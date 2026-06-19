// Dashboard controller. Runs in both the popup and the side panel.
import { getToken, signOut } from "./lib/auth.js";
import { listSites, fetchTotals, fetchDaily, fetchDimension } from "./lib/gsc.js";
import { renderTrend } from "./lib/chart.js";
import { reportUser } from "./lib/report.js";
import { CONFIG } from "./lib/config.js";
import {
  periodRange, fmtInt, fmtPct, fmtPos, pctChange, fmtDelta,
  shortDate, siteHostname, siteLabel,
} from "./lib/format.js";

const $ = (sel) => document.querySelector(sel);

const state = {
  sites: [],
  site: null,
  days: 28,
  compare: true,
  dimension: "query",
  sort: { col: "clicks", dir: -1 },
  // cache of last loaded table rows for client-side re-sorting
  tableRows: [],
  // active tab context, captured once at startup
  tabHost: null,
  windowId: null,
  signedIn: false,
};

// ---------- Boot ----------
init();

async function init() {
  bindControls();

  // If sign-in completes in the background (e.g. while this view stayed open),
  // refresh into the signed-in state automatically.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "auth:changed" && !state.signedIn) {
      getToken({ interactive: false }).then(onSignedIn).catch(() => {});
    }
  });

  try {
    await getToken({ interactive: false });
    await onSignedIn();
  } catch {
    showSignedOut();
  }
}

function showSignedOut(errMsg) {
  state.signedIn = false;
  $("#dashboard").classList.add("hidden");
  $("#signed-out").classList.remove("hidden");
  const errEl = $("#signin-error");
  if (errMsg) {
    errEl.textContent = errMsg;
    errEl.classList.remove("hidden");
  } else {
    errEl.classList.add("hidden");
  }
}

async function onSignedIn() {
  state.signedIn = true;
  $("#signed-out").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  await captureActiveTab();
  await loadSites();
  await loadData();
  await maybeReport();
}

// Report the user once consent is given. Shows a one-time notice first.
async function maybeReport() {
  const { reportConsent } = await chrome.storage.local.get("reportConsent");
  if (reportConsent) {
    sendReport();
  } else {
    $("#consent-bar").classList.remove("hidden");
  }
}

async function sendReport() {
  try {
    const token = await getToken({ interactive: false });
    await reportUser(token, state.sites);
  } catch {
    /* best-effort */
  }
}

// Read the active tab once (under the activeTab grant from the icon click) so
// we can both match a property and later open the side panel in this window.
async function captureActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.windowId = tab?.windowId ?? null;
    if (tab?.url) {
      const u = new URL(tab.url);
      state.tabHost = u.protocol.startsWith("http") ? u.hostname : null;
    }
  } catch {
    /* no tab access — fall back to last/first property */
  }
}

// ---------- Sites ----------
async function loadSites() {
  state.sites = await listSites();
  const select = $("#site-select");
  select.innerHTML = "";
  if (state.sites.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No verified properties";
    select.appendChild(opt);
    return;
  }
  for (const s of state.sites) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = siteLabel(s);
    select.appendChild(opt);
  }
  state.site = await pickInitialSite();
  select.value = state.site;
}

// Prefer (1) the property matching the current tab's domain, then
// (2) the last property the user looked at, then (3) the first one.
async function pickInitialSite() {
  const tabHost = state.tabHost;
  if (tabHost) {
    const match = state.sites.find((s) => {
      const h = siteHostname(s);
      return h === tabHost || tabHost.endsWith(`.${h}`) || h.endsWith(`.${tabHost}`);
    });
    if (match) return match;
  }
  const { lastSite } = await chrome.storage.local.get("lastSite");
  if (lastSite && state.sites.includes(lastSite)) return lastSite;
  return state.sites[0];
}

// ---------- Data ----------
async function loadData() {
  if (!state.site) return;
  setLoading(true);
  $("#error").classList.add("hidden");

  const ranges = periodRange(state.days);
  $("#range-label").textContent =
    `${shortDate(ranges.current.startDate)} – ${shortDate(ranges.current.endDate)}` +
    (state.compare
      ? `  vs  ${shortDate(ranges.previous.startDate)} – ${shortDate(ranges.previous.endDate)}`
      : "");

  try {
    const tasks = [
      fetchTotals(state.site, ranges.current),
      fetchDaily(state.site, ranges.current),
      fetchDimension(state.site, ranges.current, state.dimension),
    ];
    if (state.compare) {
      tasks.push(fetchTotals(state.site, ranges.previous));
      tasks.push(fetchDimension(state.site, ranges.previous, state.dimension));
    }
    const [totals, daily, dimRows, prevTotals, prevDimRows] = await Promise.all(tasks);

    renderCards(totals, state.compare ? prevTotals : null);
    renderTrend($("#chart"), daily);
    state.tableRows = mergeDelta(dimRows, state.compare ? prevDimRows : null);
    renderTable();

    chrome.storage.local.set({ lastSite: state.site });
  } catch (e) {
    const msg = String(e.message || e);
    if (/not signed in|401|invalid/i.test(msg)) {
      showSignedOut("Your session expired. Please sign in again.");
    } else {
      $("#error").textContent = msg;
      $("#error").classList.remove("hidden");
    }
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  $("#loading").classList.toggle("hidden", !on);
  $("#content").style.opacity = on ? 0.4 : 1;
}

// ---------- Render: cards ----------
function renderCards(t, prev) {
  const cards = [
    { label: "Clicks", value: fmtInt(t.clicks), raw: t.clicks, prev: prev?.clicks, betterUp: true },
    { label: "Impressions", value: fmtInt(t.impressions), raw: t.impressions, prev: prev?.impressions, betterUp: true },
    { label: "CTR", value: fmtPct(t.ctr), raw: t.ctr, prev: prev?.ctr, betterUp: true },
    { label: "Avg position", value: fmtPos(t.position), raw: t.position, prev: prev?.position, betterUp: false },
  ];
  $("#cards").innerHTML = cards.map((c) => {
    let delta = "";
    if (prev != null) {
      const change = pctChange(c.raw, c.prev);
      const improved = c.betterUp ? change > 0 : change < 0;
      const cls = change === 0 ? "flat" : improved ? "up" : "down";
      const arrow = change === 0 ? "" : change > 0 ? "▲" : "▼";
      delta = `<div class="delta ${cls}">${arrow} ${fmtDelta(change)}</div>`;
    }
    return `<div class="card"><div class="label">${c.label}</div><div class="value">${c.value}</div>${delta}</div>`;
  }).join("");
}

// ---------- Render: table ----------
// Attach previous-period clicks to each current row by key (for row deltas).
function mergeDelta(rows, prevRows) {
  if (!prevRows) return rows.map((r) => ({ ...r, prevClicks: null }));
  const prevMap = new Map(prevRows.map((r) => [r.key, r.clicks]));
  return rows.map((r) => ({ ...r, prevClicks: prevMap.has(r.key) ? prevMap.get(r.key) : null }));
}

function renderTable() {
  const wrap = $("#table-wrap");
  const rows = [...state.tableRows];
  if (rows.length === 0) {
    wrap.innerHTML = `<p class="empty">No data for this period.</p>`;
    return;
  }

  const { col, dir } = state.sort;
  rows.sort((a, b) => (a[col] < b[col] ? -dir : a[col] > b[col] ? dir : 0));

  const dimName = { query: "Query", page: "Page", country: "Country", device: "Device" }[state.dimension];
  const cols = [
    { key: "key", label: dimName },
    { key: "clicks", label: "Clicks" },
    { key: "impressions", label: "Impr." },
    { key: "ctr", label: "CTR" },
    { key: "position", label: "Pos." },
  ];

  const head = cols.map((c) =>
    `<th data-col="${c.key}" class="${col === c.key ? "sorted" : ""}">${c.label}</th>`
  ).join("");

  const body = rows.map((r) => {
    let deltaHtml = "";
    if (r.prevClicks != null) {
      const change = pctChange(r.clicks, r.prevClicks);
      const cls = change === 0 ? "" : change > 0 ? "up" : "down";
      deltaHtml = `<span class="row-delta ${cls}">${fmtDelta(change)}</span>`;
    }
    return `<tr>
      <td class="key" title="${escapeHtml(r.key)}">${escapeHtml(r.key)}</td>
      <td>${fmtInt(r.clicks)}${deltaHtml}</td>
      <td>${fmtInt(r.impressions)}</td>
      <td>${fmtPct(r.ctr)}</td>
      <td>${fmtPos(r.position)}</td>
    </tr>`;
  }).join("");

  wrap.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;

  wrap.querySelectorAll("th").forEach((th) => {
    th.addEventListener("click", () => {
      const c = th.dataset.col;
      if (state.sort.col === c) state.sort.dir *= -1;
      else state.sort = { col: c, dir: c === "key" || c === "position" ? 1 : -1 };
      renderTable();
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// ---------- Controls ----------
function bindControls() {
  $("#signin-btn").addEventListener("click", async () => {
    try {
      await getToken({ interactive: true });
      await onSignedIn();
    } catch (e) {
      showSignedOut(String(e.message || e));
    }
  });

  $("#signout-btn").addEventListener("click", async () => {
    await signOut();
    showSignedOut();
  });

  $("#refresh-btn").addEventListener("click", () => loadData());

  $("#consent-ok").addEventListener("click", async () => {
    await chrome.storage.local.set({ reportConsent: true });
    $("#consent-bar").classList.add("hidden");
    sendReport();
  });

  for (const id of ["#consent-privacy", "#footer-privacy"]) {
    $(id).addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: CONFIG.privacyUrl });
    });
  }

  $("#expand-btn").addEventListener("click", () => {
    // Must be called synchronously within the click gesture.
    if (state.windowId != null) {
      chrome.sidePanel.open({ windowId: state.windowId });
      window.close();
    }
  });

  $("#site-select").addEventListener("change", (e) => {
    state.site = e.target.value;
    loadData();
  });

  $("#range-group").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.days = Number(btn.dataset.days);
    setActive("#range-group", btn);
    loadData();
  });

  $("#compare-toggle").addEventListener("change", (e) => {
    state.compare = e.target.checked;
    loadData();
  });

  $("#dim-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.dimension = btn.dataset.dim;
    state.sort = { col: "clicks", dir: -1 };
    setActive("#dim-tabs", btn);
    loadData();
  });
}

function setActive(groupSel, btn) {
  $(groupSel).querySelectorAll("button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

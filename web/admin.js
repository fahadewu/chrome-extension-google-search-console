// Admin dashboard logic. Authenticates with the admin password against the
// `admin` edge function, lists apps, then renders the selected app's users.
(function () {
  const $ = (s) => document.querySelector(s);
  const base = window.ADMIN_CONFIG?.functionsBase || "";

  let users = [];
  let currentApp = null;
  let sort = { col: "last_seen", dir: -1 };

  // Keep the password only for this tab session.
  let password = sessionStorage.getItem("scp_admin_pw") || "";

  if (password) start(password);

  $("#login-btn").addEventListener("click", () => {
    const pw = $("#pw").value.trim();
    if (pw) start(pw);
  });
  $("#pw").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#login-btn").click();
  });
  $("#logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("scp_admin_pw");
    location.reload();
  });
  $("#refresh-btn").addEventListener("click", () => loadUsers(currentApp));
  $("#search").addEventListener("input", render);
  $("#app-select").addEventListener("change", (e) => loadUsers(e.target.value));

  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      sort = sort.col === col ? { col, dir: -sort.dir } : { col, dir: -1 };
      render();
    });
  });

  // Validate password + load the app list.
  async function start(pw) {
    $("#login-error").textContent = "";
    try {
      const res = await api("/admin", pw);
      if (res.status === 401) {
        $("#login-error").textContent = "Wrong password.";
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const { apps } = await res.json();

      password = pw;
      sessionStorage.setItem("scp_admin_pw", pw);

      const select = $("#app-select");
      select.innerHTML = "";
      for (const a of apps || []) {
        const opt = document.createElement("option");
        opt.value = a.slug;
        opt.textContent = `${a.name} (${a.user_count})`;
        select.appendChild(opt);
      }

      $("#login").style.display = "none";
      $("#dash").style.display = "block";

      if (apps && apps.length) {
        select.value = apps[0].slug;
        await loadUsers(apps[0].slug);
      } else {
        users = [];
        render();
      }
    } catch (e) {
      $("#login-error").textContent = String(e.message || e);
    }
  }

  async function loadUsers(appSlug) {
    if (!appSlug) return;
    currentApp = appSlug;
    try {
      const res = await api(`/admin?app=${encodeURIComponent(appSlug)}`, password);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      users = data.users || [];
      $("#stat-users").textContent = data.stats?.total ?? users.length;
      $("#stat-visits").textContent = (data.stats?.totalVisits ?? 0).toLocaleString();
      render();
    } catch (e) {
      $("#empty").style.display = "block";
      $("#empty").textContent = String(e.message || e);
    }
  }

  function api(path, pw) {
    return fetch(`${base}${path}`, { headers: { "x-admin-password": pw } });
  }

  function props(u) {
    const m = u.metadata || {};
    return Array.isArray(m.properties) ? m.properties : [];
  }

  function render() {
    const q = $("#search").value.trim().toLowerCase();
    let rows = users.slice();

    if (q) {
      rows = rows.filter((u) =>
        [u.name, u.email, ...props(u)]
          .filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }

    const { col, dir } = sort;
    rows.sort((a, b) => {
      let av = a[col], bv = b[col];
      if (col === "properties") { av = props(a).length; bv = props(b).length; }
      if (col === "name") { av = (a.name || a.email || "").toLowerCase(); bv = (b.name || b.email || "").toLowerCase(); }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });

    const tbody = $("#rows");
    tbody.innerHTML = "";
    $("#empty").style.display = rows.length ? "none" : "block";
    if (!rows.length) $("#empty").textContent = "No users yet.";

    for (const u of rows) {
      const tr = document.createElement("tr");
      tr.appendChild(userCell(u));
      tr.appendChild(td(String(u.visit_count ?? 0)));
      tr.appendChild(propsCell(props(u)));
      tr.appendChild(td(fmtDate(u.first_seen), "muted"));
      tr.appendChild(td(fmtDate(u.last_seen), "muted"));
      tbody.appendChild(tr);
    }
  }

  function userCell(u) {
    const cell = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.className = "u-cell";

    if (u.avatar_url) {
      const img = document.createElement("img");
      img.className = "u-avatar";
      img.src = u.avatar_url;
      img.referrerPolicy = "no-referrer";
      img.alt = "";
      wrap.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "u-avatar placeholder";
      ph.textContent = (u.name || u.email || "?").charAt(0).toUpperCase();
      wrap.appendChild(ph);
    }

    const meta = document.createElement("div");
    const name = document.createElement("div");
    name.className = "u-name";
    name.textContent = u.name || "(no name)";
    const email = document.createElement("div");
    email.className = "u-email";
    email.textContent = u.email || "";
    meta.appendChild(name);
    meta.appendChild(email);
    wrap.appendChild(meta);

    cell.appendChild(wrap);
    return cell;
  }

  function propsCell(list) {
    const cell = document.createElement("td");
    if (list.length === 0) {
      cell.innerHTML = '<span class="muted">—</span>';
      return cell;
    }
    const chips = document.createElement("div");
    chips.className = "chips";
    list.slice(0, 3).forEach((p) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = shorten(String(p));
      chips.appendChild(chip);
    });
    if (list.length > 3) {
      const more = document.createElement("span");
      more.className = "prop-count";
      more.textContent = `+${list.length - 3} more`;
      more.title = list.join("\n");
      chips.appendChild(more);
    }
    cell.appendChild(chips);
    return cell;
  }

  function shorten(siteUrl) {
    if (siteUrl.startsWith("sc-domain:")) return siteUrl.slice("sc-domain:".length);
    try { return new URL(siteUrl).hostname; } catch { return siteUrl; }
  }

  function td(text, cls) {
    const cell = document.createElement("td");
    if (cls) cell.className = cls;
    cell.textContent = text;
    return cell;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
})();

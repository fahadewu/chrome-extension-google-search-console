// Thin client for the Google Search Console (Webmasters) v3 API.
import { getToken, removeCachedToken } from "./auth.js";

const API_BASE = "https://www.googleapis.com/webmasters/v3";

// Wrap a fetch with auth + one automatic retry on 401 (expired token).
async function authedFetch(path, init = {}) {
  let token = await getToken({ interactive: false });
  let res = await doFetch(path, init, token);
  if (res.status === 401) {
    await removeCachedToken(token);
    token = await getToken({ interactive: false });
    res = await doFetch(path, init, token);
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message || "";
    } catch {
      /* ignore */
    }
    throw new Error(`Search Console API ${res.status}: ${detail || res.statusText}`);
  }
  return res.json();
}

function doFetch(path, init, token) {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

// List properties the signed-in user can read.
export async function listSites() {
  const data = await authedFetch("/sites");
  return (data.siteEntry || [])
    .filter((s) => s.permissionLevel && s.permissionLevel !== "siteUnverifiedUser")
    .map((s) => s.siteUrl);
}

// Run a Search Analytics query. `body` follows the API's request shape:
// { startDate, endDate, dimensions, rowLimit, ... }
export async function queryAnalytics(siteUrl, body) {
  const data = await authedFetch(
    `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return data.rows || [];
}

// Totals (clicks/impressions/ctr/position) for a date range — no dimensions.
export async function fetchTotals(siteUrl, range) {
  const rows = await queryAnalytics(siteUrl, {
    startDate: range.startDate,
    endDate: range.endDate,
  });
  const r = rows[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  };
}

// Daily series for the trend chart. Returns [{ date, clicks, impressions }].
export async function fetchDaily(siteUrl, range) {
  const rows = await queryAnalytics(siteUrl, {
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions: ["date"],
    rowLimit: 1000,
  });
  return rows.map((r) => ({
    date: r.keys[0],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
  }));
}

// Top rows for a single dimension (query | page | country | device).
// Returns [{ key, clicks, impressions, ctr, position }].
export async function fetchDimension(siteUrl, range, dimension, rowLimit = 50) {
  const rows = await queryAnalytics(siteUrl, {
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions: [dimension],
    rowLimit,
  });
  return rows.map((r) => ({
    key: r.keys[0],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
}

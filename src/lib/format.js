// Small formatting + date helpers. No dependencies.

export function isoDate(d) {
  // YYYY-MM-DD in local time (Search Console expects calendar dates).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Search Console data lags ~2-3 days. We anchor the most recent day we trust.
export function latestAvailableDate(lagDays = 3) {
  return addDays(new Date(), -lagDays);
}

// Given a number of days, return { startDate, endDate } ending at the latest
// trustworthy day, plus the equal-length previous period immediately before it.
export function periodRange(days, lagDays = 3) {
  const end = latestAvailableDate(lagDays);
  const start = addDays(end, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return {
    current: { startDate: isoDate(start), endDate: isoDate(end) },
    previous: { startDate: isoDate(prevStart), endDate: isoDate(prevEnd) },
  };
}

export function fmtInt(n) {
  return Math.round(n || 0).toLocaleString();
}

export function fmtPct(fraction, digits = 1) {
  return `${((fraction || 0) * 100).toFixed(digits)}%`;
}

export function fmtPos(n) {
  return (n || 0).toFixed(1);
}

// Percentage change between two raw values, as a signed fraction (0.12 = +12%).
export function pctChange(curr, prev) {
  if (!prev) return curr ? Infinity : 0;
  return (curr - prev) / prev;
}

// Human-readable delta label, e.g. "+12.4%" or "—".
export function fmtDelta(change) {
  if (change === 0) return "0%";
  if (change === Infinity) return "new";
  const pct = (change * 100).toFixed(1);
  return `${change > 0 ? "+" : ""}${pct}%`;
}

export function shortDate(iso) {
  // "2024-03-07" -> "Mar 7"
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[m - 1]} ${d}`;
}

// Strip a Search Console site URL to a comparable hostname.
// Handles both URL-prefix properties (https://example.com/) and
// domain properties (sc-domain:example.com).
export function siteHostname(siteUrl) {
  if (!siteUrl) return "";
  if (siteUrl.startsWith("sc-domain:")) return siteUrl.slice("sc-domain:".length);
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return siteUrl;
  }
}

// A friendly display label for a property.
export function siteLabel(siteUrl) {
  if (siteUrl.startsWith("sc-domain:")) return `${siteUrl.slice("sc-domain:".length)} (Domain)`;
  return siteUrl;
}

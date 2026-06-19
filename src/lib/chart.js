// Dependency-free dual-axis line chart rendered as inline SVG.
// Clicks and impressions are each scaled to their own range so both
// series are readable even when their magnitudes differ a lot.
import { shortDate } from "./format.js";

const NS = "http://www.w3.org/2000/svg";

function el(name, attrs) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// data: [{ date, clicks, impressions }]
export function renderTrend(container, data) {
  container.innerHTML = "";
  if (!data || data.length === 0) {
    container.textContent = "No data for this period.";
    return;
  }

  const W = container.clientWidth || 360;
  const H = 160;
  const pad = { top: 12, right: 12, bottom: 22, left: 12 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    height: H,
    class: "trend-svg",
  });

  const n = data.length;
  const x = (i) => pad.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  const series = [
    { key: "impressions", className: "line-impr" },
    { key: "clicks", className: "line-clicks" },
  ];

  for (const s of series) {
    const max = Math.max(1, ...data.map((d) => d[s.key]));
    const y = (v) => pad.top + plotH - (v / max) * plotH;

    // Area fill under the line.
    const areaPts =
      `${x(0)},${pad.top + plotH} ` +
      data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(" ") +
      ` ${x(n - 1)},${pad.top + plotH}`;
    svg.appendChild(el("polygon", { points: areaPts, class: `${s.className}-area` }));

    // Line.
    const linePts = data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(" ");
    svg.appendChild(el("polyline", { points: linePts, class: s.className, fill: "none" }));
  }

  // X axis labels: first, middle, last.
  const ticks = n === 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
  for (const i of ticks) {
    const t = el("text", {
      x: x(i),
      y: H - 6,
      class: "axis-label",
      "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle",
    });
    t.textContent = shortDate(data[i].date);
    svg.appendChild(t);
  }

  container.appendChild(svg);
}

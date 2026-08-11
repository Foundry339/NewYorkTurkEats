/**
 * Stats page logic: aggregates the live restaurant list into a few
 * tiles (total count, cuisine breakdown, borough breakdown, visits
 * over time) and renders them as plain HTML/SVG — no chart library.
 */

// NYC ZIP-code-prefix -> borough. Free-text city names in the sheet's
// addresses are inconsistent (neighborhood names, missing commas,
// concatenated strings), but the ZIP code nearly always survives, so
// classification keys off that instead of the parsed "city" field.
const BOROUGH_BY_ZIP3 = {
  100: "Manhattan",
  101: "Manhattan",
  102: "Manhattan",
  103: "Staten Island",
  104: "Bronx",
  112: "Brooklyn",
  110: "Queens",
  111: "Queens",
  113: "Queens",
  114: "Queens",
  116: "Queens",
};

// Long Island towns that share ambiguous 110xx/114xx ZIP prefixes
// with real NYC neighborhoods but are outside city limits.
const NON_NYC_HINTS = [
  "elmont",
  "floral park",
  "new hyde park",
  "garden city",
  "valley stream",
  "lynbrook",
  "rockville centre",
];

function boroughFromAddress(address) {
  const lower = (address || "").toLowerCase();
  if (NON_NYC_HINTS.some((hint) => lower.includes(hint))) return "Outside NYC";

  const zipMatch = (address || "").match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) {
    const prefix = Number(zipMatch[1].slice(0, 3));
    if (BOROUGH_BY_ZIP3[prefix]) return BOROUGH_BY_ZIP3[prefix];
  }

  if (/\bbrooklyn\b/.test(lower)) return "Brooklyn";
  if (/\bstaten island\b/.test(lower)) return "Staten Island";
  if (/\bbronx\b/.test(lower)) return "Bronx";
  if (/\bqueens\b/.test(lower)) return "Queens";
  if (/\bmanhattan\b/.test(lower) || /\bnew york,?\s*ny\b/.test(lower)) return "Manhattan";
  return "Outside NYC";
}

const NYC_BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

// Unlike cuisine (an open-ended, data-driven set), boroughs are a fixed
// set of 5 — a borough with zero visits should still show as "0" rather
// than silently disappear from the tile.
function boroughCounts(restaurants) {
  const counts = new Map(NYC_BOROUGHS.map((b) => [b, 0]));
  let outsideNyc = 0;
  restaurants.forEach((r) => {
    const borough = boroughFromAddress(r.address);
    if (counts.has(borough)) {
      counts.set(borough, counts.get(borough) + 1);
    } else {
      outsideNyc += 1;
    }
  });
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (outsideNyc > 0) rows.push(["Outside NYC", outsideNyc]);
  return rows;
}

// keysFn returns an array of tags for one item — an item can increment
// more than one bucket (e.g. "Halal/Burgers" counts toward both), so
// bucket totals are tag frequency, not a strict partition of `items`.
function topCounts(items, keysFn, limit) {
  const counts = new Map();
  items.forEach((item) => {
    const keys = keysFn(item);
    const tags = keys.length ? keys : ["Unknown"];
    tags.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
  });
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!limit || sorted.length <= limit) return sorted;
  const top = sorted.slice(0, limit);
  const otherTotal = sorted.slice(limit).reduce((sum, [, c]) => sum + c, 0);
  if (otherTotal > 0) top.push(["Other", otherTotal]);
  return top;
}

// "Halal - Burgers" -> ["Halal", "Burgers"]. Splits only on " - "
// (space-hyphen-space), the sheet's separator for genuine multi-tag
// entries; single fused-name cuisines with no hyphen ("French
// Steakhouse", "Korean Fried Chicken", "Upscale American") stay intact.
function splitCuisineTags(cuisine) {
  return (cuisine || "")
    .split(" - ")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : null; // "YYYY-MM"
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Builds a zero-filled, contiguous list of {key, label, count} from the
// earliest to the latest visit month, so gaps in activity show as a
// flat line rather than being silently skipped.
function monthlySeries(restaurants) {
  const keys = restaurants.map((r) => monthKey(r.dateVisited)).filter(Boolean).sort();
  if (keys.length === 0) return [];

  const counts = new Map();
  keys.forEach((k) => counts.set(k, (counts.get(k) || 0) + 1));

  const [startY, startM] = keys[0].split("-").map(Number);
  const [endY, endM] = keys[keys.length - 1].split("-").map(Number);

  const series = [];
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    series.push({ key, label: monthLabel(key), count: counts.get(key) || 0 });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return series;
}

// ---------- DOM builders ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function heroTile(total, sinceLabel) {
  const tile = el("div", "stat-tile stat-tile--hero");
  tile.appendChild(el("div", "stat-value", String(total)));
  tile.appendChild(el("div", "stat-label", "Restaurants Visited"));
  if (sinceLabel) tile.appendChild(el("div", "stat-caption", `Tracking visits since ${sinceLabel}`));
  return tile;
}

function barListTile(title, rows, total, options) {
  const { scrollable = false } = options || {};
  const tile = el("div", "stat-tile stat-tile--barlist");
  tile.appendChild(el("div", "stat-tile-title", title));

  const list = el("div", scrollable ? "bar-list bar-list--scroll" : "bar-list");
  const max = Math.max(...rows.map(([, count]) => count), 1);

  rows.forEach(([label, count]) => {
    const row = el("div", "bar-row");
    row.tabIndex = 0;
    const pct = total ? Math.round((count / total) * 100) : 0;
    row.setAttribute("aria-label", `${label}: ${count} restaurant${count === 1 ? "" : "s"} (${pct}%)`);

    row.appendChild(el("div", "bar-label", label));

    const track = el("div", "bar-track");
    const fill = el("div", "bar-fill");
    fill.style.width = `${(count / max) * 100}%`;
    track.appendChild(fill);
    row.appendChild(track);

    row.appendChild(el("div", "bar-value", String(count)));
    list.appendChild(row);
  });

  if (scrollable) {
    // The bottom fade hints "more below" — but once actually scrolled to
    // the end, the true last row shouldn't stay dimmed.
    const updateFade = () => {
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 2;
      list.classList.toggle("bar-list--at-bottom", atBottom);
    };
    list.addEventListener("scroll", updateFade);
    requestAnimationFrame(updateFade);
  }

  tile.appendChild(list);
  return tile;
}

const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function trendTile(series) {
  const tile = el("div", "stat-tile stat-tile--trend");
  tile.appendChild(el("div", "stat-tile-title", "Visits Over Time"));
  tile.appendChild(el("div", "stat-tile-subtitle", "Since March 2023"));

  const W = 640;
  const H = 200;
  const padTop = 28;
  const padBottom = 28;
  const padX = 8;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;

  const max = Math.max(...series.map((p) => p.count), 1);
  const stepX = series.length > 1 ? plotW / (series.length - 1) : 0;
  const xAt = (i) => padX + i * stepX;
  const yAt = (count) => padTop + plotH - (count / max) * plotH;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    class: "trend-svg",
    role: "img",
    "aria-label": "Line chart of restaurant visits per month",
  });

  // baseline
  svg.appendChild(
    svgEl("line", {
      x1: padX,
      y1: padTop + plotH,
      x2: W - padX,
      y2: padTop + plotH,
      class: "trend-baseline",
    })
  );

  const linePoints = series.map((p, i) => `${xAt(i)},${yAt(p.count)}`).join(" ");
  const areaPoints = `${padX},${padTop + plotH} ${linePoints} ${W - padX},${padTop + plotH}`;

  svg.appendChild(svgEl("polygon", { points: areaPoints, class: "trend-area" }));
  svg.appendChild(svgEl("polyline", { points: linePoints, class: "trend-line" }));

  // Year tick labels at each January (or the first point of the series).
  series.forEach((p, i) => {
    const isYearStart = p.key.endsWith("-01") || i === 0;
    if (isYearStart) {
      svg.appendChild(
        svgEl("text", {
          x: xAt(i),
          y: H - 6,
          class: "trend-tick",
        })
      ).textContent = p.key.slice(0, 4);
    }
  });

  // Direct-label the extreme (peak month) and the endpoint (latest month).
  const peakIndex = series.reduce((best, p, i) => (p.count > series[best].count ? i : best), 0);
  const lastIndex = series.length - 1;
  [peakIndex, lastIndex].forEach((i) => {
    if (series[i].count === 0) return;
    const cx = xAt(i);
    const cy = yAt(series[i].count);
    svg.appendChild(svgEl("circle", { cx, cy, r: 4, class: "trend-marker" }));
    const label = svgEl("text", {
      x: cx,
      y: cy - 10,
      class: "trend-point-label",
      "text-anchor": i === lastIndex ? "end" : "middle",
    });
    label.textContent = String(series[i].count);
    svg.appendChild(label);
  });

  // Hover/focus hit columns — one per month, wider than the line itself.
  const crosshair = svgEl("line", {
    y1: padTop,
    y2: padTop + plotH,
    class: "trend-crosshair",
    visibility: "hidden",
  });
  const hoverDot = svgEl("circle", { r: 4, class: "trend-hover-dot", visibility: "hidden" });

  const tooltip = el("div", "trend-tooltip");
  tooltip.hidden = true;
  const tooltipValue = el("div", "trend-tooltip-value");
  const tooltipLabel = el("div", "trend-tooltip-label");
  tooltip.appendChild(tooltipValue);
  tooltip.appendChild(tooltipLabel);

  const chartWrap = el("div", "trend-chart-wrap");

  function showPoint(i) {
    const p = series[i];
    const cx = xAt(i);
    crosshair.setAttribute("x1", cx);
    crosshair.setAttribute("x2", cx);
    crosshair.setAttribute("visibility", "visible");
    hoverDot.setAttribute("cx", cx);
    hoverDot.setAttribute("cy", yAt(p.count));
    hoverDot.setAttribute("visibility", "visible");

    tooltipValue.textContent = `${p.count} visit${p.count === 1 ? "" : "s"}`;
    tooltipLabel.textContent = p.label;
    tooltip.hidden = false;
    const leftPct = (cx / W) * 100;
    tooltip.style.left = `${leftPct}%`;
    tooltip.style.transform = leftPct > 80 ? "translateX(-100%)" : leftPct < 20 ? "translateX(0)" : "translateX(-50%)";
  }

  function hidePoint() {
    crosshair.setAttribute("visibility", "hidden");
    hoverDot.setAttribute("visibility", "hidden");
    tooltip.hidden = true;
  }

  series.forEach((p, i) => {
    const hitX = xAt(i) - stepX / 2;
    const hit = svgEl("rect", {
      x: Math.max(0, hitX),
      y: padTop,
      width: stepX || plotW,
      height: plotH,
      class: "trend-hit",
      tabindex: "0",
      "aria-label": `${p.label}: ${p.count} visit${p.count === 1 ? "" : "s"}`,
    });
    hit.addEventListener("pointerenter", () => showPoint(i));
    hit.addEventListener("pointermove", () => showPoint(i));
    hit.addEventListener("pointerleave", hidePoint);
    hit.addEventListener("focus", () => showPoint(i));
    hit.addEventListener("blur", hidePoint);
    svg.appendChild(hit);
  });

  svg.appendChild(crosshair);
  svg.appendChild(hoverDot);

  chartWrap.appendChild(svg);
  chartWrap.appendChild(tooltip);
  tile.appendChild(chartWrap);
  return tile;
}

// ---------- render ----------

function renderStats(restaurants) {
  const container = document.getElementById("stats-grid");
  container.innerHTML = "";

  if (restaurants.length === 0) {
    container.appendChild(el("div", "empty-state", "No restaurants yet. Add rows to the sheet."));
    return;
  }

  const sorted = [...restaurants].filter((r) => r.dateVisited).sort((a, b) => new Date(a.dateVisited) - new Date(b.dateVisited));
  const sinceLabel = sorted.length ? monthLabel(monthKey(sorted[0].dateVisited)) : null;

  container.appendChild(heroTile(restaurants.length, sinceLabel));

  const cuisineRows = topCounts(restaurants, (r) => splitCuisineTags(r.cuisine), null);
  container.appendChild(barListTile("Breakdown by Cuisine", cuisineRows, restaurants.length, { scrollable: true }));

  const boroughRows = boroughCounts(restaurants);
  container.appendChild(barListTile("Breakdown by Borough", boroughRows, restaurants.length));

  const series = monthlySeries(restaurants);
  if (series.length > 1) {
    container.appendChild(trendTile(series));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("stats-grid");
  container.innerHTML = `<div class="empty-state">Loading stats…</div>`;

  let restaurants;
  try {
    restaurants = await loadRestaurants();
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Couldn't load the stats. Please refresh to try again.</div>`;
    return;
  }

  renderStats(restaurants);
});

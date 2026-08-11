/**
 * Small shared helpers used by both app.js (directory page) and
 * detail.js (restaurant page).
 */

// Deterministic "poster" background color per restaurant, so cards
// without real photos still look visually distinct.
function posterGradient(seedStr) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 42) % 360;
  return `linear-gradient(155deg, hsl(${hue1} 55% 22%), hsl(${hue2} 55% 14%))`;
}

function initialsFor(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSlugFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

function findRestaurant(slug) {
  return RESTAURANTS.find((r) => r.slug === slug);
}

function videoEmbedUrl(restaurant) {
  const { videoPlatform, videoId } = restaurant;
  if (!videoPlatform || !videoId) return null;
  if (videoPlatform === "youtube") {
    return { url: `https://www.youtube.com/embed/${videoId}`, wide: true };
  }
  if (videoPlatform === "tiktok") {
    return { url: `https://www.tiktok.com/embed/v2/${videoId}`, wide: false };
  }
  if (videoPlatform === "instagram") {
    return { url: `https://www.instagram.com/p/${videoId}/embed`, wide: false };
  }
  return null;
}

function mapEmbedUrl(address) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

// ---------- CSV data loading ----------

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cityFromAddress(address) {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && p.toUpperCase() !== "USA");
  const stateZip = parts[parts.length - 1] || "";
  const stateMatch = stateZip.match(/^([A-Z]{2})\s+\d{5}/);
  if (stateMatch && parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${stateMatch[1]}`;
  }
  return parts[parts.length - 1] || address;
}

function isoDateFromPosted(dateStr) {
  const [month, day, year] = dateStr.split("/").map((n) => n.trim());
  if (!month || !day || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function youtubeIdFromLink(url) {
  const match = url.match(
    /(?:shorts\/|watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
  );
  return match ? match[1] : "";
}

// Minimal CSV parser: handles quoted fields, escaped "" quotes, and
// commas/newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => r.some((f) => f.trim() !== ""));
  return body.map((cols) => {
    const obj = {};
    header.forEach((h, i) => (obj[h.trim()] = (cols[i] || "").trim()));
    return obj;
  });
}

function restaurantFromCsvRow(record) {
  const name = record["Restaurant"] || "";
  const address = record["Address"] || "";
  const lat = parseFloat(record["Lat"]);
  const lon = parseFloat(record["Lon"]);
  return {
    slug: slugify(name),
    name,
    cuisine: record["Restaurant Type"] || "",
    city: cityFromAddress(address),
    address,
    dateVisited: isoDateFromPosted(record["Date Posted"] || ""),
    website: record["Restaurant Website"] || "",
    videoPlatform: "youtube",
    videoId: youtubeIdFromLink(record["Video Link"] || ""),
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
  };
}

async function loadRestaurants() {
  const response = await fetch(RESTAURANTS_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to load restaurant sheet (${response.status})`);
  }
  const text = await response.text();
  return parseCsv(text).map(restaurantFromCsvRow).filter((r) => r.name);
}

// ---------- mobile nav (hamburger dropdown) ----------

function initMobileNav() {
  const toggle = document.getElementById("menu-toggle");
  const nav = document.getElementById("mobile-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    nav.hidden = isOpen;
    toggle.setAttribute("aria-expanded", String(!isOpen));
  });

  document.addEventListener("click", (e) => {
    if (nav.hidden) return;
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    nav.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  });
}

document.addEventListener("DOMContentLoaded", initMobileNav);

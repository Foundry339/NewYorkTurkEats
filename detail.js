/**
 * Restaurant detail page logic. Reads ?slug=... from the URL, looks
 * it up in RESTAURANTS (loaded from the sheet via common.js), and
 * fills in the page.
 */

function videoSectionHtml(restaurant) {
  const embed = videoEmbedUrl(restaurant);
  const frameClass = embed && embed.wide ? "video-frame wide" : "video-frame";

  if (!embed) {
    return `
      <div class="${frameClass}">
        <div class="video-placeholder">
          No video linked yet. Add a Video Link for "${restaurant.name}"
          in the sheet to embed it here.
        </div>
      </div>
    `;
  }

  return `
    <div class="${frameClass}">
      <iframe
        src="${embed.url}"
        title="${restaurant.name} video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
      ></iframe>
    </div>
  `;
}

function mapSectionHtml(restaurant) {
  const hasAddress = Boolean(restaurant.address);
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    restaurant.address || restaurant.name
  )}`;

  const mapFrame = hasAddress
    ? `<div class="map-frame"><iframe src="${mapEmbedUrl(restaurant.address)}" title="Map"></iframe></div>`
    : `<div class="map-frame"><div class="video-placeholder">Add an address in the sheet to show a map.</div></div>`;

  return `
    <div class="map-wrap">
      ${mapFrame}
      <div class="address-card">
        <div class="label">Address</div>
        <div class="value">${restaurant.address || "Address not added yet"}</div>
        <a class="directions-link" href="${mapsLink}" target="_blank" rel="noopener">
          Get directions →
        </a>
      </div>
    </div>
  `;
}

let RESTAURANTS = [];

function setMetaDescription(text) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "description");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", text);
}

function metaDescriptionFor(restaurant) {
  const context = [restaurant.cuisine, restaurant.city].filter(Boolean).join(" in ");
  return `${restaurant.name}${context ? ` — ${context}` : ""}, featured by NewYorkTurk. Watch the video, see the address, and get directions.`;
}

async function render() {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="empty-state">Loading…</div>`;

  try {
    RESTAURANTS = await loadRestaurants();
  } catch (err) {
    app.innerHTML = `
      <a class="back-link" href="index.html">← Back to directory</a>
      <div class="empty-state">Couldn't load restaurant data. Please refresh to try again.</div>
    `;
    document.title = "NewYorkTurkEats";
    setMetaDescription("Couldn't load restaurant data from the NewYorkTurkEats directory. Please refresh to try again.");
    return;
  }

  const slug = getSlugFromQuery();
  const restaurant = slug ? findRestaurant(slug) : null;

  if (!restaurant) {
    app.innerHTML = `
      <a class="back-link" href="index.html">← Back to directory</a>
      <div class="empty-state">
        Couldn't find that restaurant. It may have been removed from the sheet.
      </div>
    `;
    document.title = "Not found — NewYorkTurkEats";
    setMetaDescription("This restaurant couldn't be found in the NewYorkTurkEats directory. It may have been removed from the sheet.");
    return;
  }

  document.title = `${restaurant.name} — NewYorkTurkEats`;
  setMetaDescription(metaDescriptionFor(restaurant));

  app.innerHTML = `
    <a class="back-link" href="index.html">← Back to directory</a>

    <div class="detail-header">
      <div>
        <h1 class="detail-name">${restaurant.name}</h1>
        <div class="detail-meta">
          <span class="pill">${restaurant.cuisine}</span>
          <span class="pill">${restaurant.city}</span>
          <span class="pill">Visited ${formatDate(restaurant.dateVisited)}</span>
        </div>
      </div>
      ${
        restaurant.website
          ? `<a class="site-btn" href="${restaurant.website}" target="_blank" rel="noopener">Visit Website ↗</a>`
          : ""
      }
    </div>

    <div class="section">
      <div class="section-title">The Video</div>
      ${videoSectionHtml(restaurant)}
    </div>

    <div class="section">
      <div class="section-title">Location</div>
      ${mapSectionHtml(restaurant)}
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", render);

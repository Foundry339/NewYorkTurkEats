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

const SITE_URL = "https://newyorkturkeats.com";
const DEFAULT_SHARE_IMAGE = `${SITE_URL}/images/android-chrome-512x512.png`;

function setMetaTag(attr, key, content) {
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setMetaDescription(text) {
  setMetaTag("name", "description", text);
}

function metaDescriptionFor(restaurant) {
  const context = [restaurant.cuisine, restaurant.city].filter(Boolean).join(" in ");
  return `${restaurant.name}${context ? ` — ${context}` : ""}, featured by NewYorkTurk. Watch the video, see the address, and get directions.`;
}

// YouTube's thumbnail makes a much better share image than the site logo
// when one is available — falls back to the logo otherwise.
function setSocialTags({ title, description, url, imageUrl, wideImage }) {
  setMetaTag("property", "og:title", title);
  setMetaTag("property", "og:description", description);
  setMetaTag("property", "og:url", url);
  setMetaTag("property", "og:image", imageUrl);
  setMetaTag("name", "twitter:card", wideImage ? "summary_large_image" : "summary");
  setMetaTag("name", "twitter:title", title);
  setMetaTag("name", "twitter:description", description);
  setMetaTag("name", "twitter:image", imageUrl);
}

function setCanonical(url) {
  let tag = document.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", url);
}

// JSON.stringify + textContent (not innerHTML) so nothing in restaurant
// data — names, addresses — can break out of the script tag.
function setStructuredData(data) {
  let tag = document.querySelector('script[type="application/ld+json"]');
  if (!tag) {
    tag = document.createElement("script");
    tag.type = "application/ld+json";
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(data);
}

function structuredDataFor(restaurant, url) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    url,
  };
  if (restaurant.cuisine) data.servesCuisine = restaurant.cuisine;
  if (restaurant.address) data.address = restaurant.address;
  if (restaurant.website) data.sameAs = restaurant.website;
  if (Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lon)) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: restaurant.lat,
      longitude: restaurant.lon,
    };
  }
  if (restaurant.videoPlatform === "youtube" && restaurant.videoId) {
    data.image = `https://img.youtube.com/vi/${restaurant.videoId}/hqdefault.jpg`;
  }
  return data;
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
    const errorDescription = "Couldn't load restaurant data from the NewYorkTurkEats directory. Please refresh to try again.";
    setMetaDescription(errorDescription);
    setCanonical(`${SITE_URL}/restaurant.html`);
    setSocialTags({
      title: "NewYorkTurkEats",
      description: errorDescription,
      url: `${SITE_URL}/restaurant.html`,
      imageUrl: DEFAULT_SHARE_IMAGE,
      wideImage: false,
    });
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
    document.title = "Not found - NewYorkTurkEats";
    const notFoundDescription = "This restaurant couldn't be found in the NewYorkTurkEats directory. It may have been removed from the sheet.";
    setMetaDescription(notFoundDescription);
    setCanonical(`${SITE_URL}/restaurant.html`);
    setSocialTags({
      title: "Not found — NewYorkTurkEats",
      description: notFoundDescription,
      url: `${SITE_URL}/restaurant.html`,
      imageUrl: DEFAULT_SHARE_IMAGE,
      wideImage: false,
    });
    return;
  }

  const pageTitle = `${restaurant.name} - NewYorkTurkEats`;
  const pageDescription = metaDescriptionFor(restaurant);
  const pageUrl = `${SITE_URL}/restaurant.html?slug=${encodeURIComponent(restaurant.slug)}`;
  const shareImage =
    restaurant.videoPlatform === "youtube" && restaurant.videoId
      ? `https://img.youtube.com/vi/${restaurant.videoId}/hqdefault.jpg`
      : DEFAULT_SHARE_IMAGE;

  document.title = pageTitle;
  setMetaDescription(pageDescription);
  setCanonical(pageUrl);
  setStructuredData(structuredDataFor(restaurant, pageUrl));
  setSocialTags({
    title: pageTitle,
    description: pageDescription,
    url: pageUrl,
    imageUrl: shareImage,
    wideImage: shareImage !== DEFAULT_SHARE_IMAGE,
  });

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

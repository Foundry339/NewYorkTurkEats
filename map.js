/**
 * Interactive Map page logic: plots every restaurant with coordinates
 * on a Leaflet + OpenStreetMap map.
 */

function popupHtml(restaurant) {
  const wrap = document.createElement("div");
  wrap.className = "map-popup";

  const name = document.createElement("div");
  name.className = "popup-name";
  name.textContent = restaurant.name;
  wrap.appendChild(name);

  const meta = document.createElement("div");
  meta.className = "popup-meta";
  meta.textContent = [restaurant.cuisine, restaurant.city].filter(Boolean).join(" · ");
  wrap.appendChild(meta);

  const link = document.createElement("a");
  link.className = "popup-link";
  link.href = `restaurant.html?slug=${encodeURIComponent(restaurant.slug)}`;
  link.textContent = "View details →";
  wrap.appendChild(link);

  return wrap;
}

document.addEventListener("DOMContentLoaded", async () => {
  const mapEl = document.getElementById("leaflet-map");

  let restaurants;
  try {
    restaurants = await loadRestaurants();
  } catch (err) {
    mapEl.outerHTML = `<div class="empty-state">Couldn't load the directory. Please refresh to try again.</div>`;
    return;
  }

  const withCoords = restaurants.filter((r) => r.lat != null && r.lon != null);

  if (withCoords.length === 0) {
    mapEl.outerHTML = `<div class="empty-state">No restaurants have coordinates yet.</div>`;
    return;
  }

  const map = L.map(mapEl);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const markers = withCoords.map((r) => {
    const marker = L.marker([r.lat, r.lon]);
    marker.bindPopup(popupHtml(r));
    marker.addTo(map);
    return marker;
  });

  const group = L.featureGroup(markers);
  map.fitBounds(group.getBounds().pad(0.12));
});

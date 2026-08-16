/**
 * Directory / browse page logic: renders the grid and handles the
 * A-Z vs Recently Visited sort toggle.
 */

const PAGE_SIZE = 30;

let currentSort = "date"; // "date" | "alpha"
let searchQuery = "";
let currentPage = 1;
let RESTAURANTS = [];

function matchesSearch(restaurant, query) {
  const haystack = [
    restaurant.name,
    restaurant.cuisine,
    restaurant.address,
    formatDate(restaurant.dateVisited),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function sortedRestaurants() {
  let list = [...RESTAURANTS];

  const query = searchQuery.trim().toLowerCase();
  if (query) {
    list = list.filter((r) => matchesSearch(r, query));
  }

  if (currentSort === "alpha") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    list.sort((a, b) => new Date(b.dateVisited) - new Date(a.dateVisited));
  }
  return list;
}

function cardHtml(restaurant, rank) {
  const gradient = posterGradient(restaurant.slug);
  const initials = initialsFor(restaurant.name);
  const thumbnail =
    restaurant.videoPlatform === "youtube" && restaurant.videoId
      ? `<img class="poster-img" src="https://img.youtube.com/vi/${restaurant.videoId}/hqdefault.jpg" alt="${escapeHtml(restaurant.name)}" loading="lazy" onerror="this.remove()" />`
      : "";
  return `
    <a class="card" href="restaurant.html?slug=${encodeURIComponent(restaurant.slug)}">
      <div class="poster" style="background:${gradient}">
        ${initials}
        ${thumbnail}
      </div>
      <div class="card-body">
        <div class="card-name">${escapeHtml(restaurant.name)}</div>
        <div class="card-meta">${escapeHtml(restaurant.cuisine)}</div>
        <div class="card-meta">${escapeHtml(restaurant.city)}</div>
        <div class="card-date">Posted ${formatDate(restaurant.dateVisited)}</div>
      </div>
    </a>
  `;
}

function renderPagination(totalItems) {
  const pagination = document.getElementById("pagination");
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  const pageButtons = Array.from({ length: totalPages }, (_, i) => i + 1)
    .map(
      (page) =>
        `<button class="page-btn${page === currentPage ? " active" : ""}" data-page="${page}">${page}</button>`
    )
    .join("");

  pagination.innerHTML = `
    <button class="page-btn page-nav" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>&larr; Prev</button>
    ${pageButtons}
    <button class="page-btn page-nav" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Next &rarr;</button>
  `;

  pagination.querySelectorAll(".page-btn:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => setPage(Number(btn.dataset.page)));
  });
}

function renderGrid() {
  const grid = document.getElementById("grid");
  const countEl = document.getElementById("result-count");
  const list = sortedRestaurants();

  const existingEmptyState = grid.nextElementSibling;
  if (existingEmptyState && existingEmptyState.classList.contains("empty-state")) {
    existingEmptyState.remove();
  }

  if (list.length === 0) {
    grid.innerHTML = "";
    const message = searchQuery.trim()
      ? "No restaurants match your search."
      : "No restaurants yet. Add rows to the sheet.";
    grid.insertAdjacentHTML("afterend", `<div class="empty-state">${message}</div>`);
    countEl.textContent = "0 restaurants";
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageList = list.slice(start, start + PAGE_SIZE);

  grid.innerHTML = pageList.map((r, i) => cardHtml(r, start + i + 1)).join("");
  countEl.textContent = `${start + 1}–${start + pageList.length} of ${list.length} restaurant${list.length === 1 ? "" : "s"}`;

  renderPagination(list.length);
}

function setPage(page) {
  currentPage = page;
  renderGrid();
  document.getElementById("grid").scrollIntoView({ behavior: "smooth", block: "start" });
}

function setSort(sort) {
  currentSort = sort;
  currentPage = 1;
  document
    .querySelectorAll(".sort-btn")
    .forEach((btn) => btn.classList.toggle("active", btn.dataset.sort === sort));
  renderGrid();
}

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => setSort(btn.dataset.sort));
  });

  document.getElementById("search-input").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    currentPage = 1;
    renderGrid();
  });

  const grid = document.getElementById("grid");
  grid.innerHTML = `<div class="empty-state">Loading directory…</div>`;

  try {
    RESTAURANTS = await loadRestaurants();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Couldn't load the directory. Please refresh to try again.</div>`;
    return;
  }

  renderGrid();
});

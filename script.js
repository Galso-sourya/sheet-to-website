/*
  REELINDEX — Google Sheets powered movie database
  Sheet ID is preconfigured. If your data is on another tab, update SHEET_GID below.
  The spreadsheet must be published to the web or accessible for public viewing.
*/
const SHEET_ID = "1QmInY3BSRC-ZA5F0tLmXO3ocSynIr_VfAJHx6AdpJIc";
const SHEET_GID = "0"; // Change this if your movie data is on another sheet tab.
const REFRESH_INTERVAL_MS = 60000;

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;
let allMovies = [];

const $ = (id) => document.getElementById(id);
const els = {
  grid: $("movieGrid"), search: $("searchInput"), actor: $("actorFilter"),
  year: $("yearFilter"), status: $("syncStatus"), message: $("message"),
  empty: $("emptyState"), result: $("resultCount"), modal: $("movieModal")
};

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += c;
  }
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}
function firstValue(obj, aliases) {
  for (const key of aliases) if (obj[key] !== undefined && String(obj[key]).trim()) return String(obj[key]).trim();
  return "";
}
function parseMovies(csv) {
  const rows = parseCSV(csv);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  const mapped = rows.slice(1).map(row => {
    const raw = {};
    headers.forEach((h, i) => raw[h] = (row[i] || "").trim());
    return {
      title: firstValue(raw, ["moviename","movie","title","filmname","film"]),
      actors: firstValue(raw, ["actorname","actor","actors","cast","starring","artist"]),
      year: firstValue(raw, ["year","releaseyear","releasedate"]),
      genre: firstValue(raw, ["genre","category","type"]),
      poster: firstValue(raw, ["posterurl","poster","imageurl","image","movieposter"]),
      description: firstValue(raw, ["description","plot","story","summary","about"])
    };
  });
  return mapped.filter(m => m.title).map((m, i) => ({...m, id: `${m.title}-${m.actors}-${i}`}));
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function safeImage(url) {
  try { const parsed = new URL(url); return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : ""; }
  catch { return ""; }
}
function posterMarkup(movie, large = false) {
  const image = safeImage(movie.poster);
  if (image) return `<img src="${escapeHTML(image)}" alt="${escapeHTML(movie.title)} poster" loading="lazy" onerror="this.remove();this.parentElement.innerHTML='<div class=&quot;poster-placeholder&quot;><span>${escapeHTML(movie.title)}</span><small>REELINDEX</small></div>'">`;
  return `<div class="poster-placeholder"><span>${escapeHTML(movie.title)}</span><small>REELINDEX</small></div>`;
}
function renderMovies(list) {
  els.grid.innerHTML = list.map(movie => `
    <article class="movie-card" data-id="${escapeHTML(movie.id)}" tabindex="0" role="button" aria-label="View ${escapeHTML(movie.title)}">
      <div class="movie-poster">${posterMarkup(movie)}${movie.year ? `<span class="year-pill">${escapeHTML(movie.year)}</span>` : ""}</div>
      <div class="movie-info"><h3 class="movie-title" title="${escapeHTML(movie.title)}">${escapeHTML(movie.title)}</h3>
      <p class="movie-actor">${escapeHTML(movie.actors || "Cast not listed")}</p>
      ${movie.genre ? `<span class="movie-genre">${escapeHTML(movie.genre)}</span>` : ""}</div>
    </article>`).join("");
  els.result.textContent = `${list.length} ${list.length === 1 ? "title" : "titles"}`;
  els.empty.classList.toggle("hidden", list.length !== 0);
  els.grid.classList.toggle("hidden", list.length === 0);
}
function populateFilters() {
  const actors = [...new Set(allMovies.flatMap(m => m.actors.split(/[,;|]/).map(a => a.trim()).filter(Boolean)))].sort((a,b)=>a.localeCompare(b));
  const years = [...new Set(allMovies.map(m=>m.year).filter(Boolean))].sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  els.actor.innerHTML = `<option value="">All actors</option>${actors.map(a=>`<option value="${escapeHTML(a)}">${escapeHTML(a)}</option>`).join("")}`;
  els.year.innerHTML = `<option value="">All years</option>${years.map(y=>`<option value="${escapeHTML(y)}">${escapeHTML(y)}</option>`).join("")}`;
  $("movieCount").textContent = allMovies.length;
  $("actorCount").textContent = actors.length;
}
function applyFilters() {
  const q = els.search.value.toLowerCase().trim(), actor = els.actor.value, year = els.year.value;
  const filtered = allMovies.filter(m => {
    const matchesQuery = !q || `${m.title} ${m.actors} ${m.genre} ${m.description}`.toLowerCase().includes(q);
    const matchesActor = !actor || m.actors.split(/[,;|]/).map(a=>a.trim()).includes(actor);
    const matchesYear = !year || m.year === year;
    return matchesQuery && matchesActor && matchesYear;
  });
  renderMovies(filtered);
}
function showMessage(text) { els.message.textContent = text; els.message.classList.remove("hidden"); }
function hideMessage() { els.message.classList.add("hidden"); }
async function loadMovies() {
  els.status.textContent = "Syncing…";
  $("refreshBtn").disabled = true;
  try {
    const response = await fetch(`${CSV_URL}&_=${Date.now()}`, {cache:"no-store"});
    if (!response.ok) throw new Error(`Google Sheets returned ${response.status}.`);
    const csv = await response.text();
    if (/^\s*</.test(csv)) throw new Error("Google returned a webpage instead of CSV. Check that the sheet is published to the web or publicly viewable.");
    const movies = parseMovies(csv);
    if (!movies.length) throw new Error("No movie rows were found. Check that the first row contains column headings such as Movie Name and Actor Name.");
    allMovies = movies;
    populateFilters();
    applyFilters();
    hideMessage();
    els.status.textContent = "Live sheet connected";
    $("lastUpdated").textContent = `Updated ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
  } catch (error) {
    els.status.textContent = "Connection issue";
    showMessage(`${error.message} If you just published the sheet, wait a minute and refresh.`);
    if (!allMovies.length) {
      els.grid.innerHTML = "";
      els.result.textContent = "Unable to load titles";
    }
  } finally { $("refreshBtn").disabled = false; }
}
function openMovie(id) {
  const movie = allMovies.find(m=>m.id===id); if (!movie) return;
  $("modalTitle").textContent = movie.title;
  $("modalMeta").textContent = [movie.year, movie.genre].filter(Boolean).join(" • ") || "Movie";
  $("modalActors").textContent = movie.actors || "Cast information not available.";
  $("modalDescription").textContent = movie.description || "No description has been added to the spreadsheet yet.";
  $("modalPoster").innerHTML = posterMarkup(movie, true);
  els.modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeMovie() { els.modal.classList.add("hidden"); document.body.style.overflow = ""; }

els.search.addEventListener("input", applyFilters);
els.actor.addEventListener("change", applyFilters);
els.year.addEventListener("change", applyFilters);
$("refreshBtn").addEventListener("click", loadMovies);
els.grid.addEventListener("click", e => { const card=e.target.closest(".movie-card"); if(card) openMovie(card.dataset.id); });
els.grid.addEventListener("keydown", e => { if((e.key==="Enter"||e.key===" ") && e.target.classList.contains("movie-card")) {e.preventDefault();openMovie(e.target.dataset.id);} });
$("modalClose").addEventListener("click", closeMovie);
$("modalBackdrop").addEventListener("click", closeMovie);
document.addEventListener("keydown", e => { if(e.key==="Escape") closeMovie(); if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();els.search.focus();} });

loadMovies();
setInterval(loadMovies, REFRESH_INTERVAL_MS);

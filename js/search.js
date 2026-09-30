(function () {
  const $ = (selector) => document.querySelector(selector);
  let allApps = [];
  const params = new URLSearchParams(location.search);
  const form = $("#search-form");
  const input = $("#search-input");
  const sort = $("#sort-select");
  const query = params.get("q") || "";
  const category = params.get("category") || "";

  function draw() {
    const needle = input.value.trim().toLocaleLowerCase();
    let matches = allApps.filter((app) => {
      const searchable = [app.name, app.shortDescription, app.description, app.category, app.version].join(" ").toLocaleLowerCase();
      return (!needle || searchable.includes(needle)) && (!category || String(app.category || "").toLocaleLowerCase() === category.toLocaleLowerCase());
    });
    if (sort.value === "latest") matches = matches.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    else if (sort.value === "name") matches = matches.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    else matches = matches.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || String(a.name || "").localeCompare(String(b.name || "")));
    $("#results-label").textContent = category ? `${matches.length} app${matches.length === 1 ? "" : "s"} in ${category}` : needle ? `${matches.length} result${matches.length === 1 ? "" : "s"} for “${input.value.trim()}”` : `${matches.length} app${matches.length === 1 ? "" : "s"} on the shelf`;
    const results = $("#search-results");
    const empty = $("#empty-state");
    results.innerHTML = matches.map(AppShelf.cardMarkup).join("");
    results.hidden = !matches.length;
    empty.hidden = Boolean(matches.length);
    AppShelf.wireImages(results);
    document.title = needle ? `Search: ${input.value.trim()} — Kage Apps` : category ? `${category} apps — Kage Apps` : "All apps — Kage Apps";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    input.value = query;
    sort.value = params.get("sort") === "latest" ? "latest" : "featured";
    try { await window.databasePromise; allApps = AppShelf.apps(); draw(); }
    catch { $("#results-label").textContent = "Could not load the app list."; $("#search-results").innerHTML = ""; }
    form.addEventListener("submit", (event) => { event.preventDefault(); const next = new URL(location.href); next.searchParams.set("q", input.value.trim()); next.searchParams.delete("category"); location.href = next.toString(); });
    input.addEventListener("input", draw);
    sort.addEventListener("change", draw);
    document.querySelectorAll(".header-search input").forEach((el) => el.addEventListener("input", () => { if (el.form) el.form.action = "search.html"; }));
  });
})();

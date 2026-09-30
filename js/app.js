(function () {
  const $ = (selector) => document.querySelector(selector);
  const showError = (target, message) => { const node = $(target); if (node) node.innerHTML = `<div class="empty-inline">${AppShelf.escapeHTML(message)}</div>`; };

  function render() {
    const apps = AppShelf.apps();
    const featured = apps.filter((app) => app.featured).slice(0, 3);
    const latest = [...apps].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0, 3);
    const featuredTarget = $("#featured-apps");
    const latestTarget = $("#latest-apps");
    if (featuredTarget) featuredTarget.innerHTML = featured.length ? featured.map(AppShelf.cardMarkup).join("") : `<div class="empty-inline">No featured apps yet. Add one in <code>database.js</code>.</div>`;
    if (latestTarget) latestTarget.innerHTML = latest.length ? latest.map(AppShelf.cardMarkup).join("") : `<div class="empty-inline">Your latest apps will show up here.</div>`;
    AppShelf.wireImages();
    const cats = [...new Set(apps.map((app) => String(app.category || "Other").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const target = $("#category-list");
    if (target) target.innerHTML = cats.length ? cats.map((cat, index) => `<a class="category-chip" style="--chip-index:${index}" href="search.html?category=${encodeURIComponent(cat)}"><span class="category-chip-icon">${["✳", "⌁", "◉", "✿"][index % 4]}</span><span>${AppShelf.escapeHTML(cat)}</span><span class="category-arrow">↗</span></a>`).join("") : `<div class="empty-inline">Categories will appear when you add apps.</div>`;
    const year = $("#year"); if (year) year.textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try { await window.databasePromise; render(); } catch { showError("#featured-apps", "Could not load the app list. Try refreshing the page."); showError("#latest-apps", "The app list is temporarily unavailable."); showError("#category-list", "The app list is temporarily unavailable."); }
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    if (id) {
      try { await window.databasePromise; renderDetail(id); } catch { showError("#app-detail", "Could not load app details. Try refreshing the page."); }
    }
    document.querySelectorAll(".header-search").forEach((form) => form.addEventListener("submit", (event) => { const input = form.querySelector("input[name=q]"); if (!input.value.trim()) event.preventDefault(); }));
    document.addEventListener("keydown", (event) => { if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) { event.preventDefault(); document.querySelector(".header-search input")?.focus(); } });
  });

  function renderDetail(id) {
    const app = AppShelf.apps().find((item) => String(item.id) === id);
    const target = $("#app-detail");
    if (!target) return;
    if (!app) { target.innerHTML = `<div class="not-found"><div class="empty-illustration">?</div><h1>We couldn’t find that app.</h1><p>The link may be old, or the app may have been removed.</p><a class="button button-dark" href="search.html">Browse all apps</a></div>`; return; }
    const download = AppShelf.validWebURL(app.downloadUrl) ? `<a class="button button-dark detail-download" href="${AppShelf.escapeHTML(app.downloadUrl)}" target="_blank" rel="noopener noreferrer" data-download="true" data-app-id="${AppShelf.escapeHTML(app.id)}"><span aria-hidden="true">↓</span> Download ${AppShelf.escapeHTML(app.name)}</a>` : `<span class="button button-disabled detail-download" aria-disabled="true">Download link not added yet</span>`;
    const website = AppShelf.validWebURL(app.websiteUrl) ? `<a class="button button-outline" href="${AppShelf.escapeHTML(app.websiteUrl)}" target="_blank" rel="noopener noreferrer">Visit website <span aria-hidden="true">↗</span></a>` : "";
    target.innerHTML = `<div class="detail-hero"><div class="detail-icon-wrap">${AppShelf.iconMarkup(app, true)}</div><div class="detail-copy"><div class="detail-label-row"><span class="detail-category">${AppShelf.escapeHTML(app.category || "App")}</span>${app.sample ? `<span class="sample-tag">Example listing</span>` : ""}</div><h1>${AppShelf.escapeHTML(app.name)}</h1><p class="detail-subtitle">${AppShelf.escapeHTML(app.shortDescription || "")}</p><div class="detail-actions">${download}${website}</div></div></div><div class="detail-lower"><section class="detail-description"><p class="eyebrow">About this app</p><h2>Made to make things a little easier.</h2><p>${AppShelf.escapeHTML(app.description || app.shortDescription || "No description has been added yet.")}</p></section><aside class="spec-card"><h2>App information</h2><dl><div><dt>Version</dt><dd>${AppShelf.escapeHTML(app.version || "—")}</dd></div><div><dt>Download size</dt><dd>${AppShelf.escapeHTML(app.size || "—")}</dd></div><div><dt>Category</dt><dd>${AppShelf.escapeHTML(app.category || "—")}</dd></div><div><dt>Last updated</dt><dd>${AppShelf.formatDate(app.updatedAt)}</dd></div></dl></aside></div>`;
    AppShelf.wireImages(target);
    document.title = `${app.name} — Kage Apps`;
  }
})();

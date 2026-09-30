(function () {
  function apps() { return Array.isArray(window.database?.apps) ? window.database.apps : []; }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function validWebURL(value) {
    try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
  }
  function paletteFor(app) {
    let total = 0; for (const ch of String(app?.id || app?.name || "app")) total = (total * 31 + ch.charCodeAt(0)) | 0;
    return Math.abs(total) % 2 ? "ink" : "paper";
  }
  function iconMarkup(app, large = false) {
    const name = escapeHTML(app?.name || "App");
    const icon = validWebURL(app?.icon) ? app.icon : "";
    const glyph = String(app?.category || app?.name || "K").trim().slice(0, 1).toUpperCase() || "K";
    return `<span class="app-icon ${large ? "app-icon-large" : ""} ${paletteFor(app)}" data-fallback="${escapeHTML((app?.name || "K").slice(0, 1).toUpperCase())}">${icon ? `<img src="${escapeHTML(icon)}" alt="${name} icon" loading="lazy" referrerpolicy="no-referrer">` : `<span class="icon-glyph" aria-hidden="true">${escapeHTML(glyph)}</span>`}</span>`;
  }
  function cardMarkup(app, index = 0) {
    const name = escapeHTML(app.name || "Untitled app");
    const id = encodeURIComponent(String(app.id || ""));
    const category = escapeHTML(app.category || "Uncategorized");
    const sample = app.sample ? `<span class="sample-tag">Example</span>` : "";
    const hasDownload = validWebURL(app.downloadUrl);
    const action = hasDownload ? `<a class="card-download" href="${escapeHTML(app.downloadUrl)}" target="_blank" rel="noopener noreferrer" data-download="true" data-app-id="${escapeHTML(app.id)}" aria-label="Download ${name}">↓</a>` : `<span class="card-download card-download-disabled" aria-label="Add a download URL to enable downloads" title="Add a download URL to enable downloads">↓</span>`;
    return `<article class="app-card" style="--card-index:${index}"><a class="card-main" href="app.html?id=${id}">${iconMarkup(app)}<div class="card-copy"><div class="card-title-line"><h3>${name}</h3>${sample}</div><p>${escapeHTML(app.shortDescription || "App details and download information.")}</p><div class="card-meta"><span>${category}</span><span class="meta-separator">·</span><span>v${escapeHTML(app.version || "—")}</span></div></div></a>${action}</article>`;
  }
  function formatDate(value) {
    if (!value) return "Not specified";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return escapeHTML(value);
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("kage-apps-theme", theme); } catch { /* Private browsing may block storage. */ }
    document.querySelectorAll(".theme-glyph").forEach((el) => { el.textContent = theme === "dark" ? "☼" : "◐"; });
  }
  function initializeTheme() {
    let saved = "light"; try { saved = localStorage.getItem("kage-apps-theme") || "light"; } catch { /* Ignore storage errors. */ }
    setTheme(saved === "dark" ? "dark" : "light");
    document.querySelectorAll(".theme-toggle").forEach((button) => button.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")));
  }
  function wireImages(root = document) {
    root.querySelectorAll(".app-icon img").forEach((img) => img.addEventListener("error", () => {
      const box = img.parentElement; img.remove(); box.innerHTML = `<span class="icon-glyph" aria-hidden="true">${escapeHTML(box.dataset.fallback || "K")}</span>`;
    }, { once: true }));
  }
  window.AppShelf = { apps, escapeHTML, validWebURL, iconMarkup, cardMarkup, formatDate, initializeTheme, wireImages };
  document.addEventListener("DOMContentLoaded", initializeTheme);
})();

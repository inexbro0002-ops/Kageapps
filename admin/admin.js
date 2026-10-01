document.addEventListener("DOMContentLoaded", async () => {
  const $ = (selector) => document.querySelector(selector);
  const apiBase = String(window.APPSHELF_API_URL || "").replace(/\/$/, "");
  const auth = window.KageAuth;
  const user = auth ? await auth.updateNavAndGuards() : null;
  if (!user) return;
  const message = $("#admin-message");
  let apps = [];
  let editingId = "";
  const storageKey = "appshelf-draft-v1";

  const setMessage = (text, type = "info") => { message.textContent = text; message.className = `admin-banner ${type}`; message.hidden = false; };
  const safeUrl = (value) => { if (!value) return true; try { return new URL(value).protocol === "https:"; } catch { return false; } };
  const clearForm = () => { $("#app-form").reset(); $("#field-original-id").value = ""; editingId = ""; $("#form-title").textContent = "Add an app"; $("#save-app").textContent = "Save draft"; $("#cancel-edit").hidden = true; };
  const saveDraft = () => { try { localStorage.setItem(storageKey, JSON.stringify(apps)); } catch {} };

  function renderList() {
    const needle = $("#admin-search").value.trim().toLowerCase();
    const visible = apps.filter((app) => [app.name, app.category, app.id, app.shortDescription].join(" ").toLowerCase().includes(needle));
    const list = $("#admin-app-list");
    list.innerHTML = visible.length ? visible.map((app) => `<div class="admin-app-row" data-id="${AppShelf.escapeHTML(app.id)}">${AppShelf.iconMarkup(app)}<div class="admin-row-name"><strong>${AppShelf.escapeHTML(app.name)}</strong><span>${AppShelf.escapeHTML(app.category || "Other")} · v${AppShelf.escapeHTML(app.version || "—")}${app.sample ? " · example" : ""}</span></div><div class="admin-row-actions"><button type="button" data-action="edit" data-id="${AppShelf.escapeHTML(app.id)}">Edit</button><button type="button" class="delete-button" data-action="delete" data-id="${AppShelf.escapeHTML(app.id)}">Delete</button></div></div>`).join("") : `<p class="loading-card">No matching apps.</p>`;
    AppShelf.wireImages(list);
  }

  function edit(app) {
    editingId = String(app.id); $("#field-original-id").value = editingId;
    const fields = { name: "name", id: "id", short: "shortDescription", description: "description", version: "version", size: "size", category: "category", updated: "updatedAt", icon: "icon", download: "downloadUrl", website: "websiteUrl" };
    for (const [input, property] of Object.entries(fields)) $(`#field-${input}`).value = app[property] || "";
    $("#field-featured").checked = Boolean(app.featured); $("#form-title").textContent = `Edit ${app.name}`; $("#save-app").textContent = "Save changes"; $("#cancel-edit").hidden = false; window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("#app-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = (id) => $(`#field-${id}`).value.trim();
    const record = { id: value("id"), name: value("name"), shortDescription: value("short"), description: value("description"), version: value("version"), size: value("size"), category: value("category"), updatedAt: value("updated") || new Date().toISOString().slice(0, 10), icon: value("icon"), downloadUrl: value("download"), websiteUrl: value("website"), featured: $("#field-featured").checked, sample: false };
    if (![record.icon, record.downloadUrl, record.websiteUrl].every(safeUrl)) return setMessage("Use valid HTTPS links, or leave optional links blank.", "error");
    if (apps.some((app) => String(app.id) === record.id && String(app.id) !== editingId)) return setMessage("That app ID is already in use. Choose a unique ID.", "error");
    apps = editingId ? apps.map((app) => String(app.id) === editingId ? record : app) : [...apps, record];
    saveDraft(); renderList(); clearForm(); setMessage("Draft saved in this browser. Publishing requires the Worker service.");
  });

  $("#admin-app-list").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const app = apps.find((item) => String(item.id) === button.dataset.id); if (!app) return;
    if (button.dataset.action === "edit") edit(app);
    if (button.dataset.action === "delete" && confirm(`Delete “${app.name}” from this draft?`)) { apps = apps.filter((item) => String(item.id) !== button.dataset.id); saveDraft(); renderList(); setMessage("App removed from the local draft."); }
  });

  $("#cancel-edit").addEventListener("click", clearForm);
  $("#new-app").addEventListener("click", () => { clearForm(); $("#field-id").value = `app-${Math.random().toString(36).slice(2, 8)}`; $("#field-updated").value = new Date().toISOString().slice(0, 10); $("#field-name").focus(); });
  $("#admin-search").addEventListener("input", renderList);
  $("#logout-button").addEventListener("click", async () => { try { await auth.signOut(); } catch (error) { setMessage(error.message || "Could not sign out.", "error"); } });

  $("#publish-button").addEventListener("click", async () => {
    const button = $("#publish-button"); const status = $("#publish-status");
    if (!apiBase || apiBase.includes("YOUR-WORKER")) { status.textContent = "Draft saved locally. GitHub publishing needs a configured Worker service."; return; }
    button.disabled = true; status.textContent = "Publishing…";
    try {
      const response = await fetch(`${apiBase}/api/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apps }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Publish failed (${response.status}).`);
      localStorage.removeItem(storageKey); status.textContent = `Published ${result.count} apps.`; setMessage("Your catalog has been published.");
    } catch (error) { status.textContent = error.message || "Could not publish."; }
    finally { button.disabled = false; }
  });

  if (!apiBase || apiBase.includes("YOUR-WORKER")) setMessage("Local draft mode: editing works. GitHub publishing needs a configured Worker service.");
  try {
    await window.databasePromise; apps = AppShelf.apps().map((app) => ({ ...app }));
    const draft = localStorage.getItem(storageKey); if (draft) { const parsed = JSON.parse(draft); if (Array.isArray(parsed)) apps = parsed; }
    renderList(); $("#publish-status").textContent = apiBase && !apiBase.includes("YOUR-WORKER") ? "Catalog editor ready." : "Drafts are saved only in this browser.";
  } catch { setMessage("The public app database could not be loaded.", "error"); }
});

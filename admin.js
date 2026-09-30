document.addEventListener("DOMContentLoaded", async () => {
  const $ = (selector) => document.querySelector(selector);
  const apiBase = String(window.APPSHELF_API_URL || "").replace(/\/$/, "");
  const token = sessionStorage.getItem("appshelf-admin-session");
  if (!token) { location.replace("catalog-login.html"); return; }
  const message = $("#admin-message");
  let apps = [];
  let editingId = "";
  const storageKey = "appshelf-draft-v1";

  const setMessage = (text, type = "info") => { message.textContent = text; message.className = `admin-banner ${type}`; message.hidden = false; };
  const saveDraft = () => { try { localStorage.setItem(storageKey, JSON.stringify(apps)); } catch { /* Draft remains in memory this session. */ } };
  const safeUrl = (value) => { if (!value) return true; try { return new URL(value).protocol === "https:"; } catch { return false; } };
  const clearForm = () => { $("#app-form").reset(); $("#field-original-id").value = ""; editingId = ""; $("#form-title").textContent = "Add an app"; $("#save-app").textContent = "Save draft"; $("#cancel-edit").hidden = true; };

  function renderList() {
    const needle = $("#admin-search").value.trim().toLowerCase();
    const visible = apps.filter((app) => [app.name, app.category, app.id, app.shortDescription].join(" ").toLowerCase().includes(needle));
    const list = $("#admin-app-list");
    list.innerHTML = visible.length ? visible.map((app, index) => `<div class="admin-app-row" data-id="${AppShelf.escapeHTML(app.id)}">${AppShelf.iconMarkup(app)}<div class="admin-row-name"><strong>${AppShelf.escapeHTML(app.name)}</strong><span>${AppShelf.escapeHTML(app.category || "Other")} · v${AppShelf.escapeHTML(app.version || "—")}${app.sample ? " · example" : ""}</span></div><div class="admin-row-actions"><button type="button" data-action="edit" data-id="${AppShelf.escapeHTML(app.id)}">Edit</button><button type="button" class="delete-button" data-action="delete" data-id="${AppShelf.escapeHTML(app.id)}">Delete</button></div></div>`).join("") : `<p class="loading-card">No matching apps.</p>`;
    AppShelf.wireImages(list);
  }

  function edit(app) {
    editingId = String(app.id); $("#field-original-id").value = editingId;
    const fields = { name: "name", id: "id", short: "shortDescription", description: "description", version: "version", size: "size", category: "category", updated: "updatedAt", icon: "icon", download: "downloadUrl", website: "websiteUrl" };
    for (const [input, property] of Object.entries(fields)) $(`#field-${input}`).value = app[property] || "";
    $("#field-featured").checked = Boolean(app.featured);
    $("#form-title").textContent = `Edit ${app.name}`; $("#save-app").textContent = "Save changes"; $("#cancel-edit").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(apps)); } catch { /* Continue in memory. */ }
    renderList();
  }

  $("#app-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = (id) => $(`#field-${id}`).value.trim();
    const record = { id: value("id"), name: value("name"), shortDescription: value("short"), description: value("description"), version: value("version"), size: value("size"), category: value("category"), updatedAt: value("updated") || new Date().toISOString().slice(0, 10), icon: value("icon"), downloadUrl: value("download"), websiteUrl: value("website"), featured: $("#field-featured").checked, sample: false };
    if (![record.icon, record.downloadUrl, record.websiteUrl].every(safeUrl)) { setMessage("Use valid HTTPS links, or leave optional links blank.", "error"); return; }
    if (apps.some((app) => String(app.id) === record.id && String(app.id) !== editingId)) { setMessage("That app ID is already in use. Choose a unique ID.", "error"); return; }
    if (editingId) apps = apps.map((app) => String(app.id) === editingId ? record : app);
    else apps.push(record);
    persist(); clearForm(); setMessage("Draft saved in this browser. Publish to send it to GitHub.", "info");
  });

  $("#admin-app-list").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const id = button.dataset.id; const app = apps.find((item) => String(item.id) === id); if (!app) return;
    if (button.dataset.action === "edit") edit(app);
    if (button.dataset.action === "delete" && confirm(`Delete “${app.name}” from this draft?`)) { apps = apps.filter((item) => String(item.id) !== id); persist(); setMessage("App removed from the local draft. Publish to update the live catalog."); }
  });

  $("#cancel-edit").addEventListener("click", clearForm);
  $("#new-app").addEventListener("click", () => { clearForm(); $("#field-id").value = `app-${Math.random().toString(36).slice(2, 8)}`; $("#field-updated").value = new Date().toISOString().slice(0, 10); $("#field-name").focus(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  $("#admin-search").addEventListener("input", renderList);
  $("#logout-button").addEventListener("click", () => { sessionStorage.removeItem("appshelf-admin-session"); location.replace("catalog-login.html"); });

  $("#publish-button").addEventListener("click", async () => {
    const button = $("#publish-button"); const status = $("#publish-status");
    if (!apiBase || apiBase.includes("YOUR-WORKER")) { status.textContent = "Set admin/config.js to your deployed Worker URL before publishing."; return; }
    if (!confirm(`Publish ${apps.length} app record${apps.length === 1 ? "" : "s"} to the configured GitHub repository?`)) return;
    button.disabled = true; status.textContent = "Publishing a new database version…";
    try {
      const response = await fetch(`${apiBase}/api/publish`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ apps }) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { sessionStorage.removeItem("appshelf-admin-session"); location.replace("catalog-login.html"); return; }
      if (!response.ok) throw new Error(result.error || `Publish failed (${response.status}).`);
      localStorage.removeItem(storageKey);
      status.textContent = `Published ${result.count} apps · database ${result.version} · commit ${result.commit?.slice(0, 7) || "created"}.`;
      setMessage("Your app catalog has been published to GitHub. Pages may take a short time to refresh.");
    } catch (error) { status.textContent = error.message || "Could not publish. Check the Worker and GitHub configuration."; }
    finally { button.disabled = false; }
  });

  $("#publish-status").textContent = "Checking admin session…";
  if (!apiBase || apiBase.includes("YOUR-WORKER")) { setMessage("Admin editing is available as a local draft. Configure and deploy worker/ before sign-in and publishing are active."); }
  try {
    const response = await fetch(`${apiBase}/api/session`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Admin session expired.");
  } catch {
    sessionStorage.removeItem("appshelf-admin-session"); location.replace("catalog-login.html"); return;
  }
  try {
    await window.databasePromise; apps = AppShelf.apps().map((app) => ({ ...app }));
    const draft = localStorage.getItem(storageKey); if (draft) { const parsed = JSON.parse(draft); if (Array.isArray(parsed)) apps = parsed; }
    renderList(); $("#publish-status").textContent = "Drafts are saved only in this browser until you publish.";
  } catch { setMessage("The public app database could not be loaded. Please check the site files.", "error"); }
});

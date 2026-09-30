document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.KageAuth;
  const client = auth?.client();
  const status = document.querySelector("[data-auth-status]");
  const content = document.querySelector("[data-admin-content]");
  const body = document.querySelector("#admin-users-list");
  const search = document.querySelector("#user-search");
  const summary = document.querySelector("#users-summary");
  if (!client) { auth?.showMessage(status, window.KageSupabase?.message || "Supabase is not configured.", "error"); return; }
  const user = await auth.updateNavAndGuards();
  if (!user || !content || content.hidden) return;
  content.hidden = false;
  const render = (rows) => {
    const needle = search.value.trim().toLocaleLowerCase();
    const filtered = rows.filter((row) => [row.username, row.email].some((value) => String(value || "").toLocaleLowerCase().includes(needle)));
    body.replaceChildren();
    if (!filtered.length) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 5; td.textContent = rows.length ? "No matching users." : "No registered users yet."; tr.append(td); body.append(tr); }
    for (const row of filtered) {
      const tr = document.createElement("tr");
      const vals = [row.username, row.email, row.created_at ? new Date(row.created_at).toLocaleDateString() : "—", String(row.download_count ?? 0), row.last_activity ? new Date(row.last_activity).toLocaleString() : "No activity"];
      for (const value of vals) { const td = document.createElement("td"); td.textContent = value; tr.append(td); }
      body.append(tr);
    }
    summary.textContent = `${filtered.length} of ${rows.length} users`;
  };
  try {
    const { data, error } = await client.rpc("admin_user_activity");
    if (error) throw error;
    const rows = data || [];
    render(rows);
    search.addEventListener("input", () => render(rows));
  } catch (error) {
    console.error("Admin user list query failed.", error);
    auth.showMessage(status, error.message || "Could not load users. Verify the migration and admin role in Supabase.", "error");
  }
});

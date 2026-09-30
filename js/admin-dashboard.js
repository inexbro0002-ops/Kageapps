document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.KageAuth;
  const client = auth?.client();
  const status = document.querySelector("[data-auth-status]");
  const content = document.querySelector("[data-admin-content]");
  if (!client) { auth?.showMessage(status, window.KageSupabase?.message || "Supabase is not configured.", "error"); return; }
  const user = await auth.updateNavAndGuards();
  if (!user || !content || content.hidden) return;
  content.hidden = false;
  const element = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const errorText = "Could not load admin data. Confirm the migration is applied and the admin role is assigned in Supabase.";
  try {
    const [usersCount, downloadsCount, recentUsers, recentDownloads] = await Promise.all([
      client.from("profiles").select("id", { count: "exact", head: true }),
      client.from("app_downloads").select("id", { count: "exact", head: true }),
      client.from("profiles").select("id,username,email,created_at").order("created_at", { ascending: false }).limit(5),
      client.from("app_downloads").select("user_id,app_name,app_id,downloaded_at").order("downloaded_at", { ascending: false }).limit(8)
    ]);
    for (const result of [usersCount, downloadsCount, recentUsers, recentDownloads]) if (result.error) throw result.error;
    document.querySelector("#admin-user-count").textContent = String(usersCount.count ?? 0);
    document.querySelector("#admin-download-count").textContent = String(downloadsCount.count ?? 0);
    const userList = document.querySelector("#admin-recent-users"); userList.replaceChildren();
    for (const row of recentUsers.data) {
      const item = element("div", "admin-activity-row");
      item.append(element("strong", "", row.username), element("span", "", row.email), element("time", "", new Date(row.created_at).toLocaleDateString()));
      userList.append(item);
    }
    if (!recentUsers.data.length) userList.append(element("p", "history-empty", "No registered users yet."));
    const profileIds = [...new Set(recentDownloads.data.map((row) => row.user_id))];
    const profileResult = profileIds.length ? await client.from("profiles").select("id,username").in("id", profileIds) : { data: [], error: null };
    if (profileResult.error) throw profileResult.error;
    const byId = new Map(profileResult.data.map((row) => [row.id, row.username]));
    const activity = document.querySelector("#admin-recent-downloads"); activity.replaceChildren();
    for (const row of recentDownloads.data) {
      const item = element("div", "admin-activity-row");
      item.append(element("strong", "", row.app_name), element("span", "", byId.get(row.user_id) || "User"), element("time", "", new Date(row.downloaded_at).toLocaleDateString()));
      activity.append(item);
    }
    if (!recentDownloads.data.length) activity.append(element("p", "history-empty", "No downloads recorded yet."));
  } catch (error) {
    console.error("Admin dashboard query failed.", error);
    auth.showMessage(status, error.message || errorText, "error");
  }
});

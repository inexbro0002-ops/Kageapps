document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.KageAuth;
  const client = auth?.client();
  const message = document.querySelector("[data-form-message]");
  const status = document.querySelector("[data-auth-status]");
  const form = document.querySelector("#profile-form");
  const content = [...document.querySelectorAll("[data-profile-content]")];
  const safeAvatar = (value) => {
    try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; }
    catch { return ""; }
  };
  try {
    const user = await auth.updateNavAndGuards();
    if (!user || !client) return;
    const [{ data: profile, error: profileError }, { data: downloads, error: downloadsError, count }] = await Promise.all([
      client.from("profiles").select("id,username,email,avatar_url,created_at").eq("id", user.id).single(),
      client.from("app_downloads").select("app_id,app_name,downloaded_at", { count: "exact" }).eq("user_id", user.id).order("downloaded_at", { ascending: false }).limit(10)
    ]);
    if (profileError) throw profileError;
    if (downloadsError) throw downloadsError;
    document.querySelector("#profile-username").textContent = profile.username;
    document.querySelector("#profile-email").textContent = profile.email || user.email || "";
    document.querySelector("#profile-created").textContent = new Date(profile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    document.querySelector("#download-count").textContent = String(count ?? downloads.length);
    document.querySelector("#profile-edit-username").value = profile.username;
    document.querySelector("#profile-edit-avatar").value = profile.avatar_url || "";
    const initial = (profile.username || "K").trim().slice(0, 1).toUpperCase();
    const initialNode = document.querySelector("#profile-initial");
    const image = document.querySelector("#profile-avatar-image");
    initialNode.textContent = initial;
    const avatarUrl = safeAvatar(profile.avatar_url || "");
    if (avatarUrl) { image.src = avatarUrl; image.hidden = false; initialNode.hidden = true; image.addEventListener("error", () => { image.hidden = true; initialNode.hidden = false; }, { once: true }); }
    const history = document.querySelector("#recent-downloads");
    history.replaceChildren();
    if (!downloads.length) { const empty = document.createElement("p"); empty.className = "history-empty"; empty.textContent = "No downloads yet. Downloaded apps will appear here."; history.append(empty); }
    for (const row of downloads) {
      const item = document.createElement("a"); item.className = "history-row"; item.href = `app.html?id=${encodeURIComponent(row.app_id)}`;
      const title = document.createElement("strong"); title.textContent = row.app_name;
      const date = document.createElement("span"); date.textContent = new Date(row.downloaded_at).toLocaleDateString();
      item.append(title, date); history.append(item);
    }
    content.forEach((el) => { el.hidden = false; });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const username = String(values.get("username") || "").trim();
      const rawAvatar = String(values.get("avatar_url") || "").trim();
      if (!username || username.length > 40) { auth.showMessage(message, "Username must be between 1 and 40 characters.", "error"); return; }
      if (rawAvatar && !safeAvatar(rawAvatar)) { auth.showMessage(message, "Use a valid HTTPS image URL or leave the field blank.", "error"); return; }
      const button = form.querySelector("[type=submit]"); button.disabled = true;
      try {
        const { error } = await client.from("profiles").update({ username, avatar_url: rawAvatar }).eq("id", user.id);
        if (error) throw error;
        document.querySelector("#profile-username").textContent = username;
        initialNode.textContent = username.slice(0, 1).toUpperCase();
        if (rawAvatar) { image.src = rawAvatar; image.hidden = false; initialNode.hidden = true; }
        else { image.removeAttribute("src"); image.hidden = true; initialNode.hidden = false; }
        auth.showMessage(message, "Profile updated.", "success");
      } catch (error) { auth.showMessage(message, error.message || "Could not update your profile.", "error"); }
      finally { button.disabled = false; }
    });
  } catch (error) {
    console.error("Profile request failed.", error);
    auth?.showMessage(status, error.message || "Could not load your profile. Check the Supabase schema and connection.", "error");
  }
});

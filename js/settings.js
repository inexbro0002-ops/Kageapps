document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.KageAuth;
  const client = auth?.client();
  const message = document.querySelector("[data-form-message]");
  const status = document.querySelector("[data-auth-status]");
  const form = document.querySelector("#password-form");
  const resetMode = new URLSearchParams(location.search).get("mode") === "reset";
  if (!client) { auth?.showMessage(status, window.KageSupabase?.message || "Supabase is not configured.", "error"); return; }
  if (resetMode) {
    document.querySelector("#settings-title").textContent = "Choose a new password";
    document.querySelector("#settings-lead").textContent = "Set a new password for your Kage Apps account.";
    try {
      const { data } = await client.auth.getSession();
      if (!data.session) throw new Error("This password reset link is invalid or expired. Request a new one from the login page.");
      form.hidden = false;
    } catch (error) { auth.showMessage(status, error.message, "error"); }
  } else {
    try {
      const user = await auth.updateNavAndGuards();
      if (!user) { location.replace(`login.html?next=${encodeURIComponent("settings.html")}`); return; }
      form.hidden = false;
    } catch (error) { auth.showMessage(status, error.message || "Please log in again.", "error"); }
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const password = String(values.get("password") || "");
    if (password.length < 8) { auth.showMessage(message, "Use a password with at least 8 characters.", "error"); return; }
    if (password !== String(values.get("confirm-password") || "")) { auth.showMessage(message, "The passwords do not match.", "error"); return; }
    const submit = form.querySelector("[type=submit]"); submit.disabled = true;
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      auth.showMessage(message, "Your password has been updated.", "success");
      form.reset();
      if (resetMode) setTimeout(() => location.replace("profile.html"), 1000);
    } catch (error) { auth.showMessage(message, error.message || "Could not update your password.", "error"); }
    finally { submit.disabled = false; }
  });
});

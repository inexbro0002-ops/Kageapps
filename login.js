document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#login-form");
  const message = document.querySelector("#login-message");
  const apiBase = String(window.APPSHELF_API_URL || "").replace(/\/$/, "");
  if (sessionStorage.getItem("appshelf-admin-session")) location.replace("catalog.html");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    const password = form.elements.password.value;
    message.hidden = true;
    if (!apiBase || apiBase.includes("YOUR-WORKER")) { message.textContent = "Set the Worker URL in admin/config.js and deploy the Worker first."; message.hidden = false; message.className = "admin-banner error"; return; }
    button.disabled = true; button.textContent = "Checking…";
    try {
      const response = await fetch(`${apiBase}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.token) throw new Error(result.error || "Sign in failed. Check the password and Worker configuration.");
      sessionStorage.setItem("appshelf-admin-session", result.token);
      location.replace("catalog.html");
    } catch (error) {
      message.textContent = error.message || "Could not reach the publishing service.";
      message.hidden = false; message.className = "admin-banner error";
    } finally { button.disabled = false; button.innerHTML = 'Sign in <span aria-hidden="true">→</span>'; form.elements.password.value = ""; }
  });
});

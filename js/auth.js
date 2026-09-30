(function () {
  const auth = () => window.KageSupabase;
  const client = () => auth()?.client;
  const $ = (selector, root = document) => root.querySelector(selector);

  function showMessage(node, text, type = "info") {
    if (!node) return;
    node.textContent = text;
    node.className = `auth-message ${type}`;
    node.hidden = false;
  }
  function safeNext(value) {
    if (!value) value = document.body.dataset.defaultNext || "index.html";
    try {
      const rootPath = new URL(document.documentElement.dataset.root || "./", location.href).pathname.replace(/\/?$/, "/");
      const url = new URL(String(value).replace(/^\/+/, ""), `${location.origin}${rootPath}`);
      if (url.origin !== location.origin || !url.pathname.startsWith(rootPath) || !/\.html$/i.test(url.pathname) || /(?:^|\/)(?:login|register)\.html$/i.test(url.pathname)) return `${rootPath}index.html`;
      return url.href;
    } catch { return "index.html"; }
  }
  function signedInHref(user) { return user ? "profile.html" : "login.html"; }
  function updateAccountLink(user) {
    document.querySelectorAll(".account-link").forEach((link) => {
      link.href = signedInHref(user);
      link.setAttribute("aria-label", user ? "Your profile" : "Log in");
      link.title = user ? "Your profile" : "Log in";
      link.textContent = user ? (String(user.user_metadata?.username || "P").trim().slice(0, 1).toUpperCase() || "P") : "↗";
      link.classList.toggle("account-link-signed-in", Boolean(user));
    });
  }
  async function hasAdminAccess(user) {
    if (!user || !client()) return false;
    const { data, error } = await client().from("profiles").select("role").eq("id", user.id).maybeSingle();
    return !error && data?.role === "admin";
  }
  async function updateAdminLinks(user) {
    const links = document.querySelectorAll("[data-admin-link]");
    if (!links.length) return;
    const allowed = await hasAdminAccess(user);
    links.forEach((link) => { link.hidden = !allowed; });
  }
  function noticeDownload(app) {
    document.querySelector(".download-notice")?.remove();
    const note = document.createElement("aside");
    note.className = "download-notice";
    note.setAttribute("role", "status");
    const text = document.createElement("p");
    text.textContent = "Please login to download and keep your download history.";
    const actions = document.createElement("div");
    actions.className = "download-notice-actions";
    const login = document.createElement("a");
    login.className = "button button-dark";
    login.href = `login.html?next=${encodeURIComponent(`app.html?id=${encodeURIComponent(app.id)}`)}`;
    login.textContent = "Log in";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "icon-button";
    close.setAttribute("aria-label", "Close message");
    close.textContent = "×";
    close.addEventListener("click", () => note.remove());
    actions.append(login, close);
    note.append(text, actions);
    document.body.append(note);
  }
  function setRememberChoice(form) {
    const checkbox = $("[name=remember]", form);
    try { localStorage.setItem("kage-apps-remember", checkbox?.checked ? "true" : "false"); } catch { /* The default remains persistent. */ }
  }
  function handleLogin(form) {
    const message = $("[data-form-message]", form);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (!client()) { showMessage(message, auth()?.message || "Supabase setup is required before sign-in can work.", "error"); return; }
      const submit = $("[type=submit]", form);
      setRememberChoice(form);
      submit.disabled = true;
      showMessage(message, "Signing in…");
      try {
        const values = new FormData(form);
        const { error } = await client().auth.signInWithPassword({ email: String(values.get("email")).trim(), password: String(values.get("password")) });
        if (error) throw error;
        location.replace(safeNext(new URLSearchParams(location.search).get("next")));
      } catch (error) { showMessage(message, error.message || "Could not sign in. Please check your email and password.", "error"); submit.disabled = false; }
    });
  }
  function handleRegister(form) {
    const message = $("[data-form-message]", form);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (!client()) { showMessage(message, auth()?.message || "Supabase setup is required before creating accounts.", "error"); return; }
      const values = new FormData(form);
      const username = String(values.get("username") || "").trim();
      const email = String(values.get("email") || "").trim();
      const password = String(values.get("password") || "");
      if (!username) return showMessage(message, "Enter a username.", "error");
      if (password.length < 8) return showMessage(message, "Use a password with at least 8 characters.", "error");
      if (password !== String(values.get("confirm-password") || "")) return showMessage(message, "The passwords do not match.", "error");
      const submit = $("[type=submit]", form);
      submit.disabled = true;
      showMessage(message, "Creating your account…");
      try {
        const { data, error } = await client().auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: new URL("login.html", location.href).href } });
        if (error) throw error;
        if (data.session) location.replace("profile.html");
        else showMessage(message, "Account created. Check your email to confirm it, then log in. Your profile is created securely when signup completes.", "success");
      } catch (error) { showMessage(message, error.message || "Could not create your account.", "error"); }
      finally { submit.disabled = false; }
    });
  }
  function handleRecovery(form) {
    const message = $("[data-form-message]", form);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (!client()) { showMessage(message, auth()?.message || "Supabase setup is required for password recovery.", "error"); return; }
      const email = String(new FormData(form).get("email") || "").trim();
      const submit = $("[type=submit]", form); submit.disabled = true;
      try {
        const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: new URL("settings.html?mode=reset", location.href).href });
        if (error) throw error;
        showMessage(message, "If an account exists for that email, a password reset link has been sent.", "success");
      } catch (error) { showMessage(message, error.message || "Could not send the reset email.", "error"); }
      finally { submit.disabled = false; }
    });
  }
  async function updateNavAndGuards() {
    if (!auth()?.configured) {
      updateAccountLink(null);
      if (document.body.dataset.requiresAuth || document.body.dataset.requiresAdmin) {
        const slot = $("[data-auth-status]");
        if (slot) showMessage(slot, auth()?.message || "Supabase is not configured.", "error");
      }
      return null;
    }
    try {
      const user = await auth().user();
      updateAccountLink(user);
      await updateAdminLinks(user);
      if ((document.body.dataset.requiresAuth || document.body.dataset.requiresAdmin) && !user) {
        const root = document.documentElement.dataset.root || "./";
        const rootPath = new URL(root, location.href).pathname.replace(/\/?$/, "/");
        const next = `${location.pathname.slice(rootPath.length)}${location.search}`;
        location.replace(`${root}login.html?next=${encodeURIComponent(next)}`);
        return null;
      }
      if (document.body.dataset.requiresAdmin && user) {
        const { data, error } = await client().from("profiles").select("role").eq("id", user.id).single();
        if (error) {
          const status = $("[data-auth-status]");
          const missingSchema = error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message || "");
          showMessage(status, missingSchema ? "The Supabase schema migration has not been applied yet. See supabase/migrations/001_kage_apps.sql." : "Could not verify administrator access. Check the Supabase schema and RLS policies.", "error");
          document.querySelectorAll("[data-admin-content]").forEach((el) => { el.hidden = true; });
          return null;
        }
        if (data?.role !== "admin") {
          const status = $("[data-auth-status]");
          showMessage(status, "Access denied. This page is only available to authorized administrators.", "error");
          document.querySelectorAll("[data-admin-content]").forEach((el) => { el.hidden = true; });
          return null;
        }
      }
      return user;
    } catch (error) {
      console.error("Authentication status check failed.", error);
      return null;
    }
  }
  async function signOut() {
    const root = document.documentElement.dataset.root || "./";
    if (!client()) return location.assign(`${root}login.html`);
    const { error } = await client().auth.signOut();
    if (error) throw error;
    location.assign(`${root}index.html`);
  }
  function setupDownloads() {
    document.addEventListener("click", async (event) => {
      const link = event.target.closest("a[data-download]");
      if (!link) return;
      event.preventDefault();
      const app = window.AppShelf?.apps().find((item) => String(item.id) === link.dataset.appId);
      if (!app || !window.AppShelf.validWebURL(app.downloadUrl)) return;
      if (!client()) { noticeDownload(app); return; }
      const popup = window.open("about:blank", "_blank");
      if (popup) { try { popup.opener = null; } catch { /* Keep the download usable if the browser blocks opener access. */ } }
      let user;
      try { user = await auth().user(); } catch { user = null; }
      if (!user) { try { popup?.close(); } catch {} noticeDownload(app); return; }
      if (popup) popup.location.replace(app.downloadUrl);
      const { error } = await client().from("app_downloads").insert({ user_id: user.id, app_id: String(app.id), app_name: String(app.name || "App") });
      if (error) {
        console.error("Download history could not be saved.", error);
        showMessage(document.querySelector("[data-form-message]") || createStatusMessage(), "The download started, but its history could not be saved. Check your Supabase setup.", "error");
      }
      if (!popup) location.assign(app.downloadUrl);
    });
  }
  function createStatusMessage() {
    let node = $(".auth-status-toast");
    if (!node) { node = document.createElement("div"); node.className = "auth-message auth-status-toast"; node.setAttribute("role", "status"); document.body.append(node); }
    return node;
  }

  window.KageAuth = { client, showMessage, safeNext, signOut, updateNavAndGuards };
  document.addEventListener("DOMContentLoaded", () => {
    const loginForm = $("#login-form");
    const recoveryForm = $("#recovery-form");
    const toggleForm = (mode) => {
      const recovery = mode === "recovery";
      if (loginForm) loginForm.hidden = recovery;
      if (recoveryForm) recoveryForm.hidden = !recovery;
      const title = $("#auth-title"); if (title) title.textContent = recovery ? "Reset password" : "Log in";
      const lead = $("#auth-lead"); if (lead) lead.textContent = recovery ? "We’ll email you a link to choose a new password." : "Sign in to download apps and keep your history in one place.";
    };
    if (new URLSearchParams(location.search).get("mode") === "recovery") toggleForm("recovery");
    document.querySelectorAll("[data-show-recovery]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); history.replaceState(null, "", "login.html?mode=recovery"); toggleForm("recovery"); }));
    document.querySelectorAll("[data-show-login]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); history.replaceState(null, "", "login.html"); toggleForm("login"); }));
    document.querySelectorAll("form[data-auth-form=login]").forEach(handleLogin);
    document.querySelectorAll("form[data-auth-form=register]").forEach(handleRegister);
    document.querySelectorAll("form[data-auth-form=recovery]").forEach(handleRecovery);
    document.querySelectorAll("[data-signout]").forEach((button) => button.addEventListener("click", async () => { try { await signOut(); } catch (error) { showMessage($("[data-form-message]"), error.message || "Could not sign out.", "error"); } }));
    setupDownloads();
    updateNavAndGuards();
    if (client()) client().auth.onAuthStateChange((_event, session) => updateAccountLink(session?.user || null));
    const page = document.body.dataset.authPage;
    if (["login", "register"].includes(page) && client()) client().auth.getSession().then(({ data }) => { if (data.session) location.replace(safeNext(new URLSearchParams(location.search).get("next"))); });
  });
})();

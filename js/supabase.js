(function () {
  const config = window.supabase;
  const url = String(window.KAGE_SUPABASE_URL || "").trim();
  const key = String(window.KAGE_SUPABASE_ANON_KEY || "").trim();
  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
  const configured = Boolean(config?.createClient && validUrl && key && !key.startsWith("YOUR-"));
  let client = null;
  if (configured) {
    const remember = () => {
      try { return localStorage.getItem("kage-apps-remember") !== "false"; }
      catch { return true; }
    };
    const storage = {
      getItem(keyName) {
        try { return remember() ? (localStorage.getItem(keyName) ?? sessionStorage.getItem(keyName)) : (sessionStorage.getItem(keyName) ?? localStorage.getItem(keyName)); }
        catch { return null; }
      },
      setItem(keyName, value) {
        try {
          if (remember()) { localStorage.setItem(keyName, value); sessionStorage.removeItem(keyName); }
          else { sessionStorage.setItem(keyName, value); localStorage.removeItem(keyName); }
        } catch { /* Auth remains functional for the current page if storage is unavailable. */ }
      },
      removeItem(keyName) {
        try { localStorage.removeItem(keyName); sessionStorage.removeItem(keyName); } catch { /* Ignore storage denial. */ }
      }
    };
    client = config.createClient(url, key, { auth: { autoRefreshToken: true, detectSessionInUrl: true, persistSession: true, storage } });
  }
  window.KageSupabase = {
    client,
    configured,
    message: configured ? "" : "Supabase is not configured yet. Add your project URL and publishable/anon key in js/supabase-config.js.",
    async session() {
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async user() { return (await this.session())?.user || null; }
  };
})();

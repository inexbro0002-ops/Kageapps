(function () {
  const root = document.documentElement.dataset.root || "./";
  const asset = (file) => new URL(file, new URL(root, document.baseURI)).toString();
  window.databasePromise = (async () => {
    const versionResponse = await fetch(`${asset("version.js")}?refresh=${Date.now()}`, { cache: "no-store" });
    if (!versionResponse.ok) throw new Error("Could not load the database version.");
    const versionText = await versionResponse.text();
    const match = versionText.match(/databaseVersion\s*=\s*["']([^"']+)["']/);
    if (!match) throw new Error("The database version marker is not valid.");
    const version = match[1];
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${asset("database.js")}?v=${encodeURIComponent(version)}`;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load the app database."));
      document.head.appendChild(script);
    });
    window.loadedDatabaseVersion = version;
    return window.database;
  })().catch((error) => {
    window.databaseLoadError = error;
    console.error(error);
    document.dispatchEvent(new CustomEvent("database-load-error", { detail: error }));
    throw error;
  });
})();

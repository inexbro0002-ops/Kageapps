const MAX_APPS = 300;
const GITHUB_API = "https://api.github.com";
const encoder = new TextEncoder();

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const headers = { "Vary": "Origin", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400" };
  if (origin && origin === env.PAGES_ORIGIN) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request, env), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function base64url(bytes) {
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function hmac(message, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}
async function verifyHmac(message, signature, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(message));
}
async function issueToken(env) {
  const payload = base64url(encoder.encode(JSON.stringify({ exp: Date.now() + 4 * 60 * 60 * 1000, scope: "publish" })));
  return `${payload}.${base64url(await hmac(payload, env.SESSION_SECRET))}`;
}
async function validToken(request, env) {
  const value = request.headers.get("Authorization") || "";
  const token = value.startsWith("Bearer ") ? value.slice(7) : "";
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  try {
    const supplied = decodeBase64url(signature);
    if (!(await verifyHmac(payload, supplied, env.SESSION_SECRET))) return false;
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64url(payload)));
    return claims.scope === "publish" && Number(claims.exp) > Date.now();
  } catch { return false; }
}
function cleanString(value, max = 2000) { return String(value ?? "").trim().slice(0, max); }
function cleanApps(value) {
  if (!Array.isArray(value) || value.length > MAX_APPS) throw new Error(`Expected an apps array with no more than ${MAX_APPS} records.`);
  const ids = new Set();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("An app entry is not valid.");
    const id = cleanString(raw.id, 80);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || ids.has(id)) throw new Error("App IDs must be unique and use letters, numbers, hyphens, or underscores.");
    ids.add(id);
    const url = (key, max = 2000) => {
      const value = cleanString(raw[key], max); if (!value) return "";
      try { const parsed = new URL(value); if (parsed.protocol !== "https:") throw new Error(); return parsed.href; }
      catch { throw new Error(`${key} must be a valid HTTPS URL.`); }
    };
    const name = cleanString(raw.name, 80), shortDescription = cleanString(raw.shortDescription, 150), category = cleanString(raw.category, 40);
    if (!name || !shortDescription || !category) throw new Error("Each app needs a name, short description, and category.");
    return { id, name, icon: url("icon"), shortDescription, description: cleanString(raw.description, 3000), version: cleanString(raw.version, 40), size: cleanString(raw.size, 40), category, downloadUrl: url("downloadUrl"), websiteUrl: url("websiteUrl"), updatedAt: /^\d{4}-\d{2}-\d{2}$/.test(raw.updatedAt || "") ? raw.updatedAt : new Date().toISOString().slice(0, 10), featured: Boolean(raw.featured) };
  });
}
function jsSafeJSON(value) {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
async function github(path, env, options = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, { ...options, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${env.GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Kage-Apps-Publisher", ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `GitHub API returned ${response.status}.`);
  return result;
}
async function publish(apps, env) {
  const owner = encodeURIComponent(env.GITHUB_OWNER), repo = encodeURIComponent(env.GITHUB_REPO), branch = env.GITHUB_BRANCH || "main";
  const ref = await github(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, env);
  const parentSha = ref.object.sha;
  const parent = await github(`/repos/${owner}/${repo}/git/commits/${parentSha}`, env);
  const version = `v${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
  const databaseSource = `// Published from the Kage Apps admin panel.\nwindow.database = ${jsSafeJSON({ apps })};\n`;
  const versionSource = `// Updated by the Kage Apps publisher.\nwindow.databaseVersion = ${JSON.stringify(version)};\n`;
  const dbBlob = await github(`/repos/${owner}/${repo}/git/blobs`, env, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: databaseSource, encoding: "utf-8" }) });
  const versionBlob = await github(`/repos/${owner}/${repo}/git/blobs`, env, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: versionSource, encoding: "utf-8" }) });
  const tree = await github(`/repos/${owner}/${repo}/git/trees`, env, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base_tree: parent.tree.sha, tree: [{ path: "database.js", mode: "100644", type: "blob", sha: dbBlob.sha }, { path: "version.js", mode: "100644", type: "blob", sha: versionBlob.sha }] }) });
  const commit = await github(`/repos/${owner}/${repo}/git/commits`, env, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `Update Kage Apps catalog (${apps.length} apps)`, tree: tree.sha, parents: [parentSha] }) });
  await github(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, env, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sha: commit.sha, force: false }) });
  return { version, commit: commit.sha, count: apps.length };
}
export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return json(request, env, { ok: true, service: "Kage Apps Publisher" });
    if (url.pathname === "/api/login" && request.method === "POST") {
      let body; try { body = await request.json(); } catch { return json(request, env, { error: "Invalid JSON." }, 400); }
      const password = String(body?.password || "");
      if (!env.ADMIN_PASSWORD || password.length < 10 || password !== env.ADMIN_PASSWORD) return json(request, env, { error: "Incorrect admin password." }, 401);
      return json(request, env, { token: await issueToken(env), expiresIn: 14400 });
    }
    if (url.pathname === "/api/session" && request.method === "GET") {
      return await validToken(request, env) ? json(request, env, { authenticated: true }) : json(request, env, { error: "Sign in again." }, 401);
    }
    if (url.pathname === "/api/publish" && request.method === "POST") {
      if (!(await validToken(request, env))) return json(request, env, { error: "Sign in again." }, 401);
      try {
        const body = await request.json();
        const apps = cleanApps(body?.apps);
        const result = await publish(apps, env);
        return json(request, env, result);
      } catch (error) {
        return json(request, env, { error: cleanString(error.message || "Publish failed.", 240) }, 400);
      }
    }
    return json(request, env, { error: "Not found." }, 404);
  }
};

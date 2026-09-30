# Kage Apps — App Download Site

A lightweight, mobile-friendly app catalog with Supabase sign-in, profiles, and download history. Public app listings remain in the GitHub-hosted `database.js`; private account data belongs in Supabase.

## Current setup status

- The Supabase project URL and a **publishable** key are configured in `js/supabase-config.js`. This key is designed to be public and is not a `service_role` key.
- Supabase Auth is reachable from the current project.
- The `profiles` and `app_downloads` tables have **not** been created yet. Apply the SQL migration below before using profiles, history, or the admin data pages.
- No user data is stored in the public app catalog.

## 1. Apply the Supabase schema

In the Supabase Dashboard for the configured project:

1. Open **SQL Editor** and create a new query.
2. Open `supabase/migrations/001_kage_apps.sql` from this project, copy its contents into the editor, and run it.
3. Confirm the `profiles` and `app_downloads` tables and their RLS policies appear in Table Editor.

The migration creates the profile row from the Supabase Auth signup trigger, locks role assignment to SQL/database administrators, restricts users to their own rows, and adds admin-only access for the dashboard. It creates no user records and does not delete existing data.

### Authorize administrators

The migration creates a locked `admin_email_allowlist` and seeds `inexbro0002@gmail.com`. A new account with that exact email is automatically given the `admin` role by the Supabase signup trigger. Existing accounts need the allowlist migration plus a one-time SQL update.

After applying the migration, add the existing Supabase project-owner email (if different) in SQL Editor:

```sql
insert into public.admin_email_allowlist (email)
values (lower(trim('your-supabase-account@example.com')))
on conflict (email) do nothing;

update public.profiles
set role = 'admin'
where lower(trim(email)) = lower(trim('your-supabase-account@example.com'));
```

The Admin link is hidden for non-admin sessions, and every admin page is protected by the Supabase role plus allowlist check. Never add a browser-side `isAdmin` flag or give the web client the Supabase `service_role` key. Admin pages use RLS-protected queries and the `admin_user_activity()` function.

## 2. Supabase Auth redirect settings

In Supabase **Authentication → URL Configuration**, add the exact site URL and callback paths used after publishing to GitHub Pages. For a project repository this usually includes:

```text
https://YOUR-USER.github.io/YOUR-REPO/
https://YOUR-USER.github.io/YOUR-REPO/login.html
https://YOUR-USER.github.io/YOUR-REPO/settings.html
```

Also add your local preview URL while testing. Email confirmation and password-reset redirects use the configured site domain.

## 3. Run locally

From the project root:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Do not open the HTML files with `file://`; the app catalog and Supabase scripts require HTTP.

## 4. Publish the site with GitHub Pages

1. Add the project files to the repository root; `index.html` is already at the root.
2. In GitHub, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select `main` and `/(root)`, and save.
4. Wait for the Pages URL to become available, then add that URL to Supabase Auth's redirect allow-list.

The site is static. Supabase's publishable key is visible by design; **RLS is what protects user data**. Never put a Supabase secret or `service_role` key in any browser file.

## 5. User flows

- `login.html`: email/password sign-in, optional remember-this-device choice, and password-reset email.
- `register.html`: username, email, password, confirmation, and validation. Supabase Auth creates the account; the database trigger creates its `profiles` row.
- `profile.html`: profile, avatar URL, account date, total downloads, and recent downloads; users can edit their own username/avatar and sign out.
- `settings.html`: change the signed-in account password or complete a reset-link flow.
- App download links require sign-in. The download opens and an `app_downloads` record is inserted for the signed-in user.
- `admin/login.html` and `admin/index.html`: Supabase-authenticated admin login/dashboard.
- `admin/users.html`: admin-only user list with email, registration date, download count, and last activity.

## 6. Public app catalog

Edit the root `database.js` `apps` array. Example:

```js
{
  id: "my-app",
  name: "My App",
  icon: "https://example.com/icon.png",
  shortDescription: "A short introduction",
  description: "Full app description",
  version: "1.0.0",
  size: "25 MB",
  category: "Tools",
  downloadUrl: "https://example.com/app.apk",
  websiteUrl: "https://example.com",
  updatedAt: "2026-09-30",
  featured: true
}
```

Use a unique ID. The site loads this public list for home, search, categories, and details. It does not contain user profiles or download history. Sample entries are examples only and have no real download URLs.

## 7. Catalog publishing admin

The original Worker-backed app-list editor is preserved separately at `admin/catalog-login.html` and `admin/catalog.html`. It still needs its Cloudflare Worker and GitHub configuration before publishing. The Supabase admin dashboard does not replace or expose GitHub tokens.

## Project layout

```text
index.html                         App discovery
app.html                           App details (?id=app001)
search.html                        Search and categories
login.html                         User login and password recovery
register.html                      Account creation
profile.html                       Profile and download history
settings.html                      Password/security settings
js/supabase-config.js              Public Supabase project URL/key only
js/supabase.js                     Supabase browser client
js/auth.js                         Sign-in, route guards, download tracking
js/profile.js                      Profile/history behavior
js/settings.js                     Password reset/change behavior
js/admin-dashboard.js              Admin dashboard queries
js/admin-users.js                  Admin users/activity query
supabase/migrations/001_kage_apps.sql Tables, triggers, admin RPC and RLS
admin/login.html                   Supabase admin sign-in
admin/index.html                   Supabase admin dashboard
admin/users.html                   Admin-only user activity
admin/catalog-login.html           Existing Worker catalog publisher login
admin/catalog.html                 Existing catalog editor
```

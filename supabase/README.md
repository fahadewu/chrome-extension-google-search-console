# Backend setup (Supabase) — multi-app

One Supabase project backs **all** your extensions/products. Each product is a
row in the `apps` table with its own ingest key; users and events are scoped per
app. Adding a future extension is just inserting a new `apps` row.

Pieces: the database schema, two edge functions (`ingest`, `admin`), and the
`ADMIN_PASSWORD` secret.

## 1. Create a project

1. Sign up at <https://supabase.com>, create a new project.
2. Note your **Project Ref** (the `abcdwxyz` in `https://abcdwxyz.supabase.co`).

## 2. Create the schema

Open **SQL Editor → New query**, paste [`schema.sql`](./schema.sql), and run it.
This creates `apps`, `app_users`, `events`, the `record_user()` / `log_event()`
functions, locks everything with row-level security, and registers this
extension.

**Set this extension's ingest key.** In the SQL editor, replace the placeholder
with a long random string and remember it (you'll paste it into the extension):

```sql
update public.apps
set ingest_key = 'PASTE_A_LONG_RANDOM_STRING'   -- e.g. from `openssl rand -hex 24`
where slug = 'search-console-peek';
```

## 3. Deploy the edge functions

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from the
repo root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Both functions handle their own auth, so disable the platform JWT check.
supabase functions deploy ingest --no-verify-jwt
supabase functions deploy admin  --no-verify-jwt
```

## 4. Set the admin password

```bash
supabase secrets set ADMIN_PASSWORD="choose-a-strong-password"
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)
Note: ingest keys live in the `apps` table (per app), **not** in secrets.

## 5. Wire up the clients

**Extension** — edit `src/lib/config.js`:

```js
ingestUrl: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest",
appSlug:   "search-console-peek",
ingestKey: "the-ingest-key-you-set-in-step-2",
privacyUrl:"https://your-deployed-site/privacy.html",
```

Reload the extension at `chrome://extensions`.

**Admin dashboard** — edit `web/config.js`:

```js
window.ADMIN_CONFIG = { functionsBase: "https://YOUR_PROJECT_REF.supabase.co/functions/v1" };
```

## 6. Test the pipeline

```bash
# Record a user (use this app's ingest key):
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest" \
  -H "content-type: application/json" -H "x-ingest-key: YOUR_INGEST_KEY" \
  -d '{"app":"search-console-peek","external_id":"test-1","email":"test@example.com",
       "name":"Test","metadata":{"properties":["https://example.com/"]}}'

# List apps (admin):
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin" \
  -H "x-admin-password: YOUR_ADMIN_PASSWORD"

# List a specific app's users:
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin?app=search-console-peek" \
  -H "x-admin-password: YOUR_ADMIN_PASSWORD"
```

Then open `web/admin.html`, sign in, and pick the app from the dropdown.

---

## Adding a future product

No backend changes needed — just:

1. Register it:
   ```sql
   insert into public.apps (slug, name, ingest_key)
   values ('my-next-extension', 'My Next Extension', 'ANOTHER_RANDOM_KEY');
   ```
2. Point that product's client at the same `ingest` endpoint with its own
   `app` slug and `ingest_key`.
3. It shows up automatically in the admin dropdown.

### Reusing the ingest contract

`POST /functions/v1/ingest` with header `x-ingest-key: <app key>`:

```jsonc
{
  "app": "my-next-extension",       // required — apps.slug
  "external_id": "stable-user-id",  // required — your id for the user
  "email": "…", "name": "…", "avatar_url": "…",  // optional profile
  "metadata": { "anything": "…", "tags": ["a","b"] }, // optional; ARRAYS accumulate, scalars overwrite
  "event": { "type": "opened", "data": { "from": "popup" } } // optional; logged to `events`
}
```

The metadata merge rule (arrays union, scalars overwrite) means counters/flags
overwrite while lists like `properties`/`tags` accumulate across visits.

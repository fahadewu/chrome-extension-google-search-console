# Backend setup (Supabase)

This stores who uses the extension and powers the admin dashboard. Three pieces:
a database table, two edge functions, and a couple of secrets.

## 1. Create a project

1. Sign up at <https://supabase.com>, create a new project.
2. Note your **Project Ref** (the `abcdwxyz` in `https://abcdwxyz.supabase.co`).

## 2. Create the table

Open **SQL Editor → New query**, paste the contents of [`schema.sql`](./schema.sql),
and run it. This creates the `app_users` table, the `record_user()` upsert
function, and locks the table with row-level security.

## 3. Deploy the edge functions

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from the
repo root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Both functions handle their own auth, so disable the platform JWT check.
supabase functions deploy report-user --no-verify-jwt
supabase functions deploy admin-users --no-verify-jwt
```

## 4. Set the secrets

```bash
# Shared key the extension sends with each report (pick any long random string).
supabase secrets set INGEST_KEY="$(openssl rand -hex 24)"

# Password for the admin dashboard.
supabase secrets set ADMIN_PASSWORD="choose-a-strong-password"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — you
don't set those.

> Print the ingest key you generated so you can paste it into the extension:
> `supabase secrets list` shows names only (not values), so capture the random
> value when you run the command above, or just choose your own string.

## 5. Wire up the clients

**Extension** — edit `src/lib/config.js`:

```js
reportUrl: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/report-user",
ingestKey: "the-INGEST_KEY-you-set",
privacyUrl: "https://your-deployed-site/privacy.html",
```

Then reload the extension at `chrome://extensions`.

**Admin dashboard** — edit `web/config.js`:

```js
window.ADMIN_CONFIG = {
  functionsBase: "https://YOUR_PROJECT_REF.supabase.co/functions/v1",
};
```

## 6. Test the pipeline

1. Open the extension, sign in, click **Got it** on the consent notice.
2. Open `web/admin.html` (locally or deployed), enter the admin password — your
   own user should appear in the table.

### Quick manual checks

```bash
# Should record a row (use your real ingest key):
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/report-user" \
  -H "content-type: application/json" -H "x-ingest-key: YOUR_INGEST_KEY" \
  -d '{"sub":"test-1","email":"test@example.com","name":"Test","properties":["https://example.com/"]}'

# Should return the user list:
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin-users" \
  -H "x-admin-password: YOUR_ADMIN_PASSWORD"
```

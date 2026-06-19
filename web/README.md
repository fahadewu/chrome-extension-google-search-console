# Website (landing page · privacy policy · admin dashboard)

Plain static files — no build step. Three pages:

| File          | Purpose                                                        |
|---------------|----------------------------------------------------------------|
| `index.html`  | Public landing page (how it works, features, your team).       |
| `privacy.html`| Privacy policy (required for the Chrome Web Store + Google API).|
| `admin.html`  | Password-gated dashboard of who uses the extension.            |
| `styles.css`  | Shared styling.                                                |
| `admin.js` / `config.js` | Dashboard logic + its Supabase URL.                 |

## Before you deploy

1. **`config.js`** — set `functionsBase` to your Supabase functions URL:
   ```js
   window.ADMIN_CONFIG = { functionsBase: "https://YOUR_PROJECT_REF.supabase.co/functions/v1" };
   ```
2. **`index.html`** — search for `TODO` and replace the team names, roles, links,
   and (once published) the Chrome Web Store URL on the "Add to Chrome" button.
3. **`privacy.html`** — set the "Last updated" date; adjust wording if your data
   practices differ from the defaults.

## Deploy (pick one)

All of these host a folder of static files for free:

- **Netlify** — drag the `web/` folder onto <https://app.netlify.com/drop>.
- **Vercel** — `vercel deploy web` (or import the repo, set root to `web`).
- **Cloudflare Pages** / **GitHub Pages** — point them at the `web/` directory.

After deploying, copy the URL of `privacy.html` into the extension's
`src/lib/config.js` (`privacyUrl`) and into your Chrome Web Store listing.

## Run locally

```bash
cd web
python3 -m http.server 5500
# open http://localhost:5500/index.html  and  /admin.html
```

> The admin dashboard talks to your deployed Supabase functions, so it works
> even when opened locally — as long as `config.js` points at them and the
> functions are deployed.

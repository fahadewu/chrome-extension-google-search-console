# Search Console Peek

A Chrome extension that shows your **Google Search Console** performance — top
queries & pages, a clicks/impressions trend, and period-over-period comparisons —
in a toolbar **popup** or Chrome's **side panel**, so you don't have to keep
opening Search Console.

It auto-selects the property that matches the domain of the tab you're on.

## What's in here

```
manifest.json          Manifest V3 config (permissions, OAuth, side panel)
src/
  app.html / app.css   The dashboard UI (shared by popup + side panel)
  app.js               Dashboard controller
  background.js         Service worker (side-panel wiring)
  lib/
    auth.js            chrome.identity sign-in / sign-out
    gsc.js             Search Console API client
    chart.js           Dependency-free SVG trend chart
    format.js          Date math + number formatting
icons/                 Generated PNG icons
scripts/make_icons.py  Regenerate the icons
```

No external libraries or CDNs — everything is local, which keeps it
Content-Security-Policy clean and easy to pass Web Store review.

---

## One-time Google setup (required)

The extension reads **your own** Search Console data, so each user signs in with
Google. You must create an OAuth client so Google knows about the extension.

### 1. Load the extension to get its ID

1. Go to `chrome://extensions`, enable **Developer mode** (top-right).
2. Click **Load unpacked** and select this folder.
3. Copy the **extension ID** shown on its card (a long string like
   `abcdefghijklmnopabcdefghijklmnop`). The ID stays stable as long as this
   folder doesn't move.

### 2. Create a Google Cloud project + enable the API

1. Open <https://console.cloud.google.com/> and create (or pick) a project.
2. Go to **APIs & Services → Library**, search **"Google Search Console API"**,
   and click **Enable**.

### 3. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen.**
2. User type **External**, fill in the app name, your email, etc.
3. Add the scope: `https://www.googleapis.com/auth/webmasters.readonly`
4. While testing, add your Google account under **Test users**.

### 4. Create the OAuth client ID

1. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
2. Application type: **Chrome Extension**.
3. Paste the **extension ID** from step 1.
4. Copy the generated client ID (ends in `.apps.googleusercontent.com`).

### 5. Drop the client ID into the manifest

Open `manifest.json` and replace the placeholder:

```json
"oauth2": {
  "client_id": "REPLACE_WITH_YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  "scopes": ["https://www.googleapis.com/auth/webmasters.readonly"]
}
```

Back on `chrome://extensions`, click the **reload** icon on the extension card.

### 6. Use it

- Click the toolbar icon → the popup opens → **Sign in with Google**.
- Use the **⇲** button to pop it out into the side panel (stays open while you browse).
- Pick a property, choose 7/28/90 days, toggle **Compare**, and switch between
  Queries / Pages / Countries / Devices.

> **Sign-in tip:** the toolbar popup can close when Google's consent window takes
> focus. If that happens, just click the icon again — Chrome has cached the
> token, so you'll be signed in. The side panel doesn't have this quirk.

---

## Publishing to the Chrome Web Store

When you upload to the [Web Store developer dashboard](https://chrome.google.com/webstore/devconsole),
Google assigns the **final** extension ID. After the first upload:

1. Copy the published extension ID.
2. Create a **new** OAuth client (type *Chrome Extension*) for that ID, or update
   the existing one, and put its client ID in `manifest.json`.
3. Submit the OAuth consent screen for **verification** (required because the
   app requests a sensitive Search Console scope and will be used by people
   outside your test-user list).

Until verification completes, only listed test users can sign in.

---

## Regenerating icons

```bash
python3 scripts/make_icons.py
```

## Notes & limits

- Search Console data lags ~2–3 days; the dashboard ends ranges at the most
  recent trustworthy day.
- Scope is **read-only** (`webmasters.readonly`) — the extension can never
  change anything in your Search Console account.
- Only the active tab's URL is read (via `activeTab`) and only to auto-select a
  matching property; nothing is sent anywhere except Google's API.

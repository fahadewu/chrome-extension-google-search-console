// Backend + links configuration. Fill these in after deploying Supabase and
// the landing site. Until ingestUrl is set, the extension simply skips
// reporting — the data views work regardless.

export const CONFIG = {
  // Your Supabase project's generic ingest endpoint, e.g.
  // https://abcdwxyz.supabase.co/functions/v1/ingest
  ingestUrl: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest",

  // This product's slug — must match a row in the `apps` table.
  appSlug: "search-console-peek",

  // Must match this app's ingest_key in the `apps` table.
  ingestKey: "REPLACE_WITH_INGEST_KEY",

  // Public privacy policy (the deployed landing site).
  privacyUrl: "https://extensions.algoramming.com/search-console-peek/privacy.html",
};

export function reportingConfigured() {
  return CONFIG.ingestUrl && !CONFIG.ingestUrl.includes("YOUR_PROJECT_REF");
}

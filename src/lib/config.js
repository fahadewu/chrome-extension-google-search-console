// Backend + links configuration. Fill these in after deploying Supabase and
// the landing site. Until reportUrl is set, the extension simply skips
// reporting — the data views work regardless.

export const CONFIG = {
  // Your Supabase project's functions base, e.g.
  // https://abcdwxyz.supabase.co/functions/v1/report-user
  reportUrl: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/report-user",

  // Must match the INGEST_KEY secret set on the Supabase function.
  ingestKey: "REPLACE_WITH_INGEST_KEY",

  // Public privacy policy (the deployed web/privacy.html).
  privacyUrl: "https://YOUR_SITE/privacy.html",
};

export function reportingConfigured() {
  return (
    CONFIG.reportUrl &&
    !CONFIG.reportUrl.includes("YOUR_PROJECT_REF")
  );
}

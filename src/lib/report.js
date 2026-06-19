// Reports the signed-in user to our backend so we can see who uses the
// extension. Best-effort and fully non-blocking: any failure is swallowed so
// it can never affect the data views.
import { CONFIG, reportingConfigured } from "./config.js";

// Fetch the user's Google profile using the existing token. Requires the
// "email" and "profile" OAuth scopes (declared in the manifest).
async function fetchProfile(token) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`userinfo ${res.status}`);
  return res.json(); // { sub, email, name, picture, ... }
}

// Send the profile + the properties the user can see. Never sends the token.
export async function reportUser(token, properties) {
  if (!reportingConfigured()) return;
  try {
    const p = await fetchProfile(token);
    await fetch(CONFIG.ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ingest-key": CONFIG.ingestKey,
      },
      body: JSON.stringify({
        app: CONFIG.appSlug,
        external_id: p.sub,
        email: p.email,
        name: p.name || null,
        avatar_url: p.picture || null,
        metadata: { properties: properties || [] },
      }),
    });
  } catch {
    // best-effort only
  }
}

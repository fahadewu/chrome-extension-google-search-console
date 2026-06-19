// Generic ingest endpoint for any app backed by this project.
// Body: {
//   app: "app-slug",
//   external_id: "stable-user-id",
//   email, name, avatar_url,        // optional profile
//   metadata: { ... },              // optional, app-specific (arrays accumulate)
//   event: { type, data }           // optional, logs a generic event too
// }
// Auth: header `x-ingest-key` must match the app's ingest_key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-ingest-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const appSlug = String(body.app ?? "");
  const externalId = String(body.external_id ?? "");
  if (!appSlug || !externalId) return json({ error: "Missing app or external_id" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Validate the per-app ingest key.
  const { data: app, error: appErr } = await supabase
    .from("apps")
    .select("ingest_key")
    .eq("slug", appSlug)
    .maybeSingle();
  if (appErr) return json({ error: appErr.message }, 500);
  if (!app) return json({ error: "Unknown app" }, 404);
  if (req.headers.get("x-ingest-key") !== app.ingest_key) {
    return json({ error: "Unauthorized" }, 401);
  }

  const metadata =
    body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  const { data: userId, error } = await supabase.rpc("record_user", {
    p_app_slug: appSlug,
    p_external_id: externalId,
    p_email: body.email ? String(body.email) : null,
    p_name: body.name ? String(body.name) : null,
    p_avatar: body.avatar_url ? String(body.avatar_url) : null,
    p_metadata: metadata,
  });
  if (error) return json({ error: error.message }, 500);

  // Optional event logging.
  const ev = body.event as { type?: unknown; data?: unknown } | undefined;
  if (ev && ev.type) {
    await supabase.rpc("log_event", {
      p_app_slug: appSlug,
      p_user_id: userId,
      p_type: String(ev.type),
      p_data: ev.data && typeof ev.data === "object" ? ev.data : {},
    });
  }

  return json({ ok: true, user_id: userId });
});

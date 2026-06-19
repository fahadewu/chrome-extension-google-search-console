// Admin read API across all apps. Gated by the ADMIN_PASSWORD secret.
//   GET /admin              -> { apps: [{ slug, name, user_count }] }
//   GET /admin?app=<slug>   -> { users: [...], stats: { total, totalVisits } }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-admin-password",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const expected = Deno.env.get("ADMIN_PASSWORD");
  if (!expected || req.headers.get("x-admin-password") !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const appSlug = url.searchParams.get("app");

  // No app specified: return the app list with per-app user counts.
  if (!appSlug) {
    const { data: apps, error } = await supabase
      .from("apps")
      .select("id, slug, name")
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 500);

    const result = [];
    for (const a of apps ?? []) {
      const { count } = await supabase
        .from("app_users")
        .select("id", { count: "exact", head: true })
        .eq("app_id", a.id);
      result.push({ slug: a.slug, name: a.name, user_count: count ?? 0 });
    }
    return json({ apps: result });
  }

  // Specific app: return its users.
  const { data: app, error: appErr } = await supabase
    .from("apps")
    .select("id")
    .eq("slug", appSlug)
    .maybeSingle();
  if (appErr) return json({ error: appErr.message }, 500);
  if (!app) return json({ error: "Unknown app" }, 404);

  const { data: users, error } = await supabase
    .from("app_users")
    .select("email, name, avatar_url, metadata, visit_count, first_seen, last_seen")
    .eq("app_id", app.id)
    .order("last_seen", { ascending: false });
  if (error) return json({ error: error.message }, 500);

  const totalVisits = (users ?? []).reduce((s, u) => s + (u.visit_count ?? 0), 0);
  return json({ users: users ?? [], stats: { total: users?.length ?? 0, totalVisits } });
});

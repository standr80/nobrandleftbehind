import type { SupabaseClient } from "@supabase/supabase-js";

// Postgres-backed stand-in for the Redis INCR/EXPIRE pattern vitaldash-app uses (see
// its app/api/load-data/route.js) — there's no Redis in this project, and a personal
// app's traffic doesn't justify provisioning one just for this. Read-then-write has a
// small race window under concurrent requests (two requests could both read the same
// count and both increment from it, undercounting slightly), same as VitalDash's own
// comment calls its Redis version: "cheap defence in depth", not a hard security
// boundary — the real protection is the 256-bit lookup-hash space being unguessable.
export async function isRateLimited(supabase: SupabaseClient, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = new Date();
  const { data } = await supabase.from("rate_limits").select("count, reset_at").eq("key", key).maybeSingle();

  if (!data || new Date(data.reset_at) < now) {
    const resetAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();
    await supabase.from("rate_limits").upsert({ key, count: 1, reset_at: resetAt });
    return false;
  }
  if (data.count >= limit) return true;
  await supabase.from("rate_limits").update({ count: data.count + 1 }).eq("key", key);
  return false;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

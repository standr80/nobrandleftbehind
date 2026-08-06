import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only: uses the service-role key for a DEDICATED Supabase project (not the
// nobrandleftbehind platform's own — see supabase-repeatafterme/migrations). Only
// ever imported from app/api/repeatafterme/*/route.ts (Next.js API routes, which
// aren't importable from client components). Next.js also never inlines non-
// NEXT_PUBLIC_-prefixed env vars into the client bundle, so even a stray client-side
// import would just see `undefined` here, not a leaked key.
export function getSyncClient(): SupabaseClient | null {
  const url = process.env.REPEATAFTERME_SUPABASE_URL;
  const key = process.env.REPEATAFTERME_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

import { getSyncClient } from "@/lib/repeatafterme/syncClient";
import { isRateLimited, clientIp } from "@/lib/repeatafterme/rateLimit";

export const runtime = "nodejs";
export const preferredRegion = ["lhr1"]; // keep data processing in London (UK)

const SAVES_PER_MINUTE = 20;
const MAX_PAYLOAD_CHARS = 500_000; // generous for a personal deck+SRS+scores export, still bounded

// Unauthenticated by design (there are no accounts) — protected by lookup-hash format
// validation, a payload size cap, and per-IP rate limiting rather than by identity.
// The server never sees the magic key or plaintext; see lib/repeatafterme/vault.ts.
export async function POST(req: Request) {
  const supabase = getSyncClient();
  if (!supabase) {
    return Response.json({ error: "Sync isn't configured on the server yet." }, { status: 500 });
  }

  let body: { lookupHash?: string; iv?: string; data?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { lookupHash, iv, data } = body;
  if (!lookupHash || !/^[0-9a-f]{64}$/.test(lookupHash)) {
    return Response.json({ error: "Invalid key." }, { status: 400 });
  }
  if (!iv || !data || typeof data !== "string") {
    return Response.json({ error: "Missing payload." }, { status: 400 });
  }
  if (data.length > MAX_PAYLOAD_CHARS) {
    return Response.json({ error: "Payload too large." }, { status: 413 });
  }

  const ip = clientIp(req);
  if (await isRateLimited(supabase, `save:${ip}`, SAVES_PER_MINUTE, 60)) {
    return Response.json({ error: "Too many requests — wait a minute and try again." }, { status: 429 });
  }

  const { error } = await supabase.from("sync_blobs").upsert({ lookup_hash: lookupHash, iv, data, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

import { getSyncClient } from "@/lib/repeatafterme/syncClient";
import { isRateLimited, clientIp } from "@/lib/repeatafterme/rateLimit";

export const runtime = "nodejs";
export const preferredRegion = ["lhr1"]; // keep data processing in London (UK)

const LOADS_PER_MINUTE = 30;

// Looks up by hash only — the caller must already have derived the hash from their
// magic key client-side. Returns the ciphertext blob; decryption happens client-side
// (see lib/repeatafterme/vault.ts). The server never sees the magic key or plaintext.
export async function POST(req: Request) {
  const supabase = getSyncClient();
  if (!supabase) {
    return Response.json({ error: "Sync isn't configured on the server yet." }, { status: 500 });
  }

  let body: { lookupHash?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { lookupHash } = body;
  if (!lookupHash || !/^[0-9a-f]{64}$/.test(lookupHash)) {
    return Response.json({ error: "Invalid key." }, { status: 400 });
  }

  const ip = clientIp(req);
  if (await isRateLimited(supabase, `load:${ip}`, LOADS_PER_MINUTE, 60)) {
    return Response.json({ error: "Too many requests — wait a minute and try again." }, { status: 429 });
  }

  const { data, error } = await supabase.from("sync_blobs").select("iv, data").eq("lookup_hash", lookupHash).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "No saved data found for that key." }, { status: 404 });
  return Response.json(data);
}

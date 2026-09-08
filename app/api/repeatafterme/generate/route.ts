import { callProvider, AiError, type AiProvider, type AiErrorKind } from "@/lib/repeatafterme/providers";

export const runtime = "nodejs";

// BYOK-only, by design (see lib/repeatafterme/providers.ts): no ANTHROPIC_API_KEY or
// equivalent is ever read from process.env here. The route just forwards the caller's
// own key to their chosen vendor for this one request.
export async function POST(req: Request) {
  let body: { provider?: AiProvider; apiKey?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { provider, apiKey, prompt } = body;
  if (!provider) return fail("unknown", 400, "No AI provider selected.");
  if (!apiKey?.trim()) return fail("no_key", 400, "No API key provided.");
  if (!prompt?.trim()) return fail("unknown", 400, "No prompt provided.");

  try {
    const text = await callProvider(provider, apiKey, prompt);
    if (!text.trim()) return fail("provider", 502, "Empty response from the AI provider.");
    return Response.json({ text });
  } catch (err) {
    if (err instanceof AiError) return fail(err.kind, STATUS[err.kind], err.message);
    return fail("unknown", 502, String((err as Error)?.message || err));
  }
}

// The kind is what the client actually renders from — it maps to a localised sentence
// (aiErrorText in i18n.ts) rather than the vendor's raw JSON. `error` rides along as a
// last-resort fallback and for anyone reading the network tab.
const STATUS: Record<AiErrorKind, number> = {
  no_key: 400,
  auth: 401,
  rate_limit: 429,
  quota: 402,
  provider: 502,
  network: 503,
  unknown: 502,
};

function fail(kind: AiErrorKind, status: number, error: string) {
  return Response.json({ error, kind }, { status });
}

// Bring-your-own-key AI text generation across the three vendors. Same contract as
// vitaldash-app/app/api/chat/route.js: the caller supplies their own key per-request,
// we never read an env var and never persist it, forwarding it straight to the
// provider for this one request. Shared by /api/repeatafterme/generate today and
// intended for Écoutez's article/comprehension generation (Sprint 6) too.

export type AiProvider = "anthropic" | "openai" | "google";

const DEFAULT_MODEL: Record<AiProvider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o-mini",
  google: "gemini-1.5-flash",
};

/** What went wrong, in terms the UI can say something useful about. The vendors all
 *  describe the same handful of failures differently (and Google answers a bad key
 *  with a 400, not a 401), so the mapping happens here, once, rather than in each
 *  caller. The client turns the kind into a localised sentence — see aiErrorText()
 *  in i18n.ts — and never shows the vendor's raw JSON. */
export type AiErrorKind = "no_key" | "auth" | "rate_limit" | "quota" | "provider" | "network" | "unknown";

export class AiError extends Error {
  kind: AiErrorKind;
  status: number;
  constructor(kind: AiErrorKind, status: number, message: string) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.status = status;
  }
}

/** All three vendors nest a human-readable string at error.message. Pull it out for
 *  the "unknown" case so even the fallback reads as a sentence rather than a blob. */
function vendorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const msg = parsed?.error?.message ?? parsed?.message;
    if (typeof msg === "string" && msg.trim()) {
      return msg.length > 160 ? msg.slice(0, 157) + "…" : msg;
    }
  } catch {
    // not JSON — fall through
  }
  return body.length > 160 ? body.slice(0, 157) + "…" : body;
}

function classify(provider: AiProvider, status: number, body: string): AiErrorKind {
  const lower = body.toLowerCase();

  if (status === 401 || status === 403) return "auth";

  // Google reports an invalid key as 400 INVALID_ARGUMENT rather than 401, so status
  // alone can't tell an expired key from a malformed request.
  if (status === 400 && provider === "google" && /api[ _-]?key/.test(lower)) return "auth";
  if (status === 400 && /api[ _-]?key|invalid[ _-]?x[ _-]?api[ _-]?key|authentication/.test(lower)) return "auth";

  // Out of credit arrives as a 429 alongside ordinary rate limiting, and the two need
  // different advice — waiting doesn't fix an empty account.
  if (status === 429) return /quota|insufficient|billing|credit/.test(lower) ? "quota" : "rate_limit";

  if (status >= 500) return "provider";
  return "unknown";
}

async function failed(provider: AiProvider, res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  throw new AiError(classify(provider, res.status, body), res.status, vendorMessage(body));
}

export async function callProvider(provider: AiProvider, apiKey: string, prompt: string, maxTokens = 3000): Promise<string> {
  try {
    return await call(provider, apiKey, prompt, maxTokens);
  } catch (err) {
    if (err instanceof AiError) throw err;
    // fetch() rejects rather than resolving when the request never reaches the
    // vendor at all — offline, DNS failure, TLS refusal.
    throw new AiError("network", 0, String((err as Error)?.message || err));
  }
}

async function call(provider: AiProvider, apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: DEFAULT_MODEL.anthropic,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) await failed("anthropic", res);
    const data = await res.json();
    return (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEFAULT_MODEL.openai,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) await failed("openai", res);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  if (provider === "google") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL.google}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      }
    );
    if (!res.ok) await failed("google", res);
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts || []).map((p: { text: string }) => p.text).join("\n");
  }

  throw new AiError("unknown", 400, "Unknown AI provider.");
}

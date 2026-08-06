import { callProvider, type AiProvider } from "@/lib/repeatafterme/providers";

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
  if (!provider) return Response.json({ error: "No AI provider selected." }, { status: 400 });
  if (!apiKey?.trim()) return Response.json({ error: "No API key provided. Add one in AI settings." }, { status: 400 });
  if (!prompt?.trim()) return Response.json({ error: "No prompt provided." }, { status: 400 });

  try {
    const text = await callProvider(provider, apiKey, prompt);
    if (!text.trim()) return Response.json({ error: "Empty response from the AI provider." }, { status: 502 });
    return Response.json({ text });
  } catch (err) {
    return Response.json({ error: String((err as Error)?.message || err) }, { status: 502 });
  }
}

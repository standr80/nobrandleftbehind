export const runtime = "nodejs";
export const preferredRegion = ["lhr1"]; // keep request handling in London (UK)

// BYOK, OpenAI only in v1 (the one BYOK vendor here with a simple single-call TTS
// endpoint — see the plan's Sprint 7 scoping note). Same contract as
// /api/repeatafterme/generate: the caller's own key, forwarded for this one request,
// never read from an env var, never persisted.
export async function POST(req: Request) {
  let body: { apiKey?: string; text?: string; speed?: number; voice?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { apiKey, text, speed, voice } = body;
  if (!apiKey?.trim()) return Response.json({ error: "No API key provided." }, { status: 400 });
  if (!text?.trim()) return Response.json({ error: "No text provided." }, { status: 400 });
  if (text.length > 4096) return Response.json({ error: "Text too long for a single TTS request." }, { status: 413 });

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "tts-1",
        voice: voice || "alloy",
        input: text,
        speed: Math.min(4, Math.max(0.25, speed ?? 1)),
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ error: `OpenAI TTS error (${res.status}): ${errText}` }, { status: 502 });
    }
    const audio = await res.arrayBuffer();
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (err) {
    return Response.json({ error: String((err as Error)?.message || err) }, { status: 502 });
  }
}

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

export async function callProvider(provider: AiProvider, apiKey: string, prompt: string, maxTokens = 3000): Promise<string> {
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
    if (!res.ok) throw new Error(`Anthropic error (${res.status}): ${await res.text()}`);
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
    if (!res.ok) throw new Error(`OpenAI error (${res.status}): ${await res.text()}`);
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
    if (!res.ok) throw new Error(`Google error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts || []).map((p: { text: string }) => p.text).join("\n");
  }

  throw new Error("Unknown AI provider.");
}

import Anthropic from '@anthropic-ai/sdk'

/**
 * Shared Anthropic client.
 *
 * `maxRetries` is raised above the SDK default (2) because Scout and Clem fire
 * many calls and the API intermittently returns transient overload errors —
 * 429, 5xx, and especially 529 `overloaded_error` (which come back with
 * `x-should-retry: true`). The SDK retries these automatically with exponential
 * backoff; allowing more attempts rides out brief overload spikes instead of
 * failing a whole Scout run or Clem draft.
 *
 * Use this everywhere instead of constructing `new Anthropic(...)` per module,
 * so retry/timeout policy is configured in one place.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 4,
})

/**
 * True for transient Anthropic conditions that the caller should just retry
 * later: 429 (rate limit), 503, and 529 `overloaded_error`. These are the
 * provider being momentarily at capacity, not a bug in our request.
 */
export function isOverloadError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  if (status === 429 || status === 503 || status === 529) return true
  const msg = err instanceof Error ? err.message : String(err)
  return /overloaded|rate.?limit|too many requests/i.test(msg)
}

/**
 * Map any error from an Anthropic-backed call to a user-facing message + HTTP
 * status. Overload/rate-limit errors become a friendly 503 "try again" instead
 * of an opaque "529 ... Overloaded".
 */
export function aiErrorResponse(err: unknown): { error: string; status: number } {
  if (isOverloadError(err)) {
    return {
      error: 'The AI service is busy right now (temporarily overloaded). Please try again in a minute.',
      status: 503,
    }
  }
  return { error: err instanceof Error ? err.message : String(err), status: 500 }
}

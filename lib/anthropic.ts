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

# FAQ Topics rebuild — plan

Reworks the FAQ section so **Topics** and **Questions** are separate first-class
things. A Topic is a planned FAQ page; Questions live in a pool and are assigned
to topics. Decisions locked in with Richard:

- **Assignment:** many-to-many while *planning*; **converge to one page per question at generation** (a question used by a generated topic is locked to that page and removed from other topics — "move", not "copy" — to avoid duplicate-content).
- **CSV import:** two columns (Question, Answer) → answers used **verbatim**, no LLM rewrite.

## Data model

- **`faq_topics`** — id, tenant_id, name, `cluster_id` (optional → hub-and-spoke money page), `generated_post_id` (→ the FAQ blog_post once built), status (`draft` | `generated`), created_at.
- **`faq_topic_questions`** — join table (topic_id, question_id, position) for many-to-many + ordering.
- **`faq_questions`** — add `answer text` (optional verbatim answer, for manual Q&A and CSV import). Existing columns unchanged.

## Screen flow (the UI target)

Two clear areas:

1. **Topics** — list of FAQ topics (Draft / Generated + link to live page). A **Create FAQ Topic** button. Inside a topic: its assigned questions (add/remove/reorder), plus the scoped actions — **Suggest questions** (for this topic), **Add questions** (manual Q&A), **Generate from topic** (auto-build immediately), and **Generate FAQ page** (from the curated list). Optional **Cluster** selector.
2. **Question pool** — all questions with source/status. **Import from Scout (PAA)** and **Import from CSV** live here (topic-agnostic). Triage: review, then **assign to one or more topics**. Bulk select + assign/dismiss.

## Generation rules

- Generating a topic uses its assigned questions; where a question has a verbatim `answer`, use it as-is, otherwise Clem writes the answer.
- On success: mark those questions `used` + `used_in_post_id`, set `topic.generated_post_id` + status `generated`, and **remove them from any other topic** (convergence).
- If a topic has a `cluster_id`, the generated FAQ page inherits it (money-page pin via the existing hub-and-spoke).

## Phasing

- **Phase 1** — data model (this migration), topic CRUD + assign/unassign + reorder APIs, generation-from-topic with convergence, the answer field, and the UI restructure (Topics + Question pool, buttons relocated).
- **Phase 2** — CSV import (verbatim), Suggest-Topics (Clem proposes whole topics), near-duplicate detection/merge, CSV export, pool search/filter, min-question publish gate.

## Build stages (verified as we go)

1. **Schema** — migration 037 + types. ← this stage
2. **Backend** — topic/question/assignment API routes; rework `runFaqDraft` to accept a `topicId` and apply the generation rules; move suggest-questions to assign into a topic.
3. **UI** — rebuild `FaqQuestionsManager` into the Topics + pool layout.
4. **Phase 2** — CSV in/out, Suggest-Topics, dedupe.

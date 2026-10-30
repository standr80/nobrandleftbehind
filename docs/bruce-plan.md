# Bruce — quiz/game agent (build spec)

Bruce is a new NBLB agent (roster: Clem = blog, Scout = SEO/research, Bailey =
images/galleries, Bruce = games). Bruce creates short, playable games that a
third-party site or a Facebook Page can drop in to make itself **sticky** —
something visitors play, replay and share.

The first (and for now only) game is **Cuddly Toy!** — a memory game inspired by
the conveyor-belt finale of the classic Saturday-night TV game show.

**Not an SEO feature.** Unlike Bailey, there is no crawlable-copy or schema
requirement. Optimise for fun, load speed and shareability.

---

## Principles

- **Copy-paste distribution, no platform APIs.** Every game produces two things to
  copy out of NBLB: a **link** (Facebook, WhatsApp, email) and an **embed snippet**
  (third-party websites). No Facebook app, SDK or Instant Games.
- **Facebook's in-app browser is the primary runtime.** Most plays will come from
  a link tapped in the Facebook app, so design and test there first.
- **One engine, many belts.** The game is generic; Bruce writes the content (the
  "belt") as data. A new quiz is a new row, never new code.
- **Review before publish.** Bruce drafts, a human edits and play-tests, then
  publishes — same gate as Bailey.
- **Our own brand.** "Cuddly Toy!" is ours. Don't use the TV show's name, logo,
  theme music or catchphrases as headline branding; "inspired by the classic TV
  conveyor belt" in small print is fine.

## First client: an older audience

The first client sells care-home / home monitoring equipment for older people
and wants to build a Facebook audience of that demographic (70s–90s), plus their
adult children (45–65), who often make the buying decision. This audience grew up
with the TV show. The defaults below are designed for them, and they're good
defaults for everyone.

### Claims — keep it fun, not medical

Pitch it as **"a fun weekly memory workout"**, "keep your mind active", "a bit
of brain exercise with a cuppa". **Never** claim it improves memory, prevents or
slows dementia, or is "proven" — health claims need robust evidence under the UK
CAP code (and the FTC fined Lumosity $2m for exactly this). Bruce's generated
copy and the game UI must avoid "dementia", "cognitive decline", "proven",
"clinically". Add these to Bruce's prompt and a post-generation word check.

### Accessibility defaults

- Text ≥ 20px, high contrast, tap targets ≥ 60px, never colour-only cues.
- Tap recall only by default; typing sits behind the Champion level.
- No swipe gestures, no flashing, one obvious primary button per screen.
- Sound optional; everything spoken is also on screen.
- Tested on tablet and large phone as well as in the Facebook app.

### Difficulty levels (recognition → recall)

| Level | Belt | Recall |
|---|---|---|
| Gentle (default) | 8 items, ~4s each | Tap from 16 tiles, no timer |
| Classic | 12 items, ~3s each | Tap from 24 tiles, 60s |
| Champion | 20 items, ~2.5s each | Tap from 40 or type, 45s |

Bruce generates a belt of 20 items + 20 decoys; lower levels use a subset.
No penalty for wrong taps at Gentle and Classic; Champion keeps the 2s penalty.
**Relaxed** (untimed recall) is available at every level.

### Memory tips

Before the belt starts, show one short, well-known memory technique ("Try making
a little story out of the items", "Picture each item in a room of your house").
Rotating tips give genuine value without making health claims.

### Kind results

Lead with what they **won**, celebrated. Missed items are shown gently ("These
got away this time"). Never "fail", "poor" or "wrong". Compare with their last
game where it's available ("3 more than last week!"). `localStorage` can be
wiped in the Facebook browser, so this is a bonus, not a promise.

### Nostalgia belts

Bruce defaults to themes from the audience's era: 1970s kitchen (Teasmade,
fondue set, Soda Stream), seaside holidays, sweet-shop jars, 1960s Christmas,
"Nan's sideboard". The suggested Facebook caption always asks a question to
drive comments ("Which of these did YOU have?").

### Generations

The challenge link is framed for families: **"Challenge your Mum / Dad /
Grandad / Nan"**. Families play each other, and the client reaches both the
players and the adult children.

### Client branding (light touch)

"Brought to you by [Client]" + logo on the start and results screens, and one
gentle end link ("Peace of mind for you and your family →"). No client
products on the belt and no hard sell. With an older, potentially vulnerable
audience, trust is the whole point.

## Why a link, not a script, for Facebook

Facebook strips `<script>` and `<iframe>` from posts, Pages and groups, and the
old Page "custom HTML tab" feature is gone. The only native in-Facebook game route
(Instant Games) needs a developer app + SDK. So:

1. Each game has a public URL, e.g. `nobrandleftbehind.com/play/xmas-stocking`.
2. That page carries Open Graph tags (`og:title`, `og:description`, `og:image`),
   so pasting the link into a post unfurls a large preview card.
3. Tapping the card opens the game in Facebook's in-app browser. The user never
   really "leaves" Facebook.

The user experience is still "copy, paste, done" — it's a link instead of a
script.

## The game — Cuddly Toy!

### Flow

1. **Start screen** — title, belt theme ("Christmas Stocking Fillers"), one-line
   rules, big **Play** button. The tap also unlocks audio (browsers block sound
   until the first interaction).
   The start screen also has the level picker (Gentle default) and the Relaxed
   toggle, then shows a memory tip.
2. **Watch** — an animated conveyor belt carries the items across the screen one
   at a time (count and speed set by level). Each item: emoji/image, name, an
   optional value ("£24.99"), and a one-line bit of host patter beneath the belt.
   Order is shuffled per play. A cuddly toy is always on the belt.
3. **Recall** (time set by level, or untimed in Relaxed), two modes:
   - **Tap mode** (default): a grid of belt items + an equal number of plausible
     decoys, shuffled. Tap the ones you saw. Correct taps fly onto the winnings
     shelf. Wrong taps cost 2 seconds at Champion only.
   - **Type mode** (Champion only): a text box with forgiving matching (below).
     Each match drops onto the winnings shelf with a sound.
4. **Results** — a kind celebration in our own wording (e.g. "What a haul!"),
   score (`9 / 12`), value won, cuddly-toy badge if recalled, the items that
   "got away", and buttons: **Play again**, **Challenge your Mum/Dad…**,
   **Share result**, and (when the week's draw is open) **Enter this week's
   prize draw**. See "Weekly game, prize draw and sign-ups".

### Scoring

- 1 point per item recalled. Display both count and summed £ value.
- **Cuddly toy bonus** — recalling it shows a badge (and adds to the share text).
- **Bonus items** (optional per belt) — flagged items double their value.
- No phantom/penalty items in v1 (decoys in tap mode already do that job).

### Type-mode matching

Each item has `aliases`. Normalise input (lowercase, strip punctuation, trim
articles "a/an/the", singularise trailing "s"), then match if:

- exact match against name or any alias, or
- Damerau-Levenshtein distance ≤ 1 (≤ 2 for words of 8+ letters), or
- input is a distinctive head-noun of the name ("fondue" → "fondue set") —
  Bruce supplies these as aliases rather than us guessing at runtime.

Each item can only be won once. Submitting on Enter clears the box; no penalty
for misses in type mode.

### Facebook in-app browser constraints (design for these)

- Touch-first, portrait, one-handed. Tap mode default.
- No Web Speech recognition — skip voice input entirely in v1.
- Audio only after a user tap; game must be fully playable muted.
- Small payload: no framework-heavy bundle on `/play`; target < 150KB JS,
  emoji-only items need no image downloads.
- `localStorage` may be wiped between sessions — use it only for "best score",
  never for anything that must persist.
- No pop-ups / `window.open`. Sharing uses `navigator.share` when available,
  falling back to copy-link.

## Distribution

### 1. Share link (Facebook and everywhere else)

- `/play/[slug]` — public, server-rendered shell + the game island.
- OG image generated with `next/og` (`/play/[slug]/opengraph-image`): a belt
  with 4–5 of the items and the cuddly toy, the title, and "Can you remember all
  20?". Bruce shows a preview of exactly what the Facebook card will look like.
- Copy box in Bruce: the URL + a suggested post caption.
- Note for users: Facebook caches previews. After editing a published belt, run
  the URL through Facebook's Sharing Debugger to refresh the card (link to it
  from the Bruce UI).

### 2. Challenge link (the viral loop)

- "Challenge your Mum/Dad…" produces `/play/[slug]?c=<token>`. The token encodes the
  challenger's score and an optional first name (max 20 chars, no other PII),
  signed so it can't be edited.
- Its OG image reads "Sarah won 14 prizes. Can you beat her?" and the start
  screen shows the target score. Results compare against it.
- Each challenge share is a new Facebook post with its own card — that's the
  stickiness engine on Facebook.

### 3. Website embed snippet

```html
<div data-cuddly-toy="xmas-stocking"></div>
<script src="https://www.nobrandleftbehind.com/cuddly.js" async></script>
```

- `cuddly.js` replaces each `[data-cuddly-toy]` div with an **iframe** of
  `/play/[slug]?embed=1` (no site chrome, transparent background) and
  auto-resizes it via `postMessage`. Iframe rather than inline render so the host
  site's CSS can't break the game and vice versa.
- Optional attributes: `data-accent` (brand colour), `data-mode="tap|type"`.
- Multiple games per page supported.

## Weekly game, prize draw and sign-ups

The client runs one new belt a week (e.g. "Tuesday's Belt") and wants to collect
name + email with consent for marketing follow-up.

### Weekly series

- A **series** (e.g. "Tuesday's Belt") has a stable link,
  `/play/s/[series-slug]`, which always redirects to the current week's game.
  The client can pin that one link on the Page and put it in the Page's About /
  button; each week's post still uses the week's own link for a fresh preview
  card.
- Each week is an ordinary game with `opens_at` / `closes_at`. Bruce can draft
  the next 4 weeks' belts in one go for review, so the client isn't generating
  under deadline pressure.
- When a week closes, its page still plays (old posts keep working) but shows
  "This week's draw has closed — try this week's belt →".

### Series settings (client-editable in Bruce)

Everything client-specific is a setting on the series in the Bruce dashboard
(**Series settings** panel, like Bailey's "Gallery settings"), not a code change
or a request to us.

| Setting | Notes |
|---|---|
| **Prize** | Text + optional image (e.g. "A Fortnum's hamper"). Editable any time; see the prize-change rule below. |
| **Privacy notice URL** | Required before the series can publish. Linked from the entry form and every email. |
| **Data processing agreement** | Click-through acceptance of our standard DPA (who accepted, when, version). Required before the series can publish. It's a contract, so it's accepted, not configured. |
| **Show prize values** | On/off (default **off** for this client). Off hides £ values on the belt and the "value won" total. |
| **Schedule** | Day of week + time + timezone (default Europe/London), e.g. Tuesday 09:00. Each approved week opens automatically at that time and closes when the next opens. The weekly email sends at the same time. |
| **Logo** | Upload (stored in Supabase Storage, like Bailey's images). Shown on the start and results screens. |
| **"Brought to you by" name** | Defaults to the workspace name. |
| **End-of-game link** | Label + URL (e.g. "Peace of mind for you and your family →"). |
| **Accent colour** | Used by the game and the embed. |
| **Consent wording** | Pre-filled with our compliant default; the client name is filled in automatically. Edits create a new consent version, and the "boxes unticked, separate, optional" structure can't be changed. |
| **Draw terms** | Generated from the settings above (prize, schedule, eligibility); the client can add extra lines. |

**Prize-change rule.** The client can change the prize any time, but changing
the prize of a draw people have already entered is unfair to entrants (and
risky under consumer protection law). So:

- Changes apply from the **next** week by default.
- The **current** week's prize can only be changed until its first entry. After
  that, Bruce shows "This week's draw already has entries; your change will
  apply from next week."
- Each week stores a snapshot of the prize and terms it ran with, so the record
  of what entrants were promised is permanent.

The business questions still sit with the client: who pays for the prize and
who sends it. Bruce just displays and records what they set.

### Where the form goes

**After the game, never before.** A sign-up wall before playing kills play
rates, and this audience will abandon at the first form. On the results screen:

> **Enter this week's prize draw** — win a [prize]. Just your name and email.

The form is one screen, large fields, plain English:

- First name
- Email
- ☐ **Optional:** "Yes, [Client] can email me about their products and
  services. I can unsubscribe at any time." *(unticked)*
- ☐ **Optional:** "Email me each week's new belt." *(unticked)*
- Short line: "We'll only use your email to contact you if you win, unless you
  tick a box above. [Privacy notice]"
- Button: **Enter the draw**

### Compliance rules (UK GDPR + PECR) — non-negotiable

- **Consent boxes are unticked, separate and optional.** Entering the draw must
  **not** depend on ticking marketing consent. Bundled consent isn't freely
  given, so it's invalid, and PECR's "soft opt-in" doesn't apply because there's
  no sale.
- **Name the client** in the consent wording. A vague "and partners" isn't
  allowed.
- **Privacy notice** link (the client's), saying who holds the data, why, how
  long, and how to unsubscribe/delete.
- **Record the consent**: timestamp, exact wording shown (versioned), which boxes
  were ticked, source (Facebook link / embed / challenge link), game id.
- **Double opt-in** for marketing: a confirm-your-email message (via Resend,
  already in `lib/email`) before the address counts as a marketing contact. It
  also stops fake or mistyped entries in the draw.
- **Roles:** the client is the **data controller**; NBLB is the **processor**.
  We need a short data processing agreement with the client before going live.
- **Retention:** entry-only data (no marketing consent) is deleted 90 days after
  the draw. Marketing contacts are kept until they unsubscribe.
- **Unsubscribe** link in every email; one click.
- **Prize draw terms** page per series: who can enter (UK, 18+), one entry per
  email per week, closing time, prize, how the winner is picked and contacted.
  Free entry, so no gambling-law issue.
- **Facebook promotion rules:** the draw runs on our page, not via Facebook
  mechanics. Never require sharing, tagging or liking to enter, and include the
  required line that Facebook doesn't sponsor or administer the promotion.

### Anti-abuse

- One entry per email per week (dedupe on normalised email).
- Only confirmed (double-opt-in) emails go into the draw.
- Honeypot field + per-IP rate limit on the entry endpoint. No CAPTCHA, which
  older users struggle with.

### Draw and hand-off to the client

- In Bruce: the week's entries, and a **Pick winner** button. It picks at random
  from confirmed entries and logs who picked, when, and the seed. Contacting the
  winner is the client's job; we show their email.
- **Export**: CSV of marketing-consented contacts (name, email, consent time,
  wording version, source), filterable by series/date. Phase 2: push straight to
  Mailchimp / Brevo / the client's CRM.
- **"Email me each week's new belt"** subscribers get an automatic Tuesday email
  from Resend with that week's link. That's the retention loop, and it's on
  email, so it doesn't depend on Facebook's reach.

## Bruce — the agent

### Creating a belt

Input: a theme (free text, e.g. "80s kitchen gadgets") and optionally a tenant
product list. Bruce (Claude, via `lib/anthropic.ts`) returns structured JSON:

- 20 items: `name`, `aliases[]`, `emoji`, `value` (plausible £), `patter`
  (one witty line, family-friendly), `bonus` (bool, 0–2 per belt).
- Exactly one cuddly toy, themed if possible ("a cuddly reindeer").
- 20 decoys: same shape minus value/patter — plausible for the theme but
  clearly distinct from belt items (no near-synonyms of real items).
- Title, one-line description, suggested Facebook caption.

Validation after generation: 20 unique items, every emoji renders as a single
glyph, no decoy fuzzy-matches a belt item or alias, exactly one cuddly toy.
Retry once on failure.

### Review gate (UX)

`New game → theme → Bruce drafts belt → edit items/aliases/decoys, reorder,
regenerate a single item → Play-test (the real game, unpublished) → Publish →
copy link / copy embed`.

Unpublishing a game makes `/play/[slug]` show a friendly "this game has ended"
page rather than a 404 (old Facebook posts will live forever).

### Stats (light)

Per game: plays started, plays completed, average score, challenges sent,
plays arriving via challenge links. Enough to show a client "your game was
played 1,240 times". No personal data stored.

## Data model

New tables (migration `046_bruce_games.sql`), not `blog_posts` — a game isn't
blog content and has no publish-to-CMS step:

- `games` — `id`, `workspace_id`, `slug` (globally unique, used in public URL),
  `game_type` (`'cuddly_toy'`), `status` (`draft | published | ended`), `title`,
  `description`, `fb_caption`, `config jsonb` (the belt: items, decoys, timings,
  accent colour), `created_at`, `published_at`.
- `games` also gets `series_id` (nullable), `opens_at`, `closes_at`, and
  `settings_snapshot jsonb` — the prize, terms, branding and consent version the
  week actually ran with (frozen at first entry).
- `game_series` — `id`, `workspace_id`, `slug`, `title`, and the series
  settings: `prize_text`, `prize_image_url`, `show_values bool`,
  `schedule_day`, `schedule_time`, `timezone`, `logo_url`, `brand_name`,
  `end_link_label`, `end_link_url`, `accent`, `privacy_url`, `terms_extra_md`,
  `consent_texts jsonb` (versioned wording), `weekly_email bool`,
  `dpa_version`, `dpa_accepted_by`, `dpa_accepted_at`. Publishing is blocked
  until `privacy_url` and DPA acceptance are set.
- `game_plays` — `id`, `game_id`, `started_at`, `completed_at`, `score`,
  `level`, `mode`, `via_challenge bool`, `embed bool`. Insert-only from a public
  endpoint, rate-limited per IP.
- `game_entries` — `id`, `game_id`, `first_name`, `email` (normalised),
  `marketing_consent bool`, `weekly_email_consent bool`, `consent_version`,
  `consented_at`, `confirmed_at`, `source`, `unsubscribed_at`, `deleted_at`.
  Unique on (`game_id`, `email`). Personal data is readable only through
  authenticated routes for the owning workspace.
- `game_draws` — `game_id`, `winner_entry_id`, `picked_by`, `picked_at`, `seed`.

## Routes & files

- `app/play/[slug]/page.tsx` — public game page (+ `opengraph-image.tsx`).
- `app/play/s/[series]/route.ts` — redirect to the series' current week.
- `app/api/play/[slug]/route.ts` — public: fetch published config, record plays.
- `app/api/play/[slug]/enter/route.ts` — public: draw entry (honeypot, rate
  limit, sends confirm email).
- `app/play/confirm/[token]/page.tsx` and `app/play/unsubscribe/[token]/page.tsx`.
- `app/play/s/[series]/terms/page.tsx` — prize draw terms.
- `lib/email/templates/` — confirm-entry and weekly-belt emails; weekly send via
  the existing cron (`app/api/cron`).
- `app/(platform)/dashboard/bruce/` — list + editor/review UI.
- `app/api/games/` — authenticated CRUD + generate.
- `lib/bruce/` — `generate.ts` (Claude), `validate.ts`, `match.ts` (fuzzy
  matching, shared by game + validator), `challenge.ts` (token sign/verify).
- `components/cuddly-toy/` — the game itself (belt, recall grid, results).
- `public/cuddly.js` — embed loader.
- `lib/marketing/agents.ts` + `components/layout/DashboardNav.tsx` — add Bruce.
- `middleware.ts` — add `/play(.*)` and `/api/play(.*)` to `isPublicRoute`, and
  make sure `/play` on the platform host is never rewritten as a tenant blog
  route.

## Spikes before building

1. **Facebook in-app browser** — a throwaway `/play/test` with the belt
   animation, a tap grid and a sound, opened from a real Facebook post on iOS and
   Android. Confirm smooth animation, audio-after-tap, `navigator.share`, and
   that the OG card renders large.
2. **OG image generation** — confirm `next/og` renders colour emoji correctly
   (it needs an emoji font/asset config); fall back to Twemoji SVGs if not.

## Phasing

**Phase 1 (MVP, first client):** schema, Bruce generate + review/edit UI
(including claims word check), Cuddly Toy! engine with accessible defaults,
three levels, Relaxed mode, memory tips and kind results, `/play/[slug]` with OG
image, client branding, copy-link, `cuddly.js` embed, basic play counts.
**Weekly series + prize draw entry + double opt-in + CSV export + pick winner**,
since the first client needs these from week one.

**Phase 2:** challenge links ("Challenge your Mum…") + dynamic challenge OG
images, weekly-belt email, CRM/Mailchimp push, **Lounge mode** for care homes
(big-screen belt, residents shout answers, coordinator taps them in, printable
score sheet — a free activity resource the client can give care homes), tenant
product photos as belt items, leaderboards, sound pack.

**Later:** further game types reusing the same `games` table and Bruce flow.

## Effort

Smaller than Bailey on the backend (no upload/processing pipeline) but the game
UI needs real polish — that is where the time goes. Sub-stages, verified as we
go: (1) schema + generate + validate; (2) Bruce review UI; (3) game engine;
(4) `/play` page + OG + embed; (5) stats. Multi-session.

## Open decisions

- Draft our standard click-through DPA (needed before any client can accept it
  in Series settings); a quick legal review is worth it.
- Who can publish: our own sites only first, or clients from day one?
- Should tenant-branded games live on the tenant's own domain
  (`theirsite.com/play/...`) via the existing tenant-host routing, or always on
  `nobrandleftbehind.com`? Platform domain is simpler for v1.
- Bruce's public agent CV page: keep the persona generic — no likeness or
  catchphrases of the real presenter.

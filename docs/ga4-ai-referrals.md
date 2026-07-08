# Tracking AI-engine referrals in GA4

Goal: see how much traffic (and how many sales) come from AI assistants —
ChatGPT, Perplexity, Copilot, Gemini, Claude — so you can judge whether the
AEO/SEO work is landing. GA4 is already installed on the store, so this is all
configuration, no code.

## The AI source list

AI assistants arrive in GA4 as a **session source** equal to their hostname. The
regex to match them (paste this wherever a regex is asked for):

```
chatgpt|openai|perplexity|copilot|gemini|claude|you\.com
```

(This catches `chatgpt.com`, `chat.openai.com`, `perplexity.ai`,
`copilot.microsoft.com`, `gemini.google.com`, `claude.ai`, etc. Add more hosts
over time as new engines appear.)

---

## Step 0 — confirm you can get into the property

1. Shopify admin → **Settings → Apps and sales channels → Google & YouTube** → note the connected GA4 property.
2. Go to **analytics.google.com**, open that property → **Reports → Realtime**, and browse the store in another tab. If you appear, you have reporting access and data is flowing.
   - If you *can't* see the property, the tag was set up under someone else's Google account — you'll need them to add you (Admin → Property access management → add your email as at least "Viewer").

## Step 1 — a reusable "AI referrals" exploration (quickest win)

1. Left nav → **Explore** → **Blank** (Free-form).
2. **Dimensions** (click the `+`): add **Session source** and **Landing page + query string**.
3. **Metrics** (click the `+`): add **Sessions**, **Engaged sessions**, **Key events**, and **Total revenue**.
4. Build the table: drag **Session source** to **Rows**; drag the four metrics to **Values**. (Optionally drag **Landing page + query string** to Rows too, to see which posts/FAQs the AI traffic lands on.)
5. Add a **Filter** (bottom of the Settings column): **Session source** → **matches regex** → paste the AI regex above.
6. Set the date range (top) to **Last 90 days**.
7. Rename the tab "AI referrals" and it auto-saves. Come back to it any time.

This shows, per AI engine: sessions, engagement, conversions (key events) and
revenue — i.e. not just visits but whether they buy.

## Step 2 — a custom channel group (best for ongoing monitoring)

So "AI Assistants" shows up as its own channel in your standard reports:

1. **Admin** (bottom-left gear) → under **Data display** → **Channel groups** → **Create new channel group**.
2. Name it e.g. "Default + AI".
3. **Add a new channel**, name it **AI Assistants**, and set the condition: **Source** → **matches regex** → paste the AI regex. Save the channel.
4. **Drag "AI Assistants" to the top** of the channel list (so it's matched before Referral/Organic), then **Save** the group.
5. Now in **Reports → Acquisition → Traffic acquisition**, change the primary dimension dropdown to your new channel group → **AI Assistants** appears as a line you can watch over time.

Channel-group changes apply going forward (and to most historical reporting after
a day or so), so give it 24–48h to populate.

## Step 3 (optional) — a Looker Studio scorecard

If you want a shareable dashboard: Looker Studio → new report → connect the GA4
property → add a table with the same source filter + a time-series of AI
sessions. Free, and easy to share.

---

## What to expect / caveats

- **Volume will be small at first** — AI referral traffic builds slowly; you're establishing a baseline to watch trend over months, not day-to-day.
- **GA4 under-counts AI referrals** — some AI clicks arrive with no referrer and land in **Direct / Unassigned**, so treat these numbers as a directional floor, not the whole picture.
- **Do this per store** — repeat for Putterfingers/Photocutouts when they're publishing.
- **Later upgrade**: NBLB/Scout could pull these numbers via the GA4 Data API and show an "AI referrals" KPI in your dashboard, so you don't have to open GA4 — a phase-2 build once the GA4 side is proven.

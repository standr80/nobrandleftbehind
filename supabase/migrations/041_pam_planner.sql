-- ============================================================
-- Migration 041: Pam — content planner agent (stage 1)
--
-- pam_items holds BOTH the user's manual ideas and Pam's generated
-- recommendations — same object, different `source`. One planner, one
-- lifecycle (open → scheduled → done, or dismissed/snoozed), one handoff
-- path into the existing suggestions → Clem pipeline (mirroring how
-- scout_keyword_opportunities.clem_suggestion_id already works).
--
-- Idea capture is deliberately loose: a title is enough; type and date are
-- optional until the user acts on it.
-- ============================================================

create table if not exists pam_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,

  kind text not null default 'idea'
    check (kind in ('idea', 'recommendation')),
  item_type text not null default 'other'
    check (item_type in ('post', 'faq', 'gallery', 'refresh', 'other')),

  title text not null,
  note text,                -- freeform detail (user's or Pam's)
  reason text,              -- Pam's one-sentence justification (recommendations)
  evidence jsonb,           -- signal payload backing the reason

  status text not null default 'open'
    check (status in ('open', 'scheduled', 'done', 'dismissed', 'snoozed')),
  scheduled_for date,       -- planner slot; null = backlog
  snoozed_until date,

  source text not null default 'manual'
    check (source in ('manual', 'pam')),

  target_post_id uuid references blog_posts(id) on delete set null,
  suggestion_id uuid references suggestions(id) on delete set null,

  created_by text,          -- Clerk user id for manual ideas
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  dismissed_at timestamptz,
  done_at timestamptz
);

create index if not exists pam_items_tenant_status_idx
  on pam_items (tenant_id, status);
create index if not exists pam_items_tenant_scheduled_idx
  on pam_items (tenant_id, scheduled_for)
  where scheduled_for is not null;

alter table pam_items enable row level security;

comment on table pam_items is
  'Pam planner: manual ideas + generated recommendations. Dismissed rows persist so the engine never re-suggests them.';

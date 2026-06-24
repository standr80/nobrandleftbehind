-- ============================================================
-- Migration 031: FAQ question bank
--
-- Source questions for FAQ pages: real customer questions added manually,
-- support questions, or PAA questions pulled from Scout. Clem assembles
-- selected questions into an FAQ page; used questions are marked so they
-- are not reused.
-- ============================================================

create table if not exists public.faq_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  question text not null,
  source text default 'manual',          -- 'manual' | 'scout_paa' | 'support'
  topic text,                            -- optional grouping for which FAQ page
  status text default 'open' check (status in ('open', 'used', 'dismissed')),
  used_in_post_id uuid references public.blog_posts(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.faq_questions enable row level security;

-- Members can read their own tenant's questions (writes go through the
-- service-role API with explicit checks, matching the authors pattern).
create policy "members_can_read_own_faq_questions"
  on public.faq_questions for select
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

create index if not exists idx_faq_questions_tenant_id on public.faq_questions(tenant_id);
create index if not exists idx_faq_questions_status on public.faq_questions(tenant_id, status);

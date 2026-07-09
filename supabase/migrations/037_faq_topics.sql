-- FAQ Topics rebuild.
--
-- Topics and Questions become separate: a Topic is a planned FAQ page; Questions
-- live in a pool and are assigned to topics (many-to-many while planning). At
-- generation a question converges to one page (locked + removed from other topics).
-- Questions gain an optional verbatim `answer` (manual entry / CSV import).

-- ── Topics ──────────────────────────────────────────────────────────────────
create table if not exists public.faq_topics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  name text not null,
  cluster_id text,                              -- optional → content cluster (money-page pin)
  generated_post_id uuid references public.blog_posts(id) on delete set null,
  status text default 'draft' check (status in ('draft', 'generated')),
  created_at timestamptz default now()
);

comment on table public.faq_topics is
  'A planned FAQ page. Questions are assigned via faq_topic_questions; generating builds a blog_post (content_type=faq) and links it here.';

-- ── Topic ↔ Question assignment (many-to-many + ordering) ───────────────────
create table if not exists public.faq_topic_questions (
  topic_id uuid references public.faq_topics(id) on delete cascade not null,
  question_id uuid references public.faq_questions(id) on delete cascade not null,
  position int default 0,
  primary key (topic_id, question_id)
);

-- ── Verbatim answer on a question (manual Q&A / CSV import) ──────────────────
alter table public.faq_questions
  add column if not exists answer text;

comment on column public.faq_questions.answer is
  'Optional verbatim answer (manual entry or CSV import). Used as-is at generation; when null Clem writes the answer.';

-- ── RLS (reads for members; writes go through the service-role API) ─────────
alter table public.faq_topics enable row level security;
create policy "members_read_own_faq_topics"
  on public.faq_topics for select
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

alter table public.faq_topic_questions enable row level security;
create policy "members_read_own_faq_topic_questions"
  on public.faq_topic_questions for select
  using (
    topic_id in (
      select id from public.faq_topics
      where tenant_id in (
        select tenant_id from public.tenant_members
        where clerk_user_id = auth.jwt() ->> 'sub'
      )
    )
  );

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_faq_topics_tenant on public.faq_topics(tenant_id);
create index if not exists idx_faq_topic_questions_topic on public.faq_topic_questions(topic_id);
create index if not exists idx_faq_topic_questions_question on public.faq_topic_questions(question_id);

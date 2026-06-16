-- ============================================================
-- Migration 027: Authors (per-tenant) for E-E-A-T attribution
--
-- A workspace can keep a roster of named authors (who need NOT be
-- login users) with a bio, job title/credentials, and external
-- profile links (emitted as schema.org sameAs). Each blog post can
-- be attributed to one author, surfaced as a byline + bio + Person
-- structured data on the blog.
-- ============================================================

create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  name text not null,
  slug text not null,
  job_title text,            -- role / credentials, e.g. "Events Specialist, 10+ yrs"
  bio text,                  -- short biography
  links jsonb default '[]',  -- [{label, url}] -> schema.org sameAs
  is_default boolean default false,  -- fallback author when a post has none
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, slug)
);

alter table public.authors enable row level security;

-- Members can read their own tenant's authors (writes go through the
-- service-role API with explicit admin checks).
create policy "members_can_read_own_authors"
  on public.authors for select
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

create index if not exists idx_authors_tenant_id on public.authors(tenant_id);

-- Reuse the shared updated_at trigger function from migration 001.
create trigger authors_updated_at
  before update on public.authors
  for each row execute function set_updated_at();

-- Attribute a post to an author. Null = fall back to the tenant's
-- default author (or brand name) at render time.
alter table public.blog_posts
  add column if not exists author_id uuid references public.authors(id) on delete set null;

create index if not exists idx_blog_posts_author_id on public.blog_posts(author_id);

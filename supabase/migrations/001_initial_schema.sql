-- ============================================================
-- Clem — Initial Schema
-- nobrandleftbehind.com
-- Sprint 1 — Migration 001
-- ============================================================

-- ============================================================
-- TENANTS
-- ============================================================
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null,
  logo_url text,
  brand_voice text,
  target_audience text,
  forbidden_words text[],
  cms_type text default 'git',
  git_repo text,
  git_branch text default 'main',
  git_blog_path text default 'content/blog',
  git_installation_id text,
  publish_cadence text default '2pw',
  publish_days text[] default '{tuesday,thursday}',
  publish_time text default '09:00',
  post_cadence_active boolean default true,
  auto_merge boolean default false,
  stripe_customer_id text,
  billing_tier text default 'starter',
  white_label boolean default false,
  white_label_domain text,
  created_at timestamptz default now()
);

alter table tenants enable row level security;

-- ============================================================
-- TENANT MEMBERS
-- ============================================================
create table tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  clerk_user_id text not null,
  role text not null check (role in ('admin', 'author', 'reviewer')),
  name text,
  email text,
  created_at timestamptz default now(),
  unique (tenant_id, clerk_user_id)
);

alter table tenant_members enable row level security;

-- ============================================================
-- SUGGESTIONS (ideas queue)
-- ============================================================
create table suggestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  proposed_title text not null,
  rationale text,
  target_keywords text[],
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now()
);

alter table suggestions enable row level security;

-- ============================================================
-- BLOG POSTS (full lifecycle)
-- ============================================================
create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  suggestion_id uuid references suggestions(id),
  title text not null,
  slug text not null,
  body_mdx text,
  excerpt text,
  meta_description text,
  tags text[],
  hero_image_url text,
  hero_image_credit text,
  hero_image_alt text,
  image_suggestions jsonb,
  status text default 'draft' check (
    status in ('draft', 'in_review', 'approved', 'scheduled', 'published', 'rejected')
  ),
  assigned_reviewer_id uuid references tenant_members(id),
  reviewer_notes text,
  git_pr_url text,
  git_pr_number integer,
  git_merge_sha text,
  scheduled_for timestamptz,
  auto_scheduled boolean default false,
  suggested_at timestamptz,
  drafted_at timestamptz,
  submitted_for_review_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_by text default 'clem',
  approved_by uuid references tenant_members(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, slug)
);

alter table blog_posts enable row level security;

-- Auto-update updated_at on row changes
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger blog_posts_updated_at
  before update on blog_posts
  for each row execute function set_updated_at();

-- ============================================================
-- PUBLISH LOG (audit trail)
-- ============================================================
create table publish_log (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references blog_posts(id),
  tenant_id uuid references tenants(id) not null,
  attempted_at timestamptz default now(),
  action text check (action in ('pr_created', 'pr_merged', 'direct_publish')),
  success boolean,
  git_pr_url text,
  response_data jsonb,
  error_message text
);

alter table publish_log enable row level security;

-- ============================================================
-- SITE CRAWL CACHE
-- ============================================================
create table site_crawl_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  crawled_at timestamptz default now(),
  page_count integer,
  summary text,
  existing_topics text[],
  expires_at timestamptz,
  unique (tenant_id)
);

alter table site_crawl_cache enable row level security;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================
-- Members can read their own tenant's data; service role bypasses all.
-- The application uses the service role key on the server and the
-- anon key on the client — client-side queries must always include
-- a tenant_id filter enforced by these policies.

-- tenants: members can see the tenant they belong to
create policy "tenant_members_can_read_own_tenant"
  on tenants for select
  using (
    id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- tenant_members: members can see colleagues in their tenant
create policy "members_can_read_own_tenant_members"
  on tenant_members for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- suggestions: scoped to tenant
create policy "members_can_read_own_suggestions"
  on suggestions for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- blog_posts: scoped to tenant
create policy "members_can_read_own_posts"
  on blog_posts for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- publish_log: scoped to tenant
create policy "members_can_read_own_publish_log"
  on publish_log for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- site_crawl_cache: scoped to tenant
create policy "members_can_read_own_crawl_cache"
  on site_crawl_cache for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_tenant_members_clerk_user_id on tenant_members(clerk_user_id);
create index idx_tenant_members_tenant_id on tenant_members(tenant_id);
create index idx_suggestions_tenant_id on suggestions(tenant_id);
create index idx_suggestions_status on suggestions(status);
create index idx_blog_posts_tenant_id on blog_posts(tenant_id);
create index idx_blog_posts_status on blog_posts(status);
create index idx_blog_posts_scheduled_for on blog_posts(scheduled_for) where scheduled_for is not null;
create index idx_publish_log_tenant_id on publish_log(tenant_id);
create index idx_publish_log_post_id on publish_log(post_id);

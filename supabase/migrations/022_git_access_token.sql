-- ============================================================
-- Migration 022: git_access_token
--
-- Adds a per-tenant GitHub Personal Access Token (PAT) column.
-- Used by runPublish() to authenticate with GitHub when
-- cms_type = 'git', as a simpler alternative to GitHub App auth.
--
-- Store a fine-grained PAT scoped to the tenant's repo with:
--   Contents: Read & Write
--   Pull requests: Read & Write
-- ============================================================

alter table public.tenants
  add column if not exists git_access_token text;

comment on column public.tenants.git_access_token is
  'GitHub fine-grained PAT for pushing blog posts via PR. Scoped to git_repo.';

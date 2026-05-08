-- ============================================================
-- Migration 004: workspace_quotas
-- Superadmin can grant a Clerk user the right to self-create
-- workspaces, up to max_workspaces (default 1).
-- Any user without a quota row is not permitted to self-create.
-- ============================================================

create table workspace_quotas (
  id             uuid primary key default gen_random_uuid(),
  clerk_user_id  text not null unique,
  max_workspaces integer not null default 1 check (max_workspaces >= 0),
  granted_by     text,   -- superadmin clerk_user_id (informational)
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table workspace_quotas enable row level security;
-- All access via service role (admin client) only

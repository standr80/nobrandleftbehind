-- ============================================================
-- Migration 003: workspace_invitations
-- Supports email-based invite flow for adding members to a
-- workspace. Tokens expire after 7 days and are single-use.
-- ============================================================

create table workspace_invitations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references tenants(id) on delete cascade not null,
  email        text not null,
  role         text not null default 'author',
  token        text not null unique,
  invited_by   uuid references tenant_members(id) on delete set null,
  accepted_at  timestamptz,
  expires_at   timestamptz not null default now() + interval '7 days',
  created_at   timestamptz not null default now()
);

-- Only pending (unaccepted, unexpired) invites per email+workspace
create index workspace_invitations_tenant_email
  on workspace_invitations (tenant_id, email)
  where accepted_at is null;

alter table workspace_invitations enable row level security;

-- Service role bypasses RLS; no user-facing RLS policies needed
-- (all access goes through the admin client in API routes)

-- ============================================================
-- Migration 011: RLS policies for Scout tables + Data API grants
--
-- 1. Adds tenant-scoped SELECT policies for all Scout tables,
--    matching the pattern already used in migration 001 for
--    tenants, suggestions, blog_posts, etc.
--
-- 2. Adds SELECT policies for workspace_invitations and
--    workspace_quotas so tenant members / individual users
--    can read their own records.
--
-- 3. Adds explicit GRANTs on all affected tables to satisfy
--    Supabase's upcoming Data API change (enforced Oct 30 2026
--    for existing projects).
--
-- All write operations continue to go through the service role
-- (createAdminClient) which bypasses RLS entirely. These policies
-- only govern direct PostgREST / Data API access.
-- ============================================================

-- ── Helper: reusable sub-query to get the caller's tenant IDs ─────────────────
-- (tenant_members is already accessible via its own policy in migration 001)

-- ── Scout tables (tenant-scoped) ──────────────────────────────────────────────

create policy "members_can_read_own_scout_config"
  on scout_config for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

create policy "members_can_read_own_scout_briefings"
  on scout_briefings for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

create policy "members_can_read_own_scout_site_snapshots"
  on scout_site_snapshots for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

create policy "members_can_read_own_scout_competitor_snapshots"
  on scout_competitor_snapshots for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

create policy "members_can_read_own_scout_keyword_opportunities"
  on scout_keyword_opportunities for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

create policy "members_can_read_own_scout_alerts"
  on scout_alerts for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- PAA cache is internal but safe to expose read-only to tenant members
create policy "members_can_read_own_scout_paa_cache"
  on scout_paa_cache for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- ── workspace_invitations ─────────────────────────────────────────────────────
-- Admins managing a workspace can see pending invites for that workspace

create policy "members_can_read_own_workspace_invitations"
  on workspace_invitations for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- ── workspace_quotas ──────────────────────────────────────────────────────────
-- A user can read their own quota row (used to decide if self-create is allowed)

create policy "user_can_read_own_quota"
  on workspace_quotas for select
  using (clerk_user_id = auth.jwt() ->> 'sub');

-- ── Data API grants (ahead of Supabase Oct 30 2026 enforcement) ───────────────
-- Service role bypasses all grants; these cover the authenticated role only.

grant select on scout_config                to authenticated;
grant select on scout_briefings             to authenticated;
grant select on scout_site_snapshots        to authenticated;
grant select on scout_competitor_snapshots  to authenticated;
grant select on scout_keyword_opportunities to authenticated;
grant select on scout_alerts                to authenticated;
grant select on scout_paa_cache             to authenticated;
grant select on workspace_invitations       to authenticated;
grant select on workspace_quotas            to authenticated;

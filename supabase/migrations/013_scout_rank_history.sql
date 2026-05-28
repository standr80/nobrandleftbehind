-- Rank history table for weekly keyword position tracking
create table if not exists scout_rank_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  keyword text not null,
  snapshot_date date not null,
  position integer,
  previous_position integer,
  position_change integer,
  url text,
  search_volume integer,
  source text default 'dataforseo',
  created_at timestamptz default now(),
  unique(tenant_id, keyword, snapshot_date)
);

create index if not exists idx_rank_history_tenant_keyword
  on scout_rank_history(tenant_id, keyword, snapshot_date desc);

alter table scout_rank_history enable row level security;

create policy "members_can_read_own_rank_history"
  on scout_rank_history for select
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

grant select on scout_rank_history to authenticated;

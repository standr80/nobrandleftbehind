-- Store an optional override URL for blog design match extraction
alter table public.tenants
  add column if not exists theme_extract_url text;

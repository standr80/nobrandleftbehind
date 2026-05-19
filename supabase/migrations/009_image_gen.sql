alter table public.tenants
  add column if not exists ideogram_api_key text,
  add column if not exists image_gen_enabled boolean default false;

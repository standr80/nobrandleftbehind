-- Répétez zero-knowledge sync storage. Run this against the DEDICATED Supabase
-- project for Répétez — not the nobrandleftbehind platform's own project. See
-- lib/repeatafterme/vault.ts for the client-side encryption this table stores the
-- output of; the server (this schema) never sees a magic key or plaintext.

create table if not exists sync_blobs (
  lookup_hash text primary key,       -- SHA-256 of the magic key; opaque to us
  iv text not null,                   -- AES-GCM IV, base64
  data text not null,                 -- AES-GCM ciphertext, base64
  updated_at timestamptz not null default now()
);

-- Cheap defence-in-depth against brute-forcing lookup hashes (the 256-bit hash space
-- already makes that hopeless) and against payload spam. Not a hard security boundary
-- — see the small race window noted in lib/repeatafterme/rateLimit.ts.
create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

alter table sync_blobs enable row level security;
alter table rate_limits enable row level security;
-- Deliberately no policies: only the service-role key (used server-side only, in
-- app/api/repeatafterme/save-data and load-data) can read or write these tables. The
-- anon/public key — if this project's anon key ever ends up in client code by mistake
-- — gets nothing.

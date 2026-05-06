-- ============================================================
-- Seed: Designs on Print — Tenant #1
-- Run this after 001_initial_schema.sql
--
-- After running this migration:
-- 1. Note the tenant id printed at the bottom (or query: SELECT id FROM tenants WHERE domain = 'designsonprint.com')
-- 2. Replace YOUR_CLERK_USER_ID below with your actual Clerk user ID
--    (find it in Clerk Dashboard → Users → click your user → copy User ID)
-- 3. Uncomment and run the INSERT into tenant_members
-- ============================================================

INSERT INTO tenants (
  name,
  domain,
  brand_voice,
  target_audience,
  forbidden_words,
  cms_type,
  git_branch,
  git_blog_path,
  publish_cadence,
  publish_days,
  publish_time,
  post_cadence_active,
  billing_tier
) VALUES (
  'Designs on Print',
  'designsonprint.com',
  'Friendly, expert, approachable. UK-based. Speak to small business owners and marketeers who want quality custom print without the jargon.',
  'UK small business owners, event organisers, marketers needing custom printed products',
  ARRAY['synergy', 'leverage', 'paradigm', 'disruptive'],
  'git',
  'main',
  'content/blog',
  '2pw',
  ARRAY['tuesday', 'thursday'],
  '09:00',
  true,
  'starter'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- After running the above, find your tenant ID:
-- SELECT id FROM tenants WHERE domain = 'designsonprint.com';
--
-- Then run this (replace both placeholder values):
-- ============================================================

-- INSERT INTO tenant_members (tenant_id, clerk_user_id, role, name, email)
-- VALUES (
--   'PASTE_TENANT_UUID_HERE',
--   'PASTE_YOUR_CLERK_USER_ID_HERE',
--   'admin',
--   'Your Name',
--   'your@email.com'
-- );

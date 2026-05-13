-- Add hosted blog configuration to tenants
alter table public.tenants
  add column if not exists blog_theme jsonb;

-- white_label_domain already exists from the initial schema.
-- blog_theme stores extracted brand tokens:
-- { primaryColor, backgroundColor, textColor, headingFont, bodyFont,
--   logoUrl, logoAlt, navLinks: [{label, url}], extractedAt }

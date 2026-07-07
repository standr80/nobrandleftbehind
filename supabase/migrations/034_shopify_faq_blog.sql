-- Dedicated Shopify blog for FAQ posts.
--
-- FAQ posts (content_type='faq') publish as articles into a SEPARATE Shopify
-- blog (e.g. /blogs/faqs) rather than the main blog or standalone pages. Shopify
-- auto-lists them at /blogs/<handle> (the FAQ index) and each keeps its own URL +
-- FAQPage schema. Store that blog's id here; the main blog stays shopify_blog_id.

alter table tenants
  add column if not exists shopify_faq_blog_id text;

comment on column tenants.shopify_faq_blog_id is
  'Target Shopify Blog id for FAQ posts (numeric or gid://shopify/Blog/NNN), e.g. a blog with handle "faqs" → /blogs/faqs. Falls back to nothing — FAQ publish errors until set.';

-- Migration 023: add 'pr_open' to blog_posts status check constraint
--
-- Required for GitHub PR publish flow — posts move to 'pr_open' after
-- a PR is raised, then to 'published' once the PR is merged.

ALTER TABLE blog_posts DROP CONSTRAINT blog_posts_status_check;

ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_status_check
  CHECK (status IN ('draft', 'in_review', 'approved', 'scheduled', 'published', 'rejected', 'pr_open'));

-- Add AI Overview tracking columns to keyword opportunities
alter table scout_keyword_opportunities
  add column if not exists has_ai_overview boolean default false,
  add column if not exists ai_overview_snippet text;

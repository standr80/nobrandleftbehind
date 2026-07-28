-- ============================================================
-- Migration 043: Pam 'deferred' status
--
-- The middle road between accepting and dismissing (Richard's request):
-- Defer = "not now, but don't forget it". Deferred items leave the desk
-- into a parked list, block re-suggestion while parked (unlike dismiss's
-- 21-day mute), and restore manually whenever the user is ready.
-- ============================================================

alter table pam_items
  drop constraint if exists pam_items_status_check;
alter table pam_items
  add constraint pam_items_status_check
    check (status in ('open', 'scheduled', 'done', 'dismissed', 'snoozed', 'deferred'));

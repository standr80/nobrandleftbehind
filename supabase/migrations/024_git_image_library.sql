-- Migration 024: git_image_library
--
-- Stores the list of repo-relative hero image paths available for
-- git-based tenants (e.g. '/images/crazy-golf-course-image1.webp').
-- Used by runPublish() to pick a hero image when the post's stored
-- hero_image_url is a Supabase storage URL rather than a repo path.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS git_image_library text[] DEFAULT '{}';

COMMENT ON COLUMN public.tenants.git_image_library IS
  'Repo-relative image paths available as hero images for git-based publish (e.g. /images/foo.webp)';

-- Populate Fun4Guests image library
UPDATE public.tenants
SET git_image_library = ARRAY[
  '/images/crazy-golf-course-image1.webp',
  '/images/crazy-golf-course-image3.webp',
  '/images/crazy-golf-course-image4.webp',
  '/images/football-pool-group-800p.webp',
  '/images/footballpool.webp',
  '/images/beat-the-goalie-kick.webp',
  '/images/giant-connect4.webp',
  '/images/giant-games-multi-product.webp',
  '/images/giant-jenga.webp',
  '/images/kissing-booth1.webp',
  '/images/mega-jigsaw-puzzle1.webp',
  '/images/megacard1.webp',
  '/images/photowall.webp',
  '/images/table-tennis.webp',
  '/images/table-tennis-wedding-3d.webp',
  '/images/connect4.webp',
  '/images/fun-house-mirrors.webp',
  '/images/street-art-board.webp',
  '/images/promotional-cut-out-boards-duo.webp',
  '/images/cheque1.webp',
  '/images/sack-race.webp',
  '/images/badminton.webp',
  '/images/space-hoppers.webp',
  '/images/competition.webp',
  '/images/mrandmrs.webp'
]
WHERE name = 'Fun4Guests';

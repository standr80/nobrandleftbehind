import { createAdminClient } from '@/lib/supabase/admin'
import { getOctokitForToken, getOctokitForTenant } from '@/lib/github/client'

/**
 * Builds the Markdown file content for a blog post.
 *
 * Frontmatter follows the Astro content collections schema used by Fun4Guests
 * (and compatible with other Astro tenants). Fields map as:
 *   title          ← post.title
 *   description    ← post.meta_description
 *   pubDate        ← post.scheduled_for ?? today
 *   heroImage      ← post.hero_image_url (only if it's a /images/… path)
 *   draft          ← false
 */
function buildMarkdownFile(post: {
  title: string
  meta_description: string | null
  body_mdx: string | null
  slug: string
  hero_image_url: string | null
  scheduled_for: string | null
  published_at: string | null
}): string {
  const pubDate = post.scheduled_for
    ? post.scheduled_for.slice(0, 10)
    : post.published_at
    ? post.published_at.slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  // Only embed heroImage if it's a repo-relative /images/… path
  const heroImage =
    post.hero_image_url && post.hero_image_url.startsWith('/images/')
      ? post.hero_image_url
      : null

  const lines: string[] = ['---']
  lines.push(`title: ${JSON.stringify(post.title)}`)
  if (post.meta_description) {
    lines.push(`description: ${JSON.stringify(post.meta_description)}`)
  }
  lines.push(`pubDate: ${pubDate}`)
  if (heroImage) {
    lines.push(`heroImage: ${heroImage}`)
  }
  lines.push('draft: false')
  lines.push('---')
  lines.push('')
  lines.push(post.body_mdx ?? '')

  return lines.join('\n')
}

/**
 * Publishes a blog post to GitHub as a Pull Request.
 *
 * Flow:
 *  1. Load post + tenant from DB
 *  2. Assert cms_type === 'git' and git config is complete
 *  3. Build the markdown file
 *  4. Create a feature branch off the base branch
 *  5. Commit the file to that branch
 *  6. Open a PR — title "Blog: <post title>"
 *  7. Update blog_posts: status='pr_open', git_pr_number, git_pr_url
 *  8. Log to publish_log
 *
 * If auto_merge is true the PR is merged immediately after creation
 * (requires GitHub App to have merge permissions).
 */
export async function runPublish(tenantId: string, postId: string): Promise<void> {
  const db = createAdminClient()

  // ── 1. Load data ───────────────────────────────────────────────────────────
  const [{ data: post, error: postErr }, { data: tenant, error: tenantErr }] =
    await Promise.all([
      db.from('blog_posts').select('*').eq('id', postId).single(),
      db
        .from('tenants')
        .select(
          'cms_type, git_repo, git_branch, git_blog_path, git_installation_id, git_access_token, auto_merge, name'
        )
        .eq('id', tenantId)
        .single(),
    ])

  if (postErr || !post) throw new Error(`[publish] Post not found: ${postId}`)
  if (tenantErr || !tenant) throw new Error(`[publish] Tenant not found: ${tenantId}`)

  // ── 2. Validate git config ─────────────────────────────────────────────────
  if (tenant.cms_type !== 'git') {
    throw new Error(`[publish] Tenant cms_type is '${tenant.cms_type}', expected 'git'`)
  }

  const { git_repo, git_branch, git_blog_path, git_installation_id, git_access_token } = tenant

  if (!git_repo || !git_branch || !git_blog_path) {
    throw new Error(
      `[publish] Tenant ${tenantId} has incomplete git config. ` +
        `Ensure git_repo, git_branch, and git_blog_path are all set.`
    )
  }

  if (!git_access_token && !git_installation_id) {
    throw new Error(
      `[publish] Tenant ${tenantId} has no GitHub auth configured. ` +
        `Set either git_access_token (PAT) or git_installation_id (GitHub App).`
    )
  }

  const [owner, repo] = git_repo.split('/')
  if (!owner || !repo) {
    throw new Error(
      `[publish] Invalid git_repo format '${git_repo}' — expected 'owner/repo'`
    )
  }

  // Prefer PAT over GitHub App auth
  const octokit = git_access_token
    ? getOctokitForToken(git_access_token)
    : getOctokitForTenant(parseInt(git_installation_id!, 10))

  // ── 3. Build file content ──────────────────────────────────────────────────
  const fileContent = buildMarkdownFile(post)
  const filePath = `${git_blog_path.replace(/\/$/, '')}/${post.slug}.md`

  // ── 4. Resolve base branch SHA ─────────────────────────────────────────────
  const { data: baseRef } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${git_branch}`,
  })
  const baseSha = baseRef.object.sha

  // ── 5. Create feature branch ───────────────────────────────────────────────
  const branchName = `blog/${post.slug}-${Date.now()}`

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  })

  // ── 6. Commit file to branch ───────────────────────────────────────────────
  // Check if file already exists on this branch (re-publish scenario)
  let existingFileSha: string | undefined
  try {
    const { data: existing } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branchName,
    })
    if (!Array.isArray(existing) && existing.type === 'file') {
      existingFileSha = existing.sha
    }
  } catch {
    // File doesn't exist yet — normal for new posts
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: `Blog: ${post.title}`,
    content: Buffer.from(fileContent, 'utf-8').toString('base64'),
    branch: branchName,
    ...(existingFileSha ? { sha: existingFileSha } : {}),
  })

  // ── 7. Open Pull Request ───────────────────────────────────────────────────
  const pubDate = post.scheduled_for
    ? post.scheduled_for.slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: `Blog: ${post.title}`,
    body: [
      `**Post:** ${post.title}`,
      `**Slug:** \`${post.slug}\``,
      `**Target publish date:** ${pubDate}`,
      post.meta_description ? `**Description:** ${post.meta_description}` : '',
      '',
      `_Published by NBLB — No Brand Left Behind_`,
    ]
      .filter(Boolean)
      .join('\n'),
    head: branchName,
    base: git_branch,
  })

  // ── 8. Update blog_posts ───────────────────────────────────────────────────
  const now = new Date().toISOString()

  const { error: updateErr } = await db
    .from('blog_posts')
    .update({
      status: 'pr_open',
      git_pr_number: pr.number,
      git_pr_url: pr.html_url,
      updated_at: now,
    })
    .eq('id', postId)

  if (updateErr) {
    console.error('[publish] Failed to update blog_posts after PR creation:', updateErr)
    throw new Error(`[publish] DB update failed: ${updateErr.message}`)
  }

  // ── 9. Log ─────────────────────────────────────────────────────────────────
  await db.from('publish_log').insert({
    tenant_id: tenantId,
    post_id: postId,
    action: 'github_pr_opened',
    success: true,
    git_pr_url: pr.html_url,
    response_data: { pr_number: pr.number, branch: branchName, file_path: filePath },
    attempted_at: now,
  })

  // ── 10. Auto-merge if configured ───────────────────────────────────────────
  if (tenant.auto_merge) {
    try {
      await octokit.pulls.merge({
        owner,
        repo,
        pull_number: pr.number,
        merge_method: 'squash',
        commit_title: `Blog: ${post.title}`,
      })

      const { data: mergedPr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pr.number,
      })

      await db
        .from('blog_posts')
        .update({
          status: 'published',
          published_at: now,
          git_merge_sha: mergedPr.merge_commit_sha,
          updated_at: now,
        })
        .eq('id', postId)

      await db.from('publish_log').insert({
        tenant_id: tenantId,
        post_id: postId,
        action: 'github_pr_auto_merged',
        success: true,
        git_pr_url: pr.html_url,
        response_data: { pr_number: pr.number, merge_sha: mergedPr.merge_commit_sha },
        attempted_at: now,
      })
    } catch (mergeErr) {
      // Non-fatal — PR is open, human can merge it manually
      console.error('[publish] auto_merge failed:', mergeErr)
      await db.from('publish_log').insert({
        tenant_id: tenantId,
        post_id: postId,
        action: 'github_pr_auto_merge_failed',
        success: false,
        git_pr_url: pr.html_url,
        error_message: mergeErr instanceof Error ? mergeErr.message : String(mergeErr),
        attempted_at: now,
      })
    }
  }
}

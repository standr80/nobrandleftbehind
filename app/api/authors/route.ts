import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace, resolveMutationWorkspace } from '@/lib/workspace/active'
import type { Json } from '@/lib/supabase/types'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

interface AuthorLink {
  label: string
  url: string
}

function cleanLinks(input: unknown): AuthorLink[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((l): l is AuthorLink => !!l && typeof l === 'object' && typeof (l as AuthorLink).url === 'string')
    .map((l) => ({ label: String(l.label ?? '').trim(), url: String(l.url).trim() }))
    .filter((l) => l.url)
}

// GET — list authors for the active workspace (any member)
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('authors')
    .select('id, name, slug, job_title, bio, links, is_default, created_at')
    .eq('tenant_id', workspace.tenantId)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ authors: data ?? [] })
}

// POST — create an author (admin only)
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  // Resolve against the tenant the page was loaded with (client-supplied), not
  // the shared active-workspace cookie, so a workspace switch in another tab
  // can't redirect this create to the wrong tenant.
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  if (workspace.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const db = createAdminClient()

  // Ensure a unique slug within the tenant.
  let slug = slugify(body.slug || name) || 'author'
  const { data: existing } = await db
    .from('authors')
    .select('slug')
    .eq('tenant_id', workspace.tenantId)
    .like('slug', `${slug}%`)
  const taken = new Set((existing ?? []).map((r) => r.slug))
  if (taken.has(slug)) {
    let n = 2
    while (taken.has(`${slug}-${n}`)) n++
    slug = `${slug}-${n}`
  }

  // If marked default, clear any existing default first.
  const isDefault = !!body.is_default
  if (isDefault) {
    await db.from('authors').update({ is_default: false }).eq('tenant_id', workspace.tenantId)
  }

  const { data, error } = await db
    .from('authors')
    .insert({
      tenant_id: workspace.tenantId,
      name,
      slug,
      job_title: body.job_title ? String(body.job_title).trim() : null,
      bio: body.bio ? String(body.bio).trim() : null,
      links: cleanLinks(body.links) as unknown as Json,
      is_default: isDefault,
    })
    .select('id, name, slug, job_title, bio, links, is_default, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, author: data })
}

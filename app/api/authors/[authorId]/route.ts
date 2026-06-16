import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import type { Json } from '@/lib/supabase/types'

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

// PATCH — update an author (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ authorId: string }> },
) {
  const { authorId } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  if (workspace.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await request.json()
  const db = createAdminClient()

  const update: {
    name?: string
    job_title?: string | null
    bio?: string | null
    links?: Json
    is_default?: boolean
  } = {}
  if (typeof body.name === 'string') update.name = body.name.trim()
  if ('job_title' in body) update.job_title = body.job_title ? String(body.job_title).trim() : null
  if ('bio' in body) update.bio = body.bio ? String(body.bio).trim() : null
  if ('links' in body) update.links = cleanLinks(body.links) as unknown as Json

  if (body.is_default === true) {
    // Only one default per tenant.
    await db.from('authors').update({ is_default: false }).eq('tenant_id', workspace.tenantId)
    update.is_default = true
  } else if (body.is_default === false) {
    update.is_default = false
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Scope to the active tenant so an admin can't edit another tenant's author.
  const { data, error } = await db
    .from('authors')
    .update(update)
    .eq('id', authorId)
    .eq('tenant_id', workspace.tenantId)
    .select('id, name, slug, job_title, bio, links, is_default, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, author: data })
}

// DELETE — remove an author (admin only). Posts keep their content; author_id
// is set null by the FK (on delete set null), falling back to the default/brand.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ authorId: string }> },
) {
  const { authorId } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  if (workspace.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const db = createAdminClient()
  const { error } = await db
    .from('authors')
    .delete()
    .eq('id', authorId)
    .eq('tenant_id', workspace.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

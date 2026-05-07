'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import ImagePicker, { type ImageCandidate } from './ImagePicker'
import SchedulePicker from './SchedulePicker'
import type { BlogPost } from '@/lib/supabase/aliases'

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), { ssr: false })

// ============================================================
// MDX frontmatter helpers
// ============================================================

function parseMdxBody(mdx: string): string {
  const match = mdx.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/)
  return match ? match[1].trim() : mdx.trim()
}

function parseFrontmatter(mdx: string): Record<string, string> {
  const match = mdx.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const fm: Record<string, string> = {}
  match[1].split('\n').forEach((line) => {
    const idx = line.indexOf(':')
    if (idx === -1) return
    fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
  })
  return fm
}

function buildMdx(fm: Record<string, string>, body: string): string {
  const lines = Object.entries(fm)
    .map(([k, v]) => {
      if (k === 'tags') return `tags: ${v}`
      return `${k}: "${v.replace(/"/g, '\\"')}"`
    })
    .join('\n')
  return `---\n${lines}\n---\n\n${body}`
}

// ============================================================
// Types
// ============================================================

type Tab = 'editor' | 'images' | 'schedule' | 'meta'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  in_review: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  approved: 'bg-green-500/10 text-green-300 border-green-500/20',
  scheduled: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  published: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-300 border-red-500/20',
}

// ============================================================
// Component
// ============================================================

interface Props {
  post: BlogPost
}

export default function PostReviewClient({ post }: Props) {
  const router = useRouter()
  const fm = parseFrontmatter(post.body_mdx ?? '')
  const initialBody = parseMdxBody(post.body_mdx ?? '')

  const [body, setBody] = useState(initialBody)
  const [title, setTitle] = useState(post.title)
  const [excerpt, setExcerpt] = useState(post.excerpt ?? fm.excerpt ?? '')
  const [metaDescription, setMetaDescription] = useState(post.meta_description ?? fm.metaDescription ?? '')
  const [tags, setTags] = useState((post.tags ?? []).join(', '))

  const candidates = (post.image_suggestions as unknown as ImageCandidate[]) ?? []
  const [selectedImage, setSelectedImage] = useState<ImageCandidate | null>(
    candidates.find((c) => c.url === post.hero_image_url) ?? null,
  )

  const [schedule, setSchedule] = useState<{ mode: 'auto' | 'manual'; datetime: string }>({
    mode: 'auto',
    datetime: post.scheduled_for
      ? new Date(post.scheduled_for).toISOString().slice(0, 16)
      : '',
  })

  const [reviewerNotes, setReviewerNotes] = useState(post.reviewer_notes ?? '')
  const [activeTab, setActiveTab] = useState<Tab>('editor')
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState('')

  const handleBodyChange = useCallback((md: string) => setBody(md), [])

  async function savePost() {
    setSaving(true)
    setSaveMsg('')
    const updatedFm = {
      ...fm,
      title,
      excerpt,
      metaDescription,
      tags: `[${tags.split(',').map((t: string) => `"${t.trim()}"`).join(', ')}]`,
    }
    const newMdx = buildMdx(updatedFm, body)
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body_mdx: newMdx,
        title,
        excerpt,
        meta_description: metaDescription,
        tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      }),
    })
    setSaving(false)
    setSaveMsg(res.ok ? 'Saved' : 'Save failed')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this post? This cannot be undone.')) return
    setActionLoading('delete')
    const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/author')
    } else {
      setActionLoading(null)
    }
  }

  async function takeAction(action: 'submit_review' | 'approve' | 'request_changes' | 'reject') {
    setActionLoading(action)
    const payload: Record<string, unknown> = {
      action,
      reviewerNotes: reviewerNotes || undefined,
    }
    if (action === 'approve') {
      payload.autoSchedule = schedule.mode === 'auto'
      if (schedule.mode === 'manual' && schedule.datetime) {
        payload.scheduledFor = new Date(schedule.datetime).toISOString()
      }
      if (selectedImage) {
        payload.heroImageUrl = selectedImage.url
        payload.heroImageCredit = `Photo by ${selectedImage.photographer_name} on Unsplash`
        payload.heroImageAlt = selectedImage.alt_text
      }
    }
    const res = await fetch(`/api/posts/${post.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setActionLoading(null)
    if (res.ok) router.refresh()
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'editor', label: 'Editor' },
    { id: 'images', label: `Images${candidates.length ? ` (${candidates.length})` : ''}` },
    { id: 'schedule', label: 'Schedule' },
    { id: 'meta', label: 'Meta' },
  ]

  const statusKey = post.status ?? 'draft'

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold bg-transparent border-none outline-none w-full text-white placeholder-white/30 truncate"
            placeholder="Post title"
          />
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[statusKey] ?? 'bg-white/10 text-white/50 border-white/10'}`}>
              {statusKey.replace('_', ' ')}
            </span>
            {post.drafted_at && (
              <span className="text-xs text-white/30">
                Drafted {new Date(post.drafted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={savePost}
            disabled={saving}
            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : saveMsg || 'Save'}
          </button>
          <button
            onClick={handleDelete}
            disabled={actionLoading === 'delete'}
            className="px-4 py-2 text-sm text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/10 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors -mb-px ${
              activeTab === tab.id
                ? 'bg-white/10 text-white border-b-2 border-indigo-500'
                : 'text-white/40 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mb-8">
        {activeTab === 'editor' && (
          <TiptapEditor content={body} onChange={handleBodyChange} />
        )}

        {activeTab === 'images' && (
          <div className="space-y-4">
            <p className="text-sm text-white/50">
              Select a hero image for this post. Attribution is included automatically.
            </p>
            <ImagePicker
              candidates={candidates}
              selectedId={selectedImage?.unsplash_id ?? null}
              onSelect={setSelectedImage}
            />
            {selectedImage && (
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                <span className="text-green-400 text-sm">✓ Selected:</span>
                <span className="text-sm text-white/70 truncate">{selectedImage.alt_text}</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="max-w-md space-y-4">
            <p className="text-sm text-white/50">
              Choose when this post should be published.
            </p>
            <SchedulePicker value={schedule} onChange={setSchedule} />
            {post.scheduled_for && (
              <p className="text-xs text-white/30">
                Currently scheduled:{' '}
                {new Date(post.scheduled_for).toLocaleString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        )}

        {activeTab === 'meta' && (
          <div className="max-w-2xl space-y-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Excerpt</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="One-sentence summary for listings and social sharing"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">
                Meta description{' '}
                <span className={metaDescription.length > 160 ? 'text-red-400' : 'text-white/30'}>
                  ({metaDescription.length}/160)
                </span>
              </label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="SEO meta description (under 160 characters)"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Tags (comma-separated)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="print, marketing, small business"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Slug</label>
              <p className="text-sm text-white/40 font-mono bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                {post.slug}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Review actions */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-medium text-white/70">Reviewer notes</h3>
        <textarea
          value={reviewerNotes}
          onChange={(e) => setReviewerNotes(e.target.value)}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
          placeholder="Optional notes for Clem or the team…"
        />

        <div className="flex flex-wrap gap-3 pt-1">
          {(statusKey === 'draft') && (
            <button
              onClick={() => takeAction('submit_review')}
              disabled={actionLoading !== null}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {actionLoading === 'submit_review' ? 'Submitting…' : 'Submit for review'}
            </button>
          )}

          {(statusKey === 'in_review' || statusKey === 'draft') && (
            <>
              <button
                onClick={() => takeAction('approve')}
                disabled={actionLoading !== null}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {actionLoading === 'approve' ? 'Approving…' : '✓ Approve & Schedule'}
              </button>
              <button
                onClick={() => takeAction('request_changes')}
                disabled={actionLoading !== null}
                className="px-5 py-2.5 bg-yellow-600/80 hover:bg-yellow-500/80 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {actionLoading === 'request_changes' ? 'Sending…' : '↩ Request changes'}
              </button>
              <button
                onClick={() => takeAction('reject')}
                disabled={actionLoading !== null}
                className="px-5 py-2.5 bg-white/10 hover:bg-red-600/30 disabled:opacity-50 text-white/60 hover:text-red-300 text-sm rounded-lg transition-colors"
              >
                {actionLoading === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
            </>
          )}

          {statusKey === 'scheduled' && (
            <p className="text-sm text-white/40 self-center">
              ✓ Scheduled for{' '}
              {new Date(post.scheduled_for!).toLocaleString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}

          {statusKey === 'published' && (
            <p className="text-sm text-emerald-400 self-center">✓ Published</p>
          )}
        </div>
      </div>
    </div>
  )
}

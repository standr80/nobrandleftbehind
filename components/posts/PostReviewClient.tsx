'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import SchedulePicker from './SchedulePicker'
import PostPreview from './PostPreview'
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

type Tab = 'editor' | 'preview' | 'images' | 'schedule' | 'meta'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border-yellow-500/20',
  in_review: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-green-500/10 text-green-300 border-green-500/20',
  scheduled: 'bg-purple-50 text-purple-700 border-purple-200',
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}

// ============================================================
// Component
// ============================================================

interface Props {
  post: BlogPost
  tenantId: string
}

export default function PostReviewClient({ post, tenantId }: Props) {
  const router = useRouter()
  const fm = parseFrontmatter(post.body_mdx ?? '')
  const initialBody = parseMdxBody(post.body_mdx ?? '')

  const [body, setBody] = useState(initialBody)
  const [title, setTitle] = useState(post.title)
  const [excerpt, setExcerpt] = useState(post.excerpt ?? fm.excerpt ?? '')
  const [metaDescription, setMetaDescription] = useState(post.meta_description ?? fm.metaDescription ?? '')
  const [tags, setTags] = useState((post.tags ?? []).join(', '))

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
  const [htmlCopied, setHtmlCopied] = useState(false)
  const [htmlLoading, setHtmlLoading] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(
    post.hero_image_url ?? null,
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleBodyChange = useCallback((md: string) => setBody(md), [])

  async function fetchHtml(wrap: boolean): Promise<string> {
    const res = await fetch(`/api/posts/${post.id}/html${wrap ? '?wrap=1' : ''}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to convert HTML')
    return data.html as string
  }

  async function copyHtml() {
    setHtmlLoading(true)
    try {
      const html = await fetchHtml(false)
      await navigator.clipboard.writeText(html)
      setHtmlCopied(true)
      setTimeout(() => setHtmlCopied(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setHtmlLoading(false)
    }
  }

  async function downloadHtml() {
    setHtmlLoading(true)
    try {
      const html = await fetchHtml(true)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${post.slug ?? 'post'}.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    } finally {
      setHtmlLoading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/posts/${post.id}/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setUploadedImageUrl(data.url)

    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

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
    const heroFields = uploadedImageUrl
      ? { hero_image_url: uploadedImageUrl, hero_image_credit: null, hero_image_alt: title }
      : {}

    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body_mdx: newMdx,
        title,
        excerpt,
        meta_description: metaDescription,
        tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        ...heroFields,
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

  async function takeAction(action: 'submit_review' | 'approve' | 'request_changes' | 'reject' | 'publish_now') {
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
      if (uploadedImageUrl) {
        payload.heroImageUrl = uploadedImageUrl
        payload.heroImageAlt = title
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
    { id: 'preview', label: 'Preview' },
    { id: 'images', label: 'Hero Image' },
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
            className="text-2xl font-bold bg-transparent border-none outline-none w-full text-slate-900 placeholder-slate-400 truncate"
            placeholder="Post title"
          />
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[statusKey] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
              {statusKey.replace('_', ' ')}
            </span>
            {post.drafted_at && (
              <span className="text-xs text-slate-400">
                Drafted {new Date(post.drafted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={copyHtml}
            disabled={htmlLoading}
            className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            title="Copy post as clean HTML"
          >
            {htmlLoading ? 'Converting…' : htmlCopied ? '✓ Copied HTML' : 'Copy HTML'}
          </button>
          <button
            onClick={downloadHtml}
            disabled={htmlLoading}
            className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            title="Download as self-contained .html file"
          >
            ↓ .html
          </button>
          <button
            onClick={savePost}
            disabled={saving}
            className="px-4 py-2 text-sm bg-slate-100 hover:bg-white/15 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : saveMsg || 'Save'}
          </button>
          <button
            onClick={handleDelete}
            disabled={actionLoading === 'delete'}
            className="px-4 py-2 text-sm text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors -mb-px ${
              activeTab === tab.id
                ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-400 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mb-8">
        {activeTab === 'editor' && (
          <TiptapEditor content={body} onChange={handleBodyChange} postId={post.id} />
        )}

        {activeTab === 'preview' && (
          <div className="bg-white/3 border border-slate-200 rounded-2xl p-8">
            <PostPreview
              title={title}
              body={body}
              excerpt={excerpt}
              tags={tags.split(',').map((t) => t.trim()).filter(Boolean)}
              heroImageUrl={uploadedImageUrl ?? null}
              heroImageCredit={null}
              draftedAt={post.drafted_at ?? null}
            />
          </div>
        )}

        {activeTab === 'images' && (
          <div className="max-w-xl space-y-4">
            <p className="text-sm text-slate-500">
              Upload a hero image — this appears as the card thumbnail in the embed widget and at the top of the post preview.
            </p>
            <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-6 py-10 cursor-pointer transition-colors ${uploading ? 'border-slate-200 opacity-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-500/5'}`}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={uploading}
                onChange={handleFileUpload}
              />
              {uploading ? (
                <>
                  <span className="w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                  <span className="text-sm text-slate-400">Uploading…</span>
                </>
              ) : (
                <>
                  <span className="text-2xl text-slate-400">↑</span>
                  <span className="text-sm text-slate-600 font-medium">Click to upload hero image</span>
                  <span className="text-xs text-slate-400">JPEG, PNG, WebP or GIF · max 10 MB</span>
                </>
              )}
            </label>
            {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
            {uploadedImageUrl && (
              <div className="relative rounded-xl overflow-hidden aspect-[16/7]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedImageUrl} alt="Hero image" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setUploadedImageUrl(null)}
                    className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg"
                  >
                    Remove
                  </button>
                </div>
                <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded">
                  ✓ Hero image set
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="max-w-md space-y-4">
            <p className="text-sm text-slate-500">
              Choose when this post should be published.
            </p>
            <SchedulePicker value={schedule} onChange={setSchedule} />
            {post.scheduled_for && (
              <p className="text-xs text-slate-400">
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

            {statusKey !== 'published' && (
              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs text-slate-400 mb-3">
                  Skip the schedule and mark this post as published right now. It will immediately appear in your embed feed.
                </p>
                <button
                  onClick={() => takeAction('publish_now')}
                  disabled={actionLoading !== null}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  {actionLoading === 'publish_now' ? 'Publishing…' : '⚡ Publish Now'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'meta' && (
          <div className="max-w-2xl space-y-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Excerpt</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="One-sentence summary for listings and social sharing"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Meta description{' '}
                <span className={metaDescription.length > 160 ? 'text-red-600' : 'text-slate-400'}>
                  ({metaDescription.length}/160)
                </span>
              </label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={2}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="SEO meta description (under 160 characters)"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tags (comma-separated)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                placeholder="print, marketing, small business"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Slug</label>
              <p className="text-sm text-slate-400 font-mono bg-white border border-slate-200 rounded-lg px-3 py-2">
                {post.slug}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Review actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-medium text-slate-700">Reviewer notes</h3>
        <textarea
          value={reviewerNotes}
          onChange={(e) => setReviewerNotes(e.target.value)}
          rows={3}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 resize-none"
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
                className="px-5 py-2.5 bg-slate-100 hover:bg-red-600/30 disabled:opacity-50 text-slate-600 hover:text-red-600 text-sm rounded-lg transition-colors"
              >
                {actionLoading === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
            </>
          )}

          {statusKey === 'scheduled' && (
            <p className="text-sm text-slate-400 self-center">
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
            <p className="text-sm text-emerald-700 self-center">✓ Published</p>
          )}
        </div>
      </div>
    </div>
  )
}

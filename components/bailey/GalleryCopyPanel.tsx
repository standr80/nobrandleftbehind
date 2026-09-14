'use client'

import { useState } from 'react'
import { MAX_GALLERY_TAGS, normaliseGalleryTags, shopifyTagPageUrl } from '@/lib/bailey/constants'

interface Props {
  tenantId: string
  galleryId: string
  initialIntro: string | null
  initialMeta: string | null
  initialTags: string[] | null
  initialClusterId: string | null
  isPublished: boolean
  /** The live Shopify article, when there is one — tag pages hang off its blog. */
  shopifyArticleUrl?: string | null
}

const sameTags = (a: string[], b: string[]) => a.join('\u0000') === b.join('\u0000')

export default function GalleryCopyPanel({
  tenantId,
  galleryId,
  initialIntro,
  initialMeta,
  initialTags,
  initialClusterId,
  isPublished,
  shopifyArticleUrl,
}: Props) {
  const [intro, setIntro] = useState(initialIntro ?? '')
  const [meta, setMeta] = useState(initialMeta ?? '')
  const [tags, setTags] = useState<string[]>(initialTags ?? [])
  const [clusterId, setClusterId] = useState(initialClusterId)
  const [savedIntro, setSavedIntro] = useState(initialIntro ?? '')
  const [savedMeta, setSavedMeta] = useState(initialMeta ?? '')
  const [savedTags, setSavedTags] = useState<string[]>(initialTags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tagsDirty = !sameTags(tags, savedTags) || tagInput.trim() !== ''
  const dirty = intro !== savedIntro || meta !== savedMeta || tagsDirty

  /** Add one or more comma-separated tags from the input. */
  function addTags(raw: string) {
    if (!raw.trim()) return
    setTags((current) => normaliseGalleryTags([...current, ...raw.split(',')]))
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((t) => t !== tag))
  }

  async function generate() {
    if (generating) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/galleries/${galleryId}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not generate copy')
      setIntro(data.body_mdx ?? '')
      setSavedIntro(data.body_mdx ?? '')
      setMeta(data.meta_description ?? '')
      setSavedMeta(data.meta_description ?? '')
      // The server only fills tags when there were none saved. Unsaved tag
      // edits in the editor survive either way.
      setSavedTags(data.tags ?? [])
      if (!tagsDirty) setTags(data.tags ?? [])
      setClusterId(data.cluster_id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate copy')
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (saving || !dirty) return
    setSaving(true)
    setError(null)
    // A tag typed but not yet entered still counts — nobody expects Save to
    // silently drop it.
    const nextTags = normaliseGalleryTags([...tags, ...tagInput.split(',')])
    try {
      const res = await fetch(`/api/galleries/${galleryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, body_mdx: intro, meta_description: meta, tags: nextTags }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save')
      const stored: string[] = Array.isArray(data.gallery?.tags) ? data.gallery.tags : nextTags
      setSavedIntro(intro)
      setSavedMeta(meta)
      setTags(stored)
      setSavedTags(stored)
      setTagInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Page copy</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Write your own, or let Clem draft it from your captions
            {clusterId && (
              <>
                {' '}
                · cluster: <span className="font-medium text-slate-700">{clusterId}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (
              savedIntro &&
              !window.confirm('Replace the intro and meta description with a fresh draft from Clem?')
            ) {
              return
            }
            void generate()
          }}
          disabled={generating}
          className="px-3 py-1.5 rounded-lg border border-amber-600 text-amber-700 text-sm font-medium hover:bg-amber-50 disabled:opacity-50 shrink-0"
        >
          {generating ? 'Writing…' : savedIntro ? 'Regenerate' : 'Generate page copy'}
        </button>
      </div>

      <label className="block">
        <span className="text-xs text-slate-500">Intro (shown above the image grid)</span>
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          rows={6}
          placeholder="Write the intro yourself, or use Generate page copy above for a draft you can edit."
          className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">
          Meta description ({meta.length}/160)
        </span>
        <input
          type="text"
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
          placeholder="One sentence describing the gallery, for search results."
          className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </label>
      <div>
        <label htmlFor={`tags-${galleryId}`} className="text-xs text-slate-500">
          Tags — group related galleries (e.g. <span className="font-medium">christmas</span>). Also used to pick Related reading.
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 border border-slate-300 rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-amber-500">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 bg-slate-100 rounded-full pl-2 pr-1 py-0.5 text-xs text-slate-700"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                aria-label={`Remove tag ${t}`}
                className="w-4 h-4 rounded-full leading-none text-slate-400 hover:bg-slate-300 hover:text-slate-700"
              >
                ×
              </button>
            </span>
          ))}
          {tags.length < MAX_GALLERY_TAGS && (
            <input
              id={`tags-${galleryId}`}
              type="text"
              value={tagInput}
              onChange={(e) => {
                // Typing or pasting a comma commits everything before it.
                const value = e.target.value
                const lastComma = value.lastIndexOf(',')
                if (lastComma === -1) {
                  setTagInput(value)
                } else {
                  setTags((current) => normaliseGalleryTags([...current, ...value.slice(0, lastComma).split(',')]))
                  setTagInput(value.slice(lastComma + 1))
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTags(tagInput)
                } else if (e.key === 'Backspace' && !tagInput && tags.length) {
                  removeTag(tags[tags.length - 1])
                }
              }}
              onBlur={() => addTags(tagInput)}
              placeholder={tags.length ? 'Add tag' : 'Type a tag and press Enter'}
              className="flex-1 min-w-[10rem] py-0.5 text-sm placeholder:text-slate-400 focus:outline-none"
            />
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {tags.length >= MAX_GALLERY_TAGS
            ? `That's the maximum of ${MAX_GALLERY_TAGS} tags.`
            : 'Regenerate only suggests tags when this list is empty — it never replaces yours.'}
        </p>
        {isPublished && shopifyArticleUrl && savedTags.length > 0 && (
          <p className="text-xs text-slate-500 mt-1.5">
            Pages listing every gallery with a tag:{' '}
            {savedTags.map((t, i) => {
              const href = shopifyTagPageUrl(shopifyArticleUrl, t)
              if (!href) return null
              return (
                <span key={t}>
                  {i > 0 && ' · '}
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">
                    {t} ↗
                  </a>
                </span>
              )
            })}
            <span className="text-slate-400"> — a gallery joins these once it&apos;s republished with the tag.</span>
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save copy'}
        </button>
        {isPublished && (
          <span className="text-xs text-slate-400">
            Republish below to put changes live.
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

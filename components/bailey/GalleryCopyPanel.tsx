'use client'

import { useState } from 'react'

interface Props {
  tenantId: string
  galleryId: string
  initialIntro: string | null
  initialMeta: string | null
  initialTags: string[] | null
  initialClusterId: string | null
  isPublished: boolean
}

export default function GalleryCopyPanel({
  tenantId,
  galleryId,
  initialIntro,
  initialMeta,
  initialTags,
  initialClusterId,
  isPublished,
}: Props) {
  const [intro, setIntro] = useState(initialIntro ?? '')
  const [meta, setMeta] = useState(initialMeta ?? '')
  const [tags, setTags] = useState<string[]>(initialTags ?? [])
  const [clusterId, setClusterId] = useState(initialClusterId)
  const [savedIntro, setSavedIntro] = useState(initialIntro ?? '')
  const [savedMeta, setSavedMeta] = useState(initialMeta ?? '')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = intro !== savedIntro || meta !== savedMeta

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
      setTags(data.tags ?? [])
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
    try {
      const res = await fetch(`/api/galleries/${galleryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, body_mdx: intro, meta_description: meta }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save')
      setSavedIntro(intro)
      setSavedMeta(meta)
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
            Clem writes the intro, meta description and tags from your captions
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
          onClick={() => void generate()}
          disabled={generating}
          className="px-3 py-1.5 rounded-lg border border-amber-600 text-amber-700 text-sm font-medium hover:bg-amber-50 disabled:opacity-50 shrink-0"
        >
          {generating ? 'Writing…' : savedIntro ? 'Regenerate' : 'Generate page copy'}
        </button>
      </div>

      {(savedIntro || intro) && (
        <>
          <label className="block">
            <span className="text-xs text-slate-500">Intro (shown above the image grid)</span>
            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={6}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>
          {tags.length > 0 && (
            <p className="text-xs text-slate-500">
              Tags: {tags.map((t) => (
                <span key={t} className="inline-block bg-slate-100 rounded-full px-2 py-0.5 mr-1">
                  {t}
                </span>
              ))}
            </p>
          )}
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
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

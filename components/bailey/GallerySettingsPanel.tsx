'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  tenantId: string
  galleryId: string
  initialTitle: string
  initialSlug: string
  initialContext: string | null
  initialShowCaptions: boolean
  isPublished: boolean
}

/**
 * Rename a gallery, and edit the context that feeds Bailey's vision prompt.
 *
 * The slug follows the title while the gallery is a draft — nothing is live, so
 * there is no reason for the URL to fossilise whatever it was first called. Once
 * published the slug is left alone unless deliberately changed, because changing
 * it moves the live page and 404s any link already shared.
 */
export default function GallerySettingsPanel({
  tenantId,
  galleryId,
  initialTitle,
  initialSlug,
  initialContext,
  initialShowCaptions,
  isPublished,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [context, setContext] = useState(initialContext ?? '')
  const [slug, setSlug] = useState(initialSlug)
  const [editSlug, setEditSlug] = useState(false)
  const [saved, setSaved] = useState({ title: initialTitle, context: initialContext ?? '', slug: initialSlug })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [overwriteEdited, setOverwriteEdited] = useState(false)
  const [regenResult, setRegenResult] = useState<string | null>(null)
  const [showCaptions, setShowCaptions] = useState(initialShowCaptions)
  const [savingCaptions, setSavingCaptions] = useState(false)

  const dirty =
    title.trim() !== saved.title ||
    context.trim() !== (saved.context ?? '') ||
    (editSlug && slug.trim() !== saved.slug)

  async function save() {
    if (!title.trim()) {
      setError('A gallery title is required.')
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/galleries/${galleryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          title: title.trim(),
          gallery_context: context.trim(),
          ...(editSlug && slug.trim() !== saved.slug ? { slug: slug.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')

      const next = {
        title: data.gallery?.title ?? title.trim(),
        context: data.gallery?.gallery_context ?? '',
        slug: data.gallery?.slug ?? slug,
      }
      setSaved(next)
      setTitle(next.title)
      setContext(next.context)
      setSlug(next.slug)
      setEditSlug(false)
      if (data.slugChanged) {
        setNotice(
          isPublished
            ? `Address changed to /${next.slug} — republish to move the live page. The old address will stop working.`
            : `Address updated to /${next.slug}.`,
        )
      }
      // The title is rendered by the server component above this panel.
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleCaptions(next: boolean) {
    setShowCaptions(next)
    setSavingCaptions(true)
    setError(null)
    try {
      const res = await fetch(`/api/galleries/${galleryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, gallery_show_captions: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not save')
      router.refresh()
    } catch (e) {
      setShowCaptions(!next) // put the switch back where it was
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSavingCaptions(false)
    }
  }

  async function regenerate() {
    setRegenerating(true)
    setError(null)
    setRegenResult(null)
    try {
      const res = await fetch(`/api/galleries/${galleryId}/reenrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, overwriteEdited }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not regenerate captions')

      const bits: string[] = []
      if (data.regenerated) bits.push(`${data.regenerated} regenerated`)
      if (data.failed) bits.push(`${data.failed} failed`)
      if (data.skippedEdited) bits.push(`${data.skippedEdited} kept (edited by hand)`)
      let msg = bits.length ? bits.join(' · ') : (data.message ?? 'Nothing to regenerate.')
      if (data.urlsChanged) {
        msg +=
          ' — image addresses changed, so republish to update the live page.'
      }
      setRegenResult(msg)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not regenerate captions')
    } finally {
      setRegenerating(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-amber-700 font-medium hover:underline mb-6"
      >
        Gallery settings
      </button>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-6 space-y-3 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Gallery settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            The context is fed to Bailey when it writes alt text and captions — the
            more specific, the better they get.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
        >
          Close
        </button>
      </div>

      <label className="block">
        <span className="text-xs text-slate-500">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </label>

      <label className="block">
        <span className="text-xs text-slate-500">
          Context — venue, occasion, location, date
        </span>
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. Exchange visit to Noyelles-lès-Seclin, May 2026"
          className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </label>

      <div>
        <span className="text-xs text-slate-500">Address</span>
        {editSlug ? (
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        ) : (
          <p className="mt-1 text-sm text-slate-600 font-mono">
            /{saved.slug}
            <button
              type="button"
              onClick={() => setEditSlug(true)}
              className="ml-3 font-sans text-xs text-amber-700 hover:underline"
            >
              Change
            </button>
          </p>
        )}
        <p className="text-xs text-slate-400 mt-1">
          {isPublished
            ? 'This gallery is published, so the address stays put when you rename it. Changing it moves the live page and breaks any link already shared.'
            : 'Follows the title until the gallery is published.'}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save details'}
        </button>
        {isPublished && dirty && (
          <span className="text-xs text-slate-400">Republish below to put changes live.</span>
        )}
      </div>

      {notice && <p className="text-sm text-amber-700">{notice}</p>}

      <div className="border-t border-slate-200 pt-3 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Captions</h3>

        <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showCaptions}
            disabled={savingCaptions}
            onChange={(e) => void toggleCaptions(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Show captions under each image on the published page
            <span className="block text-xs text-slate-500">
              Turning this off keeps the caption text — it still feeds alt text,
              structured data and search — it just isn&apos;t displayed. Set the
              default for new galleries in Settings.
            </span>
          </span>
        </label>

        <p className="text-xs text-slate-500">
          Rewrite every image&apos;s alt text and caption using the title and
          context above. Worth doing after improving the context — it is what
          Bailey is shown when it looks at each photograph.
        </p>
        <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={overwriteEdited}
            onChange={(e) => setOverwriteEdited(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Also overwrite captions I have edited by hand. Off by default, so a
            re-run cannot discard your own wording.
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={regenerating || dirty}
            className="px-3 py-1.5 rounded-lg border border-amber-600 text-amber-700 text-sm font-medium hover:bg-amber-50 disabled:opacity-50"
          >
            {regenerating ? 'Rewriting…' : 'Regenerate captions'}
          </button>
          {dirty && (
            <span className="text-xs text-slate-400">
              Save your changes first — the new context is what gets used.
            </span>
          )}
        </div>
        {regenResult && <p className="text-sm text-amber-700">{regenResult}</p>}
        {isPublished && (
          <p className="text-xs text-slate-400">
            Regenerating renames each image file, so the live page keeps the old
            captions and addresses until you republish.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

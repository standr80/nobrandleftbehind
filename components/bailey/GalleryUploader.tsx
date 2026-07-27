'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ALLOWED_EXTENSIONS,
  GALLERY_BUCKET,
  MAX_IMAGES_PER_GALLERY,
  MAX_SOURCE_BYTES,
  fileExtension,
  type GalleryImage,
} from '@/lib/bailey/constants'

export type UploadedImage = GalleryImage & { preview_url: string }

interface PendingUpload {
  key: string
  name: string
  previewUrl: string // '' for HEIC until converted (browsers can't render HEIC)
  status: 'converting' | 'uploading' | 'failed'
  error?: string
  file: File
}

/** iPhone HEIC → JPEG in the browser (WASM), so the server never sees HEIC
 *  and staff never touch camera settings. ~1-2s per photo. */
async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
  const blob = Array.isArray(out) ? out[0] : out
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' })
}

function isHeic(name: string): boolean {
  const ext = fileExtension(name)
  return ext === 'heic' || ext === 'heif'
}

interface Props {
  tenantId: string
  galleryId: string
  galleryTitle?: string
  galleryContext?: string | null
  galleryStatus?: string | null
  publishedUrl?: string | null
  consentAttested?: boolean
  initialImages: UploadedImage[]
}

const UPLOAD_CONCURRENCY = 3

const STATUS_STYLES: Record<string, string> = {
  uploaded: 'bg-slate-100 text-slate-600',
  processed: 'bg-sky-100 text-sky-700',
  enriched: 'bg-violet-100 text-violet-700',
  ready: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  importing: 'bg-slate-100 text-slate-600',
  uploading: 'bg-amber-100 text-amber-700',
  converting: 'bg-amber-100 text-amber-700',
  processing: 'bg-amber-100 text-amber-700',
  enriching: 'bg-violet-100 text-violet-700',
}

export default function GalleryUploader({
  tenantId,
  galleryId,
  galleryTitle,
  galleryContext,
  galleryStatus,
  publishedUrl,
  consentAttested,
  initialImages,
}: Props) {
  const [images, setImages] = useState<UploadedImage[]>(initialImages)
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [activeSteps, setActiveSteps] = useState<Record<string, 'processing' | 'enriching'>>({})
  const [dragOver, setDragOver] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [galleryPreview, setGalleryPreview] = useState(false)
  const [editAlt, setEditAlt] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [attested, setAttested] = useState(Boolean(consentAttested))
  const [attestChecked, setAttestChecked] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [liveUrl, setLiveUrl] = useState<string | null>(publishedUrl ?? null)
  const [status, setStatus] = useState<string | null>(galleryStatus ?? null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Registration is a read-modify-write on the gallery row — serialise it.
  const registerChain = useRef<Promise<void>>(Promise.resolve())
  const countRef = useRef(initialImages.length)

  const patchImage = useCallback((id: string, patch: Partial<UploadedImage>) => {
    setImages((imgs) => imgs.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }, [])

  const runStep = useCallback(
    async (imageId: string, step: 'process' | 'enrich'): Promise<GalleryImage | null> => {
      const label = step === 'process' ? 'processing' : 'enriching'
      setActiveSteps((s) => ({ ...s, [imageId]: label }))
      try {
        const res = await fetch(`/api/galleries/${galleryId}/images/${imageId}/${step}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId }),
        })
        const data = await res.json().catch(() => ({}))
        if (data.image) {
          patchImage(imageId, {
            ...data.image,
            preview_url: data.image.thumb_url ?? data.image.url ?? undefined,
          })
          return data.image as GalleryImage
        }
        if (!res.ok) {
          patchImage(imageId, { status: 'failed', error: data.error ?? `${label} failed` })
        }
        return null
      } catch {
        patchImage(imageId, { status: 'failed', error: `${label} failed — retry below` })
        return null
      } finally {
        setActiveSteps((s) => {
          const next = { ...s }
          delete next[imageId]
          return next
        })
      }
    },
    [galleryId, tenantId, patchImage],
  )

  const uploadOne = useCallback(
    async (item: PendingUpload) => {
      const fail = (message: string) =>
        setPending((p) => p.map((u) => (u.key === item.key ? { ...u, status: 'failed', error: message } : u)))
      try {
        // 0. HEIC → JPEG in-browser first (server allowlist stays jpg/png/webp)
        let file = item.file
        if (isHeic(file.name)) {
          try {
            file = await convertHeicToJpeg(file)
          } catch {
            fail(`${item.name}: HEIC conversion failed — export as JPEG and retry`)
            return
          }
          if (file.size > MAX_SOURCE_BYTES) {
            fail(`${item.name}: converted JPEG is over the 10MB limit`)
            return
          }
          const newPreview = URL.createObjectURL(file)
          setPending((p) =>
            p.map((u) => (u.key === item.key ? { ...u, status: 'uploading', previewUrl: newPreview, file } : u)),
          )
        }

        // 1. signed URL (server enforces allowlist + caps at issuance)
        const urlRes = await fetch(`/api/galleries/${galleryId}/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, filename: file.name, size: file.size }),
        })
        const urlData = await urlRes.json()
        if (!urlRes.ok) throw new Error(urlData.error ?? 'Could not get upload URL')

        // 2. direct browser → Storage upload (Vercel body limit not in play)
        const supabase = createClient()
        const { error: upErr } = await supabase.storage
          .from(GALLERY_BUCKET)
          .uploadToSignedUrl(urlData.path, urlData.token, file)
        if (upErr) throw new Error(upErr.message)

        // 3. register (serialised; one failure must not poison the chain)
        const link = registerChain.current.then(async () => {
          const regRes = await fetch(`/api/galleries/${galleryId}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, path: urlData.path }),
          })
          const regData = await regRes.json()
          if (!regRes.ok) throw new Error(regData.error ?? 'Could not register image')
          return regData as { image: GalleryImage; preview_url: string }
        })
        registerChain.current = link.then(() => undefined, () => undefined)
        const registered = await link

        setImages((imgs) => [...imgs, { ...registered.image, preview_url: registered.preview_url }])
        setPending((p) => p.filter((u) => u.key !== item.key))
        URL.revokeObjectURL(item.previewUrl)

        // 4. sharp processing, then vision enrichment (still inside this
        // worker → concurrency ≤3 for the whole per-image pipeline)
        const processed = await runStep(registered.image.id, 'process')
        if (processed?.status === 'processed') {
          await runStep(registered.image.id, 'enrich')
        }
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Upload failed')
      }
    },
    [galleryId, tenantId, runStep],
  )

  const enqueueFiles = useCallback(
    (files: File[]) => {
      setNotice(null)
      const accepted: PendingUpload[] = []
      const rejected: string[] = []

      for (const file of files) {
        const ext = fileExtension(file.name)
        const heic = isHeic(file.name)
        if (!heic && !(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
          rejected.push(`${file.name}: unsupported type (use ${ALLOWED_EXTENSIONS.join(', ')}, heic)`)
          continue
        }
        // HEIC converts to a LARGER JPEG, so a 10MB HEIC can't make the cap.
        if (file.size > MAX_SOURCE_BYTES) {
          rejected.push(`${file.name}: over the 10MB limit`)
          continue
        }
        if (countRef.current >= MAX_IMAGES_PER_GALLERY) {
          rejected.push(`${file.name}: gallery is at the ${MAX_IMAGES_PER_GALLERY}-image limit`)
          continue
        }
        countRef.current += 1
        accepted.push({
          key: `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          // Browsers can't render HEIC — no preview until converted.
          previewUrl: heic ? '' : URL.createObjectURL(file),
          status: heic ? 'converting' : 'uploading',
          file,
        })
      }

      if (rejected.length) setNotice(rejected.join(' · '))
      if (!accepted.length) return
      setPending((p) => [...p, ...accepted])

      // Limited-concurrency worker pool over the accepted files.
      const queue = [...accepted]
      const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          await uploadOne(item)
        }
      })
      void Promise.all(workers)
    },
    [uploadOne],
  )

  // Keyboard nav for the single-image preview: Esc closes, arrows move.
  useEffect(() => {
    if (previewIndex === null && !galleryPreview) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPreviewIndex(null)
        setGalleryPreview(false)
      } else if (previewIndex !== null && e.key === 'ArrowRight') {
        setPreviewIndex((i) => (i === null ? i : Math.min(i + 1, images.length - 1)))
      } else if (previewIndex !== null && e.key === 'ArrowLeft') {
        setPreviewIndex((i) => (i === null ? i : Math.max(i - 1, 0)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewIndex, galleryPreview, images.length])

  // Seed the edit fields whenever the previewed image changes.
  useEffect(() => {
    if (previewIndex === null) return
    const img = images[previewIndex]
    setEditAlt(img?.alt ?? '')
    setEditCaption(img?.caption ?? '')
  }, [previewIndex, images])

  async function saveMeta() {
    if (previewIndex === null || savingMeta) return
    const img = images[previewIndex]
    if (!img) return
    setSavingMeta(true)
    try {
      const res = await fetch(`/api/galleries/${galleryId}/images/${img.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, alt: editAlt, caption: editCaption }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.image) patchImage(img.id, data.image)
      else setNotice(data.error ?? 'Could not save changes')
    } finally {
      setSavingMeta(false)
    }
  }

  async function rotatePreviewed(degrees: 90 | 180 | 270) {
    if (previewIndex === null || rotating) return
    const img = images[previewIndex]
    if (!img?.master_path) return
    setRotating(true)
    try {
      const res = await fetch(`/api/galleries/${galleryId}/images/${img.id}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, degrees }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.image) {
        patchImage(img.id, { ...data.image, preview_url: data.image.thumb_url ?? data.image.url })
      } else {
        setNotice(data.error ?? 'Could not rotate image')
      }
    } finally {
      setRotating(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function deleteImages(ids: string[]) {
    if (deleting || !ids.length) return
    const label = ids.length === 1 ? 'this image' : `these ${ids.length} images`
    if (!window.confirm(`Delete ${label}? This also removes the files from storage.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/galleries/${galleryId}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, imageIds: ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNotice(data.error ?? 'Could not delete images')
        return
      }
      setImages((imgs) => imgs.filter((i) => !ids.includes(i.id)))
      setSelected((s) => {
        const next = new Set(s)
        for (const id of ids) next.delete(id)
        return next
      })
      countRef.current -= ids.length
    } finally {
      setDeleting(false)
    }
  }

  async function setHidden(ids: string[], hidden: boolean) {
    for (const imgId of ids) {
      try {
        const res = await fetch(`/api/galleries/${galleryId}/images/${imgId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, hidden }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.image) patchImage(imgId, { hidden: data.image.hidden })
      } catch {
        // leave as-is; user can retry the toggle
      }
    }
  }

  async function publishGallery() {
    if (publishing) return
    setPublishing(true)
    setPublishError(null)
    try {
      const res = await fetch(`/api/galleries/${galleryId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, attest: attested || attestChecked }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPublishError(data.error ?? 'Publish failed')
        return
      }
      setAttested(true)
      setStatus(data.status ?? 'published')
      setLiveUrl(data.url ?? null)
    } finally {
      setPublishing(false)
    }
  }

  const pendingFailed = pending.filter((u) => u.status === 'failed')
  const dbFailed = images.filter((i) => i.status === 'failed')
  const failedCount = pendingFailed.length + dbFailed.length
  const uploadingCount = pending.length - pendingFailed.length

  async function retryFailed() {
    if (retrying) return
    setRetrying(true)
    try {
      // Re-upload files that never made it up…
      if (pendingFailed.length) {
        setPending((p) => p.filter((u) => u.status !== 'failed'))
        countRef.current -= pendingFailed.length // enqueueFiles re-counts them
        enqueueFiles(pendingFailed.map((f) => f.file))
      }
      // …and sweep server-side failures (stuck/failed processing).
      if (dbFailed.length) {
        await fetch(`/api/galleries/${galleryId}/reconcile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId }),
        })
        const res = await fetch(`/api/galleries/${galleryId}`)
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.gallery) setImages(data.gallery.images)
      }
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          enqueueFiles(Array.from(e.dataTransfer.files))
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-amber-500 bg-amber-50' : 'border-slate-300 bg-white hover:border-amber-400'
        }`}
      >
        <p className="text-sm font-medium text-slate-700">Drag photos here, or click to choose</p>
        <p className="text-xs text-slate-400 mt-1">
          jpg, png, webp, heic · up to 10MB each · {MAX_IMAGES_PER_GALLERY - images.length - uploadingCount} slots left
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            enqueueFiles(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      </div>

      {notice && <p className="text-sm text-red-600">{notice}</p>}

      {(uploadingCount > 0 || Object.keys(activeSteps).length > 0 || failedCount > 0) && (
        <div className="flex items-center gap-3 text-sm">
          {uploadingCount > 0 && <span className="text-slate-600">Uploading {uploadingCount}…</span>}
          {Object.keys(activeSteps).length > 0 && (
            <span className="text-slate-600">Enhancing {Object.keys(activeSteps).length}…</span>
          )}
          {failedCount > 0 && (
            <>
              <span className="text-red-600">{failedCount} failed</span>
              <button
                type="button"
                onClick={() => void retryFailed()}
                disabled={retrying}
                className="text-amber-700 font-medium hover:underline disabled:opacity-50"
              >
                {retrying ? 'Retrying…' : 'Retry failed'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Selection toolbar */}
      {images.length > 0 && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">
            {selected.size > 0 ? `${selected.size} selected` : `${images.length} image${images.length === 1 ? '' : 's'}`}
          </span>
          <button
            type="button"
            onClick={() =>
              setSelected(selected.size === images.length ? new Set() : new Set(images.map((i) => i.id)))
            }
            className="text-slate-600 hover:text-slate-900 font-medium"
          >
            {selected.size === images.length ? 'Clear selection' : 'Select all'}
          </button>
          {selected.size > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  const ids = [...selected]
                  const allHidden = ids.every((id) => images.find((i) => i.id === id)?.hidden)
                  void setHidden(ids, !allHidden)
                }}
                className="text-slate-600 hover:text-slate-900 font-medium"
              >
                {[...selected].every((id) => images.find((i) => i.id === id)?.hidden)
                  ? `Show selected (${selected.size})`
                  : `Hide selected (${selected.size})`}
              </button>
              <button
                type="button"
                onClick={() => void deleteImages([...selected])}
                disabled={deleting}
                className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : `Delete selected (${selected.size})`}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setGalleryPreview(true)}
            className="ml-auto px-3 py-1.5 rounded-lg border border-amber-600 text-amber-700 font-medium hover:bg-amber-50"
          >
            Preview gallery
          </button>
        </div>
      )}

      {/* Image grid */}
      {(images.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img, idx) => {
            const label = activeSteps[img.id] ?? img.status
            const busy = Boolean(activeSteps[img.id])
            const isSelected = selected.has(img.id)
            return (
              <li
                key={img.id}
                onClick={() => setPreviewIndex(idx)}
                className={`group relative rounded-lg overflow-hidden border bg-slate-50 aspect-square cursor-pointer ${
                  isSelected ? 'border-amber-500 ring-2 ring-amber-400' : 'border-slate-200'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview_url}
                  alt={img.alt ?? ''}
                  className={`w-full h-full object-cover ${img.hidden ? 'opacity-30 grayscale' : ''}`}
                  loading="lazy"
                />
                {/* Select checkbox */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(img.id) }}
                  title={isSelected ? 'Deselect' : 'Select'}
                  className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border flex items-center justify-center text-[11px] font-bold transition-opacity ${
                    isSelected
                      ? 'bg-amber-500 border-amber-500 text-white opacity-100'
                      : 'bg-white/80 border-slate-300 text-transparent opacity-0 group-hover:opacity-100 hover:text-slate-400'
                  }`}
                >
                  ✓
                </button>
                {/* Delete */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void deleteImages([img.id]) }}
                  disabled={deleting || busy}
                  title={busy ? 'Wait for processing to finish' : 'Delete image'}
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-white/80 text-slate-500 hover:bg-red-600 hover:text-white text-[11px] leading-none items-center justify-center hidden group-hover:flex disabled:opacity-40"
                >
                  ✕
                </button>
                <span
                  className={`absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[label] ?? STATUS_STYLES.uploaded}`}
                  title={img.error ?? undefined}
                >
                  {label === 'processing' || label === 'enriching' ? `${label}…` : label}
                </span>
                {img.hidden && (
                  <span className="absolute bottom-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-800/80 text-white">
                    hidden
                  </span>
                )}
                {/* Hide/show toggle */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void setHidden([img.id], !img.hidden) }}
                  title={img.hidden ? 'Show on published page' : 'Hide from published page'}
                  className="absolute top-1.5 right-8 w-5 h-5 rounded bg-white/80 text-slate-500 hover:bg-slate-700 hover:text-white text-[11px] leading-none items-center justify-center hidden group-hover:flex"
                >
                  {img.hidden ? '◌' : '👁'}
                </button>
              </li>
            )
          })}
          {pending.map((u) => (
            <li key={u.key} className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-square">
              {u.previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={u.previewUrl} alt="" className={`w-full h-full object-contain ${u.status === 'failed' ? 'opacity-30' : 'opacity-50'}`} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                  HEIC
                </div>
              )}
              <span
                className={`absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[u.status]}`}
                title={u.error}
              >
                {u.status === 'failed' ? 'failed' : `${u.status}…`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Publish panel */}
      {images.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Publish to your site</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {images.filter((i) => !i.hidden && i.status === 'ready').length} of{' '}
                {images.filter((i) => !i.hidden).length} visible images ready
                {images.some((i) => i.hidden) &&
                  ` · ${images.filter((i) => i.hidden).length} hidden`}
                {status === 'published' && ' · published'}
              </p>
            </div>
            {liveUrl && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-700 font-medium hover:underline shrink-0"
              >
                View live page ↗
              </a>
            )}
          </div>
          {!attested && (
            <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={attestChecked}
                onChange={(e) => setAttestChecked(e.target.checked)}
                className="mt-0.5 accent-amber-600"
              />
              <span>
                I confirm I have the right to publish these images, including any identifiable
                people in them.
              </span>
            </label>
          )}
          {publishError && <p className="text-sm text-red-600">{publishError}</p>}
          <button
            type="button"
            onClick={() => void publishGallery()}
            disabled={
              publishing ||
              images.filter((i) => !i.hidden).length === 0 ||
              images.some((i) => !i.hidden && i.status !== 'ready') ||
              (!attested && !attestChecked)
            }
            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {publishing
              ? 'Publishing…'
              : status === 'published'
                ? 'Republish changes'
                : 'Publish gallery'}
          </button>
          {images.some((i) => !i.hidden && i.status !== 'ready') && (
            <p className="text-xs text-slate-400">
              Publishing unlocks when every visible image is ready — retry, hide or delete any
              failed ones.
            </p>
          )}
        </div>
      )}

      {/* Single-image preview (lightbox) */}
      {previewIndex !== null && images[previewIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreviewIndex(null)}
        >
          <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[previewIndex].url ?? images[previewIndex].preview_url}
                alt={images[previewIndex].alt ?? ''}
                className="mx-auto max-h-[60vh] w-auto object-contain rounded-lg"
              />
              <button
                type="button"
                onClick={() => setPreviewIndex((i) => (i === null ? i : Math.max(i - 1, 0)))}
                disabled={previewIndex === 0}
                title="Previous image (←)"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white text-2xl leading-none flex items-center justify-center hover:bg-black/70 disabled:opacity-20"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setPreviewIndex((i) => (i === null ? i : Math.min(i + 1, images.length - 1)))}
                disabled={previewIndex === images.length - 1}
                title="Next image (→)"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white text-2xl leading-none flex items-center justify-center hover:bg-black/70 disabled:opacity-20"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setPreviewIndex(null)}
                title="Close (Esc)"
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white text-sm flex items-center justify-center hover:bg-black/70"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 max-w-2xl mx-auto space-y-2">
              <label className="block">
                <span className="text-white/50 text-xs">Caption (shown on the page)</span>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg bg-white/10 text-white text-sm px-3 py-2 border border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </label>
              <label className="block">
                <span className="text-white/50 text-xs">Alt text (screen readers &amp; SEO)</span>
                <textarea
                  value={editAlt}
                  onChange={(e) => setEditAlt(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg bg-white/10 text-white text-sm px-3 py-2 border border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </label>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void rotatePreviewed(270)}
                    disabled={rotating || !images[previewIndex].master_path}
                    title="Rotate left 90°"
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-30"
                  >
                    ⟲ 90°
                  </button>
                  <button
                    type="button"
                    onClick={() => void rotatePreviewed(180)}
                    disabled={rotating || !images[previewIndex].master_path}
                    title="Rotate 180°"
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-30"
                  >
                    180°
                  </button>
                  <button
                    type="button"
                    onClick={() => void rotatePreviewed(90)}
                    disabled={rotating || !images[previewIndex].master_path}
                    title="Rotate right 90°"
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-30"
                  >
                    ⟳ 90°
                  </button>
                  {rotating && <span className="text-white/50 text-xs">Rotating…</span>}
                  <button
                    type="button"
                    onClick={() => void setHidden([images[previewIndex].id], !images[previewIndex].hidden)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
                  >
                    {images[previewIndex].hidden ? 'Show on page' : 'Hide from page'}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/40 text-xs">
                    {previewIndex + 1} of {images.length} · {images[previewIndex].status}
                  </span>
                  <button
                    type="button"
                    onClick={() => void saveMeta()}
                    disabled={
                      savingMeta ||
                      (editAlt === (images[previewIndex].alt ?? '') &&
                        editCaption === (images[previewIndex].caption ?? ''))
                    }
                    className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-40"
                  >
                    {savingMeta ? 'Saving…' : 'Save text'}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setPreviewIndex((i) => (i === null ? i : Math.max(i - 1, 0)))}
                disabled={previewIndex === 0}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-30"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => setPreviewIndex(null)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setPreviewIndex((i) => (i === null ? i : Math.min(i + 1, images.length - 1)))}
                disabled={previewIndex === images.length - 1}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery preview — approximates the published page layout */}
      {galleryPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 overflow-y-auto p-4 md:p-8"
          onClick={() => setGalleryPreview(false)}
        >
          <div
            className="max-w-3xl mx-auto bg-white rounded-xl p-6 md:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold mb-1">
                  Preview — how the published gallery will read
                </p>
                <h2 className="text-2xl font-bold text-slate-900">{galleryTitle ?? 'Gallery'}</h2>
                {galleryContext && <p className="text-sm text-slate-500 mt-1">{galleryContext}</p>}
              </div>
              <button
                type="button"
                onClick={() => setGalleryPreview(false)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none shrink-0"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-400 italic mb-6">
              Intro copy will be written by Clem at the next step.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {images.map((img, idx) => img.hidden ? null : (
                <figure key={img.id} className="m-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url ?? img.preview_url}
                    alt={img.alt ?? ''}
                    title="Click to edit this image"
                    onClick={() => {
                      setGalleryPreview(false)
                      setPreviewIndex(idx)
                    }}
                    className="w-full rounded-lg cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-amber-400 transition"
                    loading="lazy"
                  />
                  {img.caption && (
                    <figcaption className="text-xs text-slate-500 mt-1.5">{img.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

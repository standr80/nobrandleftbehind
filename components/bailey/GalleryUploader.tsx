'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ALLOWED_EXTENSIONS,
  GALLERY_BUCKET,
  HEIC_REJECT_MESSAGE,
  MAX_IMAGES_PER_GALLERY,
  MAX_SOURCE_BYTES,
  fileExtension,
  type GalleryImage,
} from '@/lib/bailey/constants'

export type UploadedImage = GalleryImage & { preview_url: string }

interface PendingUpload {
  key: string
  name: string
  previewUrl: string
  status: 'uploading' | 'failed'
  error?: string
  file: File
}

interface Props {
  tenantId: string
  galleryId: string
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
  processing: 'bg-amber-100 text-amber-700',
}

export default function GalleryUploader({ tenantId, galleryId, initialImages }: Props) {
  const [images, setImages] = useState<UploadedImage[]>(initialImages)
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Registration is a read-modify-write on the gallery row — serialise it.
  const registerChain = useRef<Promise<void>>(Promise.resolve())
  const countRef = useRef(initialImages.length)

  const patchImage = useCallback((id: string, patch: Partial<UploadedImage>) => {
    setImages((imgs) => imgs.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }, [])

  const processOne = useCallback(
    async (imageId: string) => {
      setProcessingIds((s) => new Set(s).add(imageId))
      try {
        const res = await fetch(`/api/galleries/${galleryId}/images/${imageId}/process`, {
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
        } else if (!res.ok) {
          patchImage(imageId, { status: 'failed', error: data.error ?? 'Processing failed' })
        }
      } catch {
        patchImage(imageId, { status: 'failed', error: 'Processing failed — retry below' })
      } finally {
        setProcessingIds((s) => {
          const next = new Set(s)
          next.delete(imageId)
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
        // 1. signed URL (server enforces allowlist + caps at issuance)
        const urlRes = await fetch(`/api/galleries/${galleryId}/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, filename: item.file.name, size: item.file.size }),
        })
        const urlData = await urlRes.json()
        if (!urlRes.ok) throw new Error(urlData.error ?? 'Could not get upload URL')

        // 2. direct browser → Storage upload (Vercel body limit not in play)
        const supabase = createClient()
        const { error: upErr } = await supabase.storage
          .from(GALLERY_BUCKET)
          .uploadToSignedUrl(urlData.path, urlData.token, item.file)
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

        // 4. sharp processing (still inside this worker → concurrency ≤3)
        await processOne(registered.image.id)
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Upload failed')
      }
    },
    [galleryId, tenantId, processOne],
  )

  const enqueueFiles = useCallback(
    (files: File[]) => {
      setNotice(null)
      const accepted: PendingUpload[] = []
      const rejected: string[] = []

      for (const file of files) {
        const ext = fileExtension(file.name)
        if (ext === 'heic' || ext === 'heif') {
          rejected.push(`${file.name}: ${HEIC_REJECT_MESSAGE}`)
          continue
        }
        if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
          rejected.push(`${file.name}: unsupported type (use ${ALLOWED_EXTENSIONS.join(', ')})`)
          continue
        }
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
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
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
          jpg, png, webp · up to 10MB each · {MAX_IMAGES_PER_GALLERY - images.length - uploadingCount} slots left
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => {
            enqueueFiles(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      </div>

      {notice && <p className="text-sm text-red-600">{notice}</p>}

      {(uploadingCount > 0 || processingIds.size > 0 || failedCount > 0) && (
        <div className="flex items-center gap-3 text-sm">
          {uploadingCount > 0 && <span className="text-slate-600">Uploading {uploadingCount}…</span>}
          {processingIds.size > 0 && <span className="text-slate-600">Processing {processingIds.size}…</span>}
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

      {/* Image grid */}
      {(images.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img) => {
            const label = processingIds.has(img.id) && img.status === 'uploaded' ? 'processing' : img.status
            return (
              <li key={img.id} className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview_url} alt={img.alt ?? ''} className="w-full h-full object-cover" loading="lazy" />
                <span
                  className={`absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[label] ?? STATUS_STYLES.uploaded}`}
                  title={img.error ?? undefined}
                >
                  {label === 'processing' ? 'processing…' : label}
                </span>
              </li>
            )
          })}
          {pending.map((u) => (
            <li key={u.key} className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.previewUrl} alt="" className={`w-full h-full object-cover ${u.status === 'uploading' ? 'opacity-50' : 'opacity-30'}`} />
              <span
                className={`absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[u.status]}`}
                title={u.error}
              >
                {u.status === 'uploading' ? 'uploading…' : 'failed'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

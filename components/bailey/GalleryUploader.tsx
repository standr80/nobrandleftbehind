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
}

export default function GalleryUploader({ tenantId, galleryId, initialImages }: Props) {
  const [images, setImages] = useState<UploadedImage[]>(initialImages)
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Registration is a read-modify-write on the gallery row — serialise it.
  const registerChain = useRef<Promise<void>>(Promise.resolve())
  const countRef = useRef(initialImages.length)

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

        // 3. register (serialised)
        await (registerChain.current = registerChain.current.then(async () => {
          const regRes = await fetch(`/api/galleries/${galleryId}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, path: urlData.path }),
          })
          const regData = await regRes.json()
          if (!regRes.ok) throw new Error(regData.error ?? 'Could not register image')
          setImages((imgs) => [...imgs, { ...regData.image, preview_url: regData.preview_url }])
          setPending((p) => p.filter((u) => u.key !== item.key))
          URL.revokeObjectURL(item.previewUrl)
        }))
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Upload failed')
      }
    },
    [galleryId, tenantId],
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

  function retryFailed() {
    const failed = pending.filter((u) => u.status === 'failed')
    if (!failed.length) return
    setPending((p) => p.filter((u) => u.status !== 'failed'))
    countRef.current -= failed.length // enqueueFiles re-counts them
    enqueueFiles(failed.map((f) => f.file))
  }

  const failedCount = pending.filter((u) => u.status === 'failed').length
  const uploadingCount = pending.length - failedCount

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

      {(uploadingCount > 0 || failedCount > 0) && (
        <div className="flex items-center gap-3 text-sm">
          {uploadingCount > 0 && <span className="text-slate-600">Uploading {uploadingCount}…</span>}
          {failedCount > 0 && (
            <>
              <span className="text-red-600">{failedCount} failed</span>
              <button type="button" onClick={retryFailed} className="text-amber-700 font-medium hover:underline">
                Retry failed
              </button>
            </>
          )}
        </div>
      )}

      {/* Image grid */}
      {(images.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img) => (
            <li key={img.id} className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview_url} alt={img.alt ?? ''} className="w-full h-full object-cover" loading="lazy" />
              <span className={`absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[img.status] ?? STATUS_STYLES.uploaded}`}>
                {img.status}
              </span>
            </li>
          ))}
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

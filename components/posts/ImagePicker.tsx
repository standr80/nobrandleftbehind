'use client'

import Image from 'next/image'

export interface ImageCandidate {
  unsplash_id: string
  url: string
  thumb_url: string
  alt_text: string
  photographer_name: string
  photographer_url: string
}

interface Props {
  candidates: ImageCandidate[]
  selectedId: string | null
  onSelect: (candidate: ImageCandidate) => void
}

export default function ImagePicker({ candidates, selectedId, onSelect }: Props) {
  if (!candidates.length) {
    return (
      <p className="text-slate-400 text-sm py-4 text-center">
        No image candidates — run the image search first.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {candidates.map((img) => (
          <button
            key={img.unsplash_id}
            type="button"
            onClick={() => onSelect(img)}
            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
              selectedId === img.unsplash_id
                ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                : 'border-slate-200 hover:border-white/30'
            }`}
          >
            <Image
              src={img.thumb_url}
              alt={img.alt_text}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, 33vw"
            />
            {selectedId === img.unsplash_id && (
              <div className="absolute inset-0 bg-indigo-50 flex items-center justify-center">
                <span className="text-white text-xl">✓</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedId && (
        <p className="text-xs text-slate-400">
          Photo by{' '}
          <a
            href={candidates.find((c) => c.unsplash_id === selectedId)?.photographer_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-900 underline"
          >
            {candidates.find((c) => c.unsplash_id === selectedId)?.photographer_name}
          </a>{' '}
          on Unsplash
        </p>
      )}
    </div>
  )
}

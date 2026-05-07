'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ImageCandidate } from './ImagePicker'

interface Props {
  title: string
  body: string
  excerpt: string
  tags: string[]
  selectedImage: ImageCandidate | null
  draftedAt: string | null
}

export default function PostPreview({ title, body, excerpt, tags, selectedImage, draftedAt }: Props) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero image */}
      {selectedImage && (
        <div className="mb-8 rounded-xl overflow-hidden aspect-[16/7] relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage.thumb_url}
            alt={selectedImage.alt_text}
            className="w-full h-full object-cover"
          />
          <p className="absolute bottom-2 right-3 text-xs text-white/60 bg-black/40 px-2 py-0.5 rounded">
            Photo by{' '}
            <a
              href={selectedImage.photographer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              {selectedImage.photographer_name}
            </a>{' '}
            on Unsplash
          </p>
        </div>
      )}

      {/* Post header */}
      <div className="mb-8">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <span key={tag} className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-3xl font-bold text-white mb-3 leading-tight">{title}</h1>
        {excerpt && <p className="text-white/50 text-base leading-relaxed">{excerpt}</p>}
        <div className="flex items-center gap-2 mt-4 text-xs text-white/30">
          <span>By Clem</span>
          {draftedAt && (
            <>
              <span>·</span>
              <span>
                {new Date(draftedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <hr className="border-white/10 mb-8" />

      {/* Body */}
      <div className="prose prose-invert prose-headings:text-white prose-p:text-white/80 prose-a:text-indigo-400 prose-strong:text-white prose-code:text-indigo-300 prose-blockquote:border-indigo-500 prose-blockquote:text-white/60 max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </div>
  )
}

'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
interface Props {
  title: string
  body: string
  excerpt: string
  tags: string[]
  heroImageUrl: string | null
  heroImageCredit: string | null
  draftedAt: string | null
}

export default function PostPreview({ title, body, excerpt, tags, heroImageUrl, heroImageCredit, draftedAt }: Props) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero image */}
      {heroImageUrl && (
        <div className="mb-8 rounded-xl overflow-hidden aspect-[16/7] relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
          {heroImageCredit && (
            <p className="absolute bottom-2 right-3 text-xs text-slate-600 bg-black/40 px-2 py-0.5 rounded">
              {heroImageCredit}
            </p>
          )}
        </div>
      )}

      {/* Post header */}
      <div className="mb-8">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <span key={tag} className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-3xl font-bold text-slate-900 mb-3 leading-tight">{title}</h1>
        {excerpt && <p className="text-slate-500 text-base leading-relaxed">{excerpt}</p>}
        <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
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
      <hr className="border-slate-200 mb-8" />

      {/* Body */}
      <div className="prose prose-slate prose-headings:text-slate-900 prose-p:text-slate-700 prose-a:text-indigo-600 prose-strong:text-slate-900 prose-code:text-indigo-600 prose-blockquote:border-indigo-400 prose-blockquote:text-slate-600 max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </div>
  )
}

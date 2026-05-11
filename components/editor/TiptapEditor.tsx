'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useCallback, useState, useRef } from 'react'

// Extend Image to support mutable class + alignment.
// We also override `alt` to default to '' (empty string) rather than null,
// because tiptap-markdown's escapeMarkdown() calls str.replace() on it and
// crashes if the value is null/undefined.
const AlignableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alt: {
        default: '',
        parseHTML: (el) => el.getAttribute('alt') ?? '',
        renderHTML: (attrs) => ({ alt: attrs.alt ?? '' }),
      },
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('title') ?? '',
        renderHTML: (attrs) => (attrs.title ? { title: attrs.title } : {}),
      },
      class: {
        default: 'rounded-lg max-w-full my-4 mx-auto block',
        parseHTML: (el) => el.getAttribute('class'),
        renderHTML: (attrs) => ({ class: attrs.class }),
      },
    }
  },
})

const ALIGN = {
  center: 'rounded-lg max-w-full my-4 mx-auto block',
  left:   'rounded-lg my-4 mr-6 float-left max-w-[45%]',
  right:  'rounded-lg my-4 ml-6 float-right max-w-[45%]',
  full:   'rounded-lg my-4 w-full block',
} as const
type Alignment = keyof typeof ALIGN

interface Props {
  content: string
  onChange: (markdown: string) => void
  editable?: boolean
  postId?: string
}

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={`px-2.5 py-1 text-xs rounded transition-colors ${
        active ? 'bg-indigo-600/40 text-indigo-200' : 'text-slate-600 hover:bg-slate-100 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export default function TiptapEditor({ content, onChange, editable = true, postId }: Props) {
  const [linkPopover, setLinkPopover] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUploadError, setImageUploadError] = useState('')
  const [altText, setAltText] = useState('')
  const altInputRef = useRef<HTMLInputElement>(null)

  const handleUpdate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ editor }: { editor: any }) => {
      try {
        onChange(editor.storage.markdown.getMarkdown())
      } catch {
        // Serialisation failure — skip this update rather than crash
      }
    },
    [onChange],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { class: 'bg-white rounded p-3 text-sm font-mono' } } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-indigo-600 underline' } }),
      AlignableImage,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Markdown.configure({ html: false, transformCopiedText: true }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[480px] p-6',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const current = (editor.storage as any).markdown.getMarkdown()
      if (content !== current) {
        editor.commands.setContent(content ?? '')
      }
    } catch {
      // Serialisation can fail if nodes have malformed attributes (e.g. null alt on images)
      editor.commands.setContent(content ?? '')
    }
  }, [content, editor])

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editor || !postId) return
    setImageUploading(true)
    setImageUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/posts/${postId}/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      editor.chain().focus().setImage({ src: data.url, alt: file.name.replace(/\.[^/.]+$/, '') }).run()
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setImageUploading(false)
      e.target.value = ''
    }
  }

  // Sync alt text state whenever the image selection changes
  useEffect(() => {
    if (!editor) return
    const update = () => {
      if (editor.isActive('image')) {
        setAltText(editor.getAttributes('image').alt ?? '')
      }
    }
    editor.on('selectionUpdate', update)
    return () => { editor.off('selectionUpdate', update) }
  }, [editor])

  function applyAlt() {
    editor?.chain().focus().updateAttributes('image', { alt: altText }).run()
  }

  function setAlignment(align: Alignment) {
    editor?.chain().focus().updateAttributes('image', { class: ALIGN[align] }).run()
  }

  function getActiveAlignment(): Alignment {
    const cls: string = editor?.getAttributes('image').class ?? ''
    if (cls.includes('float-left'))  return 'left'
    if (cls.includes('float-right')) return 'right'
    if (cls.includes('w-full'))      return 'full'
    return 'center'
  }

  function deleteImage() {
    editor?.chain().focus().deleteSelection().run()
  }

  function openLinkPopover() {
    if (!editor) return
    const existing = editor.getAttributes('link').href ?? ''
    setLinkUrl(existing)
    setLinkPopover(true)
    setTimeout(() => linkInputRef.current?.focus(), 50)
  }

  function applyLink() {
    if (!editor) return
    const url = linkUrl.trim()
    if (!url) {
      editor.chain().focus().unsetLink().run()
    } else {
      const href = url.startsWith('http') ? url : `https://${url}`
      editor.chain().focus().setLink({ href }).run()
    }
    setLinkPopover(false)
    setLinkUrl('')
  }

  function removeLink() {
    editor?.chain().focus().unsetLink().run()
    setLinkPopover(false)
    setLinkUrl('')
  }

  if (!editor) return null

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {editable && (
        <div className="border-b border-slate-200">
          <div className="flex flex-wrap gap-0.5 px-3 py-2">
            <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <em>I</em>
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              H2
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              H3
            </ToolbarButton>
            <span className="w-px bg-slate-100 mx-1" />
            <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              • List
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              1. List
            </ToolbarButton>
            <span className="w-px bg-slate-100 mx-1" />
            <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              &ldquo; Quote
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
              {'</>'}
            </ToolbarButton>
            <span className="w-px bg-slate-100 mx-1" />
            <ToolbarButton active={editor.isActive('link')} onClick={openLinkPopover}>
              🔗 Link
            </ToolbarButton>
            {postId && (
              <>
                <ToolbarButton
                  active={false}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {imageUploading ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
                      Uploading…
                    </span>
                  ) : (
                    '🖼 Image'
                  )}
                </ToolbarButton>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={handleImageFile}
                />
              </>
            )}
            <span className="w-px bg-slate-100 mx-1" />
            <ToolbarButton active={false} onClick={() => editor.chain().focus().undo().run()}>
              ↩ Undo
            </ToolbarButton>
            <ToolbarButton active={false} onClick={() => editor.chain().focus().redo().run()}>
              ↪ Redo
            </ToolbarButton>
          </div>

          {/* Link popover */}
          {linkPopover && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-200 bg-white">
              <span className="text-xs text-slate-400 shrink-0">URL</span>
              <input
                ref={linkInputRef}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyLink()
                  if (e.key === 'Escape') setLinkPopover(false)
                }}
                placeholder="https://example.com"
                className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
              />
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyLink() }}
                className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors shrink-0"
              >
                Apply
              </button>
              {editor.isActive('link') && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); removeLink() }}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setLinkPopover(false) }}
                className="text-slate-400 hover:text-white text-sm transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
          )}
        {imageUploadError && (
          <div className="px-3 py-2 border-t border-slate-200 text-xs text-red-600">
            {imageUploadError}
          </div>
        )}
        </div>
      )}
      {/* Image bubble menu — appears when an image is selected */}
      <BubbleMenu
        editor={editor}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shouldShow={({ editor: e }: { editor: any }) => e.isActive('image')}
      >
        <div className="flex flex-col gap-1.5 bg-[#1e1e2e] border border-white/15 rounded-xl shadow-xl p-3 min-w-[280px]">
          {/* Alt text */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0 w-6">Alt</span>
            <input
              ref={altInputRef}
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              onBlur={applyAlt}
              onKeyDown={(e) => { if (e.key === 'Enter') { applyAlt(); e.currentTarget.blur() } }}
              placeholder="Describe this image for screen readers"
              className="flex-1 bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Alignment + delete */}
          <div className="flex items-center gap-1 pt-0.5">
            <span className="text-xs text-slate-400 w-6 shrink-0">↔</span>
            {((['center', 'left', 'right', 'full'] as Alignment[])).map((a) => {
              const labels: Record<Alignment, string> = { center: '⊞ Centre', left: '⇤ Left', right: '⇥ Right', full: '⟺ Full' }
              const active = getActiveAlignment() === a
              return (
                <button
                  key={a}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setAlignment(a) }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${active ? 'bg-indigo-600/50 text-indigo-200' : 'text-slate-500 hover:bg-slate-100 hover:text-white'}`}
                >
                  {labels[a]}
                </button>
              )
            })}
            <div className="flex-1" />
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); deleteImage() }}
              className="px-2 py-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              ✕ Remove
            </button>
          </div>
        </div>
      </BubbleMenu>

      <div className="prose prose-invert prose-sm max-w-none [&_.tiptap]:outline-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Youtube from '@tiptap/extension-youtube'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useCallback, useState, useRef } from 'react'

// Extend Image to support mutable class + alignment + inline width.
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
      style: {
        default: null,
        parseHTML: (el) => el.getAttribute('style'),
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
    }
  },

  addStorage() {
    return {
      markdown: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serialize(state: any, node: any) {
          const { src, alt, class: cls, style } = node.attrs
          if (cls || style) {
            let tag = '<img'
            if (src)   tag += ` src="${src}"`
            if (alt)   tag += ` alt="${alt}"`
            if (cls)   tag += ` class="${cls}"`
            if (style) tag += ` style="${style}"`
            tag += '>'
            state.write(tag)
          } else {
            state.write(`![${alt || ''}](${src || ''})`)
          }
        },
      },
    }
  },
})

const ALIGN = {
  center: 'rounded-lg max-w-full my-4 mx-auto block',
  left:   'rounded-lg my-4 mr-6 float-left',
  right:  'rounded-lg my-4 ml-6 float-right',
  full:   'rounded-lg my-4 w-full block',
} as const
type Alignment = keyof typeof ALIGN

const SIZES: { label: string; style: string | null }[] = [
  { label: 'S',    style: 'width:25%;max-width:100%;height:auto' },
  { label: 'M',    style: 'width:50%;max-width:100%;height:auto' },
  { label: 'L',    style: 'width:75%;max-width:100%;height:auto' },
  { label: 'Full', style: null },
]

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Red',     value: '#dc2626' },
  { label: 'Orange',  value: '#ea580c' },
  { label: 'Yellow',  value: '#ca8a04' },
  { label: 'Green',   value: '#16a34a' },
  { label: 'Blue',    value: '#2563eb' },
  { label: 'Purple',  value: '#9333ea' },
  { label: 'Pink',    value: '#db2777' },
  { label: 'Grey',    value: '#6b7280' },
]

const HIGHLIGHT_COLORS = [
  { label: 'None',   value: '' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green',  value: '#bbf7d0' },
  { label: 'Blue',   value: '#bfdbfe' },
  { label: 'Pink',   value: '#fbcfe8' },
  { label: 'Orange', value: '#fed7aa' },
]

interface Props {
  content: string
  onChange: (markdown: string) => void
  editable?: boolean
  postId?: string
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
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

function Sep() {
  return <span className="w-px bg-slate-100 mx-1 self-stretch" />
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
  const [youtubePopover, setYoutubePopover] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const highlightPickerRef = useRef<HTMLDivElement>(null)

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
      Markdown.configure({ html: true, transformCopiedText: true }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Youtube.configure({ nocookie: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
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
      editor.commands.setContent(content ?? '')
    }
  }, [content, editor])

  // Close colour pickers on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(e.target as Node)) {
        setShowHighlightPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  function setSize(style: string | null) {
    editor?.chain().focus().updateAttributes('image', { style }).run()
  }

  function getActiveSize(): string | null {
    return editor?.getAttributes('image').style ?? null
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

  function insertYoutube() {
    if (!editor || !youtubeUrl.trim()) return
    editor.chain().focus().setYoutubeVideo({ src: youtubeUrl.trim() }).run()
    setYoutubePopover(false)
    setYoutubeUrl('')
  }

  function insertTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  if (!editor) return null

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {editable && (
        <div className="border-b border-slate-200">
          {/* ── Toolbar ── */}
          <div className="flex flex-wrap gap-0.5 px-3 py-2 items-center">

            {/* Text style */}
            <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><strong>B</strong></ToolbarButton>
            <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><em>I</em></ToolbarButton>
            <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><u>U</u></ToolbarButton>
            <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><s>S</s></ToolbarButton>
            <ToolbarButton active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">{'`c`'}</ToolbarButton>

            <Sep />

            {/* Headings */}
            <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolbarButton>
            <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
            <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>

            <Sep />

            {/* Alignment */}
            <ToolbarButton active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left">⇤</ToolbarButton>
            <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align centre">⊞</ToolbarButton>
            <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right">⇥</ToolbarButton>

            <Sep />

            {/* Lists */}
            <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</ToolbarButton>
            <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</ToolbarButton>

            <Sep />

            {/* Blocks */}
            <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">&ldquo; Quote</ToolbarButton>
            <ToolbarButton active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block">{'</>'}</ToolbarButton>
            <ToolbarButton active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">― HR</ToolbarButton>

            <Sep />

            {/* Colour */}
            <div className="relative" ref={colorPickerRef}>
              <button
                type="button"
                title="Text colour"
                onMouseDown={(e) => { e.preventDefault(); setShowColorPicker(v => !v); setShowHighlightPicker(false) }}
                className="px-2.5 py-1 text-xs rounded transition-colors text-slate-600 hover:bg-slate-100 flex items-center gap-1"
              >
                <span style={{ borderBottom: `2px solid ${editor.getAttributes('textStyle').color || '#1a1a1a'}` }}>A</span>
                <span className="text-slate-400 text-[10px]">▾</span>
              </button>
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-50 flex flex-wrap gap-1 w-36">
                  {TEXT_COLORS.map(({ label, value }) => (
                    <button
                      key={label}
                      type="button"
                      title={label}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (value) {
                          editor.chain().focus().setColor(value).run()
                        } else {
                          editor.chain().focus().unsetColor().run()
                        }
                        setShowColorPicker(false)
                      }}
                      className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                      style={{ backgroundColor: value || '#1a1a1a' }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Highlight */}
            <div className="relative" ref={highlightPickerRef}>
              <button
                type="button"
                title="Highlight"
                onMouseDown={(e) => { e.preventDefault(); setShowHighlightPicker(v => !v); setShowColorPicker(false) }}
                className="px-2.5 py-1 text-xs rounded transition-colors text-slate-600 hover:bg-slate-100 flex items-center gap-1"
              >
                <span style={{ backgroundColor: '#fef08a', padding: '0 2px' }}>H</span>
                <span className="text-slate-400 text-[10px]">▾</span>
              </button>
              {showHighlightPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-50 flex flex-wrap gap-1 w-32">
                  {HIGHLIGHT_COLORS.map(({ label, value }) => (
                    <button
                      key={label}
                      type="button"
                      title={label}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (value) {
                          editor.chain().focus().setHighlight({ color: value }).run()
                        } else {
                          editor.chain().focus().unsetHighlight().run()
                        }
                        setShowHighlightPicker(false)
                      }}
                      className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                      style={{ backgroundColor: value || '#ffffff' }}
                    />
                  ))}
                </div>
              )}
            </div>

            <Sep />

            {/* Link */}
            <ToolbarButton active={editor.isActive('link')} onClick={openLinkPopover}>🔗 Link</ToolbarButton>

            {/* Image */}
            {postId && (
              <>
                <ToolbarButton active={false} onClick={() => imageInputRef.current?.click()}>
                  {imageUploading ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 border border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      Uploading…
                    </span>
                  ) : (
                    '🖼 Image'
                  )}
                </ToolbarButton>
                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={handleImageFile} />
              </>
            )}

            {/* YouTube */}
            <ToolbarButton active={false} onClick={() => { setYoutubePopover(v => !v); setLinkPopover(false) }} title="Embed YouTube">▶ YouTube</ToolbarButton>

            {/* Table */}
            <ToolbarButton active={editor.isActive('table')} onClick={insertTable} title="Insert table">⊞ Table</ToolbarButton>

            <Sep />

            {/* Undo / Redo */}
            <ToolbarButton active={false} onClick={() => editor.chain().focus().undo().run()}>↩ Undo</ToolbarButton>
            <ToolbarButton active={false} onClick={() => editor.chain().focus().redo().run()}>↪ Redo</ToolbarButton>
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
              <button type="button" onMouseDown={(e) => { e.preventDefault(); applyLink() }} className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors shrink-0">Apply</button>
              {editor.isActive('link') && (
                <button type="button" onMouseDown={(e) => { e.preventDefault(); removeLink() }} className="px-3 py-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0">Remove</button>
              )}
              <button type="button" onMouseDown={(e) => { e.preventDefault(); setLinkPopover(false) }} className="text-slate-400 hover:text-slate-600 text-sm transition-colors shrink-0">✕</button>
            </div>
          )}

          {/* YouTube popover */}
          {youtubePopover && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-200 bg-white">
              <span className="text-xs text-slate-400 shrink-0">YouTube URL</span>
              <input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') insertYoutube()
                  if (e.key === 'Escape') setYoutubePopover(false)
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                autoFocus
              />
              <button type="button" onMouseDown={(e) => { e.preventDefault(); insertYoutube() }} className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors shrink-0">Embed</button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); setYoutubePopover(false) }} className="text-slate-400 hover:text-slate-600 text-sm transition-colors shrink-0">✕</button>
            </div>
          )}

          {imageUploadError && (
            <div className="px-3 py-2 border-t border-slate-200 text-xs text-red-600">{imageUploadError}</div>
          )}
        </div>
      )}

      {/* Image bubble menu */}
      <BubbleMenu
        editor={editor}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shouldShow={({ editor: e }: { editor: any }) => e.isActive('image')}
      >
        <div className="flex flex-col gap-1.5 bg-[#1e1e2e] border border-white/15 rounded-xl shadow-xl p-3 min-w-[280px]">
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
          <div className="flex items-center gap-1 pt-0.5">
            <span className="text-xs text-slate-400 w-6 shrink-0">⇔</span>
            {SIZES.map(({ label, style }) => {
              const active = getActiveSize() === style
              return (
                <button key={label} type="button" onMouseDown={(e) => { e.preventDefault(); setSize(style) }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${active ? 'bg-indigo-600/50 text-indigo-200' : 'text-slate-500 hover:bg-slate-100 hover:text-white'}`}>
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400 w-6 shrink-0">↔</span>
            {(['center', 'left', 'right', 'full'] as Alignment[]).map((a) => {
              const labels: Record<Alignment, string> = { center: '⊞ Centre', left: '⇤ Left', right: '⇥ Right', full: '⟺ Full' }
              const active = getActiveAlignment() === a
              return (
                <button key={a} type="button" onMouseDown={(e) => { e.preventDefault(); setAlignment(a) }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${active ? 'bg-indigo-600/50 text-indigo-200' : 'text-slate-500 hover:bg-slate-100 hover:text-white'}`}>
                  {labels[a]}
                </button>
              )
            })}
            <div className="flex-1" />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); deleteImage() }}
              className="px-2 py-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
              ✕ Remove
            </button>
          </div>
        </div>
      </BubbleMenu>

      {/* Table bubble menu */}
      <BubbleMenu
        editor={editor}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shouldShow={({ editor: e }: { editor: any }) => e.isActive('table')}
      >
        <div className="flex gap-1 bg-[#1e1e2e] border border-white/15 rounded-xl shadow-xl p-2">
          {[
            { label: '+ Col', action: () => editor.chain().focus().addColumnAfter().run() },
            { label: '− Col', action: () => editor.chain().focus().deleteColumn().run() },
            { label: '+ Row', action: () => editor.chain().focus().addRowAfter().run() },
            { label: '− Row', action: () => editor.chain().focus().deleteRow().run() },
            { label: 'Del table', action: () => editor.chain().focus().deleteTable().run() },
          ].map(({ label, action }) => (
            <button key={label} type="button" onMouseDown={(e) => { e.preventDefault(); action() }}
              className={`px-2 py-1 text-xs rounded transition-colors text-slate-400 hover:bg-slate-700 hover:text-white ${label === 'Del table' ? 'hover:text-red-400' : ''}`}>
              {label}
            </button>
          ))}
        </div>
      </BubbleMenu>

      <div className="prose prose-slate prose-sm max-w-none [&_.tiptap]:outline-none [&_.tiptap]:text-slate-900 [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:p-2 [&_th]:bg-slate-50 [&_th]:font-semibold">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

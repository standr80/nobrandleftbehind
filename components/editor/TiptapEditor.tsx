'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useCallback, useState, useRef } from 'react'

interface Props {
  content: string
  onChange: (markdown: string) => void
  editable?: boolean
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
        active ? 'bg-indigo-600/40 text-indigo-200' : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export default function TiptapEditor({ content, onChange, editable = true }: Props) {
  const [linkPopover, setLinkPopover] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)

  const handleUpdate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ editor }: { editor: any }) => {
      onChange(editor.storage.markdown.getMarkdown())
    },
    [onChange],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { class: 'bg-white/5 rounded p-3 text-sm font-mono' } } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-indigo-400 underline' } }),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (editor.storage as any).markdown.getMarkdown()
    if (content !== current) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

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
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {editable && (
        <div className="border-b border-white/10">
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
            <span className="w-px bg-white/10 mx-1" />
            <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              • List
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              1. List
            </ToolbarButton>
            <span className="w-px bg-white/10 mx-1" />
            <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              &ldquo; Quote
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
              {'</>'}
            </ToolbarButton>
            <span className="w-px bg-white/10 mx-1" />
            <ToolbarButton active={editor.isActive('link')} onClick={openLinkPopover}>
              🔗 Link
            </ToolbarButton>
            <span className="w-px bg-white/10 mx-1" />
            <ToolbarButton active={false} onClick={() => editor.chain().focus().undo().run()}>
              ↩ Undo
            </ToolbarButton>
            <ToolbarButton active={false} onClick={() => editor.chain().focus().redo().run()}>
              ↪ Redo
            </ToolbarButton>
          </div>

          {/* Link popover */}
          {linkPopover && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10 bg-white/5">
              <span className="text-xs text-white/40 shrink-0">URL</span>
              <input
                ref={linkInputRef}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyLink()
                  if (e.key === 'Escape') setLinkPopover(false)
                }}
                placeholder="https://example.com"
                className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none"
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
                  className="px-3 py-1 text-xs text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setLinkPopover(false) }}
                className="text-white/30 hover:text-white text-sm transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
      <div className="prose prose-invert prose-sm max-w-none [&_.tiptap]:outline-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

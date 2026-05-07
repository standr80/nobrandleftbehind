'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useCallback } from 'react'

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

  if (!editor) return null

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {editable && (
        <div className="flex flex-wrap gap-0.5 px-3 py-2 border-b border-white/10">
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
            " Quote
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
            {'</>'}
          </ToolbarButton>
          <span className="w-px bg-white/10 mx-1" />
          <ToolbarButton active={false} onClick={() => editor.chain().focus().undo().run()}>
            ↩ Undo
          </ToolbarButton>
          <ToolbarButton active={false} onClick={() => editor.chain().focus().redo().run()}>
            ↪ Redo
          </ToolbarButton>
        </div>
      )}
      <div className="prose prose-invert prose-sm max-w-none [&_.tiptap]:outline-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

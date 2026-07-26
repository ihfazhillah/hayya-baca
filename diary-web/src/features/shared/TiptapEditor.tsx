import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import type { PMDoc } from '@/api/types'

// Only the marks/nodes the backend whitelist accepts (Spec 060 §4.2):
// paragraph, text, hardBreak + bold, italic, textStyle(color). Everything the
// StarterKit would otherwise add is disabled so a publish can never be rejected.
const EMOJIS = ['😀', '😢', '❤️', '🌟', '🎉', '🐱', '🌧️', '🌈']
const COLORS = ['#111827', '#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed']

function makeExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      code: false,
      link: false,
      underline: false,
    }),
    TextStyle,
    Color,
  ]
}

export function TiptapEditor({
  initial,
  onChange,
}: {
  initial: PMDoc | null
  onChange: (doc: PMDoc) => void
}) {
  const editor = useEditor({
    extensions: makeExtensions(),
    content: initial ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as PMDoc),
    editorProps: {
      attributes: {
        class:
          'min-h-48 rounded-2xl bg-white p-4 text-lg leading-relaxed outline-none',
      },
    },
  })

  if (!editor) return null

  return (
    <div className="flex flex-col gap-2">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-purple-100 p-2">
      <ToolButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Tebal"
      >
        <b>B</b>
      </ToolButton>
      <ToolButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Miring"
      >
        <i>I</i>
      </ToolButton>
      <span className="mx-1 h-6 w-px bg-purple-300" />
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Warna ${c}`}
          onClick={() => editor.chain().focus().setColor(c).run()}
          className="h-7 w-7 rounded-full border-2 border-white shadow"
          style={{ backgroundColor: c }}
        />
      ))}
      <span className="mx-1 h-6 w-px bg-purple-300" />
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => editor.chain().focus().insertContent(e).run()}
          className="text-xl"
        >
          {e}
        </button>
      ))}
    </div>
  )
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={
        'h-9 w-9 rounded-xl text-lg ' +
        (active ? 'bg-purple-600 text-white' : 'bg-white text-purple-700')
      }
    >
      {children}
    </button>
  )
}

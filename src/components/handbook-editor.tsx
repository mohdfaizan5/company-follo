import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import type { JSONContent } from '@tiptap/core'
import { BlockEditor, SlashCommand, getSlashCommandSuggestion } from '../../node_modules/@editorcn/block-editor/src/index'
import '../../node_modules/@editorcn/block-editor/src/style.css'

export function HandbookEditor({ content, onChange }: { content: JSONContent; onChange: (content: JSONContent) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Type / for blocks, or start writing…' }),
      Underline,
      SlashCommand.configure({ suggestion: getSlashCommandSuggestion() }),
    ],
    content,
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
  })
  return <div className="min-h-80 bg-background py-2"><BlockEditor editor={editor} /></div>
}

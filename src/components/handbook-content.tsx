import type { JSONContent } from '@tiptap/core'

function safeHref(value: unknown) {
  if (typeof value !== 'string') return undefined
  try { const url = new URL(value, 'https://example.invalid'); return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : undefined }
  catch { return undefined }
}

export function HandbookContent({ content }: { content: JSONContent }) {
  function render(node: JSONContent, key: number): React.ReactNode {
    const children = node.content?.map(render)
    if (node.type === 'text') {
      let text: React.ReactNode = node.text ?? ''
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') text = <strong>{text}</strong>
        if (mark.type === 'italic') text = <em>{text}</em>
        if (mark.type === 'underline') text = <u>{text}</u>
        if (mark.type === 'strike') text = <s>{text}</s>
        if (mark.type === 'highlight') text = <mark>{text}</mark>
        if (mark.type === 'code') text = <code>{text}</code>
        if (mark.type === 'link') { const href = safeHref(mark.attrs?.href); if (href) text = <a href={href} rel="nofollow noreferrer">{text}</a> }
      }
      return <span key={key}>{text}</span>
    }
    switch (node.type) {
      case 'doc': return <div key={key} className="doc-body">{children}</div>
      case 'paragraph': return <p key={key}>{children}</p>
      case 'heading': { const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1)); if (level === 1) return <h1 key={key}>{children}</h1>; if (level === 2) return <h2 key={key}>{children}</h2>; return <h3 key={key}>{children}</h3> }
      case 'bulletList': return <ul key={key}>{children}</ul>
      case 'orderedList': return <ol key={key} start={Number(node.attrs?.start) || undefined}>{children}</ol>
      case 'listItem': return <li key={key}>{children}</li>
      case 'blockquote': return <blockquote key={key}>{children}</blockquote>
      case 'codeBlock': return <pre key={key}><code>{node.content?.map((part) => part.text ?? '').join('')}</code></pre>
      case 'horizontalRule': return <hr key={key} />
      case 'hardBreak': return <br key={key} />
      case 'image': { const src = safeHref(node.attrs?.src); return src ? <img key={key} src={src} alt={String(node.attrs?.alt ?? '')} className="my-6 rounded-lg" /> : null }
      default: return <div key={key}>{children}</div>
    }
  }
  // Same `doc-content` typography as the editor, so the preview matches what was written.
  return <article className="doc-content">{render(content, 0)}</article>
}

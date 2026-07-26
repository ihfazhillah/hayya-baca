import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { PMDoc, PMNode } from '@/api/types'

// Render whitelisted ProseMirror JSON to React. No HTML is ever interpreted,
// so there is no injection surface.
function renderText(node: PMNode, key: number): ReactNode {
  let style: CSSProperties = {}
  let bold = false
  let italic = false
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') bold = true
    if (mark.type === 'italic') italic = true
    if (mark.type === 'textStyle') {
      const color = (mark.attrs as { color?: string } | undefined)?.color
      if (color) style = { ...style, color }
    }
  }
  let content: ReactNode = node.text ?? ''
  if (bold) content = <strong>{content}</strong>
  if (italic) content = <em>{content}</em>
  return (
    <span key={key} style={style}>
      {content}
    </span>
  )
}

function renderNode(node: PMNode, key: number): ReactNode {
  switch (node.type) {
    case 'text':
      return renderText(node, key)
    case 'hardBreak':
      return <br key={key} />
    case 'paragraph':
      return (
        <p key={key} className="min-h-[1em] whitespace-pre-wrap">
          {node.content?.map((c, i) => (
            <Fragment key={i}>{renderNode(c, i)}</Fragment>
          ))}
        </p>
      )
    default:
      return (
        <Fragment key={key}>
          {node.content?.map((c, i) => renderNode(c, i))}
        </Fragment>
      )
  }
}

export function RenderDoc({ doc }: { doc: PMDoc | null }) {
  if (!doc) return null
  return (
    <div className="space-y-2 leading-relaxed text-purple-950">
      {doc.content?.map((c, i) => (
        <Fragment key={i}>{renderNode(c, i)}</Fragment>
      ))}
    </div>
  )
}

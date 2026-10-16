"use client"

import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function IssueDescription({
  description,
}: {
  description: string | null
}) {
  if (!description?.trim())
    return (
      <p className="text-xs text-muted-foreground">
        Esta issue no tiene descripción.
      </p>
    )
  return (
    <div className="issue-markdown min-w-0 text-sm leading-relaxed break-words">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {description}
      </Markdown>
    </div>
  )
}

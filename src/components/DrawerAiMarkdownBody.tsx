import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

const remarkPlugins = [remarkGfm, remarkBreaks]

const markdownComponents: Components = {
  a: ({ node, ...props }) => {
    void node
    return <a {...props} target="_blank" rel="noopener noreferrer" />
  },
}

export function DrawerAiMarkdownBody({
  markdown,
  className = 'drawer-ai-md',
}: {
  markdown: string
  className?: string
}) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

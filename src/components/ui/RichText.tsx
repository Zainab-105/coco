import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'

import { cn } from '@/lib/cn'

/** Renders Payload rich text with storefront typography. */
export function RichText({ data, className }: { data: unknown; className?: string }) {
  if (!data || typeof data !== 'object') return null
  return (
    <LexicalRichText
      data={data as SerializedEditorState}
      className={cn(
        'space-y-3 text-sm leading-relaxed [&_a]:text-burgundy-700 [&_a]:underline [&_h2]:font-display [&_h2]:text-2xl [&_h3]:font-display [&_h3]:text-xl [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc',
        className,
      )}
    />
  )
}

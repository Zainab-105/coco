import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import './print.css'

export const metadata: Metadata = { title: 'Print | COCO Admin', robots: { index: false, follow: false } }

/** Bare layout for printable admin documents (invoices, packing slips). */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

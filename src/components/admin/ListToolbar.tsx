'use client'

import { Button, useSelection } from '@payloadcms/ui'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Above the Orders / Customers / Products lists: CSV export of the current filtered list,
 * and for orders, printing invoices or packing slips for the selected rows.
 */
export function ListToolbar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { selected } = useSelection()
  const collection = pathname.split('/collections/')[1]?.split('/')[0] ?? ''
  const ids = [...selected.entries()].filter(([, on]) => on).map(([id]) => id)

  // Forward the list's active filters (where[...]) so the export matches what is on screen.
  const filters = new URLSearchParams()
  searchParams.forEach((value, key) => key.startsWith('where') && filters.append(key, value))
  const exportHref = `/api/${collection}/export${filters.size ? `?${filters}` : ''}`

  const print = (doc: 'invoice' | 'packing') => window.open(`/print/orders?doc=${doc}&ids=${ids.join(',')}`, '_blank', 'noopener')

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
      <Button el="anchor" url={exportHref} buttonStyle="secondary" size="small" margin={false}>
        Export CSV{filters.size ? ' (filtered)' : ''}
      </Button>
      {collection === 'orders' && (
        <>
          <Button buttonStyle="secondary" size="small" margin={false} disabled={!ids.length} onClick={() => print('invoice')}>
            Print invoices{ids.length ? ` (${ids.length})` : ''}
          </Button>
          <Button buttonStyle="secondary" size="small" margin={false} disabled={!ids.length} onClick={() => print('packing')}>
            Packing slips{ids.length ? ` (${ids.length})` : ''}
          </Button>
          {!ids.length && <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>Tick orders to print them.</span>}
        </>
      )}
      {collection === 'products' && (
        <Button el="link" url="/admin/import-products" buttonStyle="secondary" size="small" margin={false}>
          Bulk update prices &amp; stock
        </Button>
      )}
    </div>
  )
}

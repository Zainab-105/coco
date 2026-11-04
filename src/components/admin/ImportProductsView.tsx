import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'

import { hasRole } from '@/access/roles'

import { ImportProducts } from './ImportProducts'

/** /admin/import-products: bulk price & stock update from CSV (managers and owner). */
export function ImportProductsView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req } = initPageResult
  if (!hasRole(req.user, ['owner', 'manager'])) redirect('/admin')

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <h1 style={{ marginTop: 24 }}>Bulk update prices &amp; stock</h1>
        <ImportProducts />
      </Gutter>
    </DefaultTemplate>
  )
}

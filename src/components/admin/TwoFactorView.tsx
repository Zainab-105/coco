import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'

import { hasRole } from '@/access/roles'
import { loadTwoFactor } from '@/hooks/twoFactor'

import { TwoFactorSetup } from './TwoFactorSetup'

/** /admin/security: every admin user manages their own two-factor authentication here. */
export async function TwoFactorView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req } = initPageResult
  if (!hasRole(req.user, ['owner', 'manager', 'staff'])) redirect('/admin')
  const user = await loadTwoFactor(req, req.user!.id)

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
        <div style={{ maxWidth: 560, padding: '24px 0 48px' }}>
          <h1 style={{ marginTop: 0 }}>Two-factor authentication</h1>
          <p>A code from your phone is needed at login as well as your password, so a stolen password alone cannot open the admin.</p>
          <TwoFactorSetup enabled={Boolean(user.twoFactor?.enabled)} recoveryCodesLeft={((user.twoFactor?.recoveryCodes ?? []) as string[]).length} />
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}

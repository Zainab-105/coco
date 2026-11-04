import { APIError, type CollectionConfig, type FieldAccess } from 'payload'

import { hasRole, isOwner, isStaff } from '@/access/roles'
import { resetPasswordWithoutLogin, throttleForgotPassword, twoFactorDisable, twoFactorEnable, twoFactorReset, twoFactorSetup } from '@/endpoints/twoFactor'
import { enforceTwoFactor } from '@/hooks/twoFactor'

/** Changed only through the two-factor endpoints, never by editing a user. */
const serverOnly: { update: FieldAccess; create: FieldAccess } = { update: () => false, create: () => false }

/** Admin-panel users (owner and, later, staff). Customers live in `customers`. */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: 'Settings',
    components: { edit: { beforeDocumentControls: ['/components/admin/UserTools#UserTools'] } },
  },
  // Custom endpoints are matched first, so this replaces Payload's auto-login reset-password.
  endpoints: [resetPasswordWithoutLogin, twoFactorSetup, twoFactorEnable, twoFactorDisable, twoFactorReset],
  hooks: {
    beforeLogin: [enforceTwoFactor],
    beforeOperation: [
      ({ args, operation, req }) => {
        if (operation === 'forgotPassword' && throttleForgotPassword(req)) throw new APIError('Too many requests. Please try again later.', 429, undefined, true)
        return args
      },
    ],
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    tokenExpiration: 8 * 60 * 60,
    cookies: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  access: {
    admin: ({ req }) => hasRole(req.user, ['owner', 'manager', 'staff']),
    read: isStaff,
    create: isOwner,
    update: ({ req, id }) =>
      Boolean(req.user?.roles?.includes('owner')) || req.user?.id === id,
    delete: isOwner,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['owner'],
      saveToJWT: true,
      options: [
        { label: 'Owner', value: 'owner' },
        { label: 'Manager', value: 'manager' },
        { label: 'Staff', value: 'staff' },
      ],
      access: {
        update: ({ req }) => Boolean(req.user?.roles?.includes('owner')),
      },
    },
    {
      name: 'twoFactor',
      type: 'group',
      admin: { hidden: true },
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: false, access: serverOnly },
        // Hidden: never returned by the API. Read with showHiddenFields in hooks/twoFactor.ts.
        { name: 'secret', type: 'text', hidden: true, access: serverOnly },
        { name: 'pendingSecret', type: 'text', hidden: true, access: serverOnly },
        { name: 'recoveryCodes', type: 'json', hidden: true, access: serverOnly },
        { name: 'lastCounter', type: 'number', hidden: true, access: serverOnly },
      ],
    },
  ],
}

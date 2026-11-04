import type { CollectionConfig } from 'payload'

import { isManagerOrAbove, isStaff } from '@/access/roles'

/**
 * Optional storefront logins (email + one-time code). Deliberately not a Payload auth collection:
 * a customer must never become `req.user`, because admin access rules compare user ids.
 * The email is proven by the code, so orders with that email are shown as the customer's history.
 * Sessions are issued in lib/account/server.ts.
 */
export const CustomerAccounts: CollectionConfig = {
  slug: 'customer-accounts',
  labels: { singular: 'Customer account', plural: 'Customer accounts' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'phone', 'lastLoginAt', 'disabled'],
    listSearchableFields: ['email', 'name', 'phone'],
    group: 'Customers & Support',
    description: 'Created when a customer signs in on the website. Customer records from orders are under Sales > Customers.',
  },
  access: {
    read: isStaff,
    create: () => false,
    update: isManagerOrAbove,
    delete: isManagerOrAbove,
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true, admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'phone', type: 'text', admin: { description: 'As typed by the customer; not verified.' } },
      ],
    },
    {
      name: 'addresses',
      type: 'array',
      maxRows: 10,
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text' },
            { name: 'city', type: 'text', required: true },
          ],
        },
        { name: 'address', type: 'textarea', required: true },
      ],
    },
    { name: 'wishlist', type: 'relationship', relationTo: 'products', hasMany: true },
    { name: 'lastLoginAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'disabled',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Blocks sign-in and ends current sessions.' },
    },
    // Raised on sign-out to end sessions on every device.
    { name: 'sessionVersion', type: 'number', defaultValue: 1, admin: { hidden: true } },
  ],
}

/** One-time sign-in codes (hashed). Never visible in the admin or the API. */
export const LoginCodes: CollectionConfig = {
  slug: 'login-codes',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'email', type: 'email', required: true, index: true },
    { name: 'codeHash', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'attempts', type: 'number', defaultValue: 0 },
    { name: 'used', type: 'checkbox', defaultValue: false },
  ],
}

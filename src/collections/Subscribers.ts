import type { CollectionConfig } from 'payload'

import { isManagerOrAbove, isStaff } from '@/access/roles'
import { statusCell } from '@/fields/admin'
import { exportSubscribers } from '@/endpoints/exports'

/**
 * Newsletter list (footer sign-up and checkout opt-in). The CSV export includes each person's
 * unsubscribe link for use in the email tool; /unsubscribe also withdraws customer email consent.
 */
export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'status', 'source', 'consentAt', 'createdAt'],
    group: 'Marketing',
    components: { beforeListTable: ['/components/admin/ListToolbar#ListToolbar'] },
  },
  endpoints: [exportSubscribers],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        if (data.email) data.email = String(data.email).trim().toLowerCase()
        // Keep the consent timestamps in step with status changes made in the admin.
        if (data.status && data.status !== originalDoc?.status) {
          const now = new Date().toISOString()
          if (data.status === 'subscribed') data.consentAt ??= now
          else data.unsubscribedAt ??= now
        }
        if (!originalDoc && (data.status ?? 'subscribed') === 'subscribed') data.consentAt ??= new Date().toISOString()
        return data
      },
    ],
  },
  access: {
    read: isStaff,
    create: isStaff,
    update: isStaff,
    delete: isManagerOrAbove,
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'subscribed',
      index: true,
      admin: { components: statusCell },
      options: [
        { label: 'Subscribed', value: 'subscribed' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
      ],
    },
    { name: 'source', type: 'text', admin: { description: 'footer, checkout, popup' } },
    { name: 'consentAt', type: 'date', index: true, admin: { readOnly: true } },
    { name: 'unsubscribedAt', type: 'date', index: true, admin: { readOnly: true } },
    {
      name: 'unsubscribeToken',
      type: 'text',
      index: true,
      admin: { hidden: true },
      hooks: { beforeChange: [({ value }) => value ?? crypto.randomUUID()] },
    },
  ],
}

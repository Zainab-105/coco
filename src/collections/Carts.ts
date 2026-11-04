import type { CollectionConfig } from 'payload'

import { isManagerOrAbove, isStaff } from '@/access/roles'
import { moneyCell, statusCell } from '@/fields/admin'
import { exportCarts } from '@/endpoints/exports'

/**
 * Checkout snapshots captured once a visitor has typed a valid phone number or email at
 * checkout. Marked "recovered" when the same visitor (or phone) places an order, so the rest
 * are abandoned carts staff can follow up. Created only by the storefront (server side).
 */
export const Carts: CollectionConfig = {
  slug: 'carts',
  labels: { singular: 'Abandoned cart', plural: 'Abandoned carts' },
  admin: {
    useAsTitle: 'phone',
    defaultColumns: ['name', 'phone', 'subtotal', 'status', 'marketingConsent', 'lastActivityAt'],
    listSearchableFields: ['phone', 'email', 'name'],
    group: 'Marketing',
    description:
      'Checkouts that were started but not completed. Only message customers who ticked the marketing box, or to help with an order they asked about.',
    components: {
      beforeListTable: ['/components/admin/ListToolbar#ListToolbar'],
      edit: { beforeDocumentControls: ['/components/admin/CartFollowUp#CartFollowUp'] },
    },
  },
  defaultSort: '-lastActivityAt',
  endpoints: [exportCarts],
  access: {
    read: isStaff,
    create: () => false,
    update: isStaff,
    delete: isManagerOrAbove,
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'phone', type: 'text', index: true, admin: { readOnly: true } },
        { name: 'email', type: 'email', admin: { readOnly: true } },
        { name: 'city', type: 'text', admin: { readOnly: true } },
      ],
    },
    {
      name: 'items',
      type: 'array',
      admin: { readOnly: true },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'product', type: 'relationship', relationTo: 'products' },
            { name: 'title', type: 'text' },
            { name: 'variantLabel', type: 'text' },
            { name: 'quantity', type: 'number' },
            { name: 'unitPrice', type: 'number' },
          ],
        },
        { name: 'variantId', type: 'text', admin: { hidden: true } },
      ],
    },
    { name: 'subtotal', type: 'number', admin: { readOnly: true, components: moneyCell } },
    { name: 'notes', type: 'textarea', admin: { description: 'Follow-up notes for the team.' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      index: true,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Recovered', value: 'recovered' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: { position: 'sidebar', components: statusCell },
    },
    {
      name: 'marketingConsent',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', readOnly: true, description: 'Ticked "send me offers" at checkout.' },
    },
    { name: 'lastActivityAt', type: 'date', index: true, admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      admin: { position: 'sidebar', readOnly: true, condition: (data) => data?.status === 'recovered' },
    },
    {
      // Random id kept in the visitor's browser; ties repeated saves to one cart.
      name: 'token',
      type: 'text',
      unique: true,
      index: true,
      admin: { hidden: true },
    },
  ],
}

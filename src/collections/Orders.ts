import type { CollectionConfig } from 'payload'

import { isManagerOrAbove, isStaff, managerFieldAccess } from '@/access/roles'
import { moneyCell, statusCell } from '@/fields/admin'
import { logActivity } from '@/hooks/logActivity'
import { sendStatusEmails } from '@/hooks/orderEmails'
import { exportOrders } from '@/endpoints/exports'
import { computeTotals, prepareOrder, refreshCustomerStats } from '@/hooks/orders'
import { ORDER_STATUSES, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, PAYMENT_STATUSES } from '@/lib/orderStatus'

const label = (value: string) =>
  value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/**
 * Storefront orders are created by the checkout route with `overrideAccess`,
 * after server-side price validation. Admin users manage them here.
 */
export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'customer', 'total', 'payment.method', 'payment.status', 'status', 'createdAt'],
    listSearchableFields: ['orderNumber', 'shippingAddress.phone', 'shippingAddress.fullName', 'email'],
    group: 'Sales',
    components: {
      beforeListTable: ['/components/admin/OrderStatusTabs#OrderStatusTabs', '/components/admin/ListToolbar#ListToolbar'],
      edit: { beforeDocumentControls: ['/components/admin/OrderQuickActions#OrderQuickActions'] },
    },
  },
  endpoints: [exportOrders],
  access: {
    read: isStaff,
    create: isStaff,
    update: isStaff,
    delete: isManagerOrAbove,
  },
  hooks: {
    beforeChange: [computeTotals, prepareOrder],
    afterChange: [refreshCustomerStats, logActivity('orders'), sendStatusEmails],
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: ORDER_STATUSES.map((v) => ({ label: label(v), value: v })),
      admin: { position: 'sidebar', components: statusCell },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      index: true,
      admin: { position: 'sidebar', description: 'Linked automatically by phone number.' },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'product', type: 'relationship', relationTo: 'products', required: true },
            { name: 'variantId', type: 'text', admin: { hidden: true } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'title', type: 'text', required: true, admin: { description: 'Snapshot at time of order' } },
            { name: 'variantLabel', type: 'text' },
            { name: 'sku', type: 'text' },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'unitPrice', type: 'number', required: true, min: 0 },
            { name: 'quantity', type: 'number', required: true, min: 1, defaultValue: 1 },
            { name: 'lineTotal', type: 'number', admin: { readOnly: true } },
            {
              name: 'unitCost',
              type: 'number',
              access: { read: managerFieldAccess, update: managerFieldAccess },
              admin: { description: 'Cost snapshot for profit reports' },
            },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'subtotal', type: 'number', admin: { readOnly: true } },
        { name: 'discount', type: 'number', defaultValue: 0, min: 0 },
        { name: 'shippingFee', type: 'number', defaultValue: 0, min: 0 },
        {
          name: 'total',
          type: 'number',
          index: true,
          admin: { readOnly: true, components: moneyCell },
        },
      ],
    },
    { name: 'coupon', type: 'relationship', relationTo: 'coupons' },
    {
      name: 'shippingAddress',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'fullName', type: 'text', required: true },
            { name: 'phone', type: 'text', required: true, index: true },
          ],
        },
        { name: 'city', type: 'text', required: true },
        { name: 'address', type: 'textarea', required: true },
      ],
    },
    { name: 'email', type: 'email' },
    { name: 'marketingConsent', type: 'checkbox', defaultValue: false },
    {
      name: 'gift',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'wrap', type: 'checkbox', defaultValue: false },
            { name: 'wrapFee', type: 'number', defaultValue: 0, min: 0, admin: { description: 'Added to the total' } },
          ],
        },
        { name: 'note', type: 'textarea' },
      ],
    },
    {
      name: 'payment',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'method',
              type: 'select',
              required: true,
              defaultValue: 'cod',
              options: PAYMENT_METHODS.map((v) => ({ label: PAYMENT_METHOD_LABELS[v], value: v })),
            },
            {
              name: 'status',
              type: 'select',
              required: true,
              defaultValue: 'pending',
              index: true,
              options: PAYMENT_STATUSES.map((v) => ({ label: label(v), value: v })),
              admin: {
                components: statusCell,
                description:
                  'Mark "Paid" only after confirming the transaction in the JazzCash/Easypaisa merchant portal or via gateway callback.',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'transactionId', type: 'text' },
            { name: 'paidAt', type: 'date' },
          ],
        },
        {
          name: 'proof',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Customer screenshot. Supporting evidence only — does not confirm payment.' },
        },
        { name: 'gatewayResponse', type: 'json', admin: { readOnly: true } },
      ],
    },
    {
      name: 'fulfilment',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'courier', type: 'select', options: ['TCS', 'Leopards', 'PostEx', 'Trax', 'M&P', 'Other'] },
            { name: 'trackingNumber', type: 'text' },
            { name: 'shippedAt', type: 'date' },
            { name: 'deliveredAt', type: 'date' },
          ],
        },
      ],
    },
    {
      name: 'refund',
      type: 'group',
      admin: {
        condition: (data) => ['returned', 'refunded', 'cancelled'].includes(data?.status),
      },
      fields: [
        { name: 'amount', type: 'number', min: 0 },
        { name: 'reason', type: 'textarea' },
      ],
    },
    {
      name: 'internalNotes',
      type: 'array',
      fields: [
        { name: 'note', type: 'textarea', required: true },
        {
          name: 'author',
          type: 'relationship',
          relationTo: 'users',
          hooks: { beforeChange: [({ value, req }) => value ?? req.user?.id] },
        },
      ],
    },
    {
      name: 'statusHistory',
      type: 'array',
      admin: { readOnly: true, initCollapsed: true },
      fields: [
        { name: 'status', type: 'text' },
        { name: 'changedAt', type: 'date' },
        { name: 'changedBy', type: 'relationship', relationTo: 'users' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'website',
      options: ['website', 'whatsapp', 'instagram', 'manual'].map((v) => ({ label: label(v), value: v })),
      admin: { position: 'sidebar' },
    },
    {
      // Secret for the customer's order page link; the order number alone is guessable.
      name: 'accessToken',
      type: 'text',
      index: true,
      admin: { hidden: true },
    },
    {
      name: 'stockDeducted',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
    },
  ],
}

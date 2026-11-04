import type { CollectionConfig } from 'payload'

import { isManagerOrAbove, isStaff } from '@/access/roles'
import { moneyCell, statusCell } from '@/fields/admin'
import { normalizePkPhone } from '@/lib/phone'
import { exportCustomers } from '@/endpoints/exports'
import { mergeCustomer } from '@/endpoints/customerMerge'

/**
 * CRM record, created automatically from orders (matched by normalised phone).
 * Customer login accounts are added in a later phase and link to this record.
 */
export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phone', 'orderCount', 'totalSpent', 'lastOrderAt', 'segment'],
    listSearchableFields: ['name', 'phone', 'email'],
    group: 'Sales',
    components: {
      beforeListTable: ['/components/admin/ListToolbar#ListToolbar'],
      edit: { beforeDocumentControls: ['/components/admin/CustomerTools#CustomerTools'] },
    },
  },
  endpoints: [exportCustomers, mergeCustomer],
  access: {
    read: isStaff,
    create: isStaff,
    update: isStaff,
    delete: isManagerOrAbove,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'phone',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [({ value }) => (typeof value === 'string' ? (normalizePkPhone(value) ?? value) : value)],
      },
    },
    { name: 'email', type: 'email', index: true },
    {
      name: 'addresses',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', admin: { placeholder: 'Home / Office' } },
            { name: 'city', type: 'text', required: true },
          ],
        },
        { name: 'address', type: 'textarea', required: true },
      ],
    },
    {
      name: 'marketing',
      type: 'group',
      fields: [
        { name: 'emailConsent', type: 'checkbox', defaultValue: false },
        { name: 'whatsappConsent', type: 'checkbox', defaultValue: false },
        { name: 'consentUpdatedAt', type: 'date' },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Internal only. Never shown to the customer.' },
    },
    {
      type: 'collapsible',
      label: 'Purchase stats (automatic)',
      admin: { position: 'sidebar' },
      fields: [
        { name: 'orderCount', type: 'number', defaultValue: 0, admin: { readOnly: true } },
        {
          name: 'totalSpent',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true, components: moneyCell },
        },
        { name: 'averageOrderValue', type: 'number', defaultValue: 0, admin: { readOnly: true } },
        { name: 'firstOrderAt', type: 'date', admin: { readOnly: true } },
        { name: 'lastOrderAt', type: 'date', admin: { readOnly: true } },
        {
          name: 'segment',
          type: 'select',
          defaultValue: 'new',
          admin: { readOnly: true, components: statusCell },
          options: [
            { label: 'New', value: 'new' },
            { label: 'Repeat', value: 'repeat' },
            { label: 'High value', value: 'high_value' },
            { label: 'Inactive', value: 'inactive' },
          ],
        },
      ],
    },
    {
      name: 'orders',
      type: 'join',
      collection: 'orders',
      on: 'customer',
      admin: { defaultColumns: ['orderNumber', 'status', 'total', 'createdAt'] },
    },
  ],
}

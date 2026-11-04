import type { CollectionConfig } from 'payload'

import { isManagerOrAbove, isStaff } from '@/access/roles'

/** Discount codes. Orders, discount given and sales per code are in Reports > Marketing. */
export const Coupons: CollectionConfig = {
  slug: 'coupons',
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'type', 'value', 'usageCount', 'usageLimit', 'active', 'endsAt'],
    group: 'Marketing',
    description: 'One code per order. Discounts apply to the item subtotal of eligible categories.',
  },
  access: {
    read: isStaff,
    create: isManagerOrAbove,
    update: isManagerOrAbove,
    delete: isManagerOrAbove,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      hooks: {
        beforeValidate: [
          ({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
        ],
      },
    },
    { name: 'description', type: 'text' },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          defaultValue: 'percentage',
          options: [
            { label: 'Percentage off', value: 'percentage' },
            { label: 'Fixed amount off (PKR)', value: 'fixed' },
            { label: 'Free shipping', value: 'free_shipping' },
          ],
        },
        {
          name: 'value',
          type: 'number',
          min: 0,
          defaultValue: 0,
          validate: (value: number | null | undefined, { siblingData }: { siblingData: { type?: string } }) => {
            const type = siblingData.type
            if ((value ?? 0) < 0) return 'Must be 0 or more.'
            if (type === 'percentage' && (value ?? 0) > 100) return 'A percentage cannot be more than 100.'
            if (type !== 'free_shipping' && !value) return 'Enter the discount amount.'
            return true
          },
        },
        {
          name: 'maxDiscount',
          type: 'number',
          min: 0,
          admin: { description: 'Cap for percentage coupons' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'minOrderAmount', type: 'number', min: 0 },
        { name: 'usageLimit', type: 'number', min: 0, admin: { description: 'Empty = unlimited' } },
        { name: 'perCustomerLimit', type: 'number', min: 0 },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'startsAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
        {
          name: 'endsAt',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime' } },
          validate: (value, { siblingData }) => {
            const startsAt = (siblingData as { startsAt?: string }).startsAt
            return !value || !startsAt || new Date(value) > new Date(startsAt) || 'End must be after the start.'
          },
        },
      ],
    },
    {
      name: 'appliesToCategories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: { description: 'Empty = whole store' },
    },
    { name: 'active', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
    {
      name: 'usageCount',
      type: 'number',
      defaultValue: 0,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}

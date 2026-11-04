import type { CollectionConfig } from 'payload'

import { isManagerOrAbove } from '@/access/roles'

/** Non-product costs (ads, packaging, courier fees) used in estimated profit reports. */
export const Expenses: CollectionConfig = {
  slug: 'expenses',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'amount', 'date'],
    group: 'Reports',
  },
  access: {
    read: isManagerOrAbove,
    create: isManagerOrAbove,
    update: isManagerOrAbove,
    delete: isManagerOrAbove,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'amount', type: 'number', required: true, min: 0 },
        { name: 'date', type: 'date', required: true, index: true },
        {
          name: 'category',
          type: 'select',
          options: [
            { label: 'Advertising', value: 'advertising' },
            { label: 'Packaging', value: 'packaging' },
            { label: 'Courier', value: 'courier' },
            { label: 'Salaries', value: 'salaries' },
            { label: 'Hosting & software', value: 'hosting' },
            { label: 'Other', value: 'other' },
          ],
        },
      ],
    },
    { name: 'note', type: 'textarea' },
  ],
}

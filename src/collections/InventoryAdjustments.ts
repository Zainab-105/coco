import type { CollectionConfig } from 'payload'

import { isManagerOrAbove, isStaff } from '@/access/roles'
import { applyManualAdjustment } from '@/hooks/inventory'

/**
 * Append-only stock ledger. Order-driven entries are written by order hooks;
 * manual entries (restock, damage, count correction) are added by managers.
 */
export const InventoryAdjustments: CollectionConfig = {
  slug: 'inventory-adjustments',
  admin: {
    defaultColumns: ['product', 'quantityChange', 'reason', 'reference', 'adjustedBy', 'createdAt'],
    group: 'Catalog',
    description:
      'Every stock movement. To restock or correct stock, create an entry: positive numbers add stock, negative remove it. Order entries are added automatically.',
  },
  hooks: {
    beforeChange: [applyManualAdjustment],
  },
  access: {
    read: isStaff,
    create: isManagerOrAbove,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    {
      name: 'variantSku',
      type: 'text',
      admin: { description: 'Required for products with fragrance variants, e.g. CS-HCD-SWE.' },
    },
    { name: 'variantId', type: 'text', admin: { hidden: true } },
    {
      name: 'quantityChange',
      type: 'number',
      required: true,
      admin: { description: 'e.g. 24 for a delivery of 24 units, -2 for two broken bottles.' },
    },
    {
      name: 'reason',
      type: 'select',
      required: true,
      options: [
        { label: 'Order', value: 'order' },
        { label: 'Order cancelled / returned', value: 'order_reversal' },
        { label: 'Restock', value: 'restock' },
        { label: 'Damaged / lost', value: 'damage' },
        { label: 'Stock count correction', value: 'correction' },
      ],
    },
    {
      name: 'reference',
      type: 'text',
      admin: { description: 'Order number, supplier invoice, etc.' },
    },
    { name: 'note', type: 'textarea' },
    { name: 'adjustedBy', type: 'relationship', relationTo: 'users' },
  ],
}

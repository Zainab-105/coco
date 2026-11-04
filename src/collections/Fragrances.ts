import type { CollectionConfig } from 'payload'

import { anyone, isManagerOrAbove } from '@/access/roles'
import { revalidateAll, revalidateAllOnDelete } from '@/hooks/revalidate'
import { slugField } from '@/fields/slug'

/** Reusable scent profiles (e.g. Sweet Rose, Citrus Mint) shared by diffusers and gift sets. */
export const Fragrances: CollectionConfig = {
  slug: 'fragrances',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'family', 'mood'],
    group: 'Catalog',
  },
  hooks: {
    afterChange: [revalidateAll],
    afterDelete: [revalidateAllOnDelete],
  },
  access: {
    read: anyone,
    create: isManagerOrAbove,
    update: isManagerOrAbove,
    delete: isManagerOrAbove,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    {
      name: 'family',
      type: 'select',
      options: ['floral', 'fresh', 'citrus', 'woody', 'oriental', 'aquatic', 'gourmand'].map(
        (v) => ({ label: v[0].toUpperCase() + v.slice(1), value: v }),
      ),
    },
    {
      name: 'mood',
      type: 'text',
      admin: { description: 'Short tagline, e.g. "Floral & Romantic".' },
    },
    {
      type: 'row',
      fields: [
        { name: 'topNotes', type: 'text' },
        { name: 'heartNotes', type: 'text' },
        { name: 'baseNotes', type: 'text' },
      ],
    },
    {
      name: 'swatch',
      type: 'text',
      admin: { description: 'Hex colour used for the fragrance chip, e.g. #7A1F2B.' },
    },
  ],
}

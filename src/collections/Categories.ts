import type { CollectionConfig } from 'payload'

import { anyone, isManagerOrAbove } from '@/access/roles'
import { redirectOldSlug } from '@/hooks/redirects'
import { revalidateAll, revalidateAllOnDelete } from '@/hooks/revalidate'
import { slugField } from '@/fields/slug'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'parent', 'sortOrder'],
    group: 'Catalog',
  },
  hooks: {
    afterChange: [redirectOldSlug('/collections'), revalidateAll],
    afterDelete: [revalidateAllOnDelete],
  },
  access: {
    read: anyone,
    create: isManagerOrAbove,
    update: isManagerOrAbove,
    delete: isManagerOrAbove,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      admin: { position: 'sidebar', description: 'Leave empty for a top-level category.' },
    },
    { name: 'description', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'sortOrder', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
    {
      name: 'showInMenu',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
  ],
}

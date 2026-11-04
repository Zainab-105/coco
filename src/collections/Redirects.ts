import type { CollectionConfig } from 'payload'

import { isManagerOrAbove, isStaff } from '@/access/roles'
import { revalidateAll, revalidateAllOnDelete } from '@/hooks/revalidate'
import { normalizeRedirectPath, redirectTargetProblem } from '@/lib/seo/redirects'

/**
 * Old links that should keep working. Consulted only when a page is not found, so they add no
 * cost to normal pages. Created automatically when a product or category URL changes.
 */
export const Redirects: CollectionConfig = {
  slug: 'redirects',
  admin: {
    useAsTitle: 'from',
    defaultColumns: ['from', 'to', 'createdAt'],
    listSearchableFields: ['from', 'to'],
    group: 'Marketing',
    description: 'Sends visitors and Google from an old address to a new one. Added automatically when a product or category URL changes.',
  },
  access: {
    read: isStaff,
    create: isManagerOrAbove,
    update: isManagerOrAbove,
    delete: isManagerOrAbove,
  },
  hooks: {
    afterChange: [revalidateAll],
    afterDelete: [revalidateAllOnDelete],
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Old path, e.g. /products/old-name' },
      hooks: { beforeValidate: [({ value }) => (typeof value === 'string' ? normalizeRedirectPath(value) : value)] },
    },
    {
      name: 'to',
      type: 'text',
      required: true,
      admin: { description: 'New path, e.g. /products/new-name, or a full https:// address' },
      validate: (value: string | null | undefined, { siblingData }: { siblingData: { from?: string } }) => {
        if (!value) return 'Enter where this should go.'
        if (siblingData.from && normalizeRedirectPath(value) === siblingData.from) return 'This would redirect to itself.'
        return redirectTargetProblem(value) ?? true
      },
    },
    { name: 'note', type: 'text' },
  ],
}

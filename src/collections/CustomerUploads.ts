import type { CollectionConfig } from 'payload'

import { hasRole, isStaff } from '@/access/roles'

/**
 * Photos and videos sent by customers with reviews and support messages. Kept apart from the
 * product media library: private to staff until a review using them is approved (`isPublic`,
 * set by the review hooks). Images are re-encoded, which also strips location data from phones.
 */
export const CustomerUploads: CollectionConfig = {
  slug: 'customer-uploads',
  admin: {
    group: 'Customers & Support',
    defaultColumns: ['filename', 'kind', 'isPublic', 'filesize', 'createdAt'],
    description: 'Files sent by customers. Only those on approved reviews are visible to the public.',
  },
  access: {
    read: ({ req }) => (hasRole(req.user, ['owner', 'manager', 'staff']) ? true : { isPublic: { equals: true } }),
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        const mimeType: string | undefined = data.mimeType ?? req.file?.mimetype
        if (mimeType) data.kind = mimeType.startsWith('video/') ? 'video' : 'image'
        return data
      },
    ],
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      options: [
        { label: 'Image', value: 'image' },
        { label: 'Video', value: 'video' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { readOnly: true, position: 'sidebar', description: 'Set automatically when the review is approved.' },
    },
  ],
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'],
    imageSizes: [{ name: 'card', width: 640, height: 640, position: 'centre' }],
    formatOptions: { format: 'webp', options: { quality: 82 } },
  },
}

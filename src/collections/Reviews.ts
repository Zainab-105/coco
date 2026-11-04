import type { CollectionConfig } from 'payload'

import { isStaff } from '@/access/roles'
import { statusCell } from '@/fields/admin'
import { revalidateAll, revalidateAllOnDelete } from '@/hooks/revalidate'
import { deleteUploadsWithDoc, syncReviewMedia, updateProductRating, updateProductRatingOnDelete } from '@/hooks/reviews'

/** Customer reviews. Submitted from product pages (lib/support/server.ts) and hidden until approved. */
export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'authorName',
    defaultColumns: ['product', 'authorName', 'rating', 'verifiedPurchase', 'status', 'createdAt'],
    group: 'Customers & Support',
    components: {
      beforeListTable: ['/components/admin/ModerationTabs#ReviewTabs'],
      edit: { beforeDocumentControls: ['/components/admin/ReviewActions#ReviewActions'] },
    },
  },
  hooks: {
    afterChange: [updateProductRating, syncReviewMedia, revalidateAll],
    afterDelete: [updateProductRatingOnDelete, deleteUploadsWithDoc, revalidateAllOnDelete],
  },
  access: {
    read: ({ req }) =>
      req.user?.collection === 'users' ? true : { status: { equals: 'approved' } },
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    { name: 'customer', type: 'relationship', relationTo: 'customers' },
    { name: 'order', type: 'relationship', relationTo: 'orders' },
    { name: 'authorName', type: 'text', required: true },
    { name: 'rating', type: 'number', required: true, min: 1, max: 5 },
    { name: 'title', type: 'text' },
    { name: 'body', type: 'textarea' },
    {
      name: 'attachments',
      type: 'upload',
      relationTo: 'customer-uploads',
      hasMany: true,
      admin: { description: 'Customer photos and videos. They become public when the review is approved; remove any that should not be shown.' },
    },
    {
      name: 'verifiedPurchase',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Hidden', value: 'hidden' },
        { label: 'Spam', value: 'spam' },
      ],
      admin: { position: 'sidebar', components: statusCell },
    },
    { name: 'adminReply', type: 'textarea', admin: { description: 'Shown publicly under the review.' } },
  ],
}

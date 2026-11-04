import type { CollectionConfig } from 'payload'

import { isManagerOrAbove, managerFieldAccess, publishedOrStaff } from '@/access/roles'
import { moneyCell, statusCell } from '@/fields/admin'
import { slugField } from '@/fields/slug'
import { logActivity } from '@/hooks/logActivity'
import { alertOnLowStock } from '@/hooks/inventory'
import { computeStock, resetOnDuplicate, uniqueOnDuplicate } from '@/hooks/products'
import { exportProducts } from '@/endpoints/exports'
import { importProducts } from '@/endpoints/productImport'
import { redirectOldSlug } from '@/hooks/redirects'
import { revalidateProduct, revalidateProductDelete } from '@/hooks/revalidate'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'price', 'salePrice', 'totalStock', 'stockStatus', 'status'],
    listSearchableFields: ['title', 'sku'],
    group: 'Catalog',
    description:
      'Add or edit products. Use the "..." menu on a product to duplicate it. Filter by Stock status to find low-stock items.',
    components: { beforeListTable: ['/components/admin/ListToolbar#ListToolbar'] },
  },
  access: {
    read: publishedOrStaff,
    create: isManagerOrAbove,
    update: isManagerOrAbove,
    delete: isManagerOrAbove,
  },
  endpoints: [exportProducts, importProducts],
  hooks: {
    beforeChange: [computeStock],
    afterChange: [logActivity('products'), redirectOldSlug('/products'), revalidateProduct, alertOnLowStock],
    afterDelete: [revalidateProductDelete],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            { name: 'title', type: 'text', required: true },
            {
              name: 'productType',
              type: 'select',
              required: true,
              defaultValue: 'simple',
              options: [
                { label: 'Simple product', value: 'simple' },
                { label: 'Product with variants (fragrance / option)', value: 'variable' },
                { label: 'Gift set / bundle', value: 'bundle' },
              ],
            },
            { name: 'shortDescription', type: 'textarea' },
            { name: 'description', type: 'richText' },
            {
              name: 'features',
              type: 'array',
              labels: { singular: 'Feature', plural: 'Features' },
              fields: [{ name: 'text', type: 'text', required: true }],
            },
            {
              name: 'specifications',
              type: 'array',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'label', type: 'text', required: true },
                    { name: 'value', type: 'text', required: true },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Media',
          fields: [
            {
              name: 'gallery',
              type: 'array',
              minRows: 1,
              admin: {
                description:
                  'Images and videos in display order. The first item is the featured image; all items are swipeable on product cards.',
              },
              fields: [{ name: 'media', type: 'upload', relationTo: 'media', required: true }],
            },
          ],
        },
        {
          label: 'Pricing & Stock',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'price',
                  type: 'number',
                  required: true,
                  min: 0,
                  admin: { description: 'PKR', components: moneyCell },
                },
                {
                  name: 'salePrice',
                  type: 'number',
                  min: 0,
                  admin: { description: 'Leave empty if not on sale', components: moneyCell },
                },
                {
                  name: 'costPrice',
                  type: 'number',
                  min: 0,
                  access: { read: managerFieldAccess, update: managerFieldAccess },
                  admin: { description: 'Used for profit reports only. Never shown to customers.' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'sku',
                  type: 'text',
                  index: true,
                  hooks: { beforeDuplicate: [uniqueOnDuplicate] },
                },
                {
                  name: 'stock',
                  type: 'number',
                  defaultValue: 0,
                  admin: {
                    condition: (data) => data?.productType !== 'variable',
                    description: 'For variant products, stock is set per variant.',
                  },
                },
                { name: 'lowStockThreshold', type: 'number', defaultValue: 5 },
              ],
            },
            {
              name: 'variants',
              type: 'array',
              admin: { condition: (data) => data?.productType === 'variable' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'label', type: 'text', required: true },
                    { name: 'fragrance', type: 'relationship', relationTo: 'fragrances' },
                    { name: 'sku', type: 'text' },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'price',
                      type: 'number',
                      min: 0,
                      admin: { description: 'Overrides product price' },
                    },
                    { name: 'salePrice', type: 'number', min: 0 },
                    {
                      name: 'costPrice',
                      type: 'number',
                      min: 0,
                      access: { read: managerFieldAccess, update: managerFieldAccess },
                    },
                    { name: 'stock', type: 'number', defaultValue: 0 },
                  ],
                },
                { name: 'image', type: 'upload', relationTo: 'media' },
              ],
            },
            {
              name: 'bundleItems',
              type: 'array',
              admin: { condition: (data) => data?.productType === 'bundle' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'product',
                      type: 'relationship',
                      relationTo: 'products',
                      required: true,
                    },
                    { name: 'quantity', type: 'number', defaultValue: 1, min: 1 },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Fragrance',
          fields: [
            {
              name: 'fragrances',
              type: 'relationship',
              relationTo: 'fragrances',
              hasMany: true,
              admin: {
                description: 'Scent profiles shown on the product page and used by filters.',
              },
            },
          ],
        },
        {
          label: 'Shipping & Gifting',
          fields: [
            { name: 'weightGrams', type: 'number' },
            { name: 'giftWrapAvailable', type: 'checkbox', defaultValue: false },
            {
              name: 'deliveryNote',
              type: 'text',
              admin: { description: 'e.g. "Delivered in 2-4 working days".' },
            },
          ],
        },
      ],
    },
    slugField('title'),
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      hooks: { beforeDuplicate: [resetOnDuplicate('draft')] },
      admin: { position: 'sidebar', components: statusCell },
    },
    {
      name: 'effectivePrice',
      type: 'number',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Calculated: the price customers pay now (sale price if lower). Used for sorting and filters.',
      },
    },
    {
      name: 'totalStock',
      type: 'number',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Calculated: product stock, or the sum of all variant stock.',
      },
    },
    {
      name: 'stockStatus',
      type: 'select',
      index: true,
      options: [
        { label: 'In stock', value: 'in_stock' },
        { label: 'Low stock', value: 'low_stock' },
        { label: 'Out of stock', value: 'out_of_stock' },
      ],
      admin: { position: 'sidebar', readOnly: true, components: statusCell },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      admin: { position: 'sidebar' },
    },
    { name: 'featured', type: 'checkbox', admin: { position: 'sidebar' } },
    { name: 'isNewArrival', type: 'checkbox', admin: { position: 'sidebar' } },
    {
      name: 'relatedProducts',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'salesCount',
      type: 'number',
      defaultValue: 0,
      hooks: { beforeDuplicate: [resetOnDuplicate(0)] },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Updated from orders. Used for "popularity" sorting.',
      },
    },
    {
      name: 'ratingAverage',
      type: 'number',
      defaultValue: 0,
      hooks: { beforeDuplicate: [resetOnDuplicate(0)] },
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'ratingCount',
      type: 'number',
      defaultValue: 0,
      hooks: { beforeDuplicate: [resetOnDuplicate(0)] },
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}

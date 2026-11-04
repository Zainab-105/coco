import type { GlobalConfig } from 'payload'

import { anyone, isOwner } from '@/access/roles'
import { revalidateGlobal } from '@/hooks/revalidate'

/** Store-wide settings editable by the owner without code changes. */
export const StoreSettings: GlobalConfig = {
  slug: 'store-settings',
  admin: { group: 'Settings' },
  hooks: {
    afterChange: [revalidateGlobal],
  },
  access: {
    read: anyone,
    update: isOwner,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Contact & Social',
          fields: [
            { name: 'storeName', type: 'text', defaultValue: 'COCO' },
            { name: 'tagline', type: 'text', defaultValue: 'Little Scents. Big Vibes.' },
            {
              type: 'row',
              fields: [
                { name: 'whatsappNumber', type: 'text', admin: { description: 'E.g. +923001234567' } },
                { name: 'supportEmail', type: 'email' },
                { name: 'supportPhone', type: 'text' },
              ],
            },
            { name: 'address', type: 'textarea' },
            {
              name: 'social',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'instagram', type: 'text' },
                    { name: 'facebook', type: 'text' },
                    { name: 'tiktok', type: 'text' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Shipping & Payments',
          fields: [
            {
              name: 'shipping',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'flatRate', type: 'number', defaultValue: 250, min: 0 },
                    { name: 'freeShippingThreshold', type: 'number', defaultValue: 3000, min: 0 },
                  ],
                },
                {
                  name: 'cityRates',
                  type: 'array',
                  admin: { description: 'Optional per-city overrides of the flat rate.' },
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'city', type: 'text', required: true },
                        { name: 'rate', type: 'number', required: true, min: 0 },
                      ],
                    },
                  ],
                },
                { name: 'deliveryEstimate', type: 'text', defaultValue: '2-5 working days' },
              ],
            },
            {
              name: 'payments',
              type: 'group',
              fields: [
                { name: 'codEnabled', type: 'checkbox', defaultValue: true },
                { name: 'codMaxOrderValue', type: 'number', defaultValue: 25000, min: 0 },
                { name: 'jazzcashEnabled', type: 'checkbox', defaultValue: false },
                { name: 'easypaisaEnabled', type: 'checkbox', defaultValue: false },
                {
                  name: 'manualTransferInstructions',
                  type: 'textarea',
                  admin: {
                    description:
                      'Your real bank or wallet details: account title, number, IBAN. Leave empty to hide this payment option. Customers see this text at checkout, on their order page and in their email. Orders stay "Awaiting verification" until you confirm the money arrived.',
                  },
                },
              ],
            },
            {
              name: 'giftWrap',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'enabled', type: 'checkbox', defaultValue: true },
                    { name: 'price', type: 'number', defaultValue: 150, min: 0 },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Inventory & CRM',
          fields: [
            {
              name: 'inventory',
              type: 'group',
              fields: [
                {
                  name: 'deductStockOn',
                  type: 'select',
                  defaultValue: 'placed',
                  options: [
                    { label: 'When order is placed', value: 'placed' },
                    { label: 'When order is confirmed', value: 'confirmed' },
                  ],
                },
                { name: 'allowBackorders', type: 'checkbox', defaultValue: false },
              ],
            },
            {
              name: 'crm',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'highValueThreshold',
                      type: 'number',
                      defaultValue: 15000,
                      admin: { description: 'Lifetime spend (PKR) to tag a customer high value' },
                    },
                    {
                      name: 'inactiveAfterDays',
                      type: 'number',
                      defaultValue: 90,
                      admin: { description: 'Days since last order to tag as inactive' },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Policies',
          fields: [
            { name: 'shippingPolicy', type: 'richText' },
            { name: 'returnPolicy', type: 'richText' },
            { name: 'privacyPolicy', type: 'richText' },
            { name: 'terms', type: 'richText' },
            {
              name: 'faqs',
              type: 'array',
              fields: [
                { name: 'question', type: 'text', required: true },
                { name: 'answer', type: 'textarea', required: true },
              ],
            },
          ],
        },
      ],
    },
  ],
}

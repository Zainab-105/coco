import type { CollectionConfig } from 'payload'

import { anyone, isManagerOrAbove } from '@/access/roles'
import { statusCell } from '@/fields/admin'
import { revalidateAll, revalidateAllOnDelete } from '@/hooks/revalidate'

/** Live / scheduled / ended, from the active switch and the schedule dates. */
export function bannerSchedule(b: { active?: boolean | null; startsAt?: string | null; endsAt?: string | null }, now = new Date()) {
  if (b.active === false) return 'off'
  if (b.startsAt && new Date(b.startsAt) > now) return 'scheduled'
  if (b.endsAt && new Date(b.endsAt) <= now) return 'ended'
  return 'live'
}

/**
 * Hero slides, seasonal sale banners and announcement bars. Scheduled banners go live and come
 * down on their own; the storefront picks the change up within about 5 minutes.
 */
export const Banners: CollectionConfig = {
  slug: 'banners',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'placement', 'schedule', 'startsAt', 'endsAt', 'sortOrder'],
    group: 'Marketing',
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
    { name: 'title', type: 'text', required: true },
    { name: 'subtitle', type: 'text' },
    {
      name: 'placement',
      type: 'select',
      required: true,
      defaultValue: 'hero',
      options: [
        { label: 'Home hero slider', value: 'hero' },
        { label: 'Announcement bar', value: 'announcement' },
        { label: 'Category page', value: 'category' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'desktopImage', type: 'upload', relationTo: 'media' },
        { name: 'mobileImage', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'ctaLabel', type: 'text' },
        { name: 'ctaUrl', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Empty = show now' },
        },
        {
          name: 'endsAt',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Empty = no end date' },
          validate: (value, { siblingData }) => {
            const startsAt = (siblingData as { startsAt?: string }).startsAt
            return !value || !startsAt || new Date(value) > new Date(startsAt) || 'End must be after the start.'
          },
        },
        { name: 'sortOrder', type: 'number', defaultValue: 0 },
      ],
    },
    { name: 'active', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
    {
      name: 'schedule',
      type: 'text',
      virtual: true,
      admin: { readOnly: true, position: 'sidebar', components: statusCell, description: 'Live, scheduled or ended' },
      hooks: { afterRead: [({ data }) => (data ? bannerSchedule(data) : undefined)] },
    },
  ],
}

import { APIError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

import { anyone, isStaff } from '@/access/roles'

const MB = 1024 * 1024

/** Per-type upload limits. Videos are capped hard; the guideline in the admin asks for much smaller files. */
export const MEDIA_LIMITS = {
  image: 10 * MB,
  video: 25 * MB,
  audio: 5 * MB,
} as const

export type MediaKind = keyof typeof MEDIA_LIMITS

export const mediaKind = (mimeType?: string | null): MediaKind | null => {
  if (!mimeType) return null
  const kind = mimeType.split('/')[0]
  return kind === 'image' || kind === 'video' || kind === 'audio' ? kind : null
}

const enforceLimits: CollectionBeforeValidateHook = ({ data, req }) => {
  const file = req.file
  if (file) {
    const kind = mediaKind(file.mimetype)
    if (!kind) throw new APIError(`Unsupported file type: ${file.mimetype}`, 400, undefined, true)
    if (file.size > MEDIA_LIMITS[kind]) {
      throw new APIError(
        `This ${kind} is ${(file.size / MB).toFixed(1)} MB. The limit is ${MEDIA_LIMITS[kind] / MB} MB; please compress it and try again.`,
        400,
        undefined,
        true,
      )
    }
  }
  if (data) data.kind = mediaKind(data.mimeType ?? file?.mimetype) ?? data.kind
  return data
}

/** Product images, product videos, banners and customer review media. Stored on Cloudflare R2 in production. */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Catalog',
    defaultColumns: ['filename', 'alt', 'kind', 'filesize', 'updatedAt'],
    description:
      'Product photos: 4:5 portrait, at least 1600 x 2000 px. Videos: MP4, 6-15 seconds, 720p, ideally under 1.5 MB, always with a poster image. Limits: images 10 MB, videos 25 MB, audio 5 MB.',
  },
  access: {
    read: anyone,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  hooks: {
    beforeValidate: [enforceLimits],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Describe the image for screen readers and Google, e.g. "Sweet Rose hanging car diffuser".' },
    },
    {
      name: 'kind',
      type: 'select',
      index: true,
      options: [
        { label: 'Image', value: 'image' },
        { label: 'Video', value: 'video' },
        { label: 'Audio', value: 'audio' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'poster',
      type: 'upload',
      relationTo: 'media',
      filterOptions: { kind: { equals: 'image' } },
      admin: {
        description: 'Required for videos: the cover image shown before the video plays.',
        condition: (data) => data?.kind !== 'image' && data?.kind !== 'audio',
      },
      validate: (value: unknown, { data }: { data: Record<string, unknown> }) =>
        data?.kind === 'video' && !value ? 'Please choose a poster image for this video.' : true,
    },
  ],
  upload: {
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/mp4',
      'audio/webm',
      'audio/ogg',
    ],
    focalPoint: true,
    imageSizes: [
      { name: 'thumbnail', width: 320, height: 400, position: 'centre' },
      { name: 'card', width: 640, height: 800, position: 'centre' },
      { name: 'large', width: 1400 },
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
    formatOptions: { format: 'webp', options: { quality: 82 } },
  },
}

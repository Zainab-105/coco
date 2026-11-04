import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { ActivityLogs } from './collections/ActivityLogs'
import { Banners } from './collections/Banners'
import { Carts } from './collections/Carts'
import { Categories } from './collections/Categories'
import { Coupons } from './collections/Coupons'
import { CustomerAccounts, LoginCodes } from './collections/CustomerAccounts'
import { Customers } from './collections/Customers'
import { CustomerUploads } from './collections/CustomerUploads'
import { Expenses } from './collections/Expenses'
import { Fragrances } from './collections/Fragrances'
import { InventoryAdjustments } from './collections/InventoryAdjustments'
import { Media } from './collections/Media'
import { Orders } from './collections/Orders'
import { Products } from './collections/Products'
import { Redirects } from './collections/Redirects'
import { Reviews } from './collections/Reviews'
import { Subscribers } from './collections/Subscribers'
import { SupportTickets } from './collections/SupportTickets'
import { Users } from './collections/Users'
import { reportsExport } from './endpoints/reports'
import { StoreSettings } from './globals/StoreSettings'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const useR2 = Boolean(process.env.S3_BUCKET)
// Public R2 domain (e.g. https://media.coco.pk). When set, files are served straight from the CDN
// instead of being streamed through the app.
const mediaURL = process.env.NEXT_PUBLIC_MEDIA_URL?.replace(/\/$/, '')

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
  // Admin cookies are ignored on requests from other sites.
  csrf: process.env.NEXT_PUBLIC_SERVER_URL ? [process.env.NEXT_PUBLIC_SERVER_URL] : [],
  // Nothing uses GraphQL: the storefront calls Payload directly and the admin uses REST.
  graphQL: { disable: true },
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' | COCO Admin',
      icons: [{ rel: 'icon', type: 'image/png', url: '/brand/coco-mark.png' }],
    },
    components: {
      beforeLogin: ['/components/admin/TwoFactorLogin#TwoFactorLogin'],
      graphics: {
        Logo: '/components/admin/Graphics#AdminLogo',
        Icon: '/components/admin/Graphics#AdminIcon',
      },
      Nav: '/components/admin/nav/AdminNav#AdminNav',
      views: {
        dashboard: {
          Component: '/components/admin/dashboard/DashboardView#DashboardView',
        },
        security: {
          Component: '/components/admin/TwoFactorView#TwoFactorView',
          path: '/security',
        },
        reports: {
          Component: '/components/admin/reports/ReportsView#ReportsView',
          path: '/reports',
        },
        importProducts: {
          Component: '/components/admin/ImportProductsView#ImportProductsView',
          path: '/import-products',
        },
      },
    },
    dateFormat: 'd MMM yyyy, h:mm a',
    // Initials rather than Gravatar, which would send admin email addresses to a third party.
    avatar: { Component: '/components/admin/AdminAvatar#AdminAvatar' },
  },
  collections: [
    Orders,
    Customers,
    Products,
    Categories,
    Fragrances,
    Media,
    InventoryAdjustments,
    Coupons,
    Banners,
    Subscribers,
    Carts,
    Redirects,
    Reviews,
    SupportTickets,
    CustomerUploads,
    CustomerAccounts,
    LoginCodes,
    Expenses,
    Users,
    ActivityLogs,
  ],
  globals: [StoreSettings],
  endpoints: [reportsExport],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Dev uses schema push; production applies these committed migrations on boot.
    migrationDir: path.resolve(dirname, 'migrations'),
    prodMigrations: migrations,
  }),
  upload: {
    limits: { fileSize: 26 * 1024 * 1024 },
  },
  // SMTP (Resend, Brevo, Zoho...) when configured; otherwise emails are printed to the server log.
  email: process.env.SMTP_HOST
    ? nodemailerAdapter({
        defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'orders@coco.pk',
        defaultFromName: process.env.EMAIL_FROM_NAME || 'COCO',
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        },
      })
    : undefined,
  sharp,
  plugins: [
    seoPlugin({
      collections: ['products', 'categories'],
      uploadsCollection: 'media',
      generateTitle: ({ doc }) => `${doc?.title ?? 'COCO'} | COCO`,
      generateURL: ({ doc, collectionSlug }) =>
        `${process.env.NEXT_PUBLIC_SERVER_URL}/${collectionSlug === 'products' ? 'products' : 'collections'}/${doc?.slug ?? ''}`,
    }),
    s3Storage({
      enabled: useR2,
      collections: {
        media: mediaURL
          ? {
              prefix: 'media',
              disablePayloadAccessControl: true,
              generateFileURL: ({ filename, prefix }) => `${mediaURL}/${prefix ? `${prefix}/` : ''}${filename}`,
            }
          : { prefix: 'media' },
        // Always through the app, so Payload enforces who may read each file.
        'customer-uploads': { prefix: 'customer-uploads' },
      },
      bucket: process.env.S3_BUCKET || '',
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'auto',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
      },
    }),
  ],
})

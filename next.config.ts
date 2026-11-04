import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

import { securityHeaders } from './src/lib/security/headers'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// Media served from the R2 public domain in staging/production (see docs/ops/DEPLOYMENT.md).
const mediaURL = process.env.NEXT_PUBLIC_MEDIA_URL ? new URL(process.env.NEXT_PUBLIC_MEDIA_URL) : null
// With serverURL set, Payload returns absolute upload URLs (https://coco.pk/api/media/file/...).
const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ? new URL(process.env.NEXT_PUBLIC_SERVER_URL) : null
const protocol = (u: URL) => u.protocol.replace(':', '') as 'https' | 'http'

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    localPatterns: [
      { pathname: '/api/media/file/**' },
      { pathname: '/api/customer-uploads/file/**' },
      { pathname: '/brand/**' },
      // Design-review placeholders; remove with public/mock once real product media is uploaded.
      { pathname: '/mock/**' },
    ],
    remotePatterns: [
      ...(mediaURL ? [{ protocol: protocol(mediaURL), hostname: mediaURL.hostname, port: mediaURL.port, pathname: '/**' }] : []),
      ...(serverURL
        ? ['media', 'customer-uploads'].map((slug) => ({
            protocol: protocol(serverURL),
            hostname: serverURL.hostname,
            port: serverURL.port,
            pathname: `/api/${slug}/file/**`,
          }))
        : []),
    ],
  },
  poweredByHeader: false,
  async headers() {
    return securityHeaders({
      serverUrl: process.env.NEXT_PUBLIC_SERVER_URL,
      mediaUrl: process.env.NEXT_PUBLIC_MEDIA_URL,
      isDev: process.env.NODE_ENV === 'development',
    })
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

const withAdmin = withPayload(nextConfig, { devBundleServerPackages: false })

export default {
  ...withAdmin,
  /**
   * Payload asks every page for the visitor's colour scheme (Critical-CH), for the admin's theme.
   * Browsers restart the page load to send it, which costs each new shopper a full round trip, and
   * the matching Vary header hurts CDN caching. Only the admin needs it.
   */
  async headers() {
    const rules = (await withAdmin.headers?.()) ?? []
    return rules.flatMap((rule) =>
      rule.source === '/:path*' && rule.headers.some((h) => h.key === 'Critical-CH') ? ['/admin', '/admin/:path*'].map((source) => ({ ...rule, source })) : [rule],
    )
  },
} satisfies NextConfig

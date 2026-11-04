import 'server-only'

import { notFound, permanentRedirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { normalizeRedirectPath, resolveRedirect } from './redirects'

/** For pages about to show "not found": sends old links to their new home instead. */
export async function redirectOrNotFound(rawPath: string): Promise<never> {
  let target: string | null = null
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({ collection: 'redirects', pagination: false, depth: 0, select: { from: true, to: true }, overrideAccess: true })
    target = resolveRedirect(normalizeRedirectPath(rawPath), new Map(docs.map((r) => [r.from, r.to])))
  } catch (error) {
    console.warn('[redirects] lookup failed', (error as Error).message)
  }
  // These work by throwing, so they stay outside the try.
  if (target) permanentRedirect(target)
  notFound()
}

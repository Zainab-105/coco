import { clientIp, throttled } from '@/lib/throttle'

import { UPLOAD_LIMITS } from './uploads'
import type { IncomingFile } from './server'

/** Shared request handling for the public review and contact forms (multipart, so not Server Actions). */
const MAX_BODY = UPLOAD_LIMITS.totalBytes + 1024 * 1024

const failure = (status: number, form: string) => Response.json({ ok: false, errors: { form } }, { status })

export type FormRequest = { fields: Record<string, unknown>; files: IncomingFile[] }

/** Returns the parsed form, or the error response to send. */
export async function readPublicForm(request: Request, throttleKey: string): Promise<FormRequest | Response> {
  // Browsers send Origin on POST; a mismatch means another site is submitting this form.
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (origin && URL.parse(origin)?.host !== host) return failure(403, 'This form must be sent from the COCO website.')

  // Generous: failed validation counts too, and mobile carriers share IP addresses.
  if (throttled(`${throttleKey}:${clientIp(request.headers)}`, 15)) {
    return failure(429, 'Too many messages in a short time. Please wait a few minutes or message us on WhatsApp.')
  }
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) {
    return Response.json({ ok: false, errors: { files: 'These files are too large together. Please send fewer or smaller ones.' } }, { status: 413 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return failure(400, 'We could not read your message. Please try again.')
  }

  const fields: Record<string, unknown> = {}
  const uploads: File[] = []
  form.forEach((value, key) => {
    if (typeof value === 'string') fields[key] = value
    else if (key === 'files' && value.size > 0) uploads.push(value)
  })
  const files = await Promise.all(uploads.slice(0, UPLOAD_LIMITS.files + 1).map(async (f) => ({ size: f.size, bytes: new Uint8Array(await f.arrayBuffer()) })))
  return { fields, files }
}

/** Bots fill every field; answer as if it worked. */
export const isBot = (fields: Record<string, unknown>) => Boolean(fields.company)

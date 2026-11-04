import { getCurrentAccount } from '@/lib/account/server'
import { TURNSTILE_FAILED, verifyTurnstile } from '@/lib/security/turnstile'
import { readPublicForm } from '@/lib/support/http'
import { submitReview } from '@/lib/support/server'
import { validateReview } from '@/lib/support/validate'
import { clientIp } from '@/lib/throttle'

/** Public review submission. Always pending until staff approve it. */
export async function POST(request: Request) {
  const input = await readPublicForm(request, 'review')
  if (input instanceof Response) return input

  const { data, errors } = validateReview(input.fields)
  if (!data) return Response.json({ ok: false, errors }, { status: 400 })
  if (!(await verifyTurnstile(input.fields.turnstile, clientIp(request.headers)))) {
    return Response.json({ ok: false, errors: { form: TURNSTILE_FAILED } }, { status: 400 })
  }

  try {
    const result = await submitReview(data, input.files, await getCurrentAccount())
    return Response.json(result.ok ? { ok: true } : result, { status: result.ok ? 201 : 400 })
  } catch (error) {
    console.error('[reviews] submission failed', error)
    return Response.json({ ok: false, errors: { form: 'We could not save your review. Please try again.' } }, { status: 500 })
  }
}

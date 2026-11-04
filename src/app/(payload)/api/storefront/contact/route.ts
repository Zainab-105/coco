import { TURNSTILE_FAILED, verifyTurnstile } from '@/lib/security/turnstile'
import { isBot, readPublicForm } from '@/lib/support/http'
import { submitTicket } from '@/lib/support/server'
import { validateTicket } from '@/lib/support/validate'
import { clientIp } from '@/lib/throttle'

/** Public contact form: creates a support ticket for the team. */
export async function POST(request: Request) {
  const input = await readPublicForm(request, 'contact')
  if (input instanceof Response) return input
  if (isBot(input.fields)) return Response.json({ ok: true })

  const { data, errors } = validateTicket(input.fields)
  if (!data) return Response.json({ ok: false, errors }, { status: 400 })
  if (!(await verifyTurnstile(input.fields.turnstile, clientIp(request.headers)))) {
    return Response.json({ ok: false, errors: { form: TURNSTILE_FAILED } }, { status: 400 })
  }

  try {
    const result = await submitTicket(data, input.files)
    return Response.json(result.ok ? { ok: true, reference: result.id } : result, { status: result.ok ? 201 : 400 })
  } catch (error) {
    console.error('[contact] submission failed', error)
    return Response.json({ ok: false, errors: { form: 'We could not send your message. Please try again or message us on WhatsApp.' } }, { status: 500 })
  }
}

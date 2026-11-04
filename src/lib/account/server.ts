import 'server-only'

import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@/payload.config'

import { accountFromToken } from './core'
import { SESSION_DAYS } from './session'

const SESSION_COOKIE = 'coco_session'
/** Not sensitive: tells client code a session exists, so guests never call account actions. */
export const SIGNED_IN_COOKIE = 'coco_signed_in'

const options = {
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_DAYS * 86_400,
} as const

/** The signed-in customer for this request. Reading cookies makes the calling page dynamic. */
export const getCurrentAccount = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return accountFromToken(await getPayload({ config }), token)
})

export async function setSessionCookies(token: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, { ...options, httpOnly: true })
  store.set(SIGNED_IN_COOKIE, '1', options)
}

export async function clearSessionCookies() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  store.delete(SIGNED_IN_COOKIE)
}

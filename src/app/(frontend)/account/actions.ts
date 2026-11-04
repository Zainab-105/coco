'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'
import {
  accountWishlist,
  addAddress,
  endSessions,
  removeAddress,
  requestLoginCode,
  saveProfile,
  saveWishlist,
  verifyLoginCode,
  type CodeRequest,
} from '@/lib/account/core'
import { clearSessionCookies, getCurrentAccount, setSessionCookies } from '@/lib/account/server'
import { subscribe, unsubscribeEmail } from '@/lib/marketing/server'
import { TURNSTILE_FAILED, verifyTurnstile } from '@/lib/security/turnstile'
import { clientIp, throttled } from '@/lib/throttle'

const client = () => getPayload({ config })
const refresh = () => revalidatePath('/account')

export async function requestCodeAction(email: string, turnstile?: string): Promise<CodeRequest> {
  const ip = clientIp(await headers())
  if (throttled(`login-request:${ip}`, 10)) {
    return { ok: false, message: 'Too many attempts. Please try again later.' }
  }
  if (!(await verifyTurnstile(turnstile, ip))) return { ok: false, message: TURNSTILE_FAILED }
  return requestLoginCode(await client(), email)
}

export async function verifyCodeAction(email: string, code: string): Promise<{ ok: boolean; message?: string }> {
  if (throttled(`login-verify:${clientIp(await headers())}`, 20)) {
    return { ok: false, message: 'Too many attempts. Please try again later.' }
  }
  const result = await verifyLoginCode(await client(), email, code)
  if (!result.ok) return result
  await setSessionCookies(result.token)
  refresh()
  return { ok: true }
}

export async function signOutAction() {
  const account = await getCurrentAccount()
  if (account) await endSessions(await client(), account)
  await clearSessionCookies()
  refresh()
}

/** Removes the login, addresses and wishlist. Orders stay with the business for its records. */
export async function deleteAccountAction() {
  const account = await getCurrentAccount()
  if (account) await (await client()).delete({ collection: 'customer-accounts', id: account.id, overrideAccess: true })
  await clearSessionCookies()
  refresh()
}

export type FormResult = { error?: string; saved?: boolean }

export async function saveProfileAction(_prev: FormResult, form: FormData): Promise<FormResult> {
  const account = await getCurrentAccount()
  if (!account) return { error: 'Please sign in again.' }
  const error = await saveProfile(await client(), account, { name: form.get('name'), phone: form.get('phone') })
  if (error) return { error }
  refresh()
  return { saved: true }
}

export async function addAddressAction(_prev: FormResult, form: FormData): Promise<FormResult> {
  const account = await getCurrentAccount()
  if (!account) return { error: 'Please sign in again.' }
  const error = await addAddress(await client(), account, { label: form.get('label'), city: form.get('city'), address: form.get('address') })
  if (error) return { error }
  refresh()
  return { saved: true }
}

export async function removeAddressAction(addressId: string) {
  const account = await getCurrentAccount()
  if (!account) return
  await removeAddress(await client(), account, addressId)
  refresh()
}

export async function setOffersAction(enabled: boolean) {
  const account = await getCurrentAccount()
  if (!account) return
  if (enabled) await subscribe(account.email, 'account')
  else await unsubscribeEmail(account.email)
  refresh()
}

/** `merge` adds the device's list to the account's, used once after signing in on a device. */
export async function syncWishlistAction(ids: unknown, merge: boolean): Promise<number[] | null> {
  const account = await getCurrentAccount()
  if (!account) return null
  return saveWishlist(await client(), account, ids, { merge })
}

export async function loadWishlistAction(): Promise<{ accountId: number; ids: number[] } | null> {
  const account = await getCurrentAccount()
  return account ? { accountId: account.id, ids: accountWishlist(account) } : null
}

export type CheckoutPrefill = {
  name: string
  phone: string
  email: string
  addresses: { id: string; label: string; city: string; address: string }[]
}

export async function getCheckoutPrefillAction(): Promise<CheckoutPrefill | null> {
  const account = await getCurrentAccount()
  if (!account) return null
  return {
    name: account.name ?? '',
    phone: account.phone ?? '',
    email: account.email,
    addresses: (account.addresses ?? []).map((a) => ({ id: a.id ?? a.address, label: a.label ?? '', city: a.city, address: a.address })),
  }
}

/** Rules for the redirect manager. Pure, used by the admin validation and the storefront lookup. */
export function normalizeRedirectPath(input: string): string {
  const path = input.trim().split(/[?#]/)[0].replace(/\/+$/, '')
  return path.startsWith('/') ? path : `/${path}`
}

/** A message for the admin, or null when the destination is acceptable. */
export function redirectTargetProblem(to: string): string | null {
  const value = to.trim()
  if (value.startsWith('//') || value.startsWith('/\\')) return 'Use a path such as /collections/car-scents, or a full https:// address.'
  if (value.startsWith('/')) return null
  return /^https:\/\/[^\s/]+/.test(value) ? null : 'Use a path such as /collections/car-scents, or a full https:// address.'
}

/**
 * Where a path ends up, following chains so visitors make one hop. Returns null for no redirect,
 * or when the rules loop.
 */
export function resolveRedirect(path: string, rules: Map<string, string>): string | null {
  const seen = new Set([path])
  let current = path
  for (let i = 0; i < 10; i++) {
    const next = rules.get(current)
    if (next === undefined) break
    if (seen.has(next)) return null
    seen.add(next)
    current = next
  }
  return current === path ? null : current
}

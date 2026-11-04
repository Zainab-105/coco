import type { Access, FieldAccess } from 'payload'

import type { User } from '@/payload-types'

export type Role = 'owner' | 'manager' | 'staff'

export const hasRole = (user: unknown, roles: Role[]): boolean => {
  const u = user as User | null | undefined
  return Boolean(u?.roles?.some((role) => roles.includes(role as Role)))
}

export const anyone: Access = () => true

export const isOwner: Access = ({ req }) => hasRole(req.user, ['owner'])

export const isManagerOrAbove: Access = ({ req }) => hasRole(req.user, ['owner', 'manager'])

export const isStaff: Access = ({ req }) => hasRole(req.user, ['owner', 'manager', 'staff'])

/** Public sees only published docs; staff sees everything. */
export const publishedOrStaff: Access = ({ req }) => {
  if (hasRole(req.user, ['owner', 'manager', 'staff'])) return true
  return { status: { equals: 'published' } }
}

/** Cost prices and profit data are hidden from staff and the public. */
export const managerFieldAccess: FieldAccess = ({ req }) =>
  hasRole(req.user, ['owner', 'manager'])

export const ownerFieldAccess: FieldAccess = ({ req }) => hasRole(req.user, ['owner'])

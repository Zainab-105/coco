import type { CollectionConfig } from 'payload'

import { isOwner } from '@/access/roles'

/** Audit trail of admin actions. Written by hooks only; read-only for the owner. */
export const ActivityLogs: CollectionConfig = {
  slug: 'activity-logs',
  admin: {
    defaultColumns: ['user', 'action', 'targetCollection', 'targetId', 'createdAt'],
    group: 'Settings',
  },
  access: {
    read: isOwner,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users' },
    {
      name: 'action',
      type: 'select',
      options: [
        { label: 'Create', value: 'create' },
        { label: 'Update', value: 'update' },
        { label: 'Delete', value: 'delete' },
        { label: 'Export', value: 'export' },
      ],
    },
    { name: 'targetCollection', type: 'text' },
    { name: 'targetId', type: 'text' },
    { name: 'summary', type: 'text' },
  ],
}

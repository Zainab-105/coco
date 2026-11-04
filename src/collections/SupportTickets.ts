import type { CollectionConfig } from 'payload'

import { isManagerOrAbove, isStaff } from '@/access/roles'
import { statusCell } from '@/fields/admin'
import { deleteUploadsWithDoc } from '@/hooks/reviews'

/** Complaints, contact-form messages and feedback. Created from /contact (lib/support/server.ts) or by staff. */
export const SupportTickets: CollectionConfig = {
  slug: 'support-tickets',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'type', 'name', 'status', 'priority', 'createdAt'],
    listSearchableFields: ['subject', 'name', 'phone', 'email', 'orderReference'],
    group: 'Customers & Support',
    components: {
      beforeListTable: ['/components/admin/ModerationTabs#TicketTabs'],
      edit: { beforeDocumentControls: ['/components/admin/TicketTools#TicketTools'] },
    },
  },
  hooks: { afterDelete: [deleteUploadsWithDoc] },
  access: {
    read: isStaff,
    create: isStaff,
    update: isStaff,
    delete: isManagerOrAbove,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'select',
          defaultValue: 'enquiry',
          options: [
            { label: 'Enquiry', value: 'enquiry' },
            { label: 'Complaint', value: 'complaint' },
            { label: 'Feedback', value: 'feedback' },
            { label: 'Return / exchange', value: 'return' },
          ],
        },
        {
          name: 'priority',
          type: 'select',
          defaultValue: 'normal',
          options: [
            { label: 'Low', value: 'low' },
            { label: 'Normal', value: 'normal' },
            { label: 'High', value: 'high' },
          ],
        },
      ],
    },
    { name: 'subject', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'email' },
      ],
    },
    { name: 'message', type: 'textarea' },
    { name: 'attachments', type: 'upload', relationTo: 'customer-uploads', hasMany: true },
    { name: 'orderReference', type: 'text', admin: { description: 'Order number as typed by the customer.' } },
    { name: 'customer', type: 'relationship', relationTo: 'customers' },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      admin: { description: 'Linked automatically when the order number and phone match.' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'open',
      index: true,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: { position: 'sidebar', components: statusCell },
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar' },
    },
    { name: 'resolutionNotes', type: 'textarea', admin: { description: 'Internal notes on how this was resolved.' } },
  ],
}

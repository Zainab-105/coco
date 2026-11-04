import type { Endpoint, PayloadRequest } from 'payload'

import { hasRole } from '@/access/roles'
import { toCsv, type CsvColumn } from '@/lib/csv'
import { buildReport, csvValue, reportFileName, reportTables, type Column, type ReportTableKey } from '@/lib/reports/build'
import { loadReportData } from '@/lib/reports/load'
import { parseReportRange } from '@/lib/reports/range'

/**
 * GET /api/reports/export?table=products&range=30d (same range params as the Reports screen).
 * Staff get sales tables only; cost, profit, inventory value and expenses need manager or owner.
 * Every download is audit-logged.
 */
export const reportsExport: Endpoint = {
  path: '/reports/export',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    if (!hasRole(req.user, ['owner', 'manager', 'staff'])) return Response.json({ error: 'Forbidden' }, { status: 403 })
    const query = (req.query ?? {}) as Record<string, string | undefined>
    const range = parseReportRange(query)
    const report = buildReport(await loadReportData(req.payload, range))
    const tables = reportTables(report)

    const key = query.table as ReportTableKey
    const table = key && Object.hasOwn(tables, key) ? tables[key] : undefined
    if (!table) return Response.json({ error: 'Unknown report table' }, { status: 400 })
    if ('managerOnly' in table && table.managerOnly && !hasRole(req.user, ['owner', 'manager'])) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const columns = (table.columns as Column<unknown>[]).map(
      (c): CsvColumn<unknown> => ({ header: c.header, value: (row) => csvValue(c.kind, c.value(row)) }),
    )
    const csv = toCsv(table.rows as unknown[], columns)

    await req.payload.create({
      collection: 'activity-logs',
      data: { user: req.user!.id, action: 'export', targetCollection: 'reports', summary: `Exported ${table.title} (${range.label})` },
      req,
    })

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${reportFileName(key, report)}"`,
        'Cache-Control': 'no-store',
      },
    })
  },
}

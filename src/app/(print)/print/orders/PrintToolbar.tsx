'use client'

export function PrintToolbar({ count, label }: { count: number; label: string }) {
  return (
    <div className="toolbar">
      <span>
        {count} {label}
      </span>
      <button type="button" onClick={() => window.print()} disabled={!count}>
        Print
      </button>
    </div>
  )
}

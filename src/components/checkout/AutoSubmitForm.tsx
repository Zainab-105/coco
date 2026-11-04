'use client'

import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/Button'

/** Posts the signed payment request to the gateway. Falls back to a button if scripts are slow. */
export function AutoSubmitForm({ action, fields, label }: { action: string; fields: Record<string, string>; label: string }) {
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const t = setTimeout(() => ref.current?.submit(), 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <form ref={ref} method="POST" action={action} className="mt-8">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" size="lg">
        {label}
      </Button>
    </form>
  )
}

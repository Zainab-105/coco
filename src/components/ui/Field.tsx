import type { ComponentProps, ReactNode } from 'react'
import { useId } from 'react'

import { cn } from '@/lib/cn'

const control =
  'w-full min-h-12 border border-blush-200 bg-white px-4 text-base text-ink placeholder:text-muted/70 transition-colors focus:border-burgundy-700 focus:outline-none aria-[invalid=true]:border-danger'

type FieldShellProps = { label: string; hint?: ReactNode; error?: string; className?: string; id?: string }

/** Label + control + hint/error, wired with matching ids for screen readers. */
function FieldShell({
  label,
  hint,
  error,
  className,
  id: providedId,
  children,
}: FieldShellProps & { children: (ids: { id: string; describedBy?: string }) => ReactNode }) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const describedBy = error || hint ? `${id}-desc` : undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-xs uppercase tracking-[0.16em] text-muted">
        {label}
      </label>
      {children({ id, describedBy })}
      {(error || hint) && (
        <p id={describedBy} className={cn('text-xs', error ? 'text-danger' : 'text-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function TextField({ label, hint, error, className, id, ...props }: FieldShellProps & ComponentProps<'input'>) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className} id={id}>
      {({ id, describedBy }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={Boolean(error)} className={control} {...props} />
      )}
    </FieldShell>
  )
}

export function TextAreaField({ label, hint, error, className, id, ...props }: FieldShellProps & ComponentProps<'textarea'>) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className} id={id}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className={cn(control, 'min-h-24 py-3')}
          {...props}
        />
      )}
    </FieldShell>
  )
}

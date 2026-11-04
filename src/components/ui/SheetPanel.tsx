'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export type SheetSide = 'left' | 'right' | 'center' | 'top'

const panel: Record<SheetSide, string> = {
  top: 'inset-x-0 top-0 max-h-[85dvh] animate-fade-in',
  right: 'inset-y-0 right-0 w-[min(100vw,420px)] animate-slide-in-right',
  left: 'inset-y-0 left-0 w-[min(88vw,360px)] animate-slide-in-left',
  center:
    'inset-x-0 bottom-0 max-h-[92dvh] animate-pop-in sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(92vw,960px)] sm:-translate-x-1/2 sm:-translate-y-1/2',
}

export type SheetPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: SheetSide
  title: string
  hideTitle?: boolean
  footer?: ReactNode
  children: ReactNode
  className?: string
}

/** The dialog itself. Loaded only when a sheet is first used; see Sheet.tsx. */
export default function SheetPanel({ open, onOpenChange, side = 'right', title, hideTitle, footer, children, className }: SheetPanelProps) {
  // Whatever opened the sheet gets focus back on close, for keyboard and screen reader users.
  const returnFocus = useRef(typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null))

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/40 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus.current?.focus()
          }}
          className={cn('fixed z-50 flex flex-col bg-cream-50 shadow-drawer focus:outline-none', panel[side], className)}
        >
          <div className={cn('flex items-center justify-between border-b border-blush-200 px-5 py-3', hideTitle && 'sr-only')}>
            <Dialog.Title className="font-display text-xl text-burgundy-700">{title}</Dialog.Title>
            <Dialog.Close className="-mr-2 flex size-11 items-center justify-center hover:text-burgundy-700" aria-label="Close">
              <X size={20} />
            </Dialog.Close>
          </div>
          {hideTitle && (
            <Dialog.Close
              className="absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-full bg-cream-50/90 hover:text-burgundy-700"
              aria-label="Close"
            >
              <X size={20} />
            </Dialog.Close>
          )}
          <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {footer && <div className="border-t border-blush-200 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

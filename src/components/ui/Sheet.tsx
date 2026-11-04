'use client'

import dynamic from 'next/dynamic'
import { cloneElement, isValidElement, useEffect, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react'

import type { SheetSide } from './SheetPanel'

const SheetPanel = dynamic(() => import('./SheetPanel'), { ssr: false })

/** Fetch the dialog code when the browser is idle, so the first tap opens without a wait. */
let preloaded = false
function preloadPanel() {
  if (preloaded) return
  preloaded = true
  const load = () => void import('./SheetPanel').catch(() => undefined)
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 4000 })
  else setTimeout(load, 2500)
}

/**
 * Accessible overlay panel (focus trap, Esc to close, scroll lock) used for the cart drawer, mobile
 * menu and Quick View. `center` is a bottom sheet on mobile and a modal on desktop.
 * Every page has closed sheets, so the dialog code stays out of the first page load.
 */
export function Sheet({
  open: controlledOpen,
  onOpenChange,
  side = 'right',
  title,
  hideTitle,
  trigger,
  footer,
  children,
  className,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: SheetSide
  title: string
  hideTitle?: boolean
  trigger?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = controlledOpen ?? ownOpen
  const setOpen = (next: boolean) => {
    setOwnOpen(next)
    onOpenChange?.(next)
  }

  useEffect(preloadPanel, [])

  const button = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<{ onClick?: (e: MouseEvent) => void; 'aria-haspopup'?: string; 'aria-expanded'?: boolean }>, {
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        onClick: (event: MouseEvent) => {
          ;(trigger as ReactElement<{ onClick?: (e: MouseEvent) => void }>).props.onClick?.(event)
          setOpen(true)
        },
      })
    : trigger

  return (
    <>
      {button}
      {open && (
        <SheetPanel open onOpenChange={setOpen} side={side} title={title} hideTitle={hideTitle} footer={footer} className={className}>
          {children}
        </SheetPanel>
      )}
    </>
  )
}

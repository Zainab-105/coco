import Link from 'next/link'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'whatsapp'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const base =
  'inline-flex items-center justify-center gap-2 font-sans uppercase tracking-[0.18em] transition-colors disabled:pointer-events-none disabled:opacity-50 select-none'

const variants: Record<Variant, string> = {
  primary: 'bg-burgundy-700 text-cream-50 hover:bg-burgundy-900',
  secondary: 'bg-blush-200 text-burgundy-900 hover:bg-rose-400 hover:text-cream-50',
  outline: 'border border-burgundy-700 text-burgundy-700 hover:bg-burgundy-700 hover:text-cream-50',
  ghost: 'text-ink hover:bg-nude-100',
  whatsapp: 'bg-[#1f8f4e] text-white hover:bg-[#17733e]',
}

// Every size keeps a 44px minimum touch target on mobile.
const sizes: Record<Size, string> = {
  sm: 'min-h-11 px-4 text-[11px]',
  md: 'min-h-12 px-6 text-xs',
  lg: 'min-h-14 px-8 text-sm',
  icon: 'size-11 rounded-full tracking-normal',
}

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  block,
  className,
}: { variant?: Variant; size?: Size; block?: boolean; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], block && 'w-full', className)
}

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; size?: Size; block?: boolean }

export function Button({ variant, size, block, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, block, className })} {...props} />
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean }

export function ButtonLink({ variant, size, block, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, block, className })} {...props} />
}

import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge about the brand colour scale so `bg-burgundy-700` overrides `bg-cream-50`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        'burgundy-900',
        'burgundy-700',
        'burgundy-500',
        'rose-400',
        'blush-200',
        'nude-100',
        'cream-50',
        'gold-500',
        'ink',
        'muted',
        'success',
        'danger',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

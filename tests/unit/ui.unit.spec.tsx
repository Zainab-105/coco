import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProductCard } from '@/components/product/ProductCard'
import type { ProductCardData } from '@/components/product/types'
import { Price } from '@/components/ui/Price'
import { stockLevel } from '@/components/ui/StockStatus'

// Embla needs layout APIs jsdom lacks; the card's behaviour, not the carousel engine, is under test here.
vi.mock('embla-carousel-react', () => ({ default: () => [() => {}, undefined] }))

class IO {
  observe() {}
  disconnect() {}
}
globalThis.IntersectionObserver = IO as unknown as typeof IntersectionObserver

afterEach(cleanup)

const product: ProductCardData = {
  id: 'p1',
  slug: 'hanging-car-diffuser',
  title: 'Hanging Car Diffuser',
  price: 1450,
  salePrice: 1199,
  stock: 'in_stock',
  requiresOption: true,
  media: [
    { type: 'image', src: '/mock/a.webp', alt: 'A' },
    { type: 'image', src: '/mock/b.webp', alt: 'B' },
  ],
}

describe('Price', () => {
  it('shows sale and original price', () => {
    render(<Price price={1450} salePrice={1199} />)
    expect(screen.getByText('Rs 1,199')).toBeTruthy()
    expect(screen.getByText('Rs 1,450')).toBeTruthy()
    expect(screen.getByText('-17%')).toBeTruthy()
  })

  it('shows a single price when not on sale', () => {
    render(<Price price={1450} />)
    expect(screen.queryByText(/%/)).toBeNull()
  })
})

describe('stockLevel', () => {
  it('maps quantities to levels', () => {
    expect(stockLevel(0)).toBe('out_of_stock')
    expect(stockLevel(3, 5)).toBe('low_stock')
    expect(stockLevel(20, 5)).toBe('in_stock')
  })
})

describe('ProductCard', () => {
  it('renders one dot per media item and the discount badge', () => {
    render(<ProductCard product={product} />)
    expect(screen.getAllByRole('button', { name: /Show image/ })).toHaveLength(2)
    expect(screen.getAllByText('-17%').length).toBeGreaterThan(0)
  })

  it('asks for a fragrance instead of adding directly', () => {
    const onQuickAdd = vi.fn()
    render(<ProductCard product={product} onQuickAdd={onQuickAdd} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose fragrance' }))
    expect(onQuickAdd).toHaveBeenCalledWith(product)
  })

  it('disables adding when sold out', () => {
    render(<ProductCard product={{ ...product, stock: 'out_of_stock' }} />)
    expect((screen.getByRole('button', { name: 'Sold out' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

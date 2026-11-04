export const SORTS = {
  featured: { label: 'Featured', sort: ['-featured', '-salesCount'] },
  newest: { label: 'Newest', sort: ['-createdAt'] },
  'price-asc': { label: 'Price: low to high', sort: ['effectivePrice'] },
  'price-desc': { label: 'Price: high to low', sort: ['-effectivePrice'] },
  bestselling: { label: 'Best selling', sort: ['-salesCount'] },
} as const
export type SortKey = keyof typeof SORTS

/** URL search params <-> listing filters. Kept pure so filters stay shareable and indexable. */
export type FilterState = {
  sort: SortKey
  fragrances: string[]
  price?: string
  inStock: boolean
  page: number
}

export const PRICE_RANGES = [
  { key: 'under-1500', label: 'Under Rs 1,500', min: undefined, max: 1499 },
  { key: '1500-3000', label: 'Rs 1,500 - 3,000', min: 1500, max: 3000 },
  { key: '3000-5000', label: 'Rs 3,000 - 5,000', min: 3001, max: 5000 },
  { key: 'over-5000', label: 'Over Rs 5,000', min: 5001, max: undefined },
] as const

type Params = Record<string, string | string[] | undefined>
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function parseFilters(params: Params): FilterState {
  const sort = first(params.sort)
  const page = Number(first(params.page))
  return {
    sort: sort && sort in SORTS ? (sort as SortKey) : 'featured',
    fragrances: (first(params.fragrance) ?? '').split(',').filter(Boolean).slice(0, 10),
    price: PRICE_RANGES.some((r) => r.key === first(params.price)) ? first(params.price) : undefined,
    inStock: first(params.stock) === 'in',
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 20) : 1,
  }
}

export function filtersToSearch(state: Partial<FilterState>): string {
  const params = new URLSearchParams()
  if (state.sort && state.sort !== 'featured') params.set('sort', state.sort)
  if (state.fragrances?.length) params.set('fragrance', state.fragrances.join(','))
  if (state.price) params.set('price', state.price)
  if (state.inStock) params.set('stock', 'in')
  if (state.page && state.page > 1) params.set('page', String(state.page))
  const s = params.toString()
  return s ? `?${s}` : ''
}

export function priceBounds(key?: string) {
  const range = PRICE_RANGES.find((r) => r.key === key)
  return { minPrice: range?.min, maxPrice: range?.max }
}

export const activeFilterCount = (s: FilterState) => s.fragrances.length + (s.price ? 1 : 0) + (s.inStock ? 1 : 0)

'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition, type ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { FragranceSwatch } from '@/components/ui/FragranceChip'
import { Sheet } from '@/components/ui/Sheet'
import { cn } from '@/lib/cn'
import { activeFilterCount, filtersToSearch, PRICE_RANGES, SORTS, type FilterState, type SortKey } from '@/lib/storefront/filters'

export type FragranceFacet = { slug: string; name: string; swatch?: string | null }

/**
 * Sort + filter controls. Every change updates the URL (shareable, crawlable) and the server
 * re-renders the grid. Mobile: filters in a bottom sheet. Desktop: the same panel in a sidebar.
 */
export function useFilterNavigation(state: FilterState) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  // Controls reflect a change immediately, while the server renders the new results.
  const [current, setCurrent] = useOptimistic(state)
  const update = (patch: Partial<FilterState>) =>
    startTransition(() => {
      const next = { ...current, ...patch, page: 1 }
      setCurrent(next)
      router.push(`${pathname}${filtersToSearch(next)}`, { scroll: false })
    })
  return { update, pending, state: current }
}

export function CollectionToolbar({
  state: serverState,
  total,
  fragrances,
}: {
  state: FilterState
  total: number
  fragrances: FragranceFacet[]
}) {
  const { update, pending, state } = useFilterNavigation(serverState)
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(state)

  return (
    <>
      <div className="sticky top-16 z-20 -mx-4 flex items-center gap-3 border-y border-blush-200 bg-cream-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-20 lg:mx-0 lg:border-x-0 lg:px-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 items-center gap-2 text-xs uppercase tracking-[0.18em] lg:hidden"
        >
          <SlidersHorizontal size={16} /> Filter{count > 0 && ` (${count})`}
        </button>
        <p className={cn('text-xs text-muted transition-opacity', pending && 'opacity-50')} aria-live="polite">
          {total} {total === 1 ? 'product' : 'products'}
        </p>
        <label className="ml-auto flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
          <span className="hidden sm:inline">Sort</span>
          <select
            value={state.sort}
            onChange={(e) => update({ sort: e.target.value as SortKey })}
            className="min-h-11 cursor-pointer bg-transparent pr-1 text-xs uppercase tracking-[0.12em] outline-none"
            aria-label="Sort products"
          >
            {Object.entries(SORTS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {count > 0 && <ActiveFilters state={state} fragrances={fragrances} onUpdate={update} />}

      <Sheet
        open={open}
        onOpenChange={setOpen}
        side="center"
        title="Filter"
        footer={
          <Button block onClick={() => setOpen(false)}>
            Show {total} {total === 1 ? 'product' : 'products'}
          </Button>
        }
      >
        <div className={cn('p-5 transition-opacity', pending && 'opacity-70')}>
          <FilterPanel state={state} fragrances={fragrances} onUpdate={update} />
        </div>
      </Sheet>
    </>
  )
}

function ActiveFilters({
  state,
  fragrances,
  onUpdate,
}: {
  state: FilterState
  fragrances: FragranceFacet[]
  onUpdate: (patch: Partial<FilterState>) => void
}) {
  const chips: { label: string; remove: () => void }[] = [
    ...state.fragrances.map((slug) => ({
      label: fragrances.find((f) => f.slug === slug)?.name ?? slug,
      remove: () => onUpdate({ fragrances: state.fragrances.filter((s) => s !== slug) }),
    })),
    ...(state.price
      ? [{ label: PRICE_RANGES.find((r) => r.key === state.price)?.label ?? '', remove: () => onUpdate({ price: undefined }) }]
      : []),
    ...(state.inStock ? [{ label: 'In stock', remove: () => onUpdate({ inStock: false }) }] : []),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={chip.remove}
          className="flex min-h-9 items-center gap-1.5 bg-nude-100 px-3 text-xs"
          aria-label={`Remove filter ${chip.label}`}
        >
          {chip.label} <X size={12} />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onUpdate({ fragrances: [], price: undefined, inStock: false })}
        className="min-h-9 px-2 text-xs underline underline-offset-4"
      >
        Clear all
      </button>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-blush-200 py-5 first:pt-0">
      {/* Floated legend sits inside the padding box instead of on the border line. */}
      <legend className="float-left mb-3 w-full text-xs uppercase tracking-[0.2em] text-muted">{title}</legend>
      <div className="clear-left">{children}</div>
    </fieldset>
  )
}

export function FilterPanel({
  state,
  fragrances,
  onUpdate,
}: {
  state: FilterState
  fragrances: FragranceFacet[]
  onUpdate: (patch: Partial<FilterState>) => void
}) {
  const toggleFragrance = (slug: string) =>
    onUpdate({
      fragrances: state.fragrances.includes(slug) ? state.fragrances.filter((s) => s !== slug) : [...state.fragrances, slug],
    })

  return (
    <div>
      {fragrances.length > 0 && (
        <Group title="Fragrance">
          <ul className="space-y-1">
            {fragrances.map((f) => (
              <li key={f.slug}>
                <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={state.fragrances.includes(f.slug)}
                    onChange={() => toggleFragrance(f.slug)}
                    className="size-4 accent-burgundy-700"
                  />
                  <FragranceSwatch color={f.swatch} />
                  {f.name}
                </label>
              </li>
            ))}
          </ul>
        </Group>
      )}
      <Group title="Price">
        <ul className="space-y-1">
          {PRICE_RANGES.map((r) => (
            <li key={r.key}>
              <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="price"
                  checked={state.price === r.key}
                  onChange={() => onUpdate({ price: r.key })}
                  className="size-4 accent-burgundy-700"
                />
                {r.label}
              </label>
            </li>
          ))}
        </ul>
        {state.price && (
          <button type="button" onClick={() => onUpdate({ price: undefined })} className="mt-2 text-xs underline underline-offset-4">
            Any price
          </button>
        )}
      </Group>
      <Group title="Availability">
        <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={state.inStock}
            onChange={() => onUpdate({ inStock: !state.inStock })}
            className="size-4 accent-burgundy-700"
          />
          In stock only
        </label>
      </Group>
    </div>
  )
}

/** Desktop sidebar: same panel, always visible. */
export function FilterSidebar({ state, fragrances }: { state: FilterState; fragrances: FragranceFacet[] }) {
  const nav = useFilterNavigation(state)
  return <FilterPanel state={nav.state} fragrances={fragrances} onUpdate={nav.update} />
}

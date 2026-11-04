'use client'

import { Search } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { SearchSuggestion } from '@/app/(payload)/api/storefront/search/route'
import { Sheet } from '@/components/ui/Sheet'
import { formatPKR } from '@/lib/format'

const popular = ['Sweet Rose', 'Vanilla Oud', 'Gift set', 'Room diffuser']

/** Header search with live suggestions (debounced). Enter goes to the full results page. */
export function SearchSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchSuggestion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/storefront/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        if (res.ok) setResults(await res.json())
      } catch {
        // Aborted or offline: keep previous suggestions.
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }
  const hasQuery = query.trim().length >= 2

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="top" title="Search">
      <div className="mx-auto max-w-3xl p-5">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (hasQuery) go(`/search?q=${encodeURIComponent(query.trim())}`)
          }}
          className="flex items-center gap-3 border-b-2 border-burgundy-700 pb-2"
        >
          <Search size={20} className="text-muted" aria-hidden />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scents, diffusers, gift sets..."
            aria-label="Search products"
            className="min-h-11 flex-1 bg-transparent text-lg outline-none placeholder:text-muted/70 [&::-webkit-search-cancel-button]:hidden"
          />
        </form>

        {!hasQuery && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Popular</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {popular.map((term) => (
                <li key={term}>
                  <button type="button" onClick={() => setQuery(term)} className="min-h-10 border border-blush-200 px-4 text-sm hover:border-burgundy-500">
                    {term}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasQuery && (
          <div className="mt-4" aria-live="polite">
            {results.length === 0 && !loading ? (
              <p className="py-6 text-sm text-muted">No products match &quot;{query.trim()}&quot;.</p>
            ) : (
              <ul className="divide-y divide-blush-200">
                {results.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/products/${r.slug}`} onClick={() => onOpenChange(false)} className="flex items-center gap-4 py-3 hover:bg-nude-100/60">
                      <span className="relative aspect-[4/5] w-12 shrink-0 bg-nude-100">
                        {r.image && <Image src={r.image} alt="" fill sizes="48px" className="object-cover" />}
                      </span>
                      <span className="flex-1">
                        <span className="block font-display text-lg leading-tight">{r.title}</span>
                        {r.subtitle && <span className="text-xs text-muted">{r.subtitle}</span>}
                      </span>
                      <span className="text-sm">{formatPKR(r.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {results.length > 0 && (
              <button
                type="button"
                onClick={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}
                className="mt-4 text-sm text-burgundy-700 underline underline-offset-4"
              >
                See all results for &quot;{query.trim()}&quot;
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}

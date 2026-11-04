import { getProductCardsByIds } from '@/lib/storefront/catalog'

/** Product cards for ids saved on the device (wishlist, recently viewed). Published products only. */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 50)
  const products = await getProductCardsByIds(ids)
  return Response.json(products, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
}

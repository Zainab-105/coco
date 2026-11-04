'use client'

import { useRecentlyViewed } from '@/lib/stores/lists'

import { RecentlyViewedRow } from './SavedProducts'

export function RecentlyViewed({ excludeId }: { excludeId?: number }) {
  return <RecentlyViewedRow ids={useRecentlyViewed()} excludeId={excludeId} />
}

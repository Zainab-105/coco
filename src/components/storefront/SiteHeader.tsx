import { getNavCategories, getStorefrontSettings } from '@/lib/storefront/data'

import { AnnouncementBar } from './AnnouncementBar'
import { HeaderBar } from './HeaderBar'

export async function SiteHeader() {
  const [nav, settings] = await Promise.all([getNavCategories(), getStorefrontSettings()])

  return (
    <>
      {settings.announcement && <AnnouncementBar message={settings.announcement} />}
      <HeaderBar nav={nav} whatsappNumber={settings.whatsappNumber} />
    </>
  )
}

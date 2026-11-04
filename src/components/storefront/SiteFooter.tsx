import { Mail, Phone } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { CookieSettingsLink } from '@/components/analytics/Analytics'
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/components/ui/BrandIcons'
import { whatsappLink } from '@/lib/format'
import { getNavCategories, getStorefrontSettings } from '@/lib/storefront/data'

import { NewsletterForm } from './NewsletterForm'

const help = [
  ['/track-order', 'Track your order'],
  ['/pages/shipping', 'Shipping & delivery'],
  ['/pages/returns', 'Returns & exchanges'],
  ['/faq', 'FAQs'],
  ['/contact', 'Contact us'],
]

const legal = [
  ['/pages/privacy', 'Privacy policy'],
  ['/pages/terms', 'Terms of service'],
]

export async function SiteFooter() {
  const [settings, nav] = await Promise.all([getStorefrontSettings(), getNavCategories()])
  const socials = [
    { href: settings.social.instagram, label: 'Instagram', Icon: InstagramIcon },
    { href: settings.social.facebook, label: 'Facebook', Icon: FacebookIcon },
    { href: settings.social.tiktok, label: 'TikTok', Icon: TikTokIcon },
  ].filter((s) => s.href)

  return (
    <footer className="relative mt-24 overflow-hidden bg-burgundy-700 text-nude-100">
      <svg aria-hidden viewBox="0 0 1440 60" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-6 w-full text-cream-50">
        <path fill="currentColor" d="M0 0h1440v20c-240 30-480 40-720 20S240 0 0 30Z" />
      </svg>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-16 pb-28 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:pb-12">
        <div>
          <Image src="/brand/coco-wordmark.png" alt="COCO" width={217} height={47} className="h-7 w-auto brightness-0 invert" />
          <p className="mt-3 text-xs tracking-[0.2em] uppercase opacity-80">Car Scents | Room Diffusers | Accessories</p>
          <p className="mt-4 font-display text-xl italic">{settings.tagline}</p>
          {socials.length > 0 && (
            <ul className="mt-5 flex gap-2">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex size-11 items-center justify-center rounded-full ring-1 ring-nude-100/30 hover:bg-burgundy-900">
                    <Icon size={18} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <FooterList title="Shop" links={nav.map((n) => [`/collections/${n.slug}`, n.title])} />
        <FooterList title="Help" links={help} />
        <div>
          <h2 className="font-sans text-xs tracking-[0.25em] uppercase">Get in touch</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {settings.whatsappNumber && (
              <li>
                <a href={whatsappLink(settings.whatsappNumber)} className="flex items-center gap-2 hover:underline" target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon size={16} /> WhatsApp us
                </a>
              </li>
            )}
            {settings.supportPhone && (
              <li>
                <a href={`tel:${settings.supportPhone}`} className="flex items-center gap-2 hover:underline">
                  <Phone size={16} /> {settings.supportPhone}
                </a>
              </li>
            )}
            {settings.supportEmail && (
              <li>
                <a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-2 hover:underline">
                  <Mail size={16} /> {settings.supportEmail}
                </a>
              </li>
            )}
          </ul>
          <h2 className="mt-8 font-sans text-xs tracking-[0.25em] uppercase">Newsletter</h2>
          <NewsletterForm />
          <p className="mt-6 text-xs opacity-80">Cash on Delivery | JazzCash | Easypaisa</p>
        </div>
      </div>
      <div className="border-t border-nude-100/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 pb-24 text-xs opacity-80 sm:flex-row sm:justify-between sm:px-6 lg:pb-5">
          <p>&copy; {new Date().getFullYear()} {settings.storeName}. All rights reserved.</p>
          <ul className="flex gap-4">
            {legal.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="hover:underline">
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsLink />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}

function FooterList({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <h2 className="font-sans text-xs tracking-[0.25em] uppercase">{title}</h2>
      <ul className="mt-4 space-y-1 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="inline-block py-1.5 hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

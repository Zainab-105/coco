import { WhatsAppIcon } from '@/components/ui/BrandIcons'
import { whatsappLink } from '@/lib/format'

/** Floating help button. Sits above the mobile tab bar. */
export function WhatsAppButton({ number }: { number?: string }) {
  if (!number) return null

  return (
    <a
      href={whatsappLink(number, 'Hi COCO, I have a question.')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with COCO on WhatsApp"
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex size-13 items-center justify-center rounded-full bg-[#1f8f4e] text-white shadow-drawer transition-transform hover:scale-105 lg:bottom-6"
    >
      <WhatsAppIcon size={28} />
    </a>
  )
}

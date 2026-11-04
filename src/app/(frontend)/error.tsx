'use client'

import { Button, ButtonLink } from '@/components/ui/Button'
import { Container } from '@/components/ui/Layout'

export default function StorefrontError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="flex flex-col items-center gap-4 py-28 text-center">
      <h1 className="text-4xl text-burgundy-700">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted">Please try again. If it keeps happening, message us on WhatsApp and we&apos;ll help you order.</p>
      <div className="mt-4 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Home
        </ButtonLink>
      </div>
    </Container>
  )
}

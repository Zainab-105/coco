import { ButtonLink } from '@/components/ui/Button'
import { Container } from '@/components/ui/Layout'

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center gap-4 py-28 text-center">
      <p className="text-[11px] uppercase tracking-[0.4em] text-rose-600">404</p>
      <h1 className="text-4xl text-burgundy-700 sm:text-5xl">This scent has drifted away</h1>
      <p className="max-w-md text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist or is no longer available.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/collections">Shop all</ButtonLink>
        <ButtonLink href="/" variant="outline">
          Back home
        </ButtonLink>
      </div>
    </Container>
  )
}

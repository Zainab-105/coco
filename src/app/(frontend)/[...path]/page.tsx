import { redirectOrNotFound } from '@/lib/seo/redirectLookup'

type Props = { params: Promise<{ path: string[] }> }

/** Any address no other page matches: follow a redirect if the admin has one, otherwise 404. */
export default async function UnknownPage({ params }: Props) {
  const { path } = await params
  return redirectOrNotFound(`/${path.join('/')}`)
}

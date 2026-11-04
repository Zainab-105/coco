/**
 * Media audit: lists product images and videos that break the guidelines and would slow the site
 * or look poor. Read-only. Run before launch and after big catalogue updates: npm run audit:media
 */
import config from '@payload-config'
import { getPayload } from 'payload'

const MB = 1024 * 1024
const MIN_WIDTH = 1600
const MAX_IMAGE = 2 * MB
const MAX_VIDEO = 1.5 * MB

const payload = await getPayload({ config })
const { docs } = await payload.find({ collection: 'media', pagination: false, depth: 0 })
const { docs: products } = await payload.find({
  collection: 'products',
  where: { status: { equals: 'published' } },
  pagination: false,
  depth: 0,
  select: { title: true, gallery: true },
})

const problems: string[] = []
for (const m of docs) {
  const name = m.filename ?? `media ${m.id}`
  const size = m.filesize ?? 0
  if (m.kind === 'video') {
    if (size > MAX_VIDEO) problems.push(`${name}: video is ${(size / MB).toFixed(1)} MB (aim for under 1.5 MB)`)
    if (!m.poster) problems.push(`${name}: video has no poster image`)
  }
  if (m.kind === 'image') {
    if (size > MAX_IMAGE) problems.push(`${name}: image is ${(size / MB).toFixed(1)} MB (aim for under 2 MB)`)
    if ((m.width ?? 0) < MIN_WIDTH) problems.push(`${name}: only ${m.width} px wide (needs ${MIN_WIDTH} px for zoom)`)
    if (!m.alt?.trim()) problems.push(`${name}: no description (alt text)`)
  }
}
for (const p of products) {
  if (!p.gallery?.length) problems.push(`Product "${p.title}" has no images`)
}

console.log(`Checked ${docs.length} media files and ${products.length} live products.`)
console.log(problems.length ? problems.map((p) => `- ${p}`).join('\n') : 'No problems found.')
console.log(`${problems.length} problems.`)
process.exit(0)

/** Human-friendly, non-sequential order number, e.g. COCO-261030-4F7K. */
export function generateOrderNumber(date = new Date()): string {
  const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, '')
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `COCO-${yymmdd}-${suffix}`
}

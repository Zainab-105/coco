/** "Rs 1,250". Prices are whole PKR. */
export function formatPKR(value: number): string {
  return `Rs ${Math.round(value).toLocaleString('en-PK')}`
}

/** wa.me deep link with an optional pre-filled message. */
export function whatsappLink(number: string, message?: string): string {
  const digits = number.replace(/[^\d]/g, '')
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${digits}${text}`
}

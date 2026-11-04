/**
 * Normalises Pakistani mobile numbers to E.164 (+923XXXXXXXXX) so that the
 * same customer is matched regardless of how they typed their number.
 * Returns null when the input is not a valid PK mobile number.
 */
export function normalizePkPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '')

  let local: string | null = null
  if (/^03\d{9}$/.test(digits)) local = digits.slice(1)
  else if (/^923\d{9}$/.test(digits)) local = digits.slice(2)
  else if (/^00923\d{9}$/.test(digits)) local = digits.slice(4)
  else if (/^3\d{9}$/.test(digits)) local = digits

  return local ? `+92${local}` : null
}

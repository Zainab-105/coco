import type { InputHTMLAttributes } from 'react'

/**
 * Trap for bots: hidden from people and screen readers. Keep the wording and name free of words
 * like "company" or "website": browsers and password managers autofill those, even when hidden
 * and with autoComplete off, which made real customers look like bots.
 */
export function Honeypot(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
      <label>
        Leave this field empty
        <input tabIndex={-1} autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other" {...props} />
      </label>
    </div>
  )
}

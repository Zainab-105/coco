'use client'

import { ImagePlus, X } from 'lucide-react'
import { useRef } from 'react'

import { UPLOAD_ACCEPT, UPLOAD_LIMITS } from '@/lib/support/uploads'

/** Photo and video attachments with early size checks. The server checks everything again. */
export function FilePicker({
  files,
  onChange,
  error,
  onError,
}: {
  files: File[]
  onChange: (files: File[]) => void
  error?: string
  onError: (message: string | undefined) => void
}) {
  const input = useRef<HTMLInputElement>(null)

  const add = (picked: FileList | null) => {
    const next = [...files, ...Array.from(picked ?? [])]
    if (input.current) input.current.value = ''
    const tooBig = next.find((f) => f.size > (f.type.startsWith('video/') ? UPLOAD_LIMITS.video : UPLOAD_LIMITS.image))
    if (next.length > UPLOAD_LIMITS.files) return onError(`Please attach up to ${UPLOAD_LIMITS.files} files.`)
    if (tooBig) return onError(`${tooBig.name} is too large. Photos can be up to 8 MB and videos up to 25 MB.`)
    onError(undefined)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <input ref={input} id="support-files" type="file" multiple accept={UPLOAD_ACCEPT} className="sr-only" onChange={(e) => add(e.target.files)} />
      <label htmlFor="support-files" className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-blush-200 bg-white px-4 text-sm">
        <ImagePlus size={16} /> Add photos or videos (optional)
      </label>
      {files.length > 0 && (
        <ul className="space-y-1 text-xs">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 bg-nude-100/60 px-3 py-1.5">
              <span className="truncate">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} className="flex size-8 shrink-0 items-center justify-center" onClick={() => onChange(files.filter((_, n) => n !== i))}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={error ? 'text-xs text-danger' : 'text-xs text-muted'} aria-live="polite">
        {error ?? 'Up to 4 files. Photos up to 8 MB, videos up to 25 MB.'}
      </p>
    </div>
  )
}

/** Posts a form with its files and returns the server's answer, including network failures. */
export async function postForm(url: string, fields: Record<string, string>, files: File[]) {
  const body = new FormData()
  for (const [key, value] of Object.entries(fields)) body.set(key, value)
  for (const file of files) body.append('files', file)
  try {
    const res = await fetch(url, { method: 'POST', body })
    return (await res.json()) as { ok: boolean; reference?: number; errors?: Record<string, string> }
  } catch {
    return { ok: false, errors: { form: 'We could not send this. Check your connection and try again.' } }
  }
}

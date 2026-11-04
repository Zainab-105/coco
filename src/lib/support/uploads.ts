/** Rules for files customers attach to reviews and support messages. */
const MB = 1024 * 1024

export const UPLOAD_LIMITS = { image: 8 * MB, video: 25 * MB, files: 4, totalBytes: 40 * MB }

export const UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm'

export type UploadKind = 'image' | 'video'
export type SniffedUpload = { kind: UploadKind; mimeType: string; extension: string }

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))

/** Identifies a file from its first bytes. The browser's filename and type are never trusted. */
export function sniffUpload(bytes: Uint8Array): SniffedUpload | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: 'image', mimeType: 'image/jpeg', extension: 'jpg' }
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') return { kind: 'image', mimeType: 'image/png', extension: 'png' }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return { kind: 'image', mimeType: 'image/webp', extension: 'webp' }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { kind: 'video', mimeType: 'video/webm', extension: 'webm' }
  // ISO media: mp4 brands only. "qt  " is an iPhone .mov, which most Android browsers cannot play.
  if (ascii(bytes, 4, 8) === 'ftyp' && ascii(bytes, 8, 10) !== 'qt') return { kind: 'video', mimeType: 'video/mp4', extension: 'mp4' }
  return null
}

/** Checks count, type and size. Returns a message for the customer, or null when acceptable. */
export function uploadProblem(files: { size: number; bytes: Uint8Array }[]): string | null {
  if (files.length > UPLOAD_LIMITS.files) return `Please attach up to ${UPLOAD_LIMITS.files} files.`
  if (files.reduce((s, f) => s + f.size, 0) > UPLOAD_LIMITS.totalBytes) return 'These files are too large together. Please send fewer or smaller ones.'
  for (const file of files) {
    const type = sniffUpload(file.bytes)
    if (!type) return 'Please attach JPG, PNG or WebP photos, or MP4 or WebM videos.'
    if (file.size > UPLOAD_LIMITS[type.kind]) {
      return type.kind === 'image' ? 'Each photo must be under 8 MB.' : 'Each video must be under 25 MB.'
    }
  }
  return null
}

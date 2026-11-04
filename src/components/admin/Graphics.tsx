/* eslint-disable @next/next/no-img-element -- admin graphics render outside next/image's config */

/** Login screen logo. */
export function AdminLogo() {
  return <img src="/brand/coco-logo-full.png" alt="COCO" style={{ height: 120, width: 'auto' }} />
}

/** Small mark in the admin nav. */
export function AdminIcon() {
  return <img src="/brand/coco-mark.png" alt="COCO" style={{ height: 28, width: 'auto' }} />
}

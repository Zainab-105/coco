export function AnnouncementBar({ message }: { message: string }) {
  return (
    <div className="bg-burgundy-700 px-4 py-2 text-center text-[11px] tracking-[0.18em] text-nude-100 uppercase">
      {message}
    </div>
  )
}

/** Small filament-spool mark: wound filament ring, hub, and a free strand. */
export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <circle cx="16" cy="16" r="13" fill="#F47721" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="#171B19" strokeOpacity=".35" strokeWidth="1" />
      <circle cx="16" cy="16" r="6.5" fill="none" stroke="#171B19" strokeOpacity=".35" strokeWidth="1" />
      <circle cx="16" cy="16" r="3.4" fill="#F5F0E8" />
      <circle cx="16" cy="16" r="1.4" fill="#171B19" />
      <path d="M27.5 21.5c2 .9 2.6 2.8 1.2 4.1" fill="none" stroke="#F47721" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

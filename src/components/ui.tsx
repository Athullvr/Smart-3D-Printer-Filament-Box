import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export function Card({ title, subtitle, action, children, id, className = '' }: {
  title: string; subtitle?: string; action?: ReactNode; children: ReactNode; id?: string; className?: string
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`rounded-md border border-line bg-paper shadow-[0_1px_0_rgba(32,37,34,0.05)] ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="font-display text-xl font-semibold leading-tight text-graphite">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-ink">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const variants: Record<Variant, string> = {
  primary: 'bg-filament text-graphite hover:bg-[#ff8a3d] font-semibold',
  secondary: 'border border-graphite/30 bg-paper text-graphite hover:bg-ivory',
  danger: 'bg-danger-ink text-paper hover:bg-[#962a23] font-semibold',
  ghost: 'text-graphite hover:bg-ivory',
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
    />
  )
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'safe' | 'warn' | 'breach' | 'sensor' }) {
  const tones = {
    neutral: 'border-line bg-paper text-muted-ink',
    safe: 'border-safe/50 bg-safe-tint text-safe-ink',
    warn: 'border-filament/60 bg-filament-tint text-filament-ink',
    breach: 'border-danger/50 bg-danger-tint text-danger-ink',
    sensor: 'border-graphite bg-graphite text-ivory',
  }
  return <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-semibold tracking-wide ${tones[tone]}`}>{children}</span>
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    const focusables = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return cancelRef.current()
      if (e.key !== 'Tab') return
      const f = focusables()
      const first = f[0], last = f[f.length - 1]
      if (!first || !last) return
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      else if (!root?.contains(document.activeElement)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-graphite/70 p-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc" className="max-h-full w-full max-w-sm overflow-y-auto rounded-md border border-graphite bg-paper p-5 shadow-xl">
        <h2 id="confirm-title" className="font-display text-xl font-semibold">{title}</h2>
        <p id="confirm-desc" className="mt-2 text-sm text-muted-ink">{message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

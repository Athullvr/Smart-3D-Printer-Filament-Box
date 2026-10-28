import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Card({ title, subtitle, action, children, id, className = '' }: {
  title: string; subtitle?: string; action?: ReactNode; children: ReactNode; id?: string; className?: string
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`rounded-lg border border-ink-700 bg-ink-850 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-700 px-4 py-3">
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="text-sm font-semibold tracking-wide text-slate-100">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const variants: Record<Variant, string> = {
  primary: 'bg-sensor text-ink-950 hover:bg-cyan-300',
  secondary: 'border border-ink-600 bg-ink-800 text-slate-100 hover:bg-ink-700',
  danger: 'bg-breach text-ink-950 hover:bg-rose-300',
  ghost: 'text-slate-300 hover:bg-ink-800',
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  )
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'safe' | 'warn' | 'breach' | 'sensor' }) {
  const tones = {
    neutral: 'border-ink-600 text-slate-300',
    safe: 'border-safe/40 bg-safe/10 text-safe',
    warn: 'border-warn/40 bg-warn/10 text-warn',
    breach: 'border-breach/40 bg-breach/10 text-breach',
    sensor: 'border-sensor/40 bg-sensor/10 text-sensor',
  }
  return <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-sm rounded-lg border border-ink-600 bg-ink-850 p-5">
        <h2 id="confirm-title" className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel} autoFocus>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

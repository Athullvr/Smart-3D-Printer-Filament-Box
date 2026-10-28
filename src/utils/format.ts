export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`
  if (m > 0) return `${m}m ${pad(s)}s`
  return `${s}s`
}

export const formatDateTime = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })

export const formatTime = (ts: number): string =>
  new Date(ts).toLocaleTimeString(undefined, { hour12: false })

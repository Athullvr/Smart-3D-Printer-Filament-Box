import { useState } from 'react'
import { MATERIALS, type Material, type Settings } from '../../types'
import { Pill } from '../../components/ui'
import { isValidThreshold, THRESHOLD_MAX, THRESHOLD_MIN } from './defaults'

function ThresholdInput({ material, value, onCommit }: { material: Material; value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? String(value)
  const parsed = text.trim() === '' ? NaN : Number(text)
  const invalid = draft !== null && !isValidThreshold(parsed)
  const errorId = `threshold-error-${material}`

  return (
    <div>
      <div className="flex items-center gap-2">
        <label htmlFor={`threshold-${material}`} className="w-14 text-sm text-slate-300">{material}</label>
        <input id={`threshold-${material}`} type="number" inputMode="decimal" min={THRESHOLD_MIN} max={THRESHOLD_MAX} step={1} value={text}
          aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onBlur={() => {
            if (draft !== null && isValidThreshold(parsed)) onCommit(parsed)
            setDraft(null)
          }}
          className={`w-24 rounded-md border bg-ink-900 px-2 py-1.5 font-mono text-sm ${invalid ? 'border-breach' : 'border-ink-600'}`} />
        <span className="text-sm text-slate-400">% RH</span>
      </div>
      {invalid && <p id={errorId} role="alert" className="mt-1 text-xs text-breach">Enter a number from {THRESHOLD_MIN} to {THRESHOLD_MAX}. Value will not be applied.</p>}
    </div>
  )
}

export function MaterialSettings({ settings, onMaterial, onThreshold }: {
  settings: Settings; onMaterial: (m: Material) => void; onThreshold: (m: Material, v: number) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="material-select" className="mb-1 block text-sm text-slate-300">Stored material</label>
        <select id="material-select" value={settings.material} onChange={(e) => onMaterial(e.target.value as Material)}
          className="w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-2 text-sm">
          {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm text-slate-300">Humidity thresholds</h3>
          <Pill tone="warn">PROVISIONAL</Pill>
        </div>
        <div className="space-y-2">
          {MATERIALS.map((m) => <ThresholdInput key={m} material={m} value={settings.thresholds[m]} onCommit={(v) => onThreshold(m, v)} />)}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Demonstration values only, not universal safety limits. Breach when humidity is strictly greater than the threshold; equal is safe.
          Changing a threshold never alters existing events.
        </p>
      </div>
    </div>
  )
}

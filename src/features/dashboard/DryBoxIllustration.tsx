import type { SystemStatus } from '../../types'

const LABEL: Record<SystemStatus, string> = {
  safe: 'Inside the limit',
  breach: 'Over the limit',
  unavailable: 'Reading unavailable',
  'no-data': 'Awaiting first reading',
}

/**
 * Schematic (not a photograph, not a rendering of the real prototype) of a filament dry box:
 * lid, front window, spool on a spindle, desiccant tray, and a sensor puck whose indicator
 * changes SHAPE as well as colour (tick = inside limit, exclamation = over limit, dashes = unavailable).
 */
export function DryBoxIllustration({ status, material, threshold, hardware }: { status: SystemStatus; material: string; threshold: number; hardware: boolean }) {
  const led = status === 'safe' ? '#3D9865' : status === 'breach' ? '#D94B40' : status === 'unavailable' ? '#F47721' : '#858982'
  const description = `Schematic of a filament dry box holding a spool of ${material} filament. Sensor indicator: ${LABEL[status].toLowerCase()}. Humidity limit ${threshold} percent RH.`
  return (
    <figure className="m-0">
      <svg viewBox="0 0 360 250" role="img" aria-label={description} className="h-auto w-full" data-testid="drybox-illustration" data-status={status}>
        <title>{description}</title>
        <rect x="14" y="10" width="332" height="230" rx="6" fill="none" stroke="#F5F0E8" strokeOpacity=".08" />
        {/* box body */}
        <rect x="48" y="62" width="264" height="156" rx="8" fill="#202522" stroke="#F5F0E8" strokeOpacity=".7" strokeWidth="2" />
        {/* lid + latches */}
        <path d="M40 62 V44 a8 8 0 0 1 8-8 H312 a8 8 0 0 1 8 8 V62 Z" fill="#171B19" stroke="#F5F0E8" strokeOpacity=".7" strokeWidth="2" />
        <rect x="150" y="26" width="60" height="9" rx="4.5" fill="#202522" stroke="#F5F0E8" strokeOpacity=".7" strokeWidth="1.5" />
        <rect x="76" y="58" width="22" height="14" rx="2" fill="#171B19" stroke="#F5F0E8" strokeOpacity=".5" />
        <rect x="262" y="58" width="22" height="14" rx="2" fill="#171B19" stroke="#F5F0E8" strokeOpacity=".5" />
        {/* window */}
        <rect x="62" y="82" width="190" height="110" rx="4" fill="#171B19" stroke="#F5F0E8" strokeOpacity=".35" />
        <path d="M70 92 l36 0 -28 26 -8 0 z" fill="#F5F0E8" fillOpacity=".06" />
        {/* spool */}
        <g transform="translate(157 137)">
          <circle r="44" fill="#F47721" />
          {[38, 32, 26, 20].map((r) => <circle key={r} r={r} fill="none" stroke="#171B19" strokeOpacity=".28" strokeWidth="1.4" />)}
          <circle r="13" fill="#F5F0E8" />
          <circle r="5" fill="#171B19" />
          <path d="M-44 0 A44 44 0 0 1 0 -44" fill="none" stroke="#F5F0E8" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
          <path d="M40 18 C 52 22, 60 34, 52 48" fill="none" stroke="#F47721" strokeWidth="3" strokeLinecap="round" />
        </g>
        {/* desiccant tray */}
        <rect x="62" y="198" width="190" height="12" rx="2" fill="#171B19" stroke="#F5F0E8" strokeOpacity=".35" />
        {Array.from({ length: 13 }, (_, i) => <circle key={i} cx={74 + i * 14} cy="204" r="3" fill="#F5F0E8" fillOpacity=".45" />)}
        {/* sensor puck */}
        <rect x="268" y="96" width="34" height="62" rx="6" fill="#171B19" stroke="#F5F0E8" strokeOpacity=".6" strokeWidth="1.5" />
        <circle cx="285" cy="116" r="11" fill={led} stroke="#F5F0E8" strokeWidth="1.5" strokeDasharray={status === 'unavailable' ? '3 2' : undefined} />
        {status === 'safe' && <path d="M279.5 116.5 l4 4 7-8" fill="none" stroke="#171B19" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        {status === 'breach' && <><path d="M285 109.5 v8" stroke="#171B19" strokeWidth="2.6" strokeLinecap="round" /><circle cx="285" cy="122" r="1.6" fill="#171B19" /></>}
        {status === 'unavailable' && <path d="M279 116 h12" stroke="#171B19" strokeWidth="2.6" strokeLinecap="round" />}
        <rect x="274" y="136" width="22" height="3" rx="1.5" fill="#F5F0E8" fillOpacity=".5" />
        <rect x="274" y="143" width="16" height="3" rx="1.5" fill="#F5F0E8" fillOpacity=".5" />
        {/* moisture marks when over the limit */}
        {status === 'breach' && [92, 118, 144, 170, 196].map((x, i) => (
          <path key={x} d={`M${x} ${88 + (i % 2) * 6} q-3 5 0 8 q3 -3 0 -8`} fill="#D94B40" />
        ))}
      </svg>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#B9BDB4]">
        <span data-testid="drybox-state"><strong className="font-semibold text-ivory">Box check:</strong> {LABEL[status]}</span>
        <span>{material} limit {threshold}% RH (provisional)</span>
        <span className="basis-full text-[#B9BDB4]">Schematic illustration, not a photo of the prototype. {hardware ? 'Hardware mode is mock-tested only.' : 'Values come from the built-in simulator.'}</span>
      </figcaption>
    </figure>
  )
}

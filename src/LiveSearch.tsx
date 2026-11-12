import { useEffect, useState } from 'react'
import type { SearchResult } from './chat'
import { LiquidGlass } from './glass/LiquidGlass'
import { CALL_NUMBER, callNumber } from './api'
import { LocateIcon, PhoneIcon } from './icons'

/**
 * The "calling around" card: counters tick up while the search runs, then the
 * confirmed results slide in one by one. Results are simulated in this
 * prototype, and the card says so.
 */
export type Business = SearchResult['results'][number]

/** Shared look for the small glass buttons on a result card. */
const glass = {
  bezel: 10,
  thickness: 9,
  blur: 0.5,
  aberration: 0.1,
  specular: 1,
  tint: 'rgba(255, 255, 255, 0.3)',
  interactive: true,
} as const

/** Gradient pairs from the app's palette; each business gets one by its name. */
const THUMB_COLORS = [
  ['#14b8a6', '#0e7490'],
  ['#1d9e75', '#14532d'],
  ['#38bdf8', '#1d4ed8'],
  ['#5eead4', '#0f766e'],
  ['#86efac', '#15803d'],
  ['#7dd3fc', '#0e7490'],
]

/** A small tile with the business's initials (demo businesses have no photos). */
function Thumb({ name }: { name: string }) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const [from, to] = THUMB_COLORS[hash % THUMB_COLORS.length]
  const initials = name
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(the|and|of)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
  return (
    <span className="live-thumb" style={{ background: `linear-gradient(140deg, ${from}, ${to})` }} aria-hidden="true">
      {initials}
    </span>
  )
}

function ResultCard({ r, place, onOpenCall }: { r: Business; place: string; onOpenCall: (r: Business) => void }) {

  const call = callNumber
  // Demo businesses have no address, so show the area they'd be in.
  const locate = () => {
    const query = encodeURIComponent(`${place || 'Bengaluru'}, Bengaluru`)
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener')
  }

  return (
    <article className="live-card">
      <div className="live-card-top">
        <Thumb name={r.name} />
        <h4>{r.name}</h4>
        {r.badge && <span className="live-badge">{r.badge}</span>}
      </div>
      <p className="live-meta">
        ★ {r.rating.toFixed(1)} ({r.reviews}) · {r.distance}
      </p>
      <p className="live-price">{r.price}</p>
      <p className="live-detail">{r.detail}</p>
      {/* Aurora's own one-line summary of what this business confirmed. */}
      <div className="live-take">
        <p>{r.takeaway || r.quote}</p>
      </div>


      <div className="live-actions">
        <LiquidGlass
          as="button"
          type="button"
          className="live-action live-info"
          radius={17}
          {...glass}
          aria-haspopup="dialog"
          onClick={() => onOpenCall(r)}
        >
          View call details
        </LiquidGlass>
        <LiquidGlass as="button" type="button" className="live-action live-icon" radius={17} {...glass} aria-label={`Call ${CALL_NUMBER}`} title={`Call ${CALL_NUMBER}`} onClick={call}>
          <PhoneIcon />
        </LiquidGlass>
        <LiquidGlass as="button" type="button" className="live-action live-icon" radius={17} {...glass} aria-label={`Locate ${r.name}`} onClick={locate}>
          <LocateIcon />
        </LiquidGlass>
      </div>
    </article>
  )
}

export function LiveSearch({
  result,
  failed,
  place = '',
  onOpenCall,
}: {
  result?: SearchResult
  failed?: string
  place?: string
  onOpenCall: (r: Business) => void
}) {
  const [now, setNow] = useState(() => performance.now())
  const [startedAt] = useState(() => performance.now())
  const [doneAt, setDoneAt] = useState<number | null>(null)

  useEffect(() => {
    if (result && doneAt === null) setDoneAt(performance.now())
  }, [result, doneAt])

  // Tick while running and for the reveal afterwards.
  useEffect(() => {
    if (failed) return
    if (doneAt !== null && now - doneAt > 3000) return
    const timer = window.setInterval(() => setNow(performance.now()), 120)
    return () => clearInterval(timer)
  }, [doneAt, now, failed])

  const seconds = (now - startedAt) / 1000
  const running = !result && !failed
  // While waiting, counts creep up; once results arrive they settle on the real numbers.
  const found = result ? result.found : Math.min(180, Math.round(seconds * 9))
  const called = result ? result.called : Math.min(Math.max(0, found - 4), Math.round(seconds * 1.6))
  const shown = result && doneAt !== null ? Math.min(result.results.length, Math.floor((now - doneAt) / 450) + 1) : 0
  const clock = `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, '0')}`

  return (
    <div className="live-search">
      <div className="live-head">
        <span className={`live-dot${running ? ' on' : ''}`} />
        <strong>{failed ? 'Search stopped' : running ? (found < 8 ? 'Finding businesses…' : 'Calling businesses…') : 'Search complete'}</strong>
        <span className="live-clock">{running ? clock : ''}</span>
      </div>
      {failed ? (
        <p className="live-error">{failed}</p>
      ) : (
        <>
          <div className="live-stats">
            <span>
              <b>{found}</b> found
            </span>
            <span>
              <b>{called}</b> called
            </span>
            <span>
              <b>{result ? result.results.length : 0}</b> confirmed
            </span>
          </div>
          {/* A glass tube with the progress flowing inside it. */}
          <LiquidGlass
            className="live-bar"
            contentClassName="live-bar-body"
            radius={5}
            bezel={4}
            thickness={4}
            blur={0.5}
            aberration={0.12}
            specular={1}
            tint="rgba(238, 243, 241, 0.55)"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(result ? 100 : Math.min(92, 8 + seconds * 4))}
          >
            <span className="live-fill" style={{ width: `${result ? 100 : Math.min(92, 8 + seconds * 4)}%` }} />
          </LiquidGlass>
        </>
      )}
      {result && (
        <div className="live-results">
          {result.results.slice(0, shown).map((r) => (
            <ResultCard key={r.name} r={r} place={place} onOpenCall={onOpenCall} />
          ))}
        </div>
      )}
    </div>
  )
}

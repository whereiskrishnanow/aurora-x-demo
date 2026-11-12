import { useEffect, useState } from 'react'
import type { SearchResult } from './chat'
import { LiquidGlass } from './glass/LiquidGlass'
import { LocateIcon, PhoneIcon } from './icons'

/**
 * The "calling around" card: counters tick up while the search runs, then the
 * confirmed results slide in one by one. Results are simulated in this
 * prototype, and the card says so.
 */
type Business = SearchResult['results'][number]

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

function ResultCard({ r, place }: { r: Business; place: string }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  const call = () => {
    setNote('Calling isn’t available for demo businesses.')
    window.setTimeout(() => setNote(''), 2600)
  }
  // Demo businesses have no address, so show the area they'd be in.
  const locate = () => {
    const query = encodeURIComponent(`${place || 'Bengaluru'}, Bengaluru`)
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener')
  }

  return (
    <article className="live-card">
      <div className="live-card-top">
        <h4>{r.name}</h4>
        {r.badge && <span className="live-badge">{r.badge}</span>}
      </div>
      <p className="live-meta">
        ★ {r.rating.toFixed(1)} ({r.reviews}) · {r.distance}
      </p>
      <p className="live-price">{r.price}</p>
      <p className="live-detail">{r.detail}</p>
      <p className="live-quote">“{r.quote}”</p>

      {open && (
        <div className="call-info">
          <p className="call-info-head">Call · {r.duration ?? '1:30'} · simulated</p>
          {(r.transcript ?? [{ speaker: 'Business', text: r.quote }]).map((line, i) => (
            <p key={i} className={`call-line ${line.speaker === 'Aurora' ? 'agent' : 'business'}`}>
              <b>{line.speaker === 'Aurora' ? 'Aurora' : 'Business'}</b>
              {line.text}
            </p>
          ))}
        </div>
      )}

      <div className="live-actions">
        <LiquidGlass
          as="button"
          type="button"
          className="live-action live-info"
          radius={17}
          {...glass}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide call info' : 'View call info'}
        </LiquidGlass>
        <LiquidGlass as="button" type="button" className="live-action live-icon" radius={17} {...glass} aria-label={`Call ${r.name}`} onClick={call}>
          <PhoneIcon />
        </LiquidGlass>
        <LiquidGlass as="button" type="button" className="live-action live-icon" radius={17} {...glass} aria-label={`Locate ${r.name}`} onClick={locate}>
          <LocateIcon />
        </LiquidGlass>
      </div>
      {note && <p className="live-toast">{note}</p>}
    </article>
  )
}

export function LiveSearch({ result, failed, place = '' }: { result?: SearchResult; failed?: string; place?: string }) {
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
          <div className="live-bar">
            <span style={{ width: `${result ? 100 : Math.min(92, 8 + seconds * 4)}%` }} />
          </div>
        </>
      )}
      {result && (
        <div className="live-results">
          {result.results.slice(0, shown).map((r) => (
            <ResultCard key={r.name} r={r} place={place} />
          ))}
        </div>
      )}
      <p className="live-note">Demo · calls and results are simulated</p>
    </div>
  )
}

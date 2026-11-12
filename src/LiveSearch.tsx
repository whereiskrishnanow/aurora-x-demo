import { useEffect, useState } from 'react'
import type { SearchResult } from './chat'

/**
 * The "calling around" card: counters tick up while the search runs, then the
 * confirmed results slide in one by one. Results are simulated in this
 * prototype, and the card says so.
 */
export function LiveSearch({ result, failed }: { result?: SearchResult; failed?: string }) {
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
            <article key={r.name} className="live-card">
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
              <p className="live-called">✓ Called</p>
            </article>
          ))}
        </div>
      )}
      <p className="live-note">Demo · calls and results are simulated</p>
    </div>
  )
}

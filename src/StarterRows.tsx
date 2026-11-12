import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

/** Movement past this many px turns a press into a drag (and cancels the tap). */
const DRAG_SLOP = 6

/**
 * One endless row of suggestions.
 *
 * It isn't a native scroller: the row is a GPU-composited track moved with
 * sub-pixel `translate3d` every frame, which stays smooth on phones where
 * nudging `scrollLeft` by fractions of a pixel stutters. It drifts on its own,
 * follows the finger 1:1 when dragged, keeps the flick's momentum and eases
 * back into the drift.
 *
 * Endless without a long list: only as many copies of the set are rendered as
 * it takes to cover the row plus one, added lazily when the row is wider than
 * the content, and the position wraps around one set's width.
 */
function EndlessRow({
  items,
  speed,
  onPick,
}: {
  items: string[]
  /** drift in px per second; negative drifts the other way */
  speed: number
  onPick: (text: string) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [copies, setCopies] = useState(2)
  const setWidth = useRef(0)

  // Render just enough copies to cover the row with one spare for wrapping.
  useLayoutEffect(() => {
    const row = rowRef.current
    const track = trackRef.current
    if (!row || !track) return
    const measure = () => {
      const first = track.firstElementChild as HTMLElement | null
      if (!first) return
      setWidth.current = first.offsetWidth
      const needed = Math.max(2, Math.ceil(row.clientWidth / Math.max(1, setWidth.current)) + 1)
      setCopies((current) => (current === needed ? current : needed))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    if (track.firstElementChild) observer.observe(track.firstElementChild)
    return () => observer.disconnect()
  }, [items])

  useEffect(() => {
    const row = rowRef.current
    const track = trackRef.current
    if (!row || !track) return

    let x = 0 // how far the content has moved, px (any sign; wrapped when drawn)
    let velocity = speed // px per second, eases back to `speed` after a flick
    let last = performance.now()
    let frame = 0
    let drag: { id: number; startX: number; lastX: number; lastT: number; moved: boolean; v: number } | null = null
    let suppressClick = false

    const draw = () => {
      const width = setWidth.current
      if (!width) return
      // Wrap into [-width, 0): the copies to the right fill in seamlessly.
      const offset = (((x % width) + width) % width) - width
      track.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`
    }

    const tick = (now: number) => {
      const dt = Math.min(now - last, 50) / 1000
      last = now
      if (!drag) {
        const drift = reducedMotion.matches ? 0 : speed
        // Momentum from a flick fades into the steady drift (about 0.6 s).
        velocity += (drift - velocity) * Math.min(1, dt * 3.2)
        x += velocity * dt
      }
      draw()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      drag = { id: event.pointerId, startX: event.clientX, lastX: event.clientX, lastT: event.timeStamp, moved: false, v: 0 }
      velocity = 0 // a touch catches the row, like a real carousel
    }
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return
      const dx = event.clientX - drag.lastX
      if (!drag.moved && Math.abs(event.clientX - drag.startX) > DRAG_SLOP) {
        drag.moved = true
        try {
          row.setPointerCapture(event.pointerId)
        } catch {
          // pointer already released
        }
      }
      if (!drag.moved) return
      const dt = Math.max(1, event.timeStamp - drag.lastT) / 1000
      // Smoothed finger speed, for the flick on release.
      drag.v = drag.v * 0.6 + (dx / dt) * 0.4
      drag.lastX = event.clientX
      drag.lastT = event.timeStamp
      x += dx
      draw()
    }
    const up = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return
      if (drag.moved) {
        suppressClick = true
        // A stale reading (finger paused before lifting) means no flick.
        const fresh = event.timeStamp - drag.lastT < 80
        velocity = fresh ? Math.max(-2600, Math.min(2600, drag.v)) : 0
      }
      drag = null
    }
    // After a drag, the click that follows is not a tap on a suggestion.
    const click = (event: MouseEvent) => {
      if (!suppressClick) return
      suppressClick = false
      event.preventDefault()
      event.stopPropagation()
    }

    row.addEventListener('pointerdown', down)
    row.addEventListener('pointermove', move)
    row.addEventListener('pointerup', up)
    row.addEventListener('pointercancel', up)
    row.addEventListener('click', click, true)
    return () => {
      cancelAnimationFrame(frame)
      row.removeEventListener('pointerdown', down)
      row.removeEventListener('pointermove', move)
      row.removeEventListener('pointerup', up)
      row.removeEventListener('pointercancel', up)
      row.removeEventListener('click', click, true)
    }
  }, [speed])

  return (
    <div className="starter-row" ref={rowRef}>
      <div className="starter-track" ref={trackRef}>
        {Array.from({ length: copies }, (_, copy) => (
          <div className="starter-set" key={copy} aria-hidden={copy ? true : undefined}>
            {items.map((item) => (
              <button
                key={item}
                type="button"
                className="starter"
                tabIndex={copy ? -1 : 0}
                onClick={() => onPick(item)}
              >
                {item}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function StarterRows({ rows, onPick }: { rows: string[][]; onPick: (text: string) => void }) {
  return (
    <div className="starters" aria-label="Suggestions">
      {rows.map((items, index) => (
        <EndlessRow key={index} items={items} speed={index % 2 ? 14 : -14} onPick={onPick} />
      ))}
    </div>
  )
}

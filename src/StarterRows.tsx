import { useEffect, useRef } from 'react'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

/**
 * One row of starter prompts that drifts sideways on its own and loops
 * seamlessly. People can still swipe it; drifting resumes shortly after.
 */
function DriftingRow({
  items,
  speed,
  onPick,
}: {
  items: string[]
  /** px per second; negative drifts the other way */
  speed: number
  onPick: (text: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Content is rendered twice, so half the scroll width is one full loop.
    const loop = () => el.scrollWidth / 2
    el.scrollLeft = speed < 0 ? loop() * 0.62 : loop() * 0.18
    let pausedUntil = 0
    let last = performance.now()
    let position = el.scrollLeft
    let frame = 0
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000
      last = now
      if (now >= pausedUntil && !reducedMotion.matches) {
        const width = loop()
        position += speed * dt
        if (position >= width) position -= width
        if (position < 0) position += width
        el.scrollLeft = position
      } else {
        position = el.scrollLeft
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const hold = () => {
      pausedUntil = Infinity
    }
    const release = () => {
      pausedUntil = performance.now() + 2500
    }
    el.addEventListener('pointerdown', hold)
    el.addEventListener('touchstart', hold, { passive: true })
    el.addEventListener('pointerup', release)
    el.addEventListener('pointercancel', release)
    el.addEventListener('touchend', release)
    el.addEventListener('wheel', release, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointerdown', hold)
      el.removeEventListener('touchstart', hold)
      el.removeEventListener('pointerup', release)
      el.removeEventListener('pointercancel', release)
      el.removeEventListener('touchend', release)
      el.removeEventListener('wheel', release)
    }
  }, [speed])

  return (
    <div className="starter-row" ref={ref}>
      {[0, 1].map((copy) =>
        items.map((item) => (
          <button
            key={`${copy}-${item}`}
            type="button"
            className="starter"
            tabIndex={copy ? -1 : 0}
            aria-hidden={copy ? true : undefined}
            onClick={() => onPick(item)}
          >
            {item}
          </button>
        )),
      )}
    </div>
  )
}

export function StarterRows({ rows, onPick }: { rows: string[][]; onPick: (text: string) => void }) {
  return (
    <div className="starters" aria-label="Suggestions">
      {rows.map((items, index) => (
        <DriftingRow key={index} items={items} speed={index % 2 ? 9 : -9} onPick={onPick} />
      ))}
    </div>
  )
}

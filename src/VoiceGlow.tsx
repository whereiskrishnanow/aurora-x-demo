import { useEffect, useRef } from 'react'
import { voiceLevel } from './voiceLevel'

/*
 * The dictation bar's voice visual: soft, heavily blurred pools of teal,
 * green and sky light drifting inside the bar. As the voice gets louder the
 * pools swell, brighten and gather toward the middle; in pauses they relax
 * into a faint, slow drift. Everything eases, so it breathes rather than
 * flickers.
 */

const BLOBS = [
  { color: '#14b8a6', x: 0.18, size: 0.42, tempo: 0.53, phase: 0 },
  { color: '#1d9e75', x: 0.42, size: 0.5, tempo: 0.71, phase: 1.9 },
  { color: '#38bdf8', x: 0.66, size: 0.44, tempo: 0.61, phase: 3.7 },
  { color: '#7ee8d0', x: 0.86, size: 0.36, tempo: 0.89, phase: 5.2 },
]

export function VoiceGlow({ running }: { running: boolean }) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const runningRef = useRef(running)
  runningRef.current = running

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    const blobs = Array.from(field.children) as HTMLElement[]
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let level = 0
    let t = Math.random() * 20
    let last = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const dt = Math.min(now - last, 50) / 1000
      last = now
      const target = runningRef.current ? voiceLevel.read(now) : 0
      // Rise quickly with the voice, fall back gently.
      level += (target - level) * Math.min(1, dt * (target > level ? 14 : 4))
      t += dt * (0.5 + level * 1.6) * (still.matches ? 0.2 : 1)
      const width = field.clientWidth
      blobs.forEach((blob, i) => {
        const b = BLOBS[i]
        // Drift along the bar; louder voices pull the pools toward the centre.
        const home = b.x + (0.5 - b.x) * level * 0.18
        const x = (home + Math.sin(t * b.tempo + b.phase) * 0.12) * width
        const y = Math.cos(t * b.tempo * 1.4 + b.phase) * 3 * (0.4 + level)
        const scale = 0.5 + level * 0.55 + Math.sin(t * 2.3 + b.phase) * 0.08 * (0.3 + level)
        blob.style.transform = `translate3d(${(x - (b.size * width) / 2).toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)}, ${(scale * (0.75 + level * 0.45)).toFixed(3)})`
        blob.style.opacity = (0.35 + level * 0.65).toFixed(3)
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className={`voice-glow${running ? '' : ' paused'}`} aria-hidden="true">
      <div className="voice-glow-field" ref={fieldRef}>
        {BLOBS.map((b) => (
          <span
            key={b.color}
            style={{
              width: `${b.size * 100}%`,
              background: `radial-gradient(closest-side, ${b.color}, transparent)`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

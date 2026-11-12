import { useEffect, useRef } from 'react'
import type { VoicePhase } from './useVoiceMode'

/*
 * The soft teal light pooled along the bottom in voice mode. Each blob drifts
 * on its own slow orbit; the whole field speeds up, swells and rises while the
 * assistant speaks, breathes while listening, and calms when idle. Speed and
 * energy ease toward their targets, so changes of state never jump.
 */

const BLOBS = [
  { color: 'rgb(112, 236, 232)', left: -18, width: 70, orbit: [22, 14], tempo: 0.71 },
  { color: 'rgb(98, 204, 208)', left: 16, width: 62, orbit: [30, 18], tempo: 0.93 },
  { color: 'rgb(118, 166, 186)', left: 52, width: 68, orbit: [22, 14], tempo: 0.62 },
  { color: 'rgb(150, 244, 238)', left: 26, width: 46, orbit: [38, 22], tempo: 1.17 },
  { color: 'rgb(84, 178, 190)', left: 66, width: 52, orbit: [26, 16], tempo: 0.84 },
]

const TARGETS: Record<VoicePhase, { speed: number; energy: number }> = {
  off: { speed: 0.2, energy: 0.3 },
  idle: { speed: 0.25, energy: 0.45 },
  listening: { speed: 0.5, energy: 0.68 },
  thinking: { speed: 0.85, energy: 0.6 },
  speaking: { speed: 1.45, energy: 1 },
}

export function VoiceAurora({ phase }: { phase: VoicePhase }) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    const blobs = Array.from(field.querySelectorAll<HTMLElement>('.aurora-blob'))
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let t = Math.random() * 50
    let speed = 0.3
    let energy = 0.3
    let last = performance.now()
    let frame = 0

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const target = TARGETS[phaseRef.current]
      const calm = still.matches ? 0.15 : 1
      speed += (target.speed * calm - speed) * Math.min(1, dt * 2.2)
      energy += (target.energy - energy) * Math.min(1, dt * 1.8)
      t += dt * speed

      // While speaking, a syllable-like flutter on top of the slow swell.
      const talk = Math.max(0, (speed - 0.85) / 0.6)
      const flutter = talk * (0.5 + 0.5 * Math.sin(t * 6.1) * Math.sin(t * 2.3 + 1.3))

      blobs.forEach((blob, i) => {
        const b = BLOBS[i]
        const x = Math.sin(t * b.tempo + i * 1.9) * b.orbit[0] * (0.6 + energy * 0.4)
        const y = Math.cos(t * b.tempo * 1.3 + i * 0.8) * b.orbit[1] * (0.5 + energy * 0.5)
        const s = 0.8 + energy * 0.32 + Math.sin(t * (1.1 + i * 0.27) + i * 2.1) * 0.1 + flutter * 0.08
        blob.style.transform = `translate3d(${x.toFixed(2)}%, ${y.toFixed(2)}%, 0) scale(${s.toFixed(3)})`
      })
      field.style.transform = `scaleY(${(0.78 + energy * 0.3 + flutter * 0.06).toFixed(3)})`
      field.style.opacity = (0.75 + energy * 0.25).toFixed(3)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="voice-aurora" aria-hidden="true">
      <div className="aurora-field" ref={fieldRef}>
        <span className="aurora-base" />
        {BLOBS.map((b, i) => (
          <span
            key={i}
            className="aurora-blob"
            style={{
              left: `${b.left}%`,
              width: `${b.width}%`,
              background: `radial-gradient(closest-side, ${b.color} 35%, transparent)`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

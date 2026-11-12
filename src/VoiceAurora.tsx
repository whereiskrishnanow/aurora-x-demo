import { useEffect, useRef } from 'react'
import type { VoicePhase } from './useVoiceMode'
import { voiceLevel } from './voiceLevel'

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
    let voice = 0 // the live voice level, smoothed
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

      // The live voice (yours while listening, the assistant's while it
      // speaks) swells and lifts the light on top of the phase's mood.
      const hearing = phaseRef.current === 'listening' || phaseRef.current === 'speaking'
      const live = hearing ? voiceLevel.read(now) : 0
      voice += (live - voice) * Math.min(1, dt * (live > voice ? 12 : 3.5))
      t += dt * voice * 1.2 // louder voice, faster flow
      const flutter = voice

      blobs.forEach((blob, i) => {
        const b = BLOBS[i]
        const x = Math.sin(t * b.tempo + i * 1.9) * b.orbit[0] * (0.6 + energy * 0.4)
        const y = Math.cos(t * b.tempo * 1.3 + i * 0.8) * b.orbit[1] * (0.5 + energy * 0.5)
        // Each pool answers the voice a little differently, so the light ripples rather than pumps.
        const answer = flutter * (0.75 + 0.5 * Math.sin(i * 1.7 + t * 0.9))
        const s = 0.8 + energy * 0.28 + Math.sin(t * (1.1 + i * 0.27) + i * 2.1) * 0.08 + answer * 0.32
        blob.style.transform = `translate3d(${x.toFixed(2)}%, ${y.toFixed(2)}%, 0) scale(${s.toFixed(3)})`
      })
      field.style.transform = `scaleY(${(0.74 + energy * 0.24 + flutter * 0.32).toFixed(3)})`
      field.style.opacity = (0.7 + energy * 0.15 + flutter * 0.15).toFixed(3)
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

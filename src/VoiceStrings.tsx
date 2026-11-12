import { useEffect, useRef } from 'react'
import { voiceLevel } from './voiceLevel'

/*
 * Gradient strings: several thin, glowing lines in teal, green and sky blue,
 * flowing sideways and weaving through each other. They follow the voice:
 * quiet, they ripple softly so you can see it's listening; as you speak they
 * swell, spread apart and speed up. Paused, they flatten and fade.
 */

const STRINGS = [
  { freq: 1.3, speed: 1.7, phase: 0.0, amp: 1.0, width: 2.2 },
  { freq: 1.8, speed: -2.3, phase: 1.3, amp: 0.85, width: 1.6 },
  { freq: 2.4, speed: 2.9, phase: 2.6, amp: 0.7, width: 1.3 },
  { freq: 1.1, speed: -1.4, phase: 3.9, amp: 0.6, width: 1.1 },
  { freq: 3.0, speed: 3.6, phase: 5.1, amp: 0.45, width: 0.9 },
]

export function VoiceStrings({ running }: { running: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runningRef = useRef(running)
  runningRef.current = running

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let level = 0
    let presence = runningRef.current ? 1 : 0.35
    let t = Math.random() * 10
    let last = performance.now()
    let frame = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const draw = (now: number) => {
      const dt = Math.min(now - last, 50) / 1000
      last = now
      const on = runningRef.current
      const target = on ? voiceLevel.read(now) : 0
      level += (target - level) * Math.min(1, dt * (target > level ? 16 : 5))
      presence += ((on ? 1 : 0.35) - presence) * Math.min(1, dt * 4)
      t += dt * (0.6 + level * 2.2) * (still.matches ? 0.2 : 1)

      ctx.clearRect(0, 0, width, height)
      const gradient = ctx.createLinearGradient(0, 0, width, 0)
      gradient.addColorStop(0, 'rgba(20, 184, 166, 0)')
      gradient.addColorStop(0.15, 'rgba(20, 184, 166, 1)')
      gradient.addColorStop(0.5, 'rgba(29, 158, 117, 1)')
      gradient.addColorStop(0.85, 'rgba(56, 160, 240, 1)')
      gradient.addColorStop(1, 'rgba(56, 160, 240, 0)')

      const mid = height / 2
      const room = height / 2 - 3
      const steps = Math.max(40, Math.round(width / 3))
      // Quiet: a visible ripple (about a fifth of the room). Loud: the full height.
      const swing = room * (0.2 + level * 0.8) * presence

      ctx.lineCap = 'round'
      ctx.strokeStyle = gradient
      ctx.shadowColor = 'rgba(29, 158, 117, 0.55)'
      for (const s of STRINGS) {
        ctx.beginPath()
        for (let i = 0; i <= steps; i++) {
          const u = i / steps
          const taper = Math.pow(Math.sin(Math.PI * u), 1.3) // strings meet at the ends
          const breathe = 0.75 + 0.25 * Math.sin(t * 0.8 + s.phase)
          const y = mid + swing * s.amp * breathe * taper * Math.sin(u * Math.PI * 2 * s.freq + t * s.speed + s.phase)
          if (i === 0) ctx.moveTo(0, y)
          else ctx.lineTo(u * width, y)
        }
        ctx.globalAlpha = (0.45 + 0.55 * s.amp) * (0.55 + 0.45 * presence)
        ctx.lineWidth = s.width * (1 + level * 0.5)
        ctx.shadowBlur = 4 + level * 8
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return <canvas className="voice-strings" ref={canvasRef} aria-hidden="true" />
}

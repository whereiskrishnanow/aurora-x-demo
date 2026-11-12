import { useEffect, useRef, type MutableRefObject } from 'react'

/*
 * Flowing gradient waves for dictation: three translucent ribbons in the
 * app's teal, green and sky tones, travelling sideways at different speeds
 * and crossing each other. Their height and pace follow how lively the input
 * is: a calm ripple while waiting, swelling while you speak, with a lift each
 * time new words arrive. Paused, they settle to a slow, low drift.
 */

const LAYERS = [
  { freq: 1.6, speed: 1.9, offset: 0, height: 1, alpha: 0.5 },
  { freq: 2.4, speed: -2.6, offset: 2.1, height: 0.72, alpha: 0.42 },
  { freq: 3.3, speed: 3.4, offset: 4.2, height: 0.5, alpha: 0.36 },
]

export function Waveform({
  level,
  running,
  activity,
}: {
  /** liveliness 0..1 from the speech engine (hearing sound / speech) */
  level: MutableRefObject<number>
  running: boolean
  /** grows as words are recognised; each change gives the waves a lift */
  activity: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runningRef = useRef(running)
  runningRef.current = running
  const bump = useRef(0)
  const lastActivity = useRef(activity)

  useEffect(() => {
    if (activity !== lastActivity.current) bump.current = Math.min(1, bump.current + 0.55)
    lastActivity.current = activity
  }, [activity])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let frame = 0
    let last = performance.now()
    let time = Math.random() * 10
    let energy = 0.2

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
      bump.current *= Math.pow(0.12, dt) // a lift fades in about a second
      const target = runningRef.current ? Math.min(1, Math.max(level.current, 0.18) + bump.current * 0.6) : 0.06
      energy += (target - energy) * Math.min(1, dt * 5)
      time += dt * (0.35 + energy * 1.1) * (still.matches ? 0.25 : 1)

      ctx.clearRect(0, 0, width, height)
      const mid = height / 2
      const fill = ctx.createLinearGradient(0, 0, width, 0)
      fill.addColorStop(0, 'rgba(20, 184, 166, 0)')
      fill.addColorStop(0.18, 'rgb(20, 184, 166)')
      fill.addColorStop(0.5, 'rgb(29, 158, 117)')
      fill.addColorStop(0.82, 'rgb(56, 170, 230)')
      fill.addColorStop(1, 'rgba(56, 170, 230, 0)')

      const steps = Math.max(24, Math.round(width / 4))
      for (const layer of LAYERS) {
        const amp = (height / 2 - 1) * layer.height * (0.12 + energy * 0.88)
        const curve = (i: number) => {
          const u = i / steps
          // Taper toward both ends so ribbons grow out of a point.
          const envelope = Math.pow(Math.sin(Math.PI * u), 1.6)
          return amp * envelope * Math.sin(u * Math.PI * 2 * layer.freq + time * layer.speed + layer.offset)
        }
        ctx.beginPath()
        for (let i = 0; i <= steps; i++) ctx.lineTo((i / steps) * width, mid - curve(i))
        for (let i = steps; i >= 0; i--) ctx.lineTo((i / steps) * width, mid + curve(i) * 0.55)
        ctx.closePath()
        ctx.globalAlpha = layer.alpha * (runningRef.current ? 1 : 0.6)
        ctx.fillStyle = fill
        ctx.fill()
        // A brighter crest along the top edge.
        ctx.beginPath()
        for (let i = 0; i <= steps; i++) ctx.lineTo((i / steps) * width, mid - curve(i))
        ctx.globalAlpha = Math.min(1, layer.alpha * 1.6) * (runningRef.current ? 1 : 0.6)
        ctx.strokeStyle = fill
        ctx.lineWidth = 1.4
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [level])

  return <canvas className="waveform" ref={canvasRef} aria-hidden="true" />
}

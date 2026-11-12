import { useEffect, useRef, type MutableRefObject } from 'react'

const BAR = 3 // bar width, px
const GAP = 3.4 // space between bars, px
const SAMPLE_MS = 70 // a new bar this often
const MIN = 3 // quietest bar height, px

/**
 * A scrolling waveform of the last few seconds of the microphone.
 *
 * A new bar enters on the right every SAMPLE_MS with the current loudness and
 * the row slides left continuously between samples, so it glides rather than
 * steps. Drawn on a canvas at device resolution: one draw per frame, no DOM
 * churn. While paused it freezes in place.
 */
export function Waveform({
  level,
  running,
  activity,
}: {
  /** loudness 0..1, updated by the microphone meter */
  level: MutableRefObject<number>
  running: boolean
  /** grows as speech is recognised; animates the bars when there is no meter */
  activity: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runningRef = useRef(running)
  runningRef.current = running
  const bump = useRef(0)
  const lastActivity = useRef(activity)

  // No microphone meter (e.g. permission only for speech): pulse on new words.
  useEffect(() => {
    if (activity !== lastActivity.current) bump.current = 0.55 + Math.random() * 0.4
    lastActivity.current = activity
  }, [activity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let bars: number[] = []
    let width = 0
    let height = 0
    let lastSample = performance.now()
    let frame = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.ceil(width / (BAR + GAP)) + 2
      bars = [...Array(Math.max(0, count - bars.length)).fill(0), ...bars].slice(-count)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const color = getComputedStyle(canvas).color

    const draw = (now: number) => {
      if (runningRef.current) {
        while (now - lastSample >= SAMPLE_MS) {
          lastSample += SAMPLE_MS
          const meter = level.current
          bump.current *= 0.6
          // A little life even in quiet moments, like breath on a mic.
          const value = Math.max(meter, bump.current) * (0.75 + Math.random() * 0.25)
          bars.push(Math.min(1, value))
          bars.shift()
        }
      } else {
        lastSample = now
      }
      const progress = runningRef.current ? (now - lastSample) / SAMPLE_MS : 0
      const shift = progress * (BAR + GAP)
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = color
      const mid = height / 2
      for (let i = 0; i < bars.length; i++) {
        const x = width - (bars.length - i) * (BAR + GAP) + GAP - shift + (BAR + GAP)
        if (x + BAR < 0 || x > width) continue
        const h = Math.max(MIN, bars[i] * height)
        ctx.globalAlpha = runningRef.current ? 1 : 0.45
        ctx.beginPath()
        ctx.roundRect(x, mid - h / 2, BAR, h, BAR / 2)
        ctx.fill()
      }
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

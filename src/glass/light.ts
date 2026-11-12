/**
 * One motion source shared by every piece of glass, so all of it moves and
 * catches the light together.
 *
 * On a phone it reads the gyroscope (device orientation, secure contexts
 * only); on desktop the pointer stands in for it. Tilt is measured against a
 * slowly drifting baseline, so however you hold the phone, holding it still
 * settles back to neutral and only movement shows.
 *
 * Published on <html> and consumed by glass.css:
 *   --lg-light  light angle in conic-gradient degrees (0 = up, clockwise)
 *   --lg-tx     tilt left/right, -1..1
 *   --lg-ty     tilt toward/away, -1..1
 * Code that needs the tilt per frame (the refraction shift) can subscribe.
 */

const REST = 315 // light from the top-left
const SWING = 45 // max light swing either way, degrees
const RANGE = 16 // degrees of tilt that count as a full -1..1

type Tilt = { x: number; y: number }
type Listener = (tilt: Tilt) => void

const target: Tilt = { x: 0, y: 0 }
const current: Tilt = { x: 0, y: 0 }
const velocity: Tilt = { x: 0, y: 0 }
const listeners = new Set<Listener>()
let frame = 0
let last = 0
let started = false

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp = (v: number) => Math.max(-1, Math.min(1, v))

function publish() {
  const root = document.documentElement.style
  const angle = REST + current.x * SWING - current.y * 12
  root.setProperty('--lg-light', `${angle.toFixed(2)}deg`)
  root.setProperty('--lg-tx', current.x.toFixed(4))
  root.setProperty('--lg-ty', current.y.toFixed(4))
  listeners.forEach((fn) => fn(current))
}

/* A soft, slightly underdamped spring: the glass lags the hand and settles
   with a hint of liquid sway instead of tracking rigidly. */
function step(now: number) {
  const dt = Math.min((now - (last || now)) / 1000, 1 / 30) || 1 / 60
  last = now
  let moving = false
  for (const axis of ['x', 'y'] as const) {
    const accel = 90 * (target[axis] - current[axis]) - 14 * velocity[axis]
    velocity[axis] += accel * dt
    current[axis] += velocity[axis] * dt
    if (Math.abs(target[axis] - current[axis]) > 0.0008 || Math.abs(velocity[axis]) > 0.002) moving = true
    else {
      current[axis] = target[axis]
      velocity[axis] = 0
    }
  }
  publish()
  frame = moving ? requestAnimationFrame(step) : 0
  if (!frame) last = 0
}

function aim(x: number, y: number) {
  if (reducedMotion()) return
  target.x = clamp(x)
  target.y = clamp(y)
  if (!frame) frame = requestAnimationFrame(step)
}

/** Subscribe to tilt updates (called every animated frame). */
export function onTilt(fn: Listener) {
  listeners.add(fn)
  fn(current)
  return () => {
    listeners.delete(fn)
  }
}

/**
 * Publishes the resting light. Motion (phone tilt and the desktop pointer)
 * has been switched off: the glass keeps a fixed top-left light, and no
 * motion permission is requested. `aim` is kept so motion could return.
 */
export function startLight() {
  if (started || typeof window === 'undefined') return
  started = true
  publish()
}

/** Not used while motion is off; kept for re-enabling it later. */
export const steer = aim

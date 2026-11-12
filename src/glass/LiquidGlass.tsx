import {
  createElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { getGlassMaps, supportsSvgBackdrop, type BezelProfile, type GlassMaps } from './maps'
import { onTilt, startLight } from './light'
import './glass.css'

export interface LiquidGlassProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'button' | 'aside' | 'form'
  /** corner radius in px — the map is generated for exactly this shape */
  radius: number
  /** width of the refracting rim, px */
  bezel?: number
  /** glass thickness, px — thicker glass bends further */
  thickness?: number
  /** refractive index */
  ior?: number
  profile?: BezelProfile
  /** blur of the backdrop before it is refracted, px */
  blur?: number
  saturation?: number
  /** chromatic aberration: extra refraction for green (x1) and red (x2), as a fraction */
  aberration?: number
  /** strength of the rim light, 0..1 */
  specular?: number
  /** multiplier on the physically derived displacement */
  refraction?: number
  /** tint laid over the refracted backdrop */
  tint?: string
  /** press feedback: the glass swells, follows the finger and bends harder */
  interactive?: boolean
  contentClassName?: string
  children?: ReactNode
  type?: 'button' | 'submit'
  disabled?: boolean
}

const R_ONLY = '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'
const G_ONLY = '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'
const B_ONLY = '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export function LiquidGlass({
  as = 'div',
  radius,
  bezel = 16,
  thickness = 14,
  ior = 1.5,
  profile = 'convex-squircle',
  blur = 2,
  saturation = 1.5,
  aberration = 0.08,
  specular = 0.8,
  refraction = 1,
  tint,
  interactive = false,
  className,
  contentClassName,
  style,
  children,
  ...rest
}: LiquidGlassProps) {
  const rootRef = useRef<HTMLElement>(null)
  const filterRef = useRef<SVGFilterElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [maps, setMaps] = useState<GlassMaps | null>(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  useEffect(startLight, [])

  // Gyroscope parallax inside the lens: what is seen through the glass slides
  // a little further than the glass itself, so it reads as depth.
  useEffect(
    () =>
      onTilt(({ x, y }) => {
        const node = filterRef.current?.querySelector('feOffset')
        if (!node || reducedMotion.matches) return
        node.setAttribute('dx', (x * 4).toFixed(2))
        node.setAttribute('dy', (y * 4).toFixed(2))
      }),
    [],
  )

  // The filter images must fit the element exactly, so track its size.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!size || size.w < 2 || size.h < 2) return
    let cancelled = false
    const next = getGlassMaps({ width: size.w, height: size.h, radius, bezel, thickness, ior, profile })
    next.ready.then(() => {
      if (!cancelled) setMaps(next)
    })
    return () => {
      cancelled = true
    }
  }, [size, radius, bezel, thickness, ior, profile])

  // feDisplacementMap moves a pixel by scale * (channel - 0.5), so the full
  // normalised range (0.5) has to span the real maximum displacement.
  const baseScale = maps ? maps.maxDisplacement * 2 * refraction : 0

  /*
   * Touch response, run as springs so it overshoots and settles like a liquid:
   * the glass swells under the finger, leans and stretches toward where the
   * finger drags, bends the backdrop harder, and light pools at the contact.
   */
  useEffect(() => {
    const el = rootRef.current
    if (!interactive || !el) return

    const spring = { k: 340, c: 17 }
    const state = { s: 1, vs: 0, x: 0, vx: 0, y: 0, vy: 0, p: 0, vp: 0 }
    const goal = { s: 1, x: 0, y: 0, p: 0 }
    let pointer: { id: number; ox: number; oy: number } | null = null
    let frame = 0
    let last = 0

    const render = () => {
      const still = reducedMotion.matches
      const s = still ? 1 : state.s
      const x = still ? 0 : state.x
      const y = still ? 0 : state.y
      // Stretch along the drag, squeeze across it — volume is roughly kept.
      const sx = s * (1 + Math.min(Math.abs(x) * 0.011, 0.07) - Math.min(Math.abs(y) * 0.005, 0.03))
      const sy = s * (1 + Math.min(Math.abs(y) * 0.011, 0.07) - Math.min(Math.abs(x) * 0.005, 0.03))
      el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`
      el.style.setProperty('--lg-press', Math.max(0, state.p).toFixed(3))
      const level = Math.max(0, state.p)
      filterRef.current?.querySelectorAll('feDisplacementMap').forEach((node) => {
        const base = Number(node.getAttribute('data-base'))
        node.setAttribute('scale', String(base * (1 + 0.5 * level)))
      })
    }

    const tick = (now: number) => {
      const dt = Math.min((now - (last || now)) / 1000, 1 / 30) || 1 / 60
      last = now
      let moving = false
      for (const key of ['s', 'x', 'y', 'p'] as const) {
        const v = `v${key}` as 'vs' | 'vx' | 'vy' | 'vp'
        const accel = spring.k * (goal[key] - state[key]) - spring.c * state[v]
        state[v] += accel * dt
        state[key] += state[v] * dt
        if (Math.abs(goal[key] - state[key]) > 0.0005 || Math.abs(state[v]) > 0.002) moving = true
        else {
          state[key] = goal[key]
          state[v] = 0
        }
      }
      render()
      // At rest, drop the transform so the glass is not left on its own layer.
      if (!moving && !pointer) el.style.transform = ''
      frame = moving ? requestAnimationFrame(tick) : 0
      if (!frame) last = 0
    }
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }

    const setContact = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--lg-px', `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`)
      el.style.setProperty('--lg-py', `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`)
    }

    const down = (event: PointerEvent) => {
      pointer = { id: event.pointerId, ox: event.clientX, oy: event.clientY }
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        // pointer already gone; the press still animates
      }
      el.toggleAttribute('data-pressed', true)
      setContact(event)
      goal.s = 1.14
      goal.p = 1
      kick()
    }
    const move = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id) return
      setContact(event)
      const lean = (d: number) => Math.sign(d) * Math.min(Math.abs(d) * 0.2, 7)
      goal.x = lean(event.clientX - pointer.ox)
      goal.y = lean(event.clientY - pointer.oy)
      kick()
    }
    const up = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id) return
      pointer = null
      el.toggleAttribute('data-pressed', false)
      goal.s = 1
      goal.x = 0
      goal.y = 0
      goal.p = 0
      // A small outward flick on release, so it wobbles back into shape.
      state.vs += 1.2
      kick()
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('lostpointercapture', up)
    }
  }, [interactive])

  const svgMode = supportsSvgBackdrop && maps !== null
  const filterId = maps ? `lg-${uid}-${maps.id}` : ''
  const softBlur = Math.max(blur * 2, 6)
  const backdropFilter = svgMode
    ? `blur(${blur}px) url(#${filterId}) brightness(1.03)`
    : `blur(${softBlur}px) saturate(170%) brightness(1.02)`
  const lensFilter = `blur(${softBlur + 7}px) saturate(220%) brightness(1.08)`

  const rootStyle = {
    ...style,
    borderRadius: radius,
    '--lg-spec': specular,
    ...(tint ? { '--lg-tint': tint } : null),
  } as CSSProperties

  const image = maps && { x: 0, y: 0, width: maps.width, height: maps.height, preserveAspectRatio: 'none' }
  const pass = (scale: number, result: string) => (
    <feDisplacementMap
      in="shifted"
      in2="map"
      scale={scale}
      data-base={scale}
      xChannelSelector="R"
      yChannelSelector="G"
      result={result}
    />
  )

  return createElement(
    as,
    {
      ...rest,
      ref: rootRef,
      className: `lg${className ? ` ${className}` : ''}`,
      style: rootStyle,
      'data-interactive': interactive ? '' : undefined,
    },
    svgMode && maps && image && (
      <svg className="lg-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <filter
          id={filterId}
          ref={filterRef}
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feImage href={maps.displacementUrl} {...image} result="map" />
          <feOffset in="SourceGraphic" dx="0" dy="0" result="shifted" />
          {aberration > 0 ? (
            <>
              {/* Glass disperses light: red bends furthest, blue least. */}
              {pass(baseScale * (1 + aberration * 2), 'bentR')}
              <feColorMatrix in="bentR" type="matrix" values={R_ONLY} result="red" />
              {pass(baseScale * (1 + aberration), 'bentG')}
              <feColorMatrix in="bentG" type="matrix" values={G_ONLY} result="green" />
              {pass(baseScale, 'bentB')}
              <feColorMatrix in="bentB" type="matrix" values={B_ONLY} result="blue" />
              <feBlend in="red" in2="green" mode="screen" result="redGreen" />
              <feBlend in="redGreen" in2="blue" mode="screen" result="refracted" />
            </>
          ) : (
            pass(baseScale, 'refracted')
          )}
          <feColorMatrix in="refracted" type="saturate" values={String(saturation)} />
        </filter>
      </svg>
    ),
    <span
      className="lg-backdrop"
      style={{ backdropFilter, WebkitBackdropFilter: backdropFilter }}
      aria-hidden="true"
    />,
    !svgMode && maps && (
      <span
        className="lg-lens"
        style={{
          backdropFilter: lensFilter,
          WebkitBackdropFilter: lensFilter,
          maskImage: `url(${maps.bandUrl})`,
          WebkitMaskImage: `url(${maps.bandUrl})`,
        }}
        aria-hidden="true"
      />
    ),
    <span className="lg-tint" aria-hidden="true" />,
    <span className="lg-light" aria-hidden="true">
      {/* Blur sits on a wrapper: a mask applies after an element's own filter. */}
      <span className="lg-soft lg-soft-shade">
        <span className="lg-shade" />
      </span>
      <span className="lg-soft lg-soft-glow">
        <span className="lg-glow" />
      </span>
      <span className="lg-edge" />
      <span className="lg-sheen" />
      {interactive && <span className="lg-press" />}
    </span>,
    <span className={`lg-content${contentClassName ? ` ${contentClassName}` : ''}`}>{children}</span>,
  )
}

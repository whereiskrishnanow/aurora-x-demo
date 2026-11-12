/**
 * Liquid glass map generation.
 *
 * The refraction is physically derived (kube.io approach): a ray travelling
 * orthogonally to the screen hits the curved bezel of the glass, bends per
 * Snell's law, and lands on the background some pixels away from where it
 * would have landed without glass. That offset, as a vector field, is baked
 * into the R (x) / G (y) channels of an image with 128 = "no displacement",
 * which <feDisplacementMap> then uses to bend whatever is behind the element.
 *
 * The map is generated per element size + corner radius, because a generic
 * map stretched over a different shape gives misaligned refraction.
 *
 * Alongside it we bake a "bezel band" alpha mask (opaque at the rim, fading to
 * clear where the glass turns flat). Engines without SVG backdrop filters use
 * it to fake the rim's smeared, brighter lensing with a second blur layer.
 */

export type BezelProfile = 'convex-squircle' | 'convex-circle' | 'lip'

export interface GlassShape {
  width: number
  height: number
  /** corner radius, px */
  radius: number
  /** width of the curved rim, px (clamped to the radius) */
  bezel: number
  /** thickness of the glass slab under the rim, px */
  thickness: number
  /** refractive index of the glass (air = 1) */
  ior: number
  profile: BezelProfile
}

export interface GlassMaps {
  key: string
  id: number
  width: number
  height: number
  displacementUrl: string
  bandUrl: string
  /** px — the real displacement the normalised map represents */
  maxDisplacement: number
  ready: Promise<void>
}

/* ---------- surface height functions, x: 0 = outer edge, 1 = flat interior ---------- */

const convexCircle = (x: number) => Math.sqrt(1 - (1 - x) ** 2)
const convexSquircle = (x: number) => Math.pow(1 - Math.pow(1 - x, 4), 0.25)
const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10)
const lip = (x: number) => {
  const convex = convexSquircle(x)
  const s = smootherstep(x)
  return convex * (1 - s) + (1 - convex) * s
}

const SURFACES: Record<BezelProfile, (x: number) => number> = {
  'convex-circle': convexCircle,
  'convex-squircle': convexSquircle,
  lip,
}

/** Displacement-map resolution is 8 bit around 128, so 127 samples is all it can hold. */
const SAMPLES = 127

/**
 * Ray-trace one radius of the bezel: for each distance-from-border sample,
 * how far (px, towards the centre) does the refracted ray land?
 */
function refractionProfile(shape: GlassShape, bezel: number) {
  const surface = SURFACES[shape.profile]
  const values = new Float32Array(SAMPLES)
  const delta = 0.001
  let max = 0
  for (let i = 0; i < SAMPLES; i++) {
    const x = (i + 0.5) / SAMPLES
    const x1 = Math.max(0, x - delta)
    const x2 = Math.min(1, x + delta)
    // height = bezel * f(d / bezel)  =>  dHeight/dDistance = f'(x)
    const slope = (surface(x2) - surface(x1)) / (x2 - x1)
    const incident = Math.atan(slope) // angle between the ray and the surface normal
    const refracted = Math.asin(Math.sin(incident) / shape.ior) // Snell, n1 = 1
    const depth = surface(x) * bezel + shape.thickness // glass the ray crosses
    const offset = depth * Math.tan(incident - refracted)
    values[i] = offset
    if (Math.abs(offset) > max) max = Math.abs(offset)
  }
  return { values, max: max || 1 }
}

function sampleProfile(values: Float32Array, t: number) {
  const pos = Math.min(Math.max(t * SAMPLES - 0.5, 0), SAMPLES - 1)
  const i = Math.floor(pos)
  const j = Math.min(i + 1, SAMPLES - 1)
  const f = pos - i
  return values[i] * (1 - f) + values[j] * f
}

function toDataUrl(pixels: Uint8ClampedArray<ArrayBuffer>, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0)
  return canvas.toDataURL('image/png')
}

const cache = new Map<string, GlassMaps>()
let nextId = 1

export function getGlassMaps(shape: GlassShape): GlassMaps {
  const key = [shape.width, shape.height, shape.radius, shape.bezel, shape.thickness, shape.ior, shape.profile].join('|')
  const hit = cache.get(key)
  if (hit) return hit

  const { width, height } = shape
  const radius = Math.min(shape.radius, width / 2, height / 2)
  // Keeping the bezel within the corner radius keeps the normal field continuous.
  const bezel = Math.max(1, Math.min(shape.bezel, radius))
  const profile = refractionProfile(shape, bezel)

  // Render above 1x so the bezel ramp stays smooth on retina screens.
  const res = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
  const W = Math.max(1, Math.round(width * res))
  const H = Math.max(1, Math.round(height * res))
  const disp = new Uint8ClampedArray(W * H * 4)
  const band = new Uint8ClampedArray(W * H * 4)

  const cx = width / 2
  const cy = height / 2
  const innerX = width / 2 - radius
  const innerY = height / 2 - radius

  for (let py = 0; py < H; py++) {
    const y = (py + 0.5) / res
    const sy = y < cy ? -1 : 1
    const qy = Math.abs(y - cy) - innerY
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / res
      const sx = x < cx ? -1 : 1
      const qx = Math.abs(x - cx) - innerX

      // Signed distance to the rounded-rect border + outward normal.
      let dist: number
      let nx: number
      let ny: number
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy)
        dist = radius - len
        nx = (sx * qx) / len
        ny = (sy * qy) / len
      } else if (qx > qy) {
        dist = radius - qx
        nx = sx
        ny = 0
      } else {
        dist = radius - qy
        nx = 0
        ny = sy
      }

      const o = (py * W + px) * 4
      let r = 128
      let g = 128
      let magnitude = 0
      if (dist > 0 && dist < bezel) {
        // Convex glass converges rays: sample from further inside (-normal).
        magnitude = sampleProfile(profile.values, dist / bezel) / profile.max
        r = 128 - nx * magnitude * 127
        g = 128 - ny * magnitude * 127
      }
      disp[o] = r
      disp[o + 1] = g
      disp[o + 2] = 128
      disp[o + 3] = 255

      if (dist > -1 && dist < bezel) {
        const coverage = Math.min(Math.max(dist + 0.5, 0), 1)
        const t = 1 - Math.min(Math.max(dist / bezel, 0), 1)
        band[o] = 255
        band[o + 1] = 255
        band[o + 2] = 255
        band[o + 3] = coverage * Math.pow(t, 1.6) * 255
      }
    }
  }

  const displacementUrl = toDataUrl(disp, W, H)
  const bandUrl = toDataUrl(band, W, H)

  // Decode before the filter references them, so the first paint is already refracted.
  const decode = (src: string) => {
    const img = new Image()
    img.src = src
    return img.decode().catch(() => undefined)
  }

  const maps: GlassMaps = {
    key,
    id: nextId++,
    width,
    height,
    displacementUrl,
    bandUrl,
    maxDisplacement: profile.max,
    ready: Promise.all([decode(displacementUrl), decode(bandUrl)]).then(() => undefined),
  }
  cache.set(key, maps)
  return maps
}

/**
 * SVG filters inside backdrop-filter only render in Chromium. Other engines
 * (Safari, Firefox, every iOS browser) get the layered lens fallback.
 */
export const supportsSvgBackdrop = (() => {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return false
  if (new URLSearchParams(location.search).has('fallback')) return false
  if (!CSS.supports('backdrop-filter', 'url(#lg)')) return false
  const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }
  const brands = nav.userAgentData?.brands
  if (brands) return brands.some((b) => b.brand === 'Chromium')
  return /Chrome\//.test(nav.userAgent) && !/Firefox\//.test(nav.userAgent)
})()

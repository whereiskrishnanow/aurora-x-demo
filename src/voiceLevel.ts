/**
 * One shared "how loud is the voice right now" signal, 0..1, that the voice
 * visuals read every frame. It covers both voices: the user's while listening
 * or dictating, and the assistant's while it speaks.
 *
 * Where it comes from:
 * - Desktop: the real microphone loudness. Desktop browsers let speech
 *   recognition and a level meter share the mic.
 * - Phones: phones give the mic to one listener, and that has to be speech
 *   recognition, so the level is built from its events instead: speech
 *   started/stopped, and a lift for each recognised word, with a natural
 *   syllable-rate rhythm while speech is going on.
 * - The assistant: speech synthesis exposes no audio, so its level comes from
 *   the same rhythm plus a lift on every spoken word boundary.
 */

let speaking = false
let lift = 0
let micLevel = -1 // -1 when no meter is running
/** a loudness reading supplied from elsewhere (the dictation recorder) */
let external: (() => number) | null = null
let micUsers = 0
let mic: { stream: MediaStream; context: AudioContext; frame: number } | null = null
const fine = window.matchMedia('(pointer: fine)')

/** A smooth, never-repeating wobble at speech-like rates (≈ 3–7 Hz). */
function rhythm(t: number) {
  const a = Math.sin(t * 2 * Math.PI * 4.7)
  const b = Math.sin(t * 2 * Math.PI * 6.3 + 1.7)
  const c = Math.sin(t * 2 * Math.PI * 2.9 + 0.4)
  return Math.max(0, Math.min(1, 0.5 + 0.22 * a + 0.16 * b + 0.18 * c))
}

let lastRead = performance.now()

export const voiceLevel = {
  /** Voice activity began (user started talking, or the assistant began a sentence). */
  start() {
    speaking = true
    lift = Math.max(lift, 0.6)
  },
  /** Voice activity paused. */
  stop() {
    speaking = false
  },
  /** A word was recognised or spoken. */
  word() {
    lift = Math.min(1, lift + 0.5)
  },
  /** Reset everything (leaving voice mode or dictation). */
  reset() {
    speaking = false
    lift = 0
  },

  /** Take loudness from another meter (or stop, with null). */
  source(read: (() => number) | null) {
    external = read
  },

  /** Current level, 0..1. Call once per frame. */
  read(now = performance.now()) {
    const dt = Math.min(now - lastRead, 100) / 1000
    lastRead = now
    lift *= Math.pow(0.08, dt) // a lift fades in well under a second
    if (external) return Math.min(1, external() + lift * 0.25)
    if (micLevel >= 0) return Math.min(1, micLevel + lift * 0.25)
    const base = speaking ? 0.32 + 0.5 * rhythm(now / 1000) : 0.04
    return Math.min(1, base + lift * 0.45)
  },

  /**
   * Ask for real microphone loudness. Only on desktop; on phones this is a
   * no-op so speech recognition keeps the mic. Pair every call with releaseMic.
   */
  async useMic() {
    micUsers += 1
    if (!fine.matches || mic || micUsers > 1) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (micUsers === 0) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      const context = new AudioContext()
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.5
      context.createMediaStreamSource(stream).connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      mic = { stream, context, frame: 0 }
      micLevel = 0
      const measure = () => {
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const s of samples) sum += ((s - 128) / 128) ** 2
        const target = Math.min(1, Math.max(0, (Math.sqrt(sum / samples.length) - 0.008) * 7))
        micLevel += (target - micLevel) * (target > micLevel ? 0.55 : 0.15)
        if (mic) mic.frame = requestAnimationFrame(measure)
      }
      mic.frame = requestAnimationFrame(measure)
    } catch {
      // No meter: the event-driven level is used instead.
    }
  },

  releaseMic() {
    micUsers = Math.max(0, micUsers - 1)
    if (micUsers > 0 || !mic) return
    cancelAnimationFrame(mic.frame)
    mic.stream.getTracks().forEach((t) => t.stop())
    mic.context.close().catch(() => undefined)
    mic = null
    micLevel = -1
  },
}

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Dictation for the composer's microphone button.
 *
 * Runs two things side by side: the browser's speech recognition, which
 * turns speech into text, and a microphone analyser, which measures loudness
 * for the waveform. Pausing stops both and freezes the timer; resuming
 * carries on adding to the same text.
 */

export type DictationStatus = 'off' | 'recording' | 'paused'

interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
}

const getRecognition = () =>
  (window as unknown as { SpeechRecognition?: new () => Recognition }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition

export function useDictation() {
  const [status, setStatus] = useState<DictationStatus>('off')
  const [text, setText] = useState({ settled: '', partial: '' })
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')

  const statusRef = useRef<DictationStatus>('off')
  /** text kept from earlier recognition sessions (each pause or browser restart starts a new one) */
  const kept = useRef('')
  const session = useRef({ settled: '', partial: '' })
  const recognition = useRef<Recognition | null>(null)
  /** loudness 0..1, read by the waveform every frame */
  const level = useRef(0)
  const audio = useRef<{ stream: MediaStream; context: AudioContext; analyser: AnalyserNode } | null>(null)
  const meter = useRef(0)
  const clock = useRef({ startedAt: 0, banked: 0, timer: 0 })

  const publish = () => {
    const settled = `${kept.current}${session.current.settled}`
    setText({ settled, partial: session.current.partial })
  }

  const stopRecognition = () => {
    const rec = recognition.current
    recognition.current = null
    if (!rec) return
    rec.onend = null
    rec.onresult = null
    rec.onerror = null
    rec.abort()
  }

  const startRecognition = () => {
    const Impl = getRecognition()
    if (!Impl) {
      setError('Speech-to-text isn’t available in this browser.')
      return
    }
    const rec = new Impl()
    rec.lang = 'en-IN'
    rec.interimResults = true
    rec.continuous = true
    session.current = { settled: '', partial: '' }
    rec.onresult = (event) => {
      let settled = ''
      let partial = ''
      for (const result of Array.from(event.results)) {
        if (result.isFinal) settled += result[0].transcript
        else partial += result[0].transcript
      }
      session.current = { settled, partial }
      publish()
    }
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone access is blocked. Allow it in the browser to dictate.')
      }
    }
    rec.onend = () => {
      // Keep what was heard; if still recording, the browser just timed out, so carry on.
      const { settled, partial } = session.current
      kept.current += `${settled}${partial}`.trim() ? `${settled}${partial} ` : ''
      session.current = { settled: '', partial: '' }
      publish()
      recognition.current = null
      if (statusRef.current === 'recording') setTimeout(() => statusRef.current === 'recording' && startRecognition(), 150)
    }
    try {
      rec.start()
      recognition.current = rec
    } catch {
      // already running
    }
  }

  const startMeter = async () => {
    try {
      if (!audio.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        if (statusRef.current === 'off') {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const context = new AudioContext()
        const analyser = context.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.6
        context.createMediaStreamSource(stream).connect(analyser)
        audio.current = { stream, context, analyser }
      } else {
        await audio.current.context.resume()
      }
    } catch {
      // No meter (permission or browser): the waveform falls back to speech activity.
      return
    }
    const { analyser } = audio.current!
    const samples = new Uint8Array(analyser.fftSize)
    const read = () => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const s of samples) sum += ((s - 128) / 128) ** 2
      const rms = Math.sqrt(sum / samples.length)
      // Speech sits around 0.02–0.2 RMS: stretch that into 0..1, fast attack, slower release.
      const target = Math.min(1, Math.max(0, (rms - 0.01) * 6.5))
      level.current += (target - level.current) * (target > level.current ? 0.6 : 0.18)
      meter.current = requestAnimationFrame(read)
    }
    cancelAnimationFrame(meter.current)
    meter.current = requestAnimationFrame(read)
  }

  const stopMeter = (release: boolean) => {
    cancelAnimationFrame(meter.current)
    level.current = 0
    const a = audio.current
    if (!a) return
    if (release) {
      a.stream.getTracks().forEach((t) => t.stop())
      a.context.close().catch(() => undefined)
      audio.current = null
    } else {
      a.context.suspend().catch(() => undefined)
    }
  }

  const tickClock = () => {
    const c = clock.current
    clearInterval(c.timer)
    c.timer = window.setInterval(() => setElapsed(c.banked + (performance.now() - c.startedAt)), 250)
  }

  const setStatusBoth = (next: DictationStatus) => {
    statusRef.current = next
    setStatus(next)
  }

  const start = useCallback(() => {
    if (statusRef.current !== 'off') return
    kept.current = ''
    session.current = { settled: '', partial: '' }
    setText({ settled: '', partial: '' })
    setError('')
    clock.current.banked = 0
    clock.current.startedAt = performance.now()
    setElapsed(0)
    setStatusBoth('recording')
    startRecognition()
    startMeter()
    tickClock()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pause = useCallback(() => {
    if (statusRef.current !== 'recording') return
    setStatusBoth('paused')
    const c = clock.current
    clearInterval(c.timer)
    c.banked += performance.now() - c.startedAt
    setElapsed(c.banked)
    // Ending the session keeps its words (see onend).
    const rec = recognition.current
    if (rec) {
      rec.onend?.()
      stopRecognition()
    }
    stopMeter(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    setStatusBoth('recording')
    clock.current.startedAt = performance.now()
    startRecognition()
    startMeter()
    tickClock()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Stop and hand back everything heard ('' if nothing). */
  const finish = useCallback(() => {
    const words = `${kept.current}${session.current.settled}${session.current.partial}`.replace(/\s+/g, ' ').trim()
    setStatusBoth('off')
    clearInterval(clock.current.timer)
    stopRecognition()
    stopMeter(true)
    kept.current = ''
    session.current = { settled: '', partial: '' }
    setText({ settled: '', partial: '' })
    return words
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = useCallback(() => {
    finish()
  }, [finish])

  useEffect(() => () => void finish(), [finish])

  return { status, text, elapsed, error, level, start, pause, resume, finish, cancel }
}

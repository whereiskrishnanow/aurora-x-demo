import { useCallback, useEffect, useRef, useState } from 'react'
import { voiceLevel } from './voiceLevel'

/**
 * Dictation for the composer's microphone button, using the browser's speech
 * recognition. Pausing stops it and freezes the timer; resuming carries on
 * adding to the same text.
 *
 * The glow follows the shared voice level (see voiceLevel.ts): real mic
 * loudness on desktop, speech-recognition events on phones, where a second
 * mic listener would starve the recogniser.
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
  onsoundstart?: (() => void) | null
  onaudiostart?: (() => void) | null
  onspeechstart?: (() => void) | null
  onspeechend?: (() => void) | null
  onsoundend?: (() => void) | null
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
  /** the meter (desktop only) is held while recording */
  const micHeld = useRef(false)
  const holdMic = (on: boolean) => {
    if (on === micHeld.current) return
    micHeld.current = on
    if (on) voiceLevel.useMic()
    else voiceLevel.releaseMic()
  }
  const clock = useRef({ startedAt: 0, banked: 0, timer: 0 })
  /** whether the speech engine has actually opened the microphone this run */
  const audioStarted = useRef(false)
  /** sessions in a row that ended without ever getting audio */
  const deadSessions = useRef(0)
  const watchdog = useRef(0)

  /** Stop with a message; nothing more will come of retrying. */
  const fail = (message: string) => {
    setError(message)
    statusRef.current = 'paused'
    setStatus('paused')
    clearInterval(clock.current.timer)
    clearTimeout(watchdog.current)
    voiceLevel.reset()
    holdMic(false)
    stopRecognition()
  }
  const NOT_STARTING =
    'Speech-to-text didn’t start in this browser. Open the app in Chrome or Safari and allow the microphone.'

  /** Speech engines can fail silently (no error, no audio): notice and say so. */
  const armWatchdog = () => {
    clearTimeout(watchdog.current)
    audioStarted.current = false
    deadSessions.current = 0
    watchdog.current = window.setTimeout(() => {
      if (statusRef.current === 'recording' && !audioStarted.current) fail(NOT_STARTING)
    }, 5000)
  }

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
      voiceLevel.word()
      let settled = ''
      let partial = ''
      for (const result of Array.from(event.results)) {
        if (result.isFinal) settled += result[0].transcript
        else partial += result[0].transcript
      }
      session.current = { settled, partial }
      publish()
    }
    rec.onaudiostart = () => {
      audioStarted.current = true
      deadSessions.current = 0
      clearTimeout(watchdog.current)
      // Only now, with the speech engine holding the mic, add the level meter.
      holdMic(true)
    }
    rec.onspeechstart = () => voiceLevel.start()
    rec.onspeechend = () => voiceLevel.stop()
    rec.onsoundend = () => voiceLevel.stop()
    rec.onerror = (event) => {
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access is blocked. Allow it for this site in your browser settings.',
        'service-not-allowed': 'Speech-to-text is turned off on this device. On iPhone, turn on Dictation in Settings › General › Keyboard.',
        'audio-capture': 'No microphone was found, or another app is using it.',
        network: 'Couldn’t reach the speech service. Check your connection and try again.',
      }
      if (messages[event.error]) fail(messages[event.error])
    }
    rec.onend = () => {
      // Keep what was heard; if still recording, the browser just timed out, so carry on.
      const { settled, partial } = session.current
      kept.current += `${settled}${partial}`.trim() ? `${settled}${partial} ` : ''
      session.current = { settled: '', partial: '' }
      publish()
      recognition.current = null
      if (statusRef.current !== 'recording') return
      // Sessions that end before any audio, again and again, mean it isn't working.
      if (!audioStarted.current && ++deadSessions.current >= 3) return fail(NOT_STARTING)
      setTimeout(() => statusRef.current === 'recording' && startRecognition(), 150)
    }
    try {
      rec.start()
      recognition.current = rec
    } catch (err) {
      setError(`Couldn’t start the microphone: ${(err as Error).message || 'unknown error'}`)
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
    armWatchdog()
    startRecognition()
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
    voiceLevel.reset()
    holdMic(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    setError('')
    setStatusBoth('recording')
    clock.current.startedAt = performance.now()
    armWatchdog()
    startRecognition()
    tickClock()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Stop and hand back everything heard ('' if nothing). */
  const finish = useCallback(() => {
    const words = `${kept.current}${session.current.settled}${session.current.partial}`.replace(/\s+/g, ' ').trim()
    setStatusBoth('off')
    clearInterval(clock.current.timer)
    stopRecognition()
    voiceLevel.reset()
    holdMic(false)
    kept.current = ''
    session.current = { settled: '', partial: '' }
    setText({ settled: '', partial: '' })
    return words
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = useCallback(() => {
    finish()
  }, [finish])

  useEffect(() => () => void finish(), [finish])

  return { status, text, elapsed, error, start, pause, resume, finish, cancel }
}

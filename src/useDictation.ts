import { api } from './api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { voiceLevel } from './voiceLevel'
import { makeAudioContext, startRecorder, type Recorder } from './recorder'

/**
 * Dictation for the composer's microphone button.
 *
 * Two ways to turn speech into text, chosen automatically:
 *
 * 1. The browser's own speech recognition, when it works: words appear live
 *    as you speak.
 * 2. Recording + server transcription (/api/transcribe, Gemini) when the
 *    browser has no speech recognition (Chrome on iPhone, Firefox), or it
 *    errors, or it silently never starts (some Chromium browsers). The words
 *    appear when you send.
 *
 * Pausing freezes the timer; resuming carries on with the same message.
 */

export type DictationStatus = 'off' | 'recording' | 'paused' | 'transcribing'
export type DictationMode = 'speech' | 'record'

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

const BLOCKED = 'Microphone access is blocked. Allow it for this site in your browser settings, then tap the mic again.'

export function useDictation() {
  const [status, setStatus] = useState<DictationStatus>('off')
  const [mode, setMode] = useState<DictationMode>('speech')
  const [text, setText] = useState({ settled: '', partial: '' })
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')

  const statusRef = useRef<DictationStatus>('off')
  const modeRef = useRef<DictationMode>('speech')
  /** text kept from earlier recognition sessions (each pause or browser restart starts a new one) */
  const kept = useRef('')
  const session = useRef({ settled: '', partial: '' })
  const recognition = useRef<Recognition | null>(null)
  const clock = useRef({ startedAt: 0, banked: 0, timer: 0 })
  /** whether the speech engine has actually opened the microphone this run */
  const audioStarted = useRef(false)
  /** sessions in a row that ended without ever getting audio */
  const deadSessions = useRef(0)
  const watchdog = useRef(0)
  const audioContext = useRef<AudioContext | null>(null)
  const recorder = useRef<Recorder | null>(null)
  /** last recording, kept so a failed upload can be retried */
  const recording = useRef<Blob | null>(null)
  /** desktop level meter, used alongside browser speech recognition */
  const micHeld = useRef(false)

  const holdMic = (on: boolean) => {
    if (on === micHeld.current) return
    micHeld.current = on
    if (on) voiceLevel.useMic()
    else voiceLevel.releaseMic()
  }

  const setStatusBoth = (next: DictationStatus) => {
    statusRef.current = next
    setStatus(next)
  }
  const setModeBoth = (next: DictationMode) => {
    modeRef.current = next
    setMode(next)
  }

  const publish = () => {
    setText({ settled: `${kept.current}${session.current.settled}`, partial: session.current.partial })
  }

  const stopClock = () => {
    const c = clock.current
    if (statusRef.current === 'recording') c.banked += performance.now() - c.startedAt
    clearInterval(c.timer)
    setElapsed(c.banked)
  }
  const runClock = () => {
    const c = clock.current
    c.startedAt = performance.now()
    clearInterval(c.timer)
    c.timer = window.setInterval(() => setElapsed(c.banked + (performance.now() - c.startedAt)), 250)
  }

  /** Stop with a message. */
  const fail = (message: string) => {
    setError(message)
    stopClock()
    setStatusBoth('paused')
    clearTimeout(watchdog.current)
    stopRecognition()
    recorder.current?.pause()
    voiceLevel.reset()
    holdMic(false)
  }

  // ---------- browser speech recognition ----------

  const stopRecognition = () => {
    const rec = recognition.current
    recognition.current = null
    if (!rec) return
    rec.onend = null
    rec.onresult = null
    rec.onerror = null
    rec.abort()
  }

  /** Speech engines can fail silently (no error, no audio): notice and switch over. */
  const armWatchdog = () => {
    clearTimeout(watchdog.current)
    audioStarted.current = false
    deadSessions.current = 0
    watchdog.current = window.setTimeout(() => {
      if (statusRef.current === 'recording' && modeRef.current === 'speech' && !audioStarted.current) useRecording()
    }, 4000)
  }

  const startRecognition = () => {
    const Impl = getRecognition()
    if (!Impl) return useRecording()
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
      holdMic(true) // desktop: real loudness for the animation
    }
    rec.onspeechstart = () => voiceLevel.start()
    rec.onspeechend = () => voiceLevel.stop()
    rec.onsoundend = () => voiceLevel.stop()
    rec.onerror = (event) => {
      // Silence and our own aborts are normal; anything else means this engine isn't usable here.
      if (event.error === 'no-speech' || event.error === 'aborted') return
      useRecording()
    }
    rec.onend = () => {
      const { settled, partial } = session.current
      kept.current += `${settled}${partial}`.trim() ? `${settled}${partial} ` : ''
      session.current = { settled: '', partial: '' }
      publish()
      recognition.current = null
      if (statusRef.current !== 'recording' || modeRef.current !== 'speech') return
      // Ending again and again before any audio means it isn't working.
      if (!audioStarted.current && ++deadSessions.current >= 3) return useRecording()
      setTimeout(() => statusRef.current === 'recording' && modeRef.current === 'speech' && startRecognition(), 150)
    }
    try {
      rec.start()
      recognition.current = rec
    } catch {
      useRecording()
    }
  }

  // ---------- recording + server transcription ----------

  /** Switch to recording the voice; it is transcribed when sent. */
  function useRecording() {
    if (modeRef.current === 'record') return
    clearTimeout(watchdog.current)
    // Keep anything the speech engine did catch before it gave up.
    const { settled, partial } = session.current
    kept.current += `${settled}${partial}`.trim() ? `${settled}${partial} ` : ''
    session.current = { settled: '', partial: '' }
    publish()
    stopRecognition()
    holdMic(false)
    setModeBoth('record')
    const context = audioContext.current ?? (audioContext.current = makeAudioContext())
    startRecorder(context)
      .then((r) => {
        if (statusRef.current === 'off') return r.cancel()
        recorder.current = r
        if (statusRef.current !== 'recording') r.pause()
        voiceLevel.source(() => r.level())
      })
      .catch(() => fail(BLOCKED))
  }

  // ---------- controls ----------

  const start = useCallback(() => {
    if (statusRef.current !== 'off') return
    kept.current = ''
    session.current = { settled: '', partial: '' }
    recording.current = null
    setText({ settled: '', partial: '' })
    setError('')
    clock.current.banked = 0
    setElapsed(0)
    // Made now, inside the tap: iPhone keeps audio silent otherwise.
    audioContext.current ??= makeAudioContext()
    setModeBoth('speech')
    setStatusBoth('recording')
    runClock()
    armWatchdog()
    startRecognition()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pause = useCallback(() => {
    if (statusRef.current !== 'recording') return
    stopClock()
    setStatusBoth('paused')
    if (modeRef.current === 'speech') {
      const rec = recognition.current
      if (rec) {
        rec.onend?.() // keeps its words
        stopRecognition()
      }
      clearTimeout(watchdog.current)
      holdMic(false)
    } else {
      recorder.current?.pause()
    }
    voiceLevel.reset()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    setError('')
    setStatusBoth('recording')
    runClock()
    if (modeRef.current === 'speech') {
      armWatchdog()
      startRecognition()
    } else if (recorder.current) {
      recorder.current.resume()
    } else {
      // Recording never started (mic was blocked): try again.
      modeRef.current = 'speech'
      useRecording()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Release everything and reset. */
  const teardown = () => {
    clearInterval(clock.current.timer)
    clearTimeout(watchdog.current)
    stopRecognition()
    recorder.current?.cancel()
    recorder.current = null
    voiceLevel.source(null)
    voiceLevel.reset()
    holdMic(false)
    kept.current = ''
    session.current = { settled: '', partial: '' }
    setText({ settled: '', partial: '' })
    setStatusBoth('off')
    setModeBoth('speech')
  }

  /**
   * Stop and hand back everything said ('' if nothing). In recording mode
   * this uploads the audio for transcription first.
   */
  const finish = useCallback(async (): Promise<string> => {
    const heard = `${kept.current}${session.current.settled}${session.current.partial}`.replace(/\s+/g, ' ').trim()
    if (modeRef.current === 'speech') {
      teardown()
      return heard
    }
    if (recorder.current) {
      recording.current = recorder.current.stop()
      recorder.current = null
    }
    const audio = recording.current
    if (!audio) {
      teardown()
      return heard
    }
    stopClock()
    setStatusBoth('transcribing')
    voiceLevel.source(null)
    try {
      const response = await fetch(api('/api/transcribe'), { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: audio })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Couldn’t transcribe that recording.')
      teardown()
      return `${heard} ${String(body.text ?? '')}`.replace(/\s+/g, ' ').trim()
    } catch (err) {
      // Keep the recording so send can retry it.
      setError(`${(err as Error).message} Tap send to try again.`)
      setStatusBoth('paused')
      return ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = useCallback(() => {
    recording.current = null
    teardown()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      recording.current = null
      clearInterval(clock.current.timer) // eslint-disable-line react-hooks/exhaustive-deps
      stopRecognition()
      recorder.current?.cancel()
      voiceLevel.source(null)
      holdMic(false)
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return { status, mode, text, elapsed, error, start, pause, resume, finish, cancel }
}

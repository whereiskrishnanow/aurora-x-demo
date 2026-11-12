import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hands-free conversation: listen with the browser's speech recognition,
 * hand the final transcript to the chat, then speak the reply aloud while
 * its text is revealed word by word in step with the voice.
 */

export type VoicePhase = 'off' | 'listening' | 'thinking' | 'speaking' | 'idle'

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

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

/** Prefer a natural-sounding English voice, Indian English first. */
function pickVoice() {
  const voices = synth?.getVoices() ?? []
  const english = voices.filter((v) => v.lang.startsWith('en'))
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang === 'en-IN' ? 4 : 0) +
    (/natural|premium|enhanced|neural/i.test(v.name) ? 3 : 0) +
    (/samantha|google uk english female|google us english|karen|daniel/i.test(v.name) ? 2 : 0) +
    (v.localService ? 1 : 0)
  return english.sort((a, b) => score(b) - score(a))[0]
}

/** Never cut a word in half: reveal up to the end of the word containing n. */
function toWordEnd(text: string, n: number) {
  if (n <= 0) return 0
  if (n >= text.length) return text.length
  const space = text.indexOf(' ', n)
  return space === -1 ? text.length : space
}

export interface LiveText {
  settled: string
  partial: string
}
const EMPTY_LIVE: LiveText = { settled: '', partial: '' }

/** Silence that ends the user's turn. */
const PAUSE_MS = 1100

export interface SpeakItem {
  id: number
  text: string
}

export function useVoiceMode(onFinal: (text: string) => void) {
  const [phase, setPhase] = useState<VoicePhase>('off')
  const [muted, setMuted] = useState(false)
  /** live transcript: words the recogniser has settled, and the guess still forming */
  const [interim, setInterim] = useState<LiveText>(EMPTY_LIVE)
  const [notice, setNotice] = useState('')
  /** chars revealed per message id: absent = all, -1 = not yet on screen */
  const [revealed, setRevealed] = useState<Record<number, number>>({})

  const active = useRef(false)
  const mutedRef = useRef(false)
  const speaking = useRef(false)
  const recognition = useRef<Recognition | null>(null)
  const queue = useRef<SpeakItem[]>([])
  const generation = useRef(0) // bumps on exit so stale callbacks do nothing
  const timers = useRef<number[]>([])
  const pauseTimer = useRef(0)
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const stopListening = useCallback(() => {
    const rec = recognition.current
    recognition.current = null
    if (rec) {
      rec.onend = null
      rec.onresult = null
      rec.onerror = null
      rec.abort()
    }
    clearTimeout(pauseTimer.current)
    setInterim(EMPTY_LIVE)
  }, [])

  const listen = useCallback(() => {
    if (!active.current || mutedRef.current || speaking.current || recognition.current) return
    const SpeechRecognitionImpl = getRecognition()
    if (!SpeechRecognitionImpl) {
      setPhase('idle')
      setNotice('Voice input isn’t supported in this browser — tap a chip or type instead.')
      return
    }
    const gen = generation.current
    const rec = new SpeechRecognitionImpl()
    rec.lang = 'en-IN'
    rec.interimResults = true
    // Stay open across short pauses; we decide when the turn ends.
    rec.continuous = true
    let settled = ''
    let partial = ''
    let blocked = false
    let committed = false

    /** Hand the whole utterance to the chat once. */
    const commit = () => {
      if (committed) return
      const text = `${settled}${partial}`.replace(/\s+/g, ' ').trim()
      if (!text) return
      committed = true
      clearTimeout(pauseTimer.current)
      if (recognition.current === rec) recognition.current = null
      rec.onend = null
      rec.onresult = null
      rec.onerror = null
      rec.abort()
      setInterim(EMPTY_LIVE)
      if (gen !== generation.current || !active.current) return
      setPhase('thinking')
      onFinalRef.current(text)
    }

    rec.onresult = (event) => {
      settled = ''
      partial = ''
      for (const result of Array.from(event.results)) {
        if (result.isFinal) settled += result[0].transcript
        else partial += result[0].transcript
      }
      setInterim({ settled, partial })
      // The turn ends after a short pause with no new words.
      clearTimeout(pauseTimer.current)
      pauseTimer.current = window.setTimeout(commit, PAUSE_MS)
    }
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        blocked = true
        mutedRef.current = true
        setMuted(true)
        setNotice('Microphone access is blocked. Allow it in the browser to talk.')
      }
    }
    rec.onend = () => {
      if (recognition.current === rec) recognition.current = null
      if (gen !== generation.current || !active.current || committed) return
      if (`${settled}${partial}`.trim()) {
        commit()
      } else if (!blocked && !mutedRef.current) {
        // The browser closed the session on silence: open a new one.
        later(listen, 150)
      } else {
        setInterim(EMPTY_LIVE)
        setPhase('idle')
      }
    }

    try {
      rec.start()
      recognition.current = rec
      setNotice('')
      setPhase('listening')
    } catch {
      setPhase('idle')
    }
  }, [])

  const next = useCallback(() => {
    const gen = generation.current
    const item = queue.current.shift()
    if (!item) {
      speaking.current = false
      setPhase(mutedRef.current ? 'idle' : 'listening')
      listen()
      return
    }
    speaking.current = true
    setPhase('speaking')

    const text = item.text
    const showAll = () => {
      setRevealed((prev) => {
        const copy = { ...prev }
        delete copy[item.id]
        return copy
      })
    }
    if (!text) {
      showAll()
      later(next, 350)
      return
    }

    setRevealed((prev) => ({ ...prev, [item.id]: 0 }))
    const advanceTo = (n: number) =>
      setRevealed((prev) => {
        const current = prev[item.id]
        if (current === undefined) return prev
        const end = toWordEnd(text, n)
        return end > current ? { ...prev, [item.id]: end } : prev
      })

    // Pace estimate for voices that don't report word boundaries.
    const rate = 1.04
    const charsPerSecond = 15.5 * rate
    let started = performance.now()
    let byBoundary = false
    const pacer = window.setInterval(() => {
      if (byBoundary) return
      advanceTo(Math.floor(((performance.now() - started) / 1000) * charsPerSecond))
    }, 50)

    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearInterval(pacer)
      clearTimeout(safety)
      if (gen !== generation.current) return
      showAll()
      later(next, 320)
    }
    const expected = (text.length / charsPerSecond) * 1000
    const safety = window.setTimeout(finish, expected * 2.2 + 2500)

    if (!synth) {
      later(finish, expected + 200)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang ?? 'en-IN'
    utterance.rate = rate
    utterance.onstart = () => {
      started = performance.now()
    }
    utterance.onboundary = (event) => {
      if (event.name && event.name !== 'word') return
      byBoundary = true
      advanceTo(event.charIndex + Math.max(1, event.charLength ?? 1))
    }
    utterance.onend = finish
    utterance.onerror = finish
    synth.speak(utterance)
  }, [listen])

  /** Speak new assistant messages in order; each stays hidden until its turn. */
  const speak = useCallback(
    (items: SpeakItem[]) => {
      if (!active.current || items.length === 0) return
      stopListening()
      setRevealed((prev) => {
        const copy = { ...prev }
        for (const item of items) copy[item.id] = -1
        return copy
      })
      queue.current.push(...items)
      if (!speaking.current) next()
    },
    [next, stopListening],
  )

  const enter = useCallback(() => {
    if (active.current) return
    active.current = true
    generation.current += 1
    // iOS only lets a page speak after a gesture: prime it inside this tap.
    if (synth) {
      synth.cancel()
      synth.speak(new SpeechSynthesisUtterance(''))
    }
    setPhase('idle')
    listen()
  }, [listen])

  const exit = useCallback(() => {
    active.current = false
    generation.current += 1
    speaking.current = false
    queue.current = []
    timers.current.forEach(clearTimeout)
    timers.current = []
    stopListening()
    synth?.cancel()
    setRevealed({})
    setNotice('')
    setPhase('off')
  }, [stopListening])

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    if (next) {
      stopListening()
      if (!speaking.current) setPhase('idle')
    } else {
      setNotice('')
      listen()
    }
  }, [listen, stopListening])

  /** The user acted another way (tapped a chip): stop listening, wait for the reply. */
  const awaitReply = useCallback(() => {
    if (!active.current) return
    stopListening()
    if (!speaking.current) setPhase('thinking')
  }, [stopListening])

  useEffect(() => exit, [exit])

  const hasLive = Boolean(interim.settled || interim.partial)

  return {
    active: phase !== 'off',
    isActive: () => active.current,
    phase,
    muted,
    interim,
    hasLive,
    notice,
    revealed,
    enter,
    exit,
    toggleMute,
    speak,
    awaitReply,
  }
}

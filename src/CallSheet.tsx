import { useEffect, useMemo, useRef, useState } from 'react'
import type { SearchResult } from './chat'
import { LiquidGlass } from './glass/LiquidGlass'
import { CloseIcon, LocateIcon, PauseIcon, PhoneIcon } from './icons'

type Business = SearchResult['results'][number]
type Line = { speaker: string; text: string }

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
const CHARS_PER_SECOND = 14

/** Two distinct English voices: one for Aurora, one for the business. */
function pickVoices() {
  const voices = (synth?.getVoices() ?? []).filter((v) => v.lang.startsWith('en'))
  const by = (re: RegExp) => voices.find((v) => re.test(v.name))
  const agent = by(/samantha|google uk english female|female|zira|karen/i) ?? voices[0]
  const business = voices.find((v) => v !== agent && /en-IN|rishi|daniel|google uk english male|male|david/i.test(`${v.lang} ${v.name}`)) ?? voices.find((v) => v !== agent) ?? agent
  return { agent, business }
}

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6Z" />
  </svg>
)

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`

/**
 * Bottom sheet for one call: who was called, a player that plays the call
 * back (read aloud with two device voices, since the call is simulated), and
 * the transcript, with the line being played highlighted.
 */
export function CallSheet({ business, place, onClose }: { business: Business | null; place: string; onClose: () => void }) {
  const [shown, setShown] = useState<Business | null>(business)
  const open = business !== null
  // Keep the last business while the sheet slides away.
  useEffect(() => {
    if (business) setShown(business)
  }, [business])

  const lines: Line[] = useMemo(
    () => shown?.transcript?.length ? shown.transcript : shown ? [{ speaker: 'Business', text: shown.quote }] : [],
    [shown],
  )
  // Where each line starts on the timeline, in seconds (estimated from its length).
  const starts = useMemo(() => {
    let t = 0
    return lines.map((l) => {
      const at = t
      t += Math.max(1.6, l.text.length / CHARS_PER_SECOND) + 0.5
      return at
    })
  }, [lines])
  const total = lines.length ? starts[starts.length - 1] + Math.max(1.6, lines[lines.length - 1].text.length / CHARS_PER_SECOND) + 0.5 : 0

  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0) // seconds
  const [active, setActive] = useState(-1)
  const run = useRef({ token: 0, line: 0, lineStartedAt: 0 })
  const tick = useRef(0)
  const transcriptRef = useRef<HTMLDivElement>(null)

  const stop = () => {
    run.current.token += 1
    clearInterval(tick.current)
    synth?.cancel()
    setPlaying(false)
  }

  /** Play from a line onward. */
  const playFrom = (index: number) => {
    stop()
    if (!lines.length) return
    const token = run.current.token
    const voices = pickVoices()
    setPlaying(true)

    const speakLine = (i: number) => {
      if (token !== run.current.token) return
      if (i >= lines.length) {
        clearInterval(tick.current)
        setPlaying(false)
        setPosition(total)
        setActive(-1)
        return
      }
      run.current.line = i
      run.current.lineStartedAt = performance.now()
      setActive(i)
      setPosition(starts[i])
      const next = () => window.setTimeout(() => speakLine(i + 1), 350)
      if (!synth) {
        window.setTimeout(next, (starts[i + 1] ?? total) * 1000 - starts[i] * 1000)
        return
      }
      const line = lines[i]
      const utterance = new SpeechSynthesisUtterance(line.text)
      const isAgent = line.speaker === 'Aurora'
      const voice = isAgent ? voices.agent : voices.business
      if (voice) utterance.voice = voice
      utterance.lang = voice?.lang ?? 'en-IN'
      // A slightly different pitch keeps the two sides apart even with one voice.
      utterance.pitch = isAgent ? 1.08 : 0.88
      utterance.rate = 1.02
      utterance.onend = next
      utterance.onerror = next
      synth.speak(utterance)
    }

    // The progress bar moves smoothly within each line.
    clearInterval(tick.current)
    tick.current = window.setInterval(() => {
      const i = run.current.line
      const span = (starts[i + 1] ?? total) - starts[i]
      const within = Math.min(span - 0.05, (performance.now() - run.current.lineStartedAt) / 1000)
      setPosition(starts[i] + Math.max(0, within))
    }, 100)
    speakLine(index)
  }

  const toggle = () => {
    if (playing) {
      stop()
      return
    }
    // Resume from the line that was playing, or start over at the end.
    const from = position >= total - 0.1 ? 0 : Math.max(0, starts.findLastIndex((s) => s <= position + 0.01))
    playFrom(from)
  }

  /** Tap or drag on the progress bar jumps to that line. */
  const seek = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const at = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * total
    const index = Math.max(0, starts.findLastIndex((s) => s <= at))
    if (playing) playFrom(index)
    else {
      setPosition(starts[index])
      setActive(index)
    }
  }

  // Reset when a different call is opened; stop when the sheet closes.
  useEffect(() => {
    stop()
    setPosition(0)
    setActive(-1)
  }, [shown]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) stop()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stop(), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the line being played in view.
  useEffect(() => {
    const el = transcriptRef.current?.querySelector<HTMLElement>(`[data-line="${active}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])

  // A fixed, pleasant-looking waveform for the scrubber.
  const bars = useMemo(() => Array.from({ length: 46 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.43))), [])
  const progress = total ? position / total : 0

  const locate = () => {
    const query = encodeURIComponent(`${place || 'Bengaluru'}, Bengaluru`)
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener')
  }
  const [note, setNote] = useState('')
  const call = () => {
    setNote('Calling isn’t available for demo businesses.')
    window.setTimeout(() => setNote(''), 2600)
  }

  const glassButton = { bezel: 10, thickness: 9, blur: 0.5, aberration: 0.1, specular: 1, interactive: true } as const

  return (
    <>
      <div className={`sheet-scrim${open ? ' open' : ''}`} onClick={onClose} />
      <LiquidGlass
        as="aside"
        className={`call-sheet${open ? ' open' : ''}`}
        contentClassName="call-sheet-body"
        radius={30}
        bezel={24}
        thickness={20}
        blur={10}
        aberration={0.08}
        specular={0.9}
        tint="rgba(252, 252, 252, 0.82)"
        aria-label={shown ? `Call with ${shown.name}` : 'Call'}
        aria-hidden={!open}
        inert={!open}
      >
        {shown && (
          <>
            <span className="sheet-handle" />
            <div className="sheet-head">
              <div>
                <h3>{shown.name}</h3>
                <p>
                  ★ {shown.rating.toFixed(1)} · {shown.distance} · {shown.price}
                </p>
              </div>
              <LiquidGlass as="button" type="button" className="sheet-close" radius={18} {...glassButton} tint="rgba(255,255,255,0.4)" aria-label="Close" onClick={onClose}>
                <CloseIcon />
              </LiquidGlass>
            </div>

            {/* ---------- player ---------- */}
            <div className="player">
              <LiquidGlass
                as="button"
                type="button"
                className="player-play"
                radius={24}
                {...glassButton}
                tint="radial-gradient(circle at 50% 115%, rgba(20, 184, 166, 0.95), rgba(14, 148, 136, 0.86) 70%)"
                aria-label={playing ? 'Pause call' : 'Play call'}
                onClick={toggle}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </LiquidGlass>
              <div className="player-track">
                <div className="player-wave" onPointerDown={seek} role="slider" aria-label="Call position" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(position)}>
                  {bars.map((h, i) => (
                    <span key={i} className={i / bars.length < progress ? 'played' : ''} style={{ height: `${h * 100}%` }} />
                  ))}
                </div>
                <div className="player-times">
                  <span>{time(position)}</span>
                  <span>{time(total)}</span>
                </div>
              </div>
            </div>
            <p className="player-note">Simulated call · played back with device voices</p>

            {/* ---------- transcript ---------- */}
            <div className="sheet-transcript" ref={transcriptRef}>
              {lines.map((line, i) => (
                <p
                  key={i}
                  data-line={i}
                  className={`call-line ${line.speaker === 'Aurora' ? 'agent' : 'business'}${i === active ? ' active' : ''}`}
                  onClick={() => playFrom(i)}
                >
                  <b>{line.speaker === 'Aurora' ? 'Aurora' : shown.name}</b>
                  {line.text}
                </p>
              ))}
            </div>

            <div className="sheet-actions">
              <LiquidGlass as="button" type="button" className="sheet-action" radius={21} {...glassButton} tint="rgba(255,255,255,0.4)" onClick={call}>
                <PhoneIcon />
                Call
              </LiquidGlass>
              <LiquidGlass as="button" type="button" className="sheet-action" radius={21} {...glassButton} tint="rgba(255,255,255,0.4)" onClick={locate}>
                <LocateIcon />
                Locate
              </LiquidGlass>
            </div>
            {note && <p className="live-toast sheet-toast">{note}</p>}
          </>
        )}
      </LiquidGlass>
    </>
  )
}

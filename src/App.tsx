import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LiquidGlass } from './glass/LiquidGlass'
import { StarterRows } from './StarterRows'
import { VoiceButton } from './VoiceButton'
import { VoiceAurora } from './VoiceAurora'
import { useVoiceMode } from './useVoiceMode'
import { useKeyboardOpen } from './useKeyboardOpen'
import { useDictation } from './useDictation'
import { VoiceStrings } from './VoiceStrings'
import brandRibbon from './assets/brand-ribbon.png'
import { RECENT_SEARCHES, nextId, seedConversation, type Message } from './chat'
import { ChatError, runSearch, streamReply } from './ai'
import { LiveSearch, type Business } from './LiveSearch'
import { CallSheet } from './CallSheet'
import { listSearches, saveSearch, type SavedSearch } from './db'
import {
  ArrowUpIcon,
  CheckIcon,
  CloseIcon,
  ComposeIcon,
  LinkGlyph,
  LocationArrow,
  MenuIcon,
  MicIcon,
  MicOffIcon,
  PauseIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SignalBars,
  SlidersIcon,
} from './icons'

// On a desktop browser the screen sits in a phone frame with a drawn status
// bar; on a real phone the system draws its own. `?device` forces the frame.
// A drawn iPhone status bar and notch, only on request with `?device`
// (for screenshots). Everywhere else the screen starts right at the top.
// Never on a real phone, even if the link carries ?device.
const simulatedDevice =
  new URLSearchParams(location.search).has('device') && window.matchMedia('(pointer: fine)').matches

// The reference conversation is still available as a demo with `?demo`.
const demo = new URLSearchParams(location.search).has('demo')

const STARTERS = [
  [
    'Roses delivered by 5 PM today',
    '2BHK for rent in Indiranagar',
    'Plumber who can come today',
    'Birthday cake for 20 by 7 PM',
    'AC service this evening',
    'Catering for 40 guests',
  ],
  [
    'Pharmacy with insulin in stock',
    'Dentist appointment tomorrow',
    'Car mechanic open on Sunday',
    'Tailor to alter a suit by Friday',
    'PG near Koramangala under ₹15K',
    'Movers for a 1BHK this weekend',
  ],
]

const DEFAULT_TITLE = 'New chat'
const DEFAULT_PLACE = 'Indiranagar'

/** Pull the area out of a brief like "2bhk house for rent in Indiranagar". */
/** Bengaluru areas we recognise in a first message. */
const AREAS = [
  'Indiranagar', 'Koramangala', 'HSR Layout', 'Whitefield', 'Jayanagar', 'JP Nagar', 'BTM Layout', 'Marathahalli',
  'Bellandur', 'Electronic City', 'Hebbal', 'Yelahanka', 'Malleshwaram', 'Rajajinagar', 'Basavanagudi', 'Banashankari',
  'Sarjapur', 'Sarjapur Road', 'Bannerghatta Road', 'MG Road', 'Brigade Road', 'Ulsoor', 'Domlur', 'Frazer Town',
  'Hennur', 'Kalyan Nagar', 'RT Nagar', 'Sadashivanagar', 'Vijayanagar', 'Yeshwanthpur', 'Hosur Road', 'Kammanahalli',
  'Banaswadi', 'KR Puram', 'Mahadevapura', 'Brookefield', 'Kundalahalli', 'Bommanahalli', 'Wilson Garden', 'Richmond Town',
]

/**
 * Pull a known area out of a first message, e.g. "2bhk house for rent in
 * Indiranagar". Only real area names count, so "insulin in stock" or "near
 * metro" don't become places.
 */
function parseBrief(text: string, fallback: string) {
  const lower = text.toLowerCase()
  const area = [...AREAS]
    .sort((a, b) => b.length - a.length)
    .find((a) => new RegExp(`\\b${a.toLowerCase().replace(/ /g, '\\s+')}\\b`).test(lower))
  if (!area) return { title: text, place: fallback }
  const title = text
    .replace(new RegExp(`\\s*(?:in|at|near|around)?\\s*${area.replace(/ /g, '\\s+')}\\b[,.!]?`, 'i'), '')
    .trim()
  return { title: title || text, place: area }
}

/** What the assistant says aloud for a message; its on-screen text must match it. */
function spokenText(m: Message) {
  if (m.kind === 'assistant') return m.text
  if (m.kind === 'question') return m.question.text
  return ''
}

export default function App() {
  const simulated = simulatedDevice
  const [messages, setMessages] = useState<Message[]>(() => (demo ? seedConversation() : []))
  const [title, setTitle] = useState(demo ? '2bhk house for rent' : DEFAULT_TITLE)
  const [place, setPlace] = useState(demo ? 'Indiranagar' : DEFAULT_PLACE)
  const placeRef = useRef(place)
  placeRef.current = place
  const titleRef = useRef(title)
  titleRef.current = title
  /** saved searches from Supabase; null until loaded or if storage isn't available */
  const [saved, setSaved] = useState<SavedSearch[] | null>(null)
  const [openSavedId, setOpenSavedId] = useState<string | null>(null)
  /** search within Recent searches */
  const [menuSearch, setMenuSearch] = useState(false)
  const [menuQuery, setMenuQuery] = useState('')
  const menuSearchRef = useRef<HTMLInputElement>(null)
  const [awaitingBrief, setAwaitingBrief] = useState(!demo)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [callFor, setCallFor] = useState<Business | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const keyboardOpen = useKeyboardOpen()
  const dictation = useDictation()
  const dictating = dictation.status !== 'off'
  const dictationTextRef = useRef<HTMLParagraphElement>(null)
  // Keep the newest dictated words in view.
  useEffect(() => {
    const el = dictationTextRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth
    el.classList.toggle('overflowing', el.scrollWidth > el.clientWidth + 1)
  }, [dictation.text])
  const aiRequest = useRef<AbortController | null>(null)
  const searchRequest = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const firstPaint = useRef(true)
  // Messages already on screen at launch appear in place; only new ones animate in.
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const voice = useVoiceMode((text) => submit(text))
  const settled = useRef<Set<number> | null>(null)
  if (settled.current === null) settled.current = new Set(messages.map((m) => m.id))
  const rowClass = (m: Message, kind: string) => `row ${kind}${settled.current!.has(m.id) ? ' settled' : ''}`

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({
      top: el.scrollHeight,
      behavior: firstPaint.current ? 'auto' : 'smooth',
    })
    firstPaint.current = false
  }, [messages, typing, voice.revealed, voice.interim])

  useEffect(() => () => aiRequest.current?.abort(), [])

  /**
   * Ask the AI for its next reply. In chat, its words stream into a bubble as
   * they arrive; in voice mode the finished reply is spoken, its text keeping
   * pace with the voice.
   */
  const askAI = async (history: Message[]) => {
    aiRequest.current?.abort()
    const controller = new AbortController()
    aiRequest.current = controller
    const id = nextId()
    const speakAloud = voice.isActive()
    let streaming = false
    /** voice mode: how much of the reply has been handed to the voice */
    let spokenUpTo = 0
    setBusy(true)
    setTyping(true)

    /** Hand each finished sentence to the voice as soon as it arrives. */
    const speakSentences = (text: string) => {
      const pattern = /[.!?…](?=\s)/g
      pattern.lastIndex = spokenUpTo
      let match: RegExpExecArray | null
      let end = spokenUpTo
      while ((match = pattern.exec(text))) end = match.index + 1
      if (end > spokenUpTo) {
        voice.speakPart({ id, text: text.slice(spokenUpTo, end), offset: spokenUpTo, last: false })
        spokenUpTo = end
      }
    }

    const finish = (final: Message[]) => {
      settled.current!.add(id) // already on screen: don't replay its entrance
      setTyping(false)
      setBusy(false)
      setMessages((all) => [...all.filter((m) => m.id !== id), ...final])
      if (!speakAloud || !voice.isActive()) return
      const [reply, ...extra] = final
      if (streaming) {
        // Speak whatever is left of the reply, then reveal what follows it.
        const text = spokenText(reply)
        voice.speakPart({ id, text: text.slice(spokenUpTo), offset: spokenUpTo, last: true })
        if (extra.length) voice.speak(extra.map((m) => ({ id: m.id, text: spokenText(m) })))
      } else {
        voice.speak(final.map((m) => ({ id: m.id, text: spokenText(m) })))
      }
    }

    try {
      const { text, meta } = await streamReply(history, placeRef.current, controller.signal, (partial) => {
        if (!streaming) {
          streaming = true
          // In voice mode the text stays hidden and appears as it is spoken.
          if (speakAloud) voice.hold(id)
          setTyping(false)
          setMessages((all) => [...all, { id, kind: 'assistant', text: partial }])
        } else {
          setMessages((all) => all.map((m) => (m.id === id && m.kind === 'assistant' ? { ...m, text: partial } : m)))
        }
        if (speakAloud) speakSentences(partial)
      })
      if (controller.signal.aborted) return
      if (meta.title) setTitle(meta.title)
      if (meta.place) setPlace(meta.place)
      const reply: Message =
        meta.chips.length > 0
          ? { id, kind: 'question', question: { key: `ai-${id}`, text, options: meta.chips } }
          : { id, kind: 'assistant', text: text || 'Sorry, I didn’t catch that. Could you say it another way?' }
      if (!text) spokenUpTo = 0
      const final: Message[] = [reply]
      const searchId = meta.search ? nextId() : 0
      if (meta.search) final.push({ id: searchId, kind: 'search', brief: meta.search })
      finish(final)
      if (meta.search) startSearch(searchId, meta.search)
    } catch (error) {
      if (controller.signal.aborted) return
      console.error(error)
      const text =
        error instanceof ChatError && error.limited
          ? 'I’ve hit my usage limit for now, so I can’t reply. Please try again later.'
          : 'I couldn’t reach the assistant just now. Please try again in a moment.'
      if (streaming && speakAloud) {
        voice.release(id)
        streaming = false
      }
      finish([{ id, kind: 'assistant', text }])
    }
  }

  /** Run the (simulated) call-around for a search card, then summarise it. */
  const startSearch = async (id: number, brief: string) => {
    searchRequest.current?.abort()
    const controller = new AbortController()
    searchRequest.current = controller
    try {
      const result = await runSearch(brief, controller.signal, placeRef.current)
      if (controller.signal.aborted) return
      setMessages((all) => all.map((m) => (m.id === id && m.kind === 'search' ? { ...m, result } : m)))
      // Keep it in Recent searches.
      const query = [...messagesRef.current].reverse().find((m) => m.kind === 'user')
      saveSearch({
        title: titleRef.current || brief.slice(0, 60),
        place: placeRef.current,
        query: query && query.kind === 'user' ? query.text : '',
        brief,
        result,
      }).then((row) => {
        if (!row) return
        setSaved((list) => [row, ...(list ?? []).filter((x) => x.id !== row.id)])
        setOpenSavedId(row.id)
      })
      // The summary follows once the result cards have slid in.
      window.setTimeout(() => {
        if (controller.signal.aborted) return
        const summary: Message = { id: nextId(), kind: 'assistant', text: result.summary }
        setMessages((all) => [...all, summary])
        if (voice.isActive()) voice.speak([{ id: summary.id, text: result.summary }])
      }, result.results.length * 450 + 400)
    } catch (error) {
      if (controller.signal.aborted) return
      const failed = (error as Error).message || 'The search couldn’t run right now.'
      setMessages((all) => all.map((m) => (m.id === id && m.kind === 'search' ? { ...m, failed } : m)))
    }
  }

  /** Does a recent search match what was typed in the menu's search field? */
  const matches = (query: string, ...fields: (string | null | undefined)[]) => {
    const q = query.trim().toLowerCase()
    return !q || fields.some((f) => f?.toLowerCase().includes(q))
  }
  const matchesFor = (query: string) =>
    saved && saved.length > 0
      ? saved.filter((item) => matches(query, item.title, item.place, item.query))
      : RECENT_SEARCHES.filter((item) => matches(query, item.title, item.place))

  /** Reopen a saved search: the question, its results and the summary. */
  const openSaved = (item: SavedSearch) => {
    aiRequest.current?.abort()
    searchRequest.current?.abort()
    voice.exit()
    const restored: Message[] = []
    if (item.query) restored.push({ id: nextId(), kind: 'user', text: item.query })
    if (item.result) {
      restored.push({ id: nextId(), kind: 'search', brief: item.brief ?? '', result: item.result })
      restored.push({ id: nextId(), kind: 'assistant', text: item.result.summary })
    }
    settled.current = new Set(restored.map((m) => m.id))
    setTyping(false)
    setBusy(false)
    setDraft('')
    setTitle(item.title)
    setPlace(item.place || DEFAULT_PLACE)
    setAwaitingBrief(false)
    setMessages(restored)
    setOpenSavedId(item.id)
    setMenuOpen(false)
  }

  // Load saved searches whenever the menu opens; clear the menu search when it closes.
  useEffect(() => {
    if (!menuOpen) {
      setMenuSearch(false)
      setMenuQuery('')
      return
    }
    let live = true
    listSearches().then((list) => {
      if (live && list) setSaved(list)
    })
    return () => {
      live = false
    }
  }, [menuOpen])

  const choose = (messageId: number, option: string) => {
    if (busy) return
    voice.awaitReply()
    const next: Message[] = [
      ...messagesRef.current.map((m) => (m.id === messageId && m.kind === 'question' ? { ...m, answer: option } : m)),
      { id: nextId(), kind: 'user', text: option },
    ]
    setMessages(next)
    askAI(next)
  }

  /** Send what was dictated (nothing happens if nothing was heard). */
  const sendDictation = async () => {
    if (dictation.status === 'transcribing') return
    const words = await dictation.finish()
    if (words) submit(words)
  }

  /** A tapped suggestion goes into the message box to edit or send. */
  const prefill = (text: string) => {
    setDraft(text)
    const input = inputRef.current
    if (!input) return
    input.focus({ preventScroll: true })
    // Cursor at the end, ready to add to it.
    requestAnimationFrame(() => input.setSelectionRange(text.length, text.length))
  }

  const send = (event: FormEvent) => {
    event.preventDefault()
    submit(draft)
  }

  const submit = (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setDraft('')
    const user: Message = { id: nextId(), kind: 'user', text }

    // Show the area from the first message straight away; the AI refines it.
    if (awaitingBrief) {
      const brief = parseBrief(text, place)
      setAwaitingBrief(false)
      setTitle(brief.title)
      setPlace(brief.place)
      placeRef.current = brief.place
    }

    // A typed or spoken reply answers whichever question is still open.
    const history = messagesRef.current
    const open = history.findLast((m) => m.kind === 'question' && !m.answer)
    const next = [...history.map((m) => (m === open && m.kind === 'question' ? { ...m, answer: text } : m)), user]
    setMessages(next)
    askAI(next)
  }

  const newChat = () => {
    setOpenSavedId(null)
    aiRequest.current?.abort()
    searchRequest.current?.abort()
    voice.exit()
    settled.current = new Set()
    setTyping(false)
    setBusy(false)
    setDraft('')
    setTitle(DEFAULT_TITLE)
    setPlace(DEFAULT_PLACE)
    setAwaitingBrief(true)
    setMenuOpen(false)
    setMessages([])
  }

  const canSend = draft.trim().length > 0
  const isEmpty = messages.length === 0 && !typing && !voice.hasLive
  /** characters of a message on screen: undefined = all, -1 = not yet */
  const shown = (m: Message) => voice.revealed[m.id]
  const cut = (m: Message, text: string) => {
    const n = shown(m)
    return n === undefined ? text : text.slice(0, n)
  }

  return (
    <div className="stage">
      <main className={`screen${simulated ? ' simulated' : ''}${voice.active ? ' voice-on' : ''}`}>
        {/* ---------- content layer: never glass ---------- */}
        <div className="scroll" ref={scrollRef}>
          {isEmpty && (
            <div className={`empty${keyboardOpen ? ' keyboard-open' : ''}`} aria-hidden={keyboardOpen || undefined}>
              <img className="empty-mark" src={brandRibbon} alt="" width={58} height={41} />
              <h2>Just ask and find</h2>
              <p>What can I do for you today?</p>
            </div>
          )}
          <div className="thread" role="log" aria-live="polite">
            {messages.map((m) => {
              if (shown(m) === -1) return null
              if (m.kind === 'user') {
                return (
                  <div key={m.id} className={rowClass(m, 'user')}>
                    <div className="bubble">{m.text}</div>
                  </div>
                )
              }
              if (m.kind === 'assistant') {
                return (
                  <p key={m.id} className={rowClass(m, 'assistant')}>
                    {cut(m, m.text)}
                  </p>
                )
              }
              if (m.kind === 'question') {
                const answered = m.answer !== undefined
                const speaking = shown(m) !== undefined
                return (
                  <div key={m.id} className={rowClass(m, 'question')}>
                    <p>{cut(m, m.question.text)}</p>
                    {!speaking && (
                      <div className="chips">
                        {m.question.options.map((option) => {
                          const selected = m.answer === option
                          return (
                            <button
                              key={option}
                              type="button"
                              className={`chip${selected ? ' selected' : ''}`}
                              disabled={answered}
                              aria-pressed={selected}
                              onClick={() => choose(m.id, option)}
                            >
                              {selected && <CheckIcon />}
                              {option}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }
              if (m.kind === 'search') {
                return (
                  <div key={m.id} className={rowClass(m, 'search')}>
                    <LiveSearch result={m.result} failed={m.failed} place={place} onOpenCall={setCallFor} />
                  </div>
                )
              }
              return (
                <div key={m.id} className={rowClass(m, 'listings')}>
                  <p className="listing-note">Sample homes — live listings aren’t connected yet</p>
                  {m.listings.map((listing) => (
                    <article key={listing.title} className="listing">
                      <div className="listing-art" style={{ background: listing.art }} />
                      <div className="listing-body">
                        <h3>{listing.title}</h3>
                        <p>{listing.area}</p>
                        <p>{listing.meta}</p>
                        <strong>
                          {listing.rent}
                          <span>/month</span>
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
              )
            })}
            {voice.hasLive && (
              <div className="row user live" aria-live="off">
                <div className="bubble">
                  {voice.interim.settled}
                  <span className="partial">{voice.interim.partial}</span>
                  <span className="caret" aria-hidden="true" />
                </div>
              </div>
            )}
            {typing && (
              <div className="row typing" aria-label="Assistant is typing">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </div>

        {/* ---------- scroll edge effects: keep the control layer legible ---------- */}
        <div className="edge edge-top" aria-hidden="true" />
        {!voice.active && <div className="edge edge-bottom" aria-hidden="true" />}

        {isEmpty && !voice.active && <StarterRows rows={STARTERS} onPick={prefill} />}

        {/* ---------- control layer: liquid glass ---------- */}
        <header className="header">
          <LiquidGlass
            as="button"
            type="button"
            className="round-button"
            radius={22}
            bezel={14}
            thickness={10}
            blur={1}
            aberration={0.1}
            specular={1}
            tint="rgba(255, 255, 255, 0.3)"
            interactive
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </LiquidGlass>
          <div className={`heading${isEmpty ? ' centered' : ''}`}>
            {!isEmpty && <h1>{title}</h1>}
            <p>
              <PinIcon />
              {place}
            </p>
          </div>
          <LiquidGlass
            as="button"
            type="button"
            className="round-button"
            radius={22}
            bezel={14}
            thickness={10}
            blur={1}
            aberration={0.1}
            specular={1}
            tint="rgba(255, 255, 255, 0.3)"
            interactive
            aria-label="New chat"
            onClick={newChat}
          >
            <ComposeIcon />
          </LiquidGlass>
        </header>

        {voice.active ? (
          <>
            <VoiceAurora phase={voice.phase} />
            {voice.notice && <p className="voice-notice">{voice.notice}</p>}
            <div className="voice-dock" data-phase={voice.phase}>
              <LiquidGlass
                as="button"
                type="button"
                className="dock-button"
                radius={27}
                bezel={16}
                thickness={14}
                blur={1}
                aberration={0.12}
                specular={1}
                tint="rgba(255, 255, 255, 0.26)"
                interactive
                aria-label={voice.muted ? 'Unmute microphone' : 'Mute microphone'}
                aria-pressed={voice.muted}
                onClick={voice.toggleMute}
              >
                {voice.muted ? <MicOffIcon /> : <MicIcon />}
              </LiquidGlass>
              <LiquidGlass
                as="button"
                type="button"
                className="dock-button"
                radius={27}
                bezel={16}
                thickness={14}
                blur={1}
                aberration={0.12}
                specular={1}
                tint="rgba(255, 255, 255, 0.26)"
                interactive
                aria-label="End voice mode"
                onClick={voice.exit}
              >
                <CloseIcon />
              </LiquidGlass>
            </div>
          </>
        ) : (
          <LiquidGlass
            as="form"
            className="composer"
            contentClassName="composer-body"
            radius={28}
            bezel={22}
            thickness={18}
            blur={4}
            aberration={0.1}
            specular={0.95}
            tint="rgba(255, 255, 255, 0.4)"
            onSubmit={send}
          >
            {dictating ? (
              <>
                {/* What has been heard so far: settled words dark, words still forming lighter. */}
                <p className="dictation-text" aria-live="polite" ref={dictationTextRef}>
                  {dictation.error ? (
                    <span className="dictation-hint">{dictation.error}</span>
                  ) : dictation.text.settled || dictation.text.partial ? (
                    <span>
                      {dictation.text.settled}
                      <span className="partial">{dictation.text.partial}</span>
                    </span>
                  ) : (
                    <span className="dictation-hint">
                      {dictation.status === 'transcribing'
                        ? 'Transcribing…'
                        : dictation.status === 'paused'
                          ? 'Paused'
                          : dictation.mode === 'record'
                            ? 'Recording… your words appear when you send'
                            : 'Listening…'}
                    </span>
                  )}
                </p>
                <div className="composer-tools dictation-bar">
                  <button type="button" className="tool dictation-cancel" aria-label="Cancel dictation" onClick={dictation.cancel}>
                    <CloseIcon />
                  </button>
                  <VoiceStrings running={dictation.status === 'recording'} />
                  <span className="dictation-time">
                    {Math.floor(dictation.elapsed / 60000)}:{String(Math.floor(dictation.elapsed / 1000) % 60).padStart(2, '0')}
                  </span>
                  <LiquidGlass
                    as="button"
                    type="button"
                    className="dictation-pause"
                    radius={21}
                    bezel={12}
                    thickness={10}
                    blur={0.5}
                    aberration={0.1}
                    specular={1}
                    tint="rgba(255, 255, 255, 0.35)"
                    interactive
                    aria-label={dictation.status === 'paused' ? 'Resume dictation' : 'Pause dictation'}
                    disabled={dictation.status === 'transcribing'}
                    onClick={dictation.status === 'paused' ? dictation.resume : dictation.pause}
                  >
                    {dictation.status === 'paused' ? <MicIcon /> : <PauseIcon />}
                  </LiquidGlass>
                  <LiquidGlass
                    as="button"
                    type="button"
                    className="voice voice-send"
                    radius={21}
                    bezel={13}
                    thickness={12}
                    ior={1.6}
                    blur={0.5}
                    aberration={0.14}
                    specular={1}
                    tint="radial-gradient(circle at 50% 115%, rgba(20, 184, 166, 0.95), rgba(14, 148, 136, 0.86) 70%)"
                    interactive
                    aria-label="Send dictated message"
                    disabled={dictation.status === 'transcribing'}
                    onClick={sendDictation}
                  >
                    <ArrowUpIcon />
                  </LiquidGlass>
                </div>
              </>
            ) : (
              <>
              <input
                ref={inputRef}
                className="composer-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask anything"
                aria-label="Message"
                enterKeyHint="send"
                autoComplete="off"
              />
              <div className="composer-tools">
                <button type="button" className="tool" aria-label="Add attachment">
                  <PlusIcon />
                </button>
                <span className="spacer" />
                <button type="button" className="tool" aria-label="Search preferences">
                  <SlidersIcon />
                </button>
                <button type="button" className="tool" aria-label="Dictate" onClick={dictation.start}>
                  <MicIcon />
                </button>
                <VoiceButton canSend={canSend} onVoice={voice.enter} />
              </div>
              </>
            )}
          </LiquidGlass>
        )}

        {/* ---------- call sheet ---------- */}
        <CallSheet business={callFor} place={place} onClose={() => setCallFor(null)} />

        {/* ---------- menu sheet ---------- */}
        <div className={`scrim${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />
        <LiquidGlass
          as="aside"
          className={`drawer${menuOpen ? ' open' : ''}`}
          contentClassName="drawer-body"
          radius={34}
          bezel={36}
          thickness={34}
          refraction={1.25}
          blur={2.5}
          aberration={0.12}
          specular={0.95}
          tint="rgba(250, 250, 250, 0.36)"
          aria-label="Recent searches"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
        >
          <div className="drawer-head">
            <p className="wordmark" aria-label="Aurora">
              aurora<span>.</span>
            </p>
            <LiquidGlass
              as="button"
              type="button"
              className="drawer-close"
              radius={19}
              bezel={11}
              thickness={10}
              blur={0.5}
              aberration={0.1}
              specular={1}
              tint="rgba(255, 255, 255, 0.4)"
              interactive
              aria-label={menuSearch ? 'Hide search' : 'Search recent searches'}
              aria-pressed={menuSearch}
              onClick={() => {
                const next = !menuSearch
                setMenuSearch(next)
                if (next) requestAnimationFrame(() => menuSearchRef.current?.focus())
                else setMenuQuery('')
              }}
            >
              <SearchIcon />
            </LiquidGlass>
            <LiquidGlass
              as="button"
              type="button"
              className="drawer-close"
              radius={19}
              bezel={11}
              thickness={10}
              blur={0.5}
              aberration={0.1}
              specular={1}
              tint="rgba(255, 255, 255, 0.4)"
              interactive
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <CloseIcon />
            </LiquidGlass>
          </div>
          {menuSearch && (
            <input
              ref={menuSearchRef}
              className="drawer-search"
              type="search"
              value={menuQuery}
              onChange={(e) => setMenuQuery(e.target.value)}
              placeholder="Search your searches"
              aria-label="Search recent searches"
              enterKeyHint="search"
            />
          )}
          <h2 className="drawer-title">Recent searches</h2>
          <ul>
            {menuQuery.trim() && matchesFor(menuQuery).length === 0 && <li className="drawer-empty">No matching searches</li>}
            {saved && saved.length > 0
              ? saved.filter((item) => matches(menuQuery, item.title, item.place, item.query)).map((item) => (
                  <li key={item.id}>
                    <button type="button" className={item.id === openSavedId ? 'current' : ''} onClick={() => openSaved(item)}>
                      <span>{item.title}</span>
                    </button>
                  </li>
                ))
              : // Until you've searched (or if storage is unavailable), show examples.
                RECENT_SEARCHES.filter((item) => matches(menuQuery, item.title, item.place)).map((item, index) => (
                  <li key={item.title}>
                    <button type="button" className={index === 0 ? 'current' : ''} onClick={() => setMenuOpen(false)}>
                      <span>{item.title}</span>
                    </button>
                  </li>
                ))}
          </ul>
          <LiquidGlass
            as="button"
            type="button"
            className="drawer-new"
            radius={26}
            bezel={14}
            thickness={12}
            ior={1.6}
            blur={0.5}
            aberration={0.12}
            specular={1}
            tint="linear-gradient(180deg, rgba(26, 184, 184, 0.94), rgba(0, 153, 153, 0.97) 50%, rgb(0, 146, 146))"
            interactive
            onClick={newChat}
          >
            <PlusIcon />
            New Chat
          </LiquidGlass>
        </LiquidGlass>

        {simulated && (
          <div className="statusbar" aria-hidden="true">
            <span className="time">
              9:41
              <LocationArrow />
            </span>
            <span className="island" />
            <span className="indicators">
              <SignalBars />
              <LinkGlyph />
              <span className="battery">32</span>
            </span>
          </div>
        )}
      </main>
    </div>
  )
}

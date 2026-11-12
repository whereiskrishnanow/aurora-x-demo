import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LiquidGlass } from './glass/LiquidGlass'
import { StarterRows } from './StarterRows'
import { VoiceButton } from './VoiceButton'
import { VoiceAurora } from './VoiceAurora'
import { useVoiceMode } from './useVoiceMode'
import { useKeyboardOpen } from './useKeyboardOpen'
import brandRibbon from './assets/brand-ribbon.png'
import { LISTINGS, RECENT_SEARCHES, nextId, seedConversation, type Message } from './chat'
import { ChatError, streamReply } from './ai'
import {
  CheckIcon,
  CloseIcon,
  ComposeIcon,
  LinkGlyph,
  LocationArrow,
  MenuIcon,
  MicIcon,
  MicOffIcon,
  PinIcon,
  PlusIcon,
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
    '2bhk house for rent in Indiranagar',
    'Fully furnished 1bhk near metro',
    'Pet friendly homes in Whitefield',
    'Studio apartment under ₹15K',
    '3bhk for a family in Jayanagar',
    'Flatmates wanted in HSR Layout',
  ],
  [
    'Partially equipped with essentials',
    'Flats with covered parking',
    'Gated society with a gym',
    'Homes ready to move in this week',
    'Walking distance to a tech park',
    'Independent house with a terrace',
  ],
]

const DEFAULT_TITLE = 'New chat'
const DEFAULT_PLACE = 'Indiranagar'

/** Pull the area out of a brief like "2bhk house for rent in Indiranagar". */
function parseBrief(text: string, fallback: string) {
  const match = text.match(/^(.*?)\s+(?:in|at|near)\s+([^,.]+?)\s*[.!]?$/i)
  // "near metro", "near my office" describe a must-have, not an area.
  if (!match || /^(?:the |a |my )?(?:metro|office|work|station|college|school|campus|me)\b/i.test(match[2])) {
    return { title: text, place: fallback }
  }
  const place = match[2].replace(/\b\w/g, (c) => c.toUpperCase())
  return { title: match[1], place }
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
  const [awaitingBrief, setAwaitingBrief] = useState(!demo)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const keyboardOpen = useKeyboardOpen()
  const aiRequest = useRef<AbortController | null>(null)
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
      if (meta.listings) final.push({ id: nextId(), kind: 'listings', listings: LISTINGS })
      finish(final)
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
    aiRequest.current?.abort()
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
              <h2>Find Anything</h2>
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
              <button type="button" className="tool" aria-label="Dictate">
                <MicIcon />
              </button>
              <VoiceButton canSend={canSend} onVoice={voice.enter} />
            </div>
          </LiquidGlass>
        )}

        {/* ---------- menu sheet ---------- */}
        <div className={`scrim${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />
        <LiquidGlass
          as="aside"
          className={`drawer${menuOpen ? ' open' : ''}`}
          contentClassName="drawer-body"
          radius={34}
          bezel={26}
          thickness={22}
          blur={8}
          aberration={0.07}
          specular={0.85}
          tint="rgba(250, 250, 250, 0.55)"
          aria-label="Recent searches"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
        >
          <div className="drawer-head">
            <p className="wordmark" aria-label="Aurora">
              aurora<span>.</span>
            </p>
            <button type="button" className="tool" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
              <CloseIcon />
            </button>
          </div>
          <h2 className="drawer-title">Recent searches</h2>
          <ul>
            {RECENT_SEARCHES.map((item, index) => (
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

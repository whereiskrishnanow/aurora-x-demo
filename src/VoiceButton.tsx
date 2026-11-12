import { LiquidGlass } from './glass/LiquidGlass'
import { ArrowUpIcon } from './icons'

interface Props {
  /** there is text to send: the button turns into the send arrow */
  canSend: boolean
  /** start a hands-free voice conversation */
  onVoice: () => void
}

/**
 * Bottom-right composer button. At rest it is a clear glass pebble with a
 * voice waveform that opens voice mode; once there is text it fills with
 * teal and becomes send.
 */
export function VoiceButton({ canSend, onVoice }: Props) {
  const mode = canSend ? 'send' : 'idle'
  const tint =
    mode === 'send'
      ? 'radial-gradient(circle at 50% 115%, rgba(20, 184, 166, 0.95), rgba(14, 148, 136, 0.86) 70%)'
      : 'radial-gradient(circle at 50% 120%, rgba(20, 184, 166, 0.2), rgba(255, 255, 255, 0.16) 72%)'

  return (
    <LiquidGlass
      as="button"
      type={mode === 'send' ? 'submit' : 'button'}
      className={`voice voice-${mode}`}
      radius={21}
      bezel={13}
      thickness={12}
      ior={1.6}
      blur={0.5}
      aberration={0.14}
      specular={1}
      tint={tint}
      interactive
      aria-label={mode === 'send' ? 'Send message' : 'Start voice mode'}
      onClick={mode === 'send' ? undefined : onVoice}
    >
      <span className="voice-glyph voice-wave" aria-hidden="true">
        {[0.42, 0.72, 1, 0.62, 0.36].map((h, i) => (
          <i key={i} style={{ '--h': h, '--i': i } as React.CSSProperties} />
        ))}
      </span>
      <span className="voice-glyph voice-arrow" aria-hidden="true">
        <ArrowUpIcon />
      </span>
    </LiquidGlass>
  )
}

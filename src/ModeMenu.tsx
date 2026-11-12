import { LiquidGlass } from './glass/LiquidGlass'
import { CheckIcon } from './icons'

export type ResearchMode = 'web' | 'auto' | 'calls'

export const MODES: { id: ResearchMode; title: string; description: string; recommended?: boolean }[] = [
  { id: 'web', title: 'Web only', description: 'Quick answers from Maps and the web. No calls.' },
  { id: 'auto', title: 'Auto', description: 'Aurora calls businesses when it helps.', recommended: true },
  { id: 'calls', title: 'Calls + Web', description: 'Calls more businesses and searches wider.' },
]

/** Liquid glass dropdown above the composer for choosing the research mode. */
export function ModeMenu({
  open,
  mode,
  onPick,
  onClose,
}: {
  open: boolean
  mode: ResearchMode
  onPick: (mode: ResearchMode) => void
  onClose: () => void
}) {
  return (
    <>
      <div className={`mode-scrim${open ? ' open' : ''}`} onClick={onClose} />
      <LiquidGlass
        className={`mode-menu${open ? ' open' : ''}`}
        contentClassName="mode-menu-body"
        radius={24}
        bezel={20}
        thickness={18}
        blur={8}
        aberration={0.08}
        specular={0.9}
        tint="rgba(252, 252, 252, 0.72)"
        role="menu"
        aria-label="Research mode"
        aria-hidden={!open}
        inert={!open}
      >
        <p className="mode-menu-title">Research mode</p>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="menuitemradio"
            aria-checked={m.id === mode}
            className={`mode-option${m.id === mode ? ' selected' : ''}`}
            onClick={() => onPick(m.id)}
          >
            <span className="mode-text">
              <span className="mode-name">
                {m.title}
                {m.recommended && <span className="mode-tag">Recommended</span>}
              </span>
              <span className="mode-desc">{m.description}</span>
            </span>
            {m.id === mode && <CheckIcon />}
          </button>
        ))}
      </LiquidGlass>
    </>
  )
}

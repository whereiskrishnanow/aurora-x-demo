import type { SVGProps } from 'react'

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})

export const MenuIcon = () => (
  <svg {...base(22)}>
    <path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h9.5" />
  </svg>
)

export const ComposeIcon = () => (
  <svg {...base(22)}>
    <path d="M11 4.5H7.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3V13" />
    <path d="M17.6 3.9a1.77 1.77 0 0 1 2.5 2.5l-7.4 7.4-3.2.7.7-3.2 7.4-7.4Z" />
  </svg>
)

export const PinIcon = () => (
  <svg {...base(15)} strokeWidth={1.7}>
    <path d="M12 21.2s6.6-5.6 6.6-11A6.6 6.6 0 0 0 5.4 10.2c0 5.4 6.6 11 6.6 11Z" />
    <circle cx="12" cy="10.2" r="2.3" />
  </svg>
)

export const PlusIcon = () => (
  <svg {...base(24)} strokeWidth={1.7}>
    <path d="M12 4.5v15M4.5 12h15" />
  </svg>
)

export const SlidersIcon = () => (
  <svg {...base(24)} strokeWidth={1.7}>
    <path d="M4 8h3.2M12.8 8H20M4 16h7.2M16.8 16H20" />
    <circle cx="10" cy="8" r="2.6" />
    <circle cx="14" cy="16" r="2.6" />
  </svg>
)

export const MicIcon = () => (
  <svg {...base(24)} strokeWidth={1.7}>
    <rect x="9" y="3.2" width="6" height="11" rx="3" />
    <path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0M12 17.4v3.2" />
  </svg>
)

export const MicOffIcon = () => (
  <svg {...base(24)} strokeWidth={1.7}>
    <path d="M15 9.6V6.2a3 3 0 0 0-5.6-1.5M9 9v2.2a3 3 0 0 0 4.9 2.3" />
    <path d="M5.8 11.2a6.2 6.2 0 0 0 10.5 4.5M18.2 11.2a6 6 0 0 1-.4 2.1M12 17.4v3.2M4 4l16 16" />
  </svg>
)

export const PauseIcon = () => (
  <svg {...base(22)} fill="currentColor" stroke="none">
    <rect x="7" y="5.5" width="3.4" height="13" rx="1.2" />
    <rect x="13.6" y="5.5" width="3.4" height="13" rx="1.2" />
  </svg>
)

export const PhoneIcon = () => (
  <svg {...base(18)} strokeWidth={1.8}>
    <path d="M6.6 3.8h2.6l1.4 4-1.9 1.3a11 11 0 0 0 5.2 5.2l1.3-1.9 4 1.4v2.6a1.8 1.8 0 0 1-2 1.8A15.8 15.8 0 0 1 4.8 5.8a1.8 1.8 0 0 1 1.8-2Z" />
  </svg>
)

export const LocateIcon = () => (
  <svg {...base(18)} strokeWidth={1.8}>
    <path d="m4.5 11.2 15-6.7-6.7 15-1.7-6.6-6.6-1.7Z" />
  </svg>
)

export const CheckIcon = () => (
  <svg {...base(15)} strokeWidth={2}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

export const ArrowUpIcon = () => (
  <svg {...base(20)} strokeWidth={2.2}>
    <path d="M12 19V5.5M6 11l6-6 6 6" />
  </svg>
)

export const CloseIcon = () => (
  <svg {...base(20)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

/** App mark: two ribbons of teal, drawn for this app. */
export const BrandMark = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="brand-a" x1="2" y1="6" x2="22" y2="18" gradientUnits="userSpaceOnUse">
        <stop stopColor="#35C9B5" />
        <stop offset="1" stopColor="#0C8F86" />
      </linearGradient>
      <linearGradient id="brand-b" x1="2" y1="18" x2="22" y2="8" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0A7F78" />
        <stop offset="1" stopColor="#1DB3A2" />
      </linearGradient>
    </defs>
    <path
      d="M2.5 9.2c3-2.6 5.6-2.6 8.3-.6 2.4 1.8 4.6 2 7.1.2L21.5 6v6.300c-3 2.6-5.600 2.600-8.300.6-2.400-1.800-4.600-2-7.100-.2L2.500 15.500Z"
      fill="url(#brand-a)"
    />
    <path
      d="M2.500 15.400c3-2.600 5.600-2.600 8.300-.6 2.400 1.800 4.600 2 7.100.2l3.600-2.800v4.400c-3 2.600-5.600 2.600-8.300.6-2.400-1.800-4.600-2-7.100-.2L2.500 19.800Z"
      fill="url(#brand-b)"
      opacity="0.9"
    />
  </svg>
)

/* ---------- simulated status bar (desktop preview only) ---------- */

export const LocationArrow = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M21.300 2.700 2.800 10.400c-.8.300-.7 1.400.1 1.600l7 1.900 1.900 7c.2.800 1.300.9 1.600.1L21.300 2.700Z" />
  </svg>
)

export const SignalBars = () => (
  <svg width="19" height="13" viewBox="0 0 19 13" aria-hidden="true">
    <rect x="0" y="8.500" width="3.300" height="4.500" rx="1" fill="currentColor" />
    <rect x="5.200" y="6" width="3.300" height="7" rx="1" fill="currentColor" />
    <rect x="10.400" y="3.200" width="3.300" height="9.800" rx="1" fill="currentColor" opacity="0.28" />
    <rect x="15.600" y="0" width="3.300" height="13" rx="1" fill="currentColor" opacity="0.28" />
  </svg>
)

export const LinkGlyph = () => (
  <svg width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.900" aria-hidden="true">
    <rect x="1" y="2.500" width="12" height="9" rx="4.500" />
    <rect x="9" y="2.500" width="12" height="9" rx="4.500" />
  </svg>
)

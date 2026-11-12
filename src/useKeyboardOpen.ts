import { useEffect, useState } from 'react'

const touch = window.matchMedia('(pointer: coarse)')

/**
 * True while a phone's on-screen keyboard is open.
 *
 * Browsers don't report the keyboard directly, so this combines two signals:
 * a text field has focus, and the visible screen has shrunk well below its
 * tallest size (iOS shrinks the visual viewport; Android, with
 * `interactive-widget=resizes-content`, shrinks the window itself). Focus
 * alone isn't enough: a hardware keyboard or a desktop never opens one.
 */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!touch.matches) return
    const viewport = window.visualViewport
    let tallest = Math.max(window.innerHeight, viewport?.height ?? 0)

    const typing = () => {
      const el = document.activeElement
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable
    }
    const update = () => {
      const visible = Math.min(window.innerHeight, viewport?.height ?? window.innerHeight)
      if (!typing()) tallest = Math.max(tallest, window.innerHeight, viewport?.height ?? 0)
      // Keyboards take a third or more of the screen; toolbars come and go by far less.
      setOpen(typing() && visible < tallest * 0.78)
    }

    viewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    // The keyboard finishes opening a moment after focus.
    const late = () => setTimeout(update, 350)
    document.addEventListener('focusin', late)
    document.addEventListener('focusout', late)
    // Rotating the phone changes what "full height" means.
    const rotate = () => {
      tallest = 0
      setTimeout(update, 400)
    }
    screen.orientation?.addEventListener('change', rotate)
    return () => {
      viewport?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusin', late)
      document.removeEventListener('focusout', late)
      screen.orientation?.removeEventListener('change', rotate)
    }
  }, [])

  return open
}

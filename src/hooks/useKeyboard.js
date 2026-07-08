import { useEffect, useRef } from 'react'
import { KEYBOARD_MAP, KEYBOARD_BASE } from '../constants'

export function useKeyboard({
  attackNote,
  releaseNote,
  program,
}) {
  const held = useRef(new Set())   // tracks currently held keys to prevent repeats

  useEffect(() => {
    const onDown = (e) => {
      if (e.repeat) return   // browser key-repeat → ignore
      // Don't steal keys from BPM input etc.
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return

      const offset = KEYBOARD_MAP[e.key]
      if (offset === undefined) return

      const midi = KEYBOARD_BASE + offset
      if (held.current.has(midi)) return   // already sounding
      held.current.add(midi)
      attackNote(midi, program)
    }

    const onUp = (e) => {
      const offset = KEYBOARD_MAP[e.key]
      if (offset === undefined) return
      const midi = KEYBOARD_BASE + offset
      if (!held.current.has(midi)) return
      held.current.delete(midi)
      releaseNote(midi, program)
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [attackNote, releaseNote, program])
}
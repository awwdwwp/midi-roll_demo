import { useCallback } from "react"
import * as Tone from "tone"

import { loadPreset } from "../audio/gmPresets"
import { playSample, stopAllSamples } from "../audio/sampler"
import { getAudioEngine } from "../audio/webAudioFont"

export function useAudioEngine() {

  /**
   * Preview one note immediately.
   */
const playNote = useCallback(async (midiPitch, program = 0) => {


  const { audioContext } = await getAudioEngine()


  const preset = await loadPreset(program)

  await playSample(
    preset,
    midiPitch,
    1.2,
    1
  )

}, [])


  /**
   * Piano key pressed.
   */
  const attackNote = useCallback((midiPitch, program = 0) => {

    playNote(midiPitch, program)

  }, [playNote])


  /**
   * Nothing to release yet.
   */
  const releaseNote = useCallback(() => {}, [])



  /**
   * Sequencer playback.
   */
  const startPlayback = useCallback(async (
    notes,
    bpm,
    startCell,
    totalCells,
    tempoMap,
    onTick,
    onEnd
  ) => {

    await Tone.start()

    const { audioContext } = await getAudioEngine()

    const presets = new Map()

    await Promise.all(
      [...new Set(notes.map(n => n.instrument ?? 0))]
        .map(async program => {
          presets.set(
            program,
            await loadPreset(program)
          )
        })
    )

    const secondsPer16th =
      (60 / bpm) / 4

    const start =
      Math.max(0, Math.floor(startCell))

    const playbackStart =
      audioContext.currentTime + 0.05



    notes
      .filter(n => n.start + n.dur > start)
      .forEach(note => {

        const preset =
          presets.get(note.instrument ?? 0)

        if (!preset) return

        const when =
          playbackStart +
          (note.start - start) * secondsPer16th

        playSample(
          preset,
          note.pitch,
          note.dur * secondsPer16th,
          (note.vel ?? 100) / 127,
          when
        )

      })



    const playbackLength =
      (totalCells - start) *
      secondsPer16th

    const endTimer = setTimeout(() => {

      onEnd()

    }, playbackLength * 1000)



    let raf

    const tick = () => {

      const elapsed =
        audioContext.currentTime -
        playbackStart

      const cell =
        start +
        elapsed / secondsPer16th

      if (cell <= totalCells) {

        onTick(cell)

        raf =
          requestAnimationFrame(tick)

      }

    }

    raf =
      requestAnimationFrame(tick)



    return () => {

      clearTimeout(endTimer)

      cancelAnimationFrame(raf)

       stopAllSamples()
    }

  }, [])







  return {

    playNote,
    attackNote,
    releaseNote,
    startPlayback

  }

}
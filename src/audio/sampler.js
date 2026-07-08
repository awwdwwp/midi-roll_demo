import { getAudioEngine } from "./webAudioFont"
const activeSources = new Set()

function findZone(preset, midi) {

  

  return preset.zones.find(zone =>
    zone.buffer &&
    midi >= zone.keyRangeLow &&
    midi <= zone.keyRangeHigh
  )

}

function playbackRate(zone, midi) {

  const basePitch =
    zone.originalPitch -
    zone.coarseTune * 100 -
    zone.fineTune

  return Math.pow(
    2,
    (midi * 100 - basePitch) / 1200
  )

}

export async function playSample(
  preset,
  midi,
  duration = 2.5,
  volume = 1,
  when = null
) {

  const { audioContext } = await getAudioEngine()

  const zone = findZone(preset, midi)

  if (!zone) {
    console.warn("No zone for", midi)
    return
  }

  const source = audioContext.createBufferSource()

  activeSources.add(source)

  source.onended = () => {
    activeSources.delete(source)
  }

  source.buffer = zone.buffer

  source.playbackRate.value =
    playbackRate(zone, midi)


  const gain = audioContext.createGain()

  const startTime =
    when ?? audioContext.currentTime

  const stopTime =
    startTime + duration


  gain.gain.setValueAtTime(
    volume,
    startTime
  )

  gain.gain.setTargetAtTime(
    0,
    stopTime - 0.05,
    0.03
  )


  source.connect(gain)
  gain.connect(audioContext.destination)


  source.start(
    startTime,
    zone.delay ?? 0
  )

  source.stop(
    stopTime + 0.1
  )
}

export function stopAllSamples() {

  for (const source of activeSources) {

    try {
      source.stop()
    } catch {}

  }

  activeSources.clear()

}
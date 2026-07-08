import { getAudioEngine } from "./webAudioFont"


const presetCache = new Map()
const loadingCache = new Map()

const BASE_URL =
  "https://surikov.github.io/webaudiofontdata/sound/"

function getPresetName(program) {
   return `${String(program * 10).padStart(4, "0")}_GeneralUserGS_sf2_file`
}



async function fetchPreset(program) {
  const name =
    getPresetName(program)
  const url = `${BASE_URL}${name}.js`


  let response = await fetch(url)

  if (!response.ok && program !== 0) {
      console.warn(
    `Missing preset ${program}, falling back to piano`
  )
  return fetchPreset(0)
  }

  if (!response.ok) {
    throw new Error(`Missing preset: ${url}`)
  }

  const text = await response.text()

  const variableMatch =
    text.match(/var (_tone_[A-Za-z0-9_]+)/)

  if (!variableMatch) {
    throw new Error(
      `Could not find variable in ${name}`
    )
  }

  const variable = variableMatch[1]

  const script = document.createElement("script")
  script.textContent = text
  document.head.appendChild(script)

  const preset = window[variable]

  if (!preset) {
    throw new Error(
      `Preset not found: ${variable}`
    )
  }

  return preset
}

async function decodePreset(preset) {

  const { audioContext } =
    await getAudioEngine()

  await Promise.all(
    preset.zones.map(async zone => {

      if (zone.buffer || !zone.file)
        return

      const binary = atob(zone.file)

      const bytes =
        new Uint8Array(binary.length)

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }

      zone.buffer =
        await audioContext.decodeAudioData(
          bytes.buffer.slice(0)
        )

    })
  )

  return preset
}

export async function loadPreset(program = 0) {

  if (presetCache.has(program))
    return presetCache.get(program)

  if (loadingCache.has(program))
    return loadingCache.get(program)

  const promise = (async () => {

    const preset =
      await fetchPreset(program)

    await decodePreset(preset)

    presetCache.set(program, preset)

    loadingCache.delete(program)

    return preset

  })()

  loadingCache.set(program, promise)

  return promise
}

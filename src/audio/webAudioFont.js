let audioContext = null

export function getAudioEngine() {
  if (!audioContext) {
    const Context =
      window.AudioContext ||
      window.webkitAudioContext

    if (!Context) {
      throw new Error("Web Audio API not supported")
    }

    audioContext = new Context()
  }

  return { audioContext }
}

export async function resumeAudioEngine() {
  const { audioContext } = getAudioEngine()

  if (audioContext.state !== "running") {
    await audioContext.resume()
  }

  return { audioContext }
}
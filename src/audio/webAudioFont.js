let audioContext = null

export async function getAudioEngine() {

  if (!audioContext) {

    const Context =
      window.AudioContext ||
      window.webkitAudioContext

    if (!Context) {
      throw new Error("Web Audio API not supported")
    }

    audioContext = new Context()
  }

  if (audioContext.state !== "running") {
    await audioContext.resume()
  }

  return { audioContext }
}
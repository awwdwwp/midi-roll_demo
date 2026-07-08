export function encodeMidi(tracks, bpm, subs = 4) {
  const PPQ          = 480
  const ticksPer16th = PPQ / subs
  const usPerBeat    = Math.round(60_000_000 / bpm)

  const u16 = v => [(v >> 8) & 0xff, v & 0xff]
  const u32 = v => [(v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]

  const vlq = (v) => {
    const out = [v & 0x7f]
    v >>>= 7
    while (v > 0) { out.unshift((v & 0x7f) | 0x80); v >>>= 7 }
    return out
  }

  const mtrk = (bytes) => [
    0x4d, 0x54, 0x72, 0x6b,
    ...u32(bytes.length),
    ...bytes,
  ]

  const tempoTrack = mtrk([
    0x00,
    0xff, 0x51, 0x03,
    (usPerBeat >> 16) & 0xff,
    (usPerBeat >>  8) & 0xff,
     usPerBeat        & 0xff,
    0x00, 0xff, 0x2f, 0x00,
  ])

  const noteTracks = tracks
    .filter(t => t && !t.muted && Array.isArray(t.notes))
    .map(t => {
      const events = []

      for (const n of t.notes) {
        if (!Number.isFinite(n.pitch) || !Number.isFinite(n.start) || !Number.isFinite(n.dur)) continue
        const onTick  = Math.round(n.start * ticksPer16th)
        const offTick = Math.round((n.start + n.dur) * ticksPer16th)
        const vel     = Math.max(1, Math.min(127, n.vel ?? 100))
        events.push({ tick: onTick,  type: 0x90 | (t.channel ?? 0) , pitch: n.pitch, vel })
        events.push({ tick: offTick, type: 0x80 | (t.channel ?? 0), pitch: n.pitch, vel: 0 })
      }

      events.sort((a, b) => a.tick !== b.tick ? a.tick - b.tick : a.type - b.type)

      const bytes = []
      let cursor  = 0

      if (t.name) {
        const nameBytes = Array.from(t.name, c => c.charCodeAt(0) & 0xff)
        bytes.push(0x00, 0xff, 0x03, ...vlq(nameBytes.length), ...nameBytes)
      }

      const instrument = Math.max(0, Math.min(127, t.instrument ?? 0))

      bytes.push(
        0x00,
        0xc0 | (t.channel ?? 0),
        instrument
      )

      for (const ev of events) {
        const delta = ev.tick - cursor
        cursor      = ev.tick
        bytes.push(...vlq(delta), ev.type, ev.pitch, ev.vel)
      }

      bytes.push(0x00, 0xff, 0x2f, 0x00)
      return mtrk(bytes)
    })

  if (noteTracks.length === 0) {
    noteTracks.push(mtrk([0x00, 0xff, 0x2f, 0x00]))
  }

  const numTracks = 1 + noteTracks.length

  const header = [
    0x4d, 0x54, 0x68, 0x64,
    ...u32(6),
    ...u16(1),
    ...u16(numTracks),
    ...u16(PPQ),
  ]

  return new Uint8Array([...header, ...tempoTrack, ...noteTracks.flat()])
}
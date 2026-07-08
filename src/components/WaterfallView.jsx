import { useRef, useEffect, useCallback } from 'react'
import { MIN_NOTE, MAX_NOTE, isBlackKey, isCNote, midiToName } from '../constants'
import { useWaterfallEngine } from '../hooks/useWaterfallEngine'

const PIANO_H    = 130   // piano keyboard height at bottom of canvas
const LOOK_AHEAD = 5     // seconds of notes visible above hit line


// ── Piano key layout ──────────────────────────────────────────────────────────
function buildKeyLayout(canvasWidth) {
  let whiteCount = 0
  for (let m = MIN_NOTE; m <= MAX_NOTE; m++) {
    if (!isBlackKey(m)) whiteCount++
  }

  const ww = canvasWidth / whiteCount
  const bw = ww * 0.62
  const bh = PIANO_H * 0.62

  const layout = new Map()
  let wi = 0

  for (let m = MIN_NOTE; m <= MAX_NOTE; m++) {
    if (!isBlackKey(m)) {
      layout.set(m, { x: wi * ww, w: ww, h: PIANO_H, isBlack: false })
      wi++
    }
  }
  for (let m = MIN_NOTE; m <= MAX_NOTE; m++) {
    if (isBlackKey(m)) {
      const left = layout.get(m - 1)
      if (left) layout.set(m, { x: left.x + left.w - bw / 2, w: bw, h: bh, isBlack: true })
    }
  }
  return { layout, ww, bw }
}

// ── roundRect helper (Canvas2D API not universally supported yet) ─────────────
function rRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ── Main component ────────────────────────────────────────────────────────────
export function WaterfallView({ notes, playhead, bpm, theme, isPlaying, wfZoom = 1 }) {
  const canvasRef  = useRef(null)
  const layoutRef  = useRef(null)
  const rafRef     = useRef(null)

  // Keep fresh refs so the rAF closure never goes stale
  const phRef      = useRef(playhead)
  const notesRef   = useRef(notes)
  const bpmRef     = useRef(bpm)
  const themeRef   = useRef(theme)
  const playingRef = useRef(isPlaying)
  const wfZoomRef = useRef(wfZoom)

  useEffect(() => { phRef.current      = playhead  }, [playhead])
  useEffect(() => { notesRef.current   = notes     }, [notes])
  useEffect(() => { bpmRef.current     = bpm       }, [bpm])
  useEffect(() => { themeRef.current   = theme     }, [theme])
  useEffect(() => { playingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { wfZoomRef.current  = wfZoom    }, [wfZoom])

  const { updateActive, tickParticles, getParticles, clearParticles } = useWaterfallEngine()

  useEffect(() => {
    if (!isPlaying) clearParticles()
  }, [isPlaying, clearParticles])


  // Resize observer → rebuild key layout
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rebuild = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      layoutRef.current = buildKeyLayout(canvas.width)
    }
    const ro = new ResizeObserver(rebuild)
    ro.observe(canvas)
    rebuild()
    return () => ro.disconnect()
  }, [])

  // Main draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      if (!layoutRef.current) { rafRef.current = requestAnimationFrame(draw); return }

      const ctx   = canvas.getContext('2d')
      const W     = canvas.width
      const H     = canvas.height
      const t     = themeRef.current
      const ph    = phRef.current ?? 0
      const bpmV  = bpmRef.current ?? 120
      const ns    = notesRef.current
      const { layout } = layoutRef.current

      const hitY      = H - PIANO_H
      const secPerCell = 60 / (bpmV * 4)
      const pxPerCell =
        (hitY / LOOK_AHEAD) *
        secPerCell *
        (wfZoomRef.current ?? 1)
      // ── Background ────────────────────────────────────────────────────
      ctx.fillStyle = t.wfBg ?? '#020208'
      ctx.fillRect(0, 0, W, H)

      // Soft radial vignette
      const vig = ctx.createRadialGradient(W/2, hitY*0.6, hitY*0.1, W/2, hitY*0.6, Math.max(W,H)*0.8)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.55)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, hitY)

      // C-note lane subtle tint
      for (let m = MIN_NOTE; m <= MAX_NOTE; m++) {
        if (isCNote(m)) {
          const key = layout.get(m)
          if (key && !key.isBlack) {
            ctx.fillStyle = t.wfLane ?? 'rgba(255,255,255,0.018)'
            ctx.fillRect(key.x, 0, key.w, hitY)
          }
        }
      }

      // ── Falling notes ─────────────────────────────────────────────────
      const { activeIds, activePitches } = updateActive(
        ns, ph,
        t.wfParticle1 ?? '#ff8822',
        t.wfParticle2 ?? '#ffdd66',
        layout,
        hitY
      )

      ns.forEach(n => {
        const key = layout.get(n.pitch)
        if (!key) return

        const noteBottom = hitY - (n.start - ph) * pxPerCell
        const noteTop    = noteBottom - n.dur * pxPerCell

        if (noteBottom < -20 || noteTop > hitY + 4) return

        const noteH      = Math.max(3, noteBottom - noteTop)
        const isActive   = activeIds.has(n.id)

        const noteColor1 = n.trackColor ?? (t.wfNoteTop ?? '#7272ff')
        const noteColor2 = n.trackColor ?? (t.wfNoteBtm ?? '#4848cc')
        const proximity  = Math.max(0, 1 - (noteBottom - hitY) / (pxPerCell * 6) * -1)

        const velAlpha = 0.7 + (n.vel ?? 100) / 127 * 0.3

        ctx.globalAlpha = velAlpha

        // Glow
        if (isActive) {
          ctx.shadowColor = t.wfNoteGlow ?? t.accent ?? '#5a5aff'
          ctx.shadowBlur  = 22
        } else if (proximity > 0.05) {
          ctx.shadowColor = t.wfNoteGlow ?? t.accent ?? '#5a5aff'
          ctx.shadowBlur  = proximity * 14
        } else {
          ctx.shadowBlur = 0
        }

        // Gradient fill
        const g = ctx.createLinearGradient(0, noteTop, 0, noteBottom)

        if (isActive) {
          g.addColorStop(0, '#ffffff')
          g.addColorStop(0.25, noteColor1)
          g.addColorStop(1, noteColor2)
        } else {
          g.addColorStop(0, noteColor1)
          g.addColorStop(1, noteColor2)
        }

        ctx.fillStyle = g
        const nx = key.x + (key.isBlack ? 0.5 : 1)
        const nw = key.w  - (key.isBlack ? 1   : 2)
        rRect(ctx, nx, noteTop, nw, noteH, 3)
        ctx.fill()
        ctx.shadowBlur  = 0
        ctx.globalAlpha = 1
      })

      // ── Hit line ──────────────────────────────────────────────────────
      // Horizontal glow bar
      const hlColor = t.wfHitLine ?? '#ff8800'
      const hl = ctx.createLinearGradient(0, hitY - 12, 0, hitY + 6)
      hl.addColorStop(0,   'rgba(0,0,0,0)')
      hl.addColorStop(0.5, hlColor)
      hl.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.fillStyle  = hl
      ctx.shadowColor = hlColor
      ctx.shadowBlur  = 18
      ctx.fillRect(0, hitY - 2, W, 5)
      ctx.shadowBlur  = 0

      // ── Particles ─────────────────────────────────────────────────────
      tickParticles()
      getParticles().forEach(p => {
        const a = Math.pow(1 - p.life / p.maxLife, 1.4)
        ctx.globalAlpha = a
        ctx.fillStyle   = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur  = 5
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 - p.life / p.maxLife * 0.5), 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1
      ctx.shadowBlur  = 0

      // ── Piano keyboard ────────────────────────────────────────────────
      // White keys
      for (let m = MIN_NOTE; m <= MAX_NOTE; m++) {
        const key = layout.get(m)
        if (!key || key.isBlack) continue
        const isActive = activePitches.has(m)

        if (isActive) {
          // Active key glow gradient
          const kg = ctx.createLinearGradient(0, hitY, 0, hitY + PIANO_H)
          kg.addColorStop(0, t.wfActiveKey  ?? t.accent ?? '#8080ff')
          kg.addColorStop(1, t.wfActiveKey2 ?? '#303090')
          ctx.fillStyle   = kg
          ctx.shadowColor = t.wfActiveKey ?? t.accent ?? '#8080ff'
          ctx.shadowBlur  = 14
        } else {
          ctx.fillStyle  = t.pianoWhite ?? '#d2d2df'
          ctx.shadowBlur = 0
        }

        ctx.fillRect(key.x + 0.5, hitY, key.w - 1, PIANO_H)
        ctx.strokeStyle = t.pianoWhiteBorder ?? '#b0b0c0'
        ctx.lineWidth   = 0.5
        ctx.strokeRect(key.x + 0.5, hitY, key.w - 1, PIANO_H)
        ctx.shadowBlur  = 0

        // C note label
        if (isCNote(m)) {
          ctx.fillStyle  = isActive ? '#fff' : (t.pianoText ?? '#666')
          ctx.font       = `${Math.min(9, key.w * 0.65)}px monospace`
          ctx.textAlign  = 'center'
          ctx.fillText(midiToName(m), key.x + key.w / 2, hitY + PIANO_H - 5)
        }
      }

      // Black keys (drawn on top)
      for (let m = MIN_NOTE; m <= MAX_NOTE; m++) {
        const key = layout.get(m)
        if (!key || !key.isBlack) continue
        const isActive = activePitches.has(m)

        if (isActive) {
          ctx.fillStyle   = t.wfActiveKey ?? t.accent ?? '#8080ff'
          ctx.shadowColor = t.wfActiveKey ?? t.accent ?? '#8080ff'
          ctx.shadowBlur  = 10
        } else {
          ctx.fillStyle  = t.pianoBlack ?? '#222230'
          ctx.shadowBlur = 0
        }

        ctx.fillRect(key.x, hitY, key.w, key.h)
        ctx.shadowBlur = 0
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [updateActive, tickParticles, getParticles])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
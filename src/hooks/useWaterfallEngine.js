import { useRef, useCallback } from 'react'

function makeParticle(x, y, color) {
  const angle = (Math.random() - 0.5) * Math.PI * 1.4
  const speed = 2 + Math.random() * 5
  return {
    x, y,
    vx: Math.sin(angle) * speed,
    vy: -(Math.random() * 5 + 2),
    life: 0,
    maxLife: 25 + Math.floor(Math.random() * 35),
    color,
    size: 0.8 + Math.random() * 2,
  }
}

export function useWaterfallEngine() {
  const particlesRef  = useRef([])
  const prevActiveRef = useRef(new Set()) // note IDs active last frame

  const updateActive = useCallback((notes, playheadCell, color1, color2, layout, hitLineY) => {
    const activePitches = new Set()
    const activeIds = new Set()

    notes.forEach(n => {
      if (playheadCell >= n.start && playheadCell < n.start + n.dur) {
        activeIds.add(n.id)
        activePitches.add(n.pitch)
      }
    })

    // Spawn particles only for notes that JUST became active this frame
    notes.forEach(n => {
      if (activeIds.has(n.id) && !prevActiveRef.current.has(n.id)) {
        const key = layout.get(n.pitch)
        if (key) {
          const cx = key.x + key.w / 2
          for (let i = 0; i < 24; i++) {
            particlesRef.current.push(
              makeParticle(cx, hitLineY, Math.random() > 0.45 ? color1 : color2)
            )
          }
        }
      }
    })

    prevActiveRef.current = activeIds
    return { activeIds, activePitches }
  }, [])

  const tickParticles = useCallback(() => {
    particlesRef.current = particlesRef.current
      .filter(p => p.life < p.maxLife)
      .map(p => ({
        ...p,
        x:  p.x + p.vx,
        y:  p.y + p.vy,
        vy: p.vy + 0.22,   // gravity
        vx: p.vx * 0.97,   // air friction
        life: p.life + 1,
      }))
  }, [])

  const getParticles  = useCallback(() => particlesRef.current, [])

  const clearParticles = useCallback(() => {
    particlesRef.current  = []
    prevActiveRef.current = new Set()
  }, [])

  return { updateActive, tickParticles, getParticles, clearParticles }
}
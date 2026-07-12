import { useEffect, useRef } from 'react'

export default function PlayheadOverlay({
  playheadRef,
  cellW,
  pianoWidth,
  rulerHeight,
  gridHeight,
}) {
  const lineRef = useRef(null)

  useEffect(() => {
    let raf

    const update = () => {
      const line = lineRef.current
      const playhead = playheadRef.current

      if (line) {
        if (playhead == null) {
          line.style.display = 'none'
        } else {
          line.style.display = 'block'

          const x =
            
            playhead * cellW

          line.style.transform =
            `translate3d(${x}px, 0, 0)`

//             console.log({
//     playhead,
//     x: playhead * cellW,
//     cellW,
// })
        }
      }

      raf = requestAnimationFrame(update)
    }

    raf = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(raf)
    }
  }, [
    playheadRef,
    cellW,
    pianoWidth,
  ])

  return (
    <div
      ref={lineRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 2,
        height: "100%",
        background: '#ff3b30',
        pointerEvents: 'none',
        zIndex: 100,
        display: 'none',
        willChange: 'transform',
      }}
    />
  )
}
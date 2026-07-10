import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  CELL_W, CELL_H, PIANO_W, RULER_H,
  MIN_NOTE, MAX_NOTE, TOTAL_NOTES, BEATS, SUBS,
  midiToName, isBlackKey, isCNote, MODES
} from '../constants'
import { useTheme } from '../context/ThemeContext'

// ── Layout constants ──────────────────────────────────────────────────────────

const GRID_H = TOTAL_NOTES * CELL_H
const RESIZE_PX = 8
const safeNum = v => (Number.isFinite(v) ? v : 0)

// ── Coordinate helpers ────────────────────────────────────────────────────────
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const pitchToY = p => (MAX_NOTE - p) * CELL_H
const yToPitch = y => MAX_NOTE - Math.floor(y / CELL_H)
const xToCol = (x, cellW) => Math.floor(x / cellW)

const toGrid = (mainRef, e, totalCells, cellW) => {
  const m = mainRef.current
  if (!m) return null
  const r = m.getBoundingClientRect()

  const px = e.clientX - r.left + m.scrollLeft
  const py = e.clientY - r.top + m.scrollTop

  return {
    px,
    py,
    col: clamp(xToCol(px, cellW), 0, totalCells - 1),
    pitch: clamp(yToPitch(py), MIN_NOTE, MAX_NOTE),
  }
}

const findNote = (notes, pitch, col) => {
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i]
    if (n.pitch === pitch && col >= n.start && col < n.start + n.dur) return n
  }
  return null
}



// ── PianoRoll ─────────────────────────────────────────────────────────────────
export function PianoRoll({
  notes,
  ghostTracks = [], activeTrackColor,
  playhead,
  playStartCell,
  onSetPlayStart,
  totalCells,
  durCells,
  mode,
  zoomX,
  selectedIds, onToggleNote, onPreviewNote,
  onUpdateNotes, onSelectNotes, onDeselectAll, onToggleSelect,
}) {
  // console.count("PianoRoll")
  const { theme } = useTheme()
  const cellW = CELL_W * zoomX
  const [ghost, setGhost] = useState(null)
  const [dragPreview, setDragPreview] = useState(null)
  const [boxSel, setBoxSel] = useState(null)
  const [gridCursor, setGridCursor] = useState('crosshair')

  const mainRef = useRef(null)
  const keysRef = useRef(null)
  const rulerRef = useRef(null)
  const dragRef = useRef(null)
  const dragPreviewRef = useRef(null)

  const gridW = totalCells * cellW;

  const handleRulerClick = (e) => {
  const el = rulerRef.current
  if (!el) return

  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left + el.scrollLeft

  onSetPlayStart(
    Math.max(
      0,
      Math.min(totalCells - 1, Math.floor(x / cellW))
    )
  )
}

  const isSelectMode = mode === MODES.SELECT

  // Always-fresh snapshot for window handlers
  const snap = useRef({})
  snap.current = {
    notes,
    selectedIds,
    onUpdateNotes,
    onSelectNotes,
    onDeselectAll,
    onToggleSelect,
  }

  // ── Scroll sync ────────────────────────────────────────────────────────────
  const onScroll = useCallback(() => {
    const m = mainRef.current
    if (!m) return
    if (keysRef.current) keysRef.current.scrollTop = m.scrollTop
    if (rulerRef.current) rulerRef.current.scrollLeft = m.scrollLeft
  }, [])

  useEffect(() => {
    const m = mainRef.current
    if (!m) return
    m.scrollTop = pitchToY(60) - m.clientHeight / 2
  }, [])

  useEffect(() => {
    if (playhead === null) return
    const m = mainRef.current
    if (!m) return
    const x = playhead * cellW

    if (x > m.scrollLeft + m.clientWidth - cellW * 8) {
      m.scrollLeft = x - m.clientWidth * 0.3
    }
  }, [playhead])

  // Clear transient drag state when switching modes
  useEffect(() => {
    setGhost(null)
    setDragPreview(null)
    setBoxSel(null)
    dragRef.current = null
    setGridCursor('crosshair')
  }, [mode])

  // ── Global drag handlers ───────────────────────────────────────────────────
useEffect(() => {
  const onMove = (e) => {
    if (!dragRef.current) return
    const g = toGrid(mainRef, e, totalCells, cellW)
    if (!g) return

    const drag = dragRef.current

    if (drag.type === 'box') {
      drag.endPx = g.px
      drag.endPy = g.py
      setBoxSel({ x1: drag.startPx, y1: drag.startPy, x2: drag.endPx, y2: drag.endPy })
      return
    }

    if (drag.type === 'resize') {
      const note = snap.current.notes.find(n => n.id === drag.noteId)
      if (!note) return

      const preview = {
        type: 'resize',
        noteId: drag.noteId,
        newDur: clamp(g.col - note.start + 1, 1, totalCells - note.start),
      }
      dragPreviewRef.current = preview
      setDragPreview(preview)
      setGridCursor('ew-resize')
      return
    }

    if (drag.type === 'move') {
      const preview = {
        type: 'move',
        deltaCol: g.col - drag.startCol,
        deltaPitch: g.pitch - drag.startPitch,
        ids: drag.movedIds,
      }
      dragPreviewRef.current = preview
      setDragPreview(preview)
      setGridCursor('grabbing')
    }
  }

  const onUp = (e) => {
    if (!dragRef.current) return
    const drag = dragRef.current
    const preview = dragPreviewRef.current
    const { notes, onUpdateNotes, onSelectNotes } = snap.current

    if (drag.type === 'box') {
      const x1 = drag.startPx ?? 0
      const y1 = drag.startPy ?? 0
      const x2 = drag.endPx ?? x1
      const y2 = drag.endPy ?? y1

      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)

      const col1 = xToCol(minX, cellW)
      const col2 = xToCol(maxX, cellW)
      const p1 = yToPitch(minY)
      const p2 = yToPitch(maxY)
      const pMin = Math.min(p1, p2)
      const pMax = Math.max(p1, p2)

      const inBox = notes.filter(n =>
        n.start <= col2 &&
        (n.start + n.dur - 1) >= col1 &&
        n.pitch >= pMin &&
        n.pitch <= pMax
      )

      if (inBox.length) onSelectNotes(inBox.map(n => n.id), !e.shiftKey)
      else if (!e.shiftKey) onDeselectAll()
    }

    if (drag.type === 'resize' && preview?.type === 'resize') {
      onUpdateNotes([{ id: drag.noteId, dur: preview.newDur }])
    }

    if (drag.type === 'move' && preview?.type === 'move') {
      const { deltaCol, deltaPitch } = preview
      if (deltaCol !== 0 || deltaPitch !== 0) {
        onUpdateNotes(
          drag.origNotes.map(o => ({
            id: o.id,
            start: clamp(o.start + deltaCol, 0, totalCells - o.dur),
            pitch: clamp(o.pitch + deltaPitch, MIN_NOTE, MAX_NOTE),
          }))
        )
      }
      onSelectNotes(drag.origNotes.map(n => n.id), true)
    }

    dragRef.current = null
    dragPreviewRef.current = null
    setDragPreview(null)
    setBoxSel(null)
    setGridCursor('crosshair')
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  return () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
}, [onDeselectAll, totalCells, MIN_NOTE, MAX_NOTE, onSelectNotes, onUpdateNotes])

  // ── Draw mode handlers ─────────────────────────────────────────────────────
const handleDrawClick = (e) => {
  if (e.button !== 0) return
  const g = toGrid(mainRef, e, totalCells, cellW)
  if (g) onToggleNote(g.pitch, g.col)
}

  const handleDrawMouseMove = (e) => {
    const g = toGrid(mainRef, e, totalCells, cellW)
    setGhost(g ? { pitch: g.pitch, start: g.col } : null)
  }

  // ── Select mode handlers ───────────────────────────────────────────────────
  const handleSelectMouseDown = (e) => {
    e.preventDefault()
    if (e.button !== 0) return

    const g = toGrid(mainRef, e, totalCells, cellW)
    if (!g) return

    const note = findNote(notes, g.pitch, g.col)

    // Empty space => box select
    if (!note) {
      if (!e.shiftKey) onDeselectAll()
      dragRef.current = {
        type: 'box',
        startPx: g.px,
        startPy: g.py,
        endPx: g.px,
        endPy: g.py,
      }
      setBoxSel({ x1: g.px, y1: g.py, x2: g.px, y2: g.py })
      setDragPreview(null)
      setGridCursor('crosshair')
      return
    }

    // Shift-click toggles selection only
    if (e.shiftKey) {
      onToggleSelect(note.id)
      return
    }

    // Clicking a note without shift:
    // - if it is not selected, select it
    // - if it is selected, keep the existing multi-selection
    const effectiveIds = selectedIds.has(note.id)
      ? new Set(selectedIds)
      : new Set([note.id])

    if (!selectedIds.has(note.id)) {
      onSelectNotes([note.id], true)
    }

   const noteRightPx = (note.start + note.dur) * cellW
    const isEdge = g.px >= noteRightPx - RESIZE_PX

    if (isEdge) {
      dragRef.current = { type: 'resize', noteId: note.id }
      setGridCursor('ew-resize')
    } else {
      const toMove = notes.filter(n => effectiveIds.has(n.id))
      dragRef.current = {
        type: 'move',
        startCol: g.col,
        startPitch: g.pitch,
        origNotes: toMove.map(n => ({
          id: n.id,
          start: n.start,
          pitch: n.pitch,
          dur: n.dur,
        })),
        movedIds: new Set(toMove.map(n => n.id)),
      }
      setGridCursor('grabbing')
    }

    setDragPreview(null)
  }

  const handleSelectMouseMove = (e) => {
    if (dragRef.current) return
    const g = toGrid(mainRef, e, totalCells, cellW)
    if (!g) {
      setGridCursor('crosshair')
      return
    }

    const note = findNote(notes, g.pitch, g.col)
    if (!note) {
      setGridCursor('crosshair')
    } else if (g.px >= (note.start + note.dur) * cellW - RESIZE_PX) {
      setGridCursor('ew-resize')
    } else {
      setGridCursor('grab')
    }
  }

 

  const ghostBlocked = ghost && notes.some(
    n => n.pitch === ghost.pitch &&
      ghost.start >= n.start &&
      ghost.start < n.start + n.dur
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* ── Ruler row ── */}
      <div style={{ display: 'flex', height: RULER_H, flexShrink: 0 }}>
        <div
          style={{
            width: PIANO_W,
            flexShrink: 0,
            background: theme.rulerBg,
            borderRight: `1px solid ${theme.borderAlt}`,
            borderBottom: `1px solid ${theme.borderAlt}`,
          }}
        />
        <div
          ref={rulerRef}
          onClick={handleRulerClick}
          style={{ flex: 1, overflow: 'hidden', borderBottom: `1px solid ${theme.borderAlt}` }}
        >
          <Ruler
              theme={theme}
              totalCells={totalCells}
              cellW={cellW}
            />
        </div>
      </div>

      {/* ── Main row ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div
          ref={keysRef}
          style={{
            width: PIANO_W,
            flexShrink: 0,
            overflow: 'hidden',
            borderRight: `1px solid ${theme.borderAlt}`,
          }}
        >
          <PianoKeys onPreviewNote={onPreviewNote} theme={theme} />
        </div>

        <div ref={mainRef} onScroll={onScroll} style={{ flex: 1, overflow: 'auto' }}>
          <div
            onMouseDown={isSelectMode ? handleSelectMouseDown : handleDrawClick}
            onMouseMove={isSelectMode ? handleSelectMouseMove : handleDrawMouseMove}
            onMouseLeave={() => {
              setGhost(null)
              if (isSelectMode && !dragRef.current) setGridCursor('crosshair')
            }}
            style={{
              position: 'relative',
              width: gridW,
              height: GRID_H,
              cursor: isSelectMode ? gridCursor : 'crosshair',
              userSelect: 'none',
            }}
          >
            <GridBackground
              theme={theme}
              totalCells={totalCells}
              cellW={cellW}
            />

            {/* Ghost notes from other tracks */}
            <GhostNotesLayer
                ghostTracks={ghostTracks}
                cellW={cellW}
            />

            <NotesLayer
              notes={notes}
              // effectiveNote={effectiveNote}
              dragPreview={dragPreview}
              selectedIds={selectedIds}
              theme={theme}
              cellW={cellW}
              activeTrackColor={activeTrackColor}
          />

            {ghost && !ghostBlocked && !isSelectMode && (
              <div
                style={{
                  position: 'absolute',
                  left: safeNum(ghost?.start) * cellW + 1,
                  top: pitchToY(ghost.pitch) + 1,
                  width: durCells * cellW - 2,
                  height: CELL_H - 2,
                  background: theme.ghostBg,
                  border: `1px solid ${theme.ghostBorder}`,
                  borderRadius: 2,
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              />
            )}

            {boxSel && isSelectMode && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.min(boxSel.x1, boxSel.x2),
                  top: Math.min(boxSel.y1, boxSel.y2),
                  width: Math.abs(boxSel.x2 - boxSel.x1),
                  height: Math.abs(boxSel.y2 - boxSel.y1),
                  border: `1px solid ${theme.accent}`,
                  background: theme.selBg,
                  pointerEvents: 'none',
                  zIndex: 12,
                }}
              />
            )}

            {playStartCell !== null && (
              <div
                style={{
                  position: 'absolute',
                  left: safeNum(playStartCell) * cellW,
                  top: 0,
                  width: 2,
                  height: GRID_H,
                  background: theme.accent,
                  opacity: 0.7,
                  pointerEvents: 'none',
                  zIndex: 18,
                }}
              />
            )}

            {playhead !== null && (
              <div
                style={{
                  position: 'absolute',
                  left: safeNum(playhead) * cellW,
                  top: 0,
                  width: 2,
                  height: GRID_H,
                  background: theme.playhead,
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── GridBackground ────────────────────────────────────────────────────────────
function GridBackground({ theme, totalCells, cellW }) {
  const gridW = totalCells * cellW
  const totalBeats = Math.ceil(totalCells / SUBS)

  return (
    <svg
      style={{ position: 'absolute', inset: 0, display: 'block', pointerEvents: 'none' }}
      width={gridW}
      height={GRID_H}
    >
      {Array.from({ length: TOTAL_NOTES }, (_, i) => {
        const pitch = MAX_NOTE - i
        return (
          <rect
            key={pitch}
            x={0}
            y={i * CELL_H}
            width={gridW}
            height={CELL_H}
            fill={isBlackKey(pitch) ? theme.bgGridBlack : theme.bgGrid}
          />
        )
      })}

      {Array.from({ length: totalBeats + 1 }, (_, i) => {
        const isBar = i % 4 === 0
        return (
          <line
            key={`v${i}`}
            x1={i * SUBS * cellW}
            y1={0}
            x2={i * SUBS * cellW}
            y2={GRID_H}
            stroke={isBar ? theme.gridLineBar : theme.gridLineBeat}
            strokeWidth={isBar ? 1.5 : 0.5}
          />
        )
      })}

      {Array.from({ length: TOTAL_NOTES + 1 }, (_, i) => (
        <line
          key={`h${i}`}
          x1={0}
          y1={i * CELL_H}
          x2={gridW}
          y2={i * CELL_H}
          stroke={theme.borderAlt}
          strokeWidth={0.5}
        />
      ))}
    </svg>
  )
}

// ── NoteBlock ────────────────────────────────────────────────────────────────
function NoteBlock({ note, selected, theme, cellW, trackColor }) {
  const x = note.start * cellW + 1
  const y = pitchToY(note.pitch) + 1
  const w = note.dur * cellW - 2
  const h = CELL_H - 2

  const baseColor = trackColor ?? theme.noteGrad1
  const gradient = selected
  ? `linear-gradient(180deg, ${theme.noteSelGrad1} 0%, ${theme.noteSelGrad2} 100%)`
  : `linear-gradient(180deg, ${baseColor}dd 0%, ${baseColor}99 100%)`

  const shadow = selected ? theme.noteSelShadow : theme.noteShadow

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        background: gradient,
        borderRadius: 2,
        boxShadow: `0 0 6px ${shadow}`,
        outline: selected ? `1px solid ${theme.selBorder}` : 'none',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 3,
        overflow: 'hidden',
        fontSize: 8,
        color: 'rgba(255,255,255,0.8)',
        zIndex: selected ? 6 : 5,
      }}
    >
      {w > 22 ? midiToName(note.pitch) : ''}
      {w > 12 && (
        <div
          style={{
            position: 'absolute',
            left: 2,
            right: 2,
            bottom: 1,
            height: 2,
            borderRadius: 999,
            background: theme.velBg,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${clamp((note.vel ?? 100) / 127, 0, 1) * 100}%`,
              height: '100%',
              background: theme.velBar,
            }}
          />
        </div>
      )}
    </div>
  )
}

const GhostNotesLayer = React.memo(function GhostNotesLayer({
    ghostTracks,
    cellW
}) {

    // console.count("GhostNotesLayer")

    return (
        <>
            {ghostTracks.map(({ color, notes: gNotes }) =>
                gNotes.map(note => (
                    <GhostNote
                        key={note.id}
                        note={note}
                        color={color}
                        cellW={cellW}
                    />
                ))
            )}
        </>
    )
})

function GhostNote({
    note,
    color,
    cellW
}) {

    return (
        <div
            style={{
                position: 'absolute',
                left: note.start * cellW + 1,
                top: pitchToY(note.pitch) + 1,
                width: Math.max(4, note.dur * cellW - 2),
                height: CELL_H - 2,
                background: color,
                opacity: 0.18,
                borderRadius: 2,
                pointerEvents: 'none',
                zIndex: 3,
            }}
        />
    )
}

const NotesLayer = React.memo(function NotesLayer({
    notes,
    dragPreview,
    selectedIds,
    theme,
    cellW,
    activeTrackColor
}) {
    // console.count("NotesLayer")

     // ── Visual drag preview ────────────────────────────────────────────────────
  const effectiveNote = (n) => {
    if (!dragPreview) return n

    if (dragPreview.type === 'resize' && dragPreview.noteId === n.id) {
      return { ...n, dur: dragPreview.newDur }
    }

    if (dragPreview.type === 'move' && dragPreview.ids?.has(n.id)) {
      return {
        ...n,
        start: clamp(n.start + dragPreview.deltaCol, 0),
        pitch: clamp(n.pitch + dragPreview.deltaPitch, MIN_NOTE, MAX_NOTE),
      }
    }

    return n
  }

    return (
        <>
            {notes.map(n => (
                <NoteBlock
                    key={n.id}
                    note={effectiveNote(n)}
                    selected={selectedIds?.has(n.id)}
                    theme={theme}
                    cellW={cellW}
                    trackColor={activeTrackColor}
                />
            ))}
        </>
    )
})

// ── Ruler ─────────────────────────────────────────────────────────────────────
function Ruler({ theme, totalCells, cellW }) {
  const totalBeats = Math.ceil(totalCells / SUBS)
  const gridW = totalCells * cellW

  return (
    <svg width={gridW} height={RULER_H} style={{ display: 'block', background: theme.rulerBg }}>
      {Array.from({ length: totalBeats }, (_, beat) => {
        const bx = beat * SUBS * cellW
        const isBarStart = beat % 4 === 0
        const barNumber = Math.floor(beat / 4) + 1

        return (
          <g key={beat}>
            <line
              x1={bx}
              y1={0}
              x2={bx}
              y2={RULER_H}
              stroke={theme.rulerLine}
              strokeWidth={isBarStart ? 1 : 0.75}
            />
            {isBarStart && (
              <text
                x={bx + 3}
                y={RULER_H - 4}
                fill={theme.rulerText}
                fontSize={9}
                fontFamily="monospace"
              >
                {barNumber}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── PianoKeys ────────────────────────────────────────────────────────────────
function PianoKeys({ onPreviewNote, theme }) {
  return (
    <div style={{ position: 'relative', width: PIANO_W, height: GRID_H, background: theme.rulerBg }}>
      {Array.from({ length: TOTAL_NOTES }, (_, i) => {
        const pitch = MAX_NOTE - i
        const black = isBlackKey(pitch)
        const isC = isCNote(pitch)

        return (
          <div
            key={pitch}
            onClick={() => onPreviewNote(pitch)}
            title={midiToName(pitch)}
            style={{
              position: 'absolute',
              top: i * CELL_H,
              right: 0,
              left: black ? Math.round(PIANO_W * 0.38) : 0,
              height: CELL_H - 0.5,
              background: black ? theme.pianoBlack : theme.pianoWhite,
              borderTop: `0.5px solid ${black ? theme.pianoBlackBorder : theme.pianoWhiteBorder}`,
              borderLeft: `1px solid ${black ? theme.pianoBlackBorder : theme.pianoWhiteBorder}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: 4,
              userSelect: 'none',
              zIndex: black ? 1 : 0,
              fontSize: 7,
              color: black ? theme.pianoBlackText : theme.pianoText,
            }}
          >
            {isC && <span>{midiToName(pitch)}</span>}
          </div>
        )
      })}
    </div>
  )
}
import { useRef } from 'react'
import { DUR_OPTIONS, MODES, THEMES } from '../constants'
import { useTheme } from '../context/ThemeContext'

export function Toolbar({
  bpm, onBpmChange, durCells, onDurChange,
  isPlaying, onPlayToggle, onClear, onDemo, noteCount,
  mode, onModeChange, selectedIds, notes,
  onVelocityChange, onDeleteSelected, onMidiImport,
  playStartCell, onResetPlayStart,
  totalBars, barsToAdd, onBarsToAddChange, onAddBars,
  view, onViewChange, 
  zoomX, onZoomChange,
  wfZoom, onWfZoomChange,
  onSaveProject, onLoadProject, onExportMidi,
  canUndo, canRedo, onUndo, onRedo,
}) {
    
  const loadRef = useRef(null)
  const { theme, themeKey, setTheme } = useTheme()
  const fileRef = useRef(null)

  const selectedNotes = notes.filter(n => selectedIds.has(n.id))
  const avgVel = selectedNotes.length
    ? Math.round(selectedNotes.reduce((s, n) => s + n.vel, 0) / selectedNotes.length)
    : null

  const btn = (active, color) => ({
    padding: '6px 12px', // Slightly taller touch targets for mobile
    borderRadius: 4, 
    border: 'none', 
    cursor: 'pointer',
    fontSize: 12, 
    fontWeight: 600,
    background: active ? theme.btnActive : theme.btnInactive,
    color: color ?? (active ? theme.btnText : theme.btnTextInactive),
    transition: 'background 0.12s',
    flexShrink: 0,
  })

  const div = { width: 1, height: 24, background: theme.border, flexShrink: 0 }

  const inp = {
    background: theme.inputBg, 
    border: `1px solid ${theme.inputBorder}`,
    color: theme.inputText, 
    borderRadius: 4, 
    padding: '4px 6px', // Balanced padding for mobile inputs
    fontSize: 12, 
    cursor: 'pointer',
    flexShrink: 0,
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      padding: '4px 0',
      background: theme.bgPanel,
      fontFamily: 'system-ui, sans-serif',
      boxSizing: 'border-box',
    }}>
      {/* Responsive adjustments */}
      <style>{`
        .toolbar-row::-webkit-scrollbar {
          display: none;
        }
        @media (max-width: 768px) {
          .desktop-only-shortcuts {
            display: none !important;
          }
        }
      `}</style>

      {/* ───────────────── ROW 1 ───────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'nowrap',
        gap: 8,
        overflowX: 'auto',
        overflowY: 'visible', // Prevents native elements from clipping
        padding: '6px 12px',   // Extra breathing room
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }} className="toolbar-row">

        {/* Play / Stop */}
        <button
          onClick={onPlayToggle}
          style={{
            ...btn(true),
            fontSize: 15,
            padding: '4px 14px',
            background: isPlaying
              ? theme.accentDanger
              : theme.accentPlay,
          }}
        >
          {isPlaying ? '⏹' : '▶'}
        </button>

        <button
          onClick={onResetPlayStart}
          style={btn(false)}
        >
          ↺ Start
        </button>

        <span style={{
          fontSize: 11,
          color: theme.textFaint,
          whiteSpace: 'nowrap',
        }}>
          Start: {playStartCell + 1}
        </span>

        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ ...btn(false), opacity: canUndo ? 1 : 0.35 }}
        >
          ⟲
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={{ ...btn(false), opacity: canRedo ? 1 : 0.35 }}
        >
          ⟳
        </button>
        
        <div style={div} />

        {/* BPM */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 12,
          color: theme.textDim,
          whiteSpace: 'nowrap',
        }}>
          BPM

          <input
            type="number"
            value={bpm}
            min={40}
            max={300}
            onChange={e => {
        onBpmChange(Number(e.target.value))
          }}
        onBlur={e => {
          const bpm = Math.max(
            40,
            Math.min(
              300,
              Number(e.target.value) || 120
            )
          )
        
          onBpmChange(bpm)
        }}
            style={{
              ...inp,
              width: 54,
            }}
          />
        </label>

        <div style={div} />

        {/* Mode */}
        <span style={{
          fontSize: 11,
          color: theme.textDim,
          whiteSpace: 'nowrap',
        }}>
          Mode:
        </span>

        <button
          onClick={() => onModeChange(MODES.DRAW)}
          style={{
            ...btn(mode === MODES.DRAW),
            position: 'relative',
            paddingRight: 18,
          }}
        >
          ✏️ Draw

          <span style={{
            position: 'absolute',
            top: 2,
            right: 4,
            fontSize: 9,
            opacity: 0.7,
          }}>
            1
          </span>
        </button>

        <button
          onClick={() => onModeChange(MODES.SELECT)}
          style={{
            ...btn(mode === MODES.SELECT),
            position: 'relative',
            paddingRight: 18,
          }}
        >
          ⬚ Select

          <span style={{
            position: 'absolute',
            top: 2,
            right: 4,
            fontSize: 9,
            opacity: 0.7,
          }}>
            4
          </span>
        </button>

        {/* Draw mode options */}
        {mode === MODES.DRAW && DUR_OPTIONS.length > 0 && (
          <>
            <div style={div} />
            <span style={{
              fontSize: 11,
              color: theme.textDim,
              whiteSpace: 'nowrap',
            }}>
              Note:
            </span>

            {DUR_OPTIONS.map(opt => (
              <button
                key={opt.cells}
                onClick={() => onDurChange(opt.cells)}
                style={btn(durCells === opt.cells)}
              >
                {opt.label}
              </button>
            ))}
          </>
        )}

        {/* Select mode options */}
        {mode === MODES.SELECT && selectedNotes.length > 0 && (
          <>
            <div style={div} />
            <span style={{
              fontSize: 11,
              color: theme.textDim,
              whiteSpace: 'nowrap',
            }}>
              {selectedNotes.length} selected
            </span>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: theme.textDim,
            }}>
              Vel:

              <input
                type="range"
                min={1}
                max={127}
                value={avgVel ?? 100}
                onChange={e =>
                  onVelocityChange(
                    selectedIds,
                    Number(e.target.value)
                  )
                }
                style={{
                  width: 80,
                  accentColor: theme.accent,
                }}
              />

              <span style={{
                color: theme.text,
                fontWeight: 600,
                minWidth: 24,
              }}>
                {avgVel}
              </span>
            </label>

            <button
              onClick={onDeleteSelected}
              style={{
                ...btn(false),
                color: theme.accentDanger,
              }}
            >
              🗑 Delete
            </button>
          </>
        )}

      </div>

      {/* ───────────────── ROW 2 ───────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'nowrap',
        gap: 8,
        overflowX: 'auto',
        overflowY: 'visible', // Fixes clipping on native elements
        padding: '6px 12px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }} className="toolbar-row">

        {/* Utilities */}
        <button
          onClick={onDemo}
          style={btn(false)}
        >
          Demo
        </button>

        <button
          onClick={onClear}
          style={{
            ...btn(false),
            color: theme.accentDanger,
          }}
        >
          Clear
        </button>

        <div style={div} />

        {/* Project Actions */}
        <button onClick={onSaveProject} style={btn(false)}>Save Project</button>
        <button onClick={() => loadRef.current?.click()} style={btn(false)}>Load Project</button>
        <button onClick={onExportMidi} style={btn(false)}>Export MIDI</button>

        <input
          ref={loadRef}
          type="file"
          accept=".json,.midiroll"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) {
              onLoadProject(f)
              e.target.value = ''
            }
          }}
        />

        <button
          onClick={() => fileRef.current?.click()}
          style={btn(false)}
        >
          Import MIDI
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".mid,.midi"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) {
              onMidiImport(file)
              e.target.value = ''
            }
          }}
        />

        <div style={div} />

        {/* Bars management */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: theme.textDim,
          whiteSpace: 'nowrap',
        }}>
          Add bars

          <input
            type="number"
            min={1}
            max={32}
            value={barsToAdd}
            onChange={e =>
              onBarsToAddChange(
                Math.max(
                  1,
                  Math.min(32, Number(e.target.value) || 1)
                )
              )
            }
            style={{
              ...inp,
              width: 52,
            }}
          />
        </label>

        <button
          onClick={onAddBars}
          style={btn(false)}
        >
          + Extend
        </button>

        <span style={{
          fontSize: 11,
          color: theme.textFaint,
          whiteSpace: 'nowrap',
        }}>
          Length: {totalBars} bars
        </span>

        <div style={div} />

        {/* Zoom Engine */}
        {view === 'editor' && (
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: theme.textDim,
            whiteSpace: 'nowrap',
          }}>
            Zoom
      
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.1}
              value={zoomX}
              onChange={e => onZoomChange(Number(e.target.value))}
              style={{
                width: 120,
                accentColor: theme.accent,
              }}
            />
        
            <span style={{
              minWidth: 32,
              color: theme.text,
              fontWeight: 600,
            }}>
              {zoomX.toFixed(1)}x
            </span>
          </label>
        )}

        {view === 'waterfall' && (
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            color: theme.textDim,
            whiteSpace: 'nowrap',
          }}>
            Waterfall zoom

            <input
              type="range"
              min={0.5}
              max={4}
              step={0.1}
              value={wfZoom}
              onChange={e => onWfZoomChange(Number(e.target.value))}
              style={{
                width: 120,
                accentColor: theme.accent
              }}
            />

            <span style={{
              minWidth: 32,
              color: theme.text,
              fontWeight: 600
            }}>
              {wfZoom.toFixed(1)}x
            </span>
          </label>
        )}

        <div style={div} />

        {/* View toggles */}
        <span style={{ fontSize: 11, color: theme.textDim, whiteSpace: 'nowrap' }}>View:</span>
        <button
          onClick={() => onViewChange('editor')}
          style={btn(view === 'editor')}
        >
          ✏️ Editor
        </button>
        <button
          onClick={() => onViewChange('waterfall')}
          style={btn(view === 'waterfall')}
        >
          🎹 Waterfall
        </button>
        
        <div style={div} />

        {/* Theme Select */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: theme.textDim,
          whiteSpace: 'nowrap',
        }}>
          Theme:

          <select
            value={themeKey}
            onChange={e => setTheme(e.target.value)}
            style={inp}
          >
            {Object.entries(THEMES).map(([k, t]) => (
              <option key={k} value={k}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {/* Note Counter & Shortcuts status */}
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: theme.textFaint,
          whiteSpace: 'nowrap',
          paddingLeft: 16,
        }}>
          {noteCount} notes
          <span className="desktop-only-shortcuts">
             · Space=play · Del=delete selected · Z–M / Q–U = piano
          </span>
        </span>

      </div>
    </div>
  )
}
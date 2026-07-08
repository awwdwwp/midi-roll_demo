import { useState, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'
import { TRACK_COLORS } from '../constants'
import { InstrumentSelector } from './InstrumentSelector'

export function TrackList({
  tracks,
  activeTrackId,
  onSelectTrack,
  onAddTrack,
  onDeleteTrack,
  onDuplicateTrack,
  onToggleMute,
  onToggleSolo,
  onUpdateTrack,
  isOpen,
  onToggleOpen,
}) {
  const { theme } = useTheme()
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [colorPickerId, setColorPickerId] = useState(null)
  const inputRef = useRef(null)

  const hasSolo = tracks.some(t => t.solo)

  const commitRename = (id) => {
    if (editName.trim()) onUpdateTrack(id, { name: editName.trim() })
    setEditingId(null)
  }

  const s = {
    sidebar: {
      width: isOpen ? 310 : 42,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: `1px solid ${theme.border}`,
      background: theme.bgPanel,
      transition: 'width 0.18s ease',
      overflow: 'hidden',
      minHeight: 0,
    },
    toggle: {
      height: 42,
      border: 'none',
      background: theme.bgPanel,
      color: theme.textDim,
      cursor: 'pointer',
      borderBottom: `1px solid ${theme.border}`,
      fontWeight: 700,
    },
    body: {
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      overflowY: 'auto',
      overflowX: 'visible',
      minHeight: 0,
    },
    track: (active) => ({
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: 10,
      borderRadius: 10,
      cursor: 'pointer',
      border: `1px solid ${active ? theme.accent : theme.border}`,
      background: active ? theme.selBg : theme.bgPanel,
      position: 'relative',
      userSelect: 'none',
    }),
    topRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    name: (active, dimmed) => ({
      fontSize: 13,
      fontWeight: active ? 700 : 600,
      color: dimmed ? theme.textFaint : (active ? theme.text : theme.textDim),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: 0,
      flex: 1,
    }),
    meta: {
      fontSize: 11,
      color: theme.textFaint,
    },
    btnRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
    },
    btn: (active, color) => ({
      border: `1px solid ${active ? color ?? theme.accent : theme.border}`,
      background: active ? (color ?? theme.accent) + '22' : 'transparent',
      color: active ? (color ?? theme.text) : theme.textDim,
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 7px',
    }),
    addBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px 10px',
      borderRadius: 10,
      cursor: 'pointer',
      border: `1px dashed ${theme.border}`,
      background: 'transparent',
      color: theme.textDim,
      fontSize: 12,
      fontWeight: 700,
    },
    colorRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 6,
      alignItems: 'center',
    },
    swatch: (color, selected) => ({
      width: 24,
      height: 24,
      borderRadius: 999,
      background: color,
      border: selected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
      cursor: 'pointer',
      boxShadow: `0 0 4px ${color}66`,
    }),
    customColorWrap: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      gridColumn: 'span 2',
      justifySelf: 'start',
    },
    customColorInput: {
      width: 28,
      height: 28,
      border: 'none',
      background: 'transparent',
      padding: 0,
      cursor: 'pointer',
    },
    pickerWrap: {
      position: 'absolute',
      left: 'calc(100% + 8px)',
      top: 0,
      zIndex: 50,
      background: theme.bgPanel,
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      padding: 8,
      width: 170,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    },
    pickerGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 18px)',
      minWidth: 96,
      gap: 6,
      overflow: 'hidden',
    },
    themeBtn: {
      marginTop: 6,
      width: '100%',
      border: `1px solid ${theme.border}`,
      background: theme.btnInactive,
      color: theme.textDim,
      borderRadius: 5,
      padding: '4px 6px',
      fontSize: 11,
      cursor: 'pointer',
      transition: '0.15s',
    },
  }

  return (
    <aside style={s.sidebar}>
      <button style={s.toggle} onClick={onToggleOpen}>
        {isOpen ? '◀ Tracks' : '▶'}
      </button>

      {isOpen && (
        <div style={s.body}>
          {tracks.map(track => {
            const active = track.id === activeTrackId
            const dimmed = hasSolo && !track.solo

            return (
              <div key={track.id} style={s.track(active)} onClick={() => onSelectTrack(track.id)}>
                <div style={s.topRow}>
                  {editingId === track.id ? (
                    <input
                      ref={inputRef}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => commitRename(track.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename(track.id)
                        if (e.key === 'Escape') setEditingId(null)
                        e.stopPropagation()
                      }}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                      style={{
                        flex: 1,
                        background: theme.inputBg,
                        border: `1px solid ${theme.accent}`,
                        color: theme.text,
                        borderRadius: 6,
                        padding: '4px 6px',
                        fontSize: 12,
                      }}
                    />
                  ) : (
                    <span
                      onDoubleClick={e => {
                        e.stopPropagation()
                        setEditingId(track.id)
                        setEditName(track.name)
                        setColorPickerId(null)
                      }}
                      style={s.name(active, dimmed)}
                    >
                      {track.name}
                    </span>
                  )}

                  <span style={s.meta}>{track.notes.length}</span>
                </div>

                <div style={s.btnRow}>
                  <button style={s.btn(track.muted, theme.accentDanger)} onClick={e => { e.stopPropagation(); onToggleMute(track.id) }}>
                    Mute
                  </button>
                  <button style={s.btn(track.solo, '#ffcc44')} onClick={e => { e.stopPropagation(); onToggleSolo(track.id) }}>
                    Solo
                  </button>
                  <button style={s.btn(false)} onClick={e => { e.stopPropagation(); onDuplicateTrack(track.id) }}>
                    Duplicate
                  </button>
                  {tracks.length > 1 && (
                    <button style={s.btn(false, theme.accentDanger)} onClick={e => { e.stopPropagation(); onDeleteTrack(track.id) }}>
                      Delete
                    </button>
                  )}
                </div>
                {/* Instrument selector */}
                <div style={{ display: 'flex',flexDirection: 'column',
  gap: 3, alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: theme.textFaint, flexShrink: 0 }}>
                    Instrument:
                  </span>
                    <InstrumentSelector
                      value={track.instrument ?? 0}
                      onChange={program =>
                        onUpdateTrack(track.id, {
                          instrument: program
                        })
                      }
                    />
                </div>

                <div style={s.colorRow}>
                  {TRACK_COLORS.map(c => (
                    <div
                      key={c}
                      title="Preset color"
                      onClick={e => { e.stopPropagation(); onUpdateTrack(track.id, { color: c }) }}
                      style={s.swatch(c, track.color === c)}
                    />
                  ))}

                  <div style={s.customColorWrap} onClick={e => e.stopPropagation()}>
                    <input
                      type="color"
                      value={track.color}
                      onChange={e => onUpdateTrack(track.id, { color: e.target.value })}
                      style={s.customColorInput}
                      title="Custom color"
                    />
                    <span style={{ fontSize: 11, color: theme.textDim }}>Custom</span>
                  </div>
                </div>

                {colorPickerId === track.id && (
                  <div style={s.colorPicker} onClick={e => e.stopPropagation()}>
                    {TRACK_COLORS.map(c => (
                      <div
                        key={c}
                        onClick={() => {
                          onUpdateTrack(track.id, {
                            color: c,
                            usesThemeColor: false,
                          })
                          setColorPickerId(null)
                        }}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: c,
                          cursor: 'pointer',
                          outline: track.color === c ? `2px solid #fff` : 'none',
                          outlineOffset: 1,
                        }}
                      />
                    ))}

                    {/* Theme reset button */}
                    <button
                      style={s.themeBtn}
                      onClick={() => {
                        onUpdateTrack(track.id, {
                          color: theme.accent,
                          usesThemeColor: true,
                        })
                        setColorPickerId(null)
                      }}
                    >
                      Use Theme Color
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          <button style={s.addBtn} onClick={onAddTrack}>+ Track</button>
        </div>
      )}
    </aside>
  )
}
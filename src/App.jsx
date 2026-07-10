import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Midi }                from '@tonejs/midi'
import { encodeMidi } from './utils/midiExport'
import { Toolbar }             from './components/Toolbar'
import { PianoRoll }           from './components/PianoRoll'
import { TrackList }           from './components/TrackList'
import { WaterfallView }       from './components/WaterfallView'
import { useAudioEngine }      from './hooks/useAudioEngine'
import { useKeyboard }         from './hooks/useKeyboard'
import { useProjectHistory }   from './hooks/useProjectHistory'
import { useTheme }            from './context/ThemeContext'
import {
  uid, MODES, MIN_NOTE, MAX_NOTE, SUBS,
  DEFAULT_BARS, CELLS_PER_BAR,
  createDefaultProject, TRACK_COLORS,
} from './constants'
//temp
import { loadPreset } from "./audio/gmPresets"
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const { theme } = useTheme()

  // ── Single source of truth ─────────────────────────────────────────────────
  const {
    project,
    pushCommand, pushCommandFn,
    setProjectDirect, resetProject,
    undo, redo, canUndo, canRedo,
  } = useProjectHistory(createDefaultProject(theme.accent))

  // ── Ephemeral UI state (never serialised, never undoable) ──────────────────
  const [durCells,    setDurCells]    = useState(2)
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [playhead,    setPlayhead]    = useState(null)
  const [mode,        setMode]        = useState(MODES.DRAW)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showTracks,  setShowTracks]  = useState(true)
  const [barsToAdd,   setBarsToAdd]   = useState(8)
  const [showToolbar, setShowToolbar] = useState(true)

  const stopFnRef = useRef(null)
  const {
  playNote,
  attackNote,
  releaseNote,
  startPlayback,
} = useAudioEngine()

  // ── Destructure for convenience ────────────────────────────────────────────
  const { settings, tracks, tempoMap } = project
  const { bpm, totalBars, playStartCell, activeTrackId, view, zoomX, wfZoom } = settings
  const totalCells = totalBars * CELLS_PER_BAR

  const activeTrack = useMemo(
    () => tracks.find(t => t.id === activeTrackId) ?? tracks[0],
    [tracks, activeTrackId]
  )


const handleSaveProject = useCallback(() => {
  const snapshot = {
    ...project,
    savedAt: new Date().toISOString(),
  }

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json',
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'project.midiroll.json'
  a.click()
  URL.revokeObjectURL(url)
}, [project])

const handleLoadProject = useCallback(async (file) => {
  try {
    const loaded = JSON.parse(await file.text())
    if (!loaded.version || !Array.isArray(loaded.tracks) || !loaded.settings) {
      throw new Error('Invalid project file')
    }

        const programs = [
  ...new Set(
    loaded.tracks.map(t => t.instrument ?? 0)
  )
]

await Promise.all(
  programs.map(program =>
    loadPreset(program)
  )
)

    resetProject(loaded)

    setSelectedIds(new Set())
    setPlayhead(null)
    setIsPlaying(false)
  } catch (err) {
    alert(`Could not load project: ${err.message}`)
  }
}, [resetProject])

const handleExportMidi = useCallback(() => {
  try {
    const bytes = encodeMidi(
      project.tracks,
      project.settings?.bpm ?? 120,
      SUBS
    )

    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }))
    const a   = document.createElement('a')
    a.href     = url
    a.download = 'project.mid'

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    console.error('Export MIDI failed:', err)
    alert('Could not export MIDI.')
  }
}, [project])

  // ── Theme → first-track colour sync (non-undoable) ─────────────────────────
  useEffect(() => {
    setProjectDirect(p => ({
      ...p,
      tracks: p.tracks.map((t, i) =>
        i === 0 && t.usesThemeColor ? { ...t, color: theme.accent } : t
      ),
    }))
  }, [theme.accent, setProjectDirect])

//   useEffect(() => {

//   loadPreset(0)
//     // .then(p => console.log("PIANO LOADED", p))
//     .catch(console.error)

// }, [])
useEffect(() => {

  const programs = [
    ...new Set(
      tracks.map(t => t.instrument ?? 0)
    )
  ]

  Promise.all(
    programs.map(program =>
      loadPreset(program)
    )
  ).catch(console.error)

}, [])

  // ─── Note CRUD ─────────────────────────────────────────────────────────────

const handleToggleNote = useCallback((pitch, startCell) => {

  // Read from current React state, not from the reducer callback.
  if (activeTrack) {
    playNote(pitch, activeTrack.instrument ?? 0)
  }

  pushCommandFn(p => {

    const track = p.tracks.find(
      t => t.id === p.settings.activeTrackId
    )

    if (!track) return null

    const hit = track.notes.find(n =>
      n.pitch === pitch &&
      startCell >= n.start &&
      startCell < n.start + n.dur
    )

    if (hit) {
      return {
        type: "NOTE_DELETE",
        trackId: track.id,
        notes: [hit]
      }
    }

    return {
      type: "NOTE_ADD",
      trackId: track.id,
      note: {
        id: uid(),
        trackId: track.id,
        pitch,
        start: startCell,
        dur: durCells,
        vel: 100
      }
    }

  })

}, [
  activeTrack,
  playNote,
  pushCommandFn,
  durCells
])

  const handleUpdateNotes = useCallback((updates) => {
    // Called on drag-end from PianoRoll – updates is [{id, start?, pitch?, dur?}]
    pushCommandFn(p => {
      const track = p.tracks.find(t => t.id === p.settings.activeTrackId)
      if (!track) return null
      const before = updates.map(u => {
        const n = track.notes.find(n => n.id === u.id)
        if (!n) return null
        return { id: n.id, start: n.start, pitch: n.pitch, dur: n.dur, vel: n.vel }
      }).filter(Boolean)
      if (before.length === 0) return null
      const after = before.map(b => ({ ...b, ...updates.find(u => u.id === b.id) }))
      return { type: 'NOTE_UPDATE', trackId: track.id, before, after }
    })
  }, [pushCommandFn])

  const handleDeleteSelected = useCallback(() => {
    pushCommandFn(p => {
      const track = p.tracks.find(t => t.id === p.settings.activeTrackId)
      if (!track) return null
      const toDelete = track.notes.filter(n => selectedIds.has(n.id))
      if (toDelete.length === 0) return null
      return { type: 'NOTE_DELETE', trackId: track.id, notes: toDelete }
    })
    setSelectedIds(new Set())
  }, [pushCommandFn, selectedIds])

  const handleVelocityChange = useCallback((ids, velocity) => {
    pushCommandFn(p => {
      const track = p.tracks.find(t => t.id === p.settings.activeTrackId)
      if (!track) return null
      const affected = track.notes.filter(n => ids.has(n.id))
      if (affected.length === 0) return null
      const v = Math.max(1, Math.min(127, velocity))
      return {
        type:    'NOTE_UPDATE',
        trackId: track.id,
        before:  affected.map(n => ({ id: n.id, vel: n.vel })),
        after:   affected.map(n => ({ id: n.id, vel: v })),
      }
    }, `velocity:${activeTrackId}`)   // coalesce while slider drags
  }, [pushCommandFn, activeTrackId])

  // ─── Track operations ──────────────────────────────────────────────────────

  const handleSelectTrack = useCallback((id) => {
    setProjectDirect(p => ({ ...p, settings: { ...p.settings, activeTrackId: id } }))
    setSelectedIds(new Set())
  }, [setProjectDirect])

 const handleAddTrack = useCallback(() => {
  pushCommandFn(p => {
    const newId = `t${uid()}`
    const color = TRACK_COLORS[p.tracks.length % TRACK_COLORS.length]
    const nextChannel = (() => {
      const used = p.tracks.map(t => t.channel)

      for (let c = 0; c < 16; c++) {
        if (c === 9) continue
        if (!used.includes(c)) return c
      }
    
      return 0
    })()

    return {
      type: 'TRACK_ADD',
      track: {
        id: newId,
        name: `Track ${p.tracks.length + 1}`,
        color,
        channel: nextChannel,
        instrument: 0,
        usesThemeColor: false,
        muted: false,
        solo: false,
        notes: [],
      },
      index: p.tracks.length,
      prevActiveId: p.settings.activeTrackId,
    }
  })

  setSelectedIds(new Set())
}, [pushCommandFn])

  const handleDeleteTrack = useCallback((id) => {
    pushCommandFn(p => {
      if (p.tracks.length <= 1) return null
      const index = p.tracks.findIndex(t => t.id === id)
      return {
        type:         'TRACK_DELETE',
        track:        p.tracks[index],
        index,
        prevActiveId: p.settings.activeTrackId,
      }
    })
    setSelectedIds(new Set())
  }, [pushCommandFn])

  const handleDuplicateTrack = useCallback((id) => {
    pushCommandFn(p => {
      const src = p.tracks.find(t => t.id === id)
      if (!src) return null
      const newId    = `t${uid()}`
      const newTrack = {
        ...src, id: newId, name: src.name + ' (copy)',
        notes: src.notes.map(n => ({ ...n, id: uid(), trackId: newId })),
      }
      return {
        type:     'TRACK_DUPLICATE',
        sourceId: id,
        newTrack,
        index:    p.tracks.findIndex(t => t.id === id) + 1,
      }
    })
    setSelectedIds(new Set())
  }, [pushCommandFn])

  // Mute/solo are live-performance state → non-undoable
  const handleToggleMute = useCallback((id) =>
    setProjectDirect(p => ({
      ...p, tracks: p.tracks.map(t => t.id === id ? { ...t, muted: !t.muted } : t)
    })), [setProjectDirect])

  const handleToggleSolo = useCallback((id) =>
    setProjectDirect(p => ({
      ...p, tracks: p.tracks.map(t => t.id === id ? { ...t, solo: !t.solo } : t)
    })), [setProjectDirect])

  // Name / color / instrument → undoable
const handleUpdateTrack = useCallback((id, updates) => {

  pushCommandFn(p => {

    const track = p.tracks.find(t => t.id === id)

    if (!track) return null

    if (
      updates.instrument !== undefined &&
      updates.instrument !== track.instrument
    ) {
      loadPreset(updates.instrument).catch(console.error)
    }

    const before = Object.fromEntries(
      Object.keys(updates).map(k => [k, track[k]])
    )

    return {
      type: "TRACK_UPDATE",
      id,
      before,
      after: updates
    }

  })

}, [pushCommandFn])

  // ─── Settings mutations ────────────────────────────────────────────────────

  const handleBpmChange = useCallback((newBpm) => {
    pushCommandFn(p => ({
      type:   'SETTINGS_UPDATE',
      before: { bpm: p.settings.bpm },
      after:  { bpm: newBpm },
    }), 'settings:bpm')
  }, [pushCommandFn])

  const handleAddBars = useCallback(() => {
    const add = Math.max(1, Math.min(32, Number(barsToAdd) || 1))
    pushCommandFn(p => ({
      type:   'SETTINGS_UPDATE',
      before: { totalBars: p.settings.totalBars },
      after:  { totalBars: p.settings.totalBars + add },
    }))
  }, [pushCommandFn, barsToAdd])

  // ─── Selection ─────────────────────────────────────────────────────────────

  const handleSelectNotes = useCallback((ids, replace = true) =>
    setSelectedIds(replace
      ? new Set(ids)
      : prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return s }
    ), [])

  const handleDeselectAll  = useCallback(() => setSelectedIds(new Set()), [])

  const handleToggleSelect = useCallback((id) =>
    setSelectedIds(prev => {
      const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s
    }), [])

  const handleModeChange = useCallback((m) => {
    setMode(m)
    if (m === MODES.DRAW) setSelectedIds(new Set())
  }, [])

  // ─── Playback ──────────────────────────────────────────────────────────────

  const handlePlayToggle = useCallback(async () => {
    if (isPlaying) {
      setProjectDirect(p => ({
        ...p,
        settings: {
          ...p.settings,
          playStartCell: Math.max(0, Math.floor(playhead ?? p.settings.playStartCell)),
        },
      }))
      stopFnRef.current?.()
      setIsPlaying(false)
      setPlayhead(null)
      return
    }

    const hasSolo       = tracks.some(t => t.solo)
    const playbackNotes = tracks
      .filter(t => hasSolo ? t.solo : !t.muted)
      .flatMap(track => 
        track.notes.map(note => ({
          ...note,
          instrument: track.instrument,
          trackId: track.id,
        }))
      )

    setIsPlaying(true)

    playbackNotes.sort((a, b) => a.start - b.start)
    const stop = await startPlayback(
      playbackNotes, bpm, playStartCell, totalCells, tempoMap,
      cell  => setPlayhead(cell),
      ()    => { setIsPlaying(false); setPlayhead(null) }
    )
    stopFnRef.current = stop
  }, [isPlaying, tracks, bpm, playStartCell, playhead, totalCells, tempoMap, startPlayback, setProjectDirect])

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && !e.shiftKey && e.code === 'KeyZ')  { e.preventDefault(); undo(); return }
      if (ctrl && e.shiftKey  && e.code === 'KeyZ')  { e.preventDefault(); redo(); return }
      if (ctrl && !e.shiftKey && e.code === 'KeyY')  { e.preventDefault(); redo(); return }

      if (e.code === 'Space')                              { e.preventDefault(); handlePlayToggle() }
      else if (e.code === 'Delete' || e.code === 'Backspace') { if (selectedIds.size) handleDeleteSelected() }
      else if (e.code === 'Escape')                        { handleDeselectAll() }
      else if (e.code === 'Digit1')                        { e.preventDefault(); handleModeChange(MODES.DRAW) }
      else if (e.code === 'Digit4')                        { e.preventDefault(); handleModeChange(MODES.SELECT) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, handlePlayToggle, handleDeleteSelected, handleDeselectAll, handleModeChange, selectedIds])

  useKeyboard({
  attackNote,
  releaseNote,
  program: activeTrack?.instrument ?? 0,
})

  // ─── MIDI import (resets history) ──────────────────────────────────────────

  const handleMidiImport = useCallback(async (file) => {
    try {
      const buf       = await file.arrayBuffer()
      const midi      = new Midi(buf)
      const importBpm = midi.header.tempos[0]?.bpm ?? 120
      const sp16      = (60 / importBpm) / SUBS

      const importedTracks = midi.tracks
        .filter(t => t.notes.length > 0)
        .map((track, i) => {
          const trackId = `t${uid()}`
          return {
            id: trackId, name: track.name || `Track ${i + 1}`,
            color: TRACK_COLORS[i % TRACK_COLORS.length],
            usesThemeColor: false, instrument: track.instrument?.number ?? 0,
            muted: false, solo: false,
            notes: track.notes.map(note => ({
              id: uid(), trackId,
              pitch: note.midi,
              start: Math.round(note.time / sp16),
              dur:   Math.max(1, Math.round(note.duration / sp16)),
              vel:   Math.max(1, Math.round(note.velocity * 127)),
            })),
          }
        })

      const maxEnd  = importedTracks.reduce(
        (m, t) => Math.max(m, ...t.notes.map(n => n.start + n.dur)), 0
      )
      const newBars = Math.max(DEFAULT_BARS, Math.ceil(maxEnd / CELLS_PER_BAR) + 1)

      resetProject({
        ...project,
        tracks:   importedTracks,
        tempoMap: [{ cell: 0, bpm: importBpm }],
        settings: {
          ...project.settings,
          bpm:           Math.max(40, Math.min(300, Math.round(importBpm))),
          totalBars:     newBars,
          activeTrackId: importedTracks[0]?.id ?? project.settings.activeTrackId,
          playStartCell: 0,
        },
      })
      setSelectedIds(new Set())
    } catch (err) {
      console.error('MIDI import failed:', err)
      alert('Could not parse MIDI file.')
    }
  }, [resetProject, project])

  // ─── Project save / load ───────────────────────────────────────────────────

  // const handleSaveProject = useCallback(() => {
  //   const snapshot = { ...project, savedAt: new Date().toISOString() }
  //   const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  //   const url  = URL.createObjectURL(blob)
  //   const a    = document.createElement('a')
  //   a.href = url; a.download = 'project.midiroll'; a.click()
  //   URL.revokeObjectURL(url)
  // }, [project])

  // const handleLoadProject = useCallback(async (file) => {
  //   try {
  //     const loaded = JSON.parse(await file.text())
  //     if (!loaded.version || !Array.isArray(loaded.tracks)) throw new Error('Invalid format')
  //     resetProject(loaded)
  //     setSelectedIds(new Set())
  //   } catch (err) {
  //     alert('Could not load project: ' + err.message)
  //   }
  // }, [resetProject])

  // ─── Derived display data ──────────────────────────────────────────────────

  const ghostTracks = useMemo(() =>
    tracks.filter(t => t.id !== activeTrackId && !t.muted)
          .map(t => ({ color: t.color, notes: t.notes })),
    [tracks, activeTrackId]
  )

  const waterfallNotes = useMemo(() =>
    tracks.filter(t => !t.muted)
          .flatMap(t => t.notes.map(n => ({ ...n, trackColor: t.color }))),
    [tracks]
  )

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: theme.bg, color: theme.text, fontFamily: 'system-ui, sans-serif',
    }}>
      <TrackList
        tracks={tracks}
        activeTrackId={activeTrackId}
        onSelectTrack={handleSelectTrack}
        onAddTrack={handleAddTrack}
        onDeleteTrack={handleDeleteTrack}
        onDuplicateTrack={handleDuplicateTrack}
        onToggleMute={handleToggleMute}
        onToggleSolo={handleToggleSolo}
        onUpdateTrack={handleUpdateTrack}
        isOpen={showTracks}
        onToggleOpen={() => setShowTracks(v => !v)}
      />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div
        style={{
          maxHeight: showToolbar ? 120 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.25s ease',
          borderBottom: showToolbar ? `1px solid ${theme.border}` : 'none',
          background: theme.panel,
        }}
      >
        <Toolbar
          bpm={bpm}              onBpmChange={handleBpmChange}
          durCells={durCells}    onDurChange={setDurCells}
          isPlaying={isPlaying}  onPlayToggle={handlePlayToggle}
          onClear={() => {
            pushCommandFn(p => {
              const track = p.tracks.find(t => t.id === p.settings.activeTrackId)
              if (!track || track.notes.length === 0) return null
              return { type: 'NOTE_DELETE', trackId: track.id, notes: [...track.notes] }
            })
            setSelectedIds(new Set())
          }}
          onDemo={() => { resetProject(createDefaultProject(theme.accent)); setSelectedIds(new Set()) }}
          noteCount={activeTrack?.notes.length ?? 0}
          mode={mode}            onModeChange={handleModeChange}
          selectedIds={selectedIds}
          notes={activeTrack?.notes ?? []}
          onVelocityChange={handleVelocityChange}
          onDeleteSelected={handleDeleteSelected}
          onMidiImport={handleMidiImport}
          playStartCell={playStartCell}
          onResetPlayStart={() =>
            setProjectDirect(p => ({ ...p, settings: { ...p.settings, playStartCell: 0 } }))
          }
          totalBars={totalBars}
          barsToAdd={barsToAdd}
          onBarsToAddChange={setBarsToAdd}
          onAddBars={handleAddBars}
          view={view}
          onViewChange={v =>
            setProjectDirect(p => ({ ...p, settings: { ...p.settings, view: v } }))
          }
          zoomX={zoomX}
          onZoomChange={v =>
            setProjectDirect(p => ({ ...p, settings: { ...p.settings, zoomX: v } }))
          }
          wfZoom={wfZoom}
          onWfZoomChange={v =>
            setProjectDirect(p => ({ ...p, settings: { ...p.settings, wfZoom: v } }))
          }
          onSaveProject={handleSaveProject}
          onLoadProject={handleLoadProject}
          onExportMidi={handleExportMidi}
          canUndo={canUndo}      onUndo={undo}
          canRedo={canRedo}      onRedo={redo}
        />
        </div>

        <button
          onClick={() => setShowToolbar(v => !v)}
          title={showToolbar ? 'Hide toolbar' : 'Show toolbar'}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1000,
          
            width: 32,
            height: 32,
          
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
          
            background: theme.accent,
            color: theme.text,
          
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
          
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          {showToolbar ? '▲' : '▼'}
        </button>

        {view === 'editor' ? (
          <PianoRoll
            notes={activeTrack?.notes ?? []}
            ghostTracks={ghostTracks}
            playhead={playhead}
            playStartCell={playStartCell}
            onSetPlayStart={v =>
              setProjectDirect(p => ({ ...p, settings: { ...p.settings, playStartCell: v } }))
            }
            totalCells={totalCells}
            durCells={durCells}
            mode={mode}
            selectedIds={selectedIds}
            onToggleNote={handleToggleNote}
            onPreviewNote={playNote}
            onUpdateNotes={handleUpdateNotes}
            onSelectNotes={handleSelectNotes}
            onDeselectAll={handleDeselectAll}
            onToggleSelect={handleToggleSelect}
            onVelocityChange={handleVelocityChange}
            zoomX={zoomX}
            activeTrackColor={activeTrack?.color}
          />
        ) : (
          <WaterfallView
            notes={waterfallNotes}
            playhead={playhead}
            bpm={bpm}
            theme={theme}
            isPlaying={isPlaying}
            wfZoom={wfZoom}
          />
        )}
      </div>
    </div>
  )
}
// Pure project transformers – no React, no side-effects.
// Every function takes a project and returns a new project.

// ─── helpers ──────────────────────────────────────────────────────────────────

const patchTrack = (project, trackId, fn) => ({
  ...project,
  tracks: project.tracks.map(t => t.id === trackId ? fn(t) : t),
})

const patchNotes = (project, trackId, fn) =>
  patchTrack(project, trackId, t => ({ ...t, notes: fn(t.notes) }))

// ─── apply ────────────────────────────────────────────────────────────────────

export function applyCommand(project, cmd) {
  switch (cmd.type) {

    case 'NOTE_ADD':
      return patchNotes(project, cmd.trackId, ns => [...ns, cmd.note])

    case 'NOTE_DELETE': {
      const ids = new Set(cmd.notes.map(n => n.id))
      return patchNotes(project, cmd.trackId, ns => ns.filter(n => !ids.has(n.id)))
    }

    case 'NOTE_UPDATE': {
      const map = new Map(cmd.after.map(n => [n.id, n]))
      return patchNotes(project, cmd.trackId, ns =>
        ns.map(n => map.has(n.id) ? { ...n, ...map.get(n.id) } : n)
      )
    }

    case 'TRACK_ADD': {
      const tracks = [...project.tracks]
      tracks.splice(cmd.index, 0, cmd.track)
      return {
        ...project,
        tracks,
        settings: { ...project.settings, activeTrackId: cmd.track.id },
      }
    }

    case 'TRACK_DELETE': {
      const tracks = project.tracks.filter(t => t.id !== cmd.track.id)
      const newActive = project.settings.activeTrackId === cmd.track.id
        ? (tracks[0]?.id ?? null)
        : project.settings.activeTrackId
      return {
        ...project,
        tracks,
        settings: { ...project.settings, activeTrackId: newActive },
      }
    }

    case 'TRACK_DUPLICATE': {
      const tracks = [...project.tracks]
      tracks.splice(cmd.index, 0, cmd.newTrack)
      return {
        ...project,
        tracks,
        settings: { ...project.settings, activeTrackId: cmd.newTrack.id },
      }
    }

    case 'TRACK_UPDATE':
      return patchTrack(project, cmd.id, t => ({ ...t, ...cmd.after }))

    case 'SETTINGS_UPDATE':
      return {
        ...project,
        settings: { ...project.settings, ...cmd.after },
        ...(cmd.tempoAfter !== undefined ? { tempoMap: cmd.tempoAfter } : {}),
      }

    default:
      console.warn('applyCommand: unknown type', cmd.type)
      return project
  }
}

// ─── undo ─────────────────────────────────────────────────────────────────────

export function undoCommand(project, cmd) {
  switch (cmd.type) {

    // undo add  → delete
    case 'NOTE_ADD':
      return patchNotes(project, cmd.trackId, ns =>
        ns.filter(n => n.id !== cmd.note.id)
      )

    // undo delete → re-insert (note order inside a track doesn't matter)
    case 'NOTE_DELETE':
      return patchNotes(project, cmd.trackId, ns => [...ns, ...cmd.notes])

    // undo update → restore before-snapshots
    case 'NOTE_UPDATE': {
      const map = new Map(cmd.before.map(n => [n.id, n]))
      return patchNotes(project, cmd.trackId, ns =>
        ns.map(n => map.has(n.id) ? { ...n, ...map.get(n.id) } : n)
      )
    }

    // undo add track → delete it, restore previous active track
    case 'TRACK_ADD': {
      const tracks = project.tracks.filter(t => t.id !== cmd.track.id)
      return {
        ...project,
        tracks,
        settings: { ...project.settings, activeTrackId: cmd.prevActiveId },
      }
    }

    // undo delete → re-insert at original index, make it active again
    case 'TRACK_DELETE': {
      const tracks = [...project.tracks]
      tracks.splice(cmd.index, 0, cmd.track)
      return {
        ...project,
        tracks,
        settings: { ...project.settings, activeTrackId: cmd.track.id },
      }
    }

    // undo duplicate → remove the copy, restore source as active
    case 'TRACK_DUPLICATE': {
      const tracks = project.tracks.filter(t => t.id !== cmd.newTrack.id)
      return {
        ...project,
        tracks,
        settings: { ...project.settings, activeTrackId: cmd.sourceId },
      }
    }

    case 'TRACK_UPDATE':
      return patchTrack(project, cmd.id, t => ({ ...t, ...cmd.before }))

    case 'SETTINGS_UPDATE':
      return {
        ...project,
        settings: { ...project.settings, ...cmd.before },
        ...(cmd.tempoBefore !== undefined ? { tempoMap: cmd.tempoBefore } : {}),
      }

    default:
      console.warn('undoCommand: unknown type', cmd.type)
      return project
  }
}
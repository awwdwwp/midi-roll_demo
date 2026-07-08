import { useReducer, useCallback } from 'react'
import { applyCommand, undoCommand } from '../commands'

const MAX_HISTORY = 100

function reducer(state, action) {
  switch (action.type) {

    case 'PUSH': {
      const { cmd, coalesceKey } = action
      const last = state.undoStack[state.undoStack.length - 1]

      // Coalesce: consecutive commands with the same key merge into one undoable step.
      // The merged command keeps the *first* before-snapshot and the *latest* after-snapshot,
      // so a single undo jumps all the way back.
      if (coalesceKey && last?.coalesceKey === coalesceKey) {
        const merged = {
          ...cmd,
          before:      last.before,     // original before
          coalesceKey,
          // tempo fields if present
          ...(last.tempoBefore !== undefined ? { tempoBefore: last.tempoBefore } : {}),
        }
        const newProject = applyCommand(state.project, cmd)
        return {
          project:   newProject,
          undoStack: [...state.undoStack.slice(0, -1), merged],
          redoStack: [],
        }
      }

      const cmdWithKey = coalesceKey ? { ...cmd, coalesceKey } : cmd
      const newProject = applyCommand(state.project, cmdWithKey)
      const newStack   = [...state.undoStack, cmdWithKey]
      return {
        project:   newProject,
        undoStack: newStack.length > MAX_HISTORY ? newStack.slice(-MAX_HISTORY) : newStack,
        redoStack: [],
      }
    }

    // cmdFn receives the current project and returns a command (or null for no-op)
    case 'PUSH_FN': {
      const { cmdFn, coalesceKey } = action
      const cmd = cmdFn(state.project)
      if (!cmd) return state
      return reducer(state, { type: 'PUSH', cmd, coalesceKey })
    }

    case 'UNDO': {
      if (state.undoStack.length === 0) return state
      const cmd        = state.undoStack[state.undoStack.length - 1]
      const newProject = undoCommand(state.project, cmd)
      return {
        project:   newProject,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, cmd],
      }
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state
      const cmd        = state.redoStack[state.redoStack.length - 1]
      const newProject = applyCommand(state.project, cmd)
      return {
        project:   newProject,
        undoStack: [...state.undoStack, cmd],
        redoStack: state.redoStack.slice(0, -1),
      }
    }

    // Non-undoable project mutation (view, zoom, playhead, mute/solo…)
    case 'SET_DIRECT':
      return {
        ...state,
        project: typeof action.updater === 'function'
          ? action.updater(state.project)
          : action.updater,
      }

    // Load / demo – wipes history
    case 'RESET':
      return { project: action.project, undoStack: [], redoStack: [] }

    default:
      return state
  }
}

export function useProjectHistory(initialProject) {
  const [state, dispatch] = useReducer(reducer, {
    project:   initialProject,
    undoStack: [],
    redoStack: [],
  })

  // Undoable edit – pass a plain command object
  const pushCommand = useCallback((cmd, coalesceKey) =>
    dispatch({ type: 'PUSH', cmd, coalesceKey }), [])

  // Undoable edit – callback receives the current project and returns a command.
  // Return null to make it a no-op.
  const pushCommandFn = useCallback((cmdFn, coalesceKey) =>
    dispatch({ type: 'PUSH_FN', cmdFn, coalesceKey }), [])

  // Non-undoable direct mutation (view state, playhead, mute…)
  const setProjectDirect = useCallback((updater) =>
    dispatch({ type: 'SET_DIRECT', updater }), [])

  // Wipes undo/redo history – use for load, demo, MIDI import
  const resetProject = useCallback((project) =>
    dispatch({ type: 'RESET', project }), [])

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  return {
    project:          state.project,
    pushCommand,
    pushCommandFn,
    setProjectDirect,
    resetProject,
    undo,
    redo,
    canUndo:          state.undoStack.length > 0,
    canRedo:          state.redoStack.length > 0,
    undoCount:        state.undoStack.length,
    redoCount:        state.redoStack.length,
  }
}
// ─── Grid dimensions ─────────────────────────────────────────────────────────
export const CELL_W   = 20   // px per 16th note (x-axis)
export const CELL_H   = 13   // px per semitone  (y-axis)
export const PIANO_W  = 56   // piano keys column width
export const RULER_H  = 24   // beat ruler height
export const VEL_H   = 80

// ─── Timeline ────────────────────────────────────────────────────────────────
export const BEATS      = 4 
export const SUBS       = 4   
export const BEATS_PER_BAR = 4
export const DEFAULT_BARS = 64
export const CELLS_PER_BAR = BEATS * SUBS

// ─── Pitch range ─────────────────────────────────────────────────────────────
export const MIN_NOTE   = 36  // C2
export const MAX_NOTE   = 95  // B6
export const TOTAL_NOTES = MAX_NOTE - MIN_NOTE + 1  // 60 rows

// ─── MIDI / music theory helpers ─────────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const BLACK_SET  = new Set([1, 3, 6, 8, 10])

/** MIDI number → Tone.js note name, e.g. 60 → "C4" */
export const midiToName = (m) => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1)

/** Is this MIDI number a black key? */
export const isBlackKey = (m) => BLACK_SET.has(m % 12)

/** Is this MIDI number a C note? */
export const isCNote = (m) => m % 12 === 0

// ─── Keyboard piano mapping ───────────────────────────────────────────────────
// Offset from C3 (MIDI 48).  Two rows: z-m = C3 octave, q-u = C4 octave
export const KEYBOARD_MAP = {
  z:0, s:1, x:2, d:3,  c:4,  v:5, g:6,  b:7, h:8, n:9, j:10, m:11,
  q:12,'2':13,w:14,'3':15,e:16,r:17,'5':18,t:19,'6':20,y:21,'7':22,u:23,
}
export const KEYBOARD_BASE = 48  // C3

// ─── Note duration options ────────────────────────────────────────────────────
export const DUR_OPTIONS = [
  { label: '1/16', cells: 1  },
  { label: '1/8',  cells: 2  },
  { label: '1/4',  cells: 4  },
  { label: '1/2',  cells: 8  },
  { label: '1',    cells: 16 },
]

export const MODES = { DRAW: 'draw', SELECT: 'select' }

// ─── Demo notes (C major scale + bass) ───────────────────────────────────────
let _uid = 0
export const uid = () => ++_uid

// export const DEMO_NOTES = [
//   // Melody: C major scale up
//   { pitch:60, start:0,  dur:2 },  // C4
//   { pitch:62, start:2,  dur:2 },  // D4
//   { pitch:64, start:4,  dur:2 },  // E4
//   { pitch:65, start:6,  dur:2 },  // F4
//   { pitch:67, start:8,  dur:2 },  // G4
//   { pitch:69, start:10, dur:2 },  // A4
//   { pitch:71, start:12, dur:2 },  // B4
//   { pitch:72, start:14, dur:4 },  // C5 (held)
//   // Bass
//   { pitch:48, start:0,  dur:4 },  // C3
//   { pitch:48, start:4,  dur:4 },  // C3
//   { pitch:46, start:8,  dur:4 },  // Bb2
//   { pitch:48, start:12, dur:4 },  // C3
// ].map(n => ({ ...n, id: uid(), vel: 100 }))

const MELODY = [
  { pitch:60, start:0,  dur:2 }, { pitch:62, start:2,  dur:2 },
  { pitch:64, start:4,  dur:2 }, { pitch:65, start:6,  dur:2 },
  { pitch:67, start:8,  dur:2 }, { pitch:69, start:10, dur:2 },
  { pitch:71, start:12, dur:2 }, { pitch:72, start:14, dur:4 },
].map(n => ({ ...n, id: uid(), vel: 100 }))

const BASS = [
  { pitch:48, start:0,  dur:4 }, { pitch:48, start:4,  dur:4 },
  { pitch:46, start:8,  dur:4 }, { pitch:48, start:12, dur:4 },
].map(n => ({ ...n, id: uid(), vel: 80 }))

export const DEMO_NOTES = [...MELODY, ...BASS]

export const createDefaultTracks = (firstTrackColor = '#7c5cff') => [
  {
    id: 't1',
    name: 'Right Hand',
    color: firstTrackColor,
    channel: 0,
    instrument: 0,
    usesThemeColor: true,
    muted: false,
    solo: false,
    notes: MELODY.map(n => ({ ...n, trackId: 't1' })),
  },
  {
    id: 't2',
    name: 'Left Hand',
    color: '#ff8844',
    channel: 0,
    instrument: 0,
    usesThemeColor: false,
    muted: false,
    solo: false,
    notes: BASS.map(n => ({ ...n, trackId: 't2' })),
  },
]

export const DEFAULT_TRACKS = createDefaultTracks()

/**
 * Returns the effective BPM at a given cell position from a tempo map.
 * tempoMap must be an array of { cell, bpm } sorted ascending by cell.
 */
export const bpmAtCell = (tempoMap, cell) => {
  let result = tempoMap[0]?.bpm ?? 120
  for (const entry of [...tempoMap].sort((a, b) => a.cell - b.cell)) {
    if (entry.cell <= cell) result = entry.bpm
    else break
  }
  return result
}

export const createDefaultProject = (accentColor = '#7c5cff') => ({
  version: 1,
  settings: {
    bpm:           120,
    totalBars:     DEFAULT_BARS,
    playStartCell: 0,
    activeTrackId: 't1',
    view:          'editor',
    zoomX:         1,
    wfZoom:        1,
  },
  tempoMap: [
    { cell: 0, bpm: 120 },
  ],
  tracks: createDefaultTracks(accentColor),
})

/**
 * Convert a span of cells to wall-clock seconds, respecting a tempo map.
 * Used by the audio engine when variable-tempo playback lands.
 */
export const cellsToSeconds = (tempoMap, fromCell, durationCells) => {
  const sorted = [...tempoMap].sort((a, b) => a.cell - b.cell)
  let seconds = 0, remaining = durationCells, cursor = fromCell
  for (let i = 0; i < sorted.length; i++) {
    const segEnd = sorted[i + 1]?.cell ?? Infinity
    const s16    = 60 / (sorted[i].bpm * 4)
    if (cursor >= segEnd) continue
    const segFrom = Math.max(cursor, sorted[i].cell)
    const segTo   = Math.min(cursor + remaining, segEnd)
    const cells   = segTo - segFrom
    seconds   += cells * s16
    remaining -= cells
    cursor     = segTo
    if (remaining <= 0) break
  }
  return seconds
}

export const THEMES = {
  default: {
    name: 'Default', isDark: true,
    bg: '#080810', bgPanel: '#09090f', bgGrid: '#0d0d1e', bgGridBlack: '#09091a',
    border: '#1a1a2e', borderAlt: '#16162a',
    text: '#e0e0ff', textDim: '#888', textFaint: '#444',
    accent: '#5a5aff', accentDanger: '#9e1133', accentPlay: '#2a5eff',
    noteGrad1: '#7272ff', noteGrad2: '#4848cc',
    noteSelGrad1: '#ffaa44', noteSelGrad2: '#dd7722',
    noteShadow: 'rgba(100,100,255,0.35)', noteSelShadow: 'rgba(255,160,60,0.4)',
    ghostBg: 'rgba(80,80,255,0.22)', ghostBorder: 'rgba(100,100,255,0.45)',
    playhead: '#ff3060',
    rulerBg: '#07070e', rulerText: '#4a4a90', rulerLine: '#252550',
    gridLineBar: '#28285a', gridLineBeat: '#1c1c3a', gridLine16: '#111120',
    cHighlight: '#1c1c40',
    pianoWhite: '#d2d2df', pianoBlack: '#222230',
    pianoWhiteBorder: '#b0b0c0', pianoBlackBorder: '#0a0a12',
    pianoText: '#555', pianoBlackText: '#333',
    btnActive: '#5a5aff', btnInactive: '#1e1e3a', btnText: '#fff', btnTextInactive: '#aaa',
    selBg: 'rgba(90,90,255,0.12)', selBorder: 'rgba(90,90,255,0.55)',
    velBar: '#5a5aff', velBg: '#0d0d1e',
    inputBg: '#14142a', inputBorder: '#2e2e50', inputText: '#e0e0ff',
    wfBg:         '#020208',
    wfNoteTop:    '#6666ff',
    wfNoteBtm:    '#3030aa',
    wfActiveTop:  '#ffffff',
    wfActiveBtm:  '#8888ff',
    wfNoteGlow:   '#4444ff',
    wfHitLine:    '#ff8800',
    wfActiveKey:  '#7070ff',
    wfActiveKey2: '#202080',
    wfParticle1:  '#ff8822',
    wfParticle2:  '#ffdd44',
    wfLane:       'rgba(255,255,255,0.018)',
    wfSolo: '#ffcc44',
  },
  midnightBlue: {
    name: 'Midnight Blue', isDark: true,
    bg: '#1A1A2E', bgPanel: '#16213e', bgGrid: '#1e2240', bgGridBlack: '#191d38',
    border: '#252545', borderAlt: '#1e1e3e',
    text: '#e0f7f5', textDim: '#7a9a98', textFaint: '#445555',
    accent: '#2EC4B6', accentDanger: '#e05050', accentPlay: '#2EC4B6',
    noteGrad1: '#2EC4B6', noteGrad2: '#1a8f88',
    noteSelGrad1: '#ffaa44', noteSelGrad2: '#dd7722',
    noteShadow: 'rgba(46,196,182,0.35)', noteSelShadow: 'rgba(255,160,60,0.4)',
    ghostBg: 'rgba(46,196,182,0.2)', ghostBorder: 'rgba(46,196,182,0.5)',
    playhead: '#ff4466',
    rulerBg: '#13132a', rulerText: '#3a7a78', rulerLine: '#252545',
    gridLineBar: '#2a2a55', gridLineBeat: '#222242', gridLine16: '#1c1c35',
    cHighlight: '#24244a',
    pianoWhite: '#c5d5d8', pianoBlack: '#1c2235',
    pianoWhiteBorder: '#a0b5b8', pianoBlackBorder: '#0d1020',
    pianoText: '#445566', pianoBlackText: '#556677',
    btnActive: '#2EC4B6', btnInactive: '#252545', btnText: '#fff', btnTextInactive: '#7a9a98',
    selBg: 'rgba(46,196,182,0.12)', selBorder: 'rgba(46,196,182,0.55)',
    velBar: '#2EC4B6', velBg: '#191d38',
    inputBg: '#1e2240', inputBorder: '#2a2a55', inputText: '#e0f7f5',
    wfBg:         '#060612',
    wfNoteTop:    '#44eecc',
    wfNoteBtm:    '#1a9988',
    wfActiveTop:  '#ffffff',
    wfActiveBtm:  '#44eecc',
    wfNoteGlow:   '#2EC4B6',
    wfHitLine:    '#ff6600',
    wfActiveKey:  '#2EC4B6',
    wfActiveKey2: '#104040',
    wfParticle1:  '#ff6600',
    wfParticle2:  '#ffaa22',
    wfLane:       'rgba(46,196,182,0.025)',
    wfSolo: '#ffcc44',
  },
  mintSmoke: {
    name: 'Mint Smoke', isDark: false,
    bg: '#E2ECE8', bgPanel: '#D3E2DC', bgGrid: '#EAF2EF', bgGridBlack: '#DEEAE5',
    border: '#BCCFC8', borderAlt: '#C7D9D2',
    text: '#1F332A', textDim: '#526B60', textFaint: '#859E93',
    accent: '#52936B', accentDanger: '#D94B4B', accentPlay: '#52936B',
    noteGrad1: '#69A481', noteGrad2: '#4D8463',
    noteSelGrad1: '#E07030', noteSelGrad2: '#C05520',
    noteShadow: 'rgba(105,164,129,0.25)', noteSelShadow: 'rgba(224,112,48,0.3)',
    ghostBg: 'rgba(105,164,129,0.15)', ghostBorder: 'rgba(105,164,129,0.4)',
    playhead: '#D94B4B',
    rulerBg: '#CBDCD6', rulerText: '#668576', rulerLine: '#B5C9C1',
    gridLineBar: '#AEC4BC', gridLineBeat: '#C2D6CE', gridLine16: '#DCE7E3',
    cHighlight: '#CBE2D7',
    pianoWhite: '#F3F8F6', pianoBlack: '#3D4F46',
    pianoWhiteBorder: '#BCCFC8', pianoBlackBorder: '#28362E',
    pianoText: '#5A7060', pianoBlackText: '#C5D5CE',
    btnActive: '#69A481', btnInactive: '#BCCFC8', btnText: '#FFF', btnTextInactive: '#526B60',
    selBg: 'rgba(105,164,129,0.1)', selBorder: 'rgba(105,164,129,0.45)',
    velBar: '#69A481', velBg: '#D3E2DC',
    inputBg: '#EAF2EF', inputBorder: '#BCCFC8', inputText: '#1F332A',
    wfBg:         '#F3F8F6',
    wfNoteTop:    '#69A481',
    wfNoteBtm:    '#4D8463',
    wfActiveTop:  '#2A3D35',
    wfActiveBtm:  '#69A481',
    wfNoteGlow:   'rgba(105,164,129,0.4)',
    wfHitLine:    '#E07030',
    wfActiveKey:  '#CBDCD6',
    wfActiveKey2: '#AEC4BC',
    wfParticle1:  '#E07030',
    wfParticle2:  '#C05520',
    wfLane:       'rgba(105,164,129,0.04)',
    wfSolo: '#ffcc44',
  },
  warmOrange: {
    name: 'Warm Orange', isDark: false,
    bg: '#E8D0B8', bgPanel: '#D6BEA6', bgGrid: '#ECD6BF', bgGridBlack: '#E2C9B1',
    border: '#C2AA92', borderAlt: '#CCA482',
    text: '#3D220B', textDim: '#7A5435', textFaint: '#A88263',
    accent: '#FF6F3C', accentDanger: '#D93838', accentPlay: '#FF6F3C',
    noteGrad1: '#FF6F3C', noteGrad2: '#DD4D1A',
    noteSelGrad1: '#4488CC', noteSelGrad2: '#2266AA',
    noteShadow: 'rgba(255,111,60,0.2)', noteSelShadow: 'rgba(68,136,204,0.25)',
    ghostBg: 'rgba(255,111,60,0.12)', ghostBorder: 'rgba(255,111,60,0.35)',
    playhead: '#D93838',
    rulerBg: '#D6BEA6', rulerText: '#7A5435', rulerLine: '#C2AA92',
    gridLineBar: '#B89B82', gridLineBeat: '#DCBFA6', gridLine16: '#EAD5C2',
    cHighlight: '#DEC4A9',
    pianoWhite: '#F7EDE2', pianoBlack: '#543B29',
    pianoWhiteBorder: '#C2AA92', pianoBlackBorder: '#382518',
    pianoText: '#7A5435', pianoBlackText: '#E8D9CB',
    btnActive: '#FF6F3C', btnInactive: '#C2AA92', btnText: '#FFF', btnTextInactive: '#7A5435',
    selBg: 'rgba(255,111,60,0.08)', selBorder: 'rgba(255,111,60,0.35)',
    velBar: '#FF6F3C', velBg: '#D6BEA6',
    inputBg: '#ECD6BF', inputBorder: '#C2AA92', inputText: '#3D220B',
    wfBg:         '#F7EDE2',
    wfNoteTop:    '#FF6F3C',
    wfNoteBtm:    '#DD4D1A',
    wfActiveTop:  '#3D220B',
    wfActiveBtm:  '#FF6F3C',
    wfNoteGlow:   'rgba(255,111,60,0.4)',
    wfHitLine:    '#4488CC',
    wfActiveKey:  '#EADBCB',
    wfActiveKey2: '#CDAFA4',
    wfParticle1:  '#4488CC',
    wfParticle2:  '#2266AA',
    wfLane:       'rgba(255,111,60,0.04)',
    wfSolo: '#ffcc44',
  },
  cherryRed: {
    name: 'Cherry Red', isDark: false,
    bg: '#EAD5D5', bgPanel: '#D6C0C0', bgGrid: '#EEDCDC', bgGridBlack: '#E4CECE',
    border: '#C2ACAC', borderAlt: '#CCA4A4',
    text: '#38141A', textDim: '#7A4A51', textFaint: '#A87C82',
    accent: '#D2042D', accentDanger: '#9E001B', accentPlay: '#D2042D',
    noteGrad1: '#D2042D', noteGrad2: '#A50222',
    noteSelGrad1: '#4466CC', noteSelGrad2: '#2244AA',
    noteShadow: 'rgba(210,4,45,0.2)', noteSelShadow: 'rgba(68,102,204,0.25)',
    ghostBg: 'rgba(210,4,45,0.1)', ghostBorder: 'rgba(210,4,45,0.35)',
    playhead: '#9E001B',
    rulerBg: '#D6C0C0', rulerText: '#7A4A51', rulerLine: '#C2ACAC',
    gridLineBar: '#B89D9D', gridLineBeat: '#DCC2C2', gridLine16: '#EED8D8',
    cHighlight: '#DEC6C6',
    pianoWhite: '#F9F2F2', pianoBlack: '#4F2D32',
    pianoWhiteBorder: '#C2ACAC', pianoBlackBorder: '#331B1E',
    pianoText: '#7A4A51', pianoBlackText: '#E8DDDD',
    btnActive: '#D2042D', btnInactive: '#C2ACAC', btnText: '#FFF', btnTextInactive: '#7A4A51',
    selBg: 'rgba(210,4,45,0.06)', selBorder: 'rgba(210,4,45,0.35)',
    velBar: '#D2042D', velBg: '#D6C0C0',
    inputBg: '#EEDCDC', inputBorder: '#C2ACAC', inputText: '#38141A',
    wfBg:         '#F9F2F2',
    wfNoteTop:    '#D2042D',
    wfNoteBtm:    '#A50222',
    wfActiveTop:  '#38141A',
    wfActiveBtm:  '#D2042D',
    wfNoteGlow:   'rgba(210,4,45,0.4)',
    wfHitLine:    '#4466CC',
    wfActiveKey:  '#EADCDC',
    wfActiveKey2: '#CCA6AB',
    wfParticle1:  '#4466CC',
    wfParticle2:  '#2244AA',
    wfLane:       'rgba(210,4,45,0.04)',
    wfSolo: '#ffcc44',
  },
  retroWave: {
    name: 'Retro Wave', isDark: true,
    bg: '#0F121F', bgPanel: '#090B13', bgGrid: '#11162B', bgGridBlack: '#0F121F',
    border: '#2A2E45', borderAlt: '#1F2236',
    text: '#E0E7FF', textDim: '#9AA1C2', textFaint: '#5A6085',
    accent: '#CB2473', accentDanger: '#E53E3E', accentPlay: '#CB2473',
    noteGrad1: '#CB2473', noteGrad2: '#8E175C',
    noteSelGrad1: '#F180FF', noteSelGrad2: '#B82AEF',
    noteShadow: 'rgba(203,36,115,0.3)', noteSelShadow: 'rgba(241,128,255,0.35)',
    ghostBg: 'rgba(203,36,115,0.15)', ghostBorder: 'rgba(203,36,115,0.4)',
    playhead: '#FFD700',
    rulerBg: '#090B13', rulerText: '#5A6085', rulerLine: '#2A2E45',
    gridLineBar: '#373B54', gridLineBeat: '#23263B', gridLine16: '#191C2E',
    cHighlight: '#1A1E38',
    pianoWhite: '#CCD3E8', pianoBlack: '#0F121F',
    pianoWhiteBorder: '#9AA1C2', pianoBlackBorder: '#000000',
    pianoText: '#444C6A', pianoBlackText: '#CCD3E8',
    btnActive: '#CB2473', btnInactive: '#2A2E45', btnText: '#FFFFFF', btnTextInactive: '#9AA1C2',
    selBg: 'rgba(203,36,115,0.1)', selBorder: 'rgba(203,36,115,0.4)',
    velBar: '#CB2473', velBg: '#0F121F',
    inputBg: '#11162B', inputBorder: '#373B54', inputText: '#E0E7FF',
    wfBg:         '#090A14',
    wfNoteTop:    '#F180FF',
    wfNoteBtm:    '#CB2473',
    wfActiveTop:  '#FFFFFF',
    wfActiveBtm:  '#F180FF',
    wfNoteGlow:   '#CB2473',
    wfHitLine:    '#FFD700',
    wfActiveKey:  '#373B54',
    wfActiveKey2: '#1F2236',
    wfParticle1:  '#FFD700',
    wfParticle2:  '#F180FF',
    wfLane:       'rgba(203,36,115,0.03)',
    wfSolo: '#ffcc44',
  },
  slateMint: {
    name: 'Slate Mint', isDark: true,
    bg: '#141E1C', bgPanel: '#0E1412', bgGrid: '#182421', bgGridBlack: '#141E1C',
    border: '#283531', borderAlt: '#1F2A26',
    text: '#DEF5F1', textDim: '#8CAAA4', textFaint: '#516E68',
    accent: '#47CBAC', accentDanger: '#D9534F', accentPlay: '#47CBAC',
    noteGrad1: '#47CBAC', noteGrad2: '#34A188',
    noteSelGrad1: '#FFD700', noteSelGrad2: '#D9A300',
    noteShadow: 'rgba(71,203,172,0.3)', noteSelShadow: 'rgba(255,215,0,0.35)',
    ghostBg: 'rgba(71,203,172,0.15)', ghostBorder: 'rgba(71,203,172,0.4)',
    playhead: '#D9534F',
    rulerBg: '#0E1412', rulerText: '#516E68', rulerLine: '#283531',
    gridLineBar: '#3D4D48', gridLineBeat: '#212B28', gridLine16: '#171F1D',
    cHighlight: '#222F2A',
    pianoWhite: '#CCECF0', pianoBlack: '#141E1C',
    pianoWhiteBorder: '#8CAAA4', pianoBlackBorder: '#000000',
    pianoText: '#4D6660', pianoBlackText: '#CCECF0',
    btnActive: '#47CBAC', btnInactive: '#283531', btnText: '#FFFFFF', btnTextInactive: '#8CAAA4',
    selBg: 'rgba(71,203,172,0.1)', selBorder: 'rgba(71,203,172,0.4)',
    velBar: '#47CBAC', velBg: '#141E1C',
    inputBg: '#182421', inputBorder: '#3D4D48', inputText: '#DEF5F1',
    wfBg:         '#0A1110',
    wfNoteTop:    '#47CBAC',
    wfNoteBtm:    '#217A65',
    wfActiveTop:  '#FFFFFF',
    wfActiveBtm:  '#47CBAC',
    wfNoteGlow:   '#34A188',
    wfHitLine:    '#FFD700',
    wfActiveKey:  '#283531',
    wfActiveKey2: '#141E1C',
    wfParticle1:  '#FFD700',
    wfParticle2:  '#FFB700',
    wfLane:       'rgba(71,203,172,0.025)',
    wfSolo: '#ffcc44',
  },
  forestFloor: {
    name: 'Forest Floor', isDark: true,
    bg: '#1A1C16', bgPanel: '#11130D', bgGrid: '#1F221A', bgGridBlack: '#1A1C16',
    border: '#2A2E22', borderAlt: '#22251B',
    text: '#F1F3EA', textDim: '#A1A78B', textFaint: '#6B7059',
    accent: '#65723E', accentDanger: '#B34040', accentPlay: '#65723E',
    noteGrad1: '#65723E', noteGrad2: '#475129',
    noteSelGrad1: '#D6A055', noteSelGrad2: '#A37A3D',
    noteShadow: 'rgba(101,114,62,0.3)', noteSelShadow: 'rgba(214,160,85,0.35)',
    ghostBg: 'rgba(101,114,62,0.15)', ghostBorder: 'rgba(101,114,62,0.4)',
    playhead: '#D6A055',
    rulerBg: '#11130D', rulerText: '#6B7059', rulerLine: '#2A2E22',
    gridLineBar: '#3D4233', gridLineBeat: '#25291F', gridLine16: '#1D2118',
    cHighlight: '#2A2E22',
    pianoWhite: '#E4E7D8', pianoBlack: '#1A1C16',
    pianoWhiteBorder: '#A1A78B', pianoBlackBorder: '#000000',
    pianoText: '#5A604A', pianoBlackText: '#E4E7D8',
    btnActive: '#65723E', btnInactive: '#2A2E22', btnText: '#FFFFFF', btnTextInactive: '#A1A78B',
    selBg: 'rgba(101,114,62,0.1)', selBorder: 'rgba(101,114,62,0.4)',
    velBar: '#65723E', velBg: '#1A1C16',
    inputBg: '#1F221A', inputBorder: '#3D4233', inputText: '#F1F3EA',
    wfBg:         '#0E100C',
    wfNoteTop:    '#8CA358',
    wfNoteBtm:    '#475129',
    wfActiveTop:  '#F1F3EA',
    wfActiveBtm:  '#8CA358',
    wfNoteGlow:   '#65723E',
    wfHitLine:    '#D6A055',
    wfActiveKey:  '#2A2E22',
    wfActiveKey2: '#1A1C16',
    wfParticle1:  '#D6A055',
    wfParticle2:  '#A37A3D',
    wfLane:       'rgba(101,114,62,0.025)',
    wfSolo: '#ffcc44',
  },
  deepCrimson: {
    name: 'Deep Crimson', isDark: true,
    bg: '#1C1010', bgPanel: '#140C0C', bgGrid: '#241616', bgGridBlack: '#1C1010',
    border: '#332020', borderAlt: '#271919',
    text: '#F8F1F1', textDim: '#A98F8F', textFaint: '#6E5555',
    accent: '#D92A2A', accentDanger: '#9E2424', accentPlay: '#D92A2A',
    noteGrad1: '#D92A2A', noteGrad2: '#9E2424',
    noteSelGrad1: '#5D85EB', noteSelGrad2: '#4163B8',
    noteShadow: 'rgba(217,42,42,0.3)', noteSelShadow: 'rgba(93,133,235,0.35)',
    ghostBg: 'rgba(217,42,42,0.15)', ghostBorder: 'rgba(217,42,42,0.4)',
    playhead: '#D9534F',
    rulerBg: '#140C0C', rulerText: '#6E5555', rulerLine: '#332020',
    gridLineBar: '#4C3333', gridLineBeat: '#261919', gridLine16: '#1C1313',
    cHighlight: '#2A1A1A',
    pianoWhite: '#EBE4E4', pianoBlack: '#1C1010',
    pianoWhiteBorder: '#A98F8F', pianoBlackBorder: '#000000',
    pianoText: '#664A4A', pianoBlackText: '#EBE4E4',
    btnActive: '#D92A2A', btnInactive: '#332020', btnText: '#FFFFFF', btnTextInactive: '#A98F8F',
    selBg: 'rgba(217,42,42,0.1)', selBorder: 'rgba(217,42,42,0.4)',
    velBar: '#D92A2A', velBg: '#1C1010',
    inputBg: '#241616', inputBorder: '#4C3333', inputText: '#F8F1F1',
    wfBg:         '#100909',
    wfNoteTop:    '#FF4D4D',
    wfNoteBtm:    '#9E2424',
    wfActiveTop:  '#FFFFFF',
    wfActiveBtm:  '#FF4D4D',
    wfNoteGlow:   '#D92A2A',
    wfHitLine:    '#5D85EB',
    wfActiveKey:  '#332020',
    wfActiveKey2: '#1C1010',
    wfParticle1:  '#5D85EB',
    wfParticle2:  '#4163B8',
    wfLane:       'rgba(217,42,42,0.025)',
    wfSolo: '#ffcc44',
  },
}

export const TRACK_COLORS = [
  '#7c5cff','#ff8844','#44cc88','#44aaff',
  '#ff4488','#ffcc44','#44ddcc','#cc44ff',
]




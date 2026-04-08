export const UNIT_COLORS = {
  'aritmetica-algebra': { bg: 'bg-signal/12', text: 'text-signal', dot: 'bg-signal', border: 'border-signal/20' },
  'funciones': { bg: 'bg-aqua/12', text: 'text-aqua', dot: 'bg-aqua', border: 'border-aqua/20' },
  'analisis': { bg: 'bg-graph/12', text: 'text-graph', dot: 'bg-graph', border: 'border-graph/20' },
  'geometria-trigonometria': { bg: 'bg-violet/12', text: 'text-violet', dot: 'bg-violet', border: 'border-violet/20' },
  'estadistica-probabilidad': { bg: 'bg-rose/12', text: 'text-rose', dot: 'bg-rose', border: 'border-rose/20' },
}

export const DEFAULT_UNIT_COLOR = UNIT_COLORS['analisis']

export const getUnitColors = (unitId) => UNIT_COLORS[unitId] || DEFAULT_UNIT_COLOR

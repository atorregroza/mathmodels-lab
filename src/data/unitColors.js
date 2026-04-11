export const UNIT_COLORS = {
  'aritmetica-algebra': { bg: 'bg-signal/18', text: 'text-signal', dot: 'bg-signal', border: 'border-signal/25' },
  'funciones': { bg: 'bg-aqua/18', text: 'text-aqua', dot: 'bg-aqua', border: 'border-aqua/25' },
  'analisis': { bg: 'bg-graph/18', text: 'text-graph', dot: 'bg-graph', border: 'border-graph/25' },
  'geometria-trigonometria': { bg: 'bg-violet/18', text: 'text-violet', dot: 'bg-violet', border: 'border-violet/25' },
  'estadistica-probabilidad': { bg: 'bg-rose/18', text: 'text-rose', dot: 'bg-rose', border: 'border-rose/25' },
}

export const DEFAULT_UNIT_COLOR = UNIT_COLORS['analisis']

export const getUnitColors = (unitId) => UNIT_COLORS[unitId] || DEFAULT_UNIT_COLOR

import { useState, useCallback, useRef, useEffect, useId, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { StatsMode } from './StatsMode'
import { DistMode } from './DistMode'

/* ── expression parser (safe, no eval) ─────────────────────────── */

const factorial = (n) => {
  if (n < 0 || !Number.isInteger(n)) return NaN
  if (n > 170) return Infinity
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

const FUNCS = {
  sin:  (v) => Math.sin(v),
  cos:  (v) => Math.cos(v),
  tan:  (v) => Math.tan(v),
  asin: (v) => Math.asin(v),
  acos: (v) => Math.acos(v),
  atan: (v) => Math.atan(v),
  ln:   (v) => Math.log(v),
  log:  (v) => Math.log10(v),
  sqrt: (v) => Math.sqrt(v),
  abs:  (v) => Math.abs(v),
}

class Parser {
  constructor(expr, xVal) {
    this.expr = expr.replace(/\s/g, '')
    this.pos = 0
    this.xVal = xVal
  }

  parse() {
    const result = this.addSub()
    if (this.pos < this.expr.length) throw new Error('Inesperado')
    return result
  }

  peek() { return this.expr[this.pos] }
  consume(ch) {
    if (this.expr[this.pos] === ch) { this.pos++; return true }
    return false
  }

  addSub() {
    let left = this.mulDiv()
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.expr[this.pos++]
      const right = this.mulDiv()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  mulDiv() {
    let left = this.power()
    while (this.peek() === '×' || this.peek() === '÷' || this.peek() === '*' || this.peek() === '/') {
      const op = this.expr[this.pos++]
      const right = this.power()
      if (op === '÷' || op === '/') {
        if (right === 0) throw new Error('÷ por 0')
        left = left / right
      } else {
        left = left * right
      }
    }
    return left
  }

  power() {
    let base = this.unary()
    if (this.consume('^')) {
      const exp = this.unary()
      base = Math.pow(base, exp)
    }
    return base
  }

  unary() {
    if (this.consume('-')) return -this.unary()
    if (this.consume('+')) return this.unary()
    return this.postfix()
  }

  postfix() {
    let val = this.atom()
    if (this.consume('!')) val = factorial(val)
    return val
  }

  atom() {
    if (this.consume('(')) {
      const val = this.addSub()
      if (!this.consume(')')) throw new Error('Falta )')
      return val
    }

    const funcMatch = this.expr.slice(this.pos).match(/^(asin|acos|atan|sin|cos|tan|ln|log|sqrt|abs)/)
    if (funcMatch) {
      const name = funcMatch[0]
      this.pos += name.length
      if (!this.consume('(')) throw new Error(`Falta ( después de ${name}`)
      const arg = this.addSub()
      if (!this.consume(')')) throw new Error('Falta )')
      return FUNCS[name](arg)
    }

    // variable x
    if (this.expr[this.pos] === 'x') {
      this.pos++
      if (this.xVal === undefined) throw new Error('x no definida')
      return this.xVal
    }

    if (this.expr[this.pos] === 'π') { this.pos++; return Math.PI }
    if (this.expr[this.pos] === 'e' && !/^e\d/.test(this.expr.slice(this.pos))) {
      const next = this.expr[this.pos + 1]
      if (next === undefined || /[+\-×÷*/^)!]/.test(next)) {
        this.pos++
        return Math.E
      }
    }

    const numMatch = this.expr.slice(this.pos).match(/^\d+\.?\d*/)
    if (numMatch) {
      this.pos += numMatch[0].length
      return parseFloat(numMatch[0])
    }

    throw new Error('Expresión inválida')
  }
}

function safeEval(expr, xVal) {
  if (!expr || !expr.trim()) return ''
  try {
    const p = new Parser(expr, xVal)
    const result = p.parse()
    if (typeof result !== 'number' || !isFinite(result)) {
      if (isNaN(result)) return 'Error'
      return result > 0 ? '∞' : '-∞'
    }
    const s = parseFloat(result.toPrecision(10))
    return String(s)
  } catch {
    return ''
  }
}

function evalForGraph(expr, xVal) {
  try {
    const p = new Parser(expr, xVal)
    const result = p.parse()
    if (typeof result !== 'number' || !isFinite(result)) return null
    return result
  } catch {
    return null
  }
}

/* ── numerical analysis helpers ─────────────────────────────── */

function bisect(fn, a, b, tol = 1e-9, maxIter = 60) {
  let fa = fn(a), fb = fn(b)
  if (fa === null || fb === null) return null
  for (let i = 0; i < maxIter; i++) {
    const m = (a + b) / 2
    const fm = fn(m)
    if (fm === null) return null
    if (Math.abs(fm) < tol || (b - a) / 2 < tol) return m
    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm } else { b = m; fb = fm }
  }
  return (a + b) / 2
}

function findZerosRaw(fn, xMin, xMax, steps = 400) {
  const zeros = []
  const dx = (xMax - xMin) / steps
  let prev = fn(xMin)
  for (let i = 1; i <= steps; i++) {
    const x = xMin + i * dx
    const cur = fn(x)
    if (prev !== null && cur !== null) {
      // sign-change detection (simple roots)
      if (Math.sign(prev) !== Math.sign(cur) && Math.abs(prev - cur) < 1000) {
        const z = bisect(fn, x - dx, x)
        if (z !== null && !zeros.some(zz => Math.abs(zz - z) < dx * 3)) zeros.push(z)
      }
      // double-root detection: |f| has a local minimum near zero
      if (i >= 2) {
        const prev2 = fn(x - 2 * dx)
        if (prev2 !== null) {
          const a = Math.abs(prev2), b = Math.abs(prev), c = Math.abs(cur)
          if (b < a && b < c && b < dx * 0.5) {
            const candidate = x - dx
            if (!zeros.some(zz => Math.abs(zz - candidate) < dx * 3)) zeros.push(candidate)
          }
        }
      }
    }
    prev = cur
  }
  return zeros
}

function findZeros(expr, xMin, xMax) {
  return findZerosRaw(x => evalForGraph(expr, x), xMin, xMax)
}

function findYIntercept(expr) {
  const y = evalForGraph(expr, 0)
  return y !== null ? { x: 0, y } : null
}

function findExtrema(expr, xMin, xMax) {
  const h = 1e-6
  const deriv = x => {
    const a = evalForGraph(expr, x - h)
    const b = evalForGraph(expr, x + h)
    return (a !== null && b !== null) ? (b - a) / (2 * h) : null
  }
  const criticals = findZerosRaw(deriv, xMin, xMax, 500)
  return criticals.map(cx => {
    const y = evalForGraph(expr, cx)
    const d2 = (() => {
      const a = evalForGraph(expr, cx - h)
      const b = evalForGraph(expr, cx)
      const c = evalForGraph(expr, cx + h)
      return (a !== null && b !== null && c !== null) ? (c - 2 * b + a) / (h * h) : 0
    })()
    return { x: cx, y, type: d2 > 0.01 ? 'min' : d2 < -0.01 ? 'max' : 'inflexión' }
  }).filter(p => p.y !== null)
}

function findIntersections(expr1, expr2, xMin, xMax) {
  const diff = x => {
    const a = evalForGraph(expr1, x)
    const b = evalForGraph(expr2, x)
    return (a !== null && b !== null) ? a - b : null
  }
  return findZerosRaw(diff, xMin, xMax).map(x => ({ x, y: evalForGraph(expr1, x) })).filter(p => p.y !== null)
}

/* ── numerical integration (Simpson's 3/8) ─────────────────── */

function numericalIntegral(expr, a, b, n = 1000) {
  if (a === b) return 0
  if (a > b) return -numericalIntegral(expr, b, a, n)
  n = n % 2 === 0 ? n : n + 1
  const h = (b - a) / n
  let sum = evalForGraph(expr, a) ?? 0
  sum += evalForGraph(expr, b) ?? 0
  for (let i = 1; i < n; i++) {
    const x = a + i * h
    const y = evalForGraph(expr, x)
    if (y === null) continue
    sum += (i % 2 === 0 ? 2 : 4) * y
  }
  return (h / 3) * sum
}

/* ── numerical derivative ──────────────────────────────────── */

function numericalDerivative(expr, x0) {
  const h = 1e-5
  const a = evalForGraph(expr, x0 - h)
  const b = evalForGraph(expr, x0 + h)
  if (a === null || b === null) return null
  return (b - a) / (2 * h)
}

/* ── table of values ───────────────────────────────────────── */

function generateTable(expr, xMin, xMax, step) {
  const rows = []
  for (let x = xMin; x <= xMax + step * 0.01; x += step) {
    const xRound = parseFloat(x.toPrecision(10))
    const y = evalForGraph(expr, xRound)
    rows.push({ x: xRound, y })
    if (rows.length > 200) break
  }
  return rows
}

/* ── equation solver (Newton-Raphson with bisection fallback) ─ */

function solveEquation(expr, x0, xMin, xMax) {
  const fn = x => evalForGraph(expr, x)
  // try Newton-Raphson from x0
  let x = x0
  const h = 1e-7
  for (let i = 0; i < 50; i++) {
    const fx = fn(x)
    if (fx === null) break
    if (Math.abs(fx) < 1e-10) return x
    const dfx = ((fn(x + h) ?? 0) - (fn(x - h) ?? 0)) / (2 * h)
    if (Math.abs(dfx) < 1e-14) break
    const xNew = x - fx / dfx
    if (xNew < xMin || xNew > xMax) break
    x = xNew
  }
  // fallback: scan for sign changes
  const zeros = findZeros(expr, xMin, xMax)
  if (zeros.length > 0) {
    zeros.sort((a, b) => Math.abs(a - x0) - Math.abs(b - x0))
    return zeros[0]
  }
  return null
}

/* ── matrix operations ─────────────────────────────────────── */

function parseMatrix(text) {
  return text.trim().split('\n').map(row =>
    row.split(/[,;\s]+/).map(Number).filter(n => !isNaN(n))
  ).filter(row => row.length > 0)
}

function matAdd(a, b) {
  if (a.length !== b.length || a[0].length !== b[0].length) return null
  return a.map((row, i) => row.map((v, j) => v + b[i][j]))
}

function matMul(a, b) {
  if (a[0].length !== b.length) return null
  const rows = a.length, cols = b[0].length, n = b.length
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) =>
      a[i].reduce((s, v, k) => s + v * b[k][j], 0)
    )
  )
}

function matDet(m) {
  const n = m.length
  if (n === 1) return m[0][0]
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0]
  let det = 0
  for (let j = 0; j < n; j++) {
    const minor = m.slice(1).map(row => [...row.slice(0, j), ...row.slice(j + 1)])
    det += (j % 2 === 0 ? 1 : -1) * m[0][j] * matDet(minor)
  }
  return det
}

function matTranspose(m) {
  return m[0].map((_, j) => m.map(row => row[j]))
}

function matRref(m) {
  const rows = m.length, cols = m[0].length
  const r = m.map(row => [...row])
  let lead = 0
  for (let row = 0; row < rows && lead < cols; row++) {
    let i = row
    while (i < rows && Math.abs(r[i][lead]) < 1e-10) i++
    if (i === rows) { lead++; row--; continue }
    [r[row], r[i]] = [r[i], r[row]]
    const div = r[row][lead]
    r[row] = r[row].map(v => v / div)
    for (let j = 0; j < rows; j++) {
      if (j === row) continue
      const factor = r[j][lead]
      r[j] = r[j].map((v, k) => v - factor * r[row][k])
    }
    lead++
  }
  return r
}

function matInverse(m) {
  const n = m.length
  if (n !== m[0].length) return null
  const det = matDet(m)
  if (Math.abs(det) < 1e-10) return null
  const aug = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)])
  const rref = matRref(aug)
  return rref.map(row => row.slice(n))
}

function formatMatrix(m) {
  return m.map(row => row.map(v => {
    const r = Math.abs(v) < 1e-10 ? 0 : parseFloat(v.toPrecision(6))
    return String(r)
  }).join('\t')).join('\n')
}

/* ── graph colors ───────────────────────────────────────────── */

const GRAPH_COLORS = ['#5096ff', '#ff6b35', '#22c55e', '#a855f7', '#f59e0b']

/* ── calculator buttons layout ──────────────────────────────── */

const BTN = { fn: 'fn', op: 'op', num: 'num', act: 'act', const: 'const' }

const ROWS_SCIENTIFIC = [
  [
    { label: 'sin',   type: BTN.fn, insert: 'sin(' },
    { label: 'cos',   type: BTN.fn, insert: 'cos(' },
    { label: 'tan',   type: BTN.fn, insert: 'tan(' },
    { label: 'π',     type: BTN.const, insert: 'π' },
    { label: 'e',     type: BTN.const, insert: 'e' },
  ],
  [
    { label: 'sin⁻¹', type: BTN.fn, insert: 'asin(' },
    { label: 'cos⁻¹', type: BTN.fn, insert: 'acos(' },
    { label: 'tan⁻¹', type: BTN.fn, insert: 'atan(' },
    { label: 'ln',     type: BTN.fn, insert: 'ln(' },
    { label: 'log',    type: BTN.fn, insert: 'log(' },
  ],
  [
    { label: 'x²',   type: BTN.fn, insert: '^2' },
    { label: 'xʸ',   type: BTN.fn, insert: '^' },
    { label: '√',     type: BTN.fn, insert: 'sqrt(' },
    { label: 'eˣ',   type: BTN.fn, insert: 'e^' },
    { label: 'n!',    type: BTN.fn, insert: '!' },
  ],
]

const ROWS_MAIN = [
  [
    { label: 'C',  type: BTN.act, action: 'clear' },
    { label: '⌫', type: BTN.act, action: 'backspace' },
    { label: '(',  type: BTN.op, insert: '(' },
    { label: ')',  type: BTN.op, insert: ')' },
    { label: '÷',  type: BTN.op, insert: '÷' },
  ],
  [
    { label: '7', type: BTN.num, insert: '7' },
    { label: '8', type: BTN.num, insert: '8' },
    { label: '9', type: BTN.num, insert: '9' },
    { label: '×', type: BTN.op, insert: '×' },
    { label: '1/x', type: BTN.fn, insert: '1÷' },
  ],
  [
    { label: '4', type: BTN.num, insert: '4' },
    { label: '5', type: BTN.num, insert: '5' },
    { label: '6', type: BTN.num, insert: '6' },
    { label: '-', type: BTN.op, insert: '-' },
    { label: '%', type: BTN.fn, insert: '÷100' },
  ],
  [
    { label: '1', type: BTN.num, insert: '1' },
    { label: '2', type: BTN.num, insert: '2' },
    { label: '3', type: BTN.num, insert: '3' },
    { label: '+', type: BTN.op, insert: '+' },
    { label: '±', type: BTN.act, action: 'negate' },
  ],
  [
    { label: '0', type: BTN.num, insert: '0', wide: true },
    { label: '.', type: BTN.num, insert: '.' },
    { label: '=', type: BTN.act, action: 'evaluate', accent: true },
  ],
]

/* ── mini graph component ───────────────────────────────────── */

function MiniGraph({ functions, xRange, yRangeOverride = null, analysisPoints = [] }) {
  const clipId = useId().replace(/:/g, '')
  const W = 340
  const H = 200
  const pad = 24
  const [xMin, xMax] = xRange
  const samples = 500

  const curves = useMemo(() => {
    return functions.map((fn) => {
      const points = []
      for (let i = 0; i <= samples; i++) {
        const x = xMin + (i / samples) * (xMax - xMin)
        const y = evalForGraph(fn.expr, x)
        if (y !== null) points.push({ x, y })
      }
      return { ...fn, points }
    })
  }, [functions, xMin, xMax])

  // compute y range from data — percentile-based to handle outliers
  let yMin = Infinity, yMax = -Infinity
  const allY = []
  for (const c of curves) {
    for (const pt of c.points) {
      if (isFinite(pt.y)) allY.push(pt.y)
    }
  }
  if (allY.length > 0) {
    allY.sort((a, b) => a - b)
    const lo = Math.floor(allY.length * 0.02)
    const hi = Math.ceil(allY.length * 0.98) - 1
    yMin = allY[Math.max(0, lo)]
    yMax = allY[Math.min(allY.length - 1, hi)]
    if (yMin === yMax) { yMin -= 1; yMax += 1 }
  } else {
    yMin = -1; yMax = 1
  }
  if (yRangeOverride) {
    yMin = yRangeOverride[0]
    yMax = yRangeOverride[1]
  } else {
    const yPad = Math.max((yMax - yMin) * 0.15, 0.5)
    yMin -= yPad
    yMax += yPad
  }

  const sx = (v) => pad + ((v - xMin) / ((xMax - xMin) || 1)) * (W - pad * 2)
  const sy = (v) => H - pad - ((v - yMin) / ((yMax - yMin) || 1)) * (H - pad * 2)

  // generate nice ticks
  const makeTicks = (min, max, count) => {
    const range = max - min
    if (range <= 0) return [min]
    const rawStep = range / count
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
    const residual = rawStep / magnitude
    const niceStep = residual <= 1.5 ? 1 * magnitude : residual <= 3.5 ? 2 * magnitude : residual <= 7.5 ? 5 * magnitude : 10 * magnitude
    const ticks = []
    const start = Math.ceil(min / niceStep) * niceStep
    for (let v = start; v <= max + niceStep * 0.01; v += niceStep) {
      ticks.push(parseFloat(v.toPrecision(10)))
      if (ticks.length > 15) break
    }
    return ticks
  }

  const xTicks = makeTicks(xMin, xMax, 6)
  const yTicks = makeTicks(yMin, yMax, 5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-[#0e1219]">
      <defs>
        <clipPath id={clipId}>
          <rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} />
        </clipPath>
      </defs>

      {/* grid */}
      {xTicks.map((t) => (
        <line key={`xg${t}`} x1={sx(t)} y1={pad} x2={sx(t)} y2={H - pad} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      {yTicks.map((t) => (
        <line key={`yg${t}`} x1={pad} y1={sy(t)} x2={W - pad} y2={sy(t)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}

      {/* axes */}
      {xMin <= 0 && xMax >= 0 && (
        <line x1={sx(0)} y1={pad} x2={sx(0)} y2={H - pad} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      )}
      {yMin <= 0 && yMax >= 0 && (
        <line x1={pad} y1={sy(0)} x2={W - pad} y2={sy(0)} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      )}

      {/* tick labels — always visible */}
      {(() => {
        const xLabelY = (yMin <= 0 && yMax >= 0) ? sy(0) + 14 : H - pad + 14
        const yLabelX = (xMin <= 0 && xMax >= 0) ? sx(0) - 6 : pad - 4
        const fmtTick = v => Math.abs(v) < 1e-10 ? 0 : parseFloat(v.toPrecision(6))
        return (<>
          {xTicks.map((t) => (
            <text key={`xl${t}`} x={sx(t)} y={xLabelY} fill="rgba(255,255,255,0.45)" fontSize="8" textAnchor="middle">{fmtTick(t)}</text>
          ))}
          {yTicks.map((t) => (
            <text key={`yl${t}`} x={yLabelX} y={sy(t) + 3} fill="rgba(255,255,255,0.45)" fontSize="8" textAnchor="end">{fmtTick(t)}</text>
          ))}
        </>)
      })()}

      {/* curves */}
      <g clipPath={`url(#${clipId})`}>
        {curves.map((c, ci) => {
          if (c.points.length < 2) return null
          // split into segments to handle discontinuities
          const segments = []
          let seg = [c.points[0]]
          for (let i = 1; i < c.points.length; i++) {
            const gap = Math.abs(c.points[i].y - c.points[i - 1].y)
            if (gap > (yMax - yMin) * 2) {
              if (seg.length >= 2) segments.push(seg)
              seg = [c.points[i]]
            } else {
              seg.push(c.points[i])
            }
          }
          if (seg.length >= 2) segments.push(seg)

          return segments.map((pts, si) => (
            <polyline
              key={`${ci}-${si}`}
              points={pts.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              stroke={c.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))
        })}

        {/* analysis points */}
        {analysisPoints.map((pt, i) => {
          const cx = sx(pt.x), cy = sy(pt.y)
          const label = `(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})`
          if (pt.shape === 'diamond') return (
            <g key={`ap${i}`}>
              <polygon points={`${cx},${cy-5} ${cx+5},${cy} ${cx},${cy+5} ${cx-5},${cy}`} fill={pt.color} opacity="0.9"><title>{label}</title></polygon>
            </g>
          )
          if (pt.shape === 'triangle-up') return (
            <g key={`ap${i}`}>
              <polygon points={`${cx},${cy-6} ${cx+5},${cy+3} ${cx-5},${cy+3}`} fill={pt.color} opacity="0.9"><title>{label}</title></polygon>
            </g>
          )
          if (pt.shape === 'triangle-down') return (
            <g key={`ap${i}`}>
              <polygon points={`${cx-5},${cy-3} ${cx+5},${cy-3} ${cx},${cy+6}`} fill={pt.color} opacity="0.9"><title>{label}</title></polygon>
            </g>
          )
          return (
            <g key={`ap${i}`}>
              <circle cx={cx} cy={cy} r="4.5" fill={pt.fill || pt.color} stroke={pt.color} strokeWidth="2" opacity="0.9"><title>{label}</title></circle>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

/* ── main component ─────────────────────────────────────────── */

export function ScientificCalculator({ open, onToggle, standalone = false }) {
  const [mode, setMode] = useState('calc') // 'calc' | 'graph' | 'stats' | 'dist' | 'matrix'
  const [expr, setExpr] = useState('')
  const [history, setHistory] = useState('')
  const [showSci, setShowSci] = useState(true)
  const [graphFns, setGraphFns] = useState([{ expr: 'sin(x)', color: GRAPH_COLORS[0] }])
  const [xRange, setXRange] = useState([-10, 10])
  const [yRangeManual, setYRangeManual] = useState(null) // null = auto
  const panelRef = useRef(null)
  const graphInputRefs = useRef([])
  const [showAnalysis, setShowAnalysis] = useState(false)
  // calculus tools state
  const [integralBounds, setIntegralBounds] = useState({ a: '', b: '' })
  const [derivPoint, setDerivPoint] = useState('')
  const [showTable, setShowTable] = useState(false)
  const [tableStep, setTableStep] = useState('1')
  const [solverGuess, setSolverGuess] = useState('0')
  // matrix state
  const [matA, setMatA] = useState('1 0\n0 1')
  const [matB, setMatB] = useState('1 0\n0 1')
  const [matOp, setMatOp] = useState('mul')
  const [matResult, setMatResult] = useState('')

  const preview = safeEval(expr)

  const validGraphFnsForAnalysis = graphFns.filter(fn => fn.expr.trim() && evalForGraph(fn.expr, 0) !== null)

  const analysisData = useMemo(() => {
    if (!showAnalysis) return { perFn: [], intersections: [], points: [] }
    const [xMin, xMax] = xRange
    const perFn = validGraphFnsForAnalysis.map(fn => ({
      expr: fn.expr,
      color: fn.color,
      zeros: findZeros(fn.expr, xMin, xMax),
      yIntercept: findYIntercept(fn.expr),
      extrema: findExtrema(fn.expr, xMin, xMax),
    }))

    const intersections = []
    for (let i = 0; i < validGraphFnsForAnalysis.length; i++) {
      for (let j = i + 1; j < validGraphFnsForAnalysis.length; j++) {
        const pts = findIntersections(validGraphFnsForAnalysis[i].expr, validGraphFnsForAnalysis[j].expr, xMin, xMax)
        if (pts.length) intersections.push({ i, j, color1: validGraphFnsForAnalysis[i].color, color2: validGraphFnsForAnalysis[j].color, pts })
      }
    }

    const points = []
    perFn.forEach(fn => {
      fn.zeros.forEach(x => points.push({ x, y: 0, color: fn.color, fill: '#0e1219', shape: 'circle' }))
      if (fn.yIntercept) points.push({ x: 0, y: fn.yIntercept.y, color: fn.color, fill: fn.color, shape: 'circle' })
      fn.extrema.forEach(e => points.push({ x: e.x, y: e.y, color: fn.color, shape: e.type === 'max' ? 'triangle-up' : e.type === 'min' ? 'triangle-down' : 'circle' }))
    })
    intersections.forEach(inter => {
      inter.pts.forEach(p => points.push({ x: p.x, y: p.y, color: '#fff', shape: 'diamond' }))
    })

    return { perFn, intersections, points }
  }, [showAnalysis, validGraphFnsForAnalysis, xRange])

  const handleButton = useCallback((btn) => {
    if (btn.action === 'clear') {
      setExpr('')
      setHistory('')
      return
    }
    if (btn.action === 'backspace') {
      setExpr(prev => {
        const funcMatch = prev.match(/(asin|acos|atan|sin|cos|tan|ln|log|sqrt|abs)\($/)
        if (funcMatch) return prev.slice(0, -funcMatch[0].length)
        return prev.slice(0, -1)
      })
      return
    }
    if (btn.action === 'evaluate') {
      const result = safeEval(expr)
      if (result && result !== 'Error') {
        setHistory(expr + ' =')
        setExpr(result)
      }
      return
    }
    if (btn.action === 'negate') {
      setExpr(prev => {
        if (!prev) return '-'
        if (prev.startsWith('-')) return prev.slice(1)
        return '-' + prev
      })
      return
    }
    if (btn.insert !== undefined) {
      setExpr(prev => prev + btn.insert)
    }
  }, [expr])

  // keyboard support
  useEffect(() => {
    if (!open || mode === 'graph' || mode === 'stats' || mode === 'dist' || mode === 'matrix') return
    const handler = (e) => {
      if (e.key === 'Escape') { onToggle(); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        const result = safeEval(expr)
        if (result && result !== 'Error') {
          setHistory(expr + ' =')
          setExpr(result)
        }
        return
      }
      if (e.key === 'Backspace') {
        setExpr(prev => prev.slice(0, -1))
        return
      }
      if (/^[0-9.+\-*/^()!eπx]$/.test(e.key)) {
        e.preventDefault()
        setExpr(prev => prev + e.key)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, expr, mode])

  const updateGraphFn = (idx, value) => {
    setGraphFns(prev => prev.map((fn, i) => i === idx ? { ...fn, expr: value } : fn))
  }

  const addGraphFn = () => {
    if (graphFns.length >= 5) return
    setGraphFns(prev => [...prev, { expr: '', color: GRAPH_COLORS[prev.length % GRAPH_COLORS.length] }])
  }

  const removeGraphFn = (idx) => {
    if (graphFns.length <= 1) return
    setGraphFns(prev => prev.filter((_, i) => i !== idx))
  }

  const validGraphFns = graphFns.filter(fn => fn.expr.trim())

  const btnClass = (btn) => {
    const base = `flex ${standalone ? 'h-12 text-sm' : 'h-11 text-sm'} items-center justify-center rounded-xl font-semibold transition-all active:scale-95 select-none`
    if (btn.accent) return `${base} bg-aqua text-white shadow-[0_4px_12px_rgba(120,180,255,0.3)]`
    if (btn.action === 'clear') return `${base} bg-signal/20 text-signal`
    if (btn.action === 'backspace') return `${base} bg-white/8 text-paper/70`
    if (btn.type === BTN.op) return `${base} bg-white/10 text-aqua font-bold`
    if (btn.type === BTN.fn || btn.type === BTN.const) return `${base} bg-white/6 text-paper/65 text-xs`
    return `${base} bg-white/12 text-paper`
  }

  const modeBtn = (m, label) => (
    <button
      onClick={() => setMode(m)}
      className={`flex-1 rounded-full px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-wider transition-colors ${mode === m ? 'bg-aqua/20 text-aqua' : 'text-paper/45 hover:text-paper/65'}`}
    >
      {label}
    </button>
  )

  return (
    <>
      {/* floating button removed — calculator access is via navbar */}

      {/* inline panel — used when rendered standalone at /calculadora */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={standalone
              ? 'mx-auto w-full max-w-5xl min-h-screen bg-ink text-paper px-6 py-3'
              : 'mx-auto w-full max-w-md rounded-[1.6rem] border border-white/10 bg-ink text-paper shadow-[0_28px_80px_rgba(0,0,0,0.45)]'
            }
          >
            {/* header — mode toggle */}
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-2.5">
              <div className="flex gap-2 rounded-full bg-white/6 p-1">
                {modeBtn('calc', 'Calc')}
                {modeBtn('graph', 'Graf')}
                {modeBtn('stats', 'Stats')}
                {modeBtn('dist', 'Dist')}
                {modeBtn('matrix', 'Mat')}
              </div>
              {mode === 'calc' && (
                <button
                  onClick={() => setShowSci(v => !v)}
                  className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wider transition-colors ${showSci ? 'bg-aqua/20 text-aqua' : 'bg-white/8 text-paper/45'}`}
                >
                  SCI
                </button>
              )}
            </div>

            {mode === 'calc' && (
              <>
                {/* display */}
                <div className="border-b border-white/8 px-5 py-4">
                  {history && (
                    <p className="mb-1 truncate text-right text-xs text-paper/35">{history}</p>
                  )}
                  <p className={`truncate text-right font-display font-bold tracking-tight text-paper ${standalone ? 'min-h-[2.5rem] text-3xl' : 'min-h-[2rem] text-2xl'}`}>
                    {expr || '0'}
                  </p>
                  {preview && preview !== expr && (
                    <p className="mt-1 truncate text-right text-sm text-aqua/70">= {preview}</p>
                  )}
                </div>

                {/* scientific rows */}
                <AnimatePresence>
                  {showSci && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden border-b border-white/8"
                    >
                      <div className="grid gap-[3px] p-3">
                        {ROWS_SCIENTIFIC.map((row, ri) => (
                          <div key={ri} className="grid grid-cols-5 gap-[3px]">
                            {row.map((btn) => (
                              <button
                                key={btn.label}
                                onClick={() => handleButton(btn)}
                                className={btnClass(btn)}
                              >
                                {btn.label}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* main keypad */}
                <div className="grid gap-[3px] p-3">
                  {ROWS_MAIN.map((row, ri) => (
                    <div key={ri} className="grid grid-cols-5 gap-[3px]">
                      {row.map((btn) => (
                        <button
                          key={btn.label}
                          onClick={() => handleButton(btn)}
                          className={`${btnClass(btn)} ${btn.wide ? 'col-span-2' : ''}`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}

            {mode === 'graph' && (
              /* ── GRAPH MODE ── */
              <div className="flex flex-col">
                {/* graph canvas */}
                <div className="border-b border-white/8 p-3">
                  {validGraphFns.length > 0 ? (
                    <MiniGraph functions={validGraphFns} xRange={xRange} yRangeOverride={yRangeManual} analysisPoints={analysisData.points} />
                  ) : (
                    <div className="flex h-[200px] items-center justify-center rounded-xl bg-[#0e1219] text-sm text-paper/30">
                      Escribe una función para graficar
                    </div>
                  )}
                </div>

                {/* window controls */}
                <div className="flex flex-col gap-1.5 border-b border-white/8 px-4 py-2.5">
                  {[
                    { label: 'x', range: xRange, setRange: setXRange, manual: xRange, autoVal: null },
                    { label: 'y', range: yRangeManual, setRange: setYRangeManual, manual: yRangeManual, autoVal: true },
                  ].map(({ label, range, setRange, manual, autoVal }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-14 text-[0.6rem] uppercase tracking-wider text-paper/40">Ventana {label}</span>
                      <input
                        type="text"
                        placeholder="min"
                        value={range ? range[0] : ''}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '' && autoVal) { setRange(null); return }
                          if (v === '-' || v === '') return
                          const n = Number(v)
                          if (!isNaN(n)) setRange([n, range ? range[1] : 10])
                        }}
                        className="w-14 rounded bg-white/8 px-1.5 py-1 font-mono text-[0.65rem] text-paper text-center outline-none placeholder:text-paper/25 focus:ring-1 focus:ring-aqua/40"
                      />
                      <span className="text-paper/30">→</span>
                      <input
                        type="text"
                        placeholder="max"
                        value={range ? range[1] : ''}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '' && autoVal) { setRange(null); return }
                          if (v === '-' || v === '') return
                          const n = Number(v)
                          if (!isNaN(n)) setRange([range ? range[0] : -10, n])
                        }}
                        className="w-14 rounded bg-white/8 px-1.5 py-1 font-mono text-[0.65rem] text-paper text-center outline-none placeholder:text-paper/25 focus:ring-1 focus:ring-aqua/40"
                      />
                      {autoVal && (
                        <button
                          onClick={() => setRange(null)}
                          className={`ml-auto rounded px-2 py-0.5 text-[0.6rem] font-semibold transition-colors ${!range ? 'bg-aqua/15 text-aqua' : 'bg-white/6 text-paper/40 hover:bg-white/10'}`}
                        >Auto</button>
                      )}
                    </div>
                  ))}
                </div>

                {/* function inputs */}
                <div className="space-y-2 p-3">
                  {graphFns.map((fn, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: fn.color }}
                      />
                      <span className="text-xs text-paper/50">f{i > 0 ? i + 1 : ''}(x) =</span>
                      <input
                        ref={el => graphInputRefs.current[i] = el}
                        type="text"
                        value={fn.expr}
                        onChange={(e) => updateGraphFn(i, e.target.value)}
                        placeholder="sin(x)"
                        className="min-w-0 flex-1 rounded-lg bg-white/8 px-3 py-2 font-mono text-sm text-paper outline-none placeholder:text-paper/25 focus:ring-1 focus:ring-aqua/40"
                      />
                      {graphFns.length > 1 && (
                        <button
                          onClick={() => removeGraphFn(i)}
                          className="shrink-0 text-paper/30 hover:text-signal"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {graphFns.length < 5 && (
                    <button
                      onClick={addGraphFn}
                      className="flex w-full items-center justify-center gap-1 rounded-lg bg-white/6 py-2 text-xs text-paper/40 transition-colors hover:bg-white/10 hover:text-paper/60"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                      Agregar función
                    </button>
                  )}
                </div>

                {/* analysis toggle + panel */}
                <div className="border-t border-white/8 px-3 py-2">
                  <button
                    onClick={() => setShowAnalysis(v => !v)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${showAnalysis ? 'bg-aqua/15 text-aqua' : 'bg-white/6 text-paper/50 hover:bg-white/10 hover:text-paper/70'}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    Análisis
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`ml-auto transition-transform ${showAnalysis ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6"/></svg>
                  </button>

                  {showAnalysis && analysisData.perFn.length > 0 && (() => {
                    const fmt = v => { const s = v.toFixed(3); return s === '-0.000' ? '0.000' : s }
                    return (
                    <div className="mt-2 space-y-2 text-[0.65rem]">
                      {analysisData.perFn.map((fn, i) => (
                        <div key={i} className="space-y-1 rounded-lg bg-white/4 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: fn.color }} />
                            <span className="font-mono text-paper/60">{fn.expr}</span>
                          </div>
                          {fn.yIntercept && (
                            <p className="text-paper/50">
                              <span className="text-paper/35">Corte Y:</span>{' '}
                              (0, {fmt(fn.yIntercept.y)})
                            </p>
                          )}
                          {fn.zeros.length > 0 && (
                            <p className="text-paper/50">
                              <span className="text-paper/35">Ceros:</span>{' '}
                              {fn.zeros.map(z => `x = ${fmt(z)}`).join(', ')}
                            </p>
                          )}
                          {fn.extrema.length > 0 && (
                            <p className="text-paper/50">
                              <span className="text-paper/35">Extremos:</span>{' '}
                              {fn.extrema.map(e => `${e.type === 'max' ? 'Máx' : e.type === 'min' ? 'Mín' : 'Infl'} (${fmt(e.x)}, ${fmt(e.y)})`).join(', ')}
                            </p>
                          )}
                        </div>
                      ))}
                      {analysisData.intersections.length > 0 && (
                        <div className="rounded-lg bg-white/4 px-3 py-2">
                          <p className="mb-1 font-semibold text-paper/45">Intersecciones</p>
                          {analysisData.intersections.map((inter, k) => (
                            <p key={k} className="text-paper/50">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: inter.color1 }} />{' '}
                              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: inter.color2 }} />{' '}
                              {inter.pts.map(p => `(${fmt(p.x)}, ${fmt(p.y)})`).join(', ')}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    )
                  })()}
                </div>

                {/* ── calculus tools ── */}
                {validGraphFns.length > 0 && (
                  <div className="space-y-2 border-t border-white/8 px-3 py-2.5">
                    <p className="text-[0.6rem] uppercase tracking-wider text-paper/35">Herramientas</p>

                    {/* integral */}
                    <div className="flex items-center gap-1.5 text-[0.65rem]">
                      <span className="text-paper/40">∫</span>
                      <input type="text" value={integralBounds.a} onChange={e => setIntegralBounds(p => ({ ...p, a: e.target.value }))} placeholder="a" className="w-12 rounded bg-white/8 px-2 py-1 font-mono text-paper text-center outline-none placeholder:text-paper/25 focus:ring-1 focus:ring-aqua/40" />
                      <span className="text-paper/40">→</span>
                      <input type="text" value={integralBounds.b} onChange={e => setIntegralBounds(p => ({ ...p, b: e.target.value }))} placeholder="b" className="w-12 rounded bg-white/8 px-2 py-1 font-mono text-paper text-center outline-none placeholder:text-paper/25 focus:ring-1 focus:ring-aqua/40" />
                      <button
                        onClick={() => {
                          const a = parseFloat(integralBounds.a), b = parseFloat(integralBounds.b)
                          if (!isNaN(a) && !isNaN(b) && validGraphFns[0]?.expr) {
                            const result = numericalIntegral(validGraphFns[0].expr, a, b)
                            setHistory(`∫[${a},${b}] ${validGraphFns[0].expr} = ${result !== null ? parseFloat(result.toPrecision(8)) : 'Error'}`)
                          }
                        }}
                        className="rounded bg-aqua/15 px-2 py-1 font-semibold text-aqua hover:bg-aqua/25"
                      >Calcular</button>
                    </div>

                    {/* derivative */}
                    <div className="flex items-center gap-1.5 text-[0.65rem]">
                      <span className="text-paper/40">f'(</span>
                      <input type="text" value={derivPoint} onChange={e => setDerivPoint(e.target.value)} placeholder="x₀" className="w-14 rounded bg-white/8 px-2 py-1 font-mono text-paper text-center outline-none placeholder:text-paper/25 focus:ring-1 focus:ring-aqua/40" />
                      <span className="text-paper/40">)</span>
                      <button
                        onClick={() => {
                          const x0 = parseFloat(derivPoint)
                          if (!isNaN(x0) && validGraphFns[0]?.expr) {
                            const result = numericalDerivative(validGraphFns[0].expr, x0)
                            setHistory(`f'(${x0}) = ${result !== null ? parseFloat(result.toPrecision(8)) : 'Error'}`)
                          }
                        }}
                        className="rounded bg-aqua/15 px-2 py-1 font-semibold text-aqua hover:bg-aqua/25"
                      >Calcular</button>
                    </div>

                    {/* solver */}
                    <div className="flex items-center gap-1.5 text-[0.65rem]">
                      <span className="text-paper/40">f(x)=0</span>
                      <input type="text" value={solverGuess} onChange={e => setSolverGuess(e.target.value)} placeholder="x₀" className="w-14 rounded bg-white/8 px-2 py-1 font-mono text-paper text-center outline-none placeholder:text-paper/25 focus:ring-1 focus:ring-aqua/40" />
                      <button
                        onClick={() => {
                          const x0 = parseFloat(solverGuess)
                          if (!isNaN(x0) && validGraphFns[0]?.expr) {
                            const result = solveEquation(validGraphFns[0].expr, x0, xRange[0], xRange[1])
                            setHistory(`Solve: x = ${result !== null ? parseFloat(result.toPrecision(8)) : 'Sin solución'}`)
                          }
                        }}
                        className="rounded bg-aqua/15 px-2 py-1 font-semibold text-aqua hover:bg-aqua/25"
                      >Resolver</button>
                    </div>

                    {/* result display */}
                    {history && (mode === 'graph') && (
                      <div className="rounded-lg bg-aqua/8 px-3 py-1.5 font-mono text-[0.65rem] text-aqua">{history}</div>
                    )}

                    {/* table toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowTable(v => !v)}
                        className={`flex items-center gap-1.5 rounded px-2 py-1 text-[0.65rem] font-semibold transition-colors ${showTable ? 'bg-aqua/15 text-aqua' : 'bg-white/6 text-paper/50 hover:bg-white/10'}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
                        Tabla
                      </button>
                      {showTable && (
                        <div className="flex items-center gap-1 text-[0.6rem]">
                          <span className="text-paper/35">Paso:</span>
                          <input type="text" value={tableStep} onChange={e => setTableStep(e.target.value)} className="w-10 rounded bg-white/8 px-1.5 py-0.5 font-mono text-paper text-center outline-none focus:ring-1 focus:ring-aqua/40" />
                        </div>
                      )}
                    </div>
                    {showTable && validGraphFns[0]?.expr && (() => {
                      const step = parseFloat(tableStep) || 1
                      const rows = generateTable(validGraphFns[0].expr, xRange[0], xRange[1], step)
                      return (
                        <div className="max-h-40 overflow-y-auto rounded-lg bg-white/4">
                          <table className="w-full text-[0.6rem]">
                            <thead><tr className="border-b border-white/8">
                              <th className="px-3 py-1 text-left font-semibold text-paper/40">x</th>
                              <th className="px-3 py-1 text-left font-semibold text-paper/40">f(x)</th>
                            </tr></thead>
                            <tbody>{rows.map((r, i) => (
                              <tr key={i} className="border-b border-white/4">
                                <td className="px-3 py-0.5 font-mono text-paper/55">{r.x}</td>
                                <td className="px-3 py-0.5 font-mono text-paper/55">{r.y !== null ? parseFloat(r.y.toPrecision(6)) : '—'}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* quick examples */}
                <div className="flex flex-wrap gap-1.5 border-t border-white/8 px-3 py-2.5">
                  {['sin(x)', 'x^2', 'cos(x)', 'ln(x)', 'sqrt(x)', '1÷x'].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => {
                        const emptyIdx = graphFns.findIndex(fn => !fn.expr.trim())
                        if (emptyIdx >= 0) updateGraphFn(emptyIdx, ex)
                        else if (graphFns.length < 5) setGraphFns(prev => [...prev, { expr: ex, color: GRAPH_COLORS[prev.length % GRAPH_COLORS.length] }])
                      }}
                      className="rounded-full bg-white/6 px-2.5 py-1 font-mono text-[0.65rem] text-paper/50 transition-colors hover:bg-white/12 hover:text-paper/70"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── MATRIX MODE ── */}
            {mode === 'matrix' && (
              <div className="flex flex-col space-y-3 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[0.6rem] uppercase tracking-wider text-paper/35">Matriz A</label>
                    <textarea value={matA} onChange={e => setMatA(e.target.value)} rows={3} className="mt-1 w-full rounded-lg bg-white/8 px-3 py-2 font-mono text-xs text-paper outline-none placeholder:text-paper/25 focus:ring-1 focus:ring-aqua/40" placeholder="1 2&#10;3 4" />
                  </div>
                  <div>
                    <label className="text-[0.6rem] uppercase tracking-wider text-paper/35">Matriz B</label>
                    <textarea value={matB} onChange={e => setMatB(e.target.value)} rows={3} className="mt-1 w-full rounded-lg bg-white/8 px-3 py-2 font-mono text-xs text-paper outline-none placeholder:text-paper/25 focus:ring-1 focus:ring-aqua/40" placeholder="1 0&#10;0 1" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    ['mul', 'A × B'], ['add', 'A + B'], ['det', 'det(A)'],
                    ['inv', 'A⁻¹'], ['trans', 'Aᵀ'], ['rref', 'RREF(A)']
                  ].map(([op, label]) => (
                    <button
                      key={op}
                      onClick={() => {
                        setMatOp(op)
                        const a = parseMatrix(matA)
                        const b = parseMatrix(matB)
                        try {
                          let res
                          if (op === 'mul') res = matMul(a, b)
                          else if (op === 'add') res = matAdd(a, b)
                          else if (op === 'det') { setMatResult(`det(A) = ${matDet(a)}`); return }
                          else if (op === 'inv') res = matInverse(a)
                          else if (op === 'trans') res = matTranspose(a)
                          else if (op === 'rref') res = matRref(a.map(r => [...r]))
                          setMatResult(res ? formatMatrix(res) : 'Error: dimensiones incompatibles o matriz singular')
                        } catch { setMatResult('Error') }
                      }}
                      className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition-colors ${matOp === op ? 'bg-aqua/20 text-aqua' : 'bg-white/6 text-paper/50 hover:bg-white/12'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {matResult && (
                  <div className="rounded-lg bg-white/4 p-3">
                    <p className="mb-1 text-[0.6rem] uppercase tracking-wider text-paper/35">Resultado</p>
                    <pre className="whitespace-pre font-mono text-xs leading-5 text-paper/70">{matResult}</pre>
                  </div>
                )}
              </div>
            )}

            {mode === 'stats' && <StatsMode />}

            {mode === 'dist' && <DistMode />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

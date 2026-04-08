import { useState, useCallback, useRef, useEffect, useId, useMemo } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { StatsMode } from './StatsMode'

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

function MiniGraph({ functions, xRange }) {
  const clipId = useId().replace(/:/g, '')
  const W = 340
  const H = 200
  const pad = 24
  const [xMin, xMax] = xRange
  const samples = 200

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

  // compute y range from data
  let yMin = -1, yMax = 1
  for (const c of curves) {
    for (const pt of c.points) {
      if (Math.abs(pt.y) < 1000) {
        if (pt.y < yMin) yMin = pt.y
        if (pt.y > yMax) yMax = pt.y
      }
    }
  }
  const yPad = Math.max((yMax - yMin) * 0.15, 0.5)
  yMin -= yPad
  yMax += yPad

  const sx = (v) => pad + ((v - xMin) / ((xMax - xMin) || 1)) * (W - pad * 2)
  const sy = (v) => H - pad - ((v - yMin) / ((yMax - yMin) || 1)) * (H - pad * 2)

  // generate nice ticks
  const makeTicks = (min, max, count) => {
    const range = max - min
    const step = Math.pow(10, Math.floor(Math.log10(range / count)))
    const ticks = []
    const start = Math.ceil(min / step) * step
    for (let v = start; v <= max; v += step) {
      ticks.push(parseFloat(v.toPrecision(6)))
      if (ticks.length > 20) break
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

      {/* tick labels */}
      {xTicks.map((t) => (
        Math.abs(t) > 0.001 && yMin <= 0 && yMax >= 0 ? (
          <text key={`xl${t}`} x={sx(t)} y={sy(0) + 14} fill="rgba(255,255,255,0.45)" fontSize="8" textAnchor="middle">{t}</text>
        ) : null
      ))}
      {yTicks.map((t) => (
        Math.abs(t) > 0.001 && xMin <= 0 && xMax >= 0 ? (
          <text key={`yl${t}`} x={sx(0) - 6} y={sy(t) + 3} fill="rgba(255,255,255,0.45)" fontSize="8" textAnchor="end">{t}</text>
        ) : null
      ))}

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
      </g>
    </svg>
  )
}

/* ── main component ─────────────────────────────────────────── */

export function ScientificCalculator({ open, onToggle }) {
  const [mode, setMode] = useState('calc') // 'calc' | 'graph' | 'stats'
  const [expr, setExpr] = useState('')
  const [history, setHistory] = useState('')
  const [showSci, setShowSci] = useState(true)
  const [graphFns, setGraphFns] = useState([{ expr: 'sin(x)', color: GRAPH_COLORS[0] }])
  const [xRange, setXRange] = useState([-10, 10])
  const dragControls = useDragControls()
  const panelRef = useRef(null)
  const graphInputRefs = useRef([])

  const preview = safeEval(expr)

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
    if (!open || mode === 'graph' || mode === 'stats') return
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
    const base = 'flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-all active:scale-95 select-none'
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
      {/* floating toggle button */}
      <button
        onClick={onToggle}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_32px_rgba(255,107,53,0.4)] transition-all hover:scale-110 active:scale-95 md:bottom-8 md:right-8 ${open ? 'bg-ink text-paper' : 'bg-signal text-white animate-pulse'}`}
        aria-label={open ? 'Cerrar calculadora' : 'Abrir calculadora'}
        title="Calculadora y graficadora"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="8" y1="6" x2="16" y2="6" />
            <line x1="8" y1="10" x2="8" y2="10.01" />
            <line x1="12" y1="10" x2="12" y2="10.01" />
            <line x1="16" y1="10" x2="16" y2="10.01" />
            <line x1="8" y1="14" x2="8" y2="14.01" />
            <line x1="12" y1="14" x2="12" y2="14.01" />
            <line x1="16" y1="14" x2="16" y2="14.01" />
            <line x1="8" y1="18" x2="8" y2="18.01" />
            <line x1="12" y1="18" x2="12" y2="18.01" />
            <line x1="16" y1="18" x2="16" y2="18.01" />
          </svg>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            drag
            dragControls={dragControls}
            dragMomentum={false}
            dragElastic={0}
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed right-4 top-20 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[1.6rem] border border-white/10 bg-ink text-paper shadow-[0_28px_80px_rgba(0,0,0,0.45)] md:right-8"
          >
            {/* header — drag handle + mode toggle */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="flex cursor-grab items-center justify-between gap-3 border-b border-white/8 px-4 py-2.5 active:cursor-grabbing"
            >
              <div className="flex gap-2 rounded-full bg-white/6 p-1">
                {modeBtn('calc', 'Calc')}
                {modeBtn('graph', 'Gráfica')}
                {modeBtn('stats', 'Stats')}
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
                  <p className="min-h-[2rem] truncate text-right font-display text-2xl font-bold tracking-tight text-paper">
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
                    <MiniGraph functions={validGraphFns} xRange={xRange} />
                  ) : (
                    <div className="flex h-[200px] items-center justify-center rounded-xl bg-[#0e1219] text-sm text-paper/30">
                      Escribe una función para graficar
                    </div>
                  )}
                </div>

                {/* x range slider */}
                <div className="flex items-center gap-3 border-b border-white/8 px-4 py-2">
                  <span className="text-[0.6rem] uppercase tracking-wider text-paper/40">Rango x</span>
                  <span className="text-xs font-mono text-paper/55">[{xRange[0]}, {xRange[1]}]</span>
                  <input
                    type="range"
                    min="2"
                    max="50"
                    value={xRange[1]}
                    onChange={(e) => { const v = Number(e.target.value); setXRange([-v, v]) }}
                    className="ml-auto h-1.5 w-20 cursor-pointer accent-aqua"
                  />
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

            {mode === 'stats' && <StatsMode />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

import { useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CartesianFrame, MetricCard, SliderField } from './DerivaLabPrimitives'
import { format, sampleRange } from './derivaLabUtils'
import { parseBivariateInput } from './statisticsUtils'
import {
  rankModels, computeR2,
  MODEL_FAMILIES, interpretR2, interpretModel,
  getPatternHints, SAMPLE_DATASETS,
} from './modelFitting'

/* ── Tick generator ──────────────────────────────────── */

function makeTicks(min, max, count = 6) {
  const range = max - min
  if (range === 0) return [min]
  // Find a "nice" step that gives approximately `count` ticks
  const rawStep = range / count
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  // Round to nearest "nice" number: 1, 2, 5, 10
  const niceStep = residual <= 1.5 ? magnitude : residual <= 3.5 ? 2 * magnitude : residual <= 7.5 ? 5 * magnitude : 10 * magnitude
  const ticks = []
  const start = Math.ceil(min / niceStep) * niceStep
  for (let v = start; v <= max + niceStep * 0.01; v += niceStep) {
    ticks.push(parseFloat(v.toPrecision(6)))
    if (ticks.length > count + 2) break
  }
  return ticks
}

/* ── Model family mini-curve icons ───────────────────── */

const MINI_CURVES = {
  linear:      'M 4 28 L 36 4',
  quadratic:   'M 4 28 Q 20 0, 36 28',
  exponential: 'M 4 30 C 12 29, 24 22, 36 4',
  power:       'M 4 30 C 10 16, 20 10, 36 6',
  logarithmic: 'M 6 30 C 10 12, 18 8, 36 6',
  sinusoidal:  'M 4 16 C 10 4, 16 4, 20 16 S 30 28, 36 16',
}

/* ── Constants ───────────────────────────────────────── */

const GRAPH_COLORS = ['#ff6b35', '#5096ff', '#22c5a0', '#a855f7', '#f59e0b', '#f43f5e']

const PATTERN_OPTIONS = [
  { id: 'crece', label: 'Crece', icon: '↗' },
  { id: 'decrece', label: 'Decrece', icon: '↘' },
  { id: 'sube_baja', label: 'Sube y baja', icon: '∿' },
  { id: 'oscila', label: 'Oscila', icon: '∼' },
  { id: null, label: 'No estoy seguro', icon: '?' },
]

/* ── CSV/TSV file parser ─────────────────────────────── */

function parseFileContent(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { x: '', y: '', error: 'Archivo muy corto' }

  // Detect separator
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ','

  // Check if first row is a header (contains non-numeric text)
  const firstCells = lines[0].split(sep).map(s => s.trim())
  const hasHeader = firstCells.some(c => isNaN(Number(c)) && c !== '')
  const dataLines = hasHeader ? lines.slice(1) : lines

  const xs = [], ys = []
  for (const line of dataLines) {
    const cells = line.split(sep).map(s => s.trim())
    if (cells.length < 2) continue
    const x = Number(cells[0]), y = Number(cells[1])
    if (!isNaN(x) && !isNaN(y)) { xs.push(x); ys.push(y) }
  }

  if (xs.length < 2) return { x: '', y: '', error: 'No se encontraron datos numéricos' }
  return { x: xs.join(', '), y: ys.join(', '), error: null }
}

/* ── Scatter plot with optional fitted curves ────────── */

function DataChart({ xs, ys, fittedModels, selectedModelId, showAllCurves = false, predictionX = null, dark = true, xLabel = '', yLabel = '' }) {
  if (xs.length < 2) return null

  const dataXMin = Math.min(...xs), dataXMax = Math.max(...xs)
  const xPad = (dataXMax - dataXMin) * 0.1 || 1
  const yPad = (Math.max(...ys) - Math.min(...ys)) * 0.1 || 1
  let xMin = dataXMin - xPad
  let xMax = dataXMax + xPad
  let yMin = Math.min(...ys) - yPad
  let yMax = Math.max(...ys) + yPad

  // Extend x range if prediction point is outside
  if (predictionX != null && isFinite(predictionX)) {
    if (predictionX < xMin) xMin = predictionX - xPad
    if (predictionX > xMax) xMax = predictionX + xPad
  }

  // Extend y range to include fitted curves
  const modelsToShow = showAllCurves ? fittedModels : fittedModels.filter(m => m.id === selectedModelId)
  for (const model of modelsToShow) {
    const pts = sampleRange(xMin, xMax, 200, model.fn)
    for (const pt of pts) {
      if (isFinite(pt.y) && Math.abs(pt.y) < (yMax - yMin) * 20) {
        if (pt.y < yMin) yMin = pt.y
        if (pt.y > yMax) yMax = pt.y
      }
    }
  }

  // Include prediction point in y range
  const selected = fittedModels.find(m => m.id === selectedModelId) || fittedModels[0]
  let predY = null
  if (predictionX != null && selected) {
    predY = selected.fn(predictionX)
    if (isFinite(predY)) {
      if (predY < yMin) yMin = predY - yPad
      if (predY > yMax) yMax = predY + yPad
    }
  }

  const xTicks = makeTicks(xMin, xMax, 6)
  const yTicks = makeTicks(yMin, yMax, 5)

  // Confidence band: ± residual std dev
  const residualStd = selected ? (() => {
    let ss = 0
    for (let i = 0; i < xs.length; i++) {
      const r = ys[i] - selected.fn(xs[i])
      ss += r * r
    }
    return Math.sqrt(ss / Math.max(xs.length - 1, 1))
  })() : 0

  return (
    <CartesianFrame
      width={620} height={320}
      xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax}
      xTicks={xTicks} yTicks={yTicks}
      dark={dark}
    >
      {({ scaleX, scaleY, width, height }) => (
        <>
          {/* extrapolation zone shading */}
          {predictionX != null && (predictionX < dataXMin || predictionX > dataXMax) && (
            <>
              {predictionX < dataXMin && (
                <rect x={scaleX(xMin)} y={scaleY(yMax)} width={scaleX(dataXMin) - scaleX(xMin)}
                  height={scaleY(yMin) - scaleY(yMax)} fill="#f43f5e" opacity="0.04" />
              )}
              {predictionX > dataXMax && (
                <rect x={scaleX(dataXMax)} y={scaleY(yMax)} width={scaleX(xMax) - scaleX(dataXMax)}
                  height={scaleY(yMin) - scaleY(yMax)} fill="#f43f5e" opacity="0.04" />
              )}
            </>
          )}

          {/* confidence band for selected model */}
          {selected && residualStd > 0 && (() => {
            const pts = sampleRange(xMin, xMax, 100, selected.fn)
            const validPts = pts.filter(pt => isFinite(pt.y))
            if (validPts.length < 2) return null
            const upper = validPts.map(pt => `${scaleX(pt.x)},${scaleY(pt.y + residualStd)}`).join(' ')
            const lower = [...validPts].reverse().map(pt => `${scaleX(pt.x)},${scaleY(pt.y - residualStd)}`).join(' ')
            return <polygon points={`${upper} ${lower}`} fill="#ff6b35" opacity="0.08" />
          })()}

          {/* fitted curves */}
          {fittedModels.map((model, idx) => {
            const isSelected = model.id === selectedModelId
            if (!isSelected && !showAllCurves) return null
            const pts = sampleRange(xMin, xMax, 300, model.fn)
            const validPts = pts.filter(pt => isFinite(pt.y) && Math.abs(pt.y) < (yMax - yMin) * 10 + Math.abs(yMax))
            if (validPts.length < 2) return null
            return (
              <polyline
                key={model.id}
                points={validPts.map(pt => `${scaleX(pt.x)},${scaleY(pt.y)}`).join(' ')}
                fill="none"
                stroke={GRAPH_COLORS[idx % GRAPH_COLORS.length]}
                strokeWidth={isSelected ? 3 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isSelected ? 1 : 0.35}
              />
            )
          })}

          {/* residual lines for selected model */}
          {selected && xs.map((x, i) => {
            const yHat = selected.fn(x)
            if (!isFinite(yHat)) return null
            return (
              <line
                key={`res-${i}`}
                x1={scaleX(x)} y1={scaleY(ys[i])}
                x2={scaleX(x)} y2={scaleY(yHat)}
                stroke="#22c5a0" strokeWidth="1" strokeDasharray="3 2" opacity="0.5"
              />
            )
          })}

          {/* data points */}
          {xs.map((x, i) => (
            <circle
              key={i}
              cx={scaleX(x)} cy={scaleY(ys[i])} r="5"
              fill="#5096ff" stroke="rgba(18,23,35,0.4)" strokeWidth="1.5"
            />
          ))}

          {/* prediction point */}
          {predictionX != null && predY != null && isFinite(predY) && (
            <>
              <line x1={scaleX(predictionX)} y1={scaleY(yMin)} x2={scaleX(predictionX)} y2={scaleY(predY)}
                stroke="#ff6b35" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
              <line x1={scaleX(xMin)} y1={scaleY(predY)} x2={scaleX(predictionX)} y2={scaleY(predY)}
                stroke="#ff6b35" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
              <circle cx={scaleX(predictionX)} cy={scaleY(predY)} r="7"
                fill="#ff6b35" stroke="white" strokeWidth="2" />
            </>
          )}

          {/* legend when showing all curves */}
          {showAllCurves && fittedModels.length > 1 && fittedModels.map((model, idx) => (
            <g key={`leg-${model.id}`} transform={`translate(40, ${20 + idx * 18})`}>
              <line x1="0" y1="0" x2="16" y2="0"
                stroke={GRAPH_COLORS[idx % GRAPH_COLORS.length]} strokeWidth="2.5" />
              <text x="20" y="4" fontSize="10" fill="rgba(18,23,35,0.6)">{model.label}</text>
            </g>
          ))}

          {/* Axis labels */}
          {xLabel && (
            <text x={width / 2} y={height - 2} textAnchor="middle" fontSize="11" fontWeight="600"
              fill={dark ? 'rgba(255,255,255,0.55)' : 'rgba(18,23,35,0.45)'}>{xLabel}</text>
          )}
          {yLabel && (
            <text x={10} y={height / 2} textAnchor="middle" fontSize="11" fontWeight="600"
              fill={dark ? 'rgba(255,255,255,0.55)' : 'rgba(18,23,35,0.45)'}
              transform={`rotate(-90, 10, ${height / 2})`}>{yLabel}</text>
          )}
        </>
      )}
    </CartesianFrame>
  )
}

/* ── Residual plot ───────────────────────────────────── */

function ResidualPlot({ xs, ys, predictFn }) {
  if (!xs.length || !predictFn) return null
  const residuals = xs.map((x, i) => ({ x, r: ys[i] - predictFn(x) }))
  const rMax = Math.max(...residuals.map(p => Math.abs(p.r)), 0.01) * 1.2
  const xPad = (Math.max(...xs) - Math.min(...xs)) * 0.1 || 1
  const xMin = Math.min(...xs) - xPad
  const xMax = Math.max(...xs) + xPad
  const xTicks = makeTicks(xMin, xMax, 6)
  const yTicks = makeTicks(-rMax, rMax, 4)

  return (
    <div>
      <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-widest text-ink/45">Residuales</p>
      <CartesianFrame
        width={620} height={200}
        xMin={xMin} xMax={xMax} yMin={-rMax} yMax={rMax}
        xTicks={xTicks} yTicks={yTicks}
        dark={false}
      >
        {({ scaleX, scaleY }) => (
          <>
            {/* zero line */}
            <line x1={scaleX(xMin)} y1={scaleY(0)} x2={scaleX(xMax)} y2={scaleY(0)}
              stroke="rgba(18,23,35,0.3)" strokeWidth="1.5" strokeDasharray="6 3" />
            {/* residual points */}
            {residuals.map((p, i) => (
              <g key={i}>
                <line x1={scaleX(p.x)} y1={scaleY(0)} x2={scaleX(p.x)} y2={scaleY(p.r)}
                  stroke={p.r >= 0 ? '#5096ff' : '#f43f5e'} strokeWidth="1.5" opacity="0.5" />
                <circle cx={scaleX(p.x)} cy={scaleY(p.r)} r="4.5"
                  fill={p.r >= 0 ? '#5096ff' : '#f43f5e'} stroke="white" strokeWidth="1.5" />
              </g>
            ))}
          </>
        )}
      </CartesianFrame>
      <p className="mt-1 text-[0.6rem] text-ink/40 leading-relaxed">
        Si los puntos se distribuyen aleatoriamente arriba y abajo de la línea, el modelo captura bien la estructura.
        Si forman un patrón (curva, tendencia), falta algo.
      </p>
    </div>
  )
}

/* ── Diagnostic panel ────────────────────────────────── */

/* ── Prediction tool ──────────────────────────────────── */

function PredictionTool({ model, xs, xName, yName }) {
  const [predX, setPredX] = useState('')
  if (!model) return null

  const dataXMin = Math.min(...xs), dataXMax = Math.max(...xs)
  const xVal = Number(predX)
  const isValid = predX !== '' && isFinite(xVal)
  const predY = isValid ? model.fn(xVal) : null
  const isExtrapolating = isValid && (xVal < dataXMin || xVal > dataXMax)

  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4 space-y-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink/50">Predicción</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink/50">Si {xName || 'x'} =</span>
        <input
          type="number"
          value={predX}
          onChange={e => setPredX(e.target.value)}
          placeholder="valor"
          className="w-20 rounded-lg border border-ink/12 bg-ink/3 px-2 py-1.5 font-mono text-sm text-ink outline-none focus:ring-2 focus:ring-signal/30"
        />
        {isValid && predY != null && isFinite(predY) && (
          <>
            <span className="text-xs text-ink/50">→ {yName || 'y'} ≈</span>
            <span className="font-mono font-bold text-signal text-lg">{format(predY)}</span>
          </>
        )}
      </div>

      {isExtrapolating && (
        <div className="rounded-lg bg-rose/8 border border-rose/15 px-3 py-2">
          <p className="text-sm text-ink/60 leading-relaxed">
            <span className="font-semibold text-rose">Extrapolación:</span> el valor x = {format(xVal)} está fuera del rango de tus datos ({format(dataXMin)} a {format(dataXMax)}).
            La predicción es menos confiable porque el modelo no tiene evidencia de cómo se comporta el fenómeno en esa zona.
          </p>
        </div>
      )}
      {isValid && predY != null && isFinite(predY) && Math.abs(predY) > Math.max(...xs.map((_, i) => Math.abs(model.fn(xs[i])))) * 10 && (
        <div className="rounded-lg bg-rose/10 border border-rose/20 px-3 py-2">
          <p className="text-sm text-rose leading-relaxed">
            <strong>Predicción extrema:</strong> el valor {format(predY)} es mucho mayor que cualquier dato observado. ¿Es esto realista en el contexto de tu fenómeno?
          </p>
        </div>
      )}

      {isValid && !isExtrapolating && predY != null && (
        <p className="text-xs text-ink/40">
          Interpolación: el valor está dentro del rango de los datos — la predicción es razonablemente confiable.
        </p>
      )}
    </div>
  )
}

/* ── Manual parameter sliders ────────────────────────── */

function ManualSliders({ model, xs, ys, onParamsChange, onRevealBest, onVerify, startRandom = false, showChart = false, xLabel = '', yLabel = '' }) {
  // Build a function from params
  const buildFn = useCallback((params) => {
    if (!model) return () => 0
    switch (model.id) {
      case 'linear': return (x) => params.a + params.b * x
      case 'quadratic': return (x) => params.a * x * x + params.b * x + params.c
      case 'exponential': return (x) => params.a * Math.exp(params.b * x)
      case 'power': return (x) => params.a * Math.pow(x, params.b)
      case 'logarithmic': return (x) => params.a + params.b * Math.log(x)
      case 'sinusoidal': return (x) => params.a * Math.sin(params.b * x + params.c) + params.d
      default: return model.fn
    }
  }, [model])

  const [manualParams, setManualParams] = useState(() => {
    if (!startRandom || !model) return null
    const randomized = {}
    for (const key of Object.keys(model.params)) {
      const v = model.params[key]
      const absV = Math.max(Math.abs(v), 1)
      randomized[key] = v + (Math.random() - 0.5) * absV * 2.5
    }
    return randomized
  })
  const [showBest, setShowBest] = useState(false)

  if (!model) return null

  const paramKeys = Object.keys(model.params)
  const currentParams = showBest ? model.params : (manualParams || model.params)

  const currentFn = buildFn(currentParams)
  const currentR2 = computeR2(xs, ys, currentFn)
  const bestR2 = model.r2

  // Slider ranges: ±3x the optimal value, or ±10 if near zero
  const getRange = (key) => {
    const v = model.params[key]
    const absV = Math.max(Math.abs(v), 1)
    return { min: v - absV * 3, max: v + absV * 3, step: absV * 0.01 }
  }

  const handleChange = (key, value) => {
    const next = { ...(manualParams || model.params), [key]: value }
    setManualParams(next)
    setShowBest(false)
    if (onParamsChange) onParamsChange(buildFn(next))
  }

  const handleReveal = () => {
    setShowBest(true)
    setManualParams(null)
    if (onParamsChange) onParamsChange(model.fn)
    if (onRevealBest) onRevealBest()
  }

  const handleReset = () => {
    setShowBest(false)
    // Randomize params slightly
    const randomized = {}
    for (const key of paramKeys) {
      const v = model.params[key]
      const absV = Math.max(Math.abs(v), 1)
      randomized[key] = v + (Math.random() - 0.5) * absV * 2
    }
    setManualParams(randomized)
    if (onParamsChange) onParamsChange(buildFn(randomized))
  }

  const [verified, setVerified] = useState(false)
  const savedR2Ref = useRef(null)

  const handleVerify = () => {
    savedR2Ref.current = currentR2
    setVerified(true)
    if (onVerify) onVerify(currentFn, currentR2)
  }

  // Reset verified when params change
  const handleChangeWithReset = (key, value) => {
    handleChange(key, value)
    setVerified(false)
  }

  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4 space-y-3">
      {/* Live chart — curve moves as student adjusts sliders */}
      {showChart && (
        <DataChart xs={xs} ys={ys}
          fittedModels={[{ ...model, fn: currentFn, id: 'manual', r2: currentR2 }]}
          selectedModelId="manual" xLabel={xLabel} yLabel={yLabel} dark={false} />
      )}

      <div className="flex items-center justify-between">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink/50">
          {showBest ? 'Mejor ajuste' : 'Ajusta la curva a los datos'}
        </p>
      </div>

      {paramKeys.map(key => {
        const range = getRange(key)
        const value = currentParams[key]
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-right font-mono text-sm font-semibold text-ink/60">{key}</span>
            <input
              type="range"
              min={range.min} max={range.max} step={range.step}
              value={value}
              onChange={e => handleChangeWithReset(key, Number(e.target.value))}
              disabled={showBest}
              className="h-1.5 flex-1 cursor-pointer accent-signal disabled:opacity-50"
            />
            <span className="w-16 shrink-0 text-right font-mono text-xs text-ink/55">{format(value)}</span>
          </div>
        )
      })}

      {/* Step 1: Verify — student checks their R² */}
      {!verified && !showBest && (
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg border border-ink/12 py-2 text-xs font-medium text-ink/50 transition hover:bg-ink/5"
          >
            Reiniciar
          </button>
          <button
            onClick={handleVerify}
            className="flex-1 rounded-lg bg-signal py-2 text-xs font-semibold text-white transition hover:bg-signal/90"
          >
            Verificar mi ajuste
          </button>
        </div>
      )}

      {/* Step 2: Show student's R² and option to reveal best */}
      {verified && !showBest && (
        <>
          <div className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
            savedR2Ref.current >= 0.9 ? 'bg-graph/10 text-graph' : savedR2Ref.current >= 0.7 ? 'bg-amber-50 text-amber-700' : 'bg-signal/10 text-signal'
          }`}>
            <p><strong>Tu R² = {(savedR2Ref.current * 100).toFixed(1)}%</strong></p>
            {savedR2Ref.current >= 0.9 && 'Excelente — tu curva describe muy bien los datos.'}
            {savedR2Ref.current >= 0.7 && savedR2Ref.current < 0.9 && 'Buen intento — puedes intentar de nuevo o ver el óptimo.'}
            {savedR2Ref.current < 0.7 && 'La curva aún no se ajusta bien. Puedes intentar de nuevo o ver la solución.'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setVerified(false); handleReset() }}
              className="flex-1 rounded-lg border border-ink/12 py-2 text-xs font-medium text-ink/50 transition hover:bg-ink/5"
            >
              Intentar de nuevo
            </button>
            <button
              onClick={handleReveal}
              className="flex-1 rounded-lg bg-aqua/15 py-2 text-xs font-semibold text-aqua transition hover:bg-aqua/25"
            >
              Revelar mejor ajuste
            </button>
          </div>
        </>
      )}

      {/* Step 3: Best fit revealed — show comparison */}
      {showBest && (
        <div className="rounded-lg bg-graph/10 px-3 py-3 text-sm text-graph leading-relaxed space-y-1">
          <p><strong>Mejor R² = {(bestR2 * 100).toFixed(1)}%</strong></p>
          {savedR2Ref.current != null && (
            <p>Tu intento: R² = {(savedR2Ref.current * 100).toFixed(1)}% — {
              savedR2Ref.current >= bestR2 - 0.02 ? '¡Prácticamente igual al óptimo!' :
              savedR2Ref.current >= bestR2 * 0.85 ? 'muy cerca del óptimo.' :
              'el ajuste automático encontró mejores valores.'
            }</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Parameter interpretation ───────────────────────── */

function ParameterInterpretation({ model, xName, yName }) {
  if (!model?.params) return null
  const x = xName || 'x', y = yName || 'y'
  return (
    <div className="rounded-xl border border-ink/8 bg-paper p-4 space-y-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink/45">¿Qué significan los parámetros?</p>
      {model.id === 'linear' && (
        <div className="space-y-1 text-sm text-ink/65 leading-relaxed">
          <p><strong className="text-ink">b = {format(model.params.b)}</strong> — por cada unidad de {x}, {y} {model.params.b > 0 ? 'aumenta' : 'disminuye'} en {format(Math.abs(model.params.b))}.</p>
          <p><strong className="text-ink">a = {format(model.params.a)}</strong> — cuando {x} = 0, {y} ≈ {format(model.params.a)}.</p>
        </div>
      )}
      {model.id === 'exponential' && (
        <div className="space-y-1 text-sm text-ink/65 leading-relaxed">
          <p><strong className="text-ink">a = {format(model.params.a)}</strong> — valor inicial.</p>
          <p><strong className="text-ink">b = {format(model.params.b)}</strong> — {model.params.b > 0 ? `se duplica cada ${format(Math.log(2) / model.params.b)} unidades` : `se reduce a la mitad cada ${format(Math.log(2) / Math.abs(model.params.b))} unidades`}.</p>
        </div>
      )}
      {model.id === 'quadratic' && (
        <div className="space-y-1 text-sm text-ink/65 leading-relaxed">
          <p><strong className="text-ink">a = {format(model.params.a)}</strong> — parábola abre {model.params.a > 0 ? 'hacia arriba' : 'hacia abajo'}.</p>
          <p><strong className="text-ink">Vértice</strong> en x = {format(-model.params.b / (2 * model.params.a))}.</p>
        </div>
      )}
      {model.id === 'power' && (
        <p className="text-sm text-ink/65"><strong className="text-ink">b = {format(model.params.b)}</strong> — al duplicar {x}, {y} se multiplica por {format(Math.pow(2, model.params.b))}.</p>
      )}
      {model.id === 'logarithmic' && (
        <p className="text-sm text-ink/65"><strong className="text-ink">b = {format(model.params.b)}</strong> — cada vez que {x} se duplica, {y} aumenta en {format(model.params.b * Math.log(2))}.</p>
      )}
      {model.id === 'sinusoidal' && (
        <div className="space-y-1 text-sm text-ink/65 leading-relaxed">
          <p><strong className="text-ink">Amplitud</strong> = {format(Math.abs(model.params.a))} — oscila entre {format(model.params.d - Math.abs(model.params.a))} y {format(model.params.d + Math.abs(model.params.a))}.</p>
          <p><strong className="text-ink">Período</strong> = {format(2 * Math.PI / Math.abs(model.params.b))} unidades de {x}.</p>
        </div>
      )}
    </div>
  )
}

/* ── Diagnostic panel ────────────────────────────────── */

function DiagnosticPanel({ model, xs, xName, yName }) {
  if (!model?.diagnostics) return null
  const d = model.diagnostics
  const n = xs.length
  const context = { xName: xName || 'x', yName: yName || 'y' }
  const interpretation = interpretModel(model, d, n, context)

  return (
    <div className="space-y-3">
      {/* Metrics with explanations */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-ink/8 bg-paper px-4 py-3">
          <p className="text-[0.65rem] uppercase tracking-widest text-ink/55 mb-1 font-semibold">R²</p>
          <p className={`font-display text-2xl font-bold ${model.r2 < 0 ? 'text-rose' : 'text-ink'}`}>{(model.r2 * 100).toFixed(1)}%</p>
          <p className="mt-1 text-[0.7rem] leading-snug text-ink/50">% de variación explicada por el modelo</p>
        </div>
        <div className="rounded-xl border border-ink/8 bg-paper px-4 py-3">
          <p className="text-[0.65rem] uppercase tracking-widest text-ink/55 mb-1 font-semibold">R² ajustado</p>
          <p className={`font-display text-2xl font-bold ${d.adjR2 < model.r2 - 0.05 ? 'text-signal' : 'text-ink'}`}>{(d.adjR2 * 100).toFixed(1)}%</p>
          <p className="mt-1 text-[0.7rem] leading-snug text-ink/50">{d.adjR2 < model.r2 - 0.05 ? 'Baja: modelo muy complejo' : 'Similar a R²: complejidad adecuada'}</p>
        </div>
        <div className="rounded-xl border border-ink/8 bg-paper px-4 py-3">
          <p className="text-[0.65rem] uppercase tracking-widest text-ink/55 mb-1 font-semibold">AIC</p>
          <p className="font-display text-2xl font-bold text-ink">{format(d.aic)}</p>
          <p className="mt-1 text-[0.7rem] leading-snug text-ink/50">Menor = mejor balance entre precisión y simplicidad</p>
        </div>
        <div className="rounded-xl border border-ink/8 bg-paper px-4 py-3">
          <p className="text-[0.65rem] uppercase tracking-widest text-ink/55 mb-1 font-semibold">Error medio</p>
          <p className="font-display text-2xl font-bold text-ink">{format(model.mae)}</p>
          <p className="mt-1 text-[0.7rem] leading-snug text-ink/50">Distancia promedio entre dato real y predicción</p>
        </div>
        <div className="rounded-xl border border-ink/8 bg-paper px-4 py-3">
          <p className="text-[0.65rem] uppercase tracking-widest text-ink/55 mb-1 font-semibold">Parámetros</p>
          <p className="font-display text-2xl font-bold text-ink">{model.numParams}</p>
          <p className="mt-1 text-[0.7rem] leading-snug text-ink/50">Números ajustables en la ecuación</p>
        </div>
        <div className="rounded-xl border border-ink/8 bg-paper px-4 py-3">
          <p className="text-[0.65rem] uppercase tracking-widest text-ink/55 mb-1 font-semibold">Sobreajuste</p>
          <p className={`font-display text-2xl font-bold ${d.overfitRisk === 'alto' ? 'text-rose' : d.overfitRisk === 'moderado' ? 'text-signal' : 'text-graph'}`}>
            {d.overfitRisk === 'alto' ? 'Alto' : d.overfitRisk === 'moderado' ? 'Medio' : 'Bajo'}
          </p>
          <p className="mt-1 text-[0.7rem] leading-snug text-ink/50">{d.overfitRisk === 'alto' ? 'Pocos datos para tantos parámetros' : d.overfitRisk === 'moderado' ? 'Más datos darían más confianza' : 'Datos suficientes para el modelo'}</p>
        </div>
      </div>

      {/* Interpretation — compact */}
      <div className="rounded-xl border border-aqua/15 bg-aqua/5 px-4 py-3">
        <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-aqua/70 mb-1">Interpretación</p>
        <p className="text-sm text-ink/60 leading-relaxed">{interpretation[0]}</p>
      </div>

      {/* Warnings */}
      {d.warnings.length > 0 && (
        <div className="rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 space-y-1.5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-rose/70">Alertas</p>
          {d.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-ink/60 leading-relaxed">
              <span className="mt-0.5 shrink-0 text-rose">⚠</span> {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Ranking bar chart ───────────────────────────────── */

function RankingBars({ models, selectedId, onSelect }) {
  if (!models.length) return null
  const maxR2 = Math.max(...models.map(m => Math.max(m.r2, 0)))

  return (
    <div className="space-y-2">
      {models.map((model, idx) => {
        const isSelected = model.id === selectedId
        const barWidth = maxR2 > 0 ? Math.max((model.r2 / maxR2) * 100, 2) : 2
        return (
          <button
            key={model.id}
            onClick={() => onSelect(model.id)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all ${
              isSelected
                ? 'bg-signal/15 ring-1 ring-signal/40'
                : 'bg-ink/4 hover:bg-ink/8'
            }`}
          >
            <span
              className="h-2.5 rounded-full transition-all"
              style={{
                width: `${barWidth}%`,
                minWidth: '4px',
                backgroundColor: GRAPH_COLORS[idx % GRAPH_COLORS.length],
              }}
            />
            <span className="shrink-0 text-sm font-semibold text-ink/80">{model.label}</span>
            <span className="shrink-0 font-mono text-[0.65rem] text-ink/45">
              R²={format(model.r2)}{model.filteredCount > 0 ? ` (n=${model.usedCount})` : ''}
            </span>
            {model.filteredCount > 0 && (
              <span className="shrink-0 text-[0.6rem] text-amber-600" title={`Se excluyeron ${model.filteredCount} datos incompatibles`}>⚠️</span>
            )}
            <span className="ml-auto shrink-0 font-mono text-[0.65rem] text-ink/40">
              AIC={format(model.diagnostics?.aic)}
            </span>
            {idx === 0 && (
              <span className="rounded-full bg-signal/20 px-2 py-0.5 text-[0.6rem] font-bold text-signal">
                MEJOR
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ── Data input panel ────────────────────────────────── */

function DataInput({ xInput, yInput, setXInput, setYInput, xName, yName, setXName, setYName, onLoadSample, onFileUpload }) {
  const fileRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = parseFileContent(ev.target.result)
      if (result.error) {
        alert(result.error)
      } else {
        onFileUpload(result.x, result.y)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      {/* Variable descriptions */}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-ink/50">¿Qué mide x?</label>
          <input
            type="text"
            value={xName}
            onChange={e => setXName(e.target.value)}
            placeholder="Ej: Horas de estudio, Temperatura, Tiempo..."
            className="w-full rounded-xl border border-ink/12 bg-white px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-signal/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-ink/50">¿Qué mide y?</label>
          <input
            type="text"
            value={yName}
            onChange={e => setYName(e.target.value)}
            placeholder="Ej: Nota del examen, Ventas, Altura..."
            className="w-full rounded-xl border border-ink/12 bg-white px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-signal/30"
          />
        </div>
      </div>

      {/* Data values */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-ink/50">Valores de x</label>
          <textarea
            rows={3}
            value={xInput}
            onChange={e => setXInput(e.target.value)}
            placeholder="1, 2, 3, 4, 5..."
            className="w-full resize-none rounded-xl border border-ink/12 bg-white px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-signal/30"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-ink/50">Valores de y</label>
          <textarea
            rows={3}
            value={yInput}
            onChange={e => setYInput(e.target.value)}
            placeholder="2.1, 4.0, 5.8..."
            className="w-full resize-none rounded-xl border border-ink/12 bg-white px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-signal/30"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-ink/12 bg-white px-3 py-1.5 text-xs font-semibold text-ink/60 transition hover:bg-ink/5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          Subir CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFile} className="hidden" />

        {SAMPLE_DATASETS.map(ds => (
          <button
            key={ds.id}
            onClick={() => onLoadSample(ds)}
            className="rounded-full bg-ink/5 px-2.5 py-1 text-[0.65rem] font-medium text-ink/50 transition hover:bg-ink/10 hover:text-ink/70"
          >
            {ds.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Data preview table ──────────────────────────────── */

function DataTable({ xs, ys }) {
  if (!xs.length) return null
  const maxShow = 15
  const truncated = xs.length > maxShow

  return (
    <div className="max-h-48 overflow-y-auto rounded-xl border border-ink/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ink/5 text-[0.65rem] uppercase tracking-widest text-ink/50">
            <th className="px-3 py-1.5 text-center">#</th>
            <th className="px-3 py-1.5 text-right">x</th>
            <th className="px-3 py-1.5 text-right">y</th>
          </tr>
        </thead>
        <tbody>
          {xs.slice(0, maxShow).map((x, i) => (
            <tr key={i} className="border-t border-ink/6">
              <td className="px-3 py-1 text-center text-ink/35 text-xs">{i + 1}</td>
              <td className="px-3 py-1 text-right font-mono text-ink/70">{format(x)}</td>
              <td className="px-3 py-1 text-right font-mono text-ink/70">{format(ys[i])}</td>
            </tr>
          ))}
          {truncated && (
            <tr className="border-t border-ink/6">
              <td colSpan={3} className="px-3 py-1 text-center text-xs text-ink/40">
                ... y {xs.length - maxShow} más
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ── Model family card (for Step 2) ──────────────────── */

function FamilyCard({ family, isLikely, isUnlikely, isSelected, onToggle }) {
  // Feedback only appears AFTER the student clicks
  const feedbackColor = isSelected
    ? isLikely ? 'text-graph' : isUnlikely ? 'text-rose' : 'text-aqua'
    : ''
  const feedbackText = isSelected
    ? isLikely ? 'Buena elección — este modelo tiene sentido para la forma de tus datos.'
    : isUnlikely ? 'Piénsalo bien — ¿esta forma encaja con lo que observaste? Puedes deseleccionarla.'
    : 'Puede funcionar. Veamos cómo se comporta en el ajuste.'
    : null

  return (
    <div>
      <button
        onClick={onToggle}
        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
          isSelected
            ? isUnlikely ? 'border-rose/40 bg-rose/5 ring-1 ring-rose/20'
            : isLikely ? 'border-graph/40 bg-graph/5 ring-1 ring-graph/20'
            : 'border-signal/40 bg-signal/5 ring-1 ring-signal/20'
            : 'border-ink/10 bg-white hover:bg-ink/3'
        }`}
      >
        <div className={`shrink-0 rounded-lg p-1.5 ${isSelected ? 'bg-signal/15' : 'bg-ink/6'}`}>
          <svg width="40" height="32" viewBox="0 0 40 32">
            <path d={MINI_CURVES[family.icon] || MINI_CURVES.linear}
              fill="none" stroke={isSelected ? '#ff6b35' : '#121723'} strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" opacity={isSelected ? 1 : 0.4} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-ink">{family.label}</span>
            <span className="font-mono text-[0.65rem] text-ink/40">{family.equation}</span>
          </div>
          <p className="mt-0.5 text-xs text-ink/55 leading-relaxed">{family.description}</p>
          <p className="mt-0.5 text-[0.65rem] text-ink/40 italic">{family.when}</p>
        </div>
      </button>
      {feedbackText && (
        <p className={`mt-1 px-3 text-xs font-medium leading-relaxed ${feedbackColor}`}>
          {feedbackText}
        </p>
      )}
    </div>
  )
}

/* ── MAIN COMPONENT ──────────────────────────────────── */

export function ModelingSpace() {
  // ── Mode ──
  const [viewMode, setViewMode] = useState('guided') // 'guided' | 'direct'

  // ── Data ──
  const [xInput, setXInput] = useState('')
  const [yInput, setYInput] = useState('')
  const [xName, setXName] = useState('')
  const [yName, setYName] = useState('')
  const [isCustomData, setIsCustomData] = useState(false) // true when student typed/uploaded data

  // ── Wizard ──
  const [step, setStep] = useState(0) // 0-3
  const [pattern, setPattern] = useState(null) // 'crece' | 'decrece' | 'sube_baja' | 'oscila' | null
  const [shape, setShape] = useState(null) // 'constant' | 'accelerating' | 'decelerating' | null
  const [selectedFamilies, setSelectedFamilies] = useState([])
  const [selectedModelId, setSelectedModelId] = useState(null)
  const [conclusion, setConclusion] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentCourse, setStudentCourse] = useState('')
  const [studentSchool, setStudentSchool] = useState('')
  const [reflection1, setReflection1] = useState('')
  const [reflection2, setReflection2] = useState('')
  const [reflection3, setReflection3] = useState('')
  const [problemContext, setProblemContext] = useState('')
  const [showAllCurves, setShowAllCurves] = useState(false)
  const [studentCurveFn, setStudentCurveFn] = useState(null) // fn from student's manual sliders
  const [studentR2, setStudentR2] = useState(null)            // R² achieved by student
  const [revealedBestFit, setRevealedBestFit] = useState(false) // did student reveal optimal?
  const [predictionX, setPredictionX] = useState(null)

  // ── Parsed data ──
  const biData = useMemo(() => parseBivariateInput(xInput, yInput), [xInput, yInput])
  const { xs, ys, error: dataError } = biData
  const hasData = xs.length >= 2

  // ── Fitted models ──
  const fittedModels = useMemo(() => {
    if (!hasData) return []
    return rankModels(xs, ys, viewMode === 'guided' ? selectedFamilies : null)
  }, [xs, ys, hasData, selectedFamilies, viewMode])

  // Auto-select best model
  const activeModelId = selectedModelId && fittedModels.some(m => m.id === selectedModelId)
    ? selectedModelId
    : fittedModels[0]?.id || null

  const activeModel = fittedModels.find(m => m.id === activeModelId)

  // ── Auto-detect actual data trend ──
  const actualTrend = useMemo(() => {
    if (xs.length < 3) return null
    const n = xs.length

    // Linear regression
    const mx = xs.reduce((a, b) => a + b, 0) / n
    const my = ys.reduce((a, b) => a + b, 0) / n
    let num = 0, den = 0, ssTot = 0
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my)
      den += (xs[i] - mx) ** 2
      ssTot += (ys[i] - my) ** 2
    }
    const slope = den > 0 ? num / den : 0
    const intercept = my - slope * mx
    let ssRes = 0
    for (let i = 0; i < n; i++) ssRes += (ys[i] - (slope * xs[i] + intercept)) ** 2
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

    // If linear R² is decent (>0.5), it's monotonic — just check slope
    if (r2 > 0.5) return slope > 0 ? 'crece' : 'decrece'

    // For low R², check if data has a clear turn (quadratic) or oscillation
    // Use smoothed segments: split data in thirds and compare means
    const third = Math.floor(n / 3)
    const m1 = ys.slice(0, third).reduce((a, b) => a + b, 0) / third
    const m2 = ys.slice(third, 2 * third).reduce((a, b) => a + b, 0) / third
    const m3 = ys.slice(2 * third).reduce((a, b) => a + b, 0) / (n - 2 * third)

    // Oscillation: middle segment goes opposite to both ends
    const goesUpDown = m1 < m2 && m2 > m3
    const goesDownUp = m1 > m2 && m2 < m3

    // True oscillation needs multiple full cycles — check sign changes in smoothed residuals
    const residuals = ys.map((y, i) => y - (slope * xs[i] + intercept))
    let smoothSignChanges = 0
    const w = Math.max(2, Math.floor(n / 6))
    for (let i = w; i < n - w; i++) {
      const before = residuals.slice(i - w, i).reduce((a, b) => a + b, 0) / w
      const after = residuals.slice(i, i + w).reduce((a, b) => a + b, 0) / w
      if (i > w && before * after < 0) smoothSignChanges++
    }

    if (smoothSignChanges >= 3) return 'oscila'
    if (goesUpDown || goesDownUp) return 'sube_baja'
    return slope > 0 ? 'crece' : 'decrece'
  }, [xs, ys])

  // ── Concavity detection ──
  const actualConcavity = useMemo(() => {
    if (xs.length < 4 || !actualTrend || actualTrend === 'oscila' || actualTrend === 'sube_baja') return null
    const mid = Math.floor(xs.length / 2)
    const slopeFirst = (ys[mid] - ys[0]) / (xs[mid] - xs[0] || 1)
    const slopeSecond = (ys[xs.length - 1] - ys[mid]) / (xs[xs.length - 1] - xs[mid] || 1)
    const absDiff = Math.abs(slopeSecond) - Math.abs(slopeFirst)
    const avgSlope = (Math.abs(slopeFirst) + Math.abs(slopeSecond)) / 2
    if (avgSlope < 0.01) return 'constant'
    const relChange = absDiff / avgSlope
    if (relChange > 0.4) return 'accelerating'
    if (relChange < -0.4) return 'decelerating'
    return 'constant'
  }, [xs, ys, actualTrend])

  // ── Pattern hints ──
  const hints = useMemo(() => getPatternHints(pattern), [pattern])

  // ── Handlers ──
  const loadSample = useCallback((ds) => {
    const data = ds.generate ? ds.generate() : { x: ds.x, y: ds.y }
    setXInput(data.x)
    setYInput(data.y)
    setPattern(null)
    setShape(null)
    setIsCustomData(false)
    if (ds.xName) setXName(ds.xName)
    if (ds.yName) setYName(ds.yName)
  }, [])

  const handleFileUpload = useCallback((x, y) => {
    setXInput(x)
    setYInput(y)
    setIsCustomData(true)
  }, [])

  const resetAll = useCallback(() => {
    setXInput(''); setYInput(''); setXName(''); setYName('')
    setIsCustomData(false); setStep(0); setPattern(null); setShape(null)
    setSelectedFamilies([]); setSelectedModelId(null); setConclusion('')
    setStudentName(''); setStudentCourse(''); setStudentSchool('')
    setReflection1(''); setReflection2(''); setReflection3('')
    setProblemContext(''); setShowAllCurves(false)
    setStudentCurveFn(null); setStudentR2(null); setRevealedBestFit(false)
    setPredictionX(null); setViewMode('guided')
  }, [])

  const toggleFamily = useCallback((id) => {
    setSelectedFamilies(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }, [])

  const handleReport = useCallback(() => {
    if (!activeModel || !hasData) return
    const patternLabel = PATTERN_OPTIONS.find(p => p.id === pattern)?.label || '—'
    const shapeLabel = shape === 'accelerating' ? 'acelerando' : shape === 'decelerating' ? 'desacelerando' : shape === 'constant' ? 'a ritmo constante' : ''

    // Build SVG chart inline
    const dataXMin = Math.min(...xs), dataXMax = Math.max(...xs)
    const xPad = (dataXMax - dataXMin) * 0.1 || 1
    const cXMin = dataXMin - xPad, cXMax = dataXMax + xPad
    // Compute y range including both data AND curve
    let cYMin = Math.min(...ys), cYMax = Math.max(...ys)
    for (let i = 0; i <= 200; i++) {
      const x = cXMin + (i / 200) * (cXMax - cXMin)
      const y = activeModel.fn(x)
      if (isFinite(y) && Math.abs(y) < (cYMax - cYMin + 1) * 20) {
        if (y < cYMin) cYMin = y
        if (y > cYMax) cYMax = y
      }
    }
    const yPad = (cYMax - cYMin) * 0.1 || 1
    cYMin -= yPad; cYMax += yPad
    const w = 560, h = 300, pad = 40
    const sx = (v) => pad + ((v - cXMin) / (cXMax - cXMin)) * (w - pad * 2)
    const sy = (v) => h - pad - ((v - cYMin) / (cYMax - cYMin)) * (h - pad * 2)

    // Data points
    const dots = xs.map((x, i) => `<circle cx="${sx(x)}" cy="${sy(ys[i])}" r="5" fill="#5096ff" />`).join('')
    // Model curve
    const curvePts = []
    for (let i = 0; i <= 200; i++) {
      const x = cXMin + (i / 200) * (cXMax - cXMin)
      const y = activeModel.fn(x)
      if (isFinite(y) && Math.abs(y) < (cYMax - cYMin) * 5) {
        curvePts.push(`${curvePts.length === 0 ? 'M' : 'L'} ${sx(x)} ${sy(y)}`)
      }
    }
    // Axis lines + ticks
    const xAxis = cYMin <= 0 && cYMax >= 0 ? `<line x1="${pad}" y1="${sy(0)}" x2="${w - pad}" y2="${sy(0)}" stroke="#999" stroke-width="1"/>` : ''
    const yAxis = cXMin <= 0 && cXMax >= 0 ? `<line x1="${sx(0)}" y1="${pad}" x2="${sx(0)}" y2="${h - pad}" stroke="#999" stroke-width="1"/>` : ''

    // Data table rows
    const tableRows = xs.map((x, i) => {
      const yHat = activeModel.fn(x)
      return `<tr><td>${x}</td><td>${ys[i]}</td><td>${format(yHat)}</td><td>${format(ys[i] - yHat)}</td></tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe de Modelación — MathModels Lab</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Poppins:wght@300;400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Poppins', sans-serif; color: #121723; max-width: 800px; margin: 0 auto; padding: 40px 32px; line-height: 1.6; }
  h1 { font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 4px; }
  h2 { font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 600; color: #ff6b35; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #ff6b3520; }
  .subtitle { color: #12172380; font-size: 0.85rem; margin-bottom: 24px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 16px 0; }
  .meta-card { background: #f8f7f4; border-radius: 12px; padding: 12px 16px; }
  .meta-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.12em; color: #12172360; font-weight: 600; }
  .meta-value { font-size: 1rem; font-weight: 600; margin-top: 4px; }
  .model-box { background: #22c5a010; border: 1px solid #22c5a030; border-radius: 16px; padding: 16px 20px; margin: 16px 0; }
  .model-eq { font-family: monospace; font-size: 1.3rem; font-weight: 700; color: #ff6b35; }
  .model-detail { font-size: 0.85rem; color: #12172370; margin-top: 6px; }
  .chart-container { margin: 20px 0; text-align: center; }
  svg.chart { border: 1px solid #12172310; border-radius: 12px; background: white; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin: 12px 0; }
  th { background: #121723; color: white; padding: 8px 12px; text-align: left; font-weight: 500; }
  td { padding: 6px 12px; border-bottom: 1px solid #12172310; }
  tr:nth-child(even) td { background: #f8f7f4; }
  .justification { background: #5096ff10; border: 1px solid #5096ff25; border-radius: 12px; padding: 16px; margin: 16px 0; white-space: pre-wrap; font-size: 0.9rem; }
  .reflection { background: #8b5cf610; border: 1px solid #8b5cf620; border-radius: 12px; padding: 16px; margin: 16px 0; }
  .reflection ul { padding-left: 20px; }
  .reflection li { margin: 4px 0; font-size: 0.85rem; color: #12172380; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #12172315; font-size: 0.7rem; color: #12172340; text-align: center; }
  .print-btn { display: block; margin: 24px auto; padding: 12px 32px; background: #ff6b35; color: white; border: none; border-radius: 24px; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
  .print-btn:hover { opacity: 0.9; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
    <div style="width:40px;height:40px;background:#121723;border-radius:10px;display:flex;align-items:center;justify-content:center;">
      <span style="color:#22c5a0;font-family:Outfit;font-weight:700;font-size:14px;">ML</span>
    </div>
    <div>
      <p style="font-family:Outfit;font-weight:700;font-size:1rem;letter-spacing:-0.02em;">MathModels Lab</p>
      <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.15em;color:#12172350;">Informe de modelación matemática</p>
    </div>
  </div>
  <hr style="border:none;border-top:2px solid #12172310;margin:16px 0;">

  <p class="subtitle">${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

  ${studentName || studentCourse || studentSchool ? `
  <div class="meta">
    ${studentName ? `<div class="meta-card"><p class="meta-label">Estudiante</p><p class="meta-value">${studentName}</p></div>` : ''}
    ${studentCourse ? `<div class="meta-card"><p class="meta-label">Curso</p><p class="meta-value">${studentCourse}</p></div>` : ''}
    ${studentSchool ? `<div class="meta-card"><p class="meta-label">Colegio</p><p class="meta-value">${studentSchool}</p></div>` : ''}
  </div>` : ''}

  <h2>1. Observación</h2>
  <div class="meta">
    <div class="meta-card">
      <p class="meta-label">Variable X</p>
      <p class="meta-value">${xName || 'x'}</p>
    </div>
    <div class="meta-card">
      <p class="meta-label">Variable Y</p>
      <p class="meta-value">${yName || 'y'}</p>
    </div>
    <div class="meta-card">
      <p class="meta-label">Datos</p>
      <p class="meta-value">${xs.length} pares</p>
    </div>
  </div>
  <p>Tendencia observada: <strong>${patternLabel}${shapeLabel ? ', ' + shapeLabel : ''}</strong></p>
  <p>Familias consideradas: <strong>${selectedFamilies.join(', ')}</strong></p>

  ${problemContext ? `
  <h2>Contexto del problema</h2>
  <div class="justification">${problemContext}</div>
  ` : ''}

  <h2>2. Modelo seleccionado</h2>
  <div class="model-box">
    <p class="model-eq">${activeModel.formula}</p>
    <p class="model-detail">${activeModel.label} — R² = ${format(activeModel.r2)} (${interpretR2(activeModel.r2).toLowerCase()})</p>
  </div>

  <h2>3. Gráfica</h2>
  <div class="chart-container">
    <svg class="chart" viewBox="0 0 ${w} ${h}" width="100%">
      <rect width="${w}" height="${h}" fill="#fafafa" rx="8"/>
      ${xAxis}${yAxis}
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#ddd" stroke-width="1"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="#ddd" stroke-width="1"/>
      <path d="${curvePts.join(' ')}" fill="none" stroke="#ff6b35" stroke-width="3" stroke-linecap="round"/>
      ${dots}
      <text x="${w / 2}" y="${h - 6}" text-anchor="middle" font-size="11" fill="#999">${xName || 'x'}</text>
      <text x="10" y="${h / 2}" text-anchor="middle" font-size="11" fill="#999" transform="rotate(-90,10,${h / 2})">${yName || 'y'}</text>
    </svg>
  </div>

  <h2>4. Datos y predicciones</h2>
  <table>
    <thead><tr><th>${xName || 'x'}</th><th>${yName || 'y'} (dato)</th><th>ŷ (modelo)</th><th>Residual</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <h2>5. Justificación</h2>
  <div class="justification">${conclusion || '<em>No se escribió justificación.</em>'}</div>

  <h2>6. Reflexión</h2>
  <div class="reflection" style="space-y:12px;">
    <p style="font-size:0.85rem;color:#12172370;margin-bottom:8px;"><strong>¿Tu modelo sirve para predecir fuera del rango de datos?</strong></p>
    <div class="justification" style="margin:4px 0 16px;">${reflection1 || '<em>Sin respuesta</em>'}</div>
    <p style="font-size:0.85rem;color:#12172370;margin-bottom:8px;"><strong>¿Hay algún dato que no se ajusta bien? ¿Por qué?</strong></p>
    <div class="justification" style="margin:4px 0 16px;">${reflection2 || '<em>Sin respuesta</em>'}</div>
    <p style="font-size:0.85rem;color:#12172370;margin-bottom:8px;"><strong>¿Qué variable no estás considerando?</strong></p>
    <div class="justification" style="margin:4px 0 16px;">${reflection3 || '<em>Sin respuesta</em>'}</div>
  </div>

  <button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button>

  <div class="footer">
    Generado con MathModels Lab — mathmodels.astridto.com<br>
    Astrid Torregroza Olivero · Lic. en Matemáticas y Física
  </div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }, [activeModel, xs, ys, hasData, conclusion, pattern, shape, selectedFamilies, xName, yName, studentName, studentCourse, studentSchool, reflection1, reflection2, reflection3])

  // ── Step navigation ──
  const patternCorrect = pattern === actualTrend || pattern === null
  const needsShape = patternCorrect && (pattern === 'crece' || pattern === 'decrece') && actualConcavity != null
  const shapeCorrect = !needsShape || shape === actualConcavity
  const canNext = step === 0 ? hasData && pattern != null && patternCorrect && (!needsShape || (shape != null && shapeCorrect))
    : step === 1 ? selectedFamilies.length >= 2
    : step === 2 ? activeModel != null
    : step === 3 ? activeModel != null
    : true
  const totalSteps = 5
  const STEP_NAMES = ['Observar', 'Conjeturar', 'Ajustar', 'Evaluar', 'Justificar']

  // ── Render helpers ──
  const sectionKicker = (text) => (
    <p className="mb-2 flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-ink/55">
      <span className="h-2 w-2 rounded-full bg-signal" />
      {text}
    </p>
  )

  /* ════════════════════════════════════════════════════ */
  /* ══ GUIDED MODE ════════════════════════════════════ */
  /* ════════════════════════════════════════════════════ */

  const renderGuided = () => (
    <div className="space-y-6">
      {/* progress bar */}
      <div className="flex items-center gap-1">
        {STEP_NAMES.map((label, i) => (
          <div key={i} className="flex flex-1 items-center gap-1">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i >= step}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                i < step ? 'bg-graph text-white cursor-pointer hover:bg-graph/80' : i === step ? 'bg-signal text-white' : 'bg-ink/10 text-ink/40'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </button>
            <span className={`hidden text-xs font-medium md:block ${i === step ? 'text-signal' : i < step ? 'text-graph cursor-pointer' : 'text-ink/40'}`}>
              {label}
            </span>
            {i < totalSteps - 1 && <div className={`mx-1 h-0.5 flex-1 rounded ${i < step ? 'bg-graph' : 'bg-ink/10'}`} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          {/* ── FASE 1: OBSERVAR ── */}
          {step === 0 && (
            <div className="space-y-4">
              {sectionKicker('Fase 1 — Observar')}
              <p className="text-base font-semibold text-ink/80">¿Qué fenómeno quieres estudiar?</p>
              <p className="text-sm text-ink/55 leading-relaxed">
                Carga tus datos y observa la nube de puntos. Antes de buscar una fórmula, describe con tus palabras qué patrón ves.
              </p>
              <DataInput xInput={xInput} yInput={yInput}
                setXInput={(v) => { setXInput(v); setIsCustomData(true) }}
                setYInput={(v) => { setYInput(v); setIsCustomData(true) }}
                xName={xName} yName={yName} setXName={setXName} setYName={setYName}
                onLoadSample={loadSample} onFileUpload={handleFileUpload} />
              {dataError && <p className="text-sm text-rose font-medium">{dataError}</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <DataTable xs={xs} ys={ys} />
                {hasData && <DataChart xs={xs} ys={ys} fittedModels={[]} selectedModelId={null} xLabel={xName} yLabel={yName} dark={false} />}
              </div>
              {hasData && xs.length < 6 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                  <strong>Pocos datos:</strong> Con {xs.length} puntos, incluso un modelo complejo puede parecer perfecto.
                  Se recomiendan al menos 8–10 puntos para un análisis confiable.
                </div>
              )}
              {hasData && (
                <div className="rounded-xl border border-aqua/20 bg-aqua/5 p-4">
                  <p className="mb-2 text-sm font-semibold text-ink/70">Mirando la nube de puntos, ¿qué forma ves?</p>
                  <div className="flex flex-wrap gap-2">
                    {PATTERN_OPTIONS.map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => setPattern(opt.id)}
                        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                          pattern === opt.id
                            ? 'bg-signal text-white shadow-md'
                            : 'bg-white border border-ink/12 text-ink/60 hover:bg-ink/5'
                        }`}
                      >
                        <span className="text-base">{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {pattern && (() => {
                    const match = pattern === actualTrend || pattern === null
                    const close = !match && (
                      (pattern === 'crece' && actualTrend === 'sube_baja') ||
                      (pattern === 'decrece' && actualTrend === 'sube_baja') ||
                      (pattern === 'sube_baja' && (actualTrend === 'crece' || actualTrend === 'decrece'))
                    )
                    return (
                      <div className={`mt-3 rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        match ? 'bg-graph/10 text-graph' : close ? 'bg-amber-50 text-amber-700' : 'bg-rose/10 text-rose'
                      }`}>
                        {match && pattern === 'crece' && '¡Bien! Los datos crecen.'}
                        {match && pattern === 'decrece' && '¡Bien! Los datos decrecen.'}
                        {match && pattern === 'sube_baja' && '¡Correcto! Los datos tienen un cambio de dirección. Esto sugiere un modelo cuadrático o polinomial.'}
                        {match && pattern === 'oscila' && '¡Correcto! Los datos oscilan. Esto sugiere un modelo trigonométrico (senoidal).'}
                        {match && pattern === null && 'No pasa nada — la herramienta te ayudará a descartar modelos en el siguiente paso.'}
                        {close && 'Casi — observa con más cuidado la nube de puntos. ¿La tendencia general sube, baja, o hace ambas cosas?'}
                        {!match && !close && `Observa de nuevo la gráfica. Los datos parecen ${
                          actualTrend === 'crece' ? 'crecer' : actualTrend === 'decrece' ? 'decrecer' : actualTrend === 'sube_baja' ? 'subir y bajar' : 'oscilar'
                        }, no ${
                          pattern === 'crece' ? 'crecer' : pattern === 'decrece' ? 'decrecer' : pattern === 'sube_baja' ? 'subir y bajar' : 'oscilar'
                        }. Inténtalo de nuevo.`}
                      </div>
                    )
                  })()}

                  {/* Second question: concavity — only when trend is correct and monotonic */}
                  {patternCorrect && needsShape && (
                    <div className="mt-4 rounded-xl border border-violet/20 bg-violet/5 p-4">
                      <p className="mb-2 text-sm font-semibold text-ink/70">
                        Los datos {pattern === 'crece' ? 'crecen' : 'decrecen'}. ¿Cómo lo hacen?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'constant', label: 'A ritmo constante', desc: 'Los puntos siguen una línea recta' },
                          { id: 'accelerating', label: pattern === 'crece' ? 'Cada vez más rápido' : 'Cada vez más lento', desc: 'La curva se abre hacia arriba' },
                          { id: 'decelerating', label: pattern === 'crece' ? 'Cada vez más lento' : 'Cada vez más rápido', desc: 'La curva se aplana' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setShape(opt.id)}
                            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                              shape === opt.id
                                ? 'bg-violet text-white shadow-md'
                                : 'bg-white border border-ink/12 text-ink/60 hover:bg-ink/5'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {shape && (() => {
                        const ok = shape === actualConcavity
                        return (
                          <p className={`mt-2 text-sm leading-relaxed ${ok ? 'text-graph' : 'text-rose'}`}>
                            {ok && shape === 'constant' && '¡Sí! El ritmo es constante — un modelo lineal es el candidato natural.'}
                            {ok && shape === 'accelerating' && `¡Exacto! El ${pattern === 'crece' ? 'crecimiento se acelera' : 'decrecimiento se frena'}. Esto sugiere un modelo exponencial o de potencia.`}
                            {ok && shape === 'decelerating' && `¡Correcto! El ${pattern === 'crece' ? 'crecimiento se desacelera' : 'decrecimiento se acelera'}. Esto sugiere un modelo logarítmico.`}
                            {!ok && `Observa la curvatura de los puntos. ¿La separación entre puntos consecutivos ${actualConcavity === 'accelerating' ? 'aumenta' : actualConcavity === 'decelerating' ? 'disminuye' : 'se mantiene igual'}?`}
                          </p>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── FASE 2: CONJETURAR ── */}
          {step === 1 && (
            <div className="space-y-4">
              {sectionKicker('Fase 2 — Conjeturar')}
              <p className="text-base font-semibold text-ink/80">¿Qué familias de funciones podrían describir este fenómeno?</p>
              <p className="text-sm text-ink/55 leading-relaxed">
                {pattern
                  ? `Observaste que tus datos "${PATTERN_OPTIONS.find(p => p.id === pattern)?.label?.toLowerCase() || ''}". Ahora elige las familias que crees que podrían ajustarse — y descarta las que no tienen sentido para esta forma.`
                  : 'Selecciona las familias de funciones que quieres probar con tus datos.'}
              </p>
              <p className="text-xs text-ink/40">Haz clic en cada familia para seleccionarla o descartarla. Recibirás retroalimentación sobre tu elección.</p>
              <div className="grid gap-2 md:grid-cols-2">
                {MODEL_FAMILIES.map(family => (
                  <FamilyCard
                    key={family.id}
                    family={family}
                    isLikely={hints.likely.includes(family.id)}
                    isUnlikely={hints.unlikely.includes(family.id)}
                    isSelected={selectedFamilies.includes(family.id)}
                    onToggle={() => toggleFamily(family.id)}
                  />
                ))}
              </div>
              {selectedFamilies.length > 0 && (
                <p className="text-xs text-ink/45">{selectedFamilies.length} familia{selectedFamilies.length > 1 ? 's' : ''} seleccionada{selectedFamilies.length > 1 ? 's' : ''} para comparar.</p>
              )}
            </div>
          )}

          {/* ── FASE 3: AJUSTAR ── */}
          {step === 2 && (
            <div className="space-y-4">
              {sectionKicker('Fase 3 — Ajustar')}
              <p className="text-base font-semibold text-ink/80">Ajusta cada modelo a los datos moviendo los parámetros</p>
              <p className="text-sm text-ink/55 leading-relaxed">
                Para cada familia que elegiste, mueve los deslizadores hasta que la curva se acerque lo más posible a los puntos. Cuando creas que es tu mejor intento, verifica tu ajuste.
              </p>
              {fittedModels.length === 0 ? (
                <p className="text-sm text-ink/50">No se pudieron ajustar modelos. Vuelve al paso anterior y selecciona más familias.</p>
              ) : (
                <>
                  {/* Model selector tabs — no R² shown */}
                  <div className="flex flex-wrap gap-2">
                    {fittedModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedModelId(m.id); setStudentCurveFn(null); setStudentR2(null); setRevealedBestFit(false) }}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                          activeModelId === m.id ? 'bg-ink text-paper' : 'border border-ink/10 bg-paper text-ink hover:border-ink/30'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {activeModel && (
                    <div className="space-y-3">
                      {/* Show equation template */}
                      <div className="rounded-xl border border-signal/20 bg-signal/5 px-4 py-3 text-center">
                        <p className="text-[0.65rem] uppercase tracking-widest text-ink/45 mb-1">Ecuación general</p>
                        <p className="font-mono text-base font-semibold text-signal">{activeModel.equation}</p>
                      </div>

                      {/* Unified chart — curve moves as student drags sliders */}
                      <DataChart xs={xs} ys={ys}
                        fittedModels={[studentCurveFn
                          ? { ...activeModel, fn: studentCurveFn, id: 'manual', r2: computeR2(xs, ys, studentCurveFn) }
                          : { ...activeModel, id: 'manual' }
                        ]}
                        selectedModelId="manual" xLabel={xName} yLabel={yName} dark={false} />

                      {/* Sliders only — no duplicate chart */}
                      <ManualSliders model={activeModel} xs={xs} ys={ys} startRandom xLabel={xName} yLabel={yName}
                        onParamsChange={(fn) => { setStudentCurveFn(() => fn); setRevealedBestFit(false) }}
                        onVerify={(fn, r2) => { setStudentCurveFn(() => fn); setStudentR2(r2); setRevealedBestFit(false) }}
                        onRevealBest={() => { setRevealedBestFit(true); setStudentCurveFn(null); setStudentR2(null) }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── FASE 4: EVALUAR ── */}
          {step === 3 && (() => {
            // Use student's curve if they didn't reveal the best fit
            const useStudentCurve = studentCurveFn && !revealedBestFit
            const evalModel = activeModel && useStudentCurve
              ? { ...activeModel, fn: studentCurveFn, r2: studentR2 ?? computeR2(xs, ys, studentCurveFn) }
              : activeModel
            return (
            <div className="space-y-4">
              {sectionKicker('Fase 4 — Evaluar')}
              <p className="text-base font-semibold text-ink/80">¿Qué tan bien describe el modelo tus datos?</p>
              <p className="text-sm text-ink/55 leading-relaxed">
                {useStudentCurve
                  ? 'Estás evaluando la curva que ajustaste manualmente. Un buen modelo no solo pasa cerca de los puntos — también predice bien donde no hay datos.'
                  : 'Un buen modelo no solo pasa cerca de los puntos — también predice bien donde no hay datos y sus residuales no forman patrones.'}
              </p>
              {useStudentCurve && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  Evaluando <strong>tu ajuste manual</strong> (R² = {((studentR2 ?? computeR2(xs, ys, studentCurveFn)) * 100).toFixed(1)}%).
                  Si quieres evaluar el ajuste óptimo, vuelve a la fase 3 y revela el mejor ajuste.
                </div>
              )}
              {evalModel && (
                <div className="space-y-3">
                  <DataChart xs={xs} ys={ys} fittedModels={[evalModel]} selectedModelId={evalModel.id}
                    predictionX={predictionX} xLabel={xName} yLabel={yName} dark={false} />

                  <PredictionTool model={evalModel} xs={xs} xName={xName} yName={yName} />

                  <ResidualPlot xs={xs} ys={ys} predictFn={evalModel.fn} />

                  <DiagnosticPanel model={evalModel} xs={xs} ys={ys} xName={xName} yName={yName} />
                </div>
              )}
            </div>
            )
          })()}

          {/* ── FASE 5: JUSTIFICAR ── */}
          {step === 4 && (
            <div className="space-y-4">
              {sectionKicker('Fase 5 — Justificar y cerrar')}
              <p className="text-base font-semibold text-ink/80">Cierre de tu proceso de modelación</p>
              <p className="text-sm text-ink/55 leading-relaxed">
                En matemáticas, elegir un modelo no basta — hay que argumentar la decisión y reconocer sus limitaciones. Esto es lo que evalúa el criterio E de la Exploración IB.
              </p>
              {activeModel && (
                <>
                  {/* ── Resumen del proceso ── */}
                  <div className="rounded-xl border border-ink/8 bg-paper p-4 space-y-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink/45">Resumen de tu proceso</p>
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="rounded-lg bg-white border border-ink/8 px-3 py-2">
                        <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Observaste</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{PATTERN_OPTIONS.find(p => p.id === pattern)?.label || '—'}{shape === 'accelerating' ? ', acelerando' : shape === 'decelerating' ? ', desacelerando' : shape === 'constant' ? ', a ritmo constante' : ''}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-ink/8 px-3 py-2">
                        <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Probaste</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{selectedFamilies.length} familia{selectedFamilies.length > 1 ? 's' : ''}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-ink/8 px-3 py-2">
                        <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Elegiste</p>
                        <p className="mt-1 text-sm font-semibold text-signal">{activeModel.label}</p>
                      </div>
                    </div>
                  </div>

                  {/* ── Modelo final con gráfica ── */}
                  <div className="rounded-xl border border-graph/20 bg-graph/5 px-4 py-4">
                    <p className="text-[0.65rem] uppercase tracking-widest text-ink/45 mb-2">Tu modelo</p>
                    <p className="font-mono text-lg font-bold text-signal">{activeModel.formula}</p>
                    <p className="mt-1 text-sm text-ink/55">{activeModel.label} — R² = {format(activeModel.r2)} ({interpretR2(activeModel.r2).toLowerCase()})</p>
                  </div>

                  <DataChart xs={xs} ys={ys} fittedModels={[activeModel]} selectedModelId={activeModelId} xLabel={xName} yLabel={yName} dark={false} />

                  <ParameterInterpretation model={activeModel} xName={xName} yName={yName} />

                  {/* ── Identificación del estudiante ── */}
                  <div className="rounded-xl border border-ink/8 bg-white p-4 space-y-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink/45">Identificación</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-ink/40">Nombre</label>
                        <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Tu nombre completo" className="w-full rounded-lg border border-ink/12 bg-ink/3 px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-signal/30" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-ink/40">Curso</label>
                        <input type="text" value={studentCourse} onChange={e => setStudentCourse(e.target.value)} placeholder="Ej: 11° IB" className="w-full rounded-lg border border-ink/12 bg-ink/3 px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-signal/30" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-ink/40">Colegio</label>
                        <input type="text" value={studentSchool} onChange={e => setStudentSchool(e.target.value)} placeholder="Nombre del colegio" className="w-full rounded-lg border border-ink/12 bg-ink/3 px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-signal/30" />
                      </div>
                    </div>
                  </div>

                  {/* ── Contexto del problema ── */}
                  <div className="rounded-xl border border-ink/8 bg-white p-4 space-y-2">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink/45">Contexto del problema</p>
                    <p className="text-xs text-ink/45">Describe brevemente el fenómeno que estás modelando: ¿de dónde vienen los datos? ¿Qué se quiere entender o predecir?</p>
                    <textarea rows={3} value={problemContext} onChange={e => setProblemContext(e.target.value)} placeholder="Ej: Se midió la población de bacterias en un cultivo cada hora durante 10 horas para determinar su tasa de crecimiento..." className="w-full resize-none rounded-lg border border-ink/12 bg-ink/3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-signal/30" />
                  </div>

                  {/* ── Justificación del estudiante ── */}
                  <div className="rounded-xl border border-aqua/20 bg-aqua/5 p-4 space-y-3">
                    <p className="text-sm font-semibold text-ink/70">Escribe tu justificación:</p>
                    <p className="text-xs text-ink/45 leading-relaxed">
                      Responde: ¿Por qué esta familia y no las otras? ¿Qué dice el R²? ¿Los residuales muestran algún patrón? ¿El modelo tiene sentido en el contexto del fenómeno? ¿Qué limitaciones tiene?
                    </p>
                    <textarea
                      rows={5}
                      value={conclusion}
                      onChange={e => setConclusion(e.target.value)}
                      placeholder="Elegí el modelo... porque..."
                      className="w-full resize-none rounded-xl border border-ink/12 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-aqua/30"
                    />
                  </div>

                  {/* ── Reflexión metacognitiva ── */}
                  <div className="rounded-xl border border-violet/20 bg-violet/5 p-4 space-y-2">
                    <p className="text-sm font-semibold text-ink/70">Reflexión final</p>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-ink/50 mb-1">¿Tu modelo sirve para predecir valores <strong>fuera</strong> del rango de datos? ¿Hasta dónde?</p>
                        <textarea rows={2} value={reflection1} onChange={e => setReflection1(e.target.value)} placeholder="Responde aquí..." className="w-full resize-none rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-violet/30" />
                      </div>
                      <div>
                        <p className="text-xs text-ink/50 mb-1">¿Hay algún dato que no se ajusta bien? ¿Por qué podría ser?</p>
                        <textarea rows={2} value={reflection2} onChange={e => setReflection2(e.target.value)} placeholder="Responde aquí..." className="w-full resize-none rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-violet/30" />
                      </div>
                      <div>
                        <p className="text-xs text-ink/50 mb-1">¿Qué variable no estás considerando que podría mejorar la predicción?</p>
                        <textarea rows={2} value={reflection3} onChange={e => setReflection3(e.target.value)} placeholder="Responde aquí..." className="w-full resize-none rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-violet/30" />
                      </div>
                    </div>
                  </div>

                  {/* ── Exportar ── */}
                  <button
                    onClick={handleReport}
                    disabled={!studentName || !problemContext || !conclusion || !reflection1 || !reflection2 || !reflection3}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 font-semibold text-paper transition hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    Ver informe completo
                  </button>

                  {/* Validation message */}
                  {(!studentName || !problemContext || !conclusion || !reflection1 || !reflection2 || !reflection3) && (
                    <p className="text-xs text-rose text-center">Completa todos los campos antes de generar el informe: nombre, justificación y las 3 reflexiones.</p>
                  )}
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1 rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink/60 transition hover:bg-ink/5 disabled:opacity-25"
        >
          ← Anterior
        </button>
        {step < totalSteps - 1 && (
          <button
            onClick={() => setStep(s => Math.min(totalSteps - 1, s + 1))}
            disabled={!canNext}
            className="flex items-center gap-1 rounded-full bg-signal px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-signal/90 disabled:opacity-40"
          >
            Siguiente →
          </button>
        )}
      </div>
    </div>
  )

  /* ════════════════════════════════════════════════════ */
  /* ══ DIRECT MODE ════════════════════════════════════ */
  /* ════════════════════════════════════════════════════ */

  const renderDirect = () => (
    <div className="space-y-4">
      {/* TOP: Data input — full width, compact */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <DataInput xInput={xInput} yInput={yInput} setXInput={setXInput} setYInput={setYInput}
          xName={xName} yName={yName} setXName={setXName} setYName={setYName}
          onLoadSample={loadSample} onFileUpload={handleFileUpload} />
        {dataError && <p className="text-sm text-rose font-medium">{dataError}</p>}
      </div>

      {!hasData ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-ink/15 text-sm text-ink/35">
          Ingresa al menos 2 pares de datos para comenzar
        </div>
      ) : (
        <>
          {/* MAIN: Chart + Ranking side by side */}
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {sectionKicker('Gráfica')}
                <button
                  onClick={() => setShowAllCurves(v => !v)}
                  className={`rounded-full px-3 py-1 text-[0.65rem] font-medium transition ${showAllCurves ? 'bg-aqua/15 text-aqua' : 'bg-ink/5 text-ink/40 hover:bg-ink/10'}`}
                >
                  {showAllCurves ? 'Todas las curvas' : 'Comparar'}
                </button>
              </div>
              <DataChart xs={xs} ys={ys} fittedModels={fittedModels} selectedModelId={activeModelId}
                showAllCurves={showAllCurves} predictionX={predictionX} xLabel={xName} yLabel={yName} dark={false} />
            </div>
            {fittedModels.length > 0 && (
              <div>
                {sectionKicker('Ranking')}
                <RankingBars models={fittedModels} selectedId={activeModelId} onSelect={setSelectedModelId} />
                {activeModel && (
                  <div className="mt-3 rounded-xl border border-signal/20 bg-signal/5 px-3 py-2 text-center">
                    <p className="font-mono text-sm font-semibold text-signal">{activeModel.formula}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BOTTOM: Tools side by side */}
          {activeModel && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <ManualSliders model={activeModel} xs={xs} ys={ys} showChart xLabel={xName} yLabel={yName} />
                <PredictionTool model={activeModel} xs={xs} xName={xName} yName={yName} />
              </div>
              <div className="space-y-3">
                <ResidualPlot xs={xs} ys={ys} predictFn={activeModel.fn} />
                <DiagnosticPanel model={activeModel} xs={xs} ys={ys} xName={xName} yName={yName} />
                <ParameterInterpretation model={activeModel} xName={xName} yName={yName} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )

  /* ════════════════════════════════════════════════════ */
  /* ══ RENDER ═════════════════════════════════════════ */
  /* ════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      {/* mode toggle */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-full bg-ink/6 p-1">
          <button
            onClick={() => { setViewMode('guided'); setStep(0) }}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              viewMode === 'guided' ? 'bg-signal text-white shadow-md' : 'text-ink/50 hover:text-ink/70'
            }`}
          >
            Guiado
          </button>
          <button
            onClick={() => setViewMode('direct')}
            disabled={isCustomData}
            title={isCustomData ? 'Con datos propios, usa el modo Guiado para aprender modelando' : ''}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              viewMode === 'direct' ? 'bg-signal text-white shadow-md'
              : isCustomData ? 'text-ink/25 cursor-not-allowed'
              : 'text-ink/50 hover:text-ink/70'
            }`}
          >
            Directo
          </button>
        </div>
        {hasData && (
          <button
            onClick={resetAll}
            className="rounded-full border border-ink/12 px-4 py-2 text-xs font-medium text-ink/50 transition hover:bg-ink/5 hover:text-ink/70"
          >
            Nueva modelación
          </button>
        )}
        <p className="text-xs text-ink/40 hidden md:block">
          {viewMode === 'guided'
            ? 'Ciclo completo de modelación: observar, conjeturar, ajustar, evaluar, justificar'
            : 'Todos los modelos y herramientas visibles — para usuarios con experiencia'}
        </p>
      </div>

      {viewMode === 'guided' ? renderGuided() : renderDirect()}
    </div>
  )
}

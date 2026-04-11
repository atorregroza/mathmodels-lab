import { useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CartesianFrame, MetricCard, SliderField } from './DerivaLabPrimitives'
import { format, downloadCsv, sampleRange, linePath } from './derivaLabUtils'
import { parseBivariateInput } from './statisticsUtils'
import {
  rankModels, computeR2, computeMAE,
  MODEL_FAMILIES, interpretR2, explainFit, interpretModel,
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
    <div className="rounded-xl border border-ink/10 bg-white p-4 space-y-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink/50">Predicción</p>
      <div className="flex items-center gap-3">
        <label className="text-sm text-ink/60 shrink-0">Si {xName || 'x'} =</label>
        <input
          type="number"
          value={predX}
          onChange={e => setPredX(e.target.value)}
          placeholder="valor"
          className="w-24 rounded-lg border border-ink/12 bg-ink/3 px-3 py-1.5 font-mono text-sm text-ink outline-none focus:ring-2 focus:ring-signal/30"
        />
        {isValid && predY != null && isFinite(predY) && (
          <span className="flex items-center gap-1.5 text-sm">
            <span className="text-ink/50">→ {yName || 'y'} ≈</span>
            <span className="font-mono font-bold text-signal text-base">{format(predY)}</span>
          </span>
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

function ManualSliders({ model, xs, ys, onParamsChange }) {
  const [manualParams, setManualParams] = useState(null)
  const [showBest, setShowBest] = useState(false)

  if (!model) return null

  const paramKeys = Object.keys(model.params)
  const currentParams = showBest ? model.params : (manualParams || model.params)

  // Build a function from manual params
  const buildFn = (params) => {
    switch (model.id) {
      case 'linear': return (x) => params.a + params.b * x
      case 'quadratic': return (x) => params.a * x * x + params.b * x + params.c
      case 'exponential': return (x) => params.a * Math.exp(params.b * x)
      case 'power': return (x) => params.a * Math.pow(x, params.b)
      case 'logarithmic': return (x) => params.a + params.b * Math.log(x)
      case 'sinusoidal': return (x) => params.a * Math.sin(params.b * x + params.c) + params.d
      default: return model.fn
    }
  }

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

  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink/50">Ajustar parámetros manualmente</p>
        <div className="flex items-center gap-2">
          {/* R² indicator */}
          <span className={`font-mono text-sm font-bold ${
            currentR2 >= bestR2 - 0.01 ? 'text-graph' : currentR2 >= bestR2 * 0.8 ? 'text-signal' : 'text-rose'
          }`}>
            R² = {(currentR2 * 100).toFixed(1)}%
          </span>
        </div>
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
              onChange={e => handleChange(key, Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-signal"
            />
            <span className="w-16 shrink-0 text-right font-mono text-xs text-ink/55">{format(value)}</span>
          </div>
        )
      })}

      <div className="flex gap-2">
        <button
          onClick={handleReset}
          className="flex-1 rounded-lg border border-ink/12 py-1.5 text-xs font-medium text-ink/50 transition hover:bg-ink/5"
        >
          Aleatorizar
        </button>
        <button
          onClick={handleReveal}
          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
            showBest ? 'bg-graph/15 text-graph' : 'bg-signal/10 text-signal hover:bg-signal/20'
          }`}
        >
          {showBest ? '✓ Mejor ajuste revelado' : 'Ver mejor ajuste'}
        </button>
      </div>

      {!showBest && manualParams && (
        <p className="text-xs text-ink/40 leading-relaxed">
          Mueve los sliders para entender qué hace cada parámetro. Observa cómo cambia la curva y el R².
          Cuando estés listo, compara tu ajuste con el óptimo.
        </p>
      )}
      {showBest && (
        <p className="text-xs text-graph/70 leading-relaxed">
          Estos son los valores que minimizan el error. ¿Se parecen a los que encontraste manualmente?
        </p>
      )}
    </div>
  )
}

/* ── Diagnostic panel ────────────────────────────────── */

function DiagnosticPanel({ model, xs, ys, xName, yName }) {
  if (!model?.diagnostics) return null
  const d = model.diagnostics
  const n = xs.length
  const context = { xName: xName || 'x', yName: yName || 'y' }
  const interpretation = interpretModel(model, d, n, context)

  return (
    <div className="space-y-3">
      {/* Metric grid — student-friendly labels */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MetricCard label="¿Qué tan bien ajusta?" value={`${(model.r2 * 100).toFixed(1)}%`}
          detail={model.r2 < 0 ? 'R² negativo — este modelo es PEOR que usar el promedio. Prueba otra familia.' : 'R² — porcentaje de variación explicada por el modelo'}
          dark={false} valueClassName={model.r2 < 0 ? 'text-rose' : ''} />
        <MetricCard label="Ajuste corregido" value={`${(d.adjR2 * 100).toFixed(1)}%`}
          detail={d.adjR2 < model.r2 - 0.05 ? 'R² ajustado — baja porque el modelo es muy complejo para estos datos' : 'R² ajustado — similar al básico, el modelo no es innecesariamente complejo'}
          dark={false}
          valueClassName={d.adjR2 < model.r2 - 0.05 ? 'text-signal' : ''} />
        <MetricCard label="Calidad vs complejidad" value={format(d.aic)}
          detail="AIC — piénsalo como una nota que premia la precisión pero penaliza usar demasiados parámetros. El modelo con menor AIC es el mejor equilibrio entre simple y preciso" dark={false} />
        {model.cvR2 != null && (
          <MetricCard label="¿Generaliza?" value={`${(model.cvR2 * 100).toFixed(1)}%`}
            detail={model.cvR2 < model.r2 - 0.15
              ? 'Validación cruzada — si este número es mucho menor que el ajuste, el modelo memoriza en vez de aprender'
              : 'Validación cruzada — el modelo predice bien datos que no ha visto, eso es buena señal'}
            dark={false}
            valueClassName={model.cvR2 < model.r2 - 0.15 ? 'text-rose' : ''} />
        )}
      </div>

      {/* Diagnostics detail */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="Error promedio" value={format(model.mae)}
          detail={`En promedio, el modelo se equivoca por ${format(model.mae)} unidades de "${context.yName}"`} dark={false} />
        <MetricCard label="Complejidad" value={`${model.numParams} param.`}
          detail={`El modelo usa ${model.numParams} número(s) ajustable(s) para describir ${n} datos`} dark={false} />
        <MetricCard label="¿Sobreajuste?" value={d.overfitRisk === 'alto' ? 'Cuidado' : d.overfitRisk === 'moderado' ? 'Posible' : 'No'}
          detail={d.overfitRisk === 'alto' ? 'El modelo puede estar "memorizando" los datos — necesitas más observaciones' : d.overfitRisk === 'moderado' ? 'Más datos harían la conclusión más sólida' : 'Hay suficientes datos para confiar en el modelo'}
          dark={false}
          valueClassName={d.overfitRisk === 'alto' ? 'text-rose' : d.overfitRisk === 'moderado' ? 'text-signal' : 'text-graph'} />
      </div>

      {/* Interpretation — the pedagogical core */}
      <div className="rounded-xl border border-aqua/15 bg-aqua/5 px-4 py-3 space-y-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-aqua/70">Interpretación</p>
        {interpretation.map((line, i) => (
          <p key={i} className="text-sm text-ink/65 leading-relaxed">{line}</p>
        ))}
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
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-ink/50">¿Qué mide x?</label>
          <input
            type="text"
            value={xName}
            onChange={e => setXName(e.target.value)}
            placeholder="Ej: Horas de estudio, Temperatura, Tiempo..."
            className="w-full rounded-xl border border-ink/12 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-signal/30"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-widest text-ink/50">¿Qué mide y?</label>
          <input
            type="text"
            value={yName}
            onChange={e => setYName(e.target.value)}
            placeholder="Ej: Nota del examen, Ventas, Altura..."
            className="w-full rounded-xl border border-ink/12 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-signal/30"
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

  // ── Wizard ──
  const [step, setStep] = useState(0) // 0-3
  const [pattern, setPattern] = useState(null) // 'crece' | 'decrece' | 'sube_baja' | 'oscila' | null
  const [shape, setShape] = useState(null) // 'constant' | 'accelerating' | 'decelerating' | null
  const [selectedFamilies, setSelectedFamilies] = useState([])
  const [selectedModelId, setSelectedModelId] = useState(null)
  const [conclusion, setConclusion] = useState('')
  const [showAllCurves, setShowAllCurves] = useState(false)
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
    setXInput(ds.x)
    setYInput(ds.y)
    setPattern(null)
    setShape(null)
    if (ds.xName) setXName(ds.xName)
    if (ds.yName) setYName(ds.yName)
  }, [])

  const handleFileUpload = useCallback((x, y) => {
    setXInput(x)
    setYInput(y)
  }, [])

  const toggleFamily = useCallback((id) => {
    setSelectedFamilies(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }, [])

  const handleExport = useCallback(() => {
    if (!activeModel || !hasData) return
    const rows = [
      ['x', 'y (dato)', 'ŷ (modelo)', 'Residual'],
      ...xs.map((x, i) => {
        const yHat = activeModel.fn(x)
        return [x, ys[i], format(yHat), format(ys[i] - yHat)]
      }),
      [],
      ['Modelo', activeModel.label],
      ['Ecuación', activeModel.formula],
      ['R²', format(activeModel.r2)],
      ['MAE', format(activeModel.mae)],
      ...(conclusion ? [[], ['Justificación del estudiante', conclusion]] : []),
    ]
    downloadCsv(rows, `modelacion-${activeModel.id}.csv`)
  }, [activeModel, xs, ys, hasData, conclusion])

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
              <DataInput xInput={xInput} yInput={yInput} setXInput={setXInput} setYInput={setYInput}
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
              <p className="text-base font-semibold text-ink/80">Manipula los parámetros y observa cómo cambia la curva</p>
              <p className="text-sm text-ink/55 leading-relaxed">
                Cada modelo tiene parámetros que controlan su forma. Mueve los sliders para entender qué hace cada uno. ¿Cuál se acerca más a tus datos?
              </p>
              {fittedModels.length === 0 ? (
                <p className="text-sm text-ink/50">No se pudieron ajustar modelos. Vuelve al paso anterior y selecciona más familias.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAllCurves(v => !v)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${showAllCurves ? 'bg-aqua/15 text-aqua' : 'bg-ink/5 text-ink/45 hover:bg-ink/10'}`}
                    >
                      {showAllCurves ? 'Mostrando todas las curvas' : 'Comparar curvas'}
                    </button>
                  </div>
                  <DataChart xs={xs} ys={ys} fittedModels={fittedModels} selectedModelId={activeModelId}
                    showAllCurves={showAllCurves} predictionX={predictionX} xLabel={xName} yLabel={yName} dark={false} />
                  <RankingBars models={fittedModels} selectedId={activeModelId} onSelect={setSelectedModelId} />
                  {activeModel && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-signal/20 bg-signal/5 px-4 py-3 text-center">
                        <p className="text-[0.65rem] uppercase tracking-widest text-ink/45 mb-1">Ecuación ajustada</p>
                        <p className="font-mono text-base font-semibold text-signal">{activeModel.formula}</p>
                      </div>
                      <ManualSliders model={activeModel} xs={xs} ys={ys} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── FASE 4: EVALUAR ── */}
          {step === 3 && (
            <div className="space-y-4">
              {sectionKicker('Fase 4 — Evaluar')}
              <p className="text-base font-semibold text-ink/80">¿Qué tan bien describe el modelo tus datos?</p>
              <p className="text-sm text-ink/55 leading-relaxed">
                Un buen modelo no solo pasa cerca de los puntos — también predice bien donde no hay datos y sus residuales no forman patrones.
              </p>
              {activeModel && (
                <div className="space-y-3">
                  <DataChart xs={xs} ys={ys} fittedModels={[activeModel]} selectedModelId={activeModelId}
                    predictionX={predictionX} xLabel={xName} yLabel={yName} dark={false} />

                  <PredictionTool model={activeModel} xs={xs} xName={xName} yName={yName} />

                  <ResidualPlot xs={xs} ys={ys} predictFn={activeModel.fn} />

                  <DiagnosticPanel model={activeModel} xs={xs} ys={ys} xName={xName} yName={yName} />
                </div>
              )}
            </div>
          )}

          {/* ── FASE 5: JUSTIFICAR ── */}
          {step === 4 && (
            <div className="space-y-4">
              {sectionKicker('Fase 5 — Justificar')}
              <p className="text-base font-semibold text-ink/80">¿Por qué este modelo y no otro?</p>
              <p className="text-sm text-ink/55 leading-relaxed">
                En matemáticas, elegir un modelo no basta — hay que argumentar la decisión. Esto es lo que evalúa el criterio E de la Exploración IB.
              </p>
              {activeModel && (
                <>
                  <div className="rounded-xl border border-graph/20 bg-graph/5 px-4 py-4">
                    <p className="text-[0.65rem] uppercase tracking-widest text-ink/45 mb-2">Tu modelo</p>
                    <p className="font-mono text-lg font-bold text-signal">{activeModel.formula}</p>
                    <p className="mt-1 text-sm text-ink/55">{activeModel.label} — R² = {format(activeModel.r2)} ({interpretR2(activeModel.r2).toLowerCase()})</p>
                  </div>

                  <DataChart xs={xs} ys={ys} fittedModels={[activeModel]} selectedModelId={activeModelId} xLabel={xName} yLabel={yName} dark={false} />

                  <div className="rounded-xl border border-aqua/20 bg-aqua/5 p-4 space-y-3">
                    <p className="text-sm font-semibold text-ink/70">Escribe tu justificación:</p>
                    <p className="text-xs text-ink/45 leading-relaxed">
                      Considera: ¿Por qué esta familia y no las otras? ¿Qué dice el R²? ¿Los residuales muestran algún patrón? ¿El modelo tiene sentido en el contexto del fenómeno?
                    </p>
                    <textarea
                      rows={5}
                      value={conclusion}
                      onChange={e => setConclusion(e.target.value)}
                      placeholder="Elegí el modelo... porque..."
                      className="w-full resize-none rounded-xl border border-ink/12 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/25 focus:ring-2 focus:ring-aqua/30"
                    />
                  </div>

                  <button
                    onClick={handleExport}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal px-4 py-3 font-semibold text-white transition hover:bg-signal/90"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                    Exportar resultados (CSV)
                  </button>
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
    <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
      {/* LEFT: data input */}
      <div className="space-y-4">
        {sectionKicker('Datos')}
        <DataInput xInput={xInput} yInput={yInput} setXInput={setXInput} setYInput={setYInput}
          xName={xName} yName={yName} setXName={setXName} setYName={setYName}
                onLoadSample={loadSample} onFileUpload={handleFileUpload} />
        {dataError && <p className="text-sm text-rose font-medium">{dataError}</p>}
        <DataTable xs={xs} ys={ys} />
        {hasData && (
          <p className="text-xs text-ink/45">n = {xs.length} pares de datos</p>
        )}
      </div>

      {/* RIGHT: results */}
      <div className="space-y-4">
        {!hasData ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-ink/15 text-sm text-ink/35">
            Ingresa al menos 2 pares de datos para comenzar
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              {sectionKicker('Modelo ajustado')}
              <button
                onClick={() => setShowAllCurves(v => !v)}
                className={`rounded-full px-3 py-1 text-[0.65rem] font-medium transition ${showAllCurves ? 'bg-aqua/15 text-aqua' : 'bg-ink/5 text-ink/40 hover:bg-ink/10'}`}
              >
                {showAllCurves ? 'Todas las curvas' : 'Comparar curvas'}
              </button>
            </div>
            <DataChart xs={xs} ys={ys} fittedModels={fittedModels} selectedModelId={activeModelId}
              showAllCurves={showAllCurves} predictionX={predictionX} xLabel={xName} yLabel={yName} dark={false} />

            {fittedModels.length > 0 && (
              <>
                {sectionKicker('Ranking de modelos')}
                <RankingBars models={fittedModels} selectedId={activeModelId} onSelect={setSelectedModelId} />

                {activeModel && (
                  <>
                    {/* equation */}
                    <div className="rounded-xl border border-signal/20 bg-signal/5 px-4 py-3 text-center">
                      <p className="text-[0.65rem] uppercase tracking-widest text-ink/45 mb-1">{activeModel.label}</p>
                      <p className="font-mono text-base font-semibold text-signal">{activeModel.formula}</p>
                    </div>

                    {/* manual parameter adjustment */}
                    <ManualSliders model={activeModel} xs={xs} ys={ys} />

                    {/* prediction */}
                    <PredictionTool model={activeModel} xs={xs} xName={xName} yName={yName} />

                    {/* residual plot */}
                    <ResidualPlot xs={xs} ys={ys} predictFn={activeModel.fn} />

                    {/* full diagnostics */}
                    <DiagnosticPanel model={activeModel} xs={xs} ys={ys} xName={xName} yName={yName} />

                    <button
                      onClick={handleExport}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 font-semibold text-paper transition hover:bg-ink/90"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                      </svg>
                      Exportar CSV
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
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
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              viewMode === 'direct' ? 'bg-signal text-white shadow-md' : 'text-ink/50 hover:text-ink/70'
            }`}
          >
            Directo
          </button>
        </div>
        <p className="text-xs text-ink/40">
          {viewMode === 'guided'
            ? 'Ciclo completo de modelación: observar, conjeturar, ajustar, evaluar, justificar'
            : 'Todos los modelos y herramientas visibles — para usuarios con experiencia'}
        </p>
      </div>

      {viewMode === 'guided' ? renderGuided() : renderDirect()}
    </div>
  )
}

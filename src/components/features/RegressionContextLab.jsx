import { useState, useMemo } from 'react'
import { CartesianFrame, LabCard, MetricCard, SliderField, AxisRangePanel } from './DerivaLabPrimitives'
import { downloadCsv, format, generateTicks } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

/* ── datasets ──────────────────────────────────────────── */

const datasets = [
  {
    id: 'study',
    label: 'Horas de estudio vs Calificación',
    xLabel: 'Horas de estudio',
    yLabel: 'Calificación (0-100)',
    context: 'Un profesor registra las horas semanales de estudio y la calificación final de 12 estudiantes.',
    points: [
      [2, 45], [3, 52], [4, 55], [5, 60], [6, 68],
      [7, 72], [8, 78], [9, 82], [10, 88], [11, 90], [12, 95], [14, 97],
    ],
  },
  {
    id: 'temperature',
    label: 'Temperatura vs Ventas de helado',
    xLabel: 'Temperatura (°C)',
    yLabel: 'Ventas (unidades)',
    context: 'Una heladería registra la temperatura máxima diaria y sus ventas durante 10 días.',
    points: [
      [18, 50], [20, 62], [22, 75], [24, 80], [26, 95],
      [28, 110], [30, 125], [32, 140], [34, 155], [36, 170],
    ],
  },
  {
    id: 'altitude',
    label: 'Altitud vs Temperatura',
    xLabel: 'Altitud (m)',
    yLabel: 'Temperatura (°C)',
    context: 'Se mide la temperatura en diferentes altitudes de una montaña andina.',
    points: [
      [0, 28], [500, 25], [1000, 22], [1500, 19], [2000, 16],
      [2500, 13], [3000, 10], [3500, 7], [4000, 4], [4500, 1],
    ],
  },
  {
    id: 'co2',
    label: 'Año vs Emisiones de CO₂',
    xLabel: 'Año',
    yLabel: 'CO₂ (Gt)',
    context: 'Emisiones globales de CO₂ por década desde 1960, mostrando tendencia creciente.',
    points: [
      [1960, 9.4], [1970, 14.9], [1980, 19.5], [1990, 22.7],
      [2000, 25.2], [2005, 29.1], [2010, 33.4], [2015, 35.2], [2020, 34.8],
    ],
  },
]

/* ── stats helpers ─────────────────────────────────────── */

function computeRegression(points) {
  const n = points.length
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const sx = xs.reduce((a, b) => a + b, 0)
  const sy = ys.reduce((a, b) => a + b, 0)
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sx2 = xs.reduce((a, x) => a + x * x, 0)
  const sy2 = ys.reduce((a, y) => a + y * y, 0)
  const denom = n * sx2 - sx * sx
  const b = denom ? (n * sxy - sx * sy) / denom : 0
  const a = (sy - b * sx) / n
  const numR = n * sxy - sx * sy
  const denR = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy))
  const r = denR ? numR / denR : 0
  return { a, b, r, r2: r * r }
}

/* ── component ─────────────────────────────────────────── */

export const RegressionContextLab = () => {
  const [datasetId, setDatasetId] = useState('study')
  const [showBest, setShowBest] = useState(false)

  const dataset = datasets.find((d) => d.id === datasetId) || datasets[0]
  const best = useMemo(() => computeRegression(dataset.points), [dataset])

  // user-adjustable params
  const [userA, setUserA] = useState(0)
  const [userB, setUserB] = useState(1)

  // switch dataset → reset user params
  const selectDataset = (id) => {
    setDatasetId(id)
    setShowBest(false)
    setUserA(0)
    setUserB(1)
    axis.resetRange()
  }

  const active = showBest ? best : { a: userA, b: userB }

  const xMin = Math.min(...dataset.points.map(([x]) => x))
  const xMax = Math.max(...dataset.points.map(([x]) => x))
  const yMin = Math.min(...dataset.points.map(([, y]) => y))
  const yMax = Math.max(...dataset.points.map(([, y]) => y))
  const xPad = (xMax - xMin) * 0.1 || 1
  const yPad = (yMax - yMin) * 0.12 || 1

  // user line endpoints
  const lineY1 = active.a + active.b * (xMin - xPad)
  const lineY2 = active.a + active.b * (xMax + xPad)

  // MAE
  const mae = dataset.points.reduce((s, [x, y]) => s + Math.abs(y - (active.a + active.b * x)), 0) / dataset.points.length

  // r for user line (always show best r)
  const activeR = showBest ? best.r : best.r
  const activeR2 = showBest ? best.r2 : best.r2

  const axis = useAxisRange({ xMin: xMin - xPad, xMax: xMax + xPad, yMin: yMin - yPad * 3, yMax: yMax + yPad * 3 })

  const handleExport = () => {
    const rows = [
      [dataset.xLabel, dataset.yLabel, 'ŷ (predicción)'],
      ...dataset.points.map(([x, y]) => [x, y, format(active.a + active.b * x)]),
      [],
      ['Ecuación', `y = ${format(active.a)} + ${format(active.b)}x`],
      ['r', format(best.r)], ['r²', format(best.r2)], ['MAE', format(mae)],
    ]
    downloadCsv(rows, `regresion-${datasetId}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
        {/* ── left: context + controls ── */}
        <div className="space-y-4">
          <LabCard title="Escenario">
            <div className="flex flex-wrap gap-2 mb-3">
              {datasets.map((d) => (
                <button
                  key={d.id}
                  onClick={() => selectDataset(d.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${datasetId === d.id ? 'bg-aqua/15 text-aqua' : 'bg-ink/5 text-ink/45 hover:bg-ink/10'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-ink/60 leading-relaxed">{dataset.context}</p>
            <p className="mt-2 text-xs text-ink/40">{dataset.points.length} puntos de datos</p>
          </LabCard>

          <LabCard title="Ajusta tu recta">
            <SliderField
              id="userA" label="Ordenada (a)" value={userA}
              min={yMin - yPad * 2} max={yMax + yPad} step={0.5}
              onChange={(v) => { setUserA(v); setShowBest(false) }}
            />
            <SliderField
              id="userB" label="Pendiente (b)" value={userB}
              min={-20} max={20} step={0.1}
              onChange={(v) => { setUserB(v); setShowBest(false) }}
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { setShowBest(true); setUserA(best.a); setUserB(best.b) }}
                className="flex-1 rounded-xl bg-signal/10 py-2.5 text-sm font-semibold text-signal transition-colors hover:bg-signal/20"
              >
                Ver mejor ajuste
              </button>
              <button
                onClick={() => { setShowBest(false); setUserA(0); setUserB(1) }}
                className="rounded-xl bg-ink/5 px-4 py-2.5 text-sm font-medium text-ink/40 hover:bg-ink/10"
              >
                Reset
              </button>
            </div>
          </LabCard>

          <LabCard title="Ecuación actual">
            <p className="text-center font-mono text-lg font-semibold text-signal">
              ŷ = {format(active.a)} {active.b >= 0 ? '+' : '−'} {format(Math.abs(active.b))}x
            </p>
          </LabCard>
        </div>

        {/* ── right: chart + metrics ── */}
        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <LabCard dark>
            <CartesianFrame
              xMin={axis.xMin} xMax={axis.xMax}
              yMin={axis.yMin} yMax={axis.yMax}
              xTicks={generateTicks(axis.xMin, axis.xMax)}
              yTicks={generateTicks(axis.yMin, axis.yMax)}
              className="w-full h-auto aspect-[16/9] overflow-hidden rounded-[1.1rem]"
            >
              {({ scaleX, scaleY }) => (
                <>
                  {/* regression line */}
                  <line
                    x1={scaleX(xMin - xPad)} y1={scaleY(lineY1)}
                    x2={scaleX(xMax + xPad)} y2={scaleY(lineY2)}
                    stroke={showBest ? '#ff6b35' : '#ff6b35'}
                    strokeWidth="2.5" strokeDasharray={showBest ? 'none' : '6 4'}
                    strokeOpacity={showBest ? 1 : 0.7}
                  />

                  {/* data points */}
                  {dataset.points.map(([x, y], i) => (
                    <circle key={i} cx={scaleX(x)} cy={scaleY(y)} r="6"
                      fill="#5096ff" stroke="rgba(18,23,35,0.3)" strokeWidth="1.5" />
                  ))}

                  {/* residual lines */}
                  {dataset.points.map(([x, y], i) => {
                    const yPred = active.a + active.b * x
                    return (
                      <line key={`r${i}`}
                        x1={scaleX(x)} y1={scaleY(y)}
                        x2={scaleX(x)} y2={scaleY(yPred)}
                        stroke="#22c5a0" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="3 2"
                      />
                    )
                  })}
                </>
              )}
            </CartesianFrame>
            <AxisRangePanel {...axis} />
          </LabCard>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="r (Pearson)" value={format(activeR)} detail="Correlación" />
            <MetricCard label="r²" value={format(activeR2)} detail="Determinación" />
            <MetricCard label="MAE" value={format(mae)} detail="Error medio absoluto" />
            <MetricCard
              label="Fuerza"
              value={Math.abs(best.r) >= 0.9 ? 'Muy fuerte' : Math.abs(best.r) >= 0.7 ? 'Fuerte' : Math.abs(best.r) >= 0.5 ? 'Moderada' : 'Débil'}
              detail={best.r >= 0 ? 'Positiva' : 'Negativa'}
            />
          </div>

          <button
            onClick={handleExport}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink/5 py-3 text-sm font-medium text-ink/50 transition-colors hover:bg-ink/10 hover:text-ink/70"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Exportar datos CSV
          </button>
        </div>
      </div>
    </div>
  )
}

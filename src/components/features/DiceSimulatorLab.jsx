import { useState, useCallback, useMemo } from 'react'
import { CartesianFrame, LabCard, MetricCard, AxisRangePanel } from './DerivaLabPrimitives'
import { downloadCsv, format, generateTicks } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

/* ── dice face SVG ─────────────────────────────────────── */

const DOT_LAYOUTS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
}

function DiceFace({ value, size = 64 }) {
  const dots = DOT_LAYOUTS[value] || []
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <rect x="2" y="2" width="96" height="96" rx="16" fill="#f8f7f4" stroke="#121723" strokeWidth="3" strokeOpacity="0.15" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" fill="#121723" />
      ))}
    </svg>
  )
}

/* ── component ─────────────────────────────────────────── */

export const DiceSimulatorLab = () => {
  const [counts, setCounts] = useState([0, 0, 0, 0, 0, 0])
  const [lastRoll, setLastRoll] = useState(null)

  const total = counts.reduce((a, b) => a + b, 0)
  const freqs = counts.map((c) => (total ? c / total : 0))
  const maxFreq = Math.max(...freqs, 1 / 6)

  // deviation from uniform
  const deviation = useMemo(() => {
    if (!total) return 0
    return Math.sqrt(freqs.reduce((s, f) => s + (f - 1 / 6) ** 2, 0) / 6)
  }, [freqs, total])

  const defaultXMin = 0.2
  const defaultXMax = 6.8
  const defaultYMin = 0
  const defaultYMax = maxFreq * 1.15 + 0.02

  const axis = useAxisRange({ xMin: defaultXMin, xMax: defaultXMax, yMin: defaultYMin, yMax: defaultYMax })

  const roll = useCallback((n) => {
    setCounts((prev) => {
      const next = [...prev]
      let last = 0
      for (let i = 0; i < n; i++) {
        const face = Math.floor(Math.random() * 6)
        next[face]++
        last = face + 1
      }
      setLastRoll(n === 1 ? last : null)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setCounts([0, 0, 0, 0, 0, 0])
    setLastRoll(null)
    axis.resetRange()
  }, [axis])

  const handleExport = () => {
    const rows = [
      ['Cara', 'Frecuencia', 'Frecuencia relativa'],
      ...counts.map((c, i) => [i + 1, c, total ? (c / total).toFixed(6) : 0]),
      [],
      ['Total lanzamientos', total],
      ['Desviación de uniformidad', deviation.toFixed(6)],
    ]
    downloadCsv(rows, 'simulacion-dados.csv')
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
        {/* ── left: controls ── */}
        <div className="space-y-4">
          <LabCard title="Lanzar dados">
            <div className="grid grid-cols-2 gap-2">
              {[1, 10, 100, 1000].map((n) => (
                <button
                  key={n}
                  onClick={() => roll(n)}
                  className="rounded-xl bg-aqua/10 py-3 text-sm font-semibold text-aqua transition-colors hover:bg-aqua/20 active:scale-[0.97]"
                >
                  Lanzar {n === 1 ? '1 vez' : `×${n}`}
                </button>
              ))}
            </div>
            <button
              onClick={reset}
              className="mt-2 w-full rounded-xl bg-signal/10 py-2.5 text-sm font-semibold text-signal transition-colors hover:bg-signal/20"
            >
              Reiniciar
            </button>
          </LabCard>

          {/* last roll display */}
          {lastRoll && (
            <LabCard title="Último lanzamiento">
              <div className="flex items-center justify-center py-2">
                <DiceFace value={lastRoll} size={80} />
              </div>
            </LabCard>
          )}

          <LabCard title="Frecuencias por cara">
            <div className="space-y-1.5">
              {counts.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <DiceFace value={i + 1} size={32} />
                  <div className="flex-1">
                    <div className="h-2.5 rounded-full bg-ink/8 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-aqua transition-all duration-300"
                        style={{ width: `${total ? (c / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-14 text-right font-mono text-xs text-ink/50">
                    {c} <span className="text-ink/30">({total ? (c / total * 100).toFixed(1) : 0}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </LabCard>
        </div>

        {/* ── right: chart + metrics ── */}
        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <LabCard dark>
            <CartesianFrame
              xMin={axis.xMin} xMax={axis.xMax} yMin={axis.yMin} yMax={axis.yMax}
              xTicks={generateTicks(axis.xMin, axis.xMax)} yTicks={generateTicks(axis.yMin, axis.yMax)}
              yTickFormatter={(v) => (v * 100).toFixed(0) + '%'}
              className="w-full h-auto aspect-[16/9] overflow-hidden rounded-[1.1rem]"
            >
              {({ scaleX, scaleY, padding, width }) => {
                const barW = (width - padding * 2) / 8
                return (
                  <>
                    {/* theoretical 1/6 line */}
                    <line
                      x1={scaleX(0.5)} y1={scaleY(1 / 6)}
                      x2={scaleX(6.5)} y2={scaleY(1 / 6)}
                      stroke="#ff6b35" strokeWidth="2" strokeDasharray="6 4" strokeOpacity="0.7"
                    />
                    <text x={scaleX(6.6)} y={scaleY(1 / 6) - 5}
                      fill="#ff6b35" fontSize="10" fontWeight="600" opacity="0.8">
                      1/6
                    </text>

                    {/* bars */}
                    {freqs.map((f, i) => (
                      <rect
                        key={i}
                        x={scaleX(i + 1) - barW / 2}
                        y={scaleY(f)}
                        width={barW}
                        height={scaleY(0) - scaleY(f)}
                        rx="4"
                        fill="#5096ff"
                        fillOpacity="0.75"
                      />
                    ))}
                  </>
                )
              }}
            </CartesianFrame>
            <AxisRangePanel {...axis} />
          </LabCard>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Total lanzamientos" value={total.toLocaleString()} detail="n acumulado" />
            <MetricCard label="Teórico" value="16.67 %" detail="P = 1/6 cada cara" />
            <MetricCard label="Desviación" value={format(deviation)} detail="RMSD vs uniforme" />
            <MetricCard
              label="Convergencia"
              value={total < 10 ? '—' : deviation < 0.01 ? 'Alta' : deviation < 0.03 ? 'Media' : 'Baja'}
              detail="Ley de grandes números"
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

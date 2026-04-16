import { useState, useMemo } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, SliderField, ModelCard } from './DerivaLabPrimitives'
import { LiveFormula } from './LiveFormula'
import { downloadCsv, format, generateTicks, sampleRange, linePath } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

/* ── math helpers ──────────────────────────────────────── */

const normalPdf = (x, mu, sigma) =>
  (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2)

// CDF via rational approximation (Abramowitz & Stegun 26.2.17, |ε| < 7.5e-8)
function normalCdf(x, mu = 0, sigma = 1) {
  const z = (x - mu) / sigma
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 // 1/√(2π)
  const p = d * Math.exp(-0.5 * z * z) *
    (t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))))
  return z >= 0 ? 1 - p : p
}

/* ── component ─────────────────────────────────────────── */

export const NormalDistributionLab = () => {
  const [mu, setMu] = useState(0)
  const [sigma, setSigma] = useState(1)
  const [a, setA] = useState(-1)
  const [b, setB] = useState(1)

  // Default axis range — worst case: μ ∈ [-5,5], σ ∈ [0.3,3]
  const defaultXMin = -17
  const defaultXMax = 17
  const defaultYMax = 1.45 // σ=0.3 → peak ≈ 1.33, with padding

  const axis = useAxisRange({
    xMin: defaultXMin, xMax: defaultXMax,
    yMin: 0, yMax: defaultYMax,
  })

  const curve = useMemo(
    () => sampleRange(mu - 4.5 * sigma, mu + 4.5 * sigma, 300, (x) => normalPdf(x, mu, sigma)),
    [mu, sigma],
  )

  const prob = useMemo(() => normalCdf(b, mu, sigma) - normalCdf(a, mu, sigma), [a, b, mu, sigma])
  const zA = (a - mu) / sigma
  const zB = (b - mu) / sigma

  // empirical rule intervals
  const emp = useMemo(() => [
    { k: 1, pct: '68.27 %', from: mu - sigma, to: mu + sigma },
    { k: 2, pct: '95.45 %', from: mu - 2 * sigma, to: mu + 2 * sigma },
    { k: 3, pct: '99.73 %', from: mu - 3 * sigma, to: mu + 3 * sigma },
  ], [mu, sigma])

  // shaded area points for fill
  const shadedPath = useMemo(() => {
    const clampA = Math.max(a, mu - 4.5 * sigma)
    const clampB = Math.min(b, mu + 4.5 * sigma)
    if (clampA >= clampB) return null
    const pts = sampleRange(clampA, clampB, 120, (x) => normalPdf(x, mu, sigma))
    return pts
  }, [a, b, mu, sigma])

  const handleExport = () => {
    const rows = [
      ['x', 'f(x)'],
      ...curve.map((p) => [p.x.toFixed(4), p.y.toFixed(6)]),
      [],
      ['Parámetro', 'Valor'],
      ['μ', mu], ['σ', sigma],
      ['a', a], ['b', b],
      ['P(a ≤ X ≤ b)', prob.toFixed(6)],
      ['z(a)', zA.toFixed(4)], ['z(b)', zB.toFixed(4)],
    ]
    downloadCsv(rows, 'distribucion-normal.csv')
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
        {/* ── left: controls ── */}
        <div className="space-y-4">
          <LabCard title="Parámetros de la distribución">
            <SliderField id="mu" label="Media μ" value={mu} min={-5} max={5} step={0.1} onChange={setMu} />
            <SliderField id="sigma" label="Desviación σ" value={sigma} min={0.3} max={3} step={0.05} onChange={setSigma} />
          </LabCard>

          <LabCard title="Rango de probabilidad">
            <SliderField id="a" label="Desde a" value={a} min={mu - 4 * sigma} max={b - 0.01} step={0.05} onChange={setA} />
            <SliderField id="b" label="Hasta b" value={b} min={a + 0.01} max={mu + 4 * sigma} step={0.05} onChange={setB} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MetricCard label="P(a ≤ X ≤ b)" value={(prob * 100).toFixed(2) + ' %'} detail="Probabilidad" dark={false} />
              <MetricCard label="z(a)" value={format(zA)} detail="Score estandar." dark={false} />
              <MetricCard label="z(b)" value={format(zB)} detail="Score estandar." dark={false} />
            </div>
          </LabCard>

          <LabCard title="Regla empírica">
            <div className="space-y-2">
              {emp.map((e) => (
                <div key={e.k} className="flex items-center justify-between rounded-lg bg-ink/5 px-3 py-2 text-sm">
                  <span className="font-semibold text-ink/70">μ ± {e.k}σ</span>
                  <span className="font-mono text-xs text-ink/50">[{format(e.from)}, {format(e.to)}]</span>
                  <span className="font-bold text-signal">{e.pct}</span>
                </div>
              ))}
            </div>
          </LabCard>

          <ModelCard
            title="Modelo general"
            expression="f(x) = frac(1,σ√(2π)) · e^{-(x-μ)²/(2σ²)}"
            parameters="μ ∈ ℝ, σ > 0"
          />
          <ModelCard
            title="Modelo evaluado"
            expression={`f(x) = frac(1, ${format(sigma)}√(2π)) · e^{-(x ${mu >= 0 ? '−' : '+'} ${format(Math.abs(mu))})²/(2·${format(sigma)}²)}`}
            parameters={`μ = ${format(mu)},  σ = ${format(sigma)}`}
          />
        </div>

        {/* ── right: chart + metrics ── */}
        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <LabCard dark>
            <CartesianFrame
              xMin={axis.xMin} xMax={axis.xMax} yMin={axis.yMin} yMax={axis.yMax}
              xTicks={generateTicks(axis.xMin, axis.xMax)}
              yTicks={generateTicks(axis.yMin, axis.yMax, 6)}
              yTickFormatter={(v) => v.toFixed(1)}
              className="w-full h-auto aspect-[16/9] overflow-hidden rounded-[1.1rem]"
            >
              {({ scaleX, scaleY }) => (
                <>
                  {/* shaded area */}
                  {shadedPath && shadedPath.length > 1 && (
                    <path
                      d={`M ${scaleX(shadedPath[0].x)} ${scaleY(0)} ` +
                        shadedPath.map((p) => `L ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ') +
                        ` L ${scaleX(shadedPath[shadedPath.length - 1].x)} ${scaleY(0)} Z`}
                      fill="#5096ff" fillOpacity="0.25"
                    />
                  )}

                  {/* empirical rule bands (faint) */}
                  {emp.map((e) => (
                    <line key={e.k}
                      x1={scaleX(e.from)} y1={scaleY(0)}
                      x2={scaleX(e.from)} y2={scaleY(normalPdf(e.from, mu, sigma))}
                      stroke="#22c5a0" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.35"
                    />
                  ))}
                  {emp.map((e) => (
                    <line key={`r${e.k}`}
                      x1={scaleX(e.to)} y1={scaleY(0)}
                      x2={scaleX(e.to)} y2={scaleY(normalPdf(e.to, mu, sigma))}
                      stroke="#22c5a0" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.35"
                    />
                  ))}

                  {/* curve */}
                  <path
                    d={linePath(curve, scaleX, scaleY)}
                    fill="none" stroke="#5096ff" strokeWidth="2.5" strokeLinejoin="round"
                  />

                  {/* boundary lines a and b */}
                  <line x1={scaleX(a)} y1={scaleY(0)} x2={scaleX(a)} y2={scaleY(normalPdf(a, mu, sigma))}
                    stroke="#ff6b35" strokeWidth="2" strokeDasharray="5 3" />
                  <line x1={scaleX(b)} y1={scaleY(0)} x2={scaleX(b)} y2={scaleY(normalPdf(b, mu, sigma))}
                    stroke="#ff6b35" strokeWidth="2" strokeDasharray="5 3" />
                </>
              )}
            </CartesianFrame>
            <AxisRangePanel {...axis} />
            <div className="mt-3">
              <LiveFormula
                label="Densidad normal evaluada"
                general={String.raw`f(x) = \frac{1}{\sigma\sqrt{2\pi}} \cdot e^{-\frac{(x-\mu)^2}{2\sigma^2}}`}
                evaluated={`f(x) = \\frac{1}{${format(sigma)}\\sqrt{2\\pi}} \\cdot e^{-\\frac{(x ${mu >= 0 ? '-' : '+'} ${format(Math.abs(mu))})^2}{2 \\cdot ${format(sigma)}^2}}`}
                raw
              />
            </div>
          </LabCard>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Media μ" value={format(mu)} detail="Centro de la campana" />
            <MetricCard label="Desviación σ" value={format(sigma)} detail="Dispersión" />
            <MetricCard label="P(a ≤ X ≤ b)" value={(prob * 100).toFixed(2) + ' %'} detail="Área sombreada" />
            <MetricCard label="Moda" value={format(mu)} detail="Igual a la media" />
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

import { useState, useMemo } from 'react'
import { CartesianFrame, LabCard, MetricCard, SliderField, ModelCard } from './DerivaLabPrimitives'
import { downloadCsv, format, sampleRange, linePath } from './derivaLabUtils'

/* ── math helpers ──────────────────────────────────────── */

// log-gamma for large factorials (Lanczos approx)
function lnGamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z)
  z -= 1
  const g = 7
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  let x = c[0]
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i)
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

function lnComb(n, k) {
  if (k < 0 || k > n) return -Infinity
  return lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1)
}

function binomPmf(k, n, p) {
  if (k < 0 || k > n) return 0
  if (p === 0) return k === 0 ? 1 : 0
  if (p === 1) return k === n ? 1 : 0
  return Math.exp(lnComb(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p))
}

function binomCdf(k, n, p) {
  let s = 0
  for (let i = 0; i <= Math.floor(k); i++) s += binomPmf(i, n, p)
  return Math.min(s, 1)
}

const normalPdf = (x, mu, sigma) =>
  sigma > 0 ? (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2) : 0

/* ── component ─────────────────────────────────────────── */

export const BinomialDistributionLab = () => {
  const [n, setN] = useState(15)
  const [p, setP] = useState(0.5)
  const [k, setK] = useState(7)

  const mu = n * p
  const variance = n * p * (1 - p)
  const sigma = Math.sqrt(variance)

  const pmf = useMemo(() => {
    const arr = []
    for (let i = 0; i <= n; i++) arr.push({ k: i, p: binomPmf(i, n, p) })
    return arr
  }, [n, p])

  const maxP = useMemo(() => Math.max(...pmf.map((d) => d.p)), [pmf])

  const pK = binomPmf(k, n, p)
  const pLeK = binomCdf(k, n, p)
  const pGeK = 1 - binomCdf(k - 1, n, p)

  // normal approximation curve
  const normalCurve = useMemo(() => {
    if (sigma < 0.01) return []
    return sampleRange(-0.5, n + 0.5, 200, (x) => normalPdf(x, mu, sigma))
  }, [n, mu, sigma])

  const xTicks = useMemo(() => {
    if (n <= 20) return Array.from({ length: n + 1 }, (_, i) => i)
    const step = Math.ceil(n / 10)
    const ticks = []
    for (let i = 0; i <= n; i += step) ticks.push(i)
    if (ticks[ticks.length - 1] !== n) ticks.push(n)
    return ticks
  }, [n])

  const yTicks = useMemo(() => {
    const ticks = []
    const step = maxP > 0.2 ? 0.05 : maxP > 0.1 ? 0.02 : 0.01
    for (let v = 0; v <= maxP * 1.15 + step; v += step) ticks.push(parseFloat(v.toFixed(3)))
    return ticks
  }, [maxP])

  const handleExport = () => {
    const rows = [
      ['k', 'P(X=k)', 'P(X≤k)'],
      ...pmf.map((d) => [d.k, d.p.toFixed(8), binomCdf(d.k, n, p).toFixed(8)]),
      [],
      ['n', n], ['p', p],
      ['E(X)', format(mu)], ['Var(X)', format(variance)], ['σ', format(sigma)],
    ]
    downloadCsv(rows, 'distribucion-binomial.csv')
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
        {/* ── left ── */}
        <div className="space-y-4">
          <LabCard title="Parámetros">
            <SliderField id="n" label="Ensayos n" value={n} min={1} max={50} step={1} natural onChange={setN} />
            <SliderField id="p" label="Probabilidad p" value={p} min={0} max={1} step={0.01} onChange={setP} />
          </LabCard>

          <LabCard title="Calcular probabilidades">
            <SliderField id="k" label="Valor k" value={k} min={0} max={n} step={1} natural onChange={setK} />
            <div className="mt-3 grid grid-cols-1 gap-2">
              <MetricCard label="P(X = k)" value={pK.toFixed(4)} detail={`k = ${k}`} dark={false} />
              <MetricCard label="P(X ≤ k)" value={pLeK.toFixed(4)} detail="Acumulada izquierda" dark={false} />
              <MetricCard label="P(X ≥ k)" value={pGeK.toFixed(4)} detail="Acumulada derecha" dark={false} />
            </div>
          </LabCard>

          <ModelCard
            title="Función de masa"
            expression="P(X=k) = frac(n!,k!(n-k)!) · p^{k} · (1-p)^{n-k}"
            parameters="n ∈ ℕ, 0 ≤ p ≤ 1, k ∈ {0,1,...,n}"
          />
        </div>

        {/* ── right ── */}
        <div className="space-y-5">
          <LabCard dark>
            <CartesianFrame
              xMin={-0.8} xMax={n + 0.8}
              yMin={0} yMax={maxP * 1.15 + 0.01}
              xTicks={xTicks} yTicks={yTicks}
              yTickFormatter={(v) => v.toFixed(2)}
              className="w-full h-auto aspect-[16/9] overflow-hidden rounded-[1.1rem]"
            >
              {({ scaleX, scaleY, padding, width }) => {
                const barW = Math.min((width - padding * 2) / (n + 2) * 0.7, 28)
                return (
                  <>
                    {/* normal approximation */}
                    {normalCurve.length > 1 && (
                      <path
                        d={linePath(normalCurve, scaleX, scaleY)}
                        fill="none" stroke="#ff6b35" strokeWidth="2" strokeDasharray="5 3" strokeOpacity="0.7"
                      />
                    )}

                    {/* bars */}
                    {pmf.map((d) => (
                      <rect
                        key={d.k}
                        x={scaleX(d.k) - barW / 2}
                        y={scaleY(d.p)}
                        width={barW}
                        height={scaleY(0) - scaleY(d.p)}
                        rx="3"
                        fill={d.k === k ? '#22c5a0' : '#5096ff'}
                        fillOpacity={d.k === k ? 0.9 : 0.7}
                      />
                    ))}

                    {/* k indicator label */}
                    <text x={scaleX(k)} y={scaleY(pK) - 8}
                      fill="#22c5a0" fontSize="10" fontWeight="700" textAnchor="middle">
                      k={k}
                    </text>
                  </>
                )
              }}
            </CartesianFrame>
            <div className="mt-2 flex items-center justify-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#5096ff]" /> Binomial
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-[#ff6b35]" style={{ borderTop: '2px dashed #ff6b35' }} /> Normal aprox.
              </span>
            </div>
          </LabCard>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="E(X) = np" value={format(mu)} detail="Valor esperado" />
            <MetricCard label="Var = np(1−p)" value={format(variance)} detail="Varianza" />
            <MetricCard label="σ" value={format(sigma)} detail="Desviación estándar" />
            <MetricCard label="Moda" value={Math.floor((n + 1) * p)} detail="Valor más probable" />
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

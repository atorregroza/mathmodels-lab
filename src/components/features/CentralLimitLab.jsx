import { useState, useMemo, useCallback, useId } from 'react'
import { LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format } from './derivaLabUtils'

/* ── population generators ─────────────────────────────── */

const populations = {
  uniform:     { label: 'Uniforme [0, 10]', gen: () => Math.random() * 10 },
  exponential: { label: 'Exponencial (λ=1)', gen: () => -Math.log(1 - Math.random()) },
  bimodal:     { label: 'Bimodal', gen: () => (Math.random() < 0.5 ? 2 + Math.random() * 2 : 8 + Math.random() * 2) },
  skewed:      { label: 'Sesgada derecha', gen: () => Math.pow(Math.random(), 3) * 10 },
}

// large population reference for true stats
function populationStats(popId) {
  const N = 50000
  const gen = populations[popId].gen
  let s = 0, s2 = 0
  for (let i = 0; i < N; i++) { const v = gen(); s += v; s2 += v * v }
  const mu = s / N
  const sigma = Math.sqrt(s2 / N - mu * mu)
  return { mu, sigma }
}

/* ── histogram helper ──────────────────────────────────── */

function histogramBins(data, nBins) {
  if (!data.length) return []
  const lo = Math.min(...data), hi = Math.max(...data)
  const k = nBins || Math.max(1, Math.ceil(1 + 3.322 * Math.log10(data.length)))
  const w = (hi - lo) / k || 1
  const bins = Array.from({ length: k }, (_, i) => ({
    start: lo + i * w, end: lo + (i + 1) * w, count: 0,
  }))
  data.forEach((v) => {
    let idx = Math.floor((v - lo) / w)
    if (idx >= k) idx = k - 1
    if (idx < 0) idx = 0
    bins[idx].count++
  })
  return bins
}

/* ── mini histogram SVG ────────────────────────────────── */

function MiniHist({ data, nBins, color = '#5096ff', label, overlayFn }) {
  const clipId = useId().replace(/:/g, '')
  const W = 540, H = 200, pad = 36
  const bins = useMemo(() => histogramBins(data, nBins), [data, nBins])

  // overlay normal curve (normalized to bar height) — must be before early return
  const overlayPath = useMemo(() => {
    if (!overlayFn || !bins.length) return null
    const lo = bins[0].start, hi = bins[bins.length - 1].end
    const n = data.length
    const binWidth = (hi - lo) / bins.length
    const pts = []
    for (let i = 0; i <= 200; i++) {
      const x = lo + (i / 200) * (hi - lo)
      const y = overlayFn(x) * n * binWidth
      pts.push({ x, y })
    }
    return pts
  }, [overlayFn, bins, data.length])

  if (!bins.length) return (
    <div className="flex h-[200px] items-center justify-center rounded-[1.1rem] bg-[#0e1219] text-sm text-white/25">
      {label || 'Sin datos aún'}
    </div>
  )

  const maxCount = Math.max(...bins.map((b) => b.count))
  const barW = (W - pad * 2) / bins.length
  const scaleY = (v) => H - pad - (v / (maxCount || 1)) * (H - pad * 2)
  const scaleX = (v) => {
    const lo = bins[0].start, hi = bins[bins.length - 1].end
    return pad + ((v - lo) / ((hi - lo) || 1)) * (W - pad * 2)
  }

  // y ticks
  const yStep = Math.max(1, Math.ceil(maxCount / 4))
  const yTicks = []
  for (let v = 0; v <= maxCount; v += yStep) yTicks.push(v)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-[1.1rem] bg-[#0e1219]">
      <defs><clipPath id={clipId}><rect x={pad} y={4} width={W - pad * 2} height={H - pad + 4} /></clipPath></defs>

      {yTicks.map((t) => (
        <line key={t} x1={pad} y1={scaleY(t)} x2={W - pad} y2={scaleY(t)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}

      <g clipPath={`url(#${clipId})`}>
        {bins.map((b, i) => (
          <rect key={i} x={pad + i * barW + 1} y={scaleY(b.count)}
            width={barW - 2} height={H - pad - scaleY(b.count)}
            rx="3" fill={color} fillOpacity="0.7" />
        ))}

        {overlayPath && overlayPath.length > 1 && (
          <path
            d={overlayPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ')}
            fill="none" stroke="#ff6b35" strokeWidth="2.5" strokeDasharray="5 3"
          />
        )}
      </g>

      {bins.filter((_, i) => i % Math.ceil(bins.length / 8) === 0 || i === bins.length - 1).map((b, i) => (
        <text key={`x${i}`} x={scaleX(b.start)} y={H - pad + 14}
          fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle">
          {Number(b.start.toPrecision(3))}
        </text>
      ))}

      {yTicks.map((t) => (
        <text key={`y${t}`} x={pad - 5} y={scaleY(t) + 3}
          fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="end">{t}</text>
      ))}

      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

      {label && (
        <text x={W / 2} y={18} fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="600" textAnchor="middle">
          {label}
        </text>
      )}
    </svg>
  )
}

/* ── component ─────────────────────────────────────────── */

export const CentralLimitLab = () => {
  const [popId, setPopId] = useState('uniform')
  const [sampleSize, setSampleSize] = useState(10)
  const [means, setMeans] = useState([])
  const [popSample, setPopSample] = useState([]) // last raw sample for population histogram

  const popStats = useMemo(() => populationStats(popId), [popId])
  const gen = populations[popId].gen

  const takeSamples = useCallback((count) => {
    const newMeans = []
    let lastSample = []
    for (let s = 0; s < count; s++) {
      const sample = []
      for (let i = 0; i < sampleSize; i++) sample.push(gen())
      const m = sample.reduce((a, b) => a + b, 0) / sampleSize
      newMeans.push(m)
      if (s === count - 1) lastSample = sample
    }
    setMeans((prev) => [...prev, ...newMeans])
    setPopSample((prev) => [...prev, ...lastSample])
  }, [sampleSize, gen])

  const resetAll = useCallback(() => {
    setMeans([])
    setPopSample([])
  }, [])

  const changePop = (id) => {
    setPopId(id)
    setMeans([])
    setPopSample([])
  }

  // stats of sample means
  const meanOfMeans = means.length ? means.reduce((a, b) => a + b, 0) / means.length : 0
  const sdOfMeans = useMemo(() => {
    if (means.length < 2) return 0
    const m = meanOfMeans
    return Math.sqrt(means.reduce((s, v) => s + (v - m) ** 2, 0) / means.length)
  }, [means, meanOfMeans])

  const theoreticalSd = popStats.sigma / Math.sqrt(sampleSize)

  // normal overlay for means histogram
  const normalOverlay = useMemo(() => {
    if (means.length < 5 || theoreticalSd < 0.001) return null
    const mu = popStats.mu
    const sigma = theoreticalSd
    return (x) => (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2)
  }, [means.length, popStats.mu, theoreticalSd])

  const handleExport = () => {
    const rows = [
      ['Muestra #', 'Media muestral'],
      ...means.map((m, i) => [i + 1, m.toFixed(6)]),
      [],
      ['Estadístico', 'Valor'],
      ['μ poblacional', format(popStats.mu)],
      ['σ poblacional', format(popStats.sigma)],
      ['Media de medias', format(meanOfMeans)],
      ['σ de medias (observada)', format(sdOfMeans)],
      ['σ/√n (teórica)', format(theoreticalSd)],
      ['n por muestra', sampleSize],
      ['Total muestras', means.length],
    ]
    downloadCsv(rows, 'teorema-central-limite.csv')
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
        {/* ── left ── */}
        <div className="space-y-4">
          <LabCard title="Población">
            <div className="flex flex-wrap gap-2">
              {Object.entries(populations).map(([id, pop]) => (
                <button
                  key={id}
                  onClick={() => changePop(id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${popId === id ? 'bg-aqua/15 text-aqua' : 'bg-ink/5 text-ink/45 hover:bg-ink/10'}`}
                >
                  {pop.label}
                </button>
              ))}
            </div>
          </LabCard>

          <LabCard title="Tamaño de muestra">
            <SliderField id="n" label="n por muestra" value={sampleSize} min={1} max={100} step={1} natural onChange={(v) => { setSampleSize(v); setMeans([]); setPopSample([]) }} />
          </LabCard>

          <LabCard title="Tomar muestras">
            <div className="grid grid-cols-2 gap-2">
              {[1, 10, 100, 1000].map((c) => (
                <button
                  key={c}
                  onClick={() => takeSamples(c)}
                  className="rounded-xl bg-aqua/10 py-3 text-sm font-semibold text-aqua transition-colors hover:bg-aqua/20 active:scale-[0.97]"
                >
                  {c === 1 ? '1 muestra' : `×${c}`}
                </button>
              ))}
            </div>
            <button
              onClick={resetAll}
              className="mt-2 w-full rounded-xl bg-signal/10 py-2.5 text-sm font-semibold text-signal transition-colors hover:bg-signal/20"
            >
              Reiniciar
            </button>
          </LabCard>

          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="μ poblacional" value={format(popStats.mu)} detail="Media teórica" dark={false} />
            <MetricCard label="σ poblacional" value={format(popStats.sigma)} detail="Desviación teórica" dark={false} />
            <MetricCard label="σ/√n teórica" value={format(theoreticalSd)} detail="Error estándar" dark={false} />
            <MetricCard label="Total muestras" value={means.length.toLocaleString()} detail="Acumuladas" dark={false} />
          </div>
        </div>

        {/* ── right ── */}
        <div className="space-y-5">
          <LabCard dark>
            <MiniHist
              data={popSample}
              nBins={25}
              color="#5096ff"
              label={`Población: ${populations[popId].label}`}
            />
          </LabCard>

          <LabCard dark>
            <MiniHist
              data={means}
              nBins={Math.min(30, Math.max(5, Math.ceil(Math.sqrt(means.length))))}
              color="#22c5a0"
              label={`Distribución de medias muestrales (n=${sampleSize})`}
              overlayFn={normalOverlay}
            />
            {means.length > 0 && (
              <div className="mt-2 flex items-center justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#22c5a0]" /> Medias observadas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4" style={{ borderTop: '2px dashed #ff6b35' }} /> Normal teórica
                </span>
              </div>
            )}
          </LabCard>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Media de x̄" value={means.length ? format(meanOfMeans) : '—'} detail="Converge a μ" />
            <MetricCard label="σ de x̄ (obs)" value={means.length > 1 ? format(sdOfMeans) : '—'} detail="Observada" />
            <MetricCard label="σ/√n" value={format(theoreticalSd)} detail="Teórica" />
            <MetricCard
              label="Convergencia"
              value={means.length < 30 ? '—' : Math.abs(sdOfMeans - theoreticalSd) / theoreticalSd < 0.1 ? 'Alta' : 'En curso'}
              detail="TCL en acción"
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

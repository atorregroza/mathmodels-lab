import { useState, useMemo, useId } from 'react'
import { CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, sampleRange, linePath } from './derivaLabUtils'

/* ── datasets ──────────────────────────────────────────── */

const groups = [
  {
    id: 'mixto',
    label: 'Grupo mixto (30 est.)',
    data: [152, 155, 157, 158, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 182, 184, 186, 190],
  },
  {
    id: 'mujeres',
    label: 'Mujeres (20 est.)',
    data: [150, 152, 154, 155, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 172, 174],
  },
  {
    id: 'hombres',
    label: 'Hombres (20 est.)',
    data: [162, 164, 166, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 182, 184, 186, 190],
  },
]

/* ── stat helpers ──────────────────────────────────────── */

function stats(d) {
  const n = d.length
  const sorted = [...d].sort((a, b) => a - b)
  const sum = d.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const median = n % 2 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  const q = (p) => { const i = p * (n - 1); const lo = Math.floor(i); return lo === Math.ceil(i) ? sorted[lo] : sorted[lo] + (sorted[lo + 1] - sorted[lo]) * (i - lo) }
  const q1 = q(0.25), q3 = q(0.75)
  const variance = d.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const sd = Math.sqrt(variance)
  const sampleSd = Math.sqrt(d.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1))
  return { n, sum, mean, median, min: sorted[0], max: sorted[n - 1], q1, q3, iqr: q3 - q1, sd, sampleSd, range: sorted[n - 1] - sorted[0] }
}

function histBins(data, nBins) {
  const lo = Math.min(...data), hi = Math.max(...data)
  const k = nBins || Math.max(1, Math.ceil(1 + 3.322 * Math.log10(data.length)))
  const w = (hi - lo) / k || 1
  const bins = Array.from({ length: k }, (_, i) => ({ start: lo + i * w, end: lo + (i + 1) * w, count: 0 }))
  data.forEach((v) => { let idx = Math.floor((v - lo) / w); if (idx >= k) idx = k - 1; bins[idx].count++ })
  return bins
}

const normalPdf = (x, mu, sigma) =>
  (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2)

/* ── Box plot SVG ──────────────────────────────────────── */

function BoxPlot({ data, color = '#5096ff' }) {
  const W = 540, H = 80, pad = 40
  const s = stats(data)
  const lo = s.min - 2, hi = s.max + 2
  const sx = (v) => pad + ((v - lo) / (hi - lo)) * (W - pad * 2)

  const ticks = []
  const step = Math.ceil((hi - lo) / 10)
  for (let v = Math.ceil(lo); v <= hi; v += step) ticks.push(v)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* axis */}
      <line x1={pad} y1={60} x2={W - pad} y2={60} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={57} x2={sx(t)} y2={63} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          <text x={sx(t)} y={74} fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle">{t}</text>
        </g>
      ))}

      {/* whiskers */}
      <line x1={sx(s.min)} y1={30} x2={sx(s.q1)} y2={30} stroke={color} strokeWidth="2" />
      <line x1={sx(s.q3)} y1={30} x2={sx(s.max)} y2={30} stroke={color} strokeWidth="2" />
      <line x1={sx(s.min)} y1={22} x2={sx(s.min)} y2={38} stroke={color} strokeWidth="2" />
      <line x1={sx(s.max)} y1={22} x2={sx(s.max)} y2={38} stroke={color} strokeWidth="2" />

      {/* box */}
      <rect x={sx(s.q1)} y={16} width={sx(s.q3) - sx(s.q1)} height={28}
        fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" rx="3" />

      {/* median line */}
      <line x1={sx(s.median)} y1={16} x2={sx(s.median)} y2={44}
        stroke="#ff6b35" strokeWidth="2.5" />

      {/* labels */}
      <text x={sx(s.min)} y={12} fill="rgba(255,255,255,0.5)" fontSize="8" textAnchor="middle">Min {s.min}</text>
      <text x={sx(s.q1)} y={12} fill="rgba(255,255,255,0.5)" fontSize="8" textAnchor="middle">Q1 {format(s.q1)}</text>
      <text x={sx(s.median)} y={12} fill="#ff6b35" fontSize="8" fontWeight="700" textAnchor="middle">Med {format(s.median)}</text>
      <text x={sx(s.q3)} y={12} fill="rgba(255,255,255,0.5)" fontSize="8" textAnchor="middle">Q3 {format(s.q3)}</text>
      <text x={sx(s.max)} y={12} fill="rgba(255,255,255,0.5)" fontSize="8" textAnchor="middle">Max {s.max}</text>
    </svg>
  )
}

/* ── Histogram with normal overlay ─────────────────────── */

function Histogram({ data, mu, sigma }) {
  const clipId = useId().replace(/:/g, '')
  const W = 540, H = 200, pad = 36
  const bins = useMemo(() => histBins(data, 8), [data])
  const maxCount = Math.max(...bins.map((b) => b.count))
  const barW = (W - pad * 2) / bins.length

  const scaleY = (v) => H - pad - (v / (maxCount || 1)) * (H - pad * 2)
  const lo = bins[0].start, hi = bins[bins.length - 1].end
  const scaleX = (v) => pad + ((v - lo) / ((hi - lo) || 1)) * (W - pad * 2)

  // normal curve scaled to histogram
  const binWidth = (hi - lo) / bins.length
  const normalCurve = useMemo(() =>
    sampleRange(lo, hi, 150, (x) => normalPdf(x, mu, sigma) * data.length * binWidth),
  [lo, hi, mu, sigma, data.length, binWidth])

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
          <rect key={i} x={pad + i * barW + 1} y={scaleY(b.count)} width={barW - 2} height={H - pad - scaleY(b.count)}
            rx="3" fill="#5096ff" fillOpacity="0.7" />
        ))}
        <path d={linePath(normalCurve, scaleX, scaleY)} fill="none" stroke="#ff6b35" strokeWidth="2" strokeDasharray="5 3" />
      </g>

      {bins.map((b, i) => (
        <text key={`x${i}`} x={pad + i * barW + barW / 2} y={H - pad + 13}
          fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle">{Math.round(b.start)}</text>
      ))}
      {yTicks.map((t) => (
        <text key={`y${t}`} x={pad - 5} y={scaleY(t) + 3} fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="end">{t}</text>
      ))}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
    </svg>
  )
}

/* ── component ─────────────────────────────────────────── */

export const HeightsStatisticsLab = () => {
  const [groupId, setGroupId] = useState('mixto')
  const group = groups.find((g) => g.id === groupId) || groups[0]
  const s = useMemo(() => stats(group.data), [group])

  const handleExport = () => {
    const rows = [
      ['Altura (cm)'], ...group.data.map((v) => [v]), [],
      ['Estadístico', 'Valor'],
      ['n', s.n], ['Media', format(s.mean)], ['Mediana', format(s.median)],
      ['σ', format(s.sd)], ['s', format(s.sampleSd)],
      ['Mín', s.min], ['Máx', s.max], ['Rango', s.range],
      ['Q1', format(s.q1)], ['Q3', format(s.q3)], ['IQR', format(s.iqr)],
    ]
    downloadCsv(rows, `alturas-${groupId}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
        {/* left */}
        <div className="space-y-4">
          <LabCard title="Grupo de estudiantes">
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button key={g.id} onClick={() => setGroupId(g.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${groupId === g.id ? 'bg-aqua/15 text-aqua' : 'bg-ink/5 text-ink/45 hover:bg-ink/10'}`}>
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-ink/60">Datos de altura en cm de estudiantes de grado 10-11.</p>
          </LabCard>

          <LabCard title="Resumen de 5 números">
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {[['Mín', s.min], ['Q1', format(s.q1)], ['Med', format(s.median)], ['Q3', format(s.q3)], ['Máx', s.max]].map(([label, val]) => (
                <div key={label} className="rounded-lg bg-ink/5 py-2">
                  <span className="block text-[0.5rem] uppercase tracking-wider text-ink/40">{label}</span>
                  <span className="font-display text-sm font-semibold text-ink">{val}</span>
                </div>
              ))}
            </div>
          </LabCard>

          <LabCard title="Estadísticos">
            <div className="grid grid-cols-2 gap-1.5">
              <MetricCard label="n" value={s.n} detail="Tamaño muestra" dark={false} />
              <MetricCard label="x̄ (media)" value={format(s.mean)} detail="Promedio" dark={false} />
              <MetricCard label="σ (pob)" value={format(s.sd)} detail="Desv. poblacional" dark={false} />
              <MetricCard label="s (muest)" value={format(s.sampleSd)} detail="Desv. muestral" dark={false} />
              <MetricCard label="Rango" value={s.range} detail="Máx − Mín" dark={false} />
              <MetricCard label="IQR" value={format(s.iqr)} detail="Q3 − Q1" dark={false} />
            </div>
          </LabCard>
        </div>

        {/* right */}
        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <LabCard dark title="Histograma con curva normal">
            <Histogram data={group.data} mu={s.mean} sigma={s.sd} />
            <div className="mt-2 flex items-center justify-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#5096ff]" /> Frecuencia
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4" style={{ borderTop: '2px dashed #ff6b35' }} /> Normal ajustada
              </span>
            </div>
          </LabCard>

          <LabCard dark title="Diagrama de caja (box plot)">
            <BoxPlot data={group.data} />
          </LabCard>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Media" value={format(s.mean)} detail="Centro" />
            <MetricCard label="Mediana" value={format(s.median)} detail="Valor central" />
            <MetricCard label="Simetría" value={Math.abs(s.mean - s.median) < 1 ? 'Aprox. simétrica' : s.mean > s.median ? 'Sesgo derecho' : 'Sesgo izquierdo'} detail="Media vs mediana" />
            <MetricCard label="IQR" value={format(s.iqr)} detail="Dispersión central" />
          </div>

          <button onClick={handleExport}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink/5 py-3 text-sm font-medium text-ink/50 transition-colors hover:bg-ink/10 hover:text-ink/70">
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

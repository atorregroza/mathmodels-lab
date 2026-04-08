import { useState, useMemo, useId } from 'react'
import { LabCard, MetricCard } from './DerivaLabPrimitives'
import { downloadCsv, format } from './derivaLabUtils'

/* ── datasets ──────────────────────────────────────────── */

const exams = [
  {
    id: 'math',
    label: 'Matemáticas',
    groups: {
      A: { label: 'Grupo A (mañana)', data: [45, 52, 58, 62, 65, 67, 68, 70, 72, 73, 75, 76, 78, 80, 82, 84, 85, 88, 90, 95] },
      B: { label: 'Grupo B (tarde)', data: [38, 42, 48, 50, 55, 58, 60, 62, 63, 65, 66, 68, 70, 72, 74, 76, 78, 80, 85, 88] },
    },
  },
  {
    id: 'science',
    label: 'Ciencias',
    groups: {
      A: { label: 'Grupo A (lab)', data: [55, 60, 62, 65, 68, 70, 72, 74, 75, 76, 78, 80, 82, 84, 85, 86, 88, 90, 92, 94] },
      B: { label: 'Grupo B (trad.)', data: [40, 45, 48, 52, 55, 58, 60, 62, 65, 66, 68, 70, 72, 74, 75, 76, 78, 80, 82, 85] },
    },
  },
  {
    id: 'language',
    label: 'Lengua',
    groups: {
      A: { label: 'Grupo A', data: [50, 55, 58, 60, 62, 64, 65, 66, 68, 70, 72, 74, 75, 76, 78, 80, 82, 85, 88, 92] },
      B: { label: 'Grupo B', data: [48, 52, 55, 58, 60, 62, 64, 65, 67, 68, 70, 72, 74, 75, 76, 78, 80, 82, 84, 90] },
    },
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
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
  const sampleSd = n > 1 ? Math.sqrt(d.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0
  return { n, mean, median, min: sorted[0], max: sorted[n - 1], q1, q3, iqr: q3 - q1, sd, sampleSd, range: sorted[n - 1] - sorted[0], sorted }
}

function percentileOf(sorted, value) {
  let below = 0
  for (const v of sorted) { if (v < value) below++ }
  return (below / sorted.length) * 100
}

/* ── dual box plot ─────────────────────────────────────── */

function DualBoxPlot({ dataA, dataB, labelA, labelB }) {
  const W = 540, H = 140, pad = 50
  const sA = stats(dataA), sB = stats(dataB)
  const lo = Math.min(sA.min, sB.min) - 5
  const hi = Math.max(sA.max, sB.max) + 5
  const sx = (v) => pad + ((v - lo) / (hi - lo)) * (W - pad * 2)

  const ticks = []
  const step = Math.max(5, Math.ceil((hi - lo) / 10 / 5) * 5)
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)

  const drawBox = (s, y, color, label) => (
    <g>
      <text x={pad - 6} y={y + 4} fill="rgba(255,255,255,0.5)" fontSize="9" textAnchor="end" fontWeight="600">{label}</text>
      <line x1={sx(s.min)} y1={y} x2={sx(s.q1)} y2={y} stroke={color} strokeWidth="2" />
      <line x1={sx(s.q3)} y1={y} x2={sx(s.max)} y2={y} stroke={color} strokeWidth="2" />
      <line x1={sx(s.min)} y1={y - 8} x2={sx(s.min)} y2={y + 8} stroke={color} strokeWidth="2" />
      <line x1={sx(s.max)} y1={y - 8} x2={sx(s.max)} y2={y + 8} stroke={color} strokeWidth="2" />
      <rect x={sx(s.q1)} y={y - 14} width={sx(s.q3) - sx(s.q1)} height={28}
        fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" rx="3" />
      <line x1={sx(s.median)} y1={y - 14} x2={sx(s.median)} y2={y + 14}
        stroke="#ff6b35" strokeWidth="2.5" />
    </g>
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-[1.1rem] bg-[#0e1219]">
      <line x1={pad} y1={H - 24} x2={W - pad} y2={H - 24} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={H - 27} x2={sx(t)} y2={H - 21} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          <text x={sx(t)} y={H - 8} fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle">{t}</text>
        </g>
      ))}
      {drawBox(sA, 40, '#5096ff', labelA)}
      {drawBox(sB, 85, '#22c5a0', labelB)}
    </svg>
  )
}

/* ── histogram overlay ─────────────────────────────────── */

function DualHistogram({ dataA, dataB }) {
  const clipId = useId().replace(/:/g, '')
  const W = 540, H = 200, pad = 36
  const all = [...dataA, ...dataB]
  const lo = Math.min(...all) - 5, hi = Math.max(...all) + 5
  const nBins = 10
  const binW = (hi - lo) / nBins

  const makeBins = (data) => {
    const bins = Array.from({ length: nBins }, () => 0)
    data.forEach((v) => { let idx = Math.floor((v - lo) / binW); if (idx >= nBins) idx = nBins - 1; if (idx < 0) idx = 0; bins[idx]++ })
    return bins
  }

  const binsA = makeBins(dataA), binsB = makeBins(dataB)
  const maxCount = Math.max(...binsA, ...binsB)
  const barUnit = (W - pad * 2) / nBins
  const scaleY = (v) => H - pad - (v / (maxCount || 1)) * (H - pad * 2)

  const yStep = Math.max(1, Math.ceil(maxCount / 4))
  const yTicks = []
  for (let v = 0; v <= maxCount; v += yStep) yTicks.push(v)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-[1.1rem] bg-[#0e1219]">
      <defs><clipPath id={clipId}><rect x={pad} y={4} width={W - pad * 2} height={H - pad} /></clipPath></defs>

      {yTicks.map((t) => (
        <line key={t} x1={pad} y1={scaleY(t)} x2={W - pad} y2={scaleY(t)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}

      <g clipPath={`url(#${clipId})`}>
        {binsA.map((c, i) => (
          <rect key={`a${i}`} x={pad + i * barUnit + 1} y={scaleY(c)} width={barUnit / 2 - 1} height={H - pad - scaleY(c)}
            rx="2" fill="#5096ff" fillOpacity="0.65" />
        ))}
        {binsB.map((c, i) => (
          <rect key={`b${i}`} x={pad + i * barUnit + barUnit / 2} y={scaleY(c)} width={barUnit / 2 - 1} height={H - pad - scaleY(c)}
            rx="2" fill="#22c5a0" fillOpacity="0.65" />
        ))}
      </g>

      {Array.from({ length: nBins + 1 }, (_, i) => i).filter((_, i) => i % 2 === 0).map((i) => (
        <text key={i} x={pad + i * barUnit} y={H - pad + 13}
          fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle">{Math.round(lo + i * binW)}</text>
      ))}
      {yTicks.map((t) => (
        <text key={`y${t}`} x={pad - 5} y={scaleY(t) + 3} fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="end">{t}</text>
      ))}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
    </svg>
  )
}

/* ── percentile calculator ─────────────────────────────── */

function PercentileCalc({ sorted, label }) {
  const [score, setScore] = useState(70)
  const pct = percentileOf(sorted, score)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className="text-xs text-ink/50 shrink-0">Calificación:</label>
        <input type="range" min={0} max={100} step={1} value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="flex-1 h-1.5 accent-aqua cursor-pointer" />
        <span className="font-mono text-sm font-semibold text-ink w-8 text-right">{score}</span>
      </div>
      <p className="text-center text-sm text-ink/60">
        Un puntaje de <span className="font-semibold text-aqua">{score}</span> está en el percentil{' '}
        <span className="font-bold text-signal">{pct.toFixed(0)}</span> de {label}
      </p>
    </div>
  )
}

/* ── component ─────────────────────────────────────────── */

export const ExamScoresLab = () => {
  const [examId, setExamId] = useState('math')
  const exam = exams.find((e) => e.id === examId) || exams[0]
  const sA = useMemo(() => stats(exam.groups.A.data), [exam])
  const sB = useMemo(() => stats(exam.groups.B.data), [exam])

  const handleExport = () => {
    const rows = [
      [exam.groups.A.label, exam.groups.B.label],
      ...Array.from({ length: Math.max(sA.n, sB.n) }, (_, i) => [
        exam.groups.A.data[i] ?? '', exam.groups.B.data[i] ?? '',
      ]), [],
      ['Estadístico', exam.groups.A.label, exam.groups.B.label],
      ['n', sA.n, sB.n], ['Media', format(sA.mean), format(sB.mean)],
      ['Mediana', format(sA.median), format(sB.median)],
      ['σ', format(sA.sd), format(sB.sd)], ['s', format(sA.sampleSd), format(sB.sampleSd)],
      ['Q1', format(sA.q1), format(sB.q1)], ['Q3', format(sA.q3), format(sB.q3)],
      ['IQR', format(sA.iqr), format(sB.iqr)],
    ]
    downloadCsv(rows, `calificaciones-${examId}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
        {/* left */}
        <div className="space-y-4">
          <LabCard title="Examen">
            <div className="flex flex-wrap gap-2">
              {exams.map((e) => (
                <button key={e.id} onClick={() => setExamId(e.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${examId === e.id ? 'bg-aqua/15 text-aqua' : 'bg-ink/5 text-ink/45 hover:bg-ink/10'}`}>
                  {e.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-ink/60">Compara las calificaciones de dos grupos del mismo examen.</p>
          </LabCard>

          <LabCard title="Comparación de grupos">
            <div className="grid grid-cols-2 gap-3">
              {/* Group A */}
              <div className="space-y-1.5 rounded-lg bg-ink/3 p-3">
                <p className="text-xs font-semibold text-[#5096ff]">{exam.groups.A.label}</p>
                <div className="space-y-1 text-xs text-ink/60">
                  <div className="flex justify-between"><span>Media</span><span className="font-mono font-semibold">{format(sA.mean)}</span></div>
                  <div className="flex justify-between"><span>Mediana</span><span className="font-mono font-semibold">{format(sA.median)}</span></div>
                  <div className="flex justify-between"><span>s</span><span className="font-mono font-semibold">{format(sA.sampleSd)}</span></div>
                  <div className="flex justify-between"><span>IQR</span><span className="font-mono font-semibold">{format(sA.iqr)}</span></div>
                </div>
              </div>
              {/* Group B */}
              <div className="space-y-1.5 rounded-lg bg-ink/3 p-3">
                <p className="text-xs font-semibold text-[#22c5a0]">{exam.groups.B.label}</p>
                <div className="space-y-1 text-xs text-ink/60">
                  <div className="flex justify-between"><span>Media</span><span className="font-mono font-semibold">{format(sB.mean)}</span></div>
                  <div className="flex justify-between"><span>Mediana</span><span className="font-mono font-semibold">{format(sB.median)}</span></div>
                  <div className="flex justify-between"><span>s</span><span className="font-mono font-semibold">{format(sB.sampleSd)}</span></div>
                  <div className="flex justify-between"><span>IQR</span><span className="font-mono font-semibold">{format(sB.iqr)}</span></div>
                </div>
              </div>
            </div>
          </LabCard>

          <LabCard title="Calculadora de percentiles">
            <PercentileCalc sorted={sA.sorted} label={exam.groups.A.label} />
          </LabCard>
        </div>

        {/* right */}
        <div className="space-y-5">
          <LabCard dark title="Histogramas superpuestos">
            <DualHistogram
              dataA={exam.groups.A.data} dataB={exam.groups.B.data}
            />
            <div className="mt-2 flex items-center justify-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#5096ff]" /> {exam.groups.A.label}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#22c5a0]" /> {exam.groups.B.label}
              </span>
            </div>
          </LabCard>

          <LabCard dark title="Diagramas de caja comparativos">
            <DualBoxPlot
              dataA={exam.groups.A.data} dataB={exam.groups.B.data}
              labelA="A" labelB="B"
            />
          </LabCard>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Δ Medias" value={format(sA.mean - sB.mean)} detail="A − B" />
            <MetricCard label="Δ Medianas" value={format(sA.median - sB.median)} detail="A − B" />
            <MetricCard
              label="Más disperso"
              value={sA.sampleSd > sB.sampleSd ? 'Grupo A' : 'Grupo B'}
              detail={`s: ${format(Math.max(sA.sampleSd, sB.sampleSd))}`}
            />
            <MetricCard
              label="Mejor rendim."
              value={sA.mean > sB.mean ? 'Grupo A' : 'Grupo B'}
              detail="Por media"
            />
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

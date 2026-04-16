import { useState, useMemo, useCallback, useId } from 'react'
import { LabCard, MetricCard } from './DerivaLabPrimitives'
import { downloadCsv, format } from './derivaLabUtils'

/* ── stat helpers ──────────────────────────────────────── */

function computeStats(d) {
  if (!d.length) return null
  const n = d.length
  const sorted = [...d].sort((a, b) => a - b)
  const sum = d.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const median = n % 2 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  const q = (p) => { const i = p * (n - 1); const lo = Math.floor(i); return lo === Math.ceil(i) ? sorted[lo] : sorted[lo] + (sorted[lo + 1] - sorted[lo]) * (i - lo) }
  const q1 = q(0.25), q3 = q(0.75)
  const variance = d.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const sd = Math.sqrt(variance)
  const sampleSd = n > 1 ? Math.sqrt(d.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0
  return { n, sum, mean, median, min: sorted[0], max: sorted[n - 1], q1, q3, iqr: q3 - q1, sd, sampleSd, range: sorted[n - 1] - sorted[0] }
}

/* ── dot plot ──────────────────────────────────────────── */

function DotPlot({ data, mean }) {
  const clipId = useId().replace(/:/g, '')
  const W = 540, H = 160, pad = 36
  if (!data.length) return (
    <div className="flex h-[160px] items-center justify-center rounded-[1.1rem] bg-[#0e1219] text-sm text-white/25">
      Recolecta datos para ver el gráfico
    </div>
  )

  const lo = Math.max(0, Math.min(...data) - 30)
  const hi = Math.max(...data) + 30
  const sx = (v) => pad + ((v - lo) / ((hi - lo) || 1)) * (W - pad * 2)

  // stack dots
  const stacks = {}
  data.forEach((v) => {
    const bucket = Math.round(v / 10) * 10 // group by 10ms
    stacks[bucket] = (stacks[bucket] || 0) + 1
  })

  // x ticks
  const step = Math.max(10, Math.ceil((hi - lo) / 10 / 10) * 10)
  const xTicks = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) xTicks.push(v)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-[1.1rem] bg-[#0e1219]">
      <defs><clipPath id={clipId}><rect x={pad} y={4} width={W - pad * 2} height={H - pad} /></clipPath></defs>

      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

      {xTicks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={H - pad - 2} x2={sx(t)} y2={H - pad + 2} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          <text x={sx(t)} y={H - pad + 15} fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle">{t}</text>
        </g>
      ))}

      <g clipPath={`url(#${clipId})`}>
        {/* mean line */}
        {mean && (
          <line x1={sx(mean)} y1={8} x2={sx(mean)} y2={H - pad}
            stroke="#ff6b35" strokeWidth="2" strokeDasharray="5 3" strokeOpacity="0.7" />
        )}

        {/* dots */}
        {Object.entries(stacks).map(([bucket, count]) => {
          const x = Number(bucket)
          return Array.from({ length: count }, (_, i) => (
            <circle key={`${bucket}-${i}`}
              cx={sx(x)} cy={H - pad - 10 - i * 12}
              r="5" fill="#5096ff" fillOpacity="0.8" stroke="rgba(18,23,35,0.3)" strokeWidth="1" />
          ))
        })}
      </g>

      {mean && (
        <text x={sx(mean)} y={8} fill="#ff6b35" fontSize="9" fontWeight="600" textAnchor="middle">
          x̄ = {Math.round(mean)} ms
        </text>
      )}

      <text x={W / 2} y={H - 4} fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="middle">
        Tiempo de reacción (ms)
      </text>
    </svg>
  )
}

/* ── reaction test button ──────────────────────────────── */

function ReactionTest({ onResult }) {
  const [phase, setPhase] = useState('ready') // 'ready' | 'waiting' | 'go' | 'result' | 'early'
  const [startTime, setStartTime] = useState(0)
  const [result, setResult] = useState(0)

  const start = useCallback(() => {
    setPhase('waiting')
    const delay = 1500 + Math.random() * 3000 // 1.5-4.5s random
    const timer = setTimeout(() => {
      setStartTime(performance.now())
      setPhase('go')
    }, delay)
    // store timer for early click
    window.__reactionTimer = timer
  }, [])

  const click = useCallback(() => {
    if (phase === 'waiting') {
      clearTimeout(window.__reactionTimer)
      setPhase('early')
      return
    }
    if (phase === 'go') {
      const ms = Math.round(performance.now() - startTime)
      setResult(ms)
      setPhase('result')
      onResult(ms)
      return
    }
    if (phase === 'result' || phase === 'early' || phase === 'ready') {
      start()
    }
  }, [phase, startTime, onResult, start])

  const colors = {
    ready: 'bg-aqua/15 text-aqua',
    waiting: 'bg-signal/15 text-signal',
    go: 'bg-green-500/20 text-green-400',
    result: 'bg-aqua/15 text-aqua',
    early: 'bg-red-500/15 text-red-400',
  }

  const labels = {
    ready: 'Haz clic para empezar',
    waiting: 'Espera el verde...',
    go: '¡CLIC AHORA!',
    result: `${result} ms — Clic para repetir`,
    early: '¡Muy pronto! Clic para reintentar',
  }

  return (
    <button
      onClick={click}
      className={`w-full rounded-xl py-8 text-center text-lg font-bold transition-colors select-none active:scale-[0.98] ${colors[phase]}`}
    >
      {labels[phase]}
    </button>
  )
}

/* ── component ─────────────────────────────────────────── */

export const ReactionTimeLab = () => {
  const [times, setTimes] = useState([])

  const addTime = useCallback((ms) => {
    setTimes((prev) => [...prev, ms])
  }, [])

  const s = useMemo(() => computeStats(times), [times])

  const handleExport = () => {
    if (!s) return
    const rows = [
      ['Intento', 'Tiempo (ms)'],
      ...times.map((t, i) => [i + 1, t]), [],
      ['Estadístico', 'Valor'],
      ['n', s.n], ['Media', format(s.mean)], ['Mediana', format(s.median)],
      ['σ', format(s.sd)], ['s', format(s.sampleSd)],
      ['Mín', s.min], ['Máx', s.max], ['Rango', s.range],
      ['Q1', format(s.q1)], ['Q3', format(s.q3)], ['IQR', format(s.iqr)],
    ]
    downloadCsv(rows, 'tiempo-reaccion.csv')
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
        {/* left */}
        <div className="space-y-4">
          <LabCard title="Prueba de reacción">
            <ReactionTest onResult={addTime} />
            <p className="mt-3 text-xs text-ink/75 text-center">
              Espera a que cambie a verde y haz clic lo más rápido posible.
            </p>
          </LabCard>

          {times.length > 0 && (
            <LabCard title={`Datos recolectados (${times.length} intentos)`}>
              <div className="max-h-[150px] overflow-y-auto space-y-1">
                {times.map((t, i) => (
                  <div key={i} className="flex items-center justify-between rounded bg-ink/5 px-3 py-1 text-sm">
                    <span className="text-ink/75">#{i + 1}</span>
                    <span className="font-mono font-semibold text-ink/70">{t} ms</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setTimes([])}
                className="mt-2 w-full rounded-lg bg-signal/10 py-2 text-xs font-semibold text-signal hover:bg-signal/20"
              >
                Borrar datos
              </button>
            </LabCard>
          )}

          {s && (
            <LabCard title="Estadísticos">
              <div className="grid grid-cols-2 gap-1.5">
                <MetricCard label="n" value={s.n} detail="Intentos" dark={false} />
                <MetricCard label="x̄ (media)" value={`${Math.round(s.mean)} ms`} detail="Promedio" dark={false} />
                <MetricCard label="Mediana" value={`${Math.round(s.median)} ms`} detail="Valor central" dark={false} />
                <MetricCard label="s (muest)" value={`${Math.round(s.sampleSd)} ms`} detail="Desv. muestral" dark={false} />
                <MetricCard label="Rango" value={`${s.range} ms`} detail="Máx − Mín" dark={false} />
                <MetricCard label="IQR" value={`${Math.round(s.iqr)} ms`} detail="Q3 − Q1" dark={false} />
              </div>
            </LabCard>
          )}
        </div>

        {/* right */}
        <div className="space-y-5">
          <LabCard dark title="Diagrama de puntos">
            <DotPlot data={times} mean={s?.mean} />
          </LabCard>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Media" value={s ? `${Math.round(s.mean)} ms` : '—'} detail="Tendencia central" />
            <MetricCard label="Mediana" value={s ? `${Math.round(s.median)} ms` : '—'} detail="Valor central" />
            <MetricCard label="Dispersión" value={s ? `${Math.round(s.sampleSd)} ms` : '—'} detail="Desv. estándar" />
            <MetricCard
              label="Velocidad"
              value={!s ? '—' : s.mean < 250 ? 'Excelente' : s.mean < 350 ? 'Buena' : s.mean < 500 ? 'Normal' : 'Lenta'}
              detail="Clasificación"
            />
          </div>

          {s && (
            <button onClick={handleExport}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink/5 py-3 text-sm font-medium text-ink/75 transition-colors hover:bg-ink/10 hover:text-ink/70">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Exportar datos CSV
            </button>
          )}

          {!s && (
            <div className="flex h-28 items-center justify-center rounded-xl bg-ink/5 text-sm text-ink/75">
              Haz la prueba de reacción para recolectar datos
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

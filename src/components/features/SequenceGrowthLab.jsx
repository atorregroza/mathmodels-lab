import { useState } from 'react'
import { CartesianFrame, LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format } from './derivaLabUtils'

const VIEWS = [
  { id: 'sequence', label: 'Sucesión (aₙ)' },
  { id: 'series', label: 'Serie (Sₙ)' },
]

export const SequenceGrowthLab = () => {
  const [type, setType] = useState('arithmetic')
  const [view, setView] = useState('sequence')
  const [a1, setA1] = useState(2)
  const [d, setD] = useState(3)
  const [r, setR] = useState(1.4)
  const [n, setN] = useState(12)

  // ── terms ────────────────────────────────────────────────────────────────
  const terms = Array.from({ length: n }, (_, i) => {
    const index = i + 1
    const value =
      type === 'arithmetic'
        ? a1 + (index - 1) * d
        : a1 * Math.pow(r, index - 1)
    return { n: index, value }
  })

  const sums = terms.map((_, i) => ({
    n: i + 1,
    value: terms.slice(0, i + 1).reduce((acc, t) => acc + t.value, 0),
  }))

  const displayData = view === 'sequence' ? terms : sums
  const lastTerm = terms[terms.length - 1]?.value ?? 0
  const totalSum = sums[sums.length - 1]?.value ?? 0

  // ── graph scale ──────────────────────────────────────────────────────────
  const allY = displayData.map((p) => p.value)
  const posMax = Math.max(0, ...allY)   // positive extent (>= 0)
  const negMax = -Math.min(0, ...allY)  // negative extent as positive number (>= 0)
  // Pin x-axis at 85% from top: yMin = -yMax * (15/85).
  // Expand downward only when actual negative data requires more room.
  const yMax = posMax * 1.15 || 2
  const yMin = -Math.max(yMax * (15 / 85), negMax * 1.15)

  const xTicks = Array.from({ length: Math.min(n, 12) }, (_, i) =>
    Math.round(1 + (i * (n - 1)) / (Math.min(n, 12) - 1)),
  )
  const yTicks = Array.from({ length: 5 }, (_, i) =>
    yMin + ((yMax - yMin) * i) / 4,
  )

  // ── labels ───────────────────────────────────────────────────────────────
  const termFormula =
    type === 'arithmetic'
      ? `aₙ = ${format(a1)} + (n − 1) · ${format(d)}`
      : `aₙ = ${format(a1)} · ${format(r)}^(n−1)`

  const sumFormula =
    type === 'arithmetic'
      ? `Sₙ = frac(n,2) · (2·${format(a1)} + (n−1)·${format(d)})`
      : Math.abs(r - 1) > 0.01
        ? `Sₙ = ${format(a1)} · frac(r^n − 1, r − 1)`
        : `Sₙ = n · ${format(a1)}`

  const growthLabel =
    type === 'arithmetic'
      ? d > 0
        ? 'Lineal creciente'
        : d < 0
          ? 'Lineal decreciente'
          : 'Constante'
      : r > 1
        ? 'Exponencial creciente'
        : r > 0 && r < 1
          ? 'Exponencial decreciente'
          : r < 0
            ? 'Alternante'
            : 'Constante'

  const convergesTo =
    type === 'geometric' && Math.abs(r) < 1
      ? Math.abs(1 - r) > 0.0001
        ? format(a1 / (1 - r))
        : '∞'
      : null

  // ── csv ──────────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const diffLabel = type === 'arithmetic' ? 'diferencia_d' : 'razon_r'
    const rows = [
      ['n', 'a_n', diffLabel, 'S_n'],
      ...terms.map((t, i) => {
        const prev = terms[i - 1]
        const diff =
          prev != null
            ? type === 'arithmetic'
              ? (t.value - prev.value).toFixed(4)
              : prev.value !== 0
                ? (t.value / prev.value).toFixed(4)
                : '—'
            : '—'
        return [t.n, t.value.toFixed(4), diff, sums[i].value.toFixed(4)]
      }),
    ]
    downloadCsv(rows, `sucesion-${type}-n${n}.csv`)
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── type + view controls ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {['arithmetic', 'geometric'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                type === t
                  ? 'bg-ink text-paper shadow-[0_8px_20px_rgba(18,23,35,0.18)]'
                  : 'border border-ink/12 bg-white text-ink hover:border-ink/24'
              }`}
            >
              {t === 'arithmetic' ? 'Aritmética' : 'Geométrica'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                view === v.id
                  ? 'border border-signal/28 bg-signal/12 text-signal'
                  : 'border border-ink/10 bg-paper text-ink/58 hover:text-ink/80'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── graph + sliders ──────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <LabCard
          dark
          title={
            view === 'sequence'
              ? 'Términos aₙ vs posición n'
              : 'Sumas parciales Sₙ vs n'
          }
        >
          <div className="mt-4">
            <CartesianFrame
              width={580}
              height={300}
              xMin={0.5}
              xMax={n + 0.5}
              yMin={yMin}
              yMax={yMax}
              dark
              xTicks={xTicks}
              yTicks={yTicks.map((v) => Math.round(v * 10) / 10)}
            >
              {({ scaleX, scaleY }) => (
                <>
                  {displayData.map((point, i) => {
                    if (i === 0) return null
                    const prev = displayData[i - 1]
                    return (
                      <line
                        key={`ln-${i}`}
                        x1={scaleX(prev.n)}
                        y1={scaleY(prev.value)}
                        x2={scaleX(point.n)}
                        y2={scaleY(point.value)}
                        stroke="rgba(255,107,53,0.45)"
                        strokeWidth="1.5"
                        strokeDasharray={view === 'series' ? '4 3' : 'none'}
                      />
                    )
                  })}
                  {displayData.map((point) => (
                    <circle
                      key={`dot-${point.n}`}
                      cx={scaleX(point.n)}
                      cy={scaleY(point.value)}
                      r={4.5}
                      fill="#ff6b35"
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth="1.5"
                    />
                  ))}
                </>
              )}
            </CartesianFrame>
          </div>
          <p className="mt-3 text-[0.72rem] leading-5 text-paper/45">
            {view === 'sequence'
              ? 'Cada punto es un término de la sucesión.'
              : 'Cada punto es la suma acumulada hasta ese n.'}
          </p>
        </LabCard>

        <div className="space-y-3">
          <SliderField
            id="a1"
            label="Primer término a₁"
            value={a1}
            min={-10}
            max={20}
            step={0.5}
            onChange={setA1}
          />
          {type === 'arithmetic' ? (
            <SliderField
              id="d"
              label="Diferencia común d"
              value={d}
              min={-6}
              max={10}
              step={0.5}
              onChange={setD}
            />
          ) : (
            <SliderField
              id="r"
              label="Razón común r"
              value={r}
              min={-2}
              max={3}
              step={0.1}
              onChange={setR}
            />
          )}
          <SliderField
            id="n"
            label="Número de términos n"
            value={n}
            min={3}
            max={20}
            step={1}
            natural
            onChange={setN}
          />
        </div>
      </div>

      {/* ── formulas ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <ModelCard
          title="Término general"
          expression={termFormula}
          parameters={
            type === 'arithmetic'
              ? `a₁ = ${format(a1)},  d = ${format(d)}`
              : `a₁ = ${format(a1)},  r = ${format(r)}`
          }
        />
        <ModelCard
          title="Suma parcial Sₙ"
          expression={sumFormula}
          parameters={`Para n = ${n}: Sₙ = ${Math.abs(totalSum) > 1e6 ? totalSum.toExponential(2) : format(totalSum)}`}
        />
      </div>

      {/* ── metrics ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          dark={false}
          label="Tipo de crecimiento"
          value={growthLabel}
          detail="Forma de la gráfica"
        />
        <MetricCard
          dark={false}
          label={`Término a${n}`}
          value={
            Math.abs(lastTerm) > 1e6
              ? lastTerm.toExponential(2)
              : format(lastTerm)
          }
          detail="Último término calculado"
        />
        <MetricCard
          dark={false}
          label={`Suma S${n}`}
          value={
            Math.abs(totalSum) > 1e6
              ? totalSum.toExponential(2)
              : format(totalSum)
          }
          detail="Acumulación total"
        />
        <MetricCard
          dark={false}
          label={
            convergesTo !== null ? 'Converge hacia' : 'Comportamiento Sₙ'
          }
          value={
            convergesTo !== null
              ? convergesTo
              : Math.abs(r) > 1 || type === 'arithmetic'
                ? 'Diverge'
                : '—'
          }
          detail={
            convergesTo !== null
              ? 'Límite de la serie geométrica infinita'
              : 'La suma crece sin límite'
          }
        />
      </div>

      {/* ── table ────────────────────────────────────────────────────────── */}
      <LabCard title="Tabla de términos y sumas parciales">
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="pb-2 text-left text-[0.66rem] uppercase tracking-[0.18em] text-ink/44">n</th>
                <th className="pb-2 text-right text-[0.66rem] uppercase tracking-[0.18em] text-ink/44">aₙ</th>
                <th className="pb-2 text-right text-[0.66rem] uppercase tracking-[0.18em] text-ink/44">
                  {type === 'arithmetic' ? 'Diferencia' : 'Razón'}
                </th>
                <th className="pb-2 text-right text-[0.66rem] uppercase tracking-[0.18em] text-signal/70">Sₙ</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term, i) => {
                const prev = terms[i - 1]
                const diff =
                  prev != null
                    ? type === 'arithmetic'
                      ? term.value - prev.value
                      : prev.value !== 0
                        ? term.value / prev.value
                        : null
                    : null
                const fmtVal = (v) =>
                  Math.abs(v) > 1e6 ? v.toExponential(2) : format(v)
                return (
                  <tr
                    key={term.n}
                    className="border-b border-ink/6 hover:bg-ink/3 transition-colors"
                  >
                    <td className="py-2 font-semibold text-ink/65">{term.n}</td>
                    <td className="py-2 text-right text-ink/80">{fmtVal(term.value)}</td>
                    <td className="py-2 text-right text-ink/50">
                      {diff !== null ? fmtVal(diff) : '—'}
                    </td>
                    <td className="py-2 text-right font-semibold text-signal/85">
                      {fmtVal(sums[i].value)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink hover:border-ink/24 transition-colors"
        >
          Descargar datos CSV
        </button>
      </LabCard>

      {/* ── reading ──────────────────────────────────────────────────────── */}
      <LabCard dark title="Lectura matemática">
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-7 text-paper/80">
            {type === 'arithmetic'
              ? `Con d = ${format(d)}, cada término ${d > 0 ? 'aumenta' : d < 0 ? 'disminuye' : 'se mantiene igual'} en ${format(Math.abs(d))} unidades. La gráfica de aₙ es una línea recta porque el cambio entre términos consecutivos es constante. Esto la relaciona directamente con una función lineal f(n) = a₁ + (n−1)d.`
              : `Con r = ${format(r)}, cada término se ${Math.abs(r) > 1 ? 'amplifica' : 'reduce'} por un factor de ${format(Math.abs(r))}. La gráfica de aₙ tiene forma exponencial, lo que muestra por qué las progresiones geométricas y las funciones exponenciales son la misma idea expresada de forma discreta y continua.`}
          </p>
          <p className="text-sm leading-7 text-paper/80">
            {type === 'arithmetic'
              ? 'La suma Sₙ crece cuadráticamente: si n se duplica, Sₙ crece aproximadamente cuatro veces. Eso ocurre porque al sumar una progresión aritmética, los pares de términos equidistantes (a₁ + aₙ, a₂ + aₙ₋₁…) tienen siempre la misma suma, y hay n/2 pares.'
              : convergesTo !== null
                ? `Con |r| = ${format(Math.abs(r))} < 1, la serie converge: al sumar infinitos términos el resultado se acercaría a a₁/(1−r) = ${convergesTo}. Es el fundamento de las series geométricas infinitas usadas en probabilidad y finanzas.`
                : `Con |r| = ${format(Math.abs(r))} ≥ 1, la serie diverge: Sₙ crece sin límite. Los valores grandes de r hacen que el crecimiento sea dramáticamente más rápido que el de cualquier progresión aritmética.`}
          </p>
        </div>
      </LabCard>
    </div>
  )
}

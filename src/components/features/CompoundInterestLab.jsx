import { useState } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { LiveFormula } from './LiveFormula'
import { downloadCsv, format, generateTicks } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

const VIEWS = [
  { id: 'both', label: 'Ambas curvas' },
  { id: 'compound', label: 'Solo compuesto' },
  { id: 'simple', label: 'Solo simple' },
]

// Round yMax up to a clean multiple for readable tick marks
const niceMax = (raw) => {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = mag >= raw / 2 ? mag / 4 : mag / 2
  return Math.ceil((raw * 1.14) / step) * step
}

export const CompoundInterestLab = () => {
  const [capital, setCapital] = useState(1000)
  const [rate, setRate] = useState(5) // % annual
  const [years, setYears] = useState(10)
  const [view, setView] = useState('both')

  const r = rate / 100

  // ── data ─────────────────────────────────────────────────────────────────
  const data = Array.from({ length: years + 1 }, (_, i) => ({
    n: i,
    simple: capital * (1 + r * i),
    compound: capital * Math.pow(1 + r, i),
  }))

  const simpleFinal = data[years].simple
  const compoundFinal = data[years].compound
  const extraGain = compoundFinal - simpleFinal
  const doublingYears = Math.log(2) / Math.log(1 + r)

  // ── graph scale — yMin = 0 always so x-axis never moves ──────────────────
  const defaultYMax = niceMax(Math.max(simpleFinal, compoundFinal))

  const axis = useAxisRange({
    xMin: -0.5, xMax: years + 0.5,
    yMin: 0, yMax: defaultYMax,
  })

  // ── csv ───────────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const rows = [
      ['n (años)', 'simple', 'compuesto', 'diferencia'],
      ...data.map((d) => [
        d.n,
        d.simple.toFixed(2),
        d.compound.toFixed(2),
        (d.compound - d.simple).toFixed(2),
      ]),
    ]
    downloadCsv(rows, `interes-c0${capital}-r${rate}-t${years}.csv`)
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── view toggle ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              view === v.id
                ? 'bg-ink text-paper shadow-[0_8px_20px_rgba(18,23,35,0.18)]'
                : 'border border-ink/12 bg-white text-ink hover:border-ink/24'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* ── graph + sliders ───────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="xl:sticky xl:top-4 xl:self-start">
          <LabCard dark title="Capital Aₙ vs tiempo n (años)">
            <div className="mt-4">
              <CartesianFrame
                width={580}
                height={300}
                xMin={axis.xMin}
                xMax={axis.xMax}
                yMin={axis.yMin}
                yMax={axis.yMax}
                dark
                xTicks={generateTicks(axis.xMin, axis.xMax)}
                yTicks={generateTicks(axis.yMin, axis.yMax, 5)}
                xTickFormatter={(v) => `${Math.round(v)}a`}
                yTickFormatter={(v) =>
                  v >= 10000 ? `${(v / 1000).toFixed(0)}k` :
                    v >= 1000  ? `${(v / 1000).toFixed(1)}k` :
                      String(Math.round(v))
                }
                xLabel="Años (n)"
                yLabel="Monto ($)"
              >
                {({ scaleX, scaleY }) => (
                  <>
                    {/* simple — línea azul discontinua */}
                    {(view === 'both' || view === 'simple') &&
                      data.map((point, i) => {
                        if (i === 0) return null
                        const prev = data[i - 1]
                        return (
                          <line
                            key={`s-${i}`}
                            x1={scaleX(prev.n)} y1={scaleY(prev.simple)}
                            x2={scaleX(point.n)} y2={scaleY(point.simple)}
                            stroke="rgba(120,180,255,0.80)"
                            strokeWidth="2"
                            strokeDasharray="5 3"
                          />
                        )
                      })}
                    {(view === 'both' || view === 'simple') &&
                      data.map((point) => (
                        <circle
                          key={`sd-${point.n}`}
                          cx={scaleX(point.n)} cy={scaleY(point.simple)}
                          r={3.5}
                          fill="rgba(120,180,255,0.90)"
                          stroke="rgba(255,255,255,0.30)"
                          strokeWidth="1.5"
                        />
                      ))}

                    {/* compuesto — línea naranja sólida */}
                    {(view === 'both' || view === 'compound') &&
                      data.map((point, i) => {
                        if (i === 0) return null
                        const prev = data[i - 1]
                        return (
                          <line
                            key={`c-${i}`}
                            x1={scaleX(prev.n)} y1={scaleY(prev.compound)}
                            x2={scaleX(point.n)} y2={scaleY(point.compound)}
                            stroke="rgba(255,107,53,0.75)"
                            strokeWidth="2.5"
                          />
                        )
                      })}
                    {(view === 'both' || view === 'compound') &&
                      data.map((point) => (
                        <circle
                          key={`cd-${point.n}`}
                          cx={scaleX(point.n)} cy={scaleY(point.compound)}
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
            <AxisRangePanel {...axis} />

            <div className="mt-3 space-y-2">
              {(view === 'both' || view === 'compound') && (
                <LiveFormula
                  label="Compuesto evaluado"
                  general={String.raw`A_n = C_0 \cdot (1 + r)^{n}`}
                  evaluated={`A_{${years}} = ${format(capital)} \\cdot (1 + ${format(r)})^{${years}} = ${format(compoundFinal)}`}
                  raw
                />
              )}
              {(view === 'both' || view === 'simple') && (
                <LiveFormula
                  label="Simple evaluado"
                  general={String.raw`A_n = C_0 \cdot (1 + r \cdot n)`}
                  evaluated={`A_{${years}} = ${format(capital)} \\cdot (1 + ${format(r)} \\cdot ${years}) = ${format(simpleFinal)}`}
                  raw
                />
              )}
            </div>

            {/* leyenda — solo muestra las curvas activas */}
            <div className="mt-3 flex flex-wrap gap-5">
              {(view === 'both' || view === 'compound') && (
                <span className="flex items-center gap-2 text-[0.7rem] text-paper/80">
                  <svg width="24" height="10" aria-hidden="true">
                    <line x1="0" y1="5" x2="24" y2="5" stroke="#ff6b35" strokeWidth="2.5" />
                  </svg>
                  Interés compuesto — crecimiento exponencial
                </span>
              )}
              {(view === 'both' || view === 'simple') && (
                <span className="flex items-center gap-2 text-[0.7rem] text-paper/80">
                  <svg width="24" height="10" aria-hidden="true">
                    <line x1="0" y1="5" x2="24" y2="5" stroke="rgba(120,180,255,0.85)" strokeWidth="2" strokeDasharray="5 3" />
                  </svg>
                  Interés simple — crecimiento lineal
                </span>
              )}
            </div>
          </LabCard>
        </div>

        <div className="space-y-3">
          <SliderField
            id="capital"
            label="Capital inicial C₀"
            value={capital}
            min={100}
            max={10000}
            step={100}
            suffix=" $"
            onChange={setCapital}
          />
          <SliderField
            id="rate"
            label="Tasa anual r"
            value={rate}
            min={1}
            max={30}
            step={0.5}
            suffix=" %"
            onChange={setRate}
          />
          <SliderField
            id="years"
            label="Tiempo n"
            value={years}
            min={1}
            max={30}
            step={1}
            natural
            suffix=" años"
            onChange={setYears}
          />
        </div>
      </div>

      {/* ── formulas ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <ModelCard
          title="Interés simple — función lineal"
          expression={`Aₙ = ${format(capital)} · (1 + ${format(r)} · n)`}
          parameters={`C₀ = ${format(capital)},  r = ${format(r)},  n = ${years} años`}
        />
        <ModelCard
          title="Interés compuesto — sucesión geométrica"
          expression={`Aₙ = ${format(capital)} · (1 + ${format(r)})ⁿ`}
          parameters={`C₀ = ${format(capital)},  razón = ${format(1 + r)},  Aₙ = ${format(compoundFinal)} $`}
        />
      </div>

      {/* ── métricas ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          dark={false}
          label={`Capital simple (n = ${years})`}
          value={`$ ${format(simpleFinal)}`}
          detail="Crecimiento lineal constante"
        />
        <MetricCard
          dark={false}
          label={`Capital compuesto (n = ${years})`}
          value={`$ ${format(compoundFinal)}`}
          detail="Crecimiento exponencial acumulado"
        />
        <MetricCard
          dark={false}
          label="Ventaja del compuesto"
          value={`$ ${format(extraGain)}`}
          detail={`Diferencia a favor del compuesto en n = ${years}`}
        />
        <MetricCard
          dark={false}
          label="Tiempo de duplicación"
          value={`${doublingYears.toFixed(1)} años`}
          detail={`Regla del 72: ≈ ${Math.round(72 / rate)} años`}
        />
      </div>

      {/* ── tabla comparativa ─────────────────────────────────────────────── */}
      <LabCard title="Tabla comparativa año a año">
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="pb-2 text-left text-xs uppercase tracking-[0.18em] text-ink/75">n (años)</th>
                <th className="pb-2 text-right text-xs uppercase tracking-[0.18em] text-ink/75">Simple Aₙ</th>
                <th className="pb-2 text-right text-xs uppercase tracking-[0.18em] text-signal/70">Compuesto Aₙ</th>
                <th className="pb-2 text-right text-xs uppercase tracking-[0.18em] text-ink/75">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.n} className="border-b border-ink/6 transition-colors hover:bg-ink/3">
                  <td className="py-2 font-semibold text-ink/65">{row.n}</td>
                  <td className="py-2 text-right text-ink/70">$ {format(row.simple)}</td>
                  <td className="py-2 text-right font-semibold text-signal/85">$ {format(row.compound)}</td>
                  <td className="py-2 text-right text-ink/75">
                    {row.n === 0 ? '—' : `+$ ${format(row.compound - row.simple)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink/24"
        >
          Descargar datos CSV
        </button>
      </LabCard>

      {/* ── lectura matemática ────────────────────────────────────────────── */}
      <LabCard dark title="Lectura matemática">
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-7 text-paper/80">
            El interés simple crece como una <strong className="text-paper">progresión aritmética</strong>: cada año se agrega
            la misma cantidad fija C₀ · r = $ {format(capital * r)}. La gráfica de Aₙ es una recta porque la diferencia
            entre términos consecutivos es constante. Esto conecta directamente con funciones lineales: f(n) = C₀ + C₀·r·n.
          </p>
          <p className="text-sm leading-7 text-paper/80">
            El interés compuesto crece como una <strong className="text-paper">progresión geométrica</strong>: cada año el
            capital se multiplica por el mismo factor (1 + r) = {format(1 + r)}.
            La estructura Aₙ = C₀ · (1 + r)ⁿ es idéntica a aₙ = a₁ · rⁿ⁻¹ con a₁ = C₀ y razón
            (1 + r). La diferencia entre ambas curvas al año {years} — $ {format(extraGain)} — muestra
            el efecto exponencial que se acelera con el tiempo.
          </p>
          <p className="text-sm leading-7 text-paper/80">
            El tiempo exacto para duplicar el capital es ln(2) / ln(1 + r) ≈ {doublingYears.toFixed(2)} años.
            La <strong className="text-paper">Regla del 72</strong> aproxima esto como 72 / r% ≈ {Math.round(72 / rate)} años — un atajo
            mental poderoso en finanzas personales, inversión y demografía que aparece en el programa IB
            en contextos de crecimiento exponencial.
          </p>
        </div>
      </LabCard>
    </div>
  )
}

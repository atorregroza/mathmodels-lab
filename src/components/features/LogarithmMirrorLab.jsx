import { useState } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { LiveFormula } from './LiveFormula'
import { downloadCsv, format, generateTicks } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

// Square axis range so y = x appears exactly at 45°
const AX_MIN = -0.4
const AX_MAX = 5.4

// Build SVG path string from {x,y} points
const toPath = (pts, scaleX, scaleY) =>
  pts.length === 0
    ? ''
    : pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(1)} ${scaleY(p.y).toFixed(1)}`)
      .join(' ')

// Show "e" if base is close enough to Math.E
const baseLabel = (a) => (Math.abs(a - Math.E) < 0.06 ? 'e' : format(a))

// Unicode superscript digits for exponents
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n) => String(Math.abs(n)).split('').map((d) => SUP[+d]).join('')

export const LogarithmMirrorLab = () => {
  const [base, setBase] = useState(2)
  const [traceX, setTraceX] = useState(1)
  const [showTrace, setShowTrace] = useState(true)
  const [showMirror, setShowMirror] = useState(true)

  const a = base
  const lna = Math.log(a)
  const bl = baseLabel(a) // display label for the base

  const axis = useAxisRange({ xMin: AX_MIN, xMax: AX_MAX, yMin: AX_MIN, yMax: AX_MAX })

  // ── curves ───────────────────────────────────────────────────────────────
  const expPoints = []
  for (let i = 0; i <= 400; i++) {
    const x = axis.xMin + ((i / 400) * (axis.xMax - axis.xMin))
    const y = Math.pow(a, x)
    if (y >= axis.yMin && y <= axis.yMax) expPoints.push({ x, y })
  }

  const logPoints = []
  for (let i = 1; i <= 400; i++) {
    const x = 0.008 + ((i / 400) * (axis.xMax - 0.008))
    const y = Math.log(x) / lna
    if (y >= axis.yMin && y <= axis.yMax) logPoints.push({ x, y })
  }

  // ── trace ─────────────────────────────────────────────────────────────────
  const traceY = Math.pow(a, traceX)                       // f(traceX)
  const traceOnScreen = traceY >= axis.yMin && traceY <= axis.yMax
  const mirrorOnScreen = traceY >= 0.01 && traceY <= axis.xMax  // mirror point exists?

  const xTicks = generateTicks(axis.xMin, axis.xMax)
  const yTicks = generateTicks(axis.yMin, axis.yMax)

  // ── csv ──────────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const rows = [
      ['exponente', `${bl}^exp`, `log_${bl}(valor)`],
      ...[0, 1, 2, 3].map((exp) => {
        const val = a ** exp
        return [exp, val.toFixed(4), exp]
      }),
      ['', '', ''],
      ['x₀', `f(x₀) = ${bl}^x₀`, `g(f(x₀)) = log_${bl}(f(x₀))`],
      [format(traceX), traceY.toFixed(4), format(traceX)],
    ]
    downloadCsv(rows, `logaritmo-espejo-base${format(a)}.csv`)
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── toggles ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: 'Trazar punto', state: showTrace, toggle: () => setShowTrace((v) => !v) },
          { label: 'Mostrar espejo y = x', state: showMirror, toggle: () => setShowMirror((v) => !v) },
        ].map(({ label, state, toggle }) => (
          <button
            key={label}
            type="button"
            onClick={toggle}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              state
                ? 'bg-ink text-paper shadow-[0_8px_20px_rgba(18,23,35,0.18)]'
                : 'border border-ink/12 bg-white text-ink hover:border-ink/24'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setBase(Number(Math.E.toFixed(1)))}
          className="ml-auto rounded-full border border-ink/12 bg-paper px-4 py-2.5 text-sm font-semibold text-ink hover:border-ink/24 transition-colors"
        >
          Base e ≈ 2.7
        </button>
      </div>

      {/* ── graph + sliders ───────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_0.72fr]">
        <LabCard dark title={`${bl}ˣ y log${bl}(x) — reflexión en y = x`} className="xl:sticky xl:top-4 xl:self-start">
          <div className="mt-4">
            {/* Square SVG (500×500) = equal x/y scale → y=x is truly 45° */}
            <CartesianFrame
              width={500}
              height={500}
              xMin={axis.xMin}
              xMax={axis.xMax}
              yMin={axis.yMin}
              yMax={axis.yMax}
              dark
              xTicks={xTicks}
              yTicks={yTicks}
              xLabel="x"
              yLabel="f(x)"
            >
              {({ scaleX, scaleY }) => (
                <>
                  {/* espejo y = x */}
                  {showMirror && (
                    <line
                      x1={scaleX(axis.xMin)} y1={scaleY(axis.xMin)}
                      x2={scaleX(axis.xMax)} y2={scaleY(axis.xMax)}
                      stroke="rgba(255,255,255,0.20)"
                      strokeWidth="1.5"
                      strokeDasharray="7 4"
                    />
                  )}

                  {/* logaritmo — azul */}
                  <path
                    d={toPath(logPoints, scaleX, scaleY)}
                    fill="none"
                    stroke="rgba(120,180,255,0.88)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* exponencial — naranja (encima para visibilidad) */}
                  <path
                    d={toPath(expPoints, scaleX, scaleY)}
                    fill="none"
                    stroke="rgba(255,107,53,0.88)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* ── trace ─────────────────────────────────────────────── */}
                  {showTrace && traceOnScreen && (
                    <>
                      {/* segmento que une los dos puntos espejo */}
                      {mirrorOnScreen && (
                        <line
                          x1={scaleX(traceX)} y1={scaleY(traceY)}
                          x2={scaleX(traceY)} y2={scaleY(traceX)}
                          stroke="rgba(255,255,255,0.25)"
                          strokeWidth="1.2"
                          strokeDasharray="4 3"
                        />
                      )}

                      {/* punto en f(x) = aˣ */}
                      <circle
                        cx={scaleX(traceX)} cy={scaleY(traceY)}
                        r={6}
                        fill="#ff6b35"
                        stroke="rgba(255,255,255,0.90)"
                        strokeWidth="2"
                      />
                      <text
                        x={scaleX(traceX) + 10}
                        y={scaleY(traceY) - 8}
                        fill="rgba(255,130,80,0.95)"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="monospace"
                      >
                        ({format(traceX)}, {format(traceY)})
                      </text>

                      {/* punto espejo en g(x) = logₐ(x) */}
                      {mirrorOnScreen && (
                        <>
                          <circle
                            cx={scaleX(traceY)} cy={scaleY(traceX)}
                            r={6}
                            fill="rgba(120,180,255,0.95)"
                            stroke="rgba(255,255,255,0.90)"
                            strokeWidth="2"
                          />
                          <text
                            x={scaleX(traceY) + 10}
                            y={scaleY(traceX) + 16}
                            fill="rgba(150,200,255,0.95)"
                            fontSize="11"
                            fontWeight="700"
                            fontFamily="monospace"
                          >
                            ({format(traceY)}, {format(traceX)})
                          </text>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </CartesianFrame>
          </div>

          <AxisRangePanel {...axis} />

          <div className="mt-3">
            <LiveFormula
              label="Par conjugado evaluado"
              general={String.raw`f(x) = a^{x} \quad\Longleftrightarrow\quad g(x) = \log_{a}(x)`}
              evaluated={`f(x) = ${bl === 'e' ? 'e' : bl}^{x} \\quad\\Longleftrightarrow\\quad g(x) = \\log_{${bl}}(x)`}
              raw
            />
          </div>

          {/* leyenda */}
          <div className="mt-3 flex flex-wrap gap-5">
            {[
              { color: '#ff6b35', dash: false, label: `f(x) = ${bl}ˣ — exponencial` },
              { color: 'rgba(120,180,255,0.9)', dash: false, label: `g(x) = log${bl}(x) — logaritmo` },
              ...(showMirror
                ? [{ color: 'rgba(255,255,255,0.30)', dash: true, label: 'y = x — eje de simetría' }]
                : []),
            ].map(({ color, dash, label }) => (
              <span key={label} className="flex items-center gap-2 text-[0.7rem] text-paper/80">
                <svg width="24" height="10" aria-hidden="true">
                  <line
                    x1="0" y1="5" x2="24" y2="5"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeDasharray={dash ? '6 4' : 'none'}
                  />
                </svg>
                {label}
              </span>
            ))}
          </div>
        </LabCard>

        <div className="space-y-3">
          <SliderField
            id="base"
            label="Base a"
            value={base}
            min={1.2}
            max={8}
            step={0.1}
            onChange={setBase}
          />
          {showTrace && (
            <SliderField
              id="traceX"
              label="Punto x₀"
              value={traceX}
              min={0}
              max={4}
              step={0.1}
              onChange={setTraceX}
            />
          )}

          {/* tabla de valores clave */}
          <div className="rounded-[1.3rem] border border-ink/10 bg-white/82 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-ink/75">
              Valores clave — base {bl}
            </p>

            {/* encabezados */}
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 border-b border-ink/8 pb-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6b35]/70">
                Exponencial
              </span>
              <span />
              <span className="text-right text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(120,180,255,0.8)]">
                Logaritmo
              </span>
            </div>

            {/* filas */}
            <div className="mt-2 space-y-3">
              {[0, 1, 2, 3].map((exp) => {
                const val = a ** exp
                return (
                  <div
                    key={exp}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3"
                  >
                    <span className="font-mono text-sm text-ink/80">
                      {bl}{sup(exp)} = {format(val)}
                    </span>
                    <span className="text-[0.8rem] text-ink/70">⟷</span>
                    <span className="text-right font-mono text-sm text-ink/80">
                      logₐ({format(val)}) = {exp}
                    </span>
                  </div>
                )
              })}
            </div>

            <p className="mt-4 text-xs leading-5 text-ink/75">
              logₐ(x) = y  ⟺  aʸ = x
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink hover:border-ink/24 transition-colors"
          >
            Descargar datos CSV
          </button>
        </div>
      </div>

      {/* ── fórmulas ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <ModelCard
          title="Exponencial — función directa"
          expression={`f(x) = ${bl}ˣ`}
          parameters={`Base a = ${format(a)},  f(0) = 1,  f(1) = ${format(a)}`}
          conditions="Dominio: ℝ  →  Rango: (0, +∞)"
        />
        <ModelCard
          title="Logaritmo — función inversa"
          expression={`g(x) = log${bl}(x)`}
          parameters={`log${bl}(1) = 0,  log${bl}(${format(a)}) = 1`}
          conditions="Dominio: (0, +∞)  →  Rango: ℝ"
        />
      </div>

      {/* ── métricas ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          dark={false}
          label="Base a"
          value={bl}
          detail="a > 0, a ≠ 1"
        />
        <MetricCard
          dark={false}
          label={`f(${format(traceX)}) = ${bl}^x₀`}
          value={traceOnScreen ? format(traceY) : 'fuera de vista'}
          detail={`Punto (${format(traceX)}, ${format(traceY)}) en la exponencial`}
        />
        <MetricCard
          dark={false}
          label={`g(${format(traceY)}) = log${bl}(x)`}
          value={mirrorOnScreen ? format(traceX) : '—'}
          detail={`Punto espejo (${format(traceY)}, ${format(traceX)}) en el logaritmo`}
        />
        <MetricCard
          dark={false}
          label="Verificación"
          value={`log${bl}(${bl}ˣ) = x`}
          detail={`log${bl}(${format(traceY)}) = ${format(traceX)} ✓`}
        />
      </div>

      {/* ── lectura matemática ────────────────────────────────────────────── */}
      <LabCard dark title="Lectura matemática">
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-7 text-paper/80">
            Toda función con inversa tiene un <strong className="text-paper">espejo en y = x</strong>.
            Si ({format(traceX)}, {format(traceY)}) pertenece a f(x) = {bl}ˣ, entonces
            ({format(traceY)}, {format(traceX)}) pertenece a g(x) = log{bl}(x). Las coordenadas
            se intercambian porque la inversa deshace exactamente lo que la función hace.
          </p>
          <p className="text-sm leading-7 text-paper/80">
            El logaritmo responde la pregunta que la exponencial no puede contestar directamente:{' '}
            <strong className="text-paper">¿a qué potencia hay que elevar {bl} para obtener x?</strong>{' '}
            La equivalencia log{bl}(x) = y ⟺ {bl}ʸ = x es el núcleo de toda manipulación
            logarítmica en el programa IB. Moviéndote entre ambas formas puedes despejar
            potencias, bases y exponentes en ecuaciones exponenciales.
          </p>
          <p className="text-sm leading-7 text-paper/80">
            Nota que dominio y rango se intercambian: f acepta ℝ y produce (0, +∞);
            g acepta (0, +∞) y produce ℝ. Por eso log{bl}(0) y log{bl}(x) con x &lt; 0{' '}
            <strong className="text-paper">no existen</strong> — el logaritmo solo puede
            devolver valores del rango de la exponencial, que nunca toca el cero ni los negativos.
          </p>
        </div>
      </LabCard>
    </div>
  )
}

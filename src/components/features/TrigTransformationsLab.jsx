import { useMemo, useState, useCallback } from 'react'
import { CartesianFrame, LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, linePath, sampleRange } from './derivaLabUtils'

const PI = Math.PI
const xTicks = [-2 * PI, (-3 * PI) / 2, -PI, -PI / 2, 0, PI / 2, PI, (3 * PI) / 2, 2 * PI]
const yTicks = [-4, -2, 0, 2, 4]

const formatPiTick = (value) => {
  const ratio = value / PI
  const rounded = Math.round(ratio * 2) / 2
  if (Math.abs(rounded) < 0.001) return '0'
  if (Math.abs(rounded - 1) < 0.001) return '\u03c0'
  if (Math.abs(rounded + 1) < 0.001) return '-\u03c0'
  if (Math.abs(rounded - 0.5) < 0.001) return '\u03c0/2'
  if (Math.abs(rounded + 0.5) < 0.001) return '-\u03c0/2'
  if (Math.abs(rounded - 1.5) < 0.001) return '3\u03c0/2'
  if (Math.abs(rounded + 1.5) < 0.001) return '-3\u03c0/2'
  if (Math.abs(rounded - 2) < 0.001) return '2\u03c0'
  if (Math.abs(rounded + 2) < 0.001) return '-2\u03c0'
  return `${format(rounded)}\u03c0`
}

const buildTangentSegments = (a, b, h, k) => {
  const xMin = -2 * PI
  const xMax = 2 * PI
  const asymptotes = []
  for (let n = -6; n <= 6; n += 1) {
    const asymptote = h + ((PI / 2) + (n * PI)) / b
    if (asymptote > xMin - 1 && asymptote < xMax + 1) asymptotes.push(asymptote)
  }
  const inner = asymptotes.filter((v) => v > xMin && v < xMax).sort((a, b) => a - b)
  const boundaries = [xMin, ...inner, xMax]
  const segments = []
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i]
    const end = boundaries[i + 1]
    const padStart = i === 0 ? start : start + 0.04
    const padEnd = i === boundaries.length - 2 ? end : end - 0.04
    if (padEnd > padStart) {
      segments.push(sampleRange(padStart, padEnd, 120, (x) => {
        const y = (a * Math.tan(b * (x - h))) + k
        return Math.abs(y) > 20 ? Number.NaN : y
      }))
    }
  }
  return { asymptotes: inner, segments }
}

const families = [
  { id: 'sin', label: 'Seno', symbol: 'sen', fn: Math.sin, periodBase: 2 * PI },
  { id: 'cos', label: 'Coseno', symbol: 'cos', fn: Math.cos, periodBase: 2 * PI },
  { id: 'tan', label: 'Tangente', symbol: 'tan', fn: Math.tan, periodBase: PI },
]

export const TrigTransformationsLab = () => {
  const [baseId, setBaseId] = useState('sin')
  const [a, setA] = useState(2)
  const [b, setB] = useState(1)
  const [h, setH] = useState(0)
  const [k, setK] = useState(0)
  const [showBase, setShowBase] = useState(true)
  const [mode, setMode] = useState('explore')
  const [challenge, setChallenge] = useState(null)
  const [guess, setGuess] = useState({ a: 1, b: 1, h: 0, k: 0 })
  const [score, setScore] = useState(null)

  const family = families.find((f) => f.id === baseId) || families[0]
  const effectiveB = Math.abs(b)
  const period = family.periodBase / effectiveB

  const baseCurve = useMemo(() => {
    if (family.id === 'tan') return buildTangentSegments(1, 1, 0, 0)
    return { segments: [sampleRange(-2 * PI, 2 * PI, 320, family.fn)], asymptotes: [] }
  }, [family])

  const transformedCurve = useMemo(() => {
    if (family.id === 'tan') return buildTangentSegments(a, b, h, k)
    return {
      segments: [sampleRange(-2 * PI, 2 * PI, 320, (x) => a * family.fn(b * (x - h)) + k)],
      asymptotes: [],
    }
  }, [a, b, family, h, k])

  const challengeCurve = useMemo(() => {
    if (!challenge) return null
    const cf = families.find((f) => f.id === challenge.baseId) || families[0]
    if (cf.id === 'tan') return buildTangentSegments(challenge.a, challenge.b, challenge.h, challenge.k)
    return {
      segments: [sampleRange(-2 * PI, 2 * PI, 320, (x) => challenge.a * cf.fn(challenge.b * (x - challenge.h)) + challenge.k)],
      asymptotes: [],
    }
  }, [challenge])

  const guessCurve = useMemo(() => {
    if (!challenge) return null
    const cf = families.find((f) => f.id === challenge.baseId) || families[0]
    if (cf.id === 'tan') return buildTangentSegments(guess.a, guess.b, guess.h, guess.k)
    return {
      segments: [sampleRange(-2 * PI, 2 * PI, 320, (x) => guess.a * cf.fn(guess.b * (x - guess.h)) + guess.k)],
      asymptotes: [],
    }
  }, [challenge, guess])

  const generateChallenge = useCallback(() => {
    const funcs = ['sin', 'cos']
    const baseId = funcs[Math.floor(Math.random() * funcs.length)]
    const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)]
    const aVal = pickFrom([0.5, 1, 1.5, 2, 2.5, 3]) * (Math.random() > 0.5 ? 1 : -1)
    const bVal = pickFrom([0.5, 1, 1.5, 2])
    const hVal = pickFrom([-PI / 2, -PI / 4, 0, PI / 4, PI / 2])
    const kVal = pickFrom([-2, -1, 0, 1, 2])
    setChallenge({ baseId, a: aVal, b: bVal, h: hVal, k: kVal })
    setGuess({ a: 1, b: 1, h: 0, k: 0 })
    setScore(null)
  }, [])

  const checkAnswer = useCallback(() => {
    if (!challenge) return
    const error = Math.abs(guess.a - challenge.a) + Math.abs(guess.b - challenge.b) +
      Math.abs(guess.h - challenge.h) + Math.abs(guess.k - challenge.k)
    setScore(Math.max(0, Math.round(100 * Math.exp(-error * 0.8))))
  }, [challenge, guess])

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.76fr_1.24fr]">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          <LabCard title="Transformaciones trigonometricas" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">
              Base vs. transformada
            </h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              Compara la funci&oacute;n base con su versi&oacute;n transformada usando la notaci&oacute;n est&aacute;ndar: y&nbsp;=&nbsp;a&middot;f(b(x&nbsp;-&nbsp;h))&nbsp;+&nbsp;k.
            </p>
          </LabCard>

          <LabCard title="Modo">
            <div className="mt-2 grid grid-cols-2 gap-3">
              {[{ id: 'explore', label: 'Explorar' }, { id: 'challenge', label: 'Desaf\u00edo' }].map((m) => (
                <button key={m.id} type="button"
                  onClick={() => { setMode(m.id); if (m.id === 'challenge' && !challenge) generateChallenge() }}
                  className={`rounded-[1.2rem] border px-4 py-3 text-sm font-semibold transition-colors ${
                    mode === m.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper text-ink hover:border-ink/30'
                  }`}
                >{m.label}</button>
              ))}
            </div>
          </LabCard>

          {mode === 'explore' && (
            <>
              <LabCard title="Funci\u00f3n base">
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {families.map((f) => (
                    <button key={f.id} type="button"
                      onClick={() => { setBaseId(f.id); setA(f.id === 'tan' ? 0.9 : 2); setB(1); setH(0); setK(0) }}
                      className={`rounded-[1.2rem] border px-4 py-3 text-sm font-semibold transition-colors ${
                        baseId === f.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper text-ink hover:border-ink/30'
                      }`}
                    >{f.label}</button>
                  ))}
                </div>
              </LabCard>

              <SliderField id="tt-a" label="Amplitud a" value={a} min={-3} max={3} step={0.1} onChange={setA} />
              <SliderField id="tt-b" label="Factor horizontal b" value={b} min={0.5} max={4} step={0.05} onChange={setB} />
              <SliderField id="tt-h" label="Fase h" value={h} min={-PI} max={PI} step={0.05} onChange={setH} />
              <SliderField id="tt-k" label="Traslaci\u00f3n vertical k" value={k} min={-3} max={3} step={0.1} onChange={setK} />

              <div className="flex gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-[1.2rem] border border-ink/10 bg-white/82 px-4 py-3 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={showBase} onChange={(e) => setShowBase(e.target.checked)} className="accent-[#54d6c9]" />
                  Mostrar curva base
                </label>
              </div>
            </>
          )}

          {mode === 'challenge' && challenge && (
            <>
              <LabCard title="Identifica los par\u00e1metros">
                <p className="mt-2 text-sm leading-6 text-ink/68">
                  La curva naranja es una transformaci&oacute;n de <span className="font-semibold">{families.find((f) => f.id === challenge.baseId)?.label || 'Seno'}</span>.
                  Ajusta los deslizadores hasta que tu curva blanca coincida.
                </p>
              </LabCard>

              <SliderField id="ch-a" label="Tu a" value={guess.a} min={-3} max={3} step={0.1}
                onChange={(v) => { setGuess((p) => ({ ...p, a: v })); setScore(null) }} />
              <SliderField id="ch-b" label="Tu b" value={guess.b} min={0.5} max={4} step={0.05}
                onChange={(v) => { setGuess((p) => ({ ...p, b: v })); setScore(null) }} />
              <SliderField id="ch-h" label="Tu h" value={guess.h} min={-PI} max={PI} step={0.05}
                onChange={(v) => { setGuess((p) => ({ ...p, h: v })); setScore(null) }} />
              <SliderField id="ch-k" label="Tu k" value={guess.k} min={-3} max={3} step={0.1}
                onChange={(v) => { setGuess((p) => ({ ...p, k: v })); setScore(null) }} />

              <div className="flex gap-3">
                <button type="button" onClick={checkAnswer}
                  className="rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white">
                  Verificar
                </button>
                <button type="button" onClick={generateChallenge}
                  className="rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink">
                  Nuevo desaf&iacute;o
                </button>
              </div>

              {score !== null && (
                <LabCard title="Resultado">
                  <div className="mt-2 flex items-center gap-3">
                    <span className={`inline-block h-4 w-4 rounded-full ${score >= 85 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} />
                    <span className="font-display text-3xl font-semibold">{score}/100</span>
                  </div>
                  <p className="mt-2 text-sm text-ink/68">
                    {score >= 85 ? 'Excelente \u2014 casi perfecto.' : score >= 50 ? 'Buen intento \u2014 revisa los par\u00e1metros.' : 'Sigue practicando \u2014 observa amplitud y periodo primero.'}
                  </p>
                  {score < 100 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <p><span className="font-semibold">a real:</span> {format(challenge.a)}</p>
                      <p><span className="font-semibold">b real:</span> {format(challenge.b)}</p>
                      <p><span className="font-semibold">h real:</span> {format(challenge.h)}</p>
                      <p><span className="font-semibold">k real:</span> {format(challenge.k)}</p>
                    </div>
                  )}
                </LabCard>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
            <div className="max-w-3xl">
              <p className="text-[0.65rem] uppercase tracking-[0.28em] text-paper/45">Lectura gr&aacute;fica</p>
              <h3 className="mt-3 font-display text-[clamp(2rem,3.6vw,3.2rem)] leading-[0.98] tracking-[-0.04em]">
                {mode === 'explore' ? 'Exploraci\u00f3n libre' : 'Modo desaf\u00edo'}
              </h3>
              <p className="mt-3 text-sm leading-6 text-paper/72">
                {mode === 'explore'
                  ? 'La curva base aparece en verde azulado y la transformada en naranja. Observa c\u00f3mo cada par\u00e1metro modifica la gr\u00e1fica.'
                  : 'Ajusta los par\u00e1metros hasta que tu curva (blanca) coincida con la curva objetivo (naranja).'
                }
              </p>
            </div>
            <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-white/6 p-4">
              <CartesianFrame
                xMin={-2 * PI} xMax={2 * PI} yMin={-5} yMax={5}
                xTicks={xTicks} yTicks={yTicks}
                xTickFormatter={formatPiTick}
                className="w-full h-auto aspect-[16/9] overflow-hidden rounded-[1.1rem]"
              >
                {({ scaleX, scaleY, padding, width, height }) => (
                  <>
                    {mode === 'explore' && (
                      <>
                        <line x1={padding} y1={scaleY(k)} x2={width - padding} y2={scaleY(k)}
                          stroke="rgba(84,214,201,0.6)" strokeWidth="1.4" strokeDasharray="6 6" />

                        {showBase && baseCurve.segments.map((seg, i) => (
                          <path key={`base-${i}`} d={linePath(seg, scaleX, scaleY)} fill="none"
                            stroke="rgba(84,214,201,0.85)" strokeWidth="2.5" strokeLinecap="round" />
                        ))}

                        {showBase && baseCurve.asymptotes.map((v) => (
                          <line key={`ba-${v}`} x1={scaleX(v)} y1={padding} x2={scaleX(v)} y2={height - padding}
                            stroke="rgba(84,214,201,0.5)" strokeWidth="1" strokeDasharray="4 4" />
                        ))}

                        {transformedCurve.asymptotes.map((v) => (
                          <line key={`ta-${v}`} x1={scaleX(v)} y1={padding} x2={scaleX(v)} y2={height - padding}
                            stroke="rgba(255,107,53,0.6)" strokeWidth="1.2" strokeDasharray="6 6" />
                        ))}

                        {transformedCurve.segments.map((seg, i) => (
                          <path key={`trans-${i}`} d={linePath(seg, scaleX, scaleY)} fill="none"
                            stroke="rgba(255,107,53,0.98)" strokeWidth="4" strokeLinecap="round" />
                        ))}
                      </>
                    )}

                    {mode === 'challenge' && challengeCurve && guessCurve && (
                      <>
                        {challengeCurve.segments.map((seg, i) => (
                          <path key={`target-${i}`} d={linePath(seg, scaleX, scaleY)} fill="none"
                            stroke="rgba(255,107,53,0.98)" strokeWidth="4" strokeLinecap="round" />
                        ))}
                        {challengeCurve.asymptotes.map((v) => (
                          <line key={`ca-${v}`} x1={scaleX(v)} y1={padding} x2={scaleX(v)} y2={height - padding}
                            stroke="rgba(255,107,53,0.5)" strokeWidth="1.2" strokeDasharray="6 6" />
                        ))}

                        {guessCurve.segments.map((seg, i) => (
                          <path key={`guess-${i}`} d={linePath(seg, scaleX, scaleY)} fill="none"
                            stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeLinecap="round" />
                        ))}
                      </>
                    )}
                  </>
                )}
              </CartesianFrame>
            </div>
          </LabCard>

          {mode === 'explore' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard label="Amplitud |a|" value={format(Math.abs(a))}
                  detail={family.id === 'tan' ? 'Escala vertical de cada rama' : 'Distancia de la l\u00ednea media al extremo'} dark={false} />
                <MetricCard label="Per\u00edodo" value={`${format(period)} rad`}
                  detail={family.id === 'tan' ? 'Distancia entre ramas equivalentes' : 'Distancia horizontal de repetici\u00f3n'} dark={false} />
                <MetricCard label="Fase h" value={`${format(h)} rad`}
                  detail="Desplazamiento horizontal del patr\u00f3n" dark={false} />
                <MetricCard label="L\u00ednea media" value={`y = ${format(k)}`}
                  detail="Referencia vertical de la oscilaci\u00f3n" dark={false} />
                <MetricCard label="Rango"
                  value={family.id === 'tan' ? '\u211d' : `[${format(k - Math.abs(a))}, ${format(k + Math.abs(a))}]`}
                  detail={family.id === 'tan' ? 'La tangente no tiene cota' : 'Intervalo de valores de la funci\u00f3n'} dark={false} />
                <MetricCard label="Dominio"
                  value={family.id === 'tan' ? '\u211d \\ as\u00edntotas' : '\u211d'}
                  detail={family.id === 'tan' ? 'Excluye las as\u00edntotas verticales' : 'Definida en todos los reales'} dark={false} />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ModelCard title="Funci\u00f3n base" expression={`f(x) = ${family.symbol}(x)`} />
                <ModelCard title="Modelo actual"
                  expression={`g(x) = ${format(a)}\u00b7${family.symbol}(${format(b)}(x ${h >= 0 ? '-' : '+'} ${format(Math.abs(h))})) ${k >= 0 ? '+' : '-'} ${format(Math.abs(k))}`} />
              </div>

              <LabCard title="Descarga">
                <p className="text-sm leading-6 text-ink/68">Exporta una muestra de ambas curvas para seguir el an&aacute;lisis.</p>
                <button type="button"
                  onClick={() => {
                    const rows = [['x (rad)', 'f(x) base', 'g(x) transformada']]
                    for (let i = 0; i <= 24; i++) {
                      const x = -2 * PI + (4 * PI * i / 24)
                      const base = family.fn(x)
                      const trans = a * family.fn(b * (x - h)) + k
                      if (Number.isFinite(base) && Number.isFinite(trans) && Math.abs(base) < 20 && Math.abs(trans) < 20) {
                        rows.push([format(x), format(base), format(trans)])
                      }
                    }
                    downloadCsv(rows, `transformaciones-trig-${family.id}.csv`)
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white"
                >
                  Descargar CSV
                </button>
              </LabCard>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { CartesianFrame, LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, linePath, sampleRange } from './derivaLabUtils'

const PI = Math.PI
const xTicks = [-2 * PI, (-3 * PI) / 2, -PI, -PI / 2, 0, PI / 2, PI, (3 * PI) / 2, 2 * PI]
const yTicks = [-4, -2, 0, 2, 4]

const families = [
  {
    id: 'sine',
    label: 'Seno',
    symbol: 'sen',
    context: 'Modela oscilaciones que cruzan la línea media con ritmo regular, como la altura de una boya.',
    baseFormula: 'f(x) = sin(x)',
    generalModel: 'g(x) = a·sen(b(x - h)) + k',
    fn: (u) => Math.sin(u),
    periodBase: 2 * PI,
    parameterLabel: 'Amplitud a',
    readoutLabel: 'Amplitud',
    structure: 'Cruza la línea media y alterna máximos y mínimos a distancia regular.',
  },
  {
    id: 'cosine',
    label: 'Coseno',
    symbol: 'cos',
    context: 'Modela procesos periódicos que parten de un máximo o un mínimo, como una proyección circular.',
    baseFormula: 'f(x) = cos(x)',
    generalModel: 'g(x) = a·cos(b(x - h)) + k',
    fn: (u) => Math.cos(u),
    periodBase: 2 * PI,
    parameterLabel: 'Amplitud a',
    readoutLabel: 'Amplitud',
    structure: 'Comienza en un extremo y conserva la misma separación entre crestas y valles.',
  },
  {
    id: 'tangent',
    label: 'Tangente',
    symbol: 'tan',
    context: 'Permite estudiar periodicidad con discontinuidades y crecimiento no acotado cerca de asíntotas.',
    baseFormula: 'f(x) = tan(x)',
    generalModel: 'g(x) = a·tan(b(x - h)) + k',
    fn: (u) => Math.tan(u),
    periodBase: PI,
    parameterLabel: 'Escala vertical a',
    readoutLabel: 'Escala vertical',
    structure: 'Cada rama crece de forma estricta entre dos asíntotas consecutivas.',
  },
]

const formatPiTick = (value) => {
  const ratio = value / PI
  const rounded = Math.round(ratio * 2) / 2

  if (Math.abs(rounded) < 0.001) {
    return '0'
  }
  if (Math.abs(rounded - 1) < 0.001) {
    return 'π'
  }
  if (Math.abs(rounded + 1) < 0.001) {
    return '-π'
  }
  if (Math.abs(rounded - 0.5) < 0.001) {
    return 'π/2'
  }
  if (Math.abs(rounded + 0.5) < 0.001) {
    return '-π/2'
  }
  if (Math.abs(rounded - 1.5) < 0.001) {
    return '3π/2'
  }
  if (Math.abs(rounded + 1.5) < 0.001) {
    return '-3π/2'
  }
  if (Math.abs(rounded - 2) < 0.001) {
    return '2π'
  }
  if (Math.abs(rounded + 2) < 0.001) {
    return '-2π'
  }

  return `${format(rounded)}π`
}

const buildTangentSegments = (a, b, h, k) => {
  const xMin = -2 * PI
  const xMax = 2 * PI
  const asymptotes = []

  for (let n = -6; n <= 6; n += 1) {
    const asymptote = h + ((PI / 2) + (n * PI)) / b
    if (asymptote > xMin - 1 && asymptote < xMax + 1) {
      asymptotes.push(asymptote)
    }
  }

  const inner = asymptotes
    .filter((value) => value > xMin && value < xMax)
    .sort((left, right) => left - right)
  const boundaries = [xMin, ...inner, xMax]
  const segments = []

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index]
    const end = boundaries[index + 1]
    const padStart = index === 0 ? start : start + 0.04
    const padEnd = index === boundaries.length - 2 ? end : end - 0.04
    if (padEnd > padStart) {
      segments.push(
        sampleRange(padStart, padEnd, 120, (x) => {
          const y = (a * Math.tan(b * (x - h))) + k
          return Math.abs(y) > 20 ? Number.NaN : y
        }),
      )
    }
  }

  return { asymptotes: inner, segments }
}

export const FunctionTrigonometricLab = () => {
  const [familyId, setFamilyId] = useState('sine')
  const [a, setA] = useState(1.6)
  const [b, setB] = useState(1)
  const [h, setH] = useState(0)
  const [k, setK] = useState(0)
  const family = families.find((item) => item.id === familyId) || families[0]

  const period = family.periodBase / b
  const sinusoidalPoints = useMemo(
    () => sampleRange(-2 * PI, 2 * PI, 320, (x) => (a * family.fn(b * (x - h))) + k),
    [a, b, family, h, k],
  )
  const tangentModel = useMemo(() => buildTangentSegments(a, b, h, k), [a, b, h, k])
  const points = family.id === 'tangent' ? tangentModel.segments : [sinusoidalPoints]
  const asymptotes = family.id === 'tangent' ? tangentModel.asymptotes : []

  const sampleRows = Array.from({ length: 13 }, (_, index) => {
    const x = (-2 * PI) + (((4 * PI) * index) / 12)
    const y = (a * family.fn(b * (x - h))) + k
    return [format(x), Number.isFinite(y) && Math.abs(y) < 20 ? format(y) : '']
  }).filter((row) => row[1] !== '')

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.76fr_1.24fr]">
        <div className="space-y-4">
          <LabCard title="Periodicidad y lectura en radianes" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Funciones trigonométricas</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              El plano queda fijo entre -2π y 2π para que amplitud, período y fase se lean sobre el mismo sistema de referencia.
            </p>
          </LabCard>

          <LabCard title="Familia en estudio">
            <div className="grid gap-3">
              {families.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setFamilyId(item.id)
                    setA(item.id === 'tangent' ? 0.9 : 1.6)
                    setB(1)
                    setH(0)
                    setK(0)
                  }}
                  className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${item.id === family.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper text-ink hover:border-ink/30'}`}
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className={`mt-1 text-sm leading-6 ${item.id === family.id ? 'text-paper/72' : 'text-ink/65'}`}>{item.context}</p>
                </button>
              ))}
            </div>
          </LabCard>

          <LabCard title="Claves de lectura">
            <p className="text-sm leading-6 text-ink/68">{family.structure}</p>
            <div className="mt-4 rounded-[1.2rem] bg-paper px-4 py-4">
              <p className="text-sm font-semibold text-ink">Qué conviene mirar</p>
              <p className="mt-2 text-sm leading-6 text-ink/66">
                La amplitud o escala vertical, la distancia horizontal de repetición, la fase, la línea media y, en tangente, las asíntotas verticales.
              </p>
            </div>
          </LabCard>
        </div>

        <div className="space-y-5">
          <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-[0.65rem] uppercase tracking-[0.28em] text-paper/45">Lectura gráfica</p>
                <h3 className="mt-3 font-display text-[clamp(2rem,3.6vw,3.2rem)] leading-[0.98] tracking-[-0.04em]">Plano trigonométrico fijo</h3>
                <p className="mt-3 text-sm leading-6 text-paper/72">La curva cambia dentro del mismo sistema de referencia para que amplitud, período, fase y línea media se comparen sin mover los ejes.</p>
              </div>
            </div>
            <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-white/6 p-4">
              <CartesianFrame
                xMin={-2 * PI}
                xMax={2 * PI}
                yMin={-5}
                yMax={5}
                xTicks={xTicks}
                yTicks={yTicks}
                xTickFormatter={formatPiTick}
                xLabel="x (rad)"
                yLabel="f(x)"
                className="w-full h-auto aspect-[16/9] overflow-hidden rounded-[1.1rem]"
              >
                {({ scaleX, scaleY, padding, width, height }) => (
                  <>
                    <line x1={padding} y1={scaleY(k)} x2={width - padding} y2={scaleY(k)} stroke="rgba(84,214,201,0.82)" strokeWidth="1.4" strokeDasharray="6 6" />
                    {asymptotes.map((value) => (
                      <line key={value} x1={scaleX(value)} y1={padding} x2={scaleX(value)} y2={height - padding} stroke="rgba(84,214,201,0.92)" strokeWidth="1.2" strokeDasharray="6 6" />
                    ))}
                    {points.map((segment, index) => (
                      <path key={index} d={linePath(segment, scaleX, scaleY)} fill="none" stroke="rgba(255,107,53,0.98)" strokeWidth="4.6" strokeLinecap="round" />
                    ))}
                  </>
                )}
              </CartesianFrame>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.04fr_0.96fr]">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.2em] text-paper/45">Modelo y controles</p>
                <div className="mt-3 space-y-3">
                  <ModelCard title="Función base" expression={family.baseFormula} dark />
                  <ModelCard title="Modelo general" expression={family.generalModel} parameters={'a, b, h, k ∈ R'} conditions={'b > 0'} dark />
                  <ModelCard title="Modelo actual" expression={`g(x) = ${format(a)}·${family.symbol}(${format(b)}(x ${h >= 0 ? '-' : '+'} ${format(Math.abs(h))})) ${k >= 0 ? '+' : '-'} ${format(Math.abs(k))}`} dark />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <SliderField id="trig-a" label={family.parameterLabel} value={a} min={-3} max={3} step={0.1} onChange={setA} />
                  <SliderField id="trig-b" label="Factor horizontal b" value={b} min={0.5} max={2.5} step={0.05} onChange={setB} />
                  <SliderField id="trig-h" label="Fase h" value={h} min={-PI} max={PI} step={0.05} onChange={setH} />
                  <SliderField id="trig-k" label="Traslación vertical k" value={k} min={-3} max={3} step={0.1} onChange={setK} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <MetricCard label={family.readoutLabel} value={format(a)} detail={family.id === 'tangent' ? 'Controla la inclinación de cada rama.' : 'Controla la distancia vertical a la línea media.'} />
                <MetricCard label="Período" value={`${format(period)} rad`} detail={family.id === 'tangent' ? 'Distancia entre ramas equivalentes.' : 'Distancia horizontal de repetición.'} />
                <MetricCard label="Fase" value={`${format(h)} rad`} detail="Indica hacia dónde se desplaza el patrón." />
                <MetricCard label="Línea media" value={`y = ${format(k)}`} detail={family.id === 'tangent' ? 'Referencia vertical para comparar el desplazamiento de cada rama.' : 'Referencia alrededor de la cual oscila la función.'} />
              </div>
            </div>
          </LabCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <LabCard title="Lectura del modelo">
              <p className="text-sm leading-6 text-ink/68">
                El valor de <span className="font-semibold text-ink">a</span> controla la amplitud o la escala vertical; <span className="font-semibold text-ink">b</span> modifica el período;
                <span className="font-semibold text-ink"> h</span> desplaza horizontalmente la gráfica y <span className="font-semibold text-ink">k</span> mueve la línea media.
              </p>
              <p className="mt-3 text-sm leading-6 text-ink/68">
                En tangente, además, las asíntotas verticales dependen de <span className="font-semibold text-ink">b</span> y <span className="font-semibold text-ink">h</span>, por eso la lectura del dominio exige más cuidado.
              </p>
            </LabCard>

            <LabCard title="Descarga">
              <p className="text-sm leading-6 text-ink/68">La tabla exporta una muestra en radianes dentro de la misma ventana fija para continuar el análisis fuera del laboratorio.</p>
              <button
                type="button"
                onClick={() => downloadCsv([['x (rad)', 'g(x)'], ...sampleRows], `funciones-trigonometricas-${family.id}.csv`)}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white"
              >
                Descargar CSV
              </button>
            </LabCard>
          </div>
        </div>
      </div>
    </div>
  )
}

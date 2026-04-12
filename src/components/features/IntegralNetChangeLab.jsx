import { useState } from 'react'
import { CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, linePath, sampleRange } from './derivaLabUtils'

const scenarios = [
  {
    id: 'harbor',
    label: 'Puerto y marea',
    context: 'El caudal de entrada y salida cambia de signo con la marea.',
    func: (t) => (2.6 * Math.sin(0.95 * t)) - 0.4,
    formula: 'r(t) = 2.60sen(0.95t) - 0.40',
  },
  {
    id: 'warehouse',
    label: 'Inventario',
    context: 'Entradas y salidas de producto durante la jornada.',
    func: (t) => (0.18 * ((t - 4.5) ** 3)) - (1.1 * (t - 4.5)),
    formula: 'r(t) = 0.18(t - 4.5)³ - 1.10(t - 4.5)',
  },
]

const integrateSigned = (fn, a, b, slices = 400) => {
  const dt = (b - a) / slices
  let net = 0
  let positive = 0
  let negative = 0

  for (let index = 0; index < slices; index += 1) {
    const x = a + ((index + 0.5) * dt)
    const y = fn(x)
    net += y * dt
    if (y >= 0) positive += y * dt
    if (y < 0) negative += y * dt
  }

  return { net, positive, negative: Math.abs(negative) }
}

const buildAreaSegments = (fn, a, b, samples = 240) => {
  const points = sampleRange(a, b, samples, fn)

  if (points.length < 2) return []

  const segments = []
  let current = [points[0]]

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const sameSign = (start.y >= 0 && end.y >= 0) || (start.y <= 0 && end.y <= 0)

    if (sameSign || Math.abs(end.y - start.y) < 1e-9) {
      current.push(end)
      continue
    }

    const rootX = start.x + (((0 - start.y) * (end.x - start.x)) / (end.y - start.y))
    const root = { x: rootX, y: 0 }

    current.push(root)
    segments.push(current)
    current = [root, end]
  }

  if (current.length > 1) segments.push(current)

  return segments
    .map((segment) => {
      const samplePoint = segment.find((point) => Math.abs(point.y) > 1e-6)

      if (!samplePoint) return null

      return {
        sign: samplePoint.y > 0 ? 'positive' : 'negative',
        points: segment,
      }
    })
    .filter(Boolean)
}

const buildAreaPath = (points, scaleX, scaleY) => {
  const axisY = scaleY(0)
  const start = points[0]
  const end = points[points.length - 1]
  const curve = points.map((point) => `L ${scaleX(point.x)} ${scaleY(point.y)}`).join(' ')

  return `M ${scaleX(start.x)} ${axisY} ${curve} L ${scaleX(end.x)} ${axisY} Z`
}

const buildTicks = (min, max, step = 2) => {
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step

  return Array.from({ length: Math.round((end - start) / step) + 1 }, (_, index) => start + (index * step))
}

export const IntegralNetChangeLab = () => {
  const [scenarioId, setScenarioId] = useState('harbor')
  const [a, setA] = useState(0.5)
  const [b, setB] = useState(5.8)
  const scenario = scenarios.find((item) => item.id === scenarioId) || scenarios[0]
  const left = Math.min(a, b)
  const right = Math.max(a, b)
  const values = integrateSigned(scenario.func, left, right)
  const points = sampleRange(0, 9, 160, scenario.func)
  const areaSegments = buildAreaSegments(scenario.func, left, right)
  const yValues = points.map((point) => point.y)
  const yMin = Math.min(-4, Math.floor(Math.min(...yValues) - 0.8))
  const yMax = Math.max(4, Math.ceil(Math.max(...yValues) + 0.8))
  const yTicks = buildTicks(yMin, yMax)

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-4">
          <LabCard title="Integral con signo" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Integrales y cambio neto</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">La integral neta no es lo mismo que la variación total cuando la tasa cruza el eje x.</p>
          </LabCard>
          <LabCard title="Escenario">
            <div className="grid gap-3">
              {scenarios.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScenarioId(item.id)}
                  className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${item.id === scenario.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper text-ink hover:border-ink/30'}`}
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className={`mt-1 text-sm leading-6 ${item.id === scenario.id ? 'text-paper/72' : 'text-ink/65'}`}>{item.context}</p>
                </button>
              ))}
            </div>
          </LabCard>
          <SliderField id="net-a" label="Límite izquierdo a" value={a} min={0} max={9} step={0.1} onChange={setA} />
          <SliderField id="net-b" label="Límite derecho b" value={b} min={0} max={9} step={0.1} onChange={setB} />
        </div>

        <div className="space-y-5">
          <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-paper/45">Lectura gráfica</p>
            <h3 className="mt-3 font-display text-3xl">Área positiva, área negativa y balance final</h3>
            <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-white/6 p-4">
              <CartesianFrame xMin={0} xMax={9} yMin={yMin} yMax={yMax} xTicks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]} yTicks={yTicks} xLabel="t" yLabel="r(t)">
                {({ scaleX, scaleY, padding, height }) => (
                  <>
                    {areaSegments.map((segment, index) => (
                      <path
                        key={`${segment.sign}-${index}`}
                        d={buildAreaPath(segment.points, scaleX, scaleY)}
                        fill={segment.sign === 'positive' ? 'rgba(199,244,100,0.28)' : 'rgba(255,107,53,0.24)'}
                        stroke="none"
                      />
                    ))}
                    <path d={linePath(points, scaleX, scaleY)} fill="none" stroke="rgba(199,244,100,0.95)" strokeWidth="5" strokeLinecap="round" />
                    <line x1={scaleX(left)} y1={padding} x2={scaleX(left)} y2={height - padding} stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeDasharray="6 6" />
                    <line x1={scaleX(right)} y1={padding} x2={scaleX(right)} y2={height - padding} stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeDasharray="6 6" />
                  </>
                )}
              </CartesianFrame>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <MetricCard label="Integral neta" value={format(values.net)} detail="Cambio total con signo." />
              <MetricCard label="Área positiva" value={format(values.positive)} detail="Contribución sobre el eje x." />
              <MetricCard label="Área negativa" value={format(values.negative)} detail="Magnitud acumulada bajo el eje x." />
              <MetricCard label="Variación total" value={format(values.positive + values.negative)} detail="Suma de magnitudes sin cancelación." />
            </div>
          </LabCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <LabCard title="Modelo">
              <div className="overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{scenario.formula}</p>
              </div>
            </LabCard>
            <LabCard title="Descarga de datos">
              <button
                type="button"
                onClick={() => downloadCsv([
                  ['t', 'r(t)'],
                  ...Array.from({ length: 10 }, (_, index) => {
                    const t = index
                    return [format(t), format(scenario.func(t))]
                  }),
                ], `integrales-cambio-neto-${scenario.id}.csv`)}
                className="inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white"
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

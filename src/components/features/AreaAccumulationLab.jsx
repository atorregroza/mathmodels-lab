import { useState } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, generateTicks, linePath, sampleRange } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

const scenarios = [
  {
    id: 'tank',
    label: 'Tanque de agua',
    context: 'Caudal de llenado que aumenta con el tiempo.',
    domainMax: 12,
    rateLabel: 'r(t) (L/min)',
    accumulationLabel: 'A(t) (L)',
    rate: (t) => (0.55 * t) + 2.4,
    accumulation: (t) => (0.275 * t * t) + (2.4 * t),
    rateFormula: 'r(t) = 0.55t + 2.40',
    accumulationFormula: 'A(t) = 0.275t² + 2.40t',
  },
  {
    id: 'museum',
    label: 'Entrada a un museo',
    context: 'Flujo de visitantes con patrón ondulatorio.',
    domainMax: 12,
    rateLabel: 'r(t) (visitantes/h)',
    accumulationLabel: 'A(t) (visitantes)',
    rate: (t) => (18 * Math.sin(0.65 * t)) + 48,
    accumulation: (t) => ((18 / 0.65) * (1 - Math.cos(0.65 * t))) + (48 * t),
    rateFormula: 'r(t) = 18sen(0.65t) + 48',
    accumulationFormula: 'A(t) = 27.69(1 - cos(0.65t)) + 48t',
  },
]

export const AreaAccumulationLab = () => {
  const [scenarioId, setScenarioId] = useState('tank')
  const [time, setTime] = useState(5)
  const [rectangles, setRectangles] = useState(8)
  const [mode, setMode] = useState('midpoint')
  const scenario = scenarios.find((item) => item.id === scenarioId) || scenarios[0]
  const currentTime = Math.min(time, scenario.domainMax)
  const dt = currentTime / rectangles
  const exact = scenario.accumulation(currentTime)
  const rateNow = scenario.rate(currentTime)
  const approx = Array.from({ length: rectangles }, (_, index) => {
    const left = index * dt
    const sample = mode === 'left' ? left : mode === 'right' ? left + dt : left + (dt / 2)
    return scenario.rate(sample) * dt
  }).reduce((sum, value) => sum + value, 0)
  const points = sampleRange(0, scenario.domainMax, 120, scenario.rate)
  const axis = useAxisRange({ xMin: 0, xMax: scenario.domainMax, yMin: 0, yMax: Math.max(...points.map((point) => point.y)) * 1.15 })

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <LabCard title="Integral en contexto" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Área acumulada</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">El área bajo una tasa positiva se convierte en cantidad acumulada. Aquí puedes compararla con una suma de Riemann.</p>
          </LabCard>

          <LabCard title="Escenario">
            <div className="grid gap-3">
              {scenarios.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setScenarioId(item.id); axis.resetRange() }}
                  className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${item.id === scenario.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper text-ink hover:border-ink/30'}`}
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className={`mt-1 text-sm leading-6 ${item.id === scenario.id ? 'text-paper/72' : 'text-ink/65'}`}>{item.context}</p>
                </button>
              ))}
            </div>
          </LabCard>

          <SliderField id="area-time" label="Tiempo leído" value={currentTime} min={0} max={scenario.domainMax} step={scenario.domainMax / 200} onChange={setTime} />
          <SliderField id="area-rects" label="Rectángulos de aproximación" value={rectangles} min={4} max={24} step={1} onChange={setRectangles} />

          <LabCard title="Método">
            <div className="flex flex-wrap gap-2">
              {['left', 'midpoint', 'right'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${mode === item ? 'bg-aqua text-white' : 'border border-ink/10 bg-paper text-ink hover:border-ink/30'}`}
                >
                  {item === 'left' ? 'Izquierda' : item === 'right' ? 'Derecha' : 'Punto medio'}
                </button>
              ))}
            </div>
          </LabCard>
        </div>

        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-paper/45">Tasa y acumulación</p>
            <h3 className="mt-3 font-display text-3xl">Lo que entra por unidad de tiempo y lo que se acumula después</h3>
            <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-white/6 p-4">
              <CartesianFrame xMin={axis.xMin} xMax={axis.xMax} yMin={axis.yMin} yMax={axis.yMax} xTicks={generateTicks(axis.xMin, axis.xMax)} yTicks={generateTicks(axis.yMin, axis.yMax)} xLabel="t" yLabel={scenario.rateLabel}>
                {({ scaleX, scaleY, height, padding }) => (
                  <>
                    {Array.from({ length: rectangles }, (_, index) => {
                      const left = index * dt
                      const right = left + dt
                      const sample = mode === 'left' ? left : mode === 'right' ? right : left + (dt / 2)
                      const y = scenario.rate(sample)

                      return (
                        <g key={`${left}-${right}`}>
                          <rect x={scaleX(left)} y={scaleY(y)} width={Math.max(scaleX(right) - scaleX(left), 1)} height={(height - padding) - scaleY(y)} fill="rgba(31,122,120,0.20)" stroke="rgba(31,122,120,0.45)" strokeWidth="1.1" />
                          <line x1={scaleX(left)} y1={scaleY(y)} x2={scaleX(right)} y2={scaleY(y)} stroke="rgba(31,122,120,0.95)" strokeWidth="2.1" />
                        </g>
                      )
                    })}
                    <path d={linePath(points, scaleX, scaleY)} fill="none" stroke="rgba(255,107,53,0.95)" strokeWidth="5" strokeLinecap="round" />
                    <circle cx={scaleX(currentTime)} cy={scaleY(rateNow)} r="7" fill="rgba(199,244,100,0.95)" stroke="rgba(18,23,35,0.55)" strokeWidth="2" />
                  </>
                )}
              </CartesianFrame>
            </div>
            <AxisRangePanel {...axis} />

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <MetricCard label="Tasa actual" value={format(rateNow)} detail={scenario.rateLabel} />
              <MetricCard label="Integral exacta" value={format(exact)} detail={scenario.accumulationLabel} />
              <MetricCard label="Suma por rectángulos" value={format(approx)} detail={`Método: ${mode}.`} />
              <MetricCard label="Error de aproximación" value={format(exact - approx)} detail="Diferencia entre el valor exacto y la estimación." />
            </div>
          </LabCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <LabCard title="Función de tasa">
              <div className="overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{scenario.rateFormula}</p>
              </div>
            </LabCard>
            <LabCard title="Acumulación exacta">
              <div className="overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{scenario.accumulationFormula}</p>
              </div>
            </LabCard>
          </div>

          <LabCard title="Descarga de datos">
            <button
              type="button"
              onClick={() => downloadCsv([
                ['t', 'tasa', 'acumulacion_exacta'],
                ...Array.from({ length: 10 }, (_, index) => {
                  const t = (scenario.domainMax * index) / 9
                  return [format(t), format(scenario.rate(t)), format(scenario.accumulation(t))]
                }),
              ], `area-acumulada-${scenario.id}.csv`)}
              className="inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white"
            >
              Descargar CSV
            </button>
          </LabCard>
        </div>
      </div>
    </div>
  )
}

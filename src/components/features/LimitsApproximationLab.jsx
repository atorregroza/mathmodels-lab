import { useState } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, generateTicks, linePath, sampleRange } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

const scenarios = [
  {
    id: 'bridge',
    label: 'Arco de un puente',
    context: 'La altura del arco se observa según la posición horizontal.',
    problemModel: 'La altura del arco se modela en función de la posición horizontal. El objetivo es aproximar la pendiente instantánea observando pendientes medias en intervalos cada vez más pequeños.',
    assumptions: 'Se idealiza el perfil del puente con una función suave y se estudia solo una sección del arco.',
    domainMax: 8,
    func: (x) => -0.22 * ((x - 4) ** 2) + 4.6,
    derivative: (x) => -0.44 * (x - 4),
    formula: 'f(x) = -0.22(x - 4)² + 4.60',
    derivativeFormula: "f'(x) = -0.44(x - 4)",
    nmQuestion: '¿Qué te sugieren las razones media por izquierda y por derecha sobre la pendiente instantánea cerca del punto elegido?',
    nsQuestion: 'Explica por qué el límite del cociente incremental representa la derivada en ese punto.',
  },
  {
    id: 'glucose',
    label: 'Nivel de glucosa',
    context: 'Se observa cómo cambia la concentración después de una bebida azucarada.',
    problemModel: 'Se modela la concentración de glucosa en sangre y se aproxima la razón de cambio instantánea en distintos momentos del proceso.',
    assumptions: 'Se usa una curva suave ajustada y no se modelan variaciones biológicas pequeñas ni ruido experimental.',
    domainMax: 6,
    func: (x) => -0.16 * ((x - 2.2) ** 2) + 5.1,
    derivative: (x) => -0.32 * (x - 2.2),
    formula: 'f(x) = -0.16(x - 2.20)² + 5.10',
    derivativeFormula: "f'(x) = -0.32(x - 2.20)",
    nmQuestion: '¿En qué momento parece cambiar más rápido la glucosa y cómo lo lees en la gráfica?',
    nsQuestion: 'Relaciona el signo de la derivada con los intervalos donde el fenómeno crece o decrece.',
  },
  {
    id: 'cost',
    label: 'Costo de producción',
    context: 'Se analiza cómo cambia el costo por unidad al variar la producción.',
    problemModel: 'La función resume un costo total y el laboratorio aproxima el costo marginal en un punto mediante razones medias.',
    assumptions: 'Se considera una curva suave de costos y se ignoran saltos discreto-operativos.',
    domainMax: 10,
    func: (x) => (0.06 * (x ** 2)) - (0.4 * x) + 3.2,
    derivative: (x) => (0.12 * x) - 0.4,
    formula: 'f(x) = 0.06x² - 0.40x + 3.20',
    derivativeFormula: "f'(x) = 0.12x - 0.40",
    nmQuestion: '¿Qué indica la razón de cambio en términos del costo cuando la producción aumenta?',
    nsQuestion: 'Compara la lectura numérica del límite con la recta tangente en el punto.',
  },
]

export const LimitsApproximationLab = () => {
  const [scenarioId, setScenarioId] = useState('bridge')
  const [a, setA] = useState(3.4)
  const [h, setH] = useState(0.15)
  const scenario = scenarios.find((item) => item.id === scenarioId) || scenarios[0]
  const safeH = Math.max(h, 0.02)
  const left = (scenario.func(a) - scenario.func(a - safeH)) / safeH
  const right = (scenario.func(a + safeH) - scenario.func(a)) / safeH
  const estimate = (left + right) / 2
  const exact = scenario.derivative(a)
  const diff = Math.abs(left - right)
  const points = sampleRange(0, scenario.domainMax, 120, scenario.func)
  const axis = useAxisRange({
    xMin: 0, xMax: scenario.domainMax,
    yMin: 0, yMax: Math.max(...points.map((point) => point.y)) * 1.1,
  })
  const tableRows = [1, 0.8, 0.5, 0.3, 0.2, 0.15, 0.1, 0.05].map((value) => {
    const l = (scenario.func(a) - scenario.func(a - value)) / value
    const r = (scenario.func(a + value) - scenario.func(a)) / value
    return { h: value, left: l, right: r, estimate: (l + r) / 2 }
  })

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-4">
          <LabCard title="Contextos de aproximación" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Límites como aproximación</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">Dos secantes pueden acercarse a un mismo valor cuando el intervalo alrededor del punto se hace cada vez más pequeño.</p>
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

          <SliderField id="limits-a" label="Punto de aproximación a" value={a} min={0} max={scenario.domainMax} step={0.02} onChange={setA} />
          <SliderField id="limits-h" label="Tamaño del intervalo h" value={h} min={0.02} max={1} step={0.01} onChange={setH} />
        </div>

        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-paper/80">Acercamiento bilateral</p>
                <h3 className="mt-3 font-display text-3xl">Dos secantes, un mismo valor al que tender</h3>
              </div>
              <span className="rounded-full border border-graph/30 bg-graph/12 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-graph">
                {diff < 0.08 ? 'Aproximación muy estable' : 'Comparación en curso'}
              </span>
            </div>

            <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-white/6 p-4">
              <CartesianFrame
                xMin={axis.xMin}
                xMax={axis.xMax}
                yMin={axis.yMin}
                yMax={axis.yMax}
                xTicks={generateTicks(axis.xMin, axis.xMax)}
                yTicks={generateTicks(axis.yMin, axis.yMax)}
                xLabel="x"
                yLabel="f(x)"
              >
                {({ scaleX, scaleY, padding, height }) => (
                  <>
                    <path d={linePath(points, scaleX, scaleY)} fill="none" stroke="rgba(199,244,100,0.96)" strokeWidth="5" strokeLinecap="round" />
                    <line x1={scaleX(a)} y1={padding} x2={scaleX(a)} y2={height - padding} stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeDasharray="6 6" />
                    <circle cx={scaleX(a - safeH)} cy={scaleY(scenario.func(a - safeH))} r="6" fill="rgba(84,214,201,0.96)" stroke="rgba(255,255,255,0.9)" strokeWidth="2" />
                    <circle cx={scaleX(a)} cy={scaleY(scenario.func(a))} r="7" fill="rgba(199,244,100,0.95)" stroke="rgba(18,23,35,0.45)" strokeWidth="2" />
                    <circle cx={scaleX(a + safeH)} cy={scaleY(scenario.func(a + safeH))} r="6" fill="rgba(255,107,53,1)" stroke="rgba(255,255,255,0.9)" strokeWidth="2" />
                  </>
                )}
              </CartesianFrame>
            </div>

            <AxisRangePanel {...axis} />

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <MetricCard label="Razón por izquierda" value={format(left)} detail="Usa el intervalo [a - h, a]." />
              <MetricCard label="Razón por derecha" value={format(right)} detail="Usa el intervalo [a, a + h]." />
              <MetricCard label="Estimación del límite" value={format(estimate)} detail="Promedio de ambas aproximaciones." />
              <MetricCard label="Diferencia entre lados" value={format(diff)} detail="Mide qué tan cerca están las dos lecturas." />
            </div>
          </LabCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <LabCard title="Expresiones del modelo">
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                  <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{scenario.formula}</p>
                </div>
                <div className="overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                  <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{`lim h→0 [f(${format(a)} + h) - f(${format(a)})] / h ≈ ${format(estimate)}`}</p>
                </div>
                <div className="overflow-x-auto rounded-[1.2rem] border border-ink/10 bg-white px-4 py-4">
                  <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{`${scenario.derivativeFormula}; valor en a: ${format(exact)}`}</p>
                </div>
              </div>
            </LabCard>

            <LabCard title="Preguntas NM y NS" className="bg-paper">
              <div className="space-y-4">
                <div className="rounded-[1.2rem] bg-white px-4 py-4">
                  <p className="font-semibold text-ink">NM</p>
                  <p className="mt-2 text-sm leading-6 text-ink/68">{scenario.nmQuestion}</p>
                </div>
                <div className="rounded-[1.2rem] bg-white px-4 py-4">
                  <p className="font-semibold text-ink">NS</p>
                  <p className="mt-2 text-sm leading-6 text-ink/68">{scenario.nsQuestion}</p>
                </div>
              </div>
            </LabCard>
          </div>

          <LabCard title="Tabla de aproximación">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm leading-6 text-ink/68">La tabla compara razones por izquierda y por derecha para que el estudiante vea la convergencia numérica y la contraste con el gráfico.</p>
              <button
                type="button"
                onClick={() => downloadCsv([
                  ['h', 'izquierda', 'derecha', 'estimacion'],
                  ...tableRows.map((row) => [format(row.h), format(row.left), format(row.right), format(row.estimate)]),
                ], `limites-aproximacion-${scenario.id}.csv`)}
                className="inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white"
              >
                Descargar CSV
              </button>
            </div>
          </LabCard>
        </div>
      </div>
    </div>
  )
}

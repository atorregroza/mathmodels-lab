import { useState } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { LiveFormula } from './LiveFormula'
import { downloadCsv, format, generateTicks, linePath, sampleRange } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

const families = [
  {
    id: 'linear',
    label: 'Lineal',
    context: 'Relaciones con cambio constante y pendiente uniforme.',
    generalModel: 'f(x) = mx + b',
    parameterSet: 'm, b ∈ R',
    params: { m: 1.4, b: -1.2 },
    controls: [{ key: 'm', label: 'Pendiente m', min: -4, max: 4, step: 0.1 }, { key: 'b', label: 'Intercepto b', min: -8, max: 8, step: 0.1 }],
    fn: (x, p) => (p.m * x) + p.b,
    formula: (p) => `f(x) = ${format(p.m)}x ${p.b >= 0 ? '+' : '-'} ${format(Math.abs(p.b))}`,
    domain: 'R',
    range: 'R',
    summary: (p) => (p.m > 0 ? 'Creciente en todo su dominio.' : p.m < 0 ? 'Decreciente en todo su dominio.' : 'Constante.'),
  },
  {
    id: 'quadratic',
    label: 'Cuadrática',
    context: 'Modelos con vértice, simetría axial y concavidad fija.',
    generalModel: 'f(x) = a(x - h)^2 + k',
    parameterSet: 'a, h, k ∈ R',
    conditions: 'a ≠ 0',
    params: { a: 0.45, h: 1.2, k: -2.4 },
    controls: [{ key: 'a', label: 'Apertura a', min: -2.5, max: 2.5, step: 0.05 }, { key: 'h', label: 'Traslación h', min: -4, max: 4, step: 0.1 }, { key: 'k', label: 'Traslación k', min: -6, max: 6, step: 0.1 }],
    fn: (x, p) => p.a * ((x - p.h) ** 2) + p.k,
    formula: (p) => `f(x) = ${format(p.a)}(x - ${format(p.h)})² ${p.k >= 0 ? '+' : '-'} ${format(Math.abs(p.k))}`,
    domain: 'R',
    range: (p) => (p.a >= 0 ? `[${format(p.k)}, ∞)` : `(-∞, ${format(p.k)}]`),
    summary: (p) => (p.a >= 0 ? 'Decrece y luego crece.' : 'Crece y luego decrece.'),
  },
  {
    id: 'polynomial',
    label: 'Polinómica factorizada',
    context: 'Las raíces visibles se conectan con el grado de la función.',
    generalModel: 'f(x) = a(x - r1)(x - r2)...(x - rn)',
    parameterSet: 'a, r1, r2, ..., rn ∈ R',
    conditions: 'a ≠ 0, n ∈ N',
    params: { degree: 3, a: 0.18, r1: -2.8, r2: 0.6, r3: 2.4, r4: 4 },
    controls: null,
    fn: (x, p) => [p.r1, p.r2, p.r3, p.r4].slice(0, p.degree).reduce((product, root) => product * (x - root), p.a),
    formula: (p) => `f(x) = ${format(p.a)}${[p.r1, p.r2, p.r3, p.r4].slice(0, p.degree).map((root) => `(x - ${format(root)})`).join('')}`,
    domain: 'R',
    range: (p) => (p.degree % 2 === 0 ? 'Rango con extremo global' : 'R'),
    summary: (p) => `Puede tener hasta ${p.degree} intersecciones reales con el eje x.`,
  },
  {
    id: 'exponential',
    label: 'Exponencial',
    context: 'Modelos de crecimiento o decrecimiento con asíntota horizontal.',
    generalModel: 'f(x) = ae^(kx) + c',
    parameterSet: 'a, k, c ∈ R',
    conditions: 'a ≠ 0',
    params: { a: 1.8, k: 0.45, c: -1.2 },
    controls: [{ key: 'a', label: 'Escala a', min: -6, max: 6, step: 0.1 }, { key: 'k', label: 'Tasa k', min: -1.2, max: 1.2, step: 0.02 }, { key: 'c', label: 'Asíntota c', min: -6, max: 6, step: 0.1 }],
    fn: (x, p) => (p.a * Math.exp(p.k * x)) + p.c,
    formula: (p) => `f(x) = ${format(p.a)}e^(${format(p.k)}x) ${p.c >= 0 ? '+' : '-'} ${format(Math.abs(p.c))}`,
    domain: 'R',
    range: (p) => (p.a > 0 ? `(${format(p.c)}, ∞)` : `(-∞, ${format(p.c)})`),
    summary: (p) => ((p.a * p.k) > 0 ? 'Creciente.' : 'Decreciente.'),
  },
  {
    id: 'logarithmic',
    label: 'Logarítmica',
    context: 'Dominio restringido y asíntota vertical.',
    generalModel: 'f(x) = a ln(x - h) + c',
    parameterSet: 'a, h, c ∈ R',
    conditions: 'a ≠ 0, x > h',
    params: { a: 1.6, h: -1.8, c: 0.8 },
    controls: [{ key: 'a', label: 'Escala a', min: -3, max: 3, step: 0.1 }, { key: 'h', label: 'Asíntota h', min: -4, max: 3, step: 0.1 }, { key: 'c', label: 'Traslación c', min: -6, max: 6, step: 0.1 }],
    fn: (x, p) => (x > p.h ? (p.a * Math.log(x - p.h)) + p.c : Number.NaN),
    formula: (p) => `f(x) = ${format(p.a)}ln(x - ${format(p.h)}) ${p.c >= 0 ? '+' : '-'} ${format(Math.abs(p.c))}`,
    domain: (p) => `(${format(p.h)}, ∞)`,
    range: 'R',
    summary: (p) => (p.a >= 0 ? 'Creciente en su dominio.' : 'Decreciente en su dominio.'),
  },
]

export const FunctionPanoramaLab = () => {
  const [familyId, setFamilyId] = useState('linear')
  const family = families.find((item) => item.id === familyId) || families[0]
  const [params, setParams] = useState(family.params)

  const axis = useAxisRange({ xMin: -6, xMax: 6, yMin: -8, yMax: 8 })

  const points = sampleRange(-6, 6, 200, (x) => family.fn(x, params))

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.76fr_1.24fr]">
        <div className="space-y-4">
          <LabCard title="Panorama comparativo" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Panorama de funciones</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">Comparar familias antes de especializarlas ayuda a leer qué cambia, qué se conserva y qué estructura aparece en cada caso.</p>
          </LabCard>

          <LabCard title="Familia en estudio">
            <div className="flex flex-wrap gap-2">
              {families.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setFamilyId(item.id)
                    setParams(item.params)
                    axis.resetRange()
                  }}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${familyId === item.id ? 'bg-ink text-paper shadow-[0_10px_24px_rgba(18,23,35,0.18)]' : 'border border-ink/10 bg-paper text-ink hover:border-ink/30'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-[1.2rem] bg-paper px-4 py-4">
              <p className="font-semibold text-ink">{family.label}</p>
              <p className="mt-2 text-sm leading-6 text-ink/68">{family.context}</p>
            </div>
          </LabCard>
        </div>

        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[0.68fr_1.32fr]">
            <LabCard title="Parámetros">
              <div className="mb-4 space-y-3">
                <ModelCard
                  title="Modelo general"
                  expression={family.generalModel}
                  parameters={family.parameterSet}
                  conditions={family.conditions}
                />
                <ModelCard title="Modelo actual" expression={family.formula(params)} />
              </div>
              {family.controls ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  {family.controls.map((control) => (
                    <SliderField
                      key={control.key}
                      id={`${family.id}-${control.key}`}
                      label={control.label}
                      value={params[control.key]}
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      onChange={(value) => setParams((current) => ({ ...current, [control.key]: value }))}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <SliderField id="poly-degree" label="Grado n" value={params.degree} min={2} max={4} step={1} onChange={(value) => setParams((current) => ({ ...current, degree: value }))} />
                  <SliderField id="poly-a" label="Escala a" value={params.a} min={-1.5} max={1.5} step={0.05} onChange={(value) => setParams((current) => ({ ...current, a: value }))} />
                  <SliderField id="poly-r1" label="Raíz 1" value={params.r1} min={-5} max={5} step={0.1} onChange={(value) => setParams((current) => ({ ...current, r1: value }))} />
                  <SliderField id="poly-r2" label="Raíz 2" value={params.r2} min={-5} max={5} step={0.1} onChange={(value) => setParams((current) => ({ ...current, r2: value }))} />
                  {params.degree >= 3 && <SliderField id="poly-r3" label="Raíz 3" value={params.r3} min={-5} max={5} step={0.1} onChange={(value) => setParams((current) => ({ ...current, r3: value }))} />}
                  {params.degree >= 4 && <SliderField id="poly-r4" label="Raíz 4" value={params.r4} min={-5} max={5} step={0.1} onChange={(value) => setParams((current) => ({ ...current, r4: value }))} />}
                </div>
              )}
            </LabCard>

            <LabCard dark className="overflow-hidden rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
              <p className="text-[0.65rem] uppercase tracking-[0.28em] text-paper/45">Comportamiento visible</p>
              <div className="mt-3">
                <LiveFormula
                  label="Modelo evaluado"
                  general={family.generalModel}
                  evaluated={family.formula(params)}
                />
              </div>
              <div className="mt-5 overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/6 p-4">
                <CartesianFrame
                  xMin={axis.xMin}
                  xMax={axis.xMax}
                  yMin={axis.yMin}
                  yMax={axis.yMax}
                  xTicks={generateTicks(axis.xMin, axis.xMax)}
                  yTicks={generateTicks(axis.yMin, axis.yMax)}
                  xLabel="x"
                  yLabel="f(x)"
                  className="w-full h-auto overflow-hidden rounded-[1.1rem]"
                >
                  {({ scaleX, scaleY }) => (
                    <path d={linePath(points, scaleX, scaleY)} fill="none" stroke="rgba(199,244,100,0.95)" strokeWidth="5" strokeLinecap="round" />
                  )}
                </CartesianFrame>
              </div>
              <AxisRangePanel {...axis} />

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-paper/72">
                <div className="rounded-full border border-white/10 bg-white/6 px-3 py-2"><span className="font-semibold text-graph">Dominio:</span> {typeof family.domain === 'function' ? family.domain(params) : family.domain}</div>
                <div className="rounded-full border border-white/10 bg-white/6 px-3 py-2"><span className="font-semibold text-paper">Rango:</span> {typeof family.range === 'function' ? family.range(params) : family.range}</div>
              </div>
            </LabCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <LabCard title="Expresión">
              <div className="overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{family.formula(params)}</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink/68">{family.summary(params)}</p>
            </LabCard>
            <LabCard title="Descarga">
              <button
                type="button"
                onClick={() => downloadCsv([
                  ['x', 'f(x)'],
                  ...Array.from({ length: 8 }, (_, index) => {
                    const x = -6 + ((12 * index) / 7)
                    return [format(x), format(family.fn(x, params))]
                  }).filter((row) => !row.includes('NaN')),
                ], `panorama-funciones-${family.id}.csv`)}
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

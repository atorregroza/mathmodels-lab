import { useState } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { LiveFormula } from './LiveFormula'
import { downloadCsv, format, generateTicks, linePath, sampleRange } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

const datasets = [
  {
    id: 'medication',
    label: 'Concentración de medicamento',
    context: 'La concentración disminuye con el tiempo tras una dosis.',
    xName: 'Tiempo (horas)',
    yName: 'Concentración (mg/L)',
    points: [[0, 9.2], [1, 7.1], [2, 5.8], [3, 4.9], [4, 4.1], [5, 3.6], [6, 3.1]],
  },
  {
    id: 'delivery',
    label: 'Costo de entrega',
    context: 'El costo cambia con la distancia y un cargo base.',
    xName: 'Distancia (km)',
    yName: 'Costo ($)',
    points: [[0, 2], [1, 3.4], [2, 4.8], [3, 6.1], [4, 7.6], [5, 8.9], [6, 10.3]],
  },
]

const models = {
  linear: {
    label: 'Lineal',
    generalModel: 'f(x) = ax + b',
    parameterSet: 'a, b ∈ ℝ',
    params: { a: 1.3, b: 2.1 },
    fn: (x, p) => (p.a * x) + p.b,
    formula: (p) => `f(x) = ${format(p.a)}x ${p.b >= 0 ? '+' : '-'} ${format(Math.abs(p.b))}`,
    controls: [{ key: 'a', label: 'Pendiente a', min: -3, max: 4, step: 0.05 }, { key: 'b', label: 'Intercepto b', min: -4, max: 12, step: 0.05 }],
  },
  quadratic: {
    label: 'Cuadrático',
    generalModel: 'f(x) = ax² + bx + c',
    parameterSet: 'a, b, c ∈ ℝ',
    conditions: 'a ≠ 0',
    params: { a: 0.1, b: 0.3, c: 3.6 },
    fn: (x, p) => (p.a * x * x) + (p.b * x) + p.c,
    formula: (p) => `f(x) = ${format(p.a)}x² ${p.b >= 0 ? '+' : '-'} ${format(Math.abs(p.b))}x ${p.c >= 0 ? '+' : '-'} ${format(Math.abs(p.c))}`,
    controls: [{ key: 'a', label: 'Coeficiente a', min: -1.5, max: 1.5, step: 0.02 }, { key: 'b', label: 'Coeficiente b', min: -4, max: 4, step: 0.05 }, { key: 'c', label: 'Coeficiente c', min: -4, max: 12, step: 0.05 }],
  },
  exponential: {
    label: 'Exponencial',
    generalModel: 'f(x) = a·eᵏˣ + c',
    parameterSet: 'a, k, c ∈ ℝ',
    conditions: 'a ≠ 0',
    params: { a: 8.5, k: -0.2, c: 1.2 },
    fn: (x, p) => (p.a * Math.exp(p.k * x)) + p.c,
    formula: (p) => `f(x) = ${format(p.a)}·e^(${format(p.k)}x) ${p.c >= 0 ? '+' : '-'} ${format(Math.abs(p.c))}`,
    controls: [{ key: 'a', label: 'Escala a', min: -12, max: 12, step: 0.05 }, { key: 'k', label: 'Tasa k', min: -1, max: 1, step: 0.02 }, { key: 'c', label: 'Traslación c', min: -4, max: 6, step: 0.05 }],
  },
}

export const FunctionFitLab = () => {
  const [datasetId, setDatasetId] = useState('medication')
  const [modelId, setModelId] = useState('exponential')
  const dataset = datasets.find((item) => item.id === datasetId) || datasets[0]
  const model = models[modelId]
  const [params, setParams] = useState(model.params)

  const points = dataset.points.map(([x, y]) => ({ x, y }))
  const curve = sampleRange(0, Math.max(...points.map((point) => point.x)), 160, (x) => model.fn(x, params))
  const residuals = points.map((point) => ({ ...point, residual: point.y - model.fn(point.x, params) }))
  const mae = residuals.reduce((sum, point) => sum + Math.abs(point.residual), 0) / residuals.length
  const mse = residuals.reduce((sum, point) => sum + (point.residual ** 2), 0) / residuals.length

  const axis = useAxisRange({
    xMin: 0,
    xMax: 6.5,
    yMin: 0,
    yMax: Math.max(...points.map((point) => point.y), ...curve.map((point) => point.y)) * 1.15,
  })

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-4">
          <LabCard title="Selección del problema" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Ajuste de funciones a datos</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">Aquí la pregunta ya no es solo cómo se ve una familia, sino cuál describe mejor un conjunto de datos.</p>
          </LabCard>
          <LabCard title="Conjunto de datos">
            <div className="grid gap-3">
              {datasets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setDatasetId(item.id); axis.resetRange() }}
                  className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${item.id === dataset.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper text-ink hover:border-ink/30'}`}
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className={`mt-1 text-sm leading-6 ${item.id === dataset.id ? 'text-paper/72' : 'text-ink/65'}`}>{item.context}</p>
                </button>
              ))}
            </div>
          </LabCard>
        </div>

        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
              <p className="text-xs uppercase tracking-[0.28em] text-paper/80">Comparación modelo vs. datos</p>
              <h3 className="mt-3 font-display text-3xl">La curva de ajuste sobre las observaciones</h3>
              <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-white/6 p-4">
                <CartesianFrame
                  xMin={axis.xMin}
                  xMax={axis.xMax}
                  yMin={axis.yMin}
                  yMax={axis.yMax}
                  xTicks={generateTicks(axis.xMin, axis.xMax)}
                  yTicks={generateTicks(axis.yMin, axis.yMax)}
                  xLabel={dataset.xName}
                  yLabel={dataset.yName}
                  className="w-full h-auto aspect-[5/4] overflow-hidden rounded-[1.1rem]"
                >
                  {({ scaleX, scaleY }) => (
                    <>
                      <path d={linePath(curve, scaleX, scaleY)} fill="none" stroke="rgba(255,107,53,0.98)" strokeWidth="4.8" strokeLinecap="round" />
                      {points.map((point) => (
                        <circle key={`${point.x}-${point.y}`} cx={scaleX(point.x)} cy={scaleY(point.y)} r="6" fill="rgba(199,244,100,0.95)" stroke="rgba(18,23,35,0.45)" strokeWidth="2" />
                      ))}
                    </>
                  )}
                </CartesianFrame>
              </div>
              <AxisRangePanel {...axis} />

              <div className="mt-3">
                <LiveFormula
                  label="Modelo de ajuste evaluado"
                  general={model.generalModel}
                  evaluated={model.formula(params)}
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <MetricCard label="Error cuadrático medio" value={format(mse)} detail="Resume cuán lejos está el modelo de los datos." />
                <MetricCard label="Error absoluto medio" value={format(mae)} detail="Desviación media de las predicciones." />
                <MetricCard label="Modelo actual" value={model.label} detail="Familia elegida para interpretar el fenómeno." className="md:col-span-2" valueClassName="text-[1.55rem]" />
              </div>
            </LabCard>

            <LabCard title="Modelo y parámetros">
              <div className="flex flex-wrap gap-2">
                {Object.entries(models).map(([key, item]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setModelId(key)
                      setParams(item.params)
                      axis.resetRange()
                    }}
                    className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${modelId === key ? 'bg-ink text-paper' : 'border border-ink/10 bg-paper text-ink hover:border-ink/30'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                <ModelCard title="Modelo general" expression={model.generalModel} parameters={model.parameterSet} conditions={model.conditions} />
                <ModelCard title="Modelo actual" expression={model.formula(params)} />
              </div>
              <div className="mt-4 grid gap-4">
                {model.controls.map((control) => (
                  <SliderField
                    key={control.key}
                    id={`${modelId}-${control.key}`}
                    label={control.label}
                    value={params[control.key]}
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    onChange={(value) => setParams((current) => ({ ...current, [control.key]: value }))}
                  />
                ))}
              </div>
            </LabCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <LabCard title="Expresión del modelo">
              <div className="overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{model.formula(params)}</p>
              </div>
            </LabCard>
            <LabCard title="Residuales y descarga">
              <button
                type="button"
                onClick={() => downloadCsv([
                  ['x', 'dato', 'modelo', 'residual'],
                  ...residuals.map((row) => [format(row.x), format(row.y), format(model.fn(row.x, params)), format(row.residual)]),
                ], `ajuste-funciones-${dataset.id}-${modelId}.csv`)}
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

import { useState } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { LiveFormula } from './LiveFormula'
import { downloadCsv, format, generateTicks, linePath, sampleRange } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

const caseDefinitions = {
  single: {
    id: 'single',
    label: 'Una vertical y una horizontal',
    context: 'Caso básico para leer comportamiento a ambos lados de una discontinuidad.',
    xWindow: [-5, 7],
    yWindow: [-8, 8],
    initialParams: { a: 2, h: 1, c: 1 },
    controls: [
      { key: 'a', label: 'Escala a', min: -5, max: 5, step: 0.1 },
      { key: 'h', label: 'Asíntota vertical h', min: -2, max: 4, step: 0.1 },
      { key: 'c', label: 'Asíntota horizontal c', min: -4, max: 4, step: 0.1 },
    ],
    generalModel: String.raw`f(x) = \frac{a}{x - h} + c`,
    parameterSet: 'a, h, c ∈ R',
    conditions: 'x ≠ h',
    buildModel: (params) => ({
      fn: (x) => (params.a / (x - params.h)) + params.c,
      verticals: [params.h],
      horizontal: params.c,
      references: [`Asíntota vertical: x = ${format(params.h)}`, `Asíntota horizontal: y = ${format(params.c)}`],
      formula: `f(x) = \\frac{${format(params.a)}}{x - ${format(params.h)}} ${params.c >= 0 ? '+' : '-'} ${format(Math.abs(params.c))}`,
      reading: 'Mover a cambia la apertura de las ramas. Mover h traslada la discontinuidad; mover c desplaza la asíntota horizontal.',
    }),
  },
  double: {
    id: 'double',
    label: 'Dos verticales y una horizontal',
    context: 'Permite distinguir ramas y análisis por intervalos.',
    xWindow: [-6, 6],
    yWindow: [-8, 8],
    initialParams: { a: 4, r1: -1, r2: 2, c: 0 },
    controls: [
      { key: 'a', label: 'Escala a', min: -8, max: 8, step: 0.1 },
      { key: 'r1', label: 'Asíntota r1', min: -4, max: 1, step: 0.1 },
      { key: 'r2', label: 'Asíntota r2', min: 0.5, max: 4, step: 0.1 },
      { key: 'c', label: 'Traslación c', min: -3, max: 3, step: 0.1 },
    ],
    generalModel: String.raw`f(x) = \frac{a}{(x - r_1)(x - r_2)} + c`,
    parameterSet: 'a, r1, r2, c ∈ R',
    conditions: 'x ≠ r1, x ≠ r2',
    buildModel: (params) => {
      const left = Math.min(params.r1, params.r2)
      const right = Math.max(params.r1, params.r2)

      return {
        fn: (x) => (params.a / ((x - left) * (x - right))) + params.c,
        verticals: [left, right],
        horizontal: params.c,
        references: [`Asíntotas verticales: x = ${format(left)}, x = ${format(right)}`, `Asíntota horizontal: y = ${format(params.c)}`],
        formula: `f(x) = \\frac{${format(params.a)}}{(x - ${format(left)})(x - ${format(right)})} ${params.c >= 0 ? '+' : '-'} ${format(Math.abs(params.c))}`,
        reading: 'Mover r1 y r2 separa o acerca las discontinuidades. Mover a cambia la apertura y el signo de las ramas.',
      }
    },
  },
  oblique: {
    id: 'oblique',
    label: 'Una vertical y una oblicua',
    context: 'Destaca una asíntota oblicua además de la discontinuidad.',
    xWindow: [-6, 7],
    yWindow: [-10, 10],
    initialParams: { m: 1, b: 1, a: 2, h: 1 },
    controls: [
      { key: 'm', label: 'Pendiente m', min: -2, max: 2, step: 0.1 },
      { key: 'b', label: 'Intercepto b', min: -4, max: 4, step: 0.1 },
      { key: 'a', label: 'Escala a', min: -6, max: 6, step: 0.1 },
      { key: 'h', label: 'Asíntota vertical h', min: -2, max: 4, step: 0.1 },
    ],
    generalModel: String.raw`f(x) = mx + b + \frac{a}{x - h}`,
    parameterSet: 'm, b, a, h ∈ R',
    conditions: 'x ≠ h',
    buildModel: (params) => ({
      fn: (x) => (params.m * x) + params.b + (params.a / (x - params.h)),
      verticals: [params.h],
      oblique: { m: params.m, b: params.b },
      references: [`Asíntota vertical: x = ${format(params.h)}`, `Asíntota oblicua: y = ${format(params.m)}x ${params.b >= 0 ? '+' : '-'} ${format(Math.abs(params.b))}`],
      formula: `f(x) = ${format(params.m)}x ${params.b >= 0 ? '+' : '-'} ${format(Math.abs(params.b))} + \\frac{${format(params.a)}}{x - ${format(params.h)}}`,
      reading: 'La recta oblicua cambia con m y b. El término fraccionario controla cómo la curva se separa de esa recta cerca de la discontinuidad.',
    }),
  },
}

const buildSegments = (verticals, xWindow, fn) => {
  const sorted = [...verticals].sort((left, right) => left - right)
  const boundaries = [xWindow[0], ...sorted, xWindow[1]]

  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]
    const padStart = index === 0 ? start : start + 0.08
    const padEnd = index === boundaries.length - 2 ? end : end - 0.08

    return sampleRange(padStart, padEnd, 140, fn)
  })
}

export const FunctionRationalLab = () => {
  const [caseId, setCaseId] = useState('single')
  const [paramsByCase, setParamsByCase] = useState(Object.fromEntries(
    Object.values(caseDefinitions).map((item) => [item.id, item.initialParams]),
  ))
  const config = caseDefinitions[caseId]
  const params = paramsByCase[caseId]
  const model = config.buildModel(params)
  const segments = buildSegments(model.verticals, config.xWindow, model.fn)

  const axis = useAxisRange({ xMin: config.xWindow[0], xMax: config.xWindow[1], yMin: config.yWindow[0], yMax: config.yWindow[1] })

  const updateParam = (key, value) => {
    setParamsByCase((current) => ({
      ...current,
      [caseId]: {
        ...current[caseId],
        [key]: value,
      },
    }))
  }

  const handleCaseChange = (id) => {
    setCaseId(id)
    axis.resetRange()
  }

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-4">
          <LabCard title="Casos de estudio" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Funciones racionales</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">Estas funciones merecen un laboratorio propio porque la lectura de asíntotas y discontinuidades pide más cuidado.</p>
          </LabCard>

          <LabCard title="Configuración">
            <div className="grid gap-3">
              {Object.values(caseDefinitions).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleCaseChange(item.id)}
                  className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${item.id === config.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper text-ink hover:border-ink/30'}`}
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className={`mt-1 text-sm leading-6 ${item.id === config.id ? 'text-paper/72' : 'text-ink/65'}`}>{item.context}</p>
                </button>
              ))}
            </div>
          </LabCard>

          <LabCard title="Parámetros del modelo">
            <div className="space-y-3">
              <ModelCard title="Modelo general" expression={config.generalModel} parameters={config.parameterSet} conditions={config.conditions} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              {config.controls.map((control) => (
                <SliderField
                  key={control.key}
                  id={`${caseId}-${control.key}`}
                  label={control.label}
                  value={params[control.key]}
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  onChange={(value) => updateParam(control.key, value)}
                />
              ))}
            </div>
          </LabCard>
        </div>

        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <LabCard dark className="overflow-hidden rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
            <p className="text-xs uppercase tracking-[0.28em] text-paper/80">Lectura gráfica</p>
            <h3 className="mt-3 font-display text-3xl">Asíntotas, ramas y comportamiento por intervalos</h3>
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
                {({ scaleX, scaleY, padding, width, height }) => (
                  <>
                    {model.verticals.map((value) => (
                      <line key={value} x1={scaleX(value)} y1={padding} x2={scaleX(value)} y2={height - padding} stroke="rgba(84,214,201,0.96)" strokeWidth="1.4" strokeDasharray="6 6" />
                    ))}
                    {typeof model.horizontal === 'number' && (
                      <line x1={padding} y1={scaleY(model.horizontal)} x2={width - padding} y2={scaleY(model.horizontal)} stroke="rgba(84,214,201,0.96)" strokeWidth="1.4" strokeDasharray="6 6" />
                    )}
                    {model.oblique && (
                      <line
                        x1={scaleX(axis.xMin)}
                        y1={scaleY((model.oblique.m * axis.xMin) + model.oblique.b)}
                        x2={scaleX(axis.xMax)}
                        y2={scaleY((model.oblique.m * axis.xMax) + model.oblique.b)}
                        stroke="rgba(84,214,201,0.96)"
                        strokeWidth="1.4"
                        strokeDasharray="6 6"
                      />
                    )}
                    {segments.map((segment, index) => (
                      <path key={index} d={linePath(segment, scaleX, scaleY)} fill="none" stroke="rgba(255,107,53,0.98)" strokeWidth="4.8" strokeLinecap="round" />
                    ))}
                  </>
                )}
              </CartesianFrame>
            </div>

            <AxisRangePanel {...axis} />

            <div className="mt-3">
              <LiveFormula
                label="Modelo evaluado"
                general={config.generalModel}
                evaluated={model.formula}
                raw
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-paper/72">
              {model.references.map((reference) => (
                <div key={reference} className="rounded-full border border-white/10 bg-white/6 px-3 py-2">
                  {reference}
                </div>
              ))}
            </div>
          </LabCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <LabCard title="Lectura">
              <p className="text-sm leading-6 text-ink/68">{model.reading}</p>
            </LabCard>
            <LabCard title="Descarga">
              <button
                type="button"
                onClick={() => downloadCsv([
                  ['x', 'f(x)'],
                  ...Array.from({ length: 8 }, (_, index) => {
                    const x = config.xWindow[0] + (((config.xWindow[1] - config.xWindow[0]) * index) / 7)
                    return [format(x), format(model.fn(x))]
                  }).filter((row) => !row.includes('Infinity') && !row.includes('NaN')),
                ], `funciones-racionales-${config.id}.csv`)}
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

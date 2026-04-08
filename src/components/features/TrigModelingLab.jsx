import { useEffect, useMemo, useState } from 'react'
import { CartesianFrame, LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, linePath, sampleRange } from './derivaLabUtils'

const CONTEXTS = [
  {
    id: 'ferris',
    label: 'Rueda de la fortuna',
    description: 'Un pasajero sube a una rueda de 25 m de radio. ¿Cómo varía su altura mientras gira a velocidad constante?',
    xLabel: 'Tiempo', yLabel: 'Altura', xUnit: 'min', yUnit: 'm',
    baseFn: 'cos',
    data: [
      { x: 0, y: 2 }, { x: 1, y: 8.2 }, { x: 2, y: 27 }, { x: 3, y: 44.8 },
      { x: 4, y: 52 }, { x: 5, y: 44.8 }, { x: 6, y: 27 }, { x: 7, y: 8.2 },
      { x: 8, y: 2 }, { x: 9, y: 8.2 }, { x: 10, y: 27 }, { x: 11, y: 44.8 },
      { x: 12, y: 52 },
    ],
    idealParams: { a: -25, b: Math.PI / 4, h: 0, k: 27 },
    defaultParams: { a: -10, b: 0.5, h: 0, k: 25 },
    sliderConfig: {
      a: [-30, 30, 0.5], b: [0.1, 2, 0.01], h: [-4, 4, 0.1], k: [0, 55, 0.5],
    },
    xWindow: [-1, 14], yWindow: [-5, 58],
    xTicks: [0, 2, 4, 6, 8, 10, 12],
    yTicks: [0, 10, 20, 30, 40, 50],
    hint: 'El radio de la rueda determina la amplitud. El centro de la rueda fija la l\u00ednea media. Observa cu\u00e1nto tarda en completar un giro para deducir el per\u00edodo.',
  },
  {
    id: 'tides',
    label: 'Mareas',
    description: 'El nivel del agua en un puerto sube y baja con las mareas. Se registra cada hora durante un día completo.',
    xLabel: 'Hora', yLabel: 'Nivel', xUnit: 'h', yUnit: 'm',
    baseFn: 'cos',
    data: [
      { x: 0, y: 3.8 }, { x: 1, y: 4.6 }, { x: 2, y: 5.5 }, { x: 3, y: 6.0 },
      { x: 4, y: 5.8 }, { x: 5, y: 5.0 }, { x: 6, y: 3.9 }, { x: 7, y: 2.8 },
      { x: 8, y: 2.4 }, { x: 9, y: 2.6 }, { x: 10, y: 3.4 }, { x: 11, y: 4.5 },
      { x: 12, y: 5.5 }, { x: 13, y: 5.9 }, { x: 14, y: 5.6 }, { x: 15, y: 4.8 },
      { x: 16, y: 3.6 }, { x: 17, y: 2.6 }, { x: 18, y: 2.3 }, { x: 19, y: 2.5 },
      { x: 20, y: 3.3 }, { x: 21, y: 4.4 }, { x: 22, y: 5.3 }, { x: 23, y: 5.9 },
      { x: 24, y: 5.7 },
    ],
    idealParams: { a: 1.8, b: 2 * Math.PI / 12.4, h: 3, k: 4.2 },
    defaultParams: { a: 1, b: 0.4, h: 0, k: 4 },
    sliderConfig: {
      a: [-4, 4, 0.1], b: [0.1, 1.5, 0.01], h: [-6, 6, 0.1], k: [1, 7, 0.1],
    },
    xWindow: [-1, 25], yWindow: [0, 8],
    xTicks: [0, 4, 8, 12, 16, 20, 24],
    yTicks: [0, 2, 4, 6, 8],
    hint: 'Las mareas tienen un ciclo de ~12.4 horas. La amplitud es la mitad de la diferencia entre marea alta y baja. Localiza el primer m\u00e1ximo para estimar la fase.',
  },
  {
    id: 'daylight',
    label: 'Horas de luz solar',
    description: 'A lo largo del año, los días se alargan y se acortan. Se miden las horas de luz solar en una ciudad a 45° de latitud norte.',
    xLabel: 'D\u00eda del a\u00f1o', yLabel: 'Horas de luz', xUnit: 'd\u00edas', yUnit: 'h',
    baseFn: 'sin',
    data: [
      { x: 1, y: 9.1 }, { x: 32, y: 9.8 }, { x: 60, y: 11.0 }, { x: 91, y: 12.7 },
      { x: 121, y: 14.1 }, { x: 152, y: 15.1 }, { x: 172, y: 15.4 }, { x: 182, y: 15.3 },
      { x: 213, y: 14.5 }, { x: 244, y: 13.2 }, { x: 274, y: 11.8 }, { x: 305, y: 10.3 },
      { x: 335, y: 9.2 }, { x: 356, y: 9.0 }, { x: 365, y: 9.1 },
    ],
    idealParams: { a: 3.2, b: 2 * Math.PI / 365, h: 80, k: 12.2 },
    defaultParams: { a: 2, b: 0.015, h: 50, k: 12 },
    sliderConfig: {
      a: [-6, 6, 0.1], b: [0.005, 0.04, 0.001], h: [0, 180, 1], k: [8, 16, 0.1],
    },
    xWindow: [-10, 380], yWindow: [6, 18],
    xTicks: [0, 60, 120, 180, 240, 300, 365],
    yTicks: [6, 8, 10, 12, 14, 16, 18],
    hint: 'El solsticio de verano (~d\u00eda 172) marca el m\u00e1ximo. El equinoccio de primavera (~d\u00eda 80) es cuando las horas cruzan el promedio. La diferencia entre el d\u00eda m\u00e1s largo y m\u00e1s corto da la amplitud.',
  },
  {
    id: 'temperature',
    label: 'Temperatura diaria',
    description: 'La temperatura sube desde el amanecer, alcanza un máximo por la tarde y vuelve a bajar durante la noche. Datos de un día de verano.',
    xLabel: 'Hora', yLabel: 'Temperatura', xUnit: 'h', yUnit: '\u00b0C',
    baseFn: 'sin',
    data: [
      { x: 0, y: 18 }, { x: 2, y: 17.2 }, { x: 4, y: 17 }, { x: 6, y: 18.5 },
      { x: 8, y: 21 }, { x: 10, y: 25 }, { x: 12, y: 28.5 }, { x: 14, y: 30.8 },
      { x: 16, y: 30 }, { x: 18, y: 27.5 }, { x: 20, y: 24 }, { x: 22, y: 20.5 },
      { x: 24, y: 18 },
    ],
    idealParams: { a: 7, b: 2 * Math.PI / 24, h: 10, k: 24 },
    defaultParams: { a: 4, b: 0.2, h: 6, k: 22 },
    sliderConfig: {
      a: [-12, 12, 0.1], b: [0.1, 0.8, 0.01], h: [-6, 18, 0.5], k: [15, 32, 0.5],
    },
    xWindow: [-1, 25], yWindow: [12, 35],
    xTicks: [0, 4, 8, 12, 16, 20, 24],
    yTicks: [14, 18, 22, 26, 30, 34],
    hint: 'La temperatura m\u00e1xima se alcanza cerca de las 14-15h, no al mediod\u00eda. La amplitud es la mitad de la diferencia entre m\u00e1ximo y m\u00ednimo. El ciclo dura 24 horas.',
  },
]

export const TrigModelingLab = () => {
  const [contextId, setContextId] = useState('ferris')
  const [a, setA] = useState(CONTEXTS[0].defaultParams.a)
  const [b, setB] = useState(CONTEXTS[0].defaultParams.b)
  const [h, setH] = useState(CONTEXTS[0].defaultParams.h)
  const [k, setK] = useState(CONTEXTS[0].defaultParams.k)
  const [showResiduals, setShowResiduals] = useState(false)
  const [showGuides, setShowGuides] = useState(true)
  const [showHint, setShowHint] = useState(false)

  const ctx = CONTEXTS.find((c) => c.id === contextId) || CONTEXTS[0]

  useEffect(() => {
    const c = CONTEXTS.find((c) => c.id === contextId) || CONTEXTS[0]
    setA(c.defaultParams.a)
    setB(c.defaultParams.b)
    setH(c.defaultParams.h)
    setK(c.defaultParams.k)
    setShowHint(false)
  }, [contextId])

  const baseFn = ctx.baseFn === 'cos' ? Math.cos : Math.sin
  const symbol = ctx.baseFn === 'cos' ? 'cos' : 'sen'

  const modelCurve = useMemo(
    () => sampleRange(ctx.xWindow[0], ctx.xWindow[1], 400, (x) => a * baseFn(b * (x - h)) + k),
    [a, b, h, k, baseFn, ctx.xWindow],
  )

  const residuals = useMemo(() => ctx.data.map((pt) => {
    const yModel = a * baseFn(b * (pt.x - h)) + k
    return { x: pt.x, yData: pt.y, yModel, residual: pt.y - yModel }
  }), [a, b, h, k, baseFn, ctx.data])

  const ssr = useMemo(() => residuals.reduce((sum, r) => sum + r.residual * r.residual, 0), [residuals])
  const rmse = useMemo(() => Math.sqrt(ssr / residuals.length), [ssr, residuals.length])

  const period = (2 * Math.PI) / Math.abs(b)

  const qualityThresholds = { ferris: 3, tides: 0.4, daylight: 0.6, temperature: 2 }
  const threshold = qualityThresholds[contextId] || 2
  const quality = rmse <= threshold ? 'excelente' : rmse <= threshold * 2.5 ? 'aceptable' : 'pobre'
  const qualityColor = quality === 'excelente' ? 'bg-emerald-500' : quality === 'aceptable' ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.76fr_1.24fr]">
        {/* Left column */}
        <div className="space-y-4">
          <LabCard title="Modelaci\u00f3n trigonom\u00e9trica" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">
              Modelos en contexto
            </h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              Ajusta los par\u00e1metros del modelo trigonom\u00e9trico para describir fen\u00f3menos peri\u00f3dicos reales.
            </p>
          </LabCard>

          <LabCard title="Contexto">
            <div className="mt-2 grid gap-3">
              {CONTEXTS.map((c) => (
                <button key={c.id} type="button" onClick={() => setContextId(c.id)}
                  className={`rounded-[1.2rem] border px-4 py-3 text-left transition-colors ${
                    contextId === c.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper text-ink hover:border-ink/30'
                  }`}>
                  <p className="font-semibold">{c.label}</p>
                  <p className={`mt-1 text-sm leading-6 ${contextId === c.id ? 'text-paper/72' : 'text-ink/65'}`}>{c.description}</p>
                </button>
              ))}
            </div>
          </LabCard>

          <SliderField id="tm-a" label={`Amplitud a (${ctx.yUnit})`} value={a}
            min={ctx.sliderConfig.a[0]} max={ctx.sliderConfig.a[1]} step={ctx.sliderConfig.a[2]} onChange={setA} />
          <SliderField id="tm-b" label="Frecuencia b" value={b}
            min={ctx.sliderConfig.b[0]} max={ctx.sliderConfig.b[1]} step={ctx.sliderConfig.b[2]} onChange={setB} />
          <SliderField id="tm-h" label={`Fase h (${ctx.xUnit})`} value={h}
            min={ctx.sliderConfig.h[0]} max={ctx.sliderConfig.h[1]} step={ctx.sliderConfig.h[2]} onChange={setH} />
          <SliderField id="tm-k" label={`L\u00ednea media k (${ctx.yUnit})`} value={k}
            min={ctx.sliderConfig.k[0]} max={ctx.sliderConfig.k[1]} step={ctx.sliderConfig.k[2]} onChange={setK} />

          <div className="flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-[1.2rem] border border-ink/10 bg-white/82 px-4 py-3 text-sm font-semibold text-ink">
              <input type="checkbox" checked={showResiduals} onChange={(e) => setShowResiduals(e.target.checked)} className="accent-[#54d6c9]" />
              Mostrar residuos
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-[1.2rem] border border-ink/10 bg-white/82 px-4 py-3 text-sm font-semibold text-ink">
              <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} className="accent-[#54d6c9]" />
              Mostrar gu\u00edas
            </label>
          </div>

          <LabCard title="Pista pedag\u00f3gica">
            <button type="button" onClick={() => setShowHint((v) => !v)}
              className="mt-2 text-sm font-semibold text-aqua underline underline-offset-2">
              {showHint ? 'Ocultar pista' : 'Mostrar pista'}
            </button>
            {showHint && <p className="mt-3 text-sm leading-6 text-ink/68">{ctx.hint}</p>}
          </LabCard>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
            <div className="max-w-3xl">
              <p className="text-[0.65rem] uppercase tracking-[0.28em] text-paper/45">{ctx.label}</p>
              <h3 className="mt-3 font-display text-[clamp(2rem,3.6vw,3.2rem)] leading-[0.98] tracking-[-0.04em]">
                {ctx.yLabel} vs. {ctx.xLabel}
              </h3>
              <p className="mt-3 text-sm leading-6 text-paper/72">{ctx.description}</p>
            </div>
            <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-white/6 p-4">
              <CartesianFrame
                xMin={ctx.xWindow[0]} xMax={ctx.xWindow[1]}
                yMin={ctx.yWindow[0]} yMax={ctx.yWindow[1]}
                xTicks={ctx.xTicks} yTicks={ctx.yTicks}
                className="w-full h-auto aspect-[16/9] overflow-hidden rounded-[1.1rem]"
              >
                {({ scaleX, scaleY, padding, width, height }) => (
                  <>
                    {/* Guide lines: max, midline, min */}
                    {showGuides && (
                      <>
                        <line x1={padding} y1={scaleY(k + Math.abs(a))} x2={width - padding} y2={scaleY(k + Math.abs(a))}
                          stroke="rgba(84,214,201,0.4)" strokeWidth="1" strokeDasharray="6 6" />
                        <line x1={padding} y1={scaleY(k)} x2={width - padding} y2={scaleY(k)}
                          stroke="rgba(84,214,201,0.7)" strokeWidth="1.4" strokeDasharray="6 6" />
                        <line x1={padding} y1={scaleY(k - Math.abs(a))} x2={width - padding} y2={scaleY(k - Math.abs(a))}
                          stroke="rgba(84,214,201,0.4)" strokeWidth="1" strokeDasharray="6 6" />
                      </>
                    )}

                    {/* Model curve (aqua) */}
                    <path d={linePath(modelCurve, scaleX, scaleY)} fill="none"
                      stroke="rgba(84,214,201,0.95)" strokeWidth="3.5" strokeLinecap="round" />

                    {/* Residual bars */}
                    {showResiduals && residuals.map((r, i) => (
                      <line key={`res-${i}`}
                        x1={scaleX(r.x)} y1={scaleY(r.yData)}
                        x2={scaleX(r.x)} y2={scaleY(r.yModel)}
                        stroke={r.residual >= 0 ? 'rgba(96,165,250,0.7)' : 'rgba(248,113,113,0.7)'}
                        strokeWidth="2" />
                    ))}

                    {/* Data points (orange) */}
                    {ctx.data.map((pt, i) => (
                      <circle key={`pt-${i}`} cx={scaleX(pt.x)} cy={scaleY(pt.y)}
                        r={5} fill="rgba(255,107,53,0.95)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                    ))}
                  </>
                )}
              </CartesianFrame>
            </div>
          </LabCard>

          {/* Metrics */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Amplitud |a|" value={`${format(Math.abs(a))} ${ctx.yUnit}`}
              detail="Distancia de la l\u00ednea media al extremo" dark={false} />
            <MetricCard label="Per\u00edodo" value={`${format(period)} ${ctx.xUnit}`}
              detail="Duraci\u00f3n de un ciclo completo" dark={false} />
            <MetricCard label="Fase h" value={`${format(h)} ${ctx.xUnit}`}
              detail="Desplazamiento horizontal" dark={false} />
            <MetricCard label="L\u00ednea media k" value={`${format(k)} ${ctx.yUnit}`}
              detail="Referencia central de la oscilaci\u00f3n" dark={false} />
          </div>

          {/* Goodness of fit */}
          <LabCard title="Bondad del ajuste">
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.2rem] border border-ink/10 bg-paper px-4 py-4">
                <p className="text-[0.66rem] uppercase tracking-[0.2em] text-ink/45">RMSE</p>
                <p className="mt-2 font-display text-2xl font-semibold">{format(rmse)}</p>
              </div>
              <div className="rounded-[1.2rem] border border-ink/10 bg-paper px-4 py-4">
                <p className="text-[0.66rem] uppercase tracking-[0.2em] text-ink/45">SSR</p>
                <p className="mt-2 font-display text-2xl font-semibold">{format(ssr)}</p>
              </div>
              <div className="rounded-[1.2rem] border border-ink/10 bg-paper px-4 py-4">
                <p className="text-[0.66rem] uppercase tracking-[0.2em] text-ink/45">Calidad</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full ${qualityColor}`} />
                  <p className="font-display text-lg font-semibold capitalize">{quality}</p>
                </div>
              </div>
            </div>
          </LabCard>

          {/* Model card */}
          <ModelCard title="Modelo actual"
            expression={`${ctx.yLabel}(${ctx.xLabel.charAt(0).toLowerCase()}) = ${format(a)}\u00b7${symbol}(${format(b)}(${ctx.xLabel.charAt(0).toLowerCase()} ${h >= 0 ? '-' : '+'} ${format(Math.abs(h))})) ${k >= 0 ? '+' : '-'} ${format(Math.abs(k))}`}
            parameters={`a = ${format(a)}, b = ${format(b)}, h = ${format(h)}, k = ${format(k)}`} />

          {/* CSV Download */}
          <LabCard title="Descarga">
            <p className="text-sm leading-6 text-ink/68">Exporta los datos observados, el modelo y los residuos.</p>
            <button type="button"
              onClick={() => {
                const rows = [[`${ctx.xLabel} (${ctx.xUnit})`, `${ctx.yLabel} observado (${ctx.yUnit})`, `${ctx.yLabel} modelo (${ctx.yUnit})`, 'Residuo']]
                residuals.forEach((r) => rows.push([format(r.x), format(r.yData), format(r.yModel), format(r.residual)]))
                downloadCsv(rows, `modelacion-trig-${ctx.id}.csv`)
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white"
            >
              Descargar CSV
            </button>
          </LabCard>
        </div>
      </div>
    </div>
  )
}

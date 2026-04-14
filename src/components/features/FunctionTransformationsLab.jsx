import { useState } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, generateTicks, linePath, sampleRange } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

const bases = [
  { id: 'quadratic',    label: 'Cuadrática',   fn: (u) => u ** 2,                              formula: 'f(x) = x²',    substitute: (u) => `\\left(${u}\\right)^{2}`,  xWindow: [-6, 6],    yWindow: [-12, 12] },
  { id: 'cubic',        label: 'Cúbica',        fn: (u) => u ** 3,                              formula: 'f(x) = x³',    substitute: (u) => `\\left(${u}\\right)^{3}`,  xWindow: [-4.5, 4.5], yWindow: [-12, 12] },
  { id: 'exponential',  label: 'Exponencial',   fn: (u) => Math.exp(u),                         formula: 'f(x) = eˣ',    substitute: (u) => `e^{${u}}`,                  xWindow: [-5, 5],    yWindow: [-8, 12]  },
  { id: 'logarithmic',  label: 'Logarítmica',   fn: (u) => (u > 0 ? Math.log(u) : Number.NaN), formula: 'f(x) = ln(x)', substitute: (u) => `\\ln\\left(${u}\\right)`,  xWindow: [-6, 6],    yWindow: [-8, 8]   },
]

export const FunctionTransformationsLab = () => {
  const [baseId, setBaseId] = useState('quadratic')
  const [verticalScale, setVerticalScale] = useState(1.4)
  const [horizontalScale, setHorizontalScale] = useState(1.2)
  const [h, setH] = useState(1.1)
  const [k, setK] = useState(-1.4)
  const [flipVertical, setFlipVertical] = useState(false)
  const [flipHorizontal, setFlipHorizontal] = useState(false)

  const base = bases.find((item) => item.id === baseId) || bases[0]
  const a = flipVertical ? -verticalScale : verticalScale
  const b = flipHorizontal ? -horizontalScale : horizontalScale

  const axis = useAxisRange({
    xMin: base.xWindow[0], xMax: base.xWindow[1],
    yMin: base.yWindow[0], yMax: base.yWindow[1],
  })

  const basePoints = sampleRange(base.xWindow[0], base.xWindow[1], 220, (x) => base.fn(x))
  const transformedPoints = sampleRange(base.xWindow[0], base.xWindow[1], 220, (x) => {
    const u = b * (x - h)
    return a * base.fn(u) + k
  })

  const sign = (v, pos = '+', neg = '−') => (v >= 0 ? pos : neg)
  // signo de h se invierte: f(x − h) con h>0 se lee (x − h); con h<0 se lee (x + |h|)
  const inner = `${format(b)}(x ${sign(h, '−', '+')} ${format(Math.abs(h))})`
  const generalFormula = 'g(x) = a·f(b(x − h)) + k'
  const transformedFormula =
    `g(x) = ${format(a)}·${base.substitute(inner)} ${sign(k)} ${format(Math.abs(k))}`

  const handleBaseChange = (id) => {
    setBaseId(id)
    setVerticalScale(id === 'exponential' ? 1.2 : 1.4)
    setHorizontalScale(1.2)
    setH(id === 'logarithmic' ? -1 : 1.1)
    setK(id === 'quadratic' ? -1.4 : 0.8)
    setFlipVertical(false)
    setFlipHorizontal(false)
    axis.resetRange()
  }

  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── función base ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {bases.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleBaseChange(item.id)}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              baseId === item.id
                ? 'bg-ink text-paper shadow-[0_8px_20px_rgba(18,23,35,0.18)]'
                : 'border border-ink/12 bg-white text-ink hover:border-ink/24'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ── gráfica + controles ───────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="xl:sticky xl:top-4 xl:self-start">
          <LabCard
            dark
            title="Base y transformada sobre el mismo plano"
          >
            <div className="mt-4">
              <CartesianFrame
                width={580}
                height={340}
                xMin={axis.xMin}
                xMax={axis.xMax}
                yMin={axis.yMin}
                yMax={axis.yMax}
                dark
                xTicks={generateTicks(axis.xMin, axis.xMax)}
                yTicks={generateTicks(axis.yMin, axis.yMax)}
                xLabel="x"
                yLabel="f(x)"
              >
                {({ scaleX, scaleY, padding, width, height }) => (
                  <>
                    {/* referencia de traslación */}
                    {(base.id === 'quadratic' || base.id === 'logarithmic') && (
                      <line x1={scaleX(h)} y1={padding} x2={scaleX(h)} y2={height - padding}
                        stroke="rgba(84,214,201,0.5)" strokeWidth="1.2" strokeDasharray="6 5" />
                    )}
                    {base.id === 'exponential' && (
                      <line x1={padding} y1={scaleY(k)} x2={width - padding} y2={scaleY(k)}
                        stroke="rgba(84,214,201,0.5)" strokeWidth="1.2" strokeDasharray="6 5" />
                    )}
                    {/* curvas */}
                    <path d={linePath(basePoints, scaleX, scaleY)} fill="none"
                      stroke="rgba(84,214,201,0.85)" strokeWidth="2.5" strokeLinecap="round" />
                    <path d={linePath(transformedPoints, scaleX, scaleY)} fill="none"
                      stroke="rgba(255,107,53,0.95)" strokeWidth="3.5" strokeLinecap="round" />
                  </>
                )}
              </CartesianFrame>
            </div>
            <AxisRangePanel {...axis} />
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-paper/60">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5">
                <span className="font-semibold text-aqua">Base: </span>{base.formula}
              </span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5">
                <span className="font-semibold text-signal">g(x): </span>
                a={format(a)}, b={format(b)}, h={format(h)}, k={format(k)}
              </span>
            </div>
          </LabCard>
        </div>

        <div className="space-y-3">
          <SliderField id="tf-a" label="Escala vertical |a|"      value={verticalScale}   min={0.5} max={3}   step={0.05} onChange={setVerticalScale} />
          <SliderField id="tf-b" label="Factor horizontal |b|"    value={horizontalScale} min={0.5} max={2.5} step={0.05} onChange={setHorizontalScale} />
          <SliderField id="tf-h" label="Traslación horizontal h"  value={h}               min={-4}  max={4}   step={0.1}  onChange={setH} />
          <SliderField id="tf-k" label="Traslación vertical k"    value={k}               min={-5}  max={5}   step={0.1}  onChange={setK} />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFlipVertical((v) => !v)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                flipVertical
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/10 bg-white text-ink hover:border-ink/24'
              }`}
            >
              <p className="font-semibold">−f(x)</p>
              <p className={`mt-0.5 text-xs ${flipVertical ? 'text-paper/65' : 'text-ink/50'}`}>
                Reflexión en eje x
              </p>
            </button>
            <button
              type="button"
              onClick={() => setFlipHorizontal((v) => !v)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                flipHorizontal
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/10 bg-white text-ink hover:border-ink/24'
              }`}
            >
              <p className="font-semibold">f(−x)</p>
              <p className={`mt-0.5 text-xs ${flipHorizontal ? 'text-paper/65' : 'text-ink/50'}`}>
                Reflexión en eje y
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* ── fórmulas ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <ModelCard
          title="Función base"
          expression={base.formula}
          parameters={`Dominio visible: [${format(axis.xMin)}, ${format(axis.xMax)}]`}
        />
        <ModelCard
          title="Modelo general"
          expression={generalFormula}
          parameters="Forma paramétrica con a, b, h, k"
        />
        <ModelCard
          title="Modelo evaluado"
          expression={transformedFormula}
          parameters={`a = ${format(a)},  b = ${format(b)},  h = ${format(h)},  k = ${format(k)}`}
        />
      </div>

      {/* ── lectura ──────────────────────────────────────────────────────────── */}
      <LabCard dark title="Lectura matemática">
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-7 text-paper/80">
            <strong className="text-paper">h = {format(h)}</strong> desplaza la función{' '}
            {Math.abs(h) < 0.01
              ? 'sin traslación horizontal'
              : h > 0
                ? `${format(Math.abs(h))} unidades a la derecha`
                : `${format(Math.abs(h))} unidades a la izquierda`}.{' '}
            <strong className="text-paper">k = {format(k)}</strong> la desplaza{' '}
            {Math.abs(k) < 0.01
              ? 'sin traslación vertical'
              : k > 0
                ? `${format(Math.abs(k))} unidades hacia arriba`
                : `${format(Math.abs(k))} unidades hacia abajo`}.
          </p>
          <p className="text-sm leading-7 text-paper/80">
            Con <strong className="text-paper">|a| = {format(verticalScale)}</strong>
            {flipVertical ? ' y reflexión en eje x' : ''}, la función se{' '}
            {verticalScale > 1 ? 'estira verticalmente' : 'comprime verticalmente'}.{' '}
            La escala horizontal real es 1/|b| = {format(1 / horizontalScale)}, lo que{' '}
            {horizontalScale > 1 ? 'comprime' : 'estira'} la función horizontalmente
            {flipHorizontal ? ' y la refleja respecto del eje y' : ''}.
          </p>
        </div>
      </LabCard>

      {/* ── descarga ─────────────────────────────────────────────────────────── */}
      <LabCard title="Descarga">
        <button
          type="button"
          onClick={() => downloadCsv([
            ['x', 'f(x)', 'g(x)'],
            ...Array.from({ length: 12 }, (_, index) => {
              const x = base.xWindow[0] + (((base.xWindow[1] - base.xWindow[0]) * index) / 11)
              const fx = base.fn(x)
              const u = b * (x - h)
              const gx = a * base.fn(u) + k
              return [format(x), format(fx), format(gx)]
            }).filter((row) => !row.includes('NaN')),
          ], `transformaciones-${base.id}.csv`)}
          className="inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white"
        >
          Descargar CSV
        </button>
      </LabCard>
    </div>
  )
}

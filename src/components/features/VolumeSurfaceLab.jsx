import { useState, useMemo } from 'react'
import { CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, linePath, sampleRange } from './derivaLabUtils'

/* ── solids ──────────────────────────────────────────────────── */

const solids = [
  {
    id: 'cylinder',
    label: 'Cilindro',
    params: [
      { key: 'r', label: 'Radio (r)', min: 0.5, max: 12, step: 0.1, default: 5, unit: 'cm' },
      { key: 'h', label: 'Altura (h)', min: 0.5, max: 25, step: 0.1, default: 10, unit: 'cm' },
    ],
    volume: ({ r, h }) => Math.PI * r * r * h,
    surface: ({ r, h }) => 2 * Math.PI * r * r + 2 * Math.PI * r * h,
    // Given fixed V, compute h from r
    hFromVolume: (r, V) => V / (Math.PI * r * r),
    // Given fixed A, compute h from r (A = 2πr² + 2πrh → h = (A - 2πr²)/(2πr))
    hFromSurface: (r, A) => {
      const num = A - 2 * Math.PI * r * r
      return num > 0 ? num / (2 * Math.PI * r) : 0
    },
    sweepKey: 'r',
    volumeLabel: 'V = πr²h',
    surfaceLabel: 'A = 2πr² + 2πrh',
  },
  {
    id: 'cone',
    label: 'Cono',
    params: [
      { key: 'r', label: 'Radio (r)', min: 0.5, max: 12, step: 0.1, default: 5, unit: 'cm' },
      { key: 'h', label: 'Altura (h)', min: 0.5, max: 25, step: 0.1, default: 12, unit: 'cm' },
    ],
    volume: ({ r, h }) => (Math.PI / 3) * r * r * h,
    surface: ({ r, h }) => Math.PI * r * r + Math.PI * r * Math.sqrt(r * r + h * h),
    hFromVolume: (r, V) => (3 * V) / (Math.PI * r * r),
    hFromSurface: (r, A) => {
      // A = πr² + πr√(r²+h²) → πr√(r²+h²) = A-πr² → r²+h² = ((A-πr²)/(πr))² → h²
      const lat = (A - Math.PI * r * r) / (Math.PI * r)
      return lat > r ? Math.sqrt(lat * lat - r * r) : 0
    },
    sweepKey: 'r',
    volumeLabel: 'V = ⅓πr²h',
    surfaceLabel: 'A = πr² + πr√(r²+h²)',
  },
  {
    id: 'sphere',
    label: 'Esfera',
    params: [
      { key: 'r', label: 'Radio (r)', min: 0.5, max: 12, step: 0.1, default: 5, unit: 'cm' },
    ],
    volume: ({ r }) => (4 / 3) * Math.PI * r * r * r,
    surface: ({ r }) => 4 * Math.PI * r * r,
    sweepKey: 'r',
    volumeLabel: 'V = ⁴⁄₃πr³',
    surfaceLabel: 'A = 4πr²',
  },
  {
    id: 'prism',
    label: 'Prisma rectangular',
    params: [
      { key: 'a', label: 'Largo (a)', min: 0.5, max: 15, step: 0.1, default: 6, unit: 'cm' },
      { key: 'b', label: 'Ancho (b)', min: 0.5, max: 15, step: 0.1, default: 4, unit: 'cm' },
      { key: 'h', label: 'Altura (h)', min: 0.5, max: 15, step: 0.1, default: 8, unit: 'cm' },
    ],
    volume: ({ a, b, h }) => a * b * h,
    surface: ({ a, b, h }) => 2 * (a * b + a * h + b * h),
    hFromVolume: (a, V, b) => V / (a * b),
    hFromSurface: (a, A, b) => {
      const num = A - 2 * a * b
      return num > 0 ? num / (2 * (a + b)) : 0
    },
    sweepKey: 'a',
    volumeLabel: 'V = a · b · h',
    surfaceLabel: 'A = 2(ab + ah + bh)',
  },
]

/* ── SVG solid visualizations ────────────────────────────── */

function CylinderViz({ r, h }) {
  const svgW = 280, svgH = 220, cx = svgW / 2, pad = 20
  // Independent scales so r and h don't affect each other visually
  const maxR = 12, maxH = 25
  const scaleR = (svgW / 2 - pad - 20) / maxR
  const scaleH = (svgH - pad * 2 - 10) / maxH
  const pixR = r * scaleR
  const pixH = h * scaleH
  const ry = Math.max(pixR * 0.2, 5)
  const topY = (svgH - pixH) / 2
  const botY = topY + pixH

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      <path d={`M${cx - pixR},${topY} L${cx - pixR},${botY} A${pixR},${ry} 0 0,0 ${cx + pixR},${botY} L${cx + pixR},${topY}`} fill="rgba(80,150,255,0.1)" />
      <line x1={cx - pixR} y1={topY} x2={cx - pixR} y2={botY} stroke="#5096ff" strokeWidth="2" />
      <line x1={cx + pixR} y1={topY} x2={cx + pixR} y2={botY} stroke="#5096ff" strokeWidth="2" />
      <ellipse cx={cx} cy={botY} rx={pixR} ry={ry} fill="rgba(80,150,255,0.06)" stroke="#5096ff" strokeWidth="1.5" />
      <ellipse cx={cx} cy={topY} rx={pixR} ry={ry} fill="rgba(80,150,255,0.18)" stroke="#5096ff" strokeWidth="2" />
      <line x1={cx} y1={topY} x2={cx + pixR} y2={topY} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + pixR / 2} y={topY - 8} fill="#ff6b35" fontSize="10" textAnchor="middle" fontWeight="600">r = {format(r)}</text>
      <line x1={cx + pixR + 14} y1={topY} x2={cx + pixR + 14} y2={botY} stroke="#22c5a0" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + pixR + 24} y={(topY + botY) / 2} fill="#22c5a0" fontSize="10" dominantBaseline="middle" fontWeight="600">h = {format(h)}</text>
    </svg>
  )
}

function ConeViz({ r, h }) {
  const svgW = 280, svgH = 220, cx = svgW / 2, pad = 20
  // Independent scales: r and h each use their own max so one doesn't affect the other
  const maxR = 12, maxH = 25
  const scaleR = (svgW / 2 - pad - 20) / maxR
  const scaleH = (svgH - pad * 2 - 20) / maxH
  const coneW = r * scaleR
  const coneH = h * scaleH
  const tipY = pad + (svgH - pad * 2 - 20 - coneH) / 2
  const baseY = tipY + coneH

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      <polygon points={`${cx},${tipY} ${cx - coneW},${baseY} ${cx + coneW},${baseY}`} fill="rgba(80,150,255,0.12)" stroke="#5096ff" strokeWidth="2" />
      <ellipse cx={cx} cy={baseY} rx={coneW} ry={Math.max(coneW * 0.18, 4)} fill="rgba(80,150,255,0.08)" stroke="#5096ff" strokeWidth="1.5" />
      <line x1={cx} y1={tipY} x2={cx} y2={baseY} stroke="#22c5a0" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + 8} y={(tipY + baseY) / 2} fill="#22c5a0" fontSize="10" fontWeight="600">h = {format(h)}</text>
      <line x1={cx} y1={baseY} x2={cx + coneW} y2={baseY} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + coneW / 2} y={baseY + 16} fill="#ff6b35" fontSize="10" textAnchor="middle" fontWeight="600">r = {format(r)}</text>
      <circle cx={cx} cy={tipY} r="3" fill="#ff6b35" />
    </svg>
  )
}

function SphereViz({ r }) {
  const svgW = 280, svgH = 220, cx = svgW / 2, cy = svgH / 2
  const pixR = Math.min(r * 6, 90)

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      <circle cx={cx} cy={cy} r={pixR} fill="rgba(80,150,255,0.1)" stroke="#5096ff" strokeWidth="2" />
      <ellipse cx={cx} cy={cy} rx={pixR} ry={pixR * 0.3} fill="none" stroke="rgba(80,150,255,0.3)" strokeWidth="1" strokeDasharray="4 3" />
      <line x1={cx} y1={cy} x2={cx + pixR} y2={cy} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + pixR / 2} y={cy - 8} fill="#ff6b35" fontSize="10" textAnchor="middle" fontWeight="600">r = {format(r)}</text>
      <circle cx={cx} cy={cy} r="3" fill="#ff6b35" />
    </svg>
  )
}

function PrismViz({ a, b, h }) {
  const svgW = 280, svgH = 220
  // Independent scales
  const maxA = 15, maxB = 15, maxH = 15
  const scA = 80 / maxA
  const scB = 35 / maxB
  const scH = 110 / maxH
  const pw = a * scA, pd = b * scB, ph = h * scH
  // Front face origin — offset left to make room for depth going right
  const ox = (svgW - pw - pd) / 2
  const oy = (svgH - ph) / 2 + pd / 2

  // Vertices — depth goes upper-right
  const flt = [ox, oy]                    // front-left-top
  const frt = [ox + pw, oy]               // front-right-top
  const flb = [ox, oy + ph]               // front-left-bottom
  const frb = [ox + pw, oy + ph]          // front-right-bottom
  const brt = [ox + pw + pd, oy - pd]     // back-right-top
  const blt = [ox + pd, oy - pd]          // back-left-top
  const brb = [ox + pw + pd, oy + ph - pd] // back-right-bottom

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* Right side face */}
      <polygon
        points={`${frt[0]},${frt[1]} ${brt[0]},${brt[1]} ${brb[0]},${brb[1]} ${frb[0]},${frb[1]}`}
        fill="rgba(80,150,255,0.07)" stroke="#5096ff" strokeWidth="1.5"
      />
      {/* Top face */}
      <polygon
        points={`${flt[0]},${flt[1]} ${frt[0]},${frt[1]} ${brt[0]},${brt[1]} ${blt[0]},${blt[1]}`}
        fill="rgba(80,150,255,0.15)" stroke="#5096ff" strokeWidth="1.5"
      />
      {/* Front face */}
      <rect x={ox} y={oy} width={pw} height={ph} fill="rgba(80,150,255,0.1)" stroke="#5096ff" strokeWidth="2" />

      {/* Labels */}
      <text x={ox + pw / 2} y={oy + ph + 16} fill="#ff6b35" fontSize="10" textAnchor="middle" fontWeight="600">a = {format(a)}</text>
      <text x={ox - 10} y={oy + ph / 2} fill="#22c5a0" fontSize="10" textAnchor="end" dominantBaseline="middle" fontWeight="600">h = {format(h)}</text>
      <text x={(frt[0] + brt[0]) / 2} y={(frt[1] + brt[1]) / 2 - 6} fill="rgba(255,255,255,0.6)" fontSize="9" textAnchor="middle">b = {format(b)}</text>
    </svg>
  )
}

/* ── constraint modes ────────────────────────────────────── */

const constraintModes = [
  { id: 'free', label: 'Libre', desc: 'Explora V y A sin restricciones' },
  { id: 'fixV', label: 'Volumen fijo', desc: '¿Qué dimensiones minimizan el área?' },
  { id: 'fixA', label: 'Área fija', desc: '¿Qué dimensiones maximizan el volumen?' },
]

/* ── main component ─────────────────────────────────────────── */

export const VolumeSurfaceLab = () => {
  const [solidId, setSolidId] = useState('cylinder')
  const [constraint, setConstraint] = useState('free')
  const [fixedValue, setFixedValue] = useState(500)
  const solid = solids.find((s) => s.id === solidId) || solids[0]

  const [paramValues, setParamValues] = useState(() => {
    const init = {}
    solids.forEach((s) => s.params.forEach((p) => { init[`${s.id}-${p.key}`] = p.default }))
    return init
  })

  const getParam = (key) => paramValues[`${solidId}-${key}`] ?? solid.params.find((p) => p.key === key)?.default ?? 1
  const setParam = (key, val) => setParamValues((prev) => ({ ...prev, [`${solidId}-${key}`]: val }))

  // Build current params — may override h if constraint is active
  const currentParams = useMemo(() => {
    const p = {}
    solid.params.forEach((param) => { p[param.key] = getParam(param.key) })

    if (constraint === 'fixV' && solid.hFromVolume && solidId !== 'sphere') {
      if (solidId === 'prism') {
        p.h = Math.max(solid.hFromVolume(p.a, fixedValue, p.b), 0.1)
      } else {
        p.h = Math.max(solid.hFromVolume(p.r, fixedValue), 0.1)
      }
    } else if (constraint === 'fixA' && solid.hFromSurface && solidId !== 'sphere') {
      if (solidId === 'prism') {
        p.h = Math.max(solid.hFromSurface(p.a, fixedValue, p.b), 0.1)
      } else {
        p.h = Math.max(solid.hFromSurface(p.r, fixedValue), 0.1)
      }
    }
    return p
  }, [solidId, constraint, fixedValue, ...Object.values(paramValues)])

  const currentV = solid.volume(currentParams)
  const currentA = solid.surface(currentParams)
  const ratio = currentV / currentA

  // Graph data: sweep the main param, compute V and A
  const sweepParam = solid.params.find((p) => p.key === solid.sweepKey) || solid.params[0]

  const { graphV, graphA } = useMemo(() => {
    const gv = sampleRange(sweepParam.min, sweepParam.max, 200, (x) => {
      const p = { ...currentParams, [sweepParam.key]: x }
      // Recompute h under constraint
      if (constraint === 'fixV' && solid.hFromVolume && solidId !== 'sphere') {
        p.h = solidId === 'prism' ? Math.max(solid.hFromVolume(x, fixedValue, p.b), 0.01) : Math.max(solid.hFromVolume(x, fixedValue), 0.01)
      } else if (constraint === 'fixA' && solid.hFromSurface && solidId !== 'sphere') {
        p.h = solidId === 'prism' ? Math.max(solid.hFromSurface(x, fixedValue, p.b), 0.01) : Math.max(solid.hFromSurface(x, fixedValue), 0.01)
      }
      return solid.volume(p)
    })
    const ga = sampleRange(sweepParam.min, sweepParam.max, 200, (x) => {
      const p = { ...currentParams, [sweepParam.key]: x }
      if (constraint === 'fixV' && solid.hFromVolume && solidId !== 'sphere') {
        p.h = solidId === 'prism' ? Math.max(solid.hFromVolume(x, fixedValue, p.b), 0.01) : Math.max(solid.hFromVolume(x, fixedValue), 0.01)
      } else if (constraint === 'fixA' && solid.hFromSurface && solidId !== 'sphere') {
        p.h = solidId === 'prism' ? Math.max(solid.hFromSurface(x, fixedValue, p.b), 0.01) : Math.max(solid.hFromSurface(x, fixedValue), 0.01)
      }
      return solid.surface(p)
    })
    return { graphV: gv, graphA: ga }
  }, [solidId, constraint, fixedValue, ...Object.values(currentParams)])

  // Fixed Y axis
  const { yMax, xTicks, yTicks } = useMemo(() => {
    const allY = [...graphV, ...graphA].map((p) => p.y).filter(Number.isFinite)
    const rawMax = Math.max(...allY, 1)
    const yMx = rawMax * 1.1
    const xT = Array.from({ length: 6 }, (_, i) => parseFloat((sweepParam.min + (i / 5) * (sweepParam.max - sweepParam.min)).toPrecision(3)))
    const yT = Array.from({ length: 5 }, (_, i) => parseFloat(((i / 4) * yMx).toPrecision(3)))
    return { yMax: yMx, xTicks: xT, yTicks: yT }
  }, [solidId, constraint, fixedValue, ...Object.values(currentParams)])

  // Find optimum (min A for fixV, max V for fixA)
  const optimum = useMemo(() => {
    if (constraint === 'free' || solidId === 'sphere') return null
    const target = constraint === 'fixV' ? graphA : graphV
    let bestX = 0, bestY = constraint === 'fixV' ? Infinity : -Infinity
    target.forEach((p) => {
      if (constraint === 'fixV' ? p.y < bestY : p.y > bestY) {
        bestY = p.y; bestX = p.x
      }
    })
    return { x: bestX, y: bestY }
  }, [constraint, solidId, graphV, graphA])

  const handleCsv = () => {
    const header = [sweepParam.key, 'Volumen', 'Área']
    const rows = [header, ...graphV.map((p, i) => [p.x.toFixed(2), p.y.toFixed(2), graphA[i]?.y.toFixed(2) ?? ''])]
    downloadCsv(rows, `vol-area-${solidId}.csv`)
  }

  // Compute default fixed value when switching constraint
  const activateConstraint = (mode) => {
    setConstraint(mode)
    if (mode === 'fixV') setFixedValue(Math.round(currentV))
    else if (mode === 'fixA') setFixedValue(Math.round(currentA))
  }

  return (
    <div className="rounded-[2.2rem] border border-ink/12 bg-white p-4 shadow-[0_28px_70px_rgba(18,23,35,0.12)] md:p-6">
      {/* Solid selector */}
      <div className="flex flex-wrap gap-2">
        {solids.map((s) => (
          <button
            key={s.id}
            onClick={() => { setSolidId(s.id); setConstraint('free') }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${s.id === solidId ? 'bg-ink text-paper' : 'border border-ink/10 bg-paper text-ink/70 hover:border-ink/30'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Constraint mode */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink/50">Modo:</span>
        {constraintModes.map((m) => (
          <button
            key={m.id}
            onClick={() => activateConstraint(m.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${m.id === constraint ? 'bg-signal text-white' : 'border border-ink/10 bg-paper text-ink/60 hover:border-ink/30'}`}
            title={m.desc}
          >
            {m.label}
          </button>
        ))}
        {constraint !== 'free' && (
          <span className="ml-1 text-xs text-ink/50">
            {constraint === 'fixV' ? '→ ¿Qué r minimiza el área?' : '→ ¿Qué r maximiza el volumen?'}
          </span>
        )}
      </div>

      {/* Fixed value slider (when constraint active) */}
      {constraint !== 'free' && solidId !== 'sphere' && (
        <div className="mt-3">
          <SliderField
            id="fixed-val"
            label={constraint === 'fixV' ? 'Volumen fijo' : 'Área fija'}
            value={fixedValue}
            min={10}
            max={constraint === 'fixV' ? 5000 : 3000}
            step={10}
            suffix={constraint === 'fixV' ? ' cm³' : ' cm²'}
            onChange={setFixedValue}
          />
        </div>
      )}

      {/* Main grid: solid + graph */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* LEFT: solid + sliders + metrics */}
        <div className="space-y-3">
          <div className="rounded-[1.4rem] border border-white/10 bg-ink p-4">
            {solidId === 'cylinder' && <CylinderViz r={currentParams.r} h={currentParams.h} />}
            {solidId === 'cone' && <ConeViz r={currentParams.r} h={currentParams.h} />}
            {solidId === 'sphere' && <SphereViz r={currentParams.r} />}
            {solidId === 'prism' && <PrismViz a={currentParams.a} b={currentParams.b} h={currentParams.h} />}
          </div>

          {/* Dimension sliders — hide h when constrained */}
          {solid.params.map((p) => {
            const isConstrained = (constraint !== 'free' && p.key === 'h' && solidId !== 'sphere')
            if (isConstrained) return (
              <div key={p.key} className="rounded-[1.3rem] border border-ink/10 bg-white/82 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink/50">{p.label} <span className="text-xs text-ink/35">(calculada)</span></span>
                  <span className="font-display tabular-nums text-2xl text-ink">{format(currentParams[p.key])}{` ${p.unit}`}</span>
                </div>
              </div>
            )
            return (
              <SliderField
                key={`${solidId}-${p.key}`}
                id={`vs-${solidId}-${p.key}`}
                label={p.label}
                value={getParam(p.key)}
                min={p.min}
                max={p.max}
                step={p.step}
                suffix={` ${p.unit}`}
                onChange={(v) => setParam(p.key, v)}
              />
            )
          })}

          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Volumen" value={`${format(currentV)} cm³`} dark={constraint === 'fixA'} />
            <MetricCard label="Área superficial" value={`${format(currentA)} cm²`} dark={constraint === 'fixV'} />
            <MetricCard label="V / A" value={`${format(ratio)} cm`} dark={false} />
            {currentParams.h != null && (
              <MetricCard label="Proporción h/r" value={format(currentParams.h / (currentParams.r || currentParams.a || 1))} dark={false} />
            )}
          </div>
        </div>

        {/* RIGHT: graph */}
        <div className="space-y-3">
          <div className="rounded-[1.4rem] border border-white/10 bg-ink p-4">
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-paper/45">
              {constraint === 'fixV' ? `A(${sweepParam.key}) con V = ${fixedValue} cm³`
                : constraint === 'fixA' ? `V(${sweepParam.key}) con A = ${fixedValue} cm²`
                : `V y A vs ${sweepParam.key}`}
            </p>
            <CartesianFrame
              width={540}
              height={300}
              xMin={sweepParam.min}
              xMax={sweepParam.max}
              yMin={0}
              yMax={yMax}
              xTicks={xTicks}
              yTicks={yTicks}
              xLabel={`${sweepParam.key} (cm)`}
              yLabel={constraint === 'fixV' ? 'A (cm²)' : constraint === 'fixA' ? 'V (cm³)' : 'V, A'}
              dark
            >
              {({ scaleX, scaleY }) => (
                <>
                  {/* Volume curve */}
                  {(constraint !== 'fixV') && (
                    <path d={linePath(graphV, scaleX, scaleY)} fill="none" stroke="#5096ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                  {/* Area curve */}
                  {(constraint !== 'fixA') && (
                    <path d={linePath(graphA, scaleX, scaleY)} fill="none" stroke="#22c5a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                  {/* Both curves in free mode */}
                  {constraint === 'free' && (
                    <>
                      <path d={linePath(graphV, scaleX, scaleY)} fill="none" stroke="#5096ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={linePath(graphA, scaleX, scaleY)} fill="none" stroke="#22c5a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}
                  {/* Optimum marker */}
                  {optimum && Number.isFinite(optimum.y) && (
                    <>
                      <circle cx={scaleX(optimum.x)} cy={scaleY(optimum.y)} r="6" fill={constraint === 'fixV' ? '#22c5a0' : '#5096ff'} stroke="white" strokeWidth="2" />
                      <text x={scaleX(optimum.x) + 10} y={scaleY(optimum.y) - 8} fill={constraint === 'fixV' ? '#22c5a0' : '#5096ff'} fontSize="10" fontWeight="600">
                        {constraint === 'fixV' ? 'mín A' : 'máx V'} ({format(optimum.x)})
                      </text>
                    </>
                  )}
                  {/* Current position */}
                  <circle cx={scaleX(getParam(sweepParam.key))} cy={scaleY(constraint === 'fixV' ? currentA : currentV)} r="5" fill="#ff6b35" stroke="white" strokeWidth="2" />
                  <line x1={scaleX(getParam(sweepParam.key))} y1={scaleY(0)} x2={scaleX(getParam(sweepParam.key))} y2={scaleY(constraint === 'fixV' ? currentA : currentV)} stroke="#ff6b35" strokeWidth="1" strokeDasharray="4 3" />
                </>
              )}
            </CartesianFrame>
          </div>

          {/* Legend + CSV */}
          <div className="flex flex-wrap items-center gap-3">
            {constraint !== 'fixV' && (
              <div className="flex items-center gap-2 rounded-full border border-[#5096ff]/25 bg-[#5096ff]/10 px-4 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#5096ff]" />
                <span className="text-sm font-semibold tabular-nums text-ink">V = {format(currentV)} cm³</span>
              </div>
            )}
            {constraint !== 'fixA' && (
              <div className="flex items-center gap-2 rounded-full border border-graph/25 bg-graph/10 px-4 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-graph" />
                <span className="text-sm font-semibold tabular-nums text-ink">A = {format(currentA)} cm²</span>
              </div>
            )}
            <button onClick={handleCsv} className="rounded-full border border-ink/10 bg-paper px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-ink/30">CSV</button>
          </div>

          {/* Modeling insight */}
          {constraint !== 'free' && optimum && (
            <LabCard title="Hallazgo de modelación" dark>
              <p className="mt-2 text-sm leading-6 text-paper/75">
                {constraint === 'fixV'
                  ? `Para un volumen fijo de ${fixedValue} cm³, el área superficial se minimiza cuando ${sweepParam.key} ≈ ${format(optimum.x)} cm (${format(optimum.y)} cm²). Esa es la forma más eficiente.`
                  : `Para un área fija de ${fixedValue} cm², el volumen se maximiza cuando ${sweepParam.key} ≈ ${format(optimum.x)} cm (${format(optimum.y)} cm³).`
                }
              </p>
            </LabCard>
          )}
        </div>
      </div>
    </div>
  )
}

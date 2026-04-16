import { useState } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, generateTicks, linePath, sampleRange } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

/* ── Escenarios ───────────────────────────────────────────────── */

const scenarios = [
  {
    id: 'ladder',
    label: 'Escalera deslizante',
    context: 'Una escalera se desliza por una pared: la base se aleja y la cima baja.',
    equation: 'x² + y² = L²',
    relation: 'dy/dt = −(x/y)·(dx/dt)',
  },
  {
    id: 'cone',
    label: 'Cono llenándose',
    context: 'Agua entra en un cono invertido a tasa constante. ¿Qué tan rápido sube el nivel?',
    equation: 'V = ⅓·π·(R/H)²·h³',
    relation: 'dh/dt = (dV/dt) / [π·(R/H)²·h²]',
  },
  {
    id: 'lighthouse',
    label: 'Faro giratorio',
    context: 'Un faro gira y su haz barre una costa recta. La velocidad del punto de luz se dispara.',
    equation: 'x = d·tan θ',
    relation: 'dx/dt = d·sec²θ·(dθ/dt)',
  },
]

/* ── Helpers ───────────────────────────────────────────────────── */

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

/* ── Ladder Scene ─────────────────────────────────────────────── */

const LadderScene = ({ time, dxdt, ladderL }) => {
  const x = clamp(1 + dxdt * time, 0.3, ladderL - 0.3)
  const y = Math.sqrt(Math.max(0.01, ladderL * ladderL - x * x))
  const dydt = y > 0.01 ? -(x / y) * dxdt : 0

  // Scene coordinates: 300x280 viewBox, wall on left, floor on bottom
  const wallX = 40
  const floorY = 250
  const scale = 28

  const baseX = wallX + x * scale
  const topY = floorY - y * scale

  // Rate graph data
  const graphFn = (t) => {
    const xt = clamp(1 + dxdt * t, 0.3, ladderL - 0.3)
    const yt = Math.sqrt(Math.max(0.01, ladderL * ladderL - xt * xt))
    return yt > 0.01 ? -(xt / yt) * dxdt : 0
  }
  const tMax = Math.min(20, (ladderL - 0.3 - 1) / Math.max(0.01, Math.abs(dxdt)))
  const ratePoints = sampleRange(0, Math.max(1, tMax), 120, graphFn)
  const rateVals = ratePoints.map((p) => p.y)
  const rMin = Math.min(-8, Math.floor(Math.min(...rateVals) - 1))
  const rMax = Math.max(2, Math.ceil(Math.max(...rateVals) + 1))

  const axis1 = useAxisRange({ xMin: 0, xMax: Math.max(1, tMax), yMin: rMin, yMax: rMax })

  return (
    <>
      {/* Animated scene */}
      <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
        <p className="text-xs uppercase tracking-[0.28em] text-paper/80">Escena</p>
        <h3 className="mt-2 font-display text-2xl">Escalera deslizándose</h3>
        <div className="mt-4 flex justify-center rounded-[1.3rem] border border-white/10 bg-white/6 p-4">
          <svg viewBox="0 0 300 280" className="h-auto w-full max-w-[380px]">
            {/* Wall */}
            <line x1={wallX} y1="20" x2={wallX} y2={floorY} stroke="rgba(255,255,255,0.5)" strokeWidth="3" />
            {/* Floor */}
            <line x1={wallX} y1={floorY} x2="280" y2={floorY} stroke="rgba(255,255,255,0.5)" strokeWidth="3" />
            {/* Ladder */}
            <line x1={baseX} y1={floorY} x2={wallX} y2={topY} stroke="#5096ff" strokeWidth="5" strokeLinecap="round" />
            {/* Base point */}
            <circle cx={baseX} cy={floorY} r="5" fill="#c7f464" />
            {/* Top point */}
            <circle cx={wallX} cy={topY} r="5" fill="#ff6b35" />
            {/* x label */}
            <text x={(wallX + baseX) / 2} y={floorY + 20} textAnchor="middle" fill="rgba(199,244,100,0.9)" fontSize="12" fontWeight="600">x = {format(x)}</text>
            {/* y label */}
            <text x={wallX - 8} y={(floorY + topY) / 2} textAnchor="end" fill="rgba(255,107,53,0.9)" fontSize="12" fontWeight="600">y = {format(y)}</text>
            {/* L label */}
            <text x={(wallX + baseX) / 2 + 12} y={(floorY + topY) / 2 - 8} textAnchor="start" fill="rgba(80,150,255,0.8)" fontSize="11">L = {ladderL}</text>
            {/* dx/dt arrow */}
            {dxdt > 0 && <polygon points={`${baseX + 12},${floorY - 8} ${baseX + 22},${floorY - 8} ${baseX + 22},${floorY - 14} ${baseX + 30},${floorY - 5} ${baseX + 22},${floorY + 4} ${baseX + 22},${floorY - 2} ${baseX + 12},${floorY - 2}`} fill="rgba(199,244,100,0.7)" />}
            {/* dy/dt arrow */}
            {dydt < -0.05 && <polygon points={`${wallX + 8},${topY + 12} ${wallX + 14},${topY + 12} ${wallX + 14},${topY + 22} ${wallX + 18},${topY + 22} ${wallX + 11},${topY + 30} ${wallX + 4},${topY + 22} ${wallX + 8},${topY + 22}`} fill="rgba(255,107,53,0.7)" />}
          </svg>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <MetricCard label="Posición base (x)" value={format(x)} detail={`dx/dt = ${format(dxdt)} m/s`} />
          <MetricCard label="Altura cima (y)" value={format(y)} detail={`dy/dt = ${format(dydt)} m/s`} />
        </div>
      </LabCard>

      {/* Rate graph */}
      <LabCard dark className="rounded-[1.9rem]">
        <p className="text-xs uppercase tracking-[0.28em] text-paper/80">Tasa desconocida</p>
        <h3 className="mt-2 font-display text-xl">dy/dt a lo largo del tiempo</h3>
        <div className="mt-3 rounded-[1.3rem] border border-white/10 bg-white/6 p-3">
          <CartesianFrame xMin={axis1.xMin} xMax={axis1.xMax} yMin={axis1.yMin} yMax={axis1.yMax} xTicks={generateTicks(axis1.xMin, axis1.xMax)} yTicks={generateTicks(axis1.yMin, axis1.yMax)}>
            {({ scaleX, scaleY }) => (
              <>
                <path d={linePath(ratePoints, scaleX, scaleY)} fill="none" stroke="rgba(255,107,53,0.9)" strokeWidth="3" strokeLinecap="round" />
                <circle cx={scaleX(time)} cy={scaleY(dydt)} r="6" fill="#ff6b35" stroke="white" strokeWidth="2" />
              </>
            )}
          </CartesianFrame>
        </div>
        <AxisRangePanel {...axis1} />
        <p className="mt-3 text-sm leading-6 text-paper/60">Cuando y se acerca a 0, dy/dt se dispara hacia −∞. La cima cae cada vez más rápido.</p>
      </LabCard>
    </>
  )
}

/* ── Cone Scene ───────────────────────────────────────────────── */

const ConeScene = ({ time, dvdt, coneR, coneH }) => {
  const ratio = coneR / coneH
  // V(t) = dvdt * t, h from V = (π/3)(R/H)²h³
  const V = dvdt * time
  const h = clamp(Math.cbrt((3 * V) / (Math.PI * ratio * ratio)), 0, coneH)
  const r = ratio * h
  const dhdt = h > 0.01 ? dvdt / (Math.PI * ratio * ratio * h * h) : 0

  // Scene: inverted cone (vertex at bottom, open at top), 300x280
  const cx = 150
  const topY = 40       // wide open top
  const vertexY = 260   // vertex (tip) at bottom
  const coneHpx = vertexY - topY  // pixel height of cone
  const topRpx = 75     // pixel radius of the open top ellipse

  // Water level: h measured from vertex (bottom) upward
  const hFrac = h / coneH           // 0..1
  const waterYpx = vertexY - hFrac * coneHpx  // pixel y of water surface
  const waterRpx = hFrac * topRpx              // pixel radius at water level
  const ellipseRy = 14  // vertical radius for 3D ellipses

  // Rate graph
  const graphFn = (t) => {
    const Vt = dvdt * t
    const ht = clamp(Math.cbrt((3 * Vt) / (Math.PI * ratio * ratio)), 0.01, coneH)
    return dvdt / (Math.PI * ratio * ratio * ht * ht)
  }
  const tMax = Math.min(30, (Math.PI / 3) * ratio * ratio * (coneH ** 3) / Math.max(0.01, dvdt))
  const ratePoints = sampleRange(0.1, Math.max(1, Math.min(tMax, 30)), 120, graphFn)
  const rateVals = ratePoints.map((p) => p.y)
  const rMax = Math.min(50, Math.ceil(Math.max(...rateVals) + 1))

  const axis1 = useAxisRange({ xMin: 0, xMax: Math.max(1, Math.min(tMax, 30)), yMin: 0, yMax: rMax })

  return (
    <>
      <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
        <p className="text-xs uppercase tracking-[0.28em] text-paper/80">Escena</p>
        <h3 className="mt-2 font-display text-2xl">Cono llenándose</h3>
        <div className="mt-4 flex justify-center rounded-[1.3rem] border border-white/10 bg-white/6 p-4">
          <svg viewBox="0 0 300 300" className="h-auto w-full max-w-[380px]">
            <defs>
              <clipPath id="cone-clip">
                <path d={`M ${cx - topRpx} ${topY} L ${cx} ${vertexY} L ${cx + topRpx} ${topY} Z`} />
              </clipPath>
            </defs>

            {/* Water body — clipped to cone shape */}
            {h > 0.01 && (
              <g clipPath="url(#cone-clip)">
                {/* Water rectangle fills from vertex up to water level */}
                <rect x={cx - topRpx} y={waterYpx} width={topRpx * 2} height={vertexY - waterYpx} fill="rgba(80,150,255,0.30)" />
              </g>
            )}

            {/* Cone left edge */}
            <line x1={cx - topRpx} y1={topY} x2={cx} y2={vertexY} stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
            {/* Cone right edge */}
            <line x1={cx + topRpx} y1={topY} x2={cx} y2={vertexY} stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
            {/* Top ellipse (open mouth) — back half dashed */}
            <ellipse cx={cx} cy={topY} rx={topRpx} ry={ellipseRy} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="5 4" />
            {/* Top ellipse front half (solid arc) */}
            <path d={`M ${cx - topRpx} ${topY} A ${topRpx} ${ellipseRy} 0 0 0 ${cx + topRpx} ${topY}`} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />

            {/* Water surface ellipse */}
            {h > 0.01 && (
              <ellipse cx={cx} cy={waterYpx} rx={waterRpx} ry={Math.max(2, hFrac * ellipseRy)} fill="rgba(80,150,255,0.45)" stroke="rgba(120,180,255,0.8)" strokeWidth="1.5" />
            )}

            {/* Vertex dot */}
            <circle cx={cx} cy={vertexY} r="3" fill="rgba(255,255,255,0.4)" />

            {/* h dimension line (from vertex up to water) */}
            {h > 0.01 && (
              <>
                <line x1={cx + topRpx + 18} y1={vertexY} x2={cx + topRpx + 18} y2={waterYpx} stroke="rgba(199,244,100,0.6)" strokeWidth="1.5" />
                <line x1={cx + topRpx + 12} y1={vertexY} x2={cx + topRpx + 24} y2={vertexY} stroke="rgba(199,244,100,0.4)" strokeWidth="1" />
                <line x1={cx + topRpx + 12} y1={waterYpx} x2={cx + topRpx + 24} y2={waterYpx} stroke="rgba(199,244,100,0.4)" strokeWidth="1" />
                <text x={cx + topRpx + 28} y={(vertexY + waterYpx) / 2 + 4} fill="rgba(199,244,100,0.95)" fontSize="12" fontWeight="600">h = {format(h)}</text>
              </>
            )}

            {/* r dimension line (at water surface) */}
            {h > 0.2 && (
              <>
                <line x1={cx} y1={waterYpx + Math.max(2, hFrac * ellipseRy) + 6} x2={cx + waterRpx} y2={waterYpx + Math.max(2, hFrac * ellipseRy) + 6} stroke="rgba(255,107,53,0.6)" strokeWidth="1" />
                <text x={cx + waterRpx / 2} y={waterYpx + Math.max(2, hFrac * ellipseRy) + 20} textAnchor="middle" fill="rgba(255,107,53,0.95)" fontSize="11" fontWeight="600">r = {format(r)}</text>
              </>
            )}

            {/* H total dimension */}
            <line x1={cx - topRpx - 18} y1={topY} x2={cx - topRpx - 18} y2={vertexY} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
            <text x={cx - topRpx - 22} y={(topY + vertexY) / 2} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="10">H = {coneH}</text>
          </svg>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <MetricCard label="Altura (h)" value={format(h)} detail={`dh/dt = ${format(dhdt)} m/s`} />
          <MetricCard label="Volumen (V)" value={format(V)} detail={`dV/dt = ${format(dvdt)} m³/s`} />
        </div>
      </LabCard>

      <LabCard dark className="rounded-[1.9rem]">
        <p className="text-xs uppercase tracking-[0.28em] text-paper/80">Tasa desconocida</p>
        <h3 className="mt-2 font-display text-xl">dh/dt a lo largo del tiempo</h3>
        <div className="mt-3 rounded-[1.3rem] border border-white/10 bg-white/6 p-3">
          <CartesianFrame xMin={axis1.xMin} xMax={axis1.xMax} yMin={axis1.yMin} yMax={axis1.yMax} xTicks={generateTicks(axis1.xMin, axis1.xMax)} yTicks={generateTicks(axis1.yMin, axis1.yMax)}>
            {({ scaleX, scaleY }) => (
              <>
                <path d={linePath(ratePoints, scaleX, scaleY)} fill="none" stroke="rgba(199,244,100,0.9)" strokeWidth="3" strokeLinecap="round" />
                {time > 0.05 && <circle cx={scaleX(time)} cy={scaleY(dhdt)} r="6" fill="#c7f464" stroke="white" strokeWidth="2" />}
              </>
            )}
          </CartesianFrame>
        </div>
        <AxisRangePanel {...axis1} />
        <p className="mt-3 text-sm leading-6 text-paper/60">dh/dt es grande al inicio (cono estrecho) y disminuye a medida que h crece (sección transversal más ancha).</p>
      </LabCard>
    </>
  )
}

/* ── Lighthouse Scene ─────────────────────────────────────────── */

const LighthouseScene = ({ time, dtheta, dist }) => {
  const theta = clamp(dtheta * time - Math.PI / 3, -1.4, 1.4) // start from -60° sweep through
  const x = dist * Math.tan(theta)
  const cosT = Math.cos(theta)
  const dxdt = cosT > 0.01 ? dist * dtheta / (cosT * cosT) : 999

  // Scene: 300x280
  const lhX = 150
  const lhY = 250
  const coastY = 60
  const coastScale = 12

  const spotX = lhX + clamp(x * coastScale / dist, -130, 130)
  const beamEndX = spotX

  // Rate graph
  const graphFn = (t) => {
    const th = clamp(dtheta * t - Math.PI / 3, -1.4, 1.4)
    const c = Math.cos(th)
    return c > 0.05 ? dist * dtheta / (c * c) : 100
  }
  const tMax = Math.min(20, (1.4 + Math.PI / 3) / Math.max(0.001, dtheta))
  const ratePoints = sampleRange(0, Math.max(1, tMax), 150, graphFn)
  const rateVals = ratePoints.map((p) => p.y).filter((v) => v < 100)
  const rMax = Math.min(100, Math.ceil(Math.max(10, ...rateVals) + 2))

  const axis1 = useAxisRange({ xMin: 0, xMax: Math.max(1, tMax), yMin: 0, yMax: rMax })

  return (
    <>
      <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
        <p className="text-xs uppercase tracking-[0.28em] text-paper/80">Escena</p>
        <h3 className="mt-2 font-display text-2xl">Faro giratorio</h3>
        <div className="mt-4 flex justify-center rounded-[1.3rem] border border-white/10 bg-white/6 p-4">
          <svg viewBox="0 0 300 280" className="h-auto w-full max-w-[380px]">
            {/* Coast line */}
            <line x1="20" y1={coastY} x2="280" y2={coastY} stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
            <text x="15" y={coastY - 8} fill="rgba(255,255,255,0.3)" fontSize="9">COSTA</text>
            {/* Distance line */}
            <line x1={lhX} y1={coastY} x2={lhX} y2={lhY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />
            <text x={lhX + 6} y={(coastY + lhY) / 2} fill="rgba(255,255,255,0.35)" fontSize="10">d = {dist}</text>
            {/* Light beam */}
            <line x1={lhX} y1={lhY} x2={beamEndX} y2={coastY} stroke="rgba(255,230,80,0.5)" strokeWidth="2" />
            {/* Beam cone (glow) */}
            <line x1={lhX} y1={lhY} x2={beamEndX - 4} y2={coastY} stroke="rgba(255,230,80,0.15)" strokeWidth="8" />
            {/* Lighthouse */}
            <rect x={lhX - 8} y={lhY - 5} width="16" height="20" rx="3" fill="rgba(255,255,255,0.6)" />
            <circle cx={lhX} cy={lhY - 2} r="5" fill="#ffe650" />
            {/* Light spot on coast */}
            <circle cx={spotX} cy={coastY} r="6" fill="#ffe650" />
            <circle cx={spotX} cy={coastY} r="12" fill="rgba(255,230,80,0.2)" />
            {/* Angle arc: θ measured from perpendicular (faro→costa, straight up) to beam */}
            {(() => {
              const arcR = 40
              // Perpendicular goes straight up from lighthouse to coast (angle = -π/2 in SVG coords)
              const perpAngle = -Math.PI / 2
              // Beam angle in SVG coords: from lighthouse toward spotX on coast
              const beamAngle = Math.atan2(coastY - lhY, spotX - lhX)
              const ax1 = lhX + arcR * Math.cos(perpAngle)
              const ay1 = lhY + arcR * Math.sin(perpAngle)
              const ax2 = lhX + arcR * Math.cos(beamAngle)
              const ay2 = lhY + arcR * Math.sin(beamAngle)
              // Sweep: clockwise if beam is to the right, counterclockwise if left
              const sweep = theta >= 0 ? 1 : 0
              // Label position: halfway along the arc
              const midAngle = (perpAngle + beamAngle) / 2
              const labelX = lhX + (arcR + 16) * Math.cos(midAngle)
              const labelY = lhY + (arcR + 16) * Math.sin(midAngle)
              return (
                <>
                  <path d={`M ${ax1} ${ay1} A ${arcR} ${arcR} 0 0 ${sweep} ${ax2} ${ay2}`} fill="none" stroke="rgba(255,230,80,0.6)" strokeWidth="1.5" />
                  <text x={labelX} y={labelY + 4} textAnchor="middle" fill="rgba(255,230,80,0.8)" fontSize="11" fontWeight="600">θ = {format(Math.abs(theta) * 180 / Math.PI)}°</text>
                </>
              )
            })()}
            {/* x label */}
            <text x={spotX} y={coastY - 14} textAnchor="middle" fill="rgba(199,244,100,0.9)" fontSize="12" fontWeight="600">x = {format(x)}</text>
          </svg>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <MetricCard label="Posición en costa (x)" value={format(x)} detail={`dx/dt = ${format(Math.min(dxdt, 999))} m/s`} />
          <MetricCard label="Ángulo (θ)" value={`${format(theta * 180 / Math.PI)}°`} detail={`dθ/dt = ${format(dtheta)} rad/s`} />
        </div>
      </LabCard>

      <LabCard dark className="rounded-[1.9rem]">
        <p className="text-xs uppercase tracking-[0.28em] text-paper/80">Tasa desconocida</p>
        <h3 className="mt-2 font-display text-xl">dx/dt a lo largo del tiempo</h3>
        <div className="mt-3 rounded-[1.3rem] border border-white/10 bg-white/6 p-3">
          <CartesianFrame xMin={axis1.xMin} xMax={axis1.xMax} yMin={axis1.yMin} yMax={axis1.yMax} xTicks={generateTicks(axis1.xMin, axis1.xMax)} yTicks={generateTicks(axis1.yMin, axis1.yMax)}>
            {({ scaleX, scaleY }) => (
              <>
                <path d={linePath(ratePoints.filter((p) => p.y < 100), scaleX, scaleY)} fill="none" stroke="rgba(255,230,80,0.9)" strokeWidth="3" strokeLinecap="round" />
                {dxdt < 100 && <circle cx={scaleX(time)} cy={scaleY(dxdt)} r="6" fill="#ffe650" stroke="white" strokeWidth="2" />}
              </>
            )}
          </CartesianFrame>
        </div>
        <AxisRangePanel {...axis1} />
        <p className="mt-3 text-sm leading-6 text-paper/60">dx/dt = d·sec²(θ)·(dθ/dt). Cuando θ → 90°, sec²(θ) → ∞ y la velocidad del punto de luz se dispara.</p>
      </LabCard>
    </>
  )
}

/* ── Componente principal ─────────────────────────────────────── */

export const RelatedRatesLab = () => {
  const [scenarioId, setScenarioId] = useState('ladder')
  const [time, setTime] = useState(2)

  // Ladder params
  const [dxdt, setDxdt] = useState(0.5)
  const [ladderL, setLadderL] = useState(5)

  // Cone params
  const [dvdt, setDvdt] = useState(2)
  const [coneR, setConeR] = useState(3)
  const [coneH, setConeH] = useState(6)

  // Lighthouse params
  const [dtheta, setDtheta] = useState(0.3)
  const [dist, setDist] = useState(100)

  const sc = scenarios.find((s) => s.id === scenarioId) || scenarios[0]

  const tMaxMap = {
    ladder: Math.min(20, (ladderL - 0.3 - 1) / Math.max(0.01, dxdt)),
    cone: Math.min(30, (Math.PI / 3) * (coneR / coneH) * (coneR / coneH) * (coneH ** 3) / Math.max(0.01, dvdt)),
    lighthouse: Math.min(20, (1.4 + Math.PI / 3) / Math.max(0.001, dtheta)),
  }
  const tMax = Math.max(1, tMaxMap[scenarioId] || 10)

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">

        {/* ── LEFT: Controls ──────────────────────────────────── */}
        <div className="space-y-4">
          <LabCard title="Derivación implícita" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Razón de cambio relacionada</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              Dos variables conectadas por una ecuación geométrica. Si conoces cómo cambia una, puedes deducir cómo cambia la otra usando la regla de la cadena.
            </p>
          </LabCard>

          <LabCard title="Escenario">
            <div className="grid gap-3">
              {scenarios.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setScenarioId(item.id)
                    setTime(2)
                  }}
                  className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${item.id === sc.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper text-ink hover:border-ink/30'}`}
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className={`mt-1 text-sm leading-6 ${item.id === sc.id ? 'text-paper/72' : 'text-ink/65'}`}>{item.context}</p>
                </button>
              ))}
            </div>
          </LabCard>

          <SliderField id="rr-time" label="Tiempo t" value={time} min={0} max={tMax} step={0.1} suffix=" s" onChange={setTime} />

          {scenarioId === 'ladder' && (
            <>
              <SliderField id="rr-dxdt" label="dx/dt (tasa conocida)" value={dxdt} min={0.1} max={2} step={0.1} suffix=" m/s" onChange={setDxdt} />
              <SliderField id="rr-L" label="Longitud L" value={ladderL} min={3} max={8} step={0.5} suffix=" m" onChange={setLadderL} />
            </>
          )}

          {scenarioId === 'cone' && (
            <>
              <SliderField id="rr-dvdt" label="dV/dt (tasa conocida)" value={dvdt} min={0.5} max={5} step={0.5} suffix=" m³/s" onChange={setDvdt} />
              <SliderField id="rr-R" label="Radio del cono R" value={coneR} min={1} max={5} step={0.5} suffix=" m" onChange={setConeR} />
              <SliderField id="rr-H" label="Altura del cono H" value={coneH} min={3} max={10} step={0.5} suffix=" m" onChange={setConeH} />
            </>
          )}

          {scenarioId === 'lighthouse' && (
            <>
              <SliderField id="rr-dtheta" label="dθ/dt (tasa conocida)" value={dtheta} min={0.05} max={1} step={0.05} suffix=" rad/s" onChange={setDtheta} />
              <SliderField id="rr-dist" label="Distancia a la costa d" value={dist} min={50} max={300} step={10} suffix=" m" onChange={setDist} />
            </>
          )}

          <LabCard title="Relación matemática">
            <div className="space-y-2 rounded-[1.2rem] bg-paper px-4 py-4">
              <p className="font-mono text-sm font-semibold text-ink">{sc.equation}</p>
              <p className="font-mono text-sm text-ink/70">{sc.relation}</p>
            </div>
          </LabCard>
        </div>

        {/* ── RIGHT: Visualization ────────────────────────────── */}
        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          {scenarioId === 'ladder' && <LadderScene time={time} dxdt={dxdt} ladderL={ladderL} />}
          {scenarioId === 'cone' && <ConeScene time={time} dvdt={dvdt} coneR={coneR} coneH={coneH} />}
          {scenarioId === 'lighthouse' && <LighthouseScene time={time} dtheta={dtheta} dist={dist} />}

          <div className="grid gap-4 xl:grid-cols-2">
            <LabCard title="Modelo">
              <div className="space-y-2 overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{sc.equation}</p>
                <p className="font-mono text-sm text-ink/65">{sc.relation}</p>
              </div>
            </LabCard>
            <LabCard title="Descarga de datos">
              <button
                type="button"
                onClick={() => {
                  const rows = [['t', 'variable_1', 'variable_2', 'tasa_desconocida']]
                  const n = Math.round(tMax / 0.5) + 1
                  for (let i = 0; i < n; i++) {
                    const t = i * 0.5
                    if (scenarioId === 'ladder') {
                      const xt = clamp(1 + dxdt * t, 0.3, ladderL - 0.3)
                      const yt = Math.sqrt(Math.max(0.01, ladderL * ladderL - xt * xt))
                      rows.push([format(t), format(xt), format(yt), format(yt > 0.01 ? -(xt / yt) * dxdt : 0)])
                    } else if (scenarioId === 'cone') {
                      const Vt = dvdt * t
                      const ratio = coneR / coneH
                      const ht = clamp(Math.cbrt((3 * Vt) / (Math.PI * ratio * ratio)), 0, coneH)
                      rows.push([format(t), format(ht), format(Vt), format(ht > 0.01 ? dvdt / (Math.PI * ratio * ratio * ht * ht) : 0)])
                    } else {
                      const th = clamp(dtheta * t - Math.PI / 3, -1.4, 1.4)
                      const xt = dist * Math.tan(th)
                      const c = Math.cos(th)
                      rows.push([format(t), format(th), format(xt), format(c > 0.05 ? dist * dtheta / (c * c) : 999)])
                    }
                  }
                  downloadCsv(rows, `razon-cambio-${sc.id}.csv`)
                }}
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

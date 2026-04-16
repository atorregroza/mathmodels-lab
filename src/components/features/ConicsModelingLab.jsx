import { useState, useMemo } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { LiveFormula } from './LiveFormula'
import { format, downloadCsv } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

/* ── scenarios ──────────────────────────────────────────────── */

const scenarios = [
  {
    id: 'circle',
    label: 'Circunferencia',
    title: 'Cobertura de señal WiFi',
    context: 'Un router emite señal WiFi en todas direcciones con alcance r desde su posición (h, k). ¿Qué puntos del plano quedan dentro de la cobertura? ¿Dónde ubicar el router para cubrir ciertos puntos?',
    equation: String.raw`(x - h)^{2} + (y - k)^{2} = r^{2}`,
  },
  {
    id: 'parabola',
    label: 'Parábola',
    title: 'Reflector parabólico',
    context: 'Una antena parabólica concentra rayos paralelos (señal satelital, luz) en su foco. La forma del reflector determina dónde se ubica el foco. ¿Qué profundidad y apertura concentran mejor la señal?',
    equation: String.raw`y - k = \frac{1}{4p}(x - h)^{2}`,
  },
  {
    id: 'ellipse',
    label: 'Elipse',
    title: 'Órbita planetaria',
    context: 'Un planeta orbita una estrella ubicada en uno de los focos de una elipse. La excentricidad determina qué tan "alargada" es la órbita. ¿Cómo afecta esto a la distancia mínima (perihelio) y máxima (afelio)?',
    equation: String.raw`\frac{x^{2}}{a^{2}} + \frac{y^{2}}{b^{2}} = 1`,
  },
  {
    id: 'artemis',
    label: 'Artemis II',
    title: 'Misión Artemis II — Trayectoria real (abril 2026)',
    context: 'El 1 de abril de 2026, cuatro astronautas de la NASA partieron en Artemis II: la primera misión tripulada a la Luna en más de 50 años. La nave Orion sigue una trayectoria de retorno libre (free-return): una elipse que rodea la Luna y regresa a la Tierra sin necesidad de motor.',
    equation: String.raw`\text{Elipse de transferencia: } e \approx 0.969`,
  },
]

/* ── Artemis II real mission data (km, from Earth center) ── */
const ARTEMIS = {
  earthRadius: 6_371,
  perigeeAlt: 185,           // km above surface (initial orbit)
  maxDist: 406_771,          // km from Earth (record for crewed spacecraft)
  moonDist: 384_400,         // average Earth-Moon distance
  moonRadius: 1_737,
  lunarFlybyAlt: 6_545,      // km above far-side lunar surface
  apogeeOrbit: 2_253,        // km (apogee of parking orbit after PRM, ~1400 mi)
}
// Derived orbital elements for the trans-lunar ellipse
ARTEMIS.perigee = ARTEMIS.earthRadius + ARTEMIS.perigeeAlt     // ~6,556 km
ARTEMIS.apogee = ARTEMIS.maxDist                                // 406,771 km
ARTEMIS.semiMajor = (ARTEMIS.perigee + ARTEMIS.apogee) / 2     // ~206,664 km
ARTEMIS.eccentricity = (ARTEMIS.apogee - ARTEMIS.perigee) / (ARTEMIS.apogee + ARTEMIS.perigee) // ~0.969
ARTEMIS.semiMinor = ARTEMIS.semiMajor * Math.sqrt(1 - ARTEMIS.eccentricity ** 2)
ARTEMIS.focalDist = ARTEMIS.semiMajor * ARTEMIS.eccentricity

/* ── target points for circle coverage ───────────────────── */
const targets = [
  { x: 3, y: 4, label: 'Sala' },
  { x: -2, y: 1, label: 'Cocina' },
  { x: 5, y: -2, label: 'Jardín' },
  { x: -4, y: -3, label: 'Garaje' },
]

/* ── SVG visualizations ────────────────────────────────────── */

function CircleViz({ h, k, r, xMin, xMax, yMin, yMax }) {
  const svgW = 540, svgH = 380
  const pad = 28
  const sx = (x) => pad + ((x - xMin) / (xMax - xMin)) * (svgW - 2 * pad)
  const sy = (y) => svgH - pad - ((y - yMin) / (yMax - yMin)) * (svgH - 2 * pad)
  const pixR = ((r) / (xMax - xMin)) * (svgW - 2 * pad)

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* Grid */}
      {Array.from({ length: 11 }, (_, i) => {
        const v = xMin + (i / 10) * (xMax - xMin)
        return <line key={`vg${i}`} x1={sx(v)} y1={pad} x2={sx(v)} y2={svgH - pad} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      })}
      {Array.from({ length: 11 }, (_, i) => {
        const v = yMin + (i / 10) * (yMax - yMin)
        return <line key={`hg${i}`} x1={pad} y1={sy(v)} x2={svgW - pad} y2={sy(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      })}
      {/* Axes */}
      {xMin <= 0 && xMax >= 0 && <line x1={sx(0)} y1={pad} x2={sx(0)} y2={svgH - pad} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />}
      {yMin <= 0 && yMax >= 0 && <line x1={pad} y1={sy(0)} x2={svgW - pad} y2={sy(0)} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />}

      {/* Coverage circle */}
      <circle cx={sx(h)} cy={sy(k)} r={pixR} fill="rgba(80,150,255,0.08)" stroke="#5096ff" strokeWidth="2" />
      {/* Coverage gradient ring */}
      <circle cx={sx(h)} cy={sy(k)} r={pixR * 0.7} fill="none" stroke="rgba(80,150,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />

      {/* Router (center) */}
      <circle cx={sx(h)} cy={sy(k)} r="6" fill="#ff6b35" stroke="white" strokeWidth="2" />
      <text x={sx(h)} y={sy(k) - 12} fill="#ff6b35" fontSize="10" textAnchor="middle" fontWeight="600">Router ({format(h)}, {format(k)})</text>

      {/* Radius line */}
      <line x1={sx(h)} y1={sy(k)} x2={sx(h + r)} y2={sy(k)} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={sx(h + r / 2)} y={sy(k) - 6} fill="#ff6b35" fontSize="9" textAnchor="middle">r = {format(r)}</text>

      {/* Target points */}
      {targets.map((t) => {
        const dist = Math.sqrt((t.x - h) ** 2 + (t.y - k) ** 2)
        const inside = dist <= r
        return (
          <g key={t.label}>
            <circle cx={sx(t.x)} cy={sy(t.y)} r="5" fill={inside ? '#22c5a0' : '#ef4444'} stroke="white" strokeWidth="1.5" />
            <text x={sx(t.x) + 8} y={sy(t.y) + 4} fill={inside ? '#22c5a0' : '#ef4444'} fontSize="9" fontWeight="600">{t.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function ParabolaViz({ p, aperture }) {
  const svgW = 540, svgH = 380
  const pad = 36
  // Vertex fixed at origin — viewport always centered on parabola
  const depth = (aperture * aperture) / (4 * p) // max height of parabola
  const xRange = aperture * 1.2
  const xMin = -xRange, xMax = xRange
  const yMin = -p * 1.5     // show directrix
  const yMax = depth * 1.25  // show full curve
  const sx = (x) => pad + ((x - xMin) / (xMax - xMin)) * (svgW - 2 * pad)
  const sy = (y) => svgH - pad - ((y - yMin) / (yMax - yMin)) * (svgH - 2 * pad)

  // Parabola points: y = x²/(4p)
  const pts = []
  for (let i = 0; i <= 100; i++) {
    const x = -aperture + (2 * aperture * i) / 100
    const y = (x * x) / (4 * p)
    pts.push({ x, y })
  }

  // Focus at (0, p), directrix at y = -p
  const numRays = 5
  const rays = Array.from({ length: numRays }, (_, i) => {
    const rx = -aperture * 0.8 + (1.6 * aperture * 0.8 * i) / (numRays - 1)
    const ry = (rx * rx) / (4 * p)
    return { rx, ry }
  })

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* Axes */}
      <line x1={sx(xMin)} y1={sy(0)} x2={sx(xMax)} y2={sy(0)} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <line x1={sx(0)} y1={sy(yMin)} x2={sx(0)} y2={sy(yMax)} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3" />

      {/* Directrix */}
      <line x1={sx(xMin)} y1={sy(-p)} x2={sx(xMax)} y2={sy(-p)} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6 3" />
      <text x={sx(xMax) - 4} y={sy(-p) + 14} fill="#ef4444" fontSize="9" textAnchor="end">directriz y = −{format(p)}</text>

      {/* Parabola curve */}
      <path
        d={pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${sx(pt.x)},${sy(pt.y)}`).join(' ')}
        fill="none" stroke="#5096ff" strokeWidth="2.5" strokeLinecap="round"
      />

      {/* Reflector fill (dish shape) */}
      <path
        d={`${pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${sx(pt.x)},${sy(pt.y)}`).join(' ')} L${sx(aperture)},${sy(0)} L${sx(-aperture)},${sy(0)} Z`}
        fill="rgba(80,150,255,0.06)"
      />

      {/* Parallel rays → focus */}
      {rays.map(({ rx, ry }, i) => (
        <g key={i}>
          <line x1={sx(rx)} y1={sy(yMax)} x2={sx(rx)} y2={sy(ry)} stroke="rgba(255,200,50,0.35)" strokeWidth="1.5" />
          <line x1={sx(rx)} y1={sy(ry)} x2={sx(0)} y2={sy(p)} stroke="rgba(255,200,50,0.55)" strokeWidth="1.5" />
          <circle cx={sx(rx)} cy={sy(ry)} r="3" fill="rgba(255,200,50,0.8)" />
        </g>
      ))}

      {/* Focus */}
      <circle cx={sx(0)} cy={sy(p)} r="6" fill="#22c5a0" stroke="white" strokeWidth="2" />
      <text x={sx(0) + 10} y={sy(p) + 4} fill="#22c5a0" fontSize="10" fontWeight="600">Foco (0, {format(p)})</text>

      {/* Vertex */}
      <circle cx={sx(0)} cy={sy(0)} r="4" fill="#ff6b35" stroke="white" strokeWidth="1.5" />
      <text x={sx(0) + 8} y={sy(0) + 14} fill="#ff6b35" fontSize="9">Vértice</text>

      {/* p distance marker */}
      <line x1={sx(0) + 14} y1={sy(0)} x2={sx(0) + 14} y2={sy(p)} stroke="#22c5a0" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x={sx(0) + 20} y={sy(p / 2)} fill="#22c5a0" fontSize="8" dominantBaseline="middle">p = {format(p)}</text>

      {/* Aperture marker */}
      <line x1={sx(-aperture)} y1={sy(depth) + 10} x2={sx(aperture)} y2={sy(depth) + 10} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <text x={sx(0)} y={sy(depth) + 22} fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle">apertura = {format(2 * aperture)}</text>
    </svg>
  )
}

function EllipseViz({ a, e }) {
  const b = a * Math.sqrt(1 - e * e)
  const c = a * e // focal distance
  const svgW = 540, svgH = 400
  const pad = 40
  // Uniform scale: same pixels-per-km on both axes so circles look circular
  const range = a * 1.3
  const scaleUniform = Math.min((svgW - 2 * pad) / (2 * range), (svgH - 2 * pad) / (2 * range))
  const sx = (x) => svgW / 2 + x * scaleUniform
  const sy = (y) => svgH / 2 - y * scaleUniform

  // Ellipse points
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const theta = (2 * Math.PI * i) / 120
    pts.push({ x: a * Math.cos(theta), y: b * Math.sin(theta) })
  }

  const perihelion = a - c
  const aphelion = a + c

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* Axes */}
      <line x1={sx(-range)} y1={sy(0)} x2={sx(range)} y2={sy(0)} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1={sx(0)} y1={sy(-range)} x2={sx(0)} y2={sy(range)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 3" />

      {/* Reference circle (r = a) to show how much the ellipse deviates */}
      <circle cx={sx(0)} cy={sy(0)} r={a * scaleUniform} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="6 6" />

      {/* Ellipse */}
      <path
        d={pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${sx(pt.x)},${sy(pt.y)}`).join(' ') + ' Z'}
        fill="rgba(80,150,255,0.06)" stroke="#5096ff" strokeWidth="2.5"
      />

      {/* Semi-major axis line */}
      <line x1={sx(-a)} y1={sy(0)} x2={sx(a)} y2={sy(0)} stroke="rgba(255,107,53,0.4)" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={sx(a / 2)} y={sy(0) - 8} fill="#ff6b35" fontSize="9" textAnchor="middle">a = {format(a)}</text>

      {/* Semi-minor axis line */}
      <line x1={sx(0)} y1={sy(-b)} x2={sx(0)} y2={sy(b)} stroke="rgba(34,197,160,0.3)" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={sx(0) + 8} y={sy(b / 2)} fill="rgba(34,197,160,0.6)" fontSize="9">b = {format(b)}</text>

      {/* Focus 1 (star) — right focus */}
      <circle cx={sx(c)} cy={sy(0)} r="8" fill="#fbbf24" stroke="#fbbf24" strokeWidth="2" />
      <text x={sx(c)} y={sy(0) - 14} fill="#fbbf24" fontSize="10" textAnchor="middle" fontWeight="600">Estrella</text>

      {/* Focus 2 — left focus (empty) */}
      <circle cx={sx(-c)} cy={sy(0)} r="4" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <text x={sx(-c)} y={sy(0) + 16} fill="rgba(255,255,255,0.35)" fontSize="8" textAnchor="middle">F₂</text>

      {/* Planet at perihelion */}
      <circle cx={sx(a)} cy={sy(0)} r="5" fill="#22c5a0" stroke="white" strokeWidth="1.5" />

      {/* Perihelion / aphelion distances */}
      <line x1={sx(c)} y1={sy(0) + 18} x2={sx(a)} y2={sy(0) + 18} stroke="#22c5a0" strokeWidth="1.5" />
      <text x={sx((c + a) / 2)} y={sy(0) + 30} fill="#22c5a0" fontSize="8" textAnchor="middle">perihelio = {format(perihelion)}</text>

      <line x1={sx(-a)} y1={sy(0) + 18} x2={sx(c)} y2={sy(0) + 18} stroke="#ef4444" strokeWidth="1.5" />
      <text x={sx((-a + c) / 2)} y={sy(0) + 30} fill="#ef4444" fontSize="8" textAnchor="middle">afelio = {format(aphelion)}</text>

      {/* Eccentricity label */}
      <text x={sx(c / 2)} y={sy(0) + 44} fill="rgba(255,255,255,0.5)" fontSize="9" textAnchor="middle">c = {format(c)}  |  e = {format(e)}</text>
    </svg>
  )
}

function ArtemisViz({ phase }) {
  const svgW = 600, svgH = 460

  // Layout: Earth LEFT, Moon RIGHT, same vertical center
  const midY = svgH / 2
  const earthX = 100, earthY = midY
  const moonX = svgW - 100, moonY = midY
  const loopR = 34

  // Trajectory bezier control points:
  // Outbound (ida): Earth → curves UP → arrives at Moon top (4 days)
  // Flyby: arc around the right side of Moon
  // Return (regreso): departs Moon bottom → curves DOWN → arrives at Earth (5 days)
  const bulge = 140 // how much the paths curve away from the center line

  const outP0 = { x: earthX, y: earthY }
  const outC1 = { x: earthX + 120, y: earthY - bulge }
  const outC2 = { x: moonX - 120, y: moonY - bulge * 0.8 }
  const outP3 = { x: moonX, y: moonY - loopR }

  const retP0 = { x: moonX, y: moonY + loopR }
  const retC1 = { x: moonX - 120, y: moonY + bulge * 0.8 }
  const retC2 = { x: earthX + 120, y: earthY + bulge }
  const retP3 = { x: earthX, y: earthY }

  const outPathD = `M${outP0.x},${outP0.y} C${outC1.x},${outC1.y} ${outC2.x},${outC2.y} ${outP3.x},${outP3.y}`
  const flybyPathD = `A${loopR},${loopR} 0 0,1 ${retP0.x},${retP0.y}`
  const retPathD = `C${retC1.x},${retC1.y} ${retC2.x},${retC2.y} ${retP3.x},${retP3.y}`
  const fullPathD = `${outPathD} ${flybyPathD} ${retPathD}`

  const missionDays = 10
  const currentDay = phase * missionDays

  const bezier = (t, p0, c1, c2, p3) => {
    const u = 1 - t
    return {
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
    }
  }

  const getOrionPos = (t) => {
    if (t < 0.40) {
      // Outbound (4 days / 10 = 0.40)
      return bezier(t / 0.40, outP0, outC1, outC2, outP3)
    } else if (t < 0.50) {
      // Flyby arc — clockwise around the RIGHT (far) side of Moon
      const s = (t - 0.40) / 0.10
      const angle = -Math.PI / 2 - s * Math.PI // clockwise: -90° to -270°
      return {
        x: moonX + loopR * Math.cos(angle),
        y: moonY - loopR * Math.sin(angle),
      }
    } else {
      // Return (5 days / 10 = 0.50)
      return bezier((t - 0.50) / 0.50, retP0, retC1, retC2, retP3)
    }
  }

  const orion = getOrionPos(phase)
  // Distance in km: pixel distance / pixel-distance-to-moon * real-moon-distance
  const earthMoonPixDist = Math.sqrt((moonX - earthX) ** 2 + (moonY - earthY) ** 2) || 1
  const orionDistKm = Math.sqrt((orion.x - earthX) ** 2 + (orion.y - earthY) ** 2) / earthMoonPixDist * ARTEMIS.moonDist

  // Split path for coloring: outbound (blue) vs return (orange)
  // We'll draw the full path and overlay colored sections up to current phase
  const trailPts = []
  const steps = Math.floor(phase * 200)
  for (let i = 0; i <= steps; i++) {
    trailPts.push(getOrionPos(i / 200))
  }

  const phaseLabel = phase < 0.05 ? '1. Lanzamiento desde la Tierra'
    : phase < 0.40 ? '2. Viaje de ida a la Luna'
    : phase < 0.50 ? '3. Sobrevuelo lunar (sin aterrizar)'
    : phase < 0.95 ? '4. Regreso a la Tierra'
    : '5. Reentrada y amerizaje'

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* Starfield */}
      {Array.from({ length: 60 }, (_, i) => (
        <circle key={i} cx={(i * 127.3 + 17) % svgW} cy={(i * 79.1 + 11) % svgH} r={0.4 + (i % 3) * 0.3} fill={`rgba(255,255,255,${0.06 + (i % 5) * 0.04})`} />
      ))}

      {/* Earth-Moon line (reference) */}
      <line x1={earthX} y1={earthY} x2={moonX} y2={moonY} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="6 8" />

      {/* Full trajectory (ghost) */}
      <path d={fullPathD} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />

      {/* Traveled trajectory — colored by segment */}
      {trailPts.length > 1 && (
        <path
          d={trailPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          fill="none"
          stroke={phase < 0.5 ? '#5096ff' : '#fbbf24'}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}

      {/* Stage labels along paths */}
      {(() => {
        const midOut = bezier(0.5, outP0, outC1, outC2, outP3)
        const midRet = bezier(0.5, retP0, retC1, retC2, retP3)
        return (
          <>
            <text x={midOut.x} y={midOut.y - 12} fill="rgba(80,150,255,0.5)" fontSize="9" textAnchor="middle" fontWeight="600">2. Viaje de ida (4 días)</text>
            <text x={midRet.x} y={midRet.y + 20} fill="rgba(251,191,36,0.5)" fontSize="9" textAnchor="middle" fontWeight="600">4. Regreso (5 días)</text>
            <text x={moonX + loopR + 14} y={moonY} fill="rgba(168,85,247,0.5)" fontSize="8" dominantBaseline="middle">3. Sobrevuelo</text>
          </>
        )
      })()}

      {/* Earth */}
      <circle cx={earthX} cy={earthY} r="14" fill="#3b82f6" stroke="#60a5fa" strokeWidth="2" />
      <text x={earthX} y={earthY + 30} fill="#60a5fa" fontSize="11" textAnchor="middle" fontWeight="600">TIERRA</text>
      <text x={earthX} y={earthY - 22} fill="rgba(80,150,255,0.5)" fontSize="8" textAnchor="middle">1. Lanzamiento</text>

      {/* Moon */}
      <circle cx={moonX} cy={moonY} r="9" fill="#94a3b8" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <text x={moonX} y={moonY - 20} fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="600">LUNA</text>

      {/* Reentry label near Earth */}
      {phase > 0.85 && (
        <text x={earthX + 30} y={earthY + 48} fill="rgba(251,191,36,0.6)" fontSize="8">5. Reentrada y amerizaje</text>
      )}

      {/* Orion */}
      <circle cx={orion.x} cy={orion.y} r="6" fill="#ff6b35" stroke="white" strokeWidth="2" />
      <text x={orion.x + 10} y={orion.y - 10} fill="#ff6b35" fontSize="10" fontWeight="700">Orion</text>

      {/* Distance line */}
      <line x1={earthX} y1={earthY} x2={orion.x} y2={orion.y} stroke="rgba(255,107,53,0.15)" strokeWidth="1" strokeDasharray="4 4" />

      {/* Info panel */}
      <rect x={12} y={svgH - 82} width={180} height={68} rx="10" fill="rgba(255,255,255,0.04)" />
      <text x={22} y={svgH - 62} fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="600">{phaseLabel}</text>
      <text x={22} y={svgH - 46} fill="rgba(255,255,255,0.4)" fontSize="9">Día {Math.floor(currentDay + 1)} de {missionDays}</text>
      <text x={22} y={svgH - 30} fill="rgba(255,107,53,0.8)" fontSize="9" className="tabular-nums" fontWeight="600">Distancia: {format(orionDistKm)} km</text>

      {/* Legend */}
      <g transform={`translate(${svgW - 130}, ${svgH - 24})`}>
        <line x1="0" y1="0" x2="12" y2="0" stroke="#5096ff" strokeWidth="2.5" />
        <text x="16" y="4" fill="rgba(255,255,255,0.4)" fontSize="7">Ida</text>
        <line x1="38" y1="0" x2="50" y2="0" stroke="#fbbf24" strokeWidth="2.5" />
        <text x="54" y="4" fill="rgba(255,255,255,0.4)" fontSize="7">Regreso</text>
      </g>
      <text x={svgW - 10} y={16} fill="rgba(255,255,255,0.15)" fontSize="7" textAnchor="end">Artemis II · Abril 2026 · Modelo simplificado</text>
    </svg>
  )
}

/* ── main component ─────────────────────────────────────────── */

export const ConicsModelingLab = () => {
  const [scenarioId, setScenarioId] = useState('circle')
  const sc = scenarios.find((s) => s.id === scenarioId) || scenarios[0]

  // Circle params
  const [cH, setCH] = useState(0)
  const [cK, setCK] = useState(0)
  const [cR, setCR] = useState(5)

  // Parabola params
  const [pH, _setPH] = useState(0)
  const [pK, _setPK] = useState(0)
  const [pP, setPP] = useState(2)
  const [pAp, setPAp] = useState(6)

  // Ellipse params
  const [eA, setEA] = useState(8)
  const [eE, setEE] = useState(0.6)

  // Artemis params
  const [artPhase, setArtPhase] = useState(0.15)

  // Axis range hook for circle visualization
  const circleAxis = useAxisRange({ xMin: -10, xMax: 10, yMin: -8, yMax: 8 })

  const changeScenario = (id) => {
    setScenarioId(id)
    circleAxis.resetRange()
  }

  // Circle metrics
  const circleMetrics = useMemo(() => {
    const covered = targets.filter((t) => Math.sqrt((t.x - cH) ** 2 + (t.y - cK) ** 2) <= cR)
    return {
      area: Math.PI * cR * cR,
      circumference: 2 * Math.PI * cR,
      covered: covered.length,
      coveredNames: covered.map((t) => t.label).join(', ') || 'ninguno',
    }
  }, [cH, cK, cR])

  // Parabola metrics
  const _parabolaMetrics = useMemo(() => {
    const depth = (pAp * pAp) / (4 * pP)
    return {
      focus: `(${format(pH)}, ${format(pK + pP)})`,
      directrix: format(pK - pP),
      depth: format(depth),
      focalDist: format(pP),
    }
  }, [pH, pK, pP, pAp])

  // Ellipse metrics
  const eB = eA * Math.sqrt(1 - eE * eE)
  const eC = eA * eE
  const ellipseMetrics = useMemo(() => ({
    b: format(eB),
    c: format(eC),
    perihelion: format(eA - eC),
    aphelion: format(eA + eC),
    area: format(Math.PI * eA * eB),
    ratio: format((eA + eC) / (eA - eC)),
  }), [eA, eE])

  // CSV export
  const handleCsv = () => {
    if (scenarioId === 'circle') {
      const header = ['θ', 'x', 'y']
      const rows = [header, ...Array.from({ length: 73 }, (_, i) => {
        const t = (2 * Math.PI * i) / 72
        return [t.toFixed(3), (cH + cR * Math.cos(t)).toFixed(3), (cK + cR * Math.sin(t)).toFixed(3)]
      })]
      downloadCsv(rows, 'circunferencia.csv')
    } else if (scenarioId === 'parabola') {
      const header = ['x', 'y']
      const rows = [header, ...Array.from({ length: 101 }, (_, i) => {
        const x = pH - pAp + (2 * pAp * i) / 100
        return [x.toFixed(3), (pK + ((x - pH) ** 2) / (4 * pP)).toFixed(3)]
      })]
      downloadCsv(rows, 'parabola.csv')
    } else {
      const header = ['θ', 'x', 'y']
      const rows = [header, ...Array.from({ length: 73 }, (_, i) => {
        const t = (2 * Math.PI * i) / 72
        return [t.toFixed(3), (eA * Math.cos(t)).toFixed(3), (eB * Math.sin(t)).toFixed(3)]
      })]
      downloadCsv(rows, 'elipse.csv')
    }
  }

  return (
    <div className="rounded-[2.2rem] border border-ink/12 bg-white p-4 shadow-[0_28px_70px_rgba(18,23,35,0.12)] md:p-6">
      {/* Scenario selector */}
      <div className="flex flex-wrap gap-2">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => changeScenario(s.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${s.id === scenarioId ? 'bg-ink text-paper' : 'border border-ink/10 bg-paper text-ink/70 hover:border-ink/30'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm font-semibold text-ink/80">{sc.title}</p>
      <p className="mt-1 text-sm leading-6 text-ink/60">{sc.context}</p>

      {/* Main grid */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        {/* LEFT: visualization */}
        <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-[1.4rem] border border-white/10 bg-ink p-3">
            {scenarioId === 'circle' && <CircleViz h={cH} k={cK} r={cR} xMin={circleAxis.xMin} xMax={circleAxis.xMax} yMin={circleAxis.yMin} yMax={circleAxis.yMax} />}
            {scenarioId === 'parabola' && <ParabolaViz p={pP} aperture={pAp} />}
            {scenarioId === 'ellipse' && <EllipseViz a={eA} e={eE} />}
            {scenarioId === 'artemis' && <ArtemisViz phase={artPhase} />}
            {scenarioId === 'circle' && <AxisRangePanel {...circleAxis} />}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <LiveFormula
                tone="dark"
                label="Ecuación evaluada"
                general={sc.equation}
                evaluated={
                  scenarioId === 'circle'
                    ? `(x ${cH >= 0 ? '-' : '+'} ${format(Math.abs(cH))})^{2} + (y ${cK >= 0 ? '-' : '+'} ${format(Math.abs(cK))})^{2} = ${format(cR * cR)}`
                    : scenarioId === 'parabola'
                      ? `y = \\frac{1}{${format(4 * pP)}}\\, x^{2}`
                      : scenarioId === 'ellipse'
                        ? `\\frac{x^{2}}{${format(eA * eA)}} + \\frac{y^{2}}{${format((eA * Math.sqrt(1 - eE * eE)) ** 2)}} = 1`
                        : `\\text{Elipse de transferencia: } e \\approx ${ARTEMIS.eccentricity.toFixed(4)}`
                }
                raw
              />
            </div>
            <button onClick={handleCsv} className="rounded-full border border-ink/10 bg-paper px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-ink/30">CSV</button>
          </div>
        </div>

        {/* RIGHT: sliders + metrics */}
        <div className="space-y-3">
          {/* === CIRCLE === */}
          {scenarioId === 'circle' && (
            <>
              <SliderField id="c-h" label="Posición x (h)" value={cH} min={-6} max={6} step={0.1} suffix="" onChange={setCH} />
              <SliderField id="c-k" label="Posición y (k)" value={cK} min={-5} max={5} step={0.1} suffix="" onChange={setCK} />
              <SliderField id="c-r" label="Alcance (r)" value={cR} min={0.5} max={9} step={0.1} suffix=" m" onChange={setCR} />
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Área cobertura" value={`${format(circleMetrics.area)} m²`} dark />
                <MetricCard label="Perímetro" value={`${format(circleMetrics.circumference)} m`} dark={false} />
                <MetricCard label="Puntos cubiertos" value={`${circleMetrics.covered} / ${targets.length}`} dark={circleMetrics.covered === targets.length} />
                <MetricCard label="Cubiertos" value={circleMetrics.coveredNames} dark={false} />
              </div>
            </>
          )}

          {/* === PARABOLA === */}
          {scenarioId === 'parabola' && (
            <>
              <SliderField id="p-p" label="Distancia focal (p)" value={pP} min={0.5} max={8} step={0.1} suffix=" m" onChange={setPP} />
              <SliderField id="p-ap" label="Semi-apertura del plato" value={pAp} min={1} max={10} step={0.1} suffix=" m" onChange={setPAp} />
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Foco" value={`(0, ${format(pP)})`} dark />
                <MetricCard label="Directriz" value={`y = −${format(pP)}`} dark={false} />
                <MetricCard label="Profundidad del plato" value={`${format((pAp * pAp) / (4 * pP))} m`} dark />
                <MetricCard label="Diámetro" value={`${format(2 * pAp)} m`} dark={false} />
              </div>
              <LabCard title="Pregunta de modelación">
                <p className="mt-2 text-sm leading-6 text-ink/65">Si duplicas la distancia focal p, ¿cómo cambia la profundidad del plato para la misma apertura? ¿Plato más hondo o más plano concentra mejor?</p>
              </LabCard>
            </>
          )}

          {/* === ELLIPSE === */}
          {scenarioId === 'ellipse' && (
            <>
              <SliderField id="e-a" label="Semieje mayor (a)" value={eA} min={2} max={15} step={0.1} suffix=" UA" onChange={setEA} />
              <SliderField id="e-e" label="Excentricidad (e)" value={eE} min={0} max={0.95} step={0.01} suffix="" onChange={setEE} />
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Semieje menor (b)" value={`${ellipseMetrics.b} UA`} dark={false} />
                <MetricCard label="Distancia focal (c)" value={`${ellipseMetrics.c} UA`} dark={false} />
                <MetricCard label="Perihelio" value={`${ellipseMetrics.perihelion} UA`} dark />
                <MetricCard label="Afelio" value={`${ellipseMetrics.aphelion} UA`} dark />
                <MetricCard label="Área orbital" value={`${ellipseMetrics.area} UA²`} dark={false} />
                <MetricCard label="Razón afelio/perihelio" value={`${ellipseMetrics.ratio}×`} dark />
              </div>
            </>
          )}

          {/* === ARTEMIS II === */}
          {scenarioId === 'artemis' && (
            <>
              <SliderField id="art-phase" label="Fase de la misión" value={Math.round(artPhase * 100)} min={0} max={100} step={1} suffix="%" onChange={(v) => setArtPhase(v / 100)} />

              <LabCard title="Datos orbitales reales" dark>
                <div className="mt-2 space-y-1 text-sm leading-6 text-paper/70">
                  <p><span className="text-paper/45">Semieje mayor:</span> <span className="tabular-nums font-semibold text-paper">{format(ARTEMIS.semiMajor)} km</span></p>
                  <p><span className="text-paper/45">Excentricidad:</span> <span className="tabular-nums font-semibold text-paper">{ARTEMIS.eccentricity.toFixed(4)}</span></p>
                  <p><span className="text-paper/45">Semieje menor:</span> <span className="tabular-nums font-semibold text-paper">{format(ARTEMIS.semiMinor)} km</span></p>
                </div>
              </LabCard>

              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Perigeo" value={`${format(ARTEMIS.perigeeAlt)} km`} dark />
                <MetricCard label="Distancia máxima" value={`${format(ARTEMIS.maxDist)} km`} dark />
                <MetricCard label="Sobrevuelo lunar" value={`${format(ARTEMIS.lunarFlybyAlt)} km`} dark={false} />
                <MetricCard label="Dist. Tierra-Luna" value={`${format(ARTEMIS.moonDist)} km`} dark={false} />
              </div>

              <LabCard title="Pregunta de modelación">
                <p className="mt-2 text-sm leading-6 text-ink/65">¿Por qué una excentricidad tan alta (e ≈ 0.969) permite llegar a la Luna con el mínimo combustible? ¿Qué pasaría si e fuera menor?</p>
              </LabCard>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

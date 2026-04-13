import { useState, useMemo } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, linePath, sampleRange, generateTicks } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

/* ── scenarios ──────────────────────────────────────────────── */

const scenarios = [
  {
    id: 'open-box',
    label: 'Caja abierta de cartón',
    context: 'De una lámina rectangular se recortan cuadrados iguales en las cuatro esquinas y se doblan los lados para formar una caja sin tapa. ¿Qué tamaño de corte maximiza el volumen?',
    paramLabel: 'Lado del corte (x)',
    paramUnit: 'cm',
    sheetW: 30,
    sheetH: 20,
    paramMin: 0.1,
    paramMax: null, // computed: min(W,H)/2
    paramDefault: 3,
    paramStep: 0.1,
    objective: (x, W, H) => x * (W - 2 * x) * (H - 2 * x),
    objectiveLabel: 'V(x) = x(W − 2x)(H − 2x)',
    objectiveUnit: 'cm³',
    yAxisLabel: 'Volumen',
    metrics: (x, W, H) => {
      const v = x * (W - 2 * x) * (H - 2 * x)
      return [
        { label: 'Corte x', value: `${format(x)} cm` },
        { label: 'Base', value: `${format(W - 2 * x)} × ${format(H - 2 * x)} cm` },
        { label: 'Altura', value: `${format(x)} cm` },
        { label: 'Volumen', value: `${format(v)} cm³`, highlight: true },
      ]
    },
  },
  {
    id: 'fence-wall',
    label: 'Corral contra una pared',
    context: 'Se dispone de una cantidad fija de cerca para construir un corral rectangular contra una pared. La pared funciona como uno de los lados. ¿Qué dimensiones maximizan el área del corral?',
    paramLabel: 'Ancho del corral (x)',
    paramUnit: 'm',
    totalFence: 60,
    paramMin: 0.5,
    paramMax: null, // computed: totalFence/2
    paramDefault: 15,
    paramStep: 0.5,
    objective: (x, _W, _H, fence) => x * (fence - 2 * x),
    objectiveLabel: 'A(x) = x(L − 2x)',
    objectiveUnit: 'm²',
    yAxisLabel: 'Área',
    metrics: (x, _W, _H, fence) => {
      const depth = fence - 2 * x
      const area = x * depth
      return [
        { label: 'Ancho (x)', value: `${format(x)} m` },
        { label: 'Profundidad', value: `${format(depth)} m` },
        { label: 'Cerca usada', value: `${format(2 * x + depth)} m` },
        { label: 'Área', value: `${format(area)} m²`, highlight: true },
      ]
    },
  },
  {
    id: 'shortest-cable',
    label: 'Cable cruzando un río',
    context: 'Una fábrica está a cierta distancia río arriba de una planta, al otro lado del río. Tender cable bajo el agua cuesta más que por tierra. ¿En qué punto debe cruzar el cable para minimizar el costo total?',
    paramLabel: 'Punto de cruce (x)',
    paramUnit: 'm',
    riverWidth: 40,
    landDist: 80,
    costWater: 5,
    costLand: 3,
    paramMin: 0,
    paramMax: null, // computed: landDist
    paramDefault: 30,
    paramStep: 0.5,
    objective: (x, _W, _H, _f, rW, lD, cW, cL) => {
      const water = Math.sqrt(rW * rW + x * x) * cW
      const land = (lD - x) * cL
      return water + land
    },
    objectiveLabel: 'C(x) = c₁√(d² + x²) + c₂(L − x)',
    objectiveUnit: '$',
    yAxisLabel: 'Costo',
    minimize: true,
    metrics: (x, _W, _H, _f, rW, lD, cW, cL) => {
      const waterDist = Math.sqrt(rW * rW + x * x)
      const landDist = lD - x
      return [
        { label: 'Punto cruce', value: `${format(x)} m` },
        { label: 'Cable agua', value: `${format(waterDist)} m ($${format(waterDist * cW)})` },
        { label: 'Cable tierra', value: `${format(landDist)} m ($${format(landDist * cL)})` },
        { label: 'Costo total', value: `$${format(waterDist * cW + landDist * cL)}`, highlight: true },
      ]
    },
  },
  {
    id: 'cone-in-sphere',
    label: 'Cono inscrito en esfera',
    context: 'Un cono recto está inscrito dentro de una esfera de radio fijo. La punta del cono toca la esfera y la base circular también. ¿Qué altura del cono maximiza su volumen?',
    paramLabel: 'Altura del cono (h)',
    paramUnit: '',
    sphereR: 10,
    paramMin: 0.5,
    paramMax: null, // computed: 2R
    paramDefault: 13,
    paramStep: 0.1,
    objective: (h, _W, _H, _f, _rW, _lD, _cW, _cL, R) => {
      const r2 = h * (2 * R - h)
      if (r2 <= 0) return 0
      return (Math.PI / 3) * r2 * h
    },
    objectiveLabel: 'V(h) = (π/3)·r²·h donde r² = h(2R − h)',
    objectiveUnit: '',
    yAxisLabel: 'Volumen',
    metrics: (h, _W, _H, _f, _rW, _lD, _cW, _cL, R) => {
      const r2 = h * (2 * R - h)
      const r = r2 > 0 ? Math.sqrt(r2) : 0
      const vol = r2 > 0 ? (Math.PI / 3) * r2 * h : 0
      return [
        { label: 'Altura h', value: format(h) },
        { label: 'Radio base r', value: format(r) },
        { label: 'Radio esfera R', value: format(R) },
        { label: 'Volumen cono', value: format(vol), highlight: true },
      ]
    },
  },
  {
    id: 'cylinder-can',
    label: 'Lata cilíndrica',
    context: 'Una lata cilíndrica cerrada debe contener un volumen fijo de 500 cm³. ¿Qué radio y altura minimizan la cantidad de material (área superficial) necesario para fabricarla?',
    paramLabel: 'Radio de la lata (r)',
    paramUnit: 'cm',
    volume: 500,
    paramMin: 1,
    paramMax: null,
    paramDefault: 4.3,
    paramStep: 0.1,
    objective: (r, _W, _H, _f, _rW, _lD, _cW, _cL, _R, V) => {
      if (r <= 0) return Infinity
      const h = V / (Math.PI * r * r)
      return 2 * Math.PI * r * r + 2 * Math.PI * r * h
    },
    objectiveLabel: 'A(r) = 2πr² + 2V/r',
    objectiveUnit: 'cm²',
    yAxisLabel: 'Área superficial',
    minimize: true,
    metrics: (r, _W, _H, _f, _rW, _lD, _cW, _cL, _R, V) => {
      const h = V / (Math.PI * r * r)
      const area = 2 * Math.PI * r * r + 2 * Math.PI * r * h
      return [
        { label: 'Radio r', value: `${format(r)} cm` },
        { label: 'Altura h', value: `${format(h)} cm` },
        { label: 'Volumen', value: `${format(V)} cm³` },
        { label: 'Área total', value: `${format(area)} cm²`, highlight: true },
      ]
    },
  },
  {
    id: 'cylinder-in-cone',
    label: 'Cilindro inscrito en cono',
    context: 'Un cilindro recto está inscrito dentro de un cono de radio R = 8 y altura H = 12. La base del cilindro coincide con la base del cono. ¿Qué radio del cilindro maximiza su volumen?',
    paramLabel: 'Radio del cilindro (r)',
    paramUnit: '',
    coneR: 8,
    coneH: 12,
    paramMin: 0.1,
    paramMax: null,
    paramDefault: 5,
    paramStep: 0.1,
    objective: (r, _W, _H, _f, _rW, _lD, _cW, _cL, _R, _V, cR, cH) => {
      const h = cH * (1 - r / cR)
      if (h <= 0) return 0
      return Math.PI * r * r * h
    },
    objectiveLabel: 'V(r) = πr²H(1 − r/R)',
    objectiveUnit: '',
    yAxisLabel: 'Volumen',
    metrics: (r, _W, _H, _f, _rW, _lD, _cW, _cL, _R, _V, cR, cH) => {
      const h = cH * (1 - r / cR)
      const vol = h > 0 ? Math.PI * r * r * h : 0
      return [
        { label: 'Radio cilindro r', value: format(r) },
        { label: 'Altura cilindro h', value: format(Math.max(h, 0)) },
        { label: 'Cono (R, H)', value: `${cR}, ${cH}` },
        { label: 'Volumen cilindro', value: format(vol), highlight: true },
      ]
    },
  },
  {
    id: 'submarine-pipe',
    label: 'Tubería submarina',
    context: 'Una isla está a 6 km de la costa. Una planta de energía está a 15 km a lo largo de la costa. Tender tubería submarina cuesta $80 000/km y por tierra $50 000/km. ¿Dónde debe llegar la tubería a la costa para minimizar el costo?',
    paramLabel: 'Punto de llegada a costa (x)',
    paramUnit: 'km',
    seaDist: 6,
    coastDist: 15,
    costSea: 80,
    costCoast: 50,
    paramMin: 0,
    paramMax: null,
    paramDefault: 5,
    paramStep: 0.1,
    objective: (x, _W, _H, _f, _rW, _lD, _cW, _cL, _R, _V, _cR, _cH, sea, coast, cSea, cCoast) => {
      const seaLen = Math.sqrt(sea * sea + x * x)
      const coastLen = coast - x
      return seaLen * cSea + coastLen * cCoast
    },
    objectiveLabel: 'C(x) = 80√(36 + x²) + 50(15 − x)',
    objectiveUnit: 'miles $',
    yAxisLabel: 'Costo (miles $)',
    minimize: true,
    metrics: (x, _W, _H, _f, _rW, _lD, _cW, _cL, _R, _V, _cR, _cH, sea, coast, cSea, cCoast) => {
      const seaLen = Math.sqrt(sea * sea + x * x)
      const coastLen = coast - x
      return [
        { label: 'Punto x', value: `${format(x)} km` },
        { label: 'Tubería mar', value: `${format(seaLen)} km ($${format(seaLen * cSea)}k)` },
        { label: 'Tubería costa', value: `${format(coastLen)} km ($${format(coastLen * cCoast)}k)` },
        { label: 'Costo total', value: `$${format(seaLen * cSea + coastLen * cCoast)}k`, highlight: true },
      ]
    },
  },
]

/* ── scene visualizations (SVG) ─────────────────────────────── */

function OpenBoxViz({ x, W, H }) {
  const svgW = 280
  const svgH = 200
  const scale = Math.min((svgW - 20) / W, (svgH - 20) / H)
  const sw = W * scale
  const sh = H * scale
  const sx = x * scale
  const ox = (svgW - sw) / 2
  const oy = (svgH - sh) / 2

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* full sheet */}
      <rect x={ox} y={oy} width={sw} height={sh} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" rx="2" />
      {/* corner cuts */}
      {[[ox, oy], [ox + sw - sx, oy], [ox, oy + sh - sx], [ox + sw - sx, oy + sh - sx]].map(([cx, cy], i) => (
        <rect key={i} x={cx} y={cy} width={sx} height={sx} fill="rgba(255,107,53,0.3)" stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" rx="1" />
      ))}
      {/* resulting base */}
      <rect x={ox + sx} y={oy + sx} width={sw - 2 * sx} height={sh - 2 * sx} fill="rgba(80,150,255,0.15)" stroke="#5096ff" strokeWidth="2" rx="2" />
      {/* dimension labels */}
      <text x={svgW / 2} y={oy - 4} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle">{W} cm</text>
      <text x={ox - 4} y={svgH / 2} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="end" dominantBaseline="middle">{H}</text>
      <text x={ox + sx / 2} y={oy + sx / 2 + 4} fill="#ff6b35" fontSize="11" textAnchor="middle" fontWeight="600">x</text>
    </svg>
  )
}

function FenceWallViz({ x, fence }) {
  const depth = Math.max(fence - 2 * x, 0)
  const svgW = 280
  const svgH = 200
  const maxDim = Math.max(fence / 2, 1)
  const scale = (svgW - 60) / maxDim
  const rw = x * scale
  const rd = depth * scale
  const ox = (svgW - rw) / 2
  const wallY = 30

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* wall */}
      <line x1="10" y1={wallY} x2={svgW - 10} y2={wallY} stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" />
      <text x={svgW / 2} y={wallY - 8} fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="middle">PARED</text>
      {/* corral */}
      <rect x={ox} y={wallY} width={rw} height={Math.min(rd, svgH - wallY - 20)} fill="rgba(34,197,160,0.15)" stroke="#22c5a0" strokeWidth="2" rx="2" />
      {/* fence segments */}
      <line x1={ox} y1={wallY} x2={ox} y2={wallY + Math.min(rd, svgH - wallY - 20)} stroke="#ff6b35" strokeWidth="2.5" />
      <line x1={ox + rw} y1={wallY} x2={ox + rw} y2={wallY + Math.min(rd, svgH - wallY - 20)} stroke="#ff6b35" strokeWidth="2.5" />
      <line x1={ox} y1={wallY + Math.min(rd, svgH - wallY - 20)} x2={ox + rw} y2={wallY + Math.min(rd, svgH - wallY - 20)} stroke="#ff6b35" strokeWidth="2.5" />
      {/* labels */}
      <text x={ox + rw / 2} y={wallY + Math.min(rd, svgH - wallY - 20) + 16} fill="#22c5a0" fontSize="11" textAnchor="middle" fontWeight="600">x = {format(x)} m</text>
      <text x={ox - 8} y={wallY + Math.min(rd, svgH - wallY - 20) / 2} fill="#ff6b35" fontSize="10" textAnchor="end" dominantBaseline="middle">{format(depth)} m</text>
    </svg>
  )
}

function CableViz({ x, riverWidth, landDist }) {
  const svgW = 280
  const svgH = 200
  const pad = 30
  const scX = (svgW - 2 * pad) / landDist
  const scY = (svgH - 2 * pad) / (riverWidth * 1.5)
  const riverTop = pad + 20
  const riverBot = riverTop + riverWidth * scY
  // factory at (0, riverTop) — top bank
  // plant at (landDist, riverBot) — bottom bank
  const fx = pad
  const fy = riverTop
  const px = pad + landDist * scX
  const py = riverBot
  const crossX = pad + x * scX
  const crossTopY = fy
  const crossBotY = py

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* river */}
      <rect x={0} y={riverTop} width={svgW} height={riverBot - riverTop} fill="rgba(80,150,255,0.1)" />
      <text x={svgW / 2} y={(riverTop + riverBot) / 2 + 4} fill="rgba(80,150,255,0.3)" fontSize="10" textAnchor="middle">RÍO ({riverWidth} m)</text>
      {/* land cable */}
      <line x1={crossX} y1={crossBotY} x2={px} y2={py} stroke="#22c5a0" strokeWidth="2.5" strokeLinecap="round" />
      {/* water cable */}
      <line x1={fx} y1={fy} x2={crossX} y2={crossBotY} stroke="#5096ff" strokeWidth="2.5" strokeLinecap="round" />
      {/* crossing point */}
      <circle cx={crossX} cy={crossBotY} r="5" fill="#ff6b35" />
      {/* factory */}
      <circle cx={fx} cy={fy} r="6" fill="white" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <text x={fx} y={fy - 10} fill="rgba(255,255,255,0.6)" fontSize="9" textAnchor="middle">Fábrica</text>
      {/* plant */}
      <circle cx={px} cy={py} r="6" fill="white" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <text x={px} y={py + 16} fill="rgba(255,255,255,0.6)" fontSize="9" textAnchor="middle">Planta</text>
      {/* x label */}
      <text x={crossX} y={crossBotY + 16} fill="#ff6b35" fontSize="10" textAnchor="middle" fontWeight="600">x = {format(x)}</text>
    </svg>
  )
}

function ConeInSphereViz({ h, R }) {
  const svgW = 280
  const svgH = 220
  const cx = svgW / 2
  const cy = svgH / 2
  const sr = 80 // sphere radius in SVG
  const scale = sr / R
  const r2 = h * (2 * R - h)
  const coneR = r2 > 0 ? Math.sqrt(r2) * scale : 0
  // cone tip at top of sphere: cy - sr
  // cone base center at: cy - sr + h*scale
  const tipY = cy - sr
  const baseY = tipY + h * scale
  const baseCx = cx

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* sphere */}
      <circle cx={cx} cy={cy} r={sr} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* cone */}
      {coneR > 0 && (
        <>
          <polygon
            points={`${baseCx},${tipY} ${baseCx - coneR},${baseY} ${baseCx + coneR},${baseY}`}
            fill="rgba(80,150,255,0.12)"
            stroke="#5096ff"
            strokeWidth="2"
          />
          {/* base ellipse */}
          <ellipse cx={baseCx} cy={baseY} rx={coneR} ry={coneR * 0.25} fill="rgba(80,150,255,0.08)" stroke="#5096ff" strokeWidth="1.5" />
        </>
      )}
      {/* height line */}
      <line x1={cx} y1={tipY} x2={cx} y2={baseY} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + 8} y={(tipY + baseY) / 2} fill="#ff6b35" fontSize="10" dominantBaseline="middle" fontWeight="600">h</text>
      {/* radius line */}
      {coneR > 0 && (
        <>
          <line x1={cx} y1={baseY} x2={cx + coneR} y2={baseY} stroke="#22c5a0" strokeWidth="1.5" strokeDasharray="4 2" />
          <text x={cx + coneR / 2} y={baseY + 14} fill="#22c5a0" fontSize="10" textAnchor="middle" fontWeight="600">r</text>
        </>
      )}
      {/* sphere radius label */}
      <line x1={cx} y1={cy} x2={cx + sr} y2={cy} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 2" />
      <text x={cx + sr / 2} y={cy - 6} fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle">R = {R}</text>
      {/* tip dot */}
      <circle cx={cx} cy={tipY} r="3" fill="#ff6b35" />
    </svg>
  )
}

function CylinderCanViz({ r, V }) {
  const svgW = 280
  const svgH = 200
  const h = V / (Math.PI * r * r)
  const cx = svgW / 2
  // normalize: map r and h to pixel space keeping proportions visible
  const maxPixelR = 90
  const maxPixelH = 150
  const pixR = Math.min(r * 8, maxPixelR)
  const pixH = Math.min(h * 4, maxPixelH)
  // ensure minimum visible height
  const drawH = Math.max(pixH, 20)
  const ry = Math.max(pixR * 0.2, 6)
  const topY = (svgH - drawH) / 2
  const botY = topY + drawH

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* body fill */}
      <path
        d={`M${cx - pixR},${topY} L${cx - pixR},${botY} A${pixR},${ry} 0 0,0 ${cx + pixR},${botY} L${cx + pixR},${topY}`}
        fill="rgba(80,150,255,0.1)"
      />
      {/* side lines */}
      <line x1={cx - pixR} y1={topY} x2={cx - pixR} y2={botY} stroke="#5096ff" strokeWidth="2" />
      <line x1={cx + pixR} y1={topY} x2={cx + pixR} y2={botY} stroke="#5096ff" strokeWidth="2" />
      {/* bottom ellipse (full, behind) */}
      <ellipse cx={cx} cy={botY} rx={pixR} ry={ry} fill="rgba(80,150,255,0.06)" stroke="#5096ff" strokeWidth="1.5" />
      {/* top ellipse (full, on top) */}
      <ellipse cx={cx} cy={topY} rx={pixR} ry={ry} fill="rgba(80,150,255,0.18)" stroke="#5096ff" strokeWidth="2" />
      {/* radius line on top */}
      <line x1={cx} y1={topY} x2={cx + pixR} y2={topY} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + pixR / 2} y={topY - 8} fill="#ff6b35" fontSize="10" textAnchor="middle" fontWeight="600">r = {format(r)}</text>
      {/* height line */}
      <line x1={cx + pixR + 14} y1={topY} x2={cx + pixR + 14} y2={botY} stroke="#22c5a0" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + pixR + 24} y={(topY + botY) / 2} fill="#22c5a0" fontSize="10" dominantBaseline="middle" fontWeight="600">h = {format(h)}</text>
    </svg>
  )
}

function CylinderInConeViz({ r, cR, cH }) {
  const svgW = 280
  const svgH = 220
  const cx = svgW / 2
  const pad = 20
  const scale = Math.min((svgW - pad * 2) / (cR * 2), (svgH - pad * 2) / cH)
  const coneW = cR * scale
  const coneHpx = cH * scale
  const tipY = pad
  const baseY = pad + coneHpx
  const cylR = r * scale
  const cylH = cH * (1 - r / cR) * scale

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* cone outline */}
      <polygon
        points={`${cx},${tipY} ${cx - coneW},${baseY} ${cx + coneW},${baseY}`}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      {/* cone base ellipse */}
      <ellipse cx={cx} cy={baseY} rx={coneW} ry={coneW * 0.15} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* cylinder */}
      {cylH > 0 && cylR > 0 && (
        <>
          <rect x={cx - cylR} y={baseY - cylH} width={cylR * 2} height={cylH} fill="rgba(80,150,255,0.12)" stroke="#5096ff" strokeWidth="2" />
          <ellipse cx={cx} cy={baseY - cylH} rx={cylR} ry={cylR * 0.15} fill="rgba(80,150,255,0.15)" stroke="#5096ff" strokeWidth="1.5" />
          <ellipse cx={cx} cy={baseY} rx={cylR} ry={cylR * 0.15} fill="rgba(80,150,255,0.08)" stroke="#5096ff" strokeWidth="1" />
        </>
      )}
      {/* labels */}
      <line x1={cx} y1={baseY} x2={cx + cylR} y2={baseY} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + cylR / 2} y={baseY + 16} fill="#ff6b35" fontSize="10" textAnchor="middle" fontWeight="600">r = {format(r)}</text>
      {cylH > 0 && (
        <>
          <line x1={cx - cylR - 10} y1={baseY - cylH} x2={cx - cylR - 10} y2={baseY} stroke="#22c5a0" strokeWidth="1.5" strokeDasharray="4 2" />
          <text x={cx - cylR - 18} y={baseY - cylH / 2} fill="#22c5a0" fontSize="10" textAnchor="end" dominantBaseline="middle" fontWeight="600">h</text>
        </>
      )}
    </svg>
  )
}

function SubmarinePipeViz({ x, seaDist, coastDist }) {
  const svgW = 280
  const svgH = 200
  const pad = 25
  const scX = (svgW - pad * 2) / coastDist
  const seaH = 70
  const coastY = pad + seaH
  // island at (0, pad) — top
  // plant at (coastDist, coastY) — on coast
  const islandX = pad
  const islandY = pad + 10
  const plantX = pad + coastDist * scX
  const plantY = coastY
  const crossX = pad + x * scX

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* sea */}
      <rect x={0} y={0} width={svgW} height={coastY} fill="rgba(80,150,255,0.08)" />
      <text x={svgW / 2} y={coastY / 2} fill="rgba(80,150,255,0.25)" fontSize="10" textAnchor="middle">MAR ({seaDist} km)</text>
      {/* coast line */}
      <line x1={0} y1={coastY} x2={svgW} y2={coastY} stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <text x={svgW / 2} y={coastY + 14} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="middle">COSTA ({coastDist} km)</text>
      {/* submarine pipe */}
      <line x1={islandX} y1={islandY} x2={crossX} y2={coastY} stroke="#5096ff" strokeWidth="2.5" strokeLinecap="round" />
      {/* coast pipe */}
      <line x1={crossX} y1={coastY} x2={plantX} y2={plantY} stroke="#22c5a0" strokeWidth="2.5" strokeLinecap="round" />
      {/* points */}
      <circle cx={islandX} cy={islandY} r="6" fill="white" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <text x={islandX + 10} y={islandY + 4} fill="rgba(255,255,255,0.6)" fontSize="9">Isla</text>
      <circle cx={plantX} cy={plantY} r="6" fill="white" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <text x={plantX - 5} y={plantY + 18} fill="rgba(255,255,255,0.6)" fontSize="9" textAnchor="end">Planta</text>
      <circle cx={crossX} cy={coastY} r="5" fill="#ff6b35" />
      <text x={crossX} y={coastY + 18} fill="#ff6b35" fontSize="10" textAnchor="middle" fontWeight="600">x = {format(x)}</text>
    </svg>
  )
}

/* ── main component ─────────────────────────────────────────── */

export const OptimizationLab = () => {
  const [scenarioId, setScenarioId] = useState('open-box')
  const sc = scenarios.find((s) => s.id === scenarioId) || scenarios[0]

  // compute param max
  const paramMax = sc.id === 'open-box' ? Math.min(sc.sheetW, sc.sheetH) / 2 - 0.1
    : sc.id === 'fence-wall' ? sc.totalFence / 2 - 0.5
    : sc.id === 'shortest-cable' ? sc.landDist
    : sc.id === 'cone-in-sphere' ? 2 * sc.sphereR - 0.1
    : sc.id === 'cylinder-can' ? 12
    : sc.id === 'cylinder-in-cone' ? sc.coneR - 0.1
    : sc.id === 'submarine-pipe' ? sc.coastDist
    : 10

  const [param, setParam] = useState(sc.paramDefault)
  const clampedParam = Math.min(Math.max(param, sc.paramMin), paramMax)

  // evaluate objective
  const evalObj = (x) => {
    if (sc.id === 'open-box') return sc.objective(x, sc.sheetW, sc.sheetH)
    if (sc.id === 'fence-wall') return sc.objective(x, 0, 0, sc.totalFence)
    if (sc.id === 'shortest-cable') return sc.objective(x, 0, 0, 0, sc.riverWidth, sc.landDist, sc.costWater, sc.costLand)
    if (sc.id === 'cone-in-sphere') return sc.objective(x, 0, 0, 0, 0, 0, 0, 0, sc.sphereR)
    if (sc.id === 'cylinder-can') return sc.objective(x, 0, 0, 0, 0, 0, 0, 0, 0, sc.volume)
    if (sc.id === 'cylinder-in-cone') return sc.objective(x, 0, 0, 0, 0, 0, 0, 0, 0, 0, sc.coneR, sc.coneH)
    if (sc.id === 'submarine-pipe') return sc.objective(x, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, sc.seaDist, sc.coastDist, sc.costSea, sc.costCoast)
    return 0
  }

  const currentVal = evalObj(clampedParam)

  const metrics = useMemo(() => {
    if (sc.id === 'open-box') return sc.metrics(clampedParam, sc.sheetW, sc.sheetH)
    if (sc.id === 'fence-wall') return sc.metrics(clampedParam, 0, 0, sc.totalFence)
    if (sc.id === 'shortest-cable') return sc.metrics(clampedParam, 0, 0, 0, sc.riverWidth, sc.landDist, sc.costWater, sc.costLand)
    if (sc.id === 'cone-in-sphere') return sc.metrics(clampedParam, 0, 0, 0, 0, 0, 0, 0, sc.sphereR)
    if (sc.id === 'cylinder-can') return sc.metrics(clampedParam, 0, 0, 0, 0, 0, 0, 0, 0, sc.volume)
    if (sc.id === 'cylinder-in-cone') return sc.metrics(clampedParam, 0, 0, 0, 0, 0, 0, 0, 0, 0, sc.coneR, sc.coneH)
    if (sc.id === 'submarine-pipe') return sc.metrics(clampedParam, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, sc.seaDist, sc.coastDist, sc.costSea, sc.costCoast)
    return []
  }, [sc, clampedParam])

  // find optimum numerically
  const { optX, optVal } = useMemo(() => {
    let bestX = sc.paramMin
    let bestVal = sc.minimize ? Infinity : -Infinity
    const steps = 500
    for (let i = 0; i <= steps; i++) {
      const x = sc.paramMin + (i / steps) * (paramMax - sc.paramMin)
      const v = evalObj(x)
      if (sc.minimize ? v < bestVal : v > bestVal) {
        bestVal = v
        bestX = x
      }
    }
    return { optX: bestX, optVal: bestVal }
  }, [sc, paramMax])

  // graph data — fixed Y range per scenario to prevent jitter
  const graphPoints = sampleRange(sc.paramMin, paramMax, 200, evalObj)
  const { yMin: defaultYMin, yMax: defaultYMax } = useMemo(() => {
    const yVals = graphPoints.map((p) => p.y).filter(Number.isFinite)
    const rawMin = Math.min(...yVals)
    const rawMax = Math.max(...yVals)
    const pad = Math.max((rawMax - rawMin) * 0.1, 1)
    const yMn = sc.minimize ? rawMin - pad : 0
    const yMx = rawMax + pad
    return { yMin: yMn, yMax: yMx }
  }, [sc.id, paramMax])

  const graphAxis = useAxisRange({ xMin: sc.paramMin, xMax: paramMax, yMin: defaultYMin, yMax: defaultYMax })

  // CSV export
  const handleCsv = () => {
    const header = ['x', sc.yAxisLabel]
    const rows = [header, ...graphPoints.map((p) => [p.x.toFixed(2), p.y.toFixed(4)])]
    downloadCsv(rows, `optimizacion-${sc.id}.csv`)
  }

  // change scenario
  const changeScenario = (id) => {
    setScenarioId(id)
    const next = scenarios.find((s) => s.id === id)
    if (next) setParam(next.paramDefault)
    graphAxis.resetRange()
  }

  return (
    <div className="rounded-[2.2rem] border border-ink/12 bg-white p-4 shadow-[0_28px_70px_rgba(18,23,35,0.12)] md:p-6">
      {/* problem selector tabs */}
      <div className="flex flex-wrap gap-2">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => changeScenario(s.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${s.id === sc.id ? 'bg-ink text-paper' : 'border border-ink/10 bg-paper text-ink/70 hover:border-ink/30'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* problem description */}
      <p className="mt-4 text-sm leading-6 text-ink/72">{sc.context}</p>

      {/* main grid: viz + slider | graph */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* LEFT: visualization + slider + metrics */}
        <div className="space-y-3">
          <div className="rounded-[1.4rem] border border-white/10 bg-ink p-4">
            {sc.id === 'open-box' && <OpenBoxViz x={clampedParam} W={sc.sheetW} H={sc.sheetH} />}
            {sc.id === 'fence-wall' && <FenceWallViz x={clampedParam} fence={sc.totalFence} />}
            {sc.id === 'shortest-cable' && <CableViz x={clampedParam} riverWidth={sc.riverWidth} landDist={sc.landDist} />}
            {sc.id === 'cone-in-sphere' && <ConeInSphereViz h={clampedParam} R={sc.sphereR} />}
            {sc.id === 'cylinder-can' && <CylinderCanViz r={clampedParam} V={sc.volume} />}
            {sc.id === 'cylinder-in-cone' && <CylinderInConeViz r={clampedParam} cR={sc.coneR} cH={sc.coneH} />}
            {sc.id === 'submarine-pipe' && <SubmarinePipeViz x={clampedParam} seaDist={sc.seaDist} coastDist={sc.coastDist} />}
          </div>

          <SliderField
            id="opt-param"
            label={sc.paramLabel}
            value={clampedParam}
            min={sc.paramMin}
            max={paramMax}
            step={sc.paramStep}
            suffix={sc.paramUnit}
            onChange={setParam}
          />

          <div className="grid grid-cols-2 gap-2">
            {metrics.map((m) => (
              <MetricCard key={m.label} label={m.label} value={m.value} dark={m.highlight} />
            ))}
          </div>
        </div>

        {/* RIGHT: function graph */}
        <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-[1.4rem] border border-white/10 bg-ink p-4">
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-paper/45">Función objetivo</p>
            <p className="mb-3 font-mono text-xs text-paper/60">{sc.objectiveLabel}</p>
            <CartesianFrame
              width={540}
              height={280}
              xMin={graphAxis.xMin}
              xMax={graphAxis.xMax}
              yMin={graphAxis.yMin}
              yMax={graphAxis.yMax}
              xTicks={generateTicks(graphAxis.xMin, graphAxis.xMax)}
              yTicks={generateTicks(graphAxis.yMin, graphAxis.yMax)}
              xLabel={sc.paramLabel}
              yLabel={sc.yAxisLabel}
              dark
            >
              {({ scaleX, scaleY }) => (
                <>
                  <path
                    d={linePath(graphPoints, scaleX, scaleY)}
                    fill="none"
                    stroke="#5096ff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx={scaleX(optX)} cy={scaleY(optVal)} r="5" fill="#22c5a0" stroke="white" strokeWidth="1.5" />
                  <text x={scaleX(optX) + 8} y={scaleY(optVal) - 8} fill="#22c5a0" fontSize="10" fontWeight="600">
                    {sc.minimize ? 'mín' : 'máx'} ({format(optX)}, {format(optVal)})
                  </text>
                  <circle cx={scaleX(clampedParam)} cy={scaleY(currentVal)} r="6" fill="#ff6b35" stroke="white" strokeWidth="2" />
                  <line x1={scaleX(clampedParam)} y1={scaleY(graphAxis.yMin)} x2={scaleX(clampedParam)} y2={scaleY(currentVal)} stroke="#ff6b35" strokeWidth="1" strokeDasharray="4 3" />
                </>
              )}
            </CartesianFrame>
            <AxisRangePanel {...graphAxis} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-graph/25 bg-graph/10 px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-graph" />
              <span className="text-sm font-semibold text-ink">
                {sc.minimize ? 'Mínimo' : 'Máximo'} en x = {format(optX)} → {format(optVal)} {sc.objectiveUnit}
              </span>
            </div>
            <button
              onClick={handleCsv}
              className="rounded-full border border-ink/10 bg-paper px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-ink/30"
            >
              CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, generateTicks, linePath, sampleRange } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

/* ── containers ─────────────────────────────────────────────── */
// Each container defines h(V) — height as a function of volume poured,
// and V(h) — volume as a function of height (for the graph).

const containers = [
  {
    id: 'cylinder-fill',
    label: 'Cilindro',
    context: 'Un cilindro de radio R se llena con agua. La altura sube linealmente con el volumen porque la sección transversal es constante.',
    params: [
      { key: 'R', label: 'Radio del cilindro (R)', min: 1, max: 12, step: 0.1, default: 5, unit: 'cm' },
    ],
    maxH: () => 25,
    heightOfVolume: ({ R }, V) => V / (Math.PI * R * R),
    volumeOfHeight: ({ R }, h) => Math.PI * R * R * h,
    model: 'V(h) = πR²h  →  h(V) = frac(V,πR²)',
    family: 'Lineal',
    metrics: ({ R }, h, V) => [
      { label: 'Radio R', value: `${format(R)} cm` },
      { label: 'Altura del agua', value: `${format(h)} cm`, highlight: true },
      { label: 'Volumen', value: `${format(V)} cm³`, highlight: true },
      { label: 'Sección A(h)', value: `${format(Math.PI * R * R)} cm²` },
    ],
  },
  {
    id: 'cone-fill',
    label: 'Cono',
    context: 'Un cono invertido de radio R y altura H se llena con agua. Como la sección crece con la altura, la relación V-h es cúbica y la altura sube rápido al principio.',
    params: [
      { key: 'R', label: 'Radio del cono (R)', min: 1, max: 12, step: 0.1, default: 6, unit: 'cm' },
      { key: 'H', label: 'Altura del cono (H)', min: 2, max: 30, step: 0.1, default: 18, unit: 'cm' },
    ],
    maxH: ({ H }) => H,
    heightOfVolume: ({ R, H }, V) => {
      // V = (π/3)(R·h/H)²·h = πR²h³/(3H²)  →  h = ∛(3VH²/(πR²))
      const val = Math.cbrt((3 * V * H * H) / (Math.PI * R * R))
      return Math.min(val, H)
    },
    volumeOfHeight: ({ R, H }, h) => {
      const r = (R * h) / H
      return (Math.PI / 3) * r * r * h
    },
    model: 'V(h) = frac(πR²,3H²) · h³',
    family: 'Cúbica',
    metrics: ({ R, H }, h, V) => {
      const r = (R * h) / H
      const section = Math.PI * r * r
      return [
        { label: 'Cono (R, H)', value: `${format(R)}, ${format(H)} cm` },
        { label: 'Altura del agua', value: `${format(h)} cm`, highlight: true },
        { label: 'Volumen', value: `${format(V)} cm³`, highlight: true },
        { label: 'Sección A(h)', value: `${format(section)} cm²` },
      ]
    },
  },
  {
    id: 'sphere-fill',
    label: 'Esfera',
    context: 'Una esfera de radio R se llena con agua desde abajo. La sección circular cambia con la altura y la relación V-h no es uniforme: avanza lento, luego rápido, luego lento.',
    params: [
      { key: 'R', label: 'Radio de la esfera (R)', min: 2, max: 12, step: 0.1, default: 6, unit: 'cm' },
    ],
    maxH: ({ R }) => 2 * R,
    heightOfVolume: ({ R }, V) => {
      // V = π·h²(3R - h)/3  — solve numerically
      let lo = 0, hi = 2 * R
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2
        const vMid = (Math.PI * mid * mid * (3 * R - mid)) / 3
        if (vMid < V) lo = mid; else hi = mid
      }
      return (lo + hi) / 2
    },
    volumeOfHeight: ({ R }, h) => (Math.PI * h * h * (3 * R - h)) / 3,
    model: 'V(h) = frac(π,3) · h²(3R − h)',
    family: 'Cúbica (con cambio de concavidad)',
    metrics: ({ R }, h, V) => {
      const pct = ((V / ((4 / 3) * Math.PI * R * R * R)) * 100)
      return [
        { label: 'Radio R', value: `${format(R)} cm` },
        { label: 'Altura del agua', value: `${format(h)} cm`, highlight: true },
        { label: 'Volumen', value: `${format(V)} cm³`, highlight: true },
        { label: '% lleno', value: `${format(pct)}%` },
      ]
    },
  },
  {
    id: 'bicone-fill',
    label: 'Bicono',
    context: 'Dos conos idénticos unidos por sus puntas (vértice a vértice). Al llenar desde abajo, el agua sube rápido en la parte cónica inferior, se estrecha en la unión y luego se expande en el cono superior. La curva V(h) tiene un punto de inflexión en la unión.',
    params: [
      { key: 'R', label: 'Radio máximo (R)', min: 2, max: 12, step: 0.1, default: 6, unit: 'cm' },
      { key: 'H', label: 'Altura de cada cono (H)', min: 3, max: 20, step: 0.1, default: 10, unit: 'cm' },
    ],
    maxH: ({ H }) => 2 * H,
    heightOfVolume: ({ R, H }, V) => {
      // Bottom cone (inverted): V = πR²h³/(3H²) for h ∈ [0, H]
      const vBottom = (Math.PI * R * R * H) / 3
      if (V <= vBottom) {
        return Math.cbrt((3 * V * H * H) / (Math.PI * R * R))
      }
      // Top cone: V = vBottom + π/3·[R²H - R²(2H-h)³/H²]  — solve numerically
      let lo = H, hi = 2 * H
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2
        const hTop = mid - H
        const rTop = R * (1 - hTop / H)
        const vTopCone = (Math.PI / 3) * R * R * H - (Math.PI / 3) * rTop * rTop * (H - hTop)
        if (vBottom + vTopCone < V) lo = mid; else hi = mid
      }
      return (lo + hi) / 2
    },
    volumeOfHeight: ({ R, H }, h) => {
      if (h <= H) {
        // Bottom cone (inverted, tip at bottom)
        const r = (R * h) / H
        return (Math.PI / 3) * r * r * h
      }
      // Full bottom cone + partial top cone (tip at top)
      const vBottom = (Math.PI * R * R * H) / 3
      const hTop = h - H
      const rAt = R * (1 - hTop / H)
      const vTopFull = (Math.PI / 3) * R * R * H
      const vTopRemaining = (Math.PI / 3) * rAt * rAt * (H - hTop)
      return vBottom + vTopFull - vTopRemaining
    },
    model: 'Dos conos: V₁(h) = frac(πR²,3H²)h³ + transición',
    family: 'Cúbica por tramos (punto de inflexión)',
    metrics: ({ R, H }, h, V) => {
      const totalV = (2 * Math.PI * R * R * H) / 3
      const pct = (V / totalV) * 100
      const zone = h <= H ? 'Cono inferior' : 'Cono superior'
      return [
        { label: 'Bicono (R, H)', value: `${format(R)}, ${format(H)} cm` },
        { label: 'Altura del agua', value: `${format(h)} cm`, highlight: true },
        { label: 'Volumen', value: `${format(V)} cm³`, highlight: true },
        { label: 'Zona', value: `${zone} (${format(pct)}%)` },
      ]
    },
  },
  {
    id: 'cylsphere-fill',
    label: 'Cilindro + semiesfera',
    context: 'Un cilindro con una semiesfera en la parte superior (como un silo o cápsula). La base cilíndrica tiene sección constante (lineal), y la semiesfera tiene sección decreciente. La curva V(h) cambia de lineal a cóncava.',
    params: [
      { key: 'R', label: 'Radio (R)', min: 2, max: 10, step: 0.1, default: 5, unit: 'cm' },
      { key: 'Hc', label: 'Altura cilindro (Hc)', min: 2, max: 25, step: 0.1, default: 12, unit: 'cm' },
    ],
    maxH: ({ R, Hc }) => Hc + R,
    heightOfVolume: ({ R, Hc }, V) => {
      const vCyl = Math.PI * R * R * Hc
      if (V <= vCyl) {
        return V / (Math.PI * R * R)
      }
      // Spherical cap: V = vCyl + π·hS²(3R - hS)/3  — solve numerically
      const vSphere = V - vCyl
      let lo = 0, hi = R
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2
        const vCap = (Math.PI * mid * mid * (3 * R - mid)) / 3
        if (vCap < vSphere) lo = mid; else hi = mid
      }
      return Hc + (lo + hi) / 2
    },
    volumeOfHeight: ({ R, Hc }, h) => {
      if (h <= Hc) {
        return Math.PI * R * R * h
      }
      const vCyl = Math.PI * R * R * Hc
      const hS = h - Hc
      const vCap = (Math.PI * hS * hS * (3 * R - hS)) / 3
      return vCyl + vCap
    },
    model: 'V(h) = πR²h (h ≤ Hc), luego +frac(π,3)hS²(3R − hS)',
    family: 'Lineal → cúbica (cambio de régimen)',
    metrics: ({ R, Hc }, h, V) => {
      const totalV = Math.PI * R * R * Hc + (2 / 3) * Math.PI * R * R * R
      const pct = (V / totalV) * 100
      const zone = h <= Hc ? 'Cilindro' : 'Semiesfera'
      return [
        { label: 'R, Hc', value: `${format(R)}, ${format(Hc)} cm` },
        { label: 'Altura del agua', value: `${format(h)} cm`, highlight: true },
        { label: 'Volumen', value: `${format(V)} cm³`, highlight: true },
        { label: 'Zona', value: `${zone} (${format(pct)}%)` },
      ]
    },
  },
]

/* ── SVG visualizations ────────────────────────────────────── */

function CylinderFillViz({ R, h, maxH }) {
  const svgW = 280, svgH = 220
  const cx = svgW / 2
  const pixR = Math.min(R * 6, 80)
  const totalH = 160
  const ry = Math.max(pixR * 0.2, 5)
  const topY = (svgH - totalH) / 2
  const botY = topY + totalH
  const waterH = Math.min((h / maxH) * totalH, totalH)
  const waterTop = botY - waterH

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* water fill */}
      <path d={`M${cx - pixR},${waterTop} L${cx - pixR},${botY} A${pixR},${ry} 0 0,0 ${cx + pixR},${botY} L${cx + pixR},${waterTop}`} fill="rgba(80,150,255,0.25)" />
      <ellipse cx={cx} cy={waterTop} rx={pixR} ry={ry} fill="rgba(80,150,255,0.35)" stroke="rgba(80,150,255,0.6)" strokeWidth="1" />
      {/* container outline */}
      <line x1={cx - pixR} y1={topY} x2={cx - pixR} y2={botY} stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <line x1={cx + pixR} y1={topY} x2={cx + pixR} y2={botY} stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <ellipse cx={cx} cy={topY} rx={pixR} ry={ry} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <ellipse cx={cx} cy={botY} rx={pixR} ry={ry} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      {/* height label */}
      <line x1={cx + pixR + 14} y1={waterTop} x2={cx + pixR + 14} y2={botY} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + pixR + 24} y={(waterTop + botY) / 2} fill="#ff6b35" fontSize="10" dominantBaseline="middle" fontWeight="600">h</text>
    </svg>
  )
}

function ConeFillViz({ R, H, h }) {
  const svgW = 280, svgH = 220
  const cx = svgW / 2
  const pad = 20
  const scale = Math.min((svgW - pad * 2) / (R * 2 + 4), (svgH - pad * 2) / (H + 2))
  const coneW = R * scale
  const coneH = H * scale
  // inverted cone: tip at bottom
  const tipY = pad + coneH
  const openY = pad
  const waterFrac = Math.min(h / H, 1)
  const waterH = waterFrac * coneH
  const waterW = waterFrac * coneW
  const waterBotY = tipY
  const waterTopY = tipY - waterH

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* container outline (inverted cone) */}
      <polygon points={`${cx},${tipY} ${cx - coneW},${openY} ${cx + coneW},${openY}`} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <ellipse cx={cx} cy={openY} rx={coneW} ry={Math.max(coneW * 0.12, 3)} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* water */}
      {waterH > 0.5 && (
        <>
          <polygon points={`${cx},${waterBotY} ${cx - waterW},${waterTopY} ${cx + waterW},${waterTopY}`} fill="rgba(80,150,255,0.25)" />
          <ellipse cx={cx} cy={waterTopY} rx={waterW} ry={Math.max(waterW * 0.12, 2)} fill="rgba(80,150,255,0.35)" stroke="rgba(80,150,255,0.6)" strokeWidth="1" />
        </>
      )}
      {/* height label */}
      <line x1={cx + coneW + 10} y1={waterTopY} x2={cx + coneW + 10} y2={tipY} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + coneW + 20} y={(waterTopY + tipY) / 2} fill="#ff6b35" fontSize="10" dominantBaseline="middle" fontWeight="600">h</text>
    </svg>
  )
}

function SphereFillViz({ R, h }) {
  const svgW = 280, svgH = 220
  const cx = svgW / 2, cy = svgH / 2
  const pixR = Math.min(R * 6, 85)
  // water level: h goes from 0 (bottom) to 2R (top)
  const botY = cy + pixR
  const waterFrac = Math.min(h / (2 * R), 1)
  const waterTopY = botY - waterFrac * 2 * pixR
  // width of water at that level
  const hNorm = waterFrac * 2 * R
  const rWater = Math.sqrt(Math.max(2 * R * hNorm - hNorm * hNorm, 0))
  const pixRWater = (rWater / R) * pixR
  // max circumference at equator (h = R)
  const equatorY = cy

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* sphere outline */}
      <circle cx={cx} cy={cy} r={pixR} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      {/* equator — max circumference line (inflection reference) */}
      <ellipse cx={cx} cy={equatorY} rx={pixR} ry={pixR * 0.18} fill="none" stroke="rgba(34,197,160,0.35)" strokeWidth="1" strokeDasharray="5 3" />
      <text x={cx + pixR + 4} y={equatorY - 4} fill="rgba(34,197,160,0.6)" fontSize="8" fontWeight="600">ecuador</text>
      {/* radius line */}
      <line x1={cx} y1={cy} x2={cx + pixR} y2={cy} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 2" />
      <text x={cx + pixR / 2} y={cy - 6} fill="rgba(255,255,255,0.5)" fontSize="9" textAnchor="middle">R = {format(R)}</text>
      <circle cx={cx} cy={cy} r="2.5" fill="rgba(255,255,255,0.4)" />
      {/* water fill — clip to sphere */}
      <defs>
        <clipPath id="sphere-clip">
          <circle cx={cx} cy={cy} r={pixR - 1} />
        </clipPath>
      </defs>
      <rect x={cx - pixR} y={waterTopY} width={pixR * 2} height={botY - waterTopY} fill="rgba(80,150,255,0.25)" clipPath="url(#sphere-clip)" />
      {/* water surface line with width indicator */}
      {pixRWater > 1 && (
        <>
          <ellipse cx={cx} cy={waterTopY} rx={pixRWater} ry={Math.max(pixRWater * 0.15, 2)} fill="rgba(80,150,255,0.35)" stroke="rgba(80,150,255,0.6)" strokeWidth="1" clipPath="url(#sphere-clip)" />
          {/* water radius line */}
          <line x1={cx} y1={waterTopY} x2={cx + pixRWater} y2={waterTopY} stroke="rgba(80,150,255,0.7)" strokeWidth="1" strokeDasharray="3 2" />
          <text x={cx + pixRWater / 2} y={waterTopY - 5} fill="rgba(80,150,255,0.8)" fontSize="8" textAnchor="middle">r(h) = {format(rWater)}</text>
        </>
      )}
      {/* height label */}
      <line x1={cx + pixR + 10} y1={waterTopY} x2={cx + pixR + 10} y2={botY} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + pixR + 20} y={(waterTopY + botY) / 2} fill="#ff6b35" fontSize="10" dominantBaseline="middle" fontWeight="600">h</text>
      {/* inflection marker at equator */}
      {waterTopY < equatorY && (
        <text x={cx - pixR - 4} y={equatorY + 4} fill="rgba(34,197,160,0.7)" fontSize="8" textAnchor="end">inflexión</text>
      )}
    </svg>
  )
}

function BiconeFillViz({ R, H, h }) {
  const svgW = 280, svgH = 220
  const cx = svgW / 2
  const pad = 18
  const totalH = 2 * H
  const scale = Math.min((svgW - pad * 2) / (R * 2 + 8), (svgH - pad * 2) / (totalH + 2))
  const coneW = R * scale
  const coneH = H * scale
  const ry = Math.max(coneW * 0.18, 4) // ellipse flattening for 3D look
  const botTipY = pad + 2 * coneH
  const midY = pad + coneH
  const topTipY = pad
  // Water level
  const waterY = botTipY - Math.min(h / totalH, 1) * 2 * coneH
  const ww = h <= H ? (h / H) * coneW : ((2 * H - h) / H) * coneW
  const waterRy = Math.max(ww * 0.18, 2)

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* Bottom cone: left edge, right edge, base ellipse */}
      <line x1={cx} y1={botTipY} x2={cx - coneW} y2={midY} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <line x1={cx} y1={botTipY} x2={cx + coneW} y2={midY} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      {/* Top cone: left edge, right edge */}
      <line x1={cx - coneW} y1={midY} x2={cx} y2={topTipY} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <line x1={cx + coneW} y1={midY} x2={cx} y2={topTipY} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      {/* Junction ellipse (max circumference) */}
      <ellipse cx={cx} cy={midY} rx={coneW} ry={ry} fill="none" stroke="rgba(34,197,160,0.4)" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x={cx + coneW + 4} y={midY - 4} fill="rgba(34,197,160,0.6)" fontSize="8">R = {format(R)}</text>
      {/* Tips */}
      <circle cx={cx} cy={botTipY} r="2.5" fill="rgba(255,255,255,0.4)" />
      <circle cx={cx} cy={topTipY} r="2.5" fill="rgba(255,255,255,0.4)" />
      {/* Water fill */}
      {h > 0.1 && (
        <>
          <defs>
            <clipPath id="bicone-clip">
              <polygon points={`${cx},${botTipY} ${cx - coneW},${midY} ${cx + coneW},${midY}`} />
              <polygon points={`${cx - coneW},${midY} ${cx + coneW},${midY} ${cx},${topTipY}`} />
            </clipPath>
          </defs>
          <rect x={cx - coneW} y={waterY} width={coneW * 2} height={botTipY - waterY} fill="rgba(80,150,255,0.22)" clipPath="url(#bicone-clip)" />
          {/* Water surface ellipse */}
          {ww > 1 && (
            <ellipse cx={cx} cy={waterY} rx={ww} ry={waterRy} fill="rgba(80,150,255,0.35)" stroke="rgba(80,150,255,0.6)" strokeWidth="1" />
          )}
        </>
      )}
      {/* Height label */}
      <line x1={cx + coneW + 12} y1={waterY} x2={cx + coneW + 12} y2={botTipY} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + coneW + 22} y={(waterY + botTipY) / 2} fill="#ff6b35" fontSize="10" dominantBaseline="middle" fontWeight="600">h</text>
    </svg>
  )
}

function CylSphereFillViz({ R, Hc, h }) {
  const svgW = 280, svgH = 220
  const cx = svgW / 2
  const totalH = Hc + R
  const scale = Math.min(80 / R, 160 / totalH, 10)
  const pixR = R * scale
  const pixHc = Hc * scale
  const ry = Math.max(pixR * 0.18, 4)
  const botY = svgH / 2 + (pixHc + pixR) / 2
  const cylTopY = botY - pixHc

  // Water geometry — build the water shape as a direct path (no clip)
  const waterPx = Math.min(h / totalH, 1) * (pixHc + pixR)
  const waterY = botY - waterPx
  const inSphere = h > Hc
  let waterHalfW = pixR
  if (inSphere) {
    const hS = h - Hc
    waterHalfW = (Math.sqrt(Math.max(2 * R * hS - hS * hS, 0)) / R) * pixR
  }

  // Build water path directly following the container walls
  let waterPath = ''
  if (waterPx > 1) {
    if (!inSphere) {
      // Water only in cylinder: simple rectangle
      waterPath = `M${cx - pixR},${waterY} L${cx - pixR},${botY} L${cx + pixR},${botY} L${cx + pixR},${waterY} Z`
    } else {
      // Water fills full cylinder + partial hemisphere
      // Left side: go up cylinder, then follow hemisphere arc to water surface
      // Right side: mirror back down
      // Arc from left-wall at cylTopY, curving up to waterHalfW at waterY
      // We use the hemisphere circle centered at (cx, cylTopY) with radius pixR
      // The water surface intersects the hemisphere at (cx ± waterHalfW, waterY)
      waterPath = [
        `M${cx - pixR},${botY}`,           // bottom-left
        `L${cx + pixR},${botY}`,            // bottom-right
        `L${cx + pixR},${cylTopY}`,         // up right wall of cylinder
        // Arc from right wall to water surface (following hemisphere)
        `A${pixR},${pixR} 0 0,0 ${cx + waterHalfW},${waterY}`,
        // Straight line across water surface
        `L${cx - waterHalfW},${waterY}`,
        // Arc from water surface back to left wall (following hemisphere)
        `A${pixR},${pixR} 0 0,0 ${cx - pixR},${cylTopY}`,
        'Z',
      ].join(' ')
    }
  }

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-xl bg-[#0e1219]">
      {/* Container outline */}
      <line x1={cx - pixR} y1={cylTopY} x2={cx - pixR} y2={botY} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <line x1={cx + pixR} y1={cylTopY} x2={cx + pixR} y2={botY} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <ellipse cx={cx} cy={botY} rx={pixR} ry={ry} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <path d={`M${cx - pixR},${cylTopY} A${pixR},${pixR} 0 0,1 ${cx + pixR},${cylTopY}`} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <line x1={cx - pixR} y1={cylTopY} x2={cx + pixR} y2={cylTopY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 3" />
      {/* Water — drawn as direct path, no clip needed */}
      {waterPath && (
        <>
          <path d={waterPath} fill="rgba(80,150,255,0.22)" />
          {/* Water surface ellipse */}
          {!inSphere ? (
            <ellipse cx={cx} cy={waterY} rx={pixR} ry={ry} fill="rgba(80,150,255,0.35)" stroke="rgba(80,150,255,0.6)" strokeWidth="1" />
          ) : waterHalfW > 1 && (
            <ellipse cx={cx} cy={waterY} rx={waterHalfW} ry={Math.max(waterHalfW * 0.15, 2)} fill="rgba(80,150,255,0.35)" stroke="rgba(80,150,255,0.6)" strokeWidth="1" />
          )}
        </>
      )}
      {/* Height label */}
      <line x1={cx + pixR + 12} y1={waterY} x2={cx + pixR + 12} y2={botY} stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={cx + pixR + 22} y={(waterY + botY) / 2} fill="#ff6b35" fontSize="10" dominantBaseline="middle" fontWeight="600">h</text>
      {/* Zone labels */}
      <text x={cx} y={botY - pixHc / 2} fill="rgba(255,255,255,0.2)" fontSize="8" textAnchor="middle">cilindro</text>
      <text x={cx} y={cylTopY - pixR * 0.4} fill="rgba(255,255,255,0.2)" fontSize="8" textAnchor="middle">esfera</text>
    </svg>
  )
}

/* ── main component ─────────────────────────────────────────── */

export const ContainerFillingLab = () => {
  const [containerId, setContainerId] = useState('cylinder-fill')
  const container = containers.find((c) => c.id === containerId) || containers[0]

  // param state
  const [paramValues, setParamValues] = useState(() => {
    const init = {}
    containers.forEach((c) => c.params.forEach((p) => { init[`${c.id}-${p.key}`] = p.default }))
    return init
  })

  const getParam = (key) => paramValues[`${containerId}-${key}`] ?? container.params.find((p) => p.key === key)?.default ?? 1
  const setParam = (key, val) => setParamValues((prev) => ({ ...prev, [`${containerId}-${key}`]: val }))

  const currentParams = {}
  container.params.forEach((p) => { currentParams[p.key] = getParam(p.key) })

  const maxH = container.maxH(currentParams)

  // Volume slider — main interaction
  const maxVolume = useMemo(() => container.volumeOfHeight(currentParams, maxH), [containerId, ...Object.values(currentParams)])
  const [volumeFrac, setVolumeFrac] = useState(0.4)
  const currentVolume = volumeFrac * maxVolume
  const currentHeight = container.heightOfVolume(currentParams, currentVolume)

  const metrics = useMemo(
    () => container.metrics(currentParams, currentHeight, currentVolume),
    [containerId, ...Object.values(currentParams), currentHeight, currentVolume],
  )

  // Graph: V(h) curve
  const graphData = useMemo(
    () => sampleRange(0, maxH, 200, (h) => container.volumeOfHeight(currentParams, h)),
    [containerId, ...Object.values(currentParams)],
  )

  // Fixed axes — computed once per container type, never shifts
  const { yCeil, maxHCeil } = useMemo(() => {
    const maxP = {}
    container.params.forEach((p) => { maxP[p.key] = p.max })
    const mhc = container.maxH(maxP)
    return { yCeil: container.volumeOfHeight(maxP, mhc) * 1.08 || 1, maxHCeil: mhc }
  }, [containerId])

  const axis1 = useAxisRange({
    xMin: 0, xMax: maxHCeil,
    yMin: 0, yMax: yCeil,
  })

  // Rate of change: dV/dh approximation at current height
  const dVdh = useMemo(() => {
    const eps = maxH * 0.001
    if (currentHeight < eps) return 0
    const vPlus = container.volumeOfHeight(currentParams, Math.min(currentHeight + eps, maxH))
    const vMinus = container.volumeOfHeight(currentParams, Math.max(currentHeight - eps, 0))
    return (vPlus - vMinus) / (2 * eps)
  }, [containerId, ...Object.values(currentParams), currentHeight])

  const handleCsv = () => {
    const header = ['h', 'V(h)']
    const rows = [header, ...graphData.map((p) => [p.x.toFixed(2), p.y.toFixed(2)])]
    downloadCsv(rows, `llenado-${containerId}.csv`)
  }

  return (
    <div className="rounded-[2.2rem] border border-ink/12 bg-white p-4 shadow-[0_28px_70px_rgba(18,23,35,0.12)] md:p-6">
      {/* container selector */}
      <div className="flex flex-wrap gap-2">
        {containers.map((c) => (
          <button
            key={c.id}
            onClick={() => { setContainerId(c.id); setVolumeFrac(0.4); axis1.resetRange() }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${c.id === containerId ? 'bg-ink text-paper' : 'border border-ink/10 bg-paper text-ink/70 hover:border-ink/30'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm leading-6 text-ink/72">{container.context}</p>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* LEFT: visualization + sliders */}
        <div className="space-y-3">
          <div className="rounded-[1.4rem] border border-white/10 bg-ink p-4">
            {containerId === 'cylinder-fill' && <CylinderFillViz R={getParam('R')} h={currentHeight} maxH={maxH} />}
            {containerId === 'cone-fill' && <ConeFillViz R={getParam('R')} H={getParam('H')} h={currentHeight} />}
            {containerId === 'sphere-fill' && <SphereFillViz R={getParam('R')} h={currentHeight} />}
            {containerId === 'bicone-fill' && <BiconeFillViz R={getParam('R')} H={getParam('H')} h={currentHeight} />}
            {containerId === 'cylsphere-fill' && <CylSphereFillViz R={getParam('R')} Hc={getParam('Hc')} h={currentHeight} />}
          </div>

          {/* Volume fraction slider — main control */}
          <SliderField
            id="fill-volume"
            label="Nivel de llenado"
            value={Math.round(volumeFrac * 100)}
            min={0}
            max={100}
            step={1}
            suffix="%"
            onChange={(v) => setVolumeFrac(v / 100)}
          />

          {/* Shape parameter sliders */}
          {container.params.map((p) => (
            <SliderField
              key={`${containerId}-${p.key}`}
              id={`cf-${containerId}-${p.key}`}
              label={p.label}
              value={getParam(p.key)}
              min={p.min}
              max={p.max}
              step={p.step}
              suffix={` ${p.unit}`}
              onChange={(v) => setParam(p.key, v)}
            />
          ))}

          <div className="grid grid-cols-2 gap-2">
            {metrics.map((m) => (
              <MetricCard key={m.label} label={m.label} value={m.value} dark={m.highlight} />
            ))}
          </div>
        </div>

        {/* RIGHT: V(h) graph */}
        <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-[1.4rem] border border-white/10 bg-ink p-4">
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-paper/45">Volumen vs Altura — {container.family}</p>
            <CartesianFrame
              width={540}
              height={280}
              xMin={axis1.xMin}
              xMax={axis1.xMax}
              yMin={axis1.yMin}
              yMax={axis1.yMax}
              xTicks={generateTicks(axis1.xMin, axis1.xMax)}
              yTicks={generateTicks(axis1.yMin, axis1.yMax, 5)}
              xLabel="Altura h (cm)"
              yLabel="Volumen V (cm³)"
              dark
            >
              {({ scaleX, scaleY }) => (
                <>
                  <path d={linePath(graphData, scaleX, scaleY)} fill="none" stroke="#5096ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {/* current point */}
                  <circle cx={scaleX(currentHeight)} cy={scaleY(currentVolume)} r="6" fill="#ff6b35" stroke="white" strokeWidth="2" />
                  <line x1={scaleX(currentHeight)} y1={scaleY(0)} x2={scaleX(currentHeight)} y2={scaleY(currentVolume)} stroke="#ff6b35" strokeWidth="1" strokeDasharray="4 3" />
                  <line x1={scaleX(0)} y1={scaleY(currentVolume)} x2={scaleX(currentHeight)} y2={scaleY(currentVolume)} stroke="#ff6b35" strokeWidth="1" strokeDasharray="4 3" />
                  {/* tangent line at current point */}
                  {currentHeight > 0.1 && (
                    <line
                      x1={scaleX(Math.max(currentHeight - maxH * 0.1, 0))}
                      y1={scaleY(currentVolume - dVdh * maxH * 0.1)}
                      x2={scaleX(Math.min(currentHeight + maxH * 0.1, maxH))}
                      y2={scaleY(currentVolume + dVdh * maxH * 0.1)}
                      stroke="#22c5a0"
                      strokeWidth="1.5"
                      strokeDasharray="6 3"
                      opacity="0.7"
                    />
                  )}
                </>
              )}
            </CartesianFrame>
            <AxisRangePanel {...axis1} />
          </div>

          {/* info badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-[#5096ff]/25 bg-[#5096ff]/10 px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#5096ff]" />
              <span className="text-sm font-semibold tabular-nums text-ink">h = {format(currentHeight)} cm → V = {format(currentVolume)} cm³</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-graph/25 bg-graph/10 px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-graph" />
              <span className="text-sm font-semibold tabular-nums text-ink">dV/dh ≈ {format(dVdh)} cm²</span>
            </div>
            <button
              onClick={handleCsv}
              className="rounded-full border border-ink/10 bg-paper px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:border-ink/30"
            >
              CSV
            </button>
          </div>

          {/* model card */}
          <LabCard title="Modelo algebraico">
            <p className="mt-2 font-mono text-sm text-ink/80">{container.model}</p>
            <p className="mt-1 text-sm text-ink/55">Familia: <span className="font-semibold text-ink/70">{container.family}</span></p>
          </LabCard>
        </div>
      </div>
    </div>
  )
}

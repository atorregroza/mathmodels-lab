import { useState, useMemo } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, generateTicks } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'
// modelFitting available for advanced diagnostics (R², AIC, DW) — used when adding residual analysis

/* ───────────────────────── MATERIALES DE CONSTRUCCIÓN ───────────────────────── */

const MATERIALS = [
  // Naturales / sostenibles (Colombia)
  { id: 'paja',      name: 'Paja (fardo)',        k: 0.047, rho: 120,  c: 1550, cat: 'natural', color: '#FBBF24', emoji: '🌾' },
  { id: 'guadua',    name: 'Guadua',              k: 0.17,  rho: 600,  c: 1200, cat: 'natural', color: '#059669', emoji: '🎋' },
  { id: 'tierra',    name: 'Tierra-mortero',       k: 0.55,  rho: 1600, c: 850,  cat: 'natural', color: '#A16207', emoji: '🟤' },
  { id: 'adobe',     name: 'Adobe',               k: 0.60,  rho: 1500, c: 830,  cat: 'natural', color: '#B45309', emoji: '🧱' },
  { id: 'cal',       name: 'Pañete de cal',         k: 0.70,  rho: 1600, c: 840,  cat: 'natural', color: '#FDE68A', emoji: '🤍' },
  // Industriales
  { id: 'eps',       name: 'EPS (icopor)',          k: 0.039, rho: 20,   c: 1250, cat: 'industrial', color: '#8B5CF6', emoji: '📦' },
  // Convencionales
  { id: 'ladrillo',  name: 'Ladrillo tolete',       k: 0.70,  rho: 1800, c: 840,  cat: 'convencional', color: '#DC2626', emoji: '🧱' },
  { id: 'bloque',    name: 'Bloque hueco #5',       k: 0.80,  rho: 1400, c: 880,  cat: 'convencional', color: '#6B7280', emoji: '🏗️' },
  { id: 'mortero',   name: 'Pañete cemento',         k: 0.72,  rho: 1900, c: 840,  cat: 'convencional', color: '#78716C', emoji: '⬜' },
  { id: 'aire',      name: 'Cámara de aire',         k: 0.026, rho: 1.2,  c: 1005, cat: 'convencional', color: '#E5E7EB', emoji: '💨' },
]

/* ───────────────────────── CIUDADES COLOMBIANAS ───────────────────────── */

const CITIES = [
  { id: 'tunja',    name: 'Tunja',         alt: 2810, Ts: 12, floor: 'Frío',       color: '#60A5FA', ctx: 'Altiplano boyacense — casas coloniales de adobe y tapia pisada', traditionalWall: 'adobe-trad', modernWall: 'bloque-mod' },
  { id: 'bogota',   name: 'Bogotá',        alt: 2640, Ts: 14, floor: 'Frío',       color: '#818CF8', ctx: 'Ciudad de ladrillo tolete — noches de 6°C, sin aislamiento', traditionalWall: 'tolete-bog', modernWall: 'bloque-mod' },
  { id: 'medellin', name: 'Medellín',      alt: 1495, Ts: 22, floor: 'Templado',   color: '#34D399', ctx: 'Clima de eterna primavera — bahareque encementado con guadua', traditionalWall: 'bahareque', modernWall: 'bloque-mod' },
  { id: 'cali',     name: 'Cali',          alt: 1018, Ts: 25, floor: 'Cálido',     color: '#FBBF24', ctx: 'Valle caliente — ventilación natural vs aire acondicionado', traditionalWall: 'bloque-mod', modernWall: 'bloque-eps' },
  { id: 'bquilla',  name: 'Barranquilla',  alt: 18,   Ts: 33, floor: 'Muy cálido', color: '#F97316', ctx: 'Caribe — el reto es mantener el interior fresco sin gastar', traditionalWall: 'bloque-mod', modernWall: 'bloque-eps' },
]

/* ── PAREDES PRESET ── */

const WALL_PRESETS = [
  {
    id: 'adobe-trad', name: 'Adobe tradicional',
    layers: [{ matId: 'cal', L: 0.015 }, { matId: 'adobe', L: 0.30 }, { matId: 'cal', L: 0.015 }],
  },
  {
    id: 'tolete-bog', name: 'Ladrillo tolete',
    layers: [{ matId: 'mortero', L: 0.015 }, { matId: 'ladrillo', L: 0.12 }, { matId: 'mortero', L: 0.015 }],
  },
  {
    id: 'bahareque', name: 'Bahareque encementado',
    layers: [{ matId: 'mortero', L: 0.02 }, { matId: 'guadua', L: 0.04 }, { matId: 'tierra', L: 0.08 }, { matId: 'guadua', L: 0.04 }, { matId: 'mortero', L: 0.02 }],
  },
  {
    id: 'bloque-mod', name: 'Bloque hueco #5 (estándar)',
    layers: [{ matId: 'mortero', L: 0.015 }, { matId: 'bloque', L: 0.12 }, { matId: 'mortero', L: 0.015 }],
  },
  {
    id: 'bloque-eps', name: 'Bloque + EPS (eficiente)',
    layers: [{ matId: 'mortero', L: 0.015 }, { matId: 'bloque', L: 0.12 }, { matId: 'eps', L: 0.05 }, { matId: 'mortero', L: 0.015 }],
  },
  {
    id: 'paja-eco', name: 'Fardos de paja (experimental)',
    layers: [{ matId: 'mortero', L: 0.03 }, { matId: 'paja', L: 0.35 }, { matId: 'mortero', L: 0.03 }],
  },
  {
    id: 'ladrillo-cav', name: 'Doble ladrillo con cámara',
    layers: [{ matId: 'mortero', L: 0.015 }, { matId: 'ladrillo', L: 0.12 }, { matId: 'aire', L: 0.05 }, { matId: 'ladrillo', L: 0.12 }, { matId: 'mortero', L: 0.015 }],
  },
]

const VIEWS = [
  { id: 'profile', label: 'Perfil T(x)' },
  { id: 'compare', label: 'Comparar muros' },
  { id: 'ranking', label: 'Ranking materiales' },
]

/* ──────────────────────── MODELOS MATEMÁTICOS ──────────────────────── */

// h_in y h_out: coeficientes de convección superficial (W/m²K)
const H_IN = 8.3   // interior, convección natural (ASHRAE)
const H_OUT = 23.0  // exterior, viento moderado (ASHRAE)

// Modelo 1: Fourier steady-state puro (sin convección superficial)
// q = ΔT / Σ(Lᵢ/kᵢ), T(x) lineal por tramos
const computeSteadyState = (layers, Tin, Tout) => {
  const mats = layers.map(l => ({ ...MATERIALS.find(m => m.id === l.matId), L: l.L }))
  const Rwall = mats.reduce((sum, m) => sum + m.L / m.k, 0)
  if (Rwall <= 0) return { q: 0, Rtotal: 0, U: 0, profile: [], gradients: [], layerData: [] }

  const q = (Tin - Tout) / Rwall
  const profile = [{ x: 0, T: Tin }]
  const gradients = []
  const layerData = []
  let xAcc = 0
  let T = Tin
  for (const m of mats) {
    const dTdx = -q / m.k
    const Tnext = T + dTdx * m.L
    gradients.push({ matId: m.id, name: m.name, k: m.k, L: m.L, gradient: dTdx, dT: Tnext - T })
    layerData.push({ x0: xAcc, x1: xAcc + m.L, T0: T, T1: Tnext, mat: m })
    xAcc += m.L
    profile.push({ x: xAcc, T: Tnext })
    T = Tnext
  }
  return { q, Rtotal: Rwall, U: 1 / Rwall, profile, gradients, layerData }
}

// Modelo 2: Con resistencia convectiva en superficies
// R_total = 1/h_in + Σ(Lᵢ/kᵢ) + 1/h_out
const computeWithConvection = (layers, Tin, Tout) => {
  const mats = layers.map(l => ({ ...MATERIALS.find(m => m.id === l.matId), L: l.L }))
  const Rwall = mats.reduce((sum, m) => sum + m.L / m.k, 0)
  const Rtotal = 1 / H_IN + Rwall + 1 / H_OUT
  if (Rtotal <= 0) return { q: 0, Rtotal: 0, U: 0, profile: [], gradients: [], layerData: [] }

  const q = (Tin - Tout) / Rtotal
  // Surface temperatures
  const Tsurf_in = Tin - q / H_IN
  const Tsurf_out = Tout + q / H_OUT

  // Air boundary layers: real thickness δ = k_air/h (3mm int, 1mm ext)
  // Scaled up 10x for visibility but preserving the ratio (3cm int, 1cm ext)
  const AIR_IN_W = 0.03   // 3cm visual (represents ~3mm boundary layer, h_in=8.3)
  const AIR_OUT_W = 0.015 // 1.5cm visual (represents ~1mm boundary layer, h_out=23)
  const airInMat = { id: 'aire-int', name: 'Capa límite int.', color: '#FF6B35' }
  const airOutMat = { id: 'aire-ext', name: 'Capa límite ext.', color: '#3B82F6' }

  const profile = [{ x: 0, T: Tin }]
  const layerData = [{ x0: 0, x1: AIR_IN_W, T0: Tin, T1: Tsurf_in, mat: airInMat, isAir: true }]
  profile.push({ x: AIR_IN_W, T: Tsurf_in })

  const gradients = []
  let xAcc = AIR_IN_W
  let T = Tsurf_in
  for (const m of mats) {
    const dTdx = -q / m.k
    const Tnext = T + dTdx * m.L
    gradients.push({ matId: m.id, name: m.name, k: m.k, L: m.L, gradient: dTdx, dT: Tnext - T })
    layerData.push({ x0: xAcc, x1: xAcc + m.L, T0: T, T1: Tnext, mat: m })
    xAcc += m.L
    profile.push({ x: xAcc, T: Tnext })
    T = Tnext
  }
  layerData.push({ x0: xAcc, x1: xAcc + AIR_OUT_W, T0: T, T1: Tout, mat: airOutMat, isAir: true })
  profile.push({ x: xAcc + AIR_OUT_W, T: Tout })

  return { q, Rtotal, U: 1 / Rtotal, profile, gradients, layerData, Tsurf_in, Tsurf_out }
}

// Modelo 3: Transitorio — constante de tiempo térmica
// τ = Σ(ρᵢ·cᵢ·Lᵢ) · R_total   (simplificado: masa térmica total × resistencia total)
// T_interior(t) = Tout + (Tin - Tout)·e^(-t/τ)  si se apaga la calefacción/AC
// eslint-disable-next-line no-unused-vars
const computeTransientTau = (layers, _Tin, _Tout) => {
  const mats = layers.map(l => ({ ...MATERIALS.find(m => m.id === l.matId), L: l.L }))
  const Rwall = mats.reduce((sum, m) => sum + m.L / m.k, 0)
  const Rtotal = 1 / H_IN + Rwall + 1 / H_OUT
  // Thermal mass per unit area (J/(m²·K))
  const thermalMass = mats.reduce((sum, m) => sum + m.rho * m.c * m.L, 0)
  // Time constant (seconds), convert to hours for display
  const tauSeconds = thermalMass * Rtotal
  const tauHours = tauSeconds / 3600
  return { tauHours, thermalMass, Rtotal }
}

/* ── Costo energético ── */
const COP_PER_KWH = 884 // tarifa promedio residencial Colombia 2025
// COP (coefficient of performance): AC típico en Colombia = 2.5-3.5, calefacción eléctrica = 1.0
const computeDailyCost = (q, area = 1, cop = 1.0) => {
  const wattsPerM2 = Math.abs(q)
  const kwhPerDay = (wattsPerM2 * area * 24) / 1000 / cop
  return { wattsPerM2, kwhPerDay, copPerDay: kwhPerDay * COP_PER_KWH, cop }
}

/* ── Ranking: R por centímetro ── */
const materialRanking = () =>
  MATERIALS.map(m => ({
    ...m,
    Rper10cm: 0.10 / m.k,  // R-value for 10cm thickness
  })).sort((a, b) => b.Rper10cm - a.Rper10cm)

/* ──────────────────────── COMPONENTE PRINCIPAL ──────────────────────── */

export const ThermalInsulationLab = () => {
  const [presetA, setPresetA] = useState('adobe-trad')
  const [presetB, setPresetB] = useState('bloque-mod')
  const [cityId, setCityId] = useState('bogota')
  const [Tinterior, setTinterior] = useState(20)
  const [view, setView] = useState('profile')
  const [showConvection, setShowConvection] = useState(false)
  const [showModelDetail, setShowModelDetail] = useState(false)

  const city = CITIES.find(c => c.id === cityId)
  const wallA = WALL_PRESETS.find(w => w.id === presetA)
  const wallB = WALL_PRESETS.find(w => w.id === presetB)

  // Is heat going in or out?
  const isHeating = Tinterior > city.Ts // need to keep heat IN
  const Tin = Tinterior
  const Tout = city.Ts

  /* ── Analysis ── */
  const analysis = useMemo(() => {
    const computeWall = (wall) => {
      const ss = computeSteadyState(wall.layers, Tin, Tout)
      const conv = computeWithConvection(wall.layers, Tin, Tout)
      const trans = computeTransientTau(wall.layers, Tin, Tout)
      // COP: cooling uses AC (COP~3.0), heating is resistive (COP=1.0)
      const cop = Tin < Tout ? 3.0 : 1.0
      const cost = computeDailyCost(conv.q, 1, cop)
      const totalL = wall.layers.reduce((s, l) => s + l.L, 0)
      return { ss, conv, trans, cost, totalL, name: wall.name }
    }

    const a = computeWall(wallA)
    const b = computeWall(wallB)
    const ranking = materialRanking()

    return { a, b, ranking }
  }, [wallA, wallB, Tin, Tout])

  const { a: dataA, b: dataB, ranking } = analysis

  // Dynamic axis bounds for profile
  const maxTotalL = Math.max(dataA.totalL, dataB.totalL)
  const profXMax = Math.max(maxTotalL + (showConvection ? 0.03 + 0.015 : 0) + 0.03, 0.15)
  const profYMin = Math.min(Tin, Tout) - 2
  const profYMax = Math.max(Tin, Tout) + 2

  const pAxis = useAxisRange({ xMin: 0, xMax: profXMax, yMin: profYMin, yMax: profYMax })
  const yTicks = generateTicks(pAxis.yMin, pAxis.yMax, 8)

  // Ranking axis
  const rMax = Math.max(...ranking.map(m => m.Rper10cm), 1) * 1.15
  const rAxis = useAxisRange({ xMin: 0, xMax: rMax, yMin: -0.5, yMax: ranking.length - 0.5 })

  /* ── CSV export ── */
  const handleExport = () => {
    const model = showConvection ? dataA.conv : dataA.ss
    const rows = [
      ['Material', 'Espesor_m', 'k_W_mK', 'R_m2K_W', 'Gradiente_C_m', 'DeltaT_C', 'x_inicio_m', 'x_fin_m'],
      ...model.gradients.map(g => [
        g.name, g.L.toFixed(3), g.k.toFixed(3),
        (g.L / g.k).toFixed(4), g.gradient.toFixed(2), g.dT.toFixed(2),
        model.layerData?.find(d => d.mat.id === g.matId)?.x0?.toFixed(3) ?? '',
        model.layerData?.find(d => d.mat.id === g.matId)?.x1?.toFixed(3) ?? '',
      ]),
      [],
      ['Métrica', 'Muro perfil', 'Muro comparación'],
      ['R_total (m²K/W)', format(dataA.conv.Rtotal), format(dataB.conv.Rtotal)],
      ['U-value (W/m²K)', format(dataA.conv.U), format(dataB.conv.U)],
      ['q (W/m²)', format(dataA.conv.q), format(dataB.conv.q)],
      ['Costo diario (COP/m²)', format(dataA.cost.copPerDay), format(dataB.cost.copPerDay)],
      ['τ (horas)', format(dataA.trans.tauHours), format(dataB.trans.tauHours)],
      ['Espesor total (cm)', (dataA.totalL * 100).toFixed(1), (dataB.totalL * 100).toFixed(1)],
      [],
      ['--- Ranking R/10cm ---'],
      ['Material', 'k (W/mK)', 'R por 10cm (m²K/W)'],
      ...ranking.map(m => [m.name, m.k.toFixed(3), m.Rper10cm.toFixed(3)]),
    ]
    downloadCsv(rows, `aislamiento-${cityId}.csv`)
  }

  return (
    <div className="space-y-6">
      {/* ── Ciudad selector ── */}
      <LabCard title="Ciudad y clima">
        <div className="mt-3 flex flex-wrap gap-2">
          {CITIES.map(c => (
            <button key={c.id} onClick={() => { setCityId(c.id); setPresetA(c.traditionalWall); setPresetB(c.modernWall) }}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                cityId === c.id ? 'text-white shadow-md scale-105' : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
              }`}
              style={cityId === c.id ? { backgroundColor: c.color } : undefined}
            >{c.name} · {c.Ts}°C</button>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-ink/8 p-4" style={{ borderLeftWidth: 4, borderLeftColor: city.color }}>
          <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">{city.name} — {city.floor} ({city.alt} m)</p>
          <p className="text-sm text-ink/60 mt-1">{city.ctx}</p>
          <p className="text-xs text-ink/35 mt-2 font-mono">T_exterior = {city.Ts}°C · T_interior = {Tinterior}°C · ΔT = {Math.abs(Tin - Tout)}°C</p>
        </div>
      </LabCard>

      {/* ── Temperatura interior ── */}
      <div className="w-64">
        <SliderField id="t-interior" label="T interior" value={Tinterior} min={16} max={28} step={1} suffix="°C" onChange={setTinterior} />
      </div>

      {/* ── Configuración de muros ── */}
      <LabCard title="¿Cómo se construye el muro?">
        <p className="mt-1 text-xs text-ink/45 leading-relaxed">
          Un muro real tiene varias capas de materiales. Elige una configuración para ver el perfil térmico, o compara dos en la vista "Comparar muros".
          {city.traditionalWall !== city.modernWall && (
            <span className="font-semibold text-ink/60"> En {city.name}, la construcción tradicional usa {WALL_PRESETS.find(w => w.id === city.traditionalWall)?.name?.toLowerCase()}, mientras que la moderna usa {WALL_PRESETS.find(w => w.id === city.modernWall)?.name?.toLowerCase()}.</span>
          )}
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/35 mb-2">Material para el muro (perfil)</p>
            <div className="flex flex-wrap gap-2">
              {WALL_PRESETS.map(w => (
                <button key={w.id} onClick={() => setPresetA(w.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    presetA === w.id ? 'bg-ink text-paper shadow-md' : 'border border-ink/10 bg-white text-ink/50 hover:bg-ink/5'
                  }`}
                >{w.name}</button>
              ))}
            </div>
            <p className="mt-2 text-[0.6rem] text-ink/35 uppercase tracking-wide">Capas (interior → exterior):</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {wallA.layers.map((l, i) => {
                const mat = MATERIALS.find(m => m.id === l.matId)
                return (
                  <span key={i} className="rounded-lg px-2 py-1 text-xs font-mono" style={{ backgroundColor: mat.color + '22', color: mat.color, border: `1px solid ${mat.color}44` }}>
                    {mat.emoji} {mat.name} {(l.L * 100).toFixed(1)} cm
                  </span>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/35 mb-2">Material para el muro (comparación)</p>
            <div className="flex flex-wrap gap-2">
              {WALL_PRESETS.map(w => (
                <button key={w.id} onClick={() => setPresetB(w.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    presetB === w.id ? 'bg-ink text-paper shadow-md' : 'border border-ink/10 bg-white text-ink/50 hover:bg-ink/5'
                  }`}
                >{w.name}</button>
              ))}
            </div>
            <p className="mt-2 text-[0.6rem] text-ink/35 uppercase tracking-wide">Capas (interior → exterior):</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {wallB.layers.map((l, i) => {
                const mat = MATERIALS.find(m => m.id === l.matId)
                return (
                  <span key={i} className="rounded-lg px-2 py-1 text-xs font-mono" style={{ backgroundColor: mat.color + '22', color: mat.color, border: `1px solid ${mat.color}44` }}>
                    {mat.emoji} {mat.name} {(l.L * 100).toFixed(1)} cm
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </LabCard>

      {/* ── Modelo toggle ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setShowConvection(false)}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${!showConvection ? 'bg-ink text-paper' : 'border border-ink/12 bg-white text-ink/60'}`}
        >Fourier puro</button>
        <button onClick={() => setShowConvection(true)}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${showConvection ? 'bg-ink text-paper' : 'border border-ink/12 bg-white text-ink/60'}`}
        >Con convección superficial</button>
      </div>

      {/* ── Modelo matemático con valores específicos ── */}
      {(() => {
        const m = showConvection ? dataA.conv : dataA.ss
        return (
          <div className="space-y-2">
            {/* Summary line — always visible */}
            <div className="flex flex-wrap items-center gap-3 rounded-[1.2rem] border border-ink/10 bg-paper px-4 py-3">
              <span className="text-sm font-semibold text-ink/70">q = {format(m.q)} W/m²</span>
              <span className="text-xs text-ink/40">·</span>
              <span className="text-sm font-semibold text-ink/70">R = {format(m.Rtotal)} m²K/W</span>
              <span className="text-xs text-ink/40">·</span>
              <span className="text-xs text-ink/50">{wallA.name} · {city.name} · ΔT = {Math.abs(Tin - Tout)}°C</span>
              <button onClick={() => setShowModelDetail(v => !v)}
                className="ml-auto flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-semibold text-ink/50 hover:bg-ink/10 transition-colors">
                {showModelDetail ? 'Ocultar detalle' : 'Ver detalle'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: showModelDetail ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>

            {/* Detail — collapsible */}
            {showModelDetail && (
              <>
                <ModelCard
                  title={showConvection ? 'Modelo general (con convección superficial)' : 'Modelo general (Ley de Fourier)'}
                  expression={showConvection
                    ? 'q = frac(T_int − T_ext, frac(1,h_in) + Σ frac(Lᵢ,kᵢ) + frac(1,h_out))'
                    : 'q = frac(T_int − T_ext, Σ frac(Lᵢ,kᵢ))'
                  }
                  parameters={showConvection
                    ? `donde h_in = ${H_IN} W/(m²·K), h_out = ${H_OUT} W/(m²·K)`
                    : 'donde kᵢ = conductividad térmica (W/(m·K)), Lᵢ = espesor (m)'
                  }
                />
                <ModelCard
                  title="Modelo evaluado"
                  expression={`q = frac(${format(Tin)} − ${format(Tout)}, ${format(m.Rtotal)}) = ${format(m.q)} W/m²`}
                  parameters={`ΔT = ${format(Math.abs(Tin - Tout))}°C,  R_total = ${format(m.Rtotal)} m²·K/W`}
                />
                <div className="overflow-x-auto rounded-[1.2rem] border border-ink/10 bg-paper">
                  <table className="w-full text-xs text-ink/70">
                    <thead>
                      <tr className="border-b border-ink/8 text-left text-ink/40">
                        <th className="py-2 px-3">Capa</th>
                        <th className="py-2 px-3">Material</th>
                        <th className="py-2 px-3">L (cm)</th>
                        <th className="py-2 px-3">k (W/m·K)</th>
                        <th className="py-2 px-3">R = L/k</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallA.layers.map((l, i) => {
                        const mat = MATERIALS.find(x => x.id === l.matId)
                        return (
                          <tr key={i} className="border-b border-ink/5">
                            <td className="py-1.5 px-3 font-mono text-ink/40">{i + 1}</td>
                            <td className="py-1.5 px-3 font-semibold">
                              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: mat.color }} />
                              {mat.name}
                            </td>
                            <td className="py-1.5 px-3 font-mono">{(l.L * 100).toFixed(1)}</td>
                            <td className="py-1.5 px-3 font-mono">{mat.k}</td>
                            <td className="py-1.5 px-3 font-mono">{(l.L / mat.k).toFixed(4)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* ── Vista toggle ── */}
      <div className="flex flex-wrap gap-2">
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              view === v.id ? 'bg-ink text-paper' : 'border border-ink/12 bg-white text-ink'
            }`}
          >{v.label}</button>
        ))}
      </div>

      {/* ── VISTA: Perfil T(x) — two stacked graphs, same Y axis ── */}
      {view === 'profile' && (() => {
        const WARM = '#FF6B35'
        const COOL = '#3B82F6'

        const renderWallProfile = (wallData, wall, prefix) => {
          const wallModel = showConvection ? wallData.conv : wallData.ss
          const wallXMax = Math.max(wallData.totalL + (showConvection ? 0.045 : 0) + 0.02, 0.12)
          // Ticks at center of each wall layer (not air zones), showing layer thickness
          const wallXTicks = []
          const wallXTickLabels = {}
          let acc = showConvection ? 0.03 : 0
          for (const l of wall.layers) {
            const mid = acc + l.L / 2
            wallXTicks.push(mid)
            wallXTickLabels[mid.toFixed(6)] = `${(l.L * 100).toFixed(0)} cm`
            acc += l.L
          }
          return (
            <CartesianFrame
              xMin={0} xMax={wallXMax} yMin={pAxis.yMin} yMax={pAxis.yMax}
              xTicks={wallXTicks} yTicks={yTicks}
              xLabel="" yLabel="Temperatura (°C)"
              xTickFormatter={v => wallXTickLabels[v.toFixed(6)] || ''}
              height={260}
            >
              {({ scaleX, scaleY }) => {
                const cTop = scaleY(pAxis.yMax)
                const cBot = scaleY(pAxis.yMin)
                const cH = cBot - cTop
                const cLeft = scaleX(0)
                const cRight = scaleX(wallXMax)
                return (
                  <g>
                    {/* Layer backgrounds */}
                    {wallModel.layerData.map((ld, i) => (
                      <g key={`${prefix}-bg-${i}`}>
                        <rect x={scaleX(ld.x0)} y={cTop} width={scaleX(ld.x1) - scaleX(ld.x0)} height={cH}
                          fill={ld.mat.color} opacity={ld.isAir ? 0.12 : (i % 2 === 0 ? 0.20 : 0.30)} />
                        {ld.isAir && (
                          <>
                            <defs>
                              <pattern id={`${prefix}-hatch-${ld.mat.id}`} width="5" height="5" patternUnits="userSpaceOnUse"
                                patternTransform={ld.mat.id === 'aire-int' ? 'rotate(45)' : 'rotate(-45)'}>
                                <line x1="0" y1="0" x2="0" y2="5" stroke={ld.mat.color} strokeWidth="1" opacity="0.3" />
                              </pattern>
                            </defs>
                            <rect x={scaleX(ld.x0)} y={cTop} width={scaleX(ld.x1) - scaleX(ld.x0)} height={cH}
                              fill={`url(#${prefix}-hatch-${ld.mat.id})`} />
                          </>
                        )}
                      </g>
                    ))}
                    {/* Layer boundaries */}
                    {wallModel.layerData.slice(1).map((ld, i) => (
                      <line key={`${prefix}-bnd-${i}`} x1={scaleX(ld.x0)} y1={cTop} x2={scaleX(ld.x0)} y2={cBot}
                        stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 3" />
                    ))}
                    {/* Reference lines */}
                    <line x1={cLeft} y1={scaleY(Tin)} x2={cRight} y2={scaleY(Tin)}
                      stroke={WARM} strokeWidth="1" strokeDasharray="8 4" opacity="0.3" />
                    <line x1={cLeft} y1={scaleY(Tout)} x2={cRight} y2={scaleY(Tout)}
                      stroke={COOL} strokeWidth="1" strokeDasharray="8 4" opacity="0.3" />
                    {/* Material pills */}
                    {wallModel.layerData.map((ld, i) => {
                      const midX = scaleX((ld.x0 + ld.x1) / 2)
                      const pillW = Math.min(scaleX(ld.x1) - scaleX(ld.x0) - 4, 90)
                      if (pillW < 16) return null
                      return (
                        <g key={`${prefix}-lbl-${i}`}>
                          <rect x={midX - pillW / 2} y={cTop + 5} width={pillW} height={16} rx="8"
                            fill={ld.mat.color} opacity="0.9" />
                          <text x={midX} y={cTop + 16} fill="white"
                            fontSize={ld.isAir ? '6.5' : '7'} textAnchor="middle" fontWeight="700">
                            {ld.isAir ? (ld.mat.id === 'aire-int' ? 'Aire int.' : 'Aire ext.') : ld.mat.name}
                          </text>
                        </g>
                      )
                    })}
                    {/* Temperature line */}
                    {wallModel.layerData.map((ld, i) => (
                      <line key={`${prefix}-seg-${i}`}
                        x1={scaleX(ld.x0)} y1={scaleY(ld.T0)} x2={scaleX(ld.x1)} y2={scaleY(ld.T1)}
                        stroke={ld.mat.color} strokeWidth={ld.isAir ? 2 : 3}
                        strokeLinecap="round" strokeDasharray={ld.isAir ? '5 3' : 'none'} />
                    ))}
                    {/* Data points */}
                    {wallModel.profile.map((p, i) => {
                      const idx = Math.min(i, wallModel.layerData.length - 1)
                      return (
                        <circle key={`${prefix}-dot-${i}`} cx={scaleX(p.x)} cy={scaleY(p.T)} r="4"
                          fill={wallModel.layerData[idx]?.mat.color ?? WARM} stroke="white" strokeWidth="1.5" />
                      )
                    })}
                    {/* Temperature labels */}
                    {wallModel.profile.map((p, i) => (
                      <g key={`${prefix}-t-${i}`}>
                        <rect x={scaleX(p.x) - 20} y={scaleY(p.T) - (i % 2 === 0 ? 20 : -6)} width="40" height="14" rx="7"
                          fill="rgba(0,0,0,0.6)" />
                        <text x={scaleX(p.x)} y={scaleY(p.T) - (i % 2 === 0 ? 10 : -16)} fill="white"
                          fontSize="8.5" textAnchor="middle" fontWeight="700">
                          {p.T.toFixed(1)}°C
                        </text>
                      </g>
                    ))}
                    {/* Tin / Tout labels */}
                    <g>
                      <rect x={cLeft + 2} y={scaleY(Tin) - 22} width="76" height="18" rx="9" fill={WARM} />
                      <text x={cLeft + 40} y={scaleY(Tin) - 10} fill="white" fontSize="9" textAnchor="middle" fontWeight="800">
                        Interior {Tin}°C
                      </text>
                    </g>
                    <g>
                      <rect x={cRight - 78} y={scaleY(Tout) + 6} width="76" height="18" rx="9" fill={COOL} />
                      <text x={cRight - 40} y={scaleY(Tout) + 18} fill="white" fontSize="9" textAnchor="middle" fontWeight="800">
                        Exterior {Tout}°C
                      </text>
                    </g>
                  </g>
                )
              }}
            </CartesianFrame>
          )
        }

        return (
          <div className="space-y-4">
            <LabCard dark title={`Muro del perfil: ${wallA.name}`}>
              <div className="mt-3">{renderWallProfile(dataA, wallA, 'a')}</div>
            </LabCard>

            {wallA.id !== wallB.id && (
              <LabCard dark title={`Muro de comparación: ${wallB.name}`}>
                <div className="mt-3">{renderWallProfile(dataB, wallB, 'b')}</div>
              </LabCard>
            )}

            {/* Effect summary */}
            {showConvection && dataA.conv.Tsurf_in != null && (() => {
              const retainsA = Math.abs(dataA.conv.Tsurf_in - dataA.conv.Tsurf_out)
              const retainsB = Math.abs(dataB.conv.Tsurf_in - dataB.conv.Tsurf_out)
              const totalDiff = Math.abs(Tin - Tout)
              return (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.3rem] border border-white/10 bg-ink p-4">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-paper/40">{wallA.name}</p>
                    <p className="mt-2 text-lg font-display font-bold text-paper">{retainsA.toFixed(1)}°C retenidos</p>
                    <p className="text-xs text-paper/50">de {totalDiff.toFixed(0)}°C de diferencia · {isHeating ? 'retiene calor' : 'bloquea calor'}</p>
                  </div>
                  {wallA.id !== wallB.id && (
                    <div className="rounded-[1.3rem] border border-white/10 bg-ink p-4">
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-paper/40">{wallB.name}</p>
                      <p className="mt-2 text-lg font-display font-bold text-paper">{retainsB.toFixed(1)}°C retenidos</p>
                      <p className="text-xs text-paper/50">de {totalDiff.toFixed(0)}°C de diferencia · {retainsA > retainsB ? 'aísla menos' : 'aísla más'}</p>
                    </div>
                  )}
                </div>
              )
            })()}

          {/* Gradient table */}
          <LabCard dark title="Gradientes por capa (muro del perfil)">
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs text-paper/80">
                <thead>
                  <tr className="border-b border-white/10 text-left text-paper/50">
                    <th className="py-2 pr-3">Material</th>
                    <th className="py-2 pr-3">L (cm)</th>
                    <th className="py-2 pr-3">k (W/m·K)</th>
                    <th className="py-2 pr-3">R (m²K/W)</th>
                    <th className="py-2 pr-3">dT/dx (°C/m)</th>
                    <th className="py-2">ΔT (°C)</th>
                  </tr>
                </thead>
                <tbody>
                  {(showConvection ? dataA.conv : dataA.ss).gradients.map((g, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-1.5 pr-3 font-semibold">{g.name}</td>
                      <td className="py-1.5 pr-3 font-mono">{(g.L * 100).toFixed(1)}</td>
                      <td className="py-1.5 pr-3 font-mono">{g.k.toFixed(3)}</td>
                      <td className="py-1.5 pr-3 font-mono">{(g.L / g.k).toFixed(4)}</td>
                      <td className="py-1.5 pr-3 font-mono">{g.gradient.toFixed(1)}</td>
                      <td className="py-1.5 font-mono">{g.dT.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LabCard>
        </div>
        )
      })()}

      {/* ── VISTA: Comparar muros ── */}
      {view === 'compare' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[{ data: dataA, wall: wallA, label: 'Muro del perfil' }, { data: dataB, wall: wallB, label: 'Muro de comparación' }].map(({ data, wall, label }) => (
              <LabCard key={label} dark title={`${label}: ${wall.name}`}>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <MetricCard label="R total" value={`${format(data.conv.Rtotal)} m²K/W`}
                    detail={`Espesor: ${(data.totalL * 100).toFixed(1)} cm`} />
                  <MetricCard label="Flujo de calor" value={`${format(data.conv.q)} W/m²`}
                    detail={isHeating ? 'Pérdida hacia el exterior' : 'Ganancia desde el exterior'} />
                  <MetricCard label="Costo diario" value={`$${Math.round(data.cost.copPerDay)} COP/m²`}
                    detail={`${format(data.cost.kwhPerDay)} kWh/día por m²`} />
                  <MetricCard label="Inercia térmica" value={`${format(data.trans.tauHours)} horas`}
                    detail="Constante de tiempo τ (al apagar AC/calefacción)" />
                </div>
              </LabCard>
            ))}
          </div>

          {/* Comparison summary */}
          <LabCard title="Veredicto">
            {(() => {
              const betterWall = dataA.conv.Rtotal > dataB.conv.Rtotal ? wallA : wallB
              const worseWall = dataA.conv.Rtotal > dataB.conv.Rtotal ? wallB : wallA
              const ratio = Math.max(dataA.conv.Rtotal, dataB.conv.Rtotal) / Math.min(dataA.conv.Rtotal, dataB.conv.Rtotal)
              const savingsPerYear = Math.abs(dataA.cost.copPerDay - dataB.cost.copPerDay) * 365
              return (
                <div className="mt-2 space-y-2">
                  <p className="text-sm text-ink/70">
                    <span className="font-bold text-ink">{betterWall.name}</span> aísla{' '}
                    <span className="font-bold text-signal">{ratio.toFixed(1)}x</span> mejor que {worseWall.name}.
                  </p>
                  <p className="text-sm text-ink/70">
                    Diferencia anual por m² de muro:{' '}
                    <span className="font-bold text-ink">${Math.round(savingsPerYear).toLocaleString('es-CO')} COP</span>
                  </p>
                  <p className="text-xs text-ink/45 mt-1">
                    Sensibilidad: cambiar ΔT en ±5°C cambia el costo en ±{format(Math.abs(dataA.conv.q * 5 / Math.abs(Tin - Tout || 1)) * 24 * COP_PER_KWH / 1000)} COP/día/m²
                  </p>
                </div>
              )
            })()}
          </LabCard>
        </div>
      )}

      {/* ── VISTA: Ranking ── */}
      {view === 'ranking' && (
        <LabCard dark title="Resistencia térmica por 10 cm de material (R = L/k)">
          <div className="mt-4">
            <CartesianFrame
              xMin={rAxis.xMin} xMax={rAxis.xMax}
              yMin={rAxis.yMin} yMax={rAxis.yMax}
              xTicks={generateTicks(0, rAxis.xMax, 8)} yTicks={[]}
              xLabel="R por 10 cm (m²K/W)"
              height={Math.max(360, ranking.length * 26)}
            >
              {({ scaleX, scaleY }) => (
                <g>
                  {ranking.map((m, i) => {
                    const y = scaleY(i)
                    const barW = scaleX(m.Rper10cm) - scaleX(0)
                    const isWide = barW > 120
                    return (
                      <g key={m.id}>
                        <rect x={scaleX(0)} y={y - 8} width={Math.max(barW, 1)} height={16} rx="4" fill={m.color} opacity="0.8" />
                        {isWide ? (
                          <text x={scaleX(0) + 6} y={y + 4} fill="rgba(0,0,0,0.7)" fontSize="8.5" fontWeight="600">
                            {m.emoji} {m.name} — {m.Rper10cm.toFixed(3)}
                          </text>
                        ) : (
                          <>
                            <text x={scaleX(m.Rper10cm) + 5} y={y + 4} fill="rgba(255,255,255,0.8)" fontSize="8.5" fontWeight="500">
                              {m.emoji} {m.name} — {m.Rper10cm.toFixed(3)}
                            </text>
                          </>
                        )}
                      </g>
                    )
                  })}
                </g>
              )}
            </CartesianFrame>
            <AxisRangePanel {...rAxis} />
          </div>
          <p className="mt-3 text-xs text-paper/50">
            Mayor R = mejor aislante. Aire quieto (k=0.026) y poliuretano (k=0.025) lideran.
            El acero (k=47.6) es prácticamente transparente al calor.
          </p>
        </LabCard>
      )}

      {/* ── Métricas globales ── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <MetricCard dark={false} label="R total (muro)" value={`${format(dataA.conv.Rtotal)}`} detail="m²K/W — mayor = mejor" />
        <MetricCard dark={false} label="Flujo q" value={`${format(dataA.conv.q)}`} detail="W/m² — menor = menos pérdida" />
        <MetricCard dark={false} label="Costo diario" value={`$${Math.round(dataA.cost.copPerDay)}`} detail={`COP/m² (COP AC=${dataA.cost.cop})`} />
        <MetricCard dark={false} label="% cambio q / °C" value={`${format(Math.abs(dataA.conv.q / (Math.abs(Tin - Tout) || 1)) * 100 / Math.abs(dataA.conv.q || 1))}%`}
          detail="Sensibilidad al ΔT" />
      </div>

      {/* ── Export ── */}
      <button onClick={handleExport}
        className="flex items-center gap-2 rounded-xl bg-ink/8 px-5 py-3 text-sm font-semibold text-ink/70 hover:bg-ink/12 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        Exportar CSV — datos, gradientes y comparación
      </button>

      {/* ── Limitations ── */}
      <div className="rounded-[1.2rem] border border-ink/8 bg-ink/3 p-4 text-xs text-ink/45 leading-relaxed space-y-1">
        <p className="font-semibold text-ink/55">Limitaciones del modelo</p>
        <p>Este modelo considera solo conducción estacionaria 1D a través del muro. En climas tropicales, la ventilación natural y la ganancia solar por techos y ventanas son factores dominantes que no se incluyen. En Medellín (ΔT ≈ 0) el aislamiento tiene poco efecto práctico. En Tunja/Bogotá la calefacción eléctrica es rara — las familias usan abrigo, no energía. El costo en zonas cálidas usa COP=3.0 (AC típico colombiano).</p>
        <p>El adobe no cumple NSR-10 como sistema sismo-resistente sin refuerzo. El bahareque encementado sí cumple (Título E). La selección de materiales debe considerar resistencia sísmica, no solo térmica.</p>
      </div>

      {/* ── Reference ── */}
      <p className="text-xs text-ink/30 leading-relaxed">
        MathModels Lab v1.0 — Aislamiento térmico en paredes compuestas [software interactivo].
        Datos de conductividad: Engineering ToolBox, SciELO Colombia, ScienceDirect.
        Temperaturas: Climate-Data.org. Tarifa eléctrica: MinEnergía Colombia 2025 (884 COP/kWh).
        Paredes: NSR-10, bahareque encementado UNESCO.
      </p>
    </div>
  )
}

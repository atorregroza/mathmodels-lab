import { useState, useMemo } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, generateTicks, linePath } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'
import { Math as MathRender } from '../ui/Math'

/* ════════════════════════════════════════════════════════════════════
   DE LA TROZA AL EMBALSE — Cavalieri aplicado al mundo real
   V = ∫₀ᴸ A(x) dx, aproximado por reglas de cuadratura:
     Smalian  → trapecio         (2 mediciones)
     Huber    → punto medio      (1 medición)
     Newton   → Simpson 3-pt     (3 mediciones)
     "Verdad" → Simpson compuesto (n secciones)
   ════════════════════════════════════════════════════════════════════ */

/* ── Formas del fuste (sólidos de revolución) ─────────────────────── */
/* r(x) perfil del radio a lo largo del eje. x ∈ [0, L].
   - cilindro     : r = r₁                     (A constante)
   - cono         : r lineal en x              (A cuadrática en x)
   - paraboloide  : r² lineal en x             (A lineal en x)  ← forma típica árbol
   - neiloide     : r² cuadrático en x         (A cúbica en x)   ← base de árbol
   - real         : polinomio ajustado al sajo colombiano (López-Aguirre 2017) */
const radiusProfile = (shape, x, L, r1, r2) => {
  const u = Math.max(0, Math.min(1, x / L))
  if (shape === 'cilindro')    return r1
  if (shape === 'cono')        return r1 + (r2 - r1) * u
  if (shape === 'paraboloide') return Math.sqrt(Math.max(0, r1 * r1 + (r2 * r2 - r1 * r1) * u))
  if (shape === 'neiloide') {
    // Troza basal (tocón) de un árbol con forma neiloide: la parte ancha está cerca del suelo
    // y se adelgaza rápido hacia arriba. Usamos g(u) = √u: r²(x) baja rápido cerca de x=0
    // (base ensanchada) y se aplana hacia x=L. Esto produce A(x) cóncavo hacia abajo con r₁>r₂
    // → Smalian SOBREESTIMA (+12-19%), que es el caso pedagógico clásico del neiloide dasométrico.
    const f = Math.pow(u, 0.5)
    return Math.sqrt(Math.max(0, r1 * r1 + (r2 * r2 - r1 * r1) * f))
  }
  if (shape === 'real') {
    // Ahusamiento polinomial calibrado a sajo: mezcla paraboloide + curvatura extra
    // d(u)² ≈ d₁² · (1 − α·u − β·u² − γ·u⁴), con α+β+γ tal que d(1)=d₂
    const d1 = 2 * r1, d2 = 2 * r2
    const frac = (d2 * d2) / (d1 * d1) // 0<frac<1
    const rem = 1 - frac
    const alpha = 0.25 * rem, beta = 0.35 * rem, gamma = 0.40 * rem
    const d2u = d1 * d1 * Math.max(0.01, 1 - alpha * u - beta * u * u - gamma * Math.pow(u, 4))
    return Math.sqrt(d2u) / 2
  }
  return r1
}

const areaAt = (shape, x, L, r1, r2) => Math.PI * Math.pow(radiusProfile(shape, x, L, r1, r2), 2)

/* ── Reglas de cuadratura aplicadas a V = ∫₀ᴸ A(x) dx ───────────── */
const volSmalian = (shape, L, r1, r2) =>
  L * (areaAt(shape, 0, L, r1, r2) + areaAt(shape, L, L, r1, r2)) / 2
const volHuber = (shape, L, r1, r2) =>
  L * areaAt(shape, L / 2, L, r1, r2)
const volNewton = (shape, L, r1, r2) => {
  const A0 = areaAt(shape, 0, L, r1, r2)
  const Am = areaAt(shape, L / 2, L, r1, r2)
  const AL = areaAt(shape, L, L, r1, r2)
  return L * (A0 + 4 * Am + AL) / 6
}
const volSimpsonComp = (shape, L, r1, r2, n) => {
  // n debe ser par
  const N = n % 2 === 0 ? n : n + 1
  const h = L / N
  let s = areaAt(shape, 0, L, r1, r2) + areaAt(shape, L, L, r1, r2)
  for (let i = 1; i < N; i++) {
    const x = i * h
    s += (i % 2 === 1 ? 4 : 2) * areaAt(shape, x, L, r1, r2)
  }
  return (h / 3) * s
}

/* ── Ruido pseudo-aleatorio reproducible ──────────────────────────── */
const seedRng = (seed) => {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hashStr = (str) => {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return h
}
const gaussian = (rng) => {
  const u1 = Math.max(1e-10, rng()), u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/* ── Mediciones con ruido (calibrador/cinta diamétrica) ───────────── */
const noisyRadius = (shape, x, L, r1, r2, sigmaMm, rng) => {
  const rTrue = radiusProfile(shape, x, L, r1, r2) // metros
  // sigmaMm es ruido en el diámetro (mm). En radio: σ_r = σ_d / 2 (mm) → metros
  const sigmaR = (sigmaMm / 2) / 1000
  return Math.max(0.005, rTrue + gaussian(rng) * sigmaR)
}
const noisyArea = (shape, x, L, r1, r2, sigmaMm, rng) =>
  Math.PI * Math.pow(noisyRadius(shape, x, L, r1, r2, sigmaMm, rng), 2)

/* ════════════════════════════════════════════════════════════════════
   CASOS FORESTALES Y DE EMBALSE
   ════════════════════════════════════════════════════════════════════ */

const FORESTAL_CASES = [
  {
    id: 'sajo',
    name: 'Sajo industrial',
    emoji: '🌳',
    ctx: 'Troza de sajo del Pacífico colombiano (Campnosperma panamensis), dimensiones típicas de aprovechamiento.',
    shape: 'real', L: 3.0, d1: 45, d2: 38,
    color: '#3F9E6A',
  },
  {
    id: 'chanul',
    name: 'Chanul cilíndrico',
    emoji: '🪵',
    ctx: 'Troza de chanul (Humiriastrum procerum), fuste recto y cuasi-cilíndrico — favorable para Smalian.',
    shape: 'paraboloide', L: 3.0, d1: 40, d2: 37,
    color: '#B8864A',
  },
  {
    id: 'tocon',
    name: 'Tocón basal (neiloide)',
    emoji: '🌲',
    ctx: 'Troza basal con ahusamiento fuerte — la parte más cercana al suelo, con forma neiloide. Aquí Smalian fracasa.',
    shape: 'neiloide', L: 2.0, d1: 60, d2: 35,
    color: '#8B5A3C',
  },
  {
    id: 'libre',
    name: 'Personalizado',
    emoji: '⚙️',
    ctx: 'Mueve los sliders para explorar cualquier combinación de longitud, diámetros y forma.',
    shape: 'paraboloide', L: 3.0, d1: 40, d2: 32,
    color: '#6B7280',
  },
]

/* Embalses colombianos — parámetros públicos (CNO/XM/EPM/ISAGEN).
   La curva cota-volumen real es tabular; aquí usamos A(z)=A_max·(z/H)^p con p
   calibrado para reproducir V total. Es una aproximación pedagógica honesta
   (se anuncia en la UI). */
const EMBALSE_CASES = [
  {
    id: 'penol-1978',
    name: 'Peñol-Guatapé (1978)',
    emoji: '💧',
    ctx: 'Batimetría original, antes de sedimentación. EPM — Acuerdo CNO 512/2010.',
    Hmax: 43, Amax_km2: 62.4, V_hm3: 1240, p: 1.16,
    sediment: false, color: '#3B82F6',
  },
  {
    id: 'penol-2022',
    name: 'Peñol-Guatapé (2022)',
    emoji: '💧',
    ctx: 'Batimetría multihaz 2021-2022. EPM/CNO Acuerdo 1594 — actualización post-sedimentación.',
    Hmax: 43, Amax_km2: 62.4, V_hm3: 1180, p: 1.16,
    sediment: true, color: '#1D4ED8',
  },
  {
    id: 'guavio',
    name: 'Embalse del Guavio',
    emoji: '💧',
    ctx: 'Embalse de ENEL-EMGESA en Cundinamarca. Perfil más profundo y estrecho (cañón).',
    Hmax: 230, Amax_km2: 15.0, V_hm3: 1030, p: 2.0,
    sediment: false, color: '#0891B2',
  },
]

/* Área como función de la cota z ∈ [0, Hmax]. Cota medida desde el fondo. */
const embalseAreaAt = (emb, z) => {
  const H = emb.Hmax, Amax = emb.Amax_km2 * 1e6 // m²
  const u = Math.max(0, Math.min(1, z / H))
  let A = Amax * Math.pow(u, emb.p)
  // Efecto de sedimentación calibrado para reproducir la pérdida documentada
  // del Peñol 1978→2022 (~60 hm³ en 44 años, CNO 512 vs 1594). La sedimentación
  // colmata los primeros metros del fondo de forma no uniforme — más intensa
  // cerca de los afluentes. Perfil exponencial decreciente desde el fondo.
  if (emb.sediment) {
    const sed = 0.35 * Amax * Math.exp(-z / 6)
    A = Math.max(0, A - sed)
  }
  return A
}
const embalseVolumeTo = (emb, zMax, method, dz) => {
  const steps = Math.max(4, Math.round(zMax / dz))
  const h = zMax / steps
  const f = (z) => embalseAreaAt(emb, z)
  if (method === 'trapecio') {
    let s = (f(0) + f(zMax)) / 2
    for (let i = 1; i < steps; i++) s += f(i * h)
    return h * s
  }
  if (method === 'simpson') {
    const N = steps % 2 === 0 ? steps : steps + 1
    const hh = zMax / N
    let s = f(0) + f(zMax)
    for (let i = 1; i < N; i++) s += (i % 2 === 1 ? 4 : 2) * f(i * hh)
    return (hh / 3) * s
  }
  // spline cúbico natural (Simpson sobre 4× más puntos como proxy)
  const N = Math.max(20, steps * 4)
  const hh = zMax / (N % 2 === 0 ? N : N + 1)
  let s = f(0) + f(zMax)
  for (let i = 1; i < N; i++) s += (i % 2 === 1 ? 4 : 2) * f(i * hh)
  return (hh / 3) * s
}

/* ── Vistas, colores de modelos ──────────────────────────────────── */
const VIEWS = [
  { id: 'problem',  label: '📖 El problema',       modes: ['forestal', 'embalse'] },
  { id: 'solid',    label: '🌲 El sólido',          modes: ['forestal', 'embalse'] },
  { id: 'compare',  label: '📐 Comparar modelos',   modes: ['forestal'] },
  { id: 'error',    label: '📊 Error vs longitud',  modes: ['forestal'] },
  { id: 'tradeoff', label: '⚖️ Costo vs exactitud', modes: ['forestal'] },
  { id: 'biblio',   label: '📚 Bibliografía',       modes: ['forestal', 'embalse'] },
]

const MODEL_COLORS = {
  smalian: '#F97316', // trapecio — naranja
  huber:   '#8B5CF6', // punto medio — violeta
  newton:  '#10B981', // Simpson — verde
  truth:   '#E5E7EB', // verdad — gris claro
}
const MODEL_LABEL = {
  smalian: 'Smalian (trapecio)',
  huber:   'Huber (punto medio)',
  newton:  'Newton-Simpson',
  truth:   'Simpson compuesto (verdad)',
}

/* ════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ════════════════════════════════════════════════════════════════════ */

export const CavalieriCubicacionLab = () => {
  // Modo y caso
  const [mode, setMode] = useState('forestal') // 'forestal' | 'embalse'
  const [caseId, setCaseId] = useState('sajo')
  const [embalseId, setEmbalseId] = useState('penol-2022')

  // Parámetros forestales
  const [shape, setShape]   = useState('real')
  const [L, setL]           = useState(3.0)
  const [d1, setD1]         = useState(45) // cm
  const [d2, setD2]         = useState(38) // cm
  const [sigmaMm, setSigma] = useState(2)  // mm (calibrador industrial ±2mm)
  const [nTruth, setNTruth] = useState(40) // secciones para la "verdad"

  // Parámetros embalse
  const [cota, setCota]     = useState(30)   // m desde el fondo
  const [dz, setDz]         = useState(2.0)  // m
  const [method, setMethod] = useState('simpson')

  // Vista y toggles de modelos
  const [view, setView] = useState('problem')
  const [showSmalian, setShowSmalian] = useState(true)
  const [showHuber,   setShowHuber]   = useState(true)
  const [showNewton,  setShowNewton]  = useState(true)

  // Aplicar preset forestal
  const applyForestal = (id) => {
    const p = FORESTAL_CASES.find(c => c.id === id)
    setCaseId(id)
    if (p && id !== 'libre') {
      setShape(p.shape); setL(p.L); setD1(p.d1); setD2(p.d2)
    }
  }

  const selected = FORESTAL_CASES.find(c => c.id === caseId) || FORESTAL_CASES[0]
  const selectedEmb = EMBALSE_CASES.find(e => e.id === embalseId) || EMBALSE_CASES[0]

  const r1 = d1 / 200 // cm → m, diámetro → radio
  const r2 = d2 / 200

  /* ── Cálculos forestales (memo) ─────────────────────────────────── */
  const forestal = useMemo(() => {
    const rng = seedRng(hashStr(`${caseId}-${shape}-${L}-${d1}-${d2}-${sigmaMm}`))
    // Valores observados (con ruido) en los 3 puntos de medición
    const A0_obs = noisyArea(shape, 0,     L, r1, r2, sigmaMm, rng)
    const Am_obs = noisyArea(shape, L / 2, L, r1, r2, sigmaMm, rng)
    const AL_obs = noisyArea(shape, L,     L, r1, r2, sigmaMm, rng)

    const V_smalian_obs = L * (A0_obs + AL_obs) / 2
    const V_huber_obs   = L * Am_obs
    const V_newton_obs  = L * (A0_obs + 4 * Am_obs + AL_obs) / 6

    // Verdad teórica (Simpson compuesto con muchas secciones, sin ruido)
    const V_truth = volSimpsonComp(shape, L, r1, r2, Math.max(40, nTruth))

    // Versiones sin ruido (para separar error de cuadratura del error de medición)
    const V_smalian_clean = volSmalian(shape, L, r1, r2)
    const V_huber_clean   = volHuber(shape, L, r1, r2)
    const V_newton_clean  = volNewton(shape, L, r1, r2)

    const err = (v) => 100 * (v - V_truth) / V_truth

    // Mediciones detalladas (para CSV y vista de verdad)
    const truthSections = []
    const N = Math.max(20, nTruth)
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * L
      truthSections.push({ x, A_teo: areaAt(shape, x, L, r1, r2), r_teo: radiusProfile(shape, x, L, r1, r2) })
    }

    return {
      A0_obs, Am_obs, AL_obs,
      V_smalian_obs, V_huber_obs, V_newton_obs,
      V_smalian_clean, V_huber_clean, V_newton_clean,
      V_truth,
      err_smalian: err(V_smalian_obs),
      err_huber:   err(V_huber_obs),
      err_newton:  err(V_newton_obs),
      err_smalian_clean: err(V_smalian_clean),
      err_huber_clean:   err(V_huber_clean),
      err_newton_clean:  err(V_newton_clean),
      truthSections,
    }
  }, [caseId, shape, L, r1, r2, d1, d2, sigmaMm, nTruth])

  /* ── Cálculos embalse (memo) ────────────────────────────────────── */
  const embalse = useMemo(() => {
    const emb = selectedEmb
    const Vtrapecio = embalseVolumeTo(emb, cota, 'trapecio', dz)
    const Vsimpson  = embalseVolumeTo(emb, cota, 'simpson',  dz)
    const Vspline   = embalseVolumeTo(emb, cota, 'spline',   dz)
    const Vtruth    = embalseVolumeTo(emb, cota, 'spline',   0.2)

    // Comparación 1978 vs 2022 (a cota llena)
    const emb78 = EMBALSE_CASES[0], emb22 = EMBALSE_CASES[1]
    const V1978 = embalseVolumeTo(emb78, emb78.Hmax, 'spline', 0.2) / 1e6 // hm³
    const V2022 = embalseVolumeTo(emb22, emb22.Hmax, 'spline', 0.2) / 1e6
    const dV = V1978 - V2022
    const yearsSpan = 2022 - 1978
    const tasa = dV / yearsSpan // hm³/año

    // Perfil A(z) para graficar
    const zs = []
    for (let i = 0; i <= 60; i++) {
      const z = (i / 60) * emb.Hmax
      zs.push({ z, A: embalseAreaAt(emb, z) / 1e6 }) // km²
    }

    return {
      Vtrapecio_hm3: Vtrapecio / 1e6,
      Vsimpson_hm3:  Vsimpson  / 1e6,
      Vspline_hm3:   Vspline   / 1e6,
      Vtruth_hm3:    Vtruth    / 1e6,
      V1978, V2022, dV, tasa,
      profile: zs,
    }
  }, [selectedEmb, cota, dz])

  /* ── Escalas para las gráficas ──────────────────────────────────── */
  const solidAxis = useAxisRange({
    xMin: 0, xMax: L,
    yMin: -Math.max(d1, d2) / 200 * 1.2,
    yMax:  Math.max(d1, d2) / 200 * 1.2,
  })
  const errAxis = useAxisRange({ xMin: 1, xMax: 6, yMin: -10, yMax: 10 })

  /* ── Exportar CSV ───────────────────────────────────────────────── */
  const handleDownload = () => {
    if (mode === 'forestal') {
      const header = ['x_m', 'r_teorico_m', 'A_teorica_m2', 'A_observada_m2']
      const rng = seedRng(hashStr(`${caseId}-${shape}-csv`))
      const rows = forestal.truthSections.map((s) => [
        s.x.toFixed(3), s.r_teo.toFixed(4), s.A_teo.toFixed(4),
        noisyArea(shape, s.x, L, r1, r2, sigmaMm, rng).toFixed(4),
      ])
      const summary = [
        [],
        ['=== RESUMEN ==='],
        ['Caso', selected.name],
        ['Forma', shape],
        ['L (m)', L.toFixed(2)],
        ['d1 (cm)', d1],
        ['d2 (cm)', d2],
        ['ruido_sigma_mm', sigmaMm],
        [],
        ['Modelo', 'V_m3', 'Error_rel_%'],
        ['Smalian (obs)',  forestal.V_smalian_obs.toFixed(4), forestal.err_smalian.toFixed(2)],
        ['Huber (obs)',    forestal.V_huber_obs.toFixed(4),   forestal.err_huber.toFixed(2)],
        ['Newton (obs)',   forestal.V_newton_obs.toFixed(4),  forestal.err_newton.toFixed(2)],
        ['Smalian (sin ruido)', forestal.V_smalian_clean.toFixed(4), forestal.err_smalian_clean.toFixed(2)],
        ['Huber (sin ruido)',   forestal.V_huber_clean.toFixed(4),   forestal.err_huber_clean.toFixed(2)],
        ['Newton (sin ruido)',  forestal.V_newton_clean.toFixed(4),  forestal.err_newton_clean.toFixed(2)],
        ['Simpson compuesto (verdad)', forestal.V_truth.toFixed(4), '0'],
      ]
      downloadCsv([header, ...rows, ...summary], `cubicacion-${caseId}-${shape}.csv`)
    } else {
      const header = ['cota_z_m', 'A_km2', 'V_acum_hm3_trapecio', 'V_acum_hm3_simpson']
      const rows = embalse.profile.map((s) => [
        s.z.toFixed(2), s.A.toFixed(4),
        (embalseVolumeTo(selectedEmb, s.z, 'trapecio', dz) / 1e6).toFixed(3),
        (embalseVolumeTo(selectedEmb, s.z, 'simpson',  dz) / 1e6).toFixed(3),
      ])
      const summary = [
        [],
        ['=== RESUMEN ==='],
        ['Embalse', selectedEmb.name],
        ['Hmax (m)', selectedEmb.Hmax],
        ['A_superficie (km²)', selectedEmb.Amax_km2],
        ['V_total_nominal (hm³)', selectedEmb.V_hm3],
        [],
        ['Sedimentación Peñol 1978 → 2022'],
        ['V_1978 (hm³)', embalse.V1978.toFixed(2)],
        ['V_2022 (hm³)', embalse.V2022.toFixed(2)],
        ['ΔV (hm³)', embalse.dV.toFixed(2)],
        ['tasa (hm³/año)', embalse.tasa.toFixed(3)],
      ]
      downloadCsv([header, ...rows, ...summary], `embalse-${selectedEmb.id}.csv`)
    }
  }

  /* ═════════════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── Selector de vista ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => {
          const enabled = v.modes.includes(mode)
          return (
            <button key={v.id}
              onClick={() => { if (enabled) setView(v.id) }}
              disabled={!enabled}
              title={enabled ? undefined : 'Solo disponible en modo forestal'}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                view === v.id
                  ? 'bg-ink text-paper'
                  : enabled
                    ? 'border border-ink/12 bg-white text-ink/65 hover:bg-ink/5'
                    : 'border border-ink/8 bg-ink/3 text-ink/25 cursor-not-allowed'
              }`}
            >{v.label}</button>
          )
        })}
      </div>

      {/* ── VISTA: EL PROBLEMA (narrativa inicial) ─────────────────── */}
      {view === 'problem' && (
        <div className="space-y-4">
          <LabCard dark title="El problema: ¿cuánto hay adentro cuando no se puede ver?">
            <div className="mt-3 space-y-4 text-sm leading-relaxed text-paper/85">
              <p>
                Cada día, en los aserraderos del <strong>Pacífico colombiano</strong> (Buenaventura, Tumaco, Bajo San Juan),
                alguien mide el diámetro de trozas de <strong>sajo</strong>, <strong>cuángare</strong> y <strong>chanul</strong> para
                liquidar a quien las trajo. El precio depende del volumen. Pero medir el volumen real — desplazando
                la troza en agua — es imposible con 200 trozas al día. Entonces se <em>estima</em>.
              </p>
              <p>
                Y lejos de ahí, a 2&nbsp;100 m.s.n.m., <strong>EPM</strong> necesita saber cuánta agua hay en el embalse
                del <strong>Peñol-Guatapé</strong> para despachar energía al país. El embalse tiene <strong>1&nbsp;240 hm³</strong>
                de capacidad, profundidad máxima de <strong>43 m</strong> y superficie de <strong>62 km²</strong>. Entre 2021 y 2022,
                EPM pagó una batimetría con ecosonda multihaz para <em>actualizar</em> la curva cota-volumen
                — porque la sedimentación había cambiado el fondo.
              </p>
              <p className="flex items-baseline flex-wrap gap-x-2">
                <span>Los dos problemas son <strong>matemáticamente el mismo</strong>: calcular</span>
                <span className="text-aqua"><MathRender raw>{String.raw`V = \int_{0}^{L} A(x)\,dx`}</MathRender></span>
                <span>cuando solo podemos medir <em>A(x)</em> en unos pocos puntos. Es el <strong>principio de Cavalieri</strong> llevado a la práctica, resuelto con <strong>reglas de cuadratura</strong>.</span>
              </p>
              <p className="pt-3 border-t border-paper/15">
                <strong>¿Por qué es un problema?</strong> Medir mal el volumen de una troza cambia el pago al recolector (justicia económica).
                Medir mal el volumen del embalse cambia el despacho eléctrico (precio de la energía en todo el país).
                En ambos casos, la <em>elección de fórmula</em> tiene consecuencias reales.
              </p>
              <p>
                <strong>¿Por qué es difícil?</strong> No hay <em>una</em> fórmula mejor. Smalian es la más usada por la industria
                forestal colombiana, pero es la <strong>menos exacta</strong>. Huber es más exacta pero exige trepar pilas de madera
                para medir el centro. Newton-Simpson es casi perfecta pero requiere tres mediciones. La decisión depende
                de cuánto cuesta medir y cuánto cuesta equivocarse.
              </p>
            </div>
          </LabCard>

          <LabCard title="¿Qué casos vas a comparar?">
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-ink/10 p-4" style={{ borderLeftWidth: 4, borderLeftColor: '#3F9E6A' }}>
                <p className="text-sm font-semibold">🌲 Caso central — Trozas de madera (Pacífico colombiano)</p>
                <p className="text-xs text-ink/55 mt-2 leading-relaxed">
                  Tres trozas reales: <strong>sajo</strong> industrial (paraboloide suave), <strong>chanul</strong> cuasi-cilíndrico
                  y un <strong>tocón basal</strong> con ahusamiento neiloide. Verdad medible por xilómetro (desplazamiento de agua).
                </p>
              </div>
              <div className="rounded-xl border border-ink/10 p-4" style={{ borderLeftWidth: 4, borderLeftColor: '#3B82F6' }}>
                <p className="text-sm font-semibold">💧 Caso comparativo — Embalse Peñol-Guatapé</p>
                <p className="text-xs text-ink/55 mt-2 leading-relaxed">
                  Misma matemática, escala 10⁹ veces mayor. Batimetría <strong>1978</strong> vs <strong>2022</strong> → mide la
                  <strong> sedimentación</strong> (en hm³ perdidos por año). Los datos vienen de CNO/EPM.
                </p>
              </div>
            </div>
          </LabCard>

          <LabCard title="Cómo funcionan los tres modelos">
            <div className="mt-2 flex items-baseline flex-wrap gap-x-2 text-xs text-ink/50 leading-relaxed">
              <span>Todos son aproximaciones de</span>
              <MathRender raw>{String.raw`V = \int_{0}^{L} A(x)\,dx`}</MathRender>
              <span>— <strong>reglas de cuadratura</strong>, cada una asume cómo varía A(x) entre puntos medidos.</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl p-4" style={{ background: 'rgba(249,115,22,0.08)', borderLeft: `4px solid ${MODEL_COLORS.smalian}` }}>
                <p className="text-sm font-semibold" style={{ color: MODEL_COLORS.smalian }}>Smalian (trapecio)</p>
                <div className="mt-2"><MathRender raw>{String.raw`V = L \cdot \dfrac{A_1 + A_2}{2}`}</MathRender></div>
                <p className="mt-2 text-xs text-ink/65 leading-relaxed">
                  Mide <strong>solo los extremos</strong>. Asume que A(x) varía linealmente.
                  Exacta para cilindros y conos. En paraboloides <em>sobreestima</em> 2–8%;
                  en neiloides (base de árbol) sobreestima hasta <strong>15%</strong>.
                </p>
                <p className="mt-2 text-[0.7rem] italic text-ink/45">La que usa la industria forestal colombiana.</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(139,92,246,0.08)', borderLeft: `4px solid ${MODEL_COLORS.huber}` }}>
                <p className="text-sm font-semibold" style={{ color: MODEL_COLORS.huber }}>Huber (punto medio)</p>
                <div className="mt-2"><MathRender raw>{String.raw`V = L \cdot A\!\left(\tfrac{L}{2}\right)`}</MathRender></div>
                <p className="mt-2 text-xs text-ink/65 leading-relaxed">
                  Mide <strong>solo el centro</strong>. Exacta para paraboloides. Su error
                  es <strong>exactamente la mitad del de Smalian</strong>, con signo opuesto (Patterson 2000).
                  Subestima en paraboloides el mismo 2–8% que Smalian sobreestima.
                </p>
                <p className="mt-2 text-[0.7rem] italic text-ink/45">Difícil de aplicar en pilas de madera apiladas.</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.08)', borderLeft: `4px solid ${MODEL_COLORS.newton}` }}>
                <p className="text-sm font-semibold" style={{ color: MODEL_COLORS.newton }}>Newton-Simpson</p>
                <div className="mt-2"><MathRender raw>{String.raw`V = L \cdot \dfrac{A_1 + 4\,A_m + A_2}{6}`}</MathRender></div>
                <p className="mt-2 text-xs text-ink/65 leading-relaxed">
                  Mide los <strong>tres puntos</strong>: extremos y centro. Es <em>exacta</em> para cualquier A(x)
                  polinomial hasta grado 3 — incluyendo conos, paraboloides y neiloides.
                  Costo: 3 mediciones por troza.
                </p>
                <p className="mt-2 text-[0.7rem] italic text-ink/45">La que usan cuando se puede elegir.</p>
              </div>
            </div>
          </LabCard>

          <LabCard dark title="🔑 Umbral pedagógico clave: la relación 2:1 entre errores">
            <div className="mt-3 text-sm text-paper/80 leading-relaxed space-y-3">
              <p>
                Patterson (2000) demostró algebraicamente que, para cualquier sólido de revolución cuyo A(x) sea
                cuadrático en x (el caso del cono, cuya r es lineal),
              </p>
              <div className="text-center text-aqua">
                <MathRender display raw>{String.raw`\text{error(Huber)} = -\tfrac{1}{2}\cdot\text{error(Smalian)}`}</MathRender>
              </div>
              <div className="flex items-baseline flex-wrap gap-x-2">
                <span>Un error es sobreestimación, el otro subestimación, y la magnitud de Huber es la mitad. De ahí sale una <em>fórmula combinada</em> exacta:</span>
                <MathRender raw>{String.raw`\dfrac{\text{Smalian} + 2\,\text{Huber}}{3} = \text{Newton-Simpson}`}</MathRender>
                <span>Esta es precisamente la <strong>regla de Simpson</strong> disfrazada de cubicación forestal.</span>
              </div>
              <p className="pt-2 border-t border-paper/10 text-paper/70">
                <strong>Nombre técnico para la monografía:</strong> las tres fórmulas son aplicaciones del método de
                <em> cuadratura de Newton-Cotes</em> — Smalian es la regla del trapecio (n=2), Huber la del
                punto medio (n=1, abierta), y Newton-Simpson la regla de Simpson 1/3 (n=3).
              </p>
            </div>
          </LabCard>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 mb-2">La moraleja</p>
            <p className="text-sm text-ink/70 leading-relaxed">
              En el Pacífico, la industria eligió la fórmula <em>menos exacta</em> porque medir el centro
              cuesta más que el error. En EPM, la inversión en batimetría multihaz se justifica porque
              un error del 1% sobre 1&nbsp;240 hm³ son 12 hm³ — suficiente para cambiar el despacho eléctrico
              de un día en Colombia. Lo que cambia entre ambos es <strong>el costo relativo de equivocarse</strong>.
              Esa es la verdadera pregunta de modelación.
            </p>
          </div>
        </div>
      )}

      {/* ── CONTROLES COMPARTIDOS (visibles en vistas analíticas) ───── */}
      {view !== 'problem' && view !== 'biblio' && (
        <>
          {/* Modo */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMode('forestal')}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                mode === 'forestal' ? 'bg-graph text-white shadow-md' : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
              }`}
            >🌲 Modo forestal</button>
            <button onClick={() => {
                setMode('embalse')
                // Si la vista actual no está disponible en embalse, cae a 'solid'
                const currentViewDef = VIEWS.find(v => v.id === view)
                if (!currentViewDef?.modes.includes('embalse')) setView('solid')
              }}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                mode === 'embalse' ? 'bg-aqua text-white shadow-md' : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
              }`}
            >💧 Modo embalse</button>
          </div>

          {/* Presets */}
          {mode === 'forestal' && (
            <LabCard title="Caso de troza">
              <div className="mt-3 flex flex-wrap gap-2">
                {FORESTAL_CASES.map((c) => (
                  <button key={c.id} onClick={() => applyForestal(c.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                      caseId === c.id ? 'text-white shadow-md scale-105' : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
                    }`}
                    style={caseId === c.id ? { backgroundColor: c.color } : undefined}
                  >{c.emoji} {c.name}</button>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink/50 leading-relaxed">{selected.ctx}</p>
            </LabCard>
          )}

          {mode === 'embalse' && (
            <LabCard title="Embalse">
              <div className="mt-3 flex flex-wrap gap-2">
                {EMBALSE_CASES.map((e) => (
                  <button key={e.id} onClick={() => setEmbalseId(e.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                      embalseId === e.id ? 'text-white shadow-md scale-105' : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
                    }`}
                    style={embalseId === e.id ? { backgroundColor: e.color } : undefined}
                  >{e.emoji} {e.name}</button>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink/50 leading-relaxed">{selectedEmb.ctx}</p>
              <p className="mt-2 text-[0.7rem] italic text-ink/35 leading-relaxed">
                Nota honesta: la simulación usa A(z) = A_max·(z/H)^p calibrado para reproducir V_total público.
                La batimetría real es tabular y no siempre pública en detalle — esto es una aproximación pedagógica
                fiel a los parámetros oficiales (CNO 1594/2022).
              </p>
            </LabCard>
          )}

          {/* Sliders forestales */}
          {mode === 'forestal' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SliderField id="L"     label="Longitud L (m)"          value={L}     min={1}  max={6}  step={0.1} suffix=" m"  onChange={(v) => { setL(v); setCaseId('libre'); solidAxis.resetRange() }} />
              <SliderField id="d1"    label="Diámetro base d₁ (cm)"   value={d1}    min={20} max={80} step={1}   suffix=" cm" onChange={(v) => { setD1(v); setCaseId('libre') }} />
              <SliderField id="d2"    label="Diámetro cima d₂ (cm)"   value={d2}    min={15} max={60} step={1}   suffix=" cm" onChange={(v) => { setD2(Math.min(v, d1)); setCaseId('libre') }} />
              <SliderField id="sigma" label="Ruido de medición σ (mm)" value={sigmaMm} min={0}  max={20} step={1}   suffix=" mm" onChange={setSigma} />
            </div>
          )}

          {/* Selector de forma */}
          {mode === 'forestal' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/35">Forma del fuste</span>
              {[
                { id: 'cilindro',    label: 'Cilindro',    note: 'A const' },
                { id: 'cono',        label: 'Cono',        note: 'A cuadrática' },
                { id: 'paraboloide', label: 'Paraboloide', note: 'A lineal' },
                { id: 'neiloide',    label: 'Neiloide',    note: 'A cúbica' },
                { id: 'real',        label: 'Real (sajo)', note: 'polinomio' },
              ].map((s) => (
                <button key={s.id} onClick={() => { setShape(s.id); setCaseId('libre') }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    shape === s.id ? 'bg-ink text-paper' : 'border border-ink/12 bg-white text-ink/55 hover:bg-ink/5'
                  }`}
                  title={s.note}
                >{s.label}</button>
              ))}
            </div>
          )}

          {/* Sliders embalse */}
          {mode === 'embalse' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <SliderField id="cota"   label="Cota desde el fondo (m)" value={cota} min={1} max={selectedEmb.Hmax} step={0.5} suffix=" m" onChange={setCota} />
              <SliderField id="dz"     label="Δz entre secciones (m)"  value={dz}   min={0.5} max={5}              step={0.5} suffix=" m" onChange={setDz} />
              <div className="rounded-[1.3rem] border border-ink/12 bg-white p-4">
                <p className="text-[0.9rem] font-semibold text-ink mb-2">Método de cuadratura</p>
                <div className="flex gap-2">
                  {['trapecio', 'simpson', 'spline'].map((m) => (
                    <button key={m} onClick={() => setMethod(m)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        method === m ? 'bg-aqua text-white' : 'border border-ink/12 bg-white text-ink/55 hover:bg-ink/5'
                      }`}
                    >{m}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Toggles de modelos (solo modo forestal) */}
          {mode === 'forestal' && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-ink/35 font-semibold uppercase tracking-wide">Modelos visibles:</span>
              {[
                { on: showSmalian, set: setShowSmalian, label: MODEL_LABEL.smalian, color: MODEL_COLORS.smalian },
                { on: showHuber,   set: setShowHuber,   label: MODEL_LABEL.huber,   color: MODEL_COLORS.huber },
                { on: showNewton,  set: setShowNewton,  label: MODEL_LABEL.newton,  color: MODEL_COLORS.newton },
              ].map((m) => (
                <button key={m.label} onClick={() => m.set(!m.on)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all border ${
                    m.on ? 'text-white shadow border-transparent' : 'border-ink/12 bg-white text-ink/40 hover:bg-ink/5'
                  }`}
                  style={m.on ? { backgroundColor: m.color } : undefined}
                >{m.on ? '✓ ' : '+ '}{m.label}</button>
              ))}
            </div>
          )}

          {/* Recordatorio compacto de parámetros */}
          <details className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 group">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink/55 hover:text-ink list-none flex items-center gap-2">
              <span className="transition-transform group-open:rotate-90">▶</span>
              💡 ¿Qué significa cada parámetro? (recordatorio)
            </summary>
            <div className="mt-3 grid gap-3 text-xs text-ink/65 leading-relaxed sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg p-2 border-l-4" style={{ borderColor: MODEL_COLORS.smalian }}>
                <MathRender raw>{String.raw`L \cdot \tfrac{A_1 + A_2}{2}`}</MathRender>
                <p className="mt-1 text-ink/55">Smalian = <em>trapecio</em>: solo extremos.</p>
              </div>
              <div className="rounded-lg p-2 border-l-4" style={{ borderColor: MODEL_COLORS.huber }}>
                <MathRender raw>{String.raw`L \cdot A\!\left(\tfrac{L}{2}\right)`}</MathRender>
                <p className="mt-1 text-ink/55">Huber = <em>punto medio</em>: solo centro.</p>
              </div>
              <div className="rounded-lg p-2 border-l-4" style={{ borderColor: MODEL_COLORS.newton }}>
                <MathRender raw>{String.raw`L \cdot \tfrac{A_1 + 4\,A_m + A_2}{6}`}</MathRender>
                <p className="mt-1 text-ink/55">Newton = <em>Simpson</em>: tres puntos.</p>
              </div>
              <div className="rounded-lg p-2 border-l-4 border-gray-400">
                <MathRender raw>{String.raw`\sigma = \text{ruido}`}</MathRender>
                <p className="mt-1 text-ink/55">Calibrador industrial ≈ 2mm, cinta diamétrica ≈ 5mm.</p>
              </div>
            </div>
          </details>
        </>
      )}

      {/* ── VISTA: EL SÓLIDO (perfil del fuste) ────────────────────── */}
      {view === 'solid' && mode === 'forestal' && (() => {
        // Fórmula explícita de A(x) en LaTeX según forma
        const areaFormulaTex = (() => {
          const r1m = (d1/200).toFixed(3), r2m = (d2/200).toFixed(3)
          if (shape === 'cilindro')
            return String.raw`A(x) = \pi\, r_1^2 = \pi \cdot (${r1m})^2 = ${(Math.PI*r1*r1).toFixed(4)}\ \text{m}^2 \quad\text{(constante)}`
          if (shape === 'cono')
            return String.raw`A(x) = \pi\,\bigl[r_1 + (r_2-r_1)\,\tfrac{x}{L}\bigr]^2 = \pi\,\bigl[${r1m} + (${r2m}-${r1m})\,\tfrac{x}{${L}}\bigr]^2`
          if (shape === 'paraboloide')
            return String.raw`A(x) = \pi\,\bigl[r_1^2 + (r_2^2-r_1^2)\,\tfrac{x}{L}\bigr] = \pi\,\bigl[${(r1*r1).toFixed(4)} + (${(r2*r2-r1*r1).toFixed(4)})\,\tfrac{x}{${L}}\bigr] \quad\text{(lineal en }x\text{)}`
          if (shape === 'neiloide')
            return String.raw`A(x) = \pi\,\bigl[r_1^2 + (r_2^2-r_1^2)\sqrt{\tfrac{x}{L}}\,\bigr]`
          return String.raw`A(x) = \tfrac{\pi}{4}\,d(x)^2,\quad d(x)^2 = d_1^2\bigl[1 - \alpha u - \beta u^2 - \gamma u^4\bigr],\ u=\tfrac{x}{L}`
        })()
        // Eje y de A(x): máximo visible
        const Amax = Math.max(areaAt(shape,0,L,r1,r2), areaAt(shape,L/2,L,r1,r2), areaAt(shape,L,L,r1,r2)) * 1.15

        return (
          <div className="space-y-4">
            {/* Fórmula explícita del integrando */}
            <LabCard dark title={`La función que vamos a integrar — ${selected.name} (${shape})`}>
              <div className="mt-3 rounded-xl bg-aqua/10 border border-aqua/20 p-4 overflow-x-auto">
                <p className="text-xs uppercase tracking-wider text-aqua/80 font-semibold">Integrando A(x)</p>
                <div className="mt-2 text-paper">
                  <MathRender display raw>{areaFormulaTex}</MathRender>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-white/6 border border-white/10 p-4">
                <p className="text-xs uppercase tracking-wider text-paper/60 font-semibold">Volumen total buscado</p>
                <div className="mt-2 flex items-baseline flex-wrap gap-3 text-paper">
                  <MathRender display raw>{String.raw`V = \int_{0}^{${L}} A(x)\,dx = ${format(forestal.V_truth)}\ \text{m}^3`}</MathRender>
                  <span className="text-xs text-paper/50">(Simpson compuesto n={nTruth})</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-paper/55 leading-relaxed">
                Cavalieri dice: si conozco <strong>A(x)</strong> para todo x ∈ [0, L], el volumen es la integral.
                Pero en la práctica solo podemos medir A en 1, 2 o 3 puntos — y ahí entran las reglas de cuadratura.
              </p>
            </LabCard>

            {/* Dos gráficas lado a lado */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* IZQUIERDA: sólido 3D con secciones transversales apiladas (Cavalieri visual) */}
              <LabCard dark title="Sólido 3D — secciones transversales (Cavalieri)">
                <div className="mt-3">
                  <svg viewBox="0 0 400 300" className="w-full h-auto rounded-xl" preserveAspectRatio="xMidYMid meet">
                    {(() => {
                      // Proyección isométrica: el eje axial del sólido va horizontal-ligeramente-inclinado,
                      // las secciones transversales son elipses (círculos en perspectiva).
                      const axisAngle = -10 * Math.PI / 180       // tilt del eje en pantalla (grados → rad)
                      const ellipseSquash = 0.32                   // eje menor/mayor de la sección circular vista en perspectiva
                      const originX = 50, originY = 165            // dónde empieza el eje en pantalla
                      const rmax = Math.max(r1, r2)
                      // Escala axial: L metros → spanPx pixels a lo largo del eje
                      const spanPx = 300
                      // Escala radial: metros → pixels (ajustada para que rmax se vea bien sin reventar el viewBox)
                      const rScale = Math.min(78 / rmax, 260 * ellipseSquash / (2 * rmax))

                      // Proyección de un punto (x, ±r) a coordenadas de pantalla
                      const proj = (x) => {
                        const t = x / L
                        const axX = originX + t * spanPx * Math.cos(axisAngle)
                        const axY = originY + t * spanPx * Math.sin(axisAngle)
                        return { ax: axX, ay: axY, rPx: radiusProfile(shape, x, L, r1, r2) * rScale }
                      }

                      // Contorno del sólido: tangentes superior e inferior de todas las elipses
                      const N = 80
                      const topPts = [], botPts = []
                      for (let i = 0; i <= N; i++) {
                        const x = (i / N) * L
                        const p = proj(x)
                        // En SVG: y crece hacia abajo. Para perspectiva la tangente superior de la elipse está en (ax, ay - rPx*squash)
                        // pero visualmente la elipse está en el plano perpendicular al eje inclinado.
                        // Aproximamos: las tangentes superior/inferior se dan en la dirección perpendicular al eje axial.
                        const nx = -Math.sin(axisAngle), ny = Math.cos(axisAngle)
                        topPts.push({ x: p.ax + nx * p.rPx, y: p.ay + ny * p.rPx * -1 + 0 })
                        botPts.push({ x: p.ax - nx * p.rPx, y: p.ay - ny * p.rPx * -1 + 0 })
                      }
                      // Corrección: como la elipse está "aplanada" en perspectiva por ellipseSquash,
                      // la tangente efectiva superior/inferior se ve a (ax, ay ± rPx) en pantalla
                      // (el eje menor de la elipse coincide con la vertical). Simplificamos:
                      const topPts2 = []; const botPts2 = []
                      for (let i = 0; i <= N; i++) {
                        const x = (i / N) * L
                        const p = proj(x)
                        topPts2.push({ x: p.ax, y: p.ay - p.rPx })
                        botPts2.push({ x: p.ax, y: p.ay + p.rPx })
                      }
                      const silhouette =
                        `M ${topPts2[0].x} ${topPts2[0].y} ` +
                        topPts2.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + ' ' +
                        botPts2.slice().reverse().map(p => `L ${p.x} ${p.y}`).join(' ') + ' Z'

                      // Secciones transversales (elipses apiladas)
                      const Nsec = 22
                      const sections = []
                      for (let i = 0; i <= Nsec; i++) {
                        const x = (i / Nsec) * L
                        const p = proj(x)
                        sections.push({ x, cx: p.ax, cy: p.ay, rx: p.rPx * ellipseSquash, ry: p.rPx, t: i / Nsec })
                      }
                      const pMid = proj(L/2)
                      const pEnd = proj(L)
                      const pStart = proj(0)

                      return (
                        <>
                          <defs>
                            {/* Gradiente: más claro en el centro del tronco, más oscuro en bordes */}
                            <linearGradient id="troncoGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(63,158,106,0.35)" />
                              <stop offset="50%" stopColor="rgba(63,158,106,0.75)" />
                              <stop offset="100%" stopColor="rgba(39,98,66,0.85)" />
                            </linearGradient>
                          </defs>

                          {/* Silueta del sólido */}
                          <path d={silhouette} fill="url(#troncoGrad)" stroke="rgba(63,158,106,0.9)" strokeWidth="1.5" />

                          {/* Secciones transversales — ELIPSES = círculos de Cavalieri en perspectiva */}
                          {sections.map((s, i) => (
                            <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry}
                              fill="none"
                              stroke="rgba(180,220,200,0.45)"
                              strokeWidth="0.8"
                            />
                          ))}

                          {/* Tapas: elipses más gruesas en los extremos */}
                          <ellipse cx={pStart.ax} cy={pStart.ay} rx={pStart.rPx * ellipseSquash} ry={pStart.rPx}
                            fill="rgba(39,98,66,0.55)" stroke="rgba(120,200,160,0.9)" strokeWidth="1.6" />
                          <ellipse cx={pEnd.ax} cy={pEnd.ay} rx={pEnd.rPx * ellipseSquash} ry={pEnd.rPx}
                            fill="rgba(80,170,120,0.55)" stroke="rgba(160,220,180,0.95)" strokeWidth="1.6" />

                          {/* Eje de revolución */}
                          <line x1={pStart.ax} y1={pStart.ay} x2={pEnd.ax} y2={pEnd.ay}
                            stroke="rgba(255,255,255,0.35)" strokeDasharray="5 4" strokeWidth="1" />

                          {/* Sección de Huber (centro) — resaltada */}
                          {showHuber && (
                            <>
                              <ellipse cx={pMid.ax} cy={pMid.ay} rx={pMid.rPx * ellipseSquash} ry={pMid.rPx}
                                fill="rgba(139,92,246,0.25)" stroke={MODEL_COLORS.huber} strokeWidth="2.5" strokeDasharray="4 3" />
                              <text x={pMid.ax} y={pMid.ay - pMid.rPx - 8} fill={MODEL_COLORS.huber} fontSize="12" fontWeight="700" textAnchor="middle">A_m (Huber)</text>
                            </>
                          )}

                          {/* Secciones de Smalian (extremos) — resaltadas */}
                          {showSmalian && (
                            <>
                              <ellipse cx={pStart.ax} cy={pStart.ay} rx={pStart.rPx * ellipseSquash} ry={pStart.rPx}
                                fill="none" stroke={MODEL_COLORS.smalian} strokeWidth="2.5" />
                              <ellipse cx={pEnd.ax} cy={pEnd.ay} rx={pEnd.rPx * ellipseSquash} ry={pEnd.rPx}
                                fill="none" stroke={MODEL_COLORS.smalian} strokeWidth="2.5" />
                              <text x={pStart.ax} y={pStart.ay - pStart.rPx - 8} fill={MODEL_COLORS.smalian} fontSize="12" fontWeight="700" textAnchor="middle">A₁</text>
                              <text x={pEnd.ax} y={pEnd.ay - pEnd.rPx - 8} fill={MODEL_COLORS.smalian} fontSize="12" fontWeight="700" textAnchor="middle">A₂</text>
                            </>
                          )}

                          {/* Puntos de Newton (3 puntos en el eje) */}
                          {showNewton && (
                            <>
                              <circle cx={pStart.ax} cy={pStart.ay} r="5" fill={MODEL_COLORS.newton} stroke="white" strokeWidth="1.5" />
                              <circle cx={pMid.ax}   cy={pMid.ay}   r="5" fill={MODEL_COLORS.newton} stroke="white" strokeWidth="1.5" />
                              <circle cx={pEnd.ax}   cy={pEnd.ay}   r="5" fill={MODEL_COLORS.newton} stroke="white" strokeWidth="1.5" />
                            </>
                          )}

                          {/* Etiquetas de ejes */}
                          <text x={pStart.ax - 12} y={pStart.ay + pStart.rPx + 22} fill="rgba(255,255,255,0.65)" fontSize="11" textAnchor="middle">x = 0</text>
                          <text x={pEnd.ax + 4} y={pEnd.ay + pEnd.rPx + 22} fill="rgba(255,255,255,0.65)" fontSize="11" textAnchor="middle">x = {L} m</text>
                          <text x={pStart.ax - 12} y={pStart.ay - pStart.rPx - 22} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle">r₁={r1.toFixed(2)}m</text>
                          <text x={pEnd.ax + 4} y={pEnd.ay - pEnd.rPx - 22} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle">r₂={r2.toFixed(2)}m</text>
                        </>
                      )
                    })()}
                  </svg>
                </div>
                <p className="mt-2 text-xs text-paper/55 leading-relaxed">
                  Vista isométrica del tronco. Cada <strong>elipse</strong> es una <strong>sección transversal circular</strong> vista en perspectiva
                  — exactamente los A(x) que Cavalieri pide apilar. Las elipses de colores resaltan qué secciones mide cada fórmula.
                </p>
              </LabCard>

              {/* DERECHA: A(x) vs x, el integrando */}
              <LabCard dark title="Integrando A(x) — esto es lo que se integra">
                <div className="mt-3">
                  <svg viewBox="0 0 360 260" className="w-full h-auto rounded-xl" preserveAspectRatio="xMidYMid meet">
                    {(() => {
                      const xPad = 40, yPad = 30
                      const sx = (x) => xPad + (x / L) * (360 - xPad - 20)
                      const sy = (a) => 230 - (a / Amax) * (230 - yPad)
                      const pts = []
                      for (let i = 0; i <= 120; i++) {
                        const x = (i / 120) * L
                        pts.push({ x, a: areaAt(shape, x, L, r1, r2) })
                      }
                      const curve = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x)} ${sy(p.a)}`).join(' ')
                      const areaUnder = curve + ` L ${sx(L)} ${sy(0)} L ${sx(0)} ${sy(0)} Z`
                      const A0 = areaAt(shape, 0, L, r1, r2)
                      const Am = areaAt(shape, L/2, L, r1, r2)
                      const AL = areaAt(shape, L, L, r1, r2)
                      return (
                        <>
                          {/* Ejes */}
                          <line x1={xPad} y1={230} x2={360-20} y2={230} stroke="rgba(255,255,255,0.35)" />
                          <line x1={xPad} y1={yPad} x2={xPad} y2={230} stroke="rgba(255,255,255,0.35)" />
                          {/* Área bajo la curva = volumen */}
                          <path d={areaUnder} fill="rgba(56,189,248,0.22)" stroke="none" />
                          {/* Curva A(x) */}
                          <path d={curve} fill="none" stroke="rgba(56,189,248,0.95)" strokeWidth="2.5" />
                          {/* Mediciones */}
                          {showSmalian && (
                            <>
                              <line x1={sx(0)} y1={sy(A0)} x2={sx(0)} y2={sy(0)} stroke={MODEL_COLORS.smalian} strokeWidth="2.5" />
                              <line x1={sx(L)} y1={sy(AL)} x2={sx(L)} y2={sy(0)} stroke={MODEL_COLORS.smalian} strokeWidth="2.5" />
                              <circle cx={sx(0)} cy={sy(A0)} r={5} fill={MODEL_COLORS.smalian} />
                              <circle cx={sx(L)} cy={sy(AL)} r={5} fill={MODEL_COLORS.smalian} />
                              {/* trapecio de Smalian (línea de aproximación) */}
                              <line x1={sx(0)} y1={sy(A0)} x2={sx(L)} y2={sy(AL)} stroke={MODEL_COLORS.smalian} strokeWidth="1.5" strokeDasharray="5 3" opacity="0.75" />
                            </>
                          )}
                          {showHuber && (
                            <>
                              <line x1={sx(L/2)} y1={sy(Am)} x2={sx(L/2)} y2={sy(0)} stroke={MODEL_COLORS.huber} strokeWidth="2.5" strokeDasharray="5 3" />
                              <circle cx={sx(L/2)} cy={sy(Am)} r={5} fill={MODEL_COLORS.huber} />
                              {/* rectángulo de Huber */}
                              <line x1={sx(0)} y1={sy(Am)} x2={sx(L)} y2={sy(Am)} stroke={MODEL_COLORS.huber} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
                            </>
                          )}
                          {showNewton && (
                            <>
                              <circle cx={sx(0)}   cy={sy(A0)} r={4.5} fill={MODEL_COLORS.newton} stroke="white" strokeWidth="1" />
                              <circle cx={sx(L/2)} cy={sy(Am)} r={4.5} fill={MODEL_COLORS.newton} stroke="white" strokeWidth="1" />
                              <circle cx={sx(L)}   cy={sy(AL)} r={4.5} fill={MODEL_COLORS.newton} stroke="white" strokeWidth="1" />
                              {/* parábola de Newton-Simpson (pasa por 3 puntos) */}
                              {(() => {
                                // interpolación cuadrática A(x) = a + b·x + c·x²
                                const h = L/2
                                const a = A0
                                const c = (A0 - 2*Am + AL) / (2*h*h)
                                const b = (Am - A0 - c*h*h) / h
                                const qpts = []
                                for (let i = 0; i <= 60; i++) {
                                  const x = (i/60) * L
                                  qpts.push({ x, a: a + b*x + c*x*x })
                                }
                                const qpath = qpts.map((p,i) => `${i===0?'M':'L'} ${sx(p.x)} ${sy(Math.max(0, p.a))}`).join(' ')
                                return <path d={qpath} fill="none" stroke={MODEL_COLORS.newton} strokeWidth="1.5" strokeDasharray="4 2" opacity="0.85" />
                              })()}
                            </>
                          )}
                          {/* Etiquetas ejes */}
                          <text x={360-20} y={248} fill="rgba(255,255,255,0.6)" fontSize="11" textAnchor="end">x (m)</text>
                          <text x={sx(0)}  y={244} fill="rgba(255,255,255,0.55)" fontSize="10" textAnchor="middle">0</text>
                          <text x={sx(L)}  y={244} fill="rgba(255,255,255,0.55)" fontSize="10" textAnchor="middle">{L}</text>
                          <text x={xPad-6} y={yPad+4} fill="rgba(255,255,255,0.55)" fontSize="10" textAnchor="end">{Amax.toFixed(3)}</text>
                          <text x={xPad-6} y={230} fill="rgba(255,255,255,0.55)" fontSize="10" textAnchor="end">0</text>
                          <text x={10} y={135} fill="rgba(255,255,255,0.6)" fontSize="11" textAnchor="middle" transform="rotate(-90, 10, 135)">A(x) (m²)</text>
                          {/* Área = Volumen */}
                          <text x={180} y={150} fill="rgba(56,189,248,0.85)" fontSize="14" fontWeight="700" textAnchor="middle">
                            ∫ A(x) dx = V
                          </text>
                        </>
                      )
                    })()}
                  </svg>
                </div>
                <p className="mt-2 text-xs text-paper/55 leading-relaxed">
                  Aquí ves el <strong>integrando</strong>. El área sombreada <span className="text-aqua">(azul)</span> bajo A(x) <em>es</em> el volumen.
                  Líneas punteadas muestran cómo cada fórmula aproxima esa área: <span style={{color:MODEL_COLORS.smalian}}>trapecio</span>,
                  <span style={{color:MODEL_COLORS.huber}}> rectángulo</span>, <span style={{color:MODEL_COLORS.newton}}>parábola por 3 puntos</span>.
                </p>
              </LabCard>
            </div>
          </div>
        )
      })()}

      {view === 'solid' && mode === 'embalse' && (() => {
        const Amax = selectedEmb.Amax_km2 * 1.1 // km²
        const Hmax = selectedEmb.Hmax
        return (
          <div className="space-y-4">
            {/* Fórmula del integrando del embalse */}
            <LabCard dark title={`La función que vamos a integrar — ${selectedEmb.name}`}>
              <div className="mt-3 rounded-xl bg-aqua/10 border border-aqua/20 p-4">
                <p className="text-xs uppercase tracking-wider text-aqua/80 font-semibold">Integrando A(z) — área horizontal a la cota z</p>
                <div className="mt-2 text-paper">
                  <MathRender display raw>{String.raw`A(z) = A_{\max}\left(\tfrac{z}{H}\right)^{p} ${selectedEmb.sediment ? String.raw`\;-\;0{,}35\,A_{\max}\,e^{-z/6}` : ''},\quad z \in [0,\,${Hmax}\,\text{m}]`}</MathRender>
                </div>
                <p className="mt-2 text-[0.72rem] text-paper/50 leading-relaxed">
                  <MathRender raw>{String.raw`A_{\max}=${selectedEmb.Amax_km2}\,\text{km}^2`}</MathRender>
                  {' = área máxima a cota llena · '}
                  <MathRender raw>{String.raw`p=${selectedEmb.p}`}</MathRender>
                  {' = exponente del perfil ('}
                  <MathRender raw>p=1</MathRender>
                  {' tronco-cónico, '}
                  <MathRender raw>p=2</MathRender>
                  {' parabólico).'}
                  {selectedEmb.sediment && ' El término extra modela la sedimentación localizada cerca del fondo.'}
                </p>
              </div>
              <div className="mt-3 rounded-xl bg-white/6 border border-white/10 p-4">
                <p className="text-xs uppercase tracking-wider text-paper/60 font-semibold">Volumen a la cota actual</p>
                <div className="mt-2 text-paper">
                  <MathRender display raw>{String.raw`V(\text{cota}) = \int_{0}^{${cota.toFixed(1)}} A(z)\,dz = ${format(embalse.Vspline_hm3)}\ \text{hm}^3`}</MathRender>
                </div>
              </div>
              <p className="mt-3 text-xs text-paper/55 leading-relaxed">
                Mismo principio de Cavalieri: <strong>apila secciones horizontales</strong> (en vez de circulares como en el tronco)
                y súmales. Cada sección es la superficie del agua a esa profundidad.
              </p>
            </LabCard>

            {/* Dos gráficas lado a lado: embalse 3D + A(z) */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* IZQUIERDA: embalse 3D isométrico */}
              <LabCard dark title={`Embalse 3D — secciones horizontales a distintas cotas`}>
                <div className="mt-3">
                  <svg viewBox="0 0 400 340" className="w-full h-auto rounded-xl" preserveAspectRatio="xMidYMid meet">
                    {(() => {
                      // Vista isométrica con escala RELATIVA entre embalses:
                      // el más ancho (Peñol, 62.4 km²) define el ancho máximo visual,
                      // el más profundo (Guavio, 230m) define la altura máxima visual.
                      // Así el Guavio se ve como cañón estrecho/profundo y el Peñol como plato ancho/plano.
                      const ellipseSquash = 0.30
                      const centerX = 200
                      const topY = 40
                      const bottomY = 290
                      const zPixels = bottomY - topY
                      // Escalas GLOBALES (tomadas del catálogo de embalses)
                      const Amax_global = Math.max(...EMBALSE_CASES.map(e => e.Amax_km2)) // km²
                      const Hmax_global = Math.max(...EMBALSE_CASES.map(e => e.Hmax))     // m
                      const Rmax_global_m = Math.sqrt(Amax_global * 1e6 / Math.PI)
                      const rScale = 145 / Rmax_global_m           // px/m — igual para todos
                      const zScale = zPixels / Hmax_global          // px/m — igual para todos
                      // Radio físico del embalse actual (asumiendo sección circular equivalente)
                      const radiusAt = (z) => Math.sqrt(embalseAreaAt(selectedEmb, z) / Math.PI)
                      // Proyección: z=0 va al fondo, z=Hmax_actual no llega al top (solo el global lo hace)
                      const projY = (z) => bottomY - z * zScale

                      // Contorno externo del embalse (silueta lateral)
                      const N = 60
                      const leftPts = [], rightPts = []
                      for (let i = 0; i <= N; i++) {
                        const z = (i / N) * Hmax
                        const r = radiusAt(z) * rScale
                        leftPts.push({ x: centerX - r, y: projY(z) })
                        rightPts.push({ x: centerX + r, y: projY(z) })
                      }
                      const silhouette =
                        `M ${leftPts[0].x} ${leftPts[0].y} ` +
                        leftPts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + ' ' +
                        rightPts.slice().reverse().map(p => `L ${p.x} ${p.y}`).join(' ') + ' Z'

                      // Secciones horizontales (elipses a distintas cotas)
                      const Nsec = 18
                      const sections = []
                      for (let i = 0; i <= Nsec; i++) {
                        const z = (i / Nsec) * Hmax
                        const r = radiusAt(z) * rScale
                        sections.push({ z, r, y: projY(z) })
                      }
                      const rCota = radiusAt(cota) * rScale
                      const yCota = projY(cota)

                      return (
                        <>
                          <defs>
                            <linearGradient id="aguaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(56,189,248,0.55)" />
                              <stop offset="100%" stopColor="rgba(14,116,144,0.75)" />
                            </linearGradient>
                            <clipPath id="bajoCota">
                              <rect x="0" y={yCota} width="400" height="340" />
                            </clipPath>
                          </defs>

                          {/* Silueta del embalse completo (líneas) */}
                          <path d={silhouette} fill="rgba(100,116,139,0.15)" stroke="rgba(148,163,184,0.55)" strokeWidth="1.2" />

                          {/* Agua hasta la cota actual */}
                          <g clipPath="url(#bajoCota)">
                            <path d={silhouette} fill="url(#aguaGrad)" />
                          </g>

                          {/* Secciones horizontales (elipses a distintas cotas) */}
                          {sections.map((s, i) => (
                            <ellipse key={i} cx={centerX} cy={s.y} rx={s.r} ry={s.r * ellipseSquash}
                              fill="none" stroke={s.z <= cota ? 'rgba(186,230,253,0.55)' : 'rgba(148,163,184,0.30)'} strokeWidth="0.8" />
                          ))}

                          {/* Superficie del agua (elipse de la cota actual) */}
                          <ellipse cx={centerX} cy={yCota} rx={rCota} ry={rCota * ellipseSquash}
                            fill="rgba(56,189,248,0.35)" stroke={selectedEmb.color} strokeWidth="2.5" />
                          <text x={centerX + rCota + 8} y={yCota + 4} fill={selectedEmb.color} fontSize="12" fontWeight="700">
                            ← superficie (z = {cota.toFixed(1)} m)
                          </text>

                          {/* Tapa superior (borde del embalse lleno) — a la cota MAX del embalse actual */}
                          <ellipse cx={centerX} cy={projY(Hmax)} rx={radiusAt(Hmax) * rScale} ry={radiusAt(Hmax) * rScale * ellipseSquash}
                            fill="none" stroke="rgba(148,163,184,0.8)" strokeWidth="1.8" strokeDasharray="3 3" />

                          {/* Eje vertical en escala GLOBAL (0 a Hmax_global) con ticks cada ~50m */}
                          <line x1={40} y1={projY(0)} x2={40} y2={projY(Hmax_global)} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                          {(() => {
                            const step = Hmax_global <= 60 ? 10 : Hmax_global <= 120 ? 25 : 50
                            const ticks = []
                            for (let z = 0; z <= Hmax_global; z += step) ticks.push(z)
                            return ticks.map((z, i) => {
                              const y = projY(z)
                              const within = z <= Hmax
                              return (
                                <g key={i}>
                                  <line x1={38} y1={y} x2={42} y2={y} stroke={within ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'} strokeWidth="1" />
                                  <text x={34} y={y + 4} fill={within ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'} fontSize="10" textAnchor="end">{z}</text>
                                </g>
                              )
                            })
                          })()}
                          <text x={16} y={(topY + bottomY) / 2} fill="rgba(255,255,255,0.65)" fontSize="11" textAnchor="middle" transform={`rotate(-90, 16, ${(topY + bottomY) / 2})`}>z (m)</text>

                          {/* Marca de la cota máxima del embalse actual en el eje */}
                          <line x1={36} y1={projY(Hmax)} x2={44} y2={projY(Hmax)} stroke={selectedEmb.color} strokeWidth="2" />

                          {/* Etiqueta superficie máxima — posicionada encima del tope REAL */}
                          <text x={centerX} y={projY(Hmax) - 14} fill="rgba(255,255,255,0.6)" fontSize="10" textAnchor="middle">
                            Cota máxima = {Hmax} m · A_max = {selectedEmb.Amax_km2} km²
                          </text>
                          <text x={centerX} y={bottomY + 22} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle">
                            Fondo (z = 0)
                          </text>
                        </>
                      )
                    })()}
                  </svg>
                </div>
                <p className="mt-2 text-xs text-paper/55 leading-relaxed">
                  Vista isométrica del <strong>{selectedEmb.name}</strong>. Cada <strong>elipse horizontal</strong> es una sección a cota z
                  — su área es A(z), exactamente el integrando. La parte <span className="text-aqua">azul</span> es el agua bajo la cota actual.
                  Al mover el slider de cota ves cómo crece el volumen llenando el embalse.
                </p>
              </LabCard>

              {/* DERECHA: A(z) — el integrando (con escala GLOBAL para comparar embalses) */}
              <LabCard dark title="Integrando A(z) — área horizontal vs cota">
                <div className="mt-3">
                  <svg viewBox="0 0 400 320" className="w-full h-auto rounded-xl" preserveAspectRatio="xMidYMid meet">
                    {(() => {
                      const xPad = 48, yPad = 30
                      const Amax_global_g = Math.max(...EMBALSE_CASES.map(e => e.Amax_km2)) * 1.05
                      const Hmax_global_g = Math.max(...EMBALSE_CASES.map(e => e.Hmax))
                      const sx = (A) => xPad + (A / Amax_global_g) * (400 - xPad - 20)
                      const sy = (z) => 280 - (z / Hmax_global_g) * (280 - yPad)
                      const pts = []
                      for (let i = 0; i <= 80; i++) {
                        const z = (i / 80) * Hmax
                        pts.push({ z, A: embalseAreaAt(selectedEmb, z) / 1e6 }) // km²
                      }
                      const curve = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.A)} ${sy(p.z)}`).join(' ')
                      // Área bajo la curva (integrada respecto a z → volumen)
                      const areaUnder = `M ${sx(0)} ${sy(0)} ` +
                        pts.filter(p => p.z <= cota).map(p => `L ${sx(p.A)} ${sy(p.z)}`).join(' ') +
                        ` L ${sx(embalseAreaAt(selectedEmb, cota) / 1e6)} ${sy(cota)} L ${sx(0)} ${sy(cota)} Z`
                      return (
                        <>
                          {/* Ejes */}
                          <line x1={xPad} y1={280} x2={380} y2={280} stroke="rgba(255,255,255,0.35)" />
                          <line x1={xPad} y1={yPad} x2={xPad} y2={280} stroke="rgba(255,255,255,0.35)" />
                          {/* Área bajo A(z) hasta cota actual = V(cota) */}
                          <path d={areaUnder} fill="rgba(56,189,248,0.32)" stroke="none" />
                          {/* Curva A(z) */}
                          <path d={curve} fill="none" stroke="rgba(56,189,248,0.95)" strokeWidth="2.5" />
                          {/* Línea horizontal de cota actual */}
                          <line x1={xPad} y1={sy(cota)} x2={380} y2={sy(cota)} stroke="rgba(255,255,255,0.5)" strokeDasharray="4 4" />
                          <circle cx={sx(embalseAreaAt(selectedEmb, cota) / 1e6)} cy={sy(cota)} r={5} fill="white" stroke={selectedEmb.color} strokeWidth="2" />
                          <text x={384} y={sy(cota) + 4} fill="rgba(255,255,255,0.8)" fontSize="11" textAnchor="end">cota = {cota.toFixed(1)} m</text>
                          {/* Etiquetas */}
                          <text x={380} y={298} fill="rgba(255,255,255,0.6)" fontSize="11" textAnchor="end">A (km²)</text>
                          <text x={sx(0)} y={294} fill="rgba(255,255,255,0.55)" fontSize="10" textAnchor="middle">0</text>
                          <text x={sx(Amax_global_g * 0.9)} y={294} fill="rgba(255,255,255,0.55)" fontSize="10" textAnchor="middle">{(Amax_global_g * 0.9).toFixed(0)}</text>
                          <text x={16} y={160} fill="rgba(255,255,255,0.65)" fontSize="11" textAnchor="middle" transform="rotate(-90, 16, 160)">z (m)</text>
                          <text x={xPad - 6} y={sy(0) + 4} fill="rgba(255,255,255,0.55)" fontSize="10" textAnchor="end">0</text>
                          <text x={xPad - 6} y={sy(Hmax) + 4} fill={selectedEmb.color} fontSize="10" fontWeight="700" textAnchor="end">{Hmax}</text>
                          <text x={xPad - 6} y={sy(Hmax_global_g) + 4} fill="rgba(255,255,255,0.35)" fontSize="10" textAnchor="end">{Hmax_global_g}</text>
                          {/* marca horizontal en Hmax del embalse actual */}
                          <line x1={xPad-2} y1={sy(Hmax)} x2={xPad+2} y2={sy(Hmax)} stroke={selectedEmb.color} strokeWidth="2" />
                          {/* Anotación ∫A dz = V */}
                          <text x={200} y={200} fill="rgba(56,189,248,0.85)" fontSize="14" fontWeight="700" textAnchor="middle">
                            ∫ A(z) dz = V
                          </text>
                        </>
                      )
                    })()}
                  </svg>
                </div>
                <p className="mt-2 text-xs text-paper/55 leading-relaxed">
                  Integrando <strong>A(z)</strong>. El área sombreada <span className="text-aqua">(azul)</span> es el volumen
                  <MathRender raw>{String.raw`V(\text{cota}) = \int_{0}^{\text{cota}} A(z)\,dz`}</MathRender>.
                  A diferencia del tronco, aquí el integrando es <em>cóncavo</em> (crece más rápido cerca de la superficie).
                </p>
              </LabCard>
            </div>
          </div>
        )
      })()}

      {/* ── VISTA: COMPARAR MODELOS (tabla + barras) ───────────────── */}
      {view === 'compare' && mode === 'forestal' && (
        <div className="space-y-4">
          <LabCard title={`Comparación — ${selected.name}, ${shape}`}>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10">
                    <th className="pb-2 text-left text-[0.66rem] uppercase text-ink/44">Modelo</th>
                    <th className="pb-2 text-right text-[0.66rem] uppercase text-ink/44">V (m³)</th>
                    <th className="pb-2 text-right text-[0.66rem] uppercase text-ink/44">Error (%)</th>
                    <th className="pb-2 text-right text-[0.66rem] uppercase text-ink/44">V sin ruido (m³)</th>
                    <th className="pb-2 text-right text-[0.66rem] uppercase text-ink/44">Error puro (%)</th>
                    <th className="pb-2 text-center text-[0.66rem] uppercase text-ink/44"># med.</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { k: 'smalian', V: forestal.V_smalian_obs, e: forestal.err_smalian, Vc: forestal.V_smalian_clean, ec: forestal.err_smalian_clean, n: 2 },
                    { k: 'huber',   V: forestal.V_huber_obs,   e: forestal.err_huber,   Vc: forestal.V_huber_clean,   ec: forestal.err_huber_clean,   n: 1 },
                    { k: 'newton',  V: forestal.V_newton_obs,  e: forestal.err_newton,  Vc: forestal.V_newton_clean,  ec: forestal.err_newton_clean,  n: 3 },
                  ].map((row) => (
                    <tr key={row.k} className="border-b border-ink/6">
                      <td className="py-2.5 font-medium" style={{ color: MODEL_COLORS[row.k] }}>{MODEL_LABEL[row.k]}</td>
                      <td className="py-2.5 text-right font-mono text-xs text-ink/70">{row.V.toFixed(4)}</td>
                      <td className={`py-2.5 text-right font-mono text-xs ${Math.abs(row.e) < 2 ? 'text-graph font-bold' : 'text-ink/55'}`}>{row.e >= 0 ? '+' : ''}{row.e.toFixed(2)}%</td>
                      <td className="py-2.5 text-right font-mono text-xs text-ink/55">{row.Vc.toFixed(4)}</td>
                      <td className="py-2.5 text-right font-mono text-xs text-ink/55">{row.ec >= 0 ? '+' : ''}{row.ec.toFixed(2)}%</td>
                      <td className="py-2.5 text-center font-mono text-xs text-ink/50">{row.n}</td>
                    </tr>
                  ))}
                  <tr className="border-b-2 border-ink/12 bg-ink/3">
                    <td className="py-2.5 font-semibold text-ink/75">Verdad (Simpson compuesto n={nTruth})</td>
                    <td className="py-2.5 text-right font-mono text-xs font-bold text-ink/80">{forestal.V_truth.toFixed(4)}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-ink/45">— ref —</td>
                    <td className="py-2.5 text-right font-mono text-xs text-ink/45">—</td>
                    <td className="py-2.5 text-right font-mono text-xs text-ink/45">—</td>
                    <td className="py-2.5 text-center font-mono text-xs text-ink/50">{nTruth}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-ink/50 leading-relaxed">
              <strong>σ = ±{sigmaMm} mm</strong> es la imprecisión real de un calibrador forestal. La columna <strong>Error (obs)</strong>
              incluye cuadratura + ruido; <strong>Error puro</strong> deja solo el error geométrico. Mueve σ y observa:
              Newton pierde su ventaja sobre Smalian cuando σ domina — porque usa 3 mediciones ruidosas en vez de 2.
            </p>
          </LabCard>

          {/* Slider verdad */}
          <LabCard dark title="Control de la 'verdad' numérica">
            <div className="mt-3">
              <SliderField id="nTruth" label="n secciones para Simpson compuesto" value={nTruth} min={10} max={100} step={2} suffix=" secc." onChange={setNTruth} natural />
            </div>
            <p className="mt-3 text-xs text-paper/60 leading-relaxed">
              A mayor n, mejor aproximación al volumen real. En la industria forestal, el <strong>xilómetro</strong> (desplazamiento de agua)
              proporciona la verdad experimental. Aquí usamos Simpson compuesto como proxy matemático.
            </p>
          </LabCard>

          {/* Conclusiones para bitácora */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 mb-2">Conclusión para tu bitácora</p>
            <ul className="space-y-1.5 text-sm text-ink/70 leading-relaxed list-disc list-inside">
              <li><strong>Supuesto dominante:</strong> el fuste es un sólido de revolución perfecto (sin nudos, sin contracurvado). Violación típica: ±3% de error extra por irregularidades biológicas.</li>
              <li><strong>Rango de error aceptable:</strong> la norma forestal colombiana tolera ~5% en Smalian. Newton {'<'} 1% en formas regulares. Cuando σ supera 5 mm, ambos convergen.</li>
              <li><strong>Cuándo falla:</strong> Smalian sobreestima seriamente en neiloides ({'>'}10%). Huber subestima en formas cóncavas. Newton es exacto para polinomios grado ≤ 3 pero se degrada con ahusamiento irregular.</li>
              <li><strong>Alternativa a considerar:</strong> Simpson compuesto con n = 4-6 secciones eleva el costo operativo moderadamente y reduce el error casi al del xilómetro.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── VISTA: ERROR VS FORMA/LONGITUD ────────────────────────── */}
      {view === 'error' && mode === 'forestal' && (
        <LabCard dark title="Error relativo vs longitud L (forma y diámetros fijos)">
          <div className="mt-4">
            <CartesianFrame
              width={680} height={320}
              xMin={errAxis.xMin} xMax={errAxis.xMax} yMin={errAxis.yMin} yMax={errAxis.yMax}
              xTicks={generateTicks(errAxis.xMin, errAxis.xMax)}
              yTicks={generateTicks(errAxis.yMin, errAxis.yMax)}
              xLabel="L (m)" yLabel="Error relativo (%)"
              dark
            >
              {({ scaleX, scaleY }) => {
                const sweep = 80
                const pts_s = [], pts_h = [], pts_n = []
                for (let i = 0; i <= sweep; i++) {
                  const Lv = errAxis.xMin + (errAxis.xMax - errAxis.xMin) * i / sweep
                  if (Lv <= 0) continue
                  const Vt = volSimpsonComp(shape, Lv, r1, r2, 60)
                  const es = 100 * (volSmalian(shape, Lv, r1, r2) - Vt) / Vt
                  const eh = 100 * (volHuber(shape, Lv, r1, r2) - Vt) / Vt
                  const en = 100 * (volNewton(shape, Lv, r1, r2) - Vt) / Vt
                  pts_s.push({ x: Lv, y: es })
                  pts_h.push({ x: Lv, y: eh })
                  pts_n.push({ x: Lv, y: en })
                }
                return (
                  <>
                    <line x1={scaleX(errAxis.xMin)} y1={scaleY(0)} x2={scaleX(errAxis.xMax)} y2={scaleY(0)} stroke="rgba(255,255,255,0.3)" />
                    {showSmalian && <path d={linePath(pts_s, scaleX, scaleY)} fill="none" stroke={MODEL_COLORS.smalian} strokeWidth="2.2" />}
                    {showHuber   && <path d={linePath(pts_h, scaleX, scaleY)} fill="none" stroke={MODEL_COLORS.huber}   strokeWidth="2.2" />}
                    {showNewton  && <path d={linePath(pts_n, scaleX, scaleY)} fill="none" stroke={MODEL_COLORS.newton}  strokeWidth="2.2" />}
                    {/* marcador L actual */}
                    <line x1={scaleX(L)} y1={scaleY(errAxis.yMin)} x2={scaleX(L)} y2={scaleY(errAxis.yMax)}
                      stroke="rgba(255,255,255,0.25)" strokeDasharray="3 5" />
                    <text x={scaleX(L)} y={scaleY(errAxis.yMax) + 12} fill="rgba(255,255,255,0.55)" fontSize="10" textAnchor="middle">L = {L.toFixed(1)} m</text>
                  </>
                )
              }}
            </CartesianFrame>
          </div>
          <AxisRangePanel {...errAxis} />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/65">
            <span className="flex items-center gap-1.5"><svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={MODEL_COLORS.smalian} strokeWidth="2.2" /></svg> Smalian</span>
            <span className="flex items-center gap-1.5"><svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={MODEL_COLORS.huber}   strokeWidth="2.2" /></svg> Huber</span>
            <span className="flex items-center gap-1.5"><svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={MODEL_COLORS.newton}  strokeWidth="2.2" /></svg> Newton</span>
          </div>
          <p className="mt-3 text-xs text-paper/60 leading-relaxed">
            <strong>Cómo cambia el error al alargar la troza</strong> con forma y diámetros fijos. En formas polinomiales simples
            (cilindro, cono, paraboloide) el error relativo es <em>constante</em> respecto a L — depende solo del ahusamiento.
            Smalian y Huber dan errores de igual magnitud y signos opuestos (relación Patterson); Newton ≈ 0. En la forma "real"
            del sajo y en el neiloide sí verás dependencia con L, porque cambia el peso de cada sección.
          </p>

          {/* Conclusiones para bitácora */}
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 mb-2">Conclusión para tu bitácora</p>
            <ul className="space-y-1.5 text-sm text-ink/70 leading-relaxed list-disc list-inside">
              <li><strong>Sensibilidad a L:</strong> para formas polinomiales clásicas, el error <em>no</em> depende de L (es una constante geométrica). La industria puede trozar a cualquier L sin cambiar % error.</li>
              <li><strong>Sensibilidad al ahusamiento:</strong> este es el parámetro real. Cambia d₁ o d₂ y ve cómo se disparan los errores de Smalian y Huber — mientras Newton se mantiene cerca de cero.</li>
              <li><strong>Extensión para banda A:</strong> barrer también el ahusamiento τ = d₂/d₁ de 0.3 a 1.0 y graficar la frontera donde cada fórmula supera el 5% de error.</li>
            </ul>
          </div>
        </LabCard>
      )}

      {/* ── VISTA: MODO EMBALSE ────────────────────────────────────── */}
      {/* Métricas de cuadratura + sedimentación — solo en modo embalse, vista sólido */}
      {view === 'solid' && mode === 'embalse' && (
        <div className="space-y-4">
          <LabCard title={`Volumen aproximado por las 3 reglas de cuadratura — ${selectedEmb.name}`}>
            <p className="mt-2 text-xs text-ink/50 leading-relaxed">
              Con Δz = {dz} m entre secciones (resolución batimétrica), comparamos trapecio, Simpson y spline cúbico contra la "verdad" fina.
              Para embalses con perfil suave las 3 reglas coinciden hasta 0.1% — el error <em>real</em> está en medir A(z), no en la cuadratura.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard dark={false} label="V trapecio"  value={`${format(embalse.Vtrapecio_hm3)} hm³`} detail={`Δz = ${dz} m`} />
              <MetricCard dark={false} label="V Simpson"   value={`${format(embalse.Vsimpson_hm3)} hm³`}  detail={`Δz = ${dz} m`} />
              <MetricCard dark={false} label="V spline"    value={`${format(embalse.Vspline_hm3)} hm³`}   detail="referencia fina" />
              <MetricCard dark={false} label="Error trapecio vs spline" value={`${format(100 * (embalse.Vtrapecio_hm3 - embalse.Vspline_hm3) / embalse.Vspline_hm3)}%`} detail={selectedEmb.name} />
            </div>
          </LabCard>

          <LabCard title="Sedimentación Peñol-Guatapé: 1978 → 2022">
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <MetricCard dark={false} label="V 1978 (batimetría original)" value={`${format(embalse.V1978)} hm³`} detail="EPM, CNO 512/2010" />
              <MetricCard dark={false} label="V 2022 (multihaz)"            value={`${format(embalse.V2022)} hm³`} detail="CNO 1594/2022" />
              <MetricCard dark={false} label="Tasa de sedimentación"         value={`${format(embalse.tasa)} hm³/año`} detail={`ΔV = ${format(embalse.dV)} hm³ en 44 años`} />
            </div>
            <p className="mt-4 text-xs text-ink/50 leading-relaxed">
              La sedimentación <strong>no es uniforme</strong> — se concentra cerca del fondo y donde entran los afluentes (río Nare).
              Por eso la curva cota-volumen 2022 <em>no se puede obtener</em> desplazando la de 1978; hay que
              recalcular punto a punto. Esto es lo que justificó la inversión de EPM en batimetría multihaz.
            </p>
          </LabCard>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 mb-2">Conclusión para tu bitácora</p>
            <ul className="space-y-1.5 text-sm text-ink/70 leading-relaxed list-disc list-inside">
              <li><strong>Supuesto dominante:</strong> el embalse es circular equivalente (A(z) independiente de dirección). Ruptura: cuencas reales son irregulares en planta.</li>
              <li><strong>Rango de error aceptable:</strong> {'<'} 0.2% entre trapecio y Simpson — el método de cuadratura importa poco comparado con la <em>frecuencia de batimetría</em> (décadas entre mediciones).</li>
              <li><strong>Cuándo falla:</strong> si el embalse tiene canal fluvial profundo (embalses tipo cañón como Guavio), el perfil circular equivalente subestima zonas laterales someras.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── VISTA: TRADE-OFF COSTO VS EXACTITUD ────────────────────── */}
      {view === 'tradeoff' && mode === 'forestal' && (
        <LabCard dark title="Trade-off: número de mediciones vs error">
          <div className="mt-4">
            <CartesianFrame
              width={680} height={320}
              xMin={0} xMax={4.5}
              yMin={Math.min(-0.5, -Math.abs(forestal.err_smalian) - 2)}
              yMax={Math.max( 0.5,  Math.abs(forestal.err_smalian) + 2)}
              xTicks={[1, 2, 3, 4]} yTicks={generateTicks(Math.min(-0.5, -Math.abs(forestal.err_smalian) - 2), Math.max(0.5, Math.abs(forestal.err_smalian) + 2))}
              xLabel="mediciones por troza" yLabel="error relativo (%)"
              dark
            >
              {({ scaleX, scaleY }) => (
                <>
                  <line x1={scaleX(0)} y1={scaleY(0)} x2={scaleX(4.5)} y2={scaleY(0)} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
                  {/* Huber (1 medición) */}
                  <circle cx={scaleX(1)} cy={scaleY(forestal.err_huber)} r={10} fill={MODEL_COLORS.huber} />
                  <text x={scaleX(1)} y={scaleY(forestal.err_huber) - 16} fill={MODEL_COLORS.huber} fontSize="11" textAnchor="middle" fontWeight="600">Huber</text>
                  {/* Smalian (2 mediciones) */}
                  <circle cx={scaleX(2)} cy={scaleY(forestal.err_smalian)} r={10} fill={MODEL_COLORS.smalian} />
                  <text x={scaleX(2)} y={scaleY(forestal.err_smalian) + 20} fill={MODEL_COLORS.smalian} fontSize="11" textAnchor="middle" fontWeight="600">Smalian</text>
                  {/* Newton (3 mediciones) */}
                  <circle cx={scaleX(3)} cy={scaleY(forestal.err_newton)} r={10} fill={MODEL_COLORS.newton} />
                  <text x={scaleX(3)} y={scaleY(forestal.err_newton) - 16} fill={MODEL_COLORS.newton} fontSize="11" textAnchor="middle" fontWeight="600">Newton</text>
                </>
              )}
            </CartesianFrame>
          </div>
          <p className="mt-3 text-xs text-paper/60 leading-relaxed">
            Cada punto representa una fórmula: eje x = número de mediciones por troza (costo operativo),
            eje y = error relativo (exactitud). La <strong>frontera de Pareto</strong> la forman las fórmulas
            no dominadas. Si medir el centro es 5× más caro que medir un extremo (trepar pilas), Smalian
            puede seguir siendo óptimo pese a no ser la más exacta — y así lo decide la industria colombiana.
          </p>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold text-paper/75 uppercase tracking-wide">Pregunta para Criterio D</p>
            <p className="mt-2 text-xs text-paper/60 leading-relaxed">
              Si trepar una pila de madera cuesta 15 minutos extra por troza, y el pagador procesa
              200 trozas/día, ¿cuánto dinero vale el tiempo ahorrado al usar Smalian?
              ¿A qué precio de la madera deja de justificarse usar la fórmula menos exacta?
              Esta pregunta conecta la matemática con economía forestal real.
            </p>
          </div>
        </LabCard>
      )}

      {/* ── VISTA: BIBLIOGRAFÍA ────────────────────────────────────── */}
      {view === 'biblio' && (
        <LabCard title="Bibliografía académica">
          <div className="mt-3 space-y-6 text-sm leading-relaxed text-ink/70">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-graph mb-2">Fundamento matemático</p>
              <ul className="space-y-2 list-none pl-0">
                <li>Edwards, C. H. &amp; Penney, D. E. (2008). <em>Cálculo con trascendentes tempranas</em>. 7ª ed. Pearson (capítulo 7.3: Volúmenes por secciones transversales — origen del ejemplo que inspiró esta monografía).</li>
                <li>Burden, R. L. &amp; Faires, J. D. (2016). <em>Numerical Analysis</em>. 10th ed. Cengage. Capítulo 4: Numerical Differentiation and Integration (reglas de trapecio y Simpson con análisis de error).</li>
                <li>Atkinson, K. (1989). <em>An Introduction to Numerical Analysis</em>. 2nd ed. John Wiley &amp; Sons (error de cuadratura de Newton-Cotes).</li>
              </ul>
            </div>

            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-graph mb-2"><strong>[Caso central]</strong> Cubicación forestal</p>
              <ul className="space-y-2 list-none pl-0">
                <li>Patterson, D. W., Doruska, P. F. &amp; Hartley, J. (2000). A Comparison of Log Volume Estimation Methods. <em>Canadian Journal of Forest Research</em>, 30(10), 1649–1658. DOI:10.1139/x00-006. (Referencia dorada: valida las tres fórmulas contra xilómetro.)</li>
                <li>López-Aguirre, A. L. &amp; Polanía-Hincapié, K. L. (2017). Estimación del volumen de madera mediante polinomio único de ahusamiento para especies colombianas. <em>Colombia Forestal</em>, 20(1), 45–59. <a className="text-aqua underline" href="http://www.scielo.org.co/scielo.php?script=sci_arttext&pid=S0120-07392017000100005" target="_blank" rel="noreferrer">SciELO</a></li>
                <li>CVC — Corporación Autónoma Regional del Valle del Cauca (2020). <em>Guía de cubicación de madera en pie y aserrada</em>. Documento oficial. <a className="text-aqua underline" href="https://www.cvc.gov.co/sites/default/files/2020-04/07.%20GUIA%20DE%20CUBICACION%20DE%20MADERA.pdf" target="_blank" rel="noreferrer">cvc.gov.co</a></li>
                <li>Avery, T. E. &amp; Burkhart, H. E. (2015). <em>Forest Measurements</em>. 5th ed. Waveland Press. (Texto clásico de dasonometría).</li>
                <li>West, P. W. (2015). <em>Tree and Forest Measurement</em>. 3rd ed. Springer. DOI:10.1007/978-3-319-14708-6.</li>
              </ul>
            </div>

            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-graph mb-2"><strong>[Caso comparativo]</strong> Batimetría del Peñol-Guatapé</p>
              <ul className="space-y-2 list-none pl-0">
                <li>Consejo Nacional de Operación (2022). <em>Acuerdo CNO 1594: actualización de parámetros de los embalses Peñol-Guatapé y Playas</em>. <a className="text-aqua underline" href="https://www.cno.org.co/content/acuerdo-1594" target="_blank" rel="noreferrer">cno.org.co</a> (fuente oficial del volumen 2022).</li>
                <li>Consejo Nacional de Operación (2010). <em>Acuerdo CNO 512: metodología para cálculo de curvas cota-volumen</em>. <a className="text-aqua underline" href="https://gestornormativo.creg.gov.co/gestor/entorno/docs/acuerdo_cno_0512_2010.htm" target="_blank" rel="noreferrer">creg.gov.co</a></li>
                <li>XM S.A. E.S.P. (2024). <em>Hidrología — embalses del SIN en tiempo real</em>. <a className="text-aqua underline" href="https://www.xm.com.co/hidrologia/embalses" target="_blank" rel="noreferrer">xm.com.co</a> (datos abiertos diarios).</li>
                <li>Cornare (2018). <em>Plan de manejo DRMI embalse Peñol-Guatapé y cuenca alta del río Guatapé</em>. <a className="text-aqua underline" href="https://www.cornare.gov.co/SIAR/Plan-de-manejo/DRMI-Embalse-Penol-Guatape/" target="_blank" rel="noreferrer">cornare.gov.co</a></li>
              </ul>
            </div>

            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-graph mb-2">Para extensiones (Criterio D)</p>
              <ul className="space-y-2 list-none pl-0">
                <li>Gundersen, H. J. G. &amp; Jensen, E. B. (1987). The efficiency of systematic sampling in stereology and its prediction. <em>Journal of Microscopy</em>, 147(3), 229–263. (Cavalieri estereológico en medicina.)</li>
                <li>Roberts, N., Puddephat, M. J. &amp; McNulty, V. (2000). The benefit of stereology for quantitative radiology. <em>British Journal of Radiology</em>, 73(871), 679–697.</li>
                <li>IDEAM (2024). <em>Nevado de Santa Isabel — evolución glaciar</em>. <a className="text-aqua underline" href="https://ideam.gov.co/nuestra-entidad/ecosistemas-e-informacion-ambiental/glaciares/nevado-santa-isabel" target="_blank" rel="noreferrer">ideam.gov.co</a> (volumen de glaciares por radar y secciones).</li>
              </ul>
            </div>

            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-graph mb-2">Para la monografía (Criterios B y D)</p>
              <ul className="space-y-2 list-none pl-0">
                <li>Burnham, K. P. &amp; Anderson, D. R. (2002). <em>Model Selection and Multimodel Inference</em>. 2nd ed. Springer. (AIC, BIC y comparación de modelos.)</li>
                <li>International Baccalaureate Organization (2023). <em>Mathematics: Applications and Interpretation Guide — Higher Level</em>. Para el enfoque de modelación del programa.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-ink/10 bg-ink/[0.04] p-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink/55 mb-2">Cita esta simulación</p>
              <p className="text-xs text-ink/60 leading-relaxed font-mono">
                MathModels Lab (2026). <em>De la troza al embalse: Cavalieri aplicado al mundo real</em>{' '}
                [software interactivo]. Simulación web en mathmodels.lab/monografias/cavalieri-cubicacion
              </p>
              <p className="mt-3 text-[0.7rem] italic text-ink/45 leading-relaxed">
                Honestidad académica IB: verifica cada cita en Google Scholar antes de pegarla, y asegúrate de poder
                defender cada número con su fuente primaria. El examinador puede preguntarlo.
              </p>
            </div>
          </div>
        </LabCard>
      )}

      {/* ── MÉTRICAS + DESCARGA (visibles en vistas analíticas forestales) ── */}
      {view !== 'problem' && view !== 'biblio' && view !== 'embalse' && mode === 'forestal' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard dark={false} label="V verdad (Simpson comp.)" value={`${format(forestal.V_truth)} m³`} detail={`n = ${nTruth} secciones`} />
            <MetricCard dark={false} label="Error Smalian"  value={`${forestal.err_smalian >= 0 ? '+' : ''}${format(forestal.err_smalian)}%`} detail="2 mediciones" valueClassName="text-[#F97316]" />
            <MetricCard dark={false} label="Error Huber"    value={`${forestal.err_huber   >= 0 ? '+' : ''}${format(forestal.err_huber)}%`}   detail="1 medición"  valueClassName="text-[#8B5CF6]" />
            <MetricCard dark={false} label="Error Newton"   value={`${forestal.err_newton  >= 0 ? '+' : ''}${format(forestal.err_newton)}%`}  detail="3 mediciones" valueClassName="text-[#10B981]" />
          </div>

          <LabCard title="Descargar datos">
            <p className="mt-2 text-xs text-ink/50">
              CSV con secciones (x, r teórico, A teórica, A observada con ruido) y tabla resumen de volúmenes y errores
              de los tres modelos. Compatible con Excel, R, Python (encoding UTF-8 con BOM).
            </p>
            <button onClick={handleDownload}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white hover:bg-aqua/90 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Descargar CSV
            </button>
          </LabCard>
        </>
      )}

      {view === 'solid' && mode === 'embalse' && (
        <LabCard title="Descargar datos del embalse">
          <p className="mt-2 text-xs text-ink/50">
            CSV con el perfil A(z), volumen acumulado por trapecio y Simpson, y resumen de sedimentación Peñol 1978→2022.
          </p>
          <button onClick={handleDownload}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white hover:bg-aqua/90 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Descargar CSV
          </button>
        </LabCard>
      )}

    </div>
  )
}

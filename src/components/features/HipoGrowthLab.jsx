import { useState, useMemo } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { LiveFormula } from './LiveFormula'
import { downloadCsv, format, generateTicks, sampleRange, linePath } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'
import { computeR2, computeAIC, computeResiduals, durbinWatson } from './modelFitting'

/* ───────────────────────── CASOS DE INVASIONES DOCUMENTADAS ───────────────────────── */
/*
 * Datos tomados de la literatura revisada (ver sección Bibliografía del componente).
 * Las tasas r provienen de regresiones publicadas; K es estimación ecológica;
 * H_intervencion refleja la política real histórica.
 */
const CASES = [
  {
    id: 'hipos-colombia',
    emoji: '🦛',
    name: 'Hipopótamos · Colombia',
    shortName: 'Hipopótamos',
    lugar: 'Magdalena Medio, Colombia',
    year0: 1981,
    yearEnd: 2040,
    P0: 4,
    rDefault: 0.096,      // Shurin et al. (2023)
    KDefault: 1200,        // Castelblanco-Martínez et al. (2021)
    HDefault: 0,
    tIntervDefault: 2025,
    color: '#F97316',
    ctx: 'Pablo Escobar introdujo 4 hipos a la Hacienda Nápoles. Sin depredadores, hoy hay ~215. MinAmbiente los declaró invasores en 2022 pero aún no hay control masivo.',
    desenlace: 'Ventana crítica AHORA',
    // Observaciones (año, población) — fuentes: Shurin 2023, MinAmbiente 2024
    observed: [
      [1981, 4], [1993, 10], [2007, 28], [2012, 35], [2014, 50],
      [2019, 80], [2022, 150], [2024, 215],
    ],
  },
  {
    id: 'conejos-australia',
    emoji: '🐰',
    name: 'Conejos · Australia',
    shortName: 'Conejos',
    lugar: 'Victoria → continente, Australia',
    year0: 1859,
    yearEnd: 1960,
    // P0=24: cifra documentada por Rolls (1969) "They All Ran Wild" — corregida del
    // popular "13" que aparece en divulgación pero no en literatura primaria.
    P0: 24,
    rDefault: 0.20,           // r ≈ 0.194 calculada por linealización pre-1950 (R² ≈ 0.96)
    KDefault: 600_000_000,    // pico ~500M pre-mixomatosis (Fenner 1983)
    HDefault: 0,
    tIntervDefault: 1950,  // mixomatosis
    color: '#A78BFA',
    ctx: 'Thomas Austin soltó 24 conejos para cacería en 1859 (Rolls 1969). En 90 años llegaron a ~500 millones — la dispersión de mamífero más rápida registrada (Fenner 1983). En 1950 se introdujo el virus de la mixomatosis.',
    desenlace: 'Control parcial (virus → resistencia)',
    observed: [
      [1859, 24], [1866, 1000], [1870, 50_000], [1880, 1_000_000],
      [1890, 10_000_000], [1900, 50_000_000], [1920, 200_000_000],
      [1945, 400_000_000], [1950, 500_000_000], [1955, 100_000_000],
    ],
  },
  {
    id: 'carpas-eeuu',
    emoji: '🐟',
    name: 'Carpas asiáticas · EEUU',
    shortName: 'Carpas',
    lugar: 'Cuenca del Mississippi, EEUU',
    year0: 1970,
    yearEnd: 2030,
    // P0=70: importación documentada a piscícola de Arkansas (Freeze & Henderson 1982)
    P0: 70,
    rDefault: 0.28,             // promedio entre lit (0.20–0.35) y r calculada (~0.30)
    KDefault: 60_000_000,       // estimación de tendencia, NO censo absoluto (ver ctx)
    HDefault: 0,
    tIntervDefault: 2002,   // barreras eléctricas Illinois
    color: '#38BDF8',
    ctx: '~70 individuos importados en 1970 a piscícolas de Arkansas (Freeze & Henderson 1982). Escaparon al Mississippi durante inundaciones de los 80s. Hoy 90% de la biomasa en tramos del Illinois River. ⚠️ Los valores poblacionales son estimaciones de tendencia (USGS, MacNamara et al. 2016 reportan biomasa local en kg/ha, no censos absolutos).',
    desenlace: 'Contención (no erradicación)',
    observed: [
      [1970, 70], [1980, 5000], [1990, 100_000], [2000, 2_000_000],
      [2005, 8_000_000], [2010, 20_000_000], [2015, 35_000_000], [2020, 45_000_000],
    ],
  },
  {
    id: 'estorninos-na',
    emoji: '🐦',
    name: 'Estorninos · Norteamérica',
    shortName: 'Estorninos',
    lugar: 'Central Park → continente',
    year0: 1890,
    yearEnd: 1980,
    // P0=60: Schieffelin liberó 60 aves en 1890 + 40 en 1891 (Cabe 1993).
    // Modelamos desde 1890 con cohorte inicial de 60.
    P0: 60,
    rDefault: 0.20,             // compromiso entre lit (0.13–0.18) y r calculada (~0.22)
    KDefault: 230_000_000,      // pico ~200M, margen para que el modelo no sature exacto en el dato
    HDefault: 0,
    tIntervDefault: 1970,
    color: '#14B8A6',
    ctx: 'Eugene Schieffelin liberó 60 estorninos en Central Park en 1890 (más 40 en 1891) según Cabe (1993). Hoy son ~200 millones, causan USD 800M anuales en daños agrícolas. Nunca hubo control masivo continental.',
    desenlace: 'Invasión total sin control',
    observed: [
      [1890, 60], [1900, 5000], [1920, 5_000_000], [1940, 50_000_000],
      [1950, 100_000_000], [1960, 150_000_000], [1980, 200_000_000],
    ],
  },
  {
    id: 'cabras-galapagos',
    emoji: '🐐',
    name: 'Cabras · Galápagos',
    shortName: 'Cabras',
    lugar: 'Islas Isabela, Santiago, Pinta',
    year0: 1970,
    yearEnd: 2010,
    // Pico real combinado Isabela norte + Santiago ≈ 150–180k (Carrión et al. 2011)
    P0: 10_000,
    rDefault: 0.10,             // compromiso entre lit Cruz 2005 (0.10–0.15) y r calculada (~0.094)
    KDefault: 175_000,          // pico combinado real ~150–180k según Carrión 2011
    HDefault: 30_000,           // promedio fase intensiva 2004–2006; pico de 56k en 2005
    tIntervDefault: 1997,
    color: '#84CC16',
    ctx: 'Las cabras llegaron en el s. XIX y explotaron en los 80s, alcanzando ~175 000 entre Isabela norte y Santiago (Carrión et al. 2011). El Proyecto Isabela (1997–2006) erradicó >140 000 cabras por USD 10.5M usando "cabras Judas" con GPS y caza aérea.',
    desenlace: 'ERRADICACIÓN EXITOSA',
    observed: [
      [1970, 10_000], [1980, 45_000], [1990, 110_000], [1995, 150_000],
      [1999, 130_000], [2002, 50_000], [2004, 8_000], [2006, 50],
    ],
  },
]

const VIEWS = [
  { id: 'problem',    label: '📖 El problema' },
  { id: 'population', label: 'Población P(t)' },
  { id: 'phase',      label: 'Plano fase dP/dt' },
  { id: 'residuals',  label: 'Residuales' },
  { id: 'window',     label: 'Ventana de control' },
  { id: 'biblio',     label: '📚 Bibliografía' },
]

const MODEL_COLORS = {
  exp:  'rgba(248, 113, 113, 0.9)',   // rojo — diverge
  log:  'rgba(96, 165, 250, 0.9)',    // azul — saturación
  logH: 'rgba(52, 211, 153, 0.9)',    // verde — control
}

const MODEL_NAMES = {
  exp:  'Exponencial (Malthus)',
  log:  'Logístico (Verhulst)',
  logH: 'Logístico con cosecha',
}

/* ──────────────────────── MOTOR MATEMÁTICO ──────────────────────── */

// Modelo 1 — Exponencial: dP/dt = rP  ⇒  P(t) = P₀·e^(rt)
const modelExp = (t, P0, r) => P0 * Math.exp(r * t)

// Modelo 2 — Logístico (Verhulst): solución analítica por separación de variables
//   P(t) = K / ( 1 + ((K - P₀)/P₀) · e^(−rt) )
const modelLog = (t, P0, r, K) => {
  if (P0 <= 0) return 0
  const A = (K - P0) / P0
  return K / (1 + A * Math.exp(-r * t))
}

// Modelo 3 — Logístico con cosecha constante H a partir de t_interv:
//   dP/dt = rP(1 − P/K) − H(t)
//   H(t) = 0 si t < t_interv, H si t ≥ t_interv
// No tiene solución cerrada cómoda ⇒ integración numérica (Runge-Kutta 4).
const modelLogH_RK4 = (P0, r, K, H, tInterv, t0, tMax, dt = 0.05) => {
  const f = (t, P) => {
    const hNow = t >= tInterv ? H : 0
    return r * P * (1 - P / K) - hNow
  }
  const out = []
  let t = t0, P = P0
  out.push({ t, P })
  const steps = Math.ceil((tMax - t0) / dt)
  for (let i = 0; i < steps; i++) {
    const k1 = f(t, P)
    const k2 = f(t + dt / 2, P + (dt / 2) * k1)
    const k3 = f(t + dt / 2, P + (dt / 2) * k2)
    const k4 = f(t + dt, P + dt * k3)
    P = P + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4)
    P = Math.max(0, P)
    t = t + dt
    out.push({ t, P })
  }
  return out
}

// Interpolación lineal para consultar P(t) en cualquier t dentro de la malla RK4
const interpAt = (grid, t) => {
  if (!grid.length) return 0
  if (t <= grid[0].t) return grid[0].P
  if (t >= grid[grid.length - 1].t) return grid[grid.length - 1].P
  // búsqueda binaria
  let lo = 0, hi = grid.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (grid[mid].t <= t) lo = mid; else hi = mid
  }
  const a = grid[lo], b = grid[hi]
  const u = (t - a.t) / (b.t - a.t)
  return a.P + u * (b.P - a.P)
}

// Linealización ln(P) vs t para estimar r por mínimos cuadrados
// (método clásico del currículo IB AA: tomar logaritmos a ambos lados)
const linearizeR = (obs) => {
  const pts = obs.filter(([, P]) => P > 0).map(([t, P]) => ({ x: t, y: Math.log(P) }))
  const n = pts.length
  if (n < 2) return { r: 0, lnP0: 0, R2: 0 }
  const sx = pts.reduce((s, p) => s + p.x, 0)
  const sy = pts.reduce((s, p) => s + p.y, 0)
  const sxx = pts.reduce((s, p) => s + p.x * p.x, 0)
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0)
  const r = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  const lnP0 = (sy - r * sx) / n
  const yMean = sy / n
  let ssTot = 0, ssRes = 0
  pts.forEach((p) => {
    const yHat = lnP0 + r * p.x
    ssTot += (p.y - yMean) ** 2
    ssRes += (p.y - yHat) ** 2
  })
  const R2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot
  return { r, lnP0, R2 }
}

// H_crítico: bifurcación silla-nodo de dP/dt = rP(1−P/K) − H
//   Máximo de g(P) = rP(1−P/K) ocurre en P* = K/2 → g_max = rK/4
//   Si H > rK/4, no hay estado estable positivo ⇒ P → 0 (erradicación garantizada).
const H_critico = (r, K) => (r * K) / 4

// Puntos fijos de la logística con cosecha cuando H < rK/4:
//   P_{±} = K/2 · (1 ± √(1 − 4H/(rK)))
//   P_+ (estable, capacidad reducida)   ·   P_− (inestable, umbral Allee)
const fixedPoints = (r, K, H) => {
  const discr = 1 - (4 * H) / (r * K)
  if (discr < 0) return { stable: null, unstable: null, extinction: true }
  const root = Math.sqrt(discr)
  return {
    stable:   (K / 2) * (1 + root),
    unstable: (K / 2) * (1 - root),
    extinction: false,
  }
}

/* Formato compacto para números grandes (para labels de ejes) */
const formatCompact = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k'
  if (abs >= 10 || n % 1 === 0) return String(Math.round(n))
  return n.toFixed(2)
}

/* Ticks en escala log10: devuelve potencias de 10 entre logMin y logMax */
const log10Ticks = (logMin, logMax) => {
  const lo = Math.floor(logMin)
  const hi = Math.ceil(logMax)
  const ticks = []
  for (let i = lo; i <= hi; i++) ticks.push(i)
  return ticks
}

const SAFE_LOG_FLOOR = 0.5 // evita log(0); P=1 → 0, P=10 → 1, etc.

/* ──────────────────────── COMPONENTE ──────────────────────── */

export const HipoGrowthLab = () => {
  const [caseId, setCaseId] = useState('hipos-colombia')
  const [view, setView] = useState('problem')
  const [showExp, setShowExp] = useState(true)
  const [showLog, setShowLog] = useState(true)
  const [showLogH, setShowLogH] = useState(false)
  const [yScale, setYScale] = useState('linear') // 'linear' | 'log'

  const activeCase = CASES.find((c) => c.id === caseId)

  // Parámetros ajustables (con fallback al ajuste por linealización o default del caso)
  const [rUser, setRUser] = useState(null)
  const [KUser, setKUser] = useState(null)
  const [HUser, setHUser] = useState(null)
  const [tIntervUser, setTIntervUser] = useState(null)

  // Para Galápagos los datos incluyen el periodo de erradicación → linealización engaña.
  // Solo usamos los puntos PREVIOS al inicio del control real para estimar r.
  const preInterventionObs = useMemo(() => {
    const cutoff = activeCase.tIntervDefault - activeCase.year0
    const filtered = activeCase.observed.filter(([year]) => (year - activeCase.year0) <= cutoff && year - activeCase.year0 >= 0)
    return filtered.length >= 2 ? filtered : activeCase.observed
  }, [activeCase])

  const rFitted = useMemo(() => {
    const lin = linearizeR(preInterventionObs)
    return Number.isFinite(lin.r) && lin.r > 0 ? lin.r : activeCase.rDefault
  }, [preInterventionObs, activeCase.rDefault])

  const r = rUser ?? rFitted
  const K = KUser ?? activeCase.KDefault
  const H = HUser ?? activeCase.HDefault
  const tInterv = tIntervUser ?? activeCase.tIntervDefault

  const resetCase = (id) => {
    setCaseId(id)
    setRUser(null); setKUser(null); setHUser(null); setTIntervUser(null)
    setShowLogH(false)
  }

  /* ── Análisis del caso activo ── */
  const analysis = useMemo(() => {
    const c = activeCase
    // Dominio temporal: usamos tiempo relativo τ = año - year0 para estabilidad numérica
    const tSpan = c.yearEnd - c.year0
    const tauInterv = tInterv - c.year0

    // Observados → en coordenadas τ
    const obs = c.observed.map(([year, P]) => ({ t: year - c.year0, year, P }))
    const xs = obs.map((d) => d.t)
    const ys = obs.map((d) => d.P)

    // Funciones evaluables en τ (años desde P₀)
    const fnExp = (tau) => modelExp(tau, c.P0, r)
    const fnLog = (tau) => modelLog(tau, c.P0, r, K)

    // Resolver EDO con cosecha (malla fina)
    const gridH = modelLogH_RK4(c.P0, r, K, H, tauInterv, 0, tSpan, 0.1)
    const fnLogH = (tau) => interpAt(gridH, tau)

    // Métricas estadísticas vs observaciones
    const r2Exp = computeR2(xs, ys, fnExp)
    const r2Log = computeR2(xs, ys, fnLog)
    const r2LogH = computeR2(xs, ys, fnLogH)
    const aicExp = computeAIC(xs, ys, fnExp, 1)
    const aicLog = computeAIC(xs, ys, fnLog, 2)
    const aicLogH = computeAIC(xs, ys, fnLogH, 4)
    const resExp = computeResiduals(xs, ys, fnExp)
    const resLog = computeResiduals(xs, ys, fnLog)
    const resLogH = computeResiduals(xs, ys, fnLogH)
    const dwExp = durbinWatson(resExp)
    const dwLog = durbinWatson(resLog)
    const dwLogH = durbinWatson(resLogH)

    // Linealización ln(P) vs t (para tarjeta pedagógica)
    const lin = linearizeR(c.observed)

    // Dinámica: puntos fijos y H_crítico
    const Hc = H_critico(r, K)
    const fp = fixedPoints(r, K, H)

    // Tiempo hasta P = K/2 (sin intervención)
    const tauInflex = (1 / r) * Math.log((K - c.P0) / c.P0)
    const yearInflex = c.year0 + tauInflex

    // Población 2050 (sólo aplicable a casos actuales)
    const tau2050 = 2050 - c.year0
    const P2050_exp = tau2050 > 0 && tau2050 < tSpan * 2 ? fnExp(tau2050) : null
    const P2050_log = tau2050 > 0 && tau2050 < tSpan * 2 ? modelLog(tau2050, c.P0, r, K) : null

    return {
      c, tSpan, obs, xs, ys,
      fnExp, fnLog, fnLogH, gridH,
      stats: {
        r2: [r2Exp, r2Log, r2LogH],
        aic: [aicExp, aicLog, aicLogH],
        dw: [dwExp, dwLog, dwLogH],
        residuals: [resExp, resLog, resLogH],
      },
      lin,
      Hc, fp,
      tauInflex, yearInflex,
      P2050_exp, P2050_log,
    }
  }, [activeCase, r, K, H, tInterv])

  /* ── Rangos de ejes ── */
  const obsMaxP = Math.max(...analysis.obs.map((d) => d.P))
  const obsMaxT = analysis.tSpan
  const yMaxPopulationLinear = Math.min(
    Math.max(obsMaxP * 1.35, K * 1.15),
    K * 1.4
  )

  // Rangos en escala log: potencias de 10 que cubran P₀ y K
  const logYMin = Math.floor(Math.log10(Math.max(activeCase.P0 * 0.5, 0.5)))
  const logYMax = Math.ceil(Math.log10(Math.max(K * 1.2, obsMaxP * 1.5)))

  const popAxis = useAxisRange(
    yScale === 'log'
      ? { xMin: 0, xMax: obsMaxT, yMin: logYMin, yMax: logYMax }
      : { xMin: 0, xMax: obsMaxT, yMin: 0, yMax: yMaxPopulationLinear }
  )

  // Transform: aplica log10 cuando la escala es log (con floor de seguridad)
  const toY = (v) => yScale === 'log' ? Math.log10(Math.max(v, SAFE_LOG_FLOOR)) : v

  // Plano fase: P en x, dP/dt en y
  const phaseMaxP = K * 1.1
  const phaseMaxDer = Math.max((r * K) / 4 * 1.3, 1)
  const phaseMinDer = Math.min(-H * 1.2, -phaseMaxDer * 0.3)
  const phaseAxis = useAxisRange({
    xMin: 0,
    xMax: phaseMaxP,
    yMin: phaseMinDer,
    yMax: phaseMaxDer,
  })

  const resYMaxBase = Math.max(
    ...analysis.stats.residuals[0].map((v) => Math.abs(v || 0)),
    ...analysis.stats.residuals[1].map((v) => Math.abs(v || 0)),
    1
  )
  const residAxis = useAxisRange({
    xMin: 0,
    xMax: obsMaxT,
    yMin: -resYMaxBase * 1.1,
    yMax: resYMaxBase * 1.1,
  })

  const windowAxis = useAxisRange({
    xMin: 0,
    xMax: obsMaxT,
    yMin: 0,
    yMax: analysis.Hc * 1.5,
  })

  /* ── Puntos sampleados (aplicando transformación log si corresponde) ── */
  const nSamples = 220
  const curvePopExp = sampleRange(0, obsMaxT, nSamples, (t) => toY(analysis.fnExp(t)))
  const curvePopLog = sampleRange(0, obsMaxT, nSamples, (t) => toY(analysis.fnLog(t)))
  const curvePopLogH = sampleRange(0, obsMaxT, nSamples, (t) => toY(analysis.fnLogH(t)))

  // Plano fase: tomar la curva con cosecha "actual" para dP/dt vs P
  const phaseCurve = Array.from({ length: 120 }, (_, i) => {
    const P = (i / 119) * phaseMaxP
    const dP = r * P * (1 - P / K) - H
    return { x: P, y: dP }
  })
  // Plano fase: curva sin cosecha (logística pura)
  const phaseCurveLog = Array.from({ length: 120 }, (_, i) => {
    const P = (i / 119) * phaseMaxP
    return { x: P, y: r * P * (1 - P / K) }
  })

  // Ventana de control: H_crítico teórico vs H del usuario (simple: rK/4 constante ahora,
  // pero si el estudiante cambia r o K en tiempo real, la curva se mueve).
  // Para mostrar "cómo se cierra la ventana" según cuándo se interviene:
  //   Si interviene en tau_i, la población está en P(tau_i) = logística pura.
  //   El H_min necesario para revertir desde ese punto = r·P·(1 − P/K) (pendiente en ese punto).
  const windowCurve = sampleRange(0, obsMaxT, nSamples, (tau) => {
    const P = modelLog(tau, activeCase.P0, r, K)
    return r * P * (1 - P / K)
  })

  /* ── Export CSV completo ── */
  const handleDownload = () => {
    const header = [
      'año', 'τ=año−t₀', 'P_observado',
      'P_exponencial', 'P_logístico', 'P_logístico+H',
      'res_exp', 'res_log', 'res_logH',
    ]
    const rows = analysis.obs.map((d, i) => [
      d.year,
      d.t,
      d.P.toFixed(0),
      analysis.fnExp(d.t).toFixed(1),
      analysis.fnLog(d.t).toFixed(1),
      analysis.fnLogH(d.t).toFixed(1),
      analysis.stats.residuals[0][i]?.toFixed(2) ?? '',
      analysis.stats.residuals[1][i]?.toFixed(2) ?? '',
      analysis.stats.residuals[2][i]?.toFixed(2) ?? '',
    ])
    // Resumen de modelos al final
    rows.push([])
    rows.push(['RESUMEN ESTADÍSTICO', '', '', 'Exp', 'Logístico', 'Logístico+H'])
    rows.push(['R²', '', '',
      analysis.stats.r2[0].toFixed(4),
      analysis.stats.r2[1].toFixed(4),
      analysis.stats.r2[2].toFixed(4),
    ])
    rows.push(['AIC', '', '',
      analysis.stats.aic[0].toFixed(2),
      analysis.stats.aic[1].toFixed(2),
      analysis.stats.aic[2].toFixed(2),
    ])
    rows.push(['Durbin-Watson', '', '',
      analysis.stats.dw[0].toFixed(3),
      analysis.stats.dw[1].toFixed(3),
      analysis.stats.dw[2].toFixed(3),
    ])
    rows.push([])
    rows.push(['ANÁLISIS DE ESTABILIDAD'])
    rows.push(['r (estimado linealización)', analysis.lin.r.toFixed(4)])
    rows.push(['R² linealización ln(P) vs t', analysis.lin.R2.toFixed(4)])
    rows.push(['H_crítico = rK/4', analysis.Hc.toFixed(1)])
    rows.push(['P_estable (si H < Hc)', analysis.fp.stable?.toFixed(1) ?? 'erradicación'])
    rows.push(['P_umbral (Allee)', analysis.fp.unstable?.toFixed(1) ?? '—'])
    downloadCsv([header, ...rows], `invasion-${activeCase.id}.csv`)
  }

  /* ══════════════════════════════════════════════════════════════════
   * RENDER
   * ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── Selector de caso (siempre visible) ── */}
      <LabCard title="Cinco invasiones biológicas">
        <p className="text-xs text-ink/40 mb-3 mt-1">
          El mismo modelo matemático — distinto desenlace. ¿Qué determina el final?
        </p>
        <div className="flex flex-wrap gap-2">
          {CASES.map((c) => (
            <button
              key={c.id}
              onClick={() => resetCase(c.id)}
              className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all flex items-center gap-2 ${
                caseId === c.id
                  ? 'text-white shadow-md scale-105'
                  : 'border border-ink/12 bg-white text-ink/55 hover:bg-ink/5'
              }`}
              style={caseId === c.id ? { backgroundColor: c.color } : undefined}
            >
              <span className="text-base">{c.emoji}</span>
              <span>{c.shortName}</span>
            </button>
          ))}
        </div>
      </LabCard>

      {/* ── Vista toggle ── */}
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => { setView(v.id) }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              view === v.id ? 'bg-ink text-paper' : 'border border-ink/12 bg-white text-ink'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ VISTA: EL PROBLEMA ══════════════════ */}
      {view === 'problem' && (
        <div className="space-y-4">
          <LabCard dark title="El problema: los hipopótamos de Escobar">
            <div className="mt-3 space-y-4 text-sm leading-relaxed text-paper/85">
              <p>
                En 1981, el narcotraficante <strong className="text-paper">Pablo Escobar</strong> hizo traer ilegalmente
                desde Estados Unidos <strong className="text-paper">4 hipopótamos</strong> (un macho y tres hembras)
                a su Hacienda Nápoles en <strong className="text-paper">Puerto Triunfo, Antioquia</strong>, como parte
                de un zoológico privado que incluía jirafas, elefantes y rinocerontes.
              </p>
              <p>
                Tras la muerte de Escobar en 1993 y el abandono de la hacienda, los otros animales fueron trasladados
                o murieron. Los hipopótamos, en cambio, se escaparon al <strong className="text-paper">río Magdalena</strong> y
                encontraron allí su hábitat ideal: abundante vegetación, agua templada, ningún depredador natural
                (en África, los leones y cocodrilos regulan la población) y una tasa reproductiva del{' '}
                <strong className="text-paper">~10 % anual</strong> según censos oficiales.
              </p>
              <p>
                En <strong className="text-paper">2024</strong> el Ministerio de Ambiente y el Instituto Humboldt
                estimaron <strong className="text-paper">180–215 individuos</strong> dispersos en más de
                43 000 km² de la cuenca hídrica, desde Puerto Triunfo hasta Barrancabermeja.
                Shurin y colegas (Nature, 2023) proyectaron que, de no mediar intervención,
                superarán <strong className="text-paper">1 000 hipos para 2050</strong>.
              </p>
              <p className="pt-2 border-t border-paper/15">
                <strong className="text-paper">¿Por qué es un problema?</strong> Los hipopótamos (1) desplazan a la fauna nativa —
                manatíes, chigüiros, nutrias —, (2) contaminan el agua con sus heces (eutrofización: proliferan
                algas y muere el oxígeno del río), (3) atacan a pescadores y ganado, y (4) alteran la morfología
                de los cauces. Colombia los declaró <strong className="text-paper">especie invasora</strong> en 2022.
              </p>
              <p>
                <strong className="text-paper">¿Por qué es difícil actuar?</strong> Hay tres posturas enfrentadas:
                la biológica (sacrificio o esterilización masiva), la animalista (derechos del animal individual,
                no del "problema ecológico") y la económica (el costo proyectado es de{' '}
                <strong className="text-paper">USD 1–2 millones</strong> sólo para frenar el crecimiento).
                Mientras tanto, la ventana de control se cierra <em>exponencialmente</em>.
              </p>
            </div>
          </LabCard>

          <LabCard title="¿Por qué comparar con otras invasiones?">
            <div className="mt-3 space-y-3 text-sm text-ink/70 leading-relaxed">
              <p>
                Colombia no es el primer país que enfrenta esto. La literatura biológica documenta decenas de
                invasiones con un patrón matemático común: unos pocos individuos + hábitat apto + sin depredadores
                ⇒ crecimiento exponencial, luego logístico al saturar el recurso. La diferencia final no es la
                matemática sino <strong>cuándo se actúa</strong> y <strong>con qué intensidad</strong>.
              </p>
              <p>Al lado del caso colombiano, esta simulación trae cuatro invasiones históricas de las que sí conocemos el desenlace:</p>
              <ul className="space-y-2 pl-1">
                {CASES.filter((c) => c.id !== 'hipos-colombia').map((c) => (
                  <li key={c.id} className="flex items-start gap-3 rounded-xl bg-ink/[0.03] p-3">
                    <span className="text-lg leading-none mt-0.5">{c.emoji}</span>
                    <div>
                      <p className="font-semibold text-ink">{c.name} · <span className="font-normal text-ink/55">{c.year0}–{c.yearEnd}</span></p>
                      <p className="text-xs text-ink/55 mt-0.5">{c.ctx}</p>
                      <p className="text-xs font-semibold mt-1" style={{ color: c.color }}>Desenlace: {c.desenlace}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="pt-2 text-ink/60">
                Al cambiar de caso con los botones de arriba, <strong>los mismos tres modelos</strong> se ajustan a cada
                conjunto de datos. Compara parámetros, residuales y umbrales de control para construir tu hipótesis sobre
                qué debería hacer Colombia ahora.
              </p>
            </div>
          </LabCard>

          <LabCard title="Cómo funcionan los tres modelos">
            <div className="mt-3 space-y-4 text-sm text-ink/75 leading-relaxed">
              <p className="text-ink/65">
                Imagina un hábitat donde una especie invasora se reproduce sin depredadores. Toda la dinámica de la
                simulación se reduce a tres parámetros y un umbral matemático.
              </p>

              <div className="rounded-xl border border-ink/10 p-4 space-y-2" style={{ borderLeftWidth: 4, borderLeftColor: MODEL_COLORS.exp }}>
                <p className="font-semibold text-ink">r — tasa intrínseca de crecimiento (por año)</p>
                <p>
                  Qué tan rápido se reproduce la especie cuando no hay límite. Si <strong>r = 0.10</strong>, la
                  población crece 10 % cada año: 100 individuos hoy → 110 mañana, 1 000 → 1 100. La regla es la misma,
                  pero el efecto parece chico al principio (10 → 11) y enorme cuando hay muchos (10 000 → 11 000).
                </p>
                <p className="text-ink/55 italic">
                  Esto es el modelo <strong>Exponencial</strong> (rojo): predice un crecimiento que se dispara
                  como cohete. Bueno para la fase inicial, absurdo a largo plazo (un cohete no se detiene jamás).
                </p>
              </div>

              <div className="rounded-xl border border-ink/10 p-4 space-y-2" style={{ borderLeftWidth: 4, borderLeftColor: MODEL_COLORS.log }}>
                <p className="font-semibold text-ink">K — capacidad de carga del hábitat</p>
                <p>
                  El máximo de individuos que el ecosistema puede sostener (alimento, agua, espacio, sitios de
                  reproducción). Cuando la población se acerca a K, los individuos no se mueren de golpe — pero
                  dejan de reproducirse tanto porque están escasos de recursos. La curva se aplana en forma de S.
                </p>
                <p className="text-ink/55 italic">
                  Esto es el modelo <strong>Logístico</strong> (azul): incorpora el techo K. Describe la trayectoria
                  natural completa hasta la saturación.
                </p>
              </div>

              <div className="rounded-xl border border-ink/10 p-4 space-y-2" style={{ borderLeftWidth: 4, borderLeftColor: MODEL_COLORS.logH }}>
                <p className="font-semibold text-ink">H — cosecha o remoción humana (por año)</p>
                <p>
                  Cuántos individuos retiramos del sistema cada año: sacrificio, captura, esterilización (que reduce
                  la tasa efectiva de reproducción). Es el único parámetro que la <strong>política pública</strong>{' '}
                  controla. La biología te da r y K; el humano elige H.
                </p>
                <p className="text-ink/55 italic">
                  Esto es el modelo <strong>Logístico con cosecha</strong> (verde): es el único que captura la
                  intervención. Como no tiene solución cerrada, se integra numéricamente (Runge-Kutta 4).
                </p>
              </div>

              <div className="rounded-xl bg-ink/[0.04] border border-ink/12 p-4 space-y-2">
                <p className="font-semibold text-ink">El número clave: H_crítico = rK/4</p>
                <p>
                  Aquí está la matemática elegante que el estudiante debe identificar para Criterio D. Dos fuerzas
                  chocan en el sistema:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-ink/70">
                  <li>La biología empuja arriba: la reproducción rP(1−P/K) tiene su máximo en P = K/2, y vale exactamente <strong>rK/4</strong> ahí.</li>
                  <li>Los humanos empujan abajo: removemos H individuos por año.</li>
                </ul>
                <p>
                  Si <strong>H &gt; rK/4</strong> → ninguna población positiva puede sostenerse → erradicación
                  matemáticamente garantizada (caso Galápagos).
                </p>
                <p>
                  Si <strong>H &lt; rK/4</strong> → hay un equilibrio estable P₊ (residual) y un umbral inestable
                  P₋ (efecto Allee). La cosecha solo reduce la plaga; nunca la elimina (caso Australia con
                  mixomatosis tras la resistencia evolutiva).
                </p>
                <p className="text-ink/55 text-xs pt-1 border-t border-ink/10 mt-3">
                  En la jerga: cruzar el umbral H = rK/4 produce una <em>bifurcación silla-nodo</em> — un cambio
                  cualitativo en la dinámica. Esto, derivado y discutido, vale puntos altos en Criterio B.
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <p className="font-semibold text-ink mb-2">La moraleja que une los 5 casos</p>
                <ul className="space-y-1.5 text-ink/70">
                  <li><strong>Si encuentras una invasión TEMPRANO</strong> (hipos hoy, P ≈ 215, K ≈ 1 200) — basta con sacar 30 individuos al año. H_crítico es manejable.</li>
                  <li><strong>Si esperas a que llene el hábitat</strong> (Australia, ya en 600 M conejos) — necesitas un virus, ningún cazador alcanza H_crítico.</li>
                  <li><strong>Si esperas demasiado</strong> (estorninos en Norteamérica, P = K) — ya no hay nada matemáticamente factible.</li>
                </ul>
              </div>
            </div>
          </LabCard>
        </div>
      )}

      {/* ══════════════════ CONTEXTO DEL CASO (para todas las vistas excepto problem/biblio) ══════════════════ */}
      {view !== 'problem' && view !== 'biblio' && (
        <>
          <div className="rounded-2xl border border-ink/8 p-4" style={{ borderLeftWidth: 4, borderLeftColor: activeCase.color }}>
            <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">
              {activeCase.emoji} {activeCase.name} — {activeCase.lugar}
            </p>
            <p className="text-sm text-ink/65 mt-1 leading-relaxed">{activeCase.ctx}</p>
            <p className="text-xs text-ink/40 mt-2 font-mono">
              t₀ = {activeCase.year0} · P₀ = {format(activeCase.P0)} · r = {r.toFixed(3)}/año · K = {format(K)} · H_crítico = {format(analysis.Hc)}
            </p>
          </div>

          {/* Controles */}
          <LabCard title="Parámetros del modelo">
            <div className="mt-3 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <SliderField
                id="r"
                label="Tasa r"
                value={r}
                min={0.02}
                max={0.30}
                step={0.005}
                suffix="/año"
                onChange={setRUser}
              />
              <SliderField
                id="K"
                label="Capacidad K"
                value={K}
                min={Math.max(activeCase.P0 * 2, 10)}
                max={activeCase.KDefault * 2}
                step={Math.max(1, Math.round(activeCase.KDefault / 200))}
                suffix=""
                onChange={setKUser}
              />
              <SliderField
                id="H"
                label="Cosecha H"
                value={H}
                min={0}
                max={Math.round(analysis.Hc * 2)}
                step={Math.max(1, Math.round(analysis.Hc / 100))}
                suffix="/año"
                onChange={setHUser}
              />
              <SliderField
                id="tInt"
                label="Año intervención"
                value={tInterv}
                min={activeCase.year0}
                max={activeCase.yearEnd}
                step={1}
                natural
                onChange={setTIntervUser}
              />
            </div>
            {/* Estado de estabilidad según H vs H_crítico */}
            <div className="mt-4 rounded-xl bg-ink/[0.04] p-3">
              {H >= analysis.Hc ? (
                <p className="text-sm text-ink/70">
                  <span className="font-bold text-emerald-600">✓ H ≥ H_crítico</span> — la bifurcación silla-nodo
                  colapsa ambos puntos fijos. <strong>Erradicación garantizada</strong> si el control arranca antes
                  de que P cruce el umbral Allee.
                </p>
              ) : analysis.fp.stable ? (
                <p className="text-sm text-ink/70">
                  <span className="font-bold" style={{ color: activeCase.color }}>H &lt; H_crítico</span> — dos puntos
                  fijos: <strong>P_estable ≈ {format(analysis.fp.stable)}</strong> (población residual) y{' '}
                  <strong>P_umbral ≈ {format(analysis.fp.unstable)}</strong> (efecto Allee).
                  La cosecha reduce la plaga pero no la elimina.
                </p>
              ) : null}
            </div>
          </LabCard>

          {/* Toggles de modelos */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-ink/35 font-semibold uppercase tracking-wide">Modelos activos:</span>
            {[
              { on: showExp, set: setShowExp, label: 'Exponencial', key: 'exp' },
              { on: showLog, set: setShowLog, label: 'Logístico', key: 'log' },
              { on: showLogH, set: setShowLogH, label: 'Logístico + H', key: 'logH' },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => m.set(!m.on)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-all border ${
                  m.on
                    ? 'text-white shadow-md scale-105 border-transparent'
                    : 'border-ink/12 bg-white text-ink/40 hover:bg-ink/5'
                }`}
                style={m.on ? { backgroundColor: MODEL_COLORS[m.key] } : undefined}
              >
                {m.on ? '✓ ' : '+ '}{m.label}
              </button>
            ))}
          </div>

          {/* Recordatorio compacto de los parámetros */}
          <details className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 group">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink/55 hover:text-ink list-none flex items-center gap-2">
              <span className="transition-transform group-open:rotate-90">▶</span>
              💡 ¿Qué significa cada parámetro? (recordatorio rápido)
            </summary>
            <div className="mt-3 grid gap-3 text-xs text-ink/65 leading-relaxed sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg p-2.5" style={{ borderLeft: `3px solid ${MODEL_COLORS.exp}` }}>
                <p className="font-semibold text-ink mb-0.5">r — tasa intrínseca</p>
                <p>Qué tan rápido se reproduce sin límite. r = 0.10 ⇒ +10 % al año. Domina el modelo exponencial.</p>
              </div>
              <div className="rounded-lg p-2.5" style={{ borderLeft: `3px solid ${MODEL_COLORS.log}` }}>
                <p className="font-semibold text-ink mb-0.5">K — capacidad de carga</p>
                <p>El máximo que el ecosistema sostiene. La curva logística se aplana cerca de K (forma de S).</p>
              </div>
              <div className="rounded-lg p-2.5" style={{ borderLeft: `3px solid ${MODEL_COLORS.logH}` }}>
                <p className="font-semibold text-ink mb-0.5">H — cosecha humana</p>
                <p>Individuos removidos por año (sacrificio, captura, esterilización). Lo único que la política controla.</p>
              </div>
              <div className="rounded-lg p-2.5 bg-ink/[0.05]">
                <p className="font-semibold text-ink mb-0.5">H_crítico = rK/4</p>
                <p>Umbral mágico: si H &gt; rK/4 ⇒ erradicación. Si H &lt; rK/4 ⇒ solo se reduce a un nivel residual.</p>
              </div>
            </div>
          </details>
        </>
      )}

      {/* ══════════════════ VISTA: POBLACIÓN P(t) ══════════════════ */}
      {view === 'population' && (
        <LabCard dark title={`Población P(t) — ${activeCase.name}`}>
          {/* Toggle escala y */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-paper/50">Escala Y:</span>
            <div className="inline-flex rounded-full border border-white/15 overflow-hidden">
              <button
                onClick={() => setYScale('linear')}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  yScale === 'linear' ? 'bg-paper text-ink' : 'text-paper/60 hover:text-paper'
                }`}
              >
                Lineal
              </button>
              <button
                onClick={() => setYScale('log')}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  yScale === 'log' ? 'bg-paper text-ink' : 'text-paper/60 hover:text-paper'
                }`}
              >
                Log (base 10)
              </button>
            </div>
            {yScale === 'log' && (
              <span className="text-[0.68rem] text-paper/50 italic">
                Exponencial se ve como recta · pendiente = r
              </span>
            )}
          </div>
          <div className="mt-4">
            <CartesianFrame
              width={640}
              height={360}
              xMin={popAxis.xMin}
              xMax={popAxis.xMax}
              yMin={popAxis.yMin}
              yMax={popAxis.yMax}
              xTicks={generateTicks(popAxis.xMin, popAxis.xMax)}
              yTicks={yScale === 'log'
                ? log10Ticks(popAxis.yMin, popAxis.yMax)
                : generateTicks(popAxis.yMin, popAxis.yMax)}
              xTickFormatter={(v) => String(Math.round(activeCase.year0 + v))}
              yTickFormatter={(v) => yScale === 'log' ? formatCompact(Math.pow(10, v)) : formatCompact(v)}
              xLabel="Año"
              yLabel={yScale === 'log' ? 'Población P (log₁₀)' : 'Población P'}
              dark
              className="w-full h-auto overflow-visible rounded-[1.3rem]"
            >
              {({ scaleX, scaleY }) => (
                <>
                  {/* Línea K (capacidad de carga) */}
                  <line
                    x1={scaleX(popAxis.xMin)} y1={scaleY(toY(K))}
                    x2={scaleX(popAxis.xMax)} y2={scaleY(toY(K))}
                    stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="6 4"
                  />
                  <text x={scaleX(popAxis.xMax) - 56} y={scaleY(toY(K)) - 6} fill="rgba(255,255,255,0.6)" fontSize="10">
                    K = {formatCompact(K)}
                  </text>

                  {/* Línea intervención */}
                  <line
                    x1={scaleX(tInterv - activeCase.year0)} y1={scaleY(popAxis.yMin)}
                    x2={scaleX(tInterv - activeCase.year0)} y2={scaleY(popAxis.yMax)}
                    stroke="rgba(134, 239, 172, 0.4)" strokeWidth="1" strokeDasharray="3 3"
                  />
                  <text x={scaleX(tInterv - activeCase.year0) + 4} y={scaleY(popAxis.yMax) + 12} fill="rgba(134, 239, 172, 0.7)" fontSize="9">
                    Intervención {tInterv}
                  </text>

                  {/* Curvas: en log ya vienen transformadas; en lineal son crudas.
                      Dejamos que SVG recorte lo que salga del frame. */}
                  {showExp && (
                    <path
                      d={linePath(curvePopExp, scaleX, scaleY)}
                      fill="none" stroke={MODEL_COLORS.exp} strokeWidth="2.5" strokeDasharray="5 3"
                    />
                  )}
                  {showLog && (
                    <path
                      d={linePath(curvePopLog, scaleX, scaleY)}
                      fill="none" stroke={MODEL_COLORS.log} strokeWidth="2.5"
                    />
                  )}
                  {showLogH && (
                    <path
                      d={linePath(curvePopLogH, scaleX, scaleY)}
                      fill="none" stroke={MODEL_COLORS.logH} strokeWidth="2" strokeDasharray="2 3"
                    />
                  )}

                  {/* Datos observados (también transformados) */}
                  {analysis.obs.map((d, i) => (
                    <g key={`obs-${i}`}>
                      <circle cx={scaleX(d.t)} cy={scaleY(toY(d.P))} r={4} fill="white" opacity="0.9" />
                      <circle cx={scaleX(d.t)} cy={scaleY(toY(d.P))} r={2} fill={activeCase.color} />
                    </g>
                  ))}
                </>
              )}
            </CartesianFrame>
          </div>
          <AxisRangePanel {...popAxis} />
          <div className="mt-3">
            <LiveFormula
              label="Modelo logístico evaluado"
              general={String.raw`P(t) = \frac{K}{1 + \frac{K - P_0}{P_0} \cdot e^{-rt}}`}
              evaluated={`P(t) = \\frac{${format(K)}}{1 + \\frac{${format(K - activeCase.P0)}}{${format(activeCase.P0)}} \\cdot e^{-${r.toFixed(3)}\\,t}}`}
              raw
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/60">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-white" /> Observados
            </span>
            {showExp && (
              <span className="flex items-center gap-1.5">
                <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={MODEL_COLORS.exp} strokeWidth="2" strokeDasharray="4 3" /></svg>
                Exp (diverge)
              </span>
            )}
            {showLog && (
              <span className="flex items-center gap-1.5">
                <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={MODEL_COLORS.log} strokeWidth="2.5" /></svg>
                Logístico
              </span>
            )}
            {showLogH && (
              <span className="flex items-center gap-1.5">
                <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={MODEL_COLORS.logH} strokeWidth="2.5" /></svg>
                Logístico + H
              </span>
            )}
          </div>
        </LabCard>
      )}

      {/* ══════════════════ VISTA: PLANO FASE dP/dt vs P ══════════════════ */}
      {view === 'phase' && (
        <LabCard dark title="Plano fase — dP/dt vs P">
          <p className="text-[0.72rem] mt-2 text-paper/50 leading-relaxed">
            Eje x: población P · Eje y: rapidez de cambio dP/dt. Los ceros de la curva son los{' '}
            <strong>puntos fijos</strong>. Si H &gt; rK/4 = {format(analysis.Hc)}, la curva no toca el cero y P → 0.
          </p>
          <div className="mt-4">
            <CartesianFrame
              width={640}
              height={320}
              xMin={phaseAxis.xMin}
              xMax={phaseAxis.xMax}
              yMin={phaseAxis.yMin}
              yMax={phaseAxis.yMax}
              xTicks={generateTicks(phaseAxis.xMin, phaseAxis.xMax)}
              yTicks={generateTicks(phaseAxis.yMin, phaseAxis.yMax)}
              xTickFormatter={(v) => formatCompact(v)}
              yTickFormatter={(v) => formatCompact(v)}
              xLabel="P"
              yLabel="dP/dt"
              dark
              className="w-full h-auto overflow-visible rounded-[1.3rem]"
            >
              {({ scaleX, scaleY }) => (
                <>
                  {/* Eje y=0 */}
                  <line
                    x1={scaleX(phaseAxis.xMin)} y1={scaleY(0)}
                    x2={scaleX(phaseAxis.xMax)} y2={scaleY(0)}
                    stroke="rgba(255,255,255,0.3)" strokeWidth="1"
                  />
                  {/* Pico teórico rK/4 */}
                  <line
                    x1={scaleX(phaseAxis.xMin)} y1={scaleY(analysis.Hc)}
                    x2={scaleX(phaseAxis.xMax)} y2={scaleY(analysis.Hc)}
                    stroke="rgba(251, 146, 60, 0.4)" strokeWidth="1" strokeDasharray="4 4"
                  />
                  <text x={scaleX(phaseAxis.xMax) - 60} y={scaleY(analysis.Hc) - 4} fill="rgba(251, 146, 60, 0.8)" fontSize="9">
                    rK/4 = {format(analysis.Hc)}
                  </text>

                  {/* Logística pura */}
                  {showLog && (
                    <path
                      d={linePath(phaseCurveLog, scaleX, scaleY)}
                      fill="none" stroke={MODEL_COLORS.log} strokeWidth="2" strokeDasharray="5 3"
                    />
                  )}
                  {/* Logística con cosecha */}
                  {showLogH && (
                    <path
                      d={linePath(phaseCurve, scaleX, scaleY)}
                      fill="none" stroke={MODEL_COLORS.logH} strokeWidth="2.5"
                    />
                  )}

                  {/* Puntos fijos */}
                  {analysis.fp.stable !== null && showLogH && (
                    <g>
                      <circle cx={scaleX(analysis.fp.stable)} cy={scaleY(0)} r={5} fill={MODEL_COLORS.logH} />
                      <text x={scaleX(analysis.fp.stable)} y={scaleY(0) + 18} textAnchor="middle" fill={MODEL_COLORS.logH} fontSize="9">
                        P_+ (estable)
                      </text>
                    </g>
                  )}
                  {analysis.fp.unstable !== null && showLogH && (
                    <g>
                      <circle cx={scaleX(analysis.fp.unstable)} cy={scaleY(0)} r={5} fill="rgba(248, 113, 113, 0.9)" stroke="white" strokeWidth="1.5" />
                      <text x={scaleX(analysis.fp.unstable)} y={scaleY(0) - 10} textAnchor="middle" fill="rgba(248, 113, 113, 0.9)" fontSize="9">
                        P_− (Allee)
                      </text>
                    </g>
                  )}

                  {/* K (punto fijo logística pura) */}
                  {showLog && (
                    <circle cx={scaleX(K)} cy={scaleY(0)} r={4} fill={MODEL_COLORS.log} opacity="0.8" />
                  )}
                </>
              )}
            </CartesianFrame>
          </div>
          <AxisRangePanel {...phaseAxis} />
        </LabCard>
      )}

      {/* ══════════════════ VISTA: RESIDUALES ══════════════════ */}
      {view === 'residuals' && (
        <LabCard dark title="Residuales: P_observado − P_modelo">
          <p className="text-[0.72rem] mt-2 text-paper/50 leading-relaxed">
            Si los residuales oscilan alrededor de cero <em>sin patrón</em>, el modelo captura la dinámica.
            Patrones sistemáticos (curva, tendencia) indican limitación estructural del modelo.
          </p>
          <div className="mt-4">
            <CartesianFrame
              width={640}
              height={280}
              xMin={residAxis.xMin}
              xMax={residAxis.xMax}
              yMin={residAxis.yMin}
              yMax={residAxis.yMax}
              xTicks={generateTicks(residAxis.xMin, residAxis.xMax)}
              yTicks={generateTicks(residAxis.yMin, residAxis.yMax)}
              xTickFormatter={(v) => String(Math.round(activeCase.year0 + v))}
              yTickFormatter={(v) => formatCompact(v)}
              xLabel="Año"
              yLabel="Residual"
              dark
              className="w-full h-auto overflow-visible rounded-[1.3rem]"
            >
              {({ scaleX, scaleY }) => (
                <>
                  <line
                    x1={scaleX(residAxis.xMin)} y1={scaleY(0)}
                    x2={scaleX(residAxis.xMax)} y2={scaleY(0)}
                    stroke="rgba(255,255,255,0.3)" strokeWidth="1"
                  />
                  {/* Exp */}
                  {showExp && analysis.obs.map((d, i) =>
                    analysis.stats.residuals[0][i] !== undefined && (
                      <circle
                        key={`r-exp-${i}`}
                        cx={scaleX(d.t)}
                        cy={scaleY(analysis.stats.residuals[0][i])}
                        r={4.5} fill={MODEL_COLORS.exp} opacity="0.85"
                      />
                    )
                  )}
                  {/* Log */}
                  {showLog && analysis.obs.map((d, i) =>
                    analysis.stats.residuals[1][i] !== undefined && (
                      <rect
                        key={`r-log-${i}`}
                        x={scaleX(d.t) - 3.5}
                        y={scaleY(Math.max(0, analysis.stats.residuals[1][i]))}
                        width={7}
                        height={Math.abs(scaleY(0) - scaleY(analysis.stats.residuals[1][i]))}
                        fill={MODEL_COLORS.log} opacity="0.65" rx="1"
                      />
                    )
                  )}
                  {/* LogH */}
                  {showLogH && analysis.obs.map((d, i) =>
                    analysis.stats.residuals[2][i] !== undefined && (
                      <polygon
                        key={`r-logh-${i}`}
                        points={`${scaleX(d.t)},${scaleY(analysis.stats.residuals[2][i]) - 5} ${scaleX(d.t) - 4.5},${scaleY(analysis.stats.residuals[2][i]) + 3.5} ${scaleX(d.t) + 4.5},${scaleY(analysis.stats.residuals[2][i]) + 3.5}`}
                        fill={MODEL_COLORS.logH} opacity="0.8"
                      />
                    )
                  )}
                </>
              )}
            </CartesianFrame>
          </div>
          <AxisRangePanel {...residAxis} />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/60">
            {showExp && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: MODEL_COLORS.exp }} /> Exp
              </span>
            )}
            {showLog && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: MODEL_COLORS.log }} /> Logístico
              </span>
            )}
            {showLogH && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-transparent" style={{ borderBottomColor: MODEL_COLORS.logH }} /> Logístico+H
              </span>
            )}
          </div>
        </LabCard>
      )}

      {/* ══════════════════ VISTA: VENTANA DE CONTROL ══════════════════ */}
      {view === 'window' && (
        <LabCard dark title="Ventana de control: H mínimo para frenar el crecimiento">
          <p className="text-[0.72rem] mt-2 text-paper/50 leading-relaxed">
            Si se interviene en el año τ, la cosecha mínima que <em>justo</em> detiene el crecimiento es
            <strong> H_min(τ) = rP(τ)(1 − P(τ)/K)</strong>. Esta curva muestra cómo se dispara con el tiempo y
            se cruza con la línea H_crítico = rK/4 justo en la inflexión (P = K/2).
          </p>
          <div className="mt-4">
            <CartesianFrame
              width={640}
              height={320}
              xMin={windowAxis.xMin}
              xMax={windowAxis.xMax}
              yMin={windowAxis.yMin}
              yMax={windowAxis.yMax}
              xTicks={generateTicks(windowAxis.xMin, windowAxis.xMax)}
              yTicks={generateTicks(windowAxis.yMin, windowAxis.yMax)}
              xTickFormatter={(v) => String(Math.round(activeCase.year0 + v))}
              yTickFormatter={(v) => formatCompact(v)}
              xLabel="Año de inicio del control"
              yLabel="H_min necesario"
              dark
              className="w-full h-auto overflow-visible rounded-[1.3rem]"
            >
              {({ scaleX, scaleY }) => (
                <>
                  {/* Línea H_crítico = rK/4 */}
                  <line
                    x1={scaleX(windowAxis.xMin)} y1={scaleY(analysis.Hc)}
                    x2={scaleX(windowAxis.xMax)} y2={scaleY(analysis.Hc)}
                    stroke="rgba(251, 146, 60, 0.6)" strokeWidth="1.5" strokeDasharray="6 4"
                  />
                  <text x={scaleX(windowAxis.xMax) - 110} y={scaleY(analysis.Hc) - 5} fill="rgba(251, 146, 60, 0.8)" fontSize="10">
                    H_crítico = rK/4
                  </text>

                  {/* Línea del año de inflexión */}
                  {analysis.yearInflex < activeCase.yearEnd && analysis.yearInflex > activeCase.year0 && (
                    <line
                      x1={scaleX(analysis.tauInflex)} y1={scaleY(windowAxis.yMin)}
                      x2={scaleX(analysis.tauInflex)} y2={scaleY(windowAxis.yMax)}
                      stroke="rgba(248, 113, 113, 0.5)" strokeWidth="1" strokeDasharray="2 3"
                    />
                  )}

                  {/* Curva H_min(τ) */}
                  <path
                    d={linePath(windowCurve, scaleX, scaleY)}
                    fill="none" stroke={MODEL_COLORS.logH} strokeWidth="2.5"
                  />

                  {/* H actual del usuario */}
                  <line
                    x1={scaleX(windowAxis.xMin)} y1={scaleY(H)}
                    x2={scaleX(windowAxis.xMax)} y2={scaleY(H)}
                    stroke="rgba(134, 239, 172, 0.7)" strokeWidth="1" strokeDasharray="3 3"
                  />
                  <text x={scaleX(windowAxis.xMin) + 6} y={scaleY(H) - 5} fill="rgba(134, 239, 172, 0.9)" fontSize="10">
                    H = {format(H)}
                  </text>
                </>
              )}
            </CartesianFrame>
          </div>
          <AxisRangePanel {...windowAxis} />
          <div className="mt-3 text-xs text-white/55 leading-relaxed">
            <strong className="text-white/80">Lectura:</strong> mientras la curva verde esté por debajo de tu H (línea verde punteada),
            la cosecha alcanza para revertir. Cuando la curva la cruza, el H elegido deja de ser suficiente —
            aunque en teoría rK/4 sigue siendo el umbral absoluto.
          </div>
        </LabCard>
      )}

      {/* ══════════════════ MODEL CARDS + MÉTRICAS (visible en vistas de análisis) ══════════════════ */}
      {(view === 'population' || view === 'phase' || view === 'residuals' || view === 'window') && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <ModelCard
              title="Modelo 1 — Exponencial (Malthus)"
              expression={'dP/dt = rP ⟹ P(t) = P₀·e^(rt)'}
              parameters={`P₀ = ${format(activeCase.P0)} individuos · r = ${r.toFixed(3)}/año`}
              conditions="Reproducción sin límites. Diverge; sólo válido cuando P ≪ K."
            />
            <ModelCard
              title="Modelo 2 — Logístico (Verhulst)"
              expression={'dP/dt = rP(1 − P/K)'}
              parameters={`r = ${r.toFixed(3)}/año · K = ${format(K)} indiv.`}
              conditions={'Saturación por recursos. P(t) = K / (1 + ((K−P₀)/P₀)·e^(−rt)).'}
            />
            <ModelCard
              title="Modelo 3 — Logístico con cosecha"
              expression={'dP/dt = rP(1 − P/K) − H(t)'}
              parameters={`H = ${format(H)}/año · H_crít = ${format(analysis.Hc)} (rK/4) · t_interv = ${tInterv}`}
              conditions="Integrado por Runge-Kutta 4. Bifurcación silla-nodo cuando H = rK/4."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <MetricCard
              label="H_crítico (rK/4)"
              value={format(analysis.Hc)}
              detail="cosecha mínima para erradicación garantizada"
            />
            <MetricCard
              label="r linealizado"
              value={analysis.lin.r.toFixed(4)}
              detail={`ln(P) vs t · R² = ${analysis.lin.R2.toFixed(3)}`}
            />
            <MetricCard
              label="Año P = K/2"
              value={analysis.yearInflex > activeCase.year0 && analysis.yearInflex < 3000
                ? String(Math.round(analysis.yearInflex))
                : '—'}
              detail="inflexión logística (sin control)"
            />
            <MetricCard
              label={caseId === 'hipos-colombia' ? 'P proyectada 2050' : 'P final (modelo logístico)'}
              value={
                caseId === 'hipos-colombia' && analysis.P2050_log
                  ? format(analysis.P2050_log)
                  : format(analysis.fnLog(analysis.tSpan))
              }
              detail={caseId === 'hipos-colombia' ? 'sin intervención' : `año ${activeCase.yearEnd}`}
            />
          </div>

          {/* Tabla comparativa de modelos */}
          <LabCard title={`Comparación estadística — ${activeCase.name}`}>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10">
                    <th className="pb-2 text-left text-[0.66rem] uppercase text-ink/44">Métrica</th>
                    <th className="pb-2 text-right text-[0.66rem] uppercase" style={{ color: MODEL_COLORS.exp }}>Exp</th>
                    <th className="pb-2 text-right text-[0.66rem] uppercase" style={{ color: MODEL_COLORS.log }}>Logístico</th>
                    <th className="pb-2 text-right text-[0.66rem] uppercase" style={{ color: MODEL_COLORS.logH }}>Logístico+H</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'R²',            vals: analysis.stats.r2,  fmt: (v) => v.toFixed(4), best: 'max' },
                    { label: 'AIC',           vals: analysis.stats.aic, fmt: (v) => v.toFixed(1), best: 'min' },
                    { label: 'Durbin-Watson', vals: analysis.stats.dw,  fmt: (v) => v.toFixed(3), best: 'near2' },
                  ].map((row) => {
                    const bestIdx =
                      row.best === 'max'
                        ? row.vals.indexOf(Math.max(...row.vals))
                        : row.best === 'min'
                          ? row.vals.indexOf(Math.min(...row.vals))
                          : row.vals.indexOf(row.vals.reduce((a, b) => (Math.abs(a - 2) < Math.abs(b - 2) ? a : b)))
                    return (
                      <tr key={row.label} className="border-b border-ink/6">
                        <td className="py-2.5 text-ink/55 font-medium">{row.label}</td>
                        {row.vals.map((v, i) => (
                          <td
                            key={i}
                            className={`py-2.5 text-right font-mono ${i === bestIdx ? 'text-ink font-bold' : 'text-ink/55'}`}
                          >
                            {row.fmt(v)}{i === bestIdx ? ' ★' : ''}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[0.72rem] text-ink/45">
              R² alto por sí solo no garantiza buen modelo. AIC equilibra ajuste vs complejidad (menor es mejor).
              Durbin-Watson cerca de 2 ⇒ residuales sin autocorrelación.
            </p>
          </LabCard>

          {/* Tabla de datos */}
          <LabCard title="Datos observados vs predicciones">
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10">
                    <th className="pb-2 text-left text-[0.66rem] uppercase text-ink/44">Año</th>
                    <th className="pb-2 text-right text-[0.66rem] uppercase text-ink/44">Observado</th>
                    <th className="pb-2 text-right text-[0.66rem] uppercase" style={{ color: MODEL_COLORS.exp }}>Exp</th>
                    <th className="pb-2 text-right text-[0.66rem] uppercase" style={{ color: MODEL_COLORS.log }}>Logístico</th>
                    <th className="pb-2 text-right text-[0.66rem] uppercase" style={{ color: MODEL_COLORS.logH }}>Logístico+H</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.obs.map((d) => (
                    <tr key={d.year} className="border-b border-ink/6">
                      <td className="py-2 text-ink/65 font-medium">{d.year}</td>
                      <td className="py-2 text-right font-mono text-ink/75">{format(d.P)}</td>
                      <td className="py-2 text-right font-mono text-ink/55">{format(analysis.fnExp(d.t))}</td>
                      <td className="py-2 text-right font-mono text-ink/55">{format(analysis.fnLog(d.t))}</td>
                      <td className="py-2 text-right font-mono text-ink/55">{format(analysis.fnLogH(d.t))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleDownload}
                className="rounded-full px-5 py-2.5 text-xs font-semibold bg-ink text-paper hover:bg-ink/90 transition-colors"
              >
                ⬇ Descargar CSV completo
              </button>
            </div>
          </LabCard>
        </>
      )}

      {/* ══════════════════ VISTA: BIBLIOGRAFÍA ══════════════════ */}
      {view === 'biblio' && (
        <div className="space-y-4">
          <LabCard title="Bibliografía para la monografía">
            <p className="text-xs text-ink/45 mt-1 mb-4">
              Referencias usadas para construir esta simulación. Formato Harvard adaptado — lístas para copiar al RPPF
              o apéndice. Todas las fuentes están verificadas y son citables académicamente.
            </p>

            <div className="space-y-5 text-sm">
              <section>
                <p className="text-[0.66rem] font-bold uppercase tracking-widest text-ink/40 mb-2">Caso central: hipopótamos en Colombia</p>
                <ul className="space-y-2 text-ink/70 leading-relaxed">
                  <li>
                    Shurin, J. B., Aranguren-Riaño, N., Duque Negro, D., Echeverri Lopez, D., Jones, N. T., Laverde-R., O.,
                    Neu, A. &amp; Pedroza Ramos, A. (2023). <em>Rapid population growth and high management costs have
                    created a narrow window for control of introduced hippos in Colombia</em>. Scientific Reports, 13,
                    6193. <a href="https://doi.org/10.1038/s41598-023-33028-y" className="underline text-ink/55">https://doi.org/10.1038/s41598-023-33028-y</a>
                  </li>
                  <li>
                    Castelblanco-Martínez, D. N., Moreno-Arias, R. A., Velasco, J. A., Moreno-Bejarano, L. M.,
                    Trujillo, F., Bermúdez-Romero, A. L. &amp; Lasso, C. A. (2021). <em>A hippo in the room: Predicting
                    the persistence and dispersion of an invasive mega-vertebrate in Colombia, South America</em>.
                    Biological Conservation, 253, 108923.
                  </li>
                  <li>
                    Ministerio de Ambiente y Desarrollo Sostenible de Colombia (2022). <em>Resolución 0346 de 2022 —
                    Declaración del hipopótamo (Hippopotamus amphibius) como especie exótica invasora</em>. Bogotá.
                  </li>
                  <li>
                    Instituto Humboldt (2024). <em>Plan Integral de Manejo de la Especie Invasora Hippopotamus amphibius
                    en Colombia</em>. Bogotá.
                  </li>
                </ul>
              </section>

              <section>
                <p className="text-[0.66rem] font-bold uppercase tracking-widest text-ink/40 mb-2">Casos comparativos (fuentes primarias)</p>
                <ul className="space-y-2 text-ink/70 leading-relaxed">
                  <li>
                    <strong className="text-ink/80">[Conejos]</strong> Rolls, E. C. (1969). <em>They All Ran Wild: The Story of Pests on the Land in Australia</em>.
                    Sydney: Angus &amp; Robertson. (Fuente del N₀ = 24 conejos liberados por Thomas Austin en 1859.)
                  </li>
                  <li>
                    <strong className="text-ink/80">[Conejos]</strong> Fenner, F. (1983). <em>Biological control, as exemplified by smallpox eradication
                    and myxomatosis</em>. Proceedings of the Royal Society B, 218, 259–285.
                    (Pico pre-mixomatosis ~500M y dinámica post-1950.)
                  </li>
                  <li>
                    <strong className="text-ink/80">[Conejos]</strong> Cooke, B. D. (2014). <em>Australia's war against rabbits: the story of rabbit haemorrhagic disease</em>.
                    CSIRO Publishing, Melbourne.
                  </li>
                  <li>
                    <strong className="text-ink/80">[Carpas]</strong> Freeze, M. &amp; Henderson, S. (1982). <em>Distribution and status of bighead carp
                    and silver carp in Arkansas</em>. North American Journal of Fisheries Management, 2, 197–200.
                    (Importación documentada de ~70 individuos a Arkansas.)
                  </li>
                  <li>
                    <strong className="text-ink/80">[Carpas]</strong> Tsehaye, I., Catalano, M., Sass, G., Glover, D. &amp; Roth, B. (2013).
                    <em> Prospects for fishery-induced collapse of invasive Asian carp in the Illinois River</em>.
                    Biological Invasions, 15, 2381–2399.
                  </li>
                  <li>
                    <strong className="text-ink/80">[Carpas]</strong> MacNamara, R., Glover, D., Garvey, J., Bouska, W. &amp; Irons, K. (2016).
                    <em> Bigheaded carps in the Illinois River: insights from population biology</em>.
                    North American Journal of Fisheries Management, 36, 1052–1064. (Biomasa por área, no censos absolutos.)
                  </li>
                  <li>
                    <strong className="text-ink/80">[Estorninos]</strong> Cabe, P. R. (1993). <em>European Starling (Sturnus vulgaris)</em>.
                    The Birds of North America, No. 48. Philadelphia: Academy of Natural Sciences.
                    (Schieffelin liberó 60 aves en 1890 + 40 en 1891.)
                  </li>
                  <li>
                    <strong className="text-ink/80">[Estorninos]</strong> Linz, G. M., Homan, H. J., Gaulker, S. M., Penry, L. B. &amp; Bleier, W. J. (2007).
                    <em> European starlings: a review of an invasive species with far-reaching impacts</em>.
                    Managing Vertebrate Invasive Species, USDA National Wildlife Research Center.
                  </li>
                  <li>
                    <strong className="text-ink/80">[Cabras]</strong> Cruz, F., Donlan, C. J., Campbell, K. &amp; Carrion, V. (2005).
                    <em> Conservation action in the Galápagos: feral pig (Sus scrofa) eradication from Santiago Island</em>.
                    Biological Conservation, 121, 473–478. (Tasas de crecimiento r ≈ 0.10–0.15 en cabras.)
                  </li>
                  <li>
                    <strong className="text-ink/80">[Cabras]</strong> Campbell, K., Donlan, C. J., Cruz, F. &amp; Carrion, V. (2004).
                    <em> Eradication of feral goats Capra hircus from Pinta Island, Galápagos, Ecuador</em>. Oryx, 38(3), 328–333.
                  </li>
                  <li>
                    <strong className="text-ink/80">[Cabras]</strong> Carrion, V., Donlan, C. J., Campbell, K. J., Lavoie, C. &amp; Cruz, F. (2011).
                    <em> Archipelago-wide island restoration in the Galápagos Islands: reducing costs of invasive
                    mammal eradication programs and reinvasion risk</em>. PLoS ONE, 6(5), e18835.
                    (Pico ~150–180k combinado Isabela+Santiago, H histórico.)
                  </li>
                </ul>
              </section>

              <section>
                <p className="text-[0.66rem] font-bold uppercase tracking-widest text-ink/40 mb-2">Fundamento matemático</p>
                <ul className="space-y-2 text-ink/70 leading-relaxed">
                  <li>
                    Verhulst, P. F. (1838). <em>Notice sur la loi que la population suit dans son accroissement</em>.
                    Correspondance Mathématique et Physique, 10, 113–121. (Texto fundacional del modelo logístico.)
                  </li>
                  <li>
                    Murray, J. D. (2002). <em>Mathematical Biology I: An Introduction</em> (3.ª ed.). Springer,
                    Interdisciplinary Applied Mathematics vol. 17.
                  </li>
                  <li>
                    Strogatz, S. H. (2015). <em>Nonlinear Dynamics and Chaos</em> (2.ª ed.). Westview Press.
                    Capítulo 3: Bifurcaciones — análisis silla-nodo de dP/dt = rP(1 − P/K) − H.
                  </li>
                  <li>
                    Brauer, F. &amp; Castillo-Chávez, C. (2012). <em>Mathematical Models in Population Biology and
                    Epidemiology</em> (2.ª ed.). Springer Texts in Applied Mathematics.
                  </li>
                  <li>
                    Clark, C. W. (2010). <em>Mathematical Bioeconomics: The Mathematics of Conservation</em> (3.ª ed.).
                    Wiley. Capítulos sobre cosecha constante y máxima cosecha sostenible.
                  </li>
                </ul>
              </section>

              <section>
                <p className="text-[0.66rem] font-bold uppercase tracking-widest text-ink/40 mb-2">Para la monografía (criterio B y D)</p>
                <ul className="space-y-2 text-ink/70 leading-relaxed">
                  <li>
                    Edwards, C. H. &amp; Penney, D. E. (2008). <em>Ecuaciones diferenciales y problemas con valores
                    en la frontera</em> (4.ª ed.). Pearson Educación. Sección 2.1 (modelo de crecimiento) y 2.2 (logístico).
                  </li>
                  <li>
                    Burnham, K. P. &amp; Anderson, D. R. (2002). <em>Model Selection and Multimodel Inference: A
                    Practical Information-Theoretic Approach</em> (2.ª ed.). Springer. Justifica el uso de AIC para
                    comparar modelos anidados.
                  </li>
                  <li>
                    Durbin, J. &amp; Watson, G. S. (1951). <em>Testing for serial correlation in least squares regression II</em>.
                    Biometrika, 38, 159–178. (Para interpretar DW.)
                  </li>
                </ul>
              </section>

              <section className="rounded-xl bg-ink/[0.04] p-4 border border-ink/10">
                <p className="text-[0.66rem] font-bold uppercase tracking-widest text-ink/50 mb-2">Cita esta simulación</p>
                <p className="text-ink/70 leading-relaxed font-mono text-[0.82rem]">
                  MathModels Lab (2026). <em>Crecimiento poblacional de invasiones biológicas: hipopótamos en Colombia
                  y casos comparativos</em> [software interactivo]. Disponible en:{' '}
                  <span className="text-ink/90">mathmodels-lab/monografias/hipos-invasion</span>
                </p>
                <p className="text-[0.72rem] text-ink/45 mt-2">
                  Para honestidad académica IB: describe QUÉ calculó esta simulación (RK4, AIC, H_crítico) y POR QUÉ
                  confías en los resultados. Verifica al menos un valor manualmente (la linealización ln(P) vs t es
                  ideal para eso). No trates la herramienta como caja negra.
                </p>
              </section>
            </div>
          </LabCard>
        </div>
      )}
    </div>
  )
}

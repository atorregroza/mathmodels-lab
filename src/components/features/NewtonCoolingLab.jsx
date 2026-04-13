import { useState, useMemo } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, generateTicks, sampleRange, linePath } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'
import { computeR2, computeAIC, computeResiduals, durbinWatson } from './modelFitting'

/* ───────────────────────── CIUDADES COLOMBIANAS ───────────────────────── */

const CITIES = [
  { id: 'murillo',    name: 'Murillo',              floor: 'Páramo',        alt: 3500, Ts: 4,  hum: 85, color: '#60A5FA', ctx: 'Café después de una caminata al Nevado del Ruiz' },
  { id: 'bogota-am',  name: 'Bogotá (6 am)',        floor: 'Frío',          alt: 2600, Ts: 10, hum: 75, color: '#818CF8', ctx: 'Tinto del señor de la esquina, madrugada' },
  { id: 'bogota-pm',  name: 'Bogotá (mediodía)',    floor: 'Frío-templado', alt: 2600, Ts: 18, hum: 55, color: '#A78BFA', ctx: 'Café de oficina en Chapinero' },
  { id: 'medellin',   name: 'Medellín',             floor: 'Templado',      alt: 1500, Ts: 24, hum: 70, color: '#34D399', ctx: 'Café en una finca del Eje Cafetero' },
  { id: 'cali',       name: 'Cali',                 floor: 'Cálido',        alt: 1000, Ts: 28, hum: 65, color: '#FBBF24', ctx: 'Café en el bulevar del Río' },
  { id: 'barranquilla', name: 'Barranquilla',       floor: 'Muy cálido',    alt: 0,    Ts: 33, hum: 80, color: '#F97316', ctx: 'Tinto en la calle, mediodía en el Centro' },
  { id: 'villavicencio', name: 'Villavicencio',     floor: 'Cálido',        alt: 467,  Ts: 31, hum: 75, color: '#EF4444', ctx: 'Café después del almuerzo llanero' },
]

const CONTAINERS = [
  { id: 'ceramic',   name: 'Pocillo cerámica', kBase: 0.035, emoji: '☕' },
  { id: 'styrofoam', name: 'Vaso de icopor',   kBase: 0.012, emoji: '🥤' },
  { id: 'glass',     name: 'Vaso de vidrio',   kBase: 0.045, emoji: '🥛' },
  { id: 'totuma',    name: 'Totuma',            kBase: 0.025, emoji: '🥥' },
]

const VIEWS = [
  { id: 'curves',     label: 'Curvas T(t)' },
  { id: 'residuals',  label: 'Residuales' },
  { id: 'comparison', label: 'Comparar modelos' },
]

/* ──────────────────────── MOTOR DE FÍSICA ──────────────────────── */

const boilingPoint = (alt) => 100 - 0.00325 * alt
const servingTemp  = (alt) => boilingPoint(alt) - 7

const computeK = (container, city, wind) =>
  container.kBase * (1 + 0.30 * wind) * (1 + 0.002 * city.hum)

// Modelo 1: Newton simple
const model1 = (t, Ts, T0, k) => Ts + (T0 - Ts) * Math.exp(-k * t)

// Modelo 2: dos exponenciales (masa térmica de la taza + enfriamiento lento)
// Componente rápido: el café calienta la taza (transiente ~2-3 min)
// Componente lento: el sistema café+taza se enfría al ambiente
const model2 = (t, Ts, T0, k) => {
  const dT = T0 - Ts
  return Ts + 0.8 * dT * Math.exp(-k * t) + 0.2 * dT * Math.exp(-4 * k * t)
}

// PRNG determinista (mulberry32)
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

// Datos sintéticos realistas: ningún modelo los ajusta perfectamente
// La "realidad" incluye evaporación (dominante arriba de 60°C) que ningún modelo captura
const generateData = (city, container, T0, k, wind) => {
  const rng = seedRng(hashStr(city.id + container.id))
  const Ts = city.Ts
  const kEff = computeK(container, city, wind)
  const times = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]
  return times.map((t) => {
    const u1 = rng(), u2 = rng(), u3 = rng()
    // Ruido gaussiano σ=1.0°C (termómetro de cocina ±0.5°C + variabilidad)
    const gaussian = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2) * 1.0
    // Evaporación: acelera el enfriamiento cuando T > 55°C (la evaporación
    // contribuye ~40-50% de la pérdida de calor a T alto, pero los modelos
    // exponenciales no la capturan bien). Proporcional al déficit de presión de vapor.
    const Tcurrent = model2(t, Ts, T0, kEff)
    const evapExtra = Tcurrent > 55 ? -0.04 * (Tcurrent - 55) * t * (1 - 0.005 * city.hum) : 0
    // Outlier ocasional (~8%): corriente de aire, se mueve la taza
    const outlier = u3 < 0.08 ? (rng() - 0.5) * 4 : 0
    const Treal = Tcurrent + gaussian + evapExtra + outlier
    return { t, T: Math.max(Ts + 0.5, Treal) }
  })
}

// Ajuste polinomio cúbico por mínimos cuadrados (sistema normal 4×4)
const fitCubic = (data) => {
  const n = data.length
  const S = (p) => data.reduce((s, d) => s + Math.pow(d.t, p), 0)
  const Sy = (p) => data.reduce((s, d) => s + Math.pow(d.t, p) * d.T, 0)
  // Construir sistema 4×4
  const A = [
    [n,    S(1), S(2), S(3)],
    [S(1), S(2), S(3), S(4)],
    [S(2), S(3), S(4), S(5)],
    [S(3), S(4), S(5), S(6)],
  ]
  const b = [Sy(0), Sy(1), Sy(2), Sy(3)]
  // Eliminación gaussiana con pivoteo parcial
  for (let col = 0; col < 4; col++) {
    let maxRow = col
    for (let row = col + 1; row < 4; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]]
    if (Math.abs(A[col][col]) < 1e-12) continue
    for (let row = col + 1; row < 4; row++) {
      const f = A[row][col] / A[col][col]
      for (let j = col; j < 4; j++) A[row][j] -= f * A[col][j]
      b[row] -= f * b[col]
    }
  }
  const x = [0, 0, 0, 0]
  for (let i = 3; i >= 0; i--) {
    x[i] = b[i]
    for (let j = i + 1; j < 4; j++) x[i] -= A[i][j] * x[j]
    x[i] /= A[i][i]
  }
  return { a0: x[0], a1: x[1], a2: x[2], a3: x[3] }
}

// Resolver t analíticamente para modelo 1: T(t) = target
const solveT1 = (target, Ts, T0, k) => {
  if (target <= Ts || target >= T0 || k <= 0) return null
  return -Math.log((target - Ts) / (T0 - Ts)) / k
}

// Resolver t numéricamente para modelo 2
const solveT2 = (target, Ts, T0, k) => {
  let lo = 0, hi = 300
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (model2(mid, Ts, T0, k) > target) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

/* ──────────────────────── COMPONENTE ──────────────────────── */

export const NewtonCoolingLab = () => {
  const [city1Id, setCity1Id] = useState('bogota-am')
  const [city2Id, setCity2Id] = useState('barranquilla')
  const [containerId, setContainerId] = useState('ceramic')
  const [windFactor, setWindFactor] = useState(0)
  const [view, setView] = useState('curves')
  const [showM1, setShowM1] = useState(false)
  const [showM2, setShowM2] = useState(false)
  const [showM3, setShowM3] = useState(false)

  const city1 = CITIES.find((c) => c.id === city1Id)
  const city2 = city2Id ? CITIES.find((c) => c.id === city2Id) : null
  const container = CONTAINERS.find((c) => c.id === containerId)

  const T0_1 = Math.round(servingTemp(city1.alt))
  const T0_2 = city2 ? Math.round(servingTemp(city2.alt)) : 0
  const k1 = computeK(container, city1, windFactor)
  const k2 = city2 ? computeK(container, city2, windFactor) : 0

  /* ── datos y modelos ── */
  const analysis = useMemo(() => {
    const buildCity = (city, T0, k) => {
      const obs = generateData(city, container, T0, k, windFactor)
      const xs = obs.map((d) => d.t)
      const ys = obs.map((d) => d.T)

      const fn1 = (t) => model1(t, city.Ts, T0, k)
      const fn2 = (t) => model2(t, city.Ts, T0, k)
      const poly = fitCubic(obs)
      const fn3 = (t) => poly.a0 + poly.a1 * t + poly.a2 * t * t + poly.a3 * t * t * t

      const r2_1 = computeR2(xs, ys, fn1)
      const r2_2 = computeR2(xs, ys, fn2)
      const r2_3 = computeR2(xs, ys, fn3)
      const aic1 = computeAIC(xs, ys, fn1, 1)
      const aic2 = computeAIC(xs, ys, fn2, 1)
      const aic3 = computeAIC(xs, ys, fn3, 4)
      const res1 = computeResiduals(xs, ys, fn1)
      const res2 = computeResiduals(xs, ys, fn2)
      const res3 = computeResiduals(xs, ys, fn3)
      const dw1 = durbinWatson(res1)
      const dw2 = durbinWatson(res2)
      const dw3 = durbinWatson(res3)

      const t60_1 = solveT1(60, city.Ts, T0, k)
      const t60_2 = T0 > 60 ? solveT2(60, city.Ts, T0, k) : null
      const tEq1 = solveT1(city.Ts + 2, city.Ts, T0, k)
      const dT10 = T0 - fn2(10)

      return {
        city, T0, k, obs, poly,
        fn1, fn2, fn3,
        stats: {
          r2: [r2_1, r2_2, r2_3],
          aic: [aic1, aic2, aic3],
          dw: [dw1, dw2, dw3],
          residuals: [res1, res2, res3],
        },
        metrics: { t60_1, t60_2, tEq1, dT10 },
      }
    }

    const a = buildCity(city1, T0_1, k1)
    const b = city2 ? buildCity(city2, T0_2, k2) : null
    return { a, b }
  }, [city1, city2, container, T0_1, T0_2, k1, k2, windFactor])

  const { a, b: cityB } = analysis

  /* ── escalas del gráfico ── */
  const tMax = 33
  const yMaxVal = Math.max(T0_1, city2 ? T0_2 : 0) + 5
  const yMinVal = Math.min(city1.Ts, city2 ? city2.Ts : city1.Ts) - 3

  /* ── residuales ── */
  const resMax = Math.max(
    ...a.stats.residuals[0].map(Math.abs),
    ...a.stats.residuals[1].map(Math.abs),
    ...(cityB ? cityB.stats.residuals[0].map(Math.abs) : [0]),
    2
  )
  const resYMax = Math.ceil(resMax + 0.5)

  const curvesAxis = useAxisRange({ xMin: -1, xMax: tMax, yMin: yMinVal, yMax: yMaxVal })
  const residAxis  = useAxisRange({ xMin: -1, xMax: tMax, yMin: -resYMax, yMax: resYMax })

  /* ── curvas para SVG ── */
  const curvePoints1_m1 = sampleRange(0, 30, 200, a.fn1)
  const curvePoints1_m2 = sampleRange(0, 30, 200, a.fn2)
  const curvePoints1_m3 = sampleRange(0, 30, 200, a.fn3)
  const curvePointsB_m1 = cityB ? sampleRange(0, 30, 200, cityB.fn1) : []
  const curvePointsB_m2 = cityB ? sampleRange(0, 30, 200, cityB.fn2) : []
  const curvePointsB_m3 = cityB ? sampleRange(0, 30, 200, cityB.fn3) : []

  /* ── CSV ── */
  const handleDownload = () => {
    const header = ['t (min)', `T_obs ${city1.name}`, 'Newton', 'Dos exp.', 'Polinomio', 'Res. Newton', 'Res. Dos exp.']
    if (cityB) header.push(`T_obs ${cityB.city.name}`, 'Newton (2)', 'Dos exp. (2)', 'Res. Newton (2)')
    const rows = a.obs.map((d, i) => {
      const row = [
        d.t,
        d.T.toFixed(2),
        a.fn1(d.t).toFixed(2),
        a.fn2(d.t).toFixed(2),
        a.fn3(d.t).toFixed(2),
        a.stats.residuals[0][i]?.toFixed(3) ?? '',
        a.stats.residuals[1][i]?.toFixed(3) ?? '',
      ]
      if (cityB) {
        row.push(
          cityB.obs[i]?.T.toFixed(2) ?? '',
          cityB.fn1(d.t).toFixed(2),
          cityB.fn2(d.t).toFixed(2),
          cityB.stats.residuals[0][i]?.toFixed(3) ?? '',
        )
      }
      return row
    })
    downloadCsv([header, ...rows], `enfriamiento-${city1.id}-${containerId}.csv`)
  }

  /* ── render helpers ── */
  const modelColors = ['rgba(96,165,250,0.9)', 'rgba(251,146,60,0.9)', 'rgba(244,114,182,0.85)']
  const modelNames = ['Newton simple', 'Dos exponenciales', 'Polinomio cúbico']

  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── Selector de ciudades ── */}
      <LabCard title="Ciudades colombianas">
        <p className="text-xs text-ink/40 mb-3 mt-1">Selecciona una o dos ciudades para comparar el enfriamiento</p>
        <div className="space-y-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/35 mb-2">Ciudad principal</p>
            <div className="flex flex-wrap gap-2">
              {CITIES.map((c) => (
                <button key={c.id} onClick={() => { setCity1Id(c.id); if (city2Id === c.id) setCity2Id(null); curvesAxis.resetRange(); residAxis.resetRange() }}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    city1Id === c.id
                      ? 'text-white shadow-md scale-105'
                      : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
                  }`}
                  style={city1Id === c.id ? { backgroundColor: c.color } : undefined}
                >
                  {c.name} · {c.Ts}°C
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/35 mb-2">Comparar con <span className="text-ink/25">(opcional)</span></p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setCity2Id(null); curvesAxis.resetRange(); residAxis.resetRange() }}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${!city2Id ? 'bg-ink text-paper' : 'bg-ink/5 text-ink/40 hover:bg-ink/10'}`}
              >Ninguna</button>
              {CITIES.filter((c) => c.id !== city1Id).map((c) => (
                <button key={c.id} onClick={() => { setCity2Id(c.id); curvesAxis.resetRange(); residAxis.resetRange() }}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    city2Id === c.id
                      ? 'text-white shadow-md scale-105'
                      : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
                  }`}
                  style={city2Id === c.id ? { backgroundColor: c.color } : undefined}
                >{c.name} · {c.Ts}°C</button>
              ))}
            </div>
          </div>
        </div>
      </LabCard>

      {/* ── Contexto narrativo ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink/8 p-4" style={{ borderLeftWidth: 4, borderLeftColor: city1.color }}>
          <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">{city1.name} — {city1.floor} ({city1.alt} m)</p>
          <p className="text-sm text-ink/60 mt-1">{city1.ctx}</p>
          <p className="text-xs text-ink/35 mt-2 font-mono">T_amb = {city1.Ts}°C · T₀ = {T0_1}°C · ΔT = {T0_1 - city1.Ts}°C · Hum = {city1.hum}%</p>
        </div>
        {cityB && (
          <div className="rounded-2xl border border-ink/8 p-4" style={{ borderLeftWidth: 4, borderLeftColor: cityB.city.color }}>
            <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">{cityB.city.name} — {cityB.city.floor} ({cityB.city.alt} m)</p>
            <p className="text-sm text-ink/60 mt-1">{cityB.city.ctx}</p>
            <p className="text-xs text-ink/35 mt-2 font-mono">T_amb = {cityB.city.Ts}°C · T₀ = {T0_2}°C · ΔT = {T0_2 - cityB.city.Ts}°C · Hum = {cityB.city.hum}%</p>
          </div>
        )}
      </div>

      {/* ── Recipiente + viento + toggle ── */}
      <div className="flex flex-wrap items-end gap-5">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/35 mb-2">Recipiente</p>
          <div className="flex gap-2">
            {CONTAINERS.map((c) => (
              <button key={c.id} onClick={() => { setContainerId(c.id); curvesAxis.resetRange(); residAxis.resetRange() }}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  containerId === c.id ? 'bg-ink text-paper shadow-md' : 'border border-ink/10 bg-white text-ink/50 hover:bg-ink/5'
                }`}
              >{c.emoji} {c.name}</button>
            ))}
          </div>
        </div>
        <div className="w-48">
          <SliderField id="wind" label="Viento" value={windFactor} min={0} max={3} step={0.5} suffix=" nivel" onChange={setWindFactor} />
        </div>
      </div>

      {/* ── Vista toggle ── */}
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button key={v.id} onClick={() => { setView(v.id); curvesAxis.resetRange(); residAxis.resetRange() }}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              view === v.id ? 'bg-ink text-paper' : 'border border-ink/12 bg-white text-ink'
            }`}
          >{v.label}</button>
        ))}
      </div>

      {/* ── Toggles de modelos ── */}
      {view === 'curves' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-ink/35 font-semibold uppercase tracking-wide">Agregar modelo:</span>
          {[
            { on: showM1, set: setShowM1, label: 'Newton simple', color: modelColors[0] },
            { on: showM2, set: setShowM2, label: 'Dos exponenciales', color: modelColors[1] },
            { on: showM3, set: setShowM3, label: 'Polinomio cúbico', color: modelColors[2] },
          ].map((m) => (
            <button key={m.label} onClick={() => m.set(!m.on)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all border ${
                m.on
                  ? 'text-white shadow-md scale-105 border-transparent'
                  : 'border-ink/12 bg-white text-ink/40 hover:bg-ink/5'
              }`}
              style={m.on ? { backgroundColor: m.color } : undefined}
            >
              {m.on ? '✓ ' : '+ '}{m.label}
            </button>
          ))}
        </div>
      )}

      {/* ── GRÁFICA PRINCIPAL: Curvas T(t) ── */}
      {view === 'curves' && (
        <div className="xl:sticky xl:top-4 xl:self-start">
        <LabCard dark title="Temperatura T(t) vs tiempo">
          <div className="mt-4">
            <CartesianFrame
              width={640} height={340}
              xMin={curvesAxis.xMin} xMax={curvesAxis.xMax} yMin={curvesAxis.yMin} yMax={curvesAxis.yMax}
              xTicks={generateTicks(curvesAxis.xMin, curvesAxis.xMax)} yTicks={generateTicks(curvesAxis.yMin, curvesAxis.yMax)}
              xLabel="t (min)" yLabel="T (°C)"
              dark className="w-full h-auto overflow-visible rounded-[1.3rem]"
            >
              {({ scaleX, scaleY }) => (
                <>
                  {/* Asíntota Ts ciudad 1 */}
                  <line x1={scaleX(0)} y1={scaleY(city1.Ts)} x2={scaleX(30)} y2={scaleY(city1.Ts)}
                    stroke={city1.color} strokeWidth="1" strokeDasharray="6 4" opacity="0.4" />
                  <text x={scaleX(31)} y={scaleY(city1.Ts) + 4} fill={city1.color} fontSize="9" opacity="0.6">{city1.Ts}°</text>

                  {/* Asíntota Ts ciudad 2 */}
                  {cityB && (
                    <>
                      <line x1={scaleX(0)} y1={scaleY(cityB.city.Ts)} x2={scaleX(30)} y2={scaleY(cityB.city.Ts)}
                        stroke={cityB.city.color} strokeWidth="1" strokeDasharray="6 4" opacity="0.4" />
                      <text x={scaleX(31)} y={scaleY(cityB.city.Ts) + 4} fill={cityB.city.color} fontSize="9" opacity="0.6">{cityB.city.Ts}°</text>
                    </>
                  )}

                  {/* Línea de 60°C (temperatura bebible) */}
                  <line x1={scaleX(0)} y1={scaleY(60)} x2={scaleX(30)} y2={scaleY(60)}
                    stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 5" />
                  <text x={scaleX(0.5)} y={scaleY(60) - 5} fill="rgba(255,255,255,0.3)" fontSize="8">60° bebible</text>

                  {/* Curvas ciudad 1 — solo si el toggle está activo */}
                  {showM1 && <path d={linePath(curvePoints1_m1, scaleX, scaleY)} fill="none" stroke={modelColors[0]} strokeWidth="2" />}
                  {showM2 && <path d={linePath(curvePoints1_m2, scaleX, scaleY)} fill="none" stroke={modelColors[1]} strokeWidth="2.5" />}
                  {showM3 && <path d={linePath(curvePoints1_m3, scaleX, scaleY)} fill="none" stroke={modelColors[2]} strokeWidth="1.5" strokeDasharray="4 3" />}

                  {/* Datos observados ciudad 1 */}
                  {a.obs.map((d, i) => (
                    <circle key={`o1-${i}`} cx={scaleX(d.t)} cy={scaleY(d.T)} r={3} fill="white" opacity="0.85" />
                  ))}

                  {/* Curvas ciudad 2 — solo si el toggle está activo */}
                  {cityB && (
                    <>
                      {showM1 && <path d={linePath(curvePointsB_m1, scaleX, scaleY)} fill="none" stroke={modelColors[0]} strokeWidth="1.5" strokeDasharray="8 4" />}
                      {showM2 && <path d={linePath(curvePointsB_m2, scaleX, scaleY)} fill="none" stroke={modelColors[1]} strokeWidth="2" strokeDasharray="8 4" />}
                      {showM3 && <path d={linePath(curvePointsB_m3, scaleX, scaleY)} fill="none" stroke={modelColors[2]} strokeWidth="1.5" strokeDasharray="2 3" />}
                      {cityB.obs.map((d, i) => (
                        <circle key={`o2-${i}`} cx={scaleX(d.t)} cy={scaleY(d.T)} r={2.5} fill={cityB.city.color} opacity="0.7" />
                      ))}
                    </>
                  )}
                </>
              )}
            </CartesianFrame>
          </div>
          <AxisRangePanel {...curvesAxis} />
          {/* Leyenda — solo modelos activos */}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/60">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-white" /> {city1.name}</span>
            {showM1 && <span className="flex items-center gap-1.5">
              <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={modelColors[0]} strokeWidth="2" /></svg> Newton
            </span>}
            {showM2 && <span className="flex items-center gap-1.5">
              <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={modelColors[1]} strokeWidth="2.5" /></svg> Dos exp.
            </span>}
            {showM3 && <span className="flex items-center gap-1.5">
              <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={modelColors[2]} strokeWidth="1.5" strokeDasharray="4 3" /></svg> Polinomio
            </span>}
            {cityB && (
              <>
                <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: cityB.city.color }} /> {cityB.city.name}</span>
                {showM1 && <span className="flex items-center gap-1.5">
                  <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={modelColors[0]} strokeWidth="1.5" strokeDasharray="4 3" /></svg> Newton
                </span>}
                {showM2 && <span className="flex items-center gap-1.5">
                  <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={modelColors[1]} strokeWidth="2" strokeDasharray="4 3" /></svg> Dos exp.
                </span>}
                {showM3 && <span className="flex items-center gap-1.5">
                  <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={modelColors[2]} strokeWidth="1.5" strokeDasharray="2 3" /></svg> Polinomio
                </span>}
              </>
            )}
          </div>
        </LabCard>
        </div>
      )}

      {/* ── GRÁFICA DE RESIDUALES ── */}
      {view === 'residuals' && (
        <div className="xl:sticky xl:top-4 xl:self-start">
        <LabCard dark title="Residuales: T_obs − T_modelo">
          <div className="mt-4">
            <CartesianFrame
              width={640} height={280}
              xMin={residAxis.xMin} xMax={residAxis.xMax} yMin={residAxis.yMin} yMax={residAxis.yMax}
              xTicks={generateTicks(residAxis.xMin, residAxis.xMax)} yTicks={generateTicks(residAxis.yMin, residAxis.yMax)}
              xLabel="t (min)" yLabel="Residual (°C)"
              dark className="w-full h-auto overflow-visible rounded-[1.3rem]"
            >
              {({ scaleX, scaleY }) => (
                <>
                  {/* Línea cero */}
                  <line x1={scaleX(0)} y1={scaleY(0)} x2={scaleX(30)} y2={scaleY(0)} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

                  {/* Residuales modelo 1 */}
                  {a.obs.map((d, i) => a.stats.residuals[0][i] !== undefined && (
                    <circle key={`r1-${i}`} cx={scaleX(d.t)} cy={scaleY(a.stats.residuals[0][i])} r={4} fill={modelColors[0]} opacity="0.8" />
                  ))}
                  {/* Residuales modelo 2 */}
                  {a.obs.map((d, i) => a.stats.residuals[1][i] !== undefined && (
                    <rect key={`r2-${i}`} x={scaleX(d.t) - 3} y={scaleY(Math.max(0, a.stats.residuals[1][i]))}
                      width={6} height={Math.abs(scaleY(0) - scaleY(a.stats.residuals[1][i]))}
                      fill={modelColors[1]} opacity="0.6" rx="1" />
                  ))}
                  {/* Residuales modelo 3 */}
                  {a.obs.map((d, i) => a.stats.residuals[2][i] !== undefined && (
                    <polygon key={`r3-${i}`}
                      points={`${scaleX(d.t)},${scaleY(a.stats.residuals[2][i]) - 4} ${scaleX(d.t) - 4},${scaleY(a.stats.residuals[2][i]) + 3} ${scaleX(d.t) + 4},${scaleY(a.stats.residuals[2][i]) + 3}`}
                      fill={modelColors[2]} opacity="0.7" />
                  ))}
                </>
              )}
            </CartesianFrame>
          </div>
          <AxisRangePanel {...residAxis} />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/60">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: modelColors[0] }} /> Newton</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: modelColors[1] }} /> Dos exp.</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-transparent" style={{ borderBottomColor: modelColors[2] }} /> Polinomio</span>
          </div>
        </LabCard>
        </div>
      )}

      {/* ── COMPARACIÓN DE MODELOS ── */}
      {view === 'comparison' && (
        <LabCard title={`Comparación estadística — ${city1.name}`}>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10">
                  <th className="pb-2 text-left text-[0.66rem] uppercase text-ink/44">Métrica</th>
                  {modelNames.map((n, i) => (
                    <th key={i} className="pb-2 text-right text-[0.66rem] uppercase" style={{ color: modelColors[i] }}>{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'R²', vals: a.stats.r2, fmt: (v) => v.toFixed(6), best: 'max' },
                  { label: 'AIC', vals: a.stats.aic, fmt: (v) => v.toFixed(1), best: 'min' },
                  { label: 'Durbin-Watson', vals: a.stats.dw, fmt: (v) => v.toFixed(3), best: 'near2' },
                ].map((row) => {
                  const bestIdx = row.best === 'max'
                    ? row.vals.indexOf(Math.max(...row.vals))
                    : row.best === 'min'
                      ? row.vals.indexOf(Math.min(...row.vals))
                      : row.vals.indexOf(row.vals.reduce((a, b) => Math.abs(a - 2) < Math.abs(b - 2) ? a : b))
                  return (
                    <tr key={row.label} className="border-b border-ink/6">
                      <td className="py-2.5 text-ink/55 font-medium">{row.label}</td>
                      {row.vals.map((v, i) => (
                        <td key={i} className={`py-2.5 text-right font-mono text-xs ${i === bestIdx ? 'font-bold text-graph' : 'text-ink/50'}`}>
                          {row.fmt(v)} {i === bestIdx && '✓'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                <tr className="border-b border-ink/6">
                  <td className="py-2.5 text-ink/55 font-medium">Parámetros</td>
                  <td className="py-2.5 text-right font-mono text-xs text-ink/50">1 (k)</td>
                  <td className="py-2.5 text-right font-mono text-xs text-ink/50">1 (k, fracciones fijas)</td>
                  <td className="py-2.5 text-right font-mono text-xs text-ink/50">4 (a₀,a₁,a₂,a₃)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-ink/35 leading-relaxed">
            R² mide bondad de ajuste (más alto = mejor). AIC penaliza complejidad (más bajo = mejor balance ajuste/simplicidad).
            Durbin-Watson detecta autocorrelación en residuales (ideal ≈ 2.0; {'<'}1.5 indica patrón sistemático).
          </p>
        </LabCard>
      )}

      {/* ── Modelos matemáticos ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <ModelCard
          title="Newton simple"
          expression={`T(t) = ${city1.Ts} + ${T0_1 - city1.Ts}·e^(-${format(k1)}·t)`}
          parameters="k (constante de enfriamiento)"
          conditions="Asume k constante, solo convección"
        />
        <ModelCard
          title="Dos exponenciales"
          expression={`T(t) = ${city1.Ts} + ${format(0.8 * (T0_1 - city1.Ts))}·e^(-${format(k1)}t) + ${format(0.2 * (T0_1 - city1.Ts))}·e^(-${format(4 * k1)}t)`}
          parameters="k (enfriamiento lento), 4k (transiente de la taza)"
          conditions="Separa masa térmica de la taza del enfriamiento al ambiente"
        />
        <ModelCard
          title="Polinomio cúbico"
          expression={`T(t) = ${format(a.poly.a0)} + ${format(a.poly.a1)}t + ${format(a.poly.a2)}t² + ${format(a.poly.a3)}t³`}
          parameters="a₀, a₁, a₂, a₃ (empírico)"
          conditions="Sin base física — ¡cuidado con extrapolar!"
        />
      </div>

      {/* ── Métricas ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard dark={false}
          label="Tiempo a 60°C (bebible)"
          value={a.metrics.t60_2 != null ? `${format(a.metrics.t60_2)} min` : '—'}
          detail={`${city1.name} · Modelo dos exp.`}
        />
        <MetricCard dark={false}
          label="Caída en 10 min"
          value={`${format(a.metrics.dT10)}°C`}
          detail={`De ${T0_1}°C a ~${format(T0_1 - a.metrics.dT10)}°C`}
        />
        <MetricCard dark={false}
          label="k efectivo"
          value={format(k1)}
          detail={`${container.name} · viento ${windFactor}`}
        />
        {cityB && (
          <MetricCard dark={false}
            label={`Tiempo a 60°C — ${cityB.city.name}`}
            value={cityB.metrics.t60_2 != null ? `${format(cityB.metrics.t60_2)} min` : '—'}
            detail="Modelo dos exp."
          />
        )}
        {!cityB && (
          <MetricCard dark={false}
            label="Equilibrio práctico"
            value={a.metrics.tEq1 != null ? `${format(a.metrics.tEq1)} min` : '—'}
            detail={`Llegar a ${city1.Ts + 2}°C`}
          />
        )}
      </div>

      {/* ── Tabla de datos ── */}
      <LabCard title="Datos observados y modelos">
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="pb-2 text-left text-[0.66rem] uppercase text-ink/44">t (min)</th>
                <th className="pb-2 text-right text-[0.66rem] uppercase text-ink/44">T obs</th>
                <th className="pb-2 text-right text-[0.66rem] uppercase" style={{ color: modelColors[0] }}>Newton</th>
                <th className="pb-2 text-right text-[0.66rem] uppercase" style={{ color: modelColors[1] }}>Dos exp.</th>
                <th className="pb-2 text-right text-[0.66rem] uppercase" style={{ color: modelColors[2] }}>Polinomio</th>
              </tr>
            </thead>
            <tbody>
              {a.obs.map((d) => (
                <tr key={d.t} className="border-b border-ink/6 hover:bg-ink/3">
                  <td className="py-2 text-ink/65">{d.t}</td>
                  <td className="py-2 text-right font-semibold text-ink/70">{d.T.toFixed(1)}°</td>
                  <td className="py-2 text-right text-ink/50">{a.fn1(d.t).toFixed(1)}°</td>
                  <td className="py-2 text-right text-ink/50">{a.fn2(d.t).toFixed(1)}°</td>
                  <td className="py-2 text-right text-ink/50">{a.fn3(d.t).toFixed(1)}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={handleDownload}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white hover:bg-aqua/90 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Descargar CSV
        </button>
      </LabCard>

      {/* ── Nota pedagógica ── */}
      <div className="rounded-2xl border border-ink/8 bg-ink/3 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/35 mb-2">Para tu monografía</p>
        <p className="text-sm text-ink/55 leading-relaxed">
          Observa los residuales del modelo de Newton: ¿muestran un patrón sistemático o son aleatorios?
          Si hay patrón, el modelo tiene una limitación estructural — y esa limitación es tu hallazgo para el Criterio D.
          Compara el AIC de los tres modelos: ¿cuál logra el mejor balance entre ajuste y simplicidad?
          ¿Cambia la respuesta entre ciudades frías y cálidas?
        </p>
      </div>
    </div>
  )
}

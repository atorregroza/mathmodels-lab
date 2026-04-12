import { useState } from 'react'
import { CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, linePath, sampleRange } from './derivaLabUtils'

/* ── Escenarios ───────────────────────────────────────────────── */

const scenarios = [
  {
    id: 'drone',
    label: 'Dron de entrega',
    context: 'Un dron parte de la base, avanza hasta el destino, se detiene, y retrocede.',
    tMax: 10,
    // Velocity: piecewise linear
    // 0-3: accelerates 0→6, 3-5: decelerates 6→0, 5-7: reverses 0→-4, 7-10: returns -4→0
    v: (t) => {
      if (t <= 3) return 2 * t
      if (t <= 5) return 6 - 3 * (t - 3)
      if (t <= 7) return -2 * (t - 5)
      return -4 + (4 / 3) * (t - 7)
    },
    // Position: integral of v(t) piecewise
    s: (t) => {
      if (t <= 3) return t * t
      if (t <= 5) { const u = t - 3; return 9 + 6 * u - 1.5 * u * u }
      if (t <= 7) { const u = t - 5; return 15 - u * u }
      const u = t - 7; return 11 - 4 * u + (2 / 3) * u * u
    },
    a: (t) => {
      if (t <= 3) return 2
      if (t <= 5) return -3
      if (t <= 7) return -2
      return 4 / 3
    },
    sLabel: 's (metros)',
    vLabel: 'v (m/s)',
    formula: 'v(t) por tramos lineales',
  },
  {
    id: 'elevator',
    label: 'Ascensor inteligente',
    context: 'Sube al piso 5, se detiene brevemente, baja al piso 2.',
    tMax: 8,
    // s(t) = -0.15(t-2)³ + 0.9(t-2) + 1 — cubic with turning points
    s: (t) => -0.15 * ((t - 2) ** 3) + 0.9 * (t - 2) + 1,
    v: (t) => -0.45 * ((t - 2) ** 2) + 0.9,
    a: (t) => -0.9 * (t - 2),
    sLabel: 's (pisos)',
    vLabel: 'v (pisos/s)',
    formula: 's(t) = -0.15(t - 2)³ + 0.9(t - 2) + 1',
  },
  {
    id: 'particle',
    label: 'Partícula clásica',
    context: 'Caso estándar IB: partícula con ida y vuelta sobre una recta.',
    tMax: 6,
    s: (t) => t * t - 4 * t + 3,
    v: (t) => 2 * t - 4,
    a: () => 2,
    sLabel: 's (metros)',
    vLabel: 'v (m/s)',
    formula: 's(t) = t² - 4t + 3',
  },
  {
    id: 'cyclist',
    label: 'Ciclista en colina',
    context: 'Un ciclista sube y baja una colina: su velocidad oscila entre avance y retroceso.',
    tMax: 10,
    v: (t) => 3 * Math.sin(0.8 * t),
    s: (t) => -3.75 * Math.cos(0.8 * t) + 3.75,
    a: (t) => 2.4 * Math.cos(0.8 * t),
    sLabel: 's (metros)',
    vLabel: 'v (m/s)',
    formula: 'v(t) = 3sen(0.8t)',
  },
  {
    id: 'car',
    label: 'Auto con frenado',
    context: 'Un auto viaja a velocidad constante y frena hasta detenerse.',
    tMax: 8,
    v: (t) => {
      if (t <= 4) return 5
      if (t <= 8) return 5 - 1.25 * (t - 4)
      return 0
    },
    s: (t) => {
      if (t <= 4) return 5 * t
      const u = t - 4
      return 20 + 5 * u - 0.625 * u * u
    },
    a: (t) => {
      if (t <= 4) return 0
      if (t <= 8) return -1.25
      return 0
    },
    sLabel: 's (metros)',
    vLabel: 'v (m/s)',
    formula: 'v = 5 (t ≤ 4), v = 5 - 1.25(t - 4)',
  },
  {
    id: 'pendulum',
    label: 'Péndulo amortiguado',
    context: 'Oscila cada vez menos: la velocidad se apaga exponencialmente.',
    tMax: 12,
    v: (t) => 4 * Math.exp(-0.25 * t) * Math.sin(1.8 * t),
    s: (t) => {
      // Numerical integration of v for s(t)
      const n = 400
      const dt = t / n
      let acc = 0
      for (let i = 0; i < n; i++) {
        const ti = (i + 0.5) * dt
        acc += 4 * Math.exp(-0.25 * ti) * Math.sin(1.8 * ti) * dt
      }
      return acc
    },
    a: (t) => {
      const e = Math.exp(-0.25 * t)
      return e * (-1 * Math.sin(1.8 * t) + 7.2 * Math.cos(1.8 * t))
    },
    sLabel: 's (metros)',
    vLabel: 'v (m/s)',
    formula: 'v(t) = 4e^{-0.25t}sen(1.8t)',
  },
]

/* ── Helpers ───────────────────────────────────────────────────── */

const integrate = (fn, a, b, slices = 400) => {
  const dt = (b - a) / slices
  let net = 0
  let total = 0
  for (let i = 0; i < slices; i++) {
    const y = fn(a + (i + 0.5) * dt)
    net += y * dt
    total += Math.abs(y) * dt
  }
  return { net, total }
}

const buildAreaSegments = (fn, a, b, samples = 200) => {
  const pts = sampleRange(a, b, samples, fn)
  if (pts.length < 2) return []
  const segs = []
  let cur = [pts[0]]
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1]
    if ((p.y >= 0) === (q.y >= 0) || Math.abs(q.y - p.y) < 1e-9) {
      cur.push(q)
      continue
    }
    const rx = p.x + ((0 - p.y) * (q.x - p.x)) / (q.y - p.y)
    const root = { x: rx, y: 0 }
    cur.push(root)
    segs.push(cur)
    cur = [root, q]
  }
  if (cur.length > 1) segs.push(cur)
  return segs
    .map((seg) => {
      const sample = seg.find((p) => Math.abs(p.y) > 1e-6)
      return sample ? { sign: sample.y > 0 ? 'pos' : 'neg', points: seg } : null
    })
    .filter(Boolean)
}

const areaPath = (pts, scaleX, scaleY) => {
  const y0 = scaleY(0)
  const curve = pts.map((p) => `L ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ')
  return `M ${scaleX(pts[0].x)} ${y0} ${curve} L ${scaleX(pts[pts.length - 1].x)} ${y0} Z`
}

const ticks = (min, max, step = 1) =>
  Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step)

const findZeros = (fn, a, b, n = 200) => {
  const zeros = []
  const dt = (b - a) / n
  for (let i = 0; i < n; i++) {
    const t1 = a + i * dt, t2 = t1 + dt
    const y1 = fn(t1), y2 = fn(t2)
    if (y1 * y2 < 0) {
      zeros.push(t1 - y1 * (t2 - t1) / (y2 - y1))
    }
  }
  return zeros
}

/* ── Componente ────────────────────────────────────────────────── */

export const LinearMotionLab = () => {
  const [scenarioId, setScenarioId] = useState('drone')
  const [time, setTime] = useState(5)
  const [t1, setT1] = useState(0)
  const [t2, setT2] = useState(5)

  const sc = scenarios.find((s) => s.id === scenarioId) || scenarios[0]
  const left = Math.min(t1, t2)
  const right = Math.max(t1, t2)

  // Computed values
  const sNow = sc.s(time)
  const vNow = sc.v(time)
  const aNow = sc.a(time)
  const integ = integrate(sc.v, left, right)
  const turnTimes = findZeros(sc.v, 0, sc.tMax)

  // Sampling
  const sPoints = sampleRange(0, sc.tMax, 200, sc.s)
  const vPoints = sampleRange(0, sc.tMax, 200, sc.v)
  const vSegs = buildAreaSegments(sc.v, left, right)

  // Axis ranges
  const sVals = sPoints.map((p) => p.y)
  const sMin = Math.floor(Math.min(...sVals) - 1)
  const sMax = Math.ceil(Math.max(...sVals) + 1)
  const vVals = vPoints.map((p) => p.y)
  const vMin = Math.floor(Math.min(...vVals) - 1)
  const vMax = Math.ceil(Math.max(...vVals) + 1)

  // Number line range
  const nlMin = sMin - 1
  const nlMax = sMax + 1

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">

        {/* ── LEFT: Controls ──────────────────────────────────── */}
        <div className="space-y-4">
          <LabCard title="Cinemática en recta" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Movimiento en recta</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              Desplazamiento es la integral con signo de v(t). Distancia recorrida es la integral de |v(t)|. Cuando la velocidad cambia de signo, el móvil invierte su sentido.
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
                    setTime(item.tMax / 2)
                    setT1(0)
                    setT2(item.tMax / 2)
                  }}
                  className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${item.id === sc.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper text-ink hover:border-ink/30'}`}
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className={`mt-1 text-sm leading-6 ${item.id === sc.id ? 'text-paper/72' : 'text-ink/65'}`}>{item.context}</p>
                </button>
              ))}
            </div>
          </LabCard>

          <SliderField id="lm-time" label="Instante t" value={time} min={0} max={sc.tMax} step={0.1} suffix=" s" onChange={setTime} />
          <SliderField id="lm-t1" label="Inicio del intervalo t₁" value={t1} min={0} max={sc.tMax} step={0.1} suffix=" s" onChange={setT1} />
          <SliderField id="lm-t2" label="Fin del intervalo t₂" value={t2} min={0} max={sc.tMax} step={0.1} suffix=" s" onChange={setT2} />

          {turnTimes.length > 0 && (
            <LabCard title="Cambios de sentido">
              <div className="space-y-1">
                {turnTimes.map((tz) => (
                  <p key={tz} className="text-sm text-ink/68">
                    t = <span className="font-semibold text-ink">{format(tz)} s</span> — s({format(tz)}) = {format(sc.s(tz))}
                  </p>
                ))}
              </div>
            </LabCard>
          )}
        </div>

        {/* ── RIGHT: Visualization ────────────────────────────── */}
        <div className="space-y-5">

          {/* Number line */}
          <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-paper/45">Recta numérica</p>
            <h3 className="mt-2 font-display text-2xl">Posición del móvil en t = {format(time)} s</h3>
            <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-6">
              <svg viewBox="0 0 620 80" className="w-full">
                {/* Axis */}
                <line x1="30" y1="40" x2="590" y2="40" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                {/* Ticks */}
                {ticks(nlMin, nlMax).map((v) => {
                  const x = 30 + ((v - nlMin) / (nlMax - nlMin)) * 560
                  return (
                    <g key={v}>
                      <line x1={x} y1="34" x2={x} y2="46" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                      <text x={x} y="62" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10">{v}</text>
                    </g>
                  )
                })}
                {/* Trail from s(0) to s(time) */}
                {(() => {
                  const x0 = 30 + ((sc.s(0) - nlMin) / (nlMax - nlMin)) * 560
                  const xNow = 30 + ((sNow - nlMin) / (nlMax - nlMin)) * 560
                  return <line x1={x0} y1="40" x2={xNow} y2="40" stroke="rgba(199,244,100,0.35)" strokeWidth="4" strokeLinecap="round" />
                })()}
                {/* Start marker */}
                {(() => {
                  const x0 = 30 + ((sc.s(0) - nlMin) / (nlMax - nlMin)) * 560
                  return <circle cx={x0} cy="40" r="4" fill="rgba(255,255,255,0.4)" />
                })()}
                {/* Current position */}
                {(() => {
                  const cx = 30 + ((sNow - nlMin) / (nlMax - nlMin)) * 560
                  const color = vNow > 0.01 ? 'rgba(199,244,100,0.95)' : vNow < -0.01 ? 'rgba(255,107,53,0.95)' : 'rgba(255,255,255,0.7)'
                  return (
                    <>
                      <circle cx={cx} cy="40" r="7" fill={color} />
                      {Math.abs(vNow) > 0.05 && (
                        <polygon
                          points={vNow > 0 ? `${cx + 14},40 ${cx + 8},35 ${cx + 8},45` : `${cx - 14},40 ${cx - 8},35 ${cx - 8},45`}
                          fill={color}
                        />
                      )}
                      <text x={cx} y="18" textAnchor="middle" fill="white" fontSize="11" fontWeight="600">{format(sNow)}</text>
                    </>
                  )
                })()}
              </svg>
            </div>
          </LabCard>

          {/* s(t) graph */}
          <LabCard dark className="rounded-[1.9rem]">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-paper/45">Posición</p>
            <h3 className="mt-2 font-display text-xl">{sc.sLabel}</h3>
            <div className="mt-3 rounded-[1.3rem] border border-white/10 bg-white/6 p-3">
              <CartesianFrame xMin={0} xMax={sc.tMax} yMin={sMin} yMax={sMax} xTicks={ticks(0, sc.tMax)} yTicks={ticks(sMin, sMax)} xLabel="t (s)" yLabel="s(t) (m)">
                {({ scaleX, scaleY }) => (
                  <>
                    <path d={linePath(sPoints, scaleX, scaleY)} fill="none" stroke="rgba(80,150,255,0.9)" strokeWidth="3" strokeLinecap="round" />
                    <circle cx={scaleX(time)} cy={scaleY(sNow)} r="6" fill="#5096ff" stroke="white" strokeWidth="2" />
                    <line x1={scaleX(time)} y1={scaleY(sNow) + 8} x2={scaleX(time)} y2={scaleY(sMin)} stroke="rgba(80,150,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
                  </>
                )}
              </CartesianFrame>
            </div>
          </LabCard>

          {/* v(t) graph with shaded areas */}
          <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-paper/45">Velocidad e integrales</p>
            <h3 className="mt-2 font-display text-xl">{sc.vLabel} — intervalo [{format(left)}, {format(right)}]</h3>
            <div className="mt-3 rounded-[1.3rem] border border-white/10 bg-white/6 p-3">
              <CartesianFrame xMin={0} xMax={sc.tMax} yMin={vMin} yMax={vMax} xTicks={ticks(0, sc.tMax)} yTicks={ticks(vMin, vMax)} xLabel="t (s)" yLabel="v(t) (m/s)">
                {({ scaleX, scaleY, padding, height }) => (
                  <>
                    {/* Shaded areas */}
                    {vSegs.map((seg, i) => (
                      <path
                        key={`${seg.sign}-${i}`}
                        d={areaPath(seg.points, scaleX, scaleY)}
                        fill={seg.sign === 'pos' ? 'rgba(34,197,160,0.45)' : 'rgba(244,63,94,0.42)'}
                        stroke="none"
                      />
                    ))}
                    {/* v(t) curve */}
                    <path d={linePath(vPoints, scaleX, scaleY)} fill="none" stroke="rgba(199,244,100,0.95)" strokeWidth="3" strokeLinecap="round" />
                    {/* Current time marker */}
                    <circle cx={scaleX(time)} cy={scaleY(vNow)} r="5" fill="#c7f464" stroke="white" strokeWidth="2" />
                    {/* Interval bounds */}
                    <line x1={scaleX(left)} y1={padding} x2={scaleX(left)} y2={height - padding} stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeDasharray="6 6" />
                    <line x1={scaleX(right)} y1={padding} x2={scaleX(right)} y2={height - padding} stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeDasharray="6 6" />
                    {/* Zero crossings */}
                    {turnTimes.map((tz) => (
                      <circle key={tz} cx={scaleX(tz)} cy={scaleY(0)} r="4" fill="rgba(255,255,255,0.6)" stroke="white" strokeWidth="1" />
                    ))}
                  </>
                )}
              </CartesianFrame>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <MetricCard label="Posición actual" value={format(sNow)} detail={`s(${format(time)}) en ${sc.sLabel.split('(')[1]?.replace(')', '') || 'unidades'}`} />
              <MetricCard label="Velocidad actual" value={format(vNow)} detail={vNow > 0.01 ? 'Avanza (→)' : vNow < -0.01 ? 'Retrocede (←)' : 'Detenido'} />
              <MetricCard label="Desplazamiento" value={format(integ.net)} detail={`∫v(t)dt en [${format(left)}, ${format(right)}]`} />
              <MetricCard label="Distancia recorrida" value={format(integ.total)} detail={`∫|v(t)|dt en [${format(left)}, ${format(right)}]`} />
            </div>
          </LabCard>

          {/* Model + Download */}
          <div className="grid gap-4 xl:grid-cols-2">
            <LabCard title="Modelo">
              <div className="overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{sc.formula}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/60">
                Aceleración en t = {format(time)}: a = {format(aNow)} {sc.vLabel.includes('m/s') ? 'm/s²' : 'pisos/s²'}
              </p>
            </LabCard>
            <LabCard title="Descarga de datos">
              <button
                type="button"
                onClick={() => {
                  const rows = [['t', 's(t)', 'v(t)', 'a(t)']]
                  const n = Math.round(sc.tMax / 0.5) + 1
                  for (let i = 0; i < n; i++) {
                    const t = i * 0.5
                    rows.push([format(t), format(sc.s(t)), format(sc.v(t)), format(sc.a(t))])
                  }
                  downloadCsv(rows, `movimiento-recta-${sc.id}.csv`)
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

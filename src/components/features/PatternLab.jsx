import { useState } from 'react'
import { LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 1 — PATRONES ALGEBRAICOS
// ══════════════════════════════════════════════════════════════════════════════

const algebraicScenarios = [
  {
    id: 'cuadrados',
    label: 'Cuadrados perfectos',
    shortLabel: 'n²',
    formula: (n) => n * n,
    modelStr: 'T(n) = n^{2}',
    shape: 'grid',
    color: '#ff6b35',
    degree: 2,
    diffLabel: 'Cuadrática',
    derivation: [
      { step: '1', label: 'Observa la figura',        text: (n) => `Cuadrado de lado n. T(${n}) tiene ${n}×${n} puntos.` },
      { step: '2', label: 'Δ² constante → grado 2',  text: () => 'La segunda diferencia vale siempre 2 → polinomio de grado 2.' },
      { step: '3', label: 'Forma cuadrática',         text: () => 'T(n) = an²+bn+c. Con T(1)=1, T(2)=4, T(3)=9 → a=1, b=0, c=0.' },
      { step: '✓', label: 'Fórmula',                  text: () => 'T(n) = n²', highlight: true },
    ],
    reading: 'Cada cuadrado perfecto crece añadiendo un gnomon en L de (2n−1) puntos. La segunda diferencia Δ²=2 constante es señal inequívoca de relación cuadrática.',
    sumFormula: (n) => Math.round(n * (n + 1) * (2 * n + 1) / 6),
    sumStr: 'n(n+1)(2n+1)/6',
  },
  {
    id: 'triangulares',
    label: 'Números triangulares',
    shortLabel: 'n(n+1)/2',
    formula: (n) => (n * (n + 1)) / 2,
    modelStr: 'T(n) = frac(n(n+1), 2)',
    shape: 'staircase',
    color: '#5096ff',
    degree: 2,
    diffLabel: 'Cuadrática',
    derivation: [
      { step: '1', label: 'Cuenta los puntos',        text: (n) => `Escalón de ${n} filas: 1+2+…+${n} puntos.` },
      { step: '2', label: 'Truco del rectángulo',     text: (n) => `Dos triángulos forman un rectángulo ${n}×${n+1}.` },
      { step: '3', label: 'Divide entre 2',           text: (n) => `T(${n}) = ${n}×${n+1}/2 = ${(n*(n+1)/2)}.` },
      { step: '✓', label: 'Fórmula',                  text: () => 'T(n) = n(n+1)/2', highlight: true },
    ],
    reading: 'Los números triangulares acumulan los primeros n enteros. El truco del rectángulo pega dos triángulos para obtener n(n+1), y dividir entre 2 da la fórmula. Δ²=1 constante confirma grado 2.',
    sumFormula: (n) => { let s = 0; for (let i = 1; i <= n; i++) s += (i*(i+1))/2; return s },
    sumStr: 'n(n+1)(n+2)/6',
  },
  {
    id: 'impares',
    label: 'Números impares',
    shortLabel: '2n − 1',
    formula: (n) => 2 * n - 1,
    modelStr: 'T(n) = 2n − 1',
    shape: 'gnomon',
    color: '#22c55e',
    degree: 1,
    diffLabel: 'Lineal (aritmética)',
    derivation: [
      { step: '1', label: 'Δ¹ constante → grado 1', text: () => 'Primera diferencia = 2 siempre → progresión aritmética.' },
      { step: '2', label: 'Fórmula aritmética',      text: () => 'a₁=1, d=2 → T(n) = 1+(n−1)·2 = 2n−1.' },
      { step: '3', label: 'Conexión geométrica',     text: () => 'n²−(n−1)² = 2n−1: el gnomon L completa el cuadrado.' },
      { step: '✓', label: 'Fórmula',                 text: () => 'T(n) = 2n − 1', highlight: true },
    ],
    reading: 'Los impares forman los gnomons en L que apilados construyen cuadrados: 1+3+5+…+(2n−1) = n². Δ¹=2 constante: progresión aritmética pura, el patrón lineal más simple.',
    sumFormula: (n) => n * n,
    sumStr: 'n² (suma de los primeros n impares)',
  },
  {
    id: 'rectangulares',
    label: 'Números rectangulares',
    shortLabel: 'n(n+1)',
    formula: (n) => n * (n + 1),
    modelStr: 'T(n) = n(n+1)',
    shape: 'rect',
    color: '#a855f7',
    degree: 2,
    diffLabel: 'Cuadrática',
    derivation: [
      { step: '1', label: 'Observa la figura',      text: (n) => `Rectángulo de ${n} filas y ${n+1} columnas.` },
      { step: '2', label: 'Producto directo',        text: (n) => `T(${n}) = ${n}×${n+1} = ${n*(n+1)}.` },
      { step: '3', label: 'Relación con triangular', text: (n) => `T(${n}) = 2×T_△(${n}) = 2×${n*(n+1)/2} = ${n*(n+1)}.` },
      { step: '✓', label: 'Fórmula',                text: () => 'T(n) = n(n+1)', highlight: true },
    ],
    reading: 'Cada número rectangular es el doble del triangular correspondiente. Δ²=2 constante, igual que los cuadrados — ambas familias son cuadráticas y comparten el mismo "grado de curvatura".',
    sumFormula: (n) => { let s = 0; for (let i = 1; i <= n; i++) s += i*(i+1); return s },
    sumStr: 'n(n+1)(n+2)/3',
  },
]

// ── dot figures ────────────────────────────────────────────────────────────────
const D = (n) => n <= 4 ? 11 : n <= 6 ? 8 : 6
const G = (n) => n <= 4 ? 4  : n <= 6 ? 3 : 2

const Dots = ({ rows, cols, color, n }) => {
  const d = D(n); const g = G(n)
  const W = cols*(d+g)-g; const H = rows*(d+g)-g
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <circle key={`${r}-${c}`} cx={c*(d+g)+d/2} cy={r*(d+g)+d/2} r={d/2} fill={color} opacity={0.85} />
        ))
      )}
    </svg>
  )
}

const StaircaseDots = ({ n, color }) => {
  const d = D(n); const g = G(n)
  const W = n*(d+g)-g; const H = n*(d+g)-g
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {Array.from({ length: n }, (_, r) =>
        Array.from({ length: r+1 }, (_, c) => (
          <circle key={`${r}-${c}`} cx={c*(d+g)+d/2} cy={r*(d+g)+d/2} r={d/2} fill={color} opacity={0.85} />
        ))
      )}
    </svg>
  )
}

const GnomonDots = ({ n, color }) => {
  const d = D(n); const g = G(n)
  const W = n*(d+g)-g; const H = n*(d+g)-g
  const pts = [...Array.from({ length: n }, (_, r) => ({ r, c: 0 })), ...Array.from({ length: n-1 }, (_, c) => ({ r: 0, c: c+1 }))]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {pts.map(({ r, c }) => <circle key={`${r}-${c}`} cx={c*(d+g)+d/2} cy={r*(d+g)+d/2} r={d/2} fill={color} opacity={0.85} />)}
    </svg>
  )
}

const renderFigure = (sc, k) => {
  if (sc.shape === 'grid')      return <Dots rows={k} cols={k} color={sc.color} n={k} />
  if (sc.shape === 'rect')      return <Dots rows={k} cols={k+1} color={sc.color} n={k} />
  if (sc.shape === 'staircase') return <StaircaseDots n={k} color={sc.color} />
  if (sc.shape === 'gnomon')    return <GnomonDots n={k} color={sc.color} />
  return null
}

// ── diff table ─────────────────────────────────────────────────────────────────
const DiffTable = ({ scenario }) => {
  const terms = Array.from({ length: 6 }, (_, i) => scenario.formula(i+1))
  const d1 = terms.slice(1).map((v, i) => v - terms[i])
  const d2 = d1.slice(1).map((v, i) => v - d1[i])
  const C  = 'w-10 py-2 text-center'
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-ink/8">
            <th className="py-2 pr-3 text-left text-xs font-normal uppercase tracking-[0.18em] text-ink/75">n</th>
            {[1,2,3,4,5,6].map(n => <th key={n} className={`${C} font-mono text-[0.72rem] font-normal text-ink/75`}>{n}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-ink/6">
            <td className="py-2 pr-3 text-xs uppercase tracking-[0.14em] text-ink/75">T(n)</td>
            {terms.map((v,i) => <td key={i} className={`${C} font-mono text-sm font-semibold text-ink`}>{v}</td>)}
          </tr>
          <tr className={scenario.degree >= 2 ? 'border-b border-ink/6' : ''}>
            <td className="py-2 pr-3 text-xs uppercase tracking-[0.14em] text-[#5096ff]/80">Δ¹</td>
            <td className={`${C} text-ink/20 text-xs`}>—</td>
            {d1.map((v,i) => <td key={i} className={`${C} font-mono text-sm font-semibold text-[#5096ff]`}>{v>0?'+':''}{v}</td>)}
          </tr>
          {scenario.degree >= 2 && (
            <tr>
              <td className="py-2 pr-3 text-xs uppercase tracking-[0.14em] text-signal/80">Δ²</td>
              <td className={`${C} text-ink/20 text-xs`}>—</td><td className={`${C} text-ink/20 text-xs`}>—</td>
              {d2.map((v,i) => <td key={i} className={`${C} font-mono text-sm font-bold text-signal`}>{v>0?'+':''}{v}</td>)}
            </tr>
          )}
        </tbody>
      </table>
      <div className="mt-4 rounded-xl border border-ink/8 bg-ink/[0.03] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink/75">Diagnóstico</p>
        <p className="mt-1.5 text-base text-ink/75">
          {scenario.degree === 1
            ? <>Δ¹ constante = <strong className="text-[#5096ff]">{d1[0]}</strong> → aritmética · <strong className="text-ink">grado 1</strong></>
            : <>Δ² constante = <strong className="text-signal">{d2[0]}</strong> → cuadrática · <strong className="text-ink">grado 2</strong></>}
        </p>
      </div>
    </div>
  )
}

const StepRow = ({ step, label, text, highlight }) => (
  <div className={`flex items-start gap-3 rounded-xl px-4 py-3 ${highlight ? 'border border-signal/25 bg-signal/8' : 'bg-ink/[0.03]'}`}>
    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${highlight ? 'bg-signal text-white' : 'bg-ink/12 text-ink/75'}`}>{step}</span>
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-ink/75">{label}</p>
      <p className={`mt-0.5 text-base leading-7 ${highlight ? 'font-semibold text-signal' : 'text-ink/78'}`}>{text}</p>
    </div>
  </div>
)

const AlgebraicSection = () => {
  const [scenarioId, setScenarioId] = useState('cuadrados')
  const [n, setN] = useState(4)
  const sc    = algebraicScenarios.find(s => s.id === scenarioId)
  const value = sc.formula(n)
  const next  = sc.formula(n+1)
  const sum   = sc.sumFormula(n)
  const preview = n > 4 ? [1,2,3,4,n] : [1,2,3,4]

  return (
    <div className="space-y-5">
      {/* scenario selector */}
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-ink/75">Tipo de patrón</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {algebraicScenarios.map(s => (
            <button key={s.id} type="button" onClick={() => setScenarioId(s.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${s.id === scenarioId ? 'bg-signal text-white shadow-[0_4px_16px_rgba(255,107,53,0.32)]' : 'border border-ink/12 bg-white text-ink/65 hover:border-ink/25 hover:text-ink'}`}>
              {s.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* slider */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <SliderField id="n-alg" label="Término n" value={n} min={1} max={8} step={1} natural onChange={setN} />
        <div className="flex min-w-[7rem] flex-col items-center justify-center rounded-[1.3rem] border border-ink/10 bg-white px-6 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ink/75">T({n})</p>
          <p className="mt-1 font-display text-4xl font-bold leading-none" style={{ color: sc.color }}>{value}</p>
        </div>
      </div>

      {/* figures + diff table */}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <LabCard dark title={`Patrón figural — ${sc.label}`}>
          <p className="mt-2 text-xs leading-5 text-paper/80">Pulsa un término para seleccionarlo.</p>
          <div className="mt-5 flex flex-wrap items-end gap-5">
            {preview.map(k => (
              <button key={k} type="button" onClick={() => setN(k)}
                className={`flex flex-col items-center gap-2 rounded-xl p-2 transition-all ${k===n ? 'bg-white/18 ring-2 ring-white/35' : 'opacity-60 hover:opacity-85'}`}>
                <div className="flex items-center justify-center" style={{ minWidth: 24, minHeight: 24 }}>{renderFigure(sc, k)}</div>
                <span className="text-xs text-paper/80">T({k}) = {sc.formula(k)}</span>
              </button>
            ))}
          </div>
          {n > 1 && (
            <div className="mt-4 rounded-xl bg-paper/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-paper/80">De T({n-1}) a T({n})</p>
              <p className="mt-1 text-sm leading-6 text-paper/75">
                Se añaden <strong className="text-paper">{value - sc.formula(n-1)}</strong> puntos{sc.degree === 1 ? ' — diferencia constante.' : '.'}
              </p>
            </div>
          )}
        </LabCard>
        <LabCard title="Tabla de diferencias">
          <p className="mt-2 text-xs leading-5 text-ink/75">Diferencias sucesivas revelan el grado del patrón.</p>
          <div className="mt-4"><DiffTable scenario={sc} /></div>
        </LabCard>
      </div>

      {/* derivation */}
      <LabCard title={`Cómo se deduce T(n) — ${sc.label}`}>
        <div className="mt-4 space-y-2">
          {sc.derivation.map(d => <StepRow key={d.step} step={d.step} label={d.label} text={d.text(n)} highlight={d.highlight} />)}
        </div>
      </LabCard>

      {/* model + metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <ModelCard title="Fórmula general" expression={sc.modelStr} parameters={`n ∈ ℕ,  T(${n}) = ${value}`} conditions={`Grado ${sc.degree} — ${sc.diffLabel}`} />
        <div className="grid grid-cols-2 gap-3">
          <MetricCard dark={false} label={`T(${n})`} value={value} detail={`Término ${n}`} />
          <MetricCard dark={false} label={`T(${n+1})`} value={next} detail={`+${next-value} puntos`} />
          <MetricCard dark={false} label={`Suma T(1)…T(${n})`} value={sum} detail={sc.sumStr} />
          <MetricCard dark={false} label="Tipo" value={sc.diffLabel} detail={`Δ${sc.degree} constante`} />
        </div>
      </div>

      {/* reading */}
      <LabCard dark title="Lectura matemática">
        <div className="mt-4 space-y-4">
          <p className="text-base leading-8 text-paper/82">{sc.reading}</p>
          <p className="text-base leading-8 text-paper/82">
            La <strong className="text-paper">tabla de diferencias</strong> es la herramienta clave:{' '}
            Δ¹ constante → lineal; Δ² constante → cuadrático. En general, si la diferencia de orden k es constante,
            el patrón es un <strong className="text-paper">polinomio de grado k</strong>.
          </p>
        </div>
      </LabCard>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 2 — FIBONACCI Y RAZÓN ÁUREA
// ══════════════════════════════════════════════════════════════════════════════

const PHI = (1 + Math.sqrt(5)) / 2

const buildFib = (max) => {
  const seq = [1, 1]
  while (seq.length < max) seq.push(seq[seq.length-1] + seq[seq.length-2])
  return seq
}

const ALL_FIBS = buildFib(20)

const fmtFib = (x) => x > 1e9 ? x.toExponential(2) : String(x)

// Fibonacci spiral SVG — multi-color squares + correctly chained quarter-circle arcs
const FCOLORS = ['#ff6b35','#5096ff','#22c55e','#a855f7','#f59e0b','#06b6d4','#ec4899','#84cc16']

const FibSpiral = ({ n: nTerms }) => {
  const count = Math.min(nTerms, 8)
  if (count < 1) return null
  const fib = ALL_FIBS.slice(0, count)

  // Place squares in spiral order (grid units)
  const sqs = []
  let x0 = 0, y0 = 0, x1 = fib[0], y1 = fib[0]
  sqs.push({ lx: 0, ly: 0, s: fib[0] })
  if (count >= 2) {
    sqs.push({ lx: fib[0], ly: 0, s: fib[1] })
    x1 = fib[0]+fib[1]; y1 = Math.max(fib[0], fib[1])
  }
  for (let i = 2; i < count; i++) {
    const s = fib[i]; const dir = (i-2) % 4
    let nx, ny
    if (dir===0) { nx=x0;   ny=y1   }   // below
    if (dir===1) { nx=x0-s; ny=y0   }   // left
    if (dir===2) { nx=x0;   ny=y0-s }   // above
    if (dir===3) { nx=x1;   ny=y0   }   // right
    sqs.push({ lx: nx, ly: ny, s })
    x0=Math.min(x0,nx); y0=Math.min(y0,ny)
    x1=Math.max(x1,nx+s); y1=Math.max(y1,ny+s)
  }

  // Scale to fit viewBox
  const pad = 16
  const totalW = x1-x0; const totalH = y1-y0
  const sc = Math.min(260 / Math.max(totalW,totalH,1), 22)
  const W = totalW*sc + pad*2; const H = totalH*sc + pad*2
  const ox = -x0*sc + pad; const oy = -y0*sc + pad

  // Corner accessors
  const corner = (lx, ly, s, name) => {
    if (name==='TL') return [(lx)*sc+ox,   (ly)*sc+oy]
    if (name==='TR') return [(lx+s)*sc+ox, (ly)*sc+oy]
    if (name==='BL') return [(lx)*sc+ox,   (ly+s)*sc+oy]
    /* BR */         return [(lx+s)*sc+ox, (ly+s)*sc+oy]
  }

  // Arc parameters by phase (i % 4).
  // Forward chain: BL→TR→BL→TR... connecting arcs end-to-end.
  // sweep=1 keeps every arc on the interior quarter-turn of its square.
  const phases = [
    { start:'BL', end:'TR', sweep:1 },
    { start:'TL', end:'BR', sweep:1 },
    { start:'TR', end:'BL', sweep:1 },
    { start:'BR', end:'TL', sweep:1 },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-64">
      {/* colored squares */}
      {sqs.map(({ lx, ly, s }, i) => {
        const col = FCOLORS[i % FCOLORS.length]
        const [cx, cy] = corner(lx, ly, s, 'TL')
        const sw = s*sc; const sh = s*sc
        return (
          <g key={i}>
            <rect x={cx+0.5} y={cy+0.5} width={sw-1} height={sh-1}
              fill={col} fillOpacity={0.07 + i*0.015}
              stroke={col} strokeOpacity={0.55} strokeWidth={1.5} rx={3} />
            {sw > 20 && (
              <text
                x={cx + sw/2} y={cy + sh/2 + Math.min(sw*0.14, 5)}
                textAnchor="middle" dominantBaseline="middle"
                fill={col} fontSize={Math.min(sw*0.32, 14)} fontWeight="700" opacity={0.8}
              >{fib[i]}</text>
            )}
          </g>
        )
      })}
      {/* spiral arcs — each arc is one quarter-circle within its square */}
      {sqs.map(({ lx, ly, s }, i) => {
        const { start, end, sweep } = phases[i % 4]
        const [ax1, ay1] = corner(lx, ly, s, start)
        const [ax2, ay2] = corner(lx, ly, s, end)
        const r = s*sc
        const col = FCOLORS[i % FCOLORS.length]
        return (
          <path key={`arc-${i}`}
            d={`M ${ax1.toFixed(1)} ${ay1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${ax2.toFixed(1)} ${ay2.toFixed(1)}`}
            fill="none" stroke={col} strokeWidth={2.5} strokeOpacity={0.9}
            strokeLinecap="round"
          />
        )
      })}
      {/* index labels for small squares */}
      {sqs.map(({ lx, ly, s }, i) => {
        const col = FCOLORS[i % FCOLORS.length]
        const sw = s*sc
        if (sw > 20) return null // already has value label inside
        const [cx, cy] = corner(lx, ly, s, 'TL')
        return (
          <text key={`lbl-${i}`}
            x={cx + sw/2} y={cy - 4}
            textAnchor="middle" fill={col} fontSize={9} fontWeight="700" opacity={0.75}
          >{fib[i]}</text>
        )
      })}
    </svg>
  )
}

// Ratio convergence chart
const RatioChart = ({ ratios, color }) => {
  const W = 300; const H = 130; const pad = 26
  const n = ratios.length
  if (n < 2) return null
  const yMin = 1.0; const yMax = 2.2
  const sx = (i) => pad + (i / (n-1)) * (W - pad*2)
  const sy = (v) => H - pad - ((Math.min(v, yMax) - yMin) / (yMax - yMin)) * (H - pad*2)
  const line = ratios.map((v,i) => `${i===0?'M':'L'} ${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ')
  const phiY = sy(PHI)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <line x1={pad} y1={phiY} x2={W-pad} y2={phiY} stroke={color} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.5} />
      <text x={W-pad+2} y={phiY+3} fill={color} fontSize="8" opacity={0.65}>φ</text>
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {ratios.map((v,i) => <circle key={i} cx={sx(i)} cy={sy(v)} r={2.5} fill={color} />)}
      <line x1={pad} y1={pad} x2={pad} y2={H-pad} stroke="rgba(18,23,35,0.15)" strokeWidth={1} />
      <line x1={pad} y1={H-pad} x2={W-pad} y2={H-pad} stroke="rgba(18,23,35,0.15)" strokeWidth={1} />
      {[1.0,1.4,1.6,1.8,2.0].map(v => (
        <text key={v} x={pad-3} y={sy(v)+3} fill="rgba(18,23,35,0.4)" fontSize="7" textAnchor="end">{v.toFixed(1)}</text>
      ))}
      {ratios.map((_,i) => i%3===0 && <text key={i} x={sx(i)} y={H-pad+10} fill="rgba(18,23,35,0.4)" fontSize="7" textAnchor="middle">{i+2}</text>)}
    </svg>
  )
}

export const FibonacciSection = () => {
  const [n, setN] = useState(8)
  const active = ALL_FIBS.slice(0, n)
  const fn     = ALL_FIBS[n-1]
  const ratio  = n >= 2 ? ALL_FIBS[n-1] / ALL_FIBS[n-2] : null
  const error  = ratio ? Math.abs(ratio - PHI) : null
  const ratios = active.slice(1).map((v,i) => v / active[i])
  const d1     = active.slice(1).map((v,i) => v - active[i])
  const d2     = d1.slice(1).map((v,i) => v - d1[i])
  const C      = 'w-10 py-2 text-center'

  return (
    <div className="space-y-5">
      {/* slider */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <SliderField id="n-fib" label="Número de términos" value={n} min={2} max={15} step={1} natural onChange={setN} />
        <div className="flex min-w-[7rem] flex-col items-center justify-center rounded-[1.3rem] border border-ink/10 bg-white px-6 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ink/75">F({n})</p>
          <p className="mt-1 font-display text-4xl font-bold leading-none text-signal">{fmtFib(fn)}</p>
        </div>
      </div>

      {/* sequence + spiral */}
      <div className="grid gap-5 lg:grid-cols-2">
        <LabCard dark title="Sucesión de Fibonacci">
          <p className="mt-2 text-xs leading-5 text-paper/80">F(1)=1, F(2)=1, F(n) = F(n−1)+F(n−2)</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {active.map((v,i) => (
              <div key={i} className={`flex flex-col items-center rounded-xl px-3 py-2 ${i===n-1 ? 'border border-signal/40 bg-signal/20' : 'border border-white/10 bg-white/8'}`}>
                <span className="text-[0.72rem] text-paper/80">F({i+1})</span>
                <span className={`font-mono text-sm font-semibold ${i===n-1 ? 'text-signal' : 'text-paper/85'}`}>{fmtFib(v)}</span>
              </div>
            ))}
          </div>
          {n >= 3 && (
            <div className="mt-4 rounded-xl bg-paper/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-paper/80">Regla</p>
              <p className="mt-1 font-mono text-sm text-paper/80">F({n}) = F({n-1})+F({n-2}) = {ALL_FIBS[n-2]}+{ALL_FIBS[n-3]} = {fn}</p>
            </div>
          )}
        </LabCard>
        <LabCard title="Espiral de Fibonacci">
          <p className="mt-2 text-xs leading-5 text-ink/75">Cuadrados de lado F(k) — la curva se aproxima a la espiral áurea.</p>
          <div className="mt-4 flex items-center justify-center rounded-xl bg-ink/[0.03] p-3">
            <FibSpiral n={n} />
          </div>
        </LabCard>
      </div>

      {/* ratio convergence */}
      <LabCard title="Convergencia a la razón áurea φ">
        <p className="mt-2 text-xs leading-5 text-ink/75">La razón F(n+1)/F(n) se acerca a φ = (1+√5)/2 ≈ 1.61803…</p>
        <div className="mt-4 grid gap-5 md:grid-cols-[1.5fr_0.5fr]">
          <RatioChart ratios={ratios} color="#5096ff" />
          <div className="space-y-3">
            <div className="rounded-xl border border-[#5096ff]/25 bg-[#5096ff]/8 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[#5096ff]/65">Razón actual</p>
              <p className="mt-1 font-mono text-lg font-bold text-ink">{ratio ? ratio.toFixed(6) : '—'}</p>
            </div>
            <div className="rounded-xl border border-ink/10 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-ink/75">Error |r−φ|</p>
              <p className="mt-1 font-mono text-base font-semibold text-signal">{error ? (error<1e-6 ? error.toExponential(2) : error.toFixed(6)) : '—'}</p>
            </div>
          </div>
        </div>
      </LabCard>

      {/* diff table */}
      <LabCard title="Tabla de diferencias — contraste con patrones polinomiales">
        <p className="mt-2 text-xs leading-5 text-ink/75">Aquí ninguna diferencia se vuelve constante — crecimiento exponencial, no polinomial.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-ink/8">
                <th className="py-2 pr-3 text-left text-xs font-normal uppercase tracking-[0.18em] text-ink/75">n</th>
                {active.slice(0,8).map((_,i) => <th key={i} className={`${C} font-mono text-[0.72rem] font-normal text-ink/75`}>{i+1}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-ink/6">
                <td className="py-2 pr-3 text-xs uppercase tracking-[0.14em] text-ink/75">F(n)</td>
                {active.slice(0,8).map((v,i) => <td key={i} className={`${C} font-mono text-sm font-semibold text-ink`}>{v}</td>)}
              </tr>
              <tr className="border-b border-ink/6">
                <td className="py-2 pr-3 text-xs uppercase tracking-[0.14em] text-[#5096ff]/80">Δ¹</td>
                <td className={`${C} text-ink/20 text-xs`}>—</td>
                {d1.slice(0,7).map((v,i) => <td key={i} className={`${C} font-mono text-sm text-[#5096ff]`}>+{v}</td>)}
              </tr>
              <tr>
                <td className="py-2 pr-3 text-xs uppercase tracking-[0.14em] text-signal/80">Δ²</td>
                <td className={`${C} text-ink/20 text-xs`}>—</td><td className={`${C} text-ink/20 text-xs`}>—</td>
                {d2.slice(0,6).map((v,i) => <td key={i} className={`${C} font-mono text-sm text-signal`}>+{v}</td>)}
              </tr>
            </tbody>
          </table>
          <div className="mt-4 rounded-xl border border-ink/8 bg-ink/[0.03] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/75">Diagnóstico</p>
            <p className="mt-1.5 text-base text-ink/75">Δ¹ y Δ² <strong className="text-ink">nunca se estabilizan</strong> — Fibonacci crece <strong className="text-ink">exponencialmente</strong> ≈ φⁿ/√5.</p>
          </div>
        </div>
      </LabCard>

      {/* model + metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <ModelCard title="Definición recursiva" expression="F(n) = F(n−1) + F(n−2)" parameters="F(1) = 1,  F(2) = 1" conditions="n ≥ 3,  n ∈ ℕ" />
          <ModelCard title="Fórmula de Binet" expression="F(n) = frac(φⁿ − ψⁿ, √5)" parameters="φ = (1+√5)/2 ≈ 1.618,  ψ = (1−√5)/2 ≈ −0.618" conditions="Forma cerrada sin recursión" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard dark={false} label={`F(${n})`} value={fmtFib(fn)} detail={`Término ${n}`} />
          <MetricCard dark={false} label="Razón F(n)/F(n−1)" value={ratio ? ratio.toFixed(5) : '—'} detail="→ φ al crecer n" />
          <MetricCard dark={false} label="φ (razón áurea)" value="1.61803…" detail="(1+√5)/2" />
          <MetricCard dark={false} label="Error vs φ" value={error ? (error<1e-6 ? error.toExponential(1) : error.toFixed(5)) : '—'} detail="Convergencia exponencial" />
        </div>
      </div>

      {/* reading */}
      <LabCard dark title="Lectura matemática">
        <div className="mt-4 space-y-4">
          <p className="text-base leading-8 text-paper/82">
            Fibonacci es el ejemplo más famoso de patrón <strong className="text-paper">recursivo</strong>: cada término depende de los dos anteriores.
            A diferencia de los patrones polinomiales, la tabla de diferencias <strong className="text-paper">nunca se estabiliza</strong> — señal de crecimiento <strong className="text-paper">exponencial</strong>.
          </p>
          <p className="text-base leading-8 text-paper/82">
            La <strong className="text-paper">razón áurea φ ≈ 1.61803</strong> aparece como límite de F(n+1)/F(n).
            La fórmula de Binet muestra que F(n) ≈ φⁿ/√5 — una función exponencial disfrazada de sucesión entera.
            En la naturaleza, φ aparece en espirales de girasoles y conchas porque optimiza el empaquetamiento.
          </p>
        </div>
      </LabCard>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — TABS
// ══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'algebraicos', label: 'Patrones algebraicos', sub: 'Figuras · tabla de diferencias · fórmula' },
  { id: 'fibonacci',   label: 'Fibonacci y razón áurea', sub: 'Recursión · espiral · convergencia a φ' },
]

export const PatternLab = () => {
  const [tab, setTab] = useState('algebraicos')

  return (
    <div className="p-4 md:p-6">
      {/* tab selector */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-[1.3rem] border px-5 py-4 text-left transition-all ${
              t.id === tab
                ? 'border-signal/30 bg-signal/8 shadow-[0_4px_20px_rgba(255,107,53,0.14)]'
                : 'border-ink/10 bg-white hover:border-ink/20'
            }`}
          >
            <p className={`text-sm font-bold ${t.id === tab ? 'text-signal' : 'text-ink'}`}>{t.label}</p>
            <p className="mt-0.5 text-xs text-ink/75">{t.sub}</p>
          </button>
        ))}
      </div>

      {tab === 'algebraicos' && <AlgebraicSection />}
      {tab === 'fibonacci'   && <FibonacciSection />}
    </div>
  )
}

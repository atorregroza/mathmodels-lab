import { useState } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { LiveFormula } from './LiveFormula'
import { downloadCsv, generateTicks } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

// ── math core ─────────────────────────────────────────────────────────────────
const solve = (a1, b1, c1, a2, b2, c2) => {
  const det = a1 * b2 - a2 * b1
  if (Math.abs(det) < 1e-9) return null
  return {
    x: (c1 * b2 - c2 * b1) / det,
    y: (a1 * c2 - a2 * c1) / det,
    det,
    detX: c1 * b2 - c2 * b1,
    detY: a1 * c2 - a2 * c1,
  }
}

const systemClass = (a1, b1, c1, a2, b2, c2) => {
  const det = a1 * b2 - a2 * b1
  if (Math.abs(det) > 1e-9) return 'determinado'
  const r1 = Math.abs(b1) > 1e-9 ? c1 / b1 : Math.abs(a1) > 1e-9 ? c1 / a1 : null
  const r2 = Math.abs(b2) > 1e-9 ? c2 / b2 : Math.abs(a2) > 1e-9 ? c2 / a2 : null
  return r1 !== null && r2 !== null && Math.abs(r1 - r2) < 1e-6 ? 'indeterminado' : 'incompatible'
}

const fmt = (v) => {
  if (!Number.isFinite(v)) return '?'
  if (v % 1 === 0) return String(Math.round(v))
  return v.toFixed(2)
}

// ── inline fraction for step-by-step display ─────────────────────────────────
// Renders num / den as a proper vertical fraction (no "/" slash ever)
const FracStep = ({ num, den }) => (
  <span className="mx-1 inline-flex flex-col items-center align-middle leading-none">
    <span className="border-b border-current px-1.5 pb-[1px] text-[0.85em] leading-snug">{num}</span>
    <span className="px-1.5 pt-[1px] text-[0.85em] leading-snug">{den}</span>
  </span>
)

// ── step-by-step solution renderer ───────────────────────────────────────────
const Step = ({ n, title, lines }) => (
  <div className="rounded-[1rem] border border-ink/8 bg-paper px-4 py-3">
    <p className="text-[0.65rem] uppercase tracking-[0.22em] text-ink/40">Paso {n} — {title}</p>
    <div className="mt-2 space-y-2">
      {lines.map((line, i) => (
        <p key={i} className={`font-mono text-base leading-8 ${line.highlight ? 'font-bold text-signal' : 'text-ink/75'}`}>
          {line.text}
        </p>
      ))}
    </div>
  </div>
)

const SolutionSteps = ({ method, a1, b1, c1, a2, b2, c2, sol }) => {
  const det  = a1 * b2 - a2 * b1
  const noSol = sol === null

  if (noSol) {
    return (
      <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        det = {fmt(det)} = 0 → el sistema no tiene solución única.
      </div>
    )
  }

  // ── Cramer ────────────────────────────────────────────────────────────────
  if (method === 'cramer') {
    return (
      <div className="space-y-3">
        <Step n={1} title="Determinante principal" lines={[
          { text: 'det = a₁b₂ − a₂b₁' },
          { text: `det = (${fmt(a1)})(${fmt(b2)}) − (${fmt(a2)})(${fmt(b1)})` },
          { text: `det = ${fmt(a1 * b2)} − ${fmt(a2 * b1)} = ${fmt(det)}`, highlight: true },
        ]} />
        <Step n={2} title="Determinante detₓ" lines={[
          { text: 'detₓ = c₁b₂ − c₂b₁' },
          { text: `detₓ = (${fmt(c1)})(${fmt(b2)}) − (${fmt(c2)})(${fmt(b1)})` },
          { text: `detₓ = ${fmt(c1 * b2)} − ${fmt(c2 * b1)} = ${fmt(sol.detX)}` },
        ]} />
        <Step n={3} title="Determinante detᵧ" lines={[
          { text: 'detᵧ = a₁c₂ − a₂c₁' },
          { text: `detᵧ = (${fmt(a1)})(${fmt(c2)}) − (${fmt(a2)})(${fmt(c1)})` },
          { text: `detᵧ = ${fmt(a1 * c2)} − ${fmt(a2 * c1)} = ${fmt(sol.detY)}` },
        ]} />
        <Step n={4} title="Solución por Cramer" lines={[
          {
            text: (
              <span className="inline-flex flex-wrap items-center gap-0.5">
                x = <FracStep num={`detₓ = ${fmt(sol.detX)}`} den={`det = ${fmt(det)}`} />
                = {fmt(sol.x)}
              </span>
            ),
            highlight: true,
          },
          {
            text: (
              <span className="inline-flex flex-wrap items-center gap-0.5">
                y = <FracStep num={`detᵧ = ${fmt(sol.detY)}`} den={`det = ${fmt(det)}`} />
                = {fmt(sol.y)}
              </span>
            ),
            highlight: true,
          },
        ]} />
      </div>
    )
  }

  // ── Sustitución ───────────────────────────────────────────────────────────
  if (method === 'sustitucion') {
    const despeje  = Math.abs(b1) > 1e-9   // true → isolate y from eq1
    const despVar  = despeje ? 'y' : 'x'
    const otroVar  = despeje ? 'x' : 'y'
    const numVar   = despeje ? a1 : b1     // numerator coefficient
    const denVar   = despeje ? b1 : a1     // denominator coefficient

    const coefOtro = despeje
      ? a2 - (b2 * a1) / b1
      : b2 - (a2 * b1) / a1
    const rhs2     = despeje
      ? c2 - (b2 * c1) / b1
      : c2 - (a2 * c1) / a1

    // Value found in step 3 is for otroVar
    const solOtro  = despeje ? sol.x : sol.y
    // Value found in step 4 is for despVar
    const solDesp  = despeje ? sol.y : sol.x

    return (
      <div className="space-y-3">
        <Step n={1} title={`Despeja ${despVar} de Ec. 1`} lines={[
          { text: `${fmt(a1)}x + ${fmt(b1)}y = ${fmt(c1)}` },
          {
            text: (
              <span className="inline-flex flex-wrap items-center gap-0.5">
                {despVar} =
                <FracStep num={`${fmt(c1)} − ${fmt(numVar)}·${otroVar}`} den={fmt(denVar)} />
              </span>
            ),
          },
        ]} />
        <Step n={2} title="Sustituye en Ec. 2" lines={[
          { text: `${fmt(a2)}x + ${fmt(b2)}y = ${fmt(c2)}` },
          { text: `Coef. de ${otroVar} resultante: ${fmt(coefOtro)}` },
          { text: `${fmt(coefOtro)}·${otroVar} = ${fmt(rhs2)}` },
        ]} />
        <Step n={3} title={`Despeja ${otroVar}`} lines={[
          {
            text: (
              <span className="inline-flex flex-wrap items-center gap-0.5">
                {otroVar} = <FracStep num={fmt(rhs2)} den={fmt(coefOtro)} /> = {fmt(solOtro)}
              </span>
            ),
            highlight: true,
          },
        ]} />
        <Step n={4} title="Retro-sustitución" lines={[
          {
            text: (
              <span className="inline-flex flex-wrap items-center gap-0.5">
                {despVar} =
                <FracStep num={`${fmt(c1)} − ${fmt(numVar)}·(${fmt(solOtro)})`} den={fmt(denVar)} />
                = {fmt(solDesp)}
              </span>
            ),
            highlight: true,
          },
        ]} />
      </div>
    )
  }

  // ── Eliminación ───────────────────────────────────────────────────────────
  const factor1 = Math.abs(a2) > 1e-9 ? a2 : 1
  const factor2 = Math.abs(a1) > 1e-9 ? a1 : 1
  const elimA1 = a1 * factor1, elimB1 = b1 * factor1, elimC1 = c1 * factor1
  const elimA2 = a2 * factor2, elimB2 = b2 * factor2, elimC2 = c2 * factor2
  const elimB  = elimB1 - elimB2
  const elimC  = elimC1 - elimC2

  return (
    <div className="space-y-3">
      <Step n={1} title="Multiplica para igualar coef. de x" lines={[
        { text: `Ec.1 × ${fmt(factor1)}: ${fmt(elimA1)}x + ${fmt(elimB1)}y = ${fmt(elimC1)}` },
        { text: `Ec.2 × ${fmt(factor2)}: ${fmt(elimA2)}x + ${fmt(elimB2)}y = ${fmt(elimC2)}` },
      ]} />
      <Step n={2} title="Resta las ecuaciones → elimina x" lines={[
        { text: `(${fmt(elimB1)} − ${fmt(elimB2)})y = ${fmt(elimC1)} − ${fmt(elimC2)}` },
        { text: `${fmt(elimB)}y = ${fmt(elimC)}` },
      ]} />
      <Step n={3} title="Despeja y" lines={[
        {
          text: (
            <span className="inline-flex flex-wrap items-center gap-0.5">
              y = <FracStep num={fmt(elimC)} den={fmt(elimB)} /> = {fmt(sol.y)}
            </span>
          ),
          highlight: true,
        },
      ]} />
      <Step n={4} title="Sustituye en Ec. 1 para x" lines={[
        { text: `${fmt(a1)}x + ${fmt(b1)}·(${fmt(sol.y)}) = ${fmt(c1)}` },
        {
          text: (
            <span className="inline-flex flex-wrap items-center gap-0.5">
              x = <FracStep num={`${fmt(c1)} − ${fmt(b1 * sol.y)}`} den={fmt(a1)} /> = {fmt(sol.x)}
            </span>
          ),
          highlight: true,
        },
      ]} />
    </div>
  )
}

// ── scenario scenes (SVG) ─────────────────────────────────────────────────────
// Shows trains at t=0 (initial positions), meeting point marked with a pin
const EncuentroScene = ({ D, v1, v2, sol }) => {
  const meetPct = sol ? sol.y / D : 0.5   // sol.y = distance from A to meeting point

  return (
    <svg viewBox="0 0 520 120" className="w-full h-auto">
      {/* track */}
      <rect x="40" y="64" width="440" height="6" rx="3" fill="rgba(18,23,35,0.12)" />

      {/* City A */}
      <line x1="40" y1="56" x2="40" y2="70" stroke="rgba(18,23,35,0.28)" strokeWidth="2" />
      <text x="40" y="48" textAnchor="middle" fontSize="11" fill="rgba(18,23,35,0.50)" fontFamily="system-ui">Ciudad A</text>

      {/* City B */}
      <line x1="480" y1="56" x2="480" y2="70" stroke="rgba(18,23,35,0.28)" strokeWidth="2" />
      <text x="480" y="48" textAnchor="middle" fontSize="11" fill="rgba(18,23,35,0.50)" fontFamily="system-ui">Ciudad B</text>

      {/* Distance label */}
      <text x="260" y="92" textAnchor="middle" fontSize="10" fill="rgba(18,23,35,0.30)" fontFamily="system-ui">{fmt(D)} km</text>

      {/* Train A — starts at left, travels right */}
      <g transform="translate(16, 36)">
        <rect x="0" y="0" width="52" height="24" rx="6" fill="#ff6b35" />
        <rect x="6"  y="5" width="11" height="11" rx="2" fill="rgba(255,255,255,0.52)" />
        <rect x="21" y="5" width="11" height="11" rx="2" fill="rgba(255,255,255,0.52)" />
        <circle cx="13"  cy="28" r="5" fill="rgba(18,23,35,0.28)" />
        <circle cx="40"  cy="28" r="5" fill="rgba(18,23,35,0.28)" />
        {/* front arrow */}
        <polygon points="52,8 62,12 52,16" fill="#ff6b35" />
      </g>
      <text x="42" y="26" textAnchor="start" fontSize="10" fill="#ff6b35" fontWeight="700" fontFamily="system-ui">
        {fmt(v1)} km/h →
      </text>

      {/* Train B — starts at right, travels left */}
      <g transform="translate(468, 36) scale(-1,1) translate(-52,0)">
        <rect x="0" y="0" width="52" height="24" rx="6" fill="rgba(100,160,255,0.92)" />
        <rect x="6"  y="5" width="11" height="11" rx="2" fill="rgba(255,255,255,0.52)" />
        <rect x="21" y="5" width="11" height="11" rx="2" fill="rgba(255,255,255,0.52)" />
        <circle cx="13"  cy="28" r="5" fill="rgba(18,23,35,0.28)" />
        <circle cx="40"  cy="28" r="5" fill="rgba(18,23,35,0.28)" />
        <polygon points="52,8 62,12 52,16" fill="rgba(100,160,255,0.9)" />
      </g>
      <text x="478" y="26" textAnchor="end" fontSize="10" fill="rgba(60,140,255,1)" fontWeight="700" fontFamily="system-ui">
        ← {fmt(v2)} km/h
      </text>

      {/* Meeting point */}
      {sol && (
        <>
          {/* dashed vertical */}
          <line
            x1={40 + meetPct * 440} y1="36"
            x2={40 + meetPct * 440} y2="95"
            stroke="#ff6b35" strokeWidth="1.5" strokeDasharray="4 3"
          />
          {/* pin circle */}
          <circle cx={40 + meetPct * 440} cy="65" r="6" fill="white" stroke="#ff6b35" strokeWidth="2.5" />
          <circle cx={40 + meetPct * 440} cy="65" r="2.5" fill="#ff6b35" />
          {/* labels */}
          <text
            x={Math.min(40 + meetPct * 440 + 8, 440)}
            y="108"
            textAnchor="middle" fontSize="10" fill="rgba(18,23,35,0.60)" fontFamily="monospace"
          >
            t = {fmt(sol.x)} h · d = {fmt(sol.y)} km
          </text>
        </>
      )}
    </svg>
  )
}

const MezclaScene = ({ V, p1, p2, pT, sol }) => {
  const x    = sol ? sol.x : V / 2
  const y    = sol ? sol.y : V / 2
  const pctX = Math.min(1, Math.max(0, x / V))
  const pctY = Math.min(1, Math.max(0, y / V))

  return (
    <svg viewBox="0 0 480 130" className="w-full h-auto">
      {/* Beaker A */}
      <rect x="50" y="20" width="80" height="90" rx="6" fill="rgba(255,107,53,0.10)" stroke="rgba(255,107,53,0.38)" strokeWidth="2" />
      <rect x="54" y={20 + (1 - pctX) * 84} width="72" height={pctX * 84} rx="3" fill="rgba(255,107,53,0.28)" />
      <text x="90" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="rgba(255,107,53,0.9)" fontFamily="system-ui">Sol. A</text>
      <text x="90" y="76" textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(255,107,53,1)" fontFamily="system-ui">{fmt(p1)}%</text>
      <text x="90" y="120" textAnchor="middle" fontSize="10" fill="rgba(18,23,35,0.44)" fontFamily="system-ui">{fmt(x)} L</text>

      {/* Beaker B */}
      <rect x="180" y="20" width="80" height="90" rx="6" fill="rgba(120,180,255,0.10)" stroke="rgba(120,180,255,0.42)" strokeWidth="2" />
      <rect x="184" y={20 + (1 - pctY) * 84} width="72" height={pctY * 84} rx="3" fill="rgba(120,180,255,0.28)" />
      <text x="220" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="rgba(80,150,255,0.9)" fontFamily="system-ui">Sol. B</text>
      <text x="220" y="76" textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(80,150,255,1)" fontFamily="system-ui">{fmt(p2)}%</text>
      <text x="220" y="120" textAnchor="middle" fontSize="10" fill="rgba(18,23,35,0.44)" fontFamily="system-ui">{fmt(y)} L</text>

      {/* combine arrows */}
      <text x="275" y="68" textAnchor="middle" fontSize="18" fill="rgba(18,23,35,0.25)" fontFamily="system-ui">+</text>
      <path d="M 135 65 L 300 65" stroke="rgba(18,23,35,0.16)" strokeWidth="1.5" />
      <path d="M 265 65 L 300 65" stroke="rgba(18,23,35,0.16)" strokeWidth="1.5" />

      {/* Flask */}
      <path d="M 310 20 L 310 60 L 290 110 L 380 110 L 360 60 L 360 20 Z"
        fill="rgba(18,23,35,0.05)" stroke="rgba(18,23,35,0.22)" strokeWidth="2" />
      <path d="M 310 60 L 290 110 L 380 110 L 360 60 Z"
        fill="rgba(100,165,120,0.22)" />
      <text x="335" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="rgba(18,23,35,0.52)" fontFamily="system-ui">Mezcla</text>
      <text x="335" y="78" textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(60,140,100,1)" fontFamily="system-ui">{fmt(pT)}%</text>
      <text x="335" y="120" textAnchor="middle" fontSize="10" fill="rgba(18,23,35,0.44)" fontFamily="system-ui">{fmt(V)} L total</text>
    </svg>
  )
}

const MercadoScene = ({ mS, bS, mD, bD, sol }) => {
  const qMax = 15
  const pMax = 30
  const toX  = (q) => 40 + (q / qMax) * 360
  const toY  = (p) => 110 - (p / pMax) * 90
  const supPts = [[0, bS], [qMax, mS * qMax + bS]].filter(([, p]) => p >= 0 && p <= pMax)
  const demPts = [[0, bD], [qMax, mD * qMax + bD]].filter(([, p]) => p >= 0 && p <= pMax)

  return (
    <svg viewBox="0 0 440 130" className="w-full h-auto">
      <line x1="40" y1="10" x2="40" y2="115" stroke="rgba(18,23,35,0.28)" strokeWidth="1.5" />
      <line x1="35" y1="115" x2="405" y2="115" stroke="rgba(18,23,35,0.28)" strokeWidth="1.5" />
      <text x="220" y="128" textAnchor="middle" fontSize="10" fill="rgba(18,23,35,0.40)" fontFamily="system-ui">Cantidad (q)</text>
      <text x="15" y="65" textAnchor="middle" fontSize="10" fill="rgba(18,23,35,0.40)" fontFamily="system-ui" transform="rotate(-90,15,65)">Precio (p)</text>
      {supPts.length >= 2 && (
        <line x1={toX(supPts[0][0])} y1={toY(supPts[0][1])}
          x2={toX(supPts[1][0])} y2={toY(supPts[1][1])}
          stroke="rgba(255,107,53,0.85)" strokeWidth="2.5" />
      )}
      <text x="398" y={toY(mS * qMax + bS) + 4} fontSize="10" fill="rgba(255,107,53,0.8)" fontFamily="system-ui">Oferta</text>
      {demPts.length >= 2 && (
        <line x1={toX(demPts[0][0])} y1={toY(demPts[0][1])}
          x2={toX(demPts[1][0])} y2={toY(demPts[1][1])}
          stroke="rgba(80,150,255,0.85)" strokeWidth="2.5" />
      )}
      <text x="398" y={toY(mD * qMax + bD) + 4} fontSize="10" fill="rgba(80,150,255,0.8)" fontFamily="system-ui">Demanda</text>
      {sol && sol.x > 0 && sol.x < qMax && sol.y > 0 && sol.y < pMax && (
        <>
          <line x1={toX(sol.x)} y1={115} x2={toX(sol.x)} y2={toY(sol.y)}
            stroke="rgba(18,23,35,0.14)" strokeWidth="1" strokeDasharray="3 2" />
          <line x1={40} y1={toY(sol.y)} x2={toX(sol.x)} y2={toY(sol.y)}
            stroke="rgba(18,23,35,0.14)" strokeWidth="1" strokeDasharray="3 2" />
          <circle cx={toX(sol.x)} cy={toY(sol.y)} r={6} fill="white" stroke="rgba(18,23,35,0.45)" strokeWidth="2" />
          <text x={toX(sol.x) + 10} y={toY(sol.y) - 6} fontSize="10" fontWeight="700"
            fill="rgba(18,23,35,0.55)" fontFamily="monospace">
            q*={fmt(sol.x)}, p*={fmt(sol.y)}
          </text>
        </>
      )}
    </svg>
  )
}

// ── scenarios config ──────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'encuentro',
    label: 'Encuentro de trenes',
    icon: '🚂',
    context: 'Dos trenes parten simultáneamente en sentidos opuestos. El tren A sale de la ciudad A a v₁ km/h; el B sale de la ciudad B a v₂ km/h. ¿Cuándo y dónde se encuentran?',
    guideQuestion: '¿Qué representa x en este sistema? ¿Qué significa det = 0 en este contexto real?',
    varX: 'Tiempo de encuentro t (h)',
    varY: 'Distancia desde A al punto de encuentro d (km)',
    readingFn: (sol) => sol
      ? `Los trenes se encuentran a las ${fmt(sol.x)} horas de haber partido, a ${fmt(sol.y)} km de la Ciudad A. La ecuación 1 modela la posición del tren A (d = v₁·t) y la ecuación 2 la del tren B (d = D − v₂·t). El sistema tiene solución única porque los trenes se mueven en sentidos opuestos (det ≠ 0).`
      : 'Con los parámetros actuales el sistema no tiene solución única.',
  },
  {
    id: 'mezcla',
    label: 'Mezcla de soluciones',
    icon: '🧪',
    context: 'Se mezclan x litros de una solución al p₁% con y litros al p₂% para obtener V litros totales al pT%.',
    guideQuestion: '¿Por qué una ecuación controla el volumen y otra la concentración?',
    varX: 'Litros de solución A (x)',
    varY: 'Litros de solución B (y)',
    readingFn: (sol, sc) => sol
      ? `Se necesitan ${fmt(sol.x)} litros de la solución A (${fmt(sc.p1)}%) y ${fmt(sol.y)} litros de la solución B (${fmt(sc.p2)}%) para obtener ${fmt(sc.V)} litros al ${fmt(sc.pT)}%. La primera ecuación garantiza el volumen total (x + y = V); la segunda balancea el soluto.`
      : 'Con estos parámetros no existe mezcla posible.',
  },
  {
    id: 'mercado',
    label: 'Equilibrio de mercado',
    icon: '📈',
    context: 'La oferta sube con el precio (pendiente positiva) y la demanda baja (pendiente negativa). El equilibrio es donde ambas coinciden.',
    guideQuestion: '¿Qué ocurre si la pendiente de oferta iguala la de demanda? ¿Existe equilibrio?',
    varX: 'Cantidad de equilibrio q*',
    varY: 'Precio de equilibrio p*',
    readingFn: (sol) => sol && sol.x > 0 && sol.y > 0
      ? `El mercado alcanza el equilibrio en q* = ${fmt(sol.x)} unidades a un precio p* = ${fmt(sol.y)}. Por encima de p* hay exceso de oferta; por debajo, escasez.`
      : 'No existe equilibrio de mercado con los parámetros actuales.',
  },
  {
    id: 'libre',
    label: 'Modo libre',
    icon: '⚙️',
    context: 'Ajusta libremente los coeficientes de ambas ecuaciones y explora la geometría del sistema.',
    guideQuestion: 'Busca la configuración donde det = 0. ¿Las rectas son paralelas o coincidentes?',
    varX: 'Variable x',
    varY: 'Variable y',
    readingFn: (sol) => sol
      ? `La solución x = ${fmt(sol.x)}, y = ${fmt(sol.y)} satisface ambas ecuaciones. El determinante det = ${fmt(sol.det)} ≠ 0 garantiza que las rectas se cortan exactamente en un punto.`
      : 'det = 0: las rectas son paralelas (incompatible) o coincidentes (indeterminado).',
  },
]

// ── main component ────────────────────────────────────────────────────────────
export const SystemsOfEquationsLab = () => {
  const [scenarioId, setScenarioId] = useState('encuentro')
  const [method, setMethod]         = useState('cramer')

  // Encuentro params
  const [D,  setD]  = useState(300)
  const [v1, setV1] = useState(80)
  const [v2, setV2] = useState(70)

  // Mezcla params
  const [V,  setV]  = useState(100)
  const [p1, setP1] = useState(20)
  const [p2, setP2] = useState(60)
  const [pT, setPT] = useState(35)

  // Mercado params
  const [mS, setMS] = useState(2)
  const [bS, setBS] = useState(5)
  const [mD, setMD] = useState(-1)
  const [bD, setBD] = useState(20)

  // Libre params
  const [la1, setLA1] = useState(1)
  const [lb1, setLB1] = useState(1)
  const [lc1, setLC1] = useState(4)
  const [la2, setLA2] = useState(2)
  const [lb2, setLB2] = useState(-1)
  const [lc2, setLC2] = useState(2)

  // ── derive equations ────────────────────────────────────────────────────────
  let a1, b1, c1, a2, b2, c2, sceneParams
  switch (scenarioId) {
  case 'encuentro':
    a1 = v1; b1 = -1; c1 = 0
    a2 = v2; b2 =  1; c2 = D
    sceneParams = { D, v1, v2 }
    break
  case 'mezcla':
    // x + y = V  (litros totales)
    // p1·x + p2·y = pT·V  (balance de soluto: %·L = %·L, unidades consistentes)
    a1 = 1;  b1 = 1;  c1 = V
    a2 = p1; b2 = p2; c2 = pT * V
    sceneParams = { V, p1, p2, pT }
    break
  case 'mercado':
    a1 = mS; b1 = -1; c1 = -bS
    a2 = mD; b2 = -1; c2 = -bD
    sceneParams = { mS, bS, mD, bD }
    break
  default:
    a1 = la1; b1 = lb1; c1 = lc1
    a2 = la2; b2 = lb2; c2 = lc2
    sceneParams = {}
  }

  const sol      = solve(a1, b1, c1, a2, b2, c2)
  const stype    = systemClass(a1, b1, c1, a2, b2, c2)
  const det      = a1 * b2 - a2 * b1
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)

  // ── auto-scale: smallest scale that shows intersection + both line intercepts ──
  const autoScale = (() => {
    const candidates = [5]
    // Intersection point
    if (sol) {
      candidates.push(Math.abs(sol.x) * 1.45, Math.abs(sol.y) * 1.45)
    }
    // Axis intercepts of each line (so both lines cross the viewport)
    ;[[a1, b1, c1], [a2, b2, c2]].forEach(([a, b, c]) => {
      if (Math.abs(a) > 1e-9) candidates.push(Math.abs(c / a) * 1.3)
      if (Math.abs(b) > 1e-9) candidates.push(Math.abs(c / b) * 1.3)
    })
    const raw = Math.max(...candidates)
    return Math.min(Math.ceil(raw / 5) * 5, 500)
  })()

  const axis1 = useAxisRange({
    xMin: -autoScale, xMax: autoScale,
    yMin: -autoScale, yMax: autoScale,
  })

  // ── graph helpers ───────────────────────────────────────────────────────────
  const AXIS = Math.max(Math.abs(axis1.xMin), Math.abs(axis1.xMax), Math.abs(axis1.yMin), Math.abs(axis1.yMax))
  const lineY = (x, a, b, c) => Math.abs(b) < 1e-9 ? null : (c - a * x) / b

  // Two-point line: compute exact endpoints at x = ±AXIS (extended slightly so
  // the clipPath of CartesianFrame clips a complete segment, never a short stub)
  const makePts = (a, b, c) => {
    if (Math.abs(b) < 1e-9) return []   // vertical line handled by vLine
    const x1 = axis1.xMin - 2
    const x2 = axis1.xMax + 2
    return [
      { x: x1, y: (c - a * x1) / b },
      { x: x2, y: (c - a * x2) / b },
    ]
  }

  const pts1   = makePts(a1, b1, c1)
  const pts2   = makePts(a2, b2, c2)
  const toPath = (pts, sX, sY) =>
    pts.length < 2 ? '' :
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sX(p.x).toFixed(1)} ${sY(p.y).toFixed(1)}`).join(' ')

  const vLine1 = Math.abs(b1) < 1e-9 && Math.abs(a1) > 1e-9 ? c1 / a1 : null
  const vLine2 = Math.abs(b2) < 1e-9 && Math.abs(a2) > 1e-9 ? c2 / a2 : null

  // Check if intersection is visible in current scale
  const solVisible = sol &&
    sol.x >= axis1.xMin * 1.05 && sol.x <= axis1.xMax * 1.05 &&
    sol.y >= axis1.yMin * 1.05 && sol.y <= axis1.yMax * 1.05

  // ── equation display ─────────────────────────────────────────────────────────
  const eqStr = (a, b, c) => {
    const lhs = [
      a !== 0 ? `${fmt(a)}x` : '',
      b > 0 ? ` + ${fmt(b)}y` : b < 0 ? ` − ${fmt(Math.abs(b))}y` : '',
    ].join('') || '0'
    return `${lhs} = ${fmt(c)}`
  }

  // ── CSV ─────────────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const rows = [
      ['x', 'y_ec1', 'y_ec2'],
      ...Array.from({ length: 41 }, (_, i) => {
        const x  = -AXIS + i * (2 * AXIS / 40)
        const y1 = lineY(x, a1, b1, c1)
        const y2 = lineY(x, a2, b2, c2)
        return [fmt(x), y1 !== null ? fmt(y1) : '—', y2 !== null ? fmt(y2) : '—']
      }),
    ]
    downloadCsv(rows, `sistema-${scenarioId}.csv`)
  }

  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── scenario selector ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((sc) => (
          <button key={sc.id} type="button" onClick={() => { setScenarioId(sc.id); axis1.resetRange() }}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              scenarioId === sc.id
                ? 'bg-ink text-paper shadow-[0_8px_20px_rgba(18,23,35,0.18)]'
                : 'border border-ink/12 bg-white text-ink hover:border-ink/24'
            }`}>
            {sc.icon} {sc.label}
          </button>
        ))}
      </div>

      {/* ── context card ────────────────────────────────────────────────────── */}
      <div className="rounded-[1.6rem] border border-ink/10 bg-white px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[0.66rem] uppercase tracking-[0.24em] text-ink/44">Contexto del problema</p>
            <p className="mt-2 text-sm leading-7 text-ink/70">{scenario.context}</p>
            <p className="mt-2 text-[0.78rem] italic text-signal/80">{scenario.guideQuestion}</p>
          </div>
          <div className={`self-start rounded-full border px-4 py-2 text-sm font-semibold ${
            stype === 'determinado'
              ? 'border-signal/25 bg-signal/8 text-signal'
              : stype === 'indeterminado'
                ? 'border-ink/15 bg-ink/5 text-ink/60'
                : 'border-red-200 bg-red-50 text-red-600'
          }`}>
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${
              stype === 'determinado' ? 'bg-signal' :
                stype === 'indeterminado' ? 'bg-ink/35' : 'bg-red-400'
            }`} />
            {stype === 'determinado'   && 'Compatible determinado'}
            {stype === 'indeterminado' && 'Compatible indeterminado'}
            {stype === 'incompatible'  && 'Incompatible'}
          </div>
        </div>
      </div>

      {/* ── visual scene ────────────────────────────────────────────────────── */}
      <LabCard title={`Escena — ${scenario.label}`}>
        <div className="mt-4">
          {scenarioId === 'encuentro' && <EncuentroScene D={D} v1={v1} v2={v2} sol={sol} />}
          {scenarioId === 'mezcla'    && <MezclaScene V={V} p1={p1} p2={p2} pT={pT} sol={sol} />}
          {scenarioId === 'mercado'   && <MercadoScene mS={mS} bS={bS} mD={mD} bD={bD} sol={sol} />}
          {scenarioId === 'libre'     && (
            <p className="py-6 text-center text-sm text-ink/40">
              Ajusta los coeficientes en los sliders para explorar el sistema.
            </p>
          )}
        </div>
      </LabCard>

      {/* ── equations + sliders ─────────────────────────────────────────────── */}
      {scenarioId === 'encuentro' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SliderField id="D"  label="Distancia D (km)"        value={D}  min={50}  max={600} step={10} onChange={setD} />
          <SliderField id="v1" label="Velocidad tren A (km/h)" value={v1} min={20}  max={200} step={5}  onChange={setV1} />
          <SliderField id="v2" label="Velocidad tren B (km/h)" value={v2} min={20}  max={200} step={5}  onChange={setV2} />
        </div>
      )}
      {scenarioId === 'mezcla' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SliderField id="V"  label="Volumen total (L)"            value={V}  min={10} max={200} step={5}  onChange={setV} />
          <SliderField id="p1" label="Concentración A (%)"          value={p1} min={1}  max={90}  step={1} suffix="%" onChange={setP1} />
          <SliderField id="p2" label="Concentración B (%)"          value={p2} min={1}  max={99}  step={1} suffix="%" onChange={setP2} />
          <SliderField id="pT" label="Concentración objetivo (%)"   value={pT} min={1}  max={99}  step={1} suffix="%" onChange={setPT} />
        </div>
      )}
      {scenarioId === 'mercado' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SliderField id="mS" label="Pendiente oferta"    value={mS} min={0.5}  max={5}   step={0.5} onChange={setMS} />
          <SliderField id="bS" label="Intercepto oferta"   value={bS} min={-10}  max={15}  step={0.5} onChange={setBS} />
          <SliderField id="mD" label="Pendiente demanda"   value={mD} min={-5}   max={-0.5} step={0.5} onChange={setMD} />
          <SliderField id="bD" label="Intercepto demanda"  value={bD} min={10}   max={40}  step={0.5} onChange={setBD} />
        </div>
      )}
      {scenarioId === 'libre' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2 rounded-[1.3rem] border border-[rgba(255,107,53,0.25)] bg-[rgba(255,107,53,0.04)] p-4">
            <p className="text-[0.64rem] uppercase tracking-[0.2em] text-[#ff6b35]/70">Ecuación 1</p>
            <SliderField id="la1" label="a₁" value={la1} min={-5} max={5} step={0.5} onChange={setLA1} />
            <SliderField id="lb1" label="b₁" value={lb1} min={-5} max={5} step={0.5} onChange={setLB1} />
            <SliderField id="lc1" label="c₁" value={lc1} min={-10} max={10} step={0.5} onChange={setLC1} />
          </div>
          <div className="space-y-2 rounded-[1.3rem] border border-[rgba(120,180,255,0.30)] bg-[rgba(120,180,255,0.05)] p-4">
            <p className="text-[0.64rem] uppercase tracking-[0.2em] text-[rgba(80,150,255,0.7)]">Ecuación 2</p>
            <SliderField id="la2" label="a₂" value={la2} min={-5} max={5} step={0.5} onChange={setLA2} />
            <SliderField id="lb2" label="b₂" value={lb2} min={-5} max={5} step={0.5} onChange={setLB2} />
            <SliderField id="lc2" label="c₂" value={lc2} min={-10} max={10} step={0.5} onChange={setLC2} />
          </div>
          <div className="rounded-[1.3rem] border border-ink/10 bg-paper p-4">
            <p className="text-[0.64rem] uppercase tracking-[0.2em] text-ink/44">Sistema actual</p>
            <div className="mt-4 space-y-3">
              <p className="font-mono text-sm text-[#ff6b35]">{eqStr(a1, b1, c1)}</p>
              <p className="font-mono text-sm text-[rgba(80,150,255,1)]">{eqStr(a2, b2, c2)}</p>
              <p className="mt-2 font-mono text-xs text-ink/45">det = {fmt(det)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── graph + algebraic solution ───────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">

        {/* cartesian plane */}
        <div className="xl:sticky xl:top-4 xl:self-start">
        <LabCard dark title="Interpretación geométrica — intersección de rectas">
          {!solVisible && sol && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-signal/20 bg-signal/8 px-3 py-2">
              <p className="text-[0.72rem] text-signal/80">
                Intersección ({fmt(sol.x)}, {fmt(sol.y)}) fuera de la vista
              </p>
              <button
                type="button"
                onClick={() => axis1.resetRange()}
                className="shrink-0 rounded-full bg-signal/15 px-3 py-1 text-[0.68rem] font-semibold text-signal transition-colors hover:bg-signal/25"
              >
                Ver ahora →
              </button>
            </div>
          )}
          <div className="mt-3">
            <CartesianFrame
              width={580} height={400}
              xMin={axis1.xMin} xMax={axis1.xMax}
              yMin={axis1.yMin} yMax={axis1.yMax}
              xLabel="x"
              yLabel="y"
              dark
              xTicks={generateTicks(axis1.xMin, axis1.xMax)}
              yTicks={generateTicks(axis1.yMin, axis1.yMax)}
            >
              {({ scaleX, scaleY }) => (
                <>
                  {vLine1 !== null
                    ? <line x1={scaleX(vLine1)} y1={scaleY(axis1.yMin)} x2={scaleX(vLine1)} y2={scaleY(axis1.yMax)}
                      stroke="rgba(255,107,53,0.85)" strokeWidth="2.5" />
                    : <path d={toPath(pts1, scaleX, scaleY)} fill="none"
                      stroke="rgba(255,107,53,0.85)" strokeWidth="2.5" strokeLinecap="round" />
                  }
                  {vLine2 !== null
                    ? <line x1={scaleX(vLine2)} y1={scaleY(axis1.yMin)} x2={scaleX(vLine2)} y2={scaleY(axis1.yMax)}
                      stroke="rgba(120,180,255,0.85)" strokeWidth="2.5"
                      strokeDasharray={stype === 'indeterminado' ? '8 4' : 'none'} />
                    : <path d={toPath(pts2, scaleX, scaleY)} fill="none"
                      stroke="rgba(120,180,255,0.85)" strokeWidth="2.5" strokeLinecap="round"
                      strokeDasharray={stype === 'indeterminado' ? '8 4' : 'none'} />
                  }
                  {solVisible && stype === 'determinado' && (
                    <>
                      <line x1={scaleX(sol.x)} y1={scaleY(axis1.yMin)} x2={scaleX(sol.x)} y2={scaleY(axis1.yMax)}
                        stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="4 3" />
                      <line x1={scaleX(axis1.xMin)} y1={scaleY(sol.y)} x2={scaleX(axis1.xMax)} y2={scaleY(sol.y)}
                        stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="4 3" />
                      <circle cx={scaleX(sol.x)} cy={scaleY(sol.y)} r={8}
                        fill="white" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                      <text x={scaleX(sol.x) + 12} y={scaleY(sol.y) - 10}
                        fill="white" fontSize="12" fontWeight="700" fontFamily="monospace">
                        ({fmt(sol.x)}, {fmt(sol.y)})
                      </text>
                    </>
                  )}
                </>
              )}
            </CartesianFrame>
          </div>
          <AxisRangePanel {...axis1} />
          <div className="mt-3">
            <LiveFormula
              label="Sistema evaluado"
              general={String.raw`\begin{cases} a_1 x + b_1 y = c_1 \\ a_2 x + b_2 y = c_2 \end{cases}`}
              evaluated={`\\begin{cases} ${eqStr(a1, b1, c1).replace(/−/g, '-')} \\\\ ${eqStr(a2, b2, c2).replace(/−/g, '-')} \\end{cases}`}
              raw
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-5">
            {[
              { color: 'rgba(255,107,53,0.85)', label: `Ec.1: ${eqStr(a1, b1, c1)}` },
              { color: 'rgba(120,180,255,0.85)', label: `Ec.2: ${eqStr(a2, b2, c2)}`, dash: stype === 'indeterminado' },
            ].map(({ color, label, dash }) => (
              <span key={label} className="flex items-center gap-2 text-[0.7rem] text-paper/55">
                <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke={color} strokeWidth="2.5"
                  strokeDasharray={dash ? '8 4' : 'none'} /></svg>
                {label}
              </span>
            ))}
          </div>
        </LabCard>
        </div>

        {/* algebraic solution */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'cramer',      label: 'Regla de Cramer' },
              { id: 'sustitucion', label: 'Sustitución' },
              { id: 'eliminacion', label: 'Eliminación' },
            ].map((m) => (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                  method === m.id
                    ? 'border border-signal/28 bg-signal/12 text-signal'
                    : 'border border-ink/10 bg-paper text-ink/55 hover:text-ink/80'
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          <div className="rounded-[1.3rem] border border-ink/10 bg-paper p-4">
            <p className="text-[0.64rem] uppercase tracking-[0.2em] text-ink/44">Sistema planteado</p>
            <div className="mt-3 space-y-2">
              <p className="font-mono text-base text-[#ff6b35]">① {eqStr(a1, b1, c1)}</p>
              <p className="font-mono text-base text-[rgba(80,150,255,1)]">② {eqStr(a2, b2, c2)}</p>
              <p className="text-[0.72rem] text-ink/40">{scenario.varX} · {scenario.varY}</p>
            </div>
          </div>

          <SolutionSteps method={method} a1={a1} b1={b1} c1={c1} a2={a2} b2={b2} c2={c2} sol={sol} />
        </div>
      </div>

      {/* ── metrics ───────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard dark={false} label="Determinante" value={fmt(det)}
          detail={Math.abs(det) > 1e-9 ? 'det ≠ 0 → solución única' : 'det = 0 → sin solución única'} />
        <MetricCard dark={false} label={scenario.varX}
          value={sol ? fmt(sol.x) : (stype === 'indeterminado' ? '∞' : '∄')}
          detail={sol ? 'Primera incógnita' : stype} />
        <MetricCard dark={false} label={scenario.varY}
          value={sol ? fmt(sol.y) : (stype === 'indeterminado' ? '∞' : '∄')}
          detail={sol ? 'Segunda incógnita' : stype} />
        <MetricCard dark={false} label="Tipo de sistema"
          value={stype === 'determinado' ? 'C.D.' : stype === 'indeterminado' ? 'C.I.' : 'Inc.'}
          detail={stype === 'determinado' ? 'Compatible determinado' : stype === 'indeterminado' ? 'Compatible indeterminado' : 'Incompatible'} />
      </div>

      {/* ── verification ──────────────────────────────────────────────────── */}
      {sol && (
        <LabCard title="Verificación algebraica">
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10">
                  {['Ecuación', 'Sustitución', 'Resultado', 'Valor c', '¿OK?'].map((h) => (
                    <th key={h} className="pb-2 text-left text-[0.64rem] uppercase tracking-[0.18em] text-ink/44 last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[{ label: `①  ${eqStr(a1, b1, c1)}`, a: a1, b: b1, c: c1 },
                  { label: `②  ${eqStr(a2, b2, c2)}`, a: a2, b: b2, c: c2 }].map(({ label, a, b, c }) => {
                  const result = a * sol.x + b * sol.y
                  const ok     = Math.abs(result - c) < 0.01
                  return (
                    <tr key={label} className="border-b border-ink/6 transition-colors hover:bg-ink/2">
                      <td className="py-2.5 font-mono text-ink/65">{label}</td>
                      <td className="py-2.5 font-mono text-ink/50">
                        ({fmt(a)})({fmt(sol.x)}) + ({fmt(b)})({fmt(sol.y)})
                      </td>
                      <td className="py-2.5 font-mono text-ink/80">{fmt(result)}</td>
                      <td className="py-2.5 font-mono text-ink/80">{fmt(c)}</td>
                      <td className="py-2.5 text-right font-bold text-signal">{ok ? '✓' : '✗'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={handleDownload}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink/24">
            Descargar datos CSV
          </button>
        </LabCard>
      )}

      {/* ── math reading ──────────────────────────────────────────────────── */}
      <LabCard dark title="Lectura matemática">
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-7 text-paper/80">
            {scenario.readingFn(sol, sceneParams)}
          </p>
          <p className="text-sm leading-7 text-paper/80">
            Los tres métodos de resolución (Cramer, Sustitución, Eliminación) producen siempre la
            misma solución — son equivalentes algebraicamente. La diferencia está en la transparencia
            del proceso: Cramer usa determinantes (conecta con matrices en IB HL); Sustitución despeja
            una variable y la reemplaza; Eliminación cancela una incógnita sumando ecuaciones escaladas.
            Explorar los tres consolida la comprensión de que resolver un sistema es encontrar el punto
            que satisface ambas restricciones simultáneamente.
          </p>
        </div>
      </LabCard>
    </div>
  )
}

import { useState } from 'react'
import { LabCard, MetricCard, ModelCard, SliderField } from './DerivaLabPrimitives'
import { LiveFormula } from './LiveFormula'
import { Math as MathRender } from '../ui/Math'
import { format } from './derivaLabUtils'

// ── math helpers ──────────────────────────────────────────────────────────────
const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1))
const C = (n, k) => factorial(n) / (factorial(k) * factorial(n - k))

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const toSup = (n) => String(Math.abs(n)).split('').map((d) => SUPS[+d]).join('')

// x^pow display: '', 'x', 'x²', 'x³', ...
const xStr = (pow) => {
  if (pow === 0) return ''
  if (pow === 1) return 'x'
  return 'x' + toSup(pow)
}

// Full term string: coef·x^deg
const termStr = (coef, xDeg) => {
  if (xDeg === 0) return format(coef)
  if (coef === 0) return '0'
  if (coef === 1) return xStr(xDeg)
  if (coef === -1) return '−' + xStr(xDeg)
  return `${format(coef)}·${xStr(xDeg)}`
}

// Expression label: (px + q)^n
const exprLabel = (p, q, n) => {
  const xPart = p === 1 ? 'x' : `${format(p)}x`
  const qPart = q > 0 ? ` + ${q}` : q < 0 ? ` − ${-q}` : ''
  return `(${xPart}${qPart})${toSup(n)}`
}

// Compute T(r+1) for (px + q)^n
const termData = (n, p, q, r) => {
  const binom = C(n, r)
  const xDeg  = n - r
  const pFact = Math.pow(p, xDeg)
  const qFact = Math.pow(q, r)
  return { r, binom, xDeg, pFact, qFact, coef: binom * pFact * qFact }
}

// ── sub-components ────────────────────────────────────────────────────────────
const PascalRow = ({ n, activeR, onSelect }) => {
  const row = Array.from({ length: n + 1 }, (_, k) => C(n, k))
  return (
    <div className="flex flex-wrap justify-center gap-2 py-1">
      {row.map((val, k) => (
        <button
          key={k}
          type="button"
          onClick={() => onSelect(k)}
          className={`flex h-14 w-14 flex-col items-center justify-center rounded-full text-base font-bold transition-all ${
            k === activeR
              ? 'scale-110 bg-signal text-white shadow-[0_4px_16px_rgba(255,107,53,0.38)]'
              : 'border border-ink/14 bg-white text-ink hover:border-signal/35 hover:text-signal'
          }`}
        >
          <span className="text-[0.72rem] font-semibold leading-none opacity-75">{k}</span>
          <span className="leading-tight">{val}</span>
        </button>
      ))}
    </div>
  )
}

// Proper inline fraction for division display
const FracInline = ({ num, den }) => (
  <span className="mx-1 inline-flex flex-col items-center align-middle leading-none">
    <span className="border-b-[1.5px] border-current px-1.5 pb-[2px] text-[0.95em] leading-snug">{num}</span>
    <span className="px-1.5 pt-[2px] text-[0.95em] leading-snug">{den}</span>
  </span>
)

const StepRow = ({ step, label, value, highlight }) => (
  <div className={`flex items-start gap-3 rounded-xl px-4 py-3 ${
    highlight ? 'border border-signal/30 bg-signal/10' : 'border border-ink/10 bg-ink/[0.04]'
  }`}>
    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
      highlight ? 'bg-signal text-white' : 'bg-ink/18 text-ink/80'
    }`}>
      {step}
    </span>
    <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="text-base text-ink/85">{label}</span>
      <span className={`font-mono text-lg font-semibold ${highlight ? 'text-signal' : 'text-ink'}`}>
        {value}
      </span>
    </div>
  </div>
)

// ── main component ────────────────────────────────────────────────────────────
export const BinomialTheoremLab = () => {
  const [n, setN]           = useState(5)
  const [p, setP]           = useState(2)   // coefficient of x  (px)
  const [q, setQ]           = useState(1)   // constant term
  const [r, setR]           = useState(2)   // active term index (0-based)
  const [kTarget, setKTarget] = useState(3) // x-power for coefficient finder

  const cr       = Math.min(r, n)
  const term     = termData(n, p, q, cr)
  const allTerms = Array.from({ length: n + 1 }, (_, k) => termData(n, p, q, k))

  // Middle terms
  const isNEven = n % 2 === 0
  const midR    = Math.floor(n / 2)
  const mid1    = termData(n, p, q, midR)
  const mid2    = !isNEven ? termData(n, p, q, midR + 1) : null

  // Coefficient finder
  const kClamped = Math.min(kTarget, n)
  const rForK    = n - kClamped
  const findTerm = termData(n, p, q, rForK)

  const expr       = exprLabel(p, q, n)
  const totalTerms = n + 1

  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── sliders ───────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SliderField id="n" label="Potencia n" value={n} min={2} max={9} step={1} natural
          onChange={(v) => { setN(v); if (r > v) setR(v) }} />
        <SliderField id="p" label="Coeficiente p  (px)" value={p} min={1} max={5} step={1}
          onChange={setP} />
        <SliderField id="q" label="Constante q" value={q} min={-5} max={5} step={1}
          onChange={setQ} />
      </div>

      {/* expression badge */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-[0.22em] font-semibold text-ink/70">Expresión</span>
        <span className="rounded-2xl border border-signal/35 bg-signal/10 px-6 py-2.5 font-mono text-2xl font-bold text-signal">
          {expr}
        </span>
        <span className="text-sm font-medium text-ink/75">{totalTerms} términos en total</span>
      </div>

      <LiveFormula
        tone="dark"
        label={`Término T(${cr + 1}) evaluado`}
        general={String.raw`T(r+1) = \binom{n}{r} \cdot (px)^{n-r} \cdot q^{r}`}
        evaluated={`T(${cr + 1}) = \\binom{${n}}{${cr}} \\cdot (${p}x)^{${n - cr}} \\cdot (${q})^{${cr}}`}
        raw
      />

      {/* ── pascal row + step-by-step ─────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">

        {/* Pascal row */}
        <LabCard dark title={`Fila n = ${n} — Triángulo de Pascal`}>
          <p className="mt-3 text-sm leading-6 text-paper/80">
            Cada círculo es C(n,r) — coeficiente binomial de T(r+1). Pulsa uno para ver el desarrollo.
          </p>
          <div className="mt-4">
            <PascalRow n={n} activeR={cr} onSelect={setR} />
          </div>
          <div className="mt-4 rounded-xl border border-paper/20 bg-paper/12 px-4 py-3.5">
            <p className="text-xs uppercase tracking-[0.18em] font-semibold text-paper/75">C({n}, {cr}) activo</p>
            <p className="mt-2 font-mono text-2xl font-bold text-paper">{format(term.binom)}</p>
            <div className="mt-2 flex items-center gap-2 font-mono text-base text-paper/90">
              <span>{n}!</span>
              <span className="mx-0.5 inline-flex flex-col items-center align-middle leading-none">
                <span className="border-b-[1.5px] border-current px-1.5 pb-[2px] text-[0.95em]">{n}!</span>
                <span className="px-1.5 pt-[2px] text-[0.95em]">{cr}! · {n - cr}!</span>
              </span>
              <span>= {format(term.binom)}</span>
            </div>
          </div>
        </LabCard>

        {/* Step-by-step */}
        <LabCard title={`Desarrollo de T(${cr + 1})`}>
          <div className="mt-3">
            <SliderField
              id="r" label="Índice r — selecciona T(r+1)"
              value={cr} min={0} max={n} step={1} natural
              onChange={setR}
            />
          </div>
          <div className="mt-4 space-y-2">
            <StepRow step="1" label="Fórmula general"
              value={
                <span className="inline-flex flex-wrap items-baseline gap-[1px]">
                  {'C(n,r) · (px)'}
                  <sup className="text-[0.9em] leading-none">n−r</sup>
                  {' · q'}
                  <sup className="text-[0.9em] leading-none">r</sup>
                </span>
              } />
            <StepRow step="2"
              label={`Coeficiente binomial C(${n}, ${cr})`}
              value={
                <span className="inline-flex items-center gap-1">
                  <FracInline num={`${n}!`} den={`${cr}!·${n-cr}!`} />
                  <span>= {format(term.binom)}</span>
                </span>
              } />
            <StepRow step="3"
              label={
                <span className="inline-flex items-baseline gap-[1px]">
                  {`Factor de p: (${format(p)})`}
                  <sup className="text-[0.9em] leading-none">{n - cr}</sup>
                </span>
              }
              value={`= ${format(term.pFact)}`} />
            <StepRow step="4"
              label={
                <span className="inline-flex items-baseline gap-[1px]">
                  {`Factor de q: (${format(q)})`}
                  <sup className="text-[0.9em] leading-none">{cr}</sup>
                </span>
              }
              value={`= ${format(term.qFact)}`} />
            <StepRow step="✓"
              label={`T(${cr + 1}) de ${expr}`}
              value={termStr(term.coef, term.xDeg)}
              highlight />
          </div>
        </LabCard>
      </div>

      {/* ── all terms + key terms ─────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">

        {/* All terms list */}
        <LabCard title={`Todos los términos de ${expr}`}>
          <div className="mt-4 space-y-2">
            {allTerms.map((t) => (
              <button
                key={t.r}
                type="button"
                onClick={() => setR(t.r)}
                className={`w-full rounded-xl px-4 py-3 text-left transition-colors ${
                  t.r === cr
                    ? 'border border-signal/35 bg-signal/10'
                    : 'border border-ink/12 bg-white hover:border-ink/25'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-xs uppercase tracking-[0.14em] font-semibold ${
                    t.r === cr ? 'text-signal' : 'text-ink/75'
                  }`}>
                    T({t.r + 1}) · r = {t.r}
                  </span>
                  <span className={`font-mono text-base font-semibold ${
                    t.r === cr ? 'text-signal' : 'text-ink'
                  }`}>
                    {termStr(t.coef, t.xDeg)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </LabCard>

        {/* Key terms */}
        <div className="space-y-3">

          {/* First */}
          <div className="rounded-[1.3rem] border border-ink/12 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] font-semibold text-ink/75">Primer término — T(1), r = 0</p>
            <p className="mt-2 font-mono text-xl font-bold text-ink">
              {termStr(allTerms[0].coef, n)}
            </p>
            <p className="mt-2 font-mono text-sm text-ink/80">
              C({n},0)·pⁿ·xⁿ = {format(Math.pow(p, n))}·x{toSup(n)}
            </p>
          </div>

          {/* Middle */}
          <div className="rounded-[1.3rem] border border-signal/30 bg-signal/8 p-4">
            <p className="text-xs uppercase tracking-[0.18em] font-semibold text-signal">
              Término{!isNEven ? 's' : ''} central{!isNEven ? 'es' : ''} — n={n} es {isNEven ? 'par' : 'impar'}
            </p>
            {isNEven ? (
              <>
                <p className="mt-2 font-mono text-xl font-bold text-ink">{termStr(mid1.coef, mid1.xDeg)}</p>
                <p className="mt-2 font-mono text-sm text-ink/80">T({midR + 1}), r = n/2 = {midR}</p>
              </>
            ) : (
              <div className="mt-2 space-y-1.5">
                <p className="font-mono text-base font-semibold text-ink">T({midR + 1}): {termStr(mid1.coef, mid1.xDeg)}</p>
                <p className="font-mono text-base font-semibold text-ink">T({midR + 2}): {termStr(mid2.coef, mid2.xDeg)}</p>
                <p className="mt-1 font-mono text-sm text-ink/80">r = {midR} y r = {midR + 1}</p>
              </div>
            )}
          </div>

          {/* Last */}
          <div className="rounded-[1.3rem] border border-ink/12 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] font-semibold text-ink/75">Último término — T({totalTerms}), r = n</p>
            <p className="mt-2 font-mono text-xl font-bold text-ink">
              {format(allTerms[n].coef)}
            </p>
            <p className="mt-2 font-mono text-sm text-ink/80">
              C({n},{n})·qⁿ = ({format(q)})ⁿ = {format(Math.pow(q, n))}
            </p>
          </div>
        </div>
      </div>

      {/* ── coefficient finder ────────────────────────────────────────────── */}
      <LabCard dark title="Buscador — ¿cuál es el coeficiente del término x^k?">
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <SliderField
              id="kTarget" label="Potencia de x buscada (k)"
              value={kClamped} min={0} max={n} step={1} natural
              onChange={setKTarget}
            />
            <div className="mt-3 rounded-xl border border-paper/20 bg-paper/12 px-4 py-3.5">
              <p className="text-xs uppercase tracking-[0.16em] font-semibold text-paper/80">Estrategia</p>
              <p className="mt-2 text-base text-paper flex items-center gap-2 flex-wrap">
                <MathRender raw>{`x^{k}`}</MathRender>
                <span>en T(r+1) cuando n − r = k → r = {n} − {kClamped} = {rForK}</span>
              </p>
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="rounded-xl border border-signal/40 bg-signal/18 px-4 py-3.5">
              <p className="text-xs uppercase tracking-[0.16em] font-semibold text-signal flex items-center gap-1.5 flex-wrap">
                <span>Coeficiente de</span>
                <MathRender raw>{`x^{${kClamped}}`}</MathRender>
                <span>en {expr}</span>
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-paper">
                {format(findTerm.coef)}
              </p>
            </div>
            <div className="rounded-xl border border-paper/20 bg-paper/12 px-4 py-3.5">
              <p className="text-xs uppercase tracking-[0.16em] font-semibold text-paper/80">Cálculo</p>
              <p className="mt-2 font-mono text-base text-paper">
                C({n},{rForK})·({format(p)}){toSup(kClamped)}·({format(q)}){toSup(rForK)}
              </p>
              <p className="font-mono text-base text-paper">
                = {format(findTerm.binom)} · {format(findTerm.pFact)} · {format(findTerm.qFact)} = {format(findTerm.coef)}
              </p>
            </div>
          </div>
        </div>
      </LabCard>

      {/* ── formulas ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <ModelCard
          title="Término general T(r+1)"
          expression="T(r+1) = C(n,r) · (px)^{n−r} · q^{r}"
          parameters={`n = ${n},  p = ${format(p)},  q = ${format(q)}`}
          conditions={`r = 0, 1, …, ${n}  →  ${totalTerms} términos en total`}
        />
        <ModelCard
          title="Coeficiente binomial C(n,r)"
          expression={'C(n,r) = frac(n!, r!·(n−r)!)'}
          parameters={`C(${n},${cr}) = ${format(term.binom)};  suma fila = 2${toSup(n)} = ${Math.pow(2, n)}`}
          conditions="C(n,0) + C(n,1) + ··· + C(n,n) = 2ⁿ"
        />
      </div>

      {/* ── metrics ───────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard dark={false} label="Número de términos" value={totalTerms}
          detail={`n = ${n}  →  n + 1 = ${totalTerms}`} />
        <MetricCard dark={false}
          label={`T(${cr + 1}) — ${term.xDeg > 0 ? `coef. de x${toSup(term.xDeg)}` : 'término cte.'}`}
          value={format(term.coef)}
          detail={`C(${n},${cr})·${format(term.pFact)}·${format(term.qFact)}`} />
        <MetricCard dark={false}
          label={`Término central T(${midR + 1})`}
          value={termStr(mid1.coef, mid1.xDeg)}
          detail={isNEven ? `r = n/2 = ${midR}` : `n impar → T(${midR+1}) y T(${midR+2})`} />
        <MetricCard dark={false}
          label="Suma coeficientes (p=q=1)"
          value={`2${toSup(n)} = ${Math.pow(2, n)}`}
          detail="(1+1)ⁿ = 2ⁿ identidad binomial" />
      </div>

      {/* ── math reading ──────────────────────────────────────────────────── */}
      <LabCard dark title="Lectura matemática">
        <div className="mt-4 space-y-3">
          <p className="text-base leading-7 text-paper/90">
            Para encontrar un término específico de {expr} sin expandir, usamos el{' '}
            <strong className="text-paper">término general</strong>:{' '}
            <MathRender raw>{`T(r+1) = \\binom{n}{r}(px)^{n-r} q^{r}`}</MathRender>. El exponente de x en T(r+1) es siempre{' '}
            <strong className="text-paper">n − r</strong>. Para el coeficiente de <MathRender raw>{`x^{k}`}</MathRender> despejamos
            r = n − k = {n} − {kClamped} = {rForK}, y lo aplicamos directamente en la fórmula —
            sin escribir ningún término anterior.
          </p>
          <p className="text-base leading-7 text-paper/90">
            El <strong className="text-paper">término central</strong> aparece cuando los exponentes
            de px y q son lo más equilibrados posible. Con n = {n} ({isNEven ? 'par' : 'impar'}),{' '}
            {isNEven
              ? `hay exactamente un término central T(${midR+1}) = ${termStr(mid1.coef, mid1.xDeg)}, en r = n/2 = ${midR}.`
              : `hay dos términos centrales: T(${midR+1}) = ${termStr(mid1.coef, mid1.xDeg)} y T(${midR+2}) = ${termStr(mid2.coef, mid2.xDeg)}, en r = ${midR} y r = ${midR+1}.`}
          </p>
          <p className="text-base leading-7 text-paper/90">
            El <strong className="text-paper">primer término</strong> (r=0) da el mayor exponente de x:{' '}
            {termStr(allTerms[0].coef, n)}. El{' '}
            <strong className="text-paper">último término</strong> (r=n) es siempre constante:{' '}
            qⁿ = {format(Math.pow(q, n))}. La suma de los coeficientes binomiales de la fila es siempre{' '}
            <strong className="text-paper">2ⁿ = {Math.pow(2, n)}</strong> — se obtiene poniendo p = q = 1.
          </p>
        </div>
      </LabCard>
    </div>
  )
}

import { useState, useMemo, useId } from 'react'
import { format } from './derivaLabUtils'
import {
  normalPDF, normalCDF, normalInvCDF,
  binomPMF, binomCDF,
} from './statisticsUtils'

/* ── Bell curve SVG with shaded area ─────────────────── */

function BellCurve({ mu, sigma, shade }) {
  const clipId = useId().replace(/:/g, '')
  const W = 340, H = 170, pad = 28
  const samples = 200

  // x range: μ ± 4σ
  const xMin = mu - 4 * sigma
  const xMax = mu + 4 * sigma

  const points = useMemo(() => {
    const pts = []
    for (let i = 0; i <= samples; i++) {
      const x = xMin + (i / samples) * (xMax - xMin)
      const y = normalPDF(x, mu, sigma)
      pts.push({ x, y })
    }
    return pts
  }, [mu, sigma, xMin, xMax])

  const yMax = normalPDF(mu, mu, sigma) * 1.15

  const sx = (v) => pad + ((v - xMin) / ((xMax - xMin) || 1)) * (W - pad * 2)
  const sy = (v) => H - pad - (v / yMax) * (H - pad * 2)

  // shaded area polygon
  const shadedPath = useMemo(() => {
    if (!shade) return null
    const { from, to } = shade
    const shadePts = points.filter(p => p.x >= from && p.x <= to)
    if (shadePts.length < 2) return null
    const path = shadePts.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')
    return `${sx(from)},${sy(0)} ${path} ${sx(to)},${sy(0)}`
  }, [shade, points, sx, sy])

  // sigma markers
  const sigmaMarks = [-3, -2, -1, 0, 1, 2, 3]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-[#0e1219]">
      <defs>
        <clipPath id={clipId}>
          <rect x={pad} y={4} width={W - pad * 2} height={H - pad + 4} />
        </clipPath>
        <linearGradient id={`${clipId}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5096ff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#5096ff" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {/* sigma gridlines */}
      {sigmaMarks.map(s => {
        const x = mu + s * sigma
        if (x < xMin || x > xMax) return null
        return (
          <g key={s}>
            <line x1={sx(x)} y1={8} x2={sx(x)} y2={H - pad}
              stroke={s === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}
              strokeWidth={s === 0 ? 1.5 : 1} />
            <text x={sx(x)} y={H - pad + 13}
              fill="rgba(255,255,255,0.45)" fontSize="7.5" textAnchor="middle">
              {s === 0 ? format(mu) : `${s > 0 ? '+' : ''}${s}σ`}
            </text>
          </g>
        )
      })}

      {/* baseline */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad}
        stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

      <g clipPath={`url(#${clipId})`}>
        {/* shaded area */}
        {shadedPath && (
          <polygon points={shadedPath} fill={`url(#${clipId}-fill)`} />
        )}

        {/* bell curve */}
        <polyline
          points={points.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')}
          fill="none" stroke="#5096ff" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

/* ── Binomial bar chart SVG ──────────────────────────── */

function BinomialChart({ n, p, highlightK, mode }) {
  const clipId = useId().replace(/:/g, '')
  const W = 340, H = 170, padL = 32, padR = 12, padB = 28, padT = 8

  const bars = useMemo(() => {
    const arr = []
    for (let k = 0; k <= n; k++) {
      arr.push({ k, prob: binomPMF(k, n, p) })
    }
    return arr
  }, [n, p])

  const maxP = Math.max(...bars.map(b => b.prob), 0.01)
  const barW = Math.min((W - padL - padR) / (n + 1), 20)
  const totalW = barW * (n + 1)
  const offsetX = padL + (W - padL - padR - totalW) / 2

  const isHighlighted = (k) => {
    if (highlightK === null || highlightK === undefined) return false
    if (mode === 'exact') return k === highlightK
    if (mode === 'leq') return k <= highlightK
    if (mode === 'geq') return k >= highlightK
    return false
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-[#0e1219]">
      <defs>
        <clipPath id={clipId}>
          <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} />
        </clipPath>
      </defs>

      {/* baseline */}
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB}
        stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

      <g clipPath={`url(#${clipId})`}>
        {bars.map((b, i) => {
          const bx = offsetX + i * barW + 1
          const bw = Math.max(barW - 2, 2)
          const bh = (b.prob / maxP) * (H - padT - padB - 4)
          const hl = isHighlighted(b.k)
          return (
            <rect key={b.k} x={bx} y={H - padB - bh} width={bw} height={bh}
              rx="2" fill={hl ? '#ff6b35' : '#5096ff'} fillOpacity={hl ? 0.85 : 0.5} />
          )
        })}
      </g>

      {/* x labels — show subset if too many */}
      {bars.map((b, i) => {
        const step = n <= 20 ? 1 : n <= 50 ? 5 : 10
        if (b.k % step !== 0 && b.k !== n) return null
        return (
          <text key={`x${b.k}`} x={offsetX + i * barW + barW / 2} y={H - padB + 12}
            fill="rgba(255,255,255,0.45)" fontSize="7" textAnchor="middle">
            {b.k}
          </text>
        )
      })}
    </svg>
  )
}

/* ── Slider field ─────────────────────────────────────── */

function ParamSlider({ label, value, onChange, min, max, step, suffix }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-right text-xs font-semibold text-paper/80">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer accent-aqua"
      />
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={e => {
          const v = Number(e.target.value)
          if (!isNaN(v) && v >= min && v <= max) onChange(v)
        }}
        className="w-16 rounded-md bg-white/8 px-2 py-1 text-right font-mono text-xs text-paper outline-none focus:ring-1 focus:ring-aqua/40"
      />
      {suffix && <span className="text-[0.55rem] text-paper/75">{suffix}</span>}
    </div>
  )
}

/* ── Stat cell (reused from StatsMode) ────────────────── */

function StatCell({ label, value, accent }) {
  return (
    <div className={`flex flex-col rounded-lg px-2.5 py-1.5 ${accent ? 'bg-signal/10' : 'bg-white/5'}`}>
      <span className="text-[0.55rem] uppercase tracking-wider text-paper/80">{label}</span>
      <span className={`font-display text-[0.9rem] font-semibold ${accent ? 'text-signal' : 'text-paper'}`}>{value}</span>
    </div>
  )
}

/* ── MAIN: DistMode ──────────────────────────────────── */

export function DistMode() {
  const [dist, setDist] = useState('normal') // 'normal' | 'binomial'

  // ── Normal state ──
  const [mu, setMu] = useState(0)
  const [sigma, setSigma] = useState(1)
  const [calcMode, setCalcMode] = useState('leq') // 'leq' | 'geq' | 'between' | 'inv'
  const [xVal, setXVal] = useState(0)
  const [xA, setXA] = useState(-1)
  const [xB, setXB] = useState(1)
  const [pInv, setPInv] = useState(0.5)

  // ── Binomial state ──
  const [bN, setBN] = useState(10)
  const [bP, setBP] = useState(0.5)
  const [bK, setBK] = useState(5)
  const [bMode, setBMode] = useState('exact') // 'exact' | 'leq' | 'geq'

  // ── Normal results ──
  const normalResult = useMemo(() => {
    if (sigma <= 0) return null
    const z = (xVal - mu) / sigma
    if (calcMode === 'leq') {
      return { prob: normalCDF(xVal, mu, sigma), z, label: `P(X ≤ ${format(xVal)})` }
    }
    if (calcMode === 'geq') {
      return { prob: 1 - normalCDF(xVal, mu, sigma), z, label: `P(X ≥ ${format(xVal)})` }
    }
    if (calcMode === 'between') {
      const pA = normalCDF(xA, mu, sigma)
      const pB = normalCDF(xB, mu, sigma)
      return { prob: pB - pA, z: null, label: `P(${format(xA)} ≤ X ≤ ${format(xB)})` }
    }
    if (calcMode === 'inv') {
      const x = normalInvCDF(pInv, mu, sigma)
      return { invX: x, prob: pInv, z: (x - mu) / sigma, label: `x tal que P(X ≤ x) = ${format(pInv)}` }
    }
    return null
  }, [mu, sigma, calcMode, xVal, xA, xB, pInv])

  const normalShade = useMemo(() => {
    if (!normalResult || calcMode === 'inv') {
      if (calcMode === 'inv' && normalResult?.invX != null) {
        return { from: mu - 4 * sigma, to: normalResult.invX }
      }
      return null
    }
    if (calcMode === 'leq') return { from: mu - 4 * sigma, to: xVal }
    if (calcMode === 'geq') return { from: xVal, to: mu + 4 * sigma }
    if (calcMode === 'between') return { from: xA, to: xB }
    return null
  }, [calcMode, mu, sigma, xVal, xA, xB, normalResult])

  // ── Binomial results ──
  const binomResult = useMemo(() => {
    if (bN < 0 || bP < 0 || bP > 1) return null
    if (bMode === 'exact') {
      return { prob: binomPMF(bK, bN, bP), label: `P(X = ${bK})` }
    }
    if (bMode === 'leq') {
      return { prob: binomCDF(bK, bN, bP), label: `P(X ≤ ${bK})` }
    }
    if (bMode === 'geq') {
      return { prob: 1 - binomCDF(bK - 1, bN, bP), label: `P(X ≥ ${bK})` }
    }
    return null
  }, [bN, bP, bK, bMode])

  const distBtn = (m, label) => (
    <button
      onClick={() => setDist(m)}
      className={`flex-1 rounded-full py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${dist === m ? 'bg-aqua/20 text-aqua' : 'text-paper/80 hover:text-paper/60'}`}
    >
      {label}
    </button>
  )

  const modeBtn = (val, label, setter, current) => (
    <button
      onClick={() => setter(val)}
      className={`rounded-full px-2.5 py-1 text-[0.55rem] font-semibold transition-colors ${current === val ? 'bg-signal/20 text-signal' : 'bg-white/6 text-paper/80 hover:text-paper/60'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col">
      {/* dist selector */}
      <div className="flex gap-1 rounded-full bg-white/6 p-0.5 mx-3 mt-3 mb-2">
        {distBtn('normal', 'Normal')}
        {distBtn('binomial', 'Binomial')}
      </div>

      {dist === 'normal' ? (
        /* ── NORMAL DISTRIBUTION ─────────────────── */
        <div className="flex flex-col gap-2 px-3 pb-3">
          {/* bell curve */}
          {sigma > 0 && (
            <BellCurve mu={mu} sigma={sigma} shade={normalShade} />
          )}

          {/* parameters */}
          <ParamSlider label="μ" value={mu} onChange={setMu} min={-50} max={50} step={0.5} />
          <ParamSlider label="σ" value={sigma} onChange={setSigma} min={0.1} max={20} step={0.1} />

          {/* calc mode selector */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {modeBtn('leq', 'P(X ≤ x)', setCalcMode, calcMode)}
            {modeBtn('geq', 'P(X ≥ x)', setCalcMode, calcMode)}
            {modeBtn('between', 'P(a ≤ X ≤ b)', setCalcMode, calcMode)}
            {modeBtn('inv', 'Inversa', setCalcMode, calcMode)}
          </div>

          {/* input for chosen mode */}
          {calcMode === 'leq' || calcMode === 'geq' ? (
            <ParamSlider label="x" value={xVal} onChange={setXVal}
              min={mu - 4 * sigma} max={mu + 4 * sigma} step={0.1} />
          ) : calcMode === 'between' ? (
            <>
              <ParamSlider label="a" value={xA} onChange={setXA}
                min={mu - 4 * sigma} max={mu + 4 * sigma} step={0.1} />
              <ParamSlider label="b" value={xB} onChange={setXB}
                min={mu - 4 * sigma} max={mu + 4 * sigma} step={0.1} />
            </>
          ) : (
            <ParamSlider label="p" value={pInv} onChange={setPInv}
              min={0.001} max={0.999} step={0.001} />
          )}

          {/* results */}
          {normalResult && (
            <div className="flex flex-col gap-1.5">
              <div className="rounded-lg bg-signal/10 px-3 py-2.5 text-center">
                <span className="block text-[0.55rem] uppercase tracking-wider text-paper/80 mb-1">
                  {normalResult.label}
                </span>
                <span className="font-display text-lg font-bold text-signal">
                  {calcMode === 'inv'
                    ? `x = ${format(normalResult.invX)}`
                    : format(normalResult.prob, 6)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {normalResult.z != null && (
                  <StatCell label="z-score" value={format(normalResult.z)} />
                )}
                {calcMode !== 'inv' && (
                  <StatCell label="Porcentaje" value={`${format(normalResult.prob * 100)}%`} />
                )}
                {calcMode === 'inv' && normalResult.invX != null && (
                  <StatCell label="z-score" value={format(normalResult.z)} />
                )}
              </div>
            </div>
          )}

          {/* reference info */}
          <div className="rounded-lg bg-white/4 px-3 py-2 text-xs text-paper/75 leading-relaxed">
            <span className="font-semibold text-paper/80">X ~ N({format(mu)}, {format(sigma)}²)</span>
            <span className="mx-1.5">·</span>
            E(X) = {format(mu)}
            <span className="mx-1.5">·</span>
            Var(X) = {format(sigma * sigma)}
          </div>
        </div>
      ) : (
        /* ── BINOMIAL DISTRIBUTION ───────────────── */
        <div className="flex flex-col gap-2 px-3 pb-3">
          {/* bar chart */}
          {bN > 0 && bN <= 100 && (
            <BinomialChart n={bN} p={bP} highlightK={bK} mode={bMode} />
          )}

          {/* parameters */}
          <ParamSlider label="n" value={bN} onChange={setBN} min={1} max={100} step={1} />
          <ParamSlider label="p" value={bP} onChange={setBP} min={0} max={1} step={0.01} />
          <ParamSlider label="k" value={bK} onChange={(v) => setBK(Math.min(v, bN))}
            min={0} max={bN} step={1} />

          {/* calc mode */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {modeBtn('exact', 'P(X = k)', setBMode, bMode)}
            {modeBtn('leq', 'P(X ≤ k)', setBMode, bMode)}
            {modeBtn('geq', 'P(X ≥ k)', setBMode, bMode)}
          </div>

          {/* result */}
          {binomResult && (
            <div className="flex flex-col gap-1.5">
              <div className="rounded-lg bg-signal/10 px-3 py-2.5 text-center">
                <span className="block text-[0.55rem] uppercase tracking-wider text-paper/80 mb-1">
                  {binomResult.label}
                </span>
                <span className="font-display text-lg font-bold text-signal">
                  {format(binomResult.prob, 6)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <StatCell label="Porcentaje" value={`${format(binomResult.prob * 100)}%`} />
                <StatCell label="C(n,k)" value={format(binomPMF(bK, bN, bP) > 0 ? binomResult.prob / (Math.pow(bP, bK) * Math.pow(1 - bP, bN - bK)) : 0)} />
              </div>
            </div>
          )}

          {/* reference info */}
          <div className="rounded-lg bg-white/4 px-3 py-2 text-xs text-paper/75 leading-relaxed">
            <span className="font-semibold text-paper/80">X ~ Bin({bN}, {format(bP)})</span>
            <span className="mx-1.5">·</span>
            E(X) = {format(bN * bP)}
            <span className="mx-1.5">·</span>
            Var(X) = {format(bN * bP * (1 - bP))}
            <span className="mx-1.5">·</span>
            σ = {format(Math.sqrt(bN * bP * (1 - bP)))}
          </div>
        </div>
      )}
    </div>
  )
}

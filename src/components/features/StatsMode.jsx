import { useState, useMemo, useId } from 'react'
import { downloadCsv, format } from './derivaLabUtils'
import {
  parseUnivariateInput, parseBivariateInput,
  count, sum, mean, median, mode, stdDevPop, stdDevSample,
  variancePop, varianceSample, min, max, range,
  q1, q3, iqr, histogramBins,
  linearRegression, pearsonR, rSquared,
} from './statisticsUtils'

/* ── sample datasets ──────────────────────────────────── */

const SAMPLE_UNI  = '12, 15, 18, 22, 25, 28, 30, 33, 35, 38, 40, 42, 45, 48, 50'
const SAMPLE_X    = '1, 2, 3, 4, 5, 6, 7, 8, 9, 10'
const SAMPLE_Y    = '2.1, 4.0, 5.8, 8.1, 10.2, 11.8, 14.0, 16.1, 18.3, 19.9'

/* ── mini histogram (inline SVG, matches MiniGraph style) ── */

function MiniHistogram({ data }) {
  const clipId = useId().replace(/:/g, '')
  const W = 340, H = 180, pad = 28
  const bins = useMemo(() => histogramBins(data), [data])
  if (!bins.length) return null

  const maxCount = Math.max(...bins.map(b => b.count))
  const barW = (W - pad * 2) / bins.length
  const scaleY = (v) => H - pad - (v / (maxCount || 1)) * (H - pad * 2)

  // y-axis ticks
  const yStep = Math.max(1, Math.ceil(maxCount / 4))
  const yTicks = []
  for (let v = 0; v <= maxCount; v += yStep) yTicks.push(v)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-[#0e1219]">
      <defs>
        <clipPath id={clipId}>
          <rect x={pad} y={4} width={W - pad * 2} height={H - pad} />
        </clipPath>
      </defs>

      {/* horizontal grid */}
      {yTicks.map(t => (
        <line key={t} x1={pad} y1={scaleY(t)} x2={W - pad} y2={scaleY(t)}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}

      {/* bars */}
      <g clipPath={`url(#${clipId})`}>
        {bins.map((b, i) => {
          const bx = pad + i * barW + 1
          const bw = barW - 2
          const bh = (b.count / (maxCount || 1)) * (H - pad * 2)
          return (
            <rect key={i} x={bx} y={H - pad - bh} width={bw} height={bh}
              rx="3" fill="#5096ff" fillOpacity="0.7" />
          )
        })}
      </g>

      {/* x labels */}
      {bins.map((b, i) => (
        <text key={`x${i}`} x={pad + i * barW + barW / 2} y={H - pad + 13}
          fill="rgba(255,255,255,0.4)" fontSize="7" textAnchor="middle">
          {Number(b.start.toPrecision(3))}
        </text>
      ))}

      {/* y labels */}
      {yTicks.map(t => (
        <text key={`y${t}`} x={pad - 5} y={scaleY(t) + 3}
          fill="rgba(255,255,255,0.4)" fontSize="7" textAnchor="end">
          {t}
        </text>
      ))}

      {/* base line */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad}
        stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
    </svg>
  )
}

/* ── mini scatter plot with regression line ──────────── */

function MiniScatter({ xs, ys, regression }) {
  const clipId = useId().replace(/:/g, '')
  const W = 340, H = 200, pad = 32

  const { xMin, xMax, yMin, yMax, xTicks, yTicks } = useMemo(() => {
    let lo = Math.min(...xs), hi = Math.max(...xs)
    let ylo = Math.min(...ys), yhi = Math.max(...ys)
    // include regression endpoints
    if (regression) {
      const ryLo = regression.a + regression.b * lo
      const ryHi = regression.a + regression.b * hi
      ylo = Math.min(ylo, ryLo, ryHi)
      yhi = Math.max(yhi, ryLo, ryHi)
    }
    const xPad = Math.max((hi - lo) * 0.12, 0.5)
    const yPad = Math.max((yhi - ylo) * 0.12, 0.5)
    lo -= xPad; hi += xPad; ylo -= yPad; yhi += yPad

    const makeTicks = (a, b, n) => {
      const range = b - a
      const step = Math.pow(10, Math.floor(Math.log10(range / n)))
      const ticks = []
      const start = Math.ceil(a / step) * step
      for (let v = start; v <= b; v += step) {
        ticks.push(parseFloat(v.toPrecision(6)))
        if (ticks.length > 15) break
      }
      return ticks
    }

    return { xMin: lo, xMax: hi, yMin: ylo, yMax: yhi, xTicks: makeTicks(lo, hi, 6), yTicks: makeTicks(ylo, yhi, 5) }
  }, [xs, ys, regression])

  const sx = (v) => pad + ((v - xMin) / ((xMax - xMin) || 1)) * (W - pad * 2)
  const sy = (v) => H - pad - ((v - yMin) / ((yMax - yMin) || 1)) * (H - pad * 2)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-[#0e1219]">
      <defs>
        <clipPath id={clipId}>
          <rect x={pad} y={pad / 2} width={W - pad * 2} height={H - pad * 1.5} />
        </clipPath>
      </defs>

      {/* grid */}
      {xTicks.map(t => (
        <line key={`xg${t}`} x1={sx(t)} y1={pad / 2} x2={sx(t)} y2={H - pad}
          stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      {yTicks.map(t => (
        <line key={`yg${t}`} x1={pad} y1={sy(t)} x2={W - pad} y2={sy(t)}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}

      {/* axes if range crosses zero */}
      {xMin <= 0 && xMax >= 0 && (
        <line x1={sx(0)} y1={pad / 2} x2={sx(0)} y2={H - pad}
          stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      )}
      {yMin <= 0 && yMax >= 0 && (
        <line x1={pad} y1={sy(0)} x2={W - pad} y2={sy(0)}
          stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      )}

      {/* tick labels */}
      {xTicks.map(t => (
        <text key={`xl${t}`} x={sx(t)} y={H - pad + 14}
          fill="rgba(255,255,255,0.4)" fontSize="7.5" textAnchor="middle">
          {t}
        </text>
      ))}
      {yTicks.map(t => (
        <text key={`yl${t}`} x={pad - 5} y={sy(t) + 3}
          fill="rgba(255,255,255,0.4)" fontSize="7.5" textAnchor="end">
          {t}
        </text>
      ))}

      <g clipPath={`url(#${clipId})`}>
        {/* regression line */}
        {regression && (
          <line
            x1={sx(xMin)} y1={sy(regression.a + regression.b * xMin)}
            x2={sx(xMax)} y2={sy(regression.a + regression.b * xMax)}
            stroke="#ff6b35" strokeWidth="2.5" strokeDasharray="6 3"
            strokeLinecap="round"
          />
        )}

        {/* data points */}
        {xs.map((x, i) => (
          <circle key={i} cx={sx(x)} cy={sy(ys[i])} r="5"
            fill="#5096ff" stroke="rgba(18,23,35,0.5)" strokeWidth="1.5" />
        ))}
      </g>
    </svg>
  )
}

/* ── stat metric cell ─────────────────────────────────── */

function StatCell({ label, value }) {
  return (
    <div className="flex flex-col rounded-lg bg-white/5 px-2.5 py-1.5">
      <span className="text-[0.55rem] uppercase tracking-wider text-paper/80">{label}</span>
      <span className="font-display text-[0.9rem] font-semibold text-paper">{value}</span>
    </div>
  )
}

/* ── MAIN: StatsMode ──────────────────────────────────── */

export function StatsMode() {
  const [tab, setTab] = useState('uni') // 'uni' | 'bi'
  const [uniInput, setUniInput] = useState('')
  const [xInput, setXInput] = useState('')
  const [yInput, setYInput] = useState('')

  // ── univariate computed ────────────────────────────
  const uniData = useMemo(() => parseUnivariateInput(uniInput), [uniInput])
  const uniStats = useMemo(() => {
    if (!uniData.length) return null
    const m = mode(uniData)
    return {
      n: count(uniData), sum: sum(uniData), mean: mean(uniData),
      median: median(uniData), mode: m.length ? m.map(v => format(v)).join(', ') : '—',
      σ: stdDevPop(uniData), s: stdDevSample(uniData),
      σ2: variancePop(uniData), s2: varianceSample(uniData),
      min: min(uniData), max: max(uniData), range: range(uniData),
      Q1: q1(uniData), Q3: q3(uniData), IQR: iqr(uniData),
    }
  }, [uniData])

  // ── bivariate computed ─────────────────────────────
  const biData = useMemo(() => parseBivariateInput(xInput, yInput), [xInput, yInput])
  const biStats = useMemo(() => {
    const { xs, ys } = biData
    if (xs.length < 2) return null
    const reg = linearRegression(xs, ys)
    const r = pearsonR(xs, ys)
    return { a: reg.a, b: reg.b, r, r2: rSquared(xs, ys) }
  }, [biData])

  // ── export ─────────────────────────────────────────
  const exportUni = () => {
    if (!uniStats) return
    const rows = [['Valor'], ...uniData.map(v => [v]), [],
      ['Estadístico', 'Valor'],
      ['n', uniStats.n], ['Suma', format(uniStats.sum)],
      ['Media', format(uniStats.mean)], ['Mediana', format(uniStats.median)],
      ['Moda', uniStats.mode], ['σ', format(uniStats.σ)], ['s', format(uniStats.s)],
      ['σ²', format(uniStats.σ2)], ['s²', format(uniStats.s2)],
      ['Mín', format(uniStats.min)], ['Máx', format(uniStats.max)],
      ['Rango', format(uniStats.range)],
      ['Q1', format(uniStats.Q1)], ['Q3', format(uniStats.Q3)], ['IQR', format(uniStats.IQR)],
    ]
    downloadCsv(rows, 'estadisticas-univariable.csv')
  }

  const exportBi = () => {
    if (!biStats) return
    const { xs, ys } = biData
    const rows = [['x', 'y', 'ŷ (predicción)'],
      ...xs.map((x, i) => [x, ys[i], format(biStats.a + biStats.b * x)]), [],
      ['Ecuación', `y = ${format(biStats.a)} + ${format(biStats.b)}x`],
      ['r', format(biStats.r)], ['r²', format(biStats.r2)],
    ]
    downloadCsv(rows, 'regresion-lineal.csv')
  }

  // ── sub-tab toggle ─────────────────────────────────
  const tabBtn = (m, label) => (
    <button
      onClick={() => setTab(m)}
      className={`flex-1 rounded-full py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${tab === m ? 'bg-aqua/20 text-aqua' : 'text-paper/80 hover:text-paper/60'}`}
    >
      {label}
    </button>
  )

  const textareaClass = 'w-full resize-none rounded-lg bg-white/8 px-3 py-2 font-mono text-sm text-paper outline-none placeholder:text-paper/25 focus:ring-1 focus:ring-aqua/40'

  return (
    <div className="flex flex-col">
      {/* sub-tab header */}
      <div className="flex gap-1 rounded-full bg-white/6 p-0.5 mx-3 mt-3 mb-2">
        {tabBtn('uni', '1 Variable')}
        {tabBtn('bi', '2 Variables')}
      </div>

      {tab === 'uni' ? (
        /* ── UNIVARIATE ─────────────────────────────── */
        <div className="flex flex-col gap-2 px-3 pb-3">
          {/* input */}
          <textarea
            rows={3}
            value={uniInput}
            onChange={e => setUniInput(e.target.value)}
            placeholder="12, 15, 18, 22, 25...  o uno por línea"
            className={textareaClass}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-paper/80">
              {uniData.length ? `n = ${uniData.length} valores` : 'Ingresa datos separados por comas'}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setUniInput(SAMPLE_UNI)}
                className="rounded-full bg-white/6 px-2 py-0.5 text-xs text-paper/80 hover:bg-white/10 hover:text-paper/65"
              >
                Ejemplo
              </button>
              {uniInput && (
                <button
                  onClick={() => setUniInput('')}
                  className="rounded-full bg-white/6 px-2 py-0.5 text-xs text-signal/70 hover:bg-signal/15"
                >
                  Borrar
                </button>
              )}
            </div>
          </div>

          {/* histogram */}
          {uniData.length >= 2 && (
            <MiniHistogram data={uniData} />
          )}

          {/* metrics */}
          {uniStats && (
            <div className="grid grid-cols-3 gap-1.5 max-h-[190px] overflow-y-auto pr-1">
              <StatCell label="n" value={uniStats.n} />
              <StatCell label="Σ" value={format(uniStats.sum)} />
              <StatCell label="x̄ (media)" value={format(uniStats.mean)} />
              <StatCell label="Mediana" value={format(uniStats.median)} />
              <StatCell label="Moda" value={uniStats.mode} />
              <StatCell label="Rango" value={format(uniStats.range)} />
              <StatCell label="σ (pob)" value={format(uniStats.σ)} />
              <StatCell label="s (muest)" value={format(uniStats.s)} />
              <StatCell label="σ²" value={format(uniStats.σ2)} />
              <StatCell label="s²" value={format(uniStats.s2)} />
              <StatCell label="Mín" value={format(uniStats.min)} />
              <StatCell label="Máx" value={format(uniStats.max)} />
              <StatCell label="Q1" value={format(uniStats.Q1)} />
              <StatCell label="Q3" value={format(uniStats.Q3)} />
              <StatCell label="IQR" value={format(uniStats.IQR)} />
            </div>
          )}

          {/* export */}
          {uniStats && (
            <button onClick={exportUni}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/6 py-2 text-xs text-paper/80 transition-colors hover:bg-white/10 hover:text-paper/60">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Exportar CSV
            </button>
          )}

          {/* empty state */}
          {!uniData.length && (
            <div className="flex h-28 items-center justify-center rounded-xl bg-[#0e1219] text-xs text-paper/25">
              Ingresa datos para ver estadísticas
            </div>
          )}
        </div>
      ) : (
        /* ── BIVARIATE ──────────────────────────────── */
        <div className="flex flex-col gap-2 px-3 pb-3">
          {/* dual inputs */}
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="mb-1 block text-[0.55rem] uppercase tracking-wider text-paper/80">x</span>
              <textarea
                rows={3}
                value={xInput}
                onChange={e => setXInput(e.target.value)}
                placeholder="1, 2, 3, 4, 5..."
                className={textareaClass}
              />
            </div>
            <div className="flex-1">
              <span className="mb-1 block text-[0.55rem] uppercase tracking-wider text-paper/80">y</span>
              <textarea
                rows={3}
                value={yInput}
                onChange={e => setYInput(e.target.value)}
                placeholder="2.1, 4.0, 5.8..."
                className={textareaClass}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-paper/80">
              {biData.error
                ? <span className="text-signal">{biData.error}</span>
                : biData.xs.length
                  ? `n = ${biData.xs.length} pares`
                  : 'Ingresa valores de x e y'}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => { setXInput(SAMPLE_X); setYInput(SAMPLE_Y) }}
                className="rounded-full bg-white/6 px-2 py-0.5 text-xs text-paper/80 hover:bg-white/10 hover:text-paper/65"
              >
                Ejemplo
              </button>
              {(xInput || yInput) && (
                <button
                  onClick={() => { setXInput(''); setYInput('') }}
                  className="rounded-full bg-white/6 px-2 py-0.5 text-xs text-signal/70 hover:bg-signal/15"
                >
                  Borrar
                </button>
              )}
            </div>
          </div>

          {/* scatter plot */}
          {biData.xs.length >= 2 && biStats && (
            <MiniScatter xs={biData.xs} ys={biData.ys} regression={biStats} />
          )}

          {/* regression results */}
          {biStats && (
            <div className="flex flex-col gap-1.5">
              {/* equation */}
              <div className="rounded-lg bg-white/5 px-3 py-2.5 text-center">
                <span className="text-[0.55rem] uppercase tracking-wider text-paper/80 block mb-1">Recta de regresión</span>
                <span className="font-mono text-sm text-signal font-semibold">
                  ŷ = {format(biStats.a)} {biStats.b >= 0 ? '+' : '−'} {format(Math.abs(biStats.b))}x
                </span>
              </div>

              {/* r and r² */}
              <div className="grid grid-cols-2 gap-1.5">
                <StatCell label="r (Pearson)" value={format(biStats.r)} />
                <StatCell label="r²" value={format(biStats.r2)} />
              </div>

              {/* interpretation */}
              <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                <span className="text-xs text-paper/80">
                  {Math.abs(biStats.r) >= 0.9 ? 'Correlación muy fuerte' :
                   Math.abs(biStats.r) >= 0.7 ? 'Correlación fuerte' :
                   Math.abs(biStats.r) >= 0.5 ? 'Correlación moderada' :
                   Math.abs(biStats.r) >= 0.3 ? 'Correlación débil' : 'Correlación muy débil'}
                  {biStats.r > 0 ? ' positiva' : biStats.r < 0 ? ' negativa' : ''}
                </span>
              </div>
            </div>
          )}

          {/* export */}
          {biStats && (
            <button onClick={exportBi}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/6 py-2 text-xs text-paper/80 transition-colors hover:bg-white/10 hover:text-paper/60">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Exportar CSV
            </button>
          )}

          {/* empty state */}
          {!biData.xs.length && !biData.error && (
            <div className="flex h-28 items-center justify-center rounded-xl bg-[#0e1219] text-xs text-paper/25">
              Ingresa pares (x, y) para ver regresión
            </div>
          )}
        </div>
      )}
    </div>
  )
}

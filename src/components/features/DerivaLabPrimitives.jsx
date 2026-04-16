import { useId, useState } from 'react'
import { Math as MathRender } from '../ui/Math'

export const LabCard = ({ title, children, dark = false, className = '' }) => (
  <div className={`${dark ? 'border-white/10 bg-ink text-paper' : 'border-ink/10 bg-white text-ink'} rounded-[1.6rem] border p-5 ${className}`}>
    {title && (
      <p className={`text-xs uppercase tracking-[0.22em] font-semibold ${dark ? 'text-paper/80' : 'text-ink/75'}`}>
        {title}
      </p>
    )}
    {children}
  </div>
)

export const ModelCard = ({
  title = 'Modelo general',
  expression,
  parameters,
  conditions,
  dark = false,
  className = '',
}) => (
  <div className={`${dark ? 'border-white/12 bg-white/8 text-paper' : 'border-ink/12 bg-paper text-ink'} overflow-x-auto rounded-[1.2rem] border px-4 py-4 ${className}`}>
    <p className={`text-xs uppercase tracking-[0.2em] font-semibold ${dark ? 'text-paper/80' : 'text-ink/75'}`}>{title}</p>
    <div className={`mt-2 min-w-max whitespace-nowrap ${dark ? 'text-paper' : 'text-ink'}`}>
      <div className="text-[1.08rem] font-semibold md:text-[1.18rem]">
        <MathRender>{expression}</MathRender>
      </div>
    </div>
    {(parameters || conditions) && (
      <div className={`mt-3 space-y-1 text-sm leading-6 ${dark ? 'text-paper/85' : 'text-ink/80'}`}>
        {parameters ? <p><span className="font-semibold">Parámetros:</span> {parameters}</p> : null}
        {conditions ? <p><span className="font-semibold">Condición:</span> {conditions}</p> : null}
      </div>
    )}
  </div>
)

const formatSliderValue = (value, step) => {
  if (value % 1 === 0) return String(Math.round(value))
  const decimals = step < 0.15 ? 2 : 1
  return value.toFixed(decimals)
}

export const SliderField = ({ id, label, value, min, max, step, suffix = '', natural = false, onChange }) => (
  <div className="rounded-[1.3rem] border border-ink/12 bg-white/95 p-4 shadow-[0_4px_12px_rgba(18,23,35,0.04)]">
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="flex items-center gap-2 text-[0.9rem] font-semibold text-ink">
        {label}
        {natural && (
          <span className="rounded-full border border-ink/14 bg-ink/6 px-2 py-0.5 font-mono text-xs font-normal text-ink/75 tracking-wide">
            ℕ
          </span>
        )}
      </label>
      <span className="font-display tabular-nums text-2xl text-ink">
        {formatSliderValue(value, step)}{suffix}
      </span>
    </div>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="mt-4 h-2 w-full cursor-pointer accent-[#ff6b35]"
    />
  </div>
)

export const MetricCard = ({ label, value, detail, className = '', valueClassName = '', dark = true }) => {
  const displayValue = `${value}`
  const isTextualValue = /[A-Za-z=]/.test(displayValue) || displayValue.length > 10

  return (
    <div className={`rounded-[1.3rem] border p-4 ${dark ? 'border-white/12 bg-white/8' : 'border-ink/12 bg-white'} ${className}`}>
      <p className={`text-xs uppercase leading-5 tracking-[0.16em] font-semibold ${dark ? 'text-paper/80' : 'text-ink/75'}`}>{label}</p>
      <div className="mt-3">
        <p
          className={`font-display tabular-nums ${dark ? 'text-paper' : 'text-ink'} ${
            isTextualValue
              ? 'break-words text-[1.35rem] leading-[1.08]'
              : 'whitespace-nowrap text-[1.9rem] leading-none'
          } ${valueClassName}`}
        >
          {displayValue}
        </p>
      </div>
      <p className={`mt-3 text-sm leading-7 ${dark ? 'text-paper/85' : 'text-ink/80'}`}>{detail}</p>
    </div>
  )
}

/* ── Axis range controls ─────────────────────────────────────────────── */

const AxisInput = ({ label, value, onChange }) => {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)
  const display = focused ? draft : String(value)

  const commit = () => {
    const num = Number(draft)
    if (Number.isFinite(num)) onChange(num)
    else setDraft(String(value))
  }

  return (
    <label className="flex items-center gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-paper/80">{label}</span>
      <input
        type="number"
        value={display}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => { setFocused(true); setDraft(String(value)) }}
        onBlur={() => { setFocused(false); commit() }}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(); e.target.blur() } }}
        className="w-[4.2rem] rounded-md border border-white/12 bg-white/8 px-2 py-1 text-xs tabular-nums text-paper outline-none focus:border-white/30 focus:bg-white/12"
      />
    </label>
  )
}

export const AxisRangePanel = ({ xMin, xMax, yMin, yMax, setRange, resetRange, isOverridden }) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          open ? 'bg-white/12 text-paper/80' : 'text-paper/80 hover:text-paper/60'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 3v18M3 12h18" />
          <path d="M8 8L3 3M16 8l5-5M8 16l-5 5M16 16l5 5" />
        </svg>
        Ejes
        {isOverridden && (
          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-signal" />
        )}
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-paper/75">X</span>
            <AxisInput label="mín" value={xMin} onChange={(v) => setRange('xMin', v)} />
            <AxisInput label="máx" value={xMax} onChange={(v) => setRange('xMax', v)} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-paper/75">Y</span>
            <AxisInput label="mín" value={yMin} onChange={(v) => setRange('yMin', v)} />
            <AxisInput label="máx" value={yMax} onChange={(v) => setRange('yMax', v)} />
          </div>
          {isOverridden && (
            <button
              type="button"
              onClick={resetRange}
              className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-paper/60 transition-colors hover:bg-white/18 hover:text-paper/80"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M3 12a9 9 0 1 1 3 6.7" /><path d="M3 22v-6h6" />
              </svg>
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export const CartesianFrame = ({
  width = 620,
  height = 320,
  xMin,
  xMax,
  yMin,
  yMax,
  children,
  dark = true,
  xTicks = [],
  yTicks = [],
  xTickFormatter,
  yTickFormatter,
  xLabel = '',
  yLabel = '',
  className = 'w-full h-auto overflow-visible rounded-[1.3rem]',
}) => {
  const clipId = useId().replace(/:/g, '')
  const [expanded, setExpanded] = useState(false)
  const padding = 28
  const expW = 960, expH = 520, expPad = 36, expFont = 14
  const scaleX = (value) => padding + (((value - xMin) / ((xMax - xMin) || 1)) * (width - (padding * 2)))
  const scaleY = (value) => height - padding - (((value - yMin) / ((yMax - yMin) || 1)) * (height - (padding * 2)))
  const expScaleX = (value) => expPad + (((value - xMin) / ((xMax - xMin) || 1)) * (expW - (expPad * 2)))
  const expScaleY = (value) => expH - expPad - (((value - yMin) / ((yMax - yMin) || 1)) * (expH - (expPad * 2)))
  const axisStroke = dark ? 'rgba(255,255,255,0.55)' : 'rgba(18,23,35,0.35)'
  const gridStrokeX = dark ? 'rgba(255,255,255,0.10)' : 'rgba(18,23,35,0.12)'
  const gridStrokeY = dark ? 'rgba(255,255,255,0.10)' : 'rgba(18,23,35,0.12)'
  const tickFill = dark ? 'rgba(255,255,255,0.80)' : 'rgba(18,23,35,0.72)'
  const btnFill = dark ? 'rgba(255,255,255,0.35)' : 'rgba(18,23,35,0.3)'

  return (
    <div className="relative">
      {/* expanded overlay */}
      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm p-6" onClick={() => setExpanded(false)}>
          <div className="relative w-full max-w-5xl rounded-2xl bg-ink border border-white/10 p-5 shadow-[0_32px_80px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setExpanded(false)} className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-paper/60 hover:bg-white/20 hover:text-paper transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <svg viewBox={`0 0 ${expW} ${expH}`} className="w-full h-auto overflow-visible rounded-xl">
              <defs><clipPath id={`${clipId}-exp`}><rect x={expPad} y={expPad} width={expW - expPad * 2} height={expH - expPad * 2} rx="12" ry="12" /></clipPath></defs>
              {yTicks.map((tick) => (<line key={`y-${tick}`} x1={expPad} y1={expScaleY(tick)} x2={expW - expPad} y2={expScaleY(tick)} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />))}
              {xTicks.map((tick) => (<line key={`x-${tick}`} x1={expScaleX(tick)} y1={expPad} x2={expScaleX(tick)} y2={expH - expPad} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />))}
              {xMin <= 0 && xMax >= 0 && <line x1={expScaleX(0)} y1={expPad} x2={expScaleX(0)} y2={expH - expPad} stroke="rgba(255,255,255,0.55)" strokeWidth="2" />}
              {yMin <= 0 && yMax >= 0 && <line x1={expPad} y1={expScaleY(0)} x2={expW - expPad} y2={expScaleY(0)} stroke="rgba(255,255,255,0.55)" strokeWidth="2" />}
              {xTicks.map((tick) => { const ay = (yMin <= 0 && yMax >= 0) ? expScaleY(0) : expH - expPad; return Math.abs(tick) > 0.001 ? <text key={`xt-${tick}`} x={expScaleX(tick)} y={ay + 20} fill="rgba(255,255,255,0.8)" fontSize={expFont} textAnchor="middle">{xTickFormatter ? xTickFormatter(tick) : tick}</text> : null })}
              {yTicks.map((tick) => { const ax = (xMin <= 0 && xMax >= 0) ? expScaleX(0) : expPad; return Math.abs(tick) > 0.001 ? <text key={`yt-${tick}`} x={ax - 10} y={expScaleY(tick) + 5} fill="rgba(255,255,255,0.8)" fontSize={expFont} textAnchor="end">{yTickFormatter ? yTickFormatter(tick) : tick}</text> : null })}
              <g clipPath={`url(#${clipId}-exp)`}>{children({ scaleX: expScaleX, scaleY: expScaleY, padding: expPad, width: expW, height: expH })}</g>
              {xLabel && <text x={expW / 2} y={expH - 4} fill="rgba(255,255,255,0.7)" fontSize={expFont} textAnchor="middle" fontWeight="600">{xLabel}</text>}
              {yLabel && <text x={12} y={expH / 2} fill="rgba(255,255,255,0.7)" fontSize={expFont} textAnchor="middle" fontWeight="600" transform={`rotate(-90, 12, ${expH / 2})`}>{yLabel}</text>}
            </svg>
          </div>
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className={className}>
        <defs>
          <clipPath id={clipId}>
            <rect x={padding} y={padding} width={width - (padding * 2)} height={height - (padding * 2)} rx="12" ry="12" />
          </clipPath>
        </defs>
        {yTicks.map((tick) => (
          <line key={`y-${tick}`} x1={padding} y1={scaleY(tick)} x2={width - padding} y2={scaleY(tick)} stroke={gridStrokeY} strokeWidth="1" />
        ))}
        {xTicks.map((tick) => (
          <line key={`x-${tick}`} x1={scaleX(tick)} y1={padding} x2={scaleX(tick)} y2={height - padding} stroke={gridStrokeX} strokeWidth="1" />
        ))}

        {xMin <= 0 && xMax >= 0 && (
          <line x1={scaleX(0)} y1={padding} x2={scaleX(0)} y2={height - padding} stroke={axisStroke} strokeWidth="2" />
        )}
        {yMin <= 0 && yMax >= 0 && (
          <line x1={padding} y1={scaleY(0)} x2={width - padding} y2={scaleY(0)} stroke={axisStroke} strokeWidth="2" />
        )}

        {xTicks.map((tick) => {
          const hasXAxis = yMin <= 0 && yMax >= 0
          const anchorY = hasXAxis ? scaleY(0) : height - padding
          return (
            <g key={`xt-${tick}`}>
              {hasXAxis && <line x1={scaleX(tick)} y1={anchorY - 4} x2={scaleX(tick)} y2={anchorY + 4} stroke={axisStroke} strokeWidth="1" />}
              {Math.abs(tick) > 0.001 && (
                <text x={scaleX(tick)} y={anchorY + 16} fill={tickFill} fontSize="11" textAnchor="middle">
                  {xTickFormatter ? xTickFormatter(tick) : tick}
                </text>
              )}
            </g>
          )
        })}
        {yTicks.map((tick) => {
          const hasYAxis = xMin <= 0 && xMax >= 0
          const anchorX = hasYAxis ? scaleX(0) : padding
          return (
            <g key={`yt-${tick}`}>
              {hasYAxis && <line x1={anchorX - 4} y1={scaleY(tick)} x2={anchorX + 4} y2={scaleY(tick)} stroke={axisStroke} strokeWidth="1" />}
              {Math.abs(tick) > 0.001 && (
                <text x={anchorX - 8} y={scaleY(tick) + 4} fill={tickFill} fontSize="11" textAnchor="end">
                  {yTickFormatter ? yTickFormatter(tick) : tick}
                </text>
              )}
            </g>
          )
        })}

        <g clipPath={`url(#${clipId})`}>
          {children({ scaleX, scaleY, padding, width: width, height: height })}
        </g>

        {xLabel && (
          <text x={width / 2} y={height - 2} fill={tickFill} fontSize="11" textAnchor="middle" fontWeight="600" opacity="0.7">
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text x={8} y={height / 2} fill={tickFill} fontSize="11" textAnchor="middle" fontWeight="600" opacity="0.7"
            transform={`rotate(-90, 8, ${height / 2})`}>
            {yLabel}
          </text>
        )}

        {/* expand/collapse button inside SVG */}
        <g onClick={() => setExpanded(v => !v)} cursor="pointer" opacity="0.6" className="hover:opacity-100">
          <rect x={width - padding - 22} y={6} width="22" height="22" rx="5" fill={dark ? 'rgba(255,255,255,0.08)' : 'rgba(18,23,35,0.06)'} />
          {expanded ? (
            <path d={`M ${width - padding - 16} 12 l 4 4 4 -4 M ${width - padding - 16} 22 l 4 -4 4 4`} stroke={btnFill} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          ) : (
            <path d={`M ${width - padding - 16} 15 l 4 -4 4 4 M ${width - padding - 16} 19 l 4 4 4 -4`} stroke={btnFill} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          )}
        </g>
      </svg>
    </div>
  )
}

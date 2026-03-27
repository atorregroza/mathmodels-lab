import { useId } from 'react'

// Supports three special patterns inside formula strings:
//   frac(num, den)  → proper vertical fraction (denominator supports one level of nested parens)
//   e^(exp)         → e with superscript
//   ^{exp}          → superscript for any base  — use instead of the ^ caret (IB-safe notation)
const renderMathExpression = (expression) => {
  if (typeof expression !== 'string') return expression

  const tokens = []
  // Match frac | e^(...) | ^{...} — in order of appearance
  const pattern = /frac\(([^,)]+),([^)(]*(?:\([^)]*\)[^)(]*)*)\)|e\^\(([^)]+)\)|\^\{([^}]+)\}/g
  let last = 0
  let match
  let key = 0

  while ((match = pattern.exec(expression)) !== null) {
    if (match.index > last) tokens.push(expression.slice(last, match.index))

    if (match[0].startsWith('frac')) {
      const num = match[1].trim()
      const den = match[2].trim()
      tokens.push(
        <span
          key={key++}
          className="mx-0.5 inline-flex flex-col items-center align-middle leading-none"
        >
          <span className="border-b border-current px-1 pb-0.5 text-[0.88em] leading-snug">{num}</span>
          <span className="px-1 pt-0.5 text-[0.88em] leading-snug">{den}</span>
        </span>,
      )
    } else if (match[0].startsWith('e^')) {
      tokens.push(
        <span key={key++} className="inline-flex items-start">
          <span>e</span>
          <sup className="ml-[1px] text-[0.72em] leading-none">{match[3]}</sup>
        </span>,
      )
    } else {
      // ^{exp} — superscript only (base is the preceding text token)
      tokens.push(
        <sup key={key++} className="text-[0.78em] leading-none">{match[4]}</sup>,
      )
    }

    last = match.index + match[0].length
  }

  if (tokens.length === 0) return expression
  if (last < expression.length) tokens.push(expression.slice(last))

  return tokens.map((t, i) =>
    typeof t === 'string' ? <span key={`t-${i}`}>{t}</span> : t,
  )
}

export const LabCard = ({ title, children, dark = false, className = '' }) => (
  <div className={`${dark ? 'border-white/10 bg-ink text-paper' : 'border-ink/10 bg-white text-ink'} rounded-[1.6rem] border p-5 ${className}`}>
    {title && (
      <p className={`text-[0.66rem] uppercase tracking-[0.28em] ${dark ? 'text-paper/45' : 'text-ink/45'}`}>
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
  <div className={`${dark ? 'border-white/10 bg-white/6 text-paper' : 'border-ink/10 bg-paper text-ink'} overflow-x-auto rounded-[1.2rem] border px-4 py-4 ${className}`}>
    <p className={`text-[0.68rem] uppercase tracking-[0.2em] ${dark ? 'text-paper/45' : 'text-ink/48'}`}>{title}</p>
    <div className={`mt-2 min-w-max whitespace-nowrap ${dark ? 'text-paper' : 'text-ink'}`}>
      <div className="text-[1.02rem] font-semibold md:text-[1.1rem]">{renderMathExpression(expression)}</div>
    </div>
    {(parameters || conditions) && (
      <div className={`mt-3 space-y-1 text-sm leading-6 ${dark ? 'text-paper/72' : 'text-ink/66'}`}>
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
  <div className="rounded-[1.3rem] border border-ink/10 bg-white/82 p-4">
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-ink">
        {label}
        {natural && (
          <span className="rounded-full border border-ink/14 bg-ink/6 px-2 py-0.5 font-mono text-[0.62rem] font-normal text-ink/55 tracking-wide">
            ℕ
          </span>
        )}
      </label>
      <span className="font-display text-2xl text-ink">
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
    <div className={`rounded-[1.3rem] border p-4 ${dark ? 'border-white/10 bg-white/6' : 'border-ink/10 bg-white'} ${className}`}>
      <p className={`text-[0.64rem] uppercase leading-5 tracking-[0.16em] ${dark ? 'text-paper/45' : 'text-ink/48'}`}>{label}</p>
      <div className="mt-3">
        <p
          className={`font-display ${dark ? 'text-paper' : 'text-ink'} ${
            isTextualValue
              ? 'break-words text-[1.35rem] leading-[1.08]'
              : 'whitespace-nowrap text-[1.9rem] leading-none'
          } ${valueClassName}`}
        >
          {displayValue}
        </p>
      </div>
      <p className={`mt-3 text-sm leading-7 ${dark ? 'text-paper/70' : 'text-ink/66'}`}>{detail}</p>
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
  className = 'w-full h-auto overflow-visible rounded-[1.3rem]',
}) => {
  const clipId = useId().replace(/:/g, '')
  const padding = 28
  const scaleX = (value) => padding + (((value - xMin) / ((xMax - xMin) || 1)) * (width - (padding * 2)))
  const scaleY = (value) => height - padding - (((value - yMin) / ((yMax - yMin) || 1)) * (height - (padding * 2)))
  const axisStroke = dark ? 'rgba(255,255,255,0.40)' : 'rgba(18,23,35,0.28)'
  const gridStrokeX = dark ? 'rgba(255,255,255,0.07)' : 'rgba(18,23,35,0.08)'
  const gridStrokeY = dark ? 'rgba(255,255,255,0.10)' : 'rgba(18,23,35,0.10)'
  const tickFill = dark ? 'rgba(255,255,255,0.72)' : 'rgba(18,23,35,0.68)'

  return (
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

      {yMin <= 0 && yMax >= 0 && xTicks.map((tick) => (
        <g key={`xt-${tick}`}>
          <line x1={scaleX(tick)} y1={scaleY(0) - 4} x2={scaleX(tick)} y2={scaleY(0) + 4} stroke={axisStroke} strokeWidth="1" />
          {Math.abs(tick) > 0.001 && (
            <text x={scaleX(tick)} y={scaleY(0) + 16} fill={tickFill} fontSize="10" textAnchor="middle">
              {xTickFormatter ? xTickFormatter(tick) : tick}
            </text>
          )}
        </g>
      ))}
      {xMin <= 0 && xMax >= 0 && yTicks.map((tick) => (
        <g key={`yt-${tick}`}>
          <line x1={scaleX(0) - 4} y1={scaleY(tick)} x2={scaleX(0) + 4} y2={scaleY(tick)} stroke={axisStroke} strokeWidth="1" />
          {Math.abs(tick) > 0.001 && (
            <text x={scaleX(0) - 8} y={scaleY(tick) + 4} fill={tickFill} fontSize="10" textAnchor="end">
              {yTickFormatter ? yTickFormatter(tick) : tick}
            </text>
          )}
        </g>
      ))}

      <g clipPath={`url(#${clipId})`}>
        {children({ scaleX, scaleY, padding, width, height })}
      </g>
    </svg>
  )
}

import { Math as MathRender } from '../ui/Math'

/**
 * LiveFormula — fórmula del modelo con parámetros sustituidos en tiempo real.
 *
 * Propósito pedagógico: el estudiante debe ver la expresión algebraica
 * cambiar simultáneamente con el movimiento del deslizador y el cambio
 * en la gráfica. Se usa PEGADO a los sliders / la gráfica, no al fondo
 * de la página. La tarjeta de "Modelo evaluado" lejana se queda sin
 * conexión visual; esta variante compacta la repara.
 *
 * Uso básico:
 *   <LiveFormula label="Modelo" expression={`g(x) = ${format(a)} \\cdot x + ${format(b)}`} />
 *
 * Con forma general + evaluada (tarjeta doble, recomendado):
 *   <LiveFormula
 *     label="Modelo"
 *     general="g(x) = a \\cdot x + b"
 *     evaluated={`g(x) = ${format(a)} \\cdot x + ${format(b)}`}
 *   />
 *
 * Props:
 *   label      — título corto (default "Modelo en tiempo real")
 *   general    — forma paramétrica (opcional, se muestra arriba tenue)
 *   evaluated  — expresión con valores sustituidos (requerida si no hay expression)
 *   expression — alias de evaluated si solo se pasa una fórmula
 *   tone       — 'light' (default, sobre fondo oscuro) | 'dark' (sobre fondo claro)
 *   align      — 'center' (default) | 'left'
 *   className
 *   raw        — true si las fórmulas ya vienen en LaTeX crudo (default false,
 *                así tolera tanto notación informal como LaTeX estándar vía toLatex)
 */
export const LiveFormula = ({
  label = 'Modelo en tiempo real',
  general,
  evaluated,
  expression,
  tone = 'light',
  align = 'center',
  className = '',
  raw = false,
}) => {
  const current = evaluated ?? expression ?? ''
  const isDark = tone === 'light'  // 'light' tone means white text (for dark bg)
  const alignClass = align === 'left' ? 'text-left' : 'text-center'

  return (
    <div
      className={`rounded-[1.2rem] border px-4 py-3 overflow-x-auto ${
        isDark
          ? 'border-white/12 bg-white/6 text-paper'
          : 'border-ink/12 bg-paper text-ink'
      } ${className}`}
    >
      <div className={`flex items-center justify-between gap-3 ${alignClass === 'text-center' ? 'mb-1.5' : 'mb-2'}`}>
        <p className={`text-[0.68rem] uppercase tracking-[0.22em] font-semibold ${
          isDark ? 'text-paper/55' : 'text-ink/55'
        }`}>
          {label}
        </p>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider ${
          isDark ? 'bg-signal/20 text-signal' : 'bg-signal/15 text-signal'
        }`}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
          </span>
          en vivo
        </span>
      </div>

      {general && (
        <div className={`${alignClass} text-[0.85rem] leading-6 ${isDark ? 'text-paper/48' : 'text-ink/48'}`}>
          <MathRender raw={raw}>{general}</MathRender>
        </div>
      )}

      <div className={`${alignClass} ${general ? 'mt-1.5' : ''} min-w-max whitespace-nowrap`}>
        <div className={`text-[1.02rem] font-semibold md:text-[1.12rem] ${
          isDark ? 'text-signal' : 'text-signal'
        }`}>
          <MathRender raw={raw}>{current}</MathRender>
        </div>
      </div>
    </div>
  )
}

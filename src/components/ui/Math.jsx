import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { toLatex } from './toLatex'

/**
 * Renderiza notación matemática con KaTeX.
 *
 * Uso canónico (labs nuevos):
 *   <Math>{String.raw`\frac{a}{b}`}</Math>                     → inline
 *   <Math display>{String.raw`\int_0^1 x^2\,dx`}</Math>        → bloque centrado
 *
 * Compatibilidad (labs existentes, notación informal):
 *   <Math>{'frac(a,b) · e^(x²) + √(2π)'}</Math>  → se convierte vía toLatex()
 *
 * Props:
 *   display   — renderiza en modo display (centrado, fórmulas grandes)
 *   raw       — omite toLatex() y asume que children ya es LaTeX válido
 */
export function Math({ children, display = false, raw = false, className = '' }) {
  const html = useMemo(() => {
    const src = raw ? String(children ?? '') : toLatex(String(children ?? ''))
    try {
      return katex.renderToString(src, {
        displayMode: display,
        throwOnError: false,
        strict: 'ignore',
        trust: false,
        output: 'html',
      })
    } catch {
      return String(children ?? '')
    }
  }, [children, display, raw])

  const Tag = display ? 'div' : 'span'
  return (
    <Tag
      className={`math-render ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

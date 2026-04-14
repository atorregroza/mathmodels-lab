/* ── conversor notación informal → LaTeX ───────────────────────────
 * Los labs escribieron durante meses cosas como `frac(a,b)`, `e^(x)`,
 * `²`, `π`, `√(2π)`, `·`. Para no romperlos, `<Math>` acepta ese
 * dialecto y lo traduce a LaTeX antes de pasar a KaTeX. Los labs
 * nuevos (tanda 1 del overhaul) deberían escribir LaTeX directo.
 * ────────────────────────────────────────────────────────────────── */

const GREEK = {
  π: '\\pi', μ: '\\mu', σ: '\\sigma', φ: '\\varphi', ψ: '\\psi',
  θ: '\\theta', α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta',
  λ: '\\lambda', ω: '\\omega', τ: '\\tau', ρ: '\\rho', ε: '\\varepsilon',
  Δ: '\\Delta', Ω: '\\Omega', Σ: '\\Sigma', Π: '\\Pi', Φ: '\\Phi',
  Θ: '\\Theta', Λ: '\\Lambda',
}
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', ⁿ: 'n', ˣ: 'x', '⁺': '+', '⁻': '-', '⁽': '(', '⁾': ')' }
const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', ₙ: 'n' }
const BB = { ℕ: '\\mathbb{N}', ℝ: '\\mathbb{R}', ℤ: '\\mathbb{Z}', ℚ: '\\mathbb{Q}', ℂ: '\\mathbb{C}' }

export function toLatex(input) {
  if (typeof input !== 'string') return String(input ?? '')
  let s = input

  // minus Unicode → ASCII minus
  s = s.replace(/−/g, '-')

  // frac(num, den)  — aplicado repetidamente para soportar anidamiento arbitrario
  {
    let prev
    do {
      prev = s
      s = s.replace(/frac\(([^,()]+),\s*([^)(]*(?:\([^)]*\)[^)(]*)*)\)/g,
        (_, n, d) => `\\frac{${n.trim()}}{${d.trim()}}`)
    } while (s !== prev)
  }

  // subíndices multi-carácter: T_int → T_{int}, h_out → h_{out}
  // (solo cuando siguen 2+ letras/dígitos sin llaves previas)
  s = s.replace(/([A-Za-z])_([A-Za-z0-9]{2,})\b/g, '$1_{$2}')

  // e^(expr) → e^{expr}
  s = s.replace(/e\^\(([^)]+)\)/g, 'e^{$1}')

  // √(expr) → \sqrt{expr}  y  √5 / √x → \sqrt{…}
  s = s.replace(/√\(([^)]+)\)/g, '\\sqrt{$1}')
  s = s.replace(/√([A-Za-z0-9πμσφψθαβγδλω]+)/g, '\\sqrt{$1}')

  // superíndices Unicode consecutivos → ^{…}
  s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹ⁿˣ⁺⁻⁽⁾]+)/g,
    m => '^{' + [...m].map(c => SUP[c]).join('') + '}')

  // subíndices Unicode consecutivos → _{…}
  s = s.replace(/([₀₁₂₃₄₅₆₇₈₉ₙ]+)/g,
    m => '_{' + [...m].map(c => SUB[c]).join('') + '}')

  // funciones españolas / inglesas → comandos LaTeX (evita duplicar \\)
  s = s.replace(/(?<!\\)\basin\b/g, '\\arcsin')
  s = s.replace(/(?<!\\)\bacos\b/g, '\\arccos')
  s = s.replace(/(?<!\\)\batan\b/g, '\\arctan')
  s = s.replace(/(?<!\\)\bsen\b/g, '\\operatorname{sen}')
  s = s.replace(/(?<!\\)\b(sin|cos|tan|log|ln|exp|max|min)\b/g, '\\$1')

  // letras griegas
  s = s.replace(/[πμσφψθαβγδλωτρεΔΩΣΠΦΘΛ]/g, m => GREEK[m] || m)

  // conjuntos de números
  s = s.replace(/[ℕℝℤℚℂ]/g, m => BB[m] || m)

  // operadores y relaciones
  s = s.replace(/·/g, '\\cdot ')
  s = s.replace(/×/g, '\\times ')
  s = s.replace(/÷/g, '\\div ')
  s = s.replace(/≈/g, '\\approx ')
  s = s.replace(/≥/g, '\\geq ')
  s = s.replace(/≤/g, '\\leq ')
  s = s.replace(/≠/g, '\\neq ')
  s = s.replace(/≡/g, '\\equiv ')
  s = s.replace(/∈/g, '\\in ')
  s = s.replace(/∉/g, '\\notin ')
  s = s.replace(/∞/g, '\\infty ')
  s = s.replace(/±/g, '\\pm ')
  s = s.replace(/→/g, '\\to ')

  return s
}

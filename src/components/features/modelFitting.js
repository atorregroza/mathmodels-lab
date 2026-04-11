/* ── modelFitting.js ── curve fitting for 6 model families ── */

import { linearRegression } from './statisticsUtils'

// ─── Helpers ───────────────────────────────────────────

function sumOf(arr) {
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i]
  return s
}

function meanOf(arr) {
  return arr.length ? sumOf(arr) / arr.length : 0
}

/** R² (coefficient of determination) given data and a predict function */
export function computeR2(xs, ys, predictFn) {
  const yMean = meanOf(ys)
  let ssTot = 0, ssRes = 0
  for (let i = 0; i < xs.length; i++) {
    const yHat = predictFn(xs[i])
    ssTot += (ys[i] - yMean) ** 2
    ssRes += (ys[i] - yHat) ** 2
  }
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot
}

/** MAE (mean absolute error) */
export function computeMAE(xs, ys, predictFn) {
  let s = 0
  for (let i = 0; i < xs.length; i++) s += Math.abs(ys[i] - predictFn(xs[i]))
  return xs.length ? s / xs.length : 0
}

/** MSE (mean squared error) */
export function computeMSE(xs, ys, predictFn) {
  let s = 0
  for (let i = 0; i < xs.length; i++) s += (ys[i] - predictFn(xs[i])) ** 2
  return xs.length ? s / xs.length : 0
}

// ─── Advanced Diagnostics ──────────────────────────────

/** Adjusted R² — penalizes extra parameters */
export function computeAdjR2(xs, ys, predictFn, numParams) {
  const n = xs.length
  if (n <= numParams) return -Infinity
  const r2 = computeR2(xs, ys, predictFn)
  return 1 - ((1 - r2) * (n - 1)) / (n - numParams - 1)
}

/** AIC (Akaike Information Criterion) — lower is better, penalizes complexity */
export function computeAIC(xs, ys, predictFn, numParams) {
  const n = xs.length
  if (n < 2) return Infinity
  const mse = computeMSE(xs, ys, predictFn)
  const logMSE = mse <= 0 ? 0 : Math.log(Math.max(mse, 1e-10))
  return n * logMSE + 2 * numParams
}

/** BIC (Bayesian Information Criterion) — stronger penalty for complexity than AIC */
export function computeBIC(xs, ys, predictFn, numParams) {
  const n = xs.length
  if (n < 2) return Infinity
  const mse = computeMSE(xs, ys, predictFn)
  if (mse <= 0) return -Infinity
  return n * Math.log(mse) + numParams * Math.log(n)
}

/** Residuals array */
export function computeResiduals(xs, ys, predictFn) {
  return xs.map((x, i) => ys[i] - predictFn(x))
}

/** Durbin-Watson statistic — tests autocorrelation in residuals (ideal ≈ 2) */
export function durbinWatson(residuals) {
  if (residuals.length < 3) return 2
  let sumDiffSq = 0, sumSq = 0
  for (let i = 0; i < residuals.length; i++) {
    sumSq += residuals[i] ** 2
    if (i > 0) sumDiffSq += (residuals[i] - residuals[i - 1]) ** 2
  }
  return sumSq === 0 ? 2 : sumDiffSq / sumSq
}

/** Runs test — checks if residual signs are random (not patterned)
 *  Returns: { runs, expectedRuns, zScore, isRandom }
 *  If |zScore| > 1.96, residuals show a significant pattern → model is suspect
 */
export function runsTest(residuals) {
  if (residuals.length < 4) return { runs: 0, expectedRuns: 0, zScore: 0, isRandom: true }
  const signs = residuals.map(r => r >= 0 ? 1 : -1)
  let runs = 1
  for (let i = 1; i < signs.length; i++) {
    if (signs[i] !== signs[i - 1]) runs++
  }
  const n1 = signs.filter(s => s > 0).length
  const n2 = signs.filter(s => s < 0).length
  const n = n1 + n2
  if (n1 === 0 || n2 === 0) return { runs, expectedRuns: 1, zScore: 0, isRandom: true }
  const expectedRuns = 1 + (2 * n1 * n2) / n
  const variance = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1))
  const zScore = variance > 0 ? (runs - expectedRuns) / Math.sqrt(variance) : 0
  return { runs, expectedRuns, zScore, isRandom: Math.abs(zScore) <= 1.96 }
}

/** Leave-one-out cross-validation (LOOCV) — R² on held-out points
 *  This is the gold standard for small datasets: fit on n-1 points, predict the left-out one
 *  If CV-R² << R², the model is overfitting
 */
export function crossValidateR2(xs, ys, fitter) {
  const n = xs.length
  if (n < 4) return null // need at least 4 points for meaningful CV
  const yMean = meanOf(ys)
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < n; i++) {
    const trainX = [...xs.slice(0, i), ...xs.slice(i + 1)]
    const trainY = [...ys.slice(0, i), ...ys.slice(i + 1)]
    try {
      const model = fitter(trainX, trainY)
      if (!model || !model.fn) continue
      const yHat = model.fn(xs[i])
      if (!isFinite(yHat)) continue
      ssRes += (ys[i] - yHat) ** 2
    } catch {
      continue
    }
    ssTot += (ys[i] - yMean) ** 2
  }
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot
}

/** Comprehensive diagnostics for a fitted model */
export function diagnoseModel(xs, ys, model) {
  const n = xs.length
  const k = Object.keys(model.params).length // number of parameters
  const residuals = computeResiduals(xs, ys, model.fn)
  const adjR2 = computeAdjR2(xs, ys, model.fn, k)
  const aic = computeAIC(xs, ys, model.fn, k)
  const bic = computeBIC(xs, ys, model.fn, k)
  const dw = durbinWatson(residuals)
  const runs = runsTest(residuals)

  // Residual pattern strength (0 = random, 1 = highly patterned)
  const patternStrength = Math.min(Math.abs(runs.zScore) / 3, 1)

  // Overfitting risk
  const degreesOfFreedom = n - k
  const overfitRisk = degreesOfFreedom < 3 ? 'alto'
    : degreesOfFreedom < 6 ? 'moderado'
    : 'bajo'

  // Warnings
  const warnings = []
  if (n < 5) warnings.push('Pocos datos: con menos de 5 puntos, cualquier modelo puede parecer perfecto sin serlo.')
  if (n <= k + 1) warnings.push('Sobreajuste casi seguro: tienes tantos parámetros como datos. El modelo memoriza, no generaliza.')
  if (!runs.isRandom) warnings.push('Los residuales muestran un patrón — el modelo no captura bien la estructura de los datos.')
  if (dw < 1.0) warnings.push('Autocorrelación positiva en residuales: los errores no son independientes.')
  if (dw > 3.0) warnings.push('Autocorrelación negativa en residuales: el modelo puede estar oscilando alrededor de los datos.')
  if (model.r2 > 0.99 && n < 8) warnings.push('R² perfecto con pocos datos: sospechoso. Más datos confirmarían si el patrón es real.')
  if (adjR2 < model.r2 - 0.1) warnings.push('R² ajustado mucho menor que R²: el modelo puede ser innecesariamente complejo.')

  return {
    residuals,
    adjR2,
    aic,
    bic,
    durbinWatson: dw,
    runsTest: runs,
    patternStrength,
    overfitRisk,
    degreesOfFreedom,
    numParams: k,
    warnings,
  }
}

/** Generate a rich pedagogical interpretation */
/**
 * Generate rich pedagogical interpretation for school students
 * @param {object} model - fitted model with r2, diagnostics, etc.
 * @param {object} diagnostics - from diagnoseModel()
 * @param {number} n - number of data points
 * @param {object} context - { xName, yName } variable descriptions (optional)
 */
export function interpretModel(model, diagnostics, n, context = {}) {
  const xName = context.xName || 'x'
  const yName = context.yName || 'y'
  const lines = []

  // R² — explained like a percentage grade
  const pct = (model.r2 * 100).toFixed(1)
  if (model.r2 >= 0.95) {
    lines.push(`El modelo explica el ${pct}% de la variación observada en "${yName}". Esto significa que la relación con "${xName}" es muy fuerte y el modelo captura bien la estructura de los datos.`)
  } else if (model.r2 >= 0.70) {
    lines.push(`El modelo explica el ${pct}% de la variación en "${yName}". Captura la tendencia general, pero hay un ${(100 - parseFloat(pct)).toFixed(1)}% de variación que depende de otros factores que no estamos considerando.`)
  } else if (model.r2 >= 0.40) {
    lines.push(`El modelo solo explica ${pct}% de la variación en "${yName}". Hay mucho que no captura — probablemente "${yName}" depende de más cosas que solo "${xName}".`)
  } else {
    lines.push(`El modelo apenas explica ${pct}% de la variación. Esto sugiere que "${xName}" no es un buen predictor de "${yName}", o que la relación no sigue esta forma.`)
  }

  // Adjusted R² vs R² — explained simply
  if (diagnostics.adjR2 < model.r2 - 0.05) {
    lines.push(`Al corregir por la cantidad de parámetros, el ajuste baja a ${(diagnostics.adjR2 * 100).toFixed(1)}%. Esto indica que el modelo podría ser más complejo de lo necesario — un modelo más simple podría funcionar igual de bien.`)
  }

  // Residual pattern — the key diagnostic
  if (!diagnostics.runsTest.isRandom) {
    lines.push('Los errores del modelo (residuales) no son aleatorios — forman un patrón. Esto es una señal importante: significa que hay algo sistemático en los datos que el modelo no está capturando. Prueba con otra familia de funciones.')
  } else if (n >= 5) {
    lines.push('Los errores del modelo se distribuyen aleatoriamente arriba y abajo de la curva. Eso es buena señal: el modelo captura la estructura real de los datos y lo que queda es variación natural.')
  }

  // Cross-validation
  if (model.cvR2 != null) {
    if (model.cvR2 < model.r2 - 0.15) {
      lines.push(`Prueba de generalización: cuando ocultamos un dato y predecimos con los demás, el ajuste baja a ${(model.cvR2 * 100).toFixed(1)}%. Esto indica que el modelo podría estar "memorizando" los datos en vez de aprender el patrón real.`)
    } else if (model.cvR2 >= 0) {
      lines.push(`Prueba de generalización: al ocultar un dato y predecir con los demás, el modelo mantiene un ajuste de ${(model.cvR2 * 100).toFixed(1)}%. Esto confirma que el patrón es consistente, no una coincidencia.`)
    }
  }

  // Overfitting — explained with analogy
  if (diagnostics.overfitRisk === 'alto') {
    lines.push(`Riesgo de sobreajuste alto: el modelo usa ${diagnostics.numParams} parámetros para ajustar solo ${n} datos. Con tan pocos grados de libertad, casi cualquier modelo puede parecer perfecto sin realmente capturar el fenómeno. Se necesitan más observaciones para validar esta conclusión.`)
  } else if (diagnostics.overfitRisk === 'moderado') {
    lines.push('Los datos son justos para este modelo. Agregar más observaciones haría la conclusión más confiable.')
  }

  // Causation — the most important message
  if (context.xName && context.yName) {
    lines.push(`Pregunta clave: ¿cambiar "${xName}" realmente CAUSA un cambio en "${yName}", o solo coinciden? Por ejemplo, las ventas de helado y los ahogamientos suben juntos en verano, pero uno no causa el otro — ambos dependen del calor. ¿Hay una razón científica o lógica para que "${xName}" afecte a "${yName}"?`)
  } else {
    lines.push('Recuerda: que los datos se ajusten a una curva no significa que una variable cause la otra. Correlación ≠ causalidad. Pregúntate: ¿hay una razón teórica para que esta relación exista?')
  }

  return lines
}

// ─── Model Families ────────────────────────────────────

/** Linear: y = a + bx */
function fitLinear(xs, ys) {
  const { a, b } = linearRegression(xs, ys)
  const fn = (x) => a + b * x
  return {
    id: 'linear',
    label: 'Lineal',
    equation: 'y = a + bx',
    params: { a, b },
    fn,
    formula: `y = ${fmt(a)} ${b >= 0 ? '+' : '−'} ${fmt(Math.abs(b))}x`,
    description: 'Los datos cambian a ritmo constante. Cada unidad de x agrega la misma cantidad a y.',
    when: 'Crecimiento o decrecimiento uniforme, sin curvatura visible.',
    patterns: ['crece', 'decrece'],
  }
}

/** Quadratic: y = ax² + bx + c — normal equations (3×3 system) */
function fitQuadratic(xs, ys) {
  const n = xs.length
  if (n < 3) return null

  // Σx, Σx², Σx³, Σx⁴, Σy, Σxy, Σx²y
  let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0, sy = 0, sxy = 0, sx2y = 0
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i]
    const x2 = x * x
    sx += x; sx2 += x2; sx3 += x2 * x; sx4 += x2 * x2
    sy += y; sxy += x * y; sx2y += x2 * y
  }

  // Solve: [n, sx, sx2; sx, sx2, sx3; sx2, sx3, sx4] · [c, b, a]ᵀ = [sy, sxy, sx2y]
  const M = [
    [n, sx, sx2, sy],
    [sx, sx2, sx3, sxy],
    [sx2, sx3, sx4, sx2y],
  ]

  // Gaussian elimination
  for (let col = 0; col < 3; col++) {
    // pivot
    let maxRow = col
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]]
    if (Math.abs(M[col][col]) < 1e-12) return null
    const pivot = M[col][col]
    for (let j = col; j <= 3; j++) M[col][j] /= pivot
    for (let row = 0; row < 3; row++) {
      if (row === col) continue
      const factor = M[row][col]
      for (let j = col; j <= 3; j++) M[row][j] -= factor * M[col][j]
    }
  }

  const c = M[0][3], b = M[1][3], a = M[2][3]
  const fn = (x) => a * x * x + b * x + c
  return {
    id: 'quadratic',
    label: 'Cuadrático',
    equation: 'y = ax² + bx + c',
    params: { a, b, c },
    fn,
    formula: `y = ${fmt(a)}x² ${b >= 0 ? '+' : '−'} ${fmt(Math.abs(b))}x ${c >= 0 ? '+' : '−'} ${fmt(Math.abs(c))}`,
    description: 'Los datos forman una curva con un máximo o mínimo. La tasa de cambio no es constante.',
    when: 'Datos con curvatura — sube y luego baja (o viceversa), como un arco.',
    patterns: ['sube_baja', 'crece', 'decrece'],
  }
}

/** Exponential: y = a·e^(bx) — linearize via ln(y) */
function fitExponential(xs, ys) {
  // Filter out non-positive y values
  const validIdx = []
  for (let i = 0; i < ys.length; i++) {
    if (ys[i] > 0) validIdx.push(i)
  }
  if (validIdx.length < 2) return null

  const filtered = ys.length - validIdx.length
  const vx = validIdx.map(i => xs[i])
  const vy = validIdx.map(i => Math.log(ys[i]))
  const reg = linearRegression(vx, vy)
  const a = Math.exp(reg.a)
  const b = reg.b
  const fn = (x) => a * Math.exp(b * x)
  return {
    id: 'exponential',
    label: 'Exponencial',
    equation: 'y = a·e^(bx)',
    params: { a, b },
    fn,
    formula: `y = ${fmt(a)}·e^(${fmt(b)}x)`,
    description: 'El crecimiento se acelera — cada paso multiplica y por un factor fijo.',
    when: 'Crecimiento o decaimiento que se acelera con el tiempo (poblaciones, radiactividad).',
    patterns: ['crece', 'decrece'],
    filteredCount: filtered,
    usedCount: validIdx.length,
  }
}

/** Power: y = a·x^b — linearize via ln(y) = ln(a) + b·ln(x) */
function fitPower(xs, ys) {
  const validIdx = []
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > 0 && ys[i] > 0) validIdx.push(i)
  }
  if (validIdx.length < 2) return null

  const filtered = xs.length - validIdx.length
  const vx = validIdx.map(i => Math.log(xs[i]))
  const vy = validIdx.map(i => Math.log(ys[i]))
  const reg = linearRegression(vx, vy)
  const a = Math.exp(reg.a)
  const b = reg.b
  const fn = (x) => a * Math.pow(x, b)
  return {
    id: 'power',
    label: 'Potencia',
    equation: 'y = a·x^b',
    params: { a, b },
    fn,
    formula: `y = ${fmt(a)}·x^${fmt(b)}`,
    description: 'La relación escala — al duplicar x, y se multiplica por 2^b.',
    when: 'Relaciones geométricas (área vs lado, gravedad vs distancia).',
    patterns: ['crece', 'decrece'],
    filteredCount: filtered,
    usedCount: validIdx.length,
  }
}

/** Logarithmic: y = a + b·ln(x) */
function fitLogarithmic(xs, ys) {
  const validIdx = []
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > 0) validIdx.push(i)
  }
  if (validIdx.length < 2) return null

  const filtered = xs.length - validIdx.length
  const vx = validIdx.map(i => Math.log(xs[i]))
  const vy = validIdx.map(i => ys[i])
  const reg = linearRegression(vx, vy)
  const a = reg.a, b = reg.b
  const fn = (x) => a + b * Math.log(x)
  return {
    id: 'logarithmic',
    label: 'Logarítmico',
    equation: 'y = a + b·ln(x)',
    params: { a, b },
    fn,
    formula: `y = ${fmt(a)} ${b >= 0 ? '+' : '−'} ${fmt(Math.abs(b))}·ln(x)`,
    description: 'Crece rápido al principio y luego se desacelera — rendimientos decrecientes.',
    when: 'Datos que crecen rápido al inicio pero se estabilizan (aprendizaje, sensación).',
    patterns: ['crece', 'decrece'],
    filteredCount: filtered,
    usedCount: validIdx.length,
  }
}

/** Sinusoidal: y = a·sin(bx + c) + d — heuristic estimation */
function fitSinusoidal(xs, ys) {
  if (xs.length < 4) return null

  // d = mean of y
  const d = meanOf(ys)
  // a = half the range
  const yMin = Math.min(...ys), yMax = Math.max(...ys)
  const a = (yMax - yMin) / 2

  if (a < 1e-10) return null

  // Estimate frequency b: find zero crossings of (y - d)
  const centered = ys.map(y => y - d)
  let crossings = 0
  for (let i = 1; i < centered.length; i++) {
    if (centered[i - 1] * centered[i] < 0) crossings++
  }
  const xRange = xs[xs.length - 1] - xs[0]
  // Each full period has 2 zero crossings
  const periods = Math.max(crossings / 2, 0.5)
  const b = (2 * Math.PI * periods) / xRange

  // Estimate phase c: find x where y is max, then c = π/2 - b·xMax
  let maxIdx = 0
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] > ys[maxIdx]) maxIdx = i
  }
  const c = Math.PI / 2 - b * xs[maxIdx]

  // Refine with simple grid search on c
  let bestC = c, bestR2 = -Infinity
  for (let dc = -Math.PI; dc <= Math.PI; dc += 0.1) {
    const testC = c + dc
    const testFn = (x) => a * Math.sin(b * x + testC) + d
    const r2 = computeR2(xs, ys, testFn)
    if (r2 > bestR2) { bestR2 = r2; bestC = testC }
  }

  const fn = (x) => a * Math.sin(b * x + bestC) + d
  return {
    id: 'sinusoidal',
    label: 'Senoidal',
    equation: 'y = a·sin(bx + c) + d',
    params: { a, b, c: bestC, d },
    fn,
    formula: `y = ${fmt(a)}·sin(${fmt(b)}x ${bestC >= 0 ? '+' : '−'} ${fmt(Math.abs(bestC))}) ${d >= 0 ? '+' : '−'} ${fmt(Math.abs(d))}`,
    description: 'Los datos suben y bajan de forma repetitiva, como una ola.',
    when: 'Fenómenos periódicos (mareas, temperatura estacional, sonido).',
    patterns: ['oscila'],
  }
}

// ─── Formatting helper ─────────────────────────────────

function fmt(v) {
  if (!isFinite(v)) return '?'
  const rounded = parseFloat(v.toPrecision(4))
  return String(rounded)
}

// ─── Model families registry ───────────────────────────

const ALL_FITTERS = [
  fitLinear,
  fitQuadratic,
  fitExponential,
  fitPower,
  fitLogarithmic,
  fitSinusoidal,
]

/** Map family id → fitter function (for cross-validation) */
const FITTER_MAP = {
  linear: fitLinear,
  quadratic: fitQuadratic,
  exponential: fitExponential,
  power: fitPower,
  logarithmic: fitLogarithmic,
  sinusoidal: fitSinusoidal,
}

/** Pattern-based relevance hints */
const PATTERN_RELEVANCE = {
  crece: { likely: ['linear', 'exponential', 'power', 'logarithmic', 'quadratic'], unlikely: ['sinusoidal'] },
  decrece: { likely: ['linear', 'exponential', 'power', 'logarithmic', 'quadratic'], unlikely: ['sinusoidal'] },
  sube_baja: { likely: ['quadratic', 'sinusoidal'], unlikely: ['linear', 'exponential', 'power', 'logarithmic'] },
  oscila: { likely: ['sinusoidal'], unlikely: ['linear', 'exponential', 'power', 'logarithmic'] },
}

/**
 * Get relevance hints for each model based on observed pattern
 * @param {string|null} pattern - 'crece' | 'decrece' | 'sube_baja' | 'oscila' | null
 * @returns {{ likely: string[], unlikely: string[] }}
 */
export function getPatternHints(pattern) {
  if (!pattern || !PATTERN_RELEVANCE[pattern]) {
    return { likely: [], unlikely: [] }
  }
  return PATTERN_RELEVANCE[pattern]
}

/**
 * Fit all model families to the data and return ranked results
 * @param {number[]} xs
 * @param {number[]} ys
 * @param {string[]|null} filterFamilies - only fit these family IDs (null = all)
 * @returns {Array<{id, label, equation, params, fn, formula, description, when, r2, mae, mse}>}
 */
export function rankModels(xs, ys, filterFamilies = null) {
  if (xs.length < 2) return []

  const results = []
  for (const fitter of ALL_FITTERS) {
    const model = fitter(xs, ys)
    if (!model) continue
    if (filterFamilies && !filterFamilies.includes(model.id)) continue

    // Validate that fn produces finite values for all data points
    let valid = true
    for (const x of xs) {
      const y = model.fn(x)
      if (!isFinite(y)) { valid = false; break }
    }
    if (!valid) continue

    const r2 = computeR2(xs, ys, model.fn)
    const mae = computeMAE(xs, ys, model.fn)
    const mse = computeMSE(xs, ys, model.fn)
    const numParams = Object.keys(model.params).length
    const diag = diagnoseModel(xs, ys, { ...model, r2 })

    // Cross-validation (skip for very small datasets — too slow / unstable)
    let cvR2 = null
    if (xs.length >= 5 && FITTER_MAP[model.id]) {
      cvR2 = crossValidateR2(xs, ys, FITTER_MAP[model.id])
    }

    results.push({ ...model, r2, mae, mse, numParams, diagnostics: diag, cvR2 })
  }

  // Sort by AIC (penalizes complexity), then R² as tiebreaker
  results.sort((a, b) => {
    const aicDiff = a.diagnostics.aic - b.diagnostics.aic
    if (Math.abs(aicDiff) > 2) return aicDiff // AIC difference > 2 is meaningful
    return b.r2 - a.r2 // tiebreaker: higher R²
  })
  return results
}

/**
 * Get model family metadata (descriptions, formulas) without fitting
 */
export const MODEL_FAMILIES = [
  { id: 'linear', label: 'Lineal', equation: 'y = a + bx',
    description: 'Los datos cambian a ritmo constante. Cada unidad de x agrega la misma cantidad a y.',
    when: 'Crecimiento o decrecimiento uniforme, sin curvatura visible.',
    icon: 'linear' },
  { id: 'quadratic', label: 'Cuadrático', equation: 'y = ax² + bx + c',
    description: 'Los datos forman una curva con un máximo o mínimo. La tasa de cambio no es constante.',
    when: 'Datos con curvatura — sube y luego baja (o viceversa), como un arco.',
    icon: 'quadratic' },
  { id: 'exponential', label: 'Exponencial', equation: 'y = a·e^(bx)',
    description: 'El crecimiento se acelera — cada paso multiplica y por un factor fijo.',
    when: 'Crecimiento o decaimiento que se acelera con el tiempo.',
    icon: 'exponential' },
  { id: 'power', label: 'Potencia', equation: 'y = a·x^b',
    description: 'La relación escala — al duplicar x, y se multiplica por 2^b.',
    when: 'Relaciones geométricas (área vs lado, gravedad vs distancia).',
    icon: 'power' },
  { id: 'logarithmic', label: 'Logarítmico', equation: 'y = a + b·ln(x)',
    description: 'Crece rápido al principio y luego se desacelera — rendimientos decrecientes.',
    when: 'Datos que crecen rápido al inicio pero se estabilizan.',
    icon: 'logarithmic' },
  { id: 'sinusoidal', label: 'Senoidal', equation: 'y = a·sin(bx + c) + d',
    description: 'Los datos suben y bajan de forma repetitiva, como una ola.',
    when: 'Fenómenos periódicos (mareas, temperatura, sonido).',
    icon: 'sinusoidal' },
]

/** Interpret R² value in Spanish */
export function interpretR2(r2) {
  if (r2 >= 0.95) return 'Ajuste excelente'
  if (r2 >= 0.85) return 'Ajuste muy bueno'
  if (r2 >= 0.70) return 'Ajuste bueno'
  if (r2 >= 0.50) return 'Ajuste moderado'
  if (r2 >= 0.30) return 'Ajuste débil'
  return 'Ajuste muy débil'
}

/** Generate explanation of why a model fits (or doesn't) */
export function explainFit(model) {
  const pct = (model.r2 * 100).toFixed(1)
  if (model.r2 >= 0.85) {
    return `Este modelo explica el ${pct}% de la variación en tus datos. Es un buen candidato.`
  }
  if (model.r2 >= 0.50) {
    return `Este modelo explica el ${pct}% de la variación. Captura la tendencia general, pero hay variación sin explicar.`
  }
  return `Este modelo solo explica el ${pct}% de la variación. Probablemente no describe bien el patrón de tus datos.`
}

// ─── Sample datasets for quick testing ─────────────────

// Each dataset generates fresh random data based on a model + noise
const noise = (amplitude) => (Math.random() - 0.5) * 2 * amplitude
const jitter = (val, pct = 0.08) => Math.round((val + noise(val * pct)) * 10) / 10

const SAMPLE_GENERATORS = [
  {
    id: 'notas',
    label: 'Horas de estudio vs nota',
    xName: 'Horas de estudio por semana',
    yName: 'Nota del examen (sobre 100)',
    generate: () => {
      const slope = 4 + noise(1.5)
      const intercept = 28 + noise(5)
      const xs = [1, 2, 2, 3, 3, 4, 5, 5, 6, 7, 7, 8, 9, 10, 10, 12]
      return { x: xs.join(', '), y: xs.map(x => Math.round(intercept + slope * x + noise(5))).join(', ') }
    },
  },
  {
    id: 'population',
    label: 'Crecimiento poblacional',
    xName: 'Año (desde inicio del estudio)',
    yName: 'Población (individuos)',
    generate: () => {
      const a = 90 + noise(20)
      const b = 0.18 + noise(0.05)
      const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      return { x: xs.join(', '), y: xs.map(x => Math.round(a * Math.exp(b * x) + noise(8))).join(', ') }
    },
  },
  {
    id: 'projectile',
    label: 'Trayectoria de proyectil',
    xName: 'Tiempo (segundos)',
    yName: 'Altura (metros)',
    generate: () => {
      const a = -(3 + noise(0.8))
      const b = 28 + noise(5)
      const c = noise(3)
      const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      return { x: xs.join(', '), y: xs.map(x => Math.round(a * x * x + b * x + c + noise(2))).join(', ') }
    },
  },
  {
    id: 'temperature',
    label: 'Temperatura estacional',
    xName: 'Mes del año',
    yName: 'Temperatura promedio (°C)',
    generate: () => {
      const amp = 11 + noise(3)
      const mid = 16 + noise(3)
      const phase = 1 + noise(0.5)
      const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      return { x: xs.join(', '), y: xs.map(x => Math.round(mid + amp * Math.sin((x - phase) * Math.PI / 6) + noise(1.5))).join(', ') }
    },
  },
  {
    id: 'learning',
    label: 'Curva de aprendizaje',
    xName: 'Horas de práctica acumuladas',
    yName: 'Puntaje en la prueba (%)',
    generate: () => {
      const a = 15 + noise(5)
      const b = 18 + noise(4)
      const xs = [1, 2, 3, 5, 8, 12, 18, 25, 35, 50]
      return { x: xs.join(', '), y: xs.map(x => Math.round(Math.min(98, a + b * Math.log(x) + noise(3)))).join(', ') }
    },
  },
]

export const SAMPLE_DATASETS = SAMPLE_GENERATORS.map(g => ({
  id: g.id,
  label: g.label,
  xName: g.xName,
  yName: g.yName,
  generate: g.generate,
}))

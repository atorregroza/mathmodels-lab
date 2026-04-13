import { useEffect, useState } from 'react'
import { AxisRangePanel, CartesianFrame, LabCard, MetricCard, ModelCard } from './DerivaLabPrimitives'
import { downloadCsv, format, generateTicks, linePath, sampleRange } from './derivaLabUtils'
import { useAxisRange } from '../../hooks/useAxisRange'

const sceneFrame = {
  left: 54,
  top: 54,
  width: 652,
  height: 270,
  right: 706,
  bottom: 324,
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const getCompactContext = (text) => {
  const [firstSentence] = text.split('. ')
  if (!firstSentence) return text
  return firstSentence.endsWith('.') ? firstSentence : `${firstSentence}.`
}

const createSceneScales = (scenario) => {
  const xRange = (scenario.xDomain[1] - scenario.xDomain[0]) || 1
  const yRange = (scenario.yDomain[1] - scenario.yDomain[0]) || 1

  if (scenario.sceneKind === 'circular') {
    const scale = Math.min(sceneFrame.width / xRange, sceneFrame.height / yRange)
    const centerX = sceneFrame.left + (sceneFrame.width / 2)
    const centerY = sceneFrame.top + (sceneFrame.height / 2)

    return {
      scaleX: (value) => centerX + (value * scale),
      scaleY: (value) => centerY - (value * scale),
      radiusToPixels: (radius) => Math.abs(radius * scale),
    }
  }

  return {
    scaleX: (value) => sceneFrame.left + (((value - scenario.xDomain[0]) / xRange) * sceneFrame.width),
    scaleY: (value) => sceneFrame.bottom - (((value - scenario.yDomain[0]) / yRange) * sceneFrame.height),
    radiusToPixels: (radius) => Math.abs(radius * Math.min(sceneFrame.width / xRange, sceneFrame.height / yRange)),
  }
}

const scenarios = [
  {
    id: 'free-fall',
    label: 'Caída libre',
    shortLabel: 'Caída libre',
    context: 'Se observa una pelota que se suelta desde un balcón. La componente horizontal permanece casi fija y la altura disminuye con comportamiento cuadrático.',
    guideQuestion: '¿Qué cambia en el modelo cuando no hay avance horizontal y solo queda la caída vertical?',
    duration: 1.9,
    frameCount: 20,
    autoTrackCount: 10,
    loopPlayback: false,
    xDomain: [0.2, 1.6],
    yDomain: [0, 7],
    sceneKind: 'fall',
    xModel: {
      type: 'constant',
      family: 'constante',
      general: 'x(t) = c',
      parameters: 'c ∈ R',
      minPoints: 1,
    },
    yModel: {
      type: 'quadratic',
      family: 'cuadrático',
      general: 'y(t) = at² + bt + c',
      parameters: 'a, b, c ∈ R',
      conditions: 'a ≠ 0',
      minPoints: 3,
    },
    position: (t) => ({
      x: 0.9,
      y: Math.max(0.4, 6.4 - (1.58 * t * t)),
    }),
  },
  {
    id: 'semi-parabolic',
    label: 'Lanzamiento horizontal',
    shortLabel: 'Horizontal',
    context: 'Se observa una pelota que sale horizontalmente desde una mesa. La posición horizontal crece casi linealmente mientras la altura cae por efecto de la gravedad.',
    guideQuestion: '¿Cómo se combinan una componente horizontal lineal y una componente vertical cuadrática en el mismo movimiento?',
    duration: 2.2,
    frameCount: 22,
    autoTrackCount: 10,
    loopPlayback: false,
    xDomain: [0, 9],
    yDomain: [0, 5.8],
    sceneKind: 'projectile',
    xModel: {
      type: 'linear',
      family: 'lineal',
      general: 'x(t) = mt + b',
      parameters: 'm, b ∈ R',
      minPoints: 2,
    },
    yModel: {
      type: 'quadratic',
      family: 'cuadrático',
      general: 'y(t) = at² + bt + c',
      parameters: 'a, b, c ∈ R',
      conditions: 'a ≠ 0',
      minPoints: 3,
    },
    position: (t) => ({
      x: 0.75 + (3.2 * t),
      y: Math.max(0.35, 4.9 - (1.22 * t * t)),
    }),
  },
  {
    id: 'parabolic',
    label: 'Lanzamiento oblicuo',
    shortLabel: 'Oblicuo',
    context: 'Se observa cuadro a cuadro el centro de una pelota lanzada con ángulo. La componente horizontal es casi lineal y la altura sigue una ley cuadrática.',
    guideQuestion: '¿Qué modelo recuperas para la posición horizontal y para la altura si sigues el centro de la pelota en varios fotogramas?',
    duration: 2.4,
    frameCount: 24,
    autoTrackCount: 10,
    loopPlayback: false,
    xDomain: [0, 10],
    yDomain: [0, 6.8],
    sceneKind: 'projectile',
    xModel: {
      type: 'linear',
      family: 'lineal',
      general: 'x(t) = mt + b',
      parameters: 'm, b ∈ R',
      minPoints: 2,
    },
    yModel: {
      type: 'quadratic',
      family: 'cuadrático',
      general: 'y(t) = at² + bt + c',
      parameters: 'a, b, c ∈ R',
      conditions: 'a ≠ 0',
      minPoints: 3,
    },
    position: (t) => ({
      x: 0.8 + (3.45 * t),
      y: 0.65 + (5.2 * t) - (2.18 * t * t),
    }),
  },
  {
    id: 'inclined-plane',
    label: 'Plano inclinado',
    shortLabel: 'Plano inclinado',
    context: 'Se observa un carrito que desciende por un riel inclinado. Tanto la componente horizontal como la vertical cambian con aceleración constante.',
    guideQuestion: '¿Cómo se ve en x(t) y en y(t) un movimiento acelerado que sigue una trayectoria recta inclinada?',
    duration: 2.4,
    frameCount: 24,
    autoTrackCount: 10,
    loopPlayback: false,
    xDomain: [0.4, 6.8],
    yDomain: [0.8, 5.4],
    sceneKind: 'incline',
    xModel: {
      type: 'quadratic',
      family: 'cuadrático',
      general: 'x(t) = at² + bt + c',
      parameters: 'a, b, c ∈ R',
      conditions: 'a ≠ 0',
      minPoints: 3,
    },
    yModel: {
      type: 'quadratic',
      family: 'cuadrático',
      general: 'y(t) = at² + bt + c',
      parameters: 'a, b, c ∈ R',
      conditions: 'a ≠ 0',
      minPoints: 3,
    },
    position: (t) => ({
      x: 0.7 + (0.55 * t) + (0.75 * t * t),
      y: 4.95 - (0.38 * t) - (0.52 * t * t),
    }),
  },
  {
    id: 'pendular',
    label: 'Movimiento pendular',
    shortLabel: 'Pendular',
    context: 'Se observa una masa suspendida que oscila alrededor de una posición de equilibrio con una amplitud angular moderada. El movimiento se detiene en los extremos y regresa sin completar una vuelta.',
    guideQuestion: '¿Cómo se reconoce el carácter periódico del movimiento cuando se separan x(t) e y(t)?',
    duration: 3.2,
    frameCount: 32,
    autoTrackCount: 12,
    loopPlayback: false,
    xDomain: [-1.5, 1.5],
    yDomain: [2.6, 5.4],
    sceneKind: 'pendulum',
    xModel: {
      type: 'sinusoid',
      family: 'sinusoidal',
      general: 'x(t) = A·sen(ωt + φ) + c',
      parameters: 'A, ω, φ, c ∈ R',
      conditions: 'A > 0',
      omega: 2.2,
      minPoints: 4,
    },
    yModel: {
      type: 'sinusoid',
      family: 'sinusoidal',
      general: 'y(t) = A·sen(ωt + φ) + c',
      parameters: 'A, ω, φ, c ∈ R',
      conditions: 'A > 0',
      omega: 2.2,
      minPoints: 4,
    },
    position: (t) => {
      const pivotY = 5.15
      const length = 2.15
      const theta = 0.58 * Math.sin(2.2 * t)

      return {
        x: length * Math.sin(theta),
        y: pivotY - (length * Math.cos(theta)),
      }
    },
  },
  {
    id: 'circular',
    label: 'Movimiento circular',
    shortLabel: 'Circular',
    context: 'Se sigue un punto que gira alrededor de un centro fijo. Las componentes horizontal y vertical son periódicas, con la misma frecuencia y desfase.',
    guideQuestion: '¿Qué relación observas entre x(t) e y(t) cuando el movimiento es circular uniforme?',
    duration: 3.4,
    frameCount: 34,
    autoTrackCount: 12,
    loopPlayback: false,
    xDomain: [-3.4, 3.4],
    yDomain: [-3.4, 3.4],
    sceneKind: 'circular',
    xModel: {
      type: 'sinusoid',
      family: 'sinusoidal',
      general: 'x(t) = A·sen(ωt + φ) + c',
      parameters: 'A, ω, φ, c ∈ R',
      conditions: 'A > 0',
      omega: 1.85,
      minPoints: 4,
    },
    yModel: {
      type: 'sinusoid',
      family: 'sinusoidal',
      general: 'y(t) = A·sen(ωt + φ) + c',
      parameters: 'A, ω, φ, c ∈ R',
      conditions: 'A > 0',
      omega: 1.85,
      minPoints: 4,
    },
    position: (t) => ({
      x: 2.45 * Math.cos(1.85 * t),
      y: 2.45 * Math.sin(1.85 * t),
    }),
  },
  {
    id: 'braking-cart',
    label: 'Frenado en pista',
    shortLabel: 'Frenado',
    context: 'Se observa un carrito que avanza sobre una pista horizontal y va perdiendo velocidad por efecto del rozamiento. La componente vertical permanece casi constante mientras la horizontal se desacelera.',
    guideQuestion: '¿Cómo cambia x(t) cuando el móvil sigue avanzando, pero cada vez recorre menos distancia en el mismo tiempo?',
    duration: 2.6,
    frameCount: 28,
    autoTrackCount: 11,
    loopPlayback: false,
    xDomain: [0, 7.4],
    yDomain: [0.95, 1.35],
    sceneKind: 'track',
    xModel: {
      type: 'quadratic',
      family: 'cuadrático',
      general: 'x(t) = at² + bt + c',
      parameters: 'a, b, c ∈ R',
      conditions: 'a < 0',
      minPoints: 3,
    },
    yModel: {
      type: 'constant',
      family: 'constante',
      general: 'y(t) = c',
      parameters: 'c ∈ R',
      minPoints: 1,
    },
    position: (t) => ({
      x: 0.45 + (4.3 * t) - (0.75 * t * t),
      y: 1.18,
    }),
  },
  {
    id: 'damped-spring',
    label: 'Resorte amortiguado',
    shortLabel: 'Resorte',
    context: 'Se observa una masa unida a un resorte que oscila horizontalmente y pierde amplitud con el tiempo. El rozamiento del aire y del soporte hace que cada oscilación sea menor que la anterior.',
    guideQuestion: '¿Qué diferencia notas entre una oscilación periódica ideal y una que va perdiendo amplitud a medida que transcurre el tiempo?',
    duration: 4.2,
    frameCount: 36,
    autoTrackCount: 12,
    loopPlayback: false,
    xDomain: [-2.9, 2.9],
    yDomain: [2.05, 2.75],
    sceneKind: 'spring',
    xModel: {
      type: 'dampedSinusoid',
      family: 'sinusoidal amortiguado',
      general: 'x(t) = A·e^(-kt)·sen(ωt + φ) + c',
      parameters: 'A, k, ω, φ, c ∈ R',
      conditions: 'A > 0, k > 0',
      omega: 5.1,
      decay: 0.32,
      minPoints: 5,
    },
    yModel: {
      type: 'constant',
      family: 'constante',
      general: 'y(t) = c',
      parameters: 'c ∈ R',
      minPoints: 1,
    },
    position: (t) => ({
      x: 2.3 * Math.exp(-0.32 * t) * Math.sin((5.1 * t) + 0.25),
      y: 2.38 + (0.02 * Math.cos(4.3 * t)),
    }),
  },
]

const solveLinearSystem = (matrix, vector) => {
  const size = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index]])

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row
      }
    }

    if (Math.abs(augmented[maxRow][pivot]) < 1e-10) {
      return null
    }

    if (maxRow !== pivot) {
      ;[augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]]
    }

    const pivotValue = augmented[pivot][pivot]
    for (let column = pivot; column <= size; column += 1) {
      augmented[pivot][column] /= pivotValue
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue
      const factor = augmented[row][pivot]
      for (let column = pivot; column <= size; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column]
      }
    }
  }

  return augmented.map((row) => row[size])
}

const fitConstant = (points) => {
  if (points.length < 1) return null

  const average = points.reduce((sum, point) => sum + point.value, 0) / points.length

  return {
    type: 'constant',
    value: average,
    predict: () => average,
  }
}

const fitLinear = (points) => {
  const count = points.length
  if (count < 2) return null

  const sumT = points.reduce((sum, point) => sum + point.t, 0)
  const sumY = points.reduce((sum, point) => sum + point.value, 0)
  const sumTT = points.reduce((sum, point) => sum + (point.t * point.t), 0)
  const sumTY = points.reduce((sum, point) => sum + (point.t * point.value), 0)
  const denominator = (count * sumTT) - (sumT * sumT)

  if (Math.abs(denominator) < 1e-10) return null

  const m = ((count * sumTY) - (sumT * sumY)) / denominator
  const b = (sumY - (m * sumT)) / count

  return { m, b }
}

const fitQuadratic = (points) => {
  if (points.length < 3) return null

  const sum = (selector) => points.reduce((total, point) => total + selector(point), 0)
  const matrix = [
    [sum((point) => point.t ** 4), sum((point) => point.t ** 3), sum((point) => point.t ** 2)],
    [sum((point) => point.t ** 3), sum((point) => point.t ** 2), sum((point) => point.t)],
    [sum((point) => point.t ** 2), sum((point) => point.t), points.length],
  ]
  const vector = [
    sum((point) => (point.t ** 2) * point.value),
    sum((point) => point.t * point.value),
    sum((point) => point.value),
  ]
  const solution = solveLinearSystem(matrix, vector)

  if (!solution) return null

  return { a: solution[0], b: solution[1], c: solution[2] }
}

const fitSinusoid = (points, omega) => {
  if (points.length < 4) return null

  const sum = (selector) => points.reduce((total, point) => total + selector(point), 0)
  const matrix = [
    [
      sum((point) => Math.sin(omega * point.t) ** 2),
      sum((point) => Math.sin(omega * point.t) * Math.cos(omega * point.t)),
      sum((point) => Math.sin(omega * point.t)),
    ],
    [
      sum((point) => Math.sin(omega * point.t) * Math.cos(omega * point.t)),
      sum((point) => Math.cos(omega * point.t) ** 2),
      sum((point) => Math.cos(omega * point.t)),
    ],
    [
      sum((point) => Math.sin(omega * point.t)),
      sum((point) => Math.cos(omega * point.t)),
      points.length,
    ],
  ]
  const vector = [
    sum((point) => point.value * Math.sin(omega * point.t)),
    sum((point) => point.value * Math.cos(omega * point.t)),
    sum((point) => point.value),
  ]

  const solution = solveLinearSystem(matrix, vector)
  if (!solution) return null

  const sinCoefficient = solution[0]
  const cosCoefficient = solution[1]
  const offset = solution[2]
  const amplitude = Math.sqrt((sinCoefficient ** 2) + (cosCoefficient ** 2))
  const phase = Math.atan2(cosCoefficient, sinCoefficient)
  const normalizedPhase = Number(Math.atan2(Math.sin(phase), Math.cos(phase)).toFixed(4))

  return {
    type: 'sinusoid',
    omega,
    amplitude,
    phase: normalizedPhase,
    offset,
    period: (2 * Math.PI) / omega,
    predict: (t) => (amplitude * Math.sin((omega * t) + normalizedPhase)) + offset,
  }
}

const fitDampedSinusoid = (points, omega, decay) => {
  if (points.length < 5) return null

  const sum = (selector) => points.reduce((total, point) => total + selector(point), 0)
  const basisSin = (point) => Math.exp(-decay * point.t) * Math.sin(omega * point.t)
  const basisCos = (point) => Math.exp(-decay * point.t) * Math.cos(omega * point.t)

  const matrix = [
    [
      sum((point) => basisSin(point) ** 2),
      sum((point) => basisSin(point) * basisCos(point)),
      sum((point) => basisSin(point)),
    ],
    [
      sum((point) => basisSin(point) * basisCos(point)),
      sum((point) => basisCos(point) ** 2),
      sum((point) => basisCos(point)),
    ],
    [
      sum((point) => basisSin(point)),
      sum((point) => basisCos(point)),
      points.length,
    ],
  ]

  const vector = [
    sum((point) => point.value * basisSin(point)),
    sum((point) => point.value * basisCos(point)),
    sum((point) => point.value),
  ]

  const solution = solveLinearSystem(matrix, vector)
  if (!solution) return null

  const sinCoefficient = solution[0]
  const cosCoefficient = solution[1]
  const offset = solution[2]
  const amplitude = Math.sqrt((sinCoefficient ** 2) + (cosCoefficient ** 2))
  const phase = Math.atan2(cosCoefficient, sinCoefficient)
  const normalizedPhase = Number(Math.atan2(Math.sin(phase), Math.cos(phase)).toFixed(4))

  return {
    type: 'dampedSinusoid',
    omega,
    decay,
    amplitude,
    phase: normalizedPhase,
    offset,
    predict: (t) => (amplitude * Math.exp(-decay * t) * Math.sin((omega * t) + normalizedPhase)) + offset,
  }
}

const formatSigned = (value) => `${value >= 0 ? '+' : '-'} ${format(Math.abs(value))}`

const recoverModel = (points, spec, axisLabel) => {
  if (spec.type === 'constant') {
    const result = fitConstant(points)
    if (!result) return null

    return {
      ...result,
      expression: `${axisLabel}(t) = ${format(result.value)}`,
      details: `Ajuste ${spec.family} estimado con la media de los fotogramas registrados.`,
    }
  }

  if (spec.type === 'linear') {
    const result = fitLinear(points)
    if (!result) return null

    return {
      ...result,
      expression: `${axisLabel}(t) = ${format(result.m)}t ${formatSigned(result.b)}`,
      details: `Ajuste ${spec.family} obtenido a partir de la tendencia temporal observada.`,
      predict: (t) => (result.m * t) + result.b,
    }
  }

  if (spec.type === 'quadratic') {
    const result = fitQuadratic(points)
    if (!result) return null

    return {
      ...result,
      expression: `${axisLabel}(t) = ${format(result.a)}t² ${formatSigned(result.b)}t ${formatSigned(result.c)}`,
      details: `Ajuste ${spec.family} recuperado con los puntos seguidos en la escena.`,
      predict: (t) => (result.a * t * t) + (result.b * t) + result.c,
    }
  }

  if (spec.type === 'sinusoid') {
    const result = fitSinusoid(points, spec.omega)
    if (!result) return null

    return {
      ...result,
      expression: `${axisLabel}(t) = ${format(result.amplitude)}·sen(${format(result.omega)}t ${formatSigned(result.phase)}) ${formatSigned(result.offset)}`,
      details: 'Ajuste sinusoidal con frecuencia angular fija sugerida por el ciclo observado.',
    }
  }

  if (spec.type === 'dampedSinusoid') {
    const result = fitDampedSinusoid(points, spec.omega, spec.decay)
    if (!result) return null

    return {
      ...result,
      expression: `${axisLabel}(t) = ${format(result.amplitude)}·e^(-${format(result.decay)}t)·sen(${format(result.omega)}t ${formatSigned(result.phase)}) ${formatSigned(result.offset)}`,
      details: 'Ajuste oscilatorio amortiguado con decaimiento y frecuencia fijados por el escenario observado.',
    }
  }

  return null
}

const computeRSquared = (points, predict) => {
  if (!predict || points.length < 2) return null

  const mean = points.reduce((sum, point) => sum + point.value, 0) / points.length
  const ssTotal = points.reduce((sum, point) => sum + ((point.value - mean) ** 2), 0)
  const ssResidual = points.reduce((sum, point) => sum + ((point.value - predict(point.t)) ** 2), 0)

  if (ssTotal < 1e-10) return 1
  return 1 - (ssResidual / ssTotal)
}

const createMeasuredPoint = (scenario, frame) => {
  const t = (scenario.duration * frame) / (scenario.frameCount - 1)
  const actual = scenario.position(t)
  const xRange = scenario.xDomain[1] - scenario.xDomain[0]
  const yRange = scenario.yDomain[1] - scenario.yDomain[0]
  const noiseX = Math.sin(((frame + 1) * 12.9898) + (scenario.id.length * 1.37)) * xRange * 0.012
  const noiseY = Math.cos(((frame + 1) * 8.131) + (scenario.label.length * 0.93)) * yRange * 0.014

  return {
    frame,
    t,
    x: clamp(actual.x + noiseX, scenario.xDomain[0], scenario.xDomain[1]),
    y: clamp(actual.y + noiseY, scenario.yDomain[0], scenario.yDomain[1]),
  }
}

const renderSceneDecorations = (scenario, currentPoint, sceneScaleX, sceneScaleY, radiusToPixels) => {
  const pathPoints = sampleRange(0, scenario.duration, 140, (t) => scenario.position(t))
  const path = linePath(
    pathPoints,
    (pointX) => sceneScaleX(pointX),
    (pointY) => sceneScaleY(pointY),
  )

  const pieces = [
    <path
      key="path"
      d={path}
      fill="none"
      stroke="rgba(199,244,100,0.86)"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
  ]

  if (scenario.sceneKind === 'fall') {
    pieces.push(
      <line key="balcony-line" x1="116" y1="92" x2="246" y2="92" stroke="rgba(255,255,255,0.28)" strokeWidth="5" strokeLinecap="round" />,
      <line key="wall-line" x1="116" y1="92" x2="116" y2="214" stroke="rgba(255,255,255,0.16)" strokeWidth="4" strokeLinecap="round" />,
      <line key="ground-line" x1="36" y1="318" x2="724" y2="318" stroke="rgba(163,196,106,0.30)" strokeWidth="4" strokeLinecap="round" />,
    )
  }

  if (scenario.sceneKind === 'projectile') {
    pieces.push(
      <line key="platform-line" x1="88" y1="176" x2="228" y2="176" stroke="rgba(255,255,255,0.28)" strokeWidth="5" strokeLinecap="round" />,
      <line key="platform-support" x1="112" y1="176" x2="112" y2="234" stroke="rgba(255,255,255,0.16)" strokeWidth="4" strokeLinecap="round" />,
      <line key="ground-line" x1="36" y1="318" x2="724" y2="318" stroke="rgba(163,196,106,0.30)" strokeWidth="4" strokeLinecap="round" />,
    )
  }

  if (scenario.sceneKind === 'incline') {
    pieces.push(
      <line
        key="incline"
        x1={sceneScaleX(scenario.position(0).x)}
        y1={sceneScaleY(scenario.position(0).y)}
        x2={sceneScaleX(scenario.position(scenario.duration).x)}
        y2={sceneScaleY(scenario.position(scenario.duration).y)}
        stroke="rgba(255,255,255,0.24)"
        strokeWidth="6"
        strokeLinecap="round"
      />,
      <line key="incline-base" x1="36" y1="318" x2="724" y2="318" stroke="rgba(163,196,106,0.26)" strokeWidth="4" strokeLinecap="round" />,
    )
  }

  if (scenario.sceneKind === 'track') {
    const guidePoints = Array.from({ length: 8 }, (_, index) => scenario.position((scenario.duration * index) / 7))
    const railY = sceneScaleY(1.15)

    pieces.push(
      <line
        key="track-line"
        x1="86"
        y1={railY}
        x2="676"
        y2={railY}
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="6"
        strokeLinecap="round"
      />,
      <line
        key="track-highlight"
        x1="86"
        y1={railY - 2}
        x2="676"
        y2={railY - 2}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="2"
        strokeLinecap="round"
      />,
      <line key="track-left-stop" x1="86" y1={railY - 9} x2="86" y2={railY + 9} stroke="rgba(255,255,255,0.22)" strokeWidth="3" strokeLinecap="round" />,
      <line key="track-right-stop" x1="676" y1={railY - 9} x2="676" y2={railY + 9} stroke="rgba(255,255,255,0.22)" strokeWidth="3" strokeLinecap="round" />,
      ...guidePoints.map((point, index) => (
        <circle
          key={`track-guide-${index}`}
          cx={sceneScaleX(point.x)}
          cy={sceneScaleY(point.y)}
          r="4.5"
          fill="rgba(255,255,255,0.34)"
        />
      )),
    )
  }

  if (scenario.sceneKind === 'pendulum') {
    const pivotX = sceneScaleX(0)
    const pivotY = sceneScaleY(5.15)
    const equilibriumY = sceneScaleY(scenario.position(0).y)

    pieces.push(
      <line
        key="equilibrium-axis"
        x1={pivotX}
        y1={pivotY}
        x2={pivotX}
        y2={equilibriumY}
        stroke="rgba(255,255,255,0.26)"
        strokeWidth="2"
        strokeDasharray="8 7"
      />,
      <line
        key="rod"
        x1={pivotX}
        y1={pivotY}
        x2={sceneScaleX(currentPoint.x)}
        y2={sceneScaleY(currentPoint.y)}
        stroke="rgba(255,255,255,0.78)"
        strokeWidth="3.5"
      />,
      <circle key="pivot" cx={pivotX} cy={pivotY} r="7" fill="rgba(255,255,255,0.9)" />,
    )
  }

  if (scenario.sceneKind === 'circular') {
    pieces.push(
      <circle
        key="orbit"
        cx={sceneScaleX(0)}
        cy={sceneScaleY(0)}
        r={radiusToPixels(2.45)}
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="3"
        strokeDasharray="10 8"
      />,
      <line
        key="radius"
        x1={sceneScaleX(0)}
        y1={sceneScaleY(0)}
        x2={sceneScaleX(currentPoint.x)}
        y2={sceneScaleY(currentPoint.y)}
        stroke="rgba(84,214,201,0.5)"
        strokeWidth="2.5"
      />,
      <circle key="center" cx={sceneScaleX(0)} cy={sceneScaleY(0)} r="6" fill="rgba(255,255,255,0.88)" />,
    )
  }

  if (scenario.sceneKind === 'spring') {
    const anchorX = sceneScaleX(-2.45)
    const anchorY = sceneScaleY(2.38)
    const massX = sceneScaleX(currentPoint.x)
    const springLength = Math.max(40, massX - anchorX - 32)
    const coilCount = 8
    const coilStep = springLength / (coilCount * 2)
    const springPoints = Array.from({ length: (coilCount * 2) + 1 }, (_, index) => {
      const x = anchorX + 24 + (index * coilStep)
      if (index === 0 || index === coilCount * 2) return `${x},${anchorY}`
      const y = anchorY + (index % 2 === 0 ? -14 : 14)
      return `${x},${y}`
    }).join(' ')

    pieces.push(
      <rect key="spring-wall" x={anchorX - 24} y={anchorY - 42} width="18" height="84" rx="7" fill="rgba(255,255,255,0.18)" />,
      <polyline key="spring-coil" points={springPoints} fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />,
    )
  }

  return pieces
}

export const MotionTrackingLab = () => {
  const [scenarioId, setScenarioId] = useState('parabolic')
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [trackedFrames, setTrackedFrames] = useState([])
  const scenario = scenarios.find((item) => item.id === scenarioId) || scenarios[2]

  useEffect(() => {
    if (!playing) return undefined

    const timer = window.setInterval(() => {
      setFrame((current) => {
        if (current >= scenario.frameCount - 1) {
          window.clearInterval(timer)
          setPlaying(false)
          return current
        }

        return current + 1
      })
    }, 280)

    return () => window.clearInterval(timer)
  }, [playing, scenario.frameCount])

  const xPosAxis = useAxisRange({ xMin: 0, xMax: scenario.duration, yMin: scenario.xDomain[0], yMax: scenario.xDomain[1] })
  const yPosAxis = useAxisRange({ xMin: 0, xMax: scenario.duration, yMin: scenario.yDomain[0], yMax: scenario.yDomain[1] })

  const currentTime = (scenario.duration * frame) / (scenario.frameCount - 1)
  const currentPoint = scenario.position(currentTime)
  const { scaleX: sceneScaleX, scaleY: sceneScaleY, radiusToPixels } = createSceneScales(scenario)
  const sceneCurrentX = sceneScaleX(currentPoint.x)
  const sceneCurrentY = sceneScaleY(currentPoint.y)
  const trackedPoints = trackedFrames
    .map((trackedFrame) => createMeasuredPoint(scenario, trackedFrame))
    .sort((left, right) => left.frame - right.frame)

  const xRecovered = recoverModel(
    trackedPoints.map((point) => ({ t: point.t, value: point.x })),
    scenario.xModel,
    'x',
  )
  const yRecovered = recoverModel(
    trackedPoints.map((point) => ({ t: point.t, value: point.y })),
    scenario.yModel,
    'y',
  )

  const referenceXCurve = sampleRange(0, scenario.duration, 180, (t) => scenario.position(t).x)
  const referenceYCurve = sampleRange(0, scenario.duration, 180, (t) => scenario.position(t).y)
  const xCurve = xRecovered ? sampleRange(0, scenario.duration, 160, xRecovered.predict) : []
  const yCurve = yRecovered ? sampleRange(0, scenario.duration, 160, yRecovered.predict) : []
  const xR2 = xRecovered ? computeRSquared(trackedPoints.map((point) => ({ t: point.t, value: point.x })), xRecovered.predict) : null
  const yR2 = yRecovered ? computeRSquared(trackedPoints.map((point) => ({ t: point.t, value: point.y })), yRecovered.predict) : null
  const currentTracked = trackedFrames.includes(frame)
  const isPendular = scenario.id === 'pendular'
  const atLastFrame = frame >= scenario.frameCount - 1
  const pendulumSummary = isPendular ? {
    period: xRecovered?.period ?? yRecovered?.period ?? null,
    horizontalAmplitude: xRecovered?.amplitude ?? null,
    verticalAmplitude: yRecovered?.amplitude ?? null,
    equilibriumHeight: yRecovered?.offset ?? null,
  } : null

  const registerCurrentFrame = () => {
    setTrackedFrames((current) => {
      const updated = current.includes(frame) ? current : [...current, frame]
      return updated.sort((left, right) => left - right)
    })
  }

  const autoTrack = () => {
    const count = scenario.autoTrackCount || 10
    const sampleFrames = Array.from({ length: count }, (_, index) => Math.round(((scenario.frameCount - 1) * index) / (count - 1)))
    setTrackedFrames(sampleFrames)
  }

  const clearTrack = () => setTrackedFrames([])

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="space-y-6">
        <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
          <LabCard title="Observatorio de movimiento" className="bg-paper">
            <h3 className="mt-3 font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-[-0.04em]">Escena, seguimiento y modelo</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              Este módulo abre la capa observacional de la plataforma: parte de una escena breve, sigue el objeto cuadro a cuadro y convierte esa observación en datos, gráficas y modelo matemático.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {['Escena breve', 'Seguimiento cuadro a cuadro', 'Datos con ruido realista', 'Modelo recuperado'].map((item) => (
                <div key={item} className="rounded-[1rem] border border-ink/8 bg-white/75 px-3 py-3 text-sm font-semibold text-ink/74">
                  {item}
                </div>
              ))}
            </div>
          </LabCard>

          <LabCard title="Escenario activo" className="bg-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-[clamp(1.9rem,4vw,3rem)] font-semibold tracking-[-0.04em] text-ink">{scenario.label}</h3>
                <p className="mt-3 max-w-3xl text-base leading-7 text-ink/70">{scenario.context}</p>
              </div>
              <span className="rounded-full border border-ink/10 bg-paper px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink/55">
                {scenario.frameCount} fotogramas
              </span>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.2rem] border border-ink/10 bg-paper px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.2em] text-ink/46">Pregunta guía</p>
                <p className="mt-3 text-sm leading-6 text-ink/68">{scenario.guideQuestion}</p>
              </div>
              <div className="rounded-[1.2rem] border border-ink/10 bg-white px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.2em] text-ink/46">Modelos esperados</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-ink/68">
                  <p><span className="font-semibold text-ink">x(t):</span> {scenario.xModel.family}</p>
                  <p><span className="font-semibold text-ink">y(t):</span> {scenario.yModel.family}</p>
                </div>
              </div>
            </div>
          </LabCard>
        </div>

        <LabCard title="Escenarios disponibles">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {scenarios.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setScenarioId(item.id)
                  setFrame(0)
                  setPlaying(false)
                  setTrackedFrames([])
                  xPosAxis.resetRange()
                  yPosAxis.resetRange()
                }}
                className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${
                  item.id === scenario.id
                    ? 'border-ink bg-ink text-paper shadow-[0_16px_34px_rgba(18,23,35,0.14)]'
                    : 'border-ink/10 bg-paper text-ink hover:border-ink/28 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{item.label}</p>
                  {item.id === scenario.id ? (
                    <span className="rounded-full border border-white/12 bg-white/10 px-2 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-paper/72">
                      Activo
                    </span>
                  ) : null}
                </div>
                <p className={`mt-2 text-sm leading-6 ${item.id === scenario.id ? 'text-paper/72' : 'text-ink/62'}`}>
                  {getCompactContext(item.context)}
                </p>
              </button>
            ))}
          </div>
        </LabCard>

        <div className="space-y-5">
          <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.28em] text-paper/45">Escena observada</p>
                <h3 className="mt-3 font-display text-3xl">Fotograma, seguimiento y modelo en una sola lectura</h3>
              </div>
              <span className="rounded-full border border-graph/30 bg-graph/12 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-graph">
                {currentTracked ? 'Fotograma registrado' : 'Fotograma libre'}
              </span>
            </div>

            <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#1b212e] p-4">
              <svg viewBox="0 0 760 390" className="w-full overflow-hidden rounded-[1.2rem]">
                <defs>
                  <linearGradient id="tracking-sky" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#2a3345" />
                    <stop offset="100%" stopColor="#202735" />
                  </linearGradient>
                </defs>

                <rect x="0" y="0" width="760" height="390" fill="url(#tracking-sky)" />
                <rect x={sceneFrame.left} y={sceneFrame.top} width={sceneFrame.width} height={sceneFrame.height} rx="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                {Array.from({ length: 10 }, (_, index) => sceneFrame.left + (index * (sceneFrame.width / 10))).map((xValue) => (
                  <line key={`v-${xValue}`} x1={xValue} y1={sceneFrame.top} x2={xValue} y2={sceneFrame.bottom} stroke="rgba(255,255,255,0.06)" />
                ))}
                {Array.from({ length: 5 }, (_, index) => sceneFrame.top + (index * (sceneFrame.height / 5))).map((yValue) => (
                  <line key={`h-${yValue}`} x1={sceneFrame.left} y1={yValue} x2={sceneFrame.right} y2={yValue} stroke="rgba(255,255,255,0.06)" />
                ))}
                {renderSceneDecorations(scenario, currentPoint, sceneScaleX, sceneScaleY, radiusToPixels)}
                <text x="62" y="346" fill="rgba(255,255,255,0.62)" fontSize="15">{scenario.shortLabel}</text>

                <line x1={sceneCurrentX} y1={sceneFrame.bottom} x2={sceneCurrentX} y2={sceneCurrentY} stroke="rgba(84,214,201,0.95)" strokeWidth="2.2" strokeDasharray="7 6" />
                <line x1={sceneFrame.left} y1={sceneCurrentY} x2={sceneCurrentX} y2={sceneCurrentY} stroke="rgba(255,107,53,0.95)" strokeWidth="2.2" strokeDasharray="7 6" />
                <circle cx={sceneCurrentX} cy={sceneFrame.bottom} r="5.5" fill="rgba(84,214,201,1)" />
                <circle cx={sceneFrame.left} cy={sceneCurrentY} r="5.5" fill="rgba(255,107,53,1)" />
                <text x={Math.min(sceneCurrentX + 12, 670)} y="345" fill="rgba(84,214,201,0.95)" fontSize="15" fontWeight="700">
                  x = {format(currentPoint.x)}
                </text>
                <text x="66" y={Math.max(sceneCurrentY - 12, 72)} fill="rgba(255,107,53,0.95)" fontSize="15" fontWeight="700">
                  y = {format(currentPoint.y)}
                </text>

                {trackedPoints.map((point) => (
                  <g key={point.frame}>
                    <circle cx={sceneScaleX(point.x)} cy={sceneScaleY(point.y)} r="7" fill="rgba(84,214,201,0.95)" stroke="rgba(18,23,35,0.72)" strokeWidth="2" />
                    <circle cx={sceneScaleX(point.x)} cy={sceneScaleY(point.y)} r="16" fill="none" stroke="rgba(84,214,201,0.18)" strokeWidth="2" />
                  </g>
                ))}

                <circle
                  cx={sceneCurrentX}
                  cy={sceneCurrentY}
                  r="11"
                  fill="rgba(255,107,53,1)"
                  stroke="rgba(255,255,255,0.92)"
                  strokeWidth="3"
                />
              </svg>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.2em] text-paper/45">Control temporal</p>
                    <p className="mt-2 text-sm leading-6 text-paper/72">Mueve el clip como si recorrieras fotogramas de un video corto.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPlaying(false)
                        setFrame((current) => Math.max(0, current - 1))
                      }}
                      className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-paper"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (playing) {
                          setPlaying(false)
                          return
                        }

                        if (atLastFrame) {
                          setFrame(0)
                        }

                        setPlaying(true)
                      }}
                      className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white"
                    >
                      {playing ? 'Pausar' : atLastFrame ? 'Reproducir desde el inicio' : 'Reproducir'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlaying(false)
                        setFrame((current) => Math.min(scenario.frameCount - 1, current + 1))
                      }}
                      className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-paper"
                    >
                      Siguiente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlaying(false)
                        setFrame(0)
                      }}
                      className="rounded-full border border-white/12 bg-transparent px-4 py-2 text-sm font-semibold text-paper/82"
                    >
                      Reiniciar
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    type="range"
                    min="0"
                    max={scenario.frameCount - 1}
                    step="1"
                    value={frame}
                    onChange={(event) => {
                      setPlaying(false)
                      setFrame(Number(event.target.value))
                    }}
                    className="h-2 w-full cursor-pointer accent-[#ff6b35]"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-paper/48">
                    <span>Fotograma 0</span>
                    <span>Fotograma {frame}</span>
                    <span>Fotograma {scenario.frameCount - 1}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {Array.from({ length: scenario.frameCount }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setPlaying(false)
                        setFrame(index)
                      }}
                      className={`h-8 w-8 rounded-full text-[0.68rem] font-semibold transition-colors ${
                        index === frame
                          ? 'bg-signal text-white'
                          : trackedFrames.includes(index)
                            ? 'bg-aqua text-white'
                            : 'border border-white/10 bg-white/6 text-paper/75'
                      }`}
                    >
                      {index}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-[#151b26] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.2em] text-paper/45">Acciones de seguimiento</p>
                <p className="mt-2 text-sm leading-6 text-paper/72">
                  Registra el fotograma que estás viendo o genera una primera muestra para empezar a modelar.
                </p>
                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={registerCurrentFrame}
                    className="inline-flex items-center justify-center rounded-full bg-signal px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(255,107,53,0.18)]"
                  >
                    Registrar fotograma actual
                  </button>
                  <button
                    type="button"
                    onClick={autoTrack}
                    className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-paper"
                  >
                    Autorrecolectar {scenario.autoTrackCount || 10} fotogramas
                  </button>
                  <button
                    type="button"
                    onClick={clearTrack}
                    className="inline-flex items-center justify-center rounded-full border border-white/12 bg-transparent px-5 py-3 text-sm font-semibold text-paper/74"
                  >
                    Limpiar seguimiento
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Puntos registrados" value={trackedPoints.length} detail="Cantidad de fotogramas usados para reconstruir el modelo." />
              <MetricCard label="Tiempo actual" value={`${format(currentTime)} s`} detail="Instante correspondiente al fotograma visible." />
              <MetricCard label="R² de x(t)" value={xR2 !== null ? format(xR2) : 'Aún no'} detail="Indica qué tan bien el modelo recuperado explica la componente horizontal." />
              <MetricCard label="R² de y(t)" value={yR2 !== null ? format(yR2) : 'Aún no'} detail="Indica qué tan bien el modelo recuperado explica la componente vertical." />
            </div>
          </LabCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <LabCard title="Posición horizontal x(t)" className="xl:sticky xl:top-4 xl:self-start">
              <div className="rounded-[1.35rem] border border-ink/8 bg-white px-3 py-3">
                <CartesianFrame
                  xMin={xPosAxis.xMin}
                  xMax={xPosAxis.xMax}
                  yMin={xPosAxis.yMin}
                  yMax={xPosAxis.yMax}
                  dark={false}
                  xTicks={generateTicks(xPosAxis.xMin, xPosAxis.xMax)}
                  yTicks={generateTicks(xPosAxis.yMin, xPosAxis.yMax)}
                  className="w-full h-auto aspect-[6/5] overflow-hidden rounded-[1rem]"
                >
                  {({ scaleX, scaleY, padding, height }) => (
                    <>
                      <path
                        d={linePath(referenceXCurve, scaleX, scaleY)}
                        fill="none"
                        stroke="rgba(84,214,201,0.92)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {xCurve.length > 0 && (
                        <path d={linePath(xCurve, scaleX, scaleY)} fill="none" stroke="rgba(255,107,53,0.98)" strokeWidth="4.4" strokeLinecap="round" />
                      )}
                      {isPendular && (
                        <line
                          x1={padding}
                          y1={scaleY(0)}
                          x2={620 - padding}
                          y2={scaleY(0)}
                          stroke="rgba(84,214,201,0.42)"
                          strokeDasharray="8 6"
                          strokeWidth="1.7"
                        />
                      )}
                      <line x1={scaleX(currentTime)} y1={height - padding} x2={scaleX(currentTime)} y2={scaleY(currentPoint.x)} stroke="rgba(255,107,53,0.36)" strokeDasharray="5 5" strokeWidth="1.5" />
                      <line x1={padding} y1={scaleY(currentPoint.x)} x2={scaleX(currentTime)} y2={scaleY(currentPoint.x)} stroke="rgba(84,214,201,0.32)" strokeDasharray="5 5" strokeWidth="1.5" />
                      {trackedPoints.map((point) => (
                        <circle key={`x-${point.frame}`} cx={scaleX(point.t)} cy={scaleY(point.x)} r="5.5" fill="rgba(84,214,201,0.95)" stroke="rgba(18,23,35,0.5)" strokeWidth="1.8" />
                      ))}
                      <circle cx={scaleX(currentTime)} cy={scaleY(currentPoint.x)} r="6.5" fill="rgba(255,107,53,1)" stroke="white" strokeWidth="2.2" />
                    </>
                  )}
                </CartesianFrame>
              </div>
              <AxisRangePanel {...xPosAxis} />
              <p className="mt-3 text-sm leading-6 text-ink/66">La curva turquesa representa la variación ideal del escenario y, cuando hay suficientes datos, la curva naranja muestra el modelo recuperado a partir del seguimiento.</p>
            </LabCard>

            <LabCard title="Componente vertical y(t)" className="xl:sticky xl:top-4 xl:self-start">
              <div className="rounded-[1.35rem] border border-ink/8 bg-white px-3 py-3">
                <CartesianFrame
                  xMin={yPosAxis.xMin}
                  xMax={yPosAxis.xMax}
                  yMin={yPosAxis.yMin}
                  yMax={yPosAxis.yMax}
                  dark={false}
                  xTicks={generateTicks(yPosAxis.xMin, yPosAxis.xMax)}
                  yTicks={generateTicks(yPosAxis.yMin, yPosAxis.yMax)}
                  className="w-full h-auto aspect-[6/5] overflow-hidden rounded-[1rem]"
                >
                  {({ scaleX, scaleY, padding, height }) => (
                    <>
                      <path
                        d={linePath(referenceYCurve, scaleX, scaleY)}
                        fill="none"
                        stroke="rgba(84,214,201,0.92)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {yCurve.length > 0 && (
                        <path d={linePath(yCurve, scaleX, scaleY)} fill="none" stroke="rgba(199,244,100,0.98)" strokeWidth="4.4" strokeLinecap="round" />
                      )}
                      {isPendular && pendulumSummary?.equilibriumHeight !== null && (
                        <line
                          x1={padding}
                          y1={scaleY(pendulumSummary.equilibriumHeight)}
                          x2={620 - padding}
                          y2={scaleY(pendulumSummary.equilibriumHeight)}
                          stroke="rgba(84,214,201,0.42)"
                          strokeDasharray="8 6"
                          strokeWidth="1.7"
                        />
                      )}
                      <line x1={scaleX(currentTime)} y1={height - padding} x2={scaleX(currentTime)} y2={scaleY(currentPoint.y)} stroke="rgba(255,107,53,0.36)" strokeDasharray="5 5" strokeWidth="1.5" />
                      <line x1={padding} y1={scaleY(currentPoint.y)} x2={scaleX(currentTime)} y2={scaleY(currentPoint.y)} stroke="rgba(84,214,201,0.32)" strokeDasharray="5 5" strokeWidth="1.5" />
                      {trackedPoints.map((point) => (
                        <circle key={`y-${point.frame}`} cx={scaleX(point.t)} cy={scaleY(point.y)} r="5.5" fill="rgba(84,214,201,0.95)" stroke="rgba(18,23,35,0.5)" strokeWidth="1.8" />
                      ))}
                      <circle cx={scaleX(currentTime)} cy={scaleY(currentPoint.y)} r="6.5" fill="rgba(255,107,53,1)" stroke="white" strokeWidth="2.2" />
                    </>
                  )}
                </CartesianFrame>
              </div>
              <AxisRangePanel {...yPosAxis} />
              <p className="mt-3 text-sm leading-6 text-ink/66">Aquí también aparece primero la referencia ideal del escenario; después, el seguimiento permite comparar esa forma con el ajuste construido desde los datos.</p>
            </LabCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.98fr_1.02fr]">
            <div className="space-y-5">
              <LabCard title="Modelos de las componentes">
                <div className="grid gap-3 md:grid-cols-2">
                  <ModelCard
                    title="Modelo general x(t)"
                    expression={scenario.xModel.general}
                    parameters={scenario.xModel.parameters}
                    conditions={scenario.xModel.conditions}
                  />
                  <ModelCard
                    title="Modelo general y(t)"
                    expression={scenario.yModel.general}
                    parameters={scenario.yModel.parameters}
                    conditions={scenario.yModel.conditions}
                  />
                  <ModelCard
                    title="Modelo recuperado x(t)"
                    expression={xRecovered ? xRecovered.expression : scenario.xModel.general}
                    parameters={xRecovered ? xRecovered.details : `Necesitas al menos ${scenario.xModel.minPoints} puntos para estimar esta componente.`}
                  />
                  <ModelCard
                    title="Modelo recuperado y(t)"
                    expression={yRecovered ? yRecovered.expression : scenario.yModel.general}
                    parameters={yRecovered ? yRecovered.details : `Necesitas al menos ${scenario.yModel.minPoints} puntos para estimar esta componente.`}
                  />
                </div>
              </LabCard>

              {isPendular && (
                <LabCard title="Lectura especial del péndulo">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1.2rem] bg-paper px-4 py-4">
                      <p className="text-sm font-semibold text-ink">Qué conviene mirar</p>
                      <p className="mt-2 text-sm leading-6 text-ink/66">
                        La masa no avanza de forma lineal: oscila alrededor de una posición de equilibrio. Por eso x(t) y y(t) muestran periodicidad, no crecimiento sostenido.
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] bg-paper px-4 py-4">
                      <p className="text-sm font-semibold text-ink">Lectura conceptual</p>
                      <p className="mt-2 text-sm leading-6 text-ink/66">
                        La componente horizontal tiene mayor variación visible; la vertical también oscila, pero con amplitud menor. Esa diferencia ayuda a discutir qué significa realmente “movimiento pendular”.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <MetricCard
                      label="Período estimado"
                      value={pendulumSummary?.period ? `${format(pendulumSummary.period)} s` : 'Aún no'}
                      detail="Tiempo aproximado que tarda el péndulo en repetir un ciclo completo de oscilación."
                      dark={false}
                    />
                    <MetricCard
                      label="Amplitud horizontal"
                      value={pendulumSummary?.horizontalAmplitude ? `${format(pendulumSummary.horizontalAmplitude)} m` : 'Aún no'}
                      detail="Máximo desplazamiento estimado de la masa respecto a la posición central en x(t)."
                      dark={false}
                    />
                    <MetricCard
                      label="Amplitud vertical"
                      value={pendulumSummary?.verticalAmplitude ? `${format(pendulumSummary.verticalAmplitude)} m` : 'Aún no'}
                      detail="Variación estimada de la altura alrededor de la línea media; suele ser menor que la horizontal."
                      dark={false}
                    />
                    <MetricCard
                      label="Altura de equilibrio"
                      value={pendulumSummary?.equilibriumHeight ? `${format(pendulumSummary.equilibriumHeight)} m` : 'Aún no'}
                      detail="Nivel alrededor del cual la componente vertical oscila cuando el péndulo repite su movimiento."
                      dark={false}
                    />
                  </div>
                </LabCard>
              )}
            </div>

            <LabCard title="Datos del seguimiento">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-3xl text-sm leading-6 text-ink/68">
                  La tabla recoge fotograma, tiempo y posición del punto seguido. Desde aquí puedes continuar el análisis fuera de la plataforma o comparar con otro ajuste.
                </p>
                <button
                  type="button"
                  onClick={() => downloadCsv([
                    ['escenario', scenario.label],
                    ['frame', 't', 'x', 'y'],
                    ...trackedPoints.map((point) => [point.frame, format(point.t), format(point.x), format(point.y)]),
                  ], `observatorio-movimiento-${scenario.id}.csv`)}
                  className="inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-3 text-sm font-semibold text-white"
                >
                  Descargar CSV
                </button>
              </div>

              <div className="mt-5 overflow-x-auto rounded-[1.3rem] border border-ink/10 bg-paper">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-ink/10 bg-white/75 text-ink/62">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Fotograma</th>
                      <th className="px-4 py-3 font-semibold">t (s)</th>
                      <th className="px-4 py-3 font-semibold">x (m)</th>
                      <th className="px-4 py-3 font-semibold">y (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackedPoints.length > 0 ? trackedPoints.map((point) => (
                      <tr key={`row-${point.frame}`} className="border-b border-ink/8 last:border-b-0">
                        <td className="px-4 py-3">{point.frame}</td>
                        <td className="px-4 py-3">{format(point.t)}</td>
                        <td className="px-4 py-3">{format(point.x)}</td>
                        <td className="px-4 py-3">{format(point.y)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="px-4 py-5 text-ink/58">
                          Aún no has registrado puntos. Usa el control temporal y marca algunos fotogramas para comenzar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </LabCard>
          </div>
        </div>
      </div>
    </div>
  )
}

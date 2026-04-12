import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { explorationBlocks, labs, researchBranches } from '../data/platformContent'
import { usePageMeta } from '../hooks/usePageMeta'
import { Breadcrumb } from '../components/layout/PlatformShell'

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.55, ease: 'easeOut' },
}

const linePrompts = {
  'patrones-algebra': {
    conjecture: 'Es probable que la regularidad pueda describirse con una expresión general que conserve el patrón observado y permita anticipar nuevos casos.',
    limits: 'La expresión inicial todavía debe contrastarse con más casos y con posibles cambios en la condición inicial.',
  },
  'modelacion-funcional': {
    conjecture: 'Una familia funcional parece explicar mejor el fenómeno porque conserva la forma principal de los datos y permite interpretar parámetros con sentido.',
    limits: 'El ajuste inicial no prueba que el modelo sea definitivo; todavía hay que discutir error, intervalo útil y otras familias posibles.',
  },
  'cambio-analisis': {
    conjecture: 'El fenómeno parece estar gobernado por una relación entre cambio local y comportamiento global que puede justificarse con razón de cambio o acumulación.',
    limits: 'La lectura inicial necesita precisar el dominio, la escala y si la aproximación elegida realmente es suficiente.',
  },
  'periodicidad-geometria': {
    conjecture: 'La repetición del patrón sugiere una estructura periódica que puede modelarse con parámetros como amplitud, período, fase o línea media.',
    limits: 'La periodicidad observada puede no ser ideal; todavía hay que justificar si el ciclo se mantiene, se amortigua o cambia con el tiempo.',
  },
  'datos-distribuciones': {
    conjecture: 'Los datos parecen seguir un patrón distribucional que puede describirse con medidas de centro, dispersión y forma.',
    limits: 'La descripción inicial requiere más datos o subgrupos para confirmar si la distribución propuesta es adecuada.',
  },
  'probabilidad-simulacion': {
    conjecture: 'El experimento aleatorio parece converger a un comportamiento predecible cuando se repite suficientes veces.',
    limits: 'Pocas repeticiones pueden dar resultados engañosos; hay que justificar cuántas son suficientes para sacar conclusiones.',
  },
  'inferencia-prediccion': {
    conjecture: 'Existe una relación entre las variables que permite predecir o estimar con un modelo estadístico.',
    limits: 'El modelo predictivo tiene un rango útil; fuera de él la extrapolación puede ser poco confiable.',
  },
}

const methodologyByLine = {
  'patrones-algebra': [
    'Reconoce primero qué cambia y qué permanece estable entre un caso y el siguiente.',
    'Organiza una tabla con varios casos y revisa diferencias, razones o regularidades visibles.',
    'Propón una expresión preliminar y comprueba si realmente funciona en más de un caso.',
    'Compara al menos dos formas de generalizar: regla explícita, recurrencia o forma factorizada.',
  ],
  'modelacion-funcional': [
    'Parte del fenómeno y no de la fórmula: describe primero cómo se comportan los datos o la escena.',
    'Decide qué variable depende de cuál y fija con claridad unidades e intervalo de trabajo.',
    'Contrasta al menos dos familias funcionales antes de decidir cuál representa mejor el fenómeno.',
    'Justifica la elección del modelo con forma global, parámetros, error y sentido contextual.',
  ],
  'cambio-analisis': [
    'Distingue con cuidado qué magnitud cambia y qué lectura matemática harás del cambio.',
    'Separa cambio local y comportamiento global antes de elegir derivada, integral o aproximación.',
    'Revisa dominio, unidades y signo de las cantidades para no perder sentido en la interpretación.',
    'Compara una lectura gráfica con una numérica para sustentar mejor la conclusión inicial.',
  ],
  'periodicidad-geometria': [
    'Identifica primero si el fenómeno realmente repite un patrón o solo parece hacerlo.',
    'Mide amplitud, período, fase o línea media antes de escribir un modelo trigonométrico.',
    'Compara un ciclo con el siguiente para detectar si la periodicidad es ideal o si cambia con el tiempo.',
    'Relaciona siempre los parámetros del modelo con el significado geométrico o físico del contexto.',
  ],
  'datos-distribuciones': [
    'Empieza por visualizar los datos con histograma y diagrama de caja antes de calcular estadísticos.',
    'Compara media y mediana para detectar sesgo; si difieren mucho, la distribución no es simétrica.',
    'Busca valores atípicos y decide si los incluyes o los separas, justificando tu criterio.',
    'Describe la forma de la distribución con palabras antes de proponer un modelo teórico.',
  ],
  'probabilidad-simulacion': [
    'Distingue entre lo que esperas teóricamente y lo que observas en pocas repeticiones.',
    'Repite el experimento en varias escalas (10, 100, 1000) para observar la convergencia.',
    'Registra la frecuencia relativa a lo largo del proceso, no solo al final.',
    'Relaciona siempre el resultado con la pregunta: ¿cuántas repeticiones son suficientes y por qué?',
  ],
  'inferencia-prediccion': [
    'Grafica los datos antes de calcular regresión o correlación; la forma importa.',
    'Revisa los residuos para detectar si el modelo lineal realmente captura la relación.',
    'Distingue correlación de causalidad y menciona posibles variables ocultas.',
    'Evalúa el modelo dentro del rango de datos y discute por qué extrapolar es arriesgado.',
  ],
}

const methodologyByFormat = {
  'paso-a-paso': [
    'Usa la pregunta propuesta como punto de partida y concéntrate en justificar con evidencia cada decisión.',
    'No cambies demasiadas variables al mismo tiempo; primero consolida una lectura base.',
  ],
  'con-punto-de-partida': [
    'Refina la pregunta inicial hasta que sea investigable y no demasiado amplia.',
    'Explica por qué elegiste ese recorte del problema y no otro.',
  ],
  'desde-tu-idea': [
    'Delimita el fenómeno y el foco de análisis antes de recoger datos.',
    'Define desde el principio qué evidencia te permitirá decidir si el modelo funciona o no.',
  ],
}

const helpByLine = {
  'patrones-algebra': [
    'Busca cuatro o cinco casos bien organizados antes de generalizar.',
    'Las diferencias sucesivas pueden ayudarte a decidir si el crecimiento es lineal, cuadrático o de otro tipo.',
  ],
  'modelacion-funcional': [
    'Conviene superponer datos y modelo para discutir ajuste, no solo mirar la expresión.',
    'Un modelo útil no es solo el que se parece, sino el que permite interpretar parámetros con sentido.',
  ],
  'cambio-analisis': [
    'Revisa siempre si estás hablando de cambio neto, acumulación o razón de cambio; no son lo mismo.',
    'Cuando una aproximación parece buena, intenta justificar desde qué punto deja de mejorar de forma relevante.',
  ],
  'periodicidad-geometria': [
    'Si el patrón se repite, compara varios ciclos antes de afirmar que el modelo es trigonométrico.',
    'En movimientos periódicos, la línea media y el período suelen ser más estables que los valores extremos aislados.',
  ],
  'datos-distribuciones': [
    'Antes de concluir sobre la forma, verifica con al menos 20-30 datos; con pocos, el histograma es engañoso.',
    'El diagrama de caja y el resumen de 5 números cuentan una historia que el histograma solo no muestra.',
  ],
  'probabilidad-simulacion': [
    'La intuición sobre probabilidad suele fallar; deja que los datos hablen antes de concluir.',
    'Documenta cada ronda de simulación para poder comparar cómo cambia la evidencia con más repeticiones.',
  ],
  'inferencia-prediccion': [
    'Un r² alto no garantiza que el modelo sea correcto — revisa siempre la gráfica de residuos.',
    'Predecir dentro del rango es interpolar; predecir fuera es extrapolar — y la confianza cambia radicalmente.',
  ],
}

const buildPlanningText = ({
  title,
  focus,
  question,
  line,
  format,
  variables,
  models,
  evidence,
  conjecture,
  limits,
  nextSteps,
  contextTitle,
  methodology,
  helps,
  references,
}) => `
Planeacion inicial de exploracion

Titulo provisional:
${title}

Contexto elegido:
${contextTitle}

Fenomeno o foco:
${focus}

Pregunta inicial:
${question}

Linea del bloque:
${line}

Formato:
${format}

Variables y unidades:
${variables}

Modelo preliminar:
${models}

Evidencia inicial sugerida:
${evidence}

Conjetura inicial:
${conjecture}

Limites observados:
${limits}

Enfoque metodologico sugerido:
${methodology.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Ayudas para orientar el trabajo:
${helps.map((item, index) => `${index + 1}. ${item}`).join('\n')}

Referentes dentro de la plataforma:
${references.map((item, index) => `${index + 1}. ${item}`).join('\n')}

Siguientes pasos:
${nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}
`.trim()

const buildDraftState = (exploration, context) => ({
  title: context?.planningTitle ?? exploration?.planningTitle ?? exploration?.title ?? '',
  question: context?.questionVariant ?? exploration?.questionSeed ?? exploration?.title ?? '',
  focus: context?.description ?? exploration?.phenomenon ?? '',
  variables: context?.variables.join(', ') ?? exploration?.variables.join(', ') ?? '',
  models: context?.possibleModels.join(', ') ?? exploration?.possibleModels.join(', ') ?? '',
  evidence: context?.evidence ?? exploration?.evidence ?? '',
})

export const ExplorationBlockPage = () => {
  const { blockId } = useParams()
  const block = explorationBlocks.find((item) => item.id === blockId)
  const firstExploration = block?.starterExplorations[0]
  const firstContext = firstExploration?.contexts?.[0] ?? null
  const [selectedLineId, setSelectedLineId] = useState(block?.lines[0]?.id ?? '')
  const [selectedFormatId, setSelectedFormatId] = useState(block?.formats[0]?.id ?? '')
  const [selectedExplorationId, setSelectedExplorationId] = useState(firstExploration?.id ?? '')
  const [selectedContextId, setSelectedContextId] = useState(firstContext?.id ?? '')
  const [drafts, setDrafts] = useState(() => buildDraftState(firstExploration, firstContext))
  const [copied, setCopied] = useState(false)
  const [expandedBranch, setExpandedBranch] = useState(null)
  const [studentName, setStudentName] = useState('')
  const [studentCourse, setStudentCourse] = useState('')
  const [studentSchool, setStudentSchool] = useState('')

  usePageMeta({
    title: block ? `${block.title} | Exploraciones | MathModels Lab` : 'Exploraciones | MathModels Lab',
    description: block ? block.overview : 'Bloque de exploraciones matemáticas dentro de MathModels Lab.',
    keywords: block ? `${block.title}, exploraciones matemáticas, MathModels Lab` : 'exploraciones matemáticas, MathModels Lab',
    image: '/og-image.png',
  })

  const selectedLine = useMemo(
    () => block?.lines.find((item) => item.id === selectedLineId) ?? block?.lines[0],
    [block, selectedLineId],
  )

  const filteredExplorations = useMemo(
    () => block?.starterExplorations.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [block, selectedLine],
  )

  const selectedFormat = useMemo(
    () => block?.formats.find((item) => item.id === selectedFormatId) ?? block?.formats[0],
    [block, selectedFormatId],
  )

  const selectedExploration = useMemo(
    () => filteredExplorations.find((item) => item.id === selectedExplorationId) ?? filteredExplorations[0],
    [filteredExplorations, selectedExplorationId],
  )

  const selectedContext = useMemo(
    () => selectedExploration?.contexts?.find((item) => item.id === selectedContextId) ?? selectedExploration?.contexts?.[0] ?? null,
    [selectedExploration, selectedContextId],
  )

  const recommendedLab = useMemo(
    () => labs.find((item) => item.id === (selectedContext?.recommendedLabId ?? selectedExploration?.recommendedLabId)),
    [selectedContext, selectedExploration],
  )

  if (!block) {
    return <Navigate to="/" replace />
  }

  const currentPrompts = linePrompts[selectedLine?.id] ?? linePrompts['modelacion-funcional']
  const nextSteps = [
    'Delimitar mejor la pregunta para que sea investigable y no demasiado amplia.',
    'Recoger una primera muestra de datos o registros desde el laboratorio base.',
    'Comparar al menos un segundo modelo o una segunda forma de representar el fenómeno.',
    selectedExploration?.nextStep ?? 'Profundizar el análisis con evidencia y justificación matemática.',
  ]
  const methodologicalSteps = [
    ...(methodologyByLine[selectedLine?.id] ?? methodologyByLine['modelacion-funcional']),
    ...(methodologyByFormat[selectedFormat?.id] ?? methodologyByFormat.guiada),
  ]
  const helpItems = [
    ...(helpByLine[selectedLine?.id] ?? helpByLine['modelacion-funcional']),
    selectedContext?.description
      ? `Usa el contexto "${selectedContext.title}" para acotar mejor el fenómeno y evitar una pregunta demasiado general.`
      : null,
    recommendedLab?.howToUse?.[0] ? `Empieza por este gesto básico del laboratorio: ${recommendedLab.howToUse[0]}` : null,
  ].filter(Boolean)
  const referenceItems = [
    recommendedLab?.title ? `Laboratorio base sugerido: ${recommendedLab.title}.` : null,
    recommendedLab?.purpose ? `Propósito del laboratorio: ${recommendedLab.purpose}` : null,
    recommendedLab?.teacherUse ? `Pista didáctica: ${recommendedLab.teacherUse}` : null,
  ].filter(Boolean)
  const planningText = buildPlanningText({
    title: drafts.title,
    contextTitle: selectedContext?.title ?? 'Sin contexto específico',
    focus: drafts.focus,
    question: drafts.question,
    line: selectedLine?.title ?? '',
    format: selectedFormat?.title ?? '',
    variables: drafts.variables,
    models: drafts.models,
    evidence: drafts.evidence,
    conjecture: currentPrompts.conjecture,
    limits: currentPrompts.limits,
    methodology: methodologicalSteps,
    helps: helpItems,
    references: referenceItems,
    nextSteps,
  })

  const updateDraft = (field, value) => {
    setDrafts((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSelectLine = (lineId) => {
    const nextExplorations = block.starterExplorations.filter((item) => item.lineId === lineId)
    const nextExploration = nextExplorations[0]
    const nextContext = nextExploration?.contexts?.[0] ?? null

    setSelectedLineId(lineId)
    setSelectedExplorationId(nextExploration?.id ?? '')
    setSelectedContextId(nextContext?.id ?? '')
    setDrafts(buildDraftState(nextExploration, nextContext))
  }

  const handleSelectExploration = (exploration) => {
    const nextContext = exploration.contexts?.[0] ?? null
    setSelectedExplorationId(exploration.id)
    setSelectedContextId(nextContext?.id ?? '')
    setDrafts(buildDraftState(exploration, nextContext))
  }

  const handleSelectContext = (context) => {
    setSelectedContextId(context.id)
    setDrafts(buildDraftState(selectedExploration, context))
  }

  const handleCopyPlanning = async () => {
    try {
      await navigator.clipboard.writeText(planningText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const handlePrintPlanning = () => {
    const logoSvg = `<svg viewBox="0 0 48 48" width="36" height="36" style="vertical-align:middle;margin-right:8px"><rect width="48" height="48" rx="12" fill="#121723"/><path d="M 8,36 C 10,36 14,9 17.5,9 C 21,9 21,28 24,28 C 27,28 27,9 30.5,9 C 34,9 38,36 40,36" fill="none" stroke="#22c5a0" stroke-width="3" stroke-linecap="round"/><line x1="10.5" y1="9" x2="24.5" y2="9" stroke="#ff6b35" stroke-width="1.5" stroke-linecap="round" opacity="0.75"/><circle cx="17.5" cy="9" r="3" fill="#ff6b35"/></svg>`

    const referentesHTML = selectedLine ? {
      'patrones-algebra': [
        'Tabla de diferencias finitas y su relación con el grado del polinomio.',
        'Sucesiones aritméticas y geométricas: fórmulas explícitas vs recursivas.',
        'Números figurados: triangulares, cuadrados, pentagonales.',
      ],
      'modelacion-funcional': [
        'Familias de funciones: lineal, cuadrática, exponencial, logarítmica, potencia.',
        'Criterios para elegir un modelo: R², residuos, interpretación de parámetros.',
        'Transformaciones de funciones y su efecto en los parámetros.',
      ],
      'cambio-analisis': [
        'Razón de cambio promedio vs instantánea.',
        'Integral definida como acumulación y el Teorema Fundamental del Cálculo.',
        'Optimización: condiciones de primer y segundo orden.',
      ],
      'periodicidad-geometria': [
        'Funciones trigonométricas: amplitud, período, fase, línea media.',
        'Movimiento circular uniforme y sus componentes.',
        'Amortiguamiento: modelos de decaimiento exponencial en oscilaciones.',
      ],
      'datos-distribuciones': [
        'Medidas de tendencia central: media, mediana, moda — cuándo usar cada una.',
        'Diagramas de caja y bigotes: lectura de cuartiles y valores atípicos.',
        'Distribución normal: regla empírica 68-95-99.7%.',
      ],
      'probabilidad-simulacion': [
        'Ley de los grandes números: convergencia de frecuencia relativa.',
        'Distribución binomial: P(X=k) = C(n,k)·p^k·(1-p)^(n-k).',
        'Probabilidad condicional e independencia de eventos.',
      ],
      'inferencia-prediccion': [
        'Regresión lineal por mínimos cuadrados: pendiente, intercepto, r².',
        'Correlación vs causalidad: variables ocultas y confusión.',
        'Teorema Central del Límite: distribución de medias muestrales.',
      ],
    }[selectedLine.id] || [] : []

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${drafts.title || 'Planeación inicial'}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #121723; line-height: 1.6; max-width: 700px; margin: 0 auto; padding: 1rem; }
  .header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
  .header-title { font-size: 1.1rem; font-weight: 700; }
  h1 { font-size: 1.5rem; margin: 0.5rem 0 0.25rem; }
  h2 { font-size: 0.9rem; color: #555; margin-top: 1.5rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; border-bottom: 1px solid #ddd; padding-bottom: 0.3rem; }
  p { margin: 0.3rem 0; font-size: 0.9rem; }
  .subtitle { color: #666; font-size: 0.85rem; }
  .student-info { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin: 1rem 0; padding: 0.75rem; background: #f5f5f5; border-radius: 8px; }
  .student-info div { font-size: 0.8rem; }
  .student-info .label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: #888; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .card { background: #f8f8f8; border-radius: 8px; padding: 0.75rem; }
  .card-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 0.25rem; }
  .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.7rem; color: #999; display: flex; align-items: center; gap: 0.5rem; }
  ol, ul { padding-left: 1.2rem; }
  li { margin-bottom: 0.3rem; font-size: 0.85rem; }
  .referentes { background: #f0f7ff; border-radius: 8px; padding: 0.75rem; margin-top: 0.5rem; }
  .referentes li { font-size: 0.8rem; color: #444; }
  @media print { body { font-size: 10pt; } .header { margin-bottom: 0.3rem; } }
</style>
</head>
<body>
<div class="header">${logoSvg}<span class="header-title">MathModels Lab</span></div>

<h1>${drafts.title || 'Planeación inicial de exploración'}</h1>
<p class="subtitle">${block.title} — ${selectedLine?.title || ''} — ${selectedFormat?.title || ''}</p>

${(studentName || studentCourse || studentSchool) ? `<div class="student-info">
  <div><p class="label">Estudiante</p><p>${studentName || '—'}</p></div>
  <div><p class="label">Curso</p><p>${studentCourse || '—'}</p></div>
  <div><p class="label">Institución</p><p>${studentSchool || '—'}</p></div>
</div>` : ''}

<h2>Pregunta inicial</h2>
<p>${drafts.question}</p>

<h2>Fenómeno o foco</h2>
<p>${drafts.focus}</p>

<div class="grid">
<div class="card"><p class="card-label">Variables y unidades</p><p>${drafts.variables}</p></div>
<div class="card"><p class="card-label">Modelos preliminares</p><p>${drafts.models}</p></div>
</div>

<h2>Evidencia inicial</h2>
<p>${drafts.evidence}</p>

<div class="grid">
<div class="card"><p class="card-label">Conjetura</p><p>${currentPrompts.conjecture}</p></div>
<div class="card"><p class="card-label">Limitaciones</p><p>${currentPrompts.limits}</p></div>
</div>

<h2>Enfoque metodológico</h2>
<ol>${methodologicalSteps.map(s => `<li>${s}</li>`).join('')}</ol>

<h2>Ayudas</h2>
<ol>${[...helpItems, ...referenceItems].map(s => `<li>${s}</li>`).join('')}</ol>

<h2>Referentes para investigar</h2>
<div class="referentes">
<ul>${referentesHTML.map(s => `<li>${s}</li>`).join('')}</ul>
</div>

<h2>Siguiente paso</h2>
<p>${selectedExploration?.nextStep || ''}</p>

<div class="footer">
  ${logoSvg}
  <div>
    <p><strong>MathModels Lab</strong> — mathmodels.astridto.com</p>
    <p>Este documento es una <strong>planeación inicial</strong>. No constituye un borrador ni un documento final — es el punto de partida para desarrollar la exploración fuera de la plataforma.</p>
  </div>
</div>
</body>
</html>`
    const w = window.open('', 'planeacion', 'width=800,height=900')
    w.document.write(html)
    w.document.close()
    w.focus()
    return w
  }

  const handleViewPlanning = () => {
    handlePrintPlanning()
  }

  const handlePrintPDF = () => {
    const w = handlePrintPlanning()
    w.onload = () => w.print()
    // fallback for browsers that fire load before content renders
    setTimeout(() => w.print(), 300)
  }

  return (
    <section className="px-5 pb-24 pt-4 md:px-8 md:pb-28 md:pt-6">
      <Breadcrumb items={[
        { label: 'Inicio', to: '/' },
        { label: block.title },
      ]} />
      <div className="mx-auto max-w-7xl mt-6">
        {/* ── Header compacto ── */}
        <motion.div {...fadeIn} className="max-w-5xl">
          <p className="section-kicker">Exploración matemática</p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.8rem)] font-bold leading-[0.94] tracking-[-0.05em]">
            {block.title}
          </h1>
          <p className="mt-4 text-xl text-ink/76">{block.subtitle}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {explorationBlocks.map((b) => (
              <Link
                key={b.id}
                to={`/exploraciones/${b.id}`}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                  b.id === block.id
                    ? 'bg-ink text-paper shadow-md'
                    : 'border border-ink/12 bg-white text-ink hover:border-ink/30'
                }`}
              >
                {b.title}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* ── ¿Qué es? — expandible con workflow integrado ── */}
        <motion.div {...fadeIn} className="mt-8">
          {researchBranches.filter(b => b.id === 'exploracion').map((branch) => {
            const isOpen = expandedBranch === branch.id
            return (
              <div key={branch.id} className="rounded-[1.8rem] border border-ink/10 bg-white/82 shadow-[0_12px_40px_rgba(18,23,35,0.06)] overflow-hidden">
                <button
                  onClick={() => setExpandedBranch(isOpen ? null : branch.id)}
                  className="flex w-full items-center gap-3 px-6 py-5 text-left transition-colors hover:bg-ink/3"
                >
                  <span className="text-2xl">{branch.icon}</span>
                  <span className="flex-1 font-display text-lg font-semibold text-ink">{branch.title}</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    className={`shrink-0 text-ink/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-ink/8 px-6 py-5 space-y-5">
                        <p className="text-base leading-7 text-ink/75">{branch.objective}</p>

                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {branch.develops.map((d) => (
                            <div key={d.label} className="rounded-xl border border-ink/8 bg-paper px-4 py-3">
                              <p className="text-sm font-semibold text-ink">{d.label}</p>
                              <p className="mt-1 text-xs leading-5 text-ink/55">{d.detail}</p>
                            </div>
                          ))}
                        </div>

                        {/* Workflow integrado */}
                        <div>
                          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink/45 mb-2">Cómo funciona este taller</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {block.workflow.map((item, index) => (
                              <div key={item.step} className="rounded-xl border border-ink/8 bg-ink/3 px-3 py-2.5">
                                <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Paso {index + 1}</p>
                                <p className="mt-1 text-sm font-semibold text-ink">{item.step}</p>
                                <p className="mt-0.5 text-xs leading-5 text-ink/55">{item.detail}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-ink/4 px-4 py-3">
                            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink/45 mb-1">Alcance</p>
                            <p className="text-sm leading-6 text-ink/65">{branch.scope}</p>
                          </div>
                          <div className="rounded-xl border border-graph/20 bg-graph/5 px-4 py-3">
                            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink/45 mb-1">Entregable</p>
                            <p className="text-sm leading-6 text-ink/70 font-medium">{branch.deliverable}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </motion.div>

        {/* ── Ejercicio: pasos 1-5 (izq) + planeación en vivo (der) ── */}
        <motion.div {...fadeIn} className="mt-10 grid gap-6 xl:grid-cols-[0.98fr_1.02fr]">
          <div className="space-y-5">
            <article className="rounded-[2rem] border border-ink/10 bg-white/82 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]">
              <p className="section-kicker">1. Elige la línea</p>
              <div className="mt-5 grid gap-3">
                {block.lines.map((line) => (
                  <button
                    key={line.id}
                    type="button"
                    onClick={() => handleSelectLine(line.id)}
                    className={`rounded-[1.25rem] border px-4 py-4 text-left transition-colors ${
                      selectedLine?.id === line.id
                        ? 'border-ink bg-ink text-paper shadow-[0_16px_32px_rgba(18,23,35,0.14)]'
                        : 'border-ink/10 bg-paper text-ink hover:border-ink/26 hover:bg-white'
                    }`}
                  >
                    <p className="font-semibold">{line.title}</p>
                    <p className={`mt-2 text-sm leading-6 ${selectedLine?.id === line.id ? 'text-paper/74' : 'text-ink/64'}`}>
                      {line.description}
                    </p>
                  </button>
                ))}
              </div>
            </article>

            <article className="rounded-[2rem] border border-ink/10 bg-white/82 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]">
              <p className="section-kicker">2. Elige el formato</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {block.formats.map((format) => (
                  <button
                    key={format.id}
                    type="button"
                    onClick={() => setSelectedFormatId(format.id)}
                    className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${
                      selectedFormat?.id === format.id
                        ? 'border-signal/30 bg-signal/10 text-ink'
                        : 'border-ink/10 bg-paper text-ink hover:border-ink/20'
                    }`}
                  >
                    <p className="font-semibold">{format.title}</p>
                    <p className="mt-2 text-sm leading-6 text-ink/64">{format.description}</p>
                  </button>
                ))}
              </div>
            </article>

            <article className="rounded-[2rem] border border-ink/10 bg-white/82 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]">
              <p className="section-kicker">3. Elige una idea de arranque</p>
              <div className="mt-5 grid gap-3">
                {filteredExplorations.map((exploration) => (
                  (() => {
                    const badgeLabels = Array.from(
                      new Set(
                        [
                          exploration.source,
                          exploration.recommendedLabId
                            ? labs.find((item) => item.id === exploration.recommendedLabId)?.title
                            : null,
                        ].filter(Boolean),
                      ),
                    )

                    return (
                      <button
                        key={exploration.id}
                        type="button"
                        onClick={() => handleSelectExploration(exploration)}
                        className={`rounded-[1.25rem] border px-4 py-4 text-left transition-colors ${
                          selectedExploration?.id === exploration.id
                            ? 'border-ink bg-paper shadow-[0_14px_28px_rgba(18,23,35,0.08)]'
                            : 'border-ink/10 bg-white hover:border-ink/22'
                        }`}
                      >
                        <p className="font-semibold text-ink">{exploration.title}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {badgeLabels.map((label) => (
                            <span
                              key={`${exploration.id}-${label}`}
                              className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-ink/58"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </button>
                    )
                  })()
                ))}
              </div>
            </article>

            <article className="rounded-[2rem] border border-ink/10 bg-white/82 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]">
              <p className="section-kicker">4. Elige el contexto</p>
              {selectedExploration?.contexts?.length ? (
                <div className="mt-5 grid gap-3">
                  {selectedExploration.contexts.map((context) => (
                    <button
                      key={context.id}
                      type="button"
                      onClick={() => handleSelectContext(context)}
                      className={`rounded-[1.25rem] border px-4 py-4 text-left transition-colors ${
                        selectedContext?.id === context.id
                          ? 'border-signal/32 bg-signal/10 text-ink shadow-[0_12px_24px_rgba(18,23,35,0.06)]'
                          : 'border-ink/10 bg-white hover:border-ink/22'
                      }`}
                    >
                      <p className="font-semibold text-ink">{context.title}</p>
                      <p className="mt-2 text-sm leading-6 text-ink/66">{context.description}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[1.25rem] border border-ink/10 bg-paper/78 px-4 py-4 text-sm leading-6 text-ink/66">
                  Esta idea todavía no tiene contextos cargados. Se comporta como una idea matemática abierta.
                </div>
              )}
            </article>

            <article className="rounded-[2rem] border border-ink/10 bg-paper p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]">
              <p className="section-kicker">5. Ajusta el borrador</p>
              <div className="mt-5 grid gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-ink/60">Nombre del estudiante</span>
                    <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Tu nombre completo"
                      className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-signal/35" />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-ink/60">Curso</span>
                    <input type="text" value={studentCourse} onChange={e => setStudentCourse(e.target.value)} placeholder="Ej: 11° NM"
                      className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-signal/35" />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-ink/60">Institución educativa</span>
                    <input type="text" value={studentSchool} onChange={e => setStudentSchool(e.target.value)} placeholder="Nombre del colegio"
                      className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-signal/35" />
                  </label>
                </div>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-ink">Título provisional</span>
                  <input
                    type="text"
                    value={drafts.title}
                    onChange={(event) => updateDraft('title', event.target.value)}
                    className="rounded-[1.2rem] border border-ink/10 bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition-colors focus:border-signal/35"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-ink">Pregunta inicial</span>
                  <textarea
                    value={drafts.question}
                    onChange={(event) => updateDraft('question', event.target.value)}
                    className="min-h-28 rounded-[1.2rem] border border-ink/10 bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition-colors focus:border-signal/35"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-ink">Fenómeno o foco del trabajo</span>
                  <textarea
                    value={drafts.focus}
                    onChange={(event) => updateDraft('focus', event.target.value)}
                    className="min-h-24 rounded-[1.2rem] border border-ink/10 bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition-colors focus:border-signal/35"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-ink">Variables y unidades</span>
                  <textarea
                    value={drafts.variables}
                    onChange={(event) => updateDraft('variables', event.target.value)}
                    className="min-h-20 rounded-[1.2rem] border border-ink/10 bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition-colors focus:border-signal/35"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-ink">Modelo preliminar o familias a comparar</span>
                  <textarea
                    value={drafts.models}
                    onChange={(event) => updateDraft('models', event.target.value)}
                    className="min-h-20 rounded-[1.2rem] border border-ink/10 bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition-colors focus:border-signal/35"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-ink">Evidencia inicial que vas a recoger</span>
                  <textarea
                    value={drafts.evidence}
                    onChange={(event) => updateDraft('evidence', event.target.value)}
                    className="min-h-24 rounded-[1.2rem] border border-ink/10 bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition-colors focus:border-signal/35"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  {recommendedLab ? (
                    <Link
                      to={`/laboratorios/${recommendedLab.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper"
                    >
                      Abrir laboratorio sugerido
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleViewPlanning}
                    className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink"
                  >
                    Ver documento
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintPDF}
                    className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink"
                  >
                    Imprimir / PDF
                  </button>
                </div>
              </div>
            </article>

          </div>

          <motion.article
            {...fadeIn}
            className="rounded-[2rem] border border-ink/10 bg-white/84 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]"
          >
            <p className="section-kicker">Tu planeación inicial</p>
            <p className="mt-2 text-sm text-ink/55">Se actualiza en tiempo real mientras eliges opciones a la izquierda.</p>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-signal/18 bg-signal/8 px-4 py-4">
                <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Título</p>
                <p className="mt-1 text-lg font-semibold text-ink">{drafts.title}</p>
              </div>

              <div className="rounded-xl border border-ink/10 bg-white px-4 py-4">
                <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Pregunta</p>
                <p className="mt-1 text-sm leading-7 text-ink/74">{drafts.question}</p>
              </div>

              <div className="rounded-xl border border-ink/10 bg-paper/78 px-4 py-4">
                <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Fenómeno o foco</p>
                <p className="mt-1 text-sm leading-7 text-ink/74">{drafts.focus}</p>
              </div>

              <div className="grid gap-3 grid-cols-2">
                <div className="rounded-xl border border-ink/10 bg-white px-4 py-3">
                  <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Variables</p>
                  <p className="mt-1 text-xs leading-5 text-ink/65">{drafts.variables}</p>
                </div>
                <div className="rounded-xl border border-ink/10 bg-white px-4 py-3">
                  <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Modelos</p>
                  <p className="mt-1 text-xs leading-5 text-ink/65">{drafts.models}</p>
                </div>
              </div>

              <div className="rounded-xl border border-ink/10 bg-white px-4 py-4">
                <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Evidencia inicial</p>
                <p className="mt-1 text-sm leading-6 text-ink/65">{drafts.evidence}</p>
              </div>

              <div className="grid gap-3 grid-cols-2">
                <div className="rounded-xl border border-ink/10 bg-paper/78 px-4 py-3">
                  <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Conjetura</p>
                  <p className="mt-1 text-xs leading-5 text-ink/60">{currentPrompts.conjecture}</p>
                </div>
                <div className="rounded-xl border border-ink/10 bg-paper/78 px-4 py-3">
                  <p className="text-[0.6rem] uppercase tracking-widest text-ink/40">Limitaciones</p>
                  <p className="mt-1 text-xs leading-5 text-ink/60">{currentPrompts.limits}</p>
                </div>
              </div>

              <div className="rounded-xl border border-ink/10 bg-ink px-4 py-4 text-paper">
                <p className="text-[0.6rem] uppercase tracking-widest text-paper/40">Siguiente paso</p>
                <p className="mt-1 text-sm leading-6 text-paper/75">{selectedExploration?.nextStep}</p>
              </div>

              {/* Metodología y ayudas — colapsables */}
              <details className="rounded-xl border border-ink/10 bg-white overflow-hidden">
                <summary className="px-4 py-3 text-sm font-semibold text-ink/70 cursor-pointer hover:bg-ink/3">Enfoque metodológico sugerido</summary>
                <div className="border-t border-ink/8 px-4 py-3 space-y-2">
                  {methodologicalSteps.map((step, i) => (
                    <p key={i} className="text-xs leading-5 text-ink/60">{i + 1}. {step}</p>
                  ))}
                </div>
              </details>

              <details className="rounded-xl border border-ink/10 bg-white overflow-hidden">
                <summary className="px-4 py-3 text-sm font-semibold text-ink/70 cursor-pointer hover:bg-ink/3">Ayudas y referentes</summary>
                <div className="border-t border-ink/8 px-4 py-3 space-y-2">
                  {helpItems.map((item, i) => (
                    <p key={i} className="text-xs leading-5 text-ink/60">{item}</p>
                  ))}
                  {referenceItems.map((item, i) => (
                    <p key={`r-${i}`} className="text-xs leading-5 text-signal/70">{item}</p>
                  ))}
                </div>
              </details>

              {/* Acciones */}
              <div className="flex flex-wrap gap-2 pt-2">
                {recommendedLab && (
                  <Link to={`/laboratorios/${recommendedLab.id}`}
                    className="rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-paper">
                    Abrir laboratorio sugerido
                  </Link>
                )}
                <button onClick={handleViewPlanning}
                  className="rounded-full border border-ink/12 bg-white px-4 py-2.5 text-xs font-semibold text-ink">
                  Ver documento
                </button>
                <button onClick={handlePrintPDF}
                  className="rounded-full border border-ink/12 bg-white px-4 py-2.5 text-xs font-semibold text-ink">
                  Imprimir / PDF
                </button>
              </div>
            </div>
          </motion.article>
        </motion.div>
      </div>
    </section>
  )
}

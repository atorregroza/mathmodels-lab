import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { explorationBlocks, labs } from '../data/platformContent'
import { usePageMeta } from '../hooks/usePageMeta'

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
}

const methodologyByFormat = {
  guiada: [
    'Usa la pregunta propuesta como punto de partida y concéntrate en justificar con evidencia cada decisión.',
    'No cambies demasiadas variables al mismo tiempo; primero consolida una lectura base.',
  ],
  semiabierta: [
    'Refina la pregunta inicial hasta que sea investigable y no demasiado amplia.',
    'Explica por qué elegiste ese recorte del problema y no otro.',
  ],
  abierta: [
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

  usePageMeta({
    title: block ? `${block.title} | Exploraciones | Deriva Lab` : 'Exploraciones | Deriva Lab',
    description: block ? block.overview : 'Bloque de exploraciones matemáticas dentro de Deriva Lab.',
    keywords: block ? `${block.title}, exploraciones matemáticas, Deriva Lab` : 'exploraciones matemáticas, Deriva Lab',
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
    return <Navigate to="/deriva-lab" replace />
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

  return (
    <section className="px-5 pb-24 pt-10 md:px-8 md:pb-28 md:pt-16">
      <div className="mx-auto max-w-7xl">
        <motion.div {...fadeIn} className="max-w-5xl">
          <p className="section-kicker">Exploraciones matemáticas</p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.8rem)] font-bold leading-[0.94] tracking-[-0.05em]">
            {block.title}
          </h1>
          <p className="mt-4 text-xl text-ink/76">{block.subtitle}</p>
          <p className="mt-6 max-w-4xl text-lg leading-8 text-ink/72">{block.overview}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/deriva-lab"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper"
            >
              Volver a inicio
            </Link>
            <Link
              to="/laboratorios"
              className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink"
            >
              Ver laboratorios base
            </Link>
          </div>
        </motion.div>

        <motion.article
          {...fadeIn}
          className="mt-10 rounded-[2rem] border border-ink/10 bg-white/82 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]"
        >
          <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <div>
              <p className="section-kicker">Así funciona</p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
                Activa una línea, elige un formato y construye un borrador inicial de exploración.
              </h2>
              <p className="mt-4 text-base leading-8 text-ink/70">{block.purpose}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {block.workflow.map((item, index) => (
                  <div key={item.step} className="rounded-[1.15rem] border border-ink/10 bg-paper/78 px-4 py-4">
                    <p className="text-[0.66rem] uppercase tracking-[0.18em] text-ink/44">Paso {index + 1}</p>
                    <p className="mt-2 font-semibold text-ink">{item.step}</p>
                    <p className="mt-2 text-sm leading-6 text-ink/64">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-ink/10 bg-ink p-6 text-paper shadow-[0_28px_82px_rgba(18,23,35,0.16)]">
              <p className="section-kicker text-paper/52">Salida esperada</p>
              <h2 className="mt-3 font-display text-[clamp(1.7rem,3vw,2.6rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
                {block.deliverable.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-paper/74">{block.deliverable.description}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {block.deliverable.sections.map((section) => (
                  <div key={section} className="rounded-[1.1rem] border border-white/10 bg-white/6 px-4 py-4 text-sm leading-6 text-paper/76">
                    {section}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.article>

        <motion.div {...fadeIn} className="mt-10 grid gap-6 xl:grid-cols-[0.98fr_1.02fr]">
          <div className="space-y-6">
            <article className="rounded-[2rem] border border-signal/18 bg-signal/8 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.05)]">
              <p className="section-kicker">Lo que ya hace este bloque</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.2rem] border border-signal/18 bg-white/78 px-4 py-4">
                  <p className="font-semibold text-ink">Te orienta</p>
                  <p className="mt-2 text-sm leading-6 text-ink/66">Eliges línea, formato e idea de arranque sin empezar desde cero.</p>
                </div>
                <div className="rounded-[1.2rem] border border-signal/18 bg-white/78 px-4 py-4">
                  <p className="font-semibold text-ink">Te ayuda a formular</p>
                  <p className="mt-2 text-sm leading-6 text-ink/66">Convierte una idea general en pregunta, variables, evidencia y modelo preliminar.</p>
                </div>
                <div className="rounded-[1.2rem] border border-signal/18 bg-white/78 px-4 py-4">
                  <p className="font-semibold text-ink">Te deja una salida real</p>
                  <p className="mt-2 text-sm leading-6 text-ink/66">Genera una planeación inicial que puedes imprimir o copiar para seguir fuera de la plataforma.</p>
                </div>
              </div>
            </article>

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
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink"
                  >
                    Imprimir planeación
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPlanning}
                    className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink"
                  >
                    {copied ? 'Planeación copiada' : 'Copiar planeación'}
                  </button>
                </div>
              </div>
            </article>

            <article className="rounded-[2rem] border border-ink/10 bg-white/82 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]">
              <p className="section-kicker">6. Enfoque metodológico sugerido</p>
              <div className="mt-5 grid gap-3">
                {methodologicalSteps.map((step, index) => (
                  <div key={step} className="rounded-[1.2rem] border border-ink/10 bg-paper/78 px-4 py-4">
                    <p className="text-[0.66rem] uppercase tracking-[0.18em] text-ink/44">Paso metodológico {index + 1}</p>
                    <p className="mt-2 text-sm leading-7 text-ink/72">{step}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[2rem] border border-ink/10 bg-white/82 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]">
              <p className="section-kicker">7. Ayudas y referentes</p>
              <div className="mt-5 grid gap-3">
                {helpItems.map((item) => (
                  <div key={item} className="rounded-[1.2rem] border border-ink/10 bg-paper/78 px-4 py-4 text-sm leading-7 text-ink/72">
                    {item}
                  </div>
                ))}
                {referenceItems.map((item) => (
                  <div key={item} className="rounded-[1.2rem] border border-signal/18 bg-signal/8 px-4 py-4 text-sm leading-7 text-ink/72">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </div>

          <motion.article
            {...fadeIn}
            className="rounded-[2rem] border border-ink/10 bg-white/84 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]"
          >
            <p className="section-kicker">Planeación inicial</p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
              Borrador de trabajo para continuar fuera de la plataforma.
            </h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-[1.3rem] border border-signal/18 bg-signal/8 px-5 py-5">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Título provisional</p>
                <p className="mt-2 text-lg font-semibold text-ink">{drafts.title}</p>
              </div>

              <div className="rounded-[1.3rem] border border-ink/10 bg-white px-5 py-5">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Contexto elegido</p>
                <p className="mt-2 font-semibold text-ink">{selectedContext?.title ?? 'Idea abierta sin contexto específico'}</p>
                <p className="mt-2 text-sm leading-7 text-ink/68">{selectedContext?.description ?? 'Esta exploración se encuentra formulada como una idea matemática abierta.'}</p>
              </div>

              <div className="rounded-[1.3rem] border border-ink/10 bg-paper/78 px-5 py-5">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Tema o fenómeno elegido</p>
                <p className="mt-2 text-base leading-7 text-ink/74">{drafts.focus}</p>
              </div>

              <div className="rounded-[1.3rem] border border-ink/10 bg-white px-5 py-5">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Pregunta inicial de exploración</p>
                <p className="mt-2 text-base leading-7 text-ink/74">{drafts.question}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.3rem] border border-ink/10 bg-paper/78 px-5 py-5">
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Línea del bloque</p>
                  <p className="mt-2 font-semibold text-ink">{selectedLine?.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/64">{selectedLine?.description}</p>
                </div>
                <div className="rounded-[1.3rem] border border-ink/10 bg-paper/78 px-5 py-5">
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Formato elegido</p>
                  <p className="mt-2 font-semibold text-ink">{selectedFormat?.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/64">{selectedFormat?.description}</p>
                </div>
              </div>

              <div className="rounded-[1.3rem] border border-ink/10 bg-white px-5 py-5">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Variables y unidades</p>
                <p className="mt-2 text-sm leading-7 text-ink/72">{drafts.variables}</p>
              </div>

              <div className="rounded-[1.3rem] border border-ink/10 bg-white px-5 py-5">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Datos o registros iniciales</p>
                <p className="mt-2 text-sm leading-7 text-ink/72">{drafts.evidence}</p>
              </div>

              <div className="rounded-[1.3rem] border border-ink/10 bg-paper/78 px-5 py-5">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Modelo preliminar y justificación</p>
                <p className="mt-2 text-sm leading-7 text-ink/72">Modelos sugeridos para esta exploración: {drafts.models}.</p>
                <p className="mt-3 text-sm leading-7 text-ink/64">
                  La selección preliminar del modelo debe justificarse con forma global, comportamiento de los datos, interpretación de parámetros y ajuste al contexto.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.3rem] border border-ink/10 bg-white px-5 py-5">
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Conjeturas iniciales</p>
                  <p className="mt-2 text-sm leading-7 text-ink/72">{currentPrompts.conjecture}</p>
                </div>
                <div className="rounded-[1.3rem] border border-ink/10 bg-white px-5 py-5">
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Límites observados del modelo</p>
                  <p className="mt-2 text-sm leading-7 text-ink/72">{currentPrompts.limits}</p>
                </div>
              </div>

              <div className="rounded-[1.3rem] border border-ink/10 bg-paper/78 px-5 py-5">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Enfoque metodológico sugerido</p>
                <div className="mt-4 space-y-3">
                  {methodologicalSteps.map((step) => (
                    <div key={step} className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 text-sm leading-7 text-ink/72">
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.3rem] border border-ink/10 bg-white px-5 py-5">
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Ayudas para orientar el trabajo</p>
                  <div className="mt-4 space-y-3">
                    {helpItems.map((item) => (
                      <div key={item} className="rounded-[1rem] border border-ink/10 bg-paper/78 px-4 py-3 text-sm leading-7 text-ink/72">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[1.3rem] border border-ink/10 bg-white px-5 py-5">
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Referentes dentro de la plataforma</p>
                  <div className="mt-4 space-y-3">
                    {referenceItems.length ? (
                      referenceItems.map((item) => (
                        <div key={item} className="rounded-[1rem] border border-signal/18 bg-signal/8 px-4 py-3 text-sm leading-7 text-ink/72">
                          {item}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1rem] border border-ink/10 bg-paper/78 px-4 py-3 text-sm leading-7 text-ink/72">
                        Esta idea todavía no depende de un laboratorio base específico. Puede crecer cuando se incorporen nuevos recursos.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.3rem] border border-ink/10 bg-ink px-5 py-5 text-paper">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-paper/46">Siguientes pasos para continuar el trabajo</p>
                <div className="mt-4 space-y-3">
                  {nextSteps.map((step) => (
                    <div key={step} className="rounded-[1rem] border border-white/10 bg-white/6 px-4 py-3 text-sm leading-6 text-paper/78">
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.3rem] border border-ink/10 bg-white px-5 py-5">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-ink/44">Versión de texto para llevar fuera de la plataforma</p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-[1rem] bg-paper/78 px-4 py-4 font-mono text-sm leading-7 text-ink/74">
                  {planningText}
                </pre>
              </div>
            </div>
          </motion.article>
        </motion.div>
      </div>
    </section>
  )
}

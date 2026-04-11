import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { labs, units } from '../data/platformContent'
import { getUnitColors } from '../data/unitColors'
import { usePageMeta } from '../hooks/usePageMeta'

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.55, ease: 'easeOut' },
}

const stepIcons = {
  Identificar: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <circle cx="9" cy="9" r="6" /><path d="m13.5 13.5 3.5 3.5" />
    </svg>
  ),
  Describir: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M4 5h12M4 9h8M4 13h10" />
    </svg>
  ),
  Interpretar: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M3 16V4l4 4 4-6 4 8 2-2" />
    </svg>
  ),
  Deducir: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <circle cx="10" cy="10" r="7" /><path d="M7 10h6M10 7v6" />
    </svg>
  ),
  Verificar: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="m5 10 3 3 7-7" />
    </svg>
  ),
  Comparar: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M6 4v12M14 4v12M3 10h14" />
    </svg>
  ),
  Calcular: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <rect x="3" y="3" width="14" height="14" rx="2" /><path d="M7 7h6M7 10h6M7 13h3" />
    </svg>
  ),
  Predecir: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M3 14c3-8 11-8 14 0" /><path d="m12 6 2-3 2 3" />
    </svg>
  ),
  Explicar: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M4 4h12v10H8l-4 3V4z" />
    </svg>
  ),
  Justificar: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M4 4h12v12H4z" /><path d="m7 10 2 2 4-4" />
    </svg>
  ),
  Estimar: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" />
    </svg>
  ),
  Demostrar: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M3 3h14l-5 7v5l-4 2V10z" />
    </svg>
  ),
  Investigar: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M10 3v14M6 7l4-4 4 4M5 12h10" />
    </svg>
  ),
  Determinar: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <circle cx="10" cy="10" r="7" /><path d="M10 7v3h3" />
    </svg>
  ),
}

const getStepIcon = (step) => {
  const verb = step.split(' ')[0]
  return stepIcons[verb] || null
}

const LabCard = ({ lab }) => {
  const [open, setOpen] = useState(false)
  const unit = units.find((item) => item.id === lab.unitId)
  const colors = getUnitColors(lab.unitId)

  return (
    <motion.article
      {...fadeIn}
      className={`rounded-[2rem] border border-ink/10 border-l-4 ${colors.border.replace('/20', '')} bg-white/82 p-6 shadow-[0_22px_60px_rgba(18,23,35,0.07)]`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex items-center gap-2 rounded-full ${colors.bg} px-3 py-1 text-xs uppercase tracking-[0.18em] ${colors.text}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${colors.dot}`} />
          {unit?.shortTitle || 'Unidad'}
        </span>
        <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-signal">
          Disponible
        </span>
      </div>
      <h2 className="mt-4 font-display text-[2.4rem] leading-[0.98] tracking-[-0.04em]">{lab.title}</h2>
      <p className="mt-4 text-sm leading-6 text-ink/68">{lab.contextSummary}</p>
      <div className="mt-5 rounded-[1.3rem] bg-paper px-4 py-4">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between text-sm font-semibold text-ink"
        >
          Cómo usarlo
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.25 }}
            className="text-ink/40"
          >
            ▾
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2">
                {lab.howToUse.map((step) => (
                  <div key={step} className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-ink/35">{getStepIcon(step)}</span>
                    <p className="text-sm leading-6 text-ink/66">{step}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to={`/laboratorios/${lab.id}`}
          className={`inline-flex items-center gap-2 rounded-full ${colors.dot} px-5 py-3 text-sm font-semibold text-white`}
        >
          Abrir
        </Link>
        <Link
          to={`/unidades/${lab.unitId}`}
          className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink"
        >
          Ver secuencia
        </Link>
      </div>
    </motion.article>
  )
}

export const LabsLibraryPage = () => {
  const availableLabs = labs.filter((lab) => lab.status === 'available')
  const plannedLabs = labs.filter((lab) => lab.status === 'planned')

  usePageMeta({
    title: 'Laboratorios | MathModels Lab',
    description: 'Biblioteca de simuladores interactivos de modelación matemática con experiencias manipulables y descarga de datos.',
    keywords: 'laboratorios, simuladores, modelación matemática, funciones, cálculo, estadística',
    image: '/og-image.png',
  })

  return (
    <section className="px-5 pb-24 pt-10 md:px-8 md:pb-28 md:pt-16">
      <div className="mx-auto max-w-7xl">
        <motion.div {...fadeIn} className="max-w-4xl">
          <p className="section-kicker">Biblioteca de laboratorios</p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.8rem)] font-bold leading-[0.94] tracking-[-0.05em]">
            Simuladores listos para explorar, analizar y usar en clase.
          </h1>
          <p className="mt-6 text-lg leading-8 text-ink/74">
            Esta biblioteca reúne los laboratorios activos de la plataforma. Cada experiencia tiene una página propia para mantener la lectura clara y el espacio matemático bien aprovechado.
          </p>
        </motion.div>

        <motion.div {...fadeIn} className="mt-10 rounded-[2rem] border border-ink/10 bg-ink p-6 text-paper shadow-[0_30px_85px_rgba(18,23,35,0.2)]">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.3rem] border border-white/10 bg-white/6 p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.28em] text-paper/45">1. Explora</p>
              <p className="mt-3 text-sm leading-6 text-paper/76">Manipula variables, observa la escena y busca relaciones antes de formalizar.</p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/6 p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.28em] text-paper/45">2. Interpreta</p>
              <p className="mt-3 text-sm leading-6 text-paper/76">Compara gráficos, tablas y expresiones para justificar qué está ocurriendo.</p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/6 p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.28em] text-paper/45">3. Continúa</p>
              <p className="mt-3 text-sm leading-6 text-paper/76">Descarga datos, conecta con una unidad y transforma la experiencia en análisis más largo.</p>
            </div>
          </div>
        </motion.div>

        <div className="mt-10 grid gap-5 xl:grid-cols-2">
          {availableLabs.map((lab) => <LabCard key={lab.id} lab={lab} />)}
        </div>

        <motion.div {...fadeIn} className="mt-12">
          <p className="section-kicker">Laboratorios en preparación</p>
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {plannedLabs.map((lab) => (
              <article key={lab.id} className="rounded-[1.7rem] border border-ink/10 bg-white/75 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-ink/8 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink/55">
                    En preparación
                  </span>
                </div>
                <h3 className="mt-4 font-display text-[2rem] tracking-[-0.03em]">{lab.title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink/66">{lab.contextSummary}</p>
              </article>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

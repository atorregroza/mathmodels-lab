import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { labs, units } from '../data/platformContent'
import { getUnitColors } from '../data/unitColors'
import { usePageMeta } from '../hooks/usePageMeta'
import { Breadcrumb } from '../components/layout/PlatformShell'

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.55, ease: 'easeOut' },
}

export const UnitPage = () => {
  const { unitId } = useParams()
  const unit = units.find((item) => item.id === unitId)

  usePageMeta({
    title: unit ? `${unit.title} | MathModels Lab` : 'Unidad | MathModels Lab',
    description: unit ? `${unit.title}: propósito, forma de estudio y laboratorios asociados dentro de la plataforma.` : 'Unidad de estudio dentro de MathModels Lab.',
    keywords: unit ? `${unit.title}, matemáticas, laboratorio` : 'matemáticas, laboratorio',
    image: '/og-image.png',
  })

  const [toolkitOpen, setToolkitOpen] = useState(false)
  const colors = getUnitColors(unitId)

  if (!unit) {
    return <Navigate to="/secuencia" replace />
  }

  const unitLabs = labs.filter((lab) => lab.unitId === unit.id)
  const availableLabs = unitLabs.filter((lab) => lab.status === 'available')
  const plannedLabs = unitLabs.filter((lab) => lab.status === 'planned')
  const learningPath = (unit.learningPath || [])
    .map((step) => ({ ...step, lab: labs.find((lab) => lab.id === step.labId) }))
    .filter((step) => step.lab)

  return (
    <section className="px-5 pb-24 pt-4 md:px-8 md:pb-28 md:pt-6">
      <Breadcrumb items={[
        { label: 'Unidades', to: '/secuencia' },
        { label: unit.shortTitle || unit.title },
      ]} />
      <div className="mx-auto max-w-7xl mt-6">
        <motion.div {...fadeIn} className="max-w-4xl">
          <p className="section-kicker flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${colors.dot}`} />
            Unidad
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.8rem)] font-bold leading-[0.94] tracking-[-0.05em]">
            {unit.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-ink/74">{unit.overview}</p>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-ink/35">
                <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
              </svg>
              <p className="text-sm leading-6 text-ink/58">{unit.studentFocus}</p>
            </div>
            <div className="flex items-start gap-2.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-ink/35">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              <p className="text-sm leading-6 text-ink/58">{unit.teacherUse}</p>
            </div>
          </div>
        </motion.div>

        {unit.mathToolkit && unit.mathToolkit.length > 0 && (
          <motion.div {...fadeIn} className="mt-8">
            <button
              type="button"
              onClick={() => setToolkitOpen((v) => !v)}
              className="group flex w-full items-center justify-between gap-4 rounded-[1.6rem] border border-ink/12 bg-white px-6 py-5 text-left shadow-[0_8px_24px_rgba(18,23,35,0.06)] transition-all hover:border-ink/20 hover:shadow-[0_12px_32px_rgba(18,23,35,0.1)]"
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.bg} ${colors.text}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
                  </svg>
                </span>
                <div>
                  <p className="font-display text-lg font-semibold tracking-[-0.02em]">Marco conceptual</p>
                  <p className="text-sm text-ink/55">Ideas y conexiones matemáticas de esta unidad</p>
                </div>
              </div>
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`text-ink/40 transition-transform duration-300 ${toolkitOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            <AnimatePresence>
              {toolkitOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="overflow-hidden"
                >
                  <div className={`mt-3 rounded-[1.6rem] border ${colors.border} ${colors.bg} px-6 py-6`}>
                    <div className="space-y-4">
                      {unit.mathToolkit.map((paragraph, index) => (
                        <p key={index} className="text-[0.95rem] leading-[1.85] text-ink/78">{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {learningPath.length > 0 && (
          <motion.div {...fadeIn} className="mt-8">
            <p className="section-kicker">Laboratorios de esta unidad</p>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {learningPath.map((step, index) => (
                <article key={step.lab.id} className="rounded-[1.5rem] border border-ink/10 bg-white px-5 py-5 shadow-[0_10px_25px_rgba(18,23,35,0.05)]">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colors.dot} text-sm font-semibold text-white`}>
                      {index + 1}
                    </span>
                    <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">{step.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink/68">{step.description}</p>

                  {step.lab.status === 'available' ? (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        to={`/laboratorios/${step.lab.id}`}
                        className={`inline-flex items-center gap-2 rounded-full ${colors.dot} px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5`}
                      >
                        Abrir modelación
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-ink/8 px-4 py-2.5 text-sm font-semibold text-ink/52">
                        Modelación en preparación
                      </span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </motion.div>
        )}

        {learningPath.length === 0 && (
          <motion.div {...fadeIn} className="mt-8 rounded-[2rem] border border-ink/10 bg-white/78 p-6 shadow-[0_22px_55px_rgba(18,23,35,0.07)]">
            <p className="section-kicker">Laboratorios para esta unidad</p>
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              {availableLabs.map((lab, index) => (
                <article key={lab.id} className="rounded-[1.5rem] border border-ink/10 bg-paper px-5 py-5">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colors.dot} text-sm font-semibold text-white`}>
                      {index + 1}
                    </span>
                    <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">{lab.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink/68">{lab.contextSummary}</p>
                  <Link
                    to={`/laboratorios/${lab.id}`}
                    className={`mt-5 inline-flex items-center gap-2 rounded-full ${colors.dot} px-4 py-2.5 text-sm font-semibold text-white`}
                  >
                    Abrir modelación
                  </Link>
                </article>
              ))}

              {plannedLabs.length > 0 && plannedLabs.map((lab) => (
                <article key={lab.id} className="rounded-[1.5rem] border border-ink/10 bg-white px-5 py-5">
                  <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink/55">{lab.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-ink/68">{lab.contextSummary}</p>
                </article>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  )
}

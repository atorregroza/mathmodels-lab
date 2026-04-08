import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { labs, units } from '../data/platformContent'
import { getUnitColors } from '../data/unitColors'
import { usePageMeta } from '../hooks/usePageMeta'

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
    return <Navigate to="/ruta-ib" replace />
  }

  const unitLabs = labs.filter((lab) => lab.unitId === unit.id)
  const availableLabs = unitLabs.filter((lab) => lab.status === 'available')
  const plannedLabs = unitLabs.filter((lab) => lab.status === 'planned')
  const learningPath = (unit.learningPath || [])
    .map((step) => ({ ...step, lab: labs.find((lab) => lab.id === step.labId) }))
    .filter((step) => step.lab)

  return (
    <section className="px-5 pb-24 pt-10 md:px-8 md:pb-28 md:pt-16">
      <div className="mx-auto max-w-7xl">
        <motion.div {...fadeIn} className="max-w-4xl">
          <p className="section-kicker flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${colors.dot}`} />
            Unidad curricular
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.8rem)] font-bold leading-[0.94] tracking-[-0.05em]">
            {unit.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-ink/74">{unit.overview}</p>
        </motion.div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
          <motion.div {...fadeIn} className="rounded-[2rem] border border-ink/10 bg-white/78 p-6 shadow-[0_22px_55px_rgba(18,23,35,0.07)]">
            <p className="section-kicker">Propósito</p>
            <p className="mt-4 text-base leading-7 text-ink/70">{unit.purpose}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="text-sm font-semibold text-ink">Para estudiantes</p>
                <p className="mt-2 text-sm leading-6 text-ink/68">{unit.studentFocus}</p>
              </div>
              <div className="rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="text-sm font-semibold text-ink">Para docentes</p>
                <p className="mt-2 text-sm leading-6 text-ink/68">{unit.teacherUse}</p>
              </div>
            </div>
          </motion.div>

          <motion.div {...fadeIn} className="rounded-[2rem] border border-ink/10 bg-ink p-6 text-paper shadow-[0_28px_80px_rgba(18,23,35,0.22)]">
            <p className="section-kicker text-paper/55">Secuencia sugerida</p>
            <div className="mt-5 space-y-3">
              {unit.recommendedOrder.map((item, index) => (
                <div key={item} className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.24em] text-paper/45">Paso {index + 1}</p>
                  <p className="mt-2 text-sm leading-6 text-paper/76">{item}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

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
          <motion.div {...fadeIn} className="mt-8 rounded-[2rem] border border-ink/10 bg-paper p-6 shadow-[0_22px_55px_rgba(18,23,35,0.07)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-3xl">
                <p className="section-kicker">Cómo se organiza esta unidad</p>
                <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.8rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
                  La secuencia va de una visión comparativa a laboratorios cada vez más especializados.
                </h2>
              </div>
              <Link
                to="/laboratorios"
                className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-4 py-2.5 text-sm font-semibold text-ink"
              >
                Explorar biblioteca
              </Link>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              {learningPath.map((step, index) => (
                <article key={step.lab.id} className="rounded-[1.5rem] border border-ink/10 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(18,23,35,0.05)]">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${colors.dot} text-sm font-semibold text-white`}>
                      {index + 1}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${step.lab.status === 'available' ? `border ${colors.border} ${colors.bg} ${colors.text}` : 'bg-ink/8 text-ink/55'}`}>
                      {step.lab.status === 'available' ? 'Disponible' : 'En preparación'}
                    </span>
                  </div>

                  <h3 className="mt-4 font-display text-[2rem] leading-tight tracking-[-0.03em]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-ink/68">{step.description}</p>
                  {step.lab.contextSummary && (
                    <p className="mt-3 text-sm leading-6 text-ink/60">{step.lab.contextSummary}</p>
                  )}

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
              {availableLabs.map((lab) => (
                <article key={lab.id} className="rounded-[1.5rem] border border-ink/10 bg-paper px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-[2rem] leading-tight tracking-[-0.03em]">{lab.title}</h3>
                    <span className={`rounded-full border ${colors.border} ${colors.bg} px-3 py-1 text-xs uppercase tracking-[0.16em] ${colors.text}`}>
                      Disponible
                    </span>
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

              {plannedLabs.map((lab) => (
                <article key={lab.id} className="rounded-[1.5rem] border border-ink/10 bg-white px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-[2rem] leading-tight tracking-[-0.03em]">{lab.title}</h3>
                    <span className="rounded-full bg-ink/8 px-3 py-1 text-xs uppercase tracking-[0.16em] text-ink/55">
                      En preparación
                    </span>
                  </div>
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

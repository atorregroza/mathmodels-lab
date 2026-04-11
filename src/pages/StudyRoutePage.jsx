import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { units } from '../data/platformContent'
import { getUnitColors } from '../data/unitColors'
import { usePageMeta } from '../hooks/usePageMeta'

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.55, ease: 'easeOut' },
}

export const StudyRoutePage = () => {
  usePageMeta({
    title: 'Secuencia de estudio | MathModels Lab',
    description: 'Recorrido por unidades para estudiar matemáticas con laboratorios interactivos de modelación.',
    keywords: 'secuencia de estudio, unidades, modelación matemática, laboratorios',
    image: '/og-image.png',
  })

  return (
    <section className="px-5 pb-24 pt-10 md:px-8 md:pb-28 md:pt-16">
      <div className="mx-auto max-w-7xl">
        <motion.div {...fadeIn} className="max-w-4xl">
          <p className="section-kicker">Secuencia de estudio</p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.8rem)] font-bold leading-[0.94] tracking-[-0.05em]">
            Cinco unidades, una progresión con sentido matemático.
          </h1>
          <p className="mt-6 text-lg leading-8 text-ink/74">
            Cada unidad desarrolla competencias específicas y sus laboratorios siguen un orden didáctico: del concepto a la modelación, de lo concreto a lo formal. La secuencia permite al docente planificar y al estudiante construir comprensión paso a paso.
          </p>
        </motion.div>

        <div className="mt-12 space-y-5">
          {units.map((unit, index) => {
            const colors = getUnitColors(unit.id)
            return (
            <motion.article
              key={unit.id}
              {...fadeIn}
              className={`grid gap-5 rounded-[2rem] border border-ink/10 border-l-4 ${colors.border.replace('/20', '')} bg-white/78 p-6 shadow-[0_22px_60px_rgba(18,23,35,0.07)] lg:grid-cols-[auto_1fr_auto] lg:items-start`}
            >
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${colors.bg} font-display text-2xl font-bold ${colors.text}`}>
                {index + 1}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={colors.text}>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  <h2 className="font-display text-[2rem] font-semibold tracking-[-0.03em]">{unit.title}</h2>
                </div>
                <p className="mt-3 text-base leading-7 text-ink/68">{unit.overview}</p>
                <div className="mt-3 flex flex-col gap-2">
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
                <div className="mt-5 flex flex-wrap gap-2">
                  {unit.recommendedOrder.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-ink/68"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Link
                  to={`/unidades/${unit.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper"
                >
                  Abrir unidad
                </Link>
              </div>
            </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

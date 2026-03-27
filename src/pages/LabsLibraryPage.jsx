import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { labs, units } from '../data/platformContent'
import { usePageMeta } from '../hooks/usePageMeta'

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.55, ease: 'easeOut' },
}

export const LabsLibraryPage = () => {
  const availableLabs = labs.filter((lab) => lab.status === 'available')
  const plannedLabs = labs.filter((lab) => lab.status === 'planned')

  usePageMeta({
    title: 'Laboratorios | Deriva Lab',
    description: 'Biblioteca de simuladores para estudiar Matemáticas: Análisis y Enfoques con experiencias interactivas y descarga de datos.',
    keywords: 'laboratorios, simuladores, matemáticas IB, análisis y enfoques, funciones, cálculo',
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
          {availableLabs.map((lab) => {
            const unit = units.find((item) => item.id === lab.unitId)

            return (
              <motion.article
                key={lab.id}
                {...fadeIn}
                className="rounded-[2rem] border border-ink/10 bg-white/82 p-6 shadow-[0_22px_60px_rgba(18,23,35,0.07)]"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-ink px-3 py-1 text-xs uppercase tracking-[0.18em] text-paper">
                    {unit?.shortTitle || 'Unidad'}
                  </span>
                  <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-signal">
                    Disponible
                  </span>
                </div>
                <h2 className="mt-4 font-display text-[2.4rem] leading-[0.98] tracking-[-0.04em]">{lab.title}</h2>
                <p className="mt-4 text-sm leading-6 text-ink/68">{lab.contextSummary}</p>
                <div className="mt-5 rounded-[1.3rem] bg-paper px-4 py-4">
                  <p className="text-sm font-semibold text-ink">Cómo usarlo</p>
                  <div className="mt-3 space-y-2">
                    {lab.howToUse.map((step) => (
                      <p key={step} className="text-sm leading-6 text-ink/66">{step}</p>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to={`/laboratorios/${lab.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-sm font-semibold text-white"
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
          })}
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

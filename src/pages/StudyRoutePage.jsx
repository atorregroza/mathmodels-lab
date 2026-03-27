import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { units } from '../data/platformContent'
import { usePageMeta } from '../hooks/usePageMeta'

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.55, ease: 'easeOut' },
}

export const StudyRoutePage = () => {
  usePageMeta({
    title: 'Ruta IB | Deriva Lab',
    description: 'Recorrido por unidades para estudiar Matemáticas: Análisis y Enfoques con laboratorios interactivos.',
    keywords: 'ruta IB, unidades, análisis y enfoques, laboratorios',
    image: '/og-image.png',
  })

  return (
    <section className="px-5 pb-24 pt-10 md:px-8 md:pb-28 md:pt-16">
      <div className="mx-auto max-w-7xl">
        <motion.div {...fadeIn} className="max-w-4xl">
          <p className="section-kicker">Ruta IB</p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.8rem)] font-bold leading-[0.94] tracking-[-0.05em]">
            Un recorrido pensado para que cada unidad tenga sentido antes de pasar a la siguiente.
          </h1>
          <p className="mt-6 text-lg leading-8 text-ink/74">
            Aquí la plataforma no se recorre por herramientas, sino por necesidades de aprendizaje. Cada unidad explica qué busca desarrollar, cómo se estudia y qué laboratorio conviene abrir.
          </p>
        </motion.div>

        <div className="mt-12 space-y-5">
          {units.map((unit, index) => (
            <motion.article
              key={unit.id}
              {...fadeIn}
              className="grid gap-5 rounded-[2rem] border border-ink/10 bg-white/78 p-6 shadow-[0_22px_60px_rgba(18,23,35,0.07)] lg:grid-cols-[auto_1fr_auto] lg:items-start"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-ink/12 bg-paper font-display text-2xl font-bold">
                {index + 1}
              </div>
              <div>
                <h2 className="font-display text-[2rem] font-semibold tracking-[-0.03em]">{unit.title}</h2>
                <p className="mt-3 text-base leading-7 text-ink/68">{unit.overview}</p>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.2rem] bg-paper px-4 py-4">
                    <p className="text-sm font-semibold text-ink">Para estudiantes</p>
                    <p className="mt-2 text-sm leading-6 text-ink/68">{unit.studentFocus}</p>
                  </div>
                  <div className="rounded-[1.2rem] bg-paper px-4 py-4">
                    <p className="text-sm font-semibold text-ink">Para docentes</p>
                    <p className="mt-2 text-sm leading-6 text-ink/68">{unit.teacherUse}</p>
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
                <span className={`rounded-full px-3 py-1 text-center text-xs uppercase tracking-[0.16em] ${unit.status === 'active' ? 'bg-graph/35 text-ink' : 'bg-paper text-ink/60'}`}>
                  {unit.status === 'active' ? 'Con laboratorios' : 'Próximamente'}
                </span>
                <Link
                  to={`/unidades/${unit.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper"
                >
                  Abrir unidad
                </Link>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

import { motion } from 'framer-motion'
import { usePageMeta } from '../hooks/usePageMeta'
import { ModelingSpace } from '../components/features/ModelingSpace'

export function ModelacionPage() {
  usePageMeta({
    title: 'Espacio de Modelación — MathModels Lab',
    description: 'Sube tus datos y encuentra el modelo matemático que mejor los describe. Guiado paso a paso o en modo directo.',
    keywords: 'modelación, regresión, ajuste de curvas, datos, modelo matemático, IB',
  })

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-16"
    >
      {/* header */}
      <div className="mb-8">
        <p className="mb-3 flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-ink/55">
          <span className="h-2 w-2 rounded-full bg-signal" />
          Espacio de Modelación
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl lg:text-5xl">
          Del dato al modelo.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-ink/60 leading-relaxed md:text-lg">
          Sube tus propios datos y descubre qué función matemática describe mejor el fenómeno.
          El sistema te guía para que entiendas <strong>por qué</strong> un modelo funciona — no solo cuál es.
        </p>
      </div>

      {/* main content */}
      <div className="rounded-[2rem] border border-ink/8 bg-white/80 p-5 shadow-[0_8px_40px_rgba(18,23,35,0.06)] md:p-8">
        <ModelingSpace />
      </div>
    </motion.main>
  )
}

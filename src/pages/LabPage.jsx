import { motion } from 'framer-motion'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AreaAccumulationLab } from '../components/features/AreaAccumulationLab'
import { BinomialTheoremLab } from '../components/features/BinomialTheoremLab'
import { CompoundInterestLab } from '../components/features/CompoundInterestLab'
import { LogarithmMirrorLab } from '../components/features/LogarithmMirrorLab'
import { SystemsOfEquationsLab } from '../components/features/SystemsOfEquationsLab'
import { SequenceGrowthLab } from '../components/features/SequenceGrowthLab'
import { FunctionFitLab } from '../components/features/FunctionFitLab'
import { FunctionPanoramaLab } from '../components/features/FunctionPanoramaLab'
import { FunctionRationalLab } from '../components/features/FunctionRationalLab'
import { FunctionTrigonometricLab } from '../components/features/FunctionTrigonometricLab'
import { FunctionTransformationsLab } from '../components/features/FunctionTransformationsLab'
import { IntegralNetChangeLab } from '../components/features/IntegralNetChangeLab'
import { LimitsApproximationLab } from '../components/features/LimitsApproximationLab'
import { MotionTrackingLab } from '../components/features/MotionTrackingLab'
import { PatternLab } from '../components/features/PatternLab'
import { FibonacciLab } from '../components/features/FibonacciLab'
import { TrajectoryCalculusLab } from '../components/features/TrajectoryCalculusLab'
import { OptimizationLab } from '../components/features/OptimizationLab'
import { VolumeSurfaceLab } from '../components/features/VolumeSurfaceLab'
import { ContainerFillingLab } from '../components/features/ContainerFillingLab'
import { ConicsModelingLab } from '../components/features/ConicsModelingLab'
import { labs, units } from '../data/platformContent'
import { usePageMeta } from '../hooks/usePageMeta'

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.55, ease: 'easeOut' },
}

export const LabPage = () => {
  const { labId } = useParams()
  const lab = labs.find((item) => item.id === labId)
  const unit = units.find((item) => item.id === lab?.unitId)

  usePageMeta({
    title: lab ? `${lab.title} | MathModels Lab` : 'Laboratorio | MathModels Lab',
    description: lab ? lab.purpose : 'Laboratorio interactivo dentro de MathModels Lab.',
    keywords: lab && unit ? `${lab.title}, ${unit.title}, laboratorio` : 'laboratorio, MathModels Lab',
    image: '/og-image.png',
  })

  if (!lab) {
    return <Navigate to="/laboratorios" replace />
  }

  const componentMap = {
    sequence: SequenceGrowthLab,
    compound: CompoundInterestLab,
    logarithm: LogarithmMirrorLab,
    binomial: BinomialTheoremLab,
    systems: SystemsOfEquationsLab,
    area: AreaAccumulationLab,
    fit: FunctionFitLab,
    panorama: FunctionPanoramaLab,
    rational: FunctionRationalLab,
    trigonometric: FunctionTrigonometricLab,
    transform: FunctionTransformationsLab,
    integral: IntegralNetChangeLab,
    limits: LimitsApproximationLab,
    tracking: MotionTrackingLab,
    patterns: PatternLab,
    fibonacci: FibonacciLab,
    trajectory: TrajectoryCalculusLab,
    optimization: OptimizationLab,
    volumeSurface: VolumeSurfaceLab,
    containerFilling: ContainerFillingLab,
    conics: ConicsModelingLab,
  }
  const Component = componentMap[lab.componentKey]

  return (
    <section className="px-5 pb-24 pt-10 md:px-8 md:pb-28 md:pt-16">
      <div className="mx-auto max-w-7xl">
        <motion.div {...fadeIn} className="max-w-4xl">
          <p className="section-kicker">Laboratorio</p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.8rem)] font-bold leading-[0.94] tracking-[-0.05em]">
            {lab.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-ink/74">{lab.purpose}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={`/unidades/${lab.unitId}`}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper"
            >
              Volver a la unidad
            </Link>
            <Link
              to="/ruta-ib"
              className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink"
            >
              Ver Ruta IB
            </Link>
          </div>
        </motion.div>

        <div className="mt-10 space-y-8">
          <motion.div {...fadeIn} className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="rounded-[1.8rem] border border-ink/10 bg-white/78 p-6 shadow-[0_22px_55px_rgba(18,23,35,0.07)]">
              <p className="section-kicker">Uso sugerido</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {lab.howToUse.map((step, index) => (
                  <div key={step} className="rounded-[1.2rem] border border-ink/8 bg-paper px-4 py-4">
                    <p className="text-[0.7rem] uppercase tracking-[0.24em] text-ink/45">Paso {index + 1}</p>
                    <p className="mt-2 text-sm leading-6 text-ink/68">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.8rem] border border-ink/10 bg-paper p-6 shadow-[0_22px_55px_rgba(18,23,35,0.06)]">
                <p className="section-kicker">Contexto del problema</p>
                <p className="mt-4 text-base leading-8 text-ink/70">{lab.contextSummary}</p>
              </div>

              <div className="rounded-[1.8rem] border border-ink/10 bg-ink p-6 text-paper shadow-[0_28px_80px_rgba(18,23,35,0.22)]">
                <p className="section-kicker text-paper/55">Para docentes</p>
                <p className="mt-4 text-base leading-8 text-paper/76">{lab.teacherUse}</p>
              </div>
            </div>
          </motion.div>

          <motion.div {...fadeIn} className="rounded-[1.8rem] border border-ink/10 bg-white/72 p-3 shadow-[0_22px_55px_rgba(18,23,35,0.07)]">
            {Component ? <Component /> : null}
          </motion.div>

          <motion.div {...fadeIn} className="rounded-[1.8rem] border border-ink/10 bg-white/78 p-6 shadow-[0_22px_55px_rgba(18,23,35,0.07)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="section-kicker">Unidad asociada</p>
                <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em]">{unit?.title}</h2>
                <p className="mt-3 text-sm leading-6 text-ink/68">{unit?.purpose}</p>
              </div>
              <Link
                to={`/unidades/${unit?.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper"
              >
                Ver secuencia de la unidad
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

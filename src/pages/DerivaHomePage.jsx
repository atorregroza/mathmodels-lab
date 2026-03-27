import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { complementaryRoutes, labs, platformSupports, units } from '../data/platformContent'
import { usePageMeta } from '../hooks/usePageMeta'

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.55, ease: 'easeOut' },
}

export const DerivaHomePage = () => {
  const availableLabs = labs.filter((lab) => lab.status === 'available')
  const activeUnits = units.filter((unit) => unit.status === 'active')
  const observatoryLab = labs.find((lab) => lab.id === 'seguimiento-movimiento')

  usePageMeta({
    title: 'Inicio | Deriva Lab',
    description: 'Plataforma de modelación matemática para Matemáticas: Análisis y Enfoques del IB.',
    keywords: 'Deriva Lab, modelación matemática, IB, análisis y enfoques, simuladores',
    image: '/og-image.png',
  })

  return (
    <section className="px-5 pb-24 pt-10 md:px-8 md:pb-28 md:pt-16">
      <div className="mx-auto max-w-7xl">
        <motion.div {...fadeIn} className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="section-kicker">Deriva Lab</p>
            <h1 className="mt-4 font-display text-[clamp(3rem,7vw,6.2rem)] font-bold leading-[0.92] tracking-[-0.05em]">
              Modelación matemática para estudiar con más sentido, más rigor y más contexto.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-ink/74">
              La plataforma organiza laboratorios interactivos, rutas por unidad IB y problemas de modelación para que estudiantes y docentes puedan explorar, interpretar y justificar matemáticamente lo que ocurre.
            </p>
            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-signal/20 bg-signal/8 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-signal">
              Capa observacional activa
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/ruta-ib"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper"
              >
                Entrar por Ruta IB
              </Link>
              <Link
                to="/laboratorios"
                className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink"
              >
                Ver laboratorios
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-ink/10 bg-ink p-6 text-paper shadow-[0_30px_85px_rgba(18,23,35,0.18)]">
            <p className="section-kicker text-paper/55">Cómo se recorre</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                <p className="text-sm font-semibold">1. Entra por una unidad o por un laboratorio</p>
                <p className="mt-2 text-sm leading-6 text-paper/74">La plataforma permite recorrer contenidos del IB o abrir directamente una experiencia específica.</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                <p className="text-sm font-semibold">2. Explora, modela e interpreta</p>
                <p className="mt-2 text-sm leading-6 text-paper/74">Cada laboratorio combina escena, gráfica, expresión, lectura guiada y, cuando hace falta, descarga de datos.</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                <p className="text-sm font-semibold">3. Extiende hacia investigación</p>
                <p className="mt-2 text-sm leading-6 text-paper/74">La misma lógica de modelación puede crecer hacia exploraciones matemáticas y trabajos más largos.</p>
              </div>
            </div>
          </div>
        </motion.div>

        {observatoryLab && (
          <motion.div
            {...fadeIn}
            className="mt-10 rounded-[2.2rem] border border-ink/10 bg-white/84 p-6 shadow-[0_26px_72px_rgba(18,23,35,0.08)] md:p-8"
          >
            <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="rounded-[1.8rem] border border-ink/10 bg-ink p-6 text-paper shadow-[0_24px_70px_rgba(18,23,35,0.16)]">
                <p className="section-kicker text-paper/48">Modelación desde la observación</p>
                <h2 className="mt-3 font-display text-[clamp(2.2rem,4.4vw,4.1rem)] font-semibold leading-[0.96] tracking-[-0.04em]">
                  {observatoryLab.title}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-paper/74">
                  Esta capa lleva la plataforma más allá del graficador: parte de una escena, sigue un objeto, convierte fotogramas en datos y reconstruye un modelo que sí nace del fenómeno.
                </p>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-paper/44">1. Observa</p>
                    <p className="mt-2 text-sm leading-6 text-paper/78">La escena muestra caída libre, lanzamiento horizontal u oblicuo.</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-paper/44">2. Sigue</p>
                    <p className="mt-2 text-sm leading-6 text-paper/78">El punto seguido se transforma en tabla con tiempo, x(t) e y(t).</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-paper/44">3. Modela</p>
                    <p className="mt-2 text-sm leading-6 text-paper/78">La lectura final compara fenómeno, datos y funciones recuperadas.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.6rem] border border-ink/10 bg-paper p-5">
                  <p className="section-kicker">Por qué importa</p>
                  <p className="mt-3 text-base leading-7 text-ink/72">
                    Aquí la modelación no empieza en la fórmula, sino en lo que realmente se mueve. Eso permite hablar con más rigor de componente horizontal, componente vertical, ajuste, error y elección del modelo.
                  </p>
                </div>
                <div className="rounded-[1.6rem] border border-ink/10 bg-paper p-5">
                  <p className="section-kicker">Uso en clase</p>
                  <p className="mt-3 text-base leading-7 text-ink/72">
                    Funciona como puente entre observación, recolección de datos, representación gráfica e interpretación matemática. Es una base natural para crecer hacia la futura capa de video real y seguimiento más fino.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/laboratorios/seguimiento-movimiento"
                    className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(255,107,53,0.2)]"
                  >
                    Abrir observatorio
                  </Link>
                  <Link
                    to="/unidades/funciones"
                    className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink"
                  >
                    Ver secuencia de Funciones
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div {...fadeIn} className="mt-10 grid gap-5 md:grid-cols-3">
          <article className="rounded-[1.8rem] border border-ink/10 bg-white/78 p-6 shadow-[0_20px_55px_rgba(18,23,35,0.06)]">
            <p className="section-kicker">Unidades activas</p>
            <p className="mt-4 font-display text-5xl font-semibold tracking-[-0.04em]">{activeUnits.length}</p>
            <p className="mt-3 text-sm leading-6 text-ink/66">Ya tienen ruta de estudio y laboratorios disponibles para comenzar.</p>
          </article>
          <article className="rounded-[1.8rem] border border-ink/10 bg-white/78 p-6 shadow-[0_20px_55px_rgba(18,23,35,0.06)]">
            <p className="section-kicker">Laboratorios activos</p>
            <p className="mt-4 font-display text-5xl font-semibold tracking-[-0.04em]">{availableLabs.length}</p>
            <p className="mt-3 text-sm leading-6 text-ink/66">Pueden usarse en clase, explorarse de forma autónoma y descargar datos para seguir trabajando.</p>
          </article>
          <article className="rounded-[1.8rem] border border-ink/10 bg-white/78 p-6 shadow-[0_20px_55px_rgba(18,23,35,0.06)]">
            <p className="section-kicker">Rutas de investigación</p>
            <p className="mt-4 font-display text-5xl font-semibold tracking-[-0.04em]">{complementaryRoutes.length}</p>
            <p className="mt-3 text-sm leading-6 text-ink/66">Preparan el paso desde el laboratorio breve hacia exploraciones y monografías matemáticas.</p>
          </article>
        </motion.div>

        <motion.div {...fadeIn} className="mt-10 rounded-[2rem] border border-ink/10 bg-white/82 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-3xl">
              <p className="section-kicker">Herramientas transversales</p>
              <h2 className="mt-3 font-display text-[clamp(1.9rem,4vw,3.2rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
                Apoyos que deben aparecer cuando el trabajo matemático lo requiera.
              </h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {platformSupports.map((support) => (
              <article key={support.id} className="rounded-[1.5rem] border border-ink/10 bg-paper/78 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-2xl tracking-[-0.03em]">{support.title}</h3>
                  <span className="rounded-full bg-ink/8 px-3 py-1 text-xs uppercase tracking-[0.16em] text-ink/55">
                    Próximamente
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink/68">{support.purpose}</p>
              </article>
            ))}
          </div>
        </motion.div>

        <motion.div {...fadeIn} className="mt-10 rounded-[2rem] border border-ink/10 bg-white/82 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]">
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div>
              <p className="section-kicker">Dirección y autoría</p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
                Una plataforma de modelación matemática con visión pedagógica propia.
              </h2>
              <p className="mt-4 text-base leading-7 text-ink/68">
                Deriva Lab es una plataforma elaborada con inteligencia artificial, con desarrollo asistido específicamente por Codex, para construir experiencias de modelación matemática con sentido curricular, rigor conceptual y uso real en el aula.
              </p>
            </div>

            <div className="rounded-[1.6rem] border border-ink/10 bg-paper px-5 py-5">
              <p className="text-[0.68rem] uppercase tracking-[0.2em] text-ink/48">Créditos</p>
              <p className="mt-4 font-display text-3xl tracking-[-0.03em] text-ink">Astrid Torregroza Olivero</p>
              <p className="mt-2 text-sm font-semibold text-ink/78">Lic. en Matemáticas y Física</p>
              <p className="mt-4 text-sm leading-6 text-ink/66">
                Concepto, dirección pedagógica, visión curricular y orientación académica de la plataforma.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-ink/62">Matemáticas IB</span>
                <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-ink/62">IA aplicada</span>
                <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-ink/62">Claude Code</span>
                <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-ink/62">Codex</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div {...fadeIn} className="mt-10 grid gap-8 xl:grid-cols-[1.04fr_0.96fr]">
          <div className="rounded-[2rem] border border-ink/10 bg-white/82 p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-2xl">
                <p className="section-kicker">Unidades IB</p>
                <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.6rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
                  La plataforma se organiza siguiendo la secuencia del curso.
                </h2>
              </div>
              <Link
                to="/ruta-ib"
                className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-paper px-4 py-2.5 text-sm font-semibold text-ink"
              >
                Abrir ruta
              </Link>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {units.map((unit) => (
                <article key={unit.id} className="rounded-[1.4rem] border border-ink/10 bg-paper/72 px-4 py-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <h3 className="flex-1 font-display text-2xl tracking-[-0.03em]">{unit.title}</h3>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${unit.status === 'active' ? 'border border-signal/25 bg-signal/10 text-signal' : 'bg-white text-ink/55'}`}>
                      {unit.status === 'active' ? 'Activa' : 'En preparación'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink/66">{unit.overview}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-ink/10 bg-paper p-6 shadow-[0_24px_64px_rgba(18,23,35,0.07)]">
            <p className="section-kicker">Rutas de investigación</p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
              Modelación para evaluación interna y monografía.
            </h2>
            <div className="mt-6 space-y-4">
              {complementaryRoutes.map((route) => (
                <article key={route.id} className="rounded-[1.4rem] border border-ink/10 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-2xl tracking-[-0.03em]">{route.title}</h3>
                    <span className="rounded-full bg-ink/8 px-3 py-1 text-xs uppercase tracking-[0.16em] text-ink/55">
                      Próximamente
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink/68">{route.purpose}</p>
                  <p className="mt-3 text-sm leading-6 text-ink/58">{route.description}</p>
                  {route.blocks?.length ? (
                    <div className="mt-4 grid gap-3">
                      {route.blocks.map((block) => (
                        <div key={block.id} className="rounded-[1.15rem] border border-ink/8 bg-paper/72 px-4 py-4">
                          <p className="text-[0.66rem] uppercase tracking-[0.18em] text-ink/44">{block.title}</p>
                          <p className="mt-2 font-semibold text-ink">{block.subtitle}</p>
                          <p className="mt-2 text-sm leading-6 text-ink/62">{block.description}</p>
                          {route.id === 'exploracion-matematica' && block.id === 'exploraciones-modelacion' ? (
                            <Link
                              to="/exploraciones/bloque-1"
                              className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper"
                            >
                              Ver estructura del bloque
                            </Link>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { labs, units } from '../data/platformContent'
import { usePageMeta } from '../hooks/usePageMeta'

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.55, ease: 'easeOut' },
}


const UNIT_COLORS = {
  'aritmetica-algebra': { bg: 'bg-signal/18', border: 'border-signal/30', text: 'text-signal', dot: 'bg-signal' },
  'funciones': { bg: 'bg-aqua/18', border: 'border-aqua/30', text: 'text-aqua', dot: 'bg-aqua' },
  'analisis': { bg: 'bg-graph/18', border: 'border-graph/30', text: 'text-graph', dot: 'bg-graph' },
  'geometria-trigonometria': { bg: 'bg-violet/18', border: 'border-violet/30', text: 'text-violet', dot: 'bg-violet' },
  'estadistica-probabilidad': { bg: 'bg-rose/18', border: 'border-rose/30', text: 'text-rose', dot: 'bg-rose' },
}

export const DerivaHomePage = () => {
  const availableLabs = labs.filter((lab) => lab.status === 'available')
  const activeUnits = units.filter((unit) => unit.status === 'active')
  const featuredLabs = (() => {
    const byUnit = activeUnits.map((u) => availableLabs.filter((l) => l.unitId === u.id))
    const cursors = byUnit.map(() => 0)
    const picked = []
    while (picked.length < 10) {
      let added = false
      for (let i = 0; i < byUnit.length; i++) {
        if (picked.length >= 10) break
        if (cursors[i] < byUnit[i].length) {
          picked.push(byUnit[i][cursors[i]])
          cursors[i]++
          added = true
        }
      }
      if (!added) break
    }
    return picked
  })()

  usePageMeta({
    title: 'MathModels Lab — Laboratorios interactivos de modelación matemática',
    description: 'Laboratorios interactivos de modelación matemática alineados con currículos internacionales de nivel medio y avanzado.',
    keywords: 'MathModels Lab, modelación matemática, currículos internacionales, nivel medio, nivel avanzado, simuladores, laboratorios interactivos',
    image: '/og-image.png',
  })

  return (
    <section className="px-5 pb-24 pt-10 md:px-8 md:pb-28 md:pt-14">
      <div className="mx-auto max-w-7xl">

        {/* ── HERO ── */}
        <motion.div {...fadeIn} className="grid items-center gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="section-kicker">MathModels Lab</p>
            <h1 className="mt-4 font-display text-[clamp(2.6rem,6vw,5.4rem)] font-bold leading-[0.92] tracking-[-0.04em]">
              Del fenómeno al modelo matemático.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/70">
              Laboratorios interactivos donde el estudiante parte de una situación real, formula preguntas, ajusta parámetros y construye el modelo que explica el fenómeno.
            </p>
            <p className="mt-4 font-display text-xl font-semibold tracking-[-0.02em] text-signal">
              Investiga. Modela. Justifica.
            </p>
          </div>
          <div className="hidden overflow-hidden rounded-[2rem] shadow-[0_24px_60px_rgba(18,23,35,0.15)] xl:block">
            <img
              src="/images/hero-students.png"
              alt="Estudiantes trabajando con laptops en un laboratorio de matemáticas"
              className="aspect-[3/4] w-full object-cover object-top"
              loading="eager"
            />
          </div>
        </motion.div>

        {/* ── ROLE CARDS ── */}
        <motion.div {...fadeIn} className="mt-10 grid gap-4 md:grid-cols-2">
          <Link
            to="/laboratorios"
            className="group rounded-[1.8rem] border border-aqua/20 bg-aqua/6 p-6 transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(80,150,255,0.12)]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-aqua/15 text-aqua">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
              </span>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">Soy estudiante</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink/65">
              Quiero explorar, practicar y entender mejor los temas de matemáticas de nivel medio y avanzado con simuladores interactivos.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-aqua transition-transform group-hover:translate-x-1">
              Ver laboratorios
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </span>
          </Link>

          <Link
            to="/secuencia"
            className="group rounded-[1.8rem] border border-graph/20 bg-graph/6 p-6 transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(34,197,160,0.12)]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-graph/15 text-graph">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </span>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">Soy docente</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink/65">
              Quiero preparar clases con simuladores alineados a programas internacionales y secuencias por unidad.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-graph transition-transform group-hover:translate-x-1">
              Ver secuencia por unidad
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </span>
          </Link>
        </motion.div>

        {/* ── FEATURED LABS GRID ── */}
        <motion.div {...fadeIn} className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">Laboratorios listos</p>
              <h2 className="mt-3 font-display text-[clamp(1.8rem,3.5vw,3rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
                Elige uno y empieza a explorar.
              </h2>
            </div>
            <Link
              to="/laboratorios"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink/30"
            >
              Ver los {availableLabs.length} laboratorios
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>

          <div className="relative mt-8">
            <div className="-mx-5 flex gap-5 overflow-x-auto px-5 pb-4 snap-x snap-mandatory scroll-smooth md:-mx-8 md:px-8" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(18,23,35,0.15) transparent' }}>
              {featuredLabs.map((lab) => {
                const unit = units.find((u) => u.id === lab.unitId)
                const colors = UNIT_COLORS[lab.unitId] || UNIT_COLORS['analisis']
                return (
                  <article
                    key={lab.id}
                    className="group w-[85vw] flex-none snap-start overflow-hidden rounded-[1.6rem] border border-ink/10 bg-white shadow-[0_8px_30px_rgba(18,23,35,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(18,23,35,0.1)] sm:w-[340px]"
                  >
                    <div className={`relative flex h-24 items-center justify-center ${colors.bg.replace('/18', '/28')}`}>
                      <div className="flex items-center gap-3 opacity-75">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={colors.text}>
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        <span className={`font-display text-lg font-bold ${colors.text}`}>{unit?.shortTitle || unit?.title}</span>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink/58">{unit?.title}</span>
                      </div>
                      <h3 className="mt-2 font-display text-xl font-semibold tracking-[-0.02em]">{lab.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/60">{lab.purpose}</p>
                      <Link
                        to={`/laboratorios/${lab.id}`}
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-signal transition-transform group-hover:translate-x-1"
                      >
                        Explorar
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
            <p className="mt-2 text-center text-xs text-ink/35">Desliza para ver más laboratorios</p>
          </div>
        </motion.div>

        {/* ── STUDENTS IMAGE BAND ── */}
        <motion.div {...fadeIn} className="mt-14 overflow-hidden rounded-[2rem] shadow-[0_20px_60px_rgba(18,23,35,0.1)]">
          <img
            src="/images/students-collab.png"
            alt="Estudiantes trabajando con tablets y gráficas en el aula"
            className="h-64 w-full object-cover object-[center_70%] md:h-80"
            loading="lazy"
          />
        </motion.div>

        {/* ── FOR TEACHERS ── */}
        <motion.div {...fadeIn} className="mt-14 overflow-hidden rounded-[2rem] border border-graph/15 bg-graph/5">
          <div className="grid xl:grid-cols-[1fr_0.5fr]">
          <div className="p-6 md:p-8">
          <p className="section-kicker text-graph">Para docentes</p>
          <h2 className="mt-3 max-w-3xl font-display text-[clamp(1.8rem,3.5vw,3rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
            Cada laboratorio incluye una guía de uso en clase.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.4rem] border border-graph/12 bg-white p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-graph/12 text-graph">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">Alineado con currículos internacionales</h3>
              <p className="mt-2 text-sm leading-6 text-ink/62">Cada lab se conecta con una unidad alineada con programas internacionales de matemáticas de nivel medio y avanzado.</p>
            </div>
            <div className="rounded-[1.4rem] border border-graph/12 bg-white p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-graph/12 text-graph">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">Secuencias por unidad</h3>
              <p className="mt-2 text-sm leading-6 text-ink/62">Las unidades tienen secuencias de aprendizaje que guían el orden natural de los laboratorios.</p>
            </div>
            <div className="rounded-[1.4rem] border border-graph/12 bg-white p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-graph/12 text-graph">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">Datos descargables</h3>
              <p className="mt-2 text-sm leading-6 text-ink/62">Los estudiantes pueden exportar tablas en CSV para seguir trabajando fuera de la plataforma.</p>
            </div>
          </div>
          <Link
            to="/secuencia"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-graph px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(34,197,160,0.2)]"
          >
            Ver secuencia completa
          </Link>
          </div>
          <div className="hidden xl:block">
            <img
              src="/images/teacher-student.jpg"
              alt="Docente y estudiantes analizando un simulador matemático"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          </div>
        </motion.div>

        {/* ── UNITS OVERVIEW ── */}
        <motion.div {...fadeIn} className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">Unidades</p>
              <h2 className="mt-3 font-display text-[clamp(1.8rem,3.5vw,3rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
                Organizado siguiendo el curso.
              </h2>
            </div>
            <Link to="/secuencia" className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-paper px-4 py-2.5 text-sm font-semibold text-ink">
              Ver secuencia
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {units.map((unit) => {
              const colors = UNIT_COLORS[unit.id] || UNIT_COLORS['analisis']
              const unitLabs = availableLabs.filter((l) => l.unitId === unit.id)
              return (
                <Link
                  key={unit.id}
                  to={`/unidades/${unit.id}`}
                  className={`group rounded-[1.6rem] border p-5 transition-all hover:-translate-y-1 ${colors.border} ${colors.bg}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">{unit.title}</h3>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-[0.65rem] uppercase tracking-[0.16em] ${colors.border} ${colors.bg} ${colors.text}`}>
                      {unitLabs.length} labs
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink/60">{unit.overview}</p>
                </Link>
              )
            })}
          </div>
        </motion.div>

        {/* ── EXPLORATIONS & MONOGRAPH ── */}
        <motion.div {...fadeIn} className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">Más allá del laboratorio</p>
              <h2 className="mt-3 font-display text-[clamp(1.8rem,3.5vw,3rem)] font-semibold leading-[0.98] tracking-[-0.04em]">
                Del lab breve a la investigación extensa.
              </h2>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <Link
              to="/exploraciones/bloque-1"
              className="group rounded-[1.8rem] border border-signal/15 bg-signal/5 p-6 transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(255,107,53,0.1)]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-signal/15 text-signal">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </span>
                <div>
                  <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">Exploración matemática</h3>
                  <span className="rounded-full bg-signal/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-signal">Disponible</span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-ink/68">
                Pasa del laboratorio breve a una investigación más extensa: formula una pregunta, justifica supuestos, contrasta modelos y discute los límites de tu resultado.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-signal transition-transform group-hover:translate-x-1">
                Abrir exploración
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </span>
            </Link>

            <Link
              to="/monografias"
              className="group rounded-[1.8rem] border border-violet/20 bg-violet/6 p-6 transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(139,92,246,0.12)]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet/15 text-violet">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
                  </svg>
                </span>
                <div>
                  <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">Monografía IB</h3>
                  <span className="rounded-full bg-violet/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-violet">Disponible</span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-ink/68">
                Simulaciones con datos reales, planeación guiada desde los dos itinerarios, criterios A–E y propuestas interdisciplinarias con asignaturas del DP.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet transition-transform group-hover:translate-x-1">
                Explorar monografía
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </span>
            </Link>
          </div>
        </motion.div>

        {/* ── MODELING SPACE HIGHLIGHT ── */}
        <motion.div {...fadeIn} className="mt-14 overflow-hidden rounded-[2rem] border border-ink/12 bg-ink text-paper shadow-[0_28px_80px_rgba(18,23,35,0.25)]">
          <div className="grid xl:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 md:p-8 lg:p-10">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-signal">Espacio de modelación</p>
              <h2 className="mt-4 font-display text-[clamp(1.8rem,3.5vw,3rem)] font-bold leading-[0.96] tracking-[-0.04em]">
                Del dato al modelo: ajusta, compara y justifica.
              </h2>
              <p className="mt-5 text-base leading-8 text-paper/70">
                Carga datos reales, compara familias de funciones, ajusta parámetros y decide cuál modelo describe mejor el fenómeno. No basta con encontrar la curva — hay que justificar por qué.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: 'Datos reales', icon: 'M3 3v18h18' },
                  { label: 'Múltiples modelos', icon: 'M4 20C8 12 12 4 20 4' },
                  { label: 'Residuales', icon: 'M2 12h20M7 7v10M12 5v14M17 8v8' },
                  { label: 'Exportar PDF', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' },
                ].map((feat) => (
                  <div key={feat.label} className="rounded-xl border border-white/10 bg-white/6 px-3 py-3 text-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mx-auto text-signal">
                      <path d={feat.icon} />
                    </svg>
                    <p className="mt-2 text-[0.68rem] font-semibold text-paper/60">{feat.label}</p>
                  </div>
                ))}
              </div>
              <Link
                to="/modelacion"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-signal px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(255,107,53,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(255,107,53,0.4)]"
              >
                Abrir espacio de modelación
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            </div>
            <div className="hidden items-center justify-center bg-gradient-to-br from-signal/8 to-ink p-8 xl:flex">
              <div className="w-full max-w-sm space-y-1.5">
                <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-paper/35">Flujo de trabajo</p>
                {[
                  { step: '1', label: 'Elige un conjunto de datos', sub: 'Contextos reales listos para explorar' },
                  { step: '2', label: 'Compara familias de funciones', sub: 'Lineal, cuadrática, exponencial, trigonométrica' },
                  { step: '3', label: 'Ajusta parámetros', sub: 'Deslizadores interactivos con feedback visual' },
                  { step: '4', label: 'Evalúa el ajuste', sub: 'Residuales, error cuadrático, R²' },
                  { step: '5', label: 'Exporta tu análisis', sub: 'PDF con gráficos, datos y reflexión' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/4 px-4 py-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-signal/20 text-[0.65rem] font-bold text-signal">
                      {item.step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-paper/85">{item.label}</p>
                      <p className="text-[0.7rem] leading-4 text-paper/40">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── ABOUT SECTION — compact ── */}
        <div className="mt-20 border-t border-ink/8 pt-14">

        <motion.div {...fadeIn} className="overflow-hidden rounded-[2rem] border border-ink/12 bg-paper shadow-[0_12px_35px_rgba(18,23,35,0.08)]">
          <div className="grid md:grid-cols-[1fr_auto]">
            <div className="p-6 md:p-8">
              <p className="section-kicker">Dirección y autoría</p>
              <h2 className="mt-3 font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
                Astrid Torregroza Olivero
              </h2>
              <p className="mt-2 text-sm leading-7 text-ink/65">
                Licenciada en Matemáticas y Física. Concepto, dirección pedagógica y visión de MathModels Lab.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a href="https://www.linkedin.com/in/astrid-torregroza/" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-ink/5 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink/10">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[#0A66C2]"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    LinkedIn
                  </a>
                  <a href="https://portafolio.astridto.com/" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-ink/5 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink/10">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-graph">
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                    </svg>
                    Portafolio
                  </a>
              </div>
            </div>
            <div className="flex items-center px-8 pb-6 md:pb-8 md:pt-8">
              <div className="space-y-2 text-right">
                <p className="text-sm font-semibold text-ink/70">Modelación matemática escolar</p>
                <p className="text-sm font-semibold text-ink/70">IA aplicada a la educación</p>
              </div>
            </div>
          </div>
        </motion.div>

        </div>
      </div>
    </section>
  )
}

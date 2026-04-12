import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { monografiaContent } from '../data/platformContent'
import { Breadcrumb } from '../components/layout/PlatformShell'

const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.55, ease: 'easeOut' } }
const slideUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }
const stagger = { animate: { transition: { staggerChildren: 0.07 } } }

/* ── SVG Icons ── */
const Icon = ({ d, className = '', size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{typeof d === 'string' ? <path d={d} /> : d}</svg>
)
const MicroscopeIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="9" r="2"/><path d="M12 11v4M8 21h8M10 21l1-4M14 21l-1-4M12 3v4M7 5h10"/></>} />
const GlobeIcon = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></>} />
const RouteIcon = (p) => <Icon {...p} d={<><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15"/><circle cx="18" cy="5" r="3"/></>} />
const SparkleIcon = (p) => <Icon {...p} d={<><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M19 17l.5 1.5L21 19l-1.5.5L19 21l-.5-1.5L17 19l1.5-.5z"/></>} />
const ChevronDown = (p) => <Icon {...p} size={18} d="M6 9l6 6 6-6" />
const ArrowRight = ({ className }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={className}><path d="M5 12h14M12 5l7 7-7 7"/></svg>

const CRITERIO_COLORS = {
  A: { bg: 'bg-aqua/12', border: 'border-aqua/25', text: 'text-aqua', badge: 'bg-aqua', shadow: 'hover:shadow-[0_12px_30px_rgba(80,150,255,0.12)]' },
  B: { bg: 'bg-graph/12', border: 'border-graph/25', text: 'text-graph', badge: 'bg-graph', shadow: 'hover:shadow-[0_12px_30px_rgba(34,197,160,0.12)]' },
  C: { bg: 'bg-signal/12', border: 'border-signal/25', text: 'text-signal', badge: 'bg-signal', shadow: 'hover:shadow-[0_12px_30px_rgba(255,107,53,0.1)]' },
  D: { bg: 'bg-rose/12', border: 'border-rose/25', text: 'text-rose', badge: 'bg-rose', shadow: 'hover:shadow-[0_12px_30px_rgba(244,63,94,0.12)]' },
  E: { bg: 'bg-violet/12', border: 'border-violet/25', text: 'text-violet', badge: 'bg-violet', shadow: 'hover:shadow-[0_12px_30px_rgba(139,92,246,0.12)]' },
}

function CriterioCard({ criterio, isOpen, onToggle }) {
  const c = CRITERIO_COLORS[criterio.id] || CRITERIO_COLORS.A
  return (
    <motion.div
      layout
      onClick={onToggle}
      className={`rounded-[1.2rem] border transition-all cursor-pointer overflow-hidden ${
        isOpen ? `${c.border} ${c.bg} shadow-lg` : `border-ink/10 hover:border-ink/20 ${c.shadow}`
      }`}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className={`flex items-center justify-center w-11 h-11 rounded-xl ${c.badge} font-display text-lg font-bold text-white`}>
              {criterio.id}
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">{criterio.title}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-ink/50">{criterio.puntos} puntos</span>
                {criterio.isHeaviest && (
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] bg-rose/15 text-rose px-2 py-0.5 rounded-full">
                    Criterio clave
                  </span>
                )}
              </div>
            </div>
          </div>
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="text-ink/30">
            <ChevronDown />
          </motion.div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink/55">{criterio.descripcion}</p>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4 border-t border-ink/8 pt-4">
              <div className="space-y-2">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink/40">Preguntas clave para Matemáticas</p>
                {criterio.preguntas.map((q, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm text-ink/60">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${c.badge} shrink-0`} />
                    <span>{q}</span>
                  </div>
                ))}
              </div>
              <div className={`text-sm p-4 rounded-xl ${c.bg}`} style={{ borderLeft: '3px solid' }}>
                <span className={`font-semibold ${c.text}`}>Tip: </span>
                <span className="text-ink/60">{criterio.tip}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PuntuacionBar() {
  const { criterios } = monografiaContent
  const total = criterios.reduce((s, c) => s + c.puntos, 0)
  return (
    <div className="flex items-center gap-1.5">
      {criterios.map(c => {
        const col = CRITERIO_COLORS[c.id]
        return (
          <div key={c.id} className="flex flex-col items-center gap-1" style={{ width: `${(c.puntos / total) * 100}%` }}>
            <div className={`w-full h-1.5 rounded-full ${col.badge} opacity-40`} />
            <span className={`text-[0.65rem] font-semibold ${col.text} opacity-70`}>{c.id} · {c.puntos}</span>
          </div>
        )
      })}
    </div>
  )
}

export function MonografiaPage() {
  const [openCriterio, setOpenCriterio] = useState(null)
  const [selectedItinerario, setSelectedItinerario] = useState(null)
  const [openMarco, setOpenMarco] = useState(null)
  const { hero, itinerarios, criterios, marcos, simulaciones, proceso } = monografiaContent

  return (
    <section className="px-5 pb-24 pt-8 md:px-8 md:pb-28 md:pt-10">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Monografía IB' }]} />

        {/* ══ HERO ══ */}
        <motion.div {...fadeIn} className="mt-8 text-center">
          <p className="section-kicker">Monografía IB &middot; Primera evaluación 2027</p>
          <h1 className="mt-4 font-display text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[0.94] tracking-[-0.04em]">
            {hero.title}
          </h1>
          <p className="mt-4 font-display text-xl font-medium tracking-[-0.02em] text-signal">
            {hero.tagline}
          </p>
          <p className="mt-4 mx-auto max-w-2xl text-base leading-7 text-ink/60">
            {hero.description}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-signal/10 px-5 py-2.5 text-sm font-semibold text-signal">
            <SparkleIcon size={16} />
            {hero.highlight}
          </div>
        </motion.div>

        {/* ══ PROCESO ══ */}
        <motion.div {...fadeIn} className="mt-16">
          <p className="section-kicker">El camino</p>
          <h2 className="mt-3 font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[0.98] tracking-[-0.03em]">
            6 pasos hacia tu monografía.
          </h2>
          <motion.div {...stagger} className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            {proceso.map(p => (
              <motion.div key={p.paso} {...slideUp}
                className="rounded-[1.4rem] border border-ink/8 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(18,23,35,0.06)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal/12 font-display text-sm font-bold text-signal">{p.paso}</span>
                  <h3 className="font-display text-sm font-semibold tracking-[-0.01em]">{p.titulo}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink/55">{p.descripcion}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* ══ ITINERARIOS ══ */}
        <motion.div {...fadeIn} className="mt-16">
          <p className="section-kicker">Itinerarios</p>
          <h2 className="mt-3 font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[0.98] tracking-[-0.03em]">
            Elige tu camino.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink/55">
            El primer paso es decidir si tu monografía se centra en una asignatura o es interdisciplinaria.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {itinerarios.map((it, idx) => {
              const isDisc = it.id === 'disciplinar'
              const colorClass = isDisc ? 'aqua' : 'violet'
              const isActive = selectedItinerario === it.id
              return (
                <div key={it.id}
                  onClick={() => setSelectedItinerario(isActive ? null : it.id)}
                  className={`group cursor-pointer rounded-[1.6rem] border p-6 transition-all ${
                    isActive
                      ? `border-${colorClass}/30 bg-${colorClass}/6 shadow-lg`
                      : `border-ink/10 bg-white hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(${isDisc ? '80,150,255' : '139,92,246'},0.1)]`
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-${colorClass}/15 text-${colorClass}`}>
                        {isDisc ? <MicroscopeIcon /> : <GlobeIcon />}
                      </span>
                      <div>
                        <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">{it.title}</h3>
                        <p className={`mt-1 text-sm font-medium text-${colorClass}`}>{it.subtitle}</p>
                        <p className="mt-3 text-sm leading-relaxed text-ink/60">{it.description}</p>
                        {it.nota && (
                          <p className={`mt-3 rounded-xl bg-${colorClass}/8 px-4 py-2.5 text-sm leading-relaxed text-${colorClass}`}>
                            {it.nota}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
                      <motion.div animate={{ rotate: isActive ? 180 : 0 }} className="text-ink/25">
                        <ChevronDown />
                      </motion.div>
                      {!isActive && <span className="text-[0.65rem] font-medium text-ink/30">Ejemplos</span>}
                    </div>
                  </div>
                  <AnimatePresence>
                    {isActive && it.ejemplos && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                        <div className="mt-4 border-t border-ink/8 pt-4 space-y-2.5">
                          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink/40">Ideas de preguntas de investigación</p>
                          {it.ejemplos.map((ej, i) => (
                            <div key={i} className="flex items-start gap-2.5 text-sm text-ink/55">
                              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full bg-${colorClass} shrink-0`} />
                              <span className="italic leading-relaxed">{ej}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ══ MARCOS INTERDISCIPLINARIOS ══ */}
        <motion.div {...fadeIn} className="mt-16">
          <p className="section-kicker">Marcos interdisciplinarios</p>
          <h2 className="mt-3 font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[0.98] tracking-[-0.03em]">
            El lente para tu investigación.
          </h2>

          <div className="mt-6 rounded-[1.4rem] border border-violet/20 bg-violet/5 p-5 text-center">
            <p className="text-sm text-violet leading-relaxed">
              <span className="font-semibold">Solo aplica al itinerario interdisciplinario.</span> Si tu monografía se centra en una sola asignatura, no necesitas elegir un marco.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-graph/20 bg-graph/5 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-graph/15 text-graph">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                </span>
                <h3 className="font-display text-sm font-semibold text-graph">Qué ES un marco</h3>
              </div>
              <p className="text-sm leading-relaxed text-ink/60">{monografiaContent.marcosInfo.queEs}</p>
            </div>
            <div className="rounded-[1.4rem] border border-signal/20 bg-signal/5 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal/15 text-signal">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </span>
                <h3 className="font-display text-sm font-semibold text-signal">Qué NO es un marco</h3>
              </div>
              <p className="text-sm leading-relaxed text-ink/60">{monografiaContent.marcosInfo.queNoEs}</p>
            </div>
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-aqua/20 bg-aqua/5 p-5">
            <p className="text-sm text-ink/60 leading-relaxed">
              <span className="font-semibold text-aqua">Importante:</span> {monografiaContent.marcosInfo.importante}
            </p>
          </div>

          <div className="mt-6 rounded-[1.4rem] border border-ink/10 bg-white p-6 space-y-4">
            <h3 className="font-display text-base font-semibold tracking-[-0.02em]">Secuencia si eliges interdisciplinario</h3>
            <div className="space-y-3">
              {monografiaContent.marcosInfo.secuencia.map((paso, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-ink/60">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet/12 text-[0.65rem] font-bold text-violet">{i + 1}</span>
                  <span className="leading-relaxed">{paso}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-rose/8 p-4">
              <p className="text-sm text-rose leading-relaxed">
                <span className="font-semibold">Prueba de integración:</span> {monografiaContent.marcosInfo.pruebaIntegracion}
              </p>
            </div>
          </div>

          <h3 className="mt-8 font-display text-lg font-semibold tracking-[-0.02em]">Los 5 marcos del IB</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {marcos.map(m => {
              const isOpen = openMarco === m.id
              return (
                <div key={m.id}
                  onClick={() => setOpenMarco(isOpen ? null : m.id)}
                  className={`cursor-pointer rounded-[1.4rem] border p-5 transition-all ${
                    isOpen ? 'border-violet/30 bg-violet/5 shadow-lg' : 'border-ink/10 bg-white hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(139,92,246,0.08)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/12 text-lg">{m.emoji}</span>
                      <h4 className="font-display text-sm font-semibold tracking-[-0.01em]">{m.titulo}</h4>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-0.5">
                      <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="text-ink/25"><ChevronDown /></motion.div>
                      {!isOpen && <span className="text-[0.6rem] text-ink/30">Ejemplos</span>}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink/55">{m.descripcion}</p>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                        <div className="mt-3 border-t border-ink/8 pt-3 space-y-2">
                          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink/35">Preguntas ejemplo</p>
                          {m.ejemplosRQ.map((ej, i) => (
                            <div key={i} className="text-sm leading-relaxed">
                              <span className="text-ink/55 italic">{ej.rq}</span>
                              <span className="ml-1.5 text-xs font-semibold text-violet">{ej.asignaturas}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ══ CRITERIOS ══ */}
        <motion.div {...fadeIn} className="mt-16">
          <p className="section-kicker">Evaluación</p>
          <h2 className="mt-3 font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[0.98] tracking-[-0.03em]">
            30 puntos. 5 criterios.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink/55">
            Haz clic en cada criterio para ver qué se evalúa y cómo puedes fortalecerlo.
          </p>
          <div className="mt-6">
            <PuntuacionBar />
          </div>
          <div className="mt-6 space-y-3">
            {criterios.map(c => (
              <CriterioCard key={c.id} criterio={c} isOpen={openCriterio === c.id}
                onToggle={() => setOpenCriterio(openCriterio === c.id ? null : c.id)} />
            ))}
          </div>
        </motion.div>

        {/* ══ LABORATORIO ══ */}
        <motion.div {...fadeIn} className="mt-16">
          <p className="section-kicker">Laboratorio de monografía</p>
          <h2 className="mt-3 font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[0.98] tracking-[-0.03em]">
            Explora, modela y compara.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/55">
            Cada tema incluye simulación interactiva, planeación inicial desde los dos itinerarios, ejemplos de cómo abordar cada criterio, y propuestas interdisciplinarias con asignaturas del DP.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {simulaciones.map(sim => (
              <Link key={sim.id} to={`/monografias/${sim.id}`}
                className="group rounded-[1.6rem] border border-signal/20 bg-signal/4 p-6 transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(255,107,53,0.1)]"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-signal/15 text-2xl">
                    🎡
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold tracking-[-0.02em] group-hover:text-signal transition-colors">{sim.titulo}</h3>
                    <p className="text-sm text-ink/50">{sim.subtitulo}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-ink/60">{sim.descripcion}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {sim.temas.map((t, i) => (
                    <span key={i} className="rounded-full bg-signal/10 px-3 py-1 text-xs font-medium text-signal/80">{t}</span>
                  ))}
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-signal transition-transform group-hover:translate-x-1">
                  Explorar simulación y planeación
                  <ArrowRight />
                </span>
              </Link>
            ))}
            <div className="flex items-center justify-center rounded-[1.6rem] border-2 border-dashed border-ink/12 p-6">
              <div className="text-center space-y-2">
                <span className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-ink/5 text-ink/25">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                </span>
                <p className="text-sm text-ink/35">Más temas próximamente</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ══ FOOTER ══ */}
        <div className="mt-16 text-center">
          <p className="text-xs text-ink/30">
            Basado en la Guía de Monografía IB — Primera evaluación 2027
          </p>
        </div>
      </div>
    </section>
  )
}

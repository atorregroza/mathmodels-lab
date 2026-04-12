import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { monografiaContent } from '../data/platformContent'
import { Breadcrumb } from '../components/layout/PlatformShell'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' },
}

function CriterioCard({ criterio, isOpen, onToggle }) {
  return (
    <motion.div
      layout
      className={`rounded-xl border-2 transition-colors cursor-pointer overflow-hidden ${
        isOpen ? 'border-opacity-100 shadow-lg' : 'border-opacity-30 hover:border-opacity-60'
      }`}
      style={{ borderColor: criterio.color }}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center w-10 h-10 rounded-lg font-bold text-white text-lg"
            style={{ backgroundColor: criterio.color }}
          >
            {criterio.id}
          </span>
          <div>
            <h3 className="font-semibold text-gray-800">{criterio.title}</h3>
            <span className="text-xs text-gray-500">{criterio.puntos} puntos</span>
            {criterio.isHeaviest && (
              <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                Criterio clave
              </span>
            )}
          </div>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="text-gray-400 text-lg"
        >
          &#9660;
        </motion.span>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-gray-600">{criterio.descripcion}</p>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preguntas clave</p>
                {criterio.preguntas.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-gray-400 mt-0.5">&#10132;</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>
              <div
                className="text-sm p-3 rounded-lg"
                style={{ backgroundColor: criterio.color + '10', borderLeft: `3px solid ${criterio.color}` }}
              >
                <span className="font-medium" style={{ color: criterio.color }}>Tip: </span>
                <span className="text-gray-600">{criterio.tip}</span>
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
    <div className="flex rounded-full overflow-hidden h-4 bg-gray-100">
      {criterios.map(c => (
        <div
          key={c.id}
          className="flex items-center justify-center text-[9px] font-bold text-white"
          style={{ backgroundColor: c.color, width: `${(c.puntos / total) * 100}%` }}
          title={`${c.id}: ${c.title} (${c.puntos} pts)`}
        >
          {c.id}
        </div>
      ))}
    </div>
  )
}

export function MonografiaPage() {
  const [openCriterio, setOpenCriterio] = useState(null)
  const [selectedItinerario, setSelectedItinerario] = useState(null)
  const { hero, itinerarios, criterios, marcos, simulaciones, proceso } = monografiaContent

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-10">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Monografía IB' }]} />

      {/* ===== HERO ===== */}
      <motion.section {...fadeIn} className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full">
          <span>&#128218;</span> Marco 2027
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800">{hero.title}</h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">{hero.tagline}</p>
        <p className="text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">{hero.description}</p>
        <div className="flex justify-center">
          <span className="bg-gray-100 text-gray-600 text-xs font-medium px-4 py-2 rounded-lg">
            {hero.highlight}
          </span>
        </div>
      </motion.section>

      {/* ===== PROCESO (PASOS) ===== */}
      <motion.section {...fadeIn} className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800 text-center">El camino en 6 pasos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {proceso.map(p => (
            <div key={p.paso} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{p.paso}</span>
                <h3 className="font-semibold text-gray-800 text-sm">{p.titulo}</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{p.descripcion}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ===== ITINERARIOS ===== */}
      <motion.section {...fadeIn} className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800 text-center">Elige tu itinerario</h2>
        <p className="text-sm text-gray-500 text-center max-w-lg mx-auto">
          El primer paso es decidir si tu monografía se centra en una asignatura o es interdisciplinaria.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {itinerarios.map(it => (
            <div
              key={it.id}
              onClick={() => setSelectedItinerario(selectedItinerario === it.id ? null : it.id)}
              className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${
                selectedItinerario === it.id
                  ? 'shadow-lg scale-[1.01]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={selectedItinerario === it.id ? { borderColor: it.color } : {}}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{it.emoji}</span>
                  <div className="space-y-2">
                    <h3 className="font-bold text-gray-800">{it.title}</h3>
                    <p className="text-xs font-medium" style={{ color: it.color }}>{it.subtitle}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{it.description}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                  <motion.span
                    animate={{ rotate: selectedItinerario === it.id ? 180 : 0 }}
                    className="text-gray-400 text-lg"
                  >&#9660;</motion.span>
                  <span className="text-[9px] text-gray-400">
                    {selectedItinerario === it.id ? '' : 'Ver ejemplos'}
                  </span>
                </div>
              </div>
              <AnimatePresence>
                {selectedItinerario === it.id && it.ejemplos && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ideas de preguntas de investigación</p>
                      {it.ejemplos.map((ej, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-gray-300 mt-0.5 shrink-0">&#10132;</span>
                          <span className="italic">{ej}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ===== MARCOS INTERDISCIPLINARIOS (siempre visible) ===== */}
      <motion.section {...fadeIn} className="space-y-6">
        <h2 className="text-xl font-bold text-gray-800 text-center">Los marcos interdisciplinarios</h2>
        <p className="text-sm text-gray-500 text-center max-w-xl mx-auto">
          Este es uno de los conceptos que más confusión genera en la nueva guía. Vamos a aclararlo.
        </p>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
          <p className="text-sm text-purple-700">
            <span className="font-bold">&#128276; Solo aplica al itinerario interdisciplinario.</span> Si tu monografía se centra en una sola asignatura, no necesitas elegir un marco.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-emerald-800 text-sm flex items-center gap-2">
              <span>&#10004;</span> Qué ES un marco
            </h3>
            <p className="text-sm text-emerald-700 leading-relaxed">{monografiaContent.marcosInfo.queEs}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-amber-800 text-sm flex items-center gap-2">
              <span>&#10008;</span> Qué NO es un marco
            </h3>
            <p className="text-sm text-amber-700 leading-relaxed">{monografiaContent.marcosInfo.queNoEs}</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-700 leading-relaxed">
            <span className="font-bold">&#9432; Importante:</span> {monografiaContent.marcosInfo.importante}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm">Secuencia si eliges interdisciplinario</h3>
          <div className="space-y-2">
            {monografiaContent.marcosInfo.secuencia.map((paso, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-gray-600">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                <span>{paso}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700">
              <span className="font-bold">&#9888; Prueba de integración:</span> {monografiaContent.marcosInfo.pruebaIntegracion}
            </p>
          </div>
        </div>

        <h3 className="font-bold text-gray-800 text-center">Los 5 marcos del IB</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {marcos.map(m => (
            <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{m.emoji}</span>
                <h4 className="font-semibold text-sm text-gray-800">{m.titulo}</h4>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{m.descripcion}</p>
              <div className="pt-2 border-t border-gray-100 space-y-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Preguntas ejemplo</p>
                {m.ejemplosRQ.map((rq, i) => (
                  <p key={i} className="text-xs text-gray-600 italic leading-relaxed">&#10132; {rq}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ===== CRITERIOS ===== */}
      <motion.section {...fadeIn} className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800 text-center">Criterios de evaluación</h2>
        <p className="text-sm text-gray-500 text-center max-w-lg mx-auto">
          30 puntos distribuidos en 5 criterios. Haz clic en cada uno para ver qué se evalúa.
        </p>
        <PuntuacionBar />
        <div className="space-y-3">
          {criterios.map(c => (
            <CriterioCard
              key={c.id}
              criterio={c}
              isOpen={openCriterio === c.id}
              onToggle={() => setOpenCriterio(openCriterio === c.id ? null : c.id)}
            />
          ))}
        </div>
      </motion.section>

      {/* ===== SIMULACIONES ===== */}
      <motion.section {...fadeIn} className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800 text-center">Simulaciones interactivas</h2>
        <p className="text-sm text-gray-500 text-center max-w-lg mx-auto">
          Herramientas para explorar, recolectar datos y visualizar modelos. Cada simulación está diseñada para alimentar tu monografía.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {simulaciones.map(sim => (
            <Link
              key={sim.id}
              to={`/monografias/${sim.id}`}
              className="group bg-white border border-gray-200 rounded-xl p-5 space-y-3 shadow-sm hover:shadow-lg transition-all hover:border-amber-300"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{sim.emoji}</span>
                <div>
                  <h3 className="font-bold text-gray-800 group-hover:text-amber-600 transition-colors">{sim.titulo}</h3>
                  <p className="text-xs text-gray-500">{sim.subtitulo}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{sim.descripcion}</p>
              <div className="flex flex-wrap gap-1.5">
                {sim.temas.map((t, i) => (
                  <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
              <div className="text-xs text-amber-600 font-medium group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Abrir simulación &#8594;
              </div>
            </Link>
          ))}
          {/* Placeholder para futuras simulaciones */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex items-center justify-center text-gray-400">
            <div className="text-center space-y-1">
              <span className="text-2xl">&#43;</span>
              <p className="text-xs">Más simulaciones próximamente</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ===== FOOTER ===== */}
      <div className="text-center text-xs text-gray-400 pb-8">
        Basado en la Guía de Monografía IB — Marco 2027
      </div>
    </div>
  )
}

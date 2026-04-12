import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, Navigate, useParams } from 'react-router-dom'
import { monografiaContent } from '../data/platformContent'
import { Breadcrumb } from '../components/layout/PlatformShell'

function PlanPanel({ planeacion, open, setOpen }) {
  const [tab, setTab] = useState('disciplinar')
  const disc = planeacion.disciplinar
  const inter = planeacion.interdisciplinario

  return (
    <div className={`border-b-2 ${open ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${open ? 'hover:bg-amber-50' : 'hover:bg-gray-50 bg-gradient-to-r from-amber-50 to-white'}`}
      >
        <span className={`font-bold flex items-center gap-2 ${open ? 'text-amber-700 text-sm' : 'text-amber-600'}`}>
          <span className="text-lg">&#128203;</span>
          {open ? 'Planeación inicial de monografía' : 'Planeación inicial de monografía — clic para ver cómo usar esta simulación en tu monografía'}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-amber-500 text-sm">&#9660;</motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setTab('disciplinar')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === 'disciplinar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🔬 Centrado en una asignatura
                </button>
                <button
                  onClick={() => setTab('interdisciplinario')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === 'interdisciplinario' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🌐 Interdisciplinario
                </button>
              </div>

              {/* Disciplinar */}
              {tab === 'disciplinar' && (
                <div className="space-y-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-sm text-gray-400 font-semibold uppercase tracking-wide mb-2">Pregunta de investigación</p>
                    <p className="text-base text-gray-700 italic leading-relaxed">{disc.rq}</p>
                  </div>

                  {disc.tension && (
                    <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl p-4">
                      <p className="text-sm text-amber-600 font-semibold mb-1">Por qué esta pregunta puede llegar a A</p>
                      <p className="text-base text-amber-800 leading-relaxed">{disc.tension}</p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Modelos matemáticos</p>
                      {disc.modelos.map((m, i) => (
                        <p key={i} className="text-sm text-gray-600 font-mono bg-gray-50 px-3 py-1.5 rounded">{m}</p>
                      ))}
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Datos de la simulación</p>
                      {disc.datosSimulacion.map((d, i) => (
                        <p key={i} className="text-sm text-gray-600 flex items-start gap-1.5"><span className="text-green-500 shrink-0">&#10004;</span>{d}</p>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Cómo alimentar cada criterio</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(disc.criterios).map(([k, v]) => (
                        <div key={k} className="bg-gray-50 rounded-lg p-3">
                          <span className="text-sm font-bold text-gray-800">Criterio {k}</span>
                          <p className="text-sm text-gray-600 leading-relaxed mt-1">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Interdisciplinario */}
              {tab === 'interdisciplinario' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    La misma simulación puede abordarse desde distintos marcos con diferentes asignaturas del DP. Cada enfoque produce una monografía completamente diferente.
                  </p>
                  {inter.map((opcion, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{opcion.marcoEmoji}</span>
                          <div>
                            <p className="text-sm text-gray-500 font-medium">{opcion.marco}</p>
                            <p className="text-base font-bold text-gray-800">Mat + {opcion.asignatura}</p>
                          </div>
                        </div>
                        <span className="text-sm bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-medium">Opción {idx + 1}</span>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-400 font-semibold uppercase mb-1">Pregunta de investigación</p>
                        <p className="text-base text-gray-700 italic leading-relaxed">{opcion.rq}</p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-500 font-semibold uppercase mb-1">Aporta Matemáticas</p>
                          <p className="text-sm text-gray-600 leading-relaxed">{opcion.integra.matematicas}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-500 font-semibold uppercase mb-1">Aporta {opcion.asignatura}</p>
                          <p className="text-sm text-gray-600 leading-relaxed">{opcion.integra.otraAsignatura}</p>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3" style={{ borderLeftWidth: '3px', borderLeftColor: '#d1d5db', borderLeftStyle: 'solid' }}>
                        <p className="text-sm text-gray-500 font-semibold uppercase mb-1">Criterio D — doble lente</p>
                        <p className="text-sm text-gray-600 leading-relaxed">{opcion.criterioD}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function MonografiaSimPage() {
  const { simId } = useParams()
  const sim = monografiaContent.simulaciones.find(s => s.id === simId)
  const [planOpen, setPlanOpen] = useState(false)

  if (!sim) return <Navigate to="/monografias" replace />

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="px-3 py-2 border-b border-ink/8 bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/monografias"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink/5 hover:bg-signal/10 text-ink/60 hover:text-signal text-xs font-medium transition-colors shrink-0"
          >
            <span>&#8592;</span> Volver
          </Link>
          <Breadcrumb items={[
            { label: 'Monografía IB', to: '/monografias' },
            { label: sim.titulo },
          ]} />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setPlanOpen(!planOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              planOpen ? 'bg-signal text-white' : 'bg-signal/10 text-signal hover:bg-signal/20'
            }`}
          >
            <span>&#128203;</span> {planOpen ? 'Ver simulación' : 'Ver planeación'}
          </button>
        </div>
      </div>

      {sim.planeacion && planOpen && <PlanPanel planeacion={sim.planeacion} open={planOpen} setOpen={setPlanOpen} />}

      {!planOpen && (
        <iframe
          src={sim.ruta}
          className="flex-1 w-full border-0"
          title={sim.titulo}
        />
      )}
    </div>
  )
}

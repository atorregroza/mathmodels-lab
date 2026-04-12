import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, Navigate, useParams } from 'react-router-dom'
import { monografiaContent } from '../data/platformContent'
import { Breadcrumb } from '../components/layout/PlatformShell'

function PlanPanel({ planeacion }) {
  const [tab, setTab] = useState('disciplinar')
  const [open, setOpen] = useState(true)
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
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">Pregunta de investigación</p>
                    <p className="text-sm text-blue-800 italic leading-relaxed">{disc.rq}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Modelos matemáticos</p>
                      {disc.modelos.map((m, i) => (
                        <p key={i} className="text-xs text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">{m}</p>
                      ))}
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos de la simulación</p>
                      {disc.datosSimulacion.map((d, i) => (
                        <p key={i} className="text-xs text-gray-600 flex items-start gap-1.5"><span className="text-green-500 shrink-0">&#10004;</span>{d}</p>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cómo alimentar cada criterio</p>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      {Object.entries(disc.criterios).map(([k, v]) => (
                        <div key={k} className="bg-gray-50 rounded-lg p-2">
                          <span className="text-xs font-bold text-gray-800">{k}:</span>
                          <p className="text-[10px] text-gray-600 leading-relaxed mt-0.5">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Interdisciplinario */}
              {tab === 'interdisciplinario' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    La misma simulación puede abordarse desde distintos marcos con diferentes asignaturas del DP. Cada enfoque produce una monografía completamente diferente.
                  </p>
                  {inter.map((opcion, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{opcion.marcoEmoji}</span>
                          <div>
                            <p className="text-xs text-gray-500 font-medium">{opcion.marco}</p>
                            <p className="text-sm font-bold text-gray-800">Mat + {opcion.asignatura}</p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Opción {idx + 1}</span>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1">Pregunta de investigación</p>
                        <p className="text-sm text-gray-700 italic leading-relaxed">{opcion.rq}</p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="bg-gray-50 rounded-lg p-2.5">
                          <p className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Aporta Matemáticas</p>
                          <p className="text-xs text-gray-600 leading-relaxed">{opcion.integra.matematicas}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2.5">
                          <p className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Aporta {opcion.asignatura}</p>
                          <p className="text-xs text-gray-600 leading-relaxed">{opcion.integra.otraAsignatura}</p>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-2.5 border-l-3 border-gray-300" style={{ borderLeftWidth: '3px' }}>
                        <p className="text-[10px] text-gray-500 font-semibold uppercase mb-1">Criterio D — doble lente</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{opcion.criterioD}</p>
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

  if (!sim) return <Navigate to="/monografias" replace />

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="px-3 py-2 border-b border-gray-100 bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/monografias"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-amber-100 text-gray-600 hover:text-amber-700 text-xs font-medium transition-colors shrink-0"
          >
            <span>&#8592;</span> Volver a Monografía
          </Link>
          <Breadcrumb items={[
            { label: 'Monografía IB', to: '/monografias' },
            { label: sim.titulo },
          ]} />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
          <span>{sim.emoji}</span>
          <span className="hidden sm:inline">{sim.subtitulo}</span>
        </div>
      </div>

      {sim.planeacion && <PlanPanel planeacion={sim.planeacion} />}

      <iframe
        src={sim.ruta}
        className="flex-1 w-full border-0"
        title={sim.titulo}
      />
    </div>
  )
}

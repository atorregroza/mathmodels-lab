import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, Navigate, useParams } from 'react-router-dom'
import { monografiaContent } from '../data/platformContent'
import { Breadcrumb } from '../components/layout/PlatformShell'

function PlanContent({ planeacion }) {
  const [tab, setTab] = useState('disciplinar')
  const disc = planeacion.disciplinar
  const inter = planeacion.interdisciplinario

  return (
    <div className="flex-1 overflow-y-auto bg-paper">
      <div className="mx-auto max-w-5xl px-5 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('disciplinar')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
              tab === 'disciplinar' ? 'bg-aqua text-white' : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
            }`}>
            Centrado en una asignatura
          </button>
          <button onClick={() => setTab('interdisciplinario')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
              tab === 'interdisciplinario' ? 'bg-violet text-white' : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
            }`}>
            Interdisciplinario
          </button>
        </div>

        {/* Disciplinar */}
        {tab === 'disciplinar' && (
          <div className="space-y-5">
            <div className="rounded-[1.4rem] border border-ink/10 bg-white p-6">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink/35 mb-2">Pregunta de investigación</p>
              <p className="text-base text-ink/75 italic leading-relaxed">{disc.rq}</p>
            </div>

            {disc.tension && (
              <div className="rounded-[1.4rem] border border-signal/20 bg-signal/5 p-6" style={{ borderLeftWidth: '4px', borderLeftColor: '#ff6b35' }}>
                <p className="text-sm font-semibold text-signal mb-1">Por qué esta pregunta puede llegar a A</p>
                <p className="text-sm text-ink/65 leading-relaxed">{disc.tension}</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-[1.4rem] border border-ink/10 bg-white p-5 space-y-3">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink/35">Modelos matemáticos</p>
                {disc.modelos.map((m, i) => (
                  <p key={i} className="text-sm text-ink/60 font-mono bg-ink/4 px-3 py-2 rounded-xl">{m}</p>
                ))}
              </div>
              <div className="rounded-[1.4rem] border border-ink/10 bg-white p-5 space-y-3">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink/35">Datos de la simulación</p>
                {disc.datosSimulacion.map((d, i) => (
                  <p key={i} className="text-sm text-ink/60 flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-graph shrink-0" />{d}
                  </p>
                ))}
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-ink/10 bg-white p-5 space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink/35">Cómo alimentar cada criterio</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(disc.criterios).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-ink/4 p-4">
                    <span className="font-display text-sm font-bold text-ink/80">Criterio {k}</span>
                    <p className="text-sm text-ink/55 leading-relaxed mt-1">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Interdisciplinario */}
        {tab === 'interdisciplinario' && (
          <div className="space-y-5">
            <p className="text-sm text-ink/50 leading-relaxed">
              La misma simulación puede abordarse desde distintos marcos con diferentes asignaturas del DP. Cada enfoque produce una monografía completamente diferente.
            </p>
            {inter.map((opcion, idx) => (
              <div key={idx} className="rounded-[1.4rem] border border-ink/10 bg-white p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/12 text-lg">{opcion.marcoEmoji}</span>
                    <div>
                      <p className="text-sm text-ink/45 font-medium">{opcion.marco}</p>
                      <p className="font-display text-lg font-semibold tracking-[-0.02em]">Mat + {opcion.asignatura}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-ink/5 text-ink/40 px-3 py-1 rounded-full font-medium">Opción {idx + 1}</span>
                </div>

                <div className="rounded-xl bg-ink/4 p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink/35 mb-1">Pregunta de investigación</p>
                  <p className="text-sm text-ink/65 italic leading-relaxed">{opcion.rq}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-aqua/5 border border-aqua/15 p-4">
                    <p className="text-xs font-semibold text-aqua uppercase tracking-wide mb-1">Aporta Matemáticas</p>
                    <p className="text-sm text-ink/60 leading-relaxed">{opcion.integra.matematicas}</p>
                  </div>
                  <div className="rounded-xl bg-violet/5 border border-violet/15 p-4">
                    <p className="text-xs font-semibold text-violet uppercase tracking-wide mb-1">Aporta {opcion.asignatura}</p>
                    <p className="text-sm text-ink/60 leading-relaxed">{opcion.integra.otraAsignatura}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-rose/5 border border-rose/15 p-4">
                  <p className="text-xs font-semibold text-rose uppercase tracking-wide mb-1">Criterio D — doble lente</p>
                  <p className="text-sm text-ink/60 leading-relaxed">{opcion.criterioD}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function MonografiaSimPage() {
  const { simId } = useParams()
  const sim = monografiaContent.simulaciones.find(s => s.id === simId)
  const [view, setView] = useState('simulacion')

  if (!sim) return <Navigate to="/monografias" replace />

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-ink/8 bg-white flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/monografias"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink/5 hover:bg-signal/10 text-ink/60 hover:text-signal text-xs font-semibold transition-colors shrink-0"
          >
            &#8592; Monografía
          </Link>
          <span className="text-sm font-display font-semibold text-ink/70 truncate hidden sm:block">{sim.titulo}</span>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-ink/5 rounded-full p-0.5 shrink-0">
          <button onClick={() => setView('simulacion')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              view === 'simulacion' ? 'bg-white text-ink shadow-sm' : 'text-ink/40 hover:text-ink/60'
            }`}>
            🎡 Simulación
          </button>
          <button onClick={() => setView('planeacion')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              view === 'planeacion' ? 'bg-white text-ink shadow-sm' : 'text-ink/40 hover:text-ink/60'
            }`}>
            📋 Planeación
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'simulacion' && (
        <iframe src={sim.ruta} className="flex-1 w-full border-0" title={sim.titulo} />
      )}
      {view === 'planeacion' && sim.planeacion && (
        <PlanContent planeacion={sim.planeacion} />
      )}
    </div>
  )
}

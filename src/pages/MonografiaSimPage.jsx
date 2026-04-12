import { Link, Navigate, useParams } from 'react-router-dom'
import { monografiaContent } from '../data/platformContent'
import { Breadcrumb } from '../components/layout/PlatformShell'

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
      <iframe
        src={sim.ruta}
        className="flex-1 w-full border-0"
        title={sim.titulo}
      />
    </div>
  )
}

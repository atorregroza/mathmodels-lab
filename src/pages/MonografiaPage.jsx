import { useState } from 'react'
import { motion } from 'framer-motion'
import { Breadcrumb } from '../components/layout/PlatformShell'

const MONOGRAFIA_KEY = 'mcu2026'

export function MonografiaPage() {
  const [clave, setClave] = useState('')
  const [autorizado, setAutorizado] = useState(false)
  const [error, setError] = useState(false)

  const verificar = (e) => {
    e.preventDefault()
    if (clave.toLowerCase().trim() === MONOGRAFIA_KEY) {
      setAutorizado(true)
      setError(false)
    } else {
      setError(true)
      setClave('')
    }
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">
              Monografia
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Este contenido esta protegido. Ingresa la clave de acceso.
            </p>
            <form onSubmit={verificar} className="space-y-4">
              <input
                type="password"
                value={clave}
                onChange={(e) => { setClave(e.target.value); setError(false) }}
                placeholder="Clave de acceso"
                className={`w-full px-4 py-3 rounded-xl border-2 text-center text-lg font-mono tracking-widest transition-colors outline-none ${
                  error
                    ? 'border-red-300 bg-red-50 text-red-700 placeholder-red-300'
                    : 'border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:border-amber-400 focus:bg-white'
                }`}
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-500">Clave incorrecta. Intenta de nuevo.</p>
              )}
              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
              >
                Acceder
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-white">
        <Breadcrumb items={[
          { label: 'Inicio', to: '/' },
          { label: 'Monografia' },
          { label: 'MCU — Ruedas Panoramicas' },
        ]} />
        <button
          onClick={() => setAutorizado(false)}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          🔒 Cerrar sesion
        </button>
      </div>
      <iframe
        src="/simulations/mcu-ruedas.html"
        className="flex-1 w-full border-0"
        title="Simulacion MCU - Ruedas Panoramicas"
      />
    </div>
  )
}

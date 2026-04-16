import { useEffect, useRef, useState } from 'react'
import { loadStudentInfo, saveStudentInfo } from '../../utils/pdfHelpers'

const REFLEXION_PROMPTS = [
  '¿Qué variables controlaste y cuáles observaste? ¿Por qué elegiste ese rango?',
  '¿Qué patrón matemático observaste y cómo lo describirías con palabras?',
  '¿Qué limitaciones tiene el modelo? ¿Qué supuestos hiciste?',
]

/**
 * Modal que recolecta los datos del estudiante y reflexiones antes de generar el PDF.
 * Los datos personales se persisten en localStorage — las reflexiones NO, porque son del lab activo.
 *
 * El componente se monta/desmonta desde el padre (LabExportPDF) usando `{open && <ExportPDFModal ...>}`,
 * por eso NO recibe una prop `open`. Al montarse, el state arranca limpio y hace focus al primer input.
 *
 * Props:
 *   onCancel: () => void — cerrar sin exportar
 *   onSubmit: (data) => void — recibe { name, course, school, reflections: [str, str, str] }
 *   labTitle: string — título del lab (solo para display en el modal)
 *   exporting: boolean — si está generando el PDF (deshabilita botones)
 */
export const ExportPDFModal = ({ onCancel, onSubmit, labTitle, exporting = false }) => {
  // Lazy init desde localStorage — datos personales persistentes
  const [name, setName] = useState(() => loadStudentInfo()?.name || '')
  const [course, setCourse] = useState(() => loadStudentInfo()?.course || '')
  const [school, setSchool] = useState(() => loadStudentInfo()?.school || '')
  const [reflections, setReflections] = useState(['', '', ''])
  const [rememberMe, setRememberMe] = useState(true)
  const firstInputRef = useRef(null)

  // Focus al primer input cuando se monta (sin setState → no cascading renders)
  useEffect(() => {
    const timer = setTimeout(() => firstInputRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])

  // Cerrar con Escape (subscribe externo — válido en useEffect)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && !exporting) onCancel?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [exporting, onCancel])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (exporting) return
    const trimmed = {
      name: name.trim(),
      course: course.trim(),
      school: school.trim(),
      reflections: reflections.map((r) => r.trim()),
    }
    if (rememberMe) {
      saveStudentInfo({ name: trimmed.name, course: trimmed.course, school: trimmed.school })
    }
    onSubmit?.(trimmed)
  }

  const updateReflection = (i, value) => {
    setReflections((prev) => {
      const next = [...prev]
      next[i] = value
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[1.6rem] bg-white shadow-2xl border border-ink/10"
      >
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between border-b border-ink/8 px-6 py-4">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.2em] font-semibold text-ink/50">
              Exportar informe PDF
            </p>
            <h2 className="font-display text-xl text-ink mt-0.5 leading-tight">
              {labTitle || 'Informe de laboratorio'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={exporting}
            className="rounded-full p-2 text-ink/40 hover:text-ink hover:bg-ink/5 transition-colors disabled:opacity-30"
            aria-label="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Sección 1 — datos del estudiante */}
          <section>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] font-semibold text-ink/50 mb-3">
              👤 Datos del estudiante
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-ink/70 mb-1 block">Nombre completo</span>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
                  disabled={exporting}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-ink/70 mb-1 block">Curso</span>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="Ej: 11° IB"
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
                  disabled={exporting}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-ink/70 mb-1 block">Colegio</span>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Nombre de tu colegio"
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
                  disabled={exporting}
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-ink/60 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={exporting}
                className="rounded"
              />
              <span>Recordar mis datos en este dispositivo (localStorage)</span>
            </label>
          </section>

          {/* Sección 2 — reflexiones */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] font-semibold text-ink/50">
                💭 Reflexiones <span className="normal-case text-ink/35 font-normal">(opcional)</span>
              </p>
              <p className="text-[0.65rem] text-ink/40">
                Si las dejas en blanco, el PDF tendrá líneas para escribir a mano.
              </p>
            </div>
            <div className="space-y-3">
              {REFLEXION_PROMPTS.map((prompt, i) => (
                <label key={i} className="block">
                  <span className="text-xs font-medium text-ink/65 italic mb-1 block">{prompt}</span>
                  <textarea
                    value={reflections[i]}
                    onChange={(e) => updateReflection(i, e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/10 resize-y"
                    placeholder="Tu respuesta…"
                    disabled={exporting}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-ink/8 px-6 py-4 flex items-center justify-between gap-3">
          <p className="text-[0.7rem] text-ink/40">
            El PDF incluirá datos, modelos, gráficos y tu análisis del laboratorio.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={exporting}
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink/60 hover:text-ink hover:bg-ink/5 transition-colors disabled:opacity-30"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={exporting}
              className="rounded-full px-5 py-2.5 text-sm font-semibold bg-ink text-paper hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-wait inline-flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Generando…
                </>
              ) : (
                <>⬇ Generar PDF</>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

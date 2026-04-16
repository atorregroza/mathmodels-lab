import { useState } from 'react'
import { ExportPDFModal } from './ExportPDFModal'
import { generateLabPDF } from '../../utils/pdfGenerator'

/**
 * Botón "Exportar reporte a PDF" que abre el modal de datos del estudiante
 * y delega la generación al pipeline editorial moderno.
 *
 * Props:
 *   labTitle:       string  — título del lab
 *   labPurpose:     string  — propósito / descripción
 *   unitTitle:      string  — unidad curricular (opcional)
 *   contextSummary: string  — contexto del problema (opcional)
 */
export const LabExportPDF = ({ labTitle, labPurpose, unitTitle, contextSummary }) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  const handleExport = async ({ name, course, school, reflections }) => {
    setExporting(true)
    setError(null)
    // Timeout global: si el PDF no se genera en 60s, abortamos con error visible
    const timeout = setTimeout(() => {
      setError('La generación del PDF está tardando demasiado. El lab puede tener demasiadas gráficas. Intenta cerrar el modal y reintentar.')
      setExporting(false)
    }, 60000)
    try {
      await generateLabPDF({
        labTitle,
        labPurpose,
        unitTitle,
        contextSummary,
        studentInfo: { name, course, school },
        reflections,
      })
      clearTimeout(timeout)
      setModalOpen(false)
    } catch (err) {
      clearTimeout(timeout)
      console.error('PDF export error:', err)
      setError(err?.message || 'Ocurrió un error al generar el PDF.')
    } finally {
      clearTimeout(timeout)
      setExporting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border-2 border-orange-500 bg-orange-50 px-5 py-3 text-sm font-bold text-orange-900 transition-colors hover:bg-orange-100"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        📝 Preparar informe PDF
      </button>

      {modalOpen && (
        <ExportPDFModal
          onCancel={() => setModalOpen(false)}
          onSubmit={handleExport}
          labTitle={labTitle}
          exporting={exporting}
        />
      )}

      {error && (
        <div className="fixed bottom-6 right-6 z-[110] max-w-sm rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg">
          <p className="font-semibold">No pudimos generar el PDF</p>
          <p className="text-xs mt-1">{error}</p>
          <button onClick={() => setError(null)} className="mt-2 text-xs underline">Cerrar</button>
        </div>
      )}
    </>
  )
}

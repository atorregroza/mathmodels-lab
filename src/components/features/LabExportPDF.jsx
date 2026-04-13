import { useState } from 'react'

/**
 * Captures the first SVG inside a container, converts it to an image,
 * and generates a PDF with lab context.
 */
const svgToDataURL = (svgEl) => {
  return new Promise((resolve) => {
    const clone = svgEl.cloneNode(true)
    // Ensure viewBox is set for proper scaling
    if (!clone.getAttribute('viewBox')) {
      const bb = svgEl.getBBox()
      clone.setAttribute('viewBox', `0 0 ${bb.width} ${bb.height}`)
    }
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    // Inline computed styles for dark backgrounds
    const rects = clone.querySelectorAll('rect, path, line, circle, text')
    rects.forEach((el) => {
      const computed = window.getComputedStyle(svgEl.querySelector(`[class="${el.getAttribute('class')}"]`) || el)
      if (computed.fill) el.style.fill = el.style.fill || computed.fill
      if (computed.stroke) el.style.stroke = el.style.stroke || computed.stroke
    })
    const data = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = 2 // retina quality
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)
      // Dark background for graph
      ctx.fillStyle = '#121723'
      ctx.fillRect(0, 0, img.width, img.height)
      ctx.drawImage(img, 0, 0, img.width, img.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

export const LabExportPDF = ({ labTitle, labPurpose, unitTitle, contextSummary }) => {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 18
      const contentW = pageW - margin * 2
      let y = 20

      // ── Header ──
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text('MathModels Lab — Reporte de exploración', margin, y)
      doc.text(new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }), pageW - margin, y, { align: 'right' })
      y += 8

      // ── Line ──
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, y, pageW - margin, y)
      y += 10

      // ── Title ──
      doc.setFontSize(22)
      doc.setTextColor(18, 23, 35)
      const titleLines = doc.splitTextToSize(labTitle, contentW)
      doc.text(titleLines, margin, y)
      y += titleLines.length * 9 + 4

      // ── Unit badge ──
      if (unitTitle) {
        doc.setFontSize(9)
        doc.setTextColor(100, 100, 100)
        doc.text(`Unidad: ${unitTitle}`, margin, y)
        y += 8
      }

      // ── Purpose ──
      doc.setFontSize(11)
      doc.setTextColor(40, 40, 40)
      const purposeLines = doc.splitTextToSize(labPurpose, contentW)
      doc.text(purposeLines, margin, y)
      y += purposeLines.length * 5.5 + 8

      // ── Context ──
      if (contextSummary) {
        doc.setFontSize(9)
        doc.setTextColor(80, 80, 80)
        doc.text('CONTEXTO DEL PROBLEMA', margin, y)
        y += 5
        doc.setFontSize(10)
        doc.setTextColor(50, 50, 50)
        const ctxLines = doc.splitTextToSize(contextSummary, contentW)
        doc.text(ctxLines, margin, y)
        y += ctxLines.length * 5 + 8
      }

      // ── Graph capture ──
      const labContainer = document.querySelector('[data-lab-content]')
      if (labContainer) {
        const svgs = labContainer.querySelectorAll('svg')
        // Find the main graph SVG (largest one with viewBox)
        let mainSvg = null
        let maxArea = 0
        svgs.forEach((svg) => {
          const vb = svg.getAttribute('viewBox')
          if (vb) {
            const parts = vb.split(/[\s,]+/).map(Number)
            const area = (parts[2] || 0) * (parts[3] || 0)
            if (area > maxArea) {
              maxArea = area
              mainSvg = svg
            }
          }
        })

        if (mainSvg) {
          const dataURL = await svgToDataURL(mainSvg)
          if (dataURL) {
            const vb = mainSvg.getAttribute('viewBox').split(/[\s,]+/).map(Number)
            const ratio = vb[3] / vb[2]
            const imgW = contentW
            const imgH = imgW * ratio

            // Check if we need a new page
            if (y + imgH > 270) {
              doc.addPage()
              y = 20
            }

            doc.setFontSize(9)
            doc.setTextColor(80, 80, 80)
            doc.text('GRÁFICO', margin, y)
            y += 5

            doc.addImage(dataURL, 'PNG', margin, y, imgW, imgH)
            y += imgH + 8
          }
        }

        // ── Capture visible metrics ──
        const metricCards = labContainer.querySelectorAll('[class*="tabular-nums"]')
        if (metricCards.length > 0) {
          if (y > 240) { doc.addPage(); y = 20 }
          doc.setFontSize(9)
          doc.setTextColor(80, 80, 80)
          doc.text('VALORES OBSERVADOS', margin, y)
          y += 6

          const seen = new Set()
          metricCards.forEach((card) => {
            const parent = card.closest('[class*="rounded"]')
            if (!parent) return
            const label = parent.querySelector('[class*="uppercase"]')
            const value = card.textContent?.trim()
            if (!value || !label) return
            const key = `${label.textContent}:${value}`
            if (seen.has(key)) return
            seen.add(key)

            if (y > 270) { doc.addPage(); y = 20 }
            doc.setFontSize(9)
            doc.setTextColor(100, 100, 100)
            doc.text(label.textContent?.trim() || '', margin, y)
            doc.setFontSize(11)
            doc.setTextColor(18, 23, 35)
            doc.text(value, margin + 60, y)
            y += 6
          })
          y += 4
        }
      }

      // ── Reflection space ──
      if (y > 220) { doc.addPage(); y = 20 }
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text('ESPACIO PARA REFLEXIÓN', margin, y)
      y += 6
      doc.setDrawColor(220, 220, 220)
      for (let i = 0; i < 8; i++) {
        doc.line(margin, y + i * 8, pageW - margin, y + i * 8)
      }

      // ── Footer ──
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(160, 160, 160)
        doc.text('Generado en MathModels Lab — mathmodels.astridto.com', margin, 290)
        doc.text(`Página ${i} de ${pageCount}`, pageW - margin, 290, { align: 'right' })
      }

      // ── Save ──
      const safeName = labTitle.toLowerCase().replace(/[^a-záéíóúñ0-9]+/g, '-').replace(/-+/g, '-').slice(0, 40)
      doc.save(`mathmodels-${safeName}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className="inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink/24 hover:bg-ink/5 disabled:opacity-50"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      {exporting ? 'Generando PDF...' : 'Exportar exploración a PDF'}
    </button>
  )
}

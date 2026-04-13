import { useState } from 'react'

/* ── SVG → PNG conversion ─────────────────────────────────────────────── */

const svgToDataURL = (svgEl, bgColor = '#121723') => {
  return new Promise((resolve) => {
    const clone = svgEl.cloneNode(true)
    const vb = svgEl.getAttribute('viewBox')
    if (!vb) { resolve(null); return }
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', '1200')
    clone.setAttribute('height', String(1200 * (parseFloat(vb.split(/[\s,]+/)[3]) / parseFloat(vb.split(/[\s,]+/)[2]))))

    const data = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

const loadImageAsDataURL = (src) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/* ── Color constants ──────────────────────────────────────────────────── */

const C = {
  ink: [18, 23, 35],
  accent: [255, 107, 53],     // signal orange
  muted: [120, 125, 140],
  light: [200, 200, 210],
  bg: [245, 246, 250],
  white: [255, 255, 255],
}

/* ── PDF helpers ──────────────────────────────────────────────────────── */

const drawAccentBar = (doc, x, y, w) => {
  doc.setFillColor(...C.accent)
  doc.rect(x, y, w, 1.2, 'F')
}

const sectionLabel = (doc, text, x, y) => {
  doc.setFontSize(7.5)
  doc.setTextColor(...C.accent)
  doc.setFont('helvetica', 'bold')
  doc.text(text.toUpperCase(), x, y)
  doc.setFont('helvetica', 'normal')
  return y + 5
}

const ensureSpace = (doc, y, needed) => {
  if (y + needed > 275) { doc.addPage(); return 22 }
  return y
}

/* ── Find CartesianFrame SVGs (those with axes, not figural visualizations) ── */

const findGraphSVGs = (container) => {
  const svgs = container.querySelectorAll('svg[viewBox]')
  const results = []
  svgs.forEach((svg) => {
    // CartesianFrame SVGs contain <line> elements for axes and <text> for tick labels
    const lines = svg.querySelectorAll('line')
    const texts = svg.querySelectorAll('text')
    // Must have both axis lines and tick labels to be a real graph
    if (lines.length >= 4 && texts.length >= 3) {
      results.push(svg)
    }
  })
  // If no CartesianFrame found, fall back to largest SVG
  if (results.length === 0) {
    let best = null, maxArea = 0
    svgs.forEach((svg) => {
      const vb = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number)
      if (vb && vb.length >= 4) {
        const area = vb[2] * vb[3]
        if (area > maxArea) { maxArea = area; best = svg }
      }
    })
    if (best) results.push(best)
  }
  return results
}

/* ── Main component ───────────────────────────────────────────────────── */

export const LabExportPDF = ({ labTitle, labPurpose, unitTitle, contextSummary, howToUse }) => {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const M = 20 // margin
      const W = pageW - M * 2
      let y = 16

      // ── Load logo ──
      const logoURL = await loadImageAsDataURL('/images/mathmodels-lab-logo.png')

      // ══════════════════════════════════════════════════════════════
      // PAGE 1: Cover / Header
      // ══════════════════════════════════════════════════════════════

      // Logo
      if (logoURL) {
        doc.addImage(logoURL, 'PNG', M, y, 40, 10)
        y += 14
      } else {
        doc.setFontSize(12)
        doc.setTextColor(...C.ink)
        doc.setFont('helvetica', 'bold')
        doc.text('MathModels Lab', M, y + 4)
        doc.setFont('helvetica', 'normal')
        y += 10
      }

      // Date right-aligned
      doc.setFontSize(8)
      doc.setTextColor(...C.muted)
      doc.text(
        new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
        pageW - M, y - 4, { align: 'right' },
      )

      // Accent bar
      drawAccentBar(doc, M, y, W)
      y += 8

      // Title
      doc.setFontSize(24)
      doc.setTextColor(...C.ink)
      doc.setFont('helvetica', 'bold')
      const titleLines = doc.splitTextToSize(labTitle, W)
      doc.text(titleLines, M, y)
      y += titleLines.length * 10 + 3

      // Unit badge
      if (unitTitle) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...C.accent)
        doc.text(`■ ${unitTitle}`, M, y)
        y += 7
      }

      // Purpose
      doc.setFontSize(10.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.ink)
      const purposeLines = doc.splitTextToSize(labPurpose, W)
      doc.text(purposeLines, M, y)
      y += purposeLines.length * 5 + 8

      // ── Context section with background ──
      if (contextSummary) {
        y = ensureSpace(doc, y, 30)
        y = sectionLabel(doc, 'Contexto del problema', M, y)

        doc.setFillColor(...C.bg)
        const ctxLines = doc.splitTextToSize(contextSummary, W - 8)
        const ctxH = ctxLines.length * 4.8 + 8
        doc.roundedRect(M, y - 3, W, ctxH, 2, 2, 'F')

        doc.setFontSize(9.5)
        doc.setTextColor(60, 62, 72)
        doc.text(ctxLines, M + 4, y + 2)
        y += ctxH + 6
      }

      // ── Graph captures ──
      const labContainer = document.querySelector('[data-lab-content]')
      if (labContainer) {
        const graphSVGs = findGraphSVGs(labContainer)

        for (let gi = 0; gi < Math.min(graphSVGs.length, 2); gi++) {
          const svg = graphSVGs[gi]
          const dataURL = await svgToDataURL(svg)
          if (!dataURL) continue

          y = ensureSpace(doc, y, 80)
          y = sectionLabel(doc, gi === 0 ? 'Visualización' : 'Visualización adicional', M, y)

          const vb = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number)
          const ratio = vb[3] / vb[2]
          const imgW = W
          const imgH = Math.min(imgW * ratio, 90)

          // Rounded container with border
          doc.setDrawColor(...C.light)
          doc.setLineWidth(0.3)
          doc.roundedRect(M, y - 1, imgW, imgH + 2, 2, 2, 'S')
          doc.addImage(dataURL, 'PNG', M + 0.5, y, imgW - 1, imgH)
          y += imgH + 8
        }

        // ── Metrics table ──
        const metricCards = labContainer.querySelectorAll('[class*="tabular-nums"]')
        const metrics = []
        const seen = new Set()
        metricCards.forEach((card) => {
          const parent = card.closest('[class*="rounded"]')
          if (!parent) return
          const label = parent.querySelector('[class*="uppercase"]')
          const value = card.textContent?.trim()
          if (!value || !label) return
          const lbl = label.textContent?.trim() || ''
          const key = `${lbl}:${value}`
          if (seen.has(key) || !lbl) return
          seen.add(key)
          metrics.push({ label: lbl, value })
        })

        if (metrics.length > 0) {
          y = ensureSpace(doc, y, 10 + metrics.length * 7)
          y = sectionLabel(doc, 'Valores observados', M, y)

          // Table header
          doc.setFillColor(...C.ink)
          doc.rect(M, y - 1, W, 7, 'F')
          doc.setFontSize(7.5)
          doc.setTextColor(...C.white)
          doc.setFont('helvetica', 'bold')
          doc.text('Magnitud', M + 4, y + 3.5)
          doc.text('Valor', M + W - 4, y + 3.5, { align: 'right' })
          y += 8

          // Table rows
          doc.setFont('helvetica', 'normal')
          metrics.forEach((m, i) => {
            y = ensureSpace(doc, y, 7)
            if (i % 2 === 0) {
              doc.setFillColor(...C.bg)
              doc.rect(M, y - 3.5, W, 7, 'F')
            }
            doc.setFontSize(8.5)
            doc.setTextColor(...C.muted)
            doc.text(m.label, M + 4, y)
            doc.setFontSize(10)
            doc.setTextColor(...C.ink)
            doc.setFont('helvetica', 'bold')
            doc.text(m.value, M + W - 4, y, { align: 'right' })
            doc.setFont('helvetica', 'normal')
            y += 7
          })
          y += 6
        }
      }

      // ── Model expressions (from ModelCard components) ──
      if (labContainer) {
        const modelCards = labContainer.querySelectorAll('[class*="overflow-x-auto"][class*="rounded"]')
        const expressions = []
        modelCards.forEach((card) => {
          const titleEl = card.querySelector('[class*="uppercase"]')
          const exprEl = card.querySelector('[class*="font-semibold"]:not([class*="uppercase"])')
          if (titleEl && exprEl) {
            const title = titleEl.textContent?.trim()
            const expr = exprEl.textContent?.trim()
            if (title && expr && expr.length > 2) {
              expressions.push({ title, expr })
            }
          }
        })

        if (expressions.length > 0) {
          y = ensureSpace(doc, y, 12 + expressions.length * 18)
          y = sectionLabel(doc, 'Modelo matemático', M, y)

          expressions.forEach((m) => {
            y = ensureSpace(doc, y, 18)
            doc.setFillColor(248, 245, 240)
            doc.roundedRect(M, y - 3, W, 15, 2, 2, 'F')
            doc.setDrawColor(230, 220, 200)
            doc.setLineWidth(0.3)
            doc.roundedRect(M, y - 3, W, 15, 2, 2, 'S')

            doc.setFontSize(7)
            doc.setTextColor(...C.muted)
            doc.setFont('helvetica', 'bold')
            doc.text(m.title.toUpperCase(), M + 4, y + 1)

            doc.setFontSize(11)
            doc.setTextColor(...C.ink)
            doc.setFont('helvetica', 'bold')
            doc.text(doc.splitTextToSize(m.expr, W - 10)[0] || m.expr, M + 4, y + 8)
            doc.setFont('helvetica', 'normal')
            y += 18
          })
          y += 4
        }
      }

      // ── Data tables ──
      if (labContainer) {
        const tables = labContainer.querySelectorAll('table')
        if (tables.length > 0) {
          const table = tables[0] // capture first table
          const headers = []
          const rows = []

          table.querySelectorAll('thead th').forEach((th) => {
            headers.push(th.textContent?.trim() || '')
          })

          table.querySelectorAll('tbody tr').forEach((tr) => {
            const cells = []
            tr.querySelectorAll('td').forEach((td) => {
              cells.push(td.textContent?.trim() || '')
            })
            if (cells.length > 0) rows.push(cells)
          })

          if (headers.length > 0 && rows.length > 0) {
            // Limit to first 15 rows to avoid pages of data
            const displayRows = rows.slice(0, 15)
            const tableH = 10 + displayRows.length * 6
            y = ensureSpace(doc, y, tableH)
            y = sectionLabel(doc, 'Tabla de datos', M, y)

            const colW = W / headers.length

            // Header row
            doc.setFillColor(...C.ink)
            doc.rect(M, y - 2, W, 6, 'F')
            doc.setFontSize(7)
            doc.setTextColor(...C.white)
            doc.setFont('helvetica', 'bold')
            headers.forEach((h, i) => {
              const align = i === 0 ? 'left' : 'right'
              const x = i === 0 ? M + 2 : M + colW * (i + 1) - 2
              doc.text(h, x, y + 2, { align })
            })
            y += 6

            // Data rows
            doc.setFont('helvetica', 'normal')
            displayRows.forEach((row, ri) => {
              y = ensureSpace(doc, y, 6)
              if (ri % 2 === 0) {
                doc.setFillColor(...C.bg)
                doc.rect(M, y - 3, W, 6, 'F')
              }
              row.forEach((cell, ci) => {
                const align = ci === 0 ? 'left' : 'right'
                const x = ci === 0 ? M + 2 : M + colW * (ci + 1) - 2
                doc.setFontSize(8)
                doc.setTextColor(ci === 0 ? C.muted : C.ink)
                doc.text(cell, x, y, { align })
              })
              y += 6
            })

            if (rows.length > 15) {
              doc.setFontSize(7)
              doc.setTextColor(...C.muted)
              doc.text(`... ${rows.length - 15} filas adicionales (descarga CSV para datos completos)`, M + 2, y + 2)
              y += 6
            }
            y += 6
          }
        }
      }

      // ── Reflection section ──
      y = ensureSpace(doc, y, 60)
      y = sectionLabel(doc, 'Reflexión del estudiante', M, y)

      // Guiding questions
      const questions = [
        '¿Qué patrón o comportamiento observaste al cambiar los parámetros?',
        '¿Qué relación encontraste entre las variables del modelo?',
        '¿En qué contexto real podrías aplicar lo que exploraste?',
      ]
      doc.setFontSize(8.5)
      doc.setTextColor(80, 82, 95)
      questions.forEach((q, i) => {
        y = ensureSpace(doc, y, 22)
        doc.setFont('helvetica', 'italic')
        doc.text(`${i + 1}. ${q}`, M, y)
        y += 5

        // Answer lines
        doc.setDrawColor(...C.light)
        doc.setLineWidth(0.2)
        for (let j = 0; j < 3; j++) {
          doc.line(M, y + j * 7, M + W, y + j * 7)
        }
        y += 24
      })

      // ── Student info box ──
      y = ensureSpace(doc, y, 28)
      doc.setFillColor(...C.bg)
      doc.roundedRect(M, y, W, 22, 2, 2, 'F')
      doc.setFontSize(7.5)
      doc.setTextColor(...C.muted)
      doc.setFont('helvetica', 'normal')
      doc.text('Nombre:', M + 4, y + 6)
      doc.line(M + 22, y + 7, M + W / 2 - 4, y + 7)
      doc.text('Curso:', M + W / 2, y + 6)
      doc.line(M + W / 2 + 15, y + 7, M + W - 4, y + 7)
      doc.text('Colegio:', M + 4, y + 16)
      doc.line(M + 22, y + 17, M + W / 2 - 4, y + 17)
      doc.text('Fecha:', M + W / 2, y + 16)
      doc.line(M + W / 2 + 15, y + 17, M + W - 4, y + 17)

      // ══════════════════════════════════════════════════════════════
      // FOOTER on every page
      // ══════════════════════════════════════════════════════════════
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        // Bottom accent bar
        doc.setFillColor(...C.accent)
        doc.rect(M, 286, W, 0.5, 'F')
        // Footer text
        doc.setFontSize(7)
        doc.setTextColor(...C.muted)
        doc.setFont('helvetica', 'normal')
        doc.text('MathModels Lab — mathmodels.astridto.com', M, 290)
        doc.text(`${i} / ${pageCount}`, pageW - M, 290, { align: 'right' })
      }

      // ── Save ──
      const safeName = labTitle.toLowerCase().replace(/[^a-záéíóúñ0-9]+/g, '-').replace(/-+/g, '-').slice(0, 40)
      doc.save(`mathmodels-${safeName}.pdf`)
    } catch (err) {
      console.error('PDF export error:', err)
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

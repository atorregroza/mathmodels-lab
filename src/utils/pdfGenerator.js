/**
 * Generador de PDF editorial moderno para los laboratorios de MathModels.
 *
 * Características:
 * - Layout editorial profesional con marca MathModels
 * - Datos del estudiante desde modal (sin líneas en blanco)
 * - Notación matemática renderizada con KaTeX (no texto plano)
 * - Gráficas capturadas fielmente con html2canvas
 * - Paginación automática respetando márgenes
 * - Header/footer en todas las páginas con numeración "i / N"
 *
 * Uso:
 *   await generateLabPDF({ labTitle, unitTitle, ..., studentInfo, reflections })
 */
import { jsPDF } from 'jspdf'
import {
  captureKatexElement,
  captureSvgToImage,
  toUnicodeMath,
} from './pdfHelpers.js'

/* ═══════════════════════════════════════════════════════════════════════
 * CONSTANTES DE DISEÑO — EDITORIAL MODERNO
 * ═══════════════════════════════════════════════════════════════════════ */

// Paleta — consistente con la plataforma (ink, accent naranja, grises)
const C = {
  ink:     [18, 23, 35],      // primario — títulos, texto principal
  accent:  [255, 107, 53],    // naranja — etiquetas de sección, barras
  muted:   [120, 125, 140],   // gris — metadatos, auxiliar
  soft:    [200, 200, 210],   // borde suave
  bg:      [247, 247, 249],   // fondo de cards
  bgAlt:   [252, 252, 253],   // fondo alternado (tabla)
  line:    [225, 226, 232],   // líneas separadoras
  badge:   [244, 237, 228],   // fondo badge unidad (crema)
}

// Geometría — A4 portrait (210 × 297 mm)
const G = {
  pageW: 210,
  pageH: 297,
  margin: 20,
  contentW: 170,          // 210 - 2*20
  headerY: 15,            // línea del header
  footerY: 283,           // línea del footer
  safeBottom: 270,        // no escribir contenido debajo (deja espacio al footer)
}

// Tipografía — Helvetica (jsPDF nativa)
const T = {
  h1: 22,
  h2: 14,
  h3: 11,
  body: 10,
  small: 8.5,
  tiny: 7.5,
}

/* ═══════════════════════════════════════════════════════════════════════
 * HELPERS DE DIBUJO
 * ═══════════════════════════════════════════════════════════════════════ */

const setFillRGB = (doc, rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2])
const setStrokeRGB = (doc, rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2])
const setTextRGB = (doc, rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2])

/**
 * Limpia caracteres problemáticos para jsPDF:
 * - No-break spaces (U+00A0) → espacio normal
 * - Zero-width spaces (U+200B) → nada
 * - Comillas tipográficas → comillas rectas
 * - Puntos suspensivos (…) → 3 puntos
 * Esto evita el bug de splitTextToSize que genera kerning raro con ciertos Unicode.
 */
const sanitize = (text) => {
  if (!text) return ''
  return String(text)
    .replace(/\u00A0/g, ' ')        // nbsp
    .replace(/[\u200B-\u200F]/g, '') // zero-width + bidi
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/\u2026/g, '...')       // ellipsis
    .replace(/[\u2013\u2014]/g, '-') // en-dash, em-dash → guion
    .replace(/\s+/g, ' ')
    .trim()
}

/** Asegura que queda espacio vertical; agrega página si no. Devuelve el nuevo y. */
const ensureSpace = (doc, y, needed) => {
  if (y + needed > G.safeBottom) {
    doc.addPage()
    return G.margin + 8
  }
  return y
}

/** Dibuja etiqueta de sección tipo "01 · CONTEXTO DEL PROBLEMA" */
const sectionLabel = (doc, number, text, y) => {
  setTextRGB(doc, C.accent)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(T.tiny)
  const label = `${number} · ${text.toUpperCase()}`
  doc.text(label, G.margin, y)

  // Línea acento corta al lado
  const textW = doc.getTextWidth(label)
  setStrokeRGB(doc, C.accent)
  doc.setLineWidth(0.6)
  doc.line(G.margin + textW + 4, y - 1, G.margin + textW + 14, y - 1)

  return y + 6
}

/** Párrafo con wrap automático. Devuelve el nuevo y.
 *  Aplica sanitize() para evitar kerning raro con Unicode problemático. */
const drawParagraph = (doc, text, y, { font = 'normal', size = T.body, color = C.ink, indent = 0, maxWidth = null } = {}) => {
  if (!text) return y
  setTextRGB(doc, color)
  doc.setFont('helvetica', font)
  doc.setFontSize(size)
  const width = (maxWidth ?? G.contentW) - indent
  const clean = sanitize(text)
  const lines = doc.splitTextToSize(clean, width)
  const lineHeight = size * 0.45
  let y0 = y
  lines.forEach((line) => {
    y0 = ensureSpace(doc, y0, lineHeight)
    doc.text(line, G.margin + indent, y0 + lineHeight * 0.75)
    y0 += lineHeight
  })
  return y0 + 2
}

/** Dibuja una card (rectángulo redondeado con fondo y borde opcional) */
const drawCard = (doc, x, y, w, h, { fill = C.bg, border = null, radius = 2 } = {}) => {
  setFillRGB(doc, fill)
  if (border) {
    setStrokeRGB(doc, border)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, w, h, radius, radius, 'FD')
  } else {
    doc.roundedRect(x, y, w, h, radius, radius, 'F')
  }
}

/** Inserta una imagen con control de ratio y máximo alto */
const insertImage = (doc, dataUrl, y, { maxHeight = 80, maxWidth = G.contentW, align = 'center', naturalWidth, naturalHeight } = {}) => {
  if (!dataUrl) return y
  // Calcular dimensiones preservando aspect ratio
  const ratio = naturalHeight / naturalWidth
  let w = Math.min(maxWidth, G.contentW)
  let h = w * ratio
  if (h > maxHeight) {
    h = maxHeight
    w = h / ratio
  }
  y = ensureSpace(doc, y, h + 4)
  const x = align === 'center' ? G.margin + (G.contentW - w) / 2 : G.margin
  doc.addImage(dataUrl, 'PNG', x, y, w, h, undefined, 'FAST')
  return y + h + 3
}

/* ═══════════════════════════════════════════════════════════════════════
 * HEADER / FOOTER (se dibuja en CADA página al final)
 * ═══════════════════════════════════════════════════════════════════════ */

const drawHeaderFooter = (doc, { labTitle, pageNum, totalPages, skipHeader = false }) => {
  // Header — solo en páginas 2+
  if (!skipHeader) {
    setTextRGB(doc, C.muted)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(T.tiny)
    doc.text('MathModels Lab', G.margin, G.headerY)

    doc.setFont('helvetica', 'normal')
    const shortTitle = labTitle.length > 55 ? labTitle.slice(0, 52) + '…' : labTitle
    const tw = doc.getTextWidth(shortTitle)
    doc.text(shortTitle, G.pageW - G.margin - tw, G.headerY)

    // Línea sutil bajo el header
    setStrokeRGB(doc, C.line)
    doc.setLineWidth(0.2)
    doc.line(G.margin, G.headerY + 2, G.pageW - G.margin, G.headerY + 2)
  }

  // Footer — en todas las páginas
  setFillRGB(doc, C.accent)
  doc.rect(G.margin, G.footerY - 2, 8, 0.8, 'F')

  setTextRGB(doc, C.muted)
  doc.setFontSize(T.tiny)
  doc.setFont('helvetica', 'normal')
  doc.text('mathmodels.astridto.com · Informe generado automaticamente', G.margin, G.footerY + 4)

  doc.setFont('helvetica', 'bold')
  const pageText = `${pageNum} / ${totalPages}`
  const ptw = doc.getTextWidth(pageText)
  doc.text(pageText, G.pageW - G.margin - ptw, G.footerY + 4)
}

/* ═══════════════════════════════════════════════════════════════════════
 * CAPTURA DE CONTENIDO DEL LAB ACTIVO
 * ═══════════════════════════════════════════════════════════════════════ */

/** Detecta y captura las gráficas principales del lab.
 *  - Incluye timelines horizontales (poco alto, mucho ancho) y gráficas normales.
 *  - Filtra sparklines (muy pequeños), iconos decorativos y SVGs sin contenido útil.
 *  - Captura SECUENCIALMENTE para no saturar memoria con 4+ gráficas grandes. */
const captureGraphs = async (container) => {
  if (!container) return []
  const allSvgs = [...container.querySelectorAll('svg')]
  const candidates = allSvgs.filter((svg) => {
    const rect = svg.getBoundingClientRect()
    if (rect.width < 180) return false
    if (rect.height < 20) return false
    // Mínimo 10 elementos dibujables — descarta iconos (~2-3 paths)
    const drawables = svg.querySelectorAll('line, path, rect, circle, polygon, polyline, text')
    if (drawables.length < 10) return false
    return true
  })
  // Priorizar por área; top 3
  candidates.sort((a, b) => {
    const rA = a.getBoundingClientRect()
    const rB = b.getBoundingClientRect()
    return (rB.width * rB.height) - (rA.width * rA.height)
  })
  const targets = candidates.slice(0, 3)
  // Secuencial para evitar problemas de memoria con varios SVG grandes en paralelo
  const captures = []
  for (const svg of targets) {
    const rect = svg.getBoundingClientRect()
    // targetWidth adaptativo: gráficas muy grandes se reescalan agresivamente
    const targetWidth = rect.width > 900 ? 1000 : 1200
    const img = await captureSvgToImage(svg, { targetWidth, timeoutMs: 6000 })
    if (img) captures.push(img)
  }
  return captures
}

/** Extrae métricas (MetricCard) del lab activo. */
const extractMetrics = (container) => {
  if (!container) return []
  // MetricCard tiene clase 'tabular-nums' en el valor
  const cards = container.querySelectorAll('.tabular-nums')
  const seen = new Set()
  const metrics = []
  cards.forEach((valueEl) => {
    const card = valueEl.closest('[class*="rounded"]')
    if (!card || seen.has(card)) return
    seen.add(card)
    // Buscar el label más cercano (tiene clase uppercase y tracking)
    const labelEl = card.querySelector('[class*="uppercase"]')
    const detailEl = [...card.querySelectorAll('p, div')].find((el) => {
      return el !== labelEl && el !== valueEl && !el.contains(valueEl) && el.textContent?.trim().length > 0 && !el.classList.contains('tabular-nums')
    })
    const label = labelEl?.textContent?.trim() || ''
    const value = valueEl.textContent?.trim() || ''
    const detail = detailEl?.textContent?.trim() || ''
    if (label && value) metrics.push({ label, value, detail })
  })
  return metrics.slice(0, 8) // límite razonable
}

/** Extrae expresiones de modelo (ModelCard) del lab activo.
 *  Devuelve también el ELEMENTO KaTeX para captura posterior.
 */
const extractModels = (container) => {
  if (!container) return []
  const candidates = container.querySelectorAll('[class*="overflow-x-auto"][class*="rounded"]')
  const models = []
  candidates.forEach((card) => {
    const labelEl = card.querySelector('[class*="uppercase"]')
    const katexEl = card.querySelector('.math-render')
    const fallbackEl = card.querySelector('[class*="font-semibold"]:not([class*="uppercase"])')
    const expr = katexEl?.textContent || fallbackEl?.textContent || ''
    const params = [...card.querySelectorAll('p')].find((p) => p.textContent?.includes('Parámetros:'))?.textContent
    const cond = [...card.querySelectorAll('p')].find((p) => p.textContent?.includes('Condición:'))?.textContent
    if (labelEl && expr) {
      models.push({
        title: labelEl.textContent?.trim() || 'Modelo',
        expression: expr.trim(),
        katexElement: katexEl,   // el span .math-render ya renderizado en pantalla
        parameters: params?.replace(/^Parámetros:\s*/, '').trim() || null,
        conditions: cond?.replace(/^Condición:\s*/, '').trim() || null,
      })
    }
  })
  return models.slice(0, 6)
}

/** Extrae la primera tabla de datos (completa, no truncada). */
const extractTable = (container) => {
  if (!container) return null
  const table = container.querySelector('table')
  if (!table) return null
  const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim() || '')
  const rows = [...table.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim() || '')
  )
  if (headers.length === 0 || rows.length === 0) return null
  return { headers, rows }
}

/* ═══════════════════════════════════════════════════════════════════════
 * GENERADOR PRINCIPAL
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Genera y descarga un PDF profesional del laboratorio activo.
 *
 * @param {object} config
 * @param {string} config.labTitle — título del lab
 * @param {string} config.labPurpose — propósito
 * @param {string} config.unitTitle — unidad (badge)
 * @param {string} config.contextSummary — contexto del problema
 * @param {HTMLElement} [config.labContainer] — si se omite, busca [data-lab-content]
 * @param {object} config.studentInfo — { name, course, school }
 * @param {string[]} [config.reflections] — array de 3 strings (opcional)
 * @param {string} [config.filename] — nombre del archivo (default: derivado del labTitle)
 */
export const generateLabPDF = async ({
  labTitle,
  labPurpose,
  unitTitle,
  contextSummary,
  labContainer,
  studentInfo,
  reflections = ['', '', ''],
  filename,
}) => {
  const container = labContainer || document.querySelector('[data-lab-content]')
  if (!container) {
    throw new Error('No se encontró el contenedor del lab ([data-lab-content])')
  }

  // Pipeline secuencial: evita que Promise.all atore el browser con 4+ SVGs grandes
  const metrics = extractMetrics(container)
  const models = extractModels(container)
  const dataTable = extractTable(container)
  const graphs = await captureGraphs(container)

  // Capturar KaTeX uno por uno (html2canvas en paralelo puede chocar con su iframe interno)
  const modelsRendered = []
  for (const m of models) {
    if (!m.katexElement) {
      modelsRendered.push({ ...m, img: null })
      continue
    }
    const img = await captureKatexElement(m.katexElement, { scale: 2.5, timeoutMs: 5000 })
    modelsRendered.push({ ...m, img })
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  let y = G.margin + 10

  /* ──────────────────── PÁGINA 1 — PORTADA ──────────────────── */

  // Marca superior con barra acento
  setFillRGB(doc, C.accent)
  doc.rect(G.margin, G.margin, 30, 1.5, 'F')
  setTextRGB(doc, C.muted)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(T.tiny)
  doc.text('MATHMODELS LAB', G.margin, G.margin + 6)

  // Fecha a la derecha
  const fecha = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  doc.setFont('helvetica', 'normal')
  const fw = doc.getTextWidth(fecha)
  doc.text(fecha, G.pageW - G.margin - fw, G.margin + 6)

  // Badge de unidad (si aplica)
  // Empezar el contenido de la portada justo debajo de la marca — sin dejar espacio muerto
  y = 38
  if (unitTitle) {
    const badge = sanitize(unitTitle).toUpperCase()
    doc.setFontSize(T.tiny)
    const bw = doc.getTextWidth(badge) + 8
    setFillRGB(doc, C.badge)
    doc.roundedRect(G.margin, y, bw, 7, 1.5, 1.5, 'F')
    setTextRGB(doc, C.ink)
    doc.setFont('helvetica', 'bold')
    doc.text(badge, G.margin + 4, y + 4.8)
    y += 11
  }

  // Título del lab (h1)
  const cleanTitle = sanitize(labTitle || 'Informe de laboratorio')
  setTextRGB(doc, C.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(T.h1)
  const titleLines = doc.splitTextToSize(cleanTitle, G.contentW)
  titleLines.forEach((line, i) => {
    doc.text(line, G.margin, y + i * (T.h1 * 0.45))
  })
  y += titleLines.length * (T.h1 * 0.45) + 4

  // Propósito (subtítulo — usamos normal, no italic, para evitar kerning raro en helvetica)
  if (labPurpose) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(T.h3)
    setTextRGB(doc, C.muted)
    const cleanPurpose = sanitize(labPurpose)
    const purposeLines = doc.splitTextToSize(cleanPurpose, G.contentW)
    const lh = T.h3 * 0.5
    purposeLines.forEach((line, i) => {
      doc.text(line, G.margin, y + i * lh)
    })
    y += purposeLines.length * lh + 6
  }

  // Separador
  setStrokeRGB(doc, C.line)
  doc.setLineWidth(0.3)
  doc.line(G.margin, y, G.pageW - G.margin, y)
  y += 6

  // Info del estudiante (bloque compacto — 4 columnas en 1 fila)
  y = sectionLabel(doc, '01', 'Datos del estudiante', y)

  const infoBlockH = 14
  drawCard(doc, G.margin, y, G.contentW, infoBlockH, { fill: C.bg })

  const colWidth = G.contentW / 4
  const labels = ['Nombre', 'Curso', 'Colegio', 'Fecha']
  const values = [
    sanitize(studentInfo?.name) || '—',
    sanitize(studentInfo?.course) || '—',
    sanitize(studentInfo?.school) || '—',
    fecha,
  ]

  labels.forEach((label, i) => {
    const x = G.margin + 4 + i * colWidth
    setTextRGB(doc, C.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(T.tiny)
    doc.text(label.toUpperCase(), x, y + 4.5)

    setTextRGB(doc, C.ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(T.small)
    const value = String(values[i])
    // Truncar si excede el ancho de columna
    const maxW = colWidth - 6
    const truncated = doc.getTextWidth(value) > maxW
      ? value.slice(0, Math.floor(value.length * (maxW / doc.getTextWidth(value)))) + '…'
      : value
    doc.text(truncated, x, y + 10)
  })

  y += infoBlockH + 6

  /* ──────────────────── CONTEXTO DEL PROBLEMA ──────────────────── */

  if (contextSummary) {
    y = sectionLabel(doc, '02', 'Contexto del problema', y)
    y = drawParagraph(doc, contextSummary, y, { size: T.body, color: C.ink })
    y += 2
  }

  /* ──────────────────── GRÁFICOS ──────────────────── */

  if (graphs.length > 0) {
    // Calcular espacio necesario para el label + la PRIMERA gráfica juntos
    const firstMaxH = graphs.length > 1 ? 70 : 90
    const firstRatio = graphs[0].height / graphs[0].width
    const firstHeight = Math.min(firstMaxH, G.contentW * firstRatio)
    const groupNeeded = 8 + firstHeight + 4

    y = ensureSpace(doc, y, groupNeeded)
    y = sectionLabel(doc, '03', graphs.length > 1 ? 'Visualizaciones' : 'Visualización', y)

    graphs.forEach((g, i) => {
      y = insertImage(doc, g.dataUrl, y, {
        maxHeight: graphs.length > 1 ? 70 : 90,
        maxWidth: G.contentW,
        naturalWidth: g.width,
        naturalHeight: g.height,
      })
      if (i < graphs.length - 1) y += 2
    })
    y += 3
  }

  /* ──────────────────── MÉTRICAS ──────────────────── */

  if (metrics.length > 0) {
    // Label + al menos 2 filas de cards (si hay >=2 métricas)
    const metricCardH = 16
    const rowsNeeded = Math.min(Math.ceil(metrics.length / 2), 2)
    y = ensureSpace(doc, y, 8 + rowsNeeded * (metricCardH + 3))
    y = sectionLabel(doc, '04', 'Valores observados', y)

    // Grid 2 columnas
    const cardW = (G.contentW - 4) / 2
    const cardH = 16
    let col = 0
    metrics.forEach((m) => {
      const rowY = col === 0 ? y : y - cardH
      const x = col === 0 ? G.margin : G.margin + cardW + 4
      if (col === 0) y = ensureSpace(doc, y, cardH + 2)

      drawCard(doc, x, rowY, cardW, cardH, { fill: C.bg })

      setTextRGB(doc, C.muted)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(T.tiny)
      doc.text(m.label.toUpperCase(), x + 3, rowY + 4.5)

      setTextRGB(doc, C.ink)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(T.h3)
      const val = m.value.length > 18 ? m.value.slice(0, 16) + '…' : m.value
      doc.text(val, x + 3, rowY + 10)

      if (m.detail) {
        setTextRGB(doc, C.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.8)
        const detail = m.detail.length > 40 ? m.detail.slice(0, 38) + '…' : m.detail
        doc.text(detail, x + 3, rowY + 14)
      }

      if (col === 0) {
        col = 1
      } else {
        col = 0
        y += cardH + 3
      }
    })
    if (col === 1) y += cardH + 3
    y += 4
  }

  /* ──────────────────── MODELOS MATEMÁTICOS ──────────────────── */

  if (modelsRendered.length > 0) {
    // Reservar label + al menos 1 modelo completo
    const firstModel = modelsRendered[0]
    const firstImgH = firstModel.img
      ? Math.min((firstModel.img.height / firstModel.img.width) * (G.contentW - 10), 22)
      : 10
    const firstCardH = 10 + firstImgH + (firstModel.parameters ? 5 : 0) + (firstModel.conditions ? 5 : 0) + 4
    y = ensureSpace(doc, y, 8 + firstCardH)
    y = sectionLabel(doc, '05', 'Modelo matemático', y)

    for (const m of modelsRendered) {
      // Alto aproximado necesario
      const imgH = m.img ? Math.min((m.img.height / m.img.width) * (G.contentW - 10), 25) : 10
      const cardH = 10 + imgH + (m.parameters ? 5 : 0) + (m.conditions ? 5 : 0) + 4
      y = ensureSpace(doc, y, cardH + 3)

      drawCard(doc, G.margin, y, G.contentW, cardH, { fill: C.bg, border: C.line })

      setTextRGB(doc, C.accent)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(T.tiny)
      doc.text(m.title.toUpperCase(), G.margin + 4, y + 5)

      let localY = y + 8
      if (m.img) {
        const w = Math.min(m.img.width * 0.25, G.contentW - 10)
        const h = (m.img.height / m.img.width) * w
        const centerX = G.margin + (G.contentW - w) / 2
        doc.addImage(m.img.dataUrl, 'PNG', centerX, localY, w, h, undefined, 'FAST')
        localY += h + 2
      } else {
        // Fallback: texto con Unicode (super/sub-índices) si la captura falló
        setTextRGB(doc, C.ink)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(T.h3)
        doc.text(toUnicodeMath(m.expression), G.margin + 4, localY + 4)
        localY += 8
      }

      if (m.parameters) {
        setTextRGB(doc, C.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(T.small)
        const paramText = `Parámetros: ${m.parameters}`
        const lines = doc.splitTextToSize(paramText, G.contentW - 10)
        lines.forEach((line, i) => doc.text(line, G.margin + 4, localY + 3 + i * 3.5))
        localY += lines.length * 3.5 + 1
      }
      if (m.conditions) {
        setTextRGB(doc, C.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(T.small)
        const condText = `Condición: ${m.conditions}`
        const lines = doc.splitTextToSize(condText, G.contentW - 10)
        lines.forEach((line, i) => doc.text(line, G.margin + 4, localY + 3 + i * 3.5))
      }

      y += cardH + 3
    }
    y += 2
  }

  /* ──────────────────── TABLA DE DATOS (COMPLETA, CON PAGINACIÓN) ──────────────────── */

  if (dataTable && dataTable.rows.length > 0) {
    // Reservar label + encabezado + al menos 3 filas juntas
    y = ensureSpace(doc, y, 8 + 8 + 3 * 6)
    y = sectionLabel(doc, '06', `Datos observados · ${dataTable.rows.length} filas`, y)

    const colCount = dataTable.headers.length
    const colW = G.contentW / colCount
    const headerH = 8
    const rowHeight = 6

    // Encabezado
    setFillRGB(doc, C.ink)
    doc.rect(G.margin, y, G.contentW, headerH, 'F')
    setTextRGB(doc, [255, 255, 255])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(T.tiny)
    dataTable.headers.forEach((h, i) => {
      const isNumeric = i > 0
      const textX = isNumeric ? G.margin + (i + 1) * colW - 2 : G.margin + i * colW + 3
      const align = isNumeric ? 'right' : 'left'
      doc.text(h, textX, y + 5.5, { align })
    })
    y += headerH

    // Filas
    dataTable.rows.forEach((row, rIdx) => {
      // Nueva página si no cabe
      if (y + rowHeight > G.safeBottom) {
        doc.addPage()
        y = G.margin + 10
        // Repetir encabezado
        setFillRGB(doc, C.ink)
        doc.rect(G.margin, y, G.contentW, headerH, 'F')
        setTextRGB(doc, [255, 255, 255])
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(T.tiny)
        dataTable.headers.forEach((h, i) => {
          const isNumeric = i > 0
          const textX = isNumeric ? G.margin + (i + 1) * colW - 2 : G.margin + i * colW + 3
          const align = isNumeric ? 'right' : 'left'
          doc.text(h, textX, y + 5.5, { align })
        })
        y += headerH
      }

      // Alternar fondo
      if (rIdx % 2 === 0) {
        setFillRGB(doc, C.bgAlt)
        doc.rect(G.margin, y, G.contentW, rowHeight, 'F')
      }

      setTextRGB(doc, C.ink)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(T.tiny)
      row.forEach((cell, i) => {
        const isNumeric = i > 0
        const text = String(cell).length > 18 ? String(cell).slice(0, 16) + '…' : String(cell)
        const textX = isNumeric ? G.margin + (i + 1) * colW - 2 : G.margin + i * colW + 3
        const align = isNumeric ? 'right' : 'left'
        doc.text(text, textX, y + 4, { align })
      })
      y += rowHeight
    })
    y += 6
  }

  /* ──────────────────── REFLEXIÓN DEL ESTUDIANTE ──────────────────── */

  const prompts = [
    '¿Qué variables controlaste y cuáles observaste? ¿Por qué elegiste ese rango?',
    '¿Qué patrón matemático observaste y cómo lo describirías con palabras?',
    '¿Qué limitaciones tiene el modelo? ¿Qué supuestos hiciste?',
  ]

  // Reservar label + al menos la primera pregunta + 3 líneas
  y = ensureSpace(doc, y, 8 + 12 + 15)
  y = sectionLabel(doc, '07', 'Análisis y reflexión', y)

  prompts.forEach((prompt, i) => {
    const response = (reflections[i] || '').trim()

    setTextRGB(doc, C.ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(T.small)
    y = ensureSpace(doc, y, 7)
    doc.text(`${i + 1}.`, G.margin, y)
    doc.setFont('helvetica', 'italic')
    setTextRGB(doc, C.muted)
    const promptLines = doc.splitTextToSize(prompt, G.contentW - 6)
    promptLines.forEach((line, li) => {
      doc.text(line, G.margin + 6, y + li * 4)
    })
    y += promptLines.length * 4 + 2

    if (response) {
      // Caja de respuesta del estudiante
      setTextRGB(doc, C.ink)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(T.body)
      const responseLines = doc.splitTextToSize(response, G.contentW - 6)
      responseLines.forEach((line, li) => {
        y = ensureSpace(doc, y, 5)
        doc.text(line, G.margin + 6, y + li * 4.5)
      })
      y += responseLines.length * 4.5 + 4
    } else {
      // Líneas en blanco para escribir a mano
      setStrokeRGB(doc, C.soft)
      doc.setLineWidth(0.15)
      for (let ln = 0; ln < 3; ln++) {
        y = ensureSpace(doc, y, 5)
        doc.line(G.margin + 6, y + 3, G.pageW - G.margin, y + 3)
        y += 5
      }
      y += 3
    }
  })

  /* ──────────────────── HEADER / FOOTER en TODAS las páginas ──────────────────── */

  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    // Header/footer solo en páginas 2+; la portada tiene su propia marca superior
    drawHeaderFooter(doc, { labTitle, pageNum: p, totalPages, skipHeader: p === 1 })
  }

  /* ──────────────────── DESCARGA (o preview en dev) ──────────────────── */

  const safeFilename = filename || `${(labTitle || 'laboratorio').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-mathmodels.pdf`

  // Modo debug: si window.__PDF_PREVIEW__ está activo, en lugar de descargar
  // muestra el PDF en un iframe overlay. Solo útil para tests visuales.
  if (typeof window !== 'undefined' && window.__PDF_PREVIEW__) {
    const blobUrl = doc.output('bloburl')
    let overlay = document.getElementById('__pdf_preview_overlay__')
    if (overlay) overlay.remove()
    overlay = document.createElement('div')
    overlay.id = '__pdf_preview_overlay__'
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;flex-direction:column'
    overlay.innerHTML = `
      <div style="display:flex;justify-content:space-between;padding:12px;background:#1a1a1a;color:white;font-family:sans-serif;font-size:13px">
        <span>📄 PDF Preview — ${safeFilename}</span>
        <button onclick="document.getElementById('__pdf_preview_overlay__').remove()" style="background:#ef4444;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer">Cerrar</button>
      </div>
      <iframe src="${blobUrl}" style="flex:1;width:100%;border:0;background:white"></iframe>
    `
    document.body.appendChild(overlay)
    window.__LAST_PDF_URL__ = blobUrl
    return
  }

  doc.save(safeFilename)
}

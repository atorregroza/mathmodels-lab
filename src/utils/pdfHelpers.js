/**
 * Helpers para generación de PDF profesional.
 *
 * Estrategias de captura:
 * - renderKatexToImage: KaTeX → HTML offscreen → html2canvas → PNG dataURL
 * - captureElementToImage: cualquier elemento del DOM → html2canvas → PNG dataURL
 *
 * Todas las funciones devuelven una Promise<string> con el dataURL 'image/png'
 * listo para inyectar en jsPDF con doc.addImage().
 */
import html2canvas from 'html2canvas'

const OFFSCREEN_ID = '__pdf_offscreen_stage__'

/** Asegura un contenedor offscreen para renderizar temporalmente. */
const ensureStage = () => {
  let stage = document.getElementById(OFFSCREEN_ID)
  if (!stage) {
    stage = document.createElement('div')
    stage.id = OFFSCREEN_ID
    stage.style.cssText = [
      'position:fixed',
      'left:-99999px',
      'top:0',
      'width:auto',
      'height:auto',
      'background:white',
      'color:black',
      'font-family:"Helvetica","Arial",sans-serif',
      'pointer-events:none',
      'z-index:-1',
    ].join(';')
    document.body.appendChild(stage)
  }
  return stage
}

/**
 * Captura un elemento KaTeX (.math-render ya renderizado en el DOM) como PNG.
 *
 * Estrategia: clonar el elemento a un stage aislado (para evitar que html2canvas
 * tenga que procesar toda la página), esperar a que las fuentes KaTeX estén listas,
 * y capturar.
 *
 * Precondición clave: document.fonts.ready debe resolver antes de capturar,
 * sino html2canvas renderiza texto plano en lugar de KaTeX.
 *
 * @param {HTMLElement} element — elemento .math-render
 * @param {object} options
 * @param {number} options.scale — escala de captura (default 3 = alta DPI)
 * @returns {Promise<{dataUrl:string, width:number, height:number} | null>}
 */
export const captureKatexElement = async (element, { scale = 3, timeoutMs = 6000 } = {}) => {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  if (rect.width < 5 || rect.height < 5) return null

  // Clonar a stage aislado — evita que html2canvas procese la página entera
  const stage = ensureStage()
  const clone = element.cloneNode(true)
  clone.style.display = 'inline-block'
  clone.style.background = 'white'
  clone.style.padding = '4px 8px'
  clone.style.fontSize = window.getComputedStyle(element).fontSize
  clone.style.color = '#17181c'
  stage.appendChild(clone)

  const cleanup = () => {
    if (clone.parentNode) stage.removeChild(clone)
  }

  try {
    if (document.fonts && document.fonts.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error('fonts timeout')), 2000)),
      ]).catch(() => {})
    }

    const capture = html2canvas(clone, {
      scale,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: false,
      removeContainer: true,
    })
    const canvas = await Promise.race([
      capture,
      new Promise((_, rej) => setTimeout(() => rej(new Error('html2canvas timeout')), timeoutMs)),
    ])
    cleanup()
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width / scale,
      height: canvas.height / scale,
    }
  } catch (err) {
    console.warn('[PDF] KaTeX capture failed, using Unicode fallback:', err?.message)
    cleanup()
    return null
  }
}

/**
 * Mapea notación informal a Unicode limpio (para usar como texto plano en jsPDF).
 * Usado como fallback si la captura de KaTeX falla o está desactivada.
 */
export const toUnicodeMath = (expression) => {
  if (!expression) return ''
  let s = String(expression)
  // Ya viene mayormente renderizado del DOM (textContent de KaTeX);
  // solo aseguramos algunos reemplazos comunes.
  s = s.replace(/\^(\d)/g, (_, d) => {
    const superDigits = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']
    return superDigits[Number(d)]
  })
  s = s.replace(/_(\d)/g, (_, d) => {
    const subDigits = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']
    return subDigits[Number(d)]
  })
  // Comprimir múltiples espacios (KaTeX a veces agrega espacios finos)
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/**
 * Captura un elemento del DOM a PNG data URL.
 * Útil para gráficas SVG, tablas, cards complejas.
 *
 * @param {HTMLElement} element
 * @param {object} options
 * @param {number} options.scale — escala de captura (default 2)
 * @param {string} options.backgroundColor — fondo (default '#ffffff'; usa 'transparent' para conservar dark mode)
 * @param {number} options.maxWidth — si la captura excede, reescala el elemento antes de capturar
 * @returns {Promise<{dataUrl:string, width:number, height:number}>}
 */
export const captureElementToImage = async (
  element,
  { scale = 2, backgroundColor = '#ffffff', maxWidth = null } = {}
) => {
  if (!element) throw new Error('captureElementToImage: element is null')

  const rect = element.getBoundingClientRect()
  const effectiveScale = maxWidth && rect.width > maxWidth ? (maxWidth / rect.width) * scale : scale

  const canvas = await html2canvas(element, {
    scale: effectiveScale,
    backgroundColor,
    logging: false,
    useCORS: true,
    allowTaint: false,
  })
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width / effectiveScale,
    height: canvas.height / effectiveScale,
  }
}

/**
 * Captura un SVG a PNG. Robusto: timeout, downsizing agresivo, darkmode→lightmode.
 *
 * @param {SVGElement} svgEl
 * @param {object} options
 * @param {string} options.backgroundColor — default '#ffffff' (blanco para PDF)
 * @param {number} options.targetWidth — ancho máx de salida en px (default 1100)
 * @param {number} options.timeoutMs — timeout total (default 5000)
 * @returns {Promise<{dataUrl:string, width:number, height:number} | null>}
 */
export const captureSvgToImage = (svgEl, {
  backgroundColor = '#ffffff',
  targetWidth = 1100,
  timeoutMs = 5000,
} = {}) => {
  return new Promise((resolve) => {
    if (!svgEl) { resolve(null); return }
    let settled = false
    const done = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }
    const timer = setTimeout(() => done(null), timeoutMs)

    try {
      const clone = svgEl.cloneNode(true)
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      const vb = svgEl.getAttribute('viewBox')

      // Dimensiones de salida (cap a targetWidth; mantener aspecto)
      const srcRect = svgEl.getBoundingClientRect()
      const srcW = (vb && vb.split(/\s+/).map(Number)[2]) || srcRect.width || targetWidth
      const srcH = (vb && vb.split(/\s+/).map(Number)[3]) || srcRect.height || targetWidth
      const scale = Math.min(1, targetWidth / srcW)
      const w = Math.round(srcW * scale)
      const h = Math.round(srcH * scale)
      clone.setAttribute('width', String(w))
      clone.setAttribute('height', String(h))

      // Normalizar colores: dark → light (texto blanco → oscuro; líneas blancas → gris)
      clone.querySelectorAll('text').forEach((t) => {
        const fill = window.getComputedStyle(t).fill || t.getAttribute('fill')
        if (!fill || fill === 'rgb(255, 255, 255)' || (fill.includes('rgb') && fill.includes('255'))) {
          t.setAttribute('fill', '#17181c')
        }
      })
      clone.querySelectorAll('line, path').forEach((el) => {
        const stroke = el.getAttribute('stroke') || ''
        if (stroke.includes('255') && stroke.includes('rgb')) {
          const opacity = parseFloat(el.getAttribute('stroke-opacity') || '1')
          const gray = opacity > 0.5 ? 40 : 180
          el.setAttribute('stroke', `rgb(${gray},${gray},${gray})`)
        }
      })

      const data = new XMLSerializer().serializeToString(clone)
      const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = backgroundColor
          ctx.fillRect(0, 0, w, h)
          ctx.drawImage(img, 0, 0, w, h)
          URL.revokeObjectURL(url)
          clearTimeout(timer)
          done({ dataUrl: canvas.toDataURL('image/png'), width: w, height: h })
        } catch {
          URL.revokeObjectURL(url)
          clearTimeout(timer)
          done(null)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        clearTimeout(timer)
        done(null)
      }
      img.src = url
    } catch {
      clearTimeout(timer)
      done(null)
    }
  })
}

/**
 * Persistencia de datos del estudiante en localStorage.
 * Así no tiene que rellenar cada vez que exporta.
 */
const STORAGE_KEY = 'mathmodels:student-info'

export const loadStudentInfo = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const saveStudentInfo = (info) => {
  try {
    const sanitized = {
      name: String(info.name ?? '').trim(),
      course: String(info.course ?? '').trim(),
      school: String(info.school ?? '').trim(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
  } catch {
    // localStorage puede fallar en modo privado; silenciamos
  }
}

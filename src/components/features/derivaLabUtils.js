export const format = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (n % 1 === 0) return String(Math.round(n))
  return n.toFixed(2)
}

export const downloadCsv = (rows, filename) => {
  const csv = `\uFEFF${rows.map((row) => row.join(',')).join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const sampleRange = (min, max, count, fn) => (
  Array.from({ length: count }, (_, index) => {
    const x = min + (((max - min) * index) / (count - 1))
    const y = fn(x)

    return Number.isFinite(y) ? { x, y } : null
  }).filter(Boolean)
)

export const linePath = (points, scaleX, scaleY) => (
  points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.y)}`).join(' ')
)

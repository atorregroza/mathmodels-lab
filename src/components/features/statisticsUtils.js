/* ── statisticsUtils.js ── pure statistics functions ── */

// ─── Parsing ────────────────────────────────────────────
export function parseUnivariateInput(text) {
  if (!text.trim()) return [];
  return text
    .split(/[,\s\n\r]+/)
    .map(s => s.trim())
    .filter(s => s !== '')
    .map(Number)
    .filter(v => !Number.isNaN(v));
}

export function parseBivariateInput(xText, yText) {
  const xs = parseUnivariateInput(xText);
  const ys = parseUnivariateInput(yText);
  if (xs.length === 0 || ys.length === 0) return { xs: [], ys: [], error: null };
  if (xs.length !== ys.length)
    return { xs: [], ys: [], error: `x tiene ${xs.length} valores, y tiene ${ys.length}` };
  return { xs, ys, error: null };
}

// ─── Univariate ─────────────────────────────────────────
export const count = d => d.length;
export const sum   = d => d.reduce((a, b) => a + b, 0);
export const mean  = d => (d.length ? sum(d) / d.length : 0);

export function median(d) {
  if (!d.length) return 0;
  const s = [...d].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mode(d) {
  if (!d.length) return [];
  const freq = {};
  d.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  const maxF = Math.max(...Object.values(freq));
  if (maxF === 1) return []; // no mode
  return Object.keys(freq).filter(k => freq[k] === maxF).map(Number);
}

export const variancePop    = d => { const m = mean(d); return d.length ? d.reduce((a, v) => a + (v - m) ** 2, 0) / d.length : 0; };
export const varianceSample = d => { const m = mean(d); return d.length > 1 ? d.reduce((a, v) => a + (v - m) ** 2, 0) / (d.length - 1) : 0; };
export const stdDevPop      = d => Math.sqrt(variancePop(d));
export const stdDevSample   = d => Math.sqrt(varianceSample(d));

export const min   = d => (d.length ? Math.min(...d) : 0);
export const max   = d => (d.length ? Math.max(...d) : 0);
export const range = d => max(d) - min(d);

export function quartile(d, q) {
  if (!d.length) return 0;
  const s = [...d].sort((a, b) => a - b);
  const idx = q * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export const q1  = d => quartile(d, 0.25);
export const q3  = d => quartile(d, 0.75);
export const iqr = d => q3(d) - q1(d);

export function fiveNumberSummary(d) {
  return { min: min(d), q1: q1(d), median: median(d), q3: q3(d), max: max(d) };
}

// ─── Histogram bins (Sturges' rule) ─────────────────────
export function histogramBins(data, nBins) {
  if (!data.length) return [];
  const lo = min(data), hi = max(data);
  const k = nBins || Math.max(1, Math.ceil(1 + 3.322 * Math.log10(data.length)));
  const w = (hi - lo) / k || 1;
  const bins = Array.from({ length: k }, (_, i) => ({
    start: lo + i * w,
    end:   lo + (i + 1) * w,
    count: 0,
  }));
  data.forEach(v => {
    let idx = Math.floor((v - lo) / w);
    if (idx >= k) idx = k - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  });
  return bins;
}

// ─── Bivariate ──────────────────────────────────────────
export function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2) return { a: 0, b: 0 };
  const sx  = sum(xs), sy = sum(ys);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sx2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sx2 - sx * sx;
  if (Math.abs(denom) < 1e-12) return { a: mean(ys), b: 0 };
  const b = (n * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / n;
  return { a, b };
}

export function pearsonR(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const sx = sum(xs), sy = sum(ys);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sx2 = xs.reduce((a, x) => a + x * x, 0);
  const sy2 = ys.reduce((a, y) => a + y * y, 0);
  const num   = n * sxy - sx * sy;
  const denom = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
  return Math.abs(denom) < 1e-12 ? 0 : num / denom;
}

export const rSquared = (xs, ys) => pearsonR(xs, ys) ** 2;

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

// ─── Normal Distribution ───────────────────────────────

/** Error function approximation (Abramowitz & Stegun 7.1.26, max error ~1.5×10⁻⁷) */
function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

/** Standard normal CDF: Φ(z) = P(Z ≤ z) */
export function normalStdCDF(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Normal CDF: P(X ≤ x) for X ~ N(μ, σ²) */
export function normalCDF(x, mu, sigma) {
  if (sigma <= 0) return NaN;
  return normalStdCDF((x - mu) / sigma);
}

/** Normal PDF: f(x) for X ~ N(μ, σ²) */
export function normalPDF(x, mu, sigma) {
  if (sigma <= 0) return NaN;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Inverse normal CDF (rational approximation, Beasley-Springer-Moro) */
export function normalInvCDF(p, mu = 0, sigma = 1) {
  if (p <= 0 || p >= 1 || sigma <= 0) return NaN;
  // Rational approx for standard normal quantile
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
             1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
             6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
             -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
             3.754408661907416e0];

  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r, z;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    z = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
        ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    z = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
        (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
         ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }

  return mu + sigma * z;
}

// ─── Binomial Distribution ─────────────────────────────

/** Binomial coefficient C(n, k) */
export function binomCoeff(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let r = 1;
  for (let i = 0; i < k; i++) {
    r = r * (n - i) / (i + 1);
  }
  return Math.round(r);
}

/** Binomial PMF: P(X = k) for X ~ Bin(n, p) */
export function binomPMF(k, n, p) {
  if (k < 0 || k > n || p < 0 || p > 1) return 0;
  return binomCoeff(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

/** Binomial CDF: P(X ≤ k) for X ~ Bin(n, p) */
export function binomCDF(k, n, p) {
  if (k < 0) return 0;
  if (k >= n) return 1;
  let s = 0;
  for (let i = 0; i <= Math.floor(k); i++) s += binomPMF(i, n, p);
  return Math.min(s, 1);
}

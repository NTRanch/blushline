// kernel.mjs — Blushline numerical kernel, JS transliteration.
// Transliteration of core/kernel.mojo (the reference implementation),
// operation for operation, constant for constant. The Mojo source is the
// single source of truth; conformance/vectors.json is the contract and
// tools/conformance.mjs is the gate. Any intentional change lands in the
// Mojo reference first, the vectors regenerate, this file follows.
// Discipline: tiger-style-typescript applied to plain .mjs — contracts on
// every export, named bounds, no hidden state, fail-closed numerics.

// --- constants (mirror kernel.mojo; alphabetical) ---
export const ACCUMULATE_PER_STIMULUS = 0.16;
export const BLUSH_RATE_FALL_PER_STEP = 0.0078125; // 1/128 per 16 ms step
export const BLUSH_RATE_RISE_PER_STEP = 0.03125; // 1/32 per 16 ms step
export const CHANNEL_AWAY = 1;
export const CHANNEL_DOWNCAST = 2;
export const CHANNEL_INVALID = -1;
export const CHANNEL_TOWARD = 0;
export const DISC_RADIUS_UNITS = 40;
export const GAZE_DOWNCAST_MIN_NY = 0.45;
export const GAZE_TOWARD_MAX_M = 0.3;
export const LEVEL_COUNT = 3;
export const SENSITIVITY_MAX = 2;
export const TIER_T1_MIN = 0.25;
export const TIER_T2_MIN = 0.55;

// --- scalar hygiene ---
// Fail-closed: NaN and +/-inf become 0.0. A channel that cannot be
// computed reads as rest, never as a spurious peak.
export function sanitize(x) {
  if (typeof x !== "number" || x !== x || x > 1e308 || x < -1e308) return 0;
  return x;
}

export function clamp01(x) {
  const v = sanitize(x);
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function clampRange(x, lo, hi) {
  const v = sanitize(x);
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

// --- blush response curve and session dynamics ---
// Saturating cubic 1 - (1 - x)^3: no transcendentals in the live path,
// so the transliteration is bit-reproducible against the reference.
export function blushCurve(x) {
  const t = clamp01(x);
  const u = 1 - t;
  return 1 - u * u * u;
}

export function blushTarget(sessionStimulus, sensitivity) {
  const s = clamp01(sessionStimulus);
  const k = clampRange(sensitivity, 0, SENSITIVITY_MAX);
  return blushCurve(clamp01(s * k));
}

export function blushStep(current, target) {
  const c = clamp01(current);
  const t = clamp01(target);
  const rate = t < c ? BLUSH_RATE_FALL_PER_STEP : BLUSH_RATE_RISE_PER_STEP;
  return clamp01(c + (t - c) * rate);
}

export function accumulate(sessionStimulus, stationStimulus) {
  return clamp01(clamp01(sessionStimulus) + clamp01(stationStimulus) * ACCUMULATE_PER_STIMULUS);
}

// --- gaze channels: ratified section 1.7 full-disc-centre definition ---
// The scored quantity is the full iris-disc centre displacement,
// normalised by the disc radius. Downcast is tested first on the
// normalised downward offset; then magnitude decides toward vs away.
// Unreadable geometry returns CHANNEL_INVALID (-1), never a verdict.
function gazeValid(dx, dy, radius) {
  if (typeof radius !== "number" || radius !== radius || radius > 1e308 || radius <= 0) return false;
  if (typeof dx !== "number" || typeof dy !== "number") return false;
  if (dx !== dx || dy !== dy) return false;
  if (dx > 1e308 || dx < -1e308 || dy > 1e308 || dy < -1e308) return false;
  return true;
}

export function gazeMagnitude(dx, dy, radius) {
  if (!gazeValid(dx, dy, radius)) return -1;
  return Math.sqrt(dx * dx + dy * dy) / radius;
}

export function gazeChannel(dx, dy, radius) {
  if (!gazeValid(dx, dy, radius)) return CHANNEL_INVALID;
  const ny = dy / radius;
  if (ny >= GAZE_DOWNCAST_MIN_NY) return CHANNEL_DOWNCAST;
  if (gazeMagnitude(dx, dy, radius) <= GAZE_TOWARD_MAX_M) return CHANNEL_TOWARD;
  return CHANNEL_AWAY;
}

export function gazeScore(dx, dy, radius) {
  const m = gazeMagnitude(dx, dy, radius);
  if (m < 0) return -1;
  return clamp01(1 - m);
}

// Deterministic iris offset (kernel units) for a scripted channel,
// derived by integer arithmetic on one RNG stream value. Channel-
// correct by construction; see kernel.mojo for the range proof.
export function gazeStimulus(value, channel) {
  const v = value >>> 0;
  if (channel === CHANNEL_AWAY) {
    const mag = 20 + (v % 13);
    const dx = ((v >>> 8) & 1) === 1 ? -mag : mag;
    return [dx, ((v >>> 4) % 11) - 5];
  }
  if (channel === CHANNEL_DOWNCAST) {
    return [((v >>> 3) % 11) - 5, 20 + (v % 15)];
  }
  return [(v % 13) - 6, ((v >>> 4) % 9) - 4];
}

// --- arousal-engine low-tier coupling (low tiers only; T3/T4 never) ---
export function tierOf(blush) {
  const b = clamp01(blush);
  if (b >= TIER_T2_MIN) return 2;
  if (b >= TIER_T1_MIN) return 1;
  return 0;
}

// --- deterministic RNG: splitmix32, integer-exact (Math.imul) ---
// Returns [newState, value]. Same stream as the Mojo reference.
export function rngNext(state) {
  const s = (state + 0x9e3779b9) >>> 0;
  let z = s;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  return [s, (z ^ (z >>> 15)) >>> 0];
}

// --- measurement schedule (mirrors the kernel.mojo schedule scalars;
// station names/units are presentation data and live here only) ---
export const LEVELS = [
  { fitTarget: 55, name: "FIRST FITTING", sensitivity: 1.0, stations: 4, tierTarget: 1, window: 0.34 },
  { fitTarget: 65, name: "THE THOROUGH CHECK", sensitivity: 1.25, stations: 6, tierTarget: 2, window: 0.26 },
  { fitTarget: 75, name: "MADE TO MEASURE", sensitivity: 1.5, stations: 8, tierTarget: 2, window: 0.19 },
];

// Per-station fitting data. gazeClass rotates the scripted channel the
// station is built around; intimate stations feed the revelation meter.
export const STATIONS = [
  { base: 168.2, gazeClass: 0, intimate: false, name: "POSTURE", unit: "CM" },
  { base: 38.6, gazeClass: 1, intimate: false, name: "SHOULDER", unit: "CM" },
  { base: 88.4, gazeClass: 2, intimate: true, name: "BUST LINE", unit: "CM" },
  { base: 61.2, gazeClass: 1, intimate: false, name: "WAIST", unit: "CM" },
  { base: 92.8, gazeClass: 2, intimate: true, name: "HIP LINE", unit: "CM" },
  { base: 74.5, gazeClass: 0, intimate: false, name: "INSEAM", unit: "CM" },
  { base: 42.1, gazeClass: 2, intimate: true, name: "BACK LENGTH", unit: "CM" },
  { base: 18.9, gazeClass: 1, intimate: false, name: "HEM RISE", unit: "CM" },
];

export function levelSchedule(level) {
  if (!Number.isInteger(level) || level < 0 || level >= LEVEL_COUNT) return null;
  return LEVELS[level];
}

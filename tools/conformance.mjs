// conformance.mjs — the Mojo-kernel contract gate. Runs the shipped JS
// transliteration (core/kernel.mjs) against every golden vector in
// conformance/vectors.json. The vectors are the contract of record for
// core/kernel.mojo (see conformance/README.md for their derivation);
// a breach fails the build exactly like a failed test anywhere else.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  accumulate, blushCurve, blushStep, blushTarget, gazeChannel, gazeScore,
  gazeStimulus, levelSchedule, rngNext, tierOf,
} from "../core/kernel.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vectors = JSON.parse(readFileSync(join(root, "conformance/vectors.json"), "utf8"));
const tol = vectors.tolerance?.abs ?? 1e-12;

let checked = 0;
let failures = 0;
function near(a, b) {
  return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;
}
function check(label, got, want) {
  checked++;
  const ok = typeof want === "number" && !Number.isInteger(want) ? near(got, want) : got === want;
  if (!ok) {
    failures++;
    console.error(`conformance: ${label}: got ${got}, want ${want}`);
  }
}
function checkVec(label, got, want) {
  checked++;
  const ok = Array.isArray(got) && got.length === want.length
    && got.every((g, i) => (Number.isInteger(want[i]) ? g === want[i] : near(g, want[i])));
  if (!ok) {
    failures++;
    console.error(`conformance: ${label}: got [${got}], want [${want}]`);
  }
}

for (const c of vectors.blush_curve) check(`blush_curve(${c.in})`, blushCurve(c.in), c.out);
for (const c of vectors.blush_target) check(`blush_target(${c.in})`, blushTarget(c.in[0], c.in[1]), c.out);
for (const seq of vectors.blush_step_seq) {
  let cur = seq.start;
  seq.out.forEach((want, i) => {
    cur = blushStep(cur, seq.target);
    check(`blush_step_seq(start=${seq.start},target=${seq.target})[${i}]`, cur, want);
  });
}
for (const c of vectors.accumulate) check(`accumulate(${c.in})`, accumulate(c.in[0], c.in[1]), c.out);
for (const c of vectors.gaze_channel) check(`gaze_channel(${c.in})`, gazeChannel(c.in[0], c.in[1], c.in[2]), c.out);
for (const c of vectors.gaze_score) check(`gaze_score(${c.in})`, gazeScore(c.in[0], c.in[1], c.in[2]), c.out);
for (const c of vectors.tier_of) check(`tier_of(${c.in})`, tierOf(c.in), c.out);
for (const c of vectors.gaze_stimulus) checkVec(`gaze_stimulus(${c.in})`, gazeStimulus(c.in[0], c.in[1]), c.out);
for (const stream of vectors.rng_stream) {
  let state = stream.seed >>> 0;
  stream.out.forEach((want, i) => {
    const [next, value] = rngNext(state);
    state = next;
    check(`rng_stream(seed=${stream.seed})[${i}]`, value, want);
  });
}
for (const row of vectors.level_schedule) {
  const s = levelSchedule(row.level);
  check(`level_schedule(${row.level}).stations`, s?.stations, row.stations);
  check(`level_schedule(${row.level}).window`, s?.window, row.window);
  check(`level_schedule(${row.level}).sensitivity`, s?.sensitivity, row.sensitivity);
  check(`level_schedule(${row.level}).tierTarget`, s?.tierTarget, row.tier_target);
  check(`level_schedule(${row.level}).fitTarget`, s?.fitTarget, row.fit_target);
}

if (failures) {
  console.error(`conformance: ${failures}/${checked} vector checks FAILED`);
  process.exit(1);
}
console.log(`conformance: ${checked}/${checked} vector checks pass (tolerance abs ${tol})`);

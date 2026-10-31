# Port-Back — Blushline

Filed at the week's close (v1.0.0, 2026-10-30). The full note is
`docs/PORT-BACK.md` in this repo; this chapter is the book's copy of
record.

- **Verdict:** Plays. Measured channel curves DO read as character:
  the blush ramp across a session (slow session accumulation, fast
  rise / slow fall on the face) plus the §1.7 gaze verdicts make the
  report phase — a reading, a gaze line, a steady line — land as a
  beat of dialogue rather than a score screen. The demo playtest
  completes all three fittings with fit 96–98 and T2 reached in each.
- **Numbers:** Blush curve `1 - (1 - x)^3`; accumulate gain 0.16 per
  unit stimulus; step rates 1/32 rise, 1/128 fall per 16 ms step;
  tier thresholds T1 0.25 / T2 0.55 (inclusive at the bottom). Gaze:
  downcast at normalised dy >= 0.45 (tested first), toward at centre
  magnitude <= 0.30, else away; invalid geometry returns a sentinel,
  never a verdict. Conformance: 100 vector checks at 1e-12. Perf:
  0.001 ms/step, 32 KB single-file page.
- **Language verdict (Mojo):** The kernel was the cheapest part of
  the week — one small file of pure functions under explicit
  contracts. The real cost is the conformance discipline, front-loaded:
  with no Mojo toolchain in the sandbox, the golden vectors were
  derived from the formulas by an independent exact-arithmetic
  implementation (~an hour of care) so the harness means something.
  The transliteration was then mechanical and the harness caught
  nothing. Mojo stays in the rotation for measurement-and-model
  weeks; the vector file, not the source, is the artifact that
  survives stdlib churn.
- **Breakage:** `docs/BREAKAGE-LOG.md` — B-1 the Mojo-not-executed
  honesty record, B-2 preview text overflow (found by the D-221
  frame inspection, fixed, re-inspected PASS), B-4/B-5 the held
  seahawk and GJ-07 legs.
- **§9 transfer filing:** SFW-labelled technique filed for transfer —
  the channel response-curve stack (curve / accumulator / step
  integrator / tier thresholds), the §1.7 gaze scorer + integer
  stimulus derivation, and the measurement-readout UI pattern
  (reading / gaze line / steady line as scene text). NSFW-pure
  material (the fitting scenario and Alma's station content) stays
  in this lane and is not filed.

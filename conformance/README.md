# Conformance harness — Blushline

The shipped game logic is a JS transliteration (`core/kernel.mjs`) of the
Mojo reference kernel (`core/kernel.mojo`). This harness proves the
transliteration honours the kernel's contract:

1. `conformance/vectors.json` holds the golden vectors — inputs and the
   outputs the kernel's formulas produce.
2. `tools/conformance.mjs` runs the JS transliteration on every vector.
3. Comparison is at absolute tolerance **1e-12** (stated in the vector
   file). Every vector case was chosen to be exact in Float64 (dyadic
   rationals for the curve family, Pythagorean triples for gaze
   magnitudes, integers for the RNG and stimuli), so the gate is
   effectively exact; the tolerance exists for the sqrt cases only.
   Any breach fails the build and is filed in the breakage log.

## How the vectors were derived (and the honest limit)

No Mojo toolchain is installed in the build sandbox, and none was
executed for v1.0 (see `docs/BREAKAGE-LOG.md`, entry B-1). The vectors
were therefore derived from the kernel's formulas by an **independent
implementation in Python** — arbitrary-precision integer arithmetic for
the splitmix32 stream and the gaze stimuli, exact rationals
(`fractions.Fraction`) for the curve, step sequences, thresholds and
channel boundaries — never by running the JS under test. Spot values
were additionally hand-checked (e.g. `blush_curve(0.25) = 1 - 0.75^3 =
0.578125`).

The durable contract is the vector file, not either implementation
(engine research chapter, §2h). When a Mojo toolchain is available:
regenerate the vectors by executing `core/kernel.mojo` with the pinned
compiler (pixi.toml), diff against this file, and treat any difference
as a kernel bug report, not a vector edit.

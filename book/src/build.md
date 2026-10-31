# Build & Delivery — Blushline

**Language:** Mojo (tiger-style-mojo)

**Delivery shape:** Named seam: Mojo has no credible browser/wasm target. Mojo authors the numerical kernel as the reference implementation, generates the entry's data tables, and ships a JS transliteration checked against the Mojo reference by a conformance test. Toolchain home: sandbox.

**As built at v1.0.0 (2026-10-30):**

- Kernel of record: `core/kernel.mojo` (the scaffold's stub at
  `src/kernel.mojo` was superseded by the program contract's layout,
  `core/` + `conformance/`). Compiler pin of record: mojo 0.25.6.1
  (`pixi.toml`). The kernel was **not executed** in the build sandbox
  — no Mojo toolchain is installed there; see breakage B-1.
- Shipped core: `core/kernel.mjs` (transliteration) + `web/game.mjs`
  (the fitting), inlined into `web/index.html` by
  `tools/assemble.mjs`. No wasm crosses any boundary on this route.
- Contract: `conformance/vectors.json`, derived independently of the
  JS under test (`conformance/README.md`); gate:
  `node tools/conformance.mjs` (100 checks, tolerance 1e-12).
- Gates (`just check`, recipes in the justfile): conformance, unit
  tests (`node tests/run.mjs`, 22 tests, half validation / half
  adversarial), assemble, settings bridge, perf budget, scripted
  demo playtest of all three levels.
- Previews (`just previews`): `tools/capture.mjs` steps the shipped
  JS core in demo mode and renders `docs/previews/level-<n>-blushline.mp4`.

**Jam rule:** one self-contained `index.html`, ≥6 screens (Title / Pause /
How to Play / Gameplay / Settings / Game Over-or-Victory), documented
process (GAMEOTRON orchestrates; the language build chain is part of the
documentation). As shipped: 8 screens (18+ gate first).

**Book:** `mdbook build book` renders this planning book to `book/html/`
with the NTRanch theme (dark background, hot pink).

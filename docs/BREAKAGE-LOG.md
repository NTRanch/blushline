# Breakage log — Blushline

Every breakage found in playtest or build lands here with: what broke, the
evidence, the bloch attempt id, and the fix or the filed finding. Copied to
bloch at the week's close (the log is the input, bloch is the record).

## 2026-10-30 — v1.0 build (sandbox)

- **B-1 (honesty record, not a defect): the Mojo kernel was not
  executed.** No Mojo toolchain is installed in the build sandbox and
  Mojo has no wasm target (D-335), so `core/kernel.mojo` is the
  authored source of record, gated by `conformance/vectors.json` —
  whose values were derived from the kernel's formulas by an
  independent exact-arithmetic implementation (Python integers and
  rationals), never by running the JS transliteration under test
  (`conformance/README.md` carries the method). The JS side passes
  100/100 vector checks. Executing the kernel awaits a Mojo-equipped
  host; the pin of record is mojo 0.25.6.1 (`pixi.toml`). No claim
  anywhere in this repo says the kernel ran.
- **B-2: Preview text ran off the right edge.** D-221 frame inspection
  of the first captures: the report-phase gaze line, the MISREADS
  counter, gate/howto/game-over lines were cut at the frame edge.
  Cause: the shared draw-list rasteriser's 5x7 font advance is ~1.7x
  wider than canvas monospace at the same nominal size, so lines
  sized to fit the 960px canvas overflow the 480px preview raster.
  (The shipped page was never affected.) Fix: the affected lines were
  resized/repositioned in `web/game.mjs` to fit BOTH interpreters;
  all three previews re-captured and re-inspected PASS.
- **B-3: Assembler leak check false positive.** The first assemble
  failed its own guard: the check searched the output for the string
  `core/kernel.mjs`, which legitimately appears in a header comment.
  Fix: the guard now rejects actual `import` statements at line
  start. The single-file rule itself was never violated.
- **B-4 (held, not a defect): seahawk playtest pass not run.** Primo
  is unreachable from the sandbox tonight (tunnel outage since 03:15
  PDT). The sandbox automated playtest (`docs/PLAYTEST-2026-10-30.md`)
  is the record of the moment; the seahawk pass runs when primo
  returns. R-905's verify names the sandbox playtest for this reason.
- **B-5 (held, by design of the jam): GJ-07 live itch checks open.**
  The 18+ flag / content-warning / ToS verification happens live at
  entry time; the entry is not being submitted tonight. R-904 stays
  open. The game's own 18+ gate ships as the first screen regardless.
- **B-6 (design ruling): no mid-run save.** A fitting is one sitting.
  What persists (shell localStorage): settings + per-level best
  fit/completion. R-202/R-203 are gated on that bridge
  (`tools/settings-check.mjs`), and the scoping is recorded here
  rather than silently narrowing the items.

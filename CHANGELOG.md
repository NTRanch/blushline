# Changelog — Blushline

All notable changes, newest first. Format: Keep a Changelog.

## [1.0.0] — 2026-10-30

First playable release: the full W3 mechanism group, built and gated in
the sandbox under the Owner's v1.0 jam directive.

- **Mojo reference kernel** (`core/kernel.mojo`, tiger-style-mojo): the
  blush response curve (saturating cubic — no transcendentals in the
  live path), session accumulation and step dynamics, gaze channel
  scoring under the ratified §1.7 full-disc-centre definition,
  arousal-engine low-tier coupling (T1/T2 thresholds), the measurement
  schedule scalars, and a splitmix32 stream that is integer-exact
  across languages. Pinned compiler of record: mojo 0.25.6.1
  (`pixi.toml`). The kernel is the source of record and was **not
  executed** in the build sandbox (no Mojo toolchain there) — see the
  breakage log, B-1.
- **JS transliteration + conformance gate** (`core/kernel.mjs`,
  `conformance/vectors.json`, `tools/conformance.mjs`): 100 vector
  checks at 1e-12 tolerance; vectors derived from the kernel's formulas
  by an independent exact-arithmetic implementation, never by running
  the JS under test.
- **The fitting, playable** in the single-file `web/index.html`:
  measurement stations with a needle judged on the true mark, gaze
  channels (toward / away / downcast) read per station, readings
  reported as scene text Fit-Check style, a blush that ramps on the
  kernel curve and drives lids, brows, mouth and cheek heat, and a
  revelation that completes through the fitting itself. Three levels —
  First Fitting, The Thorough Check, Made to Measure (4/6/8 stations).
- **Screens**: 18+ gate, title with level picker, how-to, gameplay,
  pause, settings (calm room, text size), victory, game over.
- **Persistence**: settings and per-level best fit/completion persist
  in the shell (localStorage) and restore into the core at boot;
  safety and accessibility options are reachable before any play.
- **Audio**: generated WebAudio cues answering player input only;
  nothing autoplays.
- **Previews**: `docs/previews/level-{1,2,3}-blushline.mp4`, rendered
  from the shipped JS core in demo mode.
- **Gates**: 100 conformance checks; 22 unit tests (13 validation /
  9 adversarial); settings-bridge check; performance budget
  (0.001 ms/step, 32 KB page); scripted playtest completing all three
  levels with tier targets reached and the L3 revelation glimpsed.
- **Scaffold correction**: the kernel moved from the scaffold stub
  `src/kernel.mojo` to `core/kernel.mojo`, the program contract's
  layout (`core/` + `conformance/`); the empty `tables/` slot went
  with it — the shipped tables are kernel constants, pinned by the
  vectors.

## [0.1.0] — 2026-10-30

- Repo scaffolded 2026-10-30: bloch roadmap (kind=game, lane=restricted),
  planning, per-game skill, baseline Mojo config, NTRanch-themed mdBook,
  brand-asset slots.

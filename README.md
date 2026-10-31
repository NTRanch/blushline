# Blushline

**Nice Thoughts Ranch** · Torogao Jam Program week 3 (Wave A — Animation) · Alma · **Mojo**

A short fitting-room beat at the clinic — her readings, reported aloud.

An 18+ game built for the weekly Gameotron jam on itch.io (NTRanch), as one
rung of the 14-week Torogao system-validation program (D-333/D-334/D-335/D-336).
The full planning book lives in [`book/`](book/) (mdBook, NTRanch theme);
this repo's bloch roadmap is [`.ai/roadmap.md`](.ai/roadmap.md).

- **Delivery:** one self-contained `index.html` (see `docs` in the book).
- **Cast/art law (D-292):** existing keeper art only; a missing asset is an
  abstract stand-in, logged — never a generation job.
- **Quality bar:** Laplace3D-class animation or the medium's equivalent
  (book chapter: Quality Bar).
- **Audio:** nothing is ever played aloud by an agent; the Owner presses play.

## Play

Open [`web/index.html`](web/index.html) in a browser — it runs fully
offline. You are the fitter; she is the client. At each measurement
station, tap as the needle crosses the true mark to take her reading,
then read her gaze — toward, away, or downcast, scored on the full
iris-disc centre (the ratified §1.7 definition). Every reading is
reported aloud, Fit-Check style, as scene text. Her blush ramps on the
measured response curve and couples to the arousal engine's low tiers;
three misreads end the session.

- **Level 1 — First Fitting:** four stations, a wide true mark, her
  blush must reach tier T1.
- **Level 2 — The Thorough Check:** six stations, a narrower mark,
  tier T2.
- **Level 3 — Made to Measure:** eight stations, the narrowest mark —
  read every intimate station's gaze truly and the fitting itself
  glimpses what the clinic is for.

Settings (calm room, text size) and your best fit per level persist in
the browser. Settings are reachable before any play.

## Preview videos (rendered from the shipped core, demo mode)

- [Level 1 — First Fitting](docs/previews/level-1-blushline.mp4)
- [Level 2 — The Thorough Check](docs/previews/level-2-blushline.mp4)
- [Level 3 — Made to Measure](docs/previews/level-3-blushline.mp4)

## Build & verify

```sh
just build   # assemble web/index.html (JS core inlined; no wasm)
just check   # conformance vectors, 22 tests, settings bridge, perf, playtest
just previews
```

The numerics are authored in Mojo (`core/kernel.mojo`, the reference
implementation) and shipped as a JS transliteration
(`core/kernel.mjs`) gated by `conformance/vectors.json` — see
`conformance/README.md` for the derivation and its honest limits.

Status: **v1.0.0** (2026-10-30) — playable, gated, tagged. The seahawk
playtest pass on primo and the live itch.io entry checks (GJ-07) remain
scheduled follow-ups; both are recorded in `docs/BREAKAGE-LOG.md`.

# Planning — Blushline

- **Program:** Torogao Jam Program (D-333), week 3 of 14, Wave A — Animation
- **Cast:** Alma
- **Language:** Mojo (tiger-style-mojo)
- **Canon core:** A short fitting-room beat at the clinic.

## Mechanism group (D-334: primary + coupled + persistence/revelation + feel)

- The blush ramp
- Gaze channels (toward / away / downcast) scored under the ratified §1.7 full-disc definition
- Face coupling to the arousal engine's low tiers
- The clinic's measurement framing — her readings reported aloud, Fit-Check style, as scene text
- Revelation: a clinic kink Glimpsed through the fitting itself

## Validates

Whether measured channel response curves (blush, gaze) read as character, and measurement-as-dialogue as a scene register.

## Port-back

Channel response curves for the arousal engine's face coupling; measurement-readout UI notes; Mojo verdict (kernel authoring + conformance cost).

## Delivery

Named seam: Mojo has no credible browser/wasm target. Mojo authors the numerical kernel as the reference implementation, generates the entry's data tables, and ships a JS transliteration checked against the Mojo reference by a conformance test. Toolchain home: sandbox.

## Open preflight items

- GJ-06-class start gate for this week's toolchain (later weeks gate their
  own preflight; only W1's gate covers the program start).
- GJ-07: 18+ flag, content warnings listed, itch ToS screen — verified live
  at entry (the NSFW allowance clause is Owner-reported; re-verify on page).
- Engine-research chapter in the book: confirm the pinned library versions
  before the first build commit.

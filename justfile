# Blushline — task recipes (wired at the v1.0 build, 2026-10-30).
# Mojo route (D-335): the kernel is the Mojo reference in core/, the
# shipped core is its conformance-gated JS transliteration. No wasm.

# Assemble the single-file jam entry: inline the JS core into web/index.html
build:
    node tools/assemble.mjs

# Run every gate: conformance vectors, unit tests (validation +
# adversarial), settings bridge, performance budget, scripted playtest
check:
    node tools/conformance.mjs
    node tests/run.mjs
    node tools/assemble.mjs
    node tools/settings-check.mjs
    node tools/perf.mjs
    node tools/playtest.mjs

# Render the per-level preview videos from the shipped core (demo mode)
previews:
    node tools/capture.mjs 0 20263
    node tools/capture.mjs 1 20263
    node tools/capture.mjs 2 20263

# Build the planning book
book:
    mdbook build book

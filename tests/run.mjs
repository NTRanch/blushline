// run.mjs — Blushline unit suite (node, assert-based, no framework).
// Estate split: half validation (the happy path, end to end), half
// adversarial (malformed, degenerate, and hostile inputs). The kernel
// half pins core/kernel.mjs beyond the conformance vectors; the game
// half pins web/game.mjs behaviour. Exit 1 on any failure.
import assert from "node:assert/strict";
import {
  accumulate, blushCurve, blushStep, blushTarget, clamp01, gazeChannel,
  gazeMagnitude, gazeScore, gazeStimulus, levelSchedule, rngNext, tierOf,
  DISC_RADIUS_UNITS, LEVELS, STATIONS,
} from "../core/kernel.mjs";
import { createGame, INPUT } from "../web/game.mjs";

let validation = 0;
let adversarial = 0;
const failures = [];
function test(kind, name, fn) {
  try {
    fn();
    if (kind === "v") validation++; else adversarial++;
  } catch (err) {
    failures.push(`${kind}:${name}: ${err.message}`);
  }
}
async function testAsync(kind, name, fn) {
  try {
    await fn();
    if (kind === "v") validation++; else adversarial++;
  } catch (err) {
    failures.push(`${kind}:${name}: ${err.message}`);
  }
}

// ---------------- validation ----------------

test("v", "curve endpoints and range", () => {
  assert.equal(blushCurve(0), 0);
  assert.equal(blushCurve(1), 1);
  for (let i = 0; i <= 64; i++) {
    const y = blushCurve(i / 64);
    assert.ok(y >= 0 && y <= 1, `curve out of range at ${i}`);
  }
});

test("v", "curve is monotone non-decreasing", () => {
  let prev = -1;
  for (let i = 0; i <= 256; i++) {
    const y = blushCurve(i / 256);
    assert.ok(y >= prev, `curve decreased at step ${i}`);
    prev = y;
  }
});

test("v", "curve saturates on the shoulder", () => {
  assert.ok(blushCurve(0.875) > 0.99);
  assert.ok(blushCurve(0.5) === 0.875);
});

test("v", "blush step converges and rise outruns fall", () => {
  let up = 0;
  for (let i = 0; i < 400; i++) up = blushStep(up, 0.8);
  assert.ok(Math.abs(up - 0.8) < 0.001);
  const halve = (from, to) => {
    let c = from;
    let n = 0;
    while (Math.abs(c - to) > Math.abs(from - to) / 2 && n < 10000) { c = blushStep(c, to); n++; }
    return n;
  };
  assert.ok(halve(0, 1) < halve(1, 0), "rise must halve the gap faster than fall");
});

test("v", "accumulate saturates and never exceeds 1", () => {
  let s = 0;
  for (let i = 0; i < 100; i++) {
    s = accumulate(s, 1);
    assert.ok(s <= 1);
  }
  assert.equal(s, 1);
});

test("v", "gaze stimuli classify back to their scripted channel", () => {
  let state = 12345;
  for (let i = 0; i < 500; i++) {
    const [next, value] = rngNext(state);
    state = next;
    for (const cls of [0, 1, 2]) {
      const [dx, dy] = gazeStimulus(value, cls);
      assert.equal(gazeChannel(dx, dy, DISC_RADIUS_UNITS), cls, `v=${value} cls=${cls}`);
    }
  }
});

test("v", "gaze score is centredness", () => {
  assert.equal(gazeScore(0, 0, 40), 1);
  assert.ok(gazeScore(8, 0, 40) > gazeScore(20, 0, 40));
  assert.equal(gazeScore(40, 0, 40), 0);
});

test("v", "tier thresholds are inclusive at the bottom", () => {
  assert.equal(tierOf(0), 0);
  assert.equal(tierOf(0.25), 1);
  assert.equal(tierOf(0.55), 2);
  assert.equal(tierOf(1), 2);
});

test("v", "level schedule escalates", () => {
  const rows = [0, 1, 2].map((i) => levelSchedule(i));
  assert.deepEqual(rows.map((r) => r.stations), [4, 6, 8]);
  assert.ok(rows[0].window > rows[1].window && rows[1].window > rows[2].window);
  assert.ok(rows[0].fitTarget < rows[1].fitTarget && rows[1].fitTarget < rows[2].fitTarget);
  assert.equal(LEVELS.length, 3);
  assert.equal(STATIONS.length, 8);
  assert.equal(new Set(STATIONS.map((s) => s.name)).size, 8);
  assert.ok(STATIONS.every((s) => s.base > 0));
});

test("v", "rng stream is deterministic and advances", () => {
  const a = rngNext(999);
  const b = rngNext(999);
  assert.deepEqual(a, b);
  assert.notEqual(a[0], 999);
  assert.ok(Number.isInteger(a[1]) && a[1] >= 0 && a[1] <= 0xffffffff);
});

await testAsync("v", "same seed + same inputs = identical draw lists", async () => {
  const g1 = await createGame({ seed: 4242, level: 1, demo: true });
  const g2 = await createGame({ seed: 4242, level: 1, demo: true });
  g1.startLevel(1);
  g2.startLevel(1);
  for (let i = 0; i < 900; i++) {
    g1.step(0);
    g2.step(0);
    if (i % 100 === 0) assert.equal(g1.frameText(), g2.frameText());
  }
});

await testAsync("v", "screen flow: gate, howto, pause, resume", async () => {
  const g = await createGame({ seed: 5, level: 0, demo: false });
  assert.equal(g.screen(), 0);
  g.step(INPUT.confirm);
  assert.equal(g.screen(), 1);
  g.step(INPUT.down); // cursor: level 2
  g.step(INPUT.down); // cursor: level 3
  g.step(INPUT.down); // cursor: HOW TO PLAY
  g.step(INPUT.confirm);
  assert.equal(g.screen(), 2);
  g.step(INPUT.back);
  assert.equal(g.screen(), 1);
  g.startLevel(0);
  assert.equal(g.screen(), 3);
  g.step(INPUT.pause);
  assert.equal(g.screen(), 4);
  g.step(INPUT.confirm);
  assert.equal(g.screen(), 3);
});

await testAsync("v", "report phase reports the reading as scene text", async () => {
  const g = await createGame({ seed: 77, level: 0, demo: true });
  g.startLevel(0);
  let seen = "";
  for (let i = 0; i < 2000 && !seen; i++) {
    g.step(0);
    const text = g.frameText();
    if (text.includes("FIT-CHECK STEADY")) seen = text;
  }
  assert.ok(seen.includes("CM - "), "report must carry the measurement readout");
  assert.ok(/HER GAZE: (TOWARD|AWAY|DOWNCAST)/.test(seen), "report must carry the gaze line");
});

// ---------------- adversarial ----------------

test("a", "kernel fails closed on non-finite input", () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.equal(blushCurve(bad), 0);
    assert.equal(blushTarget(bad, bad), 0);
    assert.equal(tierOf(bad), 0);
    assert.equal(accumulate(bad, bad), 0);
    assert.equal(clamp01(bad), 0);
  }
  assert.ok(Number.isFinite(blushStep(NaN, NaN)));
  assert.equal(blushStep(NaN, NaN), 0);
});

test("a", "gaze geometry rejects degenerate discs", () => {
  for (const r of [0, -1, -40, NaN, Infinity]) {
    assert.equal(gazeChannel(0, 0, r), -1);
    assert.equal(gazeScore(0, 0, r), -1);
    assert.equal(gazeMagnitude(0, 0, r), -1);
  }
  assert.equal(gazeChannel(NaN, 0, 40), -1);
  assert.equal(gazeChannel(0, NaN, 40), -1);
});

test("a", "gaze survives extreme offsets without NaN", () => {
  for (const [dx, dy] of [[1e300, 0], [0, 1e300], [-1e300, 1e300], [1e308, 1e308]]) {
    const ch = gazeChannel(dx, dy, 40);
    assert.ok([-1, 0, 1, 2].includes(ch), `channel ${ch}`);
    const sc = gazeScore(dx, dy, 40);
    assert.ok(sc === -1 || (sc >= 0 && sc <= 1), `score ${sc}`);
  }
});

test("a", "section 1.7 threshold edges classify exactly", () => {
  assert.equal(gazeChannel(0, 18, 40), 2); // ny exactly 0.45 -> downcast
  assert.equal(gazeChannel(0, 17, 40), 1); // ny 0.425, m 0.425 -> away
  assert.equal(gazeChannel(12, 0, 40), 0); // m exactly 0.30 -> toward
  assert.equal(gazeChannel(13, 0, 40), 1); // m 0.325 -> away
  assert.equal(gazeChannel(6, 8, 10), 2); // downcast wins over magnitude
});

test("a", "out-of-domain curve and tier inputs clamp, never wrap", () => {
  assert.equal(blushCurve(-100), 0);
  assert.equal(blushCurve(100), 1);
  assert.equal(tierOf(-1), 0);
  assert.equal(tierOf(99), 2);
  assert.equal(blushTarget(50, 50), 1);
  assert.equal(levelSchedule(3), null);
  assert.equal(levelSchedule(-1), null);
  assert.equal(levelSchedule(1.5), null);
});

await testAsync("a", "invalid levels are rejected loudly", async () => {
  await assert.rejects(() => createGame({ seed: 1, level: 7 }));
  const g = await createGame({ seed: 1, level: 0 });
  assert.throws(() => g.startLevel(3));
  assert.throws(() => g.startLevel(-1));
});

await testAsync("a", "hostile input fuzz keeps the core sane", async () => {
  const g = await createGame({ seed: 31337, level: 2, demo: false });
  g.startLevel(2);
  let s = 999;
  const nextBits = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s % 256;
  };
  for (let i = 0; i < 5000; i++) {
    g.step(nextBits());
    const scr = g.screen();
    assert.ok(scr >= 0 && scr <= 7, `screen ${scr}`);
    assert.ok(g.blush() >= 0 && g.blush() <= 1, `blush ${g.blush()}`);
    if (i % 250 === 0) {
      const text = g.frameText();
      assert.ok(!text.includes("NaN") && !text.includes("undefined"), "draw list poisoned");
      const { ops } = g.frame();
      assert.ok(ops.length <= 500, `ops ${ops.length}`);
      for (const op of ops) {
        for (const v of op.slice(1)) {
          if (typeof v === "number") assert.ok(Number.isFinite(v), `non-finite op value in ${op}`);
        }
      }
    }
  }
});

await testAsync("a", "all-bits input is deterministic, not chaotic", async () => {
  const g1 = await createGame({ seed: 8, level: 0, demo: false });
  const g2 = await createGame({ seed: 8, level: 0, demo: false });
  for (let i = 0; i < 300; i++) {
    g1.step(0xffffffff);
    g2.step(0xffffffff);
  }
  assert.equal(g1.screen(), g2.screen());
  assert.equal(g1.frameText(), g2.frameText());
});

await testAsync("a", "different seeds produce different sessions", async () => {
  const g1 = await createGame({ seed: 1, level: 0, demo: true });
  const g2 = await createGame({ seed: 2, level: 0, demo: true });
  g1.startLevel(0);
  g2.startLevel(0);
  let differ = false;
  for (let i = 0; i < 1200 && !differ; i++) {
    g1.step(0);
    g2.step(0);
    if (g1.frameText() !== g2.frameText()) differ = true;
  }
  assert.ok(differ, "seed had no effect on the session");
});

const total = validation + adversarial + failures.length;
if (failures.length) {
  console.error(`tests: ${failures.length} FAILED`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`tests: ${total} pass (${validation} validation / ${adversarial} adversarial)`);

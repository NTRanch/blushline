// perf.mjs — gates R-401: one frame of simulation + draw-list emission
// must stay far inside the 16 ms step budget. Budget of record: 10,000
// steps (each producing a full draw list) in under 2 s on this machine
// (= 0.2 ms per step, 80x headroom), shipped page under 256 KB (the
// Mojo route ships JS source, no wasm payload).
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGame } from "../web/game.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const game = await createGame({ seed: 31, level: 2, demo: true });
game.startLevel(2);
const t0 = performance.now();
for (let i = 0; i < 10_000; i++) {
  game.step(0);
  if (game.screen() === 6 || game.screen() === 7) game.startLevel(2); // keep steps live, not victory-idle
  if (i % 500 === 0) void game.frameText();
}
const ms = performance.now() - t0;
const size = statSync(join(root, "web/index.html")).size;
console.log(`perf: 10000 steps in ${ms.toFixed(1)} ms (${(ms / 10000).toFixed(3)} ms/step); page ${size} bytes`);
if (ms >= 2000) { console.error("perf: step budget exceeded"); process.exit(1); }
if (size >= 262_144) { console.error("perf: page size budget exceeded"); process.exit(1); }
console.log("perf: within budget");

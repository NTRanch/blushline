// playtest.mjs — automated playtest: the demo policy plays every level
// from start_level to victory against the shipped JS core, and the
// mechanism assertions are checked per level: the blush must reach the
// level's tier target through the kernel curve, and level 3 must
// complete the revelation (every intimate station's gaze read true).
// This is the sandbox playtest of record; the seahawk pass on primo is
// the follow-up named in docs/BREAKAGE-LOG.md.
import { createGame } from "../web/game.mjs";
import { levelSchedule } from "../core/kernel.mjs";

const SCREENS = ["gate", "title", "howto", "play", "pause", "settings", "victory", "gameover"];

let failures = 0;
for (let level = 0; level < 3; level++) {
  const sched = levelSchedule(level);
  const game = await createGame({ seed: 9100 + level, level, demo: true });
  game.startLevel(level);
  let steps = 0;
  const maxSteps = (6 * 60 * 1000) / 16;
  while (game.screen() !== 6 && game.screen() !== 7 && steps < maxSteps) {
    game.step(0);
    steps++;
  }
  const won = game.screen() === 6;
  const tierOk = game.maxTier() >= sched.tierTarget;
  const glimpseOk = level < 2 || game.glimpsed();
  console.log(
    `level ${level + 1} (${sched.name}): screen=${SCREENS[game.screen()]} steps=${steps} `
    + `fit=${game.fitScore()} maxTier=T${game.maxTier()} glimpsed=${game.glimpsed()} `
    + `${won && tierOk && glimpseOk ? "VICTORY" : "FAIL"}`,
  );
  if (!won || !tierOk || !glimpseOk) failures++;
}
if (failures) {
  console.error(`playtest: ${failures} level(s) failed the demo playtest`);
  process.exit(1);
}
console.log("playtest: all 3 levels completed, tier targets reached, L3 revelation glimpsed");

// settings-check.mjs — gates R-202/R-203/R-403: the settings bridge
// round-trips, and the settings screen is reachable from boot with no
// progression (safety/accessibility options are never gated).
import { createGame, INPUT } from "../web/game.mjs";

const game = await createGame({ seed: 7, level: 0, demo: false });

function steps(n, bits = 0) { for (let i = 0; i < n; i++) game.step(bits); }
function fail(msg) { console.error(`settings-check: ${msg}`); process.exit(1); }

if (game.screen() !== 0) fail("boot screen is not the 18+ gate");
game.applySettings(true, false);
if (game.settingsBits() !== 1) fail("applySettings(calmRoom) did not round-trip");
game.applySettings(false, true);
if (game.settingsBits() !== 2) fail("applySettings(textLarge) did not round-trip");
game.applySettings(true, true);
if (game.settingsBits() !== 3) fail("applySettings(both) did not round-trip");

// Navigate gate -> title -> settings with plain input, no play first.
// Title menu: three levels, HOW TO PLAY, SETTINGS — four downs.
steps(1, INPUT.confirm);
if (game.screen() !== 1) fail("confirm did not leave the gate");
for (let i = 0; i < 4; i++) steps(1, INPUT.down);
steps(1, INPUT.confirm);
if (game.screen() !== 5) fail(`settings not reachable from title (screen=${game.screen()})`);
steps(2);
if (!game.frameText().includes("CALM ROOM: ON")) fail("settings screen does not show restored CALM ROOM");
if (!game.frameText().includes("LARGE")) fail("settings screen does not show restored LARGE text");
console.log("settings-check: bridge round-trips; settings reachable ungated; restored values render");

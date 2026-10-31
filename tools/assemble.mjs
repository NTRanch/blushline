// assemble.mjs — build the single-file jam entry web/index.html from
// core/kernel.mjs (the transliterated kernel) + web/game.mjs (the game
// core) + web/shell.html. There is no wasm on the Mojo route (D-335):
// the shipped core is the conformance-gated JS itself, inlined.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kernelMjs = readFileSync(join(root, "core/kernel.mjs"), "utf8").replace(/^export /gm, "");
const gameMjs = readFileSync(join(root, "web/game.mjs"), "utf8")
  .replace(/^import \{[\s\S]*?\} from "\.\.\/core\/kernel\.mjs";\n/m, "")
  .replace(/^export /gm, "");
const shell = readFileSync(join(root, "web/shell.html"), "utf8");

const out = shell
  .replace("/*__KERNEL_MJS__*/", () => kernelMjs)
  .replace("/*__GAME_MJS__*/", () => gameMjs);
if (out === shell || out.includes("__KERNEL_MJS__") || out.includes("__GAME_MJS__")) {
  throw new Error("shell placeholders not found — nothing assembled");
}
if (/^import\s/m.test(out)) throw new Error("an import statement leaked into the single file");
writeFileSync(join(root, "web/index.html"), out);
console.log(`assembled web/index.html (${out.length} bytes, JS core inlined, no wasm)`);

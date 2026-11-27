// main.ts — entry program for best-flight-game-20261126-0057 (Node 22, stdlib
// only). Copies game/ and screenshots/ from beside this file into
// MAKEFUN_OUTPUT_DIR (fallback /output) and writes /output/dossier.json with
// buildDossier from ./vendor/makefun-game.ts. Deterministic: same inputs,
// same bytes — no timestamps, no random data, fixed file order.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const gameSrc = join(here, 'game');
const shotsSrc = join(here, 'screenshots');
if (!existsSync(gameSrc)) throw new Error('main.ts: no game/ directory beside main.ts');
if (!existsSync(shotsSrc)) throw new Error('main.ts: no screenshots/ directory beside main.ts');

mkdirSync(outDir, { recursive: true });
for (const name of ['game', 'screenshots']) {
  const dest = join(outDir, name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(here, name), dest, { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier.json: ${dossier.length} bytes -> ${outDir}`);

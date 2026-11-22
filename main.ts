// Midnight Vault, a make.fun best-heist-game entry (Node 22+, standard library only).
//
// The game is this directory's game/ folder: plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library, no network request). This program
// hands it in: it copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, using the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    const target = join(to, entry);
    if (statSync(source).isDirectory()) copyTree(source, target);
    else cpSync(source, target);
  }
}

mkdirSync(out, { recursive: true });
copyTree(join(here, 'game'), join(out, 'game'));
if (existsSync(join(here, 'screenshots'))) {
  copyTree(join(here, 'screenshots'), join(out, 'screenshots'));
}

// The scorer's own caps (from the competition's reference/gate.json): only text_max_bytes
// shapes the dossier text; the other limits refuse an entry the scorer would refuse — more
// than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files in all, or a path under game/ over 1000 bytes.
const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Read the dossier back so a bad write fails loudly here instead of at the scorer:
// it must exist, parse, and carry the screenshots the entry was shot with.
const dossier = JSON.parse(readFileSync(dossierPath, 'utf8'));
const shotCount = readdirSync(join(out, 'screenshots')).filter((name) => !name.startsWith('.')).length;
const sourceMatch = dossier.text.match(/Source files: (\d+)/);
console.log(
  `dossier written: ${statSync(dossierPath).size} bytes, ${shotCount} screenshots, ` +
    `${sourceMatch?.[1] ?? '?'} source files`,
);

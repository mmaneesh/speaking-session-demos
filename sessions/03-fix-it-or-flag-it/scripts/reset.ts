// Restores a scenario to its starting state so rehearsal reruns are painless.
//   npm run reset -- 2      reset scenario 2 (test file, and CHANGELOG.md gains the v2.3 entry)
//   npm run reset           reset every test file; CHANGELOG.md loses the v2.3 entry
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOLDERS = ['01', '02', '03', '04', '05'];

const arg = process.argv[2];
const picked = arg === undefined || arg === 'all' ? null : Number(arg);
if (picked !== null && !(Number.isInteger(picked) && picked >= 1 && picked <= FOLDERS.length)) {
  console.error(`Usage: npm run reset -- [1-${FOLDERS.length}|all]`);
  process.exit(1);
}

FOLDERS.forEach((folder, i) => {
  if (picked !== null && picked !== i + 1) return;
  const dir = path.join(root, 'scenarios', folder);
  fs.copyFileSync(path.join(dir, 'test.spec.ts.baseline'), path.join(dir, 'test.spec.ts'));
  console.log(`reset scenarios/${folder}/test.spec.ts`);
});

// CHANGELOG.md is the single source of truth. Scenario 2 differs only by one entry (v2.3, shipping),
// kept in its own folder as a readable file. Strip any v2.3 block, then add it back for scenario 2 only.
const changelogPath = path.join(root, 'CHANGELOG.md');
let changelog = fs.readFileSync(changelogPath, 'utf-8').replace(/^## v2\.3\b[\s\S]*?(?=^## |(?![\s\S]))/m, '');
if (picked === 2) {
  const entry = fs.readFileSync(path.join(root, 'scenarios', FOLDERS[1], 'changelog-entry.md'), 'utf-8').trimEnd();
  changelog = changelog.replace(/^## v/m, `${entry}\n\n## v`); // above the newest release
}
fs.writeFileSync(changelogPath, changelog);
console.log(`reset CHANGELOG.md (${picked === 2 ? 'with' : 'without'} the v2.3 entry)`);

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const dir = await mkdtemp(join(tmpdir(), 'agent-handoff-demo-'));
const cli = resolve('dist/cli.js');
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe' });
try {
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'Demo Fixture'); git('config', 'user.email', 'demo@example.invalid');
  git('config', 'commit.gpgsign', 'false'); git('config', 'core.hooksPath', '/dev/null');
  await writeFile(join(dir, '.gitignore'), 'brief.handoff.md\n');
  await writeFile(join(dir, 'app.ts'), 'export const answer = 42;\n');
  git('add', '.'); git('commit', '-m', 'Sample fixture: initial version');
  await writeFile(join(dir, 'app.ts'), 'export const answer = 43;\n');
  const out = join(dir, 'brief.handoff.md');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  let result = run('snapshot', '--repo', dir, '--output', out);
  if (result.status !== 0) throw new Error(result.stderr);
  console.log('1. Captured a brief for a sample repository.');
  result = run('verify', out, '--repo', dir);
  if (result.status !== 0) throw new Error(result.stderr);
  console.log('2.', result.stdout.trim());
  await writeFile(join(dir, 'app.ts'), 'export const answer = 44;\n');
  result = run('verify', out, '--repo', dir);
  if (result.status !== 2) throw new Error('Expected stale exit code 2.');
  console.log('3.', result.stdout.trim());
  console.log('Demo passed. No user repositories were modified.');
} finally { await rm(dir, { recursive: true, force: true }); }

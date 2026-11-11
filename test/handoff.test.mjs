import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { snapshot, render } from '../dist/snapshot.js';
import { parseStatus } from '../dist/git.js';
import { inline } from '../dist/privacy.js';

const cli = resolve('dist/cli.js');
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
async function fixture(t, committed = true) {
  const root = await mkdtemp(join(tmpdir(), 'handoff-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, 'repo'); await mkdir(repo);
  git(repo, 'init', '--initial-branch=main');
  git(repo, 'config', 'user.name', 'Fixture'); git(repo, 'config', 'user.email', 'fixture@example.invalid');
  git(repo, 'config', 'commit.gpgsign', 'false');
  git(repo, 'config', 'core.hooksPath', '/dev/null');
  if (committed) {
    await writeFile(join(repo, 'app.txt'), 'version one\n');
    await writeFile(join(repo, '.gitignore'), 'ignored.txt\n');
    git(repo, 'add', '.'); git(repo, 'commit', '-m', 'Fixture initial commit');
  }
  return { root, repo };
}
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('captures actual staged, unstaged and untracked paths without exporting content', async t => {
  const { repo } = await fixture(t);
  await writeFile(join(repo, 'app.txt'), 'do not export this source\n');
  await writeFile(join(repo, 'new file.txt'), 'untracked private content\n');
  await writeFile(join(repo, 'ignored.txt'), 'ignored private content\n');
  const s = await snapshot(repo);
  assert.ok(s.changes.some(c => c.status === ' M' && c.path === 'app.txt'));
  assert.ok(s.changes.some(c => c.status === '??' && c.path === 'new file.txt'));
  const output = JSON.stringify(s);
  assert.doesNotMatch(output, /do not export|untracked private|ignored private|fixture@example/);
  assert.equal(s.checks, 'not-run');
  assert.equal(s.recentCommits.length, 1);
});

test('omits tracked secrets and redacts known token shapes in commit subjects', async t => {
  const { repo } = await fixture(t);
  await writeFile(join(repo, '.env.production'), 'NEVER_EXPORT=private\n');
  git(repo, 'add', '-f', '.env.production');
  git(repo, 'commit', '-m', 'Do not use ghp_123456789012345678901234567890123456');
  await writeFile(join(repo, '.env.production'), 'NEVER_EXPORT=changed\n');
  const s = await snapshot(repo);
  assert.equal(s.hiddenChanges, 1);
  assert.doesNotMatch(JSON.stringify(s), /\.env.production|NEVER_EXPORT|ghp_/);
  assert.match(s.recentCommits[0].subject, /REDACTED/);
});

test('parses rename records and newline paths without splitting them', async t => {
  const { repo } = await fixture(t);
  git(repo, 'mv', 'app.txt', 'renamed\nfile.txt');
  const s = await snapshot(repo);
  assert.equal(s.changes[0].from, 'app.txt');
  assert.equal(s.changes[0].path, 'renamed\nfile.txt');
  assert.ok(render(s).includes(String.raw`renamed\\u000afile`));
  assert.deepEqual(parseStatus('R  to\0from\0'), [{ status: 'R ', path: 'to', from: 'from' }]);
  assert.throws(() => parseStatus('R  to\0'), /Incomplete/);
});

test('supports repositories without commits and detached HEAD', async t => {
  const { repo } = await fixture(t, false);
  assert.equal((await snapshot(repo)).head, null);
  await writeFile(join(repo, 'a'), 'a'); git(repo, 'add', '.'); git(repo, 'commit', '-m', 'Fixture');
  git(repo, 'checkout', '--detach');
  assert.equal((await snapshot(repo)).branch, '(detached HEAD)');
});

test('verification detects new tracked edits even if status codes do not change', async t => {
  const { repo, root } = await fixture(t);
  await writeFile(join(repo, 'app.txt'), 'change one\n');
  const output = join(root, 'handoff.md');
  assert.equal(run('snapshot', '--repo', repo, '--output', output).status, 0);
  assert.equal(run('verify', output, '--repo', repo).status, 0);
  await writeFile(join(repo, 'app.txt'), 'change two\n');
  assert.equal(run('verify', output, '--repo', repo).status, 2);
});

test('verification detects branch changes at the same commit', async t => {
  const { repo, root } = await fixture(t);
  const output = join(root, 'handoff.json');
  assert.equal(run('snapshot', '--repo', repo, '--output', output, '--format', 'json').status, 0);
  git(repo, 'checkout', '-b', 'other');
  assert.equal(run('verify', output, '--repo', repo).status, 2);
});

test('explicitly documents that untracked content changes are not detected', async t => {
  const { repo } = await fixture(t);
  await writeFile(join(repo, 'new.txt'), 'one'); const a = await snapshot(repo);
  await writeFile(join(repo, 'new.txt'), 'two'); const b = await snapshot(repo);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(b.untrackedContents, 'not-inspected');
});

test('budget is respected and untrusted Markdown/control characters are escaped', async t => {
  const { repo } = await fixture(t);
  for (let i = 0; i < 70; i++) await writeFile(join(repo, `long-path-${i}-example.txt`), 'a');
  const result = render(await snapshot(repo), 2000);
  assert.ok(result.length <= 2000);
  assert.match(result, /metadata omitted/);
  assert.ok(result.includes('## Continue here'));
  assert.equal(inline('<script>\n[click](https://example.invalid?a=secret)'), '&lt;script&gt;\\\\u000a\\[click\\]\\(\\[URL\\]');
});

test('CLI refuses overwrite, validates options and rejects invalid snapshots', async t => {
  const { repo, root } = await fixture(t);
  const output = join(root, 'existing.md'); await writeFile(output, 'keep me');
  assert.equal(run('snapshot', '--repo', repo, '--output', output).status, 1);
  assert.equal(await readFile(output, 'utf8'), 'keep me');
  assert.equal(run('snapshot', '--repo', repo, '--output', output, '--force').status, 0);
  assert.equal(run('snapshot', '--repo', repo, '--commits', '-1').status, 1);
  assert.equal(run('snapshot', '--repo', repo, '--format', 'html').status, 1);
  assert.equal(run('snapshot', '--repo', repo, '--format', 'json', '--max-chars', '2000').status, 1);
  await writeFile(output, '{"schemaVersion":99,"fingerprint":"x"}');
  assert.equal(run('verify', output, '--repo', repo).status, 1);
});

test('repository paths with shell syntax are passed literally, not executed', async t => {
  const { root } = await fixture(t);
  const repo = join(root, 'repo;touch INJECTED'); await mkdir(repo);
  git(repo, 'init', '--initial-branch=main');
  const s = await snapshot(repo);
  assert.equal(s.head, null);
  assert.equal(run('snapshot', '--repo', join(root, 'missing')).status, 1);
});

test('output refuses symlinks even with force', async t => {
  const { repo, root } = await fixture(t);
  const target = join(root, 'keep.txt'); const link = join(root, 'link.md');
  await writeFile(target, 'keep'); await symlink(target, link);
  assert.equal(run('snapshot', '--repo', repo, '--output', link, '--force').status, 1);
  assert.equal(await readFile(target, 'utf8'), 'keep');
});

test('disables repository fsmonitor hooks during inspection', async t => {
  const { repo } = await fixture(t);
  const hook = join(repo, 'monitor.sh'); const marker = join(repo, 'HOOK_RAN');
  await writeFile(hook, `#!/bin/sh\ntouch '${marker}'\n`, { mode: 0o700 });
  git(repo, 'config', 'core.fsmonitor', hook);
  await snapshot(repo);
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
});

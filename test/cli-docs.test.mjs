import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { referenceBlock, replaceReference, verifyReference } from '../scripts/check-cli-docs.mjs';

const cli = resolve('dist/cli.js');
const checker = resolve('scripts/check-cli-docs.mjs');
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const helpResult = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
assert.equal(helpResult.status, 0);
const help = helpResult.stdout;
const document = `# Sample documentation\n\n${referenceBlock(help)}\n\nKeep these human notes.\n`;

test('CLI reference check accepts actual help and CRLF documentation', () => {
  assert.doesNotThrow(() => verifyReference(document, help, version));
  assert.doesNotThrow(() => verifyReference(document.replace(/\n/g, '\r\n'), help, version));
});

test('CLI drift is rejected for changed options, defaults and exit-code explanations', () => {
  for (const [from, to] of [['--max-chars', '--budget'], ['0..20', '0..30'], ['2 = stale', '3 = stale']]) {
    assert.notEqual(help.replace(from, to), help);
    assert.throws(() => verifyReference(document, help.replace(from, to), version), /reference is stale/);
  }
});

test('version drift fails even if the README matches the old CLI', () => {
  assert.throws(() => verifyReference(document, help, '99.0.0'), /version banner/);
});

test('missing, duplicate or reversed reference markers fail closed', () => {
  const begin = '<!-- BEGIN CLI REFERENCE -->';
  const end = '<!-- END CLI REFERENCE -->';
  for (const bad of ['', begin, end, `${end}\n${begin}`, document + begin, document + end]) {
    assert.throws(() => replaceReference(bad, help), /exactly one ordered/);
  }
});

test('synchronization preserves surrounding documentation and is idempotent', () => {
  const old = document.replace('0..20', '0..19');
  const updated = replaceReference(old, help);
  assert.equal(updated, document);
  assert.equal(replaceReference(updated, help), updated);
  const crlf = document.replace(/\n/g, '\r\n');
  assert.equal(replaceReference(crlf.replace('0..20', '0..19'), help), crlf);
  assert.match(updated, /^# Sample documentation/);
  assert.match(updated, /Keep these human notes\.\n$/);
});

test('checker rejects unsupported arguments without modifying the README', async () => {
  const before = await readFile('README.md');
  const result = spawnSync(process.execPath, [checker, '--unknown'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
  assert.deepEqual(await readFile('README.md'), before);
});

test('checker works outside Git without inspecting the working directory', async t => {
  const root = await mkdtemp(join(tmpdir(), 'handoff-docs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const privateFile = join(root, '.env');
  await writeFile(privateFile, 'PRIVATE_FIXTURE_DO_NOT_EXPORT=sample\n');
  const before = await readFile('README.md');
  const result = spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /match the built CLI/);
  assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_FIXTURE|DO_NOT_EXPORT|handoff-docs-/);
  assert.deepEqual(await readFile('README.md'), before);
  assert.equal(await readFile(privateFile, 'utf8'), 'PRIVATE_FIXTURE_DO_NOT_EXPORT=sample\n');
});

async function checkerFixture(t, packageVersion = version) {
  const root = await mkdtemp(join(tmpdir(), 'handoff-docs-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'scripts/check-cli-docs.mjs'), await readFile(checker));
  await writeFile(join(root, 'dist/cli.js'), `process.stdout.write(${JSON.stringify(help)});\n`);
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: packageVersion }));
  const readme = join(root, 'README.md');
  await writeFile(readme, document.replace('0..20', '0..19'));
  const execute = (...args) => spawnSync(process.execPath, [join(root, 'scripts/check-cli-docs.mjs'), ...args], { encoding: 'utf8' });
  return { readme, execute };
}

test('check fails without writing; explicit update synchronizes and then passes', async t => {
  const { readme, execute } = await checkerFixture(t);
  const before = await readFile(readme, 'utf8');
  assert.equal(execute().status, 1);
  assert.equal(await readFile(readme, 'utf8'), before);
  assert.equal(execute('--write').status, 0);
  assert.equal(await readFile(readme, 'utf8'), document);
  assert.equal(execute().status, 0);
  assert.equal(execute('--write').status, 0);
  assert.equal(await readFile(readme, 'utf8'), document);
});

test('checker runs through a symlinked directory instead of silently skipping checks', async t => {
  const { readme } = await checkerFixture(t);
  const root = resolve(readme, '..');
  const alias = root + '-alias';
  const { symlink } = await import('node:fs/promises');
  await symlink(root, alias, 'dir');
  t.after(() => rm(alias, { force: true }));
  const execute = (...args) => spawnSync(process.execPath,
    [join(alias, 'scripts/check-cli-docs.mjs'), ...args], { encoding: 'utf8' });
  const before = await readFile(readme, 'utf8');
  const stale = execute();
  assert.equal(stale.status, 1, stale.stderr);
  assert.match(stale.stderr, /reference is stale/);
  assert.equal(await readFile(readme, 'utf8'), before);
  const updated = execute('--write');
  assert.equal(updated.status, 0, updated.stderr);
  assert.match(updated.stdout, /synchronized/);
  assert.equal(await readFile(readme, 'utf8'), document);
  const checked = execute();
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /match the built CLI/);
});

test('explicit update refuses a version mismatch without changing documentation', async t => {
  const { readme, execute } = await checkerFixture(t, '99.0.0');
  const before = await readFile(readme, 'utf8');
  const result = execute('--write');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /version banner/);
  assert.equal(await readFile(readme, 'utf8'), before);
});

test('checker refuses a symlinked README rather than changing its external target', async t => {
  const { readme, execute } = await checkerFixture(t);
  const target = readme + '.external';
  const before = await readFile(readme, 'utf8');
  const { symlink } = await import('node:fs/promises');
  await writeFile(target, before);
  await rm(readme);
  await symlink(target, readme);
  for (const args of [[], ['--write']]) {
    const result = execute(...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /symlinked README/);
    assert.equal(await readFile(target, 'utf8'), before);
  }
});


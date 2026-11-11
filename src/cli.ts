#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { open, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { snapshot, render } from './snapshot.js';

const help = `agent-handoff-kit 0.1.0

Usage:
  agent-handoff snapshot [--repo PATH] [--output FILE] [--format markdown|json]
                         [--commits 0..20] [--max-chars 2000..100000] [--force]
  agent-handoff verify FILE [--repo PATH]

snapshot defaults to Markdown on stdout. Existing files are never overwritten
unless --force is supplied. JSON is a complete snapshot (no character budget).
verify accepts Markdown or JSON; exit 0 = same tracked state, 2 = stale, 1 = error.
Untracked file contents are NOT fingerprinted. Neither command runs project code.
`;

async function main() {
  const { values: v, positionals: p } = parseArgs({
    options: {
      repo: { type: 'string' }, output: { type: 'string' }, format: { type: 'string' },
      commits: { type: 'string' }, 'max-chars': { type: 'string' },
      force: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    }, allowPositionals: true, strict: true,
  });
  if (v.help || !p.length) { process.stdout.write(help); return; }
  const repo = resolve(v.repo ?? '.');
  if (p[0] === 'snapshot') {
    if (p.length !== 1) throw new Error('snapshot does not accept positional arguments.');
    const commits = Number(v.commits ?? 5);
    const limit = Number(v['max-chars'] ?? 12000);
    if (!Number.isInteger(commits) || commits < 0 || commits > 20) throw new Error('--commits must be an integer from 0 to 20.');
    if (!Number.isInteger(limit) || limit < 2000 || limit > 100000) throw new Error('--max-chars must be an integer from 2000 to 100000.');
    const format = v.format ?? 'markdown';
    if (!['markdown', 'json'].includes(format)) throw new Error('--format must be markdown or json.');
    if (format === 'json' && v['max-chars']) throw new Error('--max-chars applies only to Markdown.');
    const s = await snapshot(repo, commits);
    const text = format === 'json' ? JSON.stringify(s, null, 2) + '\n' : render(s, limit);
    if (v.output) {
      const file = await open(resolve(v.output), constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW | (v.force ? constants.O_TRUNC : constants.O_EXCL), 0o600);
      try { await file.writeFile(text); } finally { await file.close(); }
      process.stderr.write('Handoff saved. Review it before sharing.\n');
    } else process.stdout.write(text);
  } else if (p[0] === 'verify') {
    if (p.length !== 2) throw new Error('verify needs exactly one handoff file.');
    const input = resolve(p[1]!);
    if ((await stat(input)).size > 2 * 1024 * 1024) throw new Error('Handoff file exceeds 2 MiB.');
    const text = await readFile(input, 'utf8');
    let fingerprint: string | undefined;
    if (text.trimStart().startsWith('{')) {
      const data: unknown = JSON.parse(text);
      if (typeof data === 'object' && data !== null && 'schemaVersion' in data && data.schemaVersion === 1 && 'fingerprint' in data && typeof data.fingerprint === 'string') fingerprint = data.fingerprint;
    } else fingerprint = text.match(/^Fingerprint: ([a-f0-9]{64})$/m)?.[1];
    if (!fingerprint || !/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('Not a supported handoff file.');
    const current = await snapshot(repo, 0);
    if (current.fingerprint === fingerprint) process.stdout.write('Current: tracked state and changed path list match. Untracked contents were not checked.\n');
    else { process.stdout.write('Stale: tracked state or changed path list differs. Create a new handoff.\n'); process.exitCode = 2; }
  } else throw new Error('Unknown command. Use --help.');
}
main().catch((err: unknown) => {
  const e = err as NodeJS.ErrnoException;
  const msg = e.code === 'EEXIST' ? 'Output already exists. Choose a new path or use --force.'
    : e.code === 'ENOENT' ? 'Input file or output directory does not exist.'
    : e.code === 'ELOOP' ? 'Refusing to write through an output symlink.'
    : e.message;
  process.stderr.write(`Error: ${msg}\n`); process.exitCode = 1;
});

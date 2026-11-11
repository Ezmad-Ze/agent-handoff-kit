import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

export async function git(repo: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await exec('git', ['--no-pager', '-c', 'core.fsmonitor=false', '-C', repo, ...args], {
      encoding: 'utf8', timeout: 15_000, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' },
      shell: false,
    });
    return stdout;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw new Error('Git is not installed or the repository directory does not exist.');
    throw new Error('Git could not inspect this repository (invalid path, timeout, or output above 8 MiB). Raw Git errors are withheld because they may contain private paths.');
  }
}

export interface Change { status: string; path: string; from?: string }

export function parseStatus(raw: string): Change[] {
  const parts = raw.split('\0');
  const changes: Change[] = [];
  for (let i = 0; i < parts.length; i++) {
    const record = parts[i];
    if (!record) continue;
    if (record.length < 4 || record[2] !== ' ') throw new Error('Unexpected Git status format.');
    const status = record.slice(0, 2);
    const change: Change = { status, path: record.slice(3) };
    if (/[RC]/.test(status)) {
      const from = parts[++i];
      if (from === undefined || from === '') throw new Error('Incomplete Git rename record.');
      change.from = from;
    }
    changes.push(change);
  }
  return changes;
}

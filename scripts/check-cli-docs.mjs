import { lstat, readFile, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const begin = '<!-- BEGIN CLI REFERENCE -->';
const end = '<!-- END CLI REFERENCE -->';
const normalize = text => text.replace(/\r\n/g, '\n');

function boundaries(document) {
  const start = document.indexOf(begin);
  const finish = document.indexOf(end);
  if (start < 0 || finish < start + begin.length
      || document.indexOf(begin, start + begin.length) !== -1
      || document.indexOf(end, finish + end.length) !== -1) {
    throw new Error('README must contain exactly one ordered CLI reference marker pair.');
  }
  return [start, finish + end.length];
}

export function referenceBlock(help) {
  return `${begin}\n\n\`\`\`text\n${normalize(help).trimEnd()}\n\`\`\`\n\n${end}`;
}

export function replaceReference(document, help) {
  const [start, finish] = boundaries(document);
  const newline = document.includes('\r\n') ? '\r\n' : '\n';
  const block = referenceBlock(help).replace(/\n/g, newline);
  return document.slice(0, start) + block + document.slice(finish);
}

export function verifyReference(document, help, version) {
  const actual = normalize(help);
  if (actual.split('\n')[0] !== `agent-handoff-kit ${version}`) {
    throw new Error('CLI version banner does not match package.json. Update the CLI banner first.');
  }
  if (normalize(document) !== normalize(replaceReference(document, actual))) {
    throw new Error('README CLI reference is stale. Review the CLI change, then run npm run docs:update.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--write')) {
    throw new Error('Usage: node scripts/check-cli-docs.mjs [--write]');
  }
  const root = new URL('../', import.meta.url);
  const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  const readmeUrl = new URL('README.md', root);
  if ((await lstat(readmeUrl)).isSymbolicLink()) throw new Error('Refusing a symlinked README.');
  const readme = await readFile(readmeUrl, 'utf8');
  // Only this project's built help is run, never scripts from an inspected repository.
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('dist/cli.js', root)), '--help'], {
    cwd: fileURLToPath(root), encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024,
    shell: false,
  });
  if (result.error || result.status !== 0 || result.stderr !== '') {
    throw new Error('Could not read built CLI help. Run npm run build and resolve any CLI error.');
  }
  const candidate = args[0] === '--write' ? replaceReference(readme, result.stdout) : readme;
  verifyReference(candidate, result.stdout, packageJson.version);
  if (args[0] === '--write') {
    if (candidate !== readme) await writeFile(readmeUrl, candidate);
    process.stdout.write('README CLI reference synchronized. Review the diff before committing.\n');
  } else process.stdout.write('README CLI reference and package version match the built CLI.\n');
}

// Node resolves module paths through symlinks, while argv can keep the alias
// (for example /var vs /private/var on macOS). Compare canonical paths.
if (process.argv[1]
    && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  main().catch(error => {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  });
}


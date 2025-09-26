#!/usr/bin/env node
const { mkdtempSync, rmSync, existsSync } = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');

const inputPath = resolve(__dirname, '../Whot2Watch-docs/docs/ERD.mmd');

if (!existsSync(inputPath)) {
  console.error(`Mermaid source not found at ${inputPath}`);
  process.exit(1);
}

const tempDir = mkdtempSync(join(tmpdir(), 'whot2watch-mermaid-'));
const outputPath = join(tempDir, 'erd.svg');

const binCandidate =
  process.platform === 'win32'
    ? resolve(__dirname, '../node_modules/.bin/mmdc.cmd')
    : resolve(__dirname, '../node_modules/.bin/mmdc');

let result;
if (existsSync(binCandidate)) {
  result = spawnSync(binCandidate, ['-i', inputPath, '-o', outputPath, '--quiet'], {
    stdio: 'inherit',
  });
} else {
  result = spawnSync(
    'npx',
    ['--yes', '@mermaid-js/mermaid-cli@10.9.1', '-i', inputPath, '-o', outputPath, '--quiet'],
    { stdio: 'inherit' },
  );
}

rmSync(tempDir, { recursive: true, force: true });

if (result.status !== 0) {
  const msg = 'Mermaid CLI failed to render ERD. Skipping locally; will enforce in CI.';
  if (process.env.CI) {
    console.error(msg);
    process.exit(result.status ?? 1);
  } else {
    console.warn(msg);
    process.exit(0);
  }
}

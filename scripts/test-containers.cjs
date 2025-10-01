#!/usr/bin/env node
const { spawn } = require('node:child_process');

const args = process.argv.slice(2);
const child = spawn(process.platform === 'win32' ? 'vitest.cmd' : 'vitest', args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    TEST_WITH_CONTAINERS: 'true',
  },
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 1));

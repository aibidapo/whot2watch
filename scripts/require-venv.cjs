#!/usr/bin/env node
const { existsSync } = require('fs');
const { resolve } = require('path');

const cwd = process.cwd();
const isCI = process.env.CI === 'true';
const venvEnv = process.env.VIRTUAL_ENV;

// Allow CI to bypass local venv requirement
if (isCI) process.exit(0);

const acceptedVenvDirs = [resolve(cwd, '.venv'), resolve(cwd, 'whot2watch_venv')];

function pathToPosix(p) {
  return (p || '').replace(/\\/g, '/');
}

function isAcceptedVenvPath(p) {
  if (!p) return false;
  const norm = pathToPosix(p);
  const cwdNorm = pathToPosix(cwd);
  return norm.startsWith(cwdNorm) && (norm.endsWith('/.venv') || norm.endsWith('/whot2watch_venv'));
}

const hasLocalVenvDir = acceptedVenvDirs.some(existsSync);
const isEnvActive = isAcceptedVenvPath(venvEnv);

if (!hasLocalVenvDir) {
  // If no local venv folder exists, instruct creation
  console.error(
    '[venv] No local virtual environment found. Create one before running repo scripts.',
  );
  console.error('  python -m venv .venv');
  console.error('  # Then activate it and install deps');
  console.error('  # PowerShell:  .\\.venv\\Scripts\\Activate.ps1');
  console.error('  # bash/zsh:    source .venv/bin/activate');
  process.exit(1);
}

if (!isEnvActive) {
  console.error(
    '[venv] Please activate the project virtual environment before running this command.',
  );
  console.error('  Detected folders:', acceptedVenvDirs.join(', '));
  console.error('  Current VIRTUAL_ENV:', venvEnv || '(not set)');
  console.error(
    '  PowerShell:  .\\.venv\\Scripts\\Activate.ps1  (or  .\\whot2watch_venv\\Scripts\\Activate.ps1)',
  );
  console.error(
    '  bash/zsh:    source .venv/bin/activate        (or  source whot2watch_venv/bin/activate)',
  );
  process.exit(1);
}

process.exit(0);

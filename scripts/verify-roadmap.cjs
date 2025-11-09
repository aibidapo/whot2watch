#!/usr/bin/env node
const { execSync } = require('child_process');

function changedFiles(baseRef) {
  try {
    const out = execSync(`git diff --name-only ${baseRef}...HEAD`, {
      encoding: 'utf8',
    });
    return out.split('\n').filter(Boolean);
  } catch (err) {
    // Handle initial push or unrelated histories where a merge-base does not exist.
    // Fall back to a standard two-dot diff, and if that still fails, diff from the root commit.
    try {
      const out = execSync(`git diff --name-only ${baseRef}..HEAD`, {
        encoding: 'utf8',
      });
      return out.split('\n').filter(Boolean);
    } catch {
      const root = execSync('git rev-list --max-parents=0 HEAD', {
        encoding: 'utf8',
      })
        .split('\n')
        .filter(Boolean)
        .pop();
      const out = execSync(`git diff --name-only ${root}..HEAD`, {
        encoding: 'utf8',
      });
      return out.split('\n').filter(Boolean);
    }
  }
}

function requiresRoadmapUpdate(paths) {
  const codeTouched = paths.some(
    (p) =>
      p.startsWith('Whot2Watch-docs/docs/') ||
      p.startsWith('server/') ||
      p.startsWith('apps/') ||
      p.startsWith('packages/') ||
      p.endsWith('.ts') ||
      p.endsWith('.tsx') ||
      p.endsWith('.js') ||
      p.endsWith('.graphql') ||
      p.endsWith('.yaml') ||
      p.endsWith('.yml'),
  );
  const roadmapTouched = paths.some((p) => p.startsWith('ROADMAP/'));
  return codeTouched && !roadmapTouched;
}

function main() {
  const base = process.env.GITHUB_BASE_REF || 'origin/main';
  const paths = changedFiles(base);
  if (requiresRoadmapUpdate(paths)) {
    console.error(
      '[roadmap] Detected changes to code/contracts without roadmap updates in ROADMAP/.',
    );
    console.error('Changed files:\n' + paths.join('\n'));
    process.exit(1);
  }
}

main();

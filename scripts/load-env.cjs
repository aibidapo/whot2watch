#!/usr/bin/env node
// Minimal .env loader to avoid external deps. Loads key=value pairs into process.env
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

function parseLine(line) {
  // Trim whitespace
  let s = line.trim();
  if (!s || s.startsWith('#')) return null; // skip comments/empty
  // Allow export KEY=... syntax
  if (s.startsWith('export ')) s = s.slice(7).trimStart();
  const eq = s.indexOf('=');
  if (eq === -1) return null;
  const key = s.slice(0, eq).trim();
  let raw = s.slice(eq + 1).trim();
  // Remove surrounding quotes if present
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }
  // Unescape common sequences
  raw = raw.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
  return { key, value: raw };
}

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const { key, value } = parsed;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const envPath = resolve(process.cwd(), '.env');
loadEnv(envPath);

// No-op export for -r preload usage
module.exports = {};

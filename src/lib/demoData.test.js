import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildProfileNarrative } from './profileNarrative.js';

// Regression: ISSUE-001 - the deployed site 404'd on first load because the demo bundle was missing
// Found by /qa on 2026-03-29
// Report: .gstack/qa-reports/qa-report-collective-memory-ui-2026-03-29.md

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../public/data');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readDemoBundle() {
  const profile = await readJson(join(DATA_DIR, 'example.profile.json'));
  const connections = await readJson(join(DATA_DIR, 'example.connections.json'));
  const projectFiles = [
    'example.project.json',
    'example.project-2.json',
    'example.project-3.json',
    'example.project-4.json',
    'example.project-5.json',
    'example.project-6.json',
    'example.project-7.json',
  ];

  const projects = [];
  for (const file of projectFiles) {
    projects.push(await readJson(join(DATA_DIR, file)));
  }

  return { connections, profile, projects, projectFiles };
}

test('demo bundle exists and supports the profile narrative', async () => {
  const { connections, profile, projects, projectFiles } = await readDemoBundle();

  assert.ok(profile.name.length > 0);
  assert.ok(Array.isArray(projects));
  assert.equal(projects.length, projectFiles.length);
  assert.ok(projects.length >= 4);
  assert.ok(Array.isArray(connections.connections));
  assert.ok(connections.connections.length >= 3);

  const narrative = buildProfileNarrative({
    profile,
    connections,
    projects,
  });

  assert.equal(narrative.name, profile.name);
  assert.equal(narrative.stats.projectCount, projects.length);
  assert.ok(narrative.sections.some((section) => section.title === 'Rutas de proyecto'));
  assert.ok(narrative.routes.length >= 1);
});

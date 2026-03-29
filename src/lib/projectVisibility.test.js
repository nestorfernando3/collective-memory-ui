import test from 'node:test';
import assert from 'node:assert/strict';
import { filterVisibleProjects, normalizeHiddenProjectIds } from './projectVisibility.js';

test('normalizes hidden project ids and filters without mutating the original list', () => {
  const projects = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const hiddenProjectIds = [' b ', 'b', '', null, undefined];

  assert.deepEqual(normalizeHiddenProjectIds(hiddenProjectIds), ['b']);

  const visible = filterVisibleProjects(projects, hiddenProjectIds);

  assert.deepEqual(
    visible.map((project) => project.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    projects.map((project) => project.id),
    ['a', 'b', 'c'],
  );
});

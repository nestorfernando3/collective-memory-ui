import test from 'node:test';
import assert from 'node:assert/strict';
import { filterVisibleProjects } from './projectVisibility.js';

test('filters hidden projects without mutating the original list', () => {
  const projects = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  const visible = filterVisibleProjects(projects, ['b']);

  assert.deepEqual(
    visible.map((project) => project.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    projects.map((project) => project.id),
    ['a', 'b', 'c'],
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMemoryBundleFromEntries } from './memoryBundle.js';

test('extracts profile, connections, and nested project files from a folder listing', () => {
  const bundle = extractMemoryBundleFromEntries(
    [
      {
        path: 'Memory/profile.json',
        text: '{"name":"Nestor","site_title":"Collective Memory"}',
      },
      {
        path: 'Memory/connections.json',
        text: '{"connections":[{"source":"a","target":"b"}]}',
      },
      {
        path: 'Memory/projects/a.json',
        text: '{"id":"a","name":"Project A"}',
      },
      {
        path: 'Memory/projects/nested/b.json',
        text: '{"id":"b","name":"Project B"}',
      },
      {
        path: 'Memory/notes.txt',
        text: 'ignore me',
      },
    ],
    { sourceLabel: 'Memory' },
  );

  assert.equal(bundle.profile.name, 'Nestor');
  assert.equal(bundle.connections.connections.length, 1);
  assert.deepEqual(
    bundle.projects.map((project) => project.id).sort(),
    ['a', 'b'],
  );
  assert.equal(bundle.sourceLabel, 'Memory');
});

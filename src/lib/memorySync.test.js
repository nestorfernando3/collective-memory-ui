import test from 'node:test';
import assert from 'node:assert/strict';
import { readMemoryBundleFromDirectoryHandle } from './memorySync.js';

function fileHandle(name, text) {
  return {
    kind: 'file',
    name,
    async getFile() {
      return {
        async text() {
          return text;
        },
      };
    },
  };
}

function directoryHandle(name, entries) {
  return {
    kind: 'directory',
    name,
    async *entries() {
      for (const entry of entries) {
        yield [entry.name, entry];
      }
    },
  };
}

test('reads a memory bundle recursively from an authorized directory handle', async () => {
  const handle = directoryHandle('Memory', [
    fileHandle('profile.json', '{"name":"Nestor","site_title":"Collective Memory"}'),
    fileHandle('connections.json', '{"connections":[{"source":"a","target":"b"}]}'),
    directoryHandle('projects', [
      fileHandle('a.json', '{"id":"a","name":"Project A"}'),
      directoryHandle('nested', [fileHandle('b.json', '{"id":"b","name":"Project B"}')]),
    ]),
    fileHandle('notes.txt', 'ignore me'),
  ]);

  const bundle = await readMemoryBundleFromDirectoryHandle(handle, { sourceLabel: 'Memory' });

  assert.equal(bundle.profile.name, 'Nestor');
  assert.equal(bundle.connections.connections.length, 1);
  assert.deepEqual(
    bundle.projects.map((project) => project.id).sort(),
    ['a', 'b'],
  );
  assert.equal(bundle.sourceLabel, 'Memory');
});

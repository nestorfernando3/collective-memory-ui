import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureDirectoryPermission,
  queryDirectoryPermission,
  readMemoryBundleFromDirectoryHandle,
} from './memorySync.js';

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

function valuesDirectoryHandle(name, entries) {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const entry of entries) {
        yield entry;
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

test('falls back to values() when entries() is unavailable', async () => {
  const handle = valuesDirectoryHandle('Memory', [
    fileHandle('profile.json', '{"name":"Nestor","site_title":"Collective Memory"}'),
    valuesDirectoryHandle('projects', [
      fileHandle('a.json', '{"id":"a","name":"Project A"}'),
    ]),
  ]);

  const bundle = await readMemoryBundleFromDirectoryHandle(handle, { sourceLabel: 'Memory' });

  assert.equal(bundle.profile.name, 'Nestor');
  assert.deepEqual(bundle.projects.map((project) => project.id), ['a']);
});

test('queries and requests directory permission when available', async () => {
  const grantedHandle = {
    kind: 'directory',
    async queryPermission() {
      return 'granted';
    },
  };

  const promptHandle = {
    kind: 'directory',
    async queryPermission() {
      return 'prompt';
    },
    async requestPermission() {
      return 'granted';
    },
  };

  const deniedHandle = {
    kind: 'directory',
    async queryPermission() {
      return 'denied';
    },
  };

  assert.equal(await queryDirectoryPermission(grantedHandle), 'granted');
  assert.equal(await queryDirectoryPermission({ kind: 'directory' }), 'unsupported');
  assert.equal(await ensureDirectoryPermission(promptHandle), true);
  assert.equal(await ensureDirectoryPermission(deniedHandle), false);
  assert.equal(await ensureDirectoryPermission({ kind: 'directory' }), false);
});

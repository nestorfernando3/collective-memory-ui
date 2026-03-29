import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearPersistedDirectoryHandle,
  clearPersistedHiddenProjectIds,
  clearPersistedMemory,
  clearPersistedSnapshot,
  loadPersistedDirectoryHandle,
  loadPersistedHiddenProjectIds,
  loadPersistedSnapshot,
  savePersistedDirectoryHandle,
  savePersistedHiddenProjectIds,
  savePersistedSnapshot,
} from './memoryStore.js';

const clone = globalThis.structuredClone || ((value) => JSON.parse(JSON.stringify(value)));

function createIndexedDbStub() {
  const storeData = new Map();

  const database = {
    objectStoreNames: {
      contains(name) {
        return storeData.has(name);
      },
    },
    createObjectStore(name) {
      if (!storeData.has(name)) {
        storeData.set(name, new Map());
      }
      return storeData.get(name);
    },
    transaction(storeName) {
      if (!storeData.has(storeName)) {
        storeData.set(storeName, new Map());
      }

      const data = storeData.get(storeName);
      const transaction = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore() {
          return {
            put(value, key) {
              data.set(key, clone(value));
              queueMicrotask(() => transaction.oncomplete?.());
            },
            get(key) {
              const request = {};
              queueMicrotask(() => {
                request.result = data.has(key) ? clone(data.get(key)) : undefined;
                request.onsuccess?.();
                queueMicrotask(() => transaction.oncomplete?.());
              });
              return request;
            },
            delete(key) {
              data.delete(key);
              queueMicrotask(() => transaction.oncomplete?.());
            },
          };
        },
      };

      return transaction;
    },
    close() {},
  };

  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = database;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

let originalIndexedDB;

beforeEach(() => {
  originalIndexedDB = globalThis.indexedDB;
  globalThis.indexedDB = createIndexedDbStub();
});

afterEach(() => {
  globalThis.indexedDB = originalIndexedDB;
});

test('round-trips snapshots, directory handles, and hidden ids through IndexedDB', async () => {
  const snapshot = {
    profile: { name: 'Nestor' },
    projects: [{ id: 'a' }],
    connections: { connections: [] },
    sourceLabel: 'Memory',
  };
  const handle = { kind: 'directory', name: 'Memory' };

  assert.deepEqual(await savePersistedSnapshot(snapshot), snapshot);
  assert.deepEqual(await loadPersistedSnapshot(), snapshot);

  assert.deepEqual(await savePersistedDirectoryHandle(handle), handle);
  assert.deepEqual(await loadPersistedDirectoryHandle(), handle);

  assert.deepEqual(await savePersistedHiddenProjectIds([' a ', 'b', 'b', '']), ['a', 'b']);
  assert.deepEqual(await loadPersistedHiddenProjectIds(), ['a', 'b']);

  await clearPersistedHiddenProjectIds();
  assert.deepEqual(await loadPersistedHiddenProjectIds(), []);

  await clearPersistedSnapshot();
  assert.equal(await loadPersistedSnapshot(), null);

  await clearPersistedDirectoryHandle();
  assert.equal(await loadPersistedDirectoryHandle(), null);

  await clearPersistedMemory();
  assert.equal(await loadPersistedSnapshot(), null);
  assert.equal(await loadPersistedDirectoryHandle(), null);
  assert.deepEqual(await loadPersistedHiddenProjectIds(), []);
});

test('falls back safely when IndexedDB is unavailable', async () => {
  globalThis.indexedDB = undefined;

  assert.deepEqual(await savePersistedHiddenProjectIds([' a ', 'a', 'b']), ['a', 'b']);
  assert.deepEqual(await loadPersistedHiddenProjectIds(), []);
  assert.deepEqual(await savePersistedSnapshot({ profile: { name: 'Nestor' } }), {
    profile: { name: 'Nestor' },
  });
  assert.equal(await loadPersistedSnapshot(), null);
});

import { normalizeHiddenProjectIds } from './projectVisibility.js';

const DB_NAME = 'collective-memory-ui';
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'active-snapshot';
const DIRECTORY_HANDLE_KEY = 'authorized-directory-handle';
const HIDDEN_PROJECT_IDS_KEY = 'hidden-project-ids';

function hasIndexedDB() {
  return typeof globalThis.indexedDB !== 'undefined';
}

function openDatabase() {
  if (!hasIndexedDB()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open memory database'));
  });
}

async function withStore(mode, callback) {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('Memory transaction failed'));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error('Memory transaction aborted'));
    };

    try {
      result = callback(store);
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

export async function savePersistedSnapshot(snapshot) {
  if (!snapshot) return null;

  if (!hasIndexedDB()) return snapshot;

  return withStore('readwrite', (store) => {
    store.put(snapshot, SNAPSHOT_KEY);
    return snapshot;
  });
}

export async function loadPersistedSnapshot() {
  return withStore('readonly', (store) => new Promise((resolve, reject) => {
    const request = store.get(SNAPSHOT_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Unable to read saved memory snapshot'));
  }));
}

export async function clearPersistedSnapshot() {
  return withStore('readwrite', (store) => {
    store.delete(SNAPSHOT_KEY);
    return null;
  });
}

export async function savePersistedDirectoryHandle(directoryHandle) {
  if (!directoryHandle) return null;

  if (!hasIndexedDB()) return directoryHandle;

  return withStore('readwrite', (store) => {
    store.put(directoryHandle, DIRECTORY_HANDLE_KEY);
    return directoryHandle;
  });
}

export async function loadPersistedDirectoryHandle() {
  return withStore('readonly', (store) => new Promise((resolve, reject) => {
    const request = store.get(DIRECTORY_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Unable to read saved directory handle'));
  }));
}

export async function clearPersistedDirectoryHandle() {
  return withStore('readwrite', (store) => {
    store.delete(DIRECTORY_HANDLE_KEY);
    return null;
  });
}

export async function savePersistedHiddenProjectIds(hiddenProjectIds) {
  const normalized = normalizeHiddenProjectIds(hiddenProjectIds);

  if (!hasIndexedDB()) return normalized;

  return withStore('readwrite', (store) => {
    store.put(normalized, HIDDEN_PROJECT_IDS_KEY);
    return normalized;
  });
}

export async function loadPersistedHiddenProjectIds() {
  const persisted = await withStore('readonly', (store) => new Promise((resolve, reject) => {
    const request = store.get(HIDDEN_PROJECT_IDS_KEY);
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error || new Error('Unable to read saved hidden project ids'));
  }));

  return normalizeHiddenProjectIds(persisted);
}

export async function clearPersistedHiddenProjectIds() {
  return withStore('readwrite', (store) => {
    store.delete(HIDDEN_PROJECT_IDS_KEY);
    return null;
  });
}

export async function clearPersistedMemory() {
  return withStore('readwrite', (store) => {
    store.delete(SNAPSHOT_KEY);
    store.delete(DIRECTORY_HANDLE_KEY);
    store.delete(HIDDEN_PROJECT_IDS_KEY);
    return null;
  });
}

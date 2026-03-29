const DB_NAME = 'collective-memory-ui';
const STORE_NAME = 'snapshots';
const STORAGE_KEY = 'active-snapshot';

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

  return withStore('readwrite', (store) => {
    store.put(snapshot, STORAGE_KEY);
    return snapshot;
  });
}

export async function loadPersistedSnapshot() {
  return withStore('readonly', (store) => new Promise((resolve, reject) => {
    const request = store.get(STORAGE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Unable to read saved memory snapshot'));
  }));
}

export async function clearPersistedSnapshot() {
  return withStore('readwrite', (store) => {
    store.delete(STORAGE_KEY);
    return null;
  });
}

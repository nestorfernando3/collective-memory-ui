import { extractMemoryBundleFromEntries } from './memoryBundle.js';

const JSON_EXTENSION = '.json';

function normalizePath(path) {
  return String(path || '').replaceAll('\\', '/');
}

function joinPath(basePath, name) {
  return basePath ? `${basePath}/${name}` : name;
}

async function* iterateDirectoryEntries(directoryHandle) {
  if (!directoryHandle) return;

  if (typeof directoryHandle.entries === 'function') {
    for await (const entry of directoryHandle.entries()) {
      yield entry;
    }
    return;
  }

  if (typeof directoryHandle.values === 'function') {
    for await (const childHandle of directoryHandle.values()) {
      yield [childHandle.name, childHandle];
    }
  }
}

async function collectDirectoryEntries(directoryHandle, basePath = '') {
  const collected = [];

  for await (const [name, childHandle] of iterateDirectoryEntries(directoryHandle)) {
    const path = joinPath(basePath, name);

    if (childHandle?.kind === 'directory') {
      collected.push(...(await collectDirectoryEntries(childHandle, path)));
      continue;
    }

    if (childHandle?.kind !== 'file') continue;
    if (!normalizePath(name).toLowerCase().endsWith(JSON_EXTENSION)) continue;

    const file = await childHandle.getFile();
    collected.push({
      name,
      path,
      text: await file.text(),
    });
  }

  return collected;
}

export async function readMemoryBundleFromDirectoryHandle(directoryHandle, options = {}) {
  if (!directoryHandle || directoryHandle.kind !== 'directory') {
    throw new Error('A directory handle is required');
  }

  const rootName = options.sourceLabel || directoryHandle.name || 'Local memory';
  const entries = await collectDirectoryEntries(directoryHandle, rootName);
  return extractMemoryBundleFromEntries(entries, {
    importedAt: options.importedAt,
    sourceLabel: rootName,
  });
}

export async function queryDirectoryPermission(directoryHandle, mode = 'read') {
  if (!directoryHandle || typeof directoryHandle.queryPermission !== 'function') {
    return 'unsupported';
  }

  try {
    return await directoryHandle.queryPermission({ mode });
  } catch {
    return 'unsupported';
  }
}

export async function ensureDirectoryPermission(directoryHandle, mode = 'read') {
  if (!directoryHandle) return false;

  const currentPermission = await queryDirectoryPermission(directoryHandle, mode);
  if (currentPermission === 'granted') return true;

  if (currentPermission === 'prompt' && typeof directoryHandle.requestPermission === 'function') {
    try {
      return (await directoryHandle.requestPermission({ mode })) === 'granted';
    } catch {
      return false;
    }
  }

  return false;
}

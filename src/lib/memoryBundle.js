const JSON_EXTENSION = '.json';

function normalizePath(path) {
  return String(path || '').replaceAll('\\', '/');
}

function getName(path) {
  const normalized = normalizePath(path);
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function inferSourceLabel(entries) {
  for (const entry of entries) {
    const path = normalizePath(entry.path || entry.webkitRelativePath || entry.name || '');
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 1) return parts[0];
  }
  return '';
}

function parseJsonEntry(entry, path) {
  if (typeof entry?.text !== 'string') {
    throw new Error(`Unable to read ${path || 'memory entry'}`);
  }

  try {
    return JSON.parse(entry.text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path || 'memory entry'}: ${error.message}`);
  }
}

export function extractMemoryBundleFromEntries(entries, options = {}) {
  const fileEntries = Array.isArray(entries) ? entries : [];
  let profile = null;
  let connections = { connections: [] };
  const projects = [];

  for (const entry of fileEntries) {
    const path = normalizePath(entry.path || entry.webkitRelativePath || entry.name || '');
    const name = getName(path);

    if (!name.toLowerCase().endsWith(JSON_EXTENSION)) continue;

    const json = parseJsonEntry(entry, path);

    if (name === 'profile.json') {
      profile = json;
      continue;
    }

    if (name === 'connections.json') {
      connections = json?.connections ? json : { connections: [] };
      continue;
    }

    if (path.includes('/projects/')) {
      projects.push(json);
    }
  }

  if (!profile) {
    throw new Error('profile.json not found in uploaded memory folder');
  }

  return {
    profile,
    connections: Array.isArray(connections?.connections) ? connections : { connections: [] },
    importedAt: options.importedAt || new Date().toISOString(),
    projects,
    sourceLabel: options.sourceLabel || inferSourceLabel(fileEntries) || profile.site_title || profile.name || 'Local memory',
  };
}

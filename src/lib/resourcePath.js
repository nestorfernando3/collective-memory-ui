export function joinBasePath(basePath, resourcePath) {
  const base = String(basePath || './').trim() || './';
  const resource = String(resourcePath || '').replace(/^\/+/, '');

  if (!resource) return base;
  if (base === './' || base === '.') return `./${resource}`;
  if (base.endsWith('/')) return `${base}${resource}`;
  return `${base}/${resource}`;
}

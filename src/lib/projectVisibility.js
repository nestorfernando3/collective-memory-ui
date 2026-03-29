function normalizeProjectId(value) {
  return String(value || '').trim();
}

export function normalizeHiddenProjectIds(hiddenProjectIds) {
  return [...new Set((Array.isArray(hiddenProjectIds) ? hiddenProjectIds : []).map(normalizeProjectId).filter(Boolean))];
}

export function filterVisibleProjects(projects, hiddenProjectIds) {
  const hidden = new Set(normalizeHiddenProjectIds(hiddenProjectIds));
  return (Array.isArray(projects) ? projects : []).filter((project) => !hidden.has(normalizeProjectId(project?.id)));
}


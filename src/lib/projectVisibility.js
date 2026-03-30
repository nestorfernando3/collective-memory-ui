function normalizeProjectId(value) {
  return String(value || '').trim();
}

export function filterVisibleProjects(projects = [], hiddenProjectIds = []) {
  const hiddenIds = new Set(
    (Array.isArray(hiddenProjectIds) ? hiddenProjectIds : [])
      .map(normalizeProjectId)
      .filter(Boolean),
  );

  return (Array.isArray(projects) ? projects : []).filter((project) => {
    if (!project || typeof project !== 'object') return false;
    const projectId = normalizeProjectId(project.id);
    if (!projectId) return false;
    return !hiddenIds.has(projectId);
  });
}

import { buildConnectionInsight } from './connectionInsights.js';
import { normalizeLocale, translateAffiliationRole } from './i18n.js';
import { filterVisibleProjects } from './projectVisibility.js';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function projectLabel(project, locale = 'en') {
  return project?.name || project?.title || project?.id || (normalizeLocale(locale) === 'es' ? 'Proyecto' : 'Project');
}

function profileLabel(profile, locale = 'en') {
  return profile?.name || (normalizeLocale(locale) === 'es' ? 'Perfil central' : 'Central profile');
}

function profileSubtitle(profile, locale = 'en') {
  const normalizedLocale = normalizeLocale(locale);
  const currentAffiliation = Array.isArray(profile?.affiliations)
    ? profile.affiliations.find((item) => item?.current) || profile.affiliations[0]
    : null;

  if (currentAffiliation?.role) {
    return translateAffiliationRole(currentAffiliation.role, normalizedLocale) || currentAffiliation.role;
  }

  return normalizedLocale === 'es' ? 'Investigador' : 'Researcher';
}

function buildProjectById(projects) {
  return new Map(
    (Array.isArray(projects) ? projects : [])
      .filter((project) => project && project.id)
      .map((project) => [project.id, project]),
  );
}

function matchesLens(project, lens) {
  const filters = Array.isArray(lens?.filter) ? lens.filter.map(normalizeText).filter(Boolean) : [];
  if (!filters.length) return true;

  const haystack = normalizeText([
    project?.name,
    project?.title,
    project?.description,
    project?.abstract,
    project?.type,
    project?.status,
    ...(Array.isArray(project?.tags) ? project.tags : []),
    ...(Array.isArray(project?.domains) ? project.domains : []),
    ...(Array.isArray(project?.themes) ? project.themes : []),
    ...(Array.isArray(project?.technologies) ? project.technologies : []),
    ...(Array.isArray(project?.theoretical_frameworks) ? project.theoretical_frameworks : []),
  ].join(' '));

  return filters.some((filter) => haystack.includes(filter));
}

function filterProjectsByLens(projects, lenses, activeLensId) {
  const availableProjects = Array.isArray(projects) ? projects : [];
  if (!activeLensId || activeLensId === 'All') return availableProjects;

  const lens = (Array.isArray(lenses) ? lenses : []).find((item) => item?.id === activeLensId);
  if (!lens) return availableProjects;

  return availableProjects.filter((project) => matchesLens(project, lens));
}

function buildCircularPositions(count, radius = 360) {
  if (!count) return [];
  const angleStep = (Math.PI * 2) / count;
  const startAngle = -Math.PI / 2;

  return Array.from({ length: count }, (_, index) => {
    const angle = startAngle + index * angleStep;
    return {
      x: Math.round(radius * Math.cos(angle)),
      y: Math.round(radius * Math.sin(angle)),
    };
  });
}

function buildProjectNode(project, position, locale = 'en') {
  return {
    id: project.id,
    type: 'project',
    position,
    data: {
      kind: 'project',
      projectId: project.id,
      label: projectLabel(project, locale),
      subtitle: project.status || project.type || '',
      project,
    },
  };
}

function buildProfileNode(profile, locale = 'en') {
  return {
    id: 'user_profile',
    type: 'profile',
    position: { x: 0, y: 0 },
    data: {
      kind: 'profile',
      label: profileLabel(profile, locale),
      subtitle: profileSubtitle(profile, locale),
      profile,
    },
  };
}

function buildCoreEdge(projectId) {
  return {
    id: `core:${projectId}`,
    source: 'user_profile',
    target: projectId,
    animated: true,
    type: 'smoothstep',
    style: {
      stroke: 'rgba(26, 26, 26, 0.4)',
      strokeWidth: 1.5,
      strokeDasharray: '4 8',
    },
    data: {
      kind: 'profile-link',
    },
  };
}

function buildConnectionEdges({ visibleProjects, allProjects, connections, locale = 'en', visibilityMode = 'default' }) {
  const normalizedLocale = normalizeLocale(locale);
  const projectById = buildProjectById(allProjects);
  const visibleProjectIds = new Set((Array.isArray(visibleProjects) ? visibleProjects : []).map((project) => project.id));
  const allInsights = (Array.isArray(connections?.connections) ? connections.connections : [])
    .map((connection, index) => buildConnectionInsight(connection, projectById, `graph-${index}`, normalizedLocale))
    .filter((item) => item.source && item.target)
    .filter((item) => item.sourceProject && item.targetProject)
    .filter((item) => visibleProjectIds.has(item.source) && visibleProjectIds.has(item.target))
    .filter((item) => visibilityMode === 'all' || item.visibility === 'default');

  const edges = allInsights.map((item) => ({
    id: `connection:${item.source}:${item.target}`,
    source: item.source,
    target: item.target,
    type: 'smoothstep',
    label: item.type,
    style: {
      stroke: item.tier === 'exploratory' ? '#1d3557' : '#e63946',
      strokeWidth: item.tier === 'exploratory' ? 1.75 : 2.6,
      strokeDasharray: item.visibility === 'optional' ? '8 6' : undefined,
    },
    labelStyle: {
      fill: '#1a1a1a',
      fontWeight: 700,
      fontSize: 12,
    },
    data: {
      kind: 'connection',
      sourceProjectId: item.source,
      targetProjectId: item.target,
      sourceLabel: item.sourceLabel,
      targetLabel: item.targetLabel,
      type: item.type,
      tier: item.tier,
      visibility: item.visibility,
      selectionReason: item.selectionReason,
      description: item.description,
      strengthLabel: item.strengthLabel,
      strengthValue: item.strengthValue,
      evidenceScore: item.evidenceScore,
      insight: item,
    },
  }));

  const strongConnectionCount = allInsights.filter((item) => item.tier === 'strong' && item.visibility === 'default').length;
  const exploratoryConnectionCount = (Array.isArray(connections?.connections) ? connections.connections : [])
    .map((connection, index) => buildConnectionInsight(connection, projectById, `count-${index}`, normalizedLocale))
    .filter((item) => item.sourceProject && item.targetProject)
    .filter((item) => visibleProjectIds.has(item.source) && visibleProjectIds.has(item.target))
    .filter((item) => item.tier === 'exploratory').length;

  return {
    edges,
    visibleConnectionCount: edges.length,
    strongConnectionCount,
    exploratoryConnectionCount,
  };
}

export function buildGraphModel({
  profile = {},
  projects = [],
  connections = {},
  hiddenProjectIds = [],
  locale = 'en',
  activeLensId = 'All',
  visibilityMode = 'default',
} = {}) {
  const visibleProjects = filterProjectsByLens(
    filterVisibleProjects(projects, hiddenProjectIds),
    profile?.lenses,
    activeLensId,
  );

  const radius = Math.max(260, 180 + visibleProjects.length * 26);
  const positions = buildCircularPositions(visibleProjects.length, radius);

  const profileNode = buildProfileNode(profile, locale);
  const projectNodes = visibleProjects.map((project, index) => buildProjectNode(project, positions[index], locale));
  const connectionData = buildConnectionEdges({
    visibleProjects,
    allProjects: projects,
    connections,
    locale,
    visibilityMode,
  });

  return {
    nodes: [profileNode, ...projectNodes],
    edges: [
      ...projectNodes.map((projectNode) => buildCoreEdge(projectNode.id)),
      ...connectionData.edges,
    ],
    profileNode,
    projectNodes,
    visibleProjects,
    meta: {
      visibleProjectCount: visibleProjects.length,
      visibleConnectionCount: connectionData.visibleConnectionCount,
      strongConnectionCount: connectionData.strongConnectionCount,
      exploratoryConnectionCount: connectionData.exploratoryConnectionCount,
      activeLensId,
      visibilityMode,
    },
  };
}

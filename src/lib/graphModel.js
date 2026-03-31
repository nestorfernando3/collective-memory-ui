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
    type: 'default',
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

export function buildConnectionEdgeBundle({
  visibleProjects,
  allProjects,
  connections,
  locale = 'en',
  visibilityMode = 'default',
} = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const projectById = buildProjectById(allProjects);
  const visibleProjectIds = new Set((Array.isArray(visibleProjects) ? visibleProjects : []).map((project) => project.id));
  const edges = [];
  let strongConnectionCount = 0;
  let exploratoryConnectionCount = 0;

  for (const [index, connection] of (Array.isArray(connections?.connections) ? connections.connections : []).entries()) {
    const insight = buildConnectionInsight(connection, projectById, `graph-${index}`, normalizedLocale);

    if (!insight.source || !insight.target || !insight.sourceProject || !insight.targetProject) {
      continue;
    }

    if (!visibleProjectIds.has(insight.source) || !visibleProjectIds.has(insight.target)) {
      continue;
    }

    if (insight.tier === 'strong' && insight.visibility === 'default') {
      strongConnectionCount += 1;
    }

    if (insight.tier === 'exploratory') {
      exploratoryConnectionCount += 1;
    }

    if (visibilityMode !== 'all' && insight.visibility !== 'default') {
      continue;
    }

    edges.push({
      id: `connection:${insight.source}:${insight.target}`,
      source: insight.source,
      target: insight.target,
      type: 'default',
      label: insight.type,
      style: {
        stroke: insight.tier === 'exploratory' ? '#1d3557' : '#e63946',
        strokeWidth: insight.tier === 'exploratory' ? 1.75 : 2.6,
        strokeDasharray: insight.visibility === 'optional' ? '8 6' : undefined,
      },
      labelStyle: {
        fill: '#1a1a1a',
        fontWeight: 700,
        fontSize: 12,
      },
      data: {
        kind: 'connection',
        sourceProjectId: insight.source,
        targetProjectId: insight.target,
        sourceLabel: insight.sourceLabel,
        targetLabel: insight.targetLabel,
        type: insight.type,
        tier: insight.tier,
        visibility: insight.visibility,
        selectionReason: insight.selectionReason,
        description: insight.description,
        strengthLabel: insight.strengthLabel,
        strengthValue: insight.strengthValue,
        evidenceScore: insight.evidenceScore,
        insight,
      },
    });
  }

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
  const connectionData = buildConnectionEdgeBundle({
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

import { resolveConnectionEndpointIds } from './graphConnections.js';
import { normalizeLocale } from './i18n.js';
import { isWeakGenericDescription, sanitizeConnectionDescription } from './connectionText.js';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function projectLabel(project, fallbackId, locale) {
  return project?.name || project?.title || fallbackId || (normalizeLocale(locale) === 'es' ? 'Proyecto' : 'Project');
}

function getConnectionStrengthValue(connection) {
  const evidenceScore = Number(connection?.evidence?.score);
  if (Number.isFinite(evidenceScore)) {
    return evidenceScore;
  }

  const strength = normalizeText(connection?.strength);
  if (!strength) return 0;
  if (strength.includes('alta') || strength.includes('strong')) return 3;
  if (strength.includes('media') || strength.includes('medium')) return 2;
  if (strength.includes('baja') || strength.includes('low')) return 1;
  return 0;
}

function getStrengthLabel(connection, strengthValue, locale) {
  const explicitStrength = String(connection?.strength || '').trim();
  if (explicitStrength) {
    return explicitStrength;
  }

  if (Number.isFinite(strengthValue) && strengthValue > 0) {
    return String(strengthValue);
  }

  return normalizeLocale(locale) === 'es' ? 'Sin nivel' : 'No level';
}

function buildProjectById(projects) {
  return new Map(
    (Array.isArray(projects) ? projects : [])
      .filter((project) => project && project.id)
      .map((project) => [project.id, project]),
  );
}

function normalizeTier(value) {
  const tier = normalizeText(value);
  return tier === 'strong' || tier === 'exploratory' ? tier : 'strong';
}

function normalizeVisibility(value) {
  const visibility = normalizeText(value);
  return visibility === 'optional' ? 'optional' : 'default';
}

function buildFallbackDescription(connection, locale) {
  const normalizedLocale = normalizeLocale(locale);
  const tier = normalizeTier(connection?.tier);

  if (tier === 'exploratory') {
    return normalizedLocale === 'es' ? 'Sin descripción revisada' : 'No reviewed description';
  }

  return '';
}

export function buildConnectionInsight(connection, projectById, fallbackId = '', locale = 'en') {
  const { source, target } = resolveConnectionEndpointIds(connection);
  const sourceProject = projectById.get(source) || null;
  const targetProject = projectById.get(target) || null;
  const strengthValue = getConnectionStrengthValue(connection);
  const sourceLabel = projectLabel(sourceProject, source, locale);
  const targetLabel = projectLabel(targetProject, target, locale);
  const normalizedLocale = normalizeLocale(locale);
  const evidenceScore = Number.isFinite(Number(connection?.evidence?.score)) ? Number(connection.evidence.score) : null;
  const description = sanitizeConnectionDescription(connection?.description);
  const tier = normalizeTier(connection?.tier);
  const visibility = normalizeVisibility(connection?.visibility);
  const selectionReason = String(connection?.selection_reason || connection?.selectionReason || '').trim() || (tier === 'strong' ? 'strong-evidence' : 'exploratory');

  return {
    id: connection?.id || `${source}::${target}::${fallbackId}`,
    source,
    target,
    sourceProjectId: source || '',
    targetProjectId: target || '',
    sourceProject,
    targetProject,
    sourceLabel,
    targetLabel,
    label: `${sourceLabel} → ${targetLabel}`,
    otherProjectId: source && source === fallbackId ? target : source,
    otherProjectLabel: source && source === fallbackId ? targetLabel : sourceLabel,
    type: connection?.type || (normalizedLocale === 'es' ? 'Sinérgica' : 'Synergistic'),
    tier,
    visibility,
    selectionReason,
    description: isWeakGenericDescription(description) ? buildFallbackDescription(connection, normalizedLocale) : description,
    strengthLabel: getStrengthLabel(connection, strengthValue, normalizedLocale),
    strengthValue,
    evidenceScore,
    raw: connection,
  };
}

export function buildProjectConnectionInsights({ projectId, projects = [], connections = [], locale = 'en', visibilityMode = 'default' } = {}) {
  const projectById = buildProjectById(projects);

  return (Array.isArray(connections) ? connections : [])
    .map((connection, index) => buildConnectionInsight(connection, projectById, `${projectId}-${index}`, locale))
    .filter((item) => item.source === projectId || item.target === projectId)
    .filter((item) => item.sourceProject && item.targetProject)
    .filter((item) => visibilityMode === 'all' || item.visibility === 'default')
    .map((item) => ({
      ...item,
      otherProjectId: item.source === projectId ? item.target : item.source,
      otherProjectLabel: item.source === projectId ? item.targetLabel : item.sourceLabel,
    }))
    .sort((a, b) => {
      if (a.visibility !== b.visibility) return a.visibility === 'default' ? -1 : 1;
      if (a.tier !== b.tier) return a.tier === 'strong' ? -1 : 1;
      if (b.strengthValue !== a.strengthValue) return b.strengthValue - a.strengthValue;
      if (a.otherProjectLabel !== b.otherProjectLabel) {
        return a.otherProjectLabel.localeCompare(b.otherProjectLabel);
      }
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.label.localeCompare(b.label);
    });
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenizeQuery(query) {
  return normalizeText(query)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildSnippet(text, query, limit = 132) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) return '';

  if (normalizedText.length <= limit) {
    return normalizedText;
  }

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return `${normalizedText.slice(0, limit - 1).trimEnd()}…`;
  }

  const normalizedHaystack = normalizeText(normalizedText);
  const matchIndex = normalizedHaystack.indexOf(normalizedQuery);
  if (matchIndex === -1) {
    return `${normalizedText.slice(0, limit - 1).trimEnd()}…`;
  }

  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(normalizedText.length, start + limit);
  const snippet = normalizedText.slice(start, end).trim();
  return start > 0 ? `…${snippet}${end < normalizedText.length ? '…' : ''}` : `${snippet}${end < normalizedText.length ? '…' : ''}`;
}

function scoreMatch({ primary, secondary = [], query }) {
  const normalizedQuery = normalizeText(query);
  const tokens = tokenizeQuery(query);
  if (!normalizedQuery || !tokens.length) return 0;

  const searchableParts = [primary, ...secondary].map((value) => String(value || '').trim()).filter(Boolean);
  const haystack = normalizeText(searchableParts.join(' '));
  if (!haystack) return 0;

  const exactHit = haystack.includes(normalizedQuery);
  const tokenHit = tokens.every((token) => haystack.includes(token));
  const partialHit = tokens.some((token) => haystack.includes(token));

  if (!exactHit && !tokenHit && !partialHit) {
    return 0;
  }

  let score = 0;
  if (exactHit) score += 6;
  if (tokenHit) score += 4;
  if (partialHit) score += 2;
  if (normalizeText(primary).startsWith(normalizedQuery)) score += 1;

  return score;
}

export function buildGraphSearchResults({ projectNodes = [], edges = [], query = '' } = {}) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  const results = [];

  for (const node of Array.isArray(projectNodes) ? projectNodes : []) {
    if (node?.data?.kind !== 'project' || !node.data.project) continue;

    const project = node.data.project;
    const score = scoreMatch({
      primary: node.data.label,
      secondary: [
        node.data.subtitle,
        project.name,
        project.title,
        project.type,
        project.status,
        project.description,
        project.abstract,
        ...(Array.isArray(project.tags) ? project.tags : []),
        ...(Array.isArray(project.domains) ? project.domains : []),
        ...(Array.isArray(project.themes) ? project.themes : []),
        ...(Array.isArray(project.technologies) ? project.technologies : []),
        ...(Array.isArray(project.theoretical_frameworks) ? project.theoretical_frameworks : []),
      ],
      query,
    });

    if (!score) continue;

    results.push({
      id: node.id,
      kind: 'project',
      label: node.data.label,
      subtitle: node.data.subtitle || '',
      description: buildSnippet(project.description || project.abstract || project.status || project.type || '', query),
      score,
      payload: project,
    });
  }

  for (const edge of Array.isArray(edges) ? edges : []) {
    if (edge?.data?.kind !== 'connection' || !edge.data.insight) continue;

    const insight = edge.data.insight;
    const score = scoreMatch({
      primary: edge.label || insight.label,
      secondary: [
        insight.description,
        insight.type,
        insight.strengthLabel,
        insight.sourceLabel,
        insight.targetLabel,
        insight.selectionReason,
      ],
      query,
    });

    if (!score) continue;

    results.push({
      id: edge.id,
      kind: 'connection',
      label: edge.label || insight.label,
      subtitle: `${insight.sourceLabel} · ${insight.targetLabel}`,
      description: buildSnippet(insight.description || insight.type || '', query),
      score,
      payload: insight,
    });
  }

  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.kind !== b.kind) return a.kind === 'project' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

const { inferMetadataFromDocuments } = require('./inferred_metadata.js');

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return uniq(value);
  }

  if (typeof value === 'string') {
    return uniq(value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean));
  }

  return [];
}

function normalizeMetadata(metadata = {}) {
  const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};

  return {
    domains: normalizeList(safeMetadata.domains),
    themes: normalizeList(safeMetadata.themes),
    institutions: normalizeList(safeMetadata.institutions),
    theoretical_frameworks: normalizeList(safeMetadata.theoretical_frameworks),
    confidence: Number.isFinite(safeMetadata.confidence) ? safeMetadata.confidence : 0,
    sources: normalizeList(safeMetadata.sources),
  };
}

function buildProjectSignalProfile({ projectId, metadata = {}, documents = [], inferred } = {}) {
  const explicit = normalizeMetadata(metadata);
  const derived = normalizeMetadata(inferred || inferMetadataFromDocuments(documents));

  return {
    projectId: projectId || null,
    metadata: explicit,
    inferred: derived,
    documents: Array.isArray(documents) ? documents : [],
    signal: {
      domains: uniq([...explicit.domains, ...derived.domains]),
      themes: uniq([...explicit.themes, ...derived.themes]),
      institutions: uniq([...explicit.institutions, ...derived.institutions]),
      theoretical_frameworks: uniq([...explicit.theoretical_frameworks, ...derived.theoretical_frameworks]),
    },
    confidence: Math.max(explicit.confidence || 0, derived.confidence || 0),
  };
}

module.exports = {
  buildProjectSignalProfile,
};

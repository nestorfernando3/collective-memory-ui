const { inferMetadataFromDocuments } = require('./inferred_metadata.js');

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeMetadata(metadata = {}) {
  return {
    domains: uniq(metadata.domains),
    themes: uniq(metadata.themes),
    institutions: uniq(metadata.institutions),
    theoretical_frameworks: uniq(metadata.theoretical_frameworks),
    confidence: Number.isFinite(metadata.confidence) ? metadata.confidence : 0,
    sources: uniq(metadata.sources),
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

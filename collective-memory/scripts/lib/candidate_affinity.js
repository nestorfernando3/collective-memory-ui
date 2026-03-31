function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function toList(value) {
  if (Array.isArray(value)) {
    return uniq(value);
  }

  if (typeof value === 'string') {
    return uniq(value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean));
  }

  return [];
}

function intersection(left = [], right = []) {
  const leftSet = new Set(toList(left));
  return uniq(toList(right).filter((item) => leftSet.has(item)));
}

function buildAffinityCandidate(leftProfile = {}, rightProfile = {}) {
  const leftMetadata = leftProfile.metadata && typeof leftProfile.metadata === 'object' ? leftProfile.metadata : {};
  const rightMetadata = rightProfile.metadata && typeof rightProfile.metadata === 'object' ? rightProfile.metadata : {};
  const leftInferred = leftProfile.inferred && typeof leftProfile.inferred === 'object' ? leftProfile.inferred : {};
  const rightInferred = rightProfile.inferred && typeof rightProfile.inferred === 'object' ? rightProfile.inferred : {};

  const sharedDomains = intersection(leftMetadata.domains, rightMetadata.domains);
  const sharedInstitutions = intersection(leftMetadata.institutions, rightMetadata.institutions);
  const sharedInferredDomains = intersection(leftInferred.domains, rightInferred.domains);

  const affinityScore = (sharedDomains.length * 20) + (sharedInstitutions.length * 16) + (sharedInferredDomains.length * 30);

  return {
    from: leftProfile.projectId || null,
    to: rightProfile.projectId || null,
    affinityScore,
    shared: {
      domains: sharedDomains,
      institutions: sharedInstitutions,
      inferred_domains: sharedInferredDomains,
    },
  };
}

module.exports = {
  buildAffinityCandidate,
};

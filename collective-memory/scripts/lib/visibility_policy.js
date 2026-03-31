function decideTier(candidate = {}) {
  const affinityScore = Number(candidate.affinityScore || 0);
  const evidenceScore = Number(candidate.evidenceScore || 0);

  if (affinityScore >= 65 && evidenceScore >= 55) {
    return {
      tier: 'strong',
      visibility: 'default',
      selectionReason: 'strong-evidence',
    };
  }

  if (affinityScore >= 60 && evidenceScore >= 20) {
    return {
      tier: 'exploratory',
      visibility: 'optional',
      selectionReason: 'exploratory',
    };
  }

  if (affinityScore < 60 && evidenceScore >= 60) {
    return {
      tier: 'review',
      visibility: 'hidden',
      selectionReason: 'manual-review',
    };
  }

  return {
    tier: 'discarded',
    visibility: 'hidden',
    selectionReason: 'discarded',
  };
}

function normalizedProjectIds(projectIds) {
  return (Array.isArray(projectIds) ? projectIds : [])
    .map((projectId) => String(projectId || '').trim())
    .filter(Boolean);
}

function canonicalPairKey(candidate = {}) {
  const from = String(candidate.from || '').trim();
  const to = String(candidate.to || '').trim();
  return [from, to].sort().join('::');
}

function rescueEligible(candidate = {}) {
  const affinityScore = Number(candidate.affinityScore || 0);
  const evidenceScore = Number(candidate.evidenceScore || 0);

  return affinityScore >= 66 && evidenceScore >= 24;
}

function decideConnectionSet(candidates = [], projectIds = []) {
  const decided = (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => ({
      ...candidate,
      ...decideTier(candidate),
    }))
    .filter((candidate) => candidate.tier !== 'discarded');

  const coverage = new Map(normalizedProjectIds(projectIds).map((projectId) => [projectId, 0]));

  decided.forEach((candidate) => {
    if (candidate.visibility !== 'default') return;

    const from = String(candidate.from || '').trim();
    const to = String(candidate.to || '').trim();

    if (coverage.has(from)) coverage.set(from, (coverage.get(from) || 0) + 1);
    if (coverage.has(to)) coverage.set(to, (coverage.get(to) || 0) + 1);
  });

  normalizedProjectIds(projectIds).forEach((projectId) => {
    if ((coverage.get(projectId) || 0) > 0) return;

    const rescue = decided
      .filter((candidate) => candidate.tier === 'exploratory')
      .filter(rescueEligible)
      .filter((candidate) => {
        const from = String(candidate.from || '').trim();
        const to = String(candidate.to || '').trim();
        return from === projectId || to === projectId;
      })
      .sort((left, right) => {
        const leftScore = Number(left.affinityScore || 0) + Number(left.evidenceScore || 0);
        const rightScore = Number(right.affinityScore || 0) + Number(right.evidenceScore || 0);
        if (rightScore !== leftScore) return rightScore - leftScore;

        const leftKey = canonicalPairKey(left);
        const rightKey = canonicalPairKey(right);
        if (leftKey !== rightKey) return leftKey.localeCompare(rightKey);

        const leftFrom = String(left.from || '').trim();
        const rightFrom = String(right.from || '').trim();
        if (leftFrom !== rightFrom) return leftFrom.localeCompare(rightFrom);

        return String(left.to || '').trim().localeCompare(String(right.to || '').trim());
      })[0];

    if (!rescue) return;

    rescue.visibility = 'default';
    rescue.selectionReason = 'coverage-floor';
    coverage.set(String(rescue.from || '').trim(), 1);
    coverage.set(String(rescue.to || '').trim(), 1);
  });

  return decided;
}

module.exports = {
  decideConnectionSet,
  decideTier,
};

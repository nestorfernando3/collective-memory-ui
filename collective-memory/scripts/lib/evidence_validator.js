function normalizeTier(tier) {
  return String(tier || '').trim().toUpperCase();
}

function isEvidenceTier(tier) {
  const normalized = normalizeTier(tier);
  return normalized === 'A' || normalized === 'B';
}

function collectDocuments(profile = {}) {
  return Array.isArray(profile.documents)
    ? profile.documents.filter((doc) => doc && isEvidenceTier(doc.tier) && typeof doc.text === 'string')
    : [];
}

function extractFragments(documents) {
  const seen = new Set();

  return documents.map((doc) => ({
    tier: normalizeTier(doc.tier),
    text: doc.text.trim(),
  })).filter((doc) => {
    if (!doc.text) {
      return false;
    }

    const normalizedText = doc.text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    const key = `${doc.tier}::${normalizedText}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function scoreFragments(fragments) {
  return fragments.reduce((total, fragment) => {
    if (fragment.tier === 'A') {
      return total + 24;
    }

    if (fragment.tier === 'B') {
      return total + 12;
    }

    return total;
  }, 0);
}

function buildEvidenceAssessment(leftProfile = {}, rightProfile = {}) {
  const evidenceDocuments = [...collectDocuments(leftProfile), ...collectDocuments(rightProfile)];
  const fragments = extractFragments(evidenceDocuments);
  const evidenceScore = scoreFragments(fragments);
  const documentsA = fragments.filter((fragment) => fragment.tier === 'A').length;
  const documentsB = fragments.filter((fragment) => fragment.tier === 'B').length;

  return {
    evidenceScore,
    fragments,
    breakdown: {
      documentsA,
      documentsB,
      documentsTechnical: 0,
    },
  };
}

module.exports = {
  buildEvidenceAssessment,
};

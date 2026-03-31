function normalizeTier(tier) {
  return String(tier || '').trim().toUpperCase();
}

function isEvidenceTier(tier) {
  const normalized = normalizeTier(tier);
  return normalized === 'A' || normalized === 'B';
}

function collectDocuments(profile = {}) {
  return Array.isArray(profile.documents) ? profile.documents.filter((doc) => doc && isEvidenceTier(doc.tier)) : [];
}

function extractFragment(documents) {
  const fragments = documents.map((doc) => ({
    tier: normalizeTier(doc.tier),
    text: String(doc.text || '').trim(),
  })).filter((doc) => doc.text);

  if (!fragments.length) {
    return null;
  }

  const tiers = [...new Set(fragments.map((fragment) => fragment.tier))];
  return {
    tier: tiers.includes('A') ? 'A' : 'B',
    text: fragments.map((fragment) => fragment.text).join(' '),
  };
}

function buildEvidenceAssessment(leftProfile = {}, rightProfile = {}) {
  const evidenceDocuments = [...collectDocuments(leftProfile), ...collectDocuments(rightProfile)];
  const fragment = extractFragment(evidenceDocuments);
  const fragments = fragment ? [fragment] : [];
  const evidenceScore = fragment ? (fragment.tier === 'A' ? 48 : 24) : 0;

  return {
    evidenceScore,
    fragments,
    breakdown: {
      documentsA: fragment && fragment.tier === 'A' ? 48 : 0,
      documentsB: fragment && fragment.tier === 'B' ? 24 : 0,
      documentsTechnical: 0,
    },
  };
}

module.exports = {
  buildEvidenceAssessment,
};

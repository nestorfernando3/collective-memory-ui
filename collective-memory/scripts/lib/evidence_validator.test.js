const test = require('node:test');
const assert = require('node:assert/strict');

const { buildEvidenceAssessment } = require('./evidence_validator.js');

test('buildEvidenceAssessment ignores D/X docs and scores A/B fragments', () => {
  const evidence = buildEvidenceAssessment(
    { documents: [{ tier: 'A', text: 'Barthes and Baudrillard analyse myth and simulacra.' }] },
    { documents: [{ tier: 'D', text: 'Todos los cambios notables...' }, { tier: 'A', text: 'The paper draws on Barthes and myth.' }] },
  );

  assert.ok(evidence.evidenceScore >= 40);
  assert.equal(evidence.fragments.length, 1);
  assert.equal(evidence.breakdown.documentsTechnical, 0);
  assert.equal(evidence.fragments.some((fragment) => fragment.tier === 'D' || fragment.tier === 'X'), false);
});

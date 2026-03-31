const test = require('node:test');
const assert = require('node:assert/strict');

const { buildEvidenceAssessment } = require('./evidence_validator.js');

test('buildEvidenceAssessment ignores D/X docs and scores A/B fragments', () => {
  const evidence = buildEvidenceAssessment(
    { documents: [{ tier: 'A', text: 'Barthes and Baudrillard analyse myth and simulacra.' }] },
    { documents: [{ tier: 'D', text: 'Todos los cambios notables...' }, { tier: 'A', text: 'The paper draws on Barthes and myth.' }] },
  );

  assert.ok(evidence.evidenceScore >= 40);
  assert.equal(evidence.fragments.length, 2);
  assert.equal(evidence.breakdown.documentsTechnical, 0);
  assert.equal(evidence.fragments.some((fragment) => fragment.tier === 'D' || fragment.tier === 'X'), false);
  assert.equal(evidence.breakdown.documentsA, 2);
  assert.equal(evidence.breakdown.documentsB, 0);
});

test('buildEvidenceAssessment preserves mixed A/B provenance and rejects invalid text', () => {
  const evidence = buildEvidenceAssessment(
    { documents: [{ tier: 'A', text: 'Alpha evidence.' }, { tier: 'B', text: { bad: true } }] },
    { documents: [{ tier: 'B', text: 'Beta evidence.' }] },
  );

  assert.equal(evidence.fragments.length, 2);
  assert.deepEqual(evidence.fragments.map((fragment) => fragment.tier), ['A', 'B']);
  assert.equal(evidence.breakdown.documentsA, 1);
  assert.equal(evidence.breakdown.documentsB, 1);
  assert.equal(evidence.evidenceScore, 36);
});

test('buildEvidenceAssessment ignores invalid non-string document text', () => {
  const evidence = buildEvidenceAssessment(
    { documents: [{ tier: 'A', text: { bad: true } }] },
    { documents: [{ tier: 'B', text: null }] },
  );

  assert.equal(evidence.fragments.length, 0);
  assert.equal(evidence.evidenceScore, 0);
  assert.equal(evidence.breakdown.documentsA, 0);
  assert.equal(evidence.breakdown.documentsB, 0);
});

test('buildEvidenceAssessment dedupes repeated A evidence across profiles', () => {
  const evidence = buildEvidenceAssessment(
    { documents: [{ tier: 'A', text: 'Shared evidence snippet.' }] },
    { documents: [{ tier: 'A', text: 'Shared evidence snippet.' }] },
  );

  assert.equal(evidence.fragments.length, 1);
  assert.equal(evidence.breakdown.documentsA, 1);
  assert.equal(evidence.evidenceScore, 24);
});

test('buildEvidenceAssessment dedupes case-only evidence variants', () => {
  const evidence = buildEvidenceAssessment(
    { documents: [{ tier: 'A', text: 'Shared evidence snippet.' }] },
    { documents: [{ tier: 'A', text: 'shared evidence snippet.' }] },
  );

  assert.equal(evidence.fragments.length, 1);
  assert.equal(evidence.breakdown.documentsA, 1);
  assert.equal(evidence.evidenceScore, 24);
});

test('buildEvidenceAssessment dedupes punctuation-only evidence variants', () => {
  const evidence = buildEvidenceAssessment(
    { documents: [{ tier: 'A', text: 'Shared evidence snippet.' }] },
    { documents: [{ tier: 'A', text: 'Shared evidence snippet!' }] },
  );

  assert.equal(evidence.fragments.length, 1);
  assert.equal(evidence.breakdown.documentsA, 1);
  assert.equal(evidence.evidenceScore, 24);
});

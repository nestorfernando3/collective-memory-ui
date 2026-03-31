const test = require('node:test');
const assert = require('node:assert/strict');

const { decideConnectionSet, decideTier } = require('./visibility_policy.js');

test('decideTier maps affinity and evidence into visibility tiers', () => {
  assert.deepEqual(decideTier({ affinityScore: 80, evidenceScore: 60 }), {
    tier: 'strong',
    visibility: 'default',
    selectionReason: 'strong-evidence',
  });

  assert.deepEqual(decideTier({ affinityScore: 62, evidenceScore: 24 }), {
    tier: 'exploratory',
    visibility: 'optional',
    selectionReason: 'exploratory',
  });

  assert.deepEqual(decideTier({ affinityScore: 52, evidenceScore: 61 }), {
    tier: 'review',
    visibility: 'hidden',
    selectionReason: 'manual-review',
  });

  assert.deepEqual(decideTier({ affinityScore: 30, evidenceScore: 10 }), {
    tier: 'discarded',
    visibility: 'hidden',
    selectionReason: 'discarded',
  });
});

test('decideConnectionSet promotes the best exploratory edge for uncovered projects', () => {
  const decided = decideConnectionSet(
    [
      { from: 'alpha', to: 'beta', affinityScore: 78, evidenceScore: 70 },
      { from: 'gamma', to: 'beta', affinityScore: 68, evidenceScore: 26 },
      { from: 'gamma', to: 'delta', affinityScore: 40, evidenceScore: 10 },
    ],
    ['alpha', 'beta', 'gamma', 'delta'],
  );

  const promoted = decided.find((item) => item.from === 'gamma' && item.to === 'beta');
  assert.equal(promoted.tier, 'exploratory');
  assert.equal(promoted.visibility, 'default');
  assert.equal(promoted.selectionReason, 'coverage-floor');
});

test('decideConnectionSet preserves review candidates with hidden manual-review semantics', () => {
  const decided = decideConnectionSet(
    [
      { from: 'alpha', to: 'beta', affinityScore: 52, evidenceScore: 61 },
      { from: 'alpha', to: 'gamma', affinityScore: 30, evidenceScore: 10 },
    ],
    ['alpha', 'beta', 'gamma'],
  );

  const review = decided.find((item) => item.from === 'alpha' && item.to === 'beta');
  assert.ok(review);
  assert.equal(review.tier, 'review');
  assert.equal(review.visibility, 'hidden');
  assert.equal(review.selectionReason, 'manual-review');
});

test('decideConnectionSet does not promote weak exploratory edges under the coverage floor', () => {
  const decided = decideConnectionSet(
    [
      { from: 'alpha', to: 'beta', affinityScore: 78, evidenceScore: 70 },
      { from: 'gamma', to: 'beta', affinityScore: 60, evidenceScore: 20 },
    ],
    ['alpha', 'beta', 'gamma'],
  );

  const weak = decided.find((item) => item.from === 'gamma' && item.to === 'beta');
  assert.ok(weak);
  assert.equal(weak.tier, 'exploratory');
  assert.equal(weak.visibility, 'optional');
  assert.equal(weak.selectionReason, 'exploratory');
});

test('decideConnectionSet resolves equal-score rescues deterministically', () => {
  const decided = decideConnectionSet(
    [
      { from: 'beta', to: 'gamma', affinityScore: 67, evidenceScore: 24 },
      { from: 'gamma', to: 'beta', affinityScore: 67, evidenceScore: 24 },
      { from: 'alpha', to: 'delta', affinityScore: 80, evidenceScore: 70 },
    ],
    ['alpha', 'beta', 'gamma', 'delta'],
  );

  const promoted = decided.find((item) => item.from === 'beta' && item.to === 'gamma');
  const notPromoted = decided.find((item) => item.from === 'gamma' && item.to === 'beta');
  assert.equal(promoted.visibility, 'default');
  assert.equal(promoted.selectionReason, 'coverage-floor');
  assert.equal(notPromoted.visibility, 'optional');
  assert.equal(notPromoted.selectionReason, 'exploratory');
});

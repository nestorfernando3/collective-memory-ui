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

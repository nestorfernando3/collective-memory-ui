const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAffinityCandidate } = require('./candidate_affinity.js');

test('buildAffinityCandidate scores shared explicit and inferred metadata', () => {
  const candidate = buildAffinityCandidate(
    {
      projectId: 'alpha',
      metadata: { domains: ['educacion'], institutions: ['politecnico'] },
      inferred: { domains: ['semiotica'] },
    },
    {
      projectId: 'beta',
      metadata: { domains: ['educacion'], institutions: ['politecnico'] },
      inferred: { domains: ['semiotica'] },
    },
  );

  assert.ok(candidate.affinityScore >= 65);
  assert.deepEqual(candidate.shared.domains, ['educacion']);
  assert.deepEqual(candidate.shared.institutions, ['politecnico']);
  assert.deepEqual(candidate.shared.inferred_domains, ['semiotica']);
});

test('buildAffinityCandidate normalizes string and object metadata before intersection', () => {
  const candidate = buildAffinityCandidate(
    {
      projectId: 'alpha',
      metadata: {
        domains: [' Educacion ', { label: 'Semiotica' }],
        institutions: [{ name: 'Politecnico' }],
      },
      inferred: { domains: [' culture '] },
    },
    {
      projectId: 'beta',
      metadata: {
        domains: 'educacion|semiotica',
        institutions: [{ label: 'politecnico' }],
      },
      inferred: { domains: [{ name: 'Culture' }] },
    },
  );

  assert.deepEqual(candidate.shared.domains, ['educacion', 'semiotica']);
  assert.deepEqual(candidate.shared.institutions, ['politecnico']);
  assert.deepEqual(candidate.shared.inferred_domains, ['culture']);
  assert.ok(candidate.affinityScore >= 66);
});

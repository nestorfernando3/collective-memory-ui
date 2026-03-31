const test = require('node:test');
const assert = require('node:assert/strict');

const { buildConnectionNarrative } = require('./connection_narrative.js');

test('buildConnectionNarrative differentiates strong, exploratory, and coverage-floor wording', () => {
  const strong = buildConnectionNarrative({
    fromName: 'Collective Memory PWA',
    toName: 'Project Alpha',
    tier: 'strong',
    sharedSummary: ['dominios: educación', 'tecnologías: frontend'],
    evidenceFragments: [{ tier: 'A' }],
    locale: 'en',
  });

  const exploratory = buildConnectionNarrative({
    fromName: 'Collective Memory PWA',
    toName: 'Project Beta',
    tier: 'exploratory',
    sharedSummary: ['dominios: educación'],
    locale: 'en',
  });

  const promoted = buildConnectionNarrative({
    fromName: 'Collective Memory PWA',
    toName: 'Diario de Emociones',
    tier: 'exploratory',
    selectionReason: 'coverage-floor',
    sharedSummary: ['dominios: educación'],
    locale: 'es',
  });

  assert.match(strong.description, /strong connection/i);
  assert.match(exploratory.description, /exploratory connection/i);
  assert.match(promoted.description, /evitar aislamiento|cobertura/i);
  assert.equal(strong.narrativeClass, 'strong');
  assert.equal(exploratory.narrativeClass, 'exploratory');
  assert.equal(promoted.narrativeClass, 'coverage-floor');
});

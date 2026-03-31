const test = require('node:test');
const assert = require('node:assert/strict');

const { inferMetadataFromDocuments } = require('./inferred_metadata.js');
const { buildProjectSignalProfile } = require('./project_signal_profile.js');

test('inferMetadataFromDocuments derives lightweight metadata only from A/B documents', () => {
  const inferred = inferMetadataFromDocuments([
    {
      tier: 'A',
      text: 'Drawing on Roland Barthes and Jean Baudrillard, this article examines Caribbean Colombian youth culture at Politecnico de la Costa Atlantica.',
    },
    {
      tier: 'D',
      text: 'Todos los cambios notables se documentan en este archivo.',
    },
  ]);

  assert.match(inferred.theoretical_frameworks[0], /barthes|baudrillard/i);
  assert.match(inferred.institutions[0], /politecnico/i);
  assert.match(inferred.domains[0], /semiotica|cultura|educacion/i);
  assert.equal(inferred.sources.length, 1);
});

test('inferMetadataFromDocuments tolerates null documents input', () => {
  const inferred = inferMetadataFromDocuments(null);

  assert.deepEqual(inferred.domains, []);
  assert.deepEqual(inferred.themes, []);
  assert.deepEqual(inferred.institutions, []);
  assert.deepEqual(inferred.theoretical_frameworks, []);
  assert.equal(inferred.confidence, 0);
  assert.deepEqual(inferred.sources, []);
});

test('inferMetadataFromDocuments does not elevate confidence without real signal', () => {
  const inferred = inferMetadataFromDocuments([
    { tier: 'A', text: 'A short note with no specific names or concepts.' },
    { tier: 'B', text: 'Another generic document that stays broad.' },
  ]);

  assert.equal(inferred.confidence, 0);
  assert.deepEqual(inferred.domains, []);
  assert.deepEqual(inferred.themes, []);
  assert.deepEqual(inferred.institutions, []);
  assert.deepEqual(inferred.theoretical_frameworks, []);
});

test('buildProjectSignalProfile normalizes explicit and inferred metadata for downstream use', () => {
  const profile = buildProjectSignalProfile({
    projectId: 'alpha',
    metadata: {
      domains: ['educacion', 'educacion'],
      themes: ['curriculum'],
      institutions: ['politecnico'],
      theoretical_frameworks: ['barthes'],
      confidence: 0.4,
    },
    documents: [
      { tier: 'A', text: 'Barthes and Baudrillard discuss myth in Caribbean culture at Politecnico de la Costa Atlantica.' },
      { tier: 'X', text: 'Ruta Objetivo: ignore this generated memory note.' },
    ],
  });

  assert.equal(profile.projectId, 'alpha');
  assert.ok(profile.metadata.domains.includes('educacion'));
  assert.ok(profile.inferred.theoretical_frameworks.includes('barthes'));
  assert.ok(profile.signal.domains.includes('educacion'));
  assert.ok(profile.signal.domains.includes('semiotica') || profile.signal.domains.includes('cultura'));
  assert.equal(profile.documents.length, 2);
  assert.ok(profile.confidence >= 0.72);
});

test('buildProjectSignalProfile tolerates null documents and string metadata fields', () => {
  const profile = buildProjectSignalProfile({
    projectId: 'beta',
    metadata: {
      domains: 'educacion, cultura',
      themes: 'curriculum|pedagogy',
      institutions: 'politecnico',
      theoretical_frameworks: 'barthes;baudrillard',
      sources: 'manual,import',
    },
    documents: null,
  });

  assert.equal(profile.projectId, 'beta');
  assert.deepEqual(profile.documents, []);
  assert.deepEqual(profile.metadata.domains, ['educacion', 'cultura']);
  assert.deepEqual(profile.metadata.theoretical_frameworks, ['barthes', 'baudrillard']);
  assert.equal(profile.inferred.confidence, 0);
  assert.equal(profile.confidence, 0);
});

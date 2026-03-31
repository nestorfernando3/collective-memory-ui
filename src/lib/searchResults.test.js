import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGraphSearchResults } from './searchResults.js';

const projectNodes = [
  {
    id: 'paideia',
    data: {
      kind: 'project',
      label: 'Paideia',
      subtitle: 'EdTech',
      project: {
        id: 'paideia',
        name: 'Paideia',
        type: 'Education',
        status: 'Active',
        description: 'Suite for formative assessment and classroom planning.',
        tags: ['pedagogy'],
      },
    },
  },
  {
    id: 'diario-emociones',
    data: {
      kind: 'project',
      label: 'Diario de Emociones',
      subtitle: 'Wellbeing',
      project: {
        id: 'diario-emociones',
        name: 'Diario de Emociones',
        type: 'Development',
        status: 'Exploratory',
        description: 'Emotional tracking with a pedagogical angle.',
        tags: ['psychology'],
      },
    },
  },
];

const edges = [
  {
    id: 'connection:paideia:diario-emociones',
    label: 'Paideia → Diario de Emociones',
    data: {
      kind: 'connection',
      insight: {
        sourceLabel: 'Paideia',
        targetLabel: 'Diario de Emociones',
        type: 'Exploratory',
        strengthLabel: 'Media',
        selectionReason: 'coverage-floor',
        description: 'Shared pedagogy and emotional support.',
      },
    },
  },
];

test('buildGraphSearchResults returns project matches before bridge matches for the same query', () => {
  const results = buildGraphSearchResults({
    projectNodes,
    edges,
    query: 'paideia',
  });

  assert.equal(results.length, 2);
  assert.equal(results[0].kind, 'project');
  assert.equal(results[0].id, 'paideia');
  assert.equal(results[1].kind, 'connection');
  assert.equal(results[1].id, 'connection:paideia:diario-emociones');
});

test('buildGraphSearchResults matches bridge descriptions and returns a readable snippet', () => {
  const results = buildGraphSearchResults({
    projectNodes,
    edges,
    query: 'shared support',
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].kind, 'connection');
  assert.equal(results[0].id, 'connection:paideia:diario-emociones');
  assert.match(results[0].description, /emotional support/i);
});

test('buildGraphSearchResults returns no results for an empty query', () => {
  assert.deepEqual(buildGraphSearchResults({ projectNodes, edges, query: '' }), []);
});

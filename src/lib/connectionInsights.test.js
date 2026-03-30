import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectConnectionInsights } from './connectionInsights.js';

const projects = [
  { id: 'alpha', name: 'Alpha' },
  { id: 'beta', name: 'Beta' },
  { id: 'gamma', name: 'Gamma' },
  { id: 'delta', name: 'Delta' },
];

test('sorts a project’s direct connections by strongest evidence first', () => {
  const connections = {
    connections: [
      { from: 'alpha', to: 'beta', type: 'Teórica', strength: 'Alta' },
      { from: 'alpha', to: 'gamma', type: 'Investigativa', evidence: { score: 42 } },
      { from: 'alpha', to: 'delta', type: 'Apoyo', strength: 'Baja' },
    ],
  };

  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: connections.connections,
  });

  assert.equal(insights.length, 3);
  assert.deepEqual(
    insights.map((item) => item.otherProjectId),
    ['gamma', 'beta', 'delta'],
  );
  assert.equal(insights[0].strengthLabel, '42');
  assert.match(insights[1].label, /Alpha → Beta/);
});

test('localizes fallback labels when no strength is provided', () => {
  const connections = {
    connections: [
      { from: 'alpha', to: 'beta' },
    ],
  };

  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: connections.connections,
    locale: 'es',
  });

  assert.equal(insights[0].strengthLabel, 'Sin nivel');
  assert.equal(insights[0].type, 'Sinérgica');
});

test('removes route and base-theory noise from connection descriptions', () => {
  const connections = {
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        description:
          'La relación entre Alpha y Beta se entiende mejor por las señales que repiten sus textos. En los textos aparecen matrices teóricas como fenomenología y teoría y pasajes como Ruta Objetivo: ~/Documents/Las Camilas - Textos selectos/... y Base Teórica Inyectada: Fe…. Si hay citas o material de terceros, conviene separarlos de la voz principal antes de atribuirlos al perfil central.',
      },
    ],
  };

  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: connections.connections,
  });

  assert.equal(insights[0].description, 'La relación entre Alpha y Beta se entiende mejor por las señales que repiten sus textos. En los textos aparecen matrices teóricas como fenomenología y teoría. Si hay citas o material de terceros, conviene separarlos de la voz principal antes de atribuirlos al perfil central.');
  assert.doesNotMatch(insights[0].description, /Ruta Objetivo|Base Teórica Inyectada|Las Camilas - Textos selectos/i);
});

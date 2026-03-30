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

test('removes route, boilerplate, and legacy memory noise from connection descriptions', () => {
  const connections = {
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        description:
          'La relación entre Alpha y Beta se entiende mejor por las señales que repiten sus textos. En los textos aparecen citas como Generación 2030 y GESTIONES BRISAS DEL RIO 2026, matrices teóricas como fenomenología y teoría, reuso de datos y corpus compartidos y pasajes como Archivo vivo de trabajo. Este perfil se entiende por la suma de proyectos académicos, pedagógicos y culturales. La lectura sugerida va de Alpha hacia Beta, porque el vínculo parece acumulativo y no accidental.',
      },
    ],
  };

  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: connections.connections,
  });

  assert.equal(
    insights[0].description,
    'Cruce provisional: la evidencia compartida todavía no alcanza para sostenerlo.',
  );
  assert.doesNotMatch(insights[0].description, /Ruta Objetivo|Base Teórica Inyectada|Las Camilas - Textos selectos|Generación 2030|Archivo vivo de trabajo|Este perfil se entiende/i);
});

test('replaces weak generic fallback descriptions with exploratory copy', () => {
  const connections = {
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        description:
          'La relación entre Alpha y Beta se entiende mejor por las señales que repiten sus textos. La lectura sugerida va de Alpha hacia Beta, porque el vínculo parece acumulativo y no accidental.',
        evidence: { score: 14 },
      },
    ],
  };

  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: connections.connections,
  });

  assert.equal(
    insights[0].description,
    'Cruce provisional: la evidencia compartida todavía no alcanza para sostenerlo.',
  );
  assert.doesNotMatch(insights[0].description, /se entiende mejor por las señales/i);
});

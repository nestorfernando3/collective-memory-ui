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

  assert.equal(insights[0].description, '');
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

  assert.equal(insights[0].description, '');
  assert.doesNotMatch(insights[0].description, /se entiende mejor por las señales/i);
});

test('buildProjectConnectionInsights hides optional exploratory links by default', () => {
  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        tier: 'strong',
        visibility: 'default',
        selection_reason: 'strong-evidence',
        type: 'Teórica',
        description: 'Comparten un marco conceptual explícito: fenomenología.',
      },
      {
        from: 'alpha',
        to: 'gamma',
        tier: 'exploratory',
        visibility: 'optional',
        selection_reason: 'exploratory',
        type: 'Exploratoria',
        description: 'La relación entre Alpha y Gamma todavía es tentativa, pero ya muestra señales útiles: citas compartidas y un marco conceptual explícito: rumor.',
      },
    ],
    visibilityMode: 'default',
  });

  assert.deepEqual(insights.map((item) => item.otherProjectId), ['beta']);
  assert.equal(insights[0].tier, 'strong');
  assert.equal(insights[0].visibility, 'default');
});

test('buildProjectConnectionInsights can include optional exploratory links on demand', () => {
  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        tier: 'strong',
        visibility: 'default',
        selection_reason: 'strong-evidence',
        type: 'Teórica',
        description: 'Comparten un marco conceptual explícito: fenomenología.',
      },
      {
        from: 'alpha',
        to: 'gamma',
        tier: 'exploratory',
        visibility: 'optional',
        selection_reason: 'exploratory',
        type: 'Exploratoria',
        description: 'La relación entre Alpha y Gamma todavía es tentativa, pero ya muestra señales útiles: citas compartidas y un marco conceptual explícito: rumor.',
      },
    ],
    visibilityMode: 'all',
  });

  assert.deepEqual(insights.map((item) => item.otherProjectId), ['beta', 'gamma']);
  assert.equal(insights[1].tier, 'exploratory');
  assert.equal(insights[1].visibility, 'optional');
});

test('buildProjectConnectionInsights surfaces coverage-floor decision metadata', () => {
  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        tier: 'exploratory',
        visibility: 'default',
        selection_reason: 'coverage-floor',
        decision: { coverage_promoted: true, affinity_score: 66, evidence_score: 22 },
      },
    ],
    locale: 'es',
    visibilityMode: 'all',
  });

  assert.equal(insights[0].selectionReason, 'coverage-floor');
  assert.equal(insights[0].decision.coverage_promoted, true);
  assert.equal(insights[0].raw.decision.coverage_promoted, true);
  assert.match(insights[0].description, /cobertura|aislamiento/i);
});

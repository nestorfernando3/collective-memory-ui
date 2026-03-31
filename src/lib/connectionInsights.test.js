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
        tier: 'exploratory',
        selection_reason: 'coverage-floor',
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

  assert.match(insights[0].description, /coverage-floor|aislamiento/i);
  assert.doesNotMatch(insights[0].description, /Ruta Objetivo|Base Teórica Inyectada|Las Camilas - Textos selectos|Generación 2030|Archivo vivo de trabajo|Este perfil se entiende/i);
});

test('replaces weak generic fallback descriptions with exploratory copy', () => {
  const connections = {
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        tier: 'exploratory',
        selection_reason: 'exploratory',
        description:
          'This link seems useful because of thematic proximity and a suggested reading.',
        evidence: { score: 14 },
      },
    ],
  };

  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: connections.connections,
  });

  assert.match(insights[0].description, /Exploratory connection between Alpha and Beta/i);
  assert.doesNotMatch(insights[0].description, /thematic proximity/i);
});

test('buildProjectConnectionInsights normalizes partial decision payloads', () => {
  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        tier: 'exploratory',
        visibility: 'optional',
        selection_reason: 'coverage-floor',
        evidence: { score: 22 },
        decision: {
          custom_flag: 'keep-me',
          evidence_score: 5,
        },
      },
    ],
    visibilityMode: 'all',
  });

  assert.equal(insights[0].decision.custom_flag, 'keep-me');
  assert.equal(insights[0].decision.evidence_score, 22);
  assert.equal(insights[0].decision.coverage_promoted, true);
});

test('preserves curated exploratory descriptions when they are already specific', () => {
  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        tier: 'exploratory',
        visibility: 'default',
        selection_reason: 'exploratory',
        description: 'Curated exploratory note about editor workflow and assessment rhythm.',
      },
    ],
  });

  assert.equal(insights[0].description, 'Curated exploratory note about editor workflow and assessment rhythm.');
});

test('preserves short curated exploratory descriptions instead of flagging them as generic', () => {
  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        tier: 'exploratory',
        visibility: 'default',
        selection_reason: 'exploratory',
        description: 'Short curated note on editor workflow and assessment rhythm.',
      },
    ],
  });

  assert.equal(insights[0].description, 'Short curated note on editor workflow and assessment rhythm.');
});

test('preserves short specific exploratory descriptions that still use relation language', () => {
  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        tier: 'exploratory',
        visibility: 'default',
        selection_reason: 'exploratory',
        description: 'La relación entre Alpha y Beta se apoya en un marco conceptual explícito y evidencia documental.',
      },
    ],
  });

  assert.equal(
    insights[0].description,
    'La relación entre Alpha y Beta se apoya en un marco conceptual explícito y evidencia documental.',
  );
});

test('preserves short specific English relation-language descriptions', () => {
  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        tier: 'exploratory',
        visibility: 'default',
        selection_reason: 'exploratory',
        description: 'The relation between Alpha and Beta is grounded in an explicit framework and shared evidence.',
      },
    ],
  });

  assert.equal(
    insights[0].description,
    'The relation between Alpha and Beta is grounded in an explicit framework and shared evidence.',
  );
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

test('buildProjectConnectionInsights preserves the full decision payload', () => {
  const insights = buildProjectConnectionInsights({
    projectId: 'alpha',
    projects,
    connections: [
      {
        from: 'alpha',
        to: 'beta',
        tier: 'exploratory',
        visibility: 'optional',
        selection_reason: 'coverage-floor',
        description: 'La relación entre Alpha y Beta todavía es tentativa.',
        decision: {
          affinity_score: 66,
          evidence_score: 22,
          coverage_promoted: true,
          review_flag: false,
          custom_flag: 'keep-me',
          shared_summary: ['dominios: educación'],
        },
      },
    ],
    visibilityMode: 'all',
  });

  assert.equal(insights[0].selectionReason, 'coverage-floor');
  assert.equal(insights[0].decision.custom_flag, 'keep-me');
  assert.equal(insights[0].decision.coverage_promoted, true);
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

test('preserves curated coverage-floor descriptions when they are already specific', () => {
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
        description: 'Curated coverage-floor note about product flow and formative assessment.',
      },
    ],
  });

  assert.equal(insights[0].description, 'Curated coverage-floor note about product flow and formative assessment.');
});

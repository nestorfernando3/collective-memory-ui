import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGraphModel } from './graphModel.js';

const profile = {
  name: 'Néstor De León',
  site_title: 'Memoria Colectiva',
  site_subtitle: 'Archivo vivo de trabajo',
  affiliations: [
    {
      institution: 'Politécnico de la Costa Atlántica',
      role: 'Docente / Investigador',
      current: true,
    },
  ],
};

const projects = [
  {
    id: 'collective-memory-ui',
    name: 'Collective Memory PWA',
    status: 'Activo / Desplegable',
    type: 'Desarrollo de Software',
    description: 'Mapa maestro de proyectos.',
    tags: ['frontend'],
  },
  {
    id: 'proyecto-icfes',
    name: 'Proyecto ICFEs',
    status: 'Materiales listos',
    type: 'Educación',
    description: 'Banco de materiales de preparación.',
    tags: ['educación'],
  },
  {
    id: 'diario-emociones',
    name: 'Diario de Emociones',
    status: 'En desarrollo',
    type: 'Desarrollo',
    description: 'Registro emocional con enfoque pedagógico.',
    tags: ['psicología'],
  },
];

const connections = {
  connections: [
    {
      from: 'collective-memory-ui',
      to: 'proyecto-icfes',
      type: 'Pedagógica',
      strength: 'Alta',
      tier: 'strong',
      visibility: 'default',
      selection_reason: 'strong-evidence',
      description: 'Comparten diseño instruccional y estructura editorial.',
      evidence: { score: 32 },
    },
    {
      from: 'collective-memory-ui',
      to: 'diario-emociones',
      type: 'Exploratoria',
      strength: 'Media',
      tier: 'exploratory',
      visibility: 'optional',
      selection_reason: 'coverage-floor',
      description: 'Todavía es tentativa, pero ya hay señales útiles para enlazar producto y acompañamiento.',
      evidence: { score: 14 },
    },
  ],
};

test('buildGraphModel hides optional exploratory edges by default', () => {
  const graph = buildGraphModel({
    profile,
    projects,
    connections,
    locale: 'es',
    visibilityMode: 'default',
  });

  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.projectNodes.length, 3);
  assert.equal(graph.edges.length, 4);

  const projectEdge = graph.edges.find((edge) => edge.id === 'connection:collective-memory-ui:proyecto-icfes');
  assert.ok(projectEdge);
  assert.equal(projectEdge.data.tier, 'strong');
  assert.equal(projectEdge.data.visibility, 'default');
  assert.match(projectEdge.data.description, /diseño instruccional/i);

  const hiddenEdge = graph.edges.find((edge) => edge.id === 'connection:collective-memory-ui:diario-emociones');
  assert.equal(hiddenEdge, undefined);

  assert.equal(graph.meta.visibleConnectionCount, 1);
  assert.equal(graph.meta.exploratoryConnectionCount, 1);
});

test('buildGraphModel can include optional exploratory edges on demand', () => {
  const graph = buildGraphModel({
    profile,
    projects,
    connections,
    locale: 'es',
    visibilityMode: 'all',
  });

  const exploratoryEdge = graph.edges.find((edge) => edge.id === 'connection:collective-memory-ui:diario-emociones');
  assert.ok(exploratoryEdge);
  assert.equal(exploratoryEdge.data.tier, 'exploratory');
  assert.equal(exploratoryEdge.data.visibility, 'optional');
  assert.equal(exploratoryEdge.data.selectionReason, 'coverage-floor');
  assert.match(exploratoryEdge.label, /Exploratoria/i);
  assert.equal(graph.meta.visibleConnectionCount, 2);
});

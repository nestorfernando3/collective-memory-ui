import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildProfileNarrative } from './profileNarrative.js';

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
  domains: ['Educación', 'Investigación Académica', 'Tecnología'],
  skills: ['Diseño Instruccional', 'Programación Web'],
};

const projects = [
  {
    id: 'paideia',
    name: 'Paideia',
    type: 'edtech',
    status: 'active',
    description: 'Suite de herramientas pedagógicas enfocadas en la evaluación formativa y la metacognición.',
    domains: ['educación', 'tecnología'],
    themes: ['pedagogía', 'evaluación formativa'],
    related_projects: ['markdown-pedagogico', 'proyecto-icfes'],
  },
  {
    id: 'markdown-pedagogico',
    name: 'Markdown Pedagógico',
    type: 'EdTech',
    status: 'En desarrollo',
    description: 'Editor web especializado para la creación de guías y planes de clase en Markdown.',
    tags: ['edtech', 'desarrollo', 'tecnología educativa'],
    related_projects: ['paideia'],
  },
  {
    id: 'proyecto-icfes',
    name: 'Proyecto ICFES',
    type: 'Educación',
    status: 'Materiales listos',
    description: 'Banco de materiales para pruebas de estado y ejercicios de aula.',
    tags: ['educación', 'secundaria'],
  },
  {
    id: 'diario-emociones',
    name: 'Diario de Emociones',
    type: 'Desarrollo',
    status: 'En desarrollo',
    description: 'Aplicación web de registro emocional con enfoque pedagógico y psicoeducativo.',
    tags: ['edtech', 'psicología'],
  },
  {
    id: 'fenomenologia-rumor',
    name: 'Fenomenología del Rumor',
    type: 'Investigación',
    status: 'En desarrollo',
    description: 'Artículo académico sobre rumor y chisme como fenómenos semióticos y socioculturales.',
    tags: ['investigación', 'semiótica', 'sociología urbana'],
  },
  {
    id: 'las-camilas',
    name: 'Las Camilas',
    type: 'Creativo',
    status: 'Libro formateado',
    description: 'Compilación de textos selectos sobre las Camilas.',
    tags: ['creativo', 'literatura', 'caribe'],
    related_projects: ['fenomenologia-rumor'],
  },
  {
    id: 'articulo-kevin-cerra',
    name: 'Artículo Kevin Cerra',
    type: 'Investigación',
    status: 'En proceso',
    description: 'Co-autoría con Kevin Cerra. Artículo académico en desarrollo conjunto.',
    tags: ['investigación', 'co-autoría', 'académico'],
  },
];

const connections = {
  connections: [
    {
      from: 'paideia',
      to: 'markdown-pedagogico',
      type: 'Técnica/Diseño',
      description:
        'La relación entre Paideia y Markdown Pedagógico se entiende mejor por las señales que repiten sus textos. En los textos aparecen matrices teóricas como pedagogía y evaluación y pasajes como Ruta Objetivo: ~/Documents/Las Camilas - Textos selectos/... y Base Teórica Inyectada: Fe….',
    },
    {
      from: 'fenomenologia-rumor',
      to: 'las-camilas',
      type: 'Teórica',
    },
  ],
};

test('builds a profile narrative with routes and expansion ideas', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects,
    connections,
  });

  assert.equal(narrative.name, 'Néstor De León');
  assert.doesNotMatch(narrative.overview, /Personal Operating System|Sistema Operativo Personal|Archivo vivo de trabajo/i);
  assert.match(narrative.overview, /docencia|investigación|desarrollo de herramientas/i);
  assert.ok(narrative.routes.some((route) => route.projects.includes('paideia')));
  assert.ok(narrative.routes.some((route) => route.projects.includes('proyecto-icfes')));
  assert.equal(
    narrative.sections.find((section) => section.title === 'Active bridges').items[0].description,
    'Strong connection between Paideia and Markdown Pedagógico: they share a shared base.',
  );
  assert.ok(narrative.expansionIdeas.some((idea) => idea.from === 'paideia' && idea.to === 'diario-emociones'));
  assert.ok(narrative.sections.some((section) => section.title === 'Active bridges'));
  assert.ok(narrative.sections.some((section) => section.items.some((item) => typeof item === 'string' && /third-party|coauthored/i.test(item))));
});

test('profile narrative counts only default-visible bridges as active', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects,
    connections: {
      connections: [
        {
          from: 'paideia',
          to: 'markdown-pedagogico',
          type: 'Técnica/Diseño',
          tier: 'strong',
          visibility: 'default',
          selection_reason: 'strong-evidence',
          description: 'Comparten una base pedagógica concreta.',
        },
        {
          from: 'paideia',
          to: 'diario-emociones',
          type: 'Exploratoria',
          tier: 'exploratory',
          visibility: 'default',
          selection_reason: 'coverage-floor',
          decision: { coverage_promoted: true, affinity_score: 66, evidence_score: 22 },
          description: '',
        },
        {
          from: 'paideia',
          to: 'diario-emociones',
          type: 'Exploratoria',
          tier: 'exploratory',
          visibility: 'optional',
          selection_reason: 'exploratory',
          description: 'La relación entre Paideia y Diario de Emociones todavía es tentativa, pero ya muestra señales útiles: acompañamiento y evaluación formativa.',
        },
      ],
    },
    locale: 'es',
  });

  assert.equal(narrative.stats.connectionCount, 2);
  assert.equal(narrative.stats.activeConnectionCount, 2);
  assert.equal(narrative.stats.reserveConnectionCount, 1);
  assert.equal(narrative.stats.coverageFloorConnectionCount, 1);
  assert.equal(narrative.sections.find((section) => section.title === 'Puentes activos').items.length, 2);
  assert.match(
    narrative.sections.find((section) => section.title === 'Trayectorias centrales').items.join(' '),
    /1 puente fuerte visible|1 puente exploratorio promovido por cobertura|1 puente exploratorio en reserva/i,
  );
  assert.match(
    narrative.sections.find((section) => section.title === 'Puentes activos').items.find((item) => item.selectionReason === 'coverage-floor').description,
    /evitar aislamiento|cobertura/i,
  );
});

test('profile narrative upgrades weak exploratory descriptions to the new semantics', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects,
    connections: {
      connections: [
        {
          from: 'paideia',
          to: 'diario-emociones',
          type: 'Exploratoria',
          tier: 'exploratory',
          visibility: 'default',
          selection_reason: 'coverage-floor',
          decision: {
            coverage_promoted: true,
            affinity_score: 66,
            evidence_score: 22,
            shared_summary: ['acompañamiento'],
          },
          description: 'La relación entre Paideia y Diario de Emociones se entiende mejor por las señales que repiten sus textos.',
        },
      ],
    },
    locale: 'es',
  });

  const bridge = narrative.sections.find((section) => section.title === 'Puentes activos').items[0];
  assert.match(bridge.description, /evitar aislamiento|cobertura/i);
  assert.doesNotMatch(bridge.description, /se entiende mejor por las señales/i);
});

test('profile narrative preserves curated exploratory descriptions when they are already specific', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects,
    connections: {
      connections: [
        {
          from: 'paideia',
          to: 'diario-emociones',
          type: 'Exploratoria',
          tier: 'exploratory',
          visibility: 'default',
          selection_reason: 'exploratory',
          description: 'Curated exploratory note about product flow and formative assessment.',
        },
      ],
    },
    locale: 'es',
  });

  const bridge = narrative.sections.find((section) => section.title === 'Puentes activos').items[0];
  assert.equal(bridge.description, 'Curated exploratory note about product flow and formative assessment.');
});

test('profile narrative fills empty exploratory descriptions with the new narrative', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects,
    connections: {
      connections: [
        {
          from: 'paideia',
          to: 'diario-emociones',
          type: 'Exploratoria',
          tier: 'exploratory',
          visibility: 'default',
          selection_reason: 'exploratory',
          description: '',
        },
      ],
    },
    locale: 'es',
  });

  const bridge = narrative.sections.find((section) => section.title === 'Puentes activos').items[0];
  assert.match(bridge.description, /conexión exploratoria|afinidad/i);
});

test('profile narrative preserves curated coverage-floor descriptions when they are already specific', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects,
    connections: {
      connections: [
        {
          from: 'paideia',
          to: 'diario-emociones',
          type: 'Exploratoria',
          tier: 'exploratory',
          visibility: 'default',
          selection_reason: 'coverage-floor',
          description: 'Curated coverage-floor note about product flow and formative assessment.',
        },
      ],
    },
    locale: 'es',
  });

  const bridge = narrative.sections.find((section) => section.title === 'Puentes activos').items[0];
  assert.equal(bridge.description, 'Curated coverage-floor note about product flow and formative assessment.');
});

test('profile narrative preserves short specific notes that still use relation language', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects,
    connections: {
      connections: [
        {
          from: 'paideia',
          to: 'diario-emociones',
          type: 'Exploratoria',
          tier: 'exploratory',
          visibility: 'default',
          selection_reason: 'exploratory',
          description: 'La relación entre Alpha y Beta se apoya en un marco conceptual explícito y evidencia documental.',
        },
      ],
    },
    locale: 'es',
  });

  const bridge = narrative.sections.find((section) => section.title === 'Puentes activos').items[0];
  assert.equal(
    bridge.description,
    'La relación entre Alpha y Beta se apoya en un marco conceptual explícito y evidencia documental.',
  );
});

test('profile narrative normalizes partial decision payloads on bridge items', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects,
    connections: {
      connections: [
        {
          from: 'paideia',
          to: 'diario-emociones',
          type: 'Exploratoria',
          tier: 'exploratory',
          visibility: 'default',
          selection_reason: 'coverage-floor',
          evidence: { score: 22 },
          decision: {
            custom_flag: 'keep-me',
            evidence_score: 5,
          },
          description: 'Curated coverage-floor note about product flow and formative assessment.',
        },
      ],
    },
    locale: 'es',
  });

  const bridge = narrative.sections.find((section) => section.title === 'Puentes activos').items[0];
  assert.equal(bridge.decision.custom_flag, 'keep-me');
  assert.equal(bridge.decision.evidence_score, 22);
  assert.equal(bridge.decision.coverage_promoted, true);
});

test('profile narrative keeps root-level shared summary and evidence fragments', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects,
    connections: {
      connections: [
        {
          from: 'paideia',
          to: 'markdown-pedagogico',
          type: 'Técnica/Diseño',
          tier: 'strong',
          visibility: 'default',
          selection_reason: 'strong-evidence',
          sharedSummary: ['marco conceptual explícito'],
          evidenceFragments: ['fragmento citado'],
          description: '',
        },
      ],
    },
    locale: 'es',
  });

  const bridge = narrative.sections.find((section) => section.title === 'Puentes activos').items[0];
  assert.match(bridge.description, /marco conceptual explícito/i);
});

test('builds a spanish profile narrative when requested', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects,
    connections,
    locale: 'es',
  });

  assert.ok(narrative.sections.some((section) => section.title === 'Puentes activos'));
  assert.doesNotMatch(narrative.overview, /Personal Operating System|Sistema Operativo Personal|Archivo vivo de trabajo/i);
  assert.match(narrative.overview, /docencia|investigación|desarrollo de herramientas/i);
  assert.ok(narrative.sections.some((section) => section.items.some((item) => typeof item === 'string' && /coautor|terceros/i.test(item))));
});

test('expansion ideas identify the project pair in the real dataset', () => {
  const realProfile = JSON.parse(fs.readFileSync(new URL('../../public/data/profile.json', import.meta.url), 'utf8'));
  const projectsIndex = fs
    .readFileSync(new URL('../../public/data/projects_index.json', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value.endsWith('.json'));
  const realProjects = projectsIndex.map((fileName) =>
    JSON.parse(fs.readFileSync(new URL(`../../public/data/projects/${fileName}`, import.meta.url), 'utf8')),
  );
  const realConnections = JSON.parse(fs.readFileSync(new URL('../../public/data/connections.json', import.meta.url), 'utf8'));

  const narrative = buildProfileNarrative({
    profile: realProfile,
    projects: realProjects,
    connections: realConnections,
    locale: 'es',
  });

  const expansionSection = narrative.sections.find((section) => section.title === 'Ideas de expansión');

  assert.ok(expansionSection);
  assert.ok(expansionSection.items.length > 0);
  assert.ok(expansionSection.items.every((item) => typeof item.pairLabel === 'string' && item.pairLabel.includes(' + ')));
  assert.equal(new Set(expansionSection.items.map((item) => item.pairLabel)).size, expansionSection.items.length);
});

test('excludes hidden projects from the visible narrative', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects,
    connections,
    hiddenProjectIds: ['paideia', 'paideia'],
  });

  assert.equal(narrative.stats.projectCount, projects.length - 1);
  assert.equal(narrative.stats.hiddenCount, 1);
  assert.ok(narrative.routes.every((route) => !route.projects.includes('paideia')));
  assert.ok(narrative.expansionIdeas.every((idea) => idea.from !== 'paideia' && idea.to !== 'paideia'));
});

test('hides demo projects from the visible narrative even without an explicit hidden list', () => {
  const narrative = buildProfileNarrative({
    profile,
    projects: [
      ...projects,
      {
        id: 'demo-archivo',
        name: 'Archivo Demo',
        path: '~/demo/archivo-demo',
        type: 'demo',
        status: 'activo',
        description: 'Proyecto de prueba que no debe aparecer en la memoria personal.',
      },
    ],
    connections,
  });

  assert.equal(narrative.stats.projectCount, projects.length);
  assert.ok(narrative.routes.every((route) => !route.projects.includes('demo-archivo')));
});

test('returns a sane fallback narrative when the profile is missing', () => {
  const narrative = buildProfileNarrative();

  assert.equal(narrative.name, 'Central profile');
  assert.equal(narrative.stats.projectCount, 0);
  assert.equal(narrative.stats.connectionCount, 0);
  assert.match(narrative.overview, /no visible projects|sin proyectos visibles/i);
});

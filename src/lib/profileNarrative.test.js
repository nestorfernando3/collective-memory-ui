import test from 'node:test';
import assert from 'node:assert/strict';
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
    'La relación entre Paideia y Markdown Pedagógico se entiende mejor por las señales que repiten sus textos. En los textos aparecen matrices teóricas como pedagogía y evaluación.',
  );
  assert.ok(narrative.expansionIdeas.some((idea) => idea.from === 'paideia' && idea.to === 'diario-emociones'));
  assert.ok(narrative.sections.some((section) => section.title === 'Active bridges'));
  assert.ok(narrative.sections.some((section) => section.items.some((item) => typeof item === 'string' && /third-party|coauthored/i.test(item))));
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

test('returns a sane fallback narrative when the profile is missing', () => {
  const narrative = buildProfileNarrative();

  assert.equal(narrative.name, 'Central profile');
  assert.equal(narrative.stats.projectCount, 0);
  assert.equal(narrative.stats.connectionCount, 0);
  assert.match(narrative.overview, /no visible projects|sin proyectos visibles/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfileNarrative } from './profileNarrative.js';

const profile = {
  name: 'Néstor De León',
  site_title: 'Memoria Colectiva',
  site_subtitle: 'Sistema Operativo Personal',
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
];

const connections = {
  connections: [
    {
      from: 'paideia',
      to: 'markdown-pedagogico',
      type: 'Técnica/Diseño',
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
  assert.match(narrative.overview, /Sistema Operativo Personal/i);
  assert.ok(narrative.routes.some((route) => route.projects.includes('paideia')));
  assert.ok(narrative.routes.some((route) => route.projects.includes('proyecto-icfes')));
  assert.ok(narrative.expansionIdeas.some((idea) => idea.from === 'paideia' && idea.to === 'diario-emociones'));
  assert.ok(narrative.sections.some((section) => section.title === 'Puentes activos'));
});

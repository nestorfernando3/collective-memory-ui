import { filterVisibleProjects } from './projectVisibility.js';
import {
  normalizeLocale,
  translateAppSubtitle,
  translateAppTitle,
  translateAffiliationRole,
} from './i18n.js';
import { sanitizeConnectionDescription } from './connectionText.js';

const EDUCATION_PATTERNS = [
  'educacion',
  'education',
  'pedagog',
  'edtech',
  'planeacion',
  'planning',
  'icfes',
  'metacogn',
  'evaluacion formativa',
  'formative assessment',
  'aprendizaje',
  'learning',
  'secundaria',
  'secondary',
  'curricul',
  'tecnologia educativa',
  'educational technology',
];

const RESEARCH_PATTERNS = [
  'investig',
  'research',
  'estudio',
  'study',
  'articulo',
  'article',
  'paper',
  'epidemiolog',
  'semiot',
  'semiotic',
  'sociologia',
  'sociology',
  'datos',
  'data',
  'analisis',
  'analysis',
];

const CREATIVE_PATTERNS = [
  'creativ',
  'creative',
  'literatura',
  'literature',
  'cuento',
  'story',
  'caribe',
  'caribbean',
  'memoria oral',
  'oral memory',
  'mito',
  'myth',
  'narrat',
];

const INSTITUTIONAL_PATTERNS = [
  'institucional',
  'institutional',
  'gestion',
  'management',
  'mincultura',
  'pei',
  'brisas',
  'administrativ',
  'politica publica',
  'public policy',
];

const SOCIOEMOTIONAL_PATTERNS = [
  'emocion',
  'emotion',
  'psicolog',
  'psycholog',
  'acompan',
  'accompa',
  'autoconocimiento',
  'self-knowledge',
  'socioemoc',
  'socioemotional',
];

const TOOL_PATTERNS = [
  'web app',
  'software',
  'ui',
  'frontend',
  'desarrollo',
  'development',
  'plataforma',
  'platform',
  'tool',
  'editor',
  'markdown',
];

const PROVENANCE_PATTERNS = [
  'co-autoría',
  'coautoría',
  'co autoria',
  'fuente externa',
  'material de terceros',
  'third party',
  'third-party',
  'research claw',
  'citado',
  'cita textual',
  'adaptado',
  'compilación',
];

const PRACTICE_PRIORITY = ['education', 'research', 'tool', 'institutional', 'creative', 'socioemotional'];

const PRACTICE_LABELS = {
  education: {
    en: 'teaching',
    es: 'docencia',
  },
  research: {
    en: 'research',
    es: 'investigación',
  },
  tool: {
    en: 'tooling and product development',
    es: 'desarrollo de herramientas',
  },
  institutional: {
    en: 'institutional management',
    es: 'gestión institucional',
  },
  creative: {
    en: 'writing and memory work',
    es: 'escritura y memoria',
  },
  socioemotional: {
    en: 'socioemotional support',
    es: 'acompañamiento socioemocional',
  },
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isDemoProject(project) {
  const normalizedPath = String(project?.path || '').replace(/\\/g, '/');
  return normalizedPath.includes('/demo/') || normalizedPath.startsWith('~/demo');
}

function isSpanish(locale) {
  return normalizeLocale(locale) === 'es';
}

function joinList(values, locale) {
  const items = [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  const conjunction = isSpanish(locale) ? 'y' : 'and';
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

function takeHighlights(values, limit = 3) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))].slice(0, limit);
}

function collectProjectText(project) {
  const parts = [
    project?.id,
    project?.name,
    project?.title,
    project?.type,
    project?.status,
    project?.description,
    project?.abstract,
    ...(Array.isArray(project?.tags) ? project.tags : []),
    ...(Array.isArray(project?.domains) ? project.domains : []),
    ...(Array.isArray(project?.themes) ? project.themes : []),
    ...(Array.isArray(project?.technologies) ? project.technologies : []),
    ...(Array.isArray(project?.theoretical_frameworks) ? project.theoretical_frameworks : []),
    ...(Array.isArray(project?.outputs)
      ? project.outputs.flatMap((output) => [output?.type, output?.title, output?.format, output?.status])
      : []),
  ];

  return normalizeText(parts.join(' '));
}

function classifyProject(project) {
  const text = collectProjectText(project);

  return {
    education: EDUCATION_PATTERNS.some((pattern) => text.includes(pattern)),
    research: RESEARCH_PATTERNS.some((pattern) => text.includes(pattern)),
    creative: CREATIVE_PATTERNS.some((pattern) => text.includes(pattern)),
    institutional: INSTITUTIONAL_PATTERNS.some((pattern) => text.includes(pattern)),
    socioemotional: SOCIOEMOTIONAL_PATTERNS.some((pattern) => text.includes(pattern)),
    tool: TOOL_PATTERNS.some((pattern) => text.includes(pattern)),
  };
}

function collectAttributionProjects(projects) {
  return (Array.isArray(projects) ? projects : []).filter((project) => {
    const text = collectProjectText(project);
    return PROVENANCE_PATTERNS.some((pattern) => text.includes(normalizeText(pattern)));
  });
}

function summarizePractice(projects, locale) {
  const counts = PRACTICE_PRIORITY.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  (Array.isArray(projects) ? projects : []).forEach((project) => {
    const classification = classifyProject(project);
    PRACTICE_PRIORITY.forEach((key) => {
      if (classification[key]) counts[key] += 1;
    });
  });

  const normalizedLocale = normalizeLocale(locale);
  const labels = PRACTICE_PRIORITY
    .filter((key) => counts[key] > 0)
    .slice(0, 3)
    .map((key) => PRACTICE_LABELS[key][normalizedLocale] || PRACTICE_LABELS[key].en);

  if (labels.length) return joinList(labels, normalizedLocale);
  return normalizedLocale === 'es'
    ? 'docencia, investigación y desarrollo de herramientas'
    : 'teaching, research, and tooling';
}

function projectLabel(project, locale) {
  return project?.name || project?.title || project?.id || (isSpanish(locale) ? 'Proyecto' : 'Project');
}

function projectPriority(project) {
  const classification = classifyProject(project);

  if (classification.tool) return 0;
  if (classification.education) return 1;
  if (classification.research) return 2;
  if (classification.institutional) return 3;
  if (classification.creative) return 4;
  return 5;
}

function normalizeConnectionTier(value) {
  const tier = normalizeText(value).trim();
  return tier === 'exploratory' ? 'exploratory' : 'strong';
}

function normalizeConnectionVisibility(value) {
  const visibility = normalizeText(value).trim();
  return visibility === 'optional' ? 'optional' : 'default';
}

function buildConnectionMap(connections, projectById, locale) {
  const spanish = isSpanish(locale);
  return (Array.isArray(connections) ? connections : []).reduce((acc, connection) => {
    const from = String(connection?.from || connection?.source || '').trim();
    const to = String(connection?.to || connection?.target || '').trim();

    if (!from || !to) return acc;
    if (!projectById.has(from) || !projectById.has(to)) return acc;

    acc.push({
      from,
      to,
      type: connection?.type || (spanish ? 'Sinérgica' : 'Synergistic'),
      description: sanitizeConnectionDescription(connection?.description),
      tier: normalizeConnectionTier(connection?.tier),
      visibility: normalizeConnectionVisibility(connection?.visibility),
      selectionReason: String(connection?.selection_reason || connection?.selectionReason || '').trim(),
    });
    return acc;
  }, []);
}

function buildRoutes(projects, locale) {
  const routes = [];
  const educationProjects = projects.filter((project) => {
    const classification = classifyProject(project);
    return classification.education || classification.tool || classification.socioemotional;
  });

  if (educationProjects.length >= 2) {
    const ordered = educationProjects.slice().sort((a, b) => projectPriority(a) - projectPriority(b) || projectLabel(a, locale).localeCompare(projectLabel(b, locale)));
    routes.push({
      title: isSpanish(locale) ? 'Ruta EdTech' : 'EdTech route',
      projects: ordered.map((project) => project.id),
      summary: isSpanish(locale)
        ? `Del editor y la planificación hacia la evaluación y el acompañamiento: ${joinList(ordered.map((project) => projectLabel(project, locale)), locale)}.`
        : `From editing and planning to assessment and support: ${joinList(ordered.map((project) => projectLabel(project, locale)), locale)}.`,
    });
  }

  const creativeProjects = projects.filter((project) => classifyProject(project).creative || /caribe|literatura|mito|caribbean|literature|myth/.test(collectProjectText(project)));
  if (creativeProjects.length >= 2) {
    const ordered = creativeProjects.slice().sort((a, b) => projectPriority(a) - projectPriority(b) || projectLabel(a, locale).localeCompare(projectLabel(b, locale)));
    routes.push({
      title: isSpanish(locale) ? 'Ruta Caribe' : 'Caribbean route',
      projects: ordered.map((project) => project.id),
      summary: isSpanish(locale)
        ? `La escritura y la memoria oral se conectan en ${joinList(ordered.map((project) => projectLabel(project, locale)), locale)}.`
        : `Writing and oral memory connect in ${joinList(ordered.map((project) => projectLabel(project, locale)), locale)}.`,
    });
  }

  const researchProjects = projects.filter((project) => classifyProject(project).research);
  if (researchProjects.length >= 2) {
    const ordered = researchProjects.slice().sort((a, b) => projectPriority(a) - projectPriority(b) || projectLabel(a, locale).localeCompare(projectLabel(b, locale)));
    routes.push({
      title: isSpanish(locale) ? 'Ruta de Investigación' : 'Research route',
      projects: ordered.map((project) => project.id),
      summary: isSpanish(locale)
        ? `La línea investigativa se sostiene en ${joinList(ordered.map((project) => projectLabel(project, locale)), locale)}.`
        : `The research line is sustained by ${joinList(ordered.map((project) => projectLabel(project, locale)), locale)}.`,
    });
  }

  const institutionalProjects = projects.filter((project) => classifyProject(project).institutional);
  if (institutionalProjects.length >= 2) {
    const ordered = institutionalProjects.slice().sort((a, b) => projectPriority(a) - projectPriority(b) || projectLabel(a, locale).localeCompare(projectLabel(b, locale)));
    routes.push({
      title: isSpanish(locale) ? 'Ruta Institucional' : 'Institutional route',
      projects: ordered.map((project) => project.id),
      summary: isSpanish(locale)
        ? `La gestión institucional se articula en ${joinList(ordered.map((project) => projectLabel(project, locale)), locale)}.`
        : `Institutional management comes together in ${joinList(ordered.map((project) => projectLabel(project, locale)), locale)}.`,
    });
  }

  return routes;
}

function scoreExpansionPair(projectA, projectB, locale) {
  const a = classifyProject(projectA);
  const b = classifyProject(projectB);
  let score = 0;
  let label = '';
  let reason = '';
  const spanish = isSpanish(locale);

  if ((a.education || a.tool) && b.socioemotional) {
    score = 9;
    label = spanish ? 'Pedagogía + acompañamiento' : 'Pedagogy + support';
    reason = spanish
      ? 'La herramienta pedagógica puede incorporar registro emocional y seguimiento formativo.'
      : 'The pedagogical tool can incorporate emotional tracking and formative follow-up.';
  } else if ((b.education || b.tool) && a.socioemotional) {
    score = 9;
    label = spanish ? 'Pedagogía + acompañamiento' : 'Pedagogy + support';
    reason = spanish
      ? 'La herramienta pedagógica puede incorporar registro emocional y seguimiento formativo.'
      : 'The pedagogical tool can incorporate emotional tracking and formative follow-up.';
  } else if ((a.education || a.tool) && b.education) {
    score = 8;
    label = spanish ? 'Pedagogía + herramienta' : 'Pedagogy + tool';
    reason = spanish
      ? 'La capa de edición y la capa de evaluación pueden compartir diseño y estructura.'
      : 'The editing layer and the assessment layer can share design and structure.';
  } else if ((b.education || b.tool) && a.education) {
    score = 8;
    label = spanish ? 'Pedagogía + herramienta' : 'Pedagogy + tool';
    reason = spanish
      ? 'La capa de edición y la capa de evaluación pueden compartir diseño y estructura.'
      : 'The editing layer and the assessment layer can share design and structure.';
  } else if (a.research && b.creative) {
    score = 7;
    label = spanish ? 'Teoría + escritura' : 'Theory + writing';
    reason = spanish
      ? 'La investigación puede alimentar una lectura narrativa o literaria más amplia.'
      : 'Research can feed a broader narrative or literary reading.';
  } else if (b.research && a.creative) {
    score = 7;
    label = spanish ? 'Teoría + escritura' : 'Theory + writing';
    reason = spanish
      ? 'La investigación puede alimentar una lectura narrativa o literaria más amplia.'
      : 'Research can feed a broader narrative or literary reading.';
  } else if (a.research && b.research) {
    score = 6;
    label = spanish ? 'Método + método' : 'Method + method';
    reason = spanish
      ? 'Los dos proyectos pueden compartir evidencia, estructura analítica y redacción.'
      : 'Both projects can share evidence, analytical structure, and writing.';
  } else if (a.institutional && b.institutional) {
    score = 5;
    label = spanish ? 'Gestión institucional' : 'Institutional management';
    reason = spanish
      ? 'Ambos proyectos pueden compartir flujo administrativo, trazabilidad y seguimiento.'
      : 'Both projects can share administrative flow, traceability, and follow-up.';
  }

  return { score, label, reason };
}

function buildExpansionIdeas(projects, activeConnections, locale) {
  const connectedPairs = new Set(
    activeConnections.map((connection) => [connection.from, connection.to].sort().join('::')),
  );

  const ideas = [];

  for (let i = 0; i < projects.length; i += 1) {
    for (let j = i + 1; j < projects.length; j += 1) {
      const left = projects[i];
      const right = projects[j];
      const pairKey = [left.id, right.id].sort().join('::');

      if (connectedPairs.has(pairKey)) continue;

      const candidate = scoreExpansionPair(left, right, locale);
      if (candidate.score < 6) continue;

      ideas.push({
        from: left.id,
        to: right.id,
        pairLabel: `${projectLabel(left, locale)} + ${projectLabel(right, locale)}`,
        label: candidate.label,
        reason: candidate.reason,
        score: candidate.score,
      });
    }
  }

  return ideas.sort((a, b) => b.score - a.score || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)).slice(0, 6);
}

function summarizeConnection(connection, projectById, locale) {
  const fromProject = projectById.get(connection.from);
  const toProject = projectById.get(connection.to);
  return {
    from: connection.from,
    to: connection.to,
    label: `${projectLabel(fromProject, locale)} → ${projectLabel(toProject, locale)}`,
    type: connection.type,
    description: connection.description,
    tier: connection.tier,
    visibility: connection.visibility,
    selectionReason: connection.selectionReason,
  };
}

function buildOverview(profile, projects, locale) {
  const spanish = isSpanish(locale);
  const name = profile?.name || (spanish ? 'Persona central' : 'Central profile');
  const affiliations = Array.isArray(profile?.affiliations)
    ? profile.affiliations
      .filter((item) => item?.current)
      .map((item) => `${translateAffiliationRole(item.role, locale) || item.role}${spanish ? ' en ' : ' at '}${item.institution}`)
    : [];
  const domains = joinList(takeHighlights(profile?.domains || [], 3), locale);
  const skills = joinList(takeHighlights(profile?.skills || [], 3), locale);
  const projectNames = joinList(takeHighlights(projects.slice(0, 4).map((project) => projectLabel(project, locale)), 4), locale);
  const practice = summarizePractice(projects, locale);
  const attributionProjects = collectAttributionProjects(projects);
  const attributionNames = joinList(attributionProjects.slice(0, 3).map((project) => projectLabel(project, locale)), locale);
  const affiliationLine = affiliations.length
    ? spanish
      ? ` Su base institucional se apoya en ${joinList(affiliations, locale)}.`
      : ` Their institutional base rests on ${joinList(affiliations, locale)}.`
    : '';
  const attributionLine = attributionNames
    ? spanish
      ? ` También reconoce coautorías y materiales de terceros como ${attributionNames}.`
      : ` It also distinguishes coauthored and third-party material such as ${attributionNames}.`
    : '';

  return spanish
    ? `${name} articula ${practice} desde una práctica que cruza ${domains || 'varios dominios'} y se apoya en ${skills || 'habilidades transversales'}; los proyectos visibles hoy —${projectNames || 'sin proyectos visibles'}— trazan una constelación de trabajo concreta.${attributionLine}${affiliationLine}`
    : `${name} articulates ${practice} through a practice that spans ${domains || 'multiple domains'} and draws on ${skills || 'cross-functional skills'}; the visible projects today —${projectNames || 'no visible projects'}— trace a concrete body of work.${attributionLine}${affiliationLine}`;
}

export function buildProfileNarrative({ profile = {}, projects = [], connections = {}, hiddenProjectIds = [], locale = 'en' } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const visibleProjects = filterVisibleProjects(projects.filter((project) => !isDemoProject(project)), hiddenProjectIds);
  const projectById = new Map(visibleProjects.map((project) => [project.id, project]));
  const allConnections = buildConnectionMap(connections.connections || [], projectById, normalizedLocale);
  const activeConnections = allConnections.filter((connection) => connection.visibility === 'default');
  const strongConnectionCount = activeConnections.filter((connection) => connection.tier === 'strong').length;
  const exploratoryConnectionCount = allConnections.filter((connection) => connection.tier === 'exploratory').length;
  const routes = buildRoutes(visibleProjects, normalizedLocale);
  const expansionIdeas = buildExpansionIdeas(visibleProjects, activeConnections, normalizedLocale);
  const overview = buildOverview(profile, visibleProjects, normalizedLocale);
  const attributionProjects = collectAttributionProjects(visibleProjects);
  const attributionNames = joinList(attributionProjects.slice(0, 3).map((project) => projectLabel(project, normalizedLocale)), normalizedLocale);
  const spanish = isSpanish(normalizedLocale);

  return {
    name: profile?.name || (spanish ? 'Persona central' : 'Central profile'),
    headline:
      translateAppTitle(profile?.site_title, normalizedLocale) ||
      translateAppSubtitle(profile?.site_subtitle, normalizedLocale) ||
      (spanish ? 'Perfil central' : 'Central profile'),
    overview,
    stats: {
      projectCount: visibleProjects.length,
      connectionCount: activeConnections.length,
      hiddenCount: normalizeHiddenCount(hiddenProjectIds),
    },
    sections: [
      {
        title: spanish ? 'Trayectorias centrales' : 'Core trajectories',
        items: [
          spanish
            ? `Enfoque central: ${summarizePractice(visibleProjects, normalizedLocale)}`
            : `Core focus: ${summarizePractice(visibleProjects, normalizedLocale)}`,
          spanish
            ? `${strongConnectionCount} puente${strongConnectionCount === 1 ? '' : 's'} fuerte${strongConnectionCount === 1 ? '' : 's'} visible${strongConnectionCount === 1 ? '' : 's'} y ${exploratoryConnectionCount} exploratorio${exploratoryConnectionCount === 1 ? '' : 's'} en reserva.`
            : `${strongConnectionCount} visible strong bridge${strongConnectionCount === 1 ? '' : 's'} and ${exploratoryConnectionCount} exploratory bridge${exploratoryConnectionCount === 1 ? '' : 's'} in reserve.`,
          profile?.affiliations?.length
            ? spanish
              ? `Afiliaciones activas: ${joinList(profile.affiliations.filter((item) => item?.current).map((item) => `${item.role} en ${item.institution}`), normalizedLocale)}`
              : `Current affiliations: ${joinList(profile.affiliations.filter((item) => item?.current).map((item) => `${item.role} at ${item.institution}`), normalizedLocale)}`
            : spanish
              ? 'Afiliaciones activas no registradas.'
              : 'No active affiliations recorded.',
          attributionNames
            ? spanish
              ? `Coautorías y materiales de terceros: ${attributionNames}`
              : `Coauthored and third-party material: ${attributionNames}`
            : null,
        ].filter(Boolean),
      },
      {
        title: spanish ? 'Puentes activos' : 'Active bridges',
        items: activeConnections.slice(0, 6).map((connection) => summarizeConnection(connection, projectById, normalizedLocale)),
      },
      {
        title: spanish ? 'Rutas posibles' : 'Possible routes',
        items: routes.map((route) => ({
          title: route.title,
          summary: route.summary,
          projects: route.projects,
        })),
      },
      {
        title: spanish ? 'Ideas de expansión' : 'Expansion ideas',
        items: expansionIdeas.map((idea) => ({
          from: idea.from,
          to: idea.to,
          pairLabel: idea.pairLabel,
          label: idea.label,
          reason: idea.reason,
        })),
      },
    ],
    routes,
    expansionIdeas,
  };
}

function normalizeHiddenCount(hiddenProjectIds) {
  return new Set((Array.isArray(hiddenProjectIds) ? hiddenProjectIds : []).map((value) => String(value || '').trim()).filter(Boolean)).size;
}

import { filterVisibleProjects } from './projectVisibility.js';

const EDUCATION_PATTERNS = [
  'educacion',
  'pedagog',
  'edtech',
  'planeacion',
  'icfes',
  'metacogn',
  'evaluacion formativa',
  'aprendizaje',
  'secundaria',
  'curricul',
  'tecnologia educativa',
];

const RESEARCH_PATTERNS = [
  'investig',
  'estudio',
  'articulo',
  'paper',
  'epidemiolog',
  'semiot',
  'sociologia',
  'datos',
  'analisis',
];

const CREATIVE_PATTERNS = [
  'creativ',
  'literatura',
  'cuento',
  'caribe',
  'memoria oral',
  'mito',
  'narrat',
];

const INSTITUTIONAL_PATTERNS = [
  'institucional',
  'gestion',
  'mincultura',
  'pei',
  'brisas',
  'administrativ',
  'politica publica',
];

const SOCIOEMOTIONAL_PATTERNS = [
  'emocion',
  'psicolog',
  'acompan',
  'autoconocimiento',
  'socioemoc',
];

const TOOL_PATTERNS = [
  'web app',
  'software',
  'ui',
  'frontend',
  'desarrollo',
  'plataforma',
  'tool',
  'editor',
  'markdown',
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function joinList(values) {
  const items = [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
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

function projectLabel(project) {
  return project?.name || project?.title || project?.id || 'Proyecto';
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

function buildConnectionMap(connections, projectById) {
  return (Array.isArray(connections) ? connections : []).reduce((acc, connection) => {
    const from = String(connection?.from || connection?.source || '').trim();
    const to = String(connection?.to || connection?.target || '').trim();

    if (!from || !to) return acc;
    if (!projectById.has(from) || !projectById.has(to)) return acc;

    acc.push({
      from,
      to,
      type: connection?.type || 'Sinérgica',
      description: connection?.description || '',
    });
    return acc;
  }, []);
}

function buildRoutes(projects) {
  const routes = [];
  const educationProjects = projects.filter((project) => {
    const classification = classifyProject(project);
    return classification.education || classification.tool || classification.socioemotional;
  });

  if (educationProjects.length >= 2) {
    const ordered = educationProjects.slice().sort((a, b) => projectPriority(a) - projectPriority(b) || projectLabel(a).localeCompare(projectLabel(b)));
    routes.push({
      title: 'Ruta EdTech',
      projects: ordered.map((project) => project.id),
      summary: `Del editor y la planificación hacia la evaluación y el acompañamiento: ${joinList(ordered.map(projectLabel))}.`,
    });
  }

  const creativeProjects = projects.filter((project) => classifyProject(project).creative || /caribe|literatura|mito/.test(collectProjectText(project)));
  if (creativeProjects.length >= 2) {
    const ordered = creativeProjects.slice().sort((a, b) => projectPriority(a) - projectPriority(b) || projectLabel(a).localeCompare(projectLabel(b)));
    routes.push({
      title: 'Ruta Caribe',
      projects: ordered.map((project) => project.id),
      summary: `La escritura y la memoria oral se conectan en ${joinList(ordered.map(projectLabel))}.`,
    });
  }

  const researchProjects = projects.filter((project) => classifyProject(project).research);
  if (researchProjects.length >= 2) {
    const ordered = researchProjects.slice().sort((a, b) => projectPriority(a) - projectPriority(b) || projectLabel(a).localeCompare(projectLabel(b)));
    routes.push({
      title: 'Ruta de Investigación',
      projects: ordered.map((project) => project.id),
      summary: `La línea investigativa se sostiene en ${joinList(ordered.map(projectLabel))}.`,
    });
  }

  const institutionalProjects = projects.filter((project) => classifyProject(project).institutional);
  if (institutionalProjects.length >= 2) {
    const ordered = institutionalProjects.slice().sort((a, b) => projectPriority(a) - projectPriority(b) || projectLabel(a).localeCompare(projectLabel(b)));
    routes.push({
      title: 'Ruta Institucional',
      projects: ordered.map((project) => project.id),
      summary: `La gestión institucional se articula en ${joinList(ordered.map(projectLabel))}.`,
    });
  }

  return routes;
}

function scoreExpansionPair(projectA, projectB) {
  const a = classifyProject(projectA);
  const b = classifyProject(projectB);
  let score = 0;
  let label = '';
  let reason = '';

  if ((a.education || a.tool) && b.socioemotional) {
    score = 9;
    label = 'Pedagogía + acompañamiento';
    reason = 'La herramienta pedagógica puede incorporar registro emocional y seguimiento formativo.';
  } else if ((b.education || b.tool) && a.socioemotional) {
    score = 9;
    label = 'Pedagogía + acompañamiento';
    reason = 'La herramienta pedagógica puede incorporar registro emocional y seguimiento formativo.';
  } else if ((a.education || a.tool) && b.education) {
    score = 8;
    label = 'Pedagogía + herramienta';
    reason = 'La capa de edición y la capa de evaluación pueden compartir diseño y estructura.';
  } else if ((b.education || b.tool) && a.education) {
    score = 8;
    label = 'Pedagogía + herramienta';
    reason = 'La capa de edición y la capa de evaluación pueden compartir diseño y estructura.';
  } else if (a.research && b.creative) {
    score = 7;
    label = 'Teoría + escritura';
    reason = 'La investigación puede alimentar una lectura narrativa o literaria más amplia.';
  } else if (b.research && a.creative) {
    score = 7;
    label = 'Teoría + escritura';
    reason = 'La investigación puede alimentar una lectura narrativa o literaria más amplia.';
  } else if (a.research && b.research) {
    score = 6;
    label = 'Método + método';
    reason = 'Los dos proyectos pueden compartir evidencia, estructura analítica y redacción.';
  } else if (a.institutional && b.institutional) {
    score = 5;
    label = 'Gestión institucional';
    reason = 'Ambos proyectos pueden compartir flujo administrativo, trazabilidad y seguimiento.';
  }

  return { score, label, reason };
}

function buildExpansionIdeas(projects, activeConnections) {
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

      const candidate = scoreExpansionPair(left, right);
      if (candidate.score < 6) continue;

      ideas.push({
        from: left.id,
        to: right.id,
        label: candidate.label,
        reason: candidate.reason,
        score: candidate.score,
      });
    }
  }

  return ideas.sort((a, b) => b.score - a.score || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)).slice(0, 6);
}

function summarizeConnection(connection, projectById) {
  const fromProject = projectById.get(connection.from);
  const toProject = projectById.get(connection.to);
  return {
    from: connection.from,
    to: connection.to,
    label: `${projectLabel(fromProject)} → ${projectLabel(toProject)}`,
    type: connection.type,
    description: connection.description,
  };
}

function buildOverview(profile, projects) {
  const name = profile?.name || 'La persona central';
  const subtitle = profile?.site_subtitle || 'Sistema Operativo Personal';
  const affiliations = Array.isArray(profile?.affiliations)
    ? profile.affiliations.filter((item) => item?.current).map((item) => `${item.role} en ${item.institution}`)
    : [];
  const domains = joinList(profile?.domains || []);
  const skills = joinList(profile?.skills || []);
  const projectNames = joinList(projects.slice(0, 4).map(projectLabel));
  const affiliationLine = affiliations.length ? ` Su base institucional se apoya en ${joinList(affiliations)}.` : '';

  return `${name} organiza su trabajo como ${subtitle}. Su práctica cruza ${domains || 'varios dominios'} y se apoya en ${skills || 'habilidades transversales'}; los proyectos visibles hoy —${projectNames || 'sin proyectos visibles'}— forman una constelación de docencia, investigación, gestión y escritura.${affiliationLine}`;
}

export function buildProfileNarrative({ profile = {}, projects = [], connections = {}, hiddenProjectIds = [] } = {}) {
  const visibleProjects = filterVisibleProjects(projects, hiddenProjectIds);
  const projectById = new Map(visibleProjects.map((project) => [project.id, project]));
  const activeConnections = buildConnectionMap(connections.connections || [], projectById);
  const routes = buildRoutes(visibleProjects);
  const expansionIdeas = buildExpansionIdeas(visibleProjects, activeConnections);
  const overview = buildOverview(profile, visibleProjects);

  return {
    name: profile?.name || 'Persona central',
    headline: profile?.site_title || profile?.site_subtitle || 'Perfil central',
    overview,
    stats: {
      projectCount: visibleProjects.length,
      connectionCount: activeConnections.length,
      hiddenCount: normalizeHiddenCount(hiddenProjectIds),
    },
    sections: [
      {
        title: 'Trayectorias centrales',
        items: [
          profile?.site_subtitle ? `Eje principal: ${profile.site_subtitle}` : 'Eje principal sin subtítulo definido.',
          profile?.affiliations?.length
            ? `Afiliaciones activas: ${joinList(profile.affiliations.filter((item) => item?.current).map((item) => `${item.role} en ${item.institution}`))}`
            : 'Afiliaciones activas no registradas.',
          profile?.skills?.length ? `Habilidades clave: ${joinList(profile.skills)}` : 'Habilidades clave no registradas.',
        ].filter(Boolean),
      },
      {
        title: 'Puentes activos',
        items: activeConnections.slice(0, 6).map((connection) => summarizeConnection(connection, projectById)),
      },
      {
        title: 'Rutas posibles',
        items: routes.map((route) => ({
          title: route.title,
          summary: route.summary,
          projects: route.projects,
        })),
      },
      {
        title: 'Ideas de expansión',
        items: expansionIdeas.map((idea) => ({
          from: idea.from,
          to: idea.to,
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

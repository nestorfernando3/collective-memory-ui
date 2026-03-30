#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_ROOT = path.join(REPO_ROOT, 'collective-memory');
const CONFIG_PATH = path.join(MEMORY_ROOT, 'config.json');
const PROJECTS_DIR = path.join(MEMORY_ROOT, 'projects');
const PROFILE_PATH = path.join(MEMORY_ROOT, 'profile.json');
const CONNECTIONS_PATH = path.join(MEMORY_ROOT, 'connections.json');
const RESEARCH_SYNC_PATH = path.join(__dirname, 'research_sync.js');
const DEFAULT_OUTPUT_ROOT = path.join(os.homedir(), 'Documents', 'Collective Memory');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(value) {
  return String(value || '')
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  values
    .flat()
    .filter(Boolean)
    .map(value => String(value).trim())
    .filter(Boolean)
    .forEach(value => {
      const key = value.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        output.push(value);
      }
    });
  return output;
}

function expandHome(inputPath) {
  if (!inputPath) return '';
  if (inputPath === '~') return os.homedir();
  if (inputPath.startsWith('~/')) return path.join(os.homedir(), inputPath.slice(2));
  return inputPath;
}

function parseArgs(argv) {
  const args = {
    outputRoot: DEFAULT_OUTPUT_ROOT,
    clean: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output-root') {
      args.outputRoot = argv[++i] || DEFAULT_OUTPUT_ROOT;
    } else if (arg === '--no-clean') {
      args.clean = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log([
        'Usage: node collective-memory/scripts/systemwide_refresh.js [options]',
        '',
        'Options:',
        '  --output-root <path>   Snapshot root to generate (default: ~/Documents/Collective Memory)',
        '  --no-clean             Keep existing files in the output root before writing',
      ].join('\n'));
      process.exit(0);
    }
  }

  return args;
}

function loadProjects() {
  return fs.readdirSync(PROJECTS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => readJson(path.join(PROJECTS_DIR, file), {}))
    .filter(project => project && project.id && project.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function normalizeProject(project) {
  const related = uniqueStrings(project.related_projects || []);
  const domains = uniqueStrings(project.domains || []);
  const themes = uniqueStrings(project.themes || []);
  const tags = uniqueStrings(project.tags || []);
  const technologies = uniqueStrings(project.technologies || []);
  const institutions = uniqueStrings(project.institutions || []);
  const collaborators = uniqueStrings(project.collaborators || []);
  const frameworks = uniqueStrings(project.theoretical_frameworks || []);

  return {
    ...project,
    type: project.type || 'Proyecto',
    status: project.status || 'activo',
    path: project.path || '',
    description: project.description || 'Sin descripción disponible todavía.',
    related_projects: related,
    domains,
    themes,
    tags,
    technologies,
    institutions,
    collaborators,
    theoretical_frameworks: frameworks,
  };
}

function buildProfile(baseProfile, projects) {
  const domains = uniqueStrings([
    baseProfile?.domains || [],
    projects.map(project => project.type),
    projects.flatMap(project => project.domains),
    projects.flatMap(project => project.themes),
    projects.flatMap(project => project.tags),
  ]);

  const skills = uniqueStrings([
    baseProfile?.skills || [],
    projects.flatMap(project => project.technologies),
    projects.flatMap(project => project.theoretical_frameworks),
  ]);

  const affiliations = Array.isArray(baseProfile?.affiliations) ? baseProfile.affiliations : [];
  const identifiers = baseProfile?.identifiers || {};
  const location = baseProfile?.location || {};
  const languages = Array.isArray(baseProfile?.languages) && baseProfile.languages.length
    ? baseProfile.languages
    : ['español', 'inglés'];

  return {
    name: baseProfile?.name || 'Néstor De León',
    site_title: baseProfile?.site_title || 'Memoria Colectiva',
    site_subtitle: baseProfile?.site_subtitle || 'Archivo vivo de trabajo',
    identifiers,
    affiliations,
    location,
    domains,
    skills,
    languages,
    lenses: [
      { id: 'All', label: 'Universo completo', filter: [] },
      { id: 'Investigacion', label: 'Investigación', filter: ['investigación', 'investigacion', 'académico', 'semiotica', 'epidemiología'] },
      { id: 'Educacion', label: 'Educación', filter: ['educación', 'pedagogía', 'edtech', 'icfes', 'institucional'] },
      { id: 'Cultura', label: 'Cultura y creación', filter: ['cultural', 'literatura', 'caribe', 'artes', 'gestión cultural'] },
    ],
    stats: {
      total_projects: projects.length,
      generated_at: new Date().toISOString(),
    },
  };
}

function buildProfileMarkdown(profile, projects) {
  const activeProjects = projects
    .filter(project => /activo|desarrollo|proceso|postul|construcci/i.test(String(project.status)))
    .slice(0, 8)
    .map(project => `- ${project.name}: ${project.description}`);

  const featuredThemes = uniqueStrings(projects.flatMap(project => [...project.domains, ...project.themes, ...project.tags])).slice(0, 12);

  return [
    `# ${profile.name}`,
    '',
    `${profile.site_subtitle}. Este perfil se entiende por la suma de proyectos académicos, pedagógicos, culturales y de desarrollo que comparten métodos, temas y trayectorias en el Caribe colombiano.`,
    '',
    '## Identidad de trabajo',
    '',
    profile.affiliations.length
      ? profile.affiliations.map(aff => `- ${aff.role} en ${aff.institution}${aff.current ? ' (vigente)' : ''}`)
      : ['- Afiliaciones por completar'],
    '',
    '## Áreas que comparte',
    '',
    featuredThemes.length ? featuredThemes.map(item => `- ${item}`) : ['- Sin áreas consolidadas todavía'],
    '',
    '## Capacidades visibles',
    '',
    profile.skills.length ? profile.skills.slice(0, 15).map(skill => `- ${skill}`) : ['- Sin capacidades registradas todavía'],
    '',
    '## Proyectos activos o en movimiento',
    '',
    activeProjects.length ? activeProjects : ['- No hay proyectos activos detectados con el estado actual'],
    '',
  ].flat().join('\n');
}

function buildConnectionsSummary(connections) {
  const ranked = (connections || [])
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 12);

  if (!ranked.length) {
    return ['- No se registraron conexiones todavía.'];
  }

  return ranked.map(connection => {
    const label = `${connection.from} -> ${connection.to}`;
    const why = connection.description || 'Sin narrativa todavía.';
    return `- ${label}: ${why}`;
  });
}

function buildMermaid(projects, connections) {
  const lines = ['graph LR'];

  projects.forEach(project => {
    lines.push(`  ${slugify(project.id)}["${project.name.replace(/"/g, '\\"')}"]`);
  });

  (connections || [])
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 40)
    .forEach(connection => {
      const from = slugify(connection.from);
      const to = slugify(connection.to);
      const labelParts = [];
      if (connection.score) labelParts.push(`score ${Math.round(connection.score)}`);
      if (Array.isArray(connection.shared) && connection.shared.length) {
        labelParts.push(connection.shared.slice(0, 2).join(', '));
      }
      const label = labelParts.join(' | ').replace(/"/g, '\\"');
      lines.push(`  ${from} -->|${label}| ${to}`);
    });

  return lines.join('\n');
}

function buildReadme(profile, projects, connections, outputRoot) {
  const projectLines = projects.map(project => {
    const details = [
      project.type,
      project.status,
      project.path ? `ruta: ${project.path}` : null,
    ].filter(Boolean).join(' · ');
    return `- **${project.name}**: ${project.description} (${details})`;
  });

  return [
    '# Collective Memory',
    '',
    `Raíz del snapshot: \`${outputRoot}\``,
    '',
    '## Qué es este snapshot',
    '',
    'Esta carpeta reúne el perfil unificado, las fichas de proyectos y el grafo de relaciones de trabajo en modo systemwide. Se basa en la memoria completa registrada en esta instalación, no solo en el proyecto activo.',
    '',
    '## Perfil unificado',
    '',
    `- Nombre: ${profile.name}`,
    `- Título: ${profile.site_title}`,
    `- Subtítulo: ${profile.site_subtitle}`,
    `- Proyectos registrados: ${projects.length}`,
    `- Conexiones registradas: ${(connections || []).length}`,
    '',
    '## Archivos clave de esta raíz',
    '',
    '- `README.md` como índice legible del snapshot',
    '- `profile.json` con la identidad unificada',
    '- `connections.json` con el grafo de relaciones',
    '- `projects/` con una ficha JSON por proyecto',
    '- `PROFILE.md` con la síntesis narrativa de la identidad',
    '',
    '## Proyectos',
    '',
    projectLines,
    '',
    '## Conexiones destacadas',
    '',
    buildConnectionsSummary(connections),
    '',
    '## Mapa Mermaid',
    '',
    '```mermaid',
    buildMermaid(projects, connections),
    '```',
    '',
    '## Siguiente paso en la plataforma',
    '',
    '- Importa la carpeta raíz completa en la UI.',
    '- Si necesitas un punto de entrada para revisar el snapshot antes de cargarlo, abre `README.md`.',
    '',
  ].flat().join('\n');
}

function runResearchSync() {
  execFileSync(process.execPath, [RESEARCH_SYNC_PATH, '--apply'], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    env: process.env,
  });
}

function writeSnapshot(outputRoot, config, profile, profileMarkdown, readme, projects, connections, clean) {
  if (clean) {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }

  const snapshotProjectsDir = path.join(outputRoot, 'projects');
  ensureDir(snapshotProjectsDir);

  projects.forEach(project => {
    writeJson(path.join(snapshotProjectsDir, `${project.id}.json`), project);
  });

  writeJson(path.join(outputRoot, 'profile.json'), profile);
  writeJson(path.join(outputRoot, 'connections.json'), connections);
  fs.writeFileSync(path.join(outputRoot, 'PROFILE.md'), `${profileMarkdown}\n`, 'utf8');
  fs.writeFileSync(path.join(outputRoot, 'README.md'), `${readme}\n`, 'utf8');
  writeJson(path.join(outputRoot, 'config.json'), {
    ...config,
    data_dir: outputRoot,
    language: 'es',
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputRoot = path.resolve(expandHome(args.outputRoot));
  const config = readJson(CONFIG_PATH, {});

  const projects = loadProjects().map(normalizeProject);
  const baseProfile = readJson(PROFILE_PATH, {});

  runResearchSync();

  const connections = readJson(CONNECTIONS_PATH, { connections: [], clusters: [] });
  const profile = buildProfile(baseProfile, projects);
  const profileMarkdown = buildProfileMarkdown(profile, projects);
  const readme = buildReadme(profile, projects, connections.connections || [], outputRoot);

  writeJson(PROFILE_PATH, profile);
  fs.writeFileSync(path.join(MEMORY_ROOT, 'PROFILE.md'), `${profileMarkdown}\n`, 'utf8');
  fs.writeFileSync(path.join(MEMORY_ROOT, 'README.md'), `${readme}\n`, 'utf8');

  writeSnapshot(outputRoot, config, profile, profileMarkdown, readme, projects, connections, args.clean);

  const result = {
    output_root: outputRoot,
    project_count: projects.length,
    connection_count: Array.isArray(connections.connections) ? connections.connections.length : 0,
    files: [
      'README.md',
      'PROFILE.md',
      'profile.json',
      'connections.json',
      'config.json',
      'projects/',
    ],
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();

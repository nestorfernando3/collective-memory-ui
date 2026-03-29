#!/usr/bin/env node
/**
 * /memoria research-sync
 *
 * Scores likely connections between project cards using:
 * - shared metadata fields (tags, domains, themes, frameworks, etc.)
 * - optional document text found under the project's path
 * - local markdown notes in the collective-memory workspace
 *
 * By default this is a dry run that prints a markdown report.
 * Pass --apply to write validated suggestions back into connections.json.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const UI_DIR = path.join(ROOT_DIR, '..', 'collective-memory-ui');
const PROJECTS_DIR = path.join(ROOT_DIR, 'projects');
const CONNECTIONS_PATH = path.join(ROOT_DIR, 'connections.json');
const UI_CONNECTIONS_PATH = path.join(UI_DIR, 'public', 'data', 'connections.json');
const DEFAULT_DOCS_ROOT = path.join(os.homedir(), 'Documents');

const FIELD_WEIGHTS = {
  theoretical_frameworks: 9,
  domains: 8,
  themes: 7,
  tags: 6,
  technologies: 4,
  institutions: 5,
  collaborators: 5,
  outputs: 3,
};

const STOPWORDS = new Set([
  'a', 'acerca', 'al', 'algo', 'ante', 'antes', 'aqui', 'as', 'at', 'bajo',
  'be', 'but', 'como', 'con', 'contra', 'creo', 'de', 'del', 'desde', 'donde',
  'dos', 'el', 'ella', 'ellos', 'en', 'entre', 'era', 'es', 'esta', 'este',
  'estos', 'for', 'from', 'ha', 'hasta', 'he', 'i', 'if', 'in', 'is', 'la',
  'las', 'le', 'les', 'lo', 'los', 'mas', 'mi', 'muy', 'no', 'of', 'on',
  'or', 'para', 'pero', 'por', 'que', 'que', 'se', 'sin', 'sobre', 'su',
  'sus', 'the', 'to', 'una', 'uno', 'y', 'ya', 'with',
  'proyecto', 'proyectos', 'documento', 'documentos', 'trabajo', 'work',
  'project', 'paper', 'nota', 'notas', 'archivo', 'archivos', 'final',
  'actual', 'current', 'available',
  'documents', 'document', 'doc', 'docs', 'users', 'nestor', 'home',
  'files', 'file', 'folder', 'folders', 'textos', 'selectos',
]);

function parseArgs(argv) {
  const args = {
    apply: false,
    focus: null,
    top: 5,
    docsRoot: DEFAULT_DOCS_ROOT,
    report: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--focus') {
      args.focus = argv[++i];
    } else if (arg === '--top') {
      args.top = Math.max(1, Number(argv[++i]) || 5);
    } else if (arg === '--documents-root') {
      args.docsRoot = argv[++i];
    } else if (arg === '--report') {
      args.report = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log([
    'Usage: node collective-memory/scripts/research_sync.js [options]',
    '',
    'Options:',
    '  --focus <project-id>      Limit analysis to one project',
    '  --top <n>                 Number of suggestions to show (default: 5)',
    '  --documents-root <path>   Root folder to scan for .md/.txt/.docx files',
    '  --report <path>           Write the markdown report to a file',
    '  --apply                   Write validated suggestions to connections.json',
    '  --help                    Show this help text',
  ].join('\n'));
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function expandHome(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath === '~') return os.homedir();
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length > 2 && !STOPWORDS.has(token));
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function joinList(values) {
  const items = uniq(values);
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

function titleCaseSlug(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function stripXmlText(xml) {
  return xml
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function readDocxText(filePath) {
  try {
    const xml = execFileSync('unzip', ['-p', filePath, 'word/document.xml'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return stripXmlText(xml);
  } catch {
    return '';
  }
}

function readDocumentText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.docx') return readDocxText(filePath);
  return safeRead(filePath);
}

function isIgnoredDir(dirName) {
  return ['.git', 'node_modules', 'dist', 'coverage', '.cache'].includes(dirName);
}

function walkFiles(rootDir, maxDepth, allowedExtensions, limit, results = [], depth = 0) {
  if (!fs.existsSync(rootDir) || results.length >= limit || depth > maxDepth) return results;

  let entries = [];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (results.length >= limit) break;
    const nextPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (!isIgnoredDir(entry.name)) {
        walkFiles(nextPath, maxDepth, allowedExtensions, limit, results, depth + 1);
      }
      continue;
    }

    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (allowedExtensions.includes(ext)) {
        results.push(nextPath);
      }
    }
  }

  return results;
}

function scorePathMatch(filePath, tokens) {
  const normalized = normalizeText(filePath);
  let score = 0;
  tokens.forEach(token => {
    if (normalized.includes(token)) score += 1;
  });
  return score;
}

function loadProjects() {
  const files = fs.existsSync(PROJECTS_DIR)
    ? fs.readdirSync(PROJECTS_DIR).filter(file => file.endsWith('.json'))
    : [];

  return files
    .map(file => {
      const filePath = path.join(PROJECTS_DIR, file);
      const data = readJson(filePath, null);
      if (!data || !data.id) return null;
      return {
        ...data,
        __filePath: filePath,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function loadConnections() {
  return readJson(CONNECTIONS_PATH, { connections: [], clusters: [] });
}

function projectStrings(project) {
  const values = [
    project.id,
    project.name,
    project.title,
    project.type,
    project.status,
    project.description,
    project.abstract,
    path.basename(String(project.path || '')),
  ];

  ['tags', 'domains', 'themes', 'theoretical_frameworks', 'technologies', 'institutions', 'collaborators'].forEach(key => {
    if (Array.isArray(project[key])) values.push(...project[key]);
  });

  if (Array.isArray(project.outputs)) {
    project.outputs.forEach(output => {
      if (output && typeof output === 'object') {
        values.push(output.type, output.title, output.status, output.url);
      }
    });
  }

  return values.filter(Boolean).map(String);
}

function gatherProjectTokens(project) {
  return new Set(tokenize(projectStrings(project).join(' ')));
}

function gatherFieldValues(project, field) {
  const values = [];
  const raw = project[field];

  if (Array.isArray(raw)) {
    raw.forEach(item => {
      if (item && typeof item === 'object') {
        values.push(item.title || item.name || item.type || item.label || item.role || item.value || '');
      } else {
        values.push(item);
      }
    });
  } else if (typeof raw === 'string') {
    values.push(raw);
  }

  return uniq(values.map(value => normalizeText(value).trim()).filter(Boolean));
}

function getMetadataFields(project) {
  return {
    theoretical_frameworks: gatherFieldValues(project, 'theoretical_frameworks'),
    domains: gatherFieldValues(project, 'domains'),
    themes: gatherFieldValues(project, 'themes'),
    tags: gatherFieldValues(project, 'tags'),
    technologies: gatherFieldValues(project, 'technologies'),
    institutions: gatherFieldValues(project, 'institutions'),
    collaborators: gatherFieldValues(project, 'collaborators'),
    outputs: gatherFieldValues(project, 'outputs'),
  };
}

function fileLabel(filePath) {
  return path.basename(filePath);
}

function gatherDocumentFiles(project, docsRoot) {
  const candidates = [];
  const seen = new Set();
  const tokens = uniq(tokenize(projectStrings(project).join(' ')));
  const pathsToCheck = [];

  const explicitPath = expandHome(project.path || '');
  if (explicitPath && fs.existsSync(explicitPath)) {
    pathsToCheck.push(explicitPath);
  }

  const localNotesRoot = ROOT_DIR;
  if (fs.existsSync(localNotesRoot)) {
    pathsToCheck.push(localNotesRoot);
  }

  const expandedDocsRoot = expandHome(docsRoot || DEFAULT_DOCS_ROOT);
  if (expandedDocsRoot && fs.existsSync(expandedDocsRoot)) {
    pathsToCheck.push(expandedDocsRoot);
  }

  pathsToCheck.forEach(root => {
    const allowedExtensions = root === localNotesRoot ? ['.md'] : ['.md', '.txt', '.docx'];
    const maxDepth = root === expandedDocsRoot ? 3 : 2;
    const limit = root === expandedDocsRoot ? 24 : 12;
    const files = walkFiles(root, maxDepth, allowedExtensions, limit, []);
    files.forEach(filePath => {
      if (seen.has(filePath)) return;
      const score = scorePathMatch(filePath, tokens) + (root === localNotesRoot ? 5 : 0);
      const isDirectProjectPath = explicitPath && filePath === explicitPath;
      const include = isDirectProjectPath || score > 0;
      if (include) {
        seen.add(filePath);
        candidates.push({ filePath, score: score + (isDirectProjectPath ? 5 : 0) });
      }
    });
  });

  return candidates
    .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath))
    .slice(0, 8)
    .map(item => item.filePath);
}

function gatherDocumentEvidence(project, docsRoot) {
  const files = gatherDocumentFiles(project, docsRoot);
  const snippets = [];
  const tokens = new Set();

  files.forEach(filePath => {
    const text = readDocumentText(filePath).slice(0, 12000);
    if (!text) return;
    const fileTokens = tokenize(text);
    fileTokens.forEach(token => tokens.add(token));
    snippets.push({
      filePath,
      label: fileLabel(filePath),
      text,
      tokens: fileTokens,
    });
  });

  return {
    files,
    snippets,
    tokens,
  };
}

function buildProjectProfile(project, docsRoot) {
  const metadataFields = getMetadataFields(project);
  const metadataTokens = gatherProjectTokens(project);
  const docEvidence = gatherDocumentEvidence(project, docsRoot);
  const docTokens = docEvidence.tokens;
  const combinedTokens = new Set([...metadataTokens, ...docTokens]);
  const roleFlags = classifyProjectRole({
    project,
    metadataFields,
    metadataTokens,
    docTokens,
    combinedTokens,
    docEvidence,
  });

  return {
    project,
    metadataFields,
    metadataTokens,
    docEvidence,
    docTokens,
    combinedTokens,
    roleFlags,
  };
}

function setIntersection(a, b) {
  const out = [];
  a.forEach(value => {
    if (b.has(value)) out.push(value);
  });
  return uniq(out);
}

function sharedFieldDetails(fieldsA, fieldsB) {
  const details = {};
  Object.keys(FIELD_WEIGHTS).forEach(field => {
    const a = new Set(fieldsA[field] || []);
    const b = new Set(fieldsB[field] || []);
    details[field] = setIntersection(a, b);
  });
  return details;
}

function scorePair(profileA, profileB, existingKeys) {
  const a = profileA.project;
  const b = profileB.project;
  const pairKey = canonicalPairKey(a.id, b.id);
  const alreadyConnected = existingKeys.has(pairKey);
  const roleA = profileA.roleFlags || classifyProjectRole(profileA);
  const roleB = profileB.roleFlags || classifyProjectRole(profileB);

  const shared = sharedFieldDetails(profileA.metadataFields, profileB.metadataFields);
  const sharedMetadataTokens = setIntersection(profileA.metadataTokens, profileB.metadataTokens);
  const sharedDocTokens = setIntersection(profileA.docTokens, profileB.docTokens);

  let score = 0;
  const signals = [];

  Object.entries(shared).forEach(([field, values]) => {
    if (!values.length) return;
    const weight = FIELD_WEIGHTS[field] || 0;
    const fieldScore = weight + Math.max(0, values.length - 1) * (weight * 0.25);
    score += fieldScore;
    signals.push({
      field,
      values,
      weight: fieldScore,
    });
  });

  if (sharedMetadataTokens.length) {
    const tokenScore = Math.min(6, sharedMetadataTokens.length * 0.45);
    score += tokenScore;
    signals.push({
      field: 'metadata_tokens',
      values: sharedMetadataTokens.slice(0, 8),
      weight: tokenScore,
    });
  }

  if (sharedDocTokens.length) {
    const docScore = Math.min(5, sharedDocTokens.length * 0.4);
    score += docScore;
    signals.push({
      field: 'document_tokens',
      values: sharedDocTokens.slice(0, 8),
      weight: docScore,
    });
  }

  const bridgeScore = semanticBridgeScore(roleA, roleB, shared, sharedMetadataTokens);
  if (bridgeScore > 0) {
    score += bridgeScore;
    signals.push({
      field: 'semantic_bridge',
      values: semanticBridgeLabels(roleA, roleB, shared, sharedMetadataTokens),
      weight: bridgeScore,
    });
  }

  const reverseRelated = [a.related_projects, b.related_projects]
    .flat()
    .filter(Boolean)
    .map(value => String(value).toLowerCase());

  if (reverseRelated.includes(a.id.toLowerCase()) || reverseRelated.includes(b.id.toLowerCase())) {
    score += 10;
    signals.push({
      field: 'explicit_relation',
      values: [a.id, b.id],
      weight: 10,
    });
  }

  return {
    a,
    b,
    pairKey,
    alreadyConnected,
    score,
    signals,
    shared,
    sharedMetadataTokens,
    sharedDocTokens,
    roleA,
    roleB,
  };
}

function canonicalPairKey(a, b) {
  return [a, b].sort().join('::');
}

function foundationScore(profile) {
  const p = profile.project;
  const text = normalizeText(projectStrings(p).join(' '));
  let score = 0;

  score += (profile.metadataFields.theoretical_frameworks.length || 0) * 4;
  score += (profile.metadataFields.domains.length || 0) * 1.5;
  score += (profile.metadataFields.themes.length || 0) * 1.25;
  score += (profile.metadataFields.tags.length || 0) * 0.75;
  score += (profile.metadataFields.technologies.length || 0) * 0.5;
  score += (Array.isArray(p.outputs) ? p.outputs.length : 0) * 2;

  if (/(teori|ensayo|marco|metodolog|investig|estudio|analisis|ensambl|curadoria)/.test(text)) {
    score += 4;
  }
  if (/(web app|app|editor|suite|plataforma|software|tool|prototipo|frontend|ui)/.test(text)) {
    score += 2;
  }
  if (/(deployed|publicado|completo|maquetado|formateado|activo|active|en desarrollo|en ejecucion)/.test(text)) {
    score += 1;
  }

  return score;
}

function sourceRoleScore(profile, roles) {
  const roleFlags = roles || classifyProjectRole(profile);
  let score = foundationScore(profile);

  if (roleFlags.theory) score += 5;
  if (roleFlags.research) score += 5;
  if (roleFlags.pedagogy) score += 4;
  if (roleFlags.institutional) score += 4;
  if (roleFlags.data) score += 4;
  if (roleFlags.tool) score += 3;
  if (roleFlags.creative) score += 2;
  if (roleFlags.article) score += 1;

  return score;
}

function classifyProjectRole(profile) {
  const p = profile.project;
  const text = normalizeText(projectStrings(p).join(' '));
  const fields = profile.metadataFields || {};

  return {
    theory: (fields.theoretical_frameworks || []).length > 0 || /(teori|semiot|epistem|rumor|chisme|simulacra|signo|metodolog)/.test(text),
    research: /(investig|estudio|research|articulo|paper|tesis|metodolog)/.test(text) || /investig/i.test(String(p.type || '')),
    pedagogy: /(educaci[oó]n|pedagog|curricul|icfes|metacogn|evaluaci[oó]n formativa|planeaci[oó]n|aprendizaje)/.test(text),
    creative: /(literatura|cuento|narrat|caribe|memoria oral|creativ|mito)/.test(text) || /creativ/i.test(String(p.type || '')),
    institutional: /(institucional|gestion|mincultura|brisas|pei|convocatoria|politica publica|administrativ)/.test(text) || /institucional/i.test(String(p.type || '')),
    tool: /(web app|software|ui|frontend|desarrollo|plataforma|tool|app\b|markdown)/.test(text) || /desarrollo|edtech/i.test(String(p.type || '')),
    data: /(datos|epidemiolog|estadist|dataset|descriptiv)/.test(text),
    article: /(articulo|ensayo|propuesta|paper)/.test(text),
  };
}

function semanticBridgeScore(roleA, roleB, shared, sharedTokens) {
  let score = 0;
  const theoryCreative = ((roleA.theory || roleA.research) && roleB.creative) || ((roleB.theory || roleB.research) && roleA.creative);
  const pedagogyTool = (roleA.pedagogy && roleB.tool) || (roleB.pedagogy && roleA.tool);
  const researchArticle = ((roleA.research || roleA.data) && roleB.article) || ((roleB.research || roleB.data) && roleA.article);
  const institutionalPair = roleA.institutional && roleB.institutional;
  const creativePair = roleA.creative && roleB.creative;
  const pedagogyCreative = (roleA.pedagogy && roleB.creative) || (roleB.pedagogy && roleA.creative);
  const theorySharedCaribe = theoryCreative && ((shared.domains || []).includes('caribe') || sharedTokens.includes('caribe'));

  if (theoryCreative) score += 7;
  if (pedagogyTool) score += 7;
  if (researchArticle) score += 6;
  if (institutionalPair) score += 4;
  if (creativePair) score += 3;
  if (pedagogyCreative) score += 4;
  if (theorySharedCaribe) score += 2;

  return score;
}

function semanticBridgeLabels(roleA, roleB, shared, sharedTokens) {
  const labels = [];
  const theoryCreative = ((roleA.theory || roleA.research) && roleB.creative) || ((roleB.theory || roleB.research) && roleA.creative);
  const pedagogyTool = (roleA.pedagogy && roleB.tool) || (roleB.pedagogy && roleA.tool);
  const researchArticle = ((roleA.research || roleA.data) && roleB.article) || ((roleB.research || roleB.data) && roleA.article);
  const institutionalPair = roleA.institutional && roleB.institutional;
  const creativePair = roleA.creative && roleB.creative;
  const pedagogyCreative = (roleA.pedagogy && roleB.creative) || (roleB.pedagogy && roleA.creative);
  const theorySharedCaribe = theoryCreative && ((shared.domains || []).includes('caribe') || sharedTokens.includes('caribe'));

  if (theoryCreative) labels.push('theory/creative');
  if (pedagogyTool) labels.push('pedagogy/tool');
  if (researchArticle) labels.push('research/article');
  if (institutionalPair) labels.push('institutional');
  if (creativePair) labels.push('creative');
  if (pedagogyCreative) labels.push('pedagogy/creative');
  if (theorySharedCaribe) labels.push('caribe bridge');

  return labels;
}

function inferType(candidate) {
  const roleA = candidate.roleA || {};
  const roleB = candidate.roleB || {};
  const has = field => (candidate.shared[field] || []).length > 0;

  const theoryCreative = ((roleA.theory || roleA.research) && roleB.creative) || ((roleB.theory || roleB.research) && roleA.creative);
  const pedagogyTool = (roleA.pedagogy && roleB.tool) || (roleB.pedagogy && roleA.tool);
  const researchArticle = ((roleA.research || roleA.data) && roleB.article) || ((roleB.research || roleB.data) && roleA.article);
  const institutionalPair = roleA.institutional && roleB.institutional;
  const creativePair = roleA.creative && roleB.creative;
  const pedagogyCreative = (roleA.pedagogy && roleB.creative) || (roleB.pedagogy && roleA.creative);
  const theoryPair = roleA.theory && roleB.theory;

  if (theoryCreative) return 'Teórica';
  if (pedagogyTool) return 'Técnica/Diseño';
  if (researchArticle) return 'Investigativa';
  if (institutionalPair) return 'Institucional';
  if (pedagogyCreative) return 'Curricular';
  if (creativePair) return 'Creativa';
  if (theoryPair || has('theoretical_frameworks')) return 'Epistemológica';
  if (has('technologies')) return 'Técnica/Diseño';
  if (/(emocion|autoconocimiento|socioemoc|acompa[nñ]amiento)/.test(normalizeText(projectStrings(candidate.a).concat(projectStrings(candidate.b)).join(' ')))) return 'Socioemocional';
  if (/(publica|cultural|politica|politica publica|mincultura)/.test(normalizeText(projectStrings(candidate.a).concat(projectStrings(candidate.b)).join(' ')))) return 'Gestión Pública';
  return 'Sinérgica';
}

function inferDirection(candidate, profilesById) {
  const roleA = candidate.roleA || {};
  const roleB = candidate.roleB || {};
  const aScore = sourceRoleScore(profilesById.get(candidate.a.id), roleA);
  const bScore = sourceRoleScore(profilesById.get(candidate.b.id), roleB);

  if ((roleA.theory || roleA.research) && roleB.creative) return [candidate.a.id, candidate.b.id];
  if ((roleB.theory || roleB.research) && roleA.creative) return [candidate.b.id, candidate.a.id];
  if (roleA.pedagogy && roleB.tool) return [candidate.a.id, candidate.b.id];
  if (roleB.pedagogy && roleA.tool) return [candidate.b.id, candidate.a.id];
  if ((roleA.research || roleA.data) && roleB.article) return [candidate.a.id, candidate.b.id];
  if ((roleB.research || roleB.data) && roleA.article) return [candidate.b.id, candidate.a.id];
  if (roleA.institutional && roleB.institutional) {
    if (aScore === bScore) {
      const aName = normalizeText(candidate.a.name || candidate.a.id);
      const bName = normalizeText(candidate.b.name || candidate.b.id);
      return aName <= bName ? [candidate.a.id, candidate.b.id] : [candidate.b.id, candidate.a.id];
    }
    return aScore >= bScore ? [candidate.a.id, candidate.b.id] : [candidate.b.id, candidate.a.id];
  }

  if (Math.abs(aScore - bScore) <= 1.25) {
    const aName = normalizeText(candidate.a.name || candidate.a.id);
    const bName = normalizeText(candidate.b.name || candidate.b.id);
    return aName <= bName ? [candidate.a.id, candidate.b.id] : [candidate.b.id, candidate.a.id];
  }

  return aScore > bScore
    ? [candidate.a.id, candidate.b.id]
    : [candidate.b.id, candidate.a.id];
}

function inferStrength(score) {
  if (score >= 18) return 'Alta';
  if (score >= 11) return 'Media';
  if (score >= 6) return 'Baja';
  return 'Exploratoria';
}

function buildDescription(candidate, fromId, toId) {
  const parts = [];
  const fieldPriority = ['theoretical_frameworks', 'domains', 'themes', 'tags', 'technologies', 'institutions', 'collaborators'];

  fieldPriority.forEach(field => {
    const values = candidate.shared[field] || [];
    if (values.length && parts.length < 2) {
      parts.push(joinList(values.slice(0, 3)));
    }
  });

  const docLabels = candidate.a.__docEvidence?.snippets?.map(item => item.label) || [];
  const otherDocLabels = candidate.b.__docEvidence?.snippets?.map(item => item.label) || [];
  const docNotes = uniq([...docLabels, ...otherDocLabels]).slice(0, 2);

  let summary = parts.length
    ? `Cruce por ${joinList(parts)}.`
    : 'La lectura cruzada de metadatos y notas locales sugiere una relación útil.';

  if (docNotes.length) {
    summary += ` Las notas locales refuerzan el cruce con ${joinList(docNotes)}.`;
  }

  if (fromId && toId) {
    summary += ` Dirección sugerida: ${fromId} -> ${toId}.`;
  }

  return summary;
}

function buildReport({ existingCandidates, newCandidates, profilesById, focusId, top }) {
  const lines = [];
  lines.push('# Research Sync');
  lines.push('');
  lines.push(`- Focus: ${focusId || 'all projects'}`);
  lines.push(`- Existing connections reviewed: ${existingCandidates.length}`);
  lines.push(`- New suggestions reviewed: ${newCandidates.length}`);
  lines.push(`- Output limit: ${top}`);
  lines.push('');

  if (!existingCandidates.length && !newCandidates.length) {
    lines.push('No meaningful connections were found.');
    return lines.join('\n');
  }

  const renderSection = (title, candidates) => {
    if (!candidates.length) return;
    lines.push(`## ${title}`);
    lines.push('');

    candidates.slice(0, top).forEach((candidate, index) => {
      const [fromId, toId] = inferDirection(candidate, profilesById);
      const strength = inferStrength(candidate.score);
      const type = inferType(candidate);
      const fromProject = profilesById.get(fromId).project;
      const toProject = profilesById.get(toId).project;
      const sharedSummary = [];

      ['theoretical_frameworks', 'domains', 'themes', 'tags', 'technologies', 'institutions', 'collaborators'].forEach(field => {
        const values = candidate.shared[field] || [];
        if (values.length) {
          sharedSummary.push(`${field}: ${joinList(values.slice(0, 3))}`);
        }
      });

      if (candidate.sharedMetadataTokens.length) {
        sharedSummary.push(`shared tokens: ${joinList(candidate.sharedMetadataTokens.slice(0, 6))}`);
      }

      const docFiles = uniq([
        ...(profilesById.get(fromId).docEvidence.snippets || []).map(item => item.label),
        ...(profilesById.get(toId).docEvidence.snippets || []).map(item => item.label),
      ]).slice(0, 2);

      lines.push(`### ${index + 1}. ${fromProject.name || fromProject.id} -> ${toProject.name || toProject.id}`);
      lines.push(`- Type: ${type}`);
      lines.push(`- Strength: ${strength} (${candidate.score.toFixed(1)})`);
      lines.push(`- From: ${fromId}`);
      lines.push(`- To: ${toId}`);
      lines.push(`- Status: ${candidate.alreadyConnected ? 'Existing connection' : 'New suggestion'}`);
      if (sharedSummary.length) {
        lines.push(`- Shared evidence: ${joinList(sharedSummary)}`);
      }
      if (docFiles.length) {
        lines.push(`- Local notes: ${joinList(docFiles)}`);
      }
      lines.push(`- Draft description: ${buildDescription(candidate, fromId, toId)}`);
      lines.push('');
    });
  };

  if (existingCandidates.length) {
    renderSection('Existing Connections to Strengthen', existingCandidates);
  }

  if (newCandidates.length) {
    renderSection('New Suggestions', newCandidates);
  }

  return lines.join('\n');
}

function existingConnectionKeys(connectionsData) {
  const keys = new Set();
  (connectionsData.connections || []).forEach(conn => {
    const from = String(conn.from || conn.source || '').trim();
    const to = String(conn.to || conn.target || '').trim();
    if (from && to) {
      keys.add(canonicalPairKey(from, to));
    }
  });
  return keys;
}

function applyCandidates(connectionsData, candidates, profilesById) {
  const existingKeys = existingConnectionKeys(connectionsData);
  const existing = Array.isArray(connectionsData.connections) ? connectionsData.connections.slice() : [];
  let added = 0;

  candidates.forEach(candidate => {
    if (candidate.score < 11 || candidate.alreadyConnected) return;
    const [fromId, toId] = inferDirection(candidate, profilesById);
    const pairKey = canonicalPairKey(fromId, toId);
    if (existingKeys.has(pairKey)) return;

    const type = inferType(candidate);
    const strength = inferStrength(candidate.score);
    const connection = {
      from: fromId,
      to: toId,
      type,
      strength,
      description: buildDescription(candidate, fromId, toId),
      source: 'research-sync',
      evidence: {
        score: Number(candidate.score.toFixed(2)),
        shared_fields: candidate.shared,
        shared_metadata_tokens: candidate.sharedMetadataTokens.slice(0, 20),
        shared_document_tokens: candidate.sharedDocTokens.slice(0, 20),
      },
    };

    existing.push(connection);
    existingKeys.add(pairKey);
    added += 1;
  });

  const nextConnections = {
    ...connectionsData,
    connections: existing.sort((a, b) => {
      const aKey = canonicalPairKey(String(a.from || a.source || ''), String(a.to || a.target || ''));
      const bKey = canonicalPairKey(String(b.from || b.source || ''), String(b.to || b.target || ''));
      return aKey.localeCompare(bKey);
    }),
  };

  return { nextConnections, added };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projects = loadProjects();
  const connectionsData = loadConnections();
  const existingKeys = existingConnectionKeys(connectionsData);
  const profilesById = new Map();
  const documentsRoot = expandHome(args.docsRoot);

  projects.forEach(project => {
    const profile = buildProjectProfile(project, documentsRoot);
    project.__docEvidence = profile.docEvidence;
    profilesById.set(project.id, profile);
  });

  const focusProjectIds = args.focus
    ? projects.filter(project => project.id === args.focus).map(project => project.id)
    : projects.map(project => project.id);

  const existingCandidates = [];
  const newCandidates = [];
  const seenCandidateKeys = new Set();

  const addCandidate = candidate => {
    if (!candidate || seenCandidateKeys.has(candidate.pairKey)) return;
    seenCandidateKeys.add(candidate.pairKey);
    if (candidate.alreadyConnected) {
      if (candidate.score >= 4) existingCandidates.push(candidate);
      return;
    }
    if (candidate.score >= (args.focus ? 6 : 8)) {
      newCandidates.push(candidate);
    }
  };

  if (args.focus) {
    const focusId = focusProjectIds[0];
    const focusProfile = profilesById.get(focusId);
    if (focusProfile) {
      projects.forEach(other => {
        if (other.id === focusId) return;
        const otherProfile = profilesById.get(other.id);
        addCandidate(scorePair(focusProfile, otherProfile, existingKeys));
      });
    }
  } else {
    for (let i = 0; i < projects.length; i += 1) {
      for (let j = i + 1; j < projects.length; j += 1) {
        const aProfile = profilesById.get(projects[i].id);
        const bProfile = profilesById.get(projects[j].id);
        addCandidate(scorePair(aProfile, bProfile, existingKeys));
      }
    }
  }

  existingCandidates.sort((a, b) => b.score - a.score || a.a.id.localeCompare(b.a.id) || a.b.id.localeCompare(b.b.id));
  newCandidates.sort((a, b) => b.score - a.score || a.a.id.localeCompare(b.a.id) || a.b.id.localeCompare(b.b.id));

  const report = buildReport({
    existingCandidates,
    newCandidates,
    profilesById,
    focusId: args.focus,
    top: args.top,
  });

  if (args.report) {
    fs.writeFileSync(args.report, `${report}\n`, 'utf8');
  }

  if (args.apply) {
    const { nextConnections, added } = applyCandidates(connectionsData, newCandidates, profilesById);
    if (added > 0) {
      writeJson(CONNECTIONS_PATH, nextConnections);
      if (fs.existsSync(UI_CONNECTIONS_PATH)) {
        writeJson(UI_CONNECTIONS_PATH, nextConnections);
      }
    }
    console.log(`Applied ${added} new connection${added === 1 ? '' : 's'}.\n`);
  }

  console.log(report);
}

main();

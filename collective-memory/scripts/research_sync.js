#!/usr/bin/env node
/**
 * /memoria research-sync
 *
 * Scores likely connections between project cards using:
 * - shared metadata fields (tags, domains, themes, frameworks, etc.)
 * - document text found under the project's path, including .md and .docx prose
 * - local markdown notes in the collective-memory workspace
 * - optional LLM prose rewriting with a deterministic local fallback
 *
 * By default this is a dry run that prints a markdown report.
 * Pass --apply to write validated suggestions back into connections.json.
 */

const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const UI_DIR = path.join(ROOT_DIR, '..', 'collective-memory-ui');
const PROJECTS_DIR = path.join(ROOT_DIR, 'projects');
const CONNECTIONS_PATH = path.join(ROOT_DIR, 'connections.json');
const UI_CONNECTIONS_PATH = path.join(UI_DIR, 'public', 'data', 'connections.json');
const DEFAULT_DOCS_ROOTS = getDefaultDocsRoots();

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

const SHARED_FIELD_LABELS = {
  theoretical_frameworks: 'marcos teóricos',
  domains: 'áreas',
  themes: 'temas',
  tags: 'etiquetas',
  technologies: 'tecnologías',
  institutions: 'instituciones',
  collaborators: 'colaboradores',
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

const THEORY_MARKERS = [
  'marco teórico',
  'marco conceptual',
  'fenomenología',
  'hermenéutica',
  'semiótica',
  'epistemología',
  'teoría',
  'rumor',
  'chisme',
  'trastienda',
  'goffman',
  'gluckman',
  'elias',
  'caribe',
];

const DATA_MARKERS = [
  'datos',
  'corpus',
  'muestra',
  'dataset',
  'entrevista',
  'registro',
  'fuente',
  'evidencia',
  'base de datos',
  'reuso',
  'reutilización',
  'caso',
  'archivo',
  'archivo fuente',
];

const WEAK_SHARED_TOKENS = new Set([
  'academic',
  'academico',
  'analisis',
  'analysis',
  'article',
  'articulo',
  'current',
  'data',
  'datos',
  'development',
  'desarrollo',
  'document',
  'documento',
  'education',
  'educacion',
  'edtech',
  'estudio',
  'investigation',
  'investigacion',
  'paper',
  'project',
  'proyecto',
  'research',
  'study',
  'web',
  'app',
  'platform',
  'plataforma',
  'software',
  'tool',
  'tools',
  'ui',
  'frontend',
  'management',
  'gestion',
  'institutional',
  'institucional',
  'creative',
  'creativo',
  'cultural',
  'pedagogia',
  'pedagogico',
  'pedagogica',
  'technology',
  'tecnologia',
  'public',
  'publica',
  'publico',
  'active',
  'activo',
]);

const PROVENANCE_MARKERS = [
  'co-autoría',
  'coautoría',
  'co autoria',
  'coautor',
  'autoría ajena',
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

const EXISTING_REPORT_THRESHOLD = 20;
const EXISTING_REFRESH_THRESHOLD = 10;
const NEW_CONNECTION_THRESHOLD = 35;
const REFRESH_SCORE_THRESHOLD = 35;

function parseArgs(argv) {
  const args = {
    apply: false,
    focus: null,
    llm: Boolean(process.env.OPENAI_API_KEY),
    llmModel: process.env.OPENAI_NARRATIVE_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    top: 5,
    docsRoot: DEFAULT_DOCS_ROOTS.slice(),
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
    } else if (arg === '--llm') {
      args.llm = true;
    } else if (arg === '--no-llm') {
      args.llm = false;
    } else if (arg === '--llm-model') {
      args.llmModel = argv[++i];
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
    '  --focus <project-id>      Limit analysis to one project; otherwise it runs systemwide across all projects',
    '  --top <n>                 Number of suggestions to show (default: 5)',
    '  --documents-root <path>   Override the default document roots (comma-separated list allowed)',
    '  --report <path>           Write the markdown report to a file',
    '  --llm                      Use OpenAI for prose descriptions when available',
    '  --no-llm                   Force local deterministic prose only',
    '  --llm-model <name>         Override the OpenAI model used for prose generation',
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

function getDefaultDocsRoots(platform = os.platform(), home = os.homedir()) {
  const roots = [];

  if (platform === 'win32') {
    roots.push(path.join(home, 'Documents'));
    roots.push(path.join(home, 'OneDrive', 'Documents'));
    roots.push(path.join(home, 'OneDrive - Personal', 'Documents'));
    roots.push(path.join(home, 'Desktop'));
  } else if (platform === 'darwin') {
    roots.push(path.join(home, 'Documents'));
    roots.push(path.join(home, 'Desktop'));
    roots.push(home);
  } else {
    roots.push(path.join(home, 'Documents'));
    roots.push(path.join(home, 'Desktop'));
    roots.push(home);
  }

  return uniq(roots);
}

function normalizeDocsRoots(docsRoot) {
  const values = Array.isArray(docsRoot) ? docsRoot : [docsRoot];
  return uniq(
    values
      .flatMap(value => String(value || '').split(','))
      .map(value => expandHome(value.trim()))
      .filter(Boolean)
  );
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

function filterMeaningfulSharedTokens(tokens) {
  return uniq(tokens)
    .map(token => String(token || '').trim())
    .filter(token => token.length > 2)
    .filter(token => !WEAK_SHARED_TOKENS.has(token));
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

function normalizePhrase(value) {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

function cleanCitation(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[.;:,]+$/g, '')
    .trim();
}

function matchMarkers(text, markers) {
  const normalized = normalizePhrase(text);
  return uniq(
    markers.filter(marker => normalized.includes(normalizePhrase(marker)))
  );
}

function extractCitationStrings(text) {
  const source = String(text || '');
  const citations = [];
  const patterns = [
    /\b([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'’.-]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'’.-]+){0,3}(?:\s+et al\.)?(?:,\s*|\s+)(?:19|20)\d{2}[a-z]?)\b/g,
    /\(([A-ZÁÉÍÓÚÑ][^()]{0,70}?(?:19|20)\d{2}[a-z]?[^()]*)\)/g,
  ];

  patterns.forEach(pattern => {
    for (const match of source.matchAll(pattern)) {
      const value = cleanCitation(match[1] || match[0]);
      if (value) citations.push(value);
    }
  });

  return uniq(citations);
}

function isHeadingLike(line) {
  return /^#{1,6}\s+/.test(line) || /^\d+(?:\.\d+)*[\).:-]?\s+\S+/.test(line);
}

function extractQuotedPhrases(text) {
  const source = String(text || '');
  const quoted = [];
  const patterns = [
    /"([^"\n]{4,120})"/g,
    /“([^”\n]{4,120})”/g,
    /‘([^’\n]{4,120})’/g,
    /'([^'\n]{4,120})'/g,
  ];

  patterns.forEach(pattern => {
    for (const match of source.matchAll(pattern)) {
      const value = String(match[1] || '').trim();
      if (value) quoted.push(value);
    }
  });

  return uniq(quoted);
}

function collectHighlights(lines, signals) {
  const normalizedSignals = uniq([
    ...(signals.citations || []),
    ...(signals.theoryTerms || []),
    ...(signals.dataTerms || []),
    ...(signals.provenanceTerms || []),
    ...(signals.headings || []),
    ...(signals.quotedPhrases || []),
  ]).map(value => normalizePhrase(value));

  const highlights = [];
  const bodyHighlights = [];

  lines.forEach(line => {
    const normalizedLine = normalizePhrase(line);
    if (!normalizedLine) return;

    const matched = normalizedSignals.some(signal => signal && normalizedLine.includes(signal));
    if (matched) {
      const cleaned = line
        .replace(/[*_`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const narrativeSnippet = cleanNarrativeSnippet(cleaned);
      if (!narrativeSnippet) return;
      highlights.push(narrativeSnippet);
      if (!isHeadingLike(cleaned)) {
        bodyHighlights.push(narrativeSnippet);
      }
    }
  });

  const preferred = bodyHighlights.length ? bodyHighlights : highlights;
  return uniq(preferred).slice(0, 6);
}

function extractDocumentSignals(text) {
  const source = String(text || '');
  const lines = source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const citations = extractCitationStrings(source);
  const theoryTerms = matchMarkers(source, THEORY_MARKERS);
  const dataTerms = matchMarkers(source, DATA_MARKERS);
  const provenanceTerms = matchMarkers(source, PROVENANCE_MARKERS);
  const headings = uniq(lines.filter(isHeadingLike).map(line => line.replace(/^#{1,6}\s+/, '').trim()))
    .map(cleanNarrativeSnippet)
    .filter(Boolean);
  const quotedPhrases = extractQuotedPhrases(source)
    .map(cleanNarrativeSnippet)
    .filter(Boolean);
  const keyPhrases = uniq([
    ...theoryTerms,
    ...dataTerms,
    ...provenanceTerms,
    ...headings,
    ...quotedPhrases,
  ])
    .map(cleanNarrativeSnippet)
    .filter(Boolean);

  return {
    citations,
    theoryTerms,
    dataTerms,
    provenanceTerms,
    headings,
    quotedPhrases,
    keyPhrases,
    highlights: collectHighlights(lines, {
      citations,
      theoryTerms,
      dataTerms,
      headings,
      quotedPhrases,
    }),
  };
}

function mergeSignals(target, source) {
  Object.keys(target).forEach(key => {
    if (!(key in source)) return;
    target[key] = uniq([...(target[key] || []), ...(source[key] || [])]);
  });
  return target;
}

function sharedSignalDetails(signalsA, signalsB) {
  const fields = ['citations', 'theoryTerms', 'dataTerms', 'provenanceTerms', 'headings', 'quotedPhrases', 'keyPhrases'];
  return fields.reduce((acc, field) => {
    const a = new Set(signalsA[field] || []);
    const b = new Set(signalsB[field] || []);
    acc[field] = setIntersection(a, b);
    return acc;
  }, {});
}

function safePreview(value, limit = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trim()}…`;
}

function isNoisyNarrativeSnippet(value) {
  const text = normalizePhrase(value);
  if (!text) return true;
  if (text.includes('ruta objetivo') || text.includes('base teorica inyectada')) return true;
  return /(?:^|[^\w])(?:~\/|\/users\/|c:\\|[a-z]:\\|\/documents\/|onedrive\/)/i.test(String(value || ''));
}

function cleanNarrativeSnippet(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  text = text
    .replace(/\s+y\s+pasajes?\s+como\s+Ruta Objetivo:\s*[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Ruta Objetivo:\s*[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Base Te[oó]rica Inyectada:\s*[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[,;]\s*([,;])/g, '$1')
    .replace(/^[,.;:!?]+\s*/, '')
    .trim();

  return isNoisyNarrativeSnippet(text) ? '' : text;
}

function buildConnectionContext(candidate, fromId, toId, profilesById) {
  const fromProfile = profilesById.get(fromId);
  const toProfile = profilesById.get(toId);
  const fromProject = fromProfile.project;
  const toProject = toProfile.project;
  const fromDocEvidence = fromProfile.docEvidence || { snippets: [] };
  const toDocEvidence = toProfile.docEvidence || { snippets: [] };
  const meaningfulTokens = filterMeaningfulSharedTokens(candidate.sharedMetadataTokens || []);

  const sharedSummary = [];
  ['theoretical_frameworks', 'domains', 'themes', 'tags', 'technologies', 'institutions', 'collaborators'].forEach(field => {
    const values = candidate.shared[field] || [];
    if (values.length) {
      sharedSummary.push(`${SHARED_FIELD_LABELS[field] || field}: ${joinList(values.slice(0, 3))}`);
    }
  });

  if (meaningfulTokens.length) {
    sharedSummary.push(`palabras compartidas: ${joinList(meaningfulTokens.slice(0, 4))}`);
  }

  const docFiles = uniq([
    ...(fromDocEvidence.snippets || []).map(item => item.label),
    ...(toDocEvidence.snippets || []).map(item => item.label),
  ]).slice(0, 3);

  const docSignals = sharedSignalDetails(fromProfile.docSignals || {}, toProfile.docSignals || {});
  const docHighlights = uniq([
    ...((fromDocEvidence.snippets || []).flatMap(item => item.highlights || [])),
    ...((toDocEvidence.snippets || []).flatMap(item => item.highlights || [])),
  ])
    .map(cleanNarrativeSnippet)
    .filter(Boolean)
    .slice(0, 4);

  return {
    candidate,
    fromId,
    toId,
    fromName: fromProject.name || fromProject.id,
    toName: toProject.name || toProject.id,
    type: inferType(candidate),
    strength: inferStrength(candidate.score),
    score: Number(candidate.score.toFixed(1)),
    sharedSummary,
    docFiles,
    docSignals,
    docHighlights,
    relationDirection: `${fromId} -> ${toId}`,
  };
}

function buildLocalDescription(context) {
  const clauses = [];
  const hasStrongSharedSignals = context.sharedSummary.length > 0;
  const hasDocumentSignals = Boolean(
    context.docSignals.citations.length ||
    context.docSignals.theoryTerms.length ||
    context.docSignals.dataTerms.length ||
    context.docSignals.provenanceTerms.length ||
    context.docSignals.quotedPhrases.length ||
    context.docHighlights.length
  );

  const lead = hasStrongSharedSignals
    ? `La relación entre ${context.fromName} y ${context.toName} se apoya en ${context.sharedSummary.slice(0, 2).join('; ')}.`
    : hasDocumentSignals
      ? `La relación entre ${context.fromName} y ${context.toName} se entiende mejor por las señales que repiten sus textos.`
      : `La relación entre ${context.fromName} y ${context.toName} sigue siendo exploratoria y todavía no muestra una base compartida fuerte.`;
  clauses.push(lead);

  const docBits = [];
  if (context.docSignals.citations.length) {
    docBits.push(`citas como ${joinList(context.docSignals.citations.slice(0, 2))}`);
  }
  if (context.docSignals.theoryTerms.length) {
    docBits.push(`matrices teóricas como ${joinList(context.docSignals.theoryTerms.slice(0, 2))}`);
  }
  if (context.docSignals.dataTerms.length) {
    docBits.push(`reuso de datos y corpus compartidos`);
  }
  if (context.docSignals.provenanceTerms.length) {
    docBits.push(`marcas de procedencia como ${joinList(context.docSignals.provenanceTerms.slice(0, 2))}`);
  }
  if (context.docHighlights.length) {
    docBits.push(`pasajes como ${safePreview(joinList(context.docHighlights.slice(0, 2)), 90)}`);
  }

  if (docBits.length) {
    clauses.push(`En los textos aparecen ${joinList(docBits)}.`);
  }

  if (context.docSignals.provenanceTerms.length || context.docSignals.citations.length || context.docSignals.quotedPhrases.length) {
    clauses.push('Si hay citas o material de terceros, conviene separarlos de la voz principal antes de atribuirlos al perfil central.');
  }

  clauses.push(`La lectura sugerida va de ${context.fromName} hacia ${context.toName}, porque el vínculo parece acumulativo y no accidental.`);
  return clauses.join(' ');
}

async function postJson(urlString, body, headers = {}) {
  if (typeof fetch === 'function') {
    const response = await fetch(urlString, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || response.statusText || `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  }

  return new Promise((resolve, reject) => {
    const target = new URL(urlString);
    const request = https.request(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...headers,
        },
      },
      response => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', chunk => {
          raw += chunk;
        });
        response.on('end', () => {
          let payload = {};
          try {
            payload = raw ? JSON.parse(raw) : {};
          } catch (error) {
            reject(error);
            return;
          }
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve(payload);
          } else {
            reject(new Error(payload?.error?.message || response.statusMessage || `HTTP ${response.statusCode}`));
          }
        });
      }
    );

    request.on('error', reject);
    request.write(JSON.stringify(body));
    request.end();
  });
}

function buildLLMPrompt(context) {
  return [
    'Escribe una justificación clara, natural y precisa en español para una conexión entre dos proyectos.',
    'Devuelve solo JSON con la forma {"description":"..."} y nada más.',
    'La descripción debe tener entre 2 y 4 oraciones, sonar orgánica y explicar el vínculo como una continuidad de trabajo, no como una etiqueta técnica.',
    'Prioriza teoría compartida, citas, reutilización de datos, vocabulario repetido y señales de prosa real antes que simples listas de campos.',
    'Si aparecen citas, coautorías o marcas de procedencia, trátalas como material de terceros o coautoría y no como autoría principal del perfil.',
    'Evita frases administrativas como "cruce por", "shared evidence" o "notas locales", y no uses nombres de campos internos como theoretical_frameworks o shared tokens.',
    'Cuando haga falta, traduce las señales a expresiones humanas como "marcos teóricos", "palabras compartidas" o "tecnologías compartidas".',
    `Proyecto origen: ${context.fromName} (${context.fromId})`,
    `Proyecto destino: ${context.toName} (${context.toId})`,
    `Tipo sugerido: ${context.type}`,
    `Fuerza sugerida: ${context.strength}`,
    `Evidencia compartida: ${context.sharedSummary.length ? context.sharedSummary.join(' | ') : 'sin metadatos compartidos fuertes'}`,
    `Rastros documentales: ${(context.docSignals.keyPhrases || []).map(cleanNarrativeSnippet).filter(Boolean).slice(0, 6).join(' | ') || 'sin señales textuales fuertes'}`,
    `Citas detectadas: ${context.docSignals.citations.length ? context.docSignals.citations.join(' | ') : 'ninguna'}`,
    `Procedencia: ${context.docSignals.provenanceTerms.length ? context.docSignals.provenanceTerms.join(' | ') : 'ninguna señal explícita de terceros'}`,
    `Pasajes o notas: ${context.docHighlights.length ? context.docHighlights.join(' | ') : 'ninguno'}`,
    `Dirección: ${context.relationDirection}`,
    'La respuesta debe explicar por qué el vínculo es orgánico, legible y defendible a nivel narrativo.',
  ].join('\n');
}

async function buildLLMDescription(context, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const payload = {
    model,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Eres un editor narrativo que transforma evidencia de investigación en justificaciones claras y naturales.',
      },
      {
        role: 'user',
        content: buildLLMPrompt(context),
      },
    ],
  };

  const response = await postJson('https://api.openai.com/v1/chat/completions', payload, {
    authorization: `Bearer ${apiKey}`,
  });

  const content = response?.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    const description = String(parsed.description || '').trim();
    return description || null;
  } catch {
    return null;
  }
}

async function resolveConnectionNarrative(candidate, fromId, toId, profilesById, options = {}, cache = new Map()) {
  const cacheKey = `${candidate.pairKey || canonicalPairKey(fromId, toId)}::${options.llm ? 'llm' : 'local'}::${options.llmModel || ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const context = buildConnectionContext(candidate, fromId, toId, profilesById);
  let description = buildLocalDescription(context);
  let descriptionMode = 'local';

  if (options.llm) {
    try {
      const llmDescription = await buildLLMDescription(context, options.llmModel);
      if (llmDescription) {
        description = llmDescription;
        descriptionMode = 'llm';
      }
    } catch {
      descriptionMode = 'local';
    }
  }

  const narrative = {
    ...context,
    description,
    descriptionMode,
  };

  cache.set(cacheKey, narrative);
  return narrative;
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
  const expandedDocsRoots = normalizeDocsRoots(docsRoot || DEFAULT_DOCS_ROOTS);
  const expandedDocsRootSet = new Set(expandedDocsRoots);

  const explicitPath = expandHome(project.path || '');
  if (explicitPath && fs.existsSync(explicitPath)) {
    const explicitStats = fs.statSync(explicitPath);
    if (explicitStats.isFile()) {
      const ext = path.extname(explicitPath).toLowerCase();
      if (['.md', '.txt', '.docx'].includes(ext)) {
        seen.add(explicitPath);
        candidates.push({ filePath: explicitPath, score: 20 });
      }
    } else {
      pathsToCheck.push(explicitPath);
    }
  }

  const localNotesRoot = ROOT_DIR;
  if (fs.existsSync(localNotesRoot)) {
    pathsToCheck.push(localNotesRoot);
  }

  expandedDocsRoots.forEach(root => {
    if (fs.existsSync(root)) {
      pathsToCheck.push(root);
    }
  });

  pathsToCheck.forEach(root => {
    const allowedExtensions = root === localNotesRoot ? ['.md'] : ['.md', '.txt', '.docx'];
    const maxDepth = expandedDocsRootSet.has(root) ? 3 : 2;
    const limit = expandedDocsRootSet.has(root) ? 24 : 12;
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
  const aggregatedSignals = {
    citations: [],
    theoryTerms: [],
    dataTerms: [],
    headings: [],
    quotedPhrases: [],
    keyPhrases: [],
  };

  files.forEach(filePath => {
    const text = readDocumentText(filePath).slice(0, 12000);
    if (!text) return;
    const fileTokens = tokenize(text);
    const signals = extractDocumentSignals(text);
    fileTokens.forEach(token => tokens.add(token));
    mergeSignals(aggregatedSignals, signals);
    snippets.push({
      filePath,
      label: fileLabel(filePath),
      text,
      tokens: fileTokens,
      signals,
      highlights: signals.highlights,
    });
  });

  return {
    files,
    snippets,
    tokens,
    signals: aggregatedSignals,
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
    docSignals: docEvidence.signals,
    combinedTokens,
    roleFlags,
  };
}

function setIntersection(a, b) {
  const out = [];
  const left = a instanceof Set ? a : new Set(a || []);
  const right = b instanceof Set ? b : new Set(b || []);
  left.forEach(value => {
    if (right.has(value)) out.push(value);
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
  const sharedDocSignals = sharedSignalDetails(profileA.docSignals || {}, profileB.docSignals || {});
  const meaningfulSharedTokens = filterMeaningfulSharedTokens(sharedMetadataTokens);

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

  if (meaningfulSharedTokens.length) {
    const tokenScore = Math.min(4, meaningfulSharedTokens.length * 0.75);
    score += tokenScore;
    signals.push({
      field: 'metadata_tokens',
      values: meaningfulSharedTokens.slice(0, 8),
      weight: tokenScore,
    });
  } else if (sharedMetadataTokens.length) {
    const tokenScore = Math.min(1, sharedMetadataTokens.length * 0.15);
    score += tokenScore;
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

  if (sharedDocSignals.citations.length) {
    const citationScore = Math.min(8, sharedDocSignals.citations.length * 2.5);
    score += citationScore;
    signals.push({
      field: 'document_citations',
      values: sharedDocSignals.citations.slice(0, 5),
      weight: citationScore,
    });
  }

  if (sharedDocSignals.theoryTerms.length) {
    const theoryScore = Math.min(6, sharedDocSignals.theoryTerms.length * 1.75);
    score += theoryScore;
    signals.push({
      field: 'document_theory_terms',
      values: sharedDocSignals.theoryTerms.slice(0, 5),
      weight: theoryScore,
    });
  }

  if (sharedDocSignals.dataTerms.length) {
    const dataScore = Math.min(4, sharedDocSignals.dataTerms.length * 1.5);
    score += dataScore;
    signals.push({
      field: 'document_data_terms',
      values: sharedDocSignals.dataTerms.slice(0, 5),
      weight: dataScore,
    });
  }

  if (sharedDocSignals.provenanceTerms.length) {
    const provenanceScore = Math.min(3, sharedDocSignals.provenanceTerms.length * 1.5);
    score += provenanceScore;
    signals.push({
      field: 'document_provenance_terms',
      values: sharedDocSignals.provenanceTerms.slice(0, 5),
      weight: provenanceScore,
    });
  }

  if (sharedDocSignals.headings.length) {
    const headingScore = Math.min(3, sharedDocSignals.headings.length * 1.1);
    score += headingScore;
    signals.push({
      field: 'document_headings',
      values: sharedDocSignals.headings.slice(0, 5),
      weight: headingScore,
    });
  }

  if (sharedDocSignals.keyPhrases.length) {
    const phraseScore = Math.min(5, sharedDocSignals.keyPhrases.length * 0.75);
    score += phraseScore;
    signals.push({
      field: 'document_phrases',
      values: sharedDocSignals.keyPhrases.slice(0, 6),
      weight: phraseScore,
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
    sharedDocSignals,
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

async function buildReport({ existingCandidates, newCandidates, profilesById, focusId, scopeLabel, top, narrativeCache, llm, llmModel }) {
  const lines = [];
  lines.push('# Research Sync');
  lines.push('');
  lines.push(`- Scope: ${scopeLabel || 'Systemwide (all projects)'}`);
  lines.push(`- Focus: ${focusId || 'none'}`);
  lines.push(`- Existing connections reviewed: ${existingCandidates.length}`);
  lines.push(`- New suggestions reviewed: ${newCandidates.length}`);
  lines.push(`- Output limit: ${top}`);
  lines.push(`- Narrative mode: ${llm ? `LLM (${llmModel}) with local fallback` : 'local deterministic fallback'}`);
  lines.push('');

  if (!existingCandidates.length && !newCandidates.length) {
    lines.push('No meaningful connections were found.');
    return lines.join('\n');
  }

  const renderSection = async (title, candidates) => {
    if (!candidates.length) return;
    lines.push(`## ${title}`);
    lines.push('');

    for (const [index, candidate] of candidates.slice(0, top).entries()) {
      const [fromId, toId] = inferDirection(candidate, profilesById);
      const fromProject = profilesById.get(fromId).project;
      const toProject = profilesById.get(toId).project;
      const narrative = await resolveConnectionNarrative(
        candidate,
        fromId,
        toId,
        profilesById,
        { llm, llmModel },
        narrativeCache
      );

      lines.push(`### ${index + 1}. ${fromProject.name || fromProject.id} -> ${toProject.name || toProject.id}`);
      lines.push(`- Type: ${narrative.type}`);
      lines.push(`- Strength: ${narrative.strength} (${narrative.score.toFixed(1)})`);
      lines.push(`- From: ${narrative.fromId}`);
      lines.push(`- To: ${narrative.toId}`);
      lines.push(`- Status: ${candidate.alreadyConnected ? 'Existing connection' : 'New suggestion'}`);
      if (narrative.sharedSummary.length) {
        lines.push(`- Shared evidence: ${joinList(narrative.sharedSummary)}`);
      }
      if (narrative.docHighlights.length) {
        lines.push(`- Document evidence: ${joinList(narrative.docHighlights.slice(0, 2))}`);
      }
      lines.push(`- Draft description (${narrative.descriptionMode}): ${narrative.description}`);
      lines.push('');
    }
  };

  if (existingCandidates.length) {
    await renderSection('Existing Connections to Strengthen', existingCandidates);
  }

  if (newCandidates.length) {
    await renderSection('New Suggestions', newCandidates);
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

function sanitizeConnectionDescription(description) {
  return cleanNarrativeSnippet(description);
}

function sanitizeConnectionsData(connectionsData) {
  const originalConnections = Array.isArray(connectionsData?.connections) ? connectionsData.connections : [];
  const nextConnections = originalConnections.map(connection => ({
    ...connection,
    description: sanitizeConnectionDescription(connection?.description),
  }));

  const changed = nextConnections.some((connection, index) => connection.description !== String(originalConnections[index]?.description || '').trim());
  return {
    nextConnections: {
      ...(connectionsData || {}),
      connections: nextConnections,
    },
    changed,
  };
}

function isFallbackDescription(description) {
  const text = normalizeText(description);
  return [
    'la relacion entre',
    'la lectura cruzada',
    'cruce por',
    'la prosa de apoyo',
    'direccion sugerida',
    'shared evidence',
    'notas locales refuerzan',
    'porque el cruce no es accidental',
  ].some(pattern => text.includes(pattern));
}

function shouldRefreshConnection(connection, candidate) {
  const description = String(connection?.description || '').trim();
  if (!description) return true;
  const source = String(connection?.source || '').toLowerCase();
  const mode = String(connection?.description_mode || '').toLowerCase();
  const currentScore = Number(connection?.evidence?.score || 0);
  const candidateScore = Number(candidate?.score || 0);
  const hasFreshDocumentSignals = Boolean(
    (candidate?.sharedDocSignals?.citations || []).length ||
    (candidate?.sharedDocSignals?.theoryTerms || []).length ||
    (candidate?.sharedDocSignals?.dataTerms || []).length ||
    (candidate?.sharedDocSignals?.keyPhrases || []).length
  );
  const fallbackLike = source === 'research-sync' || mode === 'local' || mode === 'llm' || isFallbackDescription(description);

  if (fallbackLike) {
    return candidateScore >= REFRESH_SCORE_THRESHOLD || (candidateScore >= currentScore + 10 && hasFreshDocumentSignals);
  }

  if (description.length < 110) {
    return candidateScore >= REFRESH_SCORE_THRESHOLD || (candidateScore >= currentScore + 10 && hasFreshDocumentSignals);
  }

  if (candidateScore >= currentScore + 10 && hasFreshDocumentSignals) {
    return true;
  }

  return false;
}

async function applyCandidates(connectionsData, candidates, profilesById, options = {}, narrativeCache = new Map()) {
  const existingKeys = existingConnectionKeys(connectionsData);
  const existing = Array.isArray(connectionsData.connections) ? connectionsData.connections.slice() : [];
  const byKey = new Map();
  existing.forEach(connection => {
    const from = String(connection.from || connection.source || '').trim();
    const to = String(connection.to || connection.target || '').trim();
    if (from && to) {
      byKey.set(canonicalPairKey(from, to), connection);
    }
  });
  let added = 0;
  let updated = 0;

  for (const candidate of candidates) {
    if (candidate.alreadyConnected) {
      if (candidate.score < EXISTING_REFRESH_THRESHOLD) continue;
    } else if (candidate.score < NEW_CONNECTION_THRESHOLD) {
      continue;
    }
    const [fromId, toId] = inferDirection(candidate, profilesById);
    const pairKey = canonicalPairKey(fromId, toId);
    const narrative = await resolveConnectionNarrative(candidate, fromId, toId, profilesById, options, narrativeCache);
    if (existingKeys.has(pairKey)) {
      const current = byKey.get(pairKey);
      if (current && shouldRefreshConnection(current, candidate)) {
        current.from = current.from || fromId;
        current.to = current.to || toId;
        current.type = narrative.type;
        current.strength = narrative.strength;
        current.description = narrative.description;
        current.description_mode = narrative.descriptionMode;
        current.source = current.source || 'research-sync';
        current.evidence = {
          ...(current.evidence || {}),
          score: Number(candidate.score.toFixed(2)),
          shared_fields: candidate.shared,
          shared_metadata_tokens: candidate.sharedMetadataTokens.slice(0, 20),
          shared_document_tokens: candidate.sharedDocTokens.slice(0, 20),
          shared_document_signals: candidate.sharedDocSignals,
          document_files: narrative.docFiles,
          document_highlights: narrative.docHighlights,
        };
        updated += 1;
      }
      continue;
    }

    const type = inferType(candidate);
    const strength = inferStrength(candidate.score);
    const connection = {
      from: fromId,
      to: toId,
      type,
      strength,
      description: narrative.description,
      description_mode: narrative.descriptionMode,
      source: 'research-sync',
      evidence: {
        score: Number(candidate.score.toFixed(2)),
        shared_fields: candidate.shared,
        shared_metadata_tokens: candidate.sharedMetadataTokens.slice(0, 20),
        shared_document_tokens: candidate.sharedDocTokens.slice(0, 20),
        shared_document_signals: candidate.sharedDocSignals,
        document_files: narrative.docFiles,
        document_highlights: narrative.docHighlights,
      },
    };

    existing.push(connection);
    existingKeys.add(pairKey);
    added += 1;
  }

  const nextConnections = {
    ...connectionsData,
    connections: existing.sort((a, b) => {
      const aKey = canonicalPairKey(String(a.from || a.source || ''), String(a.to || a.target || ''));
      const bKey = canonicalPairKey(String(b.from || b.source || ''), String(b.to || b.target || ''));
      return aKey.localeCompare(bKey);
    }),
  };

  return { nextConnections, added, updated };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projects = loadProjects();
  const connectionsData = loadConnections();
  const existingKeys = existingConnectionKeys(connectionsData);
  const profilesById = new Map();
  const documentsRoot = normalizeDocsRoots(args.docsRoot);
  const narrativeCache = new Map();

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
      if (candidate.score >= EXISTING_REPORT_THRESHOLD) existingCandidates.push(candidate);
      return;
    }
    if (candidate.score >= NEW_CONNECTION_THRESHOLD) {
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
    scopeLabel: args.focus ? `Project-only (${args.focus})` : 'Systemwide (all projects)',
    top: args.top,
    narrativeCache,
    llm: args.llm,
    llmModel: args.llmModel,
  });

  if (args.report) {
    const renderedReport = await report;
    fs.writeFileSync(args.report, `${renderedReport}\n`, 'utf8');
  }

  if (args.apply) {
    const { nextConnections, added, updated } = await applyCandidates(connectionsData, [...existingCandidates, ...newCandidates], profilesById, {
      llm: args.llm,
      llmModel: args.llmModel,
    }, narrativeCache);
    const { nextConnections: sanitizedConnections, changed: sanitizedChanged } = sanitizeConnectionsData(nextConnections);
    if (added > 0 || updated > 0 || sanitizedChanged) {
      writeJson(CONNECTIONS_PATH, sanitizedConnections);
      if (fs.existsSync(UI_CONNECTIONS_PATH)) {
        writeJson(UI_CONNECTIONS_PATH, sanitizedConnections);
      }
    }
    const updatedMessage = updated > 0 ? `, refreshed ${updated} existing connection${updated === 1 ? '' : 's'}` : '';
    console.log(`Applied ${added} new connection${added === 1 ? '' : 's'}${updatedMessage}.\n`);
  }

  const renderedReport = await report;
  console.log(renderedReport);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  buildConnectionContext,
  buildLocalDescription,
  buildLLMPrompt,
  buildProjectProfile,
  buildReport,
  canonicalPairKey,
  cleanCitation,
  applyCandidates,
  extractCitationStrings,
  extractDocumentSignals,
  gatherDocumentEvidence,
  gatherDocumentFiles,
  getDefaultDocsRoots,
  inferDirection,
  inferStrength,
  inferType,
  loadProjects,
  parseArgs,
  resolveConnectionNarrative,
  scorePair,
  sharedSignalDetails,
  isFallbackDescription,
  shouldRefreshConnection,
};

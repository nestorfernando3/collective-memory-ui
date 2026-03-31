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
const { classifyDocument } = require('./lib/document_classifier.js');
const { buildProjectSignalProfile } = require('./lib/project_signal_profile.js');
const { buildAffinityCandidate } = require('./lib/candidate_affinity.js');
const { buildEvidenceAssessment } = require('./lib/evidence_validator.js');
const { decideConnectionSet } = require('./lib/visibility_policy.js');

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
  'markdown',
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
const STRONG_CONNECTION_THRESHOLD = 30;
const EXPLORATORY_CONNECTION_THRESHOLD = 18;
const COVERAGE_FLOOR_THRESHOLD = 26;

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

function isSubstantiveSharedValue(value) {
  const normalized = normalizePhrase(value);
  if (!normalized) return false;
  if (/^\d+$/.test(normalized)) return false;
  return !WEAK_SHARED_TOKENS.has(normalized);
}

function isSubstantiveSharedSummaryEntry(entry) {
  const normalized = normalizeText(entry);
  if (!normalized) return false;

  const valuePart = normalized.includes(':') ? normalized.split(':').slice(1).join(':').trim() : normalized;
  const tokens = tokenize(valuePart);
  if (!tokens.length) return false;

  return tokens.some(token => !WEAK_SHARED_TOKENS.has(token));
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
  if (
    text.includes('ruta objetivo') ||
    text.includes('base teorica inyectada') ||
    text.includes('archivo vivo de trabajo') ||
    text.includes('este perfil se entiende') ||
    text === 'collective memory pwa' ||
    text.includes('collective memory pwa:') ||
    text.includes('perfil unificado') ||
    text.includes('title:') ||
    text.includes('[bug]') ||
    text.includes('decision operativa') ||
    text.includes('hoja de autoria') ||
    text.includes('datosautoriacolombiainternacional') ||
    text === 'resumen'
  ) {
    return true;
  }
  return /(?:^|[^\w])(?:~\/|\/users\/|c:\\|[a-z]:\\|\/documents\/|onedrive\/)/i.test(String(value || ''));
}

const GENERIC_EVIDENCE_TERMS = new Set([
  'teoria',
  'theory',
  'analisis',
  'analysis',
  'estudio',
  'study',
  'documento',
  'document',
  'archivo',
  'textos',
  'texto',
  'material',
  'contenido',
]);

function filterEvidenceTerms(values) {
  return uniq(Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter(value => !GENERIC_EVIDENCE_TERMS.has(normalizePhrase(value)));
}

function cleanNarrativeSnippet(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  text = text
    .replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, '')
    .replace(/\s+y\s+pasajes?\s+como\s+Ruta Objetivo:\s*[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Ruta Objetivo:\s*[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Base Te[oó]rica Inyectada:\s*[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+En los textos aparecen[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Este perfil se entiende[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Archivo vivo de trabajo[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/(?:^|[.?!]\s+)Collective Memory PWA:\s*[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Perfil unificado[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+La lectura sugerida va de[\s\S]*$/gi, '.')
    .replace(/\s+porque el vínculo parece acumulativo y no accidental\.?/gi, '.')
    .replace(/\s+porque el cruce no es accidental(?: sino orgánico y acumulativo)?\.?/gi, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[,;]\s*([,;])/g, '$1')
    .replace(/^[,.;:!?]+\s*/, '')
    .trim();

  return isNoisyNarrativeSnippet(text) ? '' : text;
}

function isGeneratedMemoryDoc(filePath) {
  return isGeneratedMemoryArtifact(filePath);
}

function isGeneratedMemoryArtifact(filePath, text = '') {
  const base = path.basename(String(filePath || ''));
  const normalizedPath = String(filePath || '').replace(/\\/g, '/');
  const normalizedText = normalizeText(text);
  return (
    /^strengthen_.+\.md$/i.test(base) ||
    /^research-sync-report(?:\s+\d+)?\.md$/i.test(base) ||
    /^(README|PROFILE|STATUS)(?:\s+\d+)?\.md$/i.test(base) &&
      /collective memory|collective-memory/i.test(normalizedPath) ||
    normalizedText.includes('memoria colectiva: fortalecimiento cruzado') ||
    normalizedText.includes('analisis del cruce') ||
    normalizedText.includes('ruta objetivo:') ||
    normalizedText.includes('base teorica inyectada:') ||
    normalizedText.startsWith('# research sync')
  );
}

function isNoisyConnectionDescription(description) {
  const text = normalizePhrase(description);
  if (!text) return false;
  return (
    text.includes('este perfil se entiende') ||
    text.includes('archivo vivo de trabajo') ||
    text.includes('collective memory pwa') ||
    text.includes('perfil unificado') ||
    /\b(?:y|hacia|se apoya en|palabras compartidas)\.?$/.test(text) ||
    /la relacion entre .* y\.?$/.test(text) ||
    /va de .* hacia\.?$/.test(text)
  );
}

function hasStrongDocumentEvidence(docSignals = {}, docHighlights = []) {
  const citations = Array.isArray(docSignals.citations) ? docSignals.citations : [];
  const dataTerms = filterEvidenceTerms(docSignals.dataTerms || []);
  const provenanceTerms = filterEvidenceTerms(docSignals.provenanceTerms || []);
  const quotedPhrases = Array.isArray(docSignals.quotedPhrases) ? docSignals.quotedPhrases : [];
  const headings = Array.isArray(docSignals.headings) ? docSignals.headings : [];
  const substantiveHighlights = uniq(Array.isArray(docHighlights) ? docHighlights : [])
    .map(cleanNarrativeSnippet)
    .filter(Boolean)
    .filter(snippet => !/^(las fuentes|este perfil se entiende|archivo vivo de trabajo|collective memory pwa)/i.test(snippet));

  return Boolean(
    citations.length ||
      provenanceTerms.length ||
      quotedPhrases.length >= 2 ||
      headings.length >= 2 ||
      substantiveHighlights.length >= 2
  );
}

function buildEvidenceBreakdown(candidate = {}) {
  const signals = Array.isArray(candidate.signals) ? candidate.signals : [];

  return signals.reduce((acc, signal) => {
    const weight = Number(signal?.weight || 0);
    const field = String(signal?.field || '');

    if (field.startsWith('document_')) {
      acc.documents += weight;
    } else if (field === 'semantic_bridge') {
      acc.semanticBridge += weight;
    } else if (field === 'explicit_relation') {
      acc.explicitRelation += weight;
    } else {
      acc.metadata += weight;
    }

    return acc;
  }, {
    metadata: 0,
    documents: 0,
    semanticBridge: 0,
    explicitRelation: 0,
    total: Number(Number(candidate.score || 0).toFixed(2)),
  });
}

function hasMetadataAnchor(candidate = {}) {
  const shared = candidate.shared || {};
  const meaningfulTokens = filterMeaningfulSharedTokens(candidate.sharedMetadataTokens || []);

  if (meaningfulTokens.length) return true;

  return ['domains', 'themes', 'tags', 'technologies', 'institutions', 'collaborators', 'outputs']
    .some(field => {
      const values = Array.isArray(shared[field]) ? shared[field] : [];
      return values.some(isSubstantiveSharedValue);
    });
}

function hasDocumentAnchor(candidate = {}, level = 'light') {
  const docSignals = candidate.sharedDocSignals || {};
  const docHighlights = Array.isArray(candidate.docHighlights) ? candidate.docHighlights : [];

  if (level === 'strong') {
    return hasStrongDocumentEvidence(docSignals, docHighlights);
  }

  return Boolean(
    hasStrongDocumentEvidence(docSignals, docHighlights) ||
      (Array.isArray(docSignals.theoryTerms) && docSignals.theoryTerms.length) ||
      (Array.isArray(docSignals.keyPhrases) && filterEvidenceTerms(docSignals.keyPhrases).length >= 2)
  );
}

function hasSemanticAnchor(candidate = {}) {
  const breakdown = buildEvidenceBreakdown(candidate);
  return breakdown.semanticBridge >= 4 || breakdown.explicitRelation >= 10;
}

function classifyConnectionTier(candidate = {}) {
  const breakdown = buildEvidenceBreakdown(candidate);
  const score = Number(candidate.score || 0);
  const metadataAnchor = hasMetadataAnchor(candidate);
  const semanticAnchor = hasSemanticAnchor(candidate);
  const documentAnchor = hasDocumentAnchor(candidate, 'light');
  const strongDocumentAnchor = hasDocumentAnchor(candidate, 'strong');

  if (!hasSufficientConnectionEvidence(candidate)) return 'discarded';

  if (
    score >= STRONG_CONNECTION_THRESHOLD &&
    strongDocumentAnchor &&
    (metadataAnchor || semanticAnchor)
  ) {
    return 'strong';
  }

  if (
    score >= 24 &&
    metadataAnchor &&
    (documentAnchor || semanticAnchor)
  ) {
    return 'exploratory';
  }

  if (
    score >= EXPLORATORY_CONNECTION_THRESHOLD &&
    (documentAnchor || metadataAnchor || semanticAnchor)
  ) {
    return 'exploratory';
  }

  if (
    breakdown.explicitRelation >= 10 &&
    score >= EXPLORATORY_CONNECTION_THRESHOLD &&
    (metadataAnchor || documentAnchor)
  ) {
    return 'exploratory';
  }

  return 'discarded';
}

function applyVisibilityPolicy(candidates = [], projectIds = []) {
  const selected = (Array.isArray(candidates) ? candidates : []).map(candidate => ({
    ...candidate,
    visibility: candidate.tier === 'strong' ? 'default' : 'optional',
    selectionReason: candidate.tier === 'strong' ? 'strong-evidence' : 'exploratory',
  }));

  const visibleCount = new Map((Array.isArray(projectIds) ? projectIds : []).map(projectId => [projectId, 0]));
  selected.forEach(candidate => {
    if (candidate.visibility !== 'default') return;
    visibleCount.set(candidate.from, (visibleCount.get(candidate.from) || 0) + 1);
    visibleCount.set(candidate.to, (visibleCount.get(candidate.to) || 0) + 1);
  });

  for (const projectId of projectIds) {
    if ((visibleCount.get(projectId) || 0) > 0) continue;

    const rescue = selected
      .filter(candidate => candidate.tier === 'exploratory')
      .filter(candidate => candidate.score >= COVERAGE_FLOOR_THRESHOLD)
      .filter(candidate => candidate.from === projectId || candidate.to === projectId)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        const rightBreakdown = buildEvidenceBreakdown(right);
        const leftBreakdown = buildEvidenceBreakdown(left);
        if (rightBreakdown.documents !== leftBreakdown.documents) return rightBreakdown.documents - leftBreakdown.documents;
        if (rightBreakdown.metadata !== leftBreakdown.metadata) return rightBreakdown.metadata - leftBreakdown.metadata;
        return String(left.pairKey || '').localeCompare(String(right.pairKey || ''));
      })[0];

    if (!rescue) continue;

    rescue.visibility = 'default';
    rescue.selectionReason = 'coverage-floor';
    visibleCount.set(rescue.from, (visibleCount.get(rescue.from) || 0) + 1);
    visibleCount.set(rescue.to, (visibleCount.get(rescue.to) || 0) + 1);
  }

  return selected;
}

function buildDocumentEvidenceSentence(docSignals = {}, docHighlights = []) {
  if (docSignals.citations && docSignals.citations.length) {
    return 'Comparten citas o referencias verificables.';
  }

  const theoryTerms = filterEvidenceTerms(docSignals.theoryTerms || []);
  if (theoryTerms.length) {
    return `Comparten un marco conceptual explícito: ${joinList(theoryTerms.slice(0, 2))}.`;
  }

  const dataTerms = filterEvidenceTerms(docSignals.dataTerms || []);
  if (dataTerms.length) {
    return 'Comparten un corpus de trabajo.';
  }

  const provenanceTerms = filterEvidenceTerms(docSignals.provenanceTerms || []);
  if (provenanceTerms.length) {
    return 'Hay marcas de procedencia que conviene separar del texto principal.';
  }

  const highlight = cleanNarrativeSnippet(docHighlights[0] || '');
  if (highlight) {
    return `El pasaje más útil es ${safePreview(highlight, 90)}.`;
  }

  return '';
}

function hasSufficientConnectionEvidence(candidate) {
  if (!candidate) return false;

  const explicitRelation = Array.isArray(candidate.signals)
    && candidate.signals.some(signal => signal && signal.field === 'explicit_relation');

  const shared = candidate.shared || {};
  const strongSharedField = ['domains', 'themes', 'institutions', 'technologies', 'collaborators'].some(field => {
    const values = Array.isArray(shared[field]) ? shared[field] : [];
    return values.some(isSubstantiveSharedValue);
  });
  const strongDocumentSupport = hasStrongDocumentEvidence(candidate.sharedDocSignals || {}, candidate.docHighlights || []);

  if (explicitRelation && (strongSharedField || strongDocumentSupport)) return true;
  if (strongSharedField) return true;
  if (strongDocumentSupport) return true;

  return false;
}

function buildConnectionContext(candidate, fromId, toId, profilesById) {
  const fromProfile = profilesById.get(fromId);
  const toProfile = profilesById.get(toId);
  const fromProject = fromProfile.project;
  const toProject = toProfile.project;
  const fromDocEvidence = fromProfile.docEvidence || { snippets: [] };
  const toDocEvidence = toProfile.docEvidence || { snippets: [] };
  const meaningfulTokens = filterMeaningfulSharedTokens(candidate.sharedMetadataTokens || []);
  const shared = candidate.shared || {};

  const sharedSummary = [];
  ['theoretical_frameworks', 'domains', 'themes', 'tags', 'technologies', 'institutions', 'collaborators'].forEach(field => {
    const values = shared[field] || [];
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
  const documentEvidence = hasStrongDocumentEvidence(docSignals, docHighlights)
    ? buildDocumentEvidenceSentence(docSignals, docHighlights)
    : '';
  const displayScore = Number.isFinite(Number(candidate.score))
    ? Number(candidate.score)
    : Number(candidate.evidenceScore || candidate.affinityScore || 0);

  return {
    candidate,
    tier: candidate.tier || classifyConnectionTier(candidate),
    visibility: candidate.visibility || 'optional',
    selectionReason: candidate.selectionReason || 'exploratory',
    fromId,
    toId,
    fromName: fromProject.name || fromProject.id,
    toName: toProject.name || toProject.id,
    type: inferType(candidate),
    strength: inferStrength(displayScore),
    score: Number(displayScore.toFixed(1)),
    sharedSummary,
    docFiles,
    docSignals,
    docHighlights,
    documentEvidence,
    relationDirection: `${fromId} -> ${toId}`,
  };
}

function buildLocalDescription(context) {
  const clauses = [];
  const hasStrongSharedSignals = context.sharedSummary.some(isSubstantiveSharedSummaryEntry);
  const hasDocumentSignals = Boolean(context.documentEvidence);
  const sharedLead = context.sharedSummary.slice(0, 2).join('; ');
  const tier = context.tier || 'exploratory';

  const lead = tier === 'strong'
    ? hasStrongSharedSignals
      ? `La relación entre ${context.fromName} y ${context.toName} se apoya en ${sharedLead}.`
      : hasDocumentSignals
        ? `La relación entre ${context.fromName} y ${context.toName} se basa en evidencia documental concreta.`
        : `La relación entre ${context.fromName} y ${context.toName} tiene suficiente apoyo para entrar en la capa principal del grafo.`
    : hasStrongSharedSignals
      ? `La relación entre ${context.fromName} y ${context.toName} todavía es tentativa, pero ya muestra señales útiles: ${sharedLead}.`
      : hasDocumentSignals
        ? `La relación entre ${context.fromName} y ${context.toName} tiene evidencia documental, pero todavía no una base compartida clara.`
        : `Por ahora no hay base suficiente para consolidar la relación entre ${context.fromName} y ${context.toName}.`;
  clauses.push(lead);

  if (context.documentEvidence) {
    clauses.push(context.documentEvidence);
  }

  if (context.docSignals.provenanceTerms.length || context.docSignals.citations.length || context.docSignals.quotedPhrases.length) {
    clauses.push('Si hay citas o material de terceros, conviene tratarlos como referencia y no como voz principal.');
  }

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
    'La descripción debe tener entre 2 y 3 oraciones, sonar orgánica y decir con precisión qué comparten y para qué sirve ese cruce.',
    'No uses cierres genéricos como "porque el vínculo parece acumulativo y no accidental" ni frases metadiscursivas como "se entiende mejor por las señales que repiten sus textos".',
    'Evita también fórmulas vagas como "sigue siendo exploratoria" salvo que la evidencia sea realmente insuficiente; en ese caso, dilo de forma breve y directa.',
    'Prioriza teoría compartida, citas, reutilización de datos, vocabulario repetido y señales de prosa real antes que simples listas de campos.',
    'Si aparecen citas, coautorías o marcas de procedencia, trátalas como material de terceros o coautoría y no como autoría principal del perfil.',
    'Evita frases administrativas como "cruce por", "shared evidence" o "notas locales", y no uses nombres de campos internos como theoretical_frameworks o shared tokens.',
    'Cuando haga falta, traduce las señales a expresiones humanas como "marcos conceptuales", "tecnologías compartidas" o "evidencia documental".',
    `Proyecto origen: ${context.fromName} (${context.fromId})`,
    `Proyecto destino: ${context.toName} (${context.toId})`,
    `Tier sugerido: ${context.tier || 'exploratory'}`,
    `Visibilidad sugerida: ${context.visibility || 'optional'}`,
    `Tipo sugerido: ${context.type}`,
    `Fuerza sugerida: ${context.strength}`,
    `Evidencia compartida: ${context.sharedSummary.length ? context.sharedSummary.join(' | ') : 'sin metadatos compartidos fuertes'}`,
    `Rastros documentales: ${(context.docSignals.keyPhrases || []).map(cleanNarrativeSnippet).filter(Boolean).slice(0, 6).join(' | ') || 'sin señales textuales fuertes'}`,
    `Citas detectadas: ${context.docSignals.citations.length ? context.docSignals.citations.join(' | ') : 'ninguna'}`,
    `Procedencia: ${context.docSignals.provenanceTerms.length ? context.docSignals.provenanceTerms.join(' | ') : 'ninguna señal explícita de terceros'}`,
    `Pasajes o notas: ${context.docHighlights.length ? context.docHighlights.join(' | ') : 'ninguno'}`,
    `Dirección: ${context.relationDirection}`,
    'La respuesta debe empezar por la evidencia concreta y terminar con una consecuencia útil o con una nota breve de insuficiencia si no la hay.',
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

function isDemoProject(project) {
  const normalizedPath = String(project?.path || '').replace(/\\/g, '/');
  return normalizedPath.includes('/demo/') || normalizedPath.startsWith('~/demo');
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
      if (isDemoProject(data)) return null;
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

function pruneConnectionsToProjects(connectionsData, allowedProjectIds) {
  const originalConnections = Array.isArray(connectionsData?.connections) ? connectionsData.connections : [];
  const nextConnections = originalConnections.filter(connection => {
    const from = String(connection.from || connection.source || '').trim();
    const to = String(connection.to || connection.target || '').trim();
    return Boolean(from && to && allowedProjectIds.has(from) && allowedProjectIds.has(to));
  });

  return {
    nextConnections: {
      ...(connectionsData || {}),
      connections: nextConnections,
    },
    changed: nextConnections.length !== originalConnections.length,
  };
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
      if (isGeneratedMemoryArtifact(filePath)) return;
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
    if (isGeneratedMemoryArtifact(filePath)) return;
    const text = readDocumentText(filePath).slice(0, 12000);
    if (!text) return;
    if (isGeneratedMemoryArtifact(filePath, text)) return;
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
  const documents = (docEvidence.snippets || []).map(snippet => ({
    ...snippet,
    ...classifyDocument(snippet.filePath, snippet.text),
  }));
  const signalProfile = buildProjectSignalProfile({
    projectId: project.id,
    metadata: metadataFields,
    documents,
  });
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
    documents,
    docTokens,
    docSignals: docEvidence.signals,
    combinedTokens,
    roleFlags,
    signalProfile,
  };
}

function buildV2Candidate(candidate, fromId, toId, profilesById) {
  const fromProfile = profilesById.get(fromId) || {};
  const toProfile = profilesById.get(toId) || {};
  const fromSignalProfile = fromProfile.signalProfile || buildProjectSignalProfile({
    projectId: fromId,
    metadata: fromProfile.metadataFields || {},
    documents: fromProfile.documents || [],
  });
  const toSignalProfile = toProfile.signalProfile || buildProjectSignalProfile({
    projectId: toId,
    metadata: toProfile.metadataFields || {},
    documents: toProfile.documents || [],
  });

  const affinityCandidate = buildAffinityCandidate(fromSignalProfile, toSignalProfile);
  const evidenceAssessment = candidate.evidenceAssessment || buildEvidenceAssessment(fromSignalProfile, toSignalProfile);

  return {
    ...candidate,
    a: candidate.a || fromProfile.project || null,
    b: candidate.b || toProfile.project || null,
    from: fromId,
    to: toId,
    pairKey: candidate.pairKey || canonicalPairKey(fromId, toId),
    roleA: candidate.roleA || (fromProfile.project ? (fromProfile.roleFlags || classifyProjectRole(fromProfile)) : {}),
    roleB: candidate.roleB || (toProfile.project ? (toProfile.roleFlags || classifyProjectRole(toProfile)) : {}),
    affinityScore: Number.isFinite(Number(candidate.affinityScore))
      ? Number(candidate.affinityScore)
      : Number(affinityCandidate.affinityScore || 0),
    evidenceScore: Number.isFinite(Number(candidate.evidenceScore))
      ? Number(candidate.evidenceScore)
      : Number(evidenceAssessment.evidenceScore || 0),
    evidenceAssessment,
    score: Number.isFinite(Number(candidate.score))
      ? Number(candidate.score)
      : Number(affinityCandidate.affinityScore || 0) + Number(evidenceAssessment.evidenceScore || 0),
  };
}

function buildV2SeedCandidate(fromProfile, toProfile, existingKeys) {
  const fromId = String(fromProfile?.project?.id || '').trim();
  const toId = String(toProfile?.project?.id || '').trim();
  const pairKey = canonicalPairKey(fromId, toId);
  const leftSignalProfile = fromProfile.signalProfile || buildProjectSignalProfile({
    projectId: fromId,
    metadata: fromProfile.metadataFields || {},
    documents: fromProfile.documents || [],
  });
  const rightSignalProfile = toProfile.signalProfile || buildProjectSignalProfile({
    projectId: toId,
    metadata: toProfile.metadataFields || {},
    documents: toProfile.documents || [],
  });
  const affinityCandidate = buildAffinityCandidate(leftSignalProfile, rightSignalProfile);
  const evidenceAssessment = buildEvidenceAssessment(leftSignalProfile, rightSignalProfile);

  return {
    a: fromProfile.project || null,
    b: toProfile.project || null,
    from: fromId,
    to: toId,
    pairKey,
    alreadyConnected: existingKeys instanceof Set ? existingKeys.has(pairKey) : false,
    shared: affinityCandidate.shared || {},
    sharedMetadataTokens: setIntersection(fromProfile.metadataTokens || [], toProfile.metadataTokens || []),
    sharedDocTokens: setIntersection(fromProfile.docTokens || [], toProfile.docTokens || []),
    sharedDocSignals: sharedSignalDetails(fromProfile.docSignals || {}, toProfile.docSignals || {}),
    roleA: fromProfile.project ? (fromProfile.roleFlags || classifyProjectRole(fromProfile)) : {},
    roleB: toProfile.project ? (toProfile.roleFlags || classifyProjectRole(toProfile)) : {},
    affinityScore: Number(affinityCandidate.affinityScore || 0),
    evidenceScore: Number(evidenceAssessment.evidenceScore || 0),
    evidenceAssessment,
    score: Number(affinityCandidate.affinityScore || 0) + Number(evidenceAssessment.evidenceScore || 0),
  };
}

function buildV2CandidateQueue(projects = [], profilesById, existingKeys = new Set(), focusId = null) {
  const queue = [];
  const projectList = Array.isArray(projects) ? projects : [];

  if (focusId) {
    const focusProfile = profilesById.get(focusId);
    if (!focusProfile) return queue;

    projectList.forEach(project => {
      if (!project || project.id === focusId) return;
      const otherProfile = profilesById.get(project.id);
      if (!otherProfile) return;
      queue.push(buildV2SeedCandidate(focusProfile, otherProfile, existingKeys));
    });
    return queue;
  }

  for (let i = 0; i < projectList.length; i += 1) {
    for (let j = i + 1; j < projectList.length; j += 1) {
      const leftProfile = profilesById.get(projectList[i].id);
      const rightProfile = profilesById.get(projectList[j].id);
      if (!leftProfile || !rightProfile) continue;
      queue.push(buildV2SeedCandidate(leftProfile, rightProfile, existingKeys));
    }
  }

  return queue;
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
  const shared = candidate.shared || {};
  const has = field => (shared[field] || []).length > 0;

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
      if (narrative.documentEvidence) {
        lines.push(`- Document evidence: ${narrative.documentEvidence}`);
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
  if (isNoisyConnectionDescription(description)) return true;
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

  if (fallbackLike && currentScore <= 15) {
    return true;
  }

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
  const allConnections = Array.isArray(connectionsData.connections) ? connectionsData.connections.slice() : [];
  const preservedConnections = [];
  const generatedConnections = [];
  const generatedByKey = new Map();
  const preservedPairKeys = new Set();

  allConnections.forEach(connection => {
    const from = String(connection.from || connection.source || '').trim();
    const to = String(connection.to || connection.target || '').trim();
    if (!from || !to) return;
    const pairKey = canonicalPairKey(from, to);
    if (String(connection.source || '').trim().toLowerCase() === 'research-sync') {
      generatedConnections.push(connection);
      generatedByKey.set(pairKey, connection);
      return;
    }
    preservedConnections.push(connection);
    preservedPairKeys.add(pairKey);
  });

  const v2Candidates = (Array.isArray(candidates) ? candidates : [])
    .map(candidate => {
      const fromId = String(candidate.from || candidate.a?.id || '').trim();
      const toId = String(candidate.to || candidate.b?.id || '').trim();
      const directed = fromId && toId ? [fromId, toId] : inferDirection(candidate, profilesById);
      const [resolvedFromId, resolvedToId] = directed;
      return buildV2Candidate(candidate, resolvedFromId, resolvedToId, profilesById);
    });

  const selectedCandidates = decideConnectionSet(
    v2Candidates,
    Array.from(profilesById.keys()),
  ).filter(candidate => candidate.tier !== 'discarded');

  let added = 0;
  let updated = 0;
  let removed = 0;
  const nextGenerated = [];
  const seenGeneratedPairs = new Set();

  for (const candidate of selectedCandidates) {
    if (preservedPairKeys.has(candidate.pairKey)) {
      continue;
    }

    const fromId = String(candidate.from || '').trim();
    const toId = String(candidate.to || '').trim();
    const pairKey = canonicalPairKey(fromId, toId);
    if (seenGeneratedPairs.has(pairKey)) continue;
    seenGeneratedPairs.add(pairKey);
    const narrative = await resolveConnectionNarrative(candidate, fromId, toId, profilesById, options, narrativeCache);
    const type = inferType(candidate);
    const strength = inferStrength(candidate.score);
    const current = generatedByKey.get(pairKey);
    const evidenceAssessment = candidate.evidenceAssessment || buildEvidenceAssessment(
      profilesById.get(fromId)?.signalProfile || {},
      profilesById.get(toId)?.signalProfile || {},
    );
    const legacyScore = Number.isFinite(Number(candidate.score))
      ? Number(candidate.score)
      : Number(candidate.evidenceScore || 0);
    const connection = {
      from: fromId,
      to: toId,
      type,
      strength,
      description: narrative.description,
      description_mode: narrative.descriptionMode,
      source: 'research-sync',
      tier: candidate.tier,
      visibility: candidate.visibility,
      selection_reason: candidate.selectionReason,
      decision: {
        affinity_score: Number(candidate.affinityScore || 0),
        evidence_score: Number(candidate.evidenceScore || 0),
        coverage_promoted: candidate.selectionReason === 'coverage-floor',
        review_flag: candidate.tier === 'review',
      },
      evidence: {
        score: Number(legacyScore.toFixed(2)),
        breakdown: evidenceAssessment.breakdown,
        fragments: evidenceAssessment.fragments,
        shared_fields: candidate.shared,
        shared_metadata_tokens: Array.isArray(candidate.sharedMetadataTokens) ? candidate.sharedMetadataTokens.slice(0, 20) : [],
        shared_document_tokens: Array.isArray(candidate.sharedDocTokens) ? candidate.sharedDocTokens.slice(0, 20) : [],
        shared_document_signals: candidate.sharedDocSignals,
        document_files: narrative.docFiles,
        document_highlights: narrative.docHighlights,
      },
    };

    if (current) {
      updated += 1;
    } else {
      added += 1;
    }

    nextGenerated.push(connection);
  }

  removed = Math.max(0, generatedConnections.length - nextGenerated.length);
  const nextConnections = {
    ...connectionsData,
    connections: [...preservedConnections, ...nextGenerated].sort((a, b) => {
      const aKey = canonicalPairKey(String(a.from || a.source || ''), String(a.to || a.target || ''));
      const bKey = canonicalPairKey(String(b.from || b.source || ''), String(b.to || b.target || ''));
      return aKey.localeCompare(bKey);
    }),
  };

  return { nextConnections, added, updated, removed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projects = loadProjects();
  const allowedProjectIds = new Set(projects.map(project => project.id));
  const loadedConnections = loadConnections();
  const { nextConnections: prunedConnectionsData, changed: prunedChanged } = pruneConnectionsToProjects(loadedConnections, allowedProjectIds);
  const connectionsData = prunedConnectionsData;
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
  const refreshableExistingCandidates = [];
  const newCandidates = [];
  const allCandidates = [];
  const seenCandidateKeys = new Set();

  const addCandidate = candidate => {
    if (!candidate || seenCandidateKeys.has(candidate.pairKey)) return;
    seenCandidateKeys.add(candidate.pairKey);
    allCandidates.push(candidate);
    if (candidate.alreadyConnected) {
      if (candidate.score >= EXISTING_REPORT_THRESHOLD) existingCandidates.push(candidate);
      if (candidate.score >= EXISTING_REFRESH_THRESHOLD) refreshableExistingCandidates.push(candidate);
      return;
    }
    if (candidate.score >= NEW_CONNECTION_THRESHOLD) {
      newCandidates.push(candidate);
    }
  };

  const decidedCandidates = decideConnectionSet(
    buildV2CandidateQueue(projects, profilesById, existingKeys, args.focus),
    projects.map(project => project.id),
  );

  decidedCandidates
    .forEach(addCandidate);

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
    const { nextConnections, added, updated, removed } = await applyCandidates(connectionsData, allCandidates, profilesById, {
      llm: args.llm,
      llmModel: args.llmModel,
    }, narrativeCache);
    const { nextConnections: sanitizedConnections, changed: sanitizedChanged } = sanitizeConnectionsData(nextConnections);
    if (added > 0 || updated > 0 || sanitizedChanged || prunedChanged) {
      writeJson(CONNECTIONS_PATH, sanitizedConnections);
      if (fs.existsSync(UI_CONNECTIONS_PATH)) {
        writeJson(UI_CONNECTIONS_PATH, sanitizedConnections);
      }
    }
    const updatedMessage = updated > 0 ? `, refreshed ${updated} existing connection${updated === 1 ? '' : 's'}` : '';
    const removedMessage = removed > 0 ? `, removed ${removed} outdated connection${removed === 1 ? '' : 's'}` : '';
    console.log(`Applied ${added} new connection${added === 1 ? '' : 's'}${updatedMessage}${removedMessage}.\n`);
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
  buildEvidenceBreakdown,
  buildDocumentEvidenceSentence,
  buildLocalDescription,
  buildLLMPrompt,
  buildV2CandidateQueue,
  classifyConnectionTier,
  applyVisibilityPolicy,
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
  hasSufficientConnectionEvidence,
  resolveConnectionNarrative,
  scorePair,
  sanitizeConnectionDescription,
  sharedSignalDetails,
  isFallbackDescription,
  isNoisyConnectionDescription,
  isGeneratedMemoryDoc,
  shouldRefreshConnection,
};

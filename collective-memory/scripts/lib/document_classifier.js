const DOCUMENT_CLASSES = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  X: 'X',
};

const D_NAME_PATTERNS = [
  /(^|\/)CHANGELOG(?:\.[^\/]+)?$/i,
  /(^|\/)README(?:\.[^\/]+)?$/i,
  /(^|\/)LICENSE(?:\.[^\/]+)?$/i,
  /bug_report(?:\.[^\/]+)?$/i,
  /feature_request(?:\.[^\/]+)?$/i,
];

const X_PATH_PATTERNS = [
  /(^|\/)strengthen[^\/]*\.(?:md|txt|docx)$/i,
  /(^|\/)PROFILE\.md$/i,
  /(^|\/)research_sync(?:\.[^\/]+)?$/i,
];

const X_TEXT_PATTERNS = [
  /Ruta Objetivo:/i,
  /Base Te[oó]rica Inyectada:/i,
  /Fortalecimiento Cruzado/i,
  /Research Sync/i,
];

const SUBSTANTIVE_WORD_THRESHOLD = 120;

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function countWords(text) {
  const source = String(text || '').trim();
  if (!source) {
    return 0;
  }

  return source.split(/\s+/).filter(Boolean).length;
}

function classifyDocument(filePath = '', text = '') {
  const normalizedPath = normalizePath(filePath);
  const source = String(text || '');
  const lowerPath = normalizedPath.toLowerCase();
  const wordCount = countWords(source);

  if (D_NAME_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
    return { tier: DOCUMENT_CLASSES.D, reason: 'technical-artifact' };
  }

  if (X_PATH_PATTERNS.some((pattern) => pattern.test(normalizedPath)) || X_TEXT_PATTERNS.some((pattern) => pattern.test(source))) {
    return { tier: DOCUMENT_CLASSES.X, reason: 'generated-memory-artifact' };
  }

  if ((lowerPath.endsWith('.docx') || lowerPath.endsWith('.md')) && wordCount >= SUBSTANTIVE_WORD_THRESHOLD) {
    return { tier: DOCUMENT_CLASSES.A, reason: 'substantive-document' };
  }

  return { tier: DOCUMENT_CLASSES.B, reason: 'fallback-substantive' };
}

module.exports = {
  DOCUMENT_CLASSES,
  classifyDocument,
};

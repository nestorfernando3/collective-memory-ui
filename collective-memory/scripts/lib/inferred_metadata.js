function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function inferMetadataFromDocuments(documents = []) {
  const allowed = documents.filter((item) => item && (item.tier === 'A' || item.tier === 'B'));
  const sourceText = allowed.map((item) => String(item.text || '')).join('\n');
  const normalized = normalizeText(sourceText);

  const out = {
    domains: [],
    themes: [],
    institutions: [],
    theoretical_frameworks: [],
    confidence: 0,
    sources: allowed.map((item) => item.tier),
  };

  const domainHints = [
    [/semiotic|semiotica|semiologia|signos|signification|myth|simulacra/, 'semiotica'],
    [/educacion|education|pedagog|universidad|academic|research/, 'educacion'],
    [/culture|cultura|cultural|identity|identidad|youth|juventud/, 'cultura'],
  ];

  const themeHints = [
    [/caribbean|caribe|colombian|colombia/, 'caribe'],
    [/youth|juventud|students|estudiantes/, 'juventud'],
  ];

  const institutionHints = [
    [/politecnico de la costa atlantica/, 'politecnico de la costa atlantica'],
    [/universidad/, 'universidad'],
    [/school|institute|instituto/, 'instituto'],
  ];

  const frameworkHints = [
    [/barthes/, 'barthes'],
    [/baudrillard/, 'baudrillard'],
    [/foucault/, 'foucault'],
    [/bourdieu/, 'bourdieu'],
  ];

  domainHints.forEach(([pattern, label]) => {
    if (pattern.test(normalized)) out.domains.push(label);
  });

  themeHints.forEach(([pattern, label]) => {
    if (pattern.test(normalized)) out.themes.push(label);
  });

  institutionHints.forEach(([pattern, label]) => {
    if (pattern.test(normalized)) out.institutions.push(label);
  });

  frameworkHints.forEach(([pattern, label]) => {
    if (pattern.test(normalized)) out.theoretical_frameworks.push(label);
  });

  out.domains = uniq(out.domains);
  out.themes = uniq(out.themes);
  out.institutions = uniq(out.institutions);
  out.theoretical_frameworks = uniq(out.theoretical_frameworks);
  out.confidence = out.sources.length ? 0.72 : 0;

  return out;
}

module.exports = {
  inferMetadataFromDocuments,
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeLocale(locale) {
  return normalizeText(locale) === 'es' ? 'es' : 'en';
}

function normalizeSelectionReason(value) {
  const reason = normalizeText(value);
  if (reason === 'coverage-floor' || reason === 'coverage floor' || reason === 'coveragefloor') {
    return 'coverage-floor';
  }
  if (reason === 'strong-evidence' || reason === 'strong evidence' || reason === 'strong') {
    return 'strong-evidence';
  }
  if (reason === 'exploratory' || reason === 'exploration') {
    return 'exploratory';
  }
  return reason;
}

function joinSummary(values, locale) {
  const items = [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
  if (!items.length) {
    return normalizeLocale(locale) === 'es' ? 'una base compartida' : 'a shared base';
  }
  if (items.length === 1) return items[0];
  const conjunction = normalizeLocale(locale) === 'es' ? 'y' : 'and';
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

function buildStrongNarrative({ fromName, toName, sharedSummary, evidenceFragments, locale }) {
  const normalizedLocale = normalizeLocale(locale);
  const sharedText = joinSummary(sharedSummary, normalizedLocale);
  const evidenceText = Array.isArray(evidenceFragments) && evidenceFragments.length
    ? normalizedLocale === 'es'
      ? ` La evidencia aparece en ${evidenceFragments.length} fragmento${evidenceFragments.length === 1 ? '' : 's'}.`
      : ` The evidence appears in ${evidenceFragments.length} fragment${evidenceFragments.length === 1 ? '' : 's'}.`
    : '';

  return normalizedLocale === 'es'
    ? `Conexión fuerte entre ${fromName} y ${toName}: comparten ${sharedText}.${evidenceText}`
    : `Strong connection between ${fromName} and ${toName}: they share ${sharedText}.${evidenceText}`;
}

function buildExploratoryNarrative({ fromName, toName, sharedSummary, locale }) {
  const normalizedLocale = normalizeLocale(locale);
  const sharedText = joinSummary(sharedSummary, normalizedLocale);

  return normalizedLocale === 'es'
    ? `Conexión exploratoria entre ${fromName} y ${toName}: su afinidad parece útil alrededor de ${sharedText}, pero la evidencia sigue siendo parcial.`
    : `Exploratory connection between ${fromName} and ${toName}: their affinity looks useful around ${sharedText}, but the evidence is still partial.`;
}

function buildCoverageFloorNarrative({ fromName, toName, sharedSummary, locale }) {
  const normalizedLocale = normalizeLocale(locale);
  const sharedText = joinSummary(sharedSummary, normalizedLocale);

  return normalizedLocale === 'es'
    ? `Conexión promovida por cobertura entre ${fromName} y ${toName}: se muestra para evitar aislamiento del proyecto. La afinidad alrededor de ${sharedText} es razonable, aunque la evidencia todavía es limitada.`
    : `Coverage-floor promoted connection between ${fromName} and ${toName}: it is shown to avoid leaving the project isolated. The affinity around ${sharedText} is reasonable, although the evidence is still limited.`;
}

function buildConnectionNarrative(context = {}) {
  const locale = normalizeLocale(context.locale);
  const selectionReason = normalizeSelectionReason(context.selectionReason);
  const tier = normalizeText(context.tier) === 'exploratory' ? 'exploratory' : 'strong';
  const fromName = String(context.fromName || (locale === 'es' ? 'Proyecto origen' : 'Source project')).trim();
  const toName = String(context.toName || (locale === 'es' ? 'Proyecto destino' : 'Target project')).trim();
  const sharedSummary = Array.isArray(context.sharedSummary) ? context.sharedSummary : [];
  const evidenceFragments = Array.isArray(context.evidenceFragments) ? context.evidenceFragments : [];

  if (selectionReason === 'coverage-floor') {
    return {
      description: buildCoverageFloorNarrative({ fromName, toName, sharedSummary, locale }),
      narrativeClass: 'coverage-floor',
    };
  }

  if (tier === 'strong') {
    return {
      description: buildStrongNarrative({ fromName, toName, sharedSummary, evidenceFragments, locale }),
      narrativeClass: 'strong',
    };
  }

  return {
    description: buildExploratoryNarrative({ fromName, toName, sharedSummary, locale }),
    narrativeClass: 'exploratory',
  };
}

module.exports = {
  buildConnectionNarrative,
};

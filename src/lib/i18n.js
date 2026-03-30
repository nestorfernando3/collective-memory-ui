function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeLocale(locale) {
  const value = normalizeText(locale);
  if (value.startsWith('es')) return 'es';
  return 'en';
}

const TITLE_TRANSLATIONS = new Map([
  ['memoria colectiva', { en: 'Collective Memory', es: 'Memoria Colectiva' }],
  ['collective memory', { en: 'Collective Memory', es: 'Memoria Colectiva' }],
]);

const SUBTITLE_TRANSLATIONS = new Map([
  ['archivo vivo de trabajo', { en: 'Living archive of work', es: 'Archivo vivo de trabajo' }],
  ['living archive of work', { en: 'Living archive of work', es: 'Archivo vivo de trabajo' }],
  ['sistema operativo personal', { en: 'Personal operating system', es: 'Sistema Operativo Personal' }],
  ['personal operating system', { en: 'Personal operating system', es: 'Sistema Operativo Personal' }],
]);

const ROLE_TRANSLATIONS = [
  {
    match: /docente/i,
    en: 'Teacher',
    es: 'Docente',
  },
  {
    match: /investigador(a)?/i,
    en: 'Researcher',
    es: 'Investigador',
  },
  {
    match: /coordinador(a)?/i,
    en: 'Coordinator',
    es: 'Coordinador',
  },
  {
    match: /director(a)?/i,
    en: 'Director',
    es: 'Director',
  },
  {
    match: /asesor(a)?/i,
    en: 'Advisor',
    es: 'Asesor',
  },
  {
    match: /docente\s*\/\s*investigador(a)?/i,
    en: 'Teacher / Researcher',
    es: 'Docente / Investigador',
  },
];

function translateByMap(value, locale, translations) {
  const normalizedLocale = normalizeLocale(locale);
  const key = normalizeText(value);
  const entry = translations.get(key);
  if (!entry) return String(value || '');
  return entry[normalizedLocale] || String(value || '');
}

export function translateAppTitle(value, locale = 'en') {
  return translateByMap(value, locale, TITLE_TRANSLATIONS);
}

export function translateAppSubtitle(value, locale = 'en') {
  return translateByMap(value, locale, SUBTITLE_TRANSLATIONS);
}

export function translateAffiliationRole(value, locale = 'en') {
  const text = String(value || '').trim();
  if (!text) return '';

  const normalizedLocale = normalizeLocale(locale);
  for (const entry of ROLE_TRANSLATIONS) {
    if (entry.match.test(text)) {
      return entry[normalizedLocale];
    }
  }

  return text;
}

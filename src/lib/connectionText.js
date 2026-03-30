function normalizeConnectionText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function sanitizeConnectionDescription(value) {
  let text = normalizeConnectionText(value);
  if (!text) return '';

  text = text
    .replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, '')
    .replace(/\s+y\s+pasajes?\s+como\s+Ruta Objetivo:\s*[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Ruta Objetivo:\s*[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Base Te[oó]rica Inyectada:\s*[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+En los textos aparecen[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Este perfil se entiende[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Archivo vivo de trabajo[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Collective Memory PWA[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+Perfil unificado[\s\S]*?(?=\s+Si hay citas|\s+La lectura sugerida|$)/gi, '. ')
    .replace(/\s+La lectura sugerida va de[\s\S]*$/gi, '.')
    .replace(/\s+porque el vínculo parece acumulativo y no accidental\.?/gi, '.')
    .replace(/\s+porque el cruce no es accidental(?: sino orgánico y acumulativo)?\.?/gi, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\.+/g, '.')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[,;]\s*([,;])/g, '$1')
    .replace(/^[,.;:!?]+\s*/, '')
    .trim();

  return text;
}

export function isWeakGenericDescription(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  return (
    normalized.includes('se entiende mejor por las senales') ||
    normalized.includes('se apoya en tecnologias') ||
    normalized.includes('se apoya en etiquetas') ||
    normalized.includes('palabras compartidas') ||
    normalized.includes('sigue siendo exploratoria') ||
    normalized.includes('porque el vinculo parece acumulativo y no accidental')
  );
}

import test from 'node:test';
import assert from 'node:assert/strict';

import { isWeakGenericDescription, sanitizeConnectionDescription } from './connectionText.js';

test('sanitizes noisy legacy connection prose', () => {
  const input =
    'La relación entre Alpha y Beta se entiende mejor por las señales que repiten sus textos. En los textos aparecen citas como Generación 2030 y GESTIONES BRISAS DEL RIO 2026, matrices teóricas como fenomenología y teoría, reuso de datos y corpus compartidos y pasajes como Archivo vivo de trabajo. Este perfil se entiende por la suma de proyectos académicos, pedagógicos y culturales. La lectura sugerida va de Alpha hacia Beta, porque el vínculo parece acumulativo y no accidental.';

  const output = sanitizeConnectionDescription(input);

  assert.equal(output, 'La relación entre Alpha y Beta se entiende mejor por las señales que repiten sus textos.');
  assert.doesNotMatch(output, /Archivo vivo de trabajo|La lectura sugerida|porque el vínculo parece acumulativo/i);
});

test('flags generic bridge prose as weak', () => {
  assert.equal(
    isWeakGenericDescription('La relación entre Alpha y Beta se entiende mejor por las señales que repiten sus textos.'),
    true,
  );
  assert.equal(isWeakGenericDescription('Comparten un marco conceptual explícito: fenomenología.'), false);
  assert.equal(
    isWeakGenericDescription('La relación entre Alpha y Gamma todavía es tentativa, pero ya muestra señales útiles: citas compartidas y un marco conceptual explícito: rumor.'),
    false,
  );
});

test('keeps project names like Collective Memory PWA while trimming legacy suffixes', () => {
  const output = sanitizeConnectionDescription(
    'La relación entre Paideia (Παιδεία) y Collective Memory PWA todavía es tentativa, pero ya muestra señales útiles: tecnologías: vite. La lectura sugerida va de Paideia hacia Collective Memory PWA, porque el vínculo parece acumulativo y no accidental.',
  );

  assert.match(output, /Collective Memory PWA/);
  assert.doesNotMatch(output, /La lectura sugerida va de|porque el vínculo parece acumulativo/i);
});

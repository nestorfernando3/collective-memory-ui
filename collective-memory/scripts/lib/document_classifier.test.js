const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyDocument, DOCUMENT_CLASSES } = require('./document_classifier.js');

function makeWordSequence(count, prefix = 'word') {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(' ');
}

test('classifyDocument excludes technical and generated artifacts before scoring', () => {
  assert.equal(
    classifyDocument('/Users/nestor/Documents/ReMember2/markdown-pedagogico/CHANGELOG.md', 'Todos los cambios notables de este proyecto se documentan en este archivo.').tier,
    DOCUMENT_CLASSES.D,
  );

  assert.equal(
    classifyDocument('/Users/nestor/Documents/ReMember2/collective-memory/strengthen_camilas_rumor.md', '# Memoria Colectiva: Fortalecimiento Cruzado\nRuta Objetivo: ...').tier,
    DOCUMENT_CLASSES.X,
  );

  assert.equal(
    classifyDocument('/Users/nestor/Documents/ReMember2/picnic-semiotico/short-note.md', 'This is a concise note with under the substantive threshold.').tier,
    DOCUMENT_CLASSES.C,
  );
});

test('classifyDocument enforces the substantive long-form threshold at the boundary', () => {
  assert.equal(
    classifyDocument(
      '/Users/nestor/Documents/ReMember2/picnic-semiotico/mid-note.md',
      makeWordSequence(119, 'mid'),
    ).tier,
    DOCUMENT_CLASSES.B,
  );

  assert.equal(
    classifyDocument(
      '/Users/nestor/Documents/ReMember2/picnic-semiotico/exact-threshold.md',
      makeWordSequence(120, 'exact'),
    ).tier,
    DOCUMENT_CLASSES.A,
  );
});

test('classifyDocument normalizes Windows paths and keeps strengthen-notes.docx out of X', () => {
  assert.equal(
    classifyDocument(
      'C:\\Users\\Nestor\\Documents\\ReMember2\\picnic-semiotico\\windows-substantive.md',
      makeWordSequence(120, 'windows'),
    ).tier,
    DOCUMENT_CLASSES.A,
  );

  assert.equal(
    classifyDocument(
      'C:\\Users\\Nestor\\Documents\\ReMember2\\collective-memory\\strengthening-notes.docx',
      'This operational note tracks edits, reminders, and next steps for the project.',
    ).tier,
    DOCUMENT_CLASSES.C,
  );
});

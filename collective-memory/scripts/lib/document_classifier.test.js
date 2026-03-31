const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyDocument, DOCUMENT_CLASSES } = require('./document_classifier.js');

function makeLongText(sentence, repeatCount) {
  return Array.from({ length: repeatCount }, () => sentence).join(' ');
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
    classifyDocument(
      '/Users/nestor/Documents/ReMember2/picnic-semiotico/Manuscript_Food_Culture_Society.docx',
      makeLongText('Drawing on Roland Barthes and Jean Baudrillard, this article examines Caribbean youth culture through semiotic methods and historical context.', 10),
    ).tier,
    DOCUMENT_CLASSES.A,
  );
});

test('classifyDocument only promotes substantive long markdown and docx files to A', () => {
  assert.equal(
    classifyDocument(
      '/Users/nestor/Documents/ReMember2/picnic-semiotico/short-note.docx',
      'Drawing on Roland Barthes and Jean Baudrillard, this article examines Caribbean youth culture.',
    ).tier,
    DOCUMENT_CLASSES.B,
  );

  assert.equal(
    classifyDocument(
      '/Users/nestor/Documents/ReMember2/picnic-semiotico/short-note.md',
      'This is a concise note with under the substantive threshold.',
    ).tier,
    DOCUMENT_CLASSES.B,
  );

  assert.equal(
    classifyDocument(
      '/Users/nestor/Documents/ReMember2/picnic-semiotico/substantive-note.md',
      makeLongText('This long-form note develops the project argument with specific examples, interpretive framing, and concrete observations.', 12),
    ).tier,
    DOCUMENT_CLASSES.A,
  );
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyDocument, DOCUMENT_CLASSES } = require('./document_classifier.js');

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
    classifyDocument('/Users/nestor/Documents/ReMember2/picnic-semiotico/Manuscript_Food_Culture_Society.docx', 'Drawing on Roland Barthes and Jean Baudrillard, this article examines...').tier,
    DOCUMENT_CLASSES.A,
  );
});

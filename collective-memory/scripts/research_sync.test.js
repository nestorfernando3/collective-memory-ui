const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildConnectionContext,
  buildDocumentEvidenceSentence,
  buildLocalDescription,
  isGeneratedMemoryDoc,
  isNoisyConnectionDescription,
  hasSufficientConnectionEvidence,
  shouldRefreshConnection,
  scorePair,
} = require('./research_sync.js');

function makeProfile(id, name, metadataTokens = [], extras = {}) {
  return {
    project: {
      id,
      name,
      description: '',
      tags: [],
      domains: [],
      themes: [],
      theoretical_frameworks: [],
      technologies: [],
      institutions: [],
      collaborators: [],
      outputs: [],
      ...extras.project,
    },
    metadataFields: {
      theoretical_frameworks: [],
      domains: [],
      themes: [],
      tags: [],
      technologies: [],
      institutions: [],
      collaborators: [],
      outputs: [],
    },
    metadataTokens,
    docTokens: [],
    docSignals: {
      citations: [],
      theoryTerms: [],
      dataTerms: [],
      provenanceTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
      highlights: [],
      ...extras.docSignals,
    },
    roleFlags: {
      theory: false,
      research: false,
      pedagogy: false,
      institutional: false,
      creative: false,
      tool: false,
      data: false,
      article: false,
      ...extras.roleFlags,
    },
  };
}

test('downweights generic metadata tokens', () => {
  const profileA = makeProfile('a', 'Alpha', ['investigacion']);
  const profileB = makeProfile('b', 'Beta', ['investigacion']);

  const candidate = scorePair(profileA, profileB, new Set());

  assert.ok(candidate.score > 0);
  assert.ok(candidate.score < 1);
  assert.ok(!candidate.signals.some((signal) => signal.field === 'metadata_tokens'));
});

test('retains meaningful shared tokens in the narrative context', () => {
  const profileA = makeProfile('a', 'Alpha', ['caribe']);
  const profileB = makeProfile('b', 'Beta', ['caribe']);
  const candidate = scorePair(profileA, profileB, new Set());
  const profilesById = new Map([
    ['a', profileA],
    ['b', profileB],
  ]);

  const context = buildConnectionContext(candidate, 'a', 'b', profilesById);
  const description = buildLocalDescription(context);

  assert.ok(candidate.score >= 0.75);
  assert.ok(candidate.signals.some((signal) => signal.field === 'metadata_tokens'));
  assert.match(context.sharedSummary.join(' '), /palabras compartidas|marcos teóricos/i);
  assert.doesNotMatch(description, /shared tokens|theoretical_frameworks|vocabulario específico/i);
});

test('marks provenance and citation material as third-party evidence', () => {
  const profileA = makeProfile('a', 'Alpha', [], {
    docSignals: {
      citations: ['García, 2024'],
      provenanceTerms: ['research claw'],
      quotedPhrases: ['fragmento citado'],
      keyPhrases: ['research claw'],
    },
  });
  const profileB = makeProfile('b', 'Beta', [], {
    docSignals: {
      citations: ['García, 2024'],
      provenanceTerms: ['research claw'],
      quotedPhrases: ['fragmento citado'],
      keyPhrases: ['research claw'],
    },
  });
  const candidate = scorePair(profileA, profileB, new Set());
  const profilesById = new Map([
    ['a', profileA],
    ['b', profileB],
  ]);

  const context = buildConnectionContext(candidate, 'a', 'b', profilesById);
  const description = buildLocalDescription(context);

  assert.ok(candidate.signals.some((signal) => signal.field === 'document_provenance_terms'));
  assert.match(description, /procedencia|terceros|coautoría/i);
});

test('keeps generated root docs out of the evidence pool', () => {
  assert.equal(isGeneratedMemoryDoc('/Users/nestor/Documents/Collective Memory/PROFILE.md'), true);
  assert.equal(isGeneratedMemoryDoc('/Users/nestor/Documents/Collective Memory/README.md'), true);
  assert.equal(isGeneratedMemoryDoc('/Users/nestor/Documents/Collective Memory Backup/strengthen_camilas_rumor.md'), true);
  assert.equal(isGeneratedMemoryDoc('/Users/nestor/Documents/ReMember2/collective-memory/PROFILE.md'), true);
  assert.equal(isGeneratedMemoryDoc('/Users/nestor/Documents/ReMember2/collective-memory/notes.md'), false);
});

test('compresses document evidence into one clear sentence', () => {
  const sentence = buildDocumentEvidenceSentence(
    {
      citations: [],
      theoryTerms: ['teoría', 'fenomenología'],
      dataTerms: [],
      provenanceTerms: [],
    },
    ['- Archivo vivo de trabajo', 'Este perfil se entiende por la suma de proyectos'],
  );

  assert.equal(sentence, 'Comparten un marco conceptual explícito: fenomenología.');
  assert.doesNotMatch(sentence, /^-\s/);
  assert.doesNotMatch(sentence, /perfil se entiende|teoría$/i);
});

test('refreshes noisy legacy connection descriptions', () => {
  assert.equal(isNoisyConnectionDescription('Este perfil se entiende por la suma de proyectos académicos.'), true);
  assert.equal(isNoisyConnectionDescription('La relación entre Paideia (Παιδεία) y.'), true);
  assert.equal(isNoisyConnectionDescription('La relación entre dos proyectos comparten métodos.'), false);
  assert.equal(
    shouldRefreshConnection(
      {
        description: 'Este perfil se entiende por la suma de proyectos académicos, pedagógicos y culturales.',
        source: 'research-sync',
        evidence: { score: 10 },
      },
      { score: 5 },
    ),
    true,
  );
});

test('prefers exploratory wording for weak connections with only generic evidence', () => {
  const description = buildLocalDescription({
    fromName: 'Alpha',
    toName: 'Beta',
    score: 14,
    sharedSummary: [],
    documentEvidence: 'Las fuentes reutilizan datos y corpus compartidos.',
    docSignals: {
      citations: [],
      theoryTerms: [],
      dataTerms: [],
      provenanceTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
    },
  });

  assert.match(description, /evidencia documental/i);
  assert.match(description, /base compartida clara|No hay base suficiente/i);
  assert.doesNotMatch(description, /se entiende mejor por las señales que repiten sus textos/i);
});

test('rejects theory-only and generic-token bridges as insufficient evidence', () => {
  assert.equal(
    hasSufficientConnectionEvidence({
      signals: [],
      shared: {
        theoretical_frameworks: ['fenomenología'],
        domains: [],
        themes: [],
        tags: [],
        technologies: [],
        institutions: [],
        collaborators: [],
      },
      sharedMetadataTokens: ['formacion'],
      sharedDocSignals: {
        citations: [],
        theoryTerms: ['fenomenología', 'rumor'],
        dataTerms: [],
        provenanceTerms: [],
        headings: [],
        quotedPhrases: [],
        keyPhrases: [],
      },
      docHighlights: [],
    }),
    false,
  );

  assert.equal(
    hasSufficientConnectionEvidence({
      signals: [{ field: 'explicit_relation', values: ['alpha', 'beta'] }],
      shared: {},
      sharedMetadataTokens: [],
      sharedDocSignals: {},
      docHighlights: [],
    }),
    false,
  );

  assert.equal(
    hasSufficientConnectionEvidence({
      signals: [{ field: 'explicit_relation', values: ['alpha', 'beta'] }],
      shared: {
        theoretical_frameworks: [],
        domains: [],
        themes: [],
        tags: [],
        technologies: [],
        institutions: ['politecnico de la costa atlantica'],
        collaborators: [],
      },
      sharedMetadataTokens: ['politecnico'],
      sharedDocSignals: {},
      docHighlights: [],
    }),
    true,
  );
});

test('rejects document-noise bridges without meaningful shared tokens', () => {
  assert.equal(
    hasSufficientConnectionEvidence({
      signals: [],
      shared: {
        theoretical_frameworks: [],
        domains: [],
        themes: [],
        tags: [],
        technologies: [],
        institutions: [],
        collaborators: [],
      },
      sharedMetadataTokens: ['investigacion'],
      sharedDocSignals: {
        citations: [],
        theoryTerms: [],
        dataTerms: ['datos', 'archivo'],
        provenanceTerms: [],
        headings: ['TOC'],
        quotedPhrases: [],
        keyPhrases: ['datos', 'archivo'],
      },
      docHighlights: ['Aparecen pasajes como TOC \\h \\u \\z'],
    }),
    false,
  );
});

test('omits document evidence when only theory markers are present', () => {
  const profileA = makeProfile('a', 'Alpha', [], {
    docSignals: {
      theoryTerms: ['fenomenología', 'rumor'],
    },
  });
  const profileB = makeProfile('b', 'Beta', [], {
    docSignals: {
      theoryTerms: ['fenomenología', 'rumor'],
    },
  });
  const candidate = scorePair(profileA, profileB, new Set());
  const profilesById = new Map([
    ['a', profileA],
    ['b', profileB],
  ]);

  const context = buildConnectionContext(candidate, 'a', 'b', profilesById);
  const description = buildLocalDescription(context);

  assert.equal(context.documentEvidence, '');
  assert.doesNotMatch(description, /Las fuentes repiten matrices teóricas/i);
});

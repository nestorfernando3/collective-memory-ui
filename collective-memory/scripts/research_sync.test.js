const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildConnectionContext,
  buildLocalDescription,
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
  assert.match(context.sharedSummary.join(' '), /vocabulario específico/i);
  assert.doesNotMatch(description, /shared tokens/i);
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

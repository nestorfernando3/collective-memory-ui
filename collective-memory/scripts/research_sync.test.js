const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');

const {
  applyCandidates,
  buildLocalDescription,
  buildLLMPrompt,
  extractDocumentSignals,
  canonicalPairKey,
  getDefaultDocsRoots,
  parseArgs,
  shouldRefreshConnection,
} = require('./research_sync');

test('extractDocumentSignals finds citations, theory markers, and data markers', () => {
  const signals = extractDocumentSignals(`
    # Marco teórico

    Goffman, 1959
    Los datos se reutilizan en el corpus de entrevistas.
    "La trastienda social"
  `);

  assert.ok(signals.citations.some(value => value.includes('Goffman')));
  assert.ok(signals.theoryTerms.includes('marco teórico'));
  assert.ok(signals.dataTerms.includes('datos'));
  assert.ok(signals.headings.includes('Marco teórico'));
  assert.ok(signals.quotedPhrases.includes('La trastienda social'));
});

test('buildLocalDescription produces prose from shared evidence', () => {
  const description = buildLocalDescription({
    fromName: 'Las Camilas',
    toName: 'Fenomenología del Rumor',
    sharedSummary: ['theoretical_frameworks: fenomenología', 'domains: caribe'],
    docFiles: ['ensayo.md'],
    docSignals: {
      citations: ['Goffman, 1959'],
      theoryTerms: ['marco teórico'],
      dataTerms: ['datos'],
      headings: ['Marco conceptual'],
      keyPhrases: ['trastienda', 'corpus'],
      quotedPhrases: ['La trastienda social'],
    },
    docHighlights: ['La trastienda social aparece como escena repetida.'],
    relationDirection: 'las-camilas -> fenomenologia-rumor',
  });

  assert.match(description, /fenomenolog/i);
  assert.match(description, /Goffman/i);
  assert.match(description, /trastienda/i);
  assert.match(description, /las-camilas -> fenomenologia-rumor/i);
});

test('applyCandidates refreshes an existing connection description', async () => {
  const makeProfile = (id, name) => ({
    project: {
      id,
      name,
      description: `${name} description`,
      path: '',
      outputs: [],
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
    metadataTokens: new Set(),
    docTokens: new Set(),
    docSignals: {
      citations: [],
      theoryTerms: [],
      dataTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
    },
    docEvidence: { snippets: [] },
    roleFlags: {
      theory: true,
      research: false,
      pedagogy: false,
      creative: true,
      institutional: false,
      tool: false,
      data: false,
      article: false,
    },
  });

  const profilesById = new Map([
    ['a', makeProfile('a', 'Project A')],
    ['b', makeProfile('b', 'Project B')],
  ]);
  const connectionsData = {
    connections: [
      {
        from: 'a',
        to: 'b',
        description: 'old description',
        source: 'research-sync',
        description_mode: 'local',
      },
    ],
  };
  const candidate = {
    pairKey: canonicalPairKey('a', 'b'),
    alreadyConnected: true,
    score: 36,
    a: { id: 'a', name: 'Project A', related_projects: [] },
    b: { id: 'b', name: 'Project B', related_projects: [] },
    shared: {
      theoretical_frameworks: ['fenomenología'],
      domains: [],
      themes: [],
      tags: [],
      technologies: [],
      institutions: [],
      collaborators: [],
    },
    sharedMetadataTokens: [],
    sharedDocTokens: [],
    sharedDocSignals: {
      citations: [],
      theoryTerms: [],
      dataTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
    },
    roleA: profilesById.get('a').roleFlags,
    roleB: profilesById.get('b').roleFlags,
  };

  const { nextConnections, added, updated } = await applyCandidates(
    connectionsData,
    [candidate],
    profilesById,
    { llm: false, llmModel: 'gpt-4.1-mini' },
    new Map()
  );

  assert.equal(added, 0);
  assert.equal(updated, 1);
  assert.equal(nextConnections.connections[0].from, 'a');
  assert.notEqual(nextConnections.connections[0].description, 'old description');
  assert.match(nextConnections.connections[0].description, /fenomenolog/i);
});

test('buildLLMPrompt emphasizes organic prose and document evidence', () => {
  const prompt = buildLLMPrompt({
    fromName: 'Las Camilas',
    fromId: 'las-camilas',
    toName: 'Fenomenología del Rumor',
    toId: 'fenomenologia-rumor',
    type: 'Teórica',
    strength: 'Alta',
    sharedSummary: ['theoretical_frameworks: fenomenología'],
    docSignals: {
      citations: ['Goffman, 1959'],
      theoryTerms: ['marco teórico'],
      dataTerms: ['datos'],
      headings: ['Marco conceptual'],
      keyPhrases: ['trastienda', 'corpus'],
      quotedPhrases: [],
    },
    docHighlights: ['La trastienda social aparece como escena repetida.'],
    docFiles: ['ensayo.md'],
    relationDirection: 'las-camilas -> fenomenologia-rumor',
  });

  assert.match(prompt, /2 y 4 oraciones/);
  assert.match(prompt, /Evita frases administrativas/);
  assert.match(prompt, /Goffman, 1959/);
});

test('shouldRefreshConnection keeps curated descriptions unless the candidate adds new evidence', () => {
  const current = {
    description:
      'Una relación curada, amplia y explícita entre proyectos, desarrollada con una voz editorial suficientemente estable para no requerir sobrescritura inmediata en el flujo automático.',
    source: 'human',
    description_mode: 'manual',
    evidence: { score: 50 },
  };
  const candidate = {
    score: 48,
    sharedDocSignals: {
      citations: [],
      theoryTerms: [],
      dataTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
    },
  };

  assert.equal(shouldRefreshConnection(current, candidate), false);
  assert.equal(
    shouldRefreshConnection(
      {
        description: 'La relación entre A y B se sostiene en shared evidence y dirección sugerida.',
        source: 'research-sync',
        description_mode: 'local',
        evidence: { score: 20 },
      },
      {
        score: 36,
        sharedDocSignals: {
          citations: ['Goffman, 1959'],
          theoryTerms: [],
          dataTerms: [],
          headings: [],
          quotedPhrases: [],
          keyPhrases: ['trastienda'],
        },
      }
    ),
    true
  );
});

test('parseArgs defaults research sync to the full home directory', () => {
  const args = parseArgs([]);
  assert.deepEqual(args.docsRoot, getDefaultDocsRoots(process.platform, os.homedir()));
});

test('getDefaultDocsRoots adapts to mac, linux, and windows conventions', () => {
  const home = '/Users/test';

  assert.deepEqual(getDefaultDocsRoots('darwin', home), [
    '/Users/test/Documents',
    '/Users/test/Desktop',
    '/Users/test',
  ]);

  assert.deepEqual(getDefaultDocsRoots('linux', home), [
    '/Users/test/Documents',
    '/Users/test/Desktop',
    '/Users/test',
  ]);

  assert.deepEqual(getDefaultDocsRoots('win32', home), [
    '/Users/test/Documents',
    '/Users/test/OneDrive/Documents',
    '/Users/test/OneDrive - Personal/Documents',
    '/Users/test/Desktop',
  ]);
});

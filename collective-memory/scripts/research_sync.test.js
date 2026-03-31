const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyVisibilityPolicy,
  buildEvidenceBreakdown,
  buildConnectionContext,
  buildDocumentEvidenceSentence,
  buildLocalDescription,
  buildReport,
  buildV2CandidateQueue,
  classifyConnectionTier,
  isGeneratedMemoryDoc,
  isNoisyConnectionDescription,
  hasSufficientConnectionEvidence,
  sanitizeConnectionDescription,
  shouldRefreshConnection,
  scorePair,
} = require('./research_sync.js');

function makeV2Profile(id, name, sharedText = 'Drawing on Barthes and myth in education.', docs = [{ tier: 'A', text: 'Drawing on Barthes and myth in education.' }]) {
  return {
    project: {
      id,
      name,
      description: '',
      tags: [],
      domains: ['educacion'],
      themes: [],
      theoretical_frameworks: [],
      technologies: [],
      institutions: ['politecnico'],
      collaborators: [],
      outputs: [],
    },
    metadataFields: {
      theoretical_frameworks: [],
      domains: ['educacion'],
      themes: [],
      tags: [],
      technologies: [],
      institutions: ['politecnico'],
      collaborators: [],
      outputs: [],
    },
    metadataTokens: ['educacion', 'politecnico', 'semiotica'],
    docTokens: ['barthes', 'myth', 'education'],
    docSignals: {
      citations: [],
      theoryTerms: [],
      dataTerms: [],
      provenanceTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
      highlights: [],
    },
    docEvidence: {
      snippets: docs.map((doc, index) => ({
        filePath: `/tmp/${id}-${index}.md`,
        label: `${id}-${index}.md`,
        text: doc.text || sharedText,
        highlights: [],
      })),
    },
    documents: docs,
    roleFlags: {
      theory: false,
      research: false,
      pedagogy: false,
      institutional: false,
      creative: false,
      tool: false,
      data: false,
      article: false,
    },
    signalProfile: {
      projectId: id,
      metadata: {
        domains: ['educacion'],
        themes: [],
        institutions: ['politecnico'],
        theoretical_frameworks: [],
        confidence: 0,
        sources: ['A'],
      },
      inferred: {
        domains: ['semiotica'],
        themes: [],
        institutions: ['politecnico'],
        theoretical_frameworks: ['barthes'],
        confidence: 0.72,
        sources: ['A'],
      },
      documents: docs,
      signal: {
        domains: ['educacion', 'semiotica'],
        themes: [],
        institutions: ['politecnico'],
        theoretical_frameworks: ['barthes'],
      },
      confidence: 0.72,
    },
  };
}

function loadResearchSyncWithStubbedVisibility(decideConnectionSet) {
  const modulePath = require.resolve('./research_sync.js');
  const visibilityPath = require.resolve('./lib/visibility_policy.js');
  const originalVisibility = require.cache[visibilityPath];

  delete require.cache[modulePath];
  require.cache[visibilityPath] = {
    id: visibilityPath,
    filename: visibilityPath,
    loaded: true,
    exports: { decideConnectionSet, decideTier: () => ({ tier: 'exploratory', visibility: 'optional', selectionReason: 'exploratory' }) },
  };

  try {
    return require('./research_sync.js');
  } finally {
    delete require.cache[modulePath];
    if (originalVisibility) {
      require.cache[visibilityPath] = originalVisibility;
    } else {
      delete require.cache[visibilityPath];
    }
  }
}

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

test('buildV2CandidateQueue derives scores from the V2 modules', () => {
  const profileA = makeV2Profile('a', 'Alpha');
  const profileB = makeV2Profile('b', 'Beta');
  const profilesById = new Map([
    ['a', profileA],
    ['b', profileB],
  ]);

  const [candidate] = buildV2CandidateQueue([{ id: 'a' }, { id: 'b' }], profilesById, new Set());

  assert.equal(candidate.from, 'a');
  assert.equal(candidate.to, 'b');
  assert.equal(candidate.affinityScore, 66);
  assert.equal(candidate.evidenceScore, 24);
  assert.equal(candidate.score, 90);
});

test('buildReport and applyCandidates use the same canonical V2 direction', async () => {
  const profileA = makeV2Profile('a', 'Alpha');
  const profileB = makeV2Profile('b', 'Beta');
  const profilesById = new Map([
    ['a', profileA],
    ['b', profileB],
  ]);
  const [candidate] = buildV2CandidateQueue([{ id: 'a' }, { id: 'b' }], profilesById, new Set());

  const report = await buildReport({
    existingCandidates: [candidate],
    newCandidates: [],
    profilesById,
    focusId: null,
    scopeLabel: 'Systemwide (all projects)',
    top: 1,
    narrativeCache: new Map(),
    llm: false,
    llmModel: 'gpt-4.1-mini',
  });

  const { applyCandidates } = require('./research_sync.js');
  const result = await applyCandidates(
    { connections: [] },
    [candidate],
    profilesById,
    { llm: false, projectIds: ['a', 'b'] },
  );

  assert.match(report, /Alpha -> Beta/);
  assert.equal(result.nextConnections.connections[0].from, 'a');
  assert.equal(result.nextConnections.connections[0].to, 'b');
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

test('refreshes low-score fallback descriptions so weak links can be rewritten honestly', () => {
  assert.equal(
    shouldRefreshConnection(
      {
        description: 'La relación entre Alpha y Beta se entiende mejor por las señales que repiten sus textos. La lectura sugerida va de Alpha hacia Beta, porque el vínculo parece acumulativo y no accidental.',
        source: 'research-sync',
        evidence: { score: 14 },
      },
      { score: 14 },
    ),
    true,
  );
});

test('applyCandidates writes decision scores and coverage promotion metadata', async () => {
  const calls = [];
  const { applyCandidates } = loadResearchSyncWithStubbedVisibility((candidates, projectIds) => {
    calls.push({ candidates, projectIds });
    return candidates.map((candidate) => ({
      ...candidate,
      tier: 'review',
      visibility: 'hidden',
      selectionReason: 'stub-policy',
    }));
  });

  const result = await applyCandidates(
    { connections: [] },
    [
      {
        from: 'collective-memory-ui',
        to: 'diario-emociones',
      },
      {
        from: 'diario-emociones',
        to: 'tercer-proyecto',
      },
    ],
    new Map([
      ['collective-memory-ui', makeV2Profile('collective-memory-ui', 'Collective Memory PWA')],
      ['diario-emociones', makeV2Profile('diario-emociones', 'Diario de Emociones')],
      ['tercer-proyecto', makeV2Profile('tercer-proyecto', 'Tercer Proyecto')],
    ]),
    { llm: false },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].projectIds.includes('collective-memory-ui'), true);
  const selected = result.nextConnections.connections.find((item) => item.from === 'collective-memory-ui' && item.to === 'diario-emociones');
  assert.equal(selected.selection_reason, 'stub-policy');
  assert.equal(selected.tier, 'review');
  assert.equal(selected.visibility, 'hidden');
  assert.equal(selected.decision.affinity_score, 66);
  assert.equal(selected.decision.evidence_score, 24);
  assert.deepEqual(
    Object.keys(selected.evidence.breakdown).sort(),
    ['assessment', 'documents', 'explicitRelation', 'metadata', 'semanticBridge', 'total'],
  );
  assert.equal(selected.evidence.breakdown.metadata, 0);
  assert.equal(selected.evidence.breakdown.documents, 0);
  assert.equal(selected.evidence.breakdown.semanticBridge, 0);
  assert.equal(selected.evidence.breakdown.explicitRelation, 0);
  assert.equal(selected.evidence.breakdown.total, 90);
  assert.equal(selected.evidence.breakdown.assessment.evidenceScore, 24);
  assert.deepEqual(selected.evidence.assessment.breakdown, selected.evidence.breakdown.assessment.breakdown);
});

test('applyCandidates scopes coverage decisions to the focused project set', async () => {
  const calls = [];
  const { applyCandidates } = loadResearchSyncWithStubbedVisibility((candidates, projectIds) => {
    calls.push(projectIds.slice());
    return candidates.map((candidate) => ({
      ...candidate,
      tier: 'exploratory',
      visibility: 'optional',
      selectionReason: 'exploratory',
    }));
  });

  await applyCandidates(
    { connections: [] },
    [
      { from: 'focus-a', to: 'focus-b' },
      { from: 'focus-a', to: 'focus-c' },
    ],
    new Map([
      ['focus-a', makeV2Profile('focus-a', 'Focus A')],
      ['focus-b', makeV2Profile('focus-b', 'Focus B')],
      ['focus-c', makeV2Profile('focus-c', 'Focus C')],
      ['outside-project', makeV2Profile('outside-project', 'Outside Project')],
    ]),
    { llm: false, projectIds: ['focus-a', 'focus-b', 'focus-c'] },
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].sort(), ['focus-a', 'focus-b', 'focus-c']);
});

test('preserves project names like Collective Memory PWA while cleaning legacy noise', () => {
  const description = sanitizeConnectionDescription(
    'La relación entre Paideia (Παιδεία) y Collective Memory PWA todavía es tentativa, pero ya muestra señales útiles: tecnologías: vite. La lectura sugerida va de Paideia hacia Collective Memory PWA, porque el vínculo parece acumulativo y no accidental.',
  );

  assert.match(description, /Collective Memory PWA/);
  assert.doesNotMatch(description, /La lectura sugerida va de|porque el vínculo parece acumulativo/i);
});

test('buildEvidenceBreakdown separates metadata, documents, semantic bridges, and explicit relations', () => {
  assert.deepEqual(
    buildEvidenceBreakdown({
      score: 38.4,
      signals: [
        { field: 'metadata_tokens', weight: 2.5 },
        { field: 'document_citations', weight: 8 },
        { field: 'semantic_bridge', weight: 7 },
        { field: 'explicit_relation', weight: 10 },
      ],
    }),
    {
      metadata: 2.5,
      documents: 8,
      semanticBridge: 7,
      explicitRelation: 10,
      total: 38.4,
    },
  );
});

test('classifyConnectionTier separates strong exploratory and discarded candidates', () => {
  const strong = classifyConnectionTier({
    score: 38,
    shared: {
      theoretical_frameworks: ['fenomenologia'],
      domains: ['educacion'],
      themes: [],
      tags: [],
      technologies: [],
      institutions: ['politecnico de la costa atlantica'],
      collaborators: [],
      outputs: [],
    },
    sharedMetadataTokens: ['fenomenologia', 'educacion', 'politecnico'],
    sharedDocSignals: {
      citations: ['Goffman, 1959'],
      theoryTerms: ['fenomenologia'],
      dataTerms: [],
      provenanceTerms: [],
      headings: ['Marco teórico'],
      quotedPhrases: [],
      keyPhrases: ['fenomenologia'],
    },
    docHighlights: ['Marco teórico: fenomenología del rumor.'],
    signals: [
      { field: 'document_citations', weight: 8 },
      { field: 'metadata_tokens', weight: 2 },
      { field: 'semantic_bridge', weight: 7 },
    ],
  });

  const exploratory = classifyConnectionTier({
    score: 24,
    shared: {
      theoretical_frameworks: [],
      domains: [],
      themes: [],
      tags: [],
      technologies: [],
      institutions: ['politecnico de la costa atlantica'],
      collaborators: [],
      outputs: [],
    },
    sharedMetadataTokens: ['politecnico'],
    sharedDocSignals: {
      citations: [],
      theoryTerms: ['caribe'],
      dataTerms: [],
      provenanceTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: ['caribe'],
    },
    docHighlights: [],
    signals: [{ field: 'metadata_tokens', weight: 1.5 }],
  });

  const discarded = classifyConnectionTier({
    score: 11,
    shared: {
      theoretical_frameworks: ['fenomenologia'],
      domains: [],
      themes: [],
      tags: [],
      technologies: [],
      institutions: [],
      collaborators: [],
      outputs: [],
    },
    sharedMetadataTokens: ['investigacion'],
    sharedDocSignals: {
      citations: [],
      theoryTerms: ['fenomenologia'],
      dataTerms: [],
      provenanceTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
    },
    docHighlights: [],
    signals: [{ field: 'document_theory_terms', weight: 2 }],
  });

  assert.equal(strong, 'strong');
  assert.equal(exploratory, 'exploratory');
  assert.equal(discarded, 'discarded');
});

test('applyVisibilityPolicy promotes one decent exploratory link for isolated projects', () => {
  const selected = applyVisibilityPolicy([
    { pairKey: 'alpha::beta', from: 'alpha', to: 'beta', score: 42, tier: 'strong' },
    { pairKey: 'beta::gamma', from: 'beta', to: 'gamma', score: 30, tier: 'exploratory' },
    { pairKey: 'gamma::delta', from: 'gamma', to: 'delta', score: 21, tier: 'exploratory' },
  ], ['alpha', 'beta', 'gamma', 'delta']);

  assert.equal(selected.find((item) => item.pairKey === 'alpha::beta').visibility, 'default');
  assert.equal(selected.find((item) => item.pairKey === 'alpha::beta').selectionReason, 'strong-evidence');
  assert.equal(selected.find((item) => item.pairKey === 'beta::gamma').visibility, 'default');
  assert.equal(selected.find((item) => item.pairKey === 'beta::gamma').selectionReason, 'coverage-floor');
  assert.equal(selected.find((item) => item.pairKey === 'gamma::delta').visibility, 'optional');
});

test('buildLocalDescription differentiates strong and exploratory prose', () => {
  const strong = buildLocalDescription({
    tier: 'strong',
    fromName: 'Paideia',
    toName: 'Collective Memory PWA',
    sharedSummary: ['tecnologías: vite', 'instituciones: politecnico de la costa atlantica'],
    documentEvidence: 'Comparten citas o referencias verificables.',
    docSignals: {
      citations: ['Goffman, 1959'],
      theoryTerms: [],
      dataTerms: [],
      provenanceTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
    },
  });

  const exploratory = buildLocalDescription({
    tier: 'exploratory',
    fromName: 'Kansas-Barranquilla',
    toName: 'Artículo Kevin Cerra',
    sharedSummary: ['palabras compartidas: caribe'],
    documentEvidence: 'Comparten un marco conceptual explícito: caribe.',
    docSignals: {
      citations: [],
      theoryTerms: ['caribe'],
      dataTerms: [],
      provenanceTerms: [],
      headings: [],
      quotedPhrases: [],
      keyPhrases: [],
    },
  });

  assert.match(strong, /se apoya|se basa/i);
  assert.match(exploratory, /todavia|todavía|aun|aún|por ahora/i);
  assert.doesNotMatch(exploratory, /Cruce provisional|se entiende mejor por las señales/i);
});

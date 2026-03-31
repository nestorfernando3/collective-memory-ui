import { lazy, startTransition, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  FileText,
  FolderUp,
  Languages,
  Link2,
  Menu,
  RotateCcw,
  UserRound,
  X,
} from 'lucide-react';

import './App.css';
import { buildProjectConnectionInsights } from './lib/connectionInsights.js';
import { buildGraphModel } from './lib/graphModel.js';
import { normalizeLocale, translateAppSubtitle, translateAppTitle } from './lib/i18n.js';
import { buildProfileNarrative } from './lib/profileNarrative.js';
import { joinBasePath } from './lib/resourcePath.js';

const GraphCanvas = lazy(() => import('./components/GraphCanvas.jsx'));

const STORAGE_KEYS = {
  locale: 'collective-memory-locale',
  hiddenProjectIds: 'collective-memory-hidden-project-ids',
  visibilityMode: 'collective-memory-visibility-mode',
};

const MEMORY_DB_NAME = 'collective-memory-ui';
const MEMORY_STORE_NAME = 'snapshots';
const ACTIVE_SNAPSHOT_KEY = 'active-snapshot';

const FALLBACK_LENS = {
  id: 'All',
  label: 'Universo completo',
  filter: [],
};

const COPY = {
  es: {
    atlasLabel: 'Atlas de memoria',
    subtitleFallback: 'Archivo vivo de trabajo',
    instructionsTitle: 'Importa o sincroniza tu snapshot para explorar la memoria.',
    instructionsBody:
      'Esta interfaz espera una carpeta raíz de Memoria Colectiva con profile.json, connections.json, projects/ y README.md. Si vienes del flujo local, corre una regeneración systemwide y luego sincroniza la UI publicada.',
    onboarding: [
      'Memoria Colectiva convierte tu trabajo en un grafo navegable.',
      'El modo por defecto es systemwide sobre ~/Documents/Collective Memory/.',
      'La acción recomendada es regenerar el snapshot y luego volver a sincronizar la UI.',
    ],
    commandsTitle: 'Comandos recomendados',
    commands: [
      { command: '/memoria systemwide', note: 'Refresca el grafo completo desde la raíz visible.' },
      { command: '/memoria collect', note: 'Reconstruye perfil, conexiones y README en un solo paso.' },
      { command: 'bash collective-memory/scripts/sync.sh', note: 'Copia el snapshot a la UI y publica el build estático.' },
    ],
    openProfile: 'Abrir perfil central',
    active: 'Activos',
    reserve: 'En reserva',
    visibilityDefault: 'Solo puentes activos',
    visibilityAll: 'Mostrar exploratorios',
    languageLabel: 'Idioma',
    sourceLabel: 'Fuente',
    sourceDemo: 'Proyectos personales · demo local',
    visibleProjects: 'proyectos visibles',
    visibleConnections: 'puentes visibles',
    directConnections: 'conexiones directas',
    summary: 'Resumen',
    tags: 'Etiquetas',
    linkedProjects: 'Proyectos enlazados',
    origin: 'Origen',
    destination: 'Destino',
    principalConnections: 'Conexiones principales',
    showAll: 'Ver todas',
    showPrincipal: 'Solo activas',
    noConnections: 'No hay conexiones visibles con el filtro actual.',
    noDescription: 'Sin descripción disponible.',
    exclude: 'Ocultar de esta vista',
    restore: 'Restaurar al grafo',
    hiddenBadge: 'oculto',
    profileChip: 'Persona central',
    connectionChip: 'Conexión',
    projectChip: 'Proyecto',
    optionalBadge: 'Exploratoria',
    defaultBadge: 'Activa',
    hiddenCount: 'ocultos',
    lensLabel: 'Lentes',
    importFolder: 'Cargar carpeta local',
    restorePublished: 'Usar snapshot publicado',
    localMemoryActive: 'memoria local activa',
    graphTab: 'GRAFO',
    guideTab: 'GUÍA',
  },
  en: {
    atlasLabel: 'Memory atlas',
    subtitleFallback: 'Living archive of work',
    instructionsTitle: 'Import or sync your snapshot to explore the memory graph.',
    instructionsBody:
      'This interface expects a Collective Memory root folder with profile.json, connections.json, projects/, and README.md. If you are coming from the local workflow, run a systemwide refresh and then sync the published UI.',
    onboarding: [
      'Collective Memory turns your work into a navigable graph.',
      'The default mode is systemwide over ~/Documents/Collective Memory/.',
      'The recommended next step is to regenerate the snapshot and then sync the published UI again.',
    ],
    commandsTitle: 'Recommended commands',
    commands: [
      { command: '/memoria systemwide', note: 'Refresh the full graph from the visible root.' },
      { command: '/memoria collect', note: 'Rebuild profile, connections, and README in one pass.' },
      { command: 'bash collective-memory/scripts/sync.sh', note: 'Copy the snapshot into the UI and publish the static build.' },
    ],
    openProfile: 'Open central profile',
    active: 'Active',
    reserve: 'In reserve',
    visibilityDefault: 'Only active bridges',
    visibilityAll: 'Show exploratory',
    languageLabel: 'Language',
    sourceLabel: 'Source',
    sourceDemo: 'Personal projects · local demo',
    visibleProjects: 'visible projects',
    visibleConnections: 'visible bridges',
    directConnections: 'direct connections',
    summary: 'Summary',
    tags: 'Tags',
    linkedProjects: 'Linked projects',
    origin: 'Origin',
    destination: 'Destination',
    principalConnections: 'Principal connections',
    showAll: 'Show all',
    showPrincipal: 'Only active',
    noConnections: 'There are no visible connections for the current filter.',
    noDescription: 'No description available.',
    exclude: 'Hide from this view',
    restore: 'Restore to graph',
    hiddenBadge: 'hidden',
    profileChip: 'Central persona',
    connectionChip: 'Connection',
    projectChip: 'Project',
    optionalBadge: 'Exploratory',
    defaultBadge: 'Active',
    hiddenCount: 'hidden',
    lensLabel: 'Lenses',
    importFolder: 'Load local folder',
    restorePublished: 'Use published snapshot',
    localMemoryActive: 'local memory active',
    graphTab: 'GRAPH',
    guideTab: 'GUIDE',
  },
};

function parseStoredJson(key, fallbackValue) {
  if (typeof window === 'undefined') return fallbackValue;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function readStoredLocale() {
  if (typeof window === 'undefined') return 'es';

  try {
    return normalizeLocale(window.localStorage.getItem(STORAGE_KEYS.locale) || 'es');
  } catch {
    return 'es';
  }
}

async function fetchJson(basePath, relativePath) {
  const response = await fetch(joinBasePath(basePath, relativePath));
  if (!response.ok) {
    throw new Error(`Failed to fetch ${relativePath}: ${response.status}`);
  }
  return response.json();
}

async function fetchText(basePath, relativePath) {
  const response = await fetch(joinBasePath(basePath, relativePath));
  if (!response.ok) {
    throw new Error(`Failed to fetch ${relativePath}: ${response.status}`);
  }
  return response.text();
}

async function loadMemoryDataset(basePath) {
  const profile = await fetchJson(basePath, 'data/profile.json');
  const connections = await fetchJson(basePath, 'data/connections.json');
  const projectIndexText = await fetchText(basePath, 'data/projects_index.json');
  const projectFiles = projectIndexText
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value.endsWith('.json'));

  const projects = await Promise.all(
    projectFiles.map((fileName) => fetchJson(basePath, `data/projects/${fileName}`)),
  );

  return {
    profile,
    connections,
    projects,
  };
}

function openMemoryDatabase() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(MEMORY_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEMORY_STORE_NAME)) {
        db.createObjectStore(MEMORY_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open memory database'));
  });
}

async function readStoredSnapshot() {
  const db = await openMemoryDatabase();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEMORY_STORE_NAME, 'readonly');
    const store = tx.objectStore(MEMORY_STORE_NAME);
    const request = store.get(ACTIVE_SNAPSHOT_KEY);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Unable to read stored snapshot'));
    tx.oncomplete = () => db.close();
  });
}

async function writeStoredSnapshot(snapshot) {
  const db = await openMemoryDatabase();
  if (!db) return;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(MEMORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEMORY_STORE_NAME);
    store.put(snapshot, ACTIVE_SNAPSHOT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Unable to store snapshot'));
  });

  db.close();
}

async function clearStoredSnapshot() {
  const db = await openMemoryDatabase();
  if (!db) return;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(MEMORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEMORY_STORE_NAME);
    store.delete(ACTIVE_SNAPSHOT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Unable to clear stored snapshot'));
  });

  db.close();
}

function inferFolderName(paths, fallback = 'Local memory') {
  const firstPath = paths.find(Boolean);
  if (!firstPath) return fallback;

  const segments = String(firstPath).replaceAll('\\', '/').split('/').filter(Boolean);
  return segments.length > 1 ? segments[0] : fallback;
}

function parseImportedEntries(entries, sourceName) {
  const jsonEntries = Array.isArray(entries)
    ? entries.filter((entry) => entry?.path?.toLowerCase?.().endsWith('.json'))
    : [];

  let profile = null;
  let connections = { connections: [] };
  const projects = [];

  for (const entry of jsonEntries) {
    let parsed = null;

    try {
      parsed = JSON.parse(entry.text);
    } catch (error) {
      throw new Error(`JSON inválido en ${entry.path}: ${error instanceof Error ? error.message : 'error desconocido'}`);
    }

    const normalizedPath = entry.path.replaceAll('\\', '/');

    if (normalizedPath.endsWith('/profile.json') || normalizedPath === 'profile.json') {
      profile = parsed;
      continue;
    }

    if (normalizedPath.endsWith('/connections.json') || normalizedPath === 'connections.json') {
      connections = parsed?.connections ? parsed : { connections: [] };
      continue;
    }

    if (normalizedPath.includes('/projects/') || normalizedPath.startsWith('projects/')) {
      projects.push(parsed);
    }
  }

  if (!profile) {
    throw new Error('No encontré profile.json en la carpeta seleccionada.');
  }

  return {
    profile,
    connections,
    projects,
    source: 'local',
    sourceName,
    importedAt: new Date().toISOString(),
  };
}

async function readDirectoryHandleEntries(handle, prefix = handle.name) {
  const entries = [];

  for await (const entry of handle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      entries.push({
        path: `${prefix}/${entry.name}`,
        text: await file.text(),
      });
      continue;
    }

    if (entry.kind === 'directory') {
      const nestedEntries = await readDirectoryHandleEntries(entry, `${prefix}/${entry.name}`);
      entries.push(...nestedEntries);
    }
  }

  return entries;
}

async function readInputEntries(fileList) {
  const files = Array.from(fileList || []);

  return Promise.all(
    files.map(async (file) => ({
      path: file.webkitRelativePath || file.name,
      text: await file.text(),
    })),
  );
}

function App() {
  const [dataset, setDataset] = useState(null);
  const [loadingError, setLoadingError] = useState('');
  const [locale, setLocale] = useState(readStoredLocale);
  const [hiddenProjectIds, setHiddenProjectIds] = useState(() => parseStoredJson(STORAGE_KEYS.hiddenProjectIds, []));
  const [visibilityMode, setVisibilityMode] = useState(() => {
    if (typeof window === 'undefined') return 'default';

    try {
      return window.localStorage.getItem(STORAGE_KEYS.visibilityMode) === 'all' ? 'all' : 'default';
    } catch {
      return 'default';
    }
  });
  const [activeLensId, setActiveLensId] = useState('All');
  const [projectConnectionMode, setProjectConnectionMode] = useState('principal');
  const [drawer, setDrawer] = useState(null);
  const fileInputRef = useRef(null);
  const [viewMode, setViewMode] = useState('graph');

  const language = normalizeLocale(locale);
  const text = COPY[language];
  const basePath = import.meta.env.BASE_URL || './';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const storedSnapshot = await readStoredSnapshot();

        if (cancelled) return;

        if (storedSnapshot) {
          setDataset(storedSnapshot);
          setLoadingError('');
          return;
        }

        const nextDataset = await loadMemoryDataset(basePath);
        if (cancelled) return;
        setDataset(nextDataset);
        setLoadingError('');
      } catch (error) {
        if (cancelled) return;
        setDataset(null);
        setLoadingError(error instanceof Error ? error.message : 'Unable to load data');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [basePath]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.locale, language);
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.hiddenProjectIds, JSON.stringify(hiddenProjectIds));
  }, [hiddenProjectIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.visibilityMode, visibilityMode);
  }, [visibilityMode]);

  const availableLenses = useMemo(
    () => (dataset?.profile?.lenses?.length ? dataset.profile.lenses : [FALLBACK_LENS]),
    [dataset],
  );
  const safeLensId = availableLenses.some((lens) => lens.id === activeLensId) ? activeLensId : availableLenses[0].id;

  useEffect(() => {
    if (safeLensId !== activeLensId) {
      setActiveLensId(safeLensId);
    }
  }, [activeLensId, safeLensId]);

  const graph = useMemo(
    () =>
      dataset
        ? buildGraphModel({
            profile: dataset.profile,
            projects: dataset.projects,
            connections: dataset.connections,
            hiddenProjectIds,
            locale: language,
            activeLensId: safeLensId,
            visibilityMode,
          })
        : null,
    [dataset, hiddenProjectIds, language, safeLensId, visibilityMode],
  );

  const renderedNodes = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        selected:
          (drawer?.type === 'profile' && node.id === 'user_profile') ||
          (drawer?.type === 'project' && node.id === drawer.project.id),
      },
    }));
  }, [drawer, graph]);

  const renderedEdges = useMemo(() => {
    if (!graph) return [];

    return graph.edges.map((edge) => ({
      ...edge,
      animated: edge.data?.kind === 'profile-link',
    }));
  }, [graph]);

  const profileNarrative = useMemo(() => {
    if (!dataset) return null;

    return buildProfileNarrative({
      profile: dataset.profile,
      projects: dataset.projects,
      connections: dataset.connections,
      hiddenProjectIds,
      locale: language,
    });
  }, [dataset, hiddenProjectIds, language]);

  const selectedProjectAllInsights = useMemo(() => {
    if (drawer?.type !== 'project' || !dataset) return [];

    return buildProjectConnectionInsights({
      projectId: drawer.project.id,
      projects: dataset.projects,
      connections: dataset.connections.connections,
      locale: language,
      visibilityMode: 'all',
    });
  }, [dataset, drawer, language]);

  const selectedProjectInsights = useMemo(() => {
    if (drawer?.type !== 'project') return [];

    return projectConnectionMode === 'all'
      ? selectedProjectAllInsights
      : selectedProjectAllInsights.filter((item) => item.visibility === 'default');
  }, [drawer, projectConnectionMode, selectedProjectAllInsights]);

  const title = translateAppTitle(dataset?.profile?.site_title, language) || dataset?.profile?.site_title || 'Collective Memory';
  const subtitle =
    translateAppSubtitle(dataset?.profile?.site_subtitle, language) ||
    dataset?.profile?.site_subtitle ||
    text.subtitleFallback;
  const activeConnectionsLabel = `${graph?.meta.visibleConnectionCount || 0} ${text.visibleConnections}`;
  const sourceDisplayLabel =
    dataset?.source === 'local'
      ? `${dataset.sourceName || 'Local memory'} · ${text.localMemoryActive}`
      : text.sourceDemo;
  const showGraph = Boolean(graph);
  const showInstructions = viewMode === 'instructions' || !graph;

  function openProfile() {
    if (!profileNarrative) return;
    setDrawer({
      type: 'profile',
      profile: profileNarrative,
    });
  }

  function openProject(project) {
    setProjectConnectionMode('principal');
    setDrawer({
      type: 'project',
      project,
    });
  }

  function openConnection(connectionInsight) {
    setDrawer({
      type: 'connection',
      connection: connectionInsight,
    });
  }

  function toggleProjectVisibility(projectId) {
    setHiddenProjectIds((current) => {
      if (current.includes(projectId)) {
        return current.filter((value) => value !== projectId);
      }
      return [...current, projectId];
    });
  }

  function handleNodeClick(_event, node) {
    if (node.id === 'user_profile') {
      openProfile();
      return;
    }

    if (node.data?.project) {
      openProject(node.data.project);
    }
  }

  function handleEdgeClick(_event, edge) {
    if (edge.data?.kind === 'connection' && edge.data.insight) {
      openConnection(edge.data.insight);
    }
  }

  async function handleImportEntries(entries, sourceName) {
    const importedDataset = parseImportedEntries(entries, sourceName);
    await writeStoredSnapshot(importedDataset);
    setDataset(importedDataset);
    setLoadingError('');
    setDrawer(null);
  }

  async function handleImportFolder() {
    try {
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        const handle = await window.showDirectoryPicker();
        const entries = await readDirectoryHandleEntries(handle);
        await handleImportEntries(entries, handle.name);
        return;
      }

      fileInputRef.current?.click();
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setLoadingError(error instanceof Error ? error.message : 'No pude cargar la carpeta local');
    }
  }

  async function handleFileInputChange(event) {
    const files = event.target.files;
    if (!files?.length) return;

    try {
      const entries = await readInputEntries(files);
      await handleImportEntries(entries, inferFolderName(entries.map((entry) => entry.path)));
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : 'No pude importar la carpeta local');
    } finally {
      event.target.value = '';
    }
  }

  async function handleRestorePublished() {
    try {
      await clearStoredSnapshot();
      const publishedDataset = await loadMemoryDataset(basePath);
      setDataset(publishedDataset);
      setLoadingError('');
      setDrawer(null);
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : 'No pude restaurar el snapshot publicado');
    }
  }

  const flowKey = [safeLensId, visibilityMode, hiddenProjectIds.join(','), language].join('::');

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".json"
        webkitdirectory=""
        directory=""
        className="hidden-folder-input"
        onChange={handleFileInputChange}
      />

      <aside className="sidebar">
        <div className="sidebar-copy">
          <span className="header-kicker">{text.atlasLabel}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="header-chips">
          <span className="header-chip">{activeConnectionsLabel}</span>
          <span className="header-chip">{sourceDisplayLabel}</span>
          {dataset?.source === 'local' ? <span className="header-chip local">{text.localMemoryActive}</span> : null}
        </div>

        <div className="sidebar-toolbar">
          <div className="mode-switch">
            <button
              className={`mode-tab ${viewMode === 'graph' ? 'active' : ''}`}
              type="button"
              onClick={() => setViewMode('graph')}
            >
              <Menu size={14} />
              {text.graphTab}
            </button>
            <button
              className={`mode-tab ${viewMode === 'instructions' ? 'active' : ''}`}
              type="button"
              onClick={() => setViewMode('instructions')}
            >
              <FileText size={14} />
              {text.guideTab}
            </button>
          </div>
          <div className="toolbar-actions">
            <button className="ghost-chip" type="button" onClick={handleImportFolder}>
              <FolderUp size={14} />
              {text.importFolder}
            </button>
            {dataset?.source === 'local' ? (
              <button className="ghost-chip" type="button" onClick={handleRestorePublished}>
                <RotateCcw size={14} />
                {text.restorePublished}
              </button>
            ) : null}
            <button
              className="ghost-chip"
              type="button"
              onClick={() => setLocale((current) => (normalizeLocale(current) === 'es' ? 'en' : 'es'))}
            >
              <Languages size={14} />
              {text.languageLabel}: {language.toUpperCase()}
            </button>
            <button
              className="ghost-chip"
              type="button"
              onClick={() =>
                startTransition(() => {
                  setVisibilityMode((current) => (current === 'default' ? 'all' : 'default'));
                })
              }
            >
              {visibilityMode === 'default' ? <Eye size={14} /> : <EyeOff size={14} />}
              {visibilityMode === 'default' ? text.visibilityAll : text.visibilityDefault}
            </button>
          </div>
        </div>

        {showInstructions ? (
          <>
            <section className="sidebar-card">
              <h2>{text.instructionsTitle}</h2>
              <p>{text.instructionsBody}</p>
              {loadingError ? <p className="error-line">{loadingError}</p> : null}
              <ol className="instructions-list">
                {text.onboarding.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>
            <section className="sidebar-card">
              <h3>{text.commandsTitle}</h3>
              <div className="command-list">
                {text.commands.map((item) => (
                  <div className="command-row" key={item.command}>
                    <code>{item.command}</code>
                    <span>{item.note}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="sidebar-card sidebar-card-notice">
              <p>
                {dataset?.source === 'local'
                  ? `${text.localMemoryActive}. ${text.sourceLabel}: ${sourceDisplayLabel}.`
                  : `${text.sourceLabel}: ${sourceDisplayLabel}.`}
              </p>
            </section>
            <section className="sidebar-card">
              <h3>{text.importFolder}</h3>
              <p>{subtitle}</p>
              <button className="secondary-btn sidebar-card-action" type="button" onClick={handleImportFolder}>
                <FolderUp size={14} />
                {text.importFolder}
              </button>
            </section>
            <section className="sidebar-card">
              <h3>{text.openProfile}</h3>
              <p>{text.visibleProjects} · {text.visibleConnections}</p>
              <button className="secondary-btn sidebar-card-action" type="button" onClick={openProfile}>
                <UserRound size={14} />
                {text.openProfile}
              </button>
            </section>
            {showGraph ? (
              <>
                <section className="sidebar-card sidebar-graph-summary">
                  <h3>{text.summary}</h3>
                  <div className="stats-grid">
                    <StatCard
                      label={text.visibleProjects}
                      value={graph?.meta.visibleProjectCount || 0}
                      note={
                        hiddenProjectIds.length
                          ? `${hiddenProjectIds.length} ${text.hiddenCount}`
                          : null
                      }
                    />
                    <StatCard
                      label={text.visibleConnections}
                      value={graph?.meta.visibleConnectionCount || 0}
                      note={`${graph?.meta.strongConnectionCount || 0} ${text.active} · ${graph?.meta.exploratoryConnectionCount || 0} ${text.reserve}`}
                    />
                    <StatCard
                      label={text.sourceLabel}
                      value={sourceDisplayLabel}
                      compact
                      note={visibilityMode === 'default' ? text.visibilityDefault : text.visibilityAll}
                    />
                  </div>
                </section>

                <section className="sidebar-card sidebar-lenses">
                  <div className="lens-panel-header">
                    <span className="lens-panel-title">{text.lensLabel}</span>
                    <span className="lens-panel-note">
                      {visibilityMode === 'default' ? text.visibilityDefault : text.visibilityAll}
                    </span>
                  </div>
                  <div className="lens-controls">
                    {availableLenses.map((lens) => (
                      <button
                        key={lens.id}
                        className={`lens-btn ${safeLensId === lens.id ? 'active' : ''}`}
                        type="button"
                        onClick={() =>
                          startTransition(() => {
                            setActiveLensId(lens.id);
                          })
                        }
                      >
                        {lens.label}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </>
        )}
      </aside>

      <main className="stage">
        {showGraph ? (
          <Suspense
            fallback={
              <div className="graph-loading-surface" aria-live="polite">
                <span className="graph-loading-label">Loading graph...</span>
              </div>
            }
          >
            <GraphCanvas
              key={flowKey}
              nodes={renderedNodes}
              edges={renderedEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
            />
          </Suspense>
        ) : null}
      </main>

      <aside className={`drawer ${drawer ? 'open' : ''}`}>
        <button className="drawer-close" type="button" onClick={() => setDrawer(null)}>
          <X size={20} />
        </button>

        {drawer?.type === 'profile' && profileNarrative ? (
          <>
            <div className="drawer-header">
              <span className="drawer-type">{text.profileChip}</span>
              <h2>{profileNarrative.name}</h2>
            </div>
            <div className="drawer-meta">
              <div className="meta-item">
                <FileText size={16} />
                <span>{profileNarrative.headline}</span>
              </div>
              <div className="meta-item">
                <Link2 size={16} />
                <span>
                  {profileNarrative.stats.projectCount} {text.visibleProjects} · {profileNarrative.stats.connectionCount} {text.visibleConnections}
                </span>
              </div>
            </div>
            <h3 className="drawer-section-title">{text.summary}</h3>
            <div className="drawer-content drawer-profile-overview">{profileNarrative.overview}</div>
            {profileNarrative.sections.map((section) => (
              <section key={section.title}>
                <h3 className="drawer-section-title">{section.title}</h3>
                <div className="drawer-content">
                  {section.items?.length ? (
                    <ul className="drawer-list">
                      {section.items.map((item, index) => (
                        <li key={`${section.title}-${index}`}>
                          {typeof item === 'string'
                            ? item
                            : item.pairLabel
                              ? `${item.pairLabel}${item.label ? ` · ${item.label}` : ''}: ${item.description || item.summary || item.reason || item.type || ''}`
                              : item.label || item.title
                              ? `${item.label || item.title}: ${item.description || item.summary || item.reason || item.type || ''}`
                              : JSON.stringify(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{text.noDescription}</p>
                  )}
                </div>
              </section>
            ))}
          </>
        ) : null}

        {drawer?.type === 'project' ? (
          <>
            <div className="drawer-header">
              <span className="drawer-type">{text.projectChip}</span>
              <h2>{drawer.project.name || drawer.project.title || drawer.project.id}</h2>
            </div>
            <div className="drawer-meta">
              <div className="meta-item">
                <FileText size={16} />
                <span>{drawer.project.type || drawer.project.status || text.projectChip}</span>
              </div>
              <div className="meta-item">
                <Link2 size={16} />
                <span>{selectedProjectInsights.length} {text.directConnections}</span>
              </div>
            </div>
            <div className="drawer-actions">
              <button className="secondary-btn drawer-action-btn" type="button" onClick={() => toggleProjectVisibility(drawer.project.id)}>
                {hiddenProjectIds.includes(drawer.project.id) ? text.restore : text.exclude}
              </button>
            </div>
            <h3 className="drawer-section-title">{text.summary}</h3>
            <div className="drawer-content">{drawer.project.abstract || drawer.project.description || text.noDescription}</div>

            {(drawer.project.tags || []).length ? (
              <>
                <h3 className="drawer-section-title">{text.tags}</h3>
                <div className="tag-list">
                  {drawer.project.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            ) : null}

            <div className="drawer-section-header">
              <h3 className="drawer-section-title">{text.principalConnections}</h3>
              {selectedProjectAllInsights.some((item) => item.visibility === 'optional') ? (
                <button
                  className="drawer-inline-action"
                  type="button"
                  onClick={() => setProjectConnectionMode((current) => (current === 'principal' ? 'all' : 'principal'))}
                >
                  {projectConnectionMode === 'principal' ? text.showAll : text.showPrincipal}
                </button>
              ) : null}
            </div>

            {selectedProjectInsights.length ? (
              <div className="connection-list">
                {selectedProjectInsights.map((item) => (
                  <button
                    className={`connection-list-item ${drawer.connection?.id === item.id ? 'selected' : ''}`}
                    key={item.id}
                    type="button"
                    onClick={() => openConnection(item)}
                  >
                    <span className="connection-list-item-label">{item.label}</span>
                    <span className="connection-list-item-meta">
                      {item.type} · {item.strengthLabel}
                    </span>
                    <span className="connection-list-item-meta subtle">
                      {item.visibility === 'optional' ? text.optionalBadge : text.defaultBadge}
                    </span>
                    <span className="connection-list-item-description">{item.description || text.noDescription}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="drawer-empty-state">{text.noConnections}</p>
            )}
          </>
        ) : null}

        {drawer?.type === 'connection' ? (
          <>
            <div className="drawer-header">
              <span className="drawer-type">{text.connectionChip}</span>
              <h2>{drawer.connection.label}</h2>
            </div>
            <div className="drawer-meta">
              <div className="meta-item">
                <FileText size={16} />
                <span>{drawer.connection.type}</span>
              </div>
              <div className="meta-item">
                <Link2 size={16} />
                <span>
                  {drawer.connection.strengthLabel} · {drawer.connection.visibility === 'optional' ? text.optionalBadge : text.defaultBadge}
                </span>
              </div>
            </div>
            <h3 className="drawer-section-title">{text.summary}</h3>
            <div className="drawer-content">{drawer.connection.description || text.noDescription}</div>
            <h3 className="drawer-section-title">{text.linkedProjects}</h3>
            <div className="connection-projects">
              <button className="connection-project-btn" type="button" onClick={() => openProject(drawer.connection.sourceProject)}>
                <span>{text.origin}</span>
                <strong>{drawer.connection.sourceLabel}</strong>
              </button>
              <button className="connection-project-btn" type="button" onClick={() => openProject(drawer.connection.targetProject)}>
                <span>{text.destination}</span>
                <strong>{drawer.connection.targetLabel}</strong>
              </button>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}

function StatCard({ label, value, note, compact = false }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className={`stat-value ${compact ? 'stat-value-compact' : ''}`}>{value}</strong>
      {note ? <span className="stat-note">{note}</span> : null}
    </div>
  );
}

export default App;

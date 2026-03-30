import { startTransition, useEffect, useState } from 'react';
import {
  Background,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Eye,
  EyeOff,
  FileText,
  Languages,
  Link2,
  UserRound,
  X,
} from 'lucide-react';

import './App.css';
import { buildProjectConnectionInsights } from './lib/connectionInsights.js';
import { buildGraphModel } from './lib/graphModel.js';
import { normalizeLocale, translateAppSubtitle, translateAppTitle } from './lib/i18n.js';
import { buildProfileNarrative } from './lib/profileNarrative.js';
import { joinBasePath } from './lib/resourcePath.js';

const nodeTypes = {
  project: ProjectNode,
  profile: ProfileNode,
};

const STORAGE_KEYS = {
  locale: 'collective-memory-locale',
  hiddenProjectIds: 'collective-memory-hidden-project-ids',
  visibilityMode: 'collective-memory-visibility-mode',
};

const FALLBACK_LENS = {
  id: 'All',
  label: 'Universo completo',
  filter: [],
};

const COPY = {
  es: {
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
    sourceDemo: 'Demo local',
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
  },
  en: {
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
    sourceDemo: 'Local demo',
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
  },
};

function ProjectNode({ data }) {
  return (
    <div className={`glass-node ${data.selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} style={hiddenHandleStyle} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />
      <div className="node-title">{data.label}</div>
      {data.subtitle ? <div className="node-subtitle">{data.subtitle}</div> : null}
    </div>
  );
}

function ProfileNode({ data }) {
  return (
    <div className="glass-node core-node">
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />
      <div className="node-title">{data.label}</div>
      {data.subtitle ? <div className="node-subtitle">{data.subtitle}</div> : null}
    </div>
  );
}

const hiddenHandleStyle = {
  opacity: 0,
  pointerEvents: 'none',
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
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const language = normalizeLocale(locale);
  const text = COPY[language];
  const basePath = import.meta.env.BASE_URL || './';

  useEffect(() => {
    let cancelled = false;

    loadMemoryDataset(basePath)
      .then((nextDataset) => {
        if (cancelled) return;
        setDataset(nextDataset);
        setLoadingError('');
      })
      .catch((error) => {
        if (cancelled) return;
        setDataset(null);
        setLoadingError(error instanceof Error ? error.message : 'Unable to load data');
      });

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

  const availableLenses = dataset?.profile?.lenses?.length ? dataset.profile.lenses : [FALLBACK_LENS];
  const safeLensId = availableLenses.some((lens) => lens.id === activeLensId) ? activeLensId : availableLenses[0].id;

  useEffect(() => {
    if (safeLensId !== activeLensId) {
      setActiveLensId(safeLensId);
    }
  }, [activeLensId, safeLensId]);

  const graph = dataset
    ? buildGraphModel({
        profile: dataset.profile,
        projects: dataset.projects,
        connections: dataset.connections,
        hiddenProjectIds,
        locale: language,
        activeLensId: safeLensId,
        visibilityMode,
      })
    : null;

  useEffect(() => {
    if (!graph) {
      setNodes([]);
      setEdges([]);
      return;
    }

    setNodes(
      graph.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          selected:
            (drawer?.type === 'profile' && node.id === 'user_profile') ||
            (drawer?.type === 'project' && node.id === drawer.project.id),
        },
      })),
    );
    setEdges(
      graph.edges.map((edge) => ({
        ...edge,
        markerEnd: edge.data?.kind === 'connection'
          ? {
              type: MarkerType.ArrowClosed,
              color: edge.style?.stroke || '#1a1a1a',
            }
          : undefined,
        animated: edge.data?.kind === 'profile-link',
      })),
    );
  }, [drawer, graph, setEdges, setNodes]);

  const profileNarrative = dataset
    ? buildProfileNarrative({
        profile: dataset.profile,
        projects: dataset.projects,
        connections: dataset.connections,
        hiddenProjectIds,
        locale: language,
      })
    : null;

  const selectedProjectAllInsights =
    drawer?.type === 'project' && dataset
      ? buildProjectConnectionInsights({
          projectId: drawer.project.id,
          projects: dataset.projects,
          connections: dataset.connections.connections,
          locale: language,
          visibilityMode: 'all',
        })
      : [];

  const selectedProjectInsights =
    drawer?.type === 'project' && dataset
      ? (projectConnectionMode === 'all'
          ? selectedProjectAllInsights
          : selectedProjectAllInsights.filter((item) => item.visibility === 'default'))
      : [];

  const title = translateAppTitle(dataset?.profile?.site_title, language) || dataset?.profile?.site_title || 'Collective Memory';
  const subtitle =
    translateAppSubtitle(dataset?.profile?.site_subtitle, language) ||
    dataset?.profile?.site_subtitle ||
    text.subtitleFallback;

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

  const flowKey = [safeLensId, visibilityMode, hiddenProjectIds.join(','), language].join('::');

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="ghost-chip" type="button" onClick={openProfile}>
            <UserRound size={14} />
            {text.openProfile}
          </button>
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
      </header>

      <section className="hud-panel hud-top">
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
            value={text.sourceDemo}
            note={visibilityMode === 'default' ? text.visibilityDefault : text.visibilityAll}
          />
        </div>
      </section>

      <section className="hud-panel hud-bottom">
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

      {graph ? (
        <ReactFlow
          key={flowKey}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.2}
          maxZoom={1.6}
        >
          <Background gap={36} color="rgba(26, 26, 26, 0.12)" size={1.1} />
        </ReactFlow>
      ) : (
        <section className="instructions-page">
          <div className="instructions-card">
            <h2>{text.instructionsTitle}</h2>
            <p>{text.instructionsBody}</p>
            {loadingError ? <p className="error-line">{loadingError}</p> : null}
            <ol className="instructions-list">
              {text.onboarding.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
          <div className="instructions-card">
            <h3>{text.commandsTitle}</h3>
            <div className="command-list">
              {text.commands.map((item) => (
                <div className="command-row" key={item.command}>
                  <code>{item.command}</code>
                  <span>{item.note}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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

function StatCard({ label, value, note }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {note ? <span className="stat-note">{note}</span> : null}
    </div>
  );
}

export default App;

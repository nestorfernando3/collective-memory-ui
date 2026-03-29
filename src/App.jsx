import React, { useEffect, useState } from 'react';
import {
  Background,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Database,
  FileText,
  FolderUp,
  Info,
  Link as LinkIcon,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { extractMemoryBundleFromEntries } from './lib/memoryBundle';
import {
  clearPersistedSnapshot,
  loadPersistedSnapshot,
  savePersistedSnapshot,
} from './lib/memoryStore';

const BASE = import.meta.env.BASE_URL;

const ACTIVE_STATUSES = [
  'activo',
  'active',
  'en desarrollo',
  'en proceso',
  'en construcción',
  'en ejecución',
  'en postulación',
  'materiales listos',
];

const nodeTypes = {
  custom: CustomNode,
};

function CustomNode({ data }) {
  return (
    <div className={`glass-node ${data.isCore ? 'core-node' : ''} ${data.selected ? 'selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }}
      />
      <div className="node-title">{data.label}</div>
      {data.status && <div className="node-subtitle">{data.status}</div>}
    </div>
  );
}

async function loadDemoBundle() {
  const profileResponse = await fetch(`${BASE}data/profile.json`);
  if (!profileResponse.ok) {
    throw new Error('No demo profile data');
  }

  const profile = await profileResponse.json();

  const connectionsResponse = await fetch(`${BASE}data/connections.json`);
  const connections = connectionsResponse.ok ? await connectionsResponse.json() : { connections: [] };

  const indexResponse = await fetch(`${BASE}data/projects_index.json`);
  if (!indexResponse.ok) {
    throw new Error('No demo project index');
  }

  const indexText = await indexResponse.text();
  const projectFiles = indexText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.endsWith('.json'));

  const projects = [];
  for (const file of projectFiles) {
    const projectResponse = await fetch(`${BASE}data/projects/${file}`);
    if (projectResponse.ok) {
      projects.push(await projectResponse.json());
    }
  }

  return {
    connections: connections?.connections ? connections : { connections: [] },
    importedAt: new Date().toISOString(),
    profile,
    projects,
    sourceLabel: 'Demo incluida',
  };
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Sin fecha';

  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

function getBundleSummary(bundle, mode) {
  if (!bundle) {
    return {
      connectionCount: 0,
      importedAt: '',
      projectCount: 0,
      sourceLabel: mode === 'local' ? 'Memoria local' : 'Demo incluida',
    };
  }

  return {
    connectionCount: Array.isArray(bundle.connections?.connections) ? bundle.connections.connections.length : 0,
    importedAt: bundle.importedAt || '',
    projectCount: Array.isArray(bundle.projects) ? bundle.projects.length : 0,
    sourceLabel: bundle.sourceLabel || (mode === 'local' ? 'Memoria local' : 'Demo incluida'),
  };
}

function FlowApp() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [rawProfile, setRawProfile] = useState(null);
  const [rawConnections, setRawConnections] = useState({ connections: [] });
  const [rawProjects, setRawProjects] = useState([]);
  const [demoBundle, setDemoBundle] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [memoryMode, setMemoryMode] = useState('demo');
  const [memorySummary, setMemorySummary] = useState({
    connectionCount: 0,
    importedAt: '',
    projectCount: 0,
    sourceLabel: 'Demo incluida',
  });
  const [uploadFeedback, setUploadFeedback] = useState({
    kind: 'info',
    text: 'Cargando memoria inicial...',
  });

  const [selectedProject, setSelectedProject] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeLens, setActiveLens] = useState('All');
  const [siteTitle, setSiteTitle] = useState('Collective Memory');
  const [siteSubtitle, setSiteSubtitle] = useState('Personal Operating System');
  const [lenses, setLenses] = useState([]);

  const { setCenter, fitView } = useReactFlow();

  const hydrateBundle = (bundle, mode) => {
    if (!bundle?.profile) return;

    const profile = bundle.profile;
    const connections = bundle.connections || { connections: [] };
    const projects = Array.isArray(bundle.projects) ? bundle.projects : [];
    const summary = getBundleSummary(bundle, mode);

    setRawProfile(profile);
    setRawConnections(connections);
    setRawProjects(projects);
    setMemoryMode(mode);
    setMemorySummary(summary);
    setSiteTitle(profile.site_title || profile.name || 'Collective Memory');
    setSiteSubtitle(profile.site_subtitle || profile.affiliations?.[0]?.role || 'Personal Operating System');
    document.title = profile.site_title || profile.name || 'Collective Memory';
    setLenses(
      profile.lenses || [
        { id: 'All', label: 'Full Universe', filter: [] },
        { id: 'Academic', label: 'Academic Lens', filter: ['research', 'academic', 'paper'] },
        { id: 'Creative', label: 'Creative Lens', filter: ['creative', 'art', 'writing'] },
      ],
    );
    setActiveLens('All');
    setSelectedProject(null);
    setIsDrawerOpen(false);
  };

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setIsLoading(true);

      try {
        const [demo, persisted] = await Promise.all([
          loadDemoBundle().catch((error) => ({ error })),
          loadPersistedSnapshot().catch(() => null),
        ]);

        if (cancelled) return;

        if (demo?.error) {
          setDemoBundle(null);
          setUploadFeedback({
            kind: 'error',
            text: demo.error.message || 'No se pudo cargar la demo incluida.',
          });
        } else {
          setDemoBundle(demo);
        }

        if (persisted?.profile) {
          hydrateBundle(persisted, 'local');
          setUploadFeedback({
            kind: 'success',
            text: `Memoria local restaurada automáticamente desde ${persisted.sourceLabel || 'este navegador'}.`,
          });
        } else if (demo && !demo.error) {
          hydrateBundle(demo, 'demo');
          setUploadFeedback({
            kind: 'info',
            text: 'Mostrando la demo incluida. Sube tu carpeta local para guardarla en este navegador.',
          });
        }
      } catch (error) {
        if (cancelled) return;

        setDemoBundle(null);
        setRawProfile(null);
        setRawConnections({ connections: [] });
        setRawProjects([]);
        setUploadFeedback({
          kind: 'error',
          text: error.message || 'No se pudo iniciar Collective Memory.',
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!rawProfile) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const newNodes = [];
    const newEdges = [];

    newNodes.push({
      id: 'user_profile',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: rawProfile.name,
        isCore: true,
        status: rawProfile.affiliations?.[0]?.role || '',
      },
    });

    const profileLenses = rawProfile.lenses || [
      { id: 'All', label: 'Full Universe', filter: [] },
      { id: 'Academic', label: 'Academic Lens', filter: ['research', 'academic', 'paper'] },
      { id: 'Creative', label: 'Creative Lens', filter: ['creative', 'art', 'writing'] },
    ];

    const currentLens = profileLenses.find((lens) => lens.id === activeLens);
    const filteredProjects =
      currentLens && Array.isArray(currentLens.filter) && currentLens.filter.length > 0
        ? rawProjects.filter((project) => {
            const tags = [...(project.tags || []), ...(project.domains || []), ...(project.themes || [])].map((tag) =>
              typeof tag === 'string' ? tag.toLowerCase() : '',
            );

            return tags.some((tag) => currentLens.filter.includes(tag));
          })
        : rawProjects;

    const innerRing = filteredProjects.filter((project) =>
      ACTIVE_STATUSES.some((status) =>
        (project.status || '').toLowerCase().replace(/_/g, ' ').includes(status.split(' ')[0]),
      ),
    );
    const outerRing = filteredProjects.filter(
      (project) =>
        !ACTIVE_STATUSES.some((status) =>
          (project.status || '').toLowerCase().replace(/_/g, ' ').includes(status.split(' ')[0]),
        ),
    );

    const NODE_W = 210;
    const innerRadius = Math.max(260, Math.ceil((innerRing.length * NODE_W) / (2 * Math.PI)));
    const outerRadius = Math.max(innerRadius + 200, Math.ceil((outerRing.length * NODE_W) / (2 * Math.PI)));

    const placeRing = (ring, radius, startAngle = 0) => {
      const step = (2 * Math.PI) / (ring.length || 1);

      ring.forEach((project, index) => {
        const angle = startAngle + step * index;

        newNodes.push({
          id: project.id,
          type: 'custom',
          position: {
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle),
          },
          data: {
            label: project.name || project.title || project.id,
            status: project.status,
            fullData: project,
          },
        });

        newEdges.push({
          id: `e-user-${project.id}`,
          source: 'user_profile',
          target: project.id,
          animated: true,
          style: { stroke: 'rgba(26,26,26,0.18)', strokeWidth: 1 },
        });
      });
    };

    placeRing(innerRing, innerRadius, -Math.PI / 2);
    const outerOffset = outerRing.length > 1 ? Math.PI / outerRing.length : Math.PI / 8;
    placeRing(outerRing, outerRadius, -Math.PI / 2 + outerOffset);

    (rawConnections.connections || []).forEach((connection, index) => {
      const source = connection.source || connection.from;
      const target = connection.target || connection.to;

      if (newNodes.find((node) => node.id === source) && newNodes.find((node) => node.id === target)) {
        newEdges.push({
          id: `e-${source}-${target}-${index}`,
          source,
          target,
          animated: false,
          label: connection.type,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#E63946' },
          style: { stroke: '#E63946', strokeWidth: 2 },
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);

    const timer = window.setTimeout(() => fitView({ padding: 0.18 }), 50);
    return () => window.clearTimeout(timer);
  }, [rawConnections, rawProfile, rawProjects, activeLens, fitView, setEdges, setNodes]);

  useEffect(() => {
    const onResize = () => fitView({ padding: 0.18 });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitView]);

  const onNodeClick = (_, node) => {
    if (node.id === 'user_profile') return;

    setNodes((currentNodes) =>
      currentNodes.map((currentNode) => ({
        ...currentNode,
        data: { ...currentNode.data, selected: currentNode.id === node.id },
      })),
    );

    setSelectedProject(node.data.fullData);
    setIsDrawerOpen(true);
    setCenter(node.position.x + 225, node.position.y, { zoom: 1, duration: 600 });
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setNodes((currentNodes) =>
      currentNodes.map((currentNode) => ({
        ...currentNode,
        data: { ...currentNode.data, selected: false },
      })),
    );
  };

  const handleFolderUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    try {
      const entries = [];
      for (const file of files) {
        if (!file.name.endsWith('.json')) continue;
        entries.push({
          name: file.name,
          path: file.webkitRelativePath || file.name,
          text: await file.text(),
        });
      }

      const bundle = extractMemoryBundleFromEntries(entries);
      await savePersistedSnapshot(bundle);
      hydrateBundle(bundle, 'local');
      setUploadFeedback({
        kind: 'success',
        text: `Memoria guardada en este navegador: ${bundle.projects.length} proyectos y ${bundle.connections.connections.length} conexiones.`,
      });
    } catch (error) {
      setUploadFeedback({
        kind: 'error',
        text: error.message || 'No se pudo leer la carpeta seleccionada.',
      });
    }
  };

  const clearLocalMemory = async () => {
    try {
      await clearPersistedSnapshot();

      if (demoBundle) {
        hydrateBundle(demoBundle, 'demo');
        setUploadFeedback({
          kind: 'info',
          text: 'Memoria local borrada. Ahora estás viendo la demo incluida.',
        });
      } else {
        setRawProfile(null);
        setRawConnections({ connections: [] });
        setRawProjects([]);
        setMemoryMode('demo');
        setMemorySummary({
          connectionCount: 0,
          importedAt: '',
          projectCount: 0,
          sourceLabel: 'Demo incluida',
        });
        setUploadFeedback({
          kind: 'info',
          text: 'Memoria local borrada. Sube una carpeta para volver a cargar contenido.',
        });
      }
    } catch (error) {
      setUploadFeedback({
        kind: 'error',
        text: error.message || 'No se pudo borrar la memoria local.',
      });
    }
  };

  const returnToDemo = () => {
    if (!demoBundle) return;

    hydrateBundle(demoBundle, 'demo');
    setUploadFeedback({
      kind: 'info',
      text: 'Vista de demo activada temporalmente. Tu memoria local sigue guardada en este navegador.',
    });
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <p className="guide-kicker">
            <Sparkles size={14} />
            Collective Memory
          </p>
          <h1>Cargando memoria</h1>
          <p>Estamos recuperando la demo incluida y la última memoria local guardada.</p>
        </div>
      </div>
    );
  }

  const projectTags = selectedProject
    ? [...(selectedProject.tags || []), ...(selectedProject.themes || []), ...(selectedProject.domains || [])].map((tag) =>
        typeof tag === 'string' ? tag.trim() : '',
      )
    : [];
  const uniqueTags = [...new Set(projectTags)].filter(Boolean);
  const isLocalMemory = memoryMode === 'local';

  return (
    <div className="app-shell">
      <aside className="guide-panel">
        <div className="guide-brand">
          <p className="guide-kicker">
            <Sparkles size={14} />
            Collective Memory
          </p>
          <h1>{siteTitle}</h1>
          <p className="subtitle">{siteSubtitle}</p>
        </div>

        <div className={`status-box ${uploadFeedback.kind}`}>
          <Info size={16} />
          <span>{uploadFeedback.text}</span>
        </div>

        <div className="guide-steps">
          <section className="guide-step">
            <span className="guide-step-index">1</span>
            <h2>Instala el skill</h2>
            <p>
              Activa <code>collective-memory</code> en tu agente para poder generar y mantener la base local de
              conocimiento.
            </p>
          </section>

          <section className="guide-step">
            <span className="guide-step-index">2</span>
            <h2>Recopila la información</h2>
            <p>
              Ejecuta <code>/memoria scan</code>, <code>/memoria register</code>, <code>/memoria profile</code> y{' '}
              <code>/memoria connections</code> para construir el snapshot.
            </p>
          </section>

          <section className="guide-step">
            <span className="guide-step-index">3</span>
            <h2>Súbelo aquí</h2>
            <p>
              Selecciona la carpeta raíz que contiene <code>profile.json</code>, <code>connections.json</code> y
              <code>projects/</code>. El navegador guardará la última memoria.
            </p>
          </section>
        </div>

        <div className="guide-actions">
          <label className="upload-btn">
            <FolderUp size={20} />
            Cargar carpeta local
            <input
              type="file"
              webkitdirectory="true"
              directory="true"
              multiple
              onChange={handleFolderUpload}
              style={{ display: 'none' }}
            />
          </label>

          <button className="secondary-btn" onClick={clearLocalMemory} disabled={!isLocalMemory && !demoBundle}>
            <Trash2 size={16} />
            Limpiar memoria local
          </button>

          <button className="ghost-btn" onClick={returnToDemo} disabled={!isLocalMemory || !demoBundle}>
            <RotateCcw size={16} />
            Volver a demo
          </button>
        </div>

        <div className="guide-meta">
          <div className="meta-row">
            <span>
              <Database size={14} />
              Origen
            </span>
            <strong>{memorySummary.sourceLabel}</strong>
          </div>
          <div className="meta-row">
            <span>
              <FileText size={14} />
              Proyectos
            </span>
            <strong>{memorySummary.projectCount}</strong>
          </div>
          <div className="meta-row">
            <span>
              <LinkIcon size={14} />
              Conexiones
            </span>
            <strong>{memorySummary.connectionCount}</strong>
          </div>
          <div className="meta-row">
            <span>Última importación</span>
            <strong>{formatTimestamp(memorySummary.importedAt)}</strong>
          </div>
        </div>

        <p className="privacy-note">
          Tus archivos se leen en el navegador. La memoria importada se guarda sólo en este dispositivo usando IndexedDB.
        </p>
      </aside>

      <main className="graph-panel">
        <div className="header">
          <div>
            <h1>{siteTitle}</h1>
            <p>{siteSubtitle}</p>
          </div>
          <span className={`source-chip ${isLocalMemory ? 'local' : 'demo'}`}>
            {isLocalMemory ? 'Memoria local activa' : 'Demo incluida'}
          </span>
        </div>

        <div className="lens-controls">
          {lenses.map((lens) => (
            <button
              key={lens.id}
              className={`lens-btn ${activeLens === lens.id ? 'active' : ''}`}
              onClick={() => setActiveLens(lens.id)}
            >
              {lens.label}
            </button>
          ))}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.18 }}
        >
          <Background gap={40} color="var(--ink-black)" size={1} />
        </ReactFlow>

        <div className={`drawer ${isDrawerOpen ? 'open' : ''}`}>
          <button className="drawer-close" onClick={closeDrawer}>
            <X size={24} />
          </button>

          {selectedProject && (
            <>
              <div className="drawer-header">
                <span className="drawer-type">{selectedProject.status}</span>
                <h2 style={{ marginTop: '0.5rem' }}>{selectedProject.name || selectedProject.title}</h2>
              </div>

              <div className="drawer-meta">
                <div className="meta-item">
                  <FileText size={16} />
                  <span>{selectedProject.type}</span>
                </div>
                {selectedProject.path && (
                  <div className="meta-item">
                    <LinkIcon size={16} />
                    <span>{selectedProject.path}</span>
                  </div>
                )}
              </div>

              <h3 className="drawer-section-title">Summary</h3>
              <div className="drawer-content">
                {selectedProject.abstract || selectedProject.description || 'No description available.'}
              </div>

              {uniqueTags.length > 0 && (
                <>
                  <h3 className="drawer-section-title">Tags</h3>
                  <div className="tag-list">
                    {uniqueTags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowApp />
    </ReactFlowProvider>
  );
}

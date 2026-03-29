import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  clearPersistedDirectoryHandle,
  clearPersistedHiddenProjectIds,
  clearPersistedMemory,
  loadPersistedHiddenProjectIds,
  loadPersistedDirectoryHandle,
  loadPersistedSnapshot,
  savePersistedHiddenProjectIds,
  savePersistedDirectoryHandle,
  savePersistedSnapshot,
} from './lib/memoryStore';
import {
  ensureDirectoryPermission,
  queryDirectoryPermission,
  readMemoryBundleFromDirectoryHandle,
} from './lib/memorySync';
import { filterVisibleProjects } from './lib/projectVisibility';
import { buildProfileNarrative } from './lib/profileNarrative';

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
    <div
      className={`glass-node ${data.isCore ? 'core-node' : ''} ${data.selected ? 'selected' : ''}`}
      data-testid={data.isCore ? 'core-node' : `project-node-${data.projectId || 'unknown'}`}
    >
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
  const profileResponse = await fetch(`${BASE}data/example.profile.json`);
  if (!profileResponse.ok) {
    throw new Error('No demo profile data');
  }

  const profile = await profileResponse.json();

  const connectionsResponse = await fetch(`${BASE}data/example.connections.json`);
  const connections = connectionsResponse.ok ? await connectionsResponse.json() : { connections: [] };

  const projectFiles = [
    'example.project.json',
    'example.project-2.json',
    'example.project-3.json',
    'example.project-4.json',
    'example.project-5.json',
    'example.project-6.json',
    'example.project-7.json',
  ];

  const projects = [];
  for (const file of projectFiles) {
    const projectResponse = await fetch(`${BASE}data/${file}`);
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
  const [directoryPickerSupported, setDirectoryPickerSupported] = useState(false);
  const [directoryPermission, setDirectoryPermission] = useState('none');
  const [hasAuthorizedDirectory, setHasAuthorizedDirectory] = useState(false);
  const [autoSyncActive, setAutoSyncActive] = useState(false);
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

  const [selectedContext, setSelectedContext] = useState(null);
  const [hiddenProjectIds, setHiddenProjectIds] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeLens, setActiveLens] = useState('All');
  const [siteTitle, setSiteTitle] = useState('Collective Memory');
  const [siteSubtitle, setSiteSubtitle] = useState('Personal Operating System');
  const [lenses, setLenses] = useState([]);

  const { setCenter, fitView } = useReactFlow();
  const directoryHandleRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const syncInFlightRef = useRef(false);

  const visibleProjects = filterVisibleProjects(rawProjects, hiddenProjectIds);
  const personaNarrative = rawProfile
    ? buildProfileNarrative({
        profile: rawProfile,
        projects: rawProjects,
        connections: rawConnections,
        hiddenProjectIds,
      })
    : null;

  const hydrateBundle = useCallback((bundle, mode) => {
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
    setSelectedContext(null);
    setIsDrawerOpen(false);
  }, []);

  const stopAutoSyncLoop = useCallback(() => {
    if (typeof window !== 'undefined' && syncIntervalRef.current) {
      window.clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    setAutoSyncActive(false);
  }, []);

  const syncAuthorizedDirectory = useCallback(async (directoryHandle, options = {}) => {
    if (!directoryHandle || syncInFlightRef.current) return false;

    const { allowPermissionPrompt = false, reason = 'manual' } = options;
    syncInFlightRef.current = true;

    try {
      const permission = await queryDirectoryPermission(directoryHandle);
      setDirectoryPermission(permission);

      if (permission !== 'granted') {
        if (allowPermissionPrompt) {
          const granted = await ensureDirectoryPermission(directoryHandle);
          const nextPermission = await queryDirectoryPermission(directoryHandle);
          setDirectoryPermission(nextPermission);

          if (!granted) {
            stopAutoSyncLoop();
            if (reason !== 'interval' && reason !== 'resume') {
              setUploadFeedback({
                kind: 'info',
                text: 'La carpeta sigue sin permiso para sincronizar. Vuelve a autorizarla para reactivar la sincronización automática.',
              });
            }
            return false;
          }
        } else {
          stopAutoSyncLoop();
          if (reason !== 'interval' && reason !== 'resume') {
            setUploadFeedback({
              kind: 'info',
              text: 'La carpeta guardada necesita reautorización antes de volver a sincronizar.',
            });
          }
          return false;
        }
      }

      const bundle = await readMemoryBundleFromDirectoryHandle(directoryHandle, {
        sourceLabel: directoryHandle.name || 'Carpeta local',
      });

      hydrateBundle(bundle, 'local');
      setHasAuthorizedDirectory(true);
      setDirectoryPermission('granted');
      setAutoSyncActive(true);

      try {
        await savePersistedSnapshot(bundle);
      } catch {
        if (reason !== 'interval' && reason !== 'resume') {
          setUploadFeedback({
            kind: 'success',
            text: `Sincronización activa con ${bundle.sourceLabel}, pero no se pudo guardar el snapshot en este navegador.`,
          });
        }
        return true;
      }

      if (reason !== 'interval' && reason !== 'resume') {
        setUploadFeedback({
          kind: 'success',
          text: `Sincronización automática activa con ${bundle.sourceLabel}.`,
        });
      }

      return true;
    } catch (error) {
      stopAutoSyncLoop();
      if (reason !== 'interval' && reason !== 'resume') {
        setUploadFeedback({
          kind: 'error',
          text: error.message || 'No se pudo sincronizar la carpeta autorizada.',
        });
      }
      return false;
    } finally {
      syncInFlightRef.current = false;
    }
  }, [hydrateBundle, stopAutoSyncLoop]);

  const startAutoSyncLoop = useCallback((directoryHandle) => {
    if (typeof window === 'undefined') return;

    stopAutoSyncLoop();
    syncIntervalRef.current = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void syncAuthorizedDirectory(directoryHandle, { reason: 'interval' });
    }, 30000);
    setAutoSyncActive(true);
  }, [stopAutoSyncLoop, syncAuthorizedDirectory]);

  const persistHiddenProjects = useCallback(async (nextHiddenProjectIds) => {
    const normalized = [...new Set((Array.isArray(nextHiddenProjectIds) ? nextHiddenProjectIds : []).map((value) => String(value || '').trim()).filter(Boolean))];
    setHiddenProjectIds(normalized);

    try {
      await savePersistedHiddenProjectIds(normalized);
    } catch {
      // Hidden selection is a local preference; the UI still works if persistence fails.
    }

    return normalized;
  }, []);

  const handleDirectoryAction = useCallback(async () => {
    const savedHandle = directoryHandleRef.current;

    if (savedHandle) {
      const synced = await syncAuthorizedDirectory(savedHandle, {
        allowPermissionPrompt: true,
        reason: 'manual',
      });

      if (synced) {
        startAutoSyncLoop(savedHandle);
      }

      return;
    }

    if (!directoryPickerSupported || typeof window.showDirectoryPicker !== 'function') {
      setUploadFeedback({
        kind: 'error',
        text: 'Tu navegador no soporta la autorización de carpetas. Usa la carga manual de una sola vez.',
      });
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      directoryHandleRef.current = handle;
      setHasAuthorizedDirectory(true);

      try {
        await savePersistedDirectoryHandle(handle);
      } catch {
        setUploadFeedback({
          kind: 'info',
          text: 'La carpeta quedó autorizada, pero no se pudo guardar el handle para la próxima visita.',
        });
      }

      const synced = await syncAuthorizedDirectory(handle, {
        allowPermissionPrompt: false,
        reason: 'manual',
      });

      if (synced) {
        startAutoSyncLoop(handle);
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        setUploadFeedback({
          kind: 'info',
          text: 'Autorización cancelada. No se cambió la memoria actual.',
        });
        return;
      }

      setUploadFeedback({
        kind: 'error',
        text: error.message || 'No se pudo autorizar la carpeta.',
      });
    }
  }, [
    directoryPickerSupported,
    startAutoSyncLoop,
    syncAuthorizedDirectory,
  ]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setIsLoading(true);
      const pickerSupported = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
      setDirectoryPickerSupported(pickerSupported);

      try {
        const [demo, persistedSnapshot, persistedHandle, persistedHiddenIds] = await Promise.all([
          loadDemoBundle().catch((error) => ({ error })),
          loadPersistedSnapshot().catch(() => null),
          loadPersistedDirectoryHandle().catch(() => null),
          loadPersistedHiddenProjectIds().catch(() => []),
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

        if (persistedSnapshot?.profile) {
          hydrateBundle(persistedSnapshot, 'local');
          setUploadFeedback({
            kind: 'success',
            text: `Memoria local restaurada automáticamente desde ${persistedSnapshot.sourceLabel || 'este navegador'}.`,
          });
        } else if (demo && !demo.error) {
          hydrateBundle(demo, 'demo');
          setUploadFeedback({
            kind: 'info',
            text: 'Mostrando la demo incluida. Sube tu carpeta local para guardarla en este navegador.',
          });
        }

        if (!cancelled) {
          setHiddenProjectIds(Array.isArray(persistedHiddenIds) ? persistedHiddenIds : []);
        }

        if (persistedHandle) {
          directoryHandleRef.current = persistedHandle;
          setHasAuthorizedDirectory(true);

          const permission = await queryDirectoryPermission(persistedHandle);
          if (cancelled) return;

          setDirectoryPermission(permission);

          if (permission === 'granted') {
            const synced = await syncAuthorizedDirectory(persistedHandle, {
              reason: 'boot',
              allowPermissionPrompt: false,
            });

            if (!cancelled && synced) {
              startAutoSyncLoop(persistedHandle);
            }
          } else {
            stopAutoSyncLoop();
            if (!cancelled) {
              setUploadFeedback({
                kind: 'info',
                text: 'La carpeta está guardada, pero necesita reautorización para reactivar la sincronización automática.',
              });
            }
          }
        } else {
          setHasAuthorizedDirectory(false);
          setDirectoryPermission('none');
          stopAutoSyncLoop();
        }
      } catch (error) {
        if (cancelled) return;

        setDemoBundle(null);
        setRawProfile(null);
        setRawConnections({ connections: [] });
        setRawProjects([]);
        stopAutoSyncLoop();
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
      stopAutoSyncLoop();
    };
  }, [startAutoSyncLoop, stopAutoSyncLoop, syncAuthorizedDirectory, hydrateBundle]);

  useEffect(() => {
    const syncOnResume = () => {
      if (!autoSyncActive || memoryMode !== 'local') return;

      const directoryHandle = directoryHandleRef.current;
      if (!directoryHandle || document.visibilityState !== 'visible') return;

      void syncAuthorizedDirectory(directoryHandle, {
        allowPermissionPrompt: false,
        reason: 'resume',
      });
    };

    window.addEventListener('focus', syncOnResume);
    document.addEventListener('visibilitychange', syncOnResume);

    return () => {
      window.removeEventListener('focus', syncOnResume);
      document.removeEventListener('visibilitychange', syncOnResume);
    };
  }, [autoSyncActive, memoryMode, syncAuthorizedDirectory]);

  useEffect(() => {
    if (!rawProfile) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const newNodes = [];
    const newEdges = [];
    const projectsForGraph = filterVisibleProjects(rawProjects, hiddenProjectIds);

    newNodes.push({
      id: 'user_profile',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: rawProfile.name,
        isCore: true,
        status: rawProfile.affiliations?.[0]?.role || '',
        projectId: 'user_profile',
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
        ? projectsForGraph.filter((project) => {
            const tags = [...(project.tags || []), ...(project.domains || []), ...(project.themes || [])].map((tag) =>
              typeof tag === 'string' ? tag.toLowerCase() : '',
            );

            return tags.some((tag) => currentLens.filter.includes(tag));
          })
        : projectsForGraph;

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
            projectId: project.id,
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
  }, [rawConnections, rawProfile, rawProjects, hiddenProjectIds, activeLens, fitView, setEdges, setNodes]);

  useEffect(() => {
    const onResize = () => fitView({ padding: 0.18 });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitView]);

  const onNodeClick = (_, node) => {
    setNodes((currentNodes) =>
      currentNodes.map((currentNode) => ({
        ...currentNode,
        data: { ...currentNode.data, selected: currentNode.id === node.id },
      })),
    );

    if (node.id === 'user_profile') {
      setSelectedContext({
        type: 'profile',
      });
      setIsDrawerOpen(true);
      setCenter(node.position.x + 225, node.position.y, { zoom: 1, duration: 600 });
      return;
    }

    setSelectedContext({
      type: 'project',
      data: node.data.fullData,
    });
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
    setSelectedContext(null);
  };

  const excludeProjectFromSelection = async (projectId) => {
    const nextHiddenIds = await persistHiddenProjects([...hiddenProjectIds, projectId]);
    if (selectedContext?.type === 'project' && selectedContext?.data?.id === projectId) {
      closeDrawer();
    }
    setUploadFeedback({
      kind: 'info',
      text: `El proyecto ${projectId} quedó fuera de la selección visible.`,
    });
    return nextHiddenIds;
  };

  const restoreProjectToSelection = async (projectId) => {
    const nextHiddenIds = await persistHiddenProjects(hiddenProjectIds.filter((hiddenId) => hiddenId !== projectId));
    setUploadFeedback({
      kind: 'info',
      text: `El proyecto ${projectId} volvió a la selección visible.`,
    });
    return nextHiddenIds;
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
      stopAutoSyncLoop();
      directoryHandleRef.current = null;
      setHasAuthorizedDirectory(false);
      setDirectoryPermission('none');
      await clearPersistedDirectoryHandle().catch(() => null);
      await savePersistedSnapshot(bundle);
      hydrateBundle(bundle, 'local');
      setUploadFeedback({
        kind: 'success',
        text: `Importación única guardada en este navegador: ${bundle.projects.length} proyectos y ${bundle.connections.connections.length} conexiones. Si quieres sincronización automática, autoriza una carpeta.`,
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
      stopAutoSyncLoop();
      directoryHandleRef.current = null;
      setHasAuthorizedDirectory(false);
      setDirectoryPermission('none');
      setHiddenProjectIds([]);
      await clearPersistedHiddenProjectIds().catch(() => null);
      await clearPersistedMemory();

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

    stopAutoSyncLoop();
    hydrateBundle(demoBundle, 'demo');
    setUploadFeedback({
      kind: 'info',
      text: 'Vista de demo activada temporalmente. La carpeta autorizada sigue guardada, pero la sincronización automática quedó en pausa.',
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

  const selectedProject = selectedContext?.type === 'project' ? selectedContext.data : null;
  const selectedProfileNarrative = selectedContext?.type === 'profile' ? personaNarrative : null;
  const projectTags = selectedProject
    ? [...(selectedProject.tags || []), ...(selectedProject.themes || []), ...(selectedProject.domains || [])].map((tag) =>
        typeof tag === 'string' ? tag.trim() : '',
      )
    : [];
  const uniqueTags = [...new Set(projectTags)].filter(Boolean);
  const isLocalMemory = memoryMode === 'local';
  const visibleProjectCount = visibleProjects.length;
  const hiddenProjectCount = hiddenProjectIds.length;
  const directoryPermissionLabel = {
    none: 'Sin autorizar',
    granted: 'Concedido',
    prompt: 'Pendiente',
    denied: 'Denegado',
    unsupported: 'No disponible',
  }[directoryPermission] || directoryPermission;
  const syncStatusLabel = autoSyncActive
    ? 'Activa'
    : hasAuthorizedDirectory
      ? 'En pausa'
      : 'No configurada';
  const directoryActionLabel = hasAuthorizedDirectory
    ? directoryPermission === 'granted'
      ? 'Sincronizar ahora'
      : 'Reautorizar carpeta'
    : 'Autorizar carpeta y sincronizar';
  const directoryActionDisabled = !hasAuthorizedDirectory && !directoryPickerSupported;
  const hiddenProjects = hiddenProjectIds
    .map((projectId) => rawProjects.find((project) => project.id === projectId) || { id: projectId })
    .filter(Boolean);

  return (
    <div className="app-shell">
      <aside className="guide-panel" data-testid="guide-panel">
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
            <h2>Autoriza la carpeta</h2>
            <p>
              Si tu navegador lo soporta, autoriza la carpeta raíz que contiene <code>profile.json</code>,{' '}
              <code>connections.json</code> y <code>projects/</code>. El navegador volverá a leerla de forma
              automática.
            </p>
          </section>
        </div>

        <div className="guide-actions">
          <button
            className="secondary-btn"
            onClick={handleDirectoryAction}
            disabled={directoryActionDisabled && !hasAuthorizedDirectory}
            data-testid="directory-action-btn"
          >
            <FolderUp size={20} />
            {directoryActionLabel}
          </button>

          <label className="upload-btn" data-testid="import-button">
            <FolderUp size={20} />
            Importar carpeta local
            <input
              type="file"
              webkitdirectory="true"
              directory="true"
              multiple
              onChange={handleFolderUpload}
              style={{ display: 'none' }}
            />
          </label>

          <button
            className="secondary-btn"
            onClick={clearLocalMemory}
            disabled={!isLocalMemory && !demoBundle}
            data-testid="clear-memory-btn"
          >
            <Trash2 size={16} />
            Limpiar memoria local
          </button>

          <button className="ghost-btn" onClick={returnToDemo} disabled={!isLocalMemory || !demoBundle} data-testid="demo-btn">
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
              <RotateCcw size={14} />
              Sincronización
            </span>
            <strong>{syncStatusLabel}</strong>
          </div>
          <div className="meta-row">
            <span>Permiso</span>
            <strong>{directoryPermissionLabel}</strong>
          </div>
          <div className="meta-row">
            <span>
              <FileText size={14} />
              Proyectos
            </span>
            <strong>
              {visibleProjectCount}/{memorySummary.projectCount}
            </strong>
          </div>
          <div className="meta-row">
            <span>Ocultos</span>
            <strong>{hiddenProjectCount}</strong>
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
          Tus archivos se leen en el navegador. La memoria importada se guarda sólo en este dispositivo usando
          IndexedDB. Si autorizas una carpeta, el navegador conserva ese permiso y vuelve a leerla automáticamente.
        </p>

        {hiddenProjects.length > 0 && (
          <section className="hidden-projects">
            <div className="hidden-projects-header">
              <h2>Proyectos excluidos</h2>
              <span>{hiddenProjects.length}</span>
            </div>
            <div className="hidden-projects-list" data-testid="excluded-projects-list">
              {hiddenProjects.map((project) => (
                <button
                  key={project.id}
                  className="hidden-project-chip"
                  onClick={() => restoreProjectToSelection(project.id)}
                  data-testid={`restore-project-btn-${project.id}`}
                >
                  <span>{project.name || project.id}</span>
                  <X size={14} />
                </button>
              ))}
            </div>
          </section>
        )}
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

        <div className={`drawer ${isDrawerOpen ? 'open' : ''}`} data-testid="drawer" data-drawer-mode={selectedContext?.type || 'empty'}>
          <button className="drawer-close" onClick={closeDrawer} data-testid="drawer-close-btn">
            <X size={24} />
          </button>

          {selectedProfileNarrative && (
            <>
              <div className="drawer-header">
                <span className="drawer-type">Persona central</span>
                <h2 style={{ marginTop: '0.5rem' }}>{selectedProfileNarrative.name}</h2>
              </div>

              <div className="drawer-meta">
                <div className="meta-item">
                  <FileText size={16} />
                  <span>{selectedProfileNarrative.headline}</span>
                </div>
                <div className="meta-item">
                  <LinkIcon size={16} />
                  <span>
                    {selectedProfileNarrative.stats.projectCount} proyectos · {selectedProfileNarrative.stats.connectionCount} conexiones
                  </span>
                </div>
              </div>

              <h3 className="drawer-section-title">Biografía</h3>
              <div className="drawer-content drawer-profile-overview">{selectedProfileNarrative.overview}</div>

              {selectedProfileNarrative.sections.map((section) => (
                <div key={section.title}>
                  <h3 className="drawer-section-title">{section.title}</h3>
                  <div className="drawer-content">
                    {section.items.length > 0 ? (
                      <ul className="drawer-list">
                        {section.items.map((item, index) => (
                          <li key={`${section.title}-${index}`}>
                            {typeof item === 'string' ? (
                              item
                            ) : (
                              <>
                                {item.label && <strong>{item.label}</strong>}
                                {item.label && item.description ? ': ' : ''}
                                {item.description || item.summary || item.reason || item.title || JSON.stringify(item)}
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No hay contenido estructurado para esta sección.</p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

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

              <div className="drawer-actions">
                <button
                  className="secondary-btn drawer-action-btn"
                  onClick={() =>
                    hiddenProjectIds.includes(selectedProject.id)
                      ? restoreProjectToSelection(selectedProject.id)
                      : excludeProjectFromSelection(selectedProject.id)
                  }
                  data-testid="exclude-project-btn"
                >
                  {hiddenProjectIds.includes(selectedProject.id) ? 'Restaurar en la selección' : 'Excluir de la selección'}
                </button>
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

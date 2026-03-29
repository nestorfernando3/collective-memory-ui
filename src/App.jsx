import React, { useState, useEffect } from 'react';
import { ReactFlow, ReactFlowProvider, Background, useNodesState, useEdgesState, MarkerType, Handle, Position, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, FileText, Link as LinkIcon, FolderUp } from 'lucide-react';

const CustomNode = ({ data }) => {
  return (
    <div className={`glass-node ${data.isCore ? 'core-node' : ''} ${data.selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
      <div className="node-title">{data.label}</div>
      {data.status && <div className="node-subtitle">{data.status}</div>}
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

const BASE = import.meta.env.BASE_URL;

function FlowApp() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Raw Data State
  const [rawProfile, setRawProfile] = useState(null);
  const [rawConnections, setRawConnections] = useState({ connections: [] });
  const [rawProjects, setRawProjects] = useState([]);
  
  const [isEmptyState, setIsEmptyState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedProject, setSelectedProject] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeLens, setActiveLens] = useState('All');
  
  const [siteTitle, setSiteTitle] = useState('Collective Memory');
  const [siteSubtitle, setSiteSubtitle] = useState('Personal Operating System');
  const [lenses, setLenses] = useState([]);
  
  const { setCenter, fitView } = useReactFlow();

  // 1. Initial Fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const profRes = await fetch(`${BASE}data/profile.json`);
        if (!profRes.ok) throw new Error('No profile data');
        const profile = await profRes.json();
        
        const connRes = await fetch(`${BASE}data/connections.json`);
        const connectionsData = connRes.ok ? await connRes.json() : { connections: [] };

        const idxRes = await fetch(`${BASE}data/projects_index.json`);
        if (!idxRes.ok) throw new Error('No index file');
        const idxText = await idxRes.text();
        const files = idxText.trim().split('\n').filter(f => f.endsWith('.json'));
        
        const projects = [];
        for (const file of files) {
          const res = await fetch(`${BASE}data/projects/${file}`);
          if(res.ok) projects.push(await res.json());
        }

        setRawProfile(profile);
        setRawConnections(connectionsData);
        setRawProjects(projects);
        setIsEmptyState(false);
      } catch {
        setIsEmptyState(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // 2. Build Graph Pipeline
  useEffect(() => {
    if (!rawProfile) return;

    setSiteTitle(rawProfile.site_title || rawProfile.name || 'Collective Memory');
    setSiteSubtitle(rawProfile.site_subtitle || rawProfile.affiliations?.[0]?.role || 'Personal Operating System');
    document.title = rawProfile.site_title || rawProfile.name || 'Collective Memory';

    const profileLenses = rawProfile.lenses || [
      { id: 'All', label: 'Full Universe', filter: [] },
      { id: 'Academic', label: 'Academic Lens', filter: ['research', 'academic', 'research-proposal'] }
    ];
    setLenses(profileLenses);

    const newNodes = [];
    const newEdges = [];

    newNodes.push({
      id: 'user_profile',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { label: rawProfile.name, isCore: true, status: rawProfile.affiliations?.[0]?.role || '' }
    });

    let filteredProjects = rawProjects;
    const currentLens = profileLenses.find(l => l.id === activeLens);
    if (currentLens && currentLens.filter && currentLens.filter.length > 0) {
      filteredProjects = rawProjects.filter(p => {
        const tags = [...(p.tags || []), ...(p.domains || []), ...(p.themes || [])].map(t => typeof t === 'string' ? t.toLowerCase() : '');
        return tags.some(t => currentLens.filter.includes(t));
      });
    }

    const ACTIVE_STATUSES = ['activo', 'active', 'en desarrollo', 'en proceso', 'en construcción', 'en ejecución', 'en postulación', 'materiales listos'];
    const innerRing = filteredProjects.filter(p =>
      ACTIVE_STATUSES.some(s => (p.status || '').toLowerCase().replace(/_/g, ' ').includes(s.split(' ')[0]))
    );
    const outerRing = filteredProjects.filter(p =>
      !ACTIVE_STATUSES.some(s => (p.status || '').toLowerCase().replace(/_/g, ' ').includes(s.split(' ')[0]))
    );

    const NODE_W = 210;
    const innerRadius = Math.max(260, Math.ceil(innerRing.length * NODE_W / (2 * Math.PI)));
    const outerRadius = Math.max(innerRadius + 200, Math.ceil(outerRing.length * NODE_W / (2 * Math.PI)));

    const placeRing = (ring, radius, startAngle = 0) => {
      const step = (2 * Math.PI) / (ring.length || 1);
      ring.forEach((proj, idx) => {
        const angle = startAngle + step * idx;
        newNodes.push({
          id: proj.id,
          type: 'custom',
          position: {
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle),
          },
          data: {
            label: proj.name || proj.title || proj.id,
            status: proj.status,
            fullData: proj,
          },
        });
        newEdges.push({
          id: `e-user-${proj.id}`,
          source: 'user_profile',
          target: proj.id,
          animated: true,
          style: { stroke: 'rgba(26,26,26,0.18)', strokeWidth: 1 },
        });
      });
    };

    placeRing(innerRing, innerRadius, -Math.PI / 2);
    const outerOffset = outerRing.length > 1 ? Math.PI / outerRing.length : Math.PI / 8;
    placeRing(outerRing, outerRadius, -Math.PI / 2 + outerOffset);

    (rawConnections.connections || []).forEach((conn, index) => {
      const src = conn.source || conn.from;
      const tgt = conn.target || conn.to;
      if(newNodes.find(n => n.id === src) && newNodes.find(n => n.id === tgt)) {
          newEdges.push({
            id: `e-${src}-${tgt}-${index}`,
            source: src,
            target: tgt,
            animated: false,
            label: conn.type,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#E63946' },
            style: { stroke: '#E63946', strokeWidth: 2 }
          });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
    
    // Fitview a bit after nodes actually render
    setTimeout(() => fitView({ padding: 0.18 }), 50);

  }, [rawProfile, rawConnections, rawProjects, activeLens, setNodes, setEdges, fitView]);

  useEffect(() => {
    const onResize = () => fitView({ padding: 0.18 });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitView]);

  const onNodeClick = (event, node) => {
    if (node.id === 'user_profile') return;
    
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, selected: n.id === node.id }
    })));

    setSelectedProject(node.data.fullData);
    setIsDrawerOpen(true);
    setCenter(node.position.x + 225, node.position.y, { zoom: 1, duration: 600 });
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, selected: false }
    })));
  };

  const handleFolderUpload = async (event) => {
    const files = Array.from(event.target.files);
    let profile = null;
    let connectionsData = { connections: [] };
    const projects = [];

    for (const file of files) {
      const name = file.name;
      const path = file.webkitRelativePath || name;
      
      // Basic filtering to avoid reading heavy non-json files
      if (!name.endsWith('.json')) continue;

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        
        if (name === 'profile.json') profile = json;
        else if (name === 'connections.json') connectionsData = json;
        else if (path.includes('/projects/') || path.includes('\\projects\\')) {
          projects.push(json);
        }
      } catch {
        console.warn(`Skipped unparseable JSON: ${name}`);
      }
    }

    if (profile) {
      setRawProfile(profile);
      setRawConnections(connectionsData);
      setRawProjects(projects);
      setIsEmptyState(false);
    } else {
      alert('⚠️ profile.json no encontrado. Debes seleccionar la carpeta raíz que contiene profile.json y la subcarpeta projects/.');
    }
  };

  if (isLoading) return null;

  if (isEmptyState && !rawProfile) {
    return (
      <div className="onboarding-container">
        <div className="onboarding-card">
          <h1>🧠 Collective Memory</h1>
          <p className="subtitle">Visualiza tu universo de investigación de forma privada y local.</p>
          
          <div className="upload-section">
            <label className="upload-btn">
              <FolderUp size={24} />
              Cargar Carpeta de Memoria Local
              <input 
                type="file" 
                webkitdirectory="true" 
                directory="true" 
                multiple 
                onChange={handleFolderUpload} 
                style={{ display: 'none' }} 
              />
            </label>
            <p className="hint">Selecciona la carpeta que contiene tu <code>profile.json</code> y la subcarpeta <code>/projects</code>.</p>
            <p className="privacy-note">🔒 Tus archivos se leen directamente en tu navegador y no se envían a ningún servidor.</p>
          </div>
        </div>
      </div>
    );
  }

  const projectTags = selectedProject ? [...(selectedProject.tags || []), ...(selectedProject.themes || []), ...(selectedProject.domains || [])].map(t => typeof t === 'string' ? t.trim() : '') : [];
  const uniqueTags = [...new Set(projectTags)].filter(Boolean);

  return (
    <div className="app-container">
      
      <div className="header">
        <h1>{siteTitle}</h1>
        <p>{siteSubtitle}</p>
      </div>

      <div className="lens-controls">
        {lenses.map(lens => (
          <button 
            key={lens.id}
            className={`lens-btn ${activeLens === lens.id ? 'active' : ''}`}
            onClick={() => setActiveLens(lens.id)}
          >
            {lens.label}
          </button>
        ))}
      </div>

      {/* Floating Upload Button for loaded state overlay */}
      <div className="floating-upload">
        <label title="Cargar otra memoria" className="mini-upload-btn">
          <FolderUp size={20} />
          <input 
            type="file" 
            webkitdirectory="true" 
            directory="true" 
            multiple 
            onChange={handleFolderUpload} 
            style={{ display: 'none' }} 
          />
        </label>
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
        <button className="drawer-close" onClick={closeDrawer}><X size={24} /></button>
        
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
              {selectedProject.abstract || selectedProject.description || "No description available."}
            </div>

            {uniqueTags.length > 0 && (
               <>
                 <h3 className="drawer-section-title">Tags</h3>
                 <div className="tag-list">
                   {uniqueTags.map(t => (
                     <span key={t} className="tag">{t}</span>
                   ))}
                 </div>
               </>
            )}
          </>
        )}
      </div>

    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowApp />
    </ReactFlowProvider>
  )
}


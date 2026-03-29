import React, { useState, useEffect } from 'react';
import { ReactFlow, ReactFlowProvider, Background, useNodesState, useEdgesState, MarkerType, Handle, Position, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, FileText, Link as LinkIcon } from 'lucide-react';

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
  const [selectedProject, setSelectedProject] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeLens, setActiveLens] = useState('All');
  const [siteTitle, setSiteTitle] = useState('Collective Memory');
  const [siteSubtitle, setSiteSubtitle] = useState('Personal Operating System');
  const [lenses, setLenses] = useState([]);
  
  const { setCenter, fitView } = useReactFlow();

  useEffect(() => {
    const loadData = async () => {
      try {
        const profRes = await fetch(`${BASE}data/profile.json`);
        const profile = await profRes.json();
        
        // Dynamic site title from profile
        setSiteTitle(profile.site_title || profile.name || 'Collective Memory');
        setSiteSubtitle(profile.site_subtitle || profile.affiliations?.[0]?.role || 'Personal Operating System');
        document.title = profile.site_title || profile.name || 'Collective Memory';

        // Dynamic lenses from profile
        const profileLenses = profile.lenses || [
          { id: 'All', label: 'Full Universe', filter: [] },
          { id: 'Academic', label: 'Academic Lens', filter: ['research', 'academic', 'research-proposal'] }
        ];
        setLenses(profileLenses);

        const connRes = await fetch(`${BASE}data/connections.json`);
        const connectionsData = await connRes.json();

        const idxRes = await fetch(`${BASE}data/projects_index.json`);
        const idxText = await idxRes.text();
        const files = idxText.trim().split('\n').filter(f => f.endsWith('.json'));
        
        const projects = [];
        for (const file of files) {
          const res = await fetch(`${BASE}data/projects/${file}`);
          projects.push(await res.json());
        }

        const newNodes = [];
        const newEdges = [];

        // Central Core Node — anchored at origin for screen-size-independent layout
        newNodes.push({
          id: 'user_profile',
          type: 'custom',
          position: { x: 0, y: 0 },
          data: { label: profile.name, isCore: true, status: profile.affiliations?.[0]?.role || '' }
        });

        // Lenses Engine
        let filteredProjects = projects;
        const currentLens = profileLenses.find(l => l.id === activeLens);
        if (currentLens && currentLens.filter && currentLens.filter.length > 0) {
          filteredProjects = projects.filter(p => {
            const tags = [...(p.tags || []), ...(p.domains || []), ...(p.themes || [])].map(t => t.toLowerCase());
            return tags.some(t => currentLens.filter.includes(t));
          });
        }

        // Split into two rings by activity level
        const ACTIVE_STATUSES = ['activo', 'active', 'en desarrollo', 'en proceso', 'en construcción',
                                  'en ejecución', 'en postulación', 'materiales listos'];
        const innerRing = filteredProjects.filter(p =>
          ACTIVE_STATUSES.some(s => (p.status || '').toLowerCase().replace(/_/g, ' ').includes(s.split(' ')[0]))
        );
        const outerRing = filteredProjects.filter(p =>
          !ACTIVE_STATUSES.some(s => (p.status || '').toLowerCase().replace(/_/g, ' ').includes(s.split(' ')[0]))
        );

        // Normalized coordinate space — small numbers, fitView handles the zoom
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

        // Inner ring: active Work (radius 230)
        placeRing(innerRing, 230, -Math.PI / 2);
        // Outer ring: submitted/complete (radius 420, rotated 22.5° to interleave)
        placeRing(outerRing, 420, -Math.PI / 2 + Math.PI / 8);

        // Inter-Project Synergies
        (connectionsData.connections || []).forEach((conn, index) => {
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
        // Fit the view after data loads — works at any screen size
        setTimeout(() => fitView({ padding: 0.18 }), 50);
      } catch (err) {
        console.error('Failed to load memory data:', err);
      }
    };

    loadData();
  }, [activeLens, setNodes, setEdges, fitView]);

  // Re-fit when window resizes (handles DevTools open, rotation, etc.)
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

  const projectTags = selectedProject ? [...(selectedProject.tags || []), ...(selectedProject.themes || []), ...(selectedProject.domains || [])].map(t => t.trim()) : [];
  const uniqueTags = [...new Set(projectTags)];

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

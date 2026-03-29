import React, { useState, useEffect } from 'react';
import { ReactFlow, Background, useNodesState, useEdgesState, MarkerType, Handle, Position } from '@xyflow/react';
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

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeLens, setActiveLens] = useState('All');

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch Global Data
        const profRes = await fetch('/data/profile.json');
        const profile = await profRes.json();
        
        const connRes = await fetch('/data/connections.json');
        const connectionsData = await connRes.json();

        const idxRes = await fetch('/data/projects_index.json');
        const idxText = await idxRes.text();
        const files = idxText.trim().split('\n').filter(f => f.endsWith('.json'));
        
        const projects = [];
        for (const file of files) {
          const res = await fetch(`/data/projects/${file}`);
          projects.push(await res.json());
        }

        const newNodes = [];
        const newEdges = [];

        // 1. Central Core Node
        newNodes.push({
          id: 'user_profile',
          type: 'custom',
          position: { x: window.innerWidth / 2 - 90, y: window.innerHeight / 2 - 90 },
          data: { label: profile.name, isCore: true, status: profile.affiliations?.[0]?.role || 'Investigador' }
        });

        // 2. Lenses Engine
        let filteredProjects = projects;
        if (activeLens === 'Academic') {
          // Filtrar por investigación o académicos
          filteredProjects = projects.filter(p => {
            const tags = [...(p.tags || []), ...(p.domains || []), ...(p.themes || [])].map(t => t.toLowerCase());
            return tags.some(t => ['research', 'academic', 'research-proposal', 'investigación', 'educación'].includes(t));
          });
        }

        const radius = 350;
        const angleStep = (2 * Math.PI) / filteredProjects.length;

        // 3. Populate Orbits
        filteredProjects.forEach((proj, idx) => {
          const angle = angleStep * idx;
          const x = (window.innerWidth / 2 - 90) + radius * Math.cos(angle);
          const y = (window.innerHeight / 2 - 90) + radius * Math.sin(angle);

          newNodes.push({
            id: proj.id,
            type: 'custom',
            position: { x, y },
            data: { 
              label: proj.name || proj.title || proj.id, 
              status: proj.status, 
              fullData: proj 
            }
          });

          // Invisible Orbital Links
          newEdges.push({
            id: `e-user-${proj.id}`,
            source: 'user_profile',
            target: proj.id,
            animated: true,
            style: { stroke: 'rgba(26,26,26,0.15)', strokeWidth: 1 } // Brutalist subtle line
          });
        });

        // 4. Inter-Project Synergies (Connections)
        connectionsData.connections.forEach((conn, index) => {
          if(newNodes.find(n => n.id === conn.source) && newNodes.find(n => n.id === conn.target)) {
              newEdges.push({
                id: `e-${conn.source}-${conn.target}-${index}`,
                source: conn.source,
                target: conn.target,
                animated: false,
                label: conn.type,
                markerEnd: { type: MarkerType.ArrowClosed, color: '#E63946' }, // Accent Red
                style: { stroke: '#E63946', strokeWidth: 2 }
              });
          }
        });

        setNodes(newNodes);
        setEdges(newEdges);
        
      } catch (err) {
        console.error('Failed to load memory data:', err);
      }
    };

    loadData();
  }, [activeLens, setNodes, setEdges]); // Only re-run if lens changes

  const onNodeClick = (event, node) => {
    if (node.id === 'user_profile') return;
    
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, selected: n.id === node.id }
    })));

    setSelectedProject(node.data.fullData);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, selected: false }
    })));
  };

  // Helper fallback para no reventar con arrays vacíos
  const projectTags = selectedProject ? [...(selectedProject.tags || []), ...(selectedProject.themes || []), ...(selectedProject.domains || [])].map(t => t.trim()) : [];
  const uniqueTags = [...new Set(projectTags)];

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      
      <div className="header">
        <h1>Memoria Colectiva</h1>
        <p>Sistema Operativo Personal</p>
      </div>

      <div className="lens-controls">
        <button 
          className={`lens-btn ${activeLens === 'All' ? 'active' : ''}`}
          onClick={() => setActiveLens('All')}
        >
          Universo Completo
        </button>
        <button 
          className={`lens-btn ${activeLens === 'Academic' ? 'active' : ''}`}
          onClick={() => setActiveLens('Academic')}
        >
          Lente Académico
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
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
               <div className="meta-item">
                  <LinkIcon size={16} />
                  <span>{selectedProject.path}</span>
               </div>
            </div>

            <h3 className="drawer-section-title">Resumen</h3>
            <div className="drawer-content">
              {/* Mostramos el abstract, o fallbackeamos a descripción */}
              {selectedProject.abstract || selectedProject.description || "Sin descripción disponible."}
            </div>

            {uniqueTags.length > 0 && (
               <>
                 <h3 className="drawer-section-title">Etiquetas</h3>
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

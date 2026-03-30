import React, { useState, useEffect } from 'react';
import { ReactFlow, Background, useNodesState, useEdgesState, MarkerType, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, FileText, Link as LinkIcon } from 'lucide-react';
import { joinBasePath } from './lib/resourcePath.js';

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
        const basePath = import.meta.env.BASE_URL || './';
        const profilePath = joinBasePath(basePath, 'data/profile.json');
        const connectionsPath = joinBasePath(basePath, 'data/connections.json');
        const projectsIndexPath = joinBasePath(basePath, 'data/projects_index.json');

        // 1. Fetch Profile
        const profRes = await fetch(profilePath);
        const profile = await profRes.json();
        
        // 2. Fetch Connections
        const connRes = await fetch(connectionsPath);
        const connectionsData = await connRes.json();

        // 3. Fetch Project Index
        const idxRes = await fetch(projectsIndexPath);
        const idxText = await idxRes.text();
        const files = idxText.trim().split('\n').filter(f => f.endsWith('.json'));
        
        const projects = [];
        for (const file of files) {
          const projectPath = joinBasePath(basePath, `data/projects/${file}`);
          const res = await fetch(projectPath);
          projects.push(await res.json());
        }

        // Build Graph
        const newNodes = [];
        const newEdges = [];

        // Add Core Profile Node
        newNodes.push({
          id: 'user_profile',
          type: 'custom',
          position: { x: window.innerWidth / 2 - 90, y: window.innerHeight / 2 - 90 },
          data: { label: profile.name, isCore: true, status: profile.affiliations?.[0]?.role || 'Investigador' }
        });

        // Filter Projects by Lens
        let filteredProjects = projects;
        if (activeLens === 'Academic') {
          filteredProjects = projects.filter(p => {
            const tags = p.tags || p.domains || p.themes || [];
            return tags.some(t => ['research', 'academic', 'research-proposal', 'investigación académica', 'educación'].includes(t.toLowerCase()));
          });
        }

        // Add Project Nodes in an orbit
        const radius = 350;
        const angleStep = (2 * Math.PI) / filteredProjects.length;

        filteredProjects.forEach((proj, idx) => {
          const angle = angleStep * idx;
          const x = (window.innerWidth / 2 - 90) + radius * Math.cos(angle);
          const y = (window.innerHeight / 2 - 90) + radius * Math.sin(angle);

          newNodes.push({
            id: proj.id,
            type: 'custom',
            position: { x, y },
            data: { 
              label: proj.name || proj.id, 
              status: proj.status, 
              fullData: proj 
            }
          });

          // Edge directly from Core to Project
          newEdges.push({
            id: `e-user-${proj.id}`,
            source: 'user_profile',
            target: proj.id,
            animated: true,
            style: { stroke: 'rgba(255,255,255,0.2)' }
          });
        });

        // Add Inter-Project Edges from connections.json
        connectionsData.connections.forEach((conn, index) => {
          // Only add if both nodes are currently filtered/visible
          if(newNodes.find(n => n.id === conn.source) && newNodes.find(n => n.id === conn.target)) {
              newEdges.push({
                id: `e-${conn.source}-${conn.target}-${index}`,
                source: conn.source,
                target: conn.target,
                animated: false,
                label: conn.type,
                markerEnd: { type: MarkerType.ArrowClosed, color: '#00F0FF' },
                style: { stroke: '#00F0FF', strokeWidth: 2 }
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
  }, [activeLens, setNodes, setEdges]);

  const onNodeClick = (event, node) => {
    if (node.id === 'user_profile') return;
    
    // Highlight the node
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

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      
      {/* HUD Header */}
      <div className="header">
        <h1>Memoria Colectiva</h1>
        <p>Sistema Operativo Personal</p>
      </div>

      {/* Lenses Controls */}
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
        <Background gap={32} color="rgba(255,255,255,0.05)" />
      </ReactFlow>

      {/* Slide-out Drawer */}
      <div className={`drawer ${isDrawerOpen ? 'open' : ''}`}>
        <button className="drawer-close" onClick={closeDrawer}><X size={24} /></button>
        
        {selectedProject && (
          <>
            <div className="drawer-header">
              <span className="drawer-type">{selectedProject.status}</span>
              <h2>{selectedProject.title}</h2>
            </div>

            <div className="drawer-meta">
               <div className="meta-item">
                  <FileText size={16} color="var(--accent-cyan)" />
                  <span>{selectedProject.type}</span>
               </div>
               <div className="meta-item">
                  <LinkIcon size={16} color="var(--accent-purple)" />
                  <span>{selectedProject.path}</span>
               </div>
            </div>

            <h3 className="drawer-section-title">Resumen</h3>
            <div className="drawer-content">
              {selectedProject.abstract || selectedProject.description}
            </div>

            <h3 className="drawer-section-title">Etiquetas</h3>
            <div className="tag-list">
              {selectedProject.tags?.map(t => (
                <span key={t} className="tag">{t}</span>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  );
}

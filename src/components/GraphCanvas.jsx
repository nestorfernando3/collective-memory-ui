import { Background, ConnectionLineType, Handle, Position, ReactFlow } from '@xyflow/react';
import { useEffect } from 'react';
import { useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  project: ProjectNode,
  profile: ProfileNode,
};

const hiddenHandleStyle = {
  opacity: 0,
  pointerEvents: 'none',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
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

export default function GraphCanvas({
  nodes,
  edges,
  onNodeClick,
  onEdgeClick,
}) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setFlowNodes(nodes);
  }, [nodes, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(edges);
  }, [edges, setFlowEdges]);

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      connectionLineType={ConnectionLineType.Bezier}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.2}
      maxZoom={1.6}
    >
      <Background gap={36} color="rgba(26, 26, 26, 0.12)" size={1.1} />
    </ReactFlow>
  );
}

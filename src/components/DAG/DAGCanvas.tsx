import React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DAGNodeComponent } from './DAGNode';
import { useTaskStore } from '../../stores/useTaskStore';
import type { Node, Edge } from '@xyflow/react';
import type { DAGNode } from '../../types/events';

const nodeTypes = { dagNode: DAGNodeComponent };

interface Props {
  style?: React.CSSProperties;
}

export function DAGCanvas({ style }: Props) {
  const { nodes: storeNodes } = useTaskStore();

  const flowNodes: Node[] = Array.from(storeNodes.values()).map((node: DAGNode) => ({
    id: node.id,
    type: 'dagNode',
    data: node,
    position: { x: 0, y: 0 },
  }));

  // 简单层级布局
  const positionedNodes = React.useMemo(() => {
    const nodesByLevel: Node[][] = [[], [], []];

    for (const n of flowNodes) {
      const data = n.data as DAGNode;
      if (!data.parentId) {
        nodesByLevel[0].push(n);
      } else {
        nodesByLevel[1].push(n);
      }
    }

    const result: Node[] = [];
    const centerX = 300;
    const yStep = 150;

    nodesByLevel[0].forEach((n, i) => {
      const offset = (i - (nodesByLevel[0].length - 1) / 2) * 180;
      result.push({ ...n, position: { x: centerX + offset, y: 20 } });
    });

    nodesByLevel[1].forEach((n, i) => {
      const offset = (i - (nodesByLevel[1].length - 1) / 2) * 180;
      result.push({ ...n, position: { x: centerX + offset, y: 20 + yStep } });
    });

    return result.length > 0 ? result : flowNodes;
  }, [flowNodes]);

  const edges: Edge[] = Array.from(storeNodes.values())
    .filter(n => n.parentId && storeNodes.has(n.parentId))
    .map(n => ({
      id: `${n.parentId}-${n.id}`,
      source: n.parentId!,
      target: n.id,
      style: {
        stroke: n.status === 'completed' ? 'var(--success)'
          : n.status === 'running' ? 'var(--warn)'
          : 'var(--accent)',
        strokeWidth: 1.5,
        strokeDasharray: n.status === 'pending' ? '4,3' : undefined,
      },
    }));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--dag-bg)',
      backgroundImage: 'radial-gradient(circle, var(--dag-dot) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      ...style,
    }}>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-bar)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          DAG 执行图
        </span>
      </div>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={positionedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          panOnDrag
          zoomOnScroll
          nodesDraggable
          style={{ background: 'transparent' }}
        >
          <Background color="var(--dag-dot)" gap={24} variant={BackgroundVariant.Dots} />
          <Controls style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} />
        </ReactFlow>
      </div>
    </div>
  );
}

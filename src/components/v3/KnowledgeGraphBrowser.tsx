/**
 * KnowledgeGraphBrowser — 知识图谱浏览器
 *
 * SVG 交互式节点图，展示实体和关系。
 * 支持力导向布局、节点详情、筛选。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { memoryStore, type Episode } from '../../stores/memoryStore';

// ── 类型 ────────────────────────────────────────────────────

interface KGNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  metadata?: Record<string, unknown>;
}

interface KGEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

interface KGData {
  nodes: KGNode[];
  edges: KGEdge[];
}

// ── 真实数据 Hook ────────────────────────────────────────────

function useKnowledgeGraph(): KGData {
  const [data, setData] = useState<KGData>({ nodes: [], edges: [] });

  useEffect(() => {
    memoryStore.episodes.list('default', 50).then(episodes => {
      const nodes: KGNode[] = episodes.map((ep: Episode, i: number) => ({
        id: ep.id,
        label: ep.type || `Episode ${i + 1}`,
        type: 'episode',
        x: Math.cos(i * 0.8) * 150 + 200,
        y: Math.sin(i * 0.8) * 150 + 200,
        metadata: { timestamp: ep.timestamp },
      }));

      const edges: KGEdge[] = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          source: nodes[i].id,
          target: nodes[i + 1].id,
          label: 'next',
          weight: 1,
        });
      }

      setData({ nodes, edges });
    }).catch(() => {
      setData({ nodes: [], edges: [] });
    });
  }, []);

  return data;
}

// ── 节点颜色 ────────────────────────────────────────────────

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  file: { fill: '#3b82f6', stroke: '#60a5fa' },
  function: { fill: '#22c55e', stroke: '#4ade80' },
  class: { fill: '#a855f7', stroke: '#c084fc' },
  module: { fill: '#f59e0b', stroke: '#fbbf24' },
  concept: { fill: '#ef4444', stroke: '#f87171' },
};

// ── 力导向布局（简化版）────────────────────────────────────

function applyForceLayout(nodes: KGNode[], edges: KGEdge[], iterations = 50): KGNode[] {
  const positioned = nodes.map((n) => ({ ...n }));
  const k = 0.01; // 弹簧常数

  for (let iter = 0; iter < iterations; iter++) {
    // 排斥力
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const dx = positioned[i].x - positioned[j].x;
        const dy = positioned[i].y - positioned[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = 5000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        positioned[i].x += fx;
        positioned[i].y += fy;
        positioned[j].x -= fx;
        positioned[j].y -= fy;
      }
    }

    // 吸引力
    for (const edge of edges) {
      const src = positioned.find((n) => n.id === edge.source);
      const tgt = positioned.find((n) => n.id === edge.target);
      if (!src || !tgt) continue;

      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = k * (dist - 100);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      src.x += fx;
      src.y += fy;
      tgt.x -= fx;
      tgt.y -= fy;
    }

    // 边界约束
    for (const node of positioned) {
      node.x = Math.max(40, Math.min(660, node.x));
      node.y = Math.max(40, Math.min(460, node.y));
    }
  }

  return positioned;
}

// ── 节点详情面板 ────────────────────────────────────────────

function NodeDetail({
  node,
  edges,
  onClose,
}: {
  node: KGNode;
  edges: KGEdge[];
  onClose: () => void;
}) {
  const related = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  );

  return (
    <div style={{
      padding: 12,
      borderRadius: 8,
      border: '1px solid rgba(55,65,81,0.5)',
      background: 'rgba(30,41,59,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: NODE_COLORS[node.type]?.fill ?? '#6b7280',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>{node.label}</span>
          <span style={{ fontSize: 10, color: '#6B7280' }}>{node.type}</span>
        </div>
        <button
          onClick={onClose}
          style={{
            color: '#6B7280',
            fontSize: 12,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: 0,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 8 }}>
        关联关系 ({related.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {related.slice(0, 10).map((e, i) => (
          <div key={i} style={{ fontSize: 10, color: '#9CA3AF' }}>
            {e.source === node.id ? `→ ${e.target}` : `← ${e.source}`}
            <span style={{ color: '#4B5563', marginLeft: 4 }}>({e.label})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface KnowledgeGraphBrowserProps {
  className?: string;
}

export default function KnowledgeGraphBrowser({}: KnowledgeGraphBrowserProps) {
  const data = useKnowledgeGraph();
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [isLayouting, setIsLayouting] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const filteredNodes = useMemo(() => {
    let nodes = data.nodes;
    if (typeFilter) {
      nodes = nodes.filter((n) => n.type === typeFilter);
    }
    return nodes;
  }, [data.nodes, typeFilter]);

  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return data.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [data.edges, filteredNodes]);

  const [positionedNodes, setPositionedNodes] = useState<KGNode[]>(filteredNodes);

  const runLayout = useCallback(() => {
    setIsLayouting(true);
    const result = applyForceLayout(filteredNodes, filteredEdges);
    setPositionedNodes(result);
    setIsLayouting(false);
  }, [filteredNodes, filteredEdges]);

  useEffect(() => {
    runLayout();
  }, [runLayout]);

  const nodeTypes = [...new Set(data.nodes.map((n) => n.type))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 0', marginBottom: 8 }}>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 4,
            background: '#1E293B',
            border: '1px solid #374151',
            color: '#9CA3AF',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        >
          <option value="">所有类型</option>
          {nodeTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          onClick={runLayout}
          disabled={isLayouting}
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 4,
            background: 'rgba(59,130,246,0.2)',
            color: '#60A5FA',
            border: '1px solid rgba(59,130,246,0.3)',
            cursor: isLayouting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: isLayouting ? 0.5 : 1,
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={e => { if (!isLayouting) e.currentTarget.style.background = 'rgba(59,130,246,0.3)'; }}
          onMouseLeave={e => { if (!isLayouting) e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
        >
          重新布局
        </button>
        <span style={{ fontSize: 10, color: '#6B7280' }}>
          {positionedNodes.length} 节点 · {filteredEdges.length} 关系
        </span>
      </div>

      {/* 图谱 */}
      <div style={{ flex: 1, padding: '0 12px' }}>
        <svg
          ref={svgRef}
          viewBox="0 0 700 500"
          style={{
            width: '100%',
            height: '100%',
            border: '1px solid rgba(55,65,81,0.3)',
            borderRadius: 8,
            background: 'rgba(15,23,42,0.5)',
          }}
        >
          {/* 边 */}
          {filteredEdges.map((edge, i) => {
            const src = positionedNodes.find((n) => n.id === edge.source);
            const tgt = positionedNodes.find((n) => n.id === edge.target);
            if (!src || !tgt) return null;

            return (
              <g key={i}>
                <line
                  x1={src.x} y1={src.y}
                  x2={tgt.x} y2={tgt.y}
                  stroke="#4b5563"
                  strokeWidth={edge.weight * 2}
                  opacity={0.5}
                />
                <text
                  x={(src.x + tgt.x) / 2}
                  y={(src.y + tgt.y) / 2}
                  fill="#4B5563"
                  fontSize="8"
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}

          {/* 节点 */}
          {positionedNodes.map((node) => {
            const colors = NODE_COLORS[node.type] ?? { fill: '#6b7280', stroke: '#9ca3af' };
            const isSelected = selectedNode?.id === node.id;

            return (
              <g
                key={node.id}
                onClick={() => setSelectedNode(isSelected ? null : node)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? 14 : 10}
                  fill={colors.fill}
                  stroke={isSelected ? '#fff' : colors.stroke}
                  strokeWidth={isSelected ? 2 : 1}
                  opacity={0.8}
                />
                <text
                  x={node.x}
                  y={node.y + 20}
                  fill="#9CA3AF"
                  fontSize="9"
                  textAnchor="middle"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 节点详情 */}
      {selectedNode && (
        <div style={{ padding: '8px 12px 12px' }}>
          <NodeDetail
            node={selectedNode}
            edges={filteredEdges}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      )}
    </div>
  );
}

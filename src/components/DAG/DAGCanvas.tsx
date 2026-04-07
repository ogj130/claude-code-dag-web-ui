import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DAGNodeComponent } from './DAGNode';
import { NodeDetailModal } from './NodeDetailModal';
import { useTaskStore } from '../../stores/useTaskStore';
import type { Node, Edge } from '@xyflow/react';
import type { DAGNode } from '../../types/events';

// 模块级 ref：存储 ReactFlow 实例的 fitView，跨 render 稳定
let fitViewInstance: ((options?: { padding: number; duration: number }) => void) | null = null;

const nodeTypes = { dagNode: DAGNodeComponent };

interface Props {
  style?: React.CSSProperties;
}

export function DAGCanvas({ style }: Props) {
  const { nodes: storeNodes, collapsedDagQueryIds } = useTaskStore();

  interface ModalState {
    open: boolean;
    nodeType: 'tool' | 'summary';
    nodeId: string;
    nodeLabel: string;
    nodeStatus?: DAGNode['status'];
    args?: Record<string, unknown> | null;
    summaryContent?: string;
  }

  const [modal, setModal] = useState<ModalState>({
    open: false,
    nodeType: 'tool',
    nodeId: '',
    nodeLabel: '',
  });

  const handleOpenDetail = useCallback((node: Pick<DAGNode, 'id' | 'type' | 'label' | 'status' | 'args' | 'summaryContent'>) => {
    setModal({
      open: true,
      nodeType: node.type as 'tool' | 'summary',
      nodeId: node.id,
      nodeLabel: node.label,
      nodeStatus: node.status,
      args: node.args as Record<string, unknown> | null,
      summaryContent: node.summaryContent,
    });
  }, []);

  // 折叠状态：直接从 store 读取（query_start 时自动设置）
  const collapsedQueryIds = collapsedDagQueryIds;

  // 手动折叠/展开 DAG query
  const handleToggleCollapse = useCallback((queryId: string) => {
    useTaskStore.getState().toggleDagQueryCollapse(queryId);
  }, []);

  const flowNodes: Node[] = Array.from(storeNodes.values()).map((node: DAGNode) => ({
    id: node.id,
    type: 'dagNode',
    data: {
      ...node,
      onOpenDetail: handleOpenDetail,
      onToggleCollapse: handleToggleCollapse,
      isCollapsed: node.type === 'query' && collapsedQueryIds.has(node.id),
    },
    position: { x: 0, y: 0 },
  }));

  // 过滤：折叠 query 的工具节点不参与布局（summary 必须保留以维持链条可见）
  const filteredFlowNodes = flowNodes.filter(n => {
    if (n.data.type === 'query') return true;   // query 节点本身永远显示
    if (n.id === 'main-agent') return true;
    if (n.data.type === 'summary') return true;  // summary 是链条必须保留
    const parentId = (n.data as DAGNode).parentId ?? 'main-agent';
    return !collapsedQueryIds.has(parentId);       // 工具节点隐藏
  });

  // 按 query 链分组布局：每条链（query + 其 tools + summary）占一个水平 band，纵向排列
  // 不再依赖 level1 数组下标，而是按链的关系分配 X
  const positionedNodes = useMemo(() => {
    const result: Node[] = [];
    const mainAgentNodes: Node[] = filteredFlowNodes.filter(n => n.id === 'main-agent');
    const queryNodes: Node[] = filteredFlowNodes.filter(n => n.data.type === 'query');
    const toolNodes: Node[] = filteredFlowNodes.filter(n => n.data.type === 'tool');
    const summaryNodes: Node[] = filteredFlowNodes.filter(n => n.data.type === 'summary');

    const centerX = 400;
    const yStep = 220;
    const chainGap = 60; // 有工具的链底部到下一链query的额外间距
    const queryNodeX = 0;       // query 节点 X（每条链起始位置）
    const toolStartX = 180;    // 工具区域起始 X
    const toolSpacing = 180;   // 相邻工具间距
    const summaryOffsetX = 180; // summary 相对 query 的 X 偏移

    // 预计算每条链是否有工具（基于原始 storeNodes，避免折叠后 toolNodes 缺失导致误判）
    // collapsedQueryIds 只影响布局的视觉分组，不影响"是否有工具"的判断
    const chainHasTools = new Map<string, boolean>();
    for (const q of queryNodes) {
      chainHasTools.set(q.id, Array.from(storeNodes.values()).some(n => n.type === 'tool' && n.parentId === q.id));
    }

    // main-agent 居中顶部
    mainAgentNodes.forEach((n) => {
      result.push({ ...n, position: { x: centerX, y: 20 } });
    });

    // 按链分组：每条链 = 一个 query 及其 tools + summary
    // 累积 Y：不再用固定 chainIdx*yStep，而是跟踪每条链的真实底部高度
    let cumulativeY = 20;
    queryNodes.forEach((q) => {
      const toolsInChain = toolNodes.filter(t => (t.data as DAGNode).parentId === q.id);
      const summaryInChain = summaryNodes.find(s => (s.data as DAGNode).parentId === q.id);
      const hasTools = chainHasTools.get(q.id) ?? false;

      const chainY = cumulativeY + yStep;
      cumulativeY = chainY; // 初始：query节点底部在 chainY

      // query 节点
      result.push({ ...q, position: { x: queryNodeX, y: chainY } });

      // tools：水平排列在 query 右侧
      toolsInChain.forEach((t, ti) => {
        const totalWidth = (toolsInChain.length - 1) * toolSpacing;
        const startX = toolStartX - totalWidth / 2;
        result.push({ ...t, position: { x: startX + ti * toolSpacing, y: chainY + yStep } });
      });

      // summary：
      // 有工具 → 在工具行下方（同 chainY + yStep + yStep/2）
      // 无工具 → 与 query 同层，query 右侧
      if (summaryInChain) {
        const sy = hasTools ? chainY + yStep + yStep / 2 : chainY;
        result.push({ ...summaryInChain, position: { x: queryNodeX + summaryOffsetX, y: sy } });
      }

      // 累积下一条链的起始Y：
      // 有工具的链 → tools行y + chainGap（留出呼吸空间）
      // 无工具的链 → query行y + chainGap（保证最小间距）
      const chainBottom = hasTools ? chainY + yStep + chainGap : chainY + chainGap;
      cumulativeY = chainBottom;
    });

    return result.length > 0 ? result : filteredFlowNodes;
  }, [filteredFlowNodes, collapsedQueryIds]);

  // Auto-fit：节点数量或折叠状态变化时重新 fit
  useEffect(() => {
    if (fitViewInstance) {
      fitViewInstance({ padding: 0.15, duration: 300 });
    }
  }, [positionedNodes.length, collapsedQueryIds.size]);

  const edges: Edge[] = Array.from(storeNodes.values())
    .filter(n => {
      if (!n.parentId || !storeNodes.has(n.parentId)) return false;
      const parentId = n.parentId ?? 'main-agent';

      // 折叠 query 的工具节点不出边
      if (n.type === 'tool' && collapsedQueryIds.has(parentId)) return false;

      // summary 作为 target 时：
      // - parentId 指向 tool（endTool）→ 直接渲染
      // - parentId 指向 query 且有 endToolIds → 不渲染（由 endTool→summary 多边替代）
      // - parentId 指向 query 且无 endToolIds → 渲染 query→summary（单工具 fallback）
      if (n.type === 'summary') {
        const parentIsEndTool = storeNodes.has(parentId) && storeNodes.get(parentId)!.type === 'tool';
        if (parentIsEndTool) {
          return true; // endTool→summary，直接渲染
        }
        // parent 是 query：检查是否有 endToolIds
        const hasEndTools = (n.endToolIds?.length ?? 0) > 0;
        if (hasEndTools) return false; // endTool→summary 多边会处理
        // 无 endToolIds：单工具 fallback，渲染 query→summary
      }
      return true;
    })
    .map(n => {
      const source = n.parentId!;
      const parentIsEndTool = storeNodes.has(source) && storeNodes.get(source)!.type === 'tool';
      return {
        id: `${source}-${n.id}`,
        source,
        target: n.id,
        style: {
          stroke: n.status === 'completed' ? 'var(--success)'
            : n.status === 'running' ? 'var(--warn)'
            : 'var(--accent)',
          strokeWidth: 1.5,
          strokeDasharray: (n.type === 'summary' && !parentIsEndTool) ? '6,3' : (
            n.status === 'pending' ? '4,3' : undefined
          ),
        },
      };
    });

  // 额外边：每个 summary 的 endToolIds[1:] → summary（[0] 已由上面的 parentId 处理）
  const extraEdges: Edge[] = [];
  for (const node of storeNodes.values()) {
    if (node.type === 'summary' && node.endToolIds && node.endToolIds.length > 1) {
      for (const endToolId of node.endToolIds.slice(1)) { // 跳过 [0]
        if (storeNodes.has(endToolId)) {
          extraEdges.push({
            id: `extra-${endToolId}-${node.id}`,
            source: endToolId,
            target: node.id,
            style: {
              stroke: 'var(--success)',
              strokeWidth: 1.5,
            },
          });
        }
      }
    }
  }
  const allEdges = [...edges, ...extraEdges];

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
          edges={allEdges}
          nodeTypes={nodeTypes}
          fitView
          onInit={(rf) => { fitViewInstance = rf.fitView; }}
          panOnDrag
          zoomOnScroll
          nodesDraggable
          style={{ background: 'transparent' }}
        >
          <Background color="var(--dag-dot)" gap={24} variant={BackgroundVariant.Dots} />
          <Controls style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} />
        </ReactFlow>

        {/* 弹窗 */}
        {modal.open && (
          <NodeDetailModal
            nodeType={modal.nodeType}
            nodeLabel={modal.nodeLabel}
            nodeId={modal.nodeId}
            nodeStatus={modal.nodeStatus}
            args={modal.args}
            summaryContent={modal.summaryContent}
            onClose={() => setModal(m => ({ ...m, open: false }))}
          />
        )}
      </div>
    </div>
  );
}

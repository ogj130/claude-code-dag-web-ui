import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DAGNodeComponent } from './DAGNode';
import { GroupNodeComponent } from './GroupNode';
import { NodeDetailModal } from './NodeDetailModal';
// V1.4.0: New node types
import AgentGroupNode, { AGENT_GROUP_NODE_TYPE } from './AgentGroupNode';
import TaskNode, { TASK_NODE_TYPE } from './TaskNode';
import CompactNode, { COMPACT_NODE_TYPE } from './CompactNode';
import ImageNode, { IMAGE_NODE_TYPE } from './ImageNode';
import { WorkspaceContainerNode, WORKSPACE_CONTAINER_NODE_TYPE } from './WorkspaceContainerNode';
import { useImageDrop, DropOverlay } from '../../hooks/useImageDrop';
import { useTerminalWorkspaceStore } from '../../stores/useTerminalWorkspaceStore';
import { useTaskStore } from '../../stores/useTaskStore';
import { useSessionStore } from '../../stores/useSessionStore';
import type { PendingAttachmentData } from '../../stores/useTaskStore';
import { AttachmentPreviewModal } from '../Attachment';
import { getGlobalMonitor } from '../../utils/performance';
import { NODE_LIMIT } from '../../utils/memoryManager';
import type { Node, Edge, OnNodesChange, OnEdgesChange, NodeMouseHandler } from '@xyflow/react';
import type { DAGNode } from '../../types/events';

// RAG 节点相关常量
const RAG_NODE_H = 60;       // RAG 节点高度
const RAG_OFFSET_X = -200;    // RAG 节点相对 query 的 X 偏移（左侧）
const RAG_VERTICAL_GAP = 70;  // 多个 RAG 节点之间的垂直间距

// 模块级 ref：存储 ReactFlow 实例的 fitView，跨 render 稳定
let fitViewInstance: ((options?: { padding: number; duration: number; nodes?: Node[] }) => void) | null = null;

// 注册节点类型：dagNode 和 group + V1.4.0 新类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, React.ComponentType<any>> = {
  dagNode: DAGNodeComponent,
  group: GroupNodeComponent,
  // V1.4.0: New node types
  [AGENT_GROUP_NODE_TYPE]: AgentGroupNode,
  [TASK_NODE_TYPE]: TaskNode,
  [COMPACT_NODE_TYPE]: CompactNode,
  [IMAGE_NODE_TYPE]: ImageNode,
  // 全局视图容器节点
  [WORKSPACE_CONTAINER_NODE_TYPE]: WorkspaceContainerNode,
};

interface Props {
  style?: React.CSSProperties;
}

export function DAGCanvas({ style }: Props) {
  const {
    nodes: storeNodes,
    collapsedDagQueryIds,
    currentQueryId,
    attachmentCountByQueryId,
    attachmentDataByQueryId,
  } = useTaskStore();
  const { activeSessionId } = useSessionStore();
  const activeTab = useTerminalWorkspaceStore(s => s.activeTab);
  const workspaceTabs = useTerminalWorkspaceStore(s => s.workspaceTabs);

  // V1.4.0: Drag & drop image zone ref
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // V1.4.0: Image drag & drop handler
  const { isDragging } = useImageDrop({
    sessionId: activeSessionId || 'default',
    dropZoneRef,
    enabled: true,
  });

  interface ModalState {
    open: boolean;
    nodeType: 'tool' | 'summary' | 'rag';
    nodeId: string;
    nodeLabel: string;
    nodeStatus?: DAGNode['status'];
    args?: Record<string, unknown> | null;
    summaryContent?: string;
    /** RAG 节点专属字段 */
    ragContent?: string;
    ragScore?: number;
    ragSourceSessionId?: string;
    ragSourceSessionTitle?: string;
  }

  const [modal, setModal] = useState<ModalState>({
    open: false,
    nodeType: 'tool',
    nodeId: '',
    nodeLabel: '',
  });

  // V1.4.1: 附件预览弹窗状态
  const [previewAttachment, setPreviewAttachment] = useState<PendingAttachmentData | null>(null);

  const handleOpenDetail = useCallback((node: Pick<DAGNode, 'id' | 'type' | 'label' | 'status' | 'args' | 'summaryContent' | 'content' | 'score' | 'sourceSessionId' | 'sourceSessionTitle'>) => {
    const dagNode = storeNodes.get(node.id);
    const isRag = dagNode?.type === 'rag';
    setModal({
      open: true,
      nodeType: isRag ? 'rag' : (node.type as 'tool' | 'summary'),
      nodeId: node.id,
      nodeLabel: node.label,
      nodeStatus: node.status,
      args: node.args as Record<string, unknown> | null,
      summaryContent: node.summaryContent,
      ragContent: isRag ? dagNode.content : undefined,
      ragScore: isRag ? dagNode.score : undefined,
      ragSourceSessionId: isRag ? dagNode.sourceSessionId : undefined,
      ragSourceSessionTitle: isRag ? dagNode.sourceSessionTitle : undefined,
    });
  }, [storeNodes]);

  // 折叠状态：直接从 store 读取（query_start 时自动设置）
  const collapsedQueryIds = collapsedDagQueryIds;

  // 手动折叠/展开 DAG query
  const handleToggleCollapse = useCallback((queryId: string) => {
    useTaskStore.getState().toggleDagQueryCollapse(queryId);
  }, []);

  const collapseAllGroups = useCallback(() => {
    useTaskStore.getState().collapseAllGroups();
  }, []);

  // 工具节点布局计算
  const flowNodes: Node[] = Array.from(storeNodes.values()).map((node: DAGNode) => ({
    id: node.id,
    type: 'dagNode',
    data: {
      ...node,
      onOpenDetail: handleOpenDetail,
      onToggleCollapse: handleToggleCollapse,
      isCollapsed: node.type === 'query' && collapsedQueryIds.has(node.id),
      // V1.4.1: 附件徽章数量
      attachmentCount: attachmentCountByQueryId.get(node.id) ?? 0,
      // V1.4.1: 完整附件数据（用于渲染附件列表）
      attachmentData: attachmentDataByQueryId.get(node.id) ?? null,
      // V1.4.1: 附件点击回调
      onAttachmentClick: (att: PendingAttachmentData) => setPreviewAttachment(att),
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

  // 按 (toolType, queryId) 分组，返回每个分组的元信息
  const groupedToolGroups = useMemo(() => {
    const toolNodes = filteredFlowNodes.filter(n => n.data.type === 'tool');
    const groups = new Map<string, { toolType: string; queryId: string; tools: Node[]; isExpanded: boolean; groupId: string }>();

    for (const tool of toolNodes) {
      const dagNode = tool.data as DAGNode;
      const toolType = dagNode.label || 'unknown';
      const queryId = dagNode.parentId || 'main-agent';
      const groupId = `group_${queryId}_${toolType}`;
      const isExpanded = useTaskStore.getState().expandedGroupIds.has(groupId);

      if (!groups.has(groupId)) {
        groups.set(groupId, { toolType, queryId, tools: [], isExpanded, groupId });
      }
      groups.get(groupId)!.tools.push(tool);
    }

    return groups;
  }, [filteredFlowNodes]);

  // 布局计算：处理 parent container 和子节点定位
  const positionedNodes = useMemo(() => {
    const result: Node[] = [];

    const centerX = 400;
    const yStep = 220;
    const chainGap = 60;
    const queryNodeX = 0;
    const summaryOffsetX = 180;
    const toolSpacing = 220;   // 工具节点间距（加大防止覆盖）
    const toolPadding = 24;    // 工具节点到容器边框的内边距

    // 收集所有 query
    const allQueryNodes = filteredFlowNodes.filter(n => n.data.type === 'query');
    const mainAgentNodes = filteredFlowNodes.filter(n => n.id === 'main-agent');
    const summaryNodes = filteredFlowNodes.filter(n => n.data.type === 'summary');

    // 收集每条链的分组
    type ToolGroupEntry = { groupId: string; isExpanded: boolean; tools: Node[]; toolType: string };
    const chainGroups = new Map<string, ToolGroupEntry[]>();
    for (const [, group] of groupedToolGroups) {
      if (group.tools.length < 2) continue; // 只有 ≥2 个工具才合并
      const existing = chainGroups.get(group.queryId) ?? [];
      existing.push({ groupId: group.groupId, isExpanded: group.isExpanded, tools: group.tools, toolType: group.toolType });
      chainGroups.set(group.queryId, existing);
    }

    // 预计算每条链是否有工具（用于 summary 定位）
    const chainHasTools = new Map<string, boolean>();
    for (const q of allQueryNodes) {
      chainHasTools.set(q.id, filteredFlowNodes.some(n => n.data.type === 'tool' && (n.data as DAGNode).parentId === q.id));
    }

    // main-agent 居中顶部
    mainAgentNodes.forEach((n) => {
      result.push({ ...n, position: { x: centerX, y: 20 } });
    });

    // 按链布局
    let cumulativeY = 20;
    allQueryNodes.forEach((q) => {
      const chainY = cumulativeY + yStep;
      const summaryInChain = summaryNodes.find(s => (s.data as DAGNode).parentId === q.id);
      const groupsThisChain = chainGroups.get(q.id) ?? [];

      // query 节点
      result.push({ ...q, position: { x: queryNodeX, y: chainY } });

      let chainToolsY = chainY + yStep;
      let chainBottom = chainY;

      // 处理每组工具
      groupsThisChain.forEach((grp: ToolGroupEntry) => {
        const { groupId, isExpanded, tools, toolType } = grp;
        const toolCount = tools.length;

        if (isExpanded) {
          // 展开状态：创建父容器 + 子工具节点
          // 容器宽度要能容纳所有子节点：总间距 + 左右 padding + 最后一个节点宽度
          const childWidth = 200; // 容器内工具节点固定宽度
          const containerWidth = (toolCount - 1) * toolSpacing + toolPadding * 2 + childWidth;
          const containerHeight = 210; // header(~40px) + children area
          const headerHeight = 40;     // header 高度

          const containerNode: Node = {
            id: groupId,
            type: 'group',
            data: {
              type: 'tool',
              label: toolType,
              count: toolCount,
              nodeIds: tools.map((t: Node) => t.id),
              queryId: q.id,
              onToggleGroup: (id: string) => useTaskStore.getState().toggleGroupExpand(id),
              isExpanded: true,
            },
            position: { x: 0, y: chainToolsY },
            style: {
              width: containerWidth,
              height: containerHeight,
              background: 'var(--dag-bg)',
              border: '1px solid var(--dag-node-border)',
              borderRadius: 10,
              boxShadow: 'none',
            },
            extent: 'parent' as const,
          };
          result.push(containerNode);

          // 子工具节点：位置相对于容器，内容从 header 下方开始
          const startX = toolPadding;
          tools.forEach((t: Node, ti: number) => {
            result.push({
              ...t,
              position: { x: startX + ti * toolSpacing, y: headerHeight + 12 },
              parentId: groupId,
              extent: 'parent' as const,
              data: {
                ...t.data,
                containerWidth: childWidth,
              },
            });
          });

          chainToolsY += containerHeight + 20;
        } else {
          // 折叠状态：使用普通 dagNode 渲染，避免 React Flow group wrapper 灰框
          result.push({
            id: groupId,
            type: 'dagNode',
            data: {
              id: groupId,
              type: 'tool',
              label: toolType,
              status: 'completed',
              parentId: q.id,
              count: toolCount,
              queryId: q.id,
              nodeIds: tools.map((t: Node) => t.id),
              groupCollapsed: true,
              onToggleGroup: (id: string) => useTaskStore.getState().toggleGroupExpand(id),
              isExpanded: false,
            },
            position: { x: toolSpacing, y: chainToolsY },
          });
          chainToolsY += yStep;
        }
      });

      // 非分组工具（独立的或 <2 个的同类型工具）：直接显示
      const groupedToolIds = new Set(groupsThisChain.flatMap(g => g.tools.map(t => t.id)));
      const independentTools = filteredFlowNodes.filter(
        n => n.data.type === 'tool' && (n.data as DAGNode).parentId === q.id && !groupedToolIds.has(n.id)
      );
      if (independentTools.length > 0) {
        const totalWidth = (independentTools.length - 1) * toolSpacing;
        const startX = toolSpacing - totalWidth / 2;
        independentTools.forEach((t: Node, ti: number) => {
          result.push({ ...t, position: { x: startX + ti * toolSpacing, y: chainToolsY } });
        });
        chainToolsY += yStep;
      }

      // summary
      const hasAnyTools = chainHasTools.get(q.id) ?? false;
      if (summaryInChain) {
        const sy = hasAnyTools ? chainToolsY : chainY;
        result.push({ ...summaryInChain, position: { x: queryNodeX + summaryOffsetX, y: sy } });
        chainToolsY = hasAnyTools ? chainToolsY : chainY;
      }

      // 累积下一条链的起始Y
      chainBottom = chainToolsY + chainGap;
      cumulativeY = chainBottom;
    });

    return result.length > 0 ? result : filteredFlowNodes;
  }, [filteredFlowNodes, groupedToolGroups, collapsedQueryIds, storeNodes]);

  // RAG 节点布局计算：按 query 分组，垂直堆叠在 query 左侧
  const ragNodePositions = useMemo(() => {
    const ragNodes = filteredFlowNodes.filter(n => (n.data as DAGNode).type === 'rag');
    const ragByQuery = new Map<string, { node: Node; index: number; count: number }[]>();

    ragNodes.forEach((n) => {
      const dag = n.data as DAGNode;
      const queryId = dag.parentId ?? '';
      if (!queryId) return;
      const list = ragByQuery.get(queryId) ?? [];
      list.push({ node: n, index: list.length, count: 0 });
      ragByQuery.set(queryId, list);
    });

    // 预计算每组数量
    for (const [, items] of ragByQuery) {
      items.forEach(item => { item.count = items.length; });
    }

    // 返回 { nodeId -> { x, y } }
    const positions = new Map<string, { x: number; y: number }>();
    for (const [queryId, items] of ragByQuery) {
      // 找到对应 query 节点的位置（在 positionedNodes 中的位置，后面会合并）
      const queryNode = positionedNodes.find(n => n.id === queryId);
      if (!queryNode) continue;
      const baseX = queryNode.position.x + RAG_OFFSET_X;
      const totalHeight = items.length * (RAG_NODE_H + RAG_VERTICAL_GAP) - RAG_VERTICAL_GAP;
      const startY = queryNode.position.y + (RAG_NODE_H + RAG_VERTICAL_GAP) / 2 - totalHeight / 2;

      items.forEach(({ node, index }) => {
        positions.set(node.id, {
          x: baseX,
          y: startY + index * (RAG_NODE_H + RAG_VERTICAL_GAP),
        });
      });
    }
    return positions;
  }, [filteredFlowNodes, positionedNodes]);

  // 应用 RAG 节点位置到 positionedNodes
  const positionedNodesWithRAG = useMemo(() => {
    return positionedNodes.map(n => {
      const pos = ragNodePositions.get(n.id);
      if (pos) {
        return { ...n, position: pos };
      }
      return n;
    });
  }, [positionedNodes, ragNodePositions]);

  // ── 碰撞检测 + 自动推挤优化 ─────────────────────────────
  // 在 positionedNodes 变化后立即检测重叠，若有重叠则修正位置
  const NODE_W = 200;   // 节点宽度
  const NODE_H = 60;    // 节点高度
  const MIN_Y_GAP = 40; // 最小 Y 间距

  const overlapOptimizedNodes = useMemo(() => {
    const nodes = positionedNodesWithRAG;

    // 第一遍：按 (x, y) 分桶，同桶内检测碰撞
    // 用 Map<yBucket, Node[]>，yBucket = floor(y / (NODE_H + MIN_Y_GAP))
    const buckets = new Map<number, Node[]>();
    for (const n of nodes) {
      const bucketKey = Math.floor(n.position.y / (NODE_H + MIN_Y_GAP));
      const bucket = buckets.get(bucketKey) ?? [];
      bucket.push(n);
      buckets.set(bucketKey, bucket);
    }

    // 修正映射：nodeId → 调整后的 y
    const yShifts = new Map<string, number>();

    for (const [, bucketNodes] of buckets) {
      if (bucketNodes.length < 2) continue;

      // 同桶内按 x 排序，检测 x 方向重叠
      const sorted = [...bucketNodes].sort((a, b) => a.position.x - b.position.x);

      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        const aRight = a.position.x + NODE_W;
        // X 方向重叠（允许 4px 缝隙）
        if (aRight > b.position.x + 4) {
          // b 需要向右推挤或向下推挤
          // 优先保持 x，改为增加间距：把 b 及其同组节点下移
          const neededShift = aRight - b.position.x + 4;
          const newY = b.position.y + neededShift;

          // 只记录需要调整的节点（按 id 避免重复处理）
          if (!yShifts.has(b.id) || yShifts.get(b.id)! < newY) {
            yShifts.set(b.id, newY);
          }
        }
      }
    }

    // 如果没有任何调整，直接返回原节点
    if (yShifts.size === 0) return positionedNodesWithRAG;

    // 应用调整：被调整的节点后续节点也顺延
    const shifts = new Map<string, number>();
    for (const [nodeId, newY] of yShifts) {
      shifts.set(nodeId, newY);
    }

    return positionedNodes.map(n => {
      const newY = shifts.get(n.id);
      return newY !== undefined ? { ...n, position: { ...n.position, y: newY } } : n;
    });
  }, [positionedNodes]);

  // 全局视图：容器节点（泳道式横向排列）
  const containerNodes: Node[] = workspaceTabs.length > 0
    ? workspaceTabs.map((tab, idx) => ({
        id: `container-${tab.id}`,
        type: WORKSPACE_CONTAINER_NODE_TYPE,
        position: { x: idx * 360, y: 0 },
        data: {
          workspaceId: tab.id,
          workspaceName: tab.name,
          status: tab.status,
          collapsed: false,
        } as Parameters<typeof WorkspaceContainerNode>[0]['data'],
        style: { width: 340, height: 500 },
        draggable: false,
      }))
    : [];

  // 全局视图：追加容器节点；单工作区视图：保持原样
  const finalNodes: Node[] = activeTab === 'global' && workspaceTabs.length > 0
    ? [...containerNodes, ...overlapOptimizedNodes]
    : overlapOptimizedNodes;

  // 聚焦当前问题 query 链（当 currentQueryId 或 positionedNodes 变化时触发）
  useEffect(() => {
    if (!fitViewInstance) return;

    // 如果有当前 queryId，聚焦到该链；否则全局 fitView
    if (currentQueryId) {
      // 收集当前 query 链的所有节点：
      // 1. 当前 query 本身
      // 2. Summary 节点
      // 3. 直接子节点（parentId === currentQueryId）
      // 4. 容器节点本身（type === 'group'，属于当前 query）
      // 5. 容器内的子节点（parentId 以 group_ 开头，属于当前 query 的容器）
      const chainNodes = overlapOptimizedNodes.filter(n => {
        const nd = n.data as DAGNode;
        if (n.id === currentQueryId) return true;
        if (n.id === `${currentQueryId}_summary`) return true;
        if (nd.parentId === currentQueryId) return true;
        // 容器节点本身
        if (n.type === 'group' && nd.queryId === currentQueryId) return true;
        // 容器内子节点
        if (n.parentId?.startsWith('group_')) {
          const groupNode = overlapOptimizedNodes.find(g => g.id === n.parentId);
          if (groupNode && (groupNode.data as DAGNode).queryId === currentQueryId) return true;
        }
        return false;
      });

      if (chainNodes.length > 0) {
        // fitView 到当前 query 链的节点区域（包含展开的子节点）
        fitViewInstance({
          nodes: chainNodes,
          padding: 0.3,
          duration: 400,
        });
        return;
      }
    }

    // 没有 currentQueryId 或链节点未就绪时，全局 fitView
    fitViewInstance({ padding: 0.15, duration: 300 });
  }, [currentQueryId, overlapOptimizedNodes]);

  // ReactFlow onNodesChange/onEdgesChange（controlled 模式，回调仅占位）
  const onNodesChange: OnNodesChange = useCallback(() => {
    // controlled 模式：节点位置由 layout 计算，无需响应 ReactFlow 内部变更
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback(() => {
    // 同上
  }, []);

  const onPaneClick = useCallback(() => {
    collapseAllGroups();
  }, [collapseAllGroups]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.type === 'group') return;
    if ((node.data as { groupCollapsed?: boolean }).groupCollapsed) return;
    if (node.parentId?.startsWith('group_')) return;
    collapseAllGroups();
  }, [collapseAllGroups]);

  // FPS 帧率监控（通过 rAF 采集）
  const monitorRef = useRef(getGlobalMonitor());
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      monitorRef.current.recordFrame();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // 构建边：展开的分组显示工具→summary 边，折叠的分组显示 group→summary 边
  const edges: Edge[] = [];

  for (const n of storeNodes.values()) {
    if (!n.parentId || !storeNodes.has(n.parentId)) continue;

    // 折叠 query 的工具节点不出边
    if (n.type === 'tool' && collapsedQueryIds.has(n.parentId)) continue;

    // 如果工具在展开的分组中，跳过（后面用工具→summary 边代替）
    if (n.type === 'tool') {
      const groupId = `group_${n.parentId}_${n.label}`;
      if (useTaskStore.getState().expandedGroupIds.has(groupId)) {
        const sameTypeTools = Array.from(storeNodes.values()).filter(
          t => t.type === 'tool' && t.parentId === n.parentId && t.label === n.label
        );
        if (sameTypeTools.length >= 2) continue; // 在展开分组中，跳过
      }
    }

    const source = n.parentId;

    // summary 的边处理
    if (n.type === 'summary') {
      const parentIsEndTool = storeNodes.has(source) && storeNodes.get(source)!.type === 'tool';
      if (parentIsEndTool) {
        edges.push({ id: `${source}-${n.id}`, source, target: n.id, style: { stroke: 'var(--success)', strokeWidth: 1.5 } });
        continue;
      }
      const hasEndTools = (n.endToolIds?.length ?? 0) > 0;
      if (hasEndTools) continue;
    }

    // RAG 节点的紫色虚线边
    if (n.type === 'rag') {
      edges.push({
        id: `${source}-${n.id}`,
        source,
        target: n.id,
        style: {
          stroke: '#a78bfa',
          strokeWidth: 1.5,
          strokeDasharray: '8 4',
        },
        className: 'rag-edge',
      });
      continue;
    }

    const parentIsEndTool = storeNodes.has(source) && storeNodes.get(source)!.type === 'tool';
    edges.push({
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
    });
  }

  // 额外边：每个 summary 的 endToolIds[1:] → summary
  const extraEdges: Edge[] = [];
  for (const node of storeNodes.values()) {
    if (node.type === 'summary' && node.endToolIds && node.endToolIds.length > 1) {
      for (const endToolId of node.endToolIds.slice(1)) {
        if (storeNodes.has(endToolId)) {
          extraEdges.push({
            id: `extra-${endToolId}-${node.id}`,
            source: endToolId,
            target: node.id,
            style: { stroke: 'var(--success)', strokeWidth: 1.5 },
          });
        }
      }
    }
  }

  // 分组边：query→group 始终创建，group→summary 在 summary 存在时创建
  const groupEdges: Edge[] = [];
  for (const [, group] of groupedToolGroups) {
    if (group.tools.length < 2) continue;

    // query → group 边（group 容器一出现就需要）
    const queryNodeExists = positionedNodes.some(n => n.id === group.queryId);
    if (queryNodeExists) {
      groupEdges.push({
        id: `${group.queryId}->${group.groupId}`,
        source: group.queryId,
        target: group.groupId,
        style: { stroke: 'var(--accent)', strokeWidth: 1.5 },
      });
    }

    // group → summary 边（summary 存在时才创建）
    const summaryId = `${group.queryId}_summary`;
    if (storeNodes.has(summaryId)) {
      if (group.isExpanded) {
        // 展开状态：每个工具→summary
        for (const tool of group.tools) {
          groupEdges.push({
            id: `${tool.id}-${summaryId}`,
            source: tool.id,
            target: summaryId,
            style: { stroke: 'var(--success)', strokeWidth: 1.5 },
          });
        }
      } else {
        // 折叠状态：group→summary
        groupEdges.push({
          id: `${group.groupId}-${summaryId}`,
          source: group.groupId,
          target: summaryId,
          style: { stroke: 'var(--success)', strokeWidth: 1.5, strokeDasharray: '6,3' },
        });
      }
    }
  }

  const allEdges = [...edges, ...extraEdges, ...groupEdges];

  // 4.3.1: 节点数限制警告
  const nodeCount = storeNodes.size;
  const isOverNodeLimit = nodeCount > NODE_LIMIT;
  const isNearNodeLimit = nodeCount > NODE_LIMIT * 0.8 && nodeCount <= NODE_LIMIT;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--dag-bg)',
      backgroundImage: 'radial-gradient(circle, var(--dag-dot) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      ...style,
    }}>
      <style>{`
        /* RAG 边的紫色虚线 + 流动动画 */
        .rag-edge path {
          stroke: #a78bfa;
          stroke-dasharray: 8 4;
          stroke-width: 1.5;
          animation: rag-flow 1.5s linear infinite;
        }
        @keyframes rag-flow {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-bar)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          DAG 执行图
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>
          {nodeCount} 节点
        </span>
        {isOverNodeLimit && (
          <span style={{
            fontSize: 10, color: '#ef4444', fontWeight: 600,
            background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: 4,
          }}>
            已超过 {NODE_LIMIT} 节点限制，建议折叠旧查询
          </span>
        )}
        {isNearNodeLimit && (
          <span style={{
            fontSize: 10, color: '#f59e0b', fontWeight: 600,
            background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4,
          }}>
            接近 {NODE_LIMIT} 节点限制
          </span>
        )}
      </div>
      <div style={{ flex: 1, position: 'relative' }} ref={dropZoneRef}>
        {isDragging && <DropOverlay message="拖放图片到 DAG 画布" />}
        <ReactFlow
          nodes={finalNodes}
          edges={allEdges}
          nodeTypes={nodeTypes}
          // 虚拟化配置：只渲染可视区域内的节点
          onlyRenderVisibleElements={true}
          // 回调（controlled 模式，仅占位）
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onPaneClick={onPaneClick}
          onNodeClick={onNodeClick}
          // 性能优化
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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
            ragContent={modal.ragContent}
            ragScore={modal.ragScore}
            ragSourceSessionId={modal.ragSourceSessionId}
            ragSourceSessionTitle={modal.ragSourceSessionTitle}
            onClose={() => setModal(m => ({ ...m, open: false }))}
          />
        )}

        {/* V1.4.1: 附件预览弹窗 */}
        {previewAttachment && (
          <AttachmentPreviewModal
            attachment={previewAttachment}
            onClose={() => setPreviewAttachment(null)}
          />
        )}
      </div>
    </div>
  );
}

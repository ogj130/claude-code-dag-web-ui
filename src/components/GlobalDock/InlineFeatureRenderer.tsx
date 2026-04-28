/**
 * InlineFeatureRenderer — maps Dock sub-item IDs to their V3 content components.
 *
 * Each inline-type Dock item renders one of these components inside the DockPanel.
 * Components with required props receive sensible defaults or placeholder states.
 */

import React from 'react';
import { ModeSwitcher } from '../v3/ModeSwitcher';
import { IntentPanel } from '../v3/IntentPanel';
import { ProfilePanel as ProfilePanelComp } from '../v3/ProfilePanel';
import { WorkingMemoryPanel } from '../v3/WorkingMemoryPanel';
import VoiceInputButton from '../v3/VoiceInputButton';
import MemoryBrowser from '../v3/MemoryBrowser';
import KnowledgeGraphBrowser from '../v3/KnowledgeGraphBrowser';
import AgentOrchestrationCanvas from '../v3/AgentOrchestrationCanvas';
import AgentMonitoringPanel from '../v3/AgentMonitoringPanel';
import KanbanBoard from '../v3/KanbanBoard';
import CodeDiffReviewer from '../v3/CodeDiffReviewer';
import LearningReport from '../v3/LearningReport';
import SessionReplay from '../v3/SessionReplay';
import HookVisualEditor from '../v3/HookVisualEditor';
import HookLogPanel from '../v3/HookLogPanel';
import MCPSettingsPanel from '../v3/MCPSettingsPanel';
import ErrorHealingPanel from '../v3/ErrorHealingPanel';
import AuditLogPanel from '../v3/AuditLogPanel';
import VisualFlowBuilder from '../v3/VisualFlowBuilder';
import FlowExecutionView from '../v3/FlowExecutionView';
import type { IntentResult } from '../v3/IntentPanel';

interface Props {
  itemId: string;
}

const EMPTY_INTENT: IntentResult = {
  type: 'create',
  confidence: 0,
  entities: {},
};

export function InlineFeatureRenderer({ itemId }: Props) {
  switch (itemId) {
    // ── 核心智能 ──
    case 'mode':
      return <ModeSwitcher mode="expert" onModeChange={() => {}} />;
    case 'intent':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <IntentPanel intent={EMPTY_INTENT} inputText="" />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            在终端中输入自然语言，意图引擎自动解析
          </p>
        </div>
      );
    case 'profile':
      return <ProfilePanelComp />;
    case 'voice':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
          <VoiceInputButton onTranscription={(text: string) => console.log('[Dock] Voice:', text)} />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            支持 OpenAI Whisper API / whisper.cpp / Web Speech API 三级降级
          </p>
        </div>
      );

    // ── 记忆系统 ──
    case 'memory-browser':
      return <MemoryBrowser />;
    case 'knowledge-graph':
      return <KnowledgeGraphBrowser />;
    case 'working-memory':
      return <WorkingMemoryPanel />;

    // ── 编排系统 ──
    case 'agent-canvas':
      return <AgentOrchestrationCanvas taskId="dock-view" />;
    case 'agent-monitor':
      return <AgentMonitoringPanel />;
    case 'flow-builder':
      return <VisualFlowBuilder />;
    case 'flow-exec':
      return <FlowExecutionView />;
    case 'kanban':
      return <KanbanBoard />;

    // ── 学习系统 ──
    case 'evolution':
      return <EvolutionInline />;
    case 'report':
      return <LearningReport />;
    case 'replay':
      return <SessionReplay />;

    // ── 开发工具 ──
    case 'skill-rec':
      return (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 16 }}>
          从终端执行任务后，Skill 推荐会在此显示
        </div>
      );
    case 'skill-detail':
      return (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 16 }}>
          选择一个 Skill 以查看详情
        </div>
      );
    case 'hook-editor':
      return <HookVisualEditor />;
    case 'hook-log':
      return <HookLogPanel />;
    case 'mcp-settings':
      return <MCPSettingsPanel />;
    case 'error-heal':
      return <ErrorHealingPanel />;
    case 'diff-review':
      return <CodeDiffReviewer />;

    // ── 安全审计 ──
    case 'audit-log':
      return <AuditLogPanel />;

    default:
      return (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>
          该功能正在开发中
        </div>
      );
  }
}

/**
 * Evolution inline component — self-contained stat display
 */
function EvolutionInline() {
  const [evoStatus] = React.useState(() => ({
    cycleCount: 0,
    pendingTraces: 0,
    totalScores: 0,
    totalCandidates: 0,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        <div style={{
          padding: 12, borderRadius: 8, background: 'var(--bg-card)',
          border: '1px solid var(--border)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{evoStatus.cycleCount}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>进化周期</div>
        </div>
        <div style={{
          padding: 12, borderRadius: 8, background: 'var(--bg-card)',
          border: '1px solid var(--border)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warn)' }}>{evoStatus.pendingTraces}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>待处理 Traces</div>
        </div>
        <div style={{
          padding: 12, borderRadius: 8, background: 'var(--bg-card)',
          border: '1px solid var(--border)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{evoStatus.totalScores}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>评分记录</div>
        </div>
        <div style={{
          padding: 12, borderRadius: 8, background: 'var(--bg-card)',
          border: '1px solid var(--border)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{evoStatus.totalCandidates}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>候选 Skills</div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        执行 → 评分 → 提取 → 消除 闭环
      </p>
    </div>
  );
}

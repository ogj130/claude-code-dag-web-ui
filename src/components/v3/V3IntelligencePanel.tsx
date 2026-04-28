/**
 * V3 Intelligence Panel — 智能层总控面板
 *
 * Professional dark-mode panel with glassmorphism effects,
 * card-based layout, and smooth transitions.
 *
 * Design System: Slate Dark + Blue Accent
 * - Background: #0F172A → #1E293B → #334155
 * - Accent: #3B82F6 (blue-500)
 * - Text: #F1F5F9 (slate-100) / #94A3B8 (slate-400)
 * - Effects: backdrop-blur, subtle borders, layered depth
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ModeSwitcher } from './ModeSwitcher';
import { IntentPanel } from './IntentPanel';
import { SmartGuidedQA } from './SmartGuidedQA';
import { ProfilePanel } from './ProfilePanel';
import { WorkingMemoryPanel } from './WorkingMemoryPanel';
import MemoryBrowser from './MemoryBrowser';
import KnowledgeGraphBrowser from './KnowledgeGraphBrowser';
import AgentOrchestrationCanvas from './AgentOrchestrationCanvas';
import AgentMonitoringPanel from './AgentMonitoringPanel';
import KanbanBoard from './KanbanBoard';
import CodeDiffReviewer from './CodeDiffReviewer';
import LearningReport from './LearningReport';
import SessionReplay from './SessionReplay';
import SkillRecommendationCard from './SkillRecommendationCard';
import SkillDetailPanel from './SkillDetailPanel';
import HookVisualEditor from './HookVisualEditor';
import HookLogPanel from './HookLogPanel';
import MCPSettingsPanel from './MCPSettingsPanel';
import ErrorHealingPanel from './ErrorHealingPanel';
import AuditLogPanel from './AuditLogPanel';
import VisualFlowBuilder from './VisualFlowBuilder';
import FlowExecutionView from './FlowExecutionView';
import VoiceInputButton from './VoiceInputButton';
import { parseIntent } from '../../services/intentEngine';
import { list as listSkills } from '../../services/skillStore';
import {
  recordExecution,
  runCycle,
  getEvolutionStatus,
  getCandidateSkills,
  getScoreSummary,
  type CandidateSkill,
  type CycleResult,
} from '../../services/evolutionLoop';
import type { AppMode } from './ModeSwitcher';
import type { IntentResult } from './IntentPanel';
import type { Skill } from '../../services/skillStore';
import {
  TABS, CATEGORY_ICONS, CATEGORY_LABELS, TOKENS, Icons, ContentCard,
  type TabCategory, type TabItem,
} from './tabDefinitions';

// ── Props ───────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ── 组件 ────────────────────────────────────────────────────

export function V3IntelligencePanel({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('mode');
  const [activeCategory, setActiveCategory] = useState<TabCategory>('core');
  const [mode, setMode] = useState<AppMode>('expert');

  // ── 意图理解（实时解析，替代 sampleIntent）──
  const [intentInput, setIntentInput] = useState('');
  const [parsedIntent, setParsedIntent] = useState<IntentResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // ── 进化闭环（实时状态，替代静态文字）──
  const [evoStatus, setEvoStatus] = useState(() => getEvolutionStatus());
  const [candidateSkills, setCandidateSkills] = useState<CandidateSkill[]>(() => getCandidateSkills());
  const [isRunningCycle, setIsRunningCycle] = useState(false);
  const [cycleResult, setCycleResult] = useState<CycleResult | null>(null);

  // ── Skill 列表（替代 sampleSkill）──
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);

  const handleTabClick = useCallback(async (tab: TabItem) => {
    setActiveTab(tab.id);
    setActiveCategory(tab.category);

    // 加载 Skill 列表（懒加载）
    if ((tab.id === 'skill-rec' || tab.id === 'skill-detail') && skills.length === 0) {
      setLoadingSkills(true);
      try {
        const result = await listSkills({ status: 'active', limit: 20 });
        setSkills(result);
      } catch (err) {
        console.error('[V3] Failed to load skills:', err);
      }
      setLoadingSkills(false);
    }
  }, [skills.length]);

  if (!isOpen) return null;

  const categoryTabs = TABS.filter(t => t.category === activeCategory);
  const activeTabData = TABS.find(t => t.id === activeTab);

  const renderContent = () => {
    switch (activeTab) {
      case 'mode':
        return (
          <ContentCard
            title={t('mode.title', '双模式切换')}
            description={t('mode.desc', '在初级引导模式和专家高级模式之间切换，自动适应您的使用习惯。')}
          >
            <ModeSwitcher mode={mode} onModeChange={setMode} />
          </ContentCard>
        );
      case 'intent':
        return (
          <ContentCard
            title={t('intent.title', '意图理解引擎')}
            description={t('intent.desc', '输入自然语言，AI 自动解析意图并生成结构化任务。')}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 输入区 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={intentInput}
                  onChange={(e) => setIntentInput(e.target.value)}
                  placeholder="描述你想要完成的任务..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${TOKENS.border}`,
                    background: TOKENS.bgBase,
                    color: TOKENS.textPrimary,
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && intentInput.trim() && !isParsing) {
                      setIsParsing(true);
                      try {
                        const result = await parseIntent(intentInput.trim());
                        setParsedIntent(result);
                      } catch (err) {
                        console.error('[V3] Parse intent failed:', err);
                      }
                      setIsParsing(false);
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    if (!intentInput.trim() || isParsing) return;
                    setIsParsing(true);
                    try {
                      const result = await parseIntent(intentInput.trim());
                      setParsedIntent(result);
                    } catch (err) {
                      console.error('[V3] Parse intent failed:', err);
                    }
                    setIsParsing(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: TOKENS.accent,
                    color: 'white',
                    fontSize: 13,
                    border: 'none',
                    cursor: isParsing ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: isParsing ? 0.6 : 1,
                  }}
                >
                  {isParsing ? '解析中...' : '解析'}
                </button>
              </div>

              {/* 解析结果 */}
              {parsedIntent && (
                <IntentPanel intent={parsedIntent} inputText={intentInput} />
              )}

              {/* 引导问答 */}
              <div style={{
                borderTop: `1px solid ${TOKENS.border}`,
                paddingTop: 16,
              }}>
                <SmartGuidedQA
                  initialInput={intentInput}
                  onComplete={(refined) => setParsedIntent(refined)}
                />
              </div>
            </div>
          </ContentCard>
        );
      case 'profile':
        return (
          <ContentCard
            title={t('profile.title', '用户画像')}
            description={t('profile.desc', '基于您的编码风格、调试习惯和领域专长，AI 持续学习和优化推荐。')}
          >
            <ProfilePanel />
          </ContentCard>
        );
      case 'voice':
        return (
          <ContentCard
            title={t('voice.title', '语音输入')}
            description={t('voice.desc', '使用语音命令控制 AI，支持中英文混合输入和语音指令映射。')}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              padding: '24px 0',
            }}>
              <VoiceInputButton onTranscription={(text) => console.log('[V3] Voice:', text)} />
              <p style={{
                margin: 0,
                fontSize: 12,
                color: TOKENS.textMuted,
                textAlign: 'center',
              }}>
                支持 OpenAI Whisper API / whisper.cpp sidecar / Web SpeechRecognition 三级降级
              </p>
            </div>
          </ContentCard>
        );
      case 'memory-browser':
        return (
          <ContentCard
            title={t('memory.title', '记忆浏览器')}
            description={t('memory.desc', '浏览、搜索和管理情景记忆、语义记忆和工作记忆。支持 FTS5 全文检索。')}
          >
            <MemoryBrowser />
          </ContentCard>
        );
      case 'knowledge-graph':
        return (
          <ContentCard
            title={t('kg.title', '知识图谱浏览器')}
            description={t('kg.desc', '交互式 SVG 知识图谱，支持 3-hop 遍历、力导向布局、节点筛选。')}
          >
            <KnowledgeGraphBrowser />
          </ContentCard>
        );
      case 'working-memory':
        return (
          <ContentCard
            title={t('wm.title', '工作记忆面板')}
            description={t('wm.desc', 'Token 窗口实时监控，80% 阈值自动压缩，条目级 CRUD 管理。')}
          >
            <WorkingMemoryPanel />
          </ContentCard>
        );
      case 'agent-canvas':
        return (
          <ContentCard
            title={t('agent.title', 'Agent 编排画布')}
            description={t('agent.desc', 'ReactFlow 拖拽画布，支持 5 种协作模式：并行/顺序/流水线/协调/审查。')}
          >
            <AgentOrchestrationCanvas taskId="demo-task" />
          </ContentCard>
        );
      case 'agent-monitor':
        return (
          <ContentCard
            title={t('monitor.title', 'Agent 实时监控')}
            description={t('monitor.desc', '实时显示 Agent 状态、Token 消耗、通信日志和文件锁状态。')}
          >
            <AgentMonitoringPanel />
          </ContentCard>
        );
      case 'flow-builder':
        return (
          <ContentCard
            title={t('flow.title', '可视化流程编排')}
            description={t('flow.desc', 'SVG 可编辑画布，5 种节点类型，拖拽创建 + 模板加载。')}
          >
            <div style={{ minHeight: 400 }}>
              <VisualFlowBuilder className="v3-panel-flow" />
            </div>
          </ContentCard>
        );
      case 'flow-exec':
        return (
          <ContentCard
            title={t('flowexec.title', '流程执行可视化')}
            description={t('flowexec.desc', '实时进度动画，执行中脉冲 / 完成绿色 / 失败红色，支持暂停/步进。')}
          >
            <FlowExecutionView className="v3-panel-flow-exec" />
          </ContentCard>
        );
      case 'kanban':
        return (
          <ContentCard
            title={t('kanban.title', '任务看板')}
            description={t('kanban.desc', 'Todo/Doing/Done/Review 四列看板，dnd-kit 拖拽排序。')}
          >
            <KanbanBoard />
          </ContentCard>
        );
      case 'evolution':
        return (
          <ContentCard
            title={t('evo.title', '自进化学习闭环')}
            description={t('evo.desc', 'Execute → Evaluate → Abstract → Refine 四阶段自进化，三层 Skill 防爆炸防线。')}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 状态概览卡片 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
              }}>
                {[
                  { label: '进化周期', value: evoStatus.cycleCount, color: TOKENS.accent },
                  { label: '待处理轨迹', value: evoStatus.pendingTraces, color: '#FBBF24' },
                  { label: '已评分', value: evoStatus.totalScores, color: '#34D399' },
                  { label: '候选 Skills', value: evoStatus.totalCandidates, color: '#A78BFA' },
                ].map((stat) => (
                  <div key={stat.label} style={{
                    padding: 12,
                    borderRadius: TOKENS.radiusSm,
                    background: TOKENS.bgBase,
                    border: `1px solid ${TOKENS.border}`,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: stat.color }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 2 }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* 评分摘要 */}
              {(() => {
                const summary = getScoreSummary();
                if (summary.totalScored === 0) return null;
                return (
                  <div style={{
                    padding: 12,
                    borderRadius: TOKENS.radiusSm,
                    background: TOKENS.bgBase,
                    border: `1px solid ${TOKENS.border}`,
                  }}>
                    <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 8 }}>
                      评分摘要
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 500, color: '#CBD5E1' }}>
                          {(summary.avgScore * 100).toFixed(0)}%
                        </div>
                        <div style={{ fontSize: 10, color: TOKENS.textMuted }}>平均分</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 500, color: '#34D399' }}>
                          {(summary.avgSuccessRate * 100).toFixed(0)}%
                        </div>
                        <div style={{ fontSize: 10, color: TOKENS.textMuted }}>成功率</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 500, color: '#60A5FA' }}>
                          {(summary.avgTokenEfficiency * 100).toFixed(0)}%
                        </div>
                        <div style={{ fontSize: 10, color: TOKENS.textMuted }}>Token 效率</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 候选 Skills */}
              {candidateSkills.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: TOKENS.textMuted, marginBottom: 8 }}>
                    候选 Skills（{candidateSkills.length}）
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {candidateSkills.slice(0, 5).map((cs) => (
                      <div key={cs.id} style={{
                        padding: '10px 12px',
                        borderRadius: TOKENS.radiusSm,
                        background: TOKENS.bgBase,
                        border: `1px solid ${TOKENS.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>
                            {cs.name}
                          </span>
                          <span style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'rgba(167, 139, 250, 0.1)',
                            color: '#A78BFA',
                          }}>
                            {cs.source === 'llm_extracted' ? 'LLM' : '频率'}
                          </span>
                          <span style={{
                            fontSize: 10,
                            color: cs.confidence > 0.7 ? '#34D399' : '#FBBF24',
                            marginLeft: 'auto',
                          }}>
                            置信度 {(cs.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: TOKENS.textMuted, marginTop: 4, lineHeight: 1.5 }}>
                          {cs.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 周期结果 */}
              {cycleResult && (
                <div style={{
                  padding: 12,
                  borderRadius: TOKENS.radiusSm,
                  background: cycleResult.phase === 'complete'
                    ? 'rgba(52, 211, 153, 0.05)'
                    : 'rgba(251, 191, 36, 0.05)',
                  border: `1px solid ${cycleResult.phase === 'complete'
                    ? 'rgba(52, 211, 153, 0.15)'
                    : 'rgba(251, 191, 36, 0.15)'}`,
                }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 500,
                    marginBottom: 6,
                    color: cycleResult.phase === 'complete' ? '#34D399' : '#FBBF24',
                  }}>
                    {cycleResult.phase === 'complete' ? '周期完成' : '周期跳过'}
                  </div>
                  <div style={{ fontSize: 11, color: TOKENS.textMuted, lineHeight: 1.6 }}>
                    {cycleResult.phase === 'complete'
                      ? `处理 ${cycleResult.tracesProcessed} 条轨迹 · 生成 ${cycleResult.scoresGenerated} 个评分 · 提取 ${cycleResult.candidatesExtracted} 个候选 · 淘汰 ${cycleResult.skillsEliminated} 个低效 Skill`
                      : `轨迹数不足 ${evoStatus.config.minTracesForCycle} 条，跳过本次周期`}
                  </div>
                </div>
              )}

              {/* Four phases visual */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
              }}>
                {[
                  { name: 'Execute', desc: '轨迹记录', color: '#60A5FA', icon: '📝' },
                  { name: 'Evaluate', desc: '质量评分', color: '#34D399', icon: '⭐' },
                  { name: 'Abstract', desc: '模式提取', color: '#A78BFA', icon: '🔍' },
                  { name: 'Refine', desc: '淘汰衰减', color: '#FBBF24', icon: '🔄' },
                ].map((phase) => (
                  <div key={phase.name} style={{
                    padding: 12,
                    borderRadius: TOKENS.radiusSm,
                    background: TOKENS.bgBase,
                    border: `1px solid ${TOKENS.border}`,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{phase.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: phase.color }}>{phase.name}</div>
                    <div style={{ fontSize: 10, color: TOKENS.textMuted, marginTop: 2 }}>{phase.desc}</div>
                  </div>
                ))}
              </div>

              {/* 操作按钮组 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    setIsRunningCycle(true);
                    setCycleResult(null);
                    try {
                      // 先记录一条当前测试轨迹
                      recordExecution({
                        workspaceId: 'workspace_default',
                        taskDescription: '测试进化闭环',
                        toolsUsed: ['code_editor', 'terminal'],
                        isSuccess: true,
                        tokenCount: 1500,
                        durationMs: 30000,
                      });
                      const result: CycleResult = await runCycle('workspace_default');
                      setCycleResult(result);
                    } catch (err) {
                      console.error('[V3] Run cycle failed:', err);
                    }
                    setEvoStatus(getEvolutionStatus());
                    setCandidateSkills(getCandidateSkills());
                    setIsRunningCycle(false);
                  }}
                  disabled={isRunningCycle}
                  style={{
                    padding: '8px 16px',
                    borderRadius: TOKENS.radiusSm,
                    background: `linear-gradient(135deg, ${TOKENS.accent}, #60A5FA)`,
                    color: 'white',
                    fontSize: 12,
                    border: 'none',
                    cursor: isRunningCycle ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: isRunningCycle ? 0.6 : 1,
                  }}
                >
                  {isRunningCycle ? '运行中...' : '运行进化周期'}
                </button>
                <button
                  onClick={() => {
                    recordExecution({
                      workspaceId: 'workspace_default',
                      taskDescription: '编写单元测试',
                      toolsUsed: ['code_editor', 'test_runner'],
                      isSuccess: true,
                      tokenCount: 2000,
                      durationMs: 45000,
                    });
                    setEvoStatus(getEvolutionStatus());
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: TOKENS.radiusSm,
                    background: TOKENS.bgHover,
                    color: TOKENS.textSecondary,
                    fontSize: 12,
                    border: `1px solid ${TOKENS.border}`,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  + 添加测试轨迹
                </button>
              </div>

              <p style={{
                margin: 0,
                fontSize: 11,
                color: TOKENS.textMuted,
                lineHeight: 1.6,
              }}>
                最少需 {evoStatus.config.minTracesForCycle} 条轨迹触发完整周期，当前 {evoStatus.pendingTraces} 条待处理。
                自进化闭环也可通过 Hook 引擎的 task_complete 事件自动触发。
              </p>
            </div>
          </ContentCard>
        );
      case 'report':
        return (
          <ContentCard
            title={t('report.title', '学习报告')}
            description={t('report.desc', '月度报告：任务完成量 / Token 消耗 / Skill 使用 / 错误率趋势分析。')}
          >
            <LearningReport />
          </ContentCard>
        );
      case 'replay':
        return (
          <ContentCard
            title={t('replay.title', '会话回放')}
            description={t('replay.desc', '时间线回放 + 播放/暂停/步进，关键决策点标注，支持导出 JSON。')}
          >
            <SessionReplay />
          </ContentCard>
        );
      case 'skill-rec':
        return (
          <ContentCard
            title={t('skill.title', 'Skill 推荐')}
            description={t('skill.desc', '基于上下文 + 用户画像 + 历史使用的智能 Skill 推荐引擎。')}
          >
            {loadingSkills ? (
              <div style={{ padding: 16, textAlign: 'center', color: TOKENS.textMuted, fontSize: 13 }}>
                加载中...
              </div>
            ) : skills.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: TOKENS.textMuted, fontSize: 13 }}>
                暂无可用 Skill。创建或导入 Skill 后，推荐引擎将自动展示在这里。
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {skills.slice(0, 5).map((skill) => (
                  <SkillRecommendationCard
                    key={skill.id}
                    skill={skill}
                    onUse={() => console.log('[V3] Use skill')}
                    onDetail={() => setActiveTab('skill-detail')}
                  />
                ))}
                {skills.length > 5 && (
                  <div style={{ fontSize: 11, color: TOKENS.textMuted, textAlign: 'center', padding: 8 }}>
                    还有 {skills.length - 5} 个 Skill · 切换分类查看全部
                  </div>
                )}
              </div>
            )}
          </ContentCard>
        );
      case 'skill-detail':
        return (
          <ContentCard
            title={t('skilldetail.title', 'Skill 详情')}
            description={t('skilldetail.desc', '统计图表 + 版本历史 + 使用成功率 + Token 成本分析。')}
          >
            {loadingSkills ? (
              <div style={{ padding: 16, textAlign: 'center', color: TOKENS.textMuted, fontSize: 13 }}>
                加载中...
              </div>
            ) : skills.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: TOKENS.textMuted, fontSize: 13 }}>
                暂无 Skill 数据。请先创建或导入一个 Skill。
              </div>
            ) : (
              <SkillDetailPanel skillId={skills[0].id} />
            )}
          </ContentCard>
        );
      case 'hook-editor':
        return (
          <ContentCard
            title={t('hook.title', 'Hook 可视化编辑器')}
            description={t('hook.desc', '模板 + 代码编辑器双模式，事件匹配 → 条件评估 → 动作执行。')}
          >
            <HookVisualEditor />
          </ContentCard>
        );
      case 'hook-log':
        return (
          <ContentCard
            title={t('hooklog.title', 'Hook 执行日志')}
            description={t('hooklog.desc', 'Hook 调试模式：单步执行 + 中间状态检查 + 执行历史。')}
          >
            <HookLogPanel />
          </ContentCard>
        );
      case 'mcp-settings':
        return (
          <ContentCard
            title={t('mcp.title', 'MCP 服务器设置')}
            description={t('mcp.desc', '添加/编辑/删除/测试 MCP 服务器连接，工具自动发现和注册。')}
          >
            <MCPSettingsPanel />
          </ContentCard>
        );
      case 'error-heal':
        return (
          <ContentCard
            title={t('heal.title', '错误自愈面板')}
            description={t('heal.desc', '自动错误检测 → 情景记忆匹配 → 一键修复 / SelfRepairAgent 生成方案。')}
          >
            <ErrorHealingPanel />
          </ContentCard>
        );
      case 'diff-review':
        return (
          <ContentCard
            title={t('diff.title', 'Code Diff 审查器')}
            description={t('diff.desc', 'Unified diff 视图 + 行内评论 + 持久化审查记录。')}
          >
            <CodeDiffReviewer />
          </ContentCard>
        );
      case 'audit-log':
        return (
          <ContentCard
            title={t('audit.title', '安全审计日志')}
            description={t('audit.desc', '6 级权限模型 + Token 预算告警 + 沙箱执行 + 完整审计链路。')}
          >
            <AuditLogPanel />
          </ContentCard>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 999,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Panel */}
      <div className="v3-panel-root" style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 760,
        maxWidth: '92vw',
        background: TOKENS.bgBase,
        borderLeft: `1px solid ${TOKENS.border}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        boxShadow: `${TOKENS.shadowLg}, ${TOKENS.shadowGlow}`,
        animation: 'slideInRight 0.3s ease-out',
        overflow: 'hidden',
      }}>
        {/* ─── Header ─── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: `linear-gradient(135deg, ${TOKENS.bgElevated} 0%, ${TOKENS.bgBase} 100%)`,
          borderBottom: `1px solid ${TOKENS.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: TOKENS.radiusSm,
              background: `linear-gradient(135deg, ${TOKENS.accent}, #818CF8)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: TOKENS.shadowGlow,
            }}>
              {Icons.sparkles}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: TOKENS.textPrimary,
                  letterSpacing: '0.02em',
                }}>
                  V3 Intelligence Layer
                </span>
                <span style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: `linear-gradient(135deg, ${TOKENS.accent}, #818CF8)`,
                  color: 'white',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}>
                  BETA
                </span>
              </div>
              <span style={{
                fontSize: 11,
                color: TOKENS.textMuted,
              }}>
                23 features across 6 categories
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            style={{
              background: 'transparent',
              border: `1px solid ${TOKENS.border}`,
              color: TOKENS.textMuted,
              cursor: 'pointer',
              padding: 6,
              borderRadius: TOKENS.radiusSm,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease-out',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = TOKENS.bgHover;
              e.currentTarget.style.color = TOKENS.textPrimary;
              e.currentTarget.style.borderColor = TOKENS.borderActive;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = TOKENS.textMuted;
              e.currentTarget.style.borderColor = TOKENS.border;
            }}
          >
            {Icons.close}
          </button>
        </div>

        {/* ─── Main Content: 3-column layout ─── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Column 1: Category Navigation */}
          <div style={{
            width: 110,
            borderRight: `1px solid ${TOKENS.border}`,
            display: 'flex',
            flexDirection: 'column',
            padding: '12px 8px',
            gap: 4,
            background: TOKENS.bgElevated,
            overflowY: 'auto',
            flexShrink: 0,
          }}>
            {(Object.keys(CATEGORY_LABELS) as TabCategory[]).map(cat => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    // 自动选中新分类的第一个标签页
                    const firstTab = TABS.find(t => t.category === cat);
                    if (firstTab) setActiveTab(firstTab.id);
                  }}
                  style={{
                    background: isActive
                      ? `linear-gradient(135deg, ${TOKENS.accentDim}, transparent)`
                      : 'transparent',
                    color: isActive ? TOKENS.accent : TOKENS.textMuted,
                    border: 'none',
                    borderLeft: isActive ? `3px solid ${TOKENS.accent}` : '3px solid transparent',
                    padding: '10px 8px',
                    borderRadius: `0 ${TOKENS.radiusSm}px ${TOKENS.radiusSm}px 0`,
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s ease-out',
                    textAlign: 'left',
                    fontWeight: isActive ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    lineHeight: 1,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = TOKENS.bgHover;
                      e.currentTarget.style.color = TOKENS.textSecondary;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = TOKENS.textMuted;
                    }
                  }}
                >
                  {CATEGORY_ICONS[cat]}
                  <span>{CATEGORY_LABELS[cat]}</span>
                </button>
              );
            })}
          </div>

          {/* Column 2: Feature Tabs */}
          <div className="v3-feature-tabs" style={{
            width: 150,
            borderRight: `1px solid ${TOKENS.border}`,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 10px',
            gap: 3,
            overflowY: 'auto',
            flexShrink: 0,
            background: `linear-gradient(180deg, ${TOKENS.bgElevated} 0%, ${TOKENS.bgBase} 100%)`,
          }}>
            {categoryTabs.map((tab, idx) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`v3-feat-tab${isActive ? ' v3-feat-tab--active' : ''}`}
                  style={{
                    position: 'relative',
                    background: isActive
                      ? `linear-gradient(135deg, ${TOKENS.accentDim} 0%, rgba(59, 130, 246, 0.05) 100%)`
                      : 'transparent',
                    color: isActive ? TOKENS.textPrimary : TOKENS.textMuted,
                    border: 'none',
                    padding: '10px 12px 10px 14px',
                    borderRadius: TOKENS.radiusSm,
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    textAlign: 'left',
                    lineHeight: 1,
                    animation: isActive ? 'none' : `featTabIn 0.25s ease-out ${idx * 0.04}s both`,
                    animationDelay: isActive ? '0s' : `${idx * 0.04}s`,
                    overflow: 'hidden',
                    outline: 'none',
                    transition: 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = `rgba(148, 163, 184, 0.06)`;
                      e.currentTarget.style.color = TOKENS.textSecondary;
                      const iconEl = e.currentTarget.querySelector('.v3-feat-icon');
                      if (iconEl) (iconEl as HTMLElement).style.opacity = '0.85';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = TOKENS.textMuted;
                      const iconEl = e.currentTarget.querySelector('.v3-feat-icon');
                      if (iconEl) (iconEl as HTMLElement).style.opacity = '0.5';
                    }
                  }}
                  onMouseDown={e => {
                    e.currentTarget.style.transform = 'scale(0.97)';
                  }}
                  onMouseUp={e => {
                    e.currentTarget.style.transform = '';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = '';
                  }}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: '55%',
                      borderRadius: '0 2px 2px 0',
                      background: `linear-gradient(180deg, ${TOKENS.accent}, #60A5FA)`,
                      boxShadow: `0 0 8px ${TOKENS.accentGlow}`,
                    }} />
                  )}
                  {/* Icon wrapper with state-aware opacity */}
                  <span className="v3-feat-icon" style={{
                    display: 'flex',
                    alignItems: 'center',
                    opacity: isActive ? 1 : 0.5,
                    color: isActive ? TOKENS.accent : 'currentColor',
                    flexShrink: 0,
                    transition: 'opacity 0.2s ease-out',
                  }}>
                    {tab.icon}
                  </span>
                  {/* Label */}
                  <span style={{
                    fontSize: 12,
                    fontWeight: isActive ? 500 : 400,
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {tab.label}
                  </span>
                  {/* Active indicator dot */}
                  {isActive && (
                    <span style={{
                      marginLeft: 'auto',
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: TOKENS.accent,
                      boxShadow: `0 0 6px ${TOKENS.accentGlow}`,
                      flexShrink: 0,
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Column 3: Content Area */}
          <div className="v3-content-area" style={{
            flex: 1,
            overflow: 'auto',
            padding: 20,
            background: TOKENS.bgBase,
          }}>
            <div key={activeTab} className="v3-content-fade-in">
              {renderContent()}
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div style={{
          padding: '8px 20px',
          borderTop: `1px solid ${TOKENS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: TOKENS.bgElevated,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 11,
            color: TOKENS.textMuted,
          }}>
            {activeTabData ? `${CATEGORY_LABELS[activeCategory]} / ${activeTabData.label}` : ''}
          </span>
          <span style={{
            fontSize: 11,
            color: TOKENS.textMuted,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#10B981',
              display: 'inline-block',
            }} />
            All systems operational
          </span>
        </div>
      </div>

      {/* ─── Animations ─── */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes featTabIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.85); }
        }
        @keyframes voiceWave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
        @keyframes rippleExpand {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.15); opacity: 0.15; }
          100% { transform: scale(1); opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Voice spinner */
        .v3-spin-anim { animation: spin 1s linear infinite; }
        .v3-spin-opacity-25 { opacity: 0.25; }
        .v3-spin-opacity-75 { opacity: 0.75; }

        /* Feature tab base styles */
        .v3-feat-tab { transition: all 0.18s ease-out; }
        .v3-feat-tab:hover:not(.v3-feat-tab--active) {
          background: rgba(148, 163, 184, 0.06) !important;
        }
        .v3-feat-tab--active { transition: all 0.25s ease-out; }

        /* Content area fade on tab switch */
        .v3-content-fade-in {
          animation: fadeSlideIn 0.3s ease-out;
        }

        /* ── V3 Panel CSS Variable Overrides ── */
        .v3-panel-root {
          --bg-card: ${TOKENS.bgElevated};
          --bg-card-hover: ${TOKENS.bgHover};
          --bg-input: ${TOKENS.bgBase};
          --bg-panel: ${TOKENS.bgBase};
          --bg-terminal: ${TOKENS.bgBase};
          --bg-bar: ${TOKENS.bgElevated};
          --bg-tab: ${TOKENS.bgElevated};
          --border: ${TOKENS.border};
          --border-card: ${TOKENS.border};
          --border-hover: rgba(148, 163, 184, 0.25);
          --text-primary: ${TOKENS.textPrimary};
          --text-secondary: ${TOKENS.textSecondary};
          --text-muted: ${TOKENS.textMuted};
          --accent: ${TOKENS.accent};
          --accent-dim: ${TOKENS.accentDim};
        }
      `}</style>
    </>
  );
}

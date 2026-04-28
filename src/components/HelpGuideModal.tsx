import { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const GROUPS = [
  { id: 'core', label: '核心智能', emoji: '⚡' },
  { id: 'memory', label: '记忆系统', emoji: '📖' },
  { id: 'orchestration', label: '编排系统', emoji: '🤖' },
  { id: 'learning', label: '学习系统', emoji: '🔄' },
  { id: 'tools', label: '开发工具', emoji: '⭐' },
  { id: 'security', label: '安全审计', emoji: '🛡️' },
  { id: 'system', label: '系统工具', emoji: '💻' },
];

const GUIDE_CONTENT: Record<string, string> = {
  core: `## 核心智能

### 模式切换
在初级引导模式和专家高级模式之间切换。初级模式提供分步引导和简化的界面，适合新手用户。专家模式解锁全部 29 个功能和完整控制权。

### 意图理解引擎
输入自然语言描述你要做的事情，AI 自动解析意图并拆解为结构化任务。支持创建、修改、查询、删除等意图类型的自动识别。

**使用方法**：在终端中输入自然语言，例如 "帮我创建一个 React 组件显示用户列表"，意图引擎会自动解析并规划执行步骤。

### 用户画像
基于你的编码风格、调试习惯和领域专长，AI 持续构建你的用户画像。画像数据用于个性化 Skill 推荐和优化回复质量。

### 语音输入
使用语音命令控制 AI，支持中英文混合输入。自动降级选择 OpenAI Whisper API、whisper.cpp sidecar 或浏览器 Web Speech API。`,

  memory: `## 记忆系统

### 记忆浏览器
浏览和搜索 AI 自动记录的情景记忆和语义记忆。支持关键词搜索、标签筛选和时间范围过滤。

**数据来源**：AI 在每次执行任务后自动将重要决策和执行轨迹记录为记忆片段。所有记忆本地存储，确保隐私安全。

### 知识图谱
交互式 SVG 可视化知识图谱，展示实体之间的语义关系。支持节点拖拽和 3-hop 关系遍历。

### 工作记忆
实时监控当前会话的 Token 窗口使用情况。达到 80% 阈值时自动触发上下文压缩，保证长对话的连贯性。`,

  orchestration: `## 编排系统

### Agent 编排画布
可视化展示 Agent 协作拓扑。支持 5 种协作模式：
- **并行**：多个 Agent 同时执行独立任务
- **顺序**：Agent 按序执行，前一个完成后启动下一个
- **流水线**：Agent 之间形成数据流水线
- **Fan-out**：一个 Agent 分发任务到多个 Agent
- **Fan-in**：多个 Agent 结果汇聚到一个 Agent

### Agent 监控
实时监控所有 Agent 的运行状态、Token 消耗和执行进度。异常 Agent 高亮显示。

### 流程编排器
拖拽式可视化流程设计器。支持 5 种节点类型：开始、任务、条件、并行、结束。内置 3 个模板帮助快速开始。

### 流程执行
实时展示流程的运行时执行状态。支持自动播放和手动步进两种模式。

### 任务看板
四列看板式任务管理：待办 → 进行中 → 审查中 → 已完成。拖拽卡片切换状态。`,

  learning: `## 学习系统

### 自进化闭环
AI 从执行记录中自动评分、提取模式、生成候选 Skill，淘汰低效 Skill。完整闭环流程：
1. **执行记录**：每次任务执行自动生成 ExecutionTrace
2. **自动评分**：从成功率、Token 效率、时间效率等维度评分
3. **模式提取**：从高分轨迹中提取可复用的操作模式
4. **候选生成**：将模式转换为候选 Skill 供用户确认
5. **淘汰机制**：低使用率低评分 Skill 自动淘汰

### 学习报告
月度统计报告，展示任务完成量、Token 消耗、Skill 使用情况和错误率趋势。

### 会话回放
时间线式回放历史会话过程。按时间顺序展示用户输入、Agent 响应、工具调用和决策点。支持播放/暂停/步进控制。`,

  tools: `## 开发工具

### Skill 推荐
基于你的使用习惯和编码风格，AI 智能推荐适合你的 Skill。每个 Skill 包含描述、使用统计和安装指引。

### Skill 详情
查看 Skill 的详细信息：描述、源代码、使用统计、版本历史。支持一键启用/禁用。

### Hook 编辑器
可视化 Hook 脚本编辑器。支持在关键事件点插入自定义逻辑：
- 任务开始前 (pre-task)
- 任务完成后 (post-task)
- 错误发生时 (on-error)

### Hook 日志
查看所有 Hook 的执行日志。包括触发时间、执行耗时、输出内容和错误信息。

### MCP 设置
管理 MCP (Model Context Protocol) 服务器配置。添加、编辑、测试 MCP 连接。

### 错误自愈
AI 自动检测代码错误并匹配历史修复方案。展示错误详情、相似度匹配和推荐的修复代码。

### Diff 审查
展示 AI 生成的代码 Diff。支持逐行审查、添加评论、接受或拒绝变更。`,

  security: `## 安全审计

### 审计日志
完整的操作审计记录。包括用户输入、Agent 决策、工具调用和系统事件。支持按时间范围、操作类型筛选和 CSV 导出。`,

  system: `## 系统工具

### 全局终端
独立于工作区的全局命令行终端。可在不切换会话的情况下执行系统命令。快捷键: Ctrl+Backtick

### 执行分析
任务执行可视化分析。展示任务耗时分布、成功率趋势、瓶颈识别和优化建议。

### Token 统计
详细的 Token 用量统计。按模型、会话、日/周/月维度展示消耗情况。

### 上下文压缩
当 Token 窗口使用率达到 80% 时自动触发。支持手动发起压缩和选择压缩策略。

### 全局搜索
跨会话、跨工作区的全文搜索。使用 FTS5 搜索引擎，支持关键词、标签、工具类型组合筛选。快捷键: Cmd/Ctrl+K

### 设置
应用全局设置：主题模式（暗黑/明亮/跟随系统）、主题色、节点密度、字体大小、语言。`,
};

export function HelpGuideModal({ isOpen, onClose }: Props) {
  const [activeGroup, setActiveGroup] = useState('core');
  const [isAnimating, setIsAnimating] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setVisible(false), 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes help-modal-enter {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes help-modal-exit {
          from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          to { opacity: 0; transform: translate(-50%, -50%) scale(0.97); }
        }
        @media (prefers-reduced-motion: reduce) {
          .help-modal-anim { animation: none !important; }
        }
      `}</style>

      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          opacity: isAnimating ? 1 : 0, transition: 'opacity 0.2s',
        }}
      />

      <div
        className="help-modal-anim"
        role="dialog" aria-modal="true" aria-label="使用指南"
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: isAnimating ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.95)',
          width: 'min(85vw, 1000px)', height: 'min(85vh, 700px)',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 25px 80px rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', overflow: 'hidden',
          opacity: isAnimating ? 1 : 0, transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
        }}
      >
        {/* Sidebar */}
        <div style={{
          width: 160, flexShrink: 0, borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', padding: '12px 0',
          overflow: 'auto',
        }}>
          <div style={{
            padding: '8px 16px 16px', fontSize: 14, fontWeight: 600,
            color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
            marginBottom: 8,
          }}>
            功能导航
          </div>
          {GROUPS.map(g => (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, textAlign: 'left',
                background: activeGroup === g.id
                  ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                  : 'transparent',
                color: activeGroup === g.id ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: activeGroup === g.id ? 600 : 400,
                borderLeft: activeGroup === g.id ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <span>{g.emoji}</span>
              <span>{g.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
          <div style={{
            fontSize: 14, lineHeight: 2, color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
              CC Web UI V3.0.0 使用指南
            </h2>
            {GUIDE_CONTENT[activeGroup]?.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return <h3 key={i} style={{ fontSize: 17, fontWeight: 700, marginTop: 24, marginBottom: 8, color: 'var(--text-primary)' }}>{line.slice(3)}</h3>;
              }
              if (line.startsWith('### ')) {
                return <h4 key={i} style={{ fontSize: 15, fontWeight: 600, marginTop: 18, marginBottom: 6, color: 'var(--accent)' }}>{line.slice(4)}</h4>;
              }
              if (line.startsWith('- **')) {
                const match = line.match(/- \*\*(.+?)\*\*：(.+)/);
                if (match) {
                  return <div key={i} style={{ paddingLeft: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}><strong style={{ color: 'var(--text-primary)' }}>{match[1]}</strong>：{match[2]}</div>;
                }
              }
              if (line.startsWith('**') && line.includes('**')) {
                return <div key={i} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>{line.replace(/\*\*/g, '')}</div>;
              }
              if (line.trim()) {
                return <p key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '4px 0' }}>{line}</p>;
              }
              return <br key={i} />;
            })}
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="关闭"
          style={{
            position: 'absolute', top: 12, right: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 20, padding: '4px 8px',
            borderRadius: 8, lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </>
  );
}

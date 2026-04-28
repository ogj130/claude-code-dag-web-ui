export interface FeatureHint {
  id: string;
  /** L1: First-time hint banner */
  title: string;
  body: string;
  /** L2: Empty state guide */
  emptyTitle: string;
  emptySteps: string[];  // 3 steps
  emptyActionLabel: string;
}

export const FEATURE_HINTS: Record<string, FeatureHint> = {
  // ========================================================================
  // Core (panel) — 4 items
  // ========================================================================
  mode: {
    id: 'mode',
    title: '模式切换',
    body: '在初级引导模式和专家高级模式之间切换。初级模式提供分步引导和简化的界面，专家模式解锁全部 29 个功能和完整控制权。',
    emptyTitle: '选择你的使用模式',
    emptySteps: [
      '点击初级模式或专家模式按钮',
      '系统自动切换界面和功能可用性',
      '可随时再次切换',
    ],
    emptyActionLabel: '',
  },

  intent: {
    id: 'intent',
    title: '意图理解引擎',
    body: '输入自然语言描述你要做的事情，AI 自动解析意图并拆解为结构化任务。支持创建、修改、查询、删除等意图类型的自动识别。',
    emptyTitle: '用自然语言描述任务',
    emptySteps: [
      '在终端中输入自然语言任务描述',
      '意图引擎自动解析并显示结构化结果',
      '确认后 AI 开始执行',
    ],
    emptyActionLabel: '去终端输入任务',
  },

  profile: {
    id: 'profile',
    title: '用户画像',
    body: '基于你的编码风格、调试习惯和领域专长，AI 持续构建你的用户画像。画像数据用于个性化 Skill 推荐和优化回复质量。',
    emptyTitle: '自动构建用户画像',
    emptySteps: [
      '在终端中持续使用 AI 完成任务',
      '系统自动采集编码习惯和偏好',
      '画像自动更新，无需手动操作',
    ],
    emptyActionLabel: '',
  },

  voice: {
    id: 'voice',
    title: '语音输入',
    body: '使用语音命令控制 AI，支持中英文混合输入。自动降级选择 OpenAI Whisper API、whisper.cpp sidecar 或浏览器 Web Speech API。',
    emptyTitle: '语音控制 AI',
    emptySteps: [
      '点击麦克风按钮开始录音',
      '说出你的任务指令',
      'AI 自动转写并执行',
    ],
    emptyActionLabel: '开始录音',
  },

  // ========================================================================
  // Memory (drawer) — 3 items
  // ========================================================================
  'memory-browser': {
    id: 'memory-browser',
    title: '记忆浏览器',
    body: '浏览和搜索 AI 自动记录的情景记忆和语义记忆。支持关键词搜索、标签筛选和时间范围过滤，帮助理解 AI 的知识积累。',
    emptyTitle: '浏览 AI 记忆',
    emptySteps: [
      '在终端中执行任务，AI 自动记录为记忆片段',
      '返回此处浏览已记录的记忆',
      '使用搜索和标签筛选快速定位',
    ],
    emptyActionLabel: '去终端执行任务',
  },

  'knowledge-graph': {
    id: 'knowledge-graph',
    title: '知识图谱',
    body: '交互式可视化知识图谱，展示实体之间的语义关系。支持 3-hop 遍历、节点拖拽、力导向布局。',
    emptyTitle: '探索知识图谱',
    emptySteps: [
      'AI 执行任务后自动提取实体和关系',
      '返回此处查看自动生成的知识图谱',
      '拖拽节点探索实体间的关系',
    ],
    emptyActionLabel: '去终端执行任务',
  },

  'working-memory': {
    id: 'working-memory',
    title: '工作记忆',
    body: '查看当前会话中 AI 的工作记忆状态。实时展示 Token 窗口使用情况，达到 80% 阈值时自动触发上下文压缩。',
    emptyTitle: '查看工作记忆',
    emptySteps: [
      '在终端中与 AI 对话',
      '实时观察 Token 窗口使用情况',
      '接近阈值时系统自动压缩',
    ],
    emptyActionLabel: '去终端对话',
  },

  // ========================================================================
  // Orchestration (modal) — 5 items
  // ========================================================================
  'agent-canvas': {
    id: 'agent-canvas',
    title: 'Agent 编排画布',
    body: '可视化展示 Agent 协作拓扑。拖拽 Agent 节点到画布，连接它们来定义协作流程。支持并行、顺序、流水线等 5 种协作模式。',
    emptyTitle: '编排 Agent 协作',
    emptySteps: [
      '从 agentOrchestrator 加载活跃的 Agent',
      '拖拽 Agent 到画布编排协作关系',
      '设置协作模式并保存编排方案',
    ],
    emptyActionLabel: '加载 Agent',
  },

  'agent-monitor': {
    id: 'agent-monitor',
    title: 'Agent 监控',
    body: '实时监控所有 Agent 的运行状态、Token 消耗和执行进度。异常 Agent 高亮显示，支持一键重启或终止。',
    emptyTitle: '监控 Agent 运行',
    emptySteps: [
      '启动 Agent 任务后自动显示在此面板',
      '观察各 Agent 的状态和 Token 消耗',
      '对异常 Agent 执行重启或终止操作',
    ],
    emptyActionLabel: '去终端执行任务',
  },

  'flow-builder': {
    id: 'flow-builder',
    title: '流程编排器',
    body: '拖拽式可视化流程设计器。支持开始、任务、条件、并行、结束 5 种节点类型。内置 3 个模板帮助你快速开始。',
    emptyTitle: '设计执行流程',
    emptySteps: [
      '从左侧拖拽节点到画布创建流程',
      '连接节点定义执行顺序',
      '保存流程，可在流程执行中运行',
    ],
    emptyActionLabel: '从模板创建',
  },

  'flow-exec': {
    id: 'flow-exec',
    title: '流程执行',
    body: '实时展示流程的运行时执行状态。自动播放或手动步进，每个节点显示执行进度、耗时和输出。',
    emptyTitle: '运行已保存的流程',
    emptySteps: [
      '在流程编排器中创建并保存流程',
      '选择已保存的流程开始执行',
      '观察自动播放或手动步进查看详情',
    ],
    emptyActionLabel: '选择流程',
  },

  kanban: {
    id: 'kanban',
    title: '任务看板',
    body: '四列看板式任务管理：待办 → 进行中 → 审查中 → 已完成。拖拽任务卡片切换状态，支持优先级标记。',
    emptyTitle: '管理任务卡片',
    emptySteps: [
      '点击「创建任务」添加第一个任务卡片',
      '拖拽卡片到不同列切换状态',
      '双击卡片编辑任务详情',
    ],
    emptyActionLabel: '创建第一个任务',
  },

  // ========================================================================
  // Learning (modal/drawer) — 3 items
  // ========================================================================
  evolution: {
    id: 'evolution',
    title: '自进化闭环',
    body: 'AI 从执行记录中自动评分、提取模式、生成候选 Skill，淘汰低效 Skill。形成 执行→评分→提取→消除 的完整闭环。',
    emptyTitle: '查看进化状态',
    emptySteps: [
      '在终端中执行任务，自动生成执行轨迹',
      '系统自动评分并提取高频模式',
      '查看生成的候选 Skill 并确认或淘汰',
    ],
    emptyActionLabel: '查看进化状态',
  },

  report: {
    id: 'report',
    title: '学习报告',
    body: '月度统计报告，展示任务完成量、Token 消耗、Skill 使用情况和错误率趋势。',
    emptyTitle: '月度学习报告',
    emptySteps: [
      '持续使用 AI 一个月后查看首份报告',
      '浏览月度统计和趋势图表',
      '对比不同月份的进步情况',
    ],
    emptyActionLabel: '',
  },

  replay: {
    id: 'replay',
    title: '会话回放',
    body: '时间线式回放历史会话过程。按时间顺序展示用户输入、Agent 响应、工具调用和决策点。支持播放/暂停/步进。',
    emptyTitle: '回放历史会话',
    emptySteps: [
      '在终端中完成一次完整的对话会话',
      '返回此处选择历史会话',
      '点击播放，观察 AI 的完整决策过程',
    ],
    emptyActionLabel: '选择会话',
  },

  // ========================================================================
  // Tools (drawer/modal) — 7 items
  // ========================================================================
  'skill-rec': {
    id: 'skill-rec',
    title: 'Skill 推荐',
    body: '基于你的使用习惯和编码风格，AI 智能推荐适合你的 Skill。每个 Skill 包含描述、使用统计和安装指引。',
    emptyTitle: '获取 Skill 推荐',
    emptySteps: [
      '在终端中执行任务，AI 自动分析使用模式',
      '返回此处查看个性化 Skill 推荐',
      '点击 Skill 查看详情并启用',
    ],
    emptyActionLabel: '去终端执行任务',
  },

  'skill-detail': {
    id: 'skill-detail',
    title: 'Skill 详情',
    body: '查看 Skill 的详细信息：包含描述、源代码、使用统计、版本历史。支持一键启用/禁用。',
    emptyTitle: '查看 Skill 详情',
    emptySteps: [
      '在 Skill 推荐中选择一个 Skill',
      '查看详细的描述和使用统计',
      '决定是否启用该 Skill',
    ],
    emptyActionLabel: '浏览 Skill 推荐',
  },

  'hook-editor': {
    id: 'hook-editor',
    title: 'Hook 编辑器',
    body: '可视化 Hook 脚本编辑器。支持在关键事件点（任务开始、任务完成、错误发生）插入自定义逻辑。',
    emptyTitle: '编写自定义 Hook',
    emptySteps: [
      '选择 Hook 触发事件类型',
      '编写或粘贴 Hook 脚本代码',
      '保存并启用 Hook，下次事件触发时自动执行',
    ],
    emptyActionLabel: '创建新 Hook',
  },

  'hook-log': {
    id: 'hook-log',
    title: 'Hook 日志',
    body: '查看所有 Hook 的执行日志。包括触发时间、执行耗时、输出内容和错误信息。支持按事件类型筛选。',
    emptyTitle: '查看 Hook 日志',
    emptySteps: [
      '创建并启用至少一个 Hook',
      '执行任务触发 Hook 事件',
      '返回此处查看 Hook 执行日志',
    ],
    emptyActionLabel: '创建 Hook',
  },

  'mcp-settings': {
    id: 'mcp-settings',
    title: 'MCP 设置',
    body: '管理 MCP (Model Context Protocol) 服务器配置。添加、编辑、测试 MCP 连接，管理工具权限。',
    emptyTitle: '配置 MCP 服务器',
    emptySteps: [
      '点击添加服务器，输入名称和启动命令',
      '测试连接确保 MCP 服务器可访问',
      '管理工具权限并保存配置',
    ],
    emptyActionLabel: '添加服务器',
  },

  'error-heal': {
    id: 'error-heal',
    title: '错误自愈',
    body: 'AI 自动检测代码错误并匹配历史修复方案。展示错误详情、相似度匹配和推荐的修复代码。',
    emptyTitle: '错误自愈',
    emptySteps: [
      'AI 执行任务时遇到错误自动记录',
      '返回此处查看检测到的错误',
      '选择匹配的修复方案并应用',
    ],
    emptyActionLabel: '',
  },

  'diff-review': {
    id: 'diff-review',
    title: 'Diff 审查',
    body: '展示 AI 生成的代码 Diff。支持逐行审查、添加评论、接受或拒绝变更。',
    emptyTitle: '审查代码变更',
    emptySteps: [
      'AI 执行代码修改任务后自动生成 Diff',
      '返回此处逐行审查变更内容',
      '接受满意的变更或拒绝重做',
    ],
    emptyActionLabel: '去终端执行任务',
  },

  // ========================================================================
  // Security (drawer) — 1 item
  // ========================================================================
  'audit-log': {
    id: 'audit-log',
    title: '审计日志',
    body: '完整的操作审计记录。包括用户输入、Agent 决策、工具调用和系统事件。支持按时间范围、操作类型筛选和导出。',
    emptyTitle: '操作审计记录',
    emptySteps: [
      '所有操作自动记录到审计日志',
      '使用筛选器按类型和时间查找',
      '导出日志用于合规审查',
    ],
    emptyActionLabel: '',
  },

  // ========================================================================
  // System (modal) — 6 items
  // ========================================================================
  'global-terminal': {
    id: 'global-terminal',
    title: '全局终端',
    body: '独立于工作区的全局命令行终端。可在不切换会话的情况下执行系统命令、管理文件和运行脚本。',
    emptyTitle: '打开终端执行命令',
    emptySteps: [
      '点击打开全局终端窗口',
      '输入命令并回车执行',
      '结果实时显示在终端中',
    ],
    emptyActionLabel: '打开终端',
  },

  'exec-analytics': {
    id: 'exec-analytics',
    title: '执行分析',
    body: '任务执行可视化分析。展示任务耗时分布、成功率趋势、瓶颈识别和优化建议。',
    emptyTitle: '分析任务执行效率',
    emptySteps: [
      '执行多个任务产生足够的分析数据',
      '返回此处查看耗时分布和趋势图表',
      '根据优化建议改进任务流程',
    ],
    emptyActionLabel: '去终端执行任务',
  },

  'token-stats': {
    id: 'token-stats',
    title: 'Token 统计',
    body: '详细的 Token 用量统计。按模型、会话、日/周/月维度展示消耗情况，帮助控制 API 成本。',
    emptyTitle: '查看 Token 消耗',
    emptySteps: [
      '使用 AI 后自动产生 Token 消耗数据',
      '返回此处按维度查看用量统计',
      '根据统计调整模型选择控制成本',
    ],
    emptyActionLabel: '',
  },

  compaction: {
    id: 'compaction',
    title: '上下文压缩',
    body: '当 Token 窗口使用率达到 80% 时自动触发。手动模式可随时发起压缩，支持选择压缩策略和预览压缩结果。',
    emptyTitle: '管理上下文窗口',
    emptySteps: [
      '与 AI 进行长对话，Token 逐渐累积',
      '接近阈值时系统提示或手动发起压缩',
      '确认压缩策略并执行',
    ],
    emptyActionLabel: '',
  },

  search: {
    id: 'search',
    title: '全局搜索',
    body: '跨会话、跨工作区的全文搜索。使用 FTS5 搜索引擎，支持关键词、标签、工具类型组合筛选。快捷键: Cmd/Ctrl+K',
    emptyTitle: '搜索历史内容',
    emptySteps: [
      '按下 Cmd/Ctrl+K 打开搜索框',
      '输入关键词搜索历史对话和操作',
      '点击结果跳转到对应的会话',
    ],
    emptyActionLabel: '打开搜索',
  },

  settings: {
    id: 'settings',
    title: '设置',
    body: '应用全局设置：主题模式（暗黑/明亮/跟随系统）、主题色（6 种预设）、节点密度、字体大小、语言切换。',
    emptyTitle: '自定义应用设置',
    emptySteps: [
      '选择主题模式和主题色',
      '调整节点密度和字体大小',
      '切换界面语言',
    ],
    emptyActionLabel: '打开设置',
  },

  // ========================================================================
  // Meta — 1 item
  // ========================================================================
  guide: {
    id: 'guide',
    title: '使用指南',
    body: 'CC Web UI V3.0.0 完整功能指南。覆盖全部 7 组 29 个功能的使用说明和操作技巧。',
    emptyTitle: '',
    emptySteps: [],
    emptyActionLabel: '',
  },
};

// Helper to check if a hint has been seen
export function hasSeenHint(featureId: string): boolean {
  try {
    const seen = localStorage.getItem('cc-web-ui-seen-hints');
    return seen ? seen.split(',').includes(featureId) : false;
  } catch { return false; }
}

export function markHintSeen(featureId: string): void {
  try {
    const seen = localStorage.getItem('cc-web-ui-seen-hints');
    const list = seen ? seen.split(',') : [];
    if (!list.includes(featureId)) {
      list.push(featureId);
      localStorage.setItem('cc-web-ui-seen-hints', list.join(','));
    }
  } catch { /* localStorage not available */ }
}

// Default hint for missing entries
export function getFeatureHint(featureId: string): FeatureHint | null {
  return FEATURE_HINTS[featureId] ?? null;
}

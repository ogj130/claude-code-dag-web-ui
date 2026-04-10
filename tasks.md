# CC Web UI 任务清单

## Phase 3.2: 历史召回算法

- [x] 3.2.1 实现历史召回排序算法（关键词 0.4 + 时间衰减 0.3 + 使用频率 0.3）
- [x] 3.2.2 实现相似问题检测（相似度 > 0.8 时提示"你之前问过类似问题"）
- [x] 3.2.3 实现错误解决方案推荐（基于相似错误搜索）

## Phase 3.3: 数据隐私

- [x] 3.3.1 集成 crypto-js（AES-256）依赖
- [x] 3.3.2 实现敏感字段的 AES-256 加密/解密
- [x] 3.3.3 实现"清除所有历史"功能（含确认对话框）
- [x] 3.3.4 实现 JSON 格式导出功能
- [x] 3.3.5 实现 Markdown 格式导出功能
- [x] 3.3.6 实现隐私模式开关及数据记录控制

## 已创建的文件

1. `src/utils/searchIndex.ts` - 全文搜索索引模块（倒排索引 + 中英文分词）
2. `src/utils/recall.ts` - 历史召回算法（加权排序 + 相似检测 + 错误推荐）
3. `src/hooks/useHistoryRecall.ts` - 历史召回 React Hook
4. `src/utils/encryption.ts` - AES-256 加密/解密工具
5. `src/utils/export.ts` - 数据导出工具（JSON + Markdown）
6. `src/components/PrivacySettings.tsx` - 隐私设置面板
7. `src/types/crypto-js.d.ts` - crypto-js 类型声明
8. `src/components/DAG/GroupNode.tsx` - 分组节点组件（Phase 4.2）
9. `src/utils/performance.ts` - 性能监控工具（Phase 4.1）

## 已修改的文件

1. `src/components/ToolView/TerminalView.tsx` - 集成历史召回推荐面板
2. `src/stores/useSessionStore.ts` - 集成隐私模式控制
3. `src/components/Toolbar/Toolbar.tsx` - 添加隐私设置入口 + 节点分组开关
4. `src/components/DAG/DAGCanvas.tsx` - 添加节点分组逻辑
5. `src/stores/useTaskStore.ts` - 添加分组状态管理

## 功能说明

### AES-256 加密
- 使用 AES-256 算法加密敏感字段（query、analysis、summary、metadata）
- 密钥随机生成并存储在 localStorage 中
- 密钥丢失则已加密数据无法解密

### 隐私模式
- 开启后不创建新的历史记录
- 现有记录不受影响
- 状态存储在 localStorage 中

### 数据导出
- JSON 格式：完整数据导出，包含所有字段
- Markdown 格式：人类可读的文档格式

### 清除历史
- 删除所有 IndexedDB 中的会话和问答数据
- 需要二次确认（危险操作）

## Phase 3.2 功能说明

### 搜索索引（searchIndex.ts）
- 基于内存倒排索引，支持中英文分词
- 中文 bigram 提升召回率
- 增量索引支持

### 召回排序算法（recall.ts）
- **关键词匹配**（权重 0.4）：Jaccard 相似度
- **时间衰减**（权重 0.3）：指数衰减，半衰期 7 天
- **使用频率**（权重 0.3）：对数归一化，最高 20 次

### 相似问题检测
- 综合相似度 = Jaccard（0.6）+ 归一化编辑距离（0.4）
- 相似度 > 0.8 时显示"你之前问过类似问题"提示

### 错误解决方案推荐
- 工具调用失败时自动触发
- 从历史记录和错误日志中搜索相似错误
- 推荐已有成功解决方案

## 编译状态
✓ 编译通过

## Phase 4.1: DAG 虚拟化

- [x] 4.1.1 启用 ReactFlow 内置虚拟化（onlyRenderVisibleElements）
- [x] 4.1.2 实现节点视口裁剪（只渲染可视区域节点）
- [x] 4.1.3 DAGNode 自定义 memo 比较函数（减少不必要的重渲染）
- [x] 4.1.4 性能监控工具（渲染耗时 + FPS 计算）
- [x] 4.1.5 防抖工具函数（降低高频变更开销）

## Phase 4.1 功能说明

### 虚拟化渲染（DAGCanvas.tsx）
- 启用 `onlyRenderVisibleElements={true}`：ReactFlow 只渲染视口内的节点
- `defaultViewport={{ x: 0, y: 0, zoom: 1 }}`：统一初始视口
- controlled 模式回调：`onNodesChange`/`onEdgesChange` 为空函数，由 store 驱动更新
- FPS 帧率监控：通过 rAF 采集帧时间戳，计算实时帧率

### 节点渲染优化（DAGNode.tsx）
- 自定义 `arePropsEqual` 浅比较函数：仅当 id/status/label/type/isCollapsed/summaryContent/args 变化时重渲染
- 避免 props 函数引用变化导致的无意义重渲染

### 性能监控（performance.ts）
- `createPerformanceMonitor()`：创建渲染耗时和 FPS 监控器
- `startRender()`/`endRender()`：记录渲染开始/结束时间
- `recordFrame()`/`calculateFPS()`：帧率计算（最近 60 帧滑动窗口）
- `getSummary()`：获取性能摘要（平均渲染耗时、最后渲染耗时、FPS）
- `debounce()`：防抖工具函数
- `debounceCallback()`：类型安全的防抖（用于 ReactFlow 回调）

## Phase 4.2: 节点分组

- [x] 4.2.1 配置 ReactFlow Group Node 实现同类型节点聚合
- [x] 4.2.2 实现分组节点展开/折叠交互
- [x] 4.2.3 实现聚合节点摘要显示（类型名 + 节点数 + 操作摘要）
- [x] 4.2.4 实现分组开关切换
- [ ] 4.2.5 验证节点数量减少 50% 的目标

## Phase 4.2 功能说明

### 节点分组机制
- **分组逻辑**：按工具名称将同类型工具节点聚合为一个分组节点
- **分组节点 UI**：
  - 显示工具类型图标（带虚线边框）
  - 显示节点数量（大字体）
  - 点击展开/折叠切换
  - 展开时显示所有原始工具节点
- **状态管理**：
  - `groupingEnabled`：全局分组开关（默认开启）
  - `expandedGroupIds`：已展开的分组 ID 集合

### 分组节点组件
**文件**: `src/components/DAG/GroupNode.tsx`
- 支持 tool/query/summary/agent 四种类型的分组图标
- 响应式边框颜色（hover 高亮）
- 平滑的展开/折叠动画
- React.memo 优化渲染性能

### Toolbar 集成
**文件**: `src/components/Toolbar/Toolbar.tsx`
- 添加"节点分组"开关按钮
- 按钮状态：开启时高亮（accent 色），关闭时透明
- 图标：4 格网格图标

### DAGCanvas 改动
**文件**: `src/components/DAG/DAGCanvas.tsx`
- 注册 GroupNodeComponent 到 nodeTypes
- 实现 `groupNodesByType` 工具函数
- 修改布局逻辑支持分组节点（通过 nodeIds 关联父 query）
- 虚拟化渲染（onlyRenderVisibleElements）

### Store 改动
**文件**: `src/stores/useTaskStore.ts`
- 新增 `groupingEnabled` 状态（默认 true）
- 新增 `expandedGroupIds` 状态（Set）
- 新增 `toggleGrouping()` 方法
- 新增 `toggleGroupExpand(groupId)` 方法

## Phase 4.3: 内存管理

- [x] 4.3.1 实现单会话 500 节点数软限制警告
- [x] 4.3.2 实现内存使用监控（超过 150MB 警告）
- [x] 4.3.3 实现图片压缩和缩略图生成
- [x] 4.3.4 实现会话切换时的内存清理（DAG 数据释放）
- [x] 4.3.5 实现存储空间不足时的 FIFO 淘汰（超过 100 条删除最旧的）

## 已创建的文件（Phase 4.3）

1. `src/utils/memoryManager.ts` - 内存管理工具模块

## 已修改的文件（Phase 4.3）

1. `src/stores/useSessionStore.ts` - 集成 FIFO 淘汰和会话切换 DAG 清理
2. `src/components/DAG/DAGCanvas.tsx` - 集成节点数限制警告

## 功能说明

### 内存估算 (memoryManager.ts)
- `estimateMemoryUsage()` - 递归估算 JS 对象内存占用
- `estimateMapMemory()` - 估算 Map 结构内存占用
- 字符串按 UTF-16（2字节/字符）、数字 8 字节、对象属性 50 字节开销计算

### 节点数限制 (4.3.1)
- 软限制：500 节点
- 超过 80%（400 节点）时显示黄色警告
- 超过 500 节点时显示红色警告
- DAGCanvas 顶栏实时显示当前节点数

### 内存监控 (4.3.2)
- 使用 `performance.memory` API（Chrome 特有）
- 警告阈值：150MB
- 定时检查（默认 60 秒间隔）
- 事件监听器机制，支持外部订阅警告

### 图片压缩 (4.3.3)
- `compressImage()` - Canvas 压缩，默认最大宽度 800px，JPEG 质量 0.85
- `generateThumbnail()` - 生成缩略图，默认最大边长 200px，返回 Data URL

### DAG 内存清理 (4.3.4)
- 会话切换时自动清理旧 DAG 节点
- 保留 main-agent + 最近 3 条 query 链（query + tools + summary）
- `cleanupDagNodes()` 可配置保留链数

### FIFO 淘汰 (4.3.5)
- 阈值：100 条会话
- 超过阈值时自动删除最旧的 10 条
- 保护当前活跃会话不被删除
- 异步删除 IndexedDB 数据，触发警告事件

## Phase 5.2: 主题系统

- [x] 5.2.1 实现 CSS Variables 主题变量定义
- [x] 5.2.2 实现暗黑主题样式
- [x] 5.2.3 实现明亮主题样式
- [x] 5.2.4 实现跟随系统主题（prefers-color-scheme，首次访问自动匹配）
- [x] 5.2.5 实现 6 种预设主题色切换
- [x] 5.2.6 实现 3 档节点密度切换（紧凑/标准/宽松）
- [x] 5.2.7 实现 12-18px 字体大小调节
- [x] 5.2.8 实现主题设置持久化到 localStorage

## 已创建的文件（Phase 5.2）

1. `src/styles/themes.css` - CSS Variables 主题定义
2. `src/hooks/useTheme.ts` - 主题管理 Hook
3. `src/components/ThemeSettings.tsx` - 主题设置面板

## 已修改的文件（Phase 5.2）

1. `src/App.tsx` - 集成主题系统
2. `src/components/Toolbar/Toolbar.tsx` - 添加主题设置入口
3. `src/main.tsx` - 引入新主题样式文件

## 功能说明（Phase 5.2）

### 主题模式
- **暗黑**：深色背景，适合夜间使用
- **明亮**：浅色背景，适合白天使用
- **跟随系统**：自动匹配操作系统的主题偏好

### 预设主题色（6 种）
- 蓝（#4a9eff）、紫（#8b5cf6）、绿（#22c55e）、橙（#f97316）、红（#ef4444）、粉（#ec4899）

### 节点密度（3 档）
- 紧凑：8px 内边距，4px 间距
- 标准：12px 内边距，8px 间距
- 宽松：16px 内边距，12px 间距

### 字体大小
- 支持 12-18px 调节，1px 步进

### 持久化
- 所有主题设置保存在 `localStorage` 的 `cc-theme-config` 键
- 首次访问自动检测系统主题偏好

## Phase 5.1: 快捷键系统

- [x] 5.1.1 实现 Cmd/Ctrl+K 全局搜索快捷键（已在 Phase 3 实现，迁移至统一 Hook）
- [x] 5.1.2 实现 Cmd/Ctrl+Shift+C 折叠全部节点
- [x] 5.1.3 实现 Cmd/Ctrl+Shift+E 展开全部节点
- [x] 5.1.4 实现 Cmd/Ctrl+T 主题切换
- [x] 5.1.5 实现 Cmd/Ctrl+H 历史面板切换
- [x] 5.1.6 实现 Esc 关闭弹窗/取消选择
- [x] 5.1.7 实现快捷键冲突检测和警告

## 已创建的文件（Phase 5.1）

1. `src/hooks/useKeyboardShortcuts.ts` — 全局快捷键 Hook（注册、匹配、冲突检测）
2. `src/components/ShortcutHelp.tsx` — 快捷键帮助面板（? 键触发）
3. `src/components/HistoryPanel.tsx` — 问答历史面板（Cmd+H 触发）
4. `src/styles/shortcut-help.css` — 快捷键帮助面板样式
5. `src/styles/history-panel.css` — 历史面板样式

## 已修改的文件（Phase 5.1）

1. `src/stores/useTaskStore.ts` — 添加 `collapseAllDagQueries` 和 `expandAllDagQueries` 方法
2. `src/App.tsx` — 集成 `useKeyboardShortcuts` Hook，替换原有的 Cmd+K 监听

## 功能说明（Phase 5.1）

### 快捷键列表
| 快捷键 | 功能 | 作用域 |
|--------|------|--------|
| Cmd/Ctrl+K | 全局搜索 | 全局 |
| Cmd/Ctrl+Shift+C | 折叠全部 DAG 节点 | DAG |
| Cmd/Ctrl+Shift+E | 展开全部 DAG 节点 | DAG |
| Cmd/Ctrl+T | 切换主题（暗/亮） | 全局 |
| Cmd/Ctrl+H | 显示/隐藏问答历史面板 | 全局 |
| Esc | 关闭弹窗/取消选择 | 弹窗 |
| ? | 显示快捷键帮助 | 全局 |

### 冲突检测
- Cmd+K: Chrome 地址栏聚焦（可覆盖）
- Cmd+T: 浏览器新建标签页（无法覆盖，仅提示）
- Cmd+H: macOS 隐藏窗口（无法覆盖，仅提示）
- Cmd+Shift+C: Chrome DevTools 元素检查（DevTools 打开时拦截）

### 使用方式
在 App.tsx 中通过 `useKeyboardShortcuts` Hook 统一注册所有快捷键，回调函数通过 ref 保持最新状态，使用 capture 阶段事件监听确保优先级。

## 编译状态
✓ TypeScript 编译通过

## Phase 6.2: 执行分析

- [x] 6.2.1 实现工具调用次数饼图
- [x] 6.2.2 实现平均响应时间统计
- [x] 6.2.3 实现错误率趋势折线图
- [x] 6.2.4 实现热点工具排行榜（Top 10）
- [x] 6.2.5 实现时间范围选择器（7 天/30 天/全部）

## 已创建的文件（Phase 6.2）

1. `src/utils/executionStats.ts` - 执行统计工具模块
2. `src/components/ExecutionAnalytics.tsx` - 执行分析面板
3. `src/components/ToolDistribution.tsx` - 工具分布图表（饼图）
4. `src/components/ToolRanking.tsx` - 热点工具排行
5. `src/components/ErrorRateTrendChart.tsx` - 错误率趋势折线图

## 已修改的文件（Phase 6.2）

1. `src/App.tsx` - 集成 ExecutionAnalytics 面板
2. `src/components/Toolbar/Toolbar.tsx` - 添加执行分析入口按钮

## 功能说明（Phase 6.2）

### 工具调用分布（饼图）
- 使用 Recharts PieChart 展示各工具的调用次数占比
- 支持时间范围过滤

### 平均响应时间（表格）
- 按工具名称统计平均响应时间
- 显示调用次数和平均耗时（毫秒/秒/分钟自动转换）

### 错误率趋势（折线图）
- 使用 Recharts LineChart 展示每日错误率
- 同时显示总调用次数和错误次数
- 支持 7 天/30 天时间范围

### 热点工具排行（Top 10）
- 按调用次数排序
- 显示排名、工具名、调用次数、平均耗时、错误率
- 金/银/铜前三名特殊配色

### 时间范围选择器
- 7 天：最近 7 天的数据
- 30 天：最近 30 天的数据
- 全部：所有历史数据

## Phase 6.1: Token 统计

- [x] 6.1.1 在 Query Card 中显示单次查询 Token 消耗
- [x] 6.1.2 实现会话总 Token 消耗显示
- [x] 6.1.3 集成 Recharts 依赖（已安装）
- [x] 6.1.4 实现 7 天 Token 趋势折线图
- [x] 6.1.5 实现 30 天 Token 趋势折线图
- [x] 6.1.6 实现模型定价配置界面（仅用于展示，不做 USD 换算）

## 已创建的文件（Phase 6.1）

1. `src/utils/tokenStats.ts` - Token 统计工具模块
2. `src/components/TokenAnalytics.tsx` - Token 统计面板
3. `src/components/TokenChart.tsx` - Token 趋势图表
4. `src/components/TokenPricing.tsx` - 模型定价配置界面

## 已修改的文件（Phase 6.1）

1. `src/stores/useTaskStore.ts` - 添加 lastTokenUsage 状态和 tokenUsage 事件处理
2. `src/components/ToolView/MarkdownCard.tsx` - 添加 Token 使用信息显示
3. `src/components/ToolView/LiveCard.tsx` - 添加实时 Token 使用信息显示
4. `src/App.tsx` - 集成 TokenAnalytics 弹窗
5. `src/components/Toolbar/Toolbar.tsx` - 添加 Token 统计入口按钮

## 功能说明（Phase 6.1）

### 单次查询 Token 显示
- 在已完成的 Query Card 底部显示本次查询的 Token 消耗
- 实时卡片完成时也显示 Token 统计
- 格式：Token: N,NNN

### Token 统计面板
- 总消耗：历史累计 Token 使用量
- 平均/次：每次查询平均 Token 消耗
- 近N天消耗：指定时间范围内的 Token 使用量
- 日均：平均每天 Token 消耗

### Token 趋势图表
- 使用 Recharts LineChart 展示每日 Token 使用量
- 支持 7 天/30 天时间范围切换
- 鼠标悬停显示详细数据（Token 数量 + 查询次数）

### 模型定价配置
- 显示预设的模型定价（Claude Sonnet 4、Claude Opus 4、Claude Haiku）
- 输入/输出价格（USD/M tokens）
- 支持自定义添加、编辑、删除模型
- 重置为默认配置功能

### Toolbar 入口
- 右侧工具栏添加 "Token 统计" 按钮
- 点击打开 Token 统计面板

## 编译状态
✓ TypeScript 编译通过

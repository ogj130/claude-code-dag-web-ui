## Context

Claude Code DAG Web UI v1.0 是一个基于 React + ReactFlow 的 AI 工作流可视化工具。目前架构如下：

```
┌─────────────┐     WebSocket      ┌─────────────┐
│ Claude Code │ ←───────────────→ │   Web UI    │
│   Backend   │   SSE + JSON       │   (React)   │
└─────────────┘                    └─────────────┘
                                         ↓
                                    ReactFlow DAG
                                         ↓
                                   Zustand Store
                                   (Memory only)
```

**当前痛点：**
- 刷新页面数据丢失
- 网络波动导致连接断开无感知
- ReactFlow 直接渲染所有节点，大图谱卡顿
- 无历史记录功能

**利益相关方：**
- 开发者：需要稳定的工作流可视化工具
- AI 开发者：依赖 DAG 分析和调试 AI 行为
- 研究者：需要历史对话数据的回溯和分析

## Goals / Non-Goals

**Goals:**
- 实现 WebSocket 可靠连接（自动重连、手动重连、状态感知）
- 实现 IndexedDB 本地持久化（会话、历史、配置）
- 实现历史对话的智能存储和召回
- 实现百节点级别的流畅 DAG 渲染
- 实现完整的快捷键系统和主题支持
- 实现 Token 消耗和执行分析的可视化

**Non-Goals:**
- 不做云端同步（纯本地优先，隐私优先）
- 不做移动端适配（仅支持平板 iPad）
- 不做多人协作功能
- 不做完整的代码编辑器（Terminal 输出保持原样）
- 不替换现有 ReactFlow（基于现有能力扩展）

## Decisions

### Decision 1: 存储层选型 — Dexie.js 封装 IndexedDB

**选择：** Dexie.js
**替代方案考虑：**
- ❌ `localStorage`: 容量小（5MB），不支持复杂查询
- ❌ `raw IndexedDB`: API 复杂，版本迁移困难
- ❌ `SQLite (WASM)`: 包体积大（~3MB），对小数据集过度设计
- ❌ `idb-keyval`: 过于简单，不支持复杂模型

**理由：** Dexie.js 提供 Promise 化的简洁 API，支持复杂查询、索引、版本迁移，且包体积小（~20KB gzip）。与 Zustand 的持久化中间件配合良好。

### Decision 2: DAG 虚拟化策略 — ReactFlow 内置虚拟化 + 自定义节点分组

**选择：** ReactFlow 内置虚拟化 + 自定义分组
**替代方案考虑：**
- ❌ `react-virtual`: 通用虚拟列表，与 ReactFlow 集成复杂
- ❌ `react-window`: 同上
- ❌ `完全自研渲染层`: 工作量巨大，维护成本高

**理由：** ReactFlow 11+ 内置虚拟化支持，且项目已在使用。节点分组是 ReactFlow 的内置功能（Group Node），只需配置即可。避免引入新渲染层带来的兼容性风险。

### Decision 3: 搜索策略 — FlexSearch（轻量全文搜索）

**选择：** FlexSearch
**替代方案考虑：**
- ❌ `Lunr.js`: 索引构建慢，不支持增量索引
- ❌ `Elasticsearch`: 需要服务端，不适合纯前端
- ❌ `Transformers.js 语义搜索`: 包体积约 50MB，严重影响首屏性能
- ❌ `全文自研`: 过度工程化

**理由：** FlexSearch 支持增量索引、Web Worker 后台构建，包体积小（~10KB gzip），v2.0 仅实现关键词搜索。语义搜索作为 v2.1 的可选增强项。

**v2.1 预留：** 语义搜索（Transformers.js，按需加载）

### Decision 4: WebSocket 重连状态机

**选择：** XState 风格状态机
**替代方案考虑：**
- ❌ `简单 setTimeout 重试`: 状态混乱，难于调试
- ❌ `RxJS`: 学习曲线陡，引入新范式

**理由：** 状态机提供清晰的状态转换（connecting → connected / disconnected → reconnecting → failed），便于 UI 响应不同状态。手动实现状态机（非引入 XState）保持轻量。

### Decision 5: 主题系统 — CSS Variables + 类名切换 + 跟随系统默认

**选择：** CSS Variables + `data-theme` 属性，默认跟随系统
**替代方案考虑：**
- ❌ `CSS-in-JS (styled-components)`: 运行时样式注入，SSR 复杂
- ❌ `Tailwind CSS`: 需引入工具链，破坏现有样式
- ❌ `强制默认暗黑`: 不够智能，用户需要手动切换

**理由：** CSS Variables 是现代浏览器原生支持，切换主题只需修改根元素属性，性能最优。配合 `prefers-color-scheme` 媒体查询，首次访问时自动匹配系统主题，减少用户首次配置。

### Decision 6: 数据压缩 — LZ-String

**选择：** LZ-String
**替代方案考虑：**
- ❌ `pako (gzip)`: 压缩率略高但解压慢
- ❌ `LZMA`: 压缩率高但速度慢，适合大文件
- ❌ `不压缩`: IndexedDB 存储配额有限（通常 50MB-无限制）

**理由：** LZ-String 提供快速的压缩/解压速度（对短文本优化良好），API 简洁，兼容性好。IndexedDB 存储配额因浏览器而异，压缩可有效延长可用空间。

## Risks / Trade-offs

**[风险 1] IndexedDB 存储配额限制**
→ **缓解：** LZ-String 压缩 + FIFO 淘汰策略 + 单会话 10MB 分片限制

**[风险 2] ReactFlow 虚拟化兼容性**
→ **缓解：** 使用 ReactFlow 11+ 内置虚拟化 API，避免第三方库；在 dev 环境进行百节点压力测试

**[风险 3] Transformers.js 包体积大（语义搜索）**
→ **缓解：** 语义搜索作为可选功能，Web Worker 异步加载；提供降级方案（仅关键词搜索）

**[风险 4] 浏览器 IndexedDB 不支持（如隐私模式）**
→ **缓解：** 检测 IndexedDB 可用性，不可用时降级到 localStorage（容量受限警告）

**[风险 5] 状态同步冲突（缓存 vs 服务端）**
→ **缓解：** 刷新页面时优先读缓存，后台同步服务端；服务端数据优先展示，缓存异步更新

**[风险 6] WebSocket 重连时序问题**
→ **缓解：** 状态机管理连接状态；重连期间显示"同步中"状态，避免数据覆盖

## Migration Plan

**Phase 1（P0）- 稳定性（2 周）**
1. 实现 WebSocket 重连状态机
2. 添加 React 错误边界
3. 实现空状态 UI
4. 测试各种断连场景

**Phase 2（P1）- 持久化（2 周）**
1. 集成 Dexie.js，定义数据库 Schema
2. 实现会话列表/详情的 CRUD 操作
3. 实现缓存同步机制
4. 添加数据导出功能

**Phase 3（P1）- 历史召回（3 周）**
1. 实现 FlexSearch 全文索引
2. 实现历史召回排序算法
3. 实现主动推荐功能
4. 添加隐私设置界面

**Phase 4（P1）- 性能（2 周）**
1. 启用 ReactFlow 虚拟化
2. 实现节点分组聚合
3. 添加内存使用监控
4. 压力测试（1000 节点）

**Phase 5（P2）- 交互增强（2 周）**
1. 实现快捷键系统
2. 实现全局搜索
3. 实现主题系统

**Phase 6（P2）- 监控分析（1 周）**
1. 实现 Token 统计图表
2. 实现执行分析可视化
3. 集成 Recharts

**回滚策略：** 每个 Phase 独立部署，发现问题可单独回滚对应功能。IndexedDB Schema 变更支持版本迁移。

## Open Questions

~~1. **语义搜索的必要性**：Transformers.js 约 50MB，是否需要？还是 FlexSearch 关键词搜索已足够？~~ → ✅ **已决定：v2.0 不做语义搜索，仅 FlexSearch 关键词搜索**
~~2. **历史数据淘汰策略**：30 天未访问自动归档，还是保留全部由用户手动删除？~~ → ✅ **已决定：手动删除模式，除非存储空间不足才自动清理**
~~3. **Token 成本估算**：是否需要接入真实 API 计费，还是使用固定单价估算？~~ → ✅ **已决定：仅显示 Token 数量，不做 USD 换算**
~~4. **主题默认选择**：新用户默认跟随系统还是默认暗黑？~~ → ✅ **已决定：首次访问跟随系统（prefers-color-scheme）**
~~5. **快捷键冲突处理**：与浏览器/IDE 快捷键冲突时如何处理？~~ → ✅ **已决定：仅警告，不强制调整**
~~6. **IndexedDB 存储上限**：是否有必要设置硬性上限，还是依赖浏览器配额？~~ → ✅ **已决定：依赖浏览器配额，接近满时警告**

## 实施策略

**并行 Agent 规则：**
- 无依赖的任务组可使用多个 Agent 并行实施
- Phase 1（P0 稳定性）：WebSocket + Error Boundary + Empty States 完全并行
- Phase 2-3：Storage 层完成后，Cache Sync 和 History Storage 可并行
- Phase 5-6（P2 体验/监控）：主题、快捷键、搜索、图表可并行

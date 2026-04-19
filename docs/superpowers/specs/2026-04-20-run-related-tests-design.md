# 智能相关测试 Skill 设计

## 背景

当前项目有 77 个测试文件、920 个测试用例，完整运行需要约 11 秒。每次修复 bug 后跑全部测试会消耗大量上下文，导致后续工作时上下文不足。需要一种智能机制，只跑与本次修改相关的测试。

## 目标

封装一个自动化 skill，在每次 bug 修复且浏览器验证通过后：
1. 分析 git diff 找出本次修改的源文件
2. 智能映射到对应的测试文件
3. 只运行相关测试，秒级完成
4. 报告结果，决定是否继续或回退

## 触发时机（自动）

- **浏览器验证通过后**：本小姐完成修复，用 Playwright 验证功能正确，立即自动触发
- **修复提交前**：防止引入 regression（可选，作为防御层）

**不触发的情况：**
- 纯研究/探索类任务（没改代码）
- 配置文件修改（.gitignore、tsconfig.json 等）
- README / 文档类修改
- node_modules / package-lock.json 修改

## 智能映射规则

| 修改文件 | 对应测试文件 |
|---|---|
| `src/hooks/xxx.ts` | `src/hooks/__tests__/xxx.test.ts` |
| `src/stores/yyy.ts` | `src/__tests__/yyy.test.ts` |
| `src/__tests__/zzz.test.ts` | `src/__tests__/zzz.test.ts`（自身） |
| `src/components/xxx.tsx` | `src/__tests__/xxx.test.tsx` |
| `src/services/zzz.ts` | `src/__tests__/zzz.test.ts` |
| `server/*.ts` | 无（服务端测试暂不纳入） |

**找不到对应测试？** → 静默跳过，不报错

**多个修改文件？** → 合并所有对应测试，一次运行

## 实现方案

### Skill 文件结构

```
~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/run-related-tests/
├── skill.md          # Skill 定义和触发逻辑
├── run-related-tests.sh  # Git diff 分析 + 测试执行脚本（可选）
└── README.md         # 使用说明
```

### 核心流程

```
1. git diff --name-only  # 获取本次修改的文件列表
2. 过滤出 src/ 下的源文件（排除 __tests__ 自身修改的配置文件）
3. 应用映射规则，找出对应测试文件
4. npx vitest run --reporter=verbose <测试文件1> <测试文件2> ...
5. 解析输出，提取通过/失败数量
6. 报告结果
```

### 报告格式

```
═══════════════════════════════════════
🎯 相关测试结果（3 个文件，42 个用例）
═══════════════════════════════════════
✅ src/hooks/__tests__/useWebSocket.test.ts — 12 passed
✅ src/__tests__/useTaskStore.test.ts — 28 passed
⚠️  src/__tests__/useSessionStore.test.ts — 1 failed, 1 passed
═══════════════════════════════════════
结论：1 个文件失败，请检查是否需要回退
```

### 失败处理策略

- **1-2 个测试失败**：本小姐分析是否是已知问题，尝试修复
- **大量失败（>10 个）**：提示笨蛋你，可能是修改范围过大，建议分步提交
- **测试超时**：延长 vitest timeout 或跳过该文件

## 与 CI 的关系

此 skill 是**开发时辅助**，不替代 CI：
- CI 始终跑完整测试套件
- 此 skill 目的是节省开发时的上下文，不是安全网

## 验收标准

1. 修改 `src/hooks/useWebSocket.ts` 后，只跑 `src/hooks/__tests__/useWebSocket.test.ts`
2. 修改 `src/stores/useTaskStore.ts` 后，跑 `src/__tests__/useTaskStore.test.ts`
3. 修改了 3 个文件，对应 3 个测试文件，全部运行
4. 无对应测试的文件，静默跳过，不报错
5. 运行时间 < 5 秒（相比完整测试 11 秒）

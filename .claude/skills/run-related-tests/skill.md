---
name: run-related-tests
description: 分析 git diff，自动运行与本次修改相关的测试文件
type: automation
---

# 智能相关测试 Runner

## 触发时机

**自动执行**，无需用户触发。在以下情况自动调用：
- 每次 bug 修复完成且浏览器验证通过后
- 每次功能实现完成且浏览器验证通过后

**不触发的情况：**
- 纯研究/探索类任务（未修改任何代码）
- 配置文件修改（.gitignore、tsconfig.json、package.json 等）
- 文档类修改（README.md、docs/ 等）
- node_modules / package-lock.json 修改

## 核心逻辑

1. 读取 `git diff --name-only HEAD` 获取本次修改的文件
2. 根据映射规则找出对应的测试文件：
   - `src/hooks/xxx.ts` → `src/hooks/__tests__/xxx.test.ts`
   - `src/stores/yyy.ts` → `src/__tests__/yyy.test.ts`
   - `src/components/zzz.tsx` → `src/__tests__/zzz.test.tsx`
   - `src/__tests__/` 自身修改 → 跑自己
3. 运行 `npx vitest run <测试文件>`
4. 报告结果

## 使用方式

本 skill 由父 agent 自动调用，无需手动触发。调用时执行：

```bash
cd /Users/ouguangji/2026/cc-web-ui
.claude/skills/run-related-tests/run.sh
```

## 输出示例

```
🔍 分析 git diff...
修改的文件:
  src/hooks/useWebSocket.ts
  src/stores/useTaskStore.ts

🎯 运行 2 个相关测试文件:
   - src/hooks/__tests__/useWebSocket.test.ts
   - src/__tests__/useTaskStore.test.ts

═══════════════════════════════════════
✅ 全部通过！2 个文件
═══════════════════════════════════════
```

## 失败处理

- **少量失败（<5个用例）**：分析是否需要修复，或标记为已知问题继续
- **大量失败（>10个用例）**：提示用户，可能是修改范围过大
- **找不到测试**：静默跳过，输出 "✅ 找到 0 个相关测试文件"
- **测试超时**：vitest 默认 5s timeout，复杂测试可能需要更长

## 注意事项

- 始终在项目根目录 `/Users/ouguangji/2026/cc-web-ui` 执行
- 使用 `npx vitest run`（而非 `vitest`），确保走本地安装
- 不修改任何项目文件，纯读取 + 执行

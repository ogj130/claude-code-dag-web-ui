# run-related-tests

智能分析 git diff，自动运行与本次修改相关的测试文件。

## 工作原理

1. 读取 `git diff --name-only HEAD` 获取本次修改的文件
2. 根据内置映射规则找出对应的测试文件
3. 运行 `npx vitest run <测试文件>`
4. 报告结果

## 映射规则

| 修改文件 | 对应测试 |
|---|---|
| `src/hooks/xxx.ts` | `src/hooks/__tests__/xxx.test.ts` |
| `src/stores/yyy.ts` | `src/__tests__/yyy.test.ts` |
| `src/components/zzz.tsx` | `src/__tests__/zzz.test.tsx` |
| `src/services/*.ts` | `src/__tests__/*.test.ts` |
| `src/__tests__/自身.test.ts` | 跑自己 |
| `server/*.ts` | 跳过 |

## 使用场景

此 skill 由 Claude Code 自动调用，无需手动执行。

当你在项目中完成以下操作后会自动触发：
- 修复 bug 并浏览器验证通过
- 实现功能并浏览器验证通过

## 手动测试

```bash
cd /Users/ouguangji/2026/cc-web-ui
.claude/skills/run-related-tests/run.sh
```

## 与完整测试的区别

| | run-related-tests | npm test（完整测试）|
|---|---|---|
| 运行文件数 | 1-5 个 | 77 个 |
| 运行时间 | 1-3 秒 | ~11 秒 |
| 触发时机 | 开发时自动 | CI / 手动 |
| 目的 | 节省上下文，快速验证 | 安全网 |

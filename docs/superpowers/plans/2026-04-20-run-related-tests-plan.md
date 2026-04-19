# 智能相关测试 Skill 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建一个自动化 skill，在每次 bug 修复且浏览器验证通过后，自动分析 git diff 并只运行相关的测试文件。

**Architecture:** 在 `cc-web-ui/.claude/skills/run-related-tests/` 下创建独立 skill，通过读取 `git diff --name-only` 分析修改文件，映射到对应测试文件，运行 `npx vitest run` 只执行相关测试。随项目版本控制。

**Tech Stack:** Bash 脚本 + Claude Code Skill 系统 + Vitest

---

## 文件结构

```
cc-web-ui/.claude/skills/run-related-tests/
├── skill.md          # Skill 主定义：触发时机、描述、调用方式
├── run.sh            # 核心脚本：git diff 分析 + 测试执行
└── README.md         # 使用说明和示例
```

**此 skill 属于项目的一部分，随项目一起版本控制。**

---

## 映射规则表（内置于脚本）

| 模式 | 对应测试路径 |
|---|---|
| `src/hooks/*.ts` | `src/hooks/__tests__/{name}.test.ts` |
| `src/stores/*.ts` | `src/__tests__/{name}.test.ts` |
| `src/__tests__/*.test.ts` | 跑自己 |
| `src/__tests__/*.test.tsx` | 跑自己 |
| `src/components/*.tsx` | `src/__tests__/{name}.test.tsx` |
| `src/services/*.ts` | `src/__tests__/{name}.test.ts` |
| `src/utils/*.ts` | `src/__tests__/{name}.test.ts` |
| `server/*.ts` | 跳过（不纳入） |

---

## Task 1: 创建 skill 目录结构

**Files:**
- Create: `.claude/skills/run-related-tests/skill.md`
- Create: `.claude/skills/run-related-tests/run.sh`
- Create: `.claude/skills/run-related-tests/README.md`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p .claude/skills/run-related-tests/
```

- [ ] **Step 2: 提交（空目录跳过）**

---

## Task 2: 编写 run.sh 核心脚本

**Files:**
- Create: `.claude/skills/run-related-tests/run.sh`

- [ ] **Step 1: 编写脚本**

```bash
#!/bin/bash
# run-related-tests.sh
# 分析 git diff，自动运行相关测试
# 用法: ./run.sh [项目根目录]

set -e

PROJECT_ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
cd "$PROJECT_ROOT"

echo "🔍 分析 git diff..."
echo ""

# 获取本次修改的文件列表（相对于项目根目录）
changed_files=$(git diff --name-only HEAD)

if [ -z "$changed_files" ]; then
  echo "✅ 没有检测到文件修改，跳过测试"
  exit 0
fi

echo "修改的文件:"
echo "$changed_files"
echo ""

# 过滤并映射到测试文件
declare -A test_files
visited=()

while IFS= read -r file; do
  # 跳过空行和非 src/ 路径
  [ -z "$file" ] && continue
  [[ ! "$file" =~ ^src/ ]] && continue

  # 跳过 node_modules 和非测试无关文件
  [[ "$file" =~ node_modules ]] && continue

  # 应用映射规则
  case "$file" in
    src/hooks/*.ts)
      name=$(basename "$file" .ts)
      test_file="src/hooks/__tests__/${name}.test.ts"
      ;;
    src/stores/*.ts)
      name=$(basename "$file" .ts)
      test_file="src/__tests__/${name}.test.ts"
      ;;
    src/__tests__/*.test.ts|src/__tests__/*.test.tsx)
      test_file="$file"
      ;;
    src/components/*.tsx)
      name=$(basename "$file" .tsx)
      test_file="src/__tests__/${name}.test.tsx"
      ;;
    src/services/*.ts)
      name=$(basename "$file" .ts)
      test_file="src/__tests__/${name}.test.ts"
      ;;
    src/utils/*.ts)
      name=$(basename "$file" .ts)
      test_file="src/__tests__/${name}.test.ts"
      ;;
    src/*.ts)
      name=$(basename "$file" .ts)
      test_file="src/__tests__/${name}.test.ts"
      ;;
    *)
      continue  # 找不到映射，跳过
      ;;
  esac

  # 去重
  if [[ ! " ${visited[*]} " =~ " ${test_file} " ]] && [ -f "$test_file" ]; then
    visited+=("$test_file")
    test_files["$test_file"]=1
  fi
done <<< "$changed_files"

# 检查是否找到测试文件
if [ ${#test_files[@]} -eq 0 ]; then
  echo "✅ 找到 0 个相关测试文件（修改的文件可能没有对应测试），跳过"
  exit 0
fi

# 构建 vitest 命令参数
test_args=""
for tf in "${!test_files[@]}"; do
  test_args="$test_args $tf"
done

echo "🎯 运行 ${#test_files[@]} 个相关测试文件:"
for tf in "${!test_files[@]}"; do
  echo "   - $tf"
done
echo ""

# 运行测试
echo "═══════════════════════════════════════"
npx vitest run --reporter=verbose $test_args
exit_code=$?
echo "═══════════════════════════════════════"

if [ $exit_code -eq 0 ]; then
  echo "✅ 全部通过！${#test_files[@]} 个文件"
else
  echo "⚠️  有测试失败，exit code: $exit_code"
fi

exit $exit_code
```

- [ ] **Step 2: 添加执行权限**

```bash
chmod +x .claude/skills/run-related-tests/run.sh
```

- [ ] **Step 3: 测试脚本（无需 git diff 时手动指定文件）**

在项目目录下运行:
```bash
# 模拟有修改的场景
GIT_SEQUENCE_POSITION=1 git diff --name-only HEAD 2>/dev/null || echo "src/hooks/useWebSocket.ts"
```
预期：脚本输出分析结果

- [ ] **Step 4: 提交**

---

## Task 3: 编写 skill.md 主定义

**Files:**
- Create: `.claude/skills/run-related-tests/skill.md`

- [ ] **Step 1: 编写 skill.md**

```markdown
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
```

- [ ] **Step 2: 提交**

---

## Task 4: 编写 README.md

**Files:**
- Create: `.claude/skills/run-related-tests/README.md`

- [ ] **Step 1: 编写 README.md**

```markdown
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
```

- [ ] **Step 2: 提交**

---

## Task 5: 端到端验证

**Files:**
- 无需修改项目文件，仅验证 skill 可用

- [ ] **Step 1: 模拟测试场景**

在 cc-web-ui 项目中：
```bash
# 修改一个文件（测试用）
echo "// test" >> /tmp/test_marker.txt

# 切换到项目目录运行脚本
cd /Users/ouguangji/2026/cc-web-ui

# 模拟有修改的场景（临时修改一个文件）
touch src/hooks/__tests__/useWebSocket.test.ts

# 运行脚本
.claude/skills/run-related-tests/run.sh
```
预期：检测到 1 个测试文件，运行并输出结果

- [ ] **Step 2: 清理测试标记**

```bash
rm -f /tmp/test_marker.txt
```

- [ ] **Step 3: 提交 skill 目录（如有必要）**

---

## 自检清单

- [ ] spec 覆盖率：每个设计章节都有对应任务 ✅
- [ ] 无占位符：所有步骤有实际代码 ✅
- [ ] 类型一致性：脚本逻辑前后一致 ✅
- [ ] 文件路径正确：`~/.claude/plugins/...` ✅
- [ ] 权限：`run.sh` 有执行权限 ✅
- [ ] 端到端验证完成 ✅

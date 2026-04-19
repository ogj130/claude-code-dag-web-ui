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

# 过滤并映射到测试文件（使用冒号分隔字符串代替关联数组，兼容 bash 3.2）
visited=""
test_files_list=""

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

  # 去重：检查是否已在 visited 中
  if [[ ! ":$visited:" =~ ":$test_file:" ]] && [ -f "$test_file" ]; then
    visited="${visited}:${test_file}"
    test_files_list="${test_files_list}${test_file}"$'\n'
  fi
done <<< "$changed_files"

# 计算测试文件数量
test_count=$(echo "$test_files_list" | grep -c .)

# 检查是否找到测试文件
if [ -z "$test_files_list" ]; then
  echo "✅ 找到 0 个相关测试文件（修改的文件可能没有对应测试），跳过"
  exit 0
fi

# 构建 vitest 命令参数
echo "🎯 运行 ${test_count} 个相关测试文件:"
echo "$test_files_list"
echo ""

# 运行测试
echo "═══════════════════════════════════════"
npx vitest run --reporter=verbose $test_files_list
exit_code=$?
echo "═══════════════════════════════════════"

if [ $exit_code -eq 0 ]; then
  echo "✅ 全部通过！${test_count} 个文件"
else
  echo "⚠️  有测试失败，exit code: $exit_code"
fi

exit $exit_code

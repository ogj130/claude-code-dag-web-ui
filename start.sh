#!/bin/bash
# CC Web 启动脚本

PID_FILE=".cc-web.pid"
LOG_FILE=".cc-web.log"
# 可能残留的子进程名
CHILD_NAMES=("tsx" "vite" "esbuild" "node.*server/index" "concurrently")

is_running() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      return 0
    fi
    rm -f "$PID_FILE"
  fi
  return 1
}

# 彻底清理所有相关进程（防止子进程残留导致端口冲突）
cleanup_processes() {
  echo "正在清理旧进程..."
  # 杀主 PID
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    kill "$PID" 2>/dev/null
  fi
  # 杀所有相关子进程
  for name in "${CHILD_NAMES[@]}"; do
    pkill -f "$name" 2>/dev/null
  done
  sleep 1
  rm -f "$PID_FILE"
}

start() {
  if is_running; then
    PID=$(cat "$PID_FILE")
    echo "CC Web 已在运行中 (PID: $PID)"
    return 1
  fi

  echo "正在检查 TypeScript 编译..."
  if ! npx tsc --noEmit 2>&1; then
    echo "❌ TypeScript 编译失败，请先修复错误"
    return 1
  fi
  echo "✓ 类型检查通过"

  echo "正在启动 CC Web..."
  npm run dev > "$LOG_FILE" 2>&1 &
  PID=$!
  echo $PID > "$PID_FILE"
  echo "CC Web 已启动 (PID: $PID)"
  echo "前端: http://localhost:5400"
  echo "WS Server: ws://localhost:5300"
  echo "日志: $LOG_FILE"
}

stop() {
  cleanup_processes
  echo "CC Web 已停止"
}

status() {
  if is_running; then
    PID=$(cat "$PID_FILE")
    echo "✓ CC Web 正在运行 (PID: $PID)"
    echo "  前端: http://localhost:5400"
    echo "  WS Server: ws://localhost:5300"
  else
    echo "✗ CC Web 未在运行"
  fi
}

case "${1:-start}" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    cleanup_processes
    sleep 1
    start
    ;;
  status)
    status
    ;;
  log)
    if [ -f "$LOG_FILE" ]; then
      tail -n 50 "$LOG_FILE"
    else
      echo "日志文件不存在"
    fi
    ;;
  *)
    echo "用法: $0 {start|stop|restart|status|log}"
    exit 1
    ;;
esac

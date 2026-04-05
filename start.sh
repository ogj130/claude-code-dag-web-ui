#!/bin/bash
# CC Web 启动脚本

PID_FILE=".cc-web.pid"
LOG_FILE=".cc-web.log"

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

start() {
  if is_running; then
    PID=$(cat "$PID_FILE")
    echo "CC Web 已在运行中 (PID: $PID)"
    return 1
  fi

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
  if ! is_running; then
    echo "CC Web 未在运行"
    return 1
  fi

  PID=$(cat "$PID_FILE")
  echo "正在停止 CC Web (PID: $PID)..."
  kill "$PID" 2>/dev/null
  rm -f "$PID_FILE"
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
    stop
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

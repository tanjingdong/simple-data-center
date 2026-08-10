#!/usr/bin/env bash
# tans-PIM 重启脚本:停止现有服务进程,重新后台启动项目根目录的 tans-pim
# 用法:./restart.sh
# 启动方式与现状一致:./tans-pim serve --http=0.0.0.0:8090(相对路径 db/),日志写 server.log

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$ROOT_DIR/tans-pim"
PORT=8090

# 1. 检查二进制存在
if [ ! -x "$BIN" ]; then
  echo "错误:未找到可执行文件 $BIN ,请先运行 dev_tools/build.sh 编译。" >&2
  exit 1
fi

# 2. 停止现有进程(SIGTERM,3 秒未退再 SIGKILL)
# 按进程名(comm)精确匹配,避免 pkill -f 误杀命令行中恰好含
# "tans-pim serve" 字符串的其他进程(如执行环境的 shell)
service_pids() {
  for pid in $(pgrep -f "tans-pim serve" 2>/dev/null || true); do
    if [ "$(ps -o comm= -p "$pid" 2>/dev/null)" = "tans-pim" ]; then
      echo "$pid"
    fi
  done
}

echo "正在停止现有服务..."
PIDS="$(service_pids)"
if [ -n "$PIDS" ]; then
  echo "旧进程 PID:$PIDS"
  for pid in $PIDS; do kill "$pid" 2>/dev/null || true; done
  for _ in 1 2 3; do
    [ -z "$(service_pids)" ] && break
    sleep 1
  done
  if [ -n "$(service_pids)" ]; then
    echo "SIGTERM 未生效,强制终止..."
    for pid in $(service_pids); do kill -9 "$pid" 2>/dev/null || true; done
    sleep 1
  fi
  echo "已停止。"
else
  echo "未发现运行中的服务。"
fi

# 3. 后台启动
cd "$ROOT_DIR"
nohup ./tans-pim serve --http=0.0.0.0:${PORT} > server.log 2>&1 &
NEW_PID=$!
sleep 1

# 4. 确认存活
if kill -0 "$NEW_PID" 2>/dev/null; then
  echo "服务已启动:PID ${NEW_PID},监听 http://0.0.0.0:${PORT}"
  echo "日志:${ROOT_DIR}/server.log"
else
  echo "错误:服务启动失败,请查看日志 ${ROOT_DIR}/server.log。" >&2
  exit 1
fi

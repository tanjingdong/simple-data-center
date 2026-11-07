#!/usr/bin/env bash
# simple-data-center 停止脚本:终止本机所有正在运行的本项目服务进程
# 用法:./stop.sh [--dry-run]
# 匹配规则与 restart.sh 一致:进程名(comm)为 simple-data-cen(Linux 下进程名
# 截断为 15 字符)且命令行含 "simple-data-center serve",避免 pkill -f 误杀
# 命令行中恰好含该字符串的其他进程。
# 先 SIGTERM,3 秒未退再 SIGKILL。

set -euo pipefail

DRY_RUN=0
case "${1:-}" in
  -n | --dry-run) DRY_RUN=1 ;;
  "") ;;
  *)
    echo "用法:$0 [--dry-run]" >&2
    exit 2
    ;;
esac

# 返回本服务所有运行中进程的 PID
service_pids() {
  for pid in $(pgrep -f "simple-data-center serve" 2>/dev/null || true); do
    if [ "$(ps -o comm= -p "$pid" 2>/dev/null)" = "simple-data-cen" ]; then
      echo "$pid"
    fi
  done
}

PIDS="$(service_pids)"
if [ -z "$PIDS" ]; then
  echo "未发现运行中的 simple-data-center 服务进程。"
  exit 0
fi

echo "发现服务进程 PID:$(echo "$PIDS" | tr '\n' ' ')"
if [ "$DRY_RUN" = 1 ]; then
  echo "[dry-run] 将终止上述进程,未执行 kill。"
  exit 0
fi

echo "正在停止..."
for pid in $PIDS; do
  kill "$pid" 2>/dev/null || true
done

for _ in 1 2 3; do
  [ -z "$(service_pids)" ] && break
  sleep 1
done

REMAINING="$(service_pids)"
if [ -n "$REMAINING" ]; then
  echo "SIGTERM 未生效,强制终止 PID:$(echo "$REMAINING" | tr '\n' ' ')"
  for pid in $REMAINING; do
    kill -9 "$pid" 2>/dev/null || true
  done
  sleep 1
fi

if [ -z "$(service_pids)" ]; then
  echo "已停止。"
else
  echo "错误:仍有进程未终止:$(service_pids | tr '\n' ' ')" >&2
  exit 1
fi

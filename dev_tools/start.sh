#!/usr/bin/env bash
# simple-data-center 启动脚本:后台启动项目根目录的 simple-data-center
# 用法:./start.sh
# 若已有本服务进程在运行则拒绝启动,避免端口冲突;需重启请用 restart.sh。
# 启动方式与 restart.sh 一致:./simple-data-center serve --http=0.0.0.0:8090
# (相对路径 db/),日志写 server.log。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$ROOT_DIR/simple-data-center"
PORT=8090

# 1. 检查二进制存在
if [ ! -x "$BIN" ]; then
  echo "错误:未找到可执行文件 $BIN ,请先运行 dev_tools/build.sh 编译。" >&2
  exit 1
fi

# 2. 检查是否已有本服务进程(识别规则与 stop.sh 一致)
service_pids() {
  for pid in $(pgrep -f "simple-data-center serve" 2>/dev/null || true); do
    if [ "$(ps -o comm= -p "$pid" 2>/dev/null)" = "simple-data-cen" ]; then
      echo "$pid"
    fi
  done
}

PIDS="$(service_pids)"
if [ -n "$PIDS" ]; then
  echo "错误:已有本服务进程在运行(PID:$(echo "$PIDS" | tr '\n' ' '))。" >&2
  echo "请先执行 dev_tools/stop.sh,或使用 dev_tools/restart.sh 重启。" >&2
  exit 1
fi

# 3. 后台启动
cd "$ROOT_DIR"
nohup ./simple-data-center serve --http=0.0.0.0:${PORT} > server.log 2>&1 &
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

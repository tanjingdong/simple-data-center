#!/usr/bin/env bash
# simple-data-center 重启脚本:停止现有服务进程,重新后台启动项目根目录的 simple-data-center
# 用法:./restart.sh
# 启动方式与现状一致:./simple-data-center serve --http=0.0.0.0:8090(相对路径 db/),日志写 server.log

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$ROOT_DIR/simple-data-center"

# 1. 检查二进制存在
if [ ! -x "$BIN" ]; then
  echo "错误:未找到可执行文件 $BIN ,请先运行 dev_tools/build.sh 编译。" >&2
  exit 1
fi

# 2. 停止现有进程(复用 stop.sh:SIGTERM,3 秒未退再 SIGKILL)
echo "正在停止现有服务..."
"$ROOT_DIR/dev_tools/stop.sh"

# 3. 启动服务(复用 start.sh)
echo "正在启动服务..."
"$ROOT_DIR/dev_tools/start.sh"

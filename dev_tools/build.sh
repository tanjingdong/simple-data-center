#!/usr/bin/env bash
# simple-data-center 菜单式编译脚本
# 对话式选择操作系统与架构,编译单可执行文件:
#   - 产物保存至 release/simple-data-center-<os>-<arch>-<版本>[.exe](归档)
#   - 成功后自动复制到项目根目录 simple-data-center[.exe](运行使用相对路径 db/)
# 版本号自动读取 package.json,无需输入。

set -euo pipefail

# 项目根目录(脚本所在目录的上一级)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="$ROOT_DIR/release"
BACKEND_DIR="$ROOT_DIR/backend"

# 1. 环境检查:go 工具链
# go 常经 .profile 注入 PATH(非登录 shell 不加载),找不到时探测常见安装位置
if ! command -v go >/dev/null 2>&1; then
  for cand in \
    "/usr/local/go/bin/go" \
    "$HOME/go-sdk/go/bin/go" \
    "$HOME/go/bin/go" \
    "/snap/bin/go"
  do
    if [ -x "$cand" ]; then
      export PATH="$(dirname "$cand"):$PATH"
      break
    fi
  done
fi
if ! command -v go >/dev/null 2>&1; then
  echo "错误:未找到 go 工具链,无法编译。" >&2
  echo "请安装 Go(https://go.dev/dl/)或将 go 所在目录加入 PATH 后重试。" >&2
  exit 1
fi

# 2. 读取版本号(package.json 顶层 version 字段)
VERSION="$(grep '"version"' "$ROOT_DIR/package.json" | head -1 \
  | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
if [ -z "$VERSION" ]; then
  echo "错误:无法从 package.json 读取版本号。" >&2
  exit 1
fi

echo "┌─ simple-data-center 编译工具 ──────────────────┐"
echo "│  当前版本:${VERSION}"
echo "└────────────────────────────────────────────────┘"
echo

# 3. 选择操作系统
echo "请选择操作系统:"
echo "  1) Linux"
echo "  2) Windows"
echo "  3) macOS"
echo "  0) 退出"
read -r -p "输入序号: " os_choice
case "$os_choice" in
  0) echo "已退出。"; exit 0 ;;
  1) GOOS=linux ;;
  2) GOOS=windows ;;
  3) GOOS=darwin ;;
  *) echo "无效输入,已退出。" >&2; exit 1 ;;
esac

# 4. 选择架构(按系统过滤)
echo "请选择架构:"
if [ "$GOOS" = "windows" ]; then
  echo "  1) amd64"
  echo "  2) 386(32 位)"
else
  echo "  1) amd64"
  echo "  2) arm64"
fi
echo "  0) 退出"
read -r -p "输入序号: " arch_choice
case "$arch_choice" in
  0) echo "已退出。"; exit 0 ;;
  1) GOARCH=amd64 ;;
  2)
    if [ "$GOOS" = "windows" ]; then GOARCH=386; else GOARCH=arm64; fi
    ;;
  *) echo "无效输入,已退出。" >&2; exit 1 ;;
esac

# 5. 编译
EXT=""
if [ "$GOOS" = "windows" ]; then EXT=".exe"; fi
OUT_NAME="simple-data-center-${GOOS}-${GOARCH}-${VERSION}${EXT}"
OUT_PATH="$RELEASE_DIR/$OUT_NAME"

mkdir -p "$RELEASE_DIR"
echo
echo "开始编译 ${GOOS}/${GOARCH} 版本 ${VERSION} ..."
echo "输出:$OUT_PATH"
(
  cd "$BACKEND_DIR"
  CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" go build -tags production -o "$OUT_PATH"
)
echo "编译成功。"

# 6. 复制到项目根目录(与现有 simple-data-center 相同位置,运行使用相对路径 db/)
DEST_PATH="$ROOT_DIR/simple-data-center${EXT}"
# 先复制到临时名再原子 mv:服务运行中二进制被占用,直接 cp 覆盖会报"文本文件忙"
TMP_DEST="$ROOT_DIR/.simple-data-center.tmp${EXT}"
cp "$OUT_PATH" "$TMP_DEST"
mv -f "$TMP_DEST" "$DEST_PATH"
echo "已复制到项目根目录:${DEST_PATH}"
echo "完成。"

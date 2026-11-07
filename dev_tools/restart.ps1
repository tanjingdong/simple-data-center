#Requires -Version 5.1
<#
.SYNOPSIS
  simple-data-center 重启脚本(Windows 版,对应 dev_tools/restart.sh)

.DESCRIPTION
  停止现有服务进程,重新后台启动项目根目录的 simple-data-center.exe。
  启动方式与 start.ps1 一致:simple-data-center.exe serve --http=0.0.0.0:8090
  (相对路径 db/),日志写 server.log / server.err.log。

  先检查二进制存在再停止,避免"停掉了服务却起不来"。

.EXAMPLE
  .\restart.ps1
  .\restart.ps1 -Port 18090
#>
[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8090
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
$ExePath = Join-Path $RootDir 'simple-data-center.exe'
$StopScript = Join-Path $PSScriptRoot 'stop.ps1'
$StartScript = Join-Path $PSScriptRoot 'start.ps1'

function Write-Err([string]$Message) {
    [Console]::Error.WriteLine($Message)
}

# 1. 检查二进制存在(先确认起得来,再动现有服务)
if (-not (Test-Path -LiteralPath $ExePath)) {
    Write-Err "错误:未找到可执行文件 $ExePath ,请先运行 dev_tools\build.ps1 编译。"
    exit 1
}

# 2. 停止现有进程(复用 stop.ps1)
Write-Host '正在停止现有服务...'
& $StopScript
if ($LASTEXITCODE -ne 0) {
    Write-Err "错误:停止失败(退出码 $LASTEXITCODE),已中止重启。"
    exit $LASTEXITCODE
}

# 3. 启动服务(复用 start.ps1)
Write-Host '正在启动服务...'
& $StartScript -Port $Port
exit $LASTEXITCODE

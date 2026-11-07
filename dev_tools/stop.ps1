#Requires -Version 5.1
<#
.SYNOPSIS
  simple-data-center 停止脚本(Windows 版,对应 dev_tools/stop.sh)

.DESCRIPTION
  终止本机所有正在运行的本项目服务进程。

  进程识别规则(与 start.ps1 一致):
    1. 优先读取项目根目录 .simple-data-center.pid 中的 PID;
    2. 兜底扫描进程名为 simple-data-center 的进程(识别 PID 文件丢失的残留进程)。
  相比 stop.sh 的 "pgrep -f + 进程名截断 15 字符" 双重校验,Windows 下进程名不做
  截断且命令行匹配不可靠,因此改用 PID 文件为主、进程名为辅。

  与 stop.sh 的重要差异:
    Windows 没有 SIGTERM,不存在 "先温和退出、3 秒不退再强杀" 的两段式流程,
    Stop-Process 等同于 TerminateProcess(强制终止)。PocketBase 的 SQLite 使用
    WAL 日志,强制终止后下次启动会自动回滚未提交事务,一般不会损坏数据;仍建议
    在写入密集时避免终止服务。

.PARAMETER DryRun
  仅列出将被终止的进程 PID,不执行终止。对应 stop.sh 的 --dry-run。

.EXAMPLE
  .\stop.ps1
  .\stop.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [Alias('n')]
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
$PidFile = Join-Path $RootDir '.simple-data-center.pid'

function Write-Err([string]$Message) {
    [Console]::Error.WriteLine($Message)
}

# 返回本项目所有运行中服务进程:
#   1) PID 文件里的进程(精确记录);
#   2) 兜底:可执行文件位于本项目目录下的 simple-data-center*.exe
#      (含 release/ 里按版本命名的产物)。
# 只认本项目目录,不会误伤其他目录下同名程序。
function Get-ServiceProcesses {
    $result = New-Object System.Collections.ArrayList
    $seen = @{}

    if (Test-Path -LiteralPath $PidFile) {
        $raw = (Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
        $procId = 0
        if ([int]::TryParse([string]$raw, [ref]$procId)) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc) { [void]$result.Add($proc); $seen[$procId] = $true }
        }
    }

    $cims = @(Get-CimInstance Win32_Process -Filter "Name LIKE 'simple-data-center%'" -ErrorAction SilentlyContinue)
    foreach ($cim in $cims) {
        $cimId = [int]$cim.ProcessId
        if ($seen.ContainsKey($cimId)) { continue }
        $exePath = [string]$cim.ExecutablePath
        if ([string]::IsNullOrEmpty($exePath)) { continue }
        if (-not $exePath.StartsWith($RootDir, [StringComparison]::OrdinalIgnoreCase)) { continue }
        $proc = Get-Process -Id $cimId -ErrorAction SilentlyContinue
        if ($proc) { [void]$result.Add($proc); $seen[$cimId] = $true }
    }

    return @($result)
}

$targets = @(Get-ServiceProcesses)
if ($targets.Count -eq 0) {
    Write-Host '未发现运行中的 simple-data-center 服务进程。'
    Remove-Item -LiteralPath $PidFile -ErrorAction SilentlyContinue
    exit 0
}

Write-Host ("发现服务进程 PID:" + (($targets | ForEach-Object { $_.Id }) -join ' '))

if ($DryRun) {
    Write-Host '[dry-run] 将终止上述进程,未执行终止。'
    exit 0
}

Write-Host '正在停止...'
foreach ($target in $targets) {
    Stop-Process -Id $target.Id -Force -ErrorAction SilentlyContinue
}

# 最多等待 3 秒确认退出
for ($i = 0; $i -lt 30; $i++) {
    if (@(Get-ServiceProcesses).Count -eq 0) { break }
    Start-Sleep -Milliseconds 100
}

$remaining = @(Get-ServiceProcesses)
if ($remaining.Count -gt 0) {
    Write-Err ("错误:仍有进程未终止:" + (($remaining | ForEach-Object { $_.Id }) -join ' '))
    Write-Err '请以管理员身份重试,或用任务管理器手动结束。'
    exit 1
}

Remove-Item -LiteralPath $PidFile -ErrorAction SilentlyContinue
Write-Host '已停止。'
exit 0

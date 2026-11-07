#Requires -Version 5.1
<#
.SYNOPSIS
  simple-data-center 启动脚本(Windows 版,对应 dev_tools/start.sh)

.DESCRIPTION
  后台启动项目根目录的 simple-data-center.exe:
    ./simple-data-center.exe serve --http=0.0.0.0:<端口>(相对路径 db/)
  若已有本服务进程在运行则拒绝启动,避免端口冲突;需重启请用 restart.ps1。

  PID 写入项目根目录 .simple-data-center.pid,供 stop.ps1 精确终止。

  日志:
    - stdout -> server.log(启动横幅、请求日志)
    - stderr -> server.err.log(警告与错误,例如 PIM_ENC_KEY 未设置)
  PowerShell 的 Start-Process 要求两个流分别重定向,因此与 start.sh 的
    "合并写入 server.log" 略有差异;两个文件都在项目根目录。

.PARAMETER Port
  监听端口,默认 8090。仅本机临时换端口调试时使用;生产口径仍是 8090。

.EXAMPLE
  .\start.ps1
  .\start.ps1 -Port 18090
#>
[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8090
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
$ExeName = 'simple-data-center.exe'
$ExePath = Join-Path $RootDir $ExeName
$LogFile = Join-Path $RootDir 'server.log'
$ErrLogFile = Join-Path $RootDir 'server.err.log'
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

# 端口是否由指定进程在监听(只看"端口有人听"会把别的程序误判成自己启动成功)
function Test-PortOwnedByProcess([int]$PortNumber, [int]$ProcessId) {
    $conns = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        if ([int]$conn.OwningProcess -eq $ProcessId) { return $true }
    }
    return $false
}

# 端口被谁占用(失败时给出可操作的线索)
function Get-PortOccupant([int]$PortNumber) {
    $conn = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $conn) { return $null }
    $cim = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction SilentlyContinue
    return [pscustomobject]@{
        Id             = $conn.OwningProcess
        Name           = if ($cim) { [string]$cim.Name } else { '' }
        ExecutablePath = if ($cim) { [string]$cim.ExecutablePath } else { '' }
        CommandLine    = if ($cim) { [string]$cim.CommandLine } else { '' }
    }
}

function Show-LogTail {
    if (Test-Path -LiteralPath $LogFile) {
        Write-Err '--- server.log(尾部) ---'
        Get-Content -LiteralPath $LogFile -Tail 20 -ErrorAction SilentlyContinue |
            ForEach-Object { Write-Err $_ }
    }
    if ((Test-Path -LiteralPath $ErrLogFile) -and (Get-Item -LiteralPath $ErrLogFile).Length -gt 0) {
        Write-Err '--- server.err.log(尾部) ---'
        Get-Content -LiteralPath $ErrLogFile -Tail 20 -ErrorAction SilentlyContinue |
            ForEach-Object { Write-Err $_ }
    }
}

function Show-PortOccupant([int]$PortNumber) {
    $occupant = Get-PortOccupant $PortNumber
    if (-not $occupant) { return }
    Write-Err "端口 $PortNumber 当前被 PID $($occupant.Id)($($occupant.Name))占用:"
    if ($occupant.ExecutablePath) { Write-Err "  可执行文件:$($occupant.ExecutablePath)" }
    if ($occupant.CommandLine) {
        $line = $occupant.CommandLine
        if ($line.Length -gt 160) { $line = $line.Substring(0, 160) + ' ...' }
        Write-Err "  命令行:$line"
    }
    if ($occupant.ExecutablePath -and -not $occupant.ExecutablePath.StartsWith($RootDir, [StringComparison]::OrdinalIgnoreCase)) {
        Write-Err '  注意:该进程不在本项目目录下,不是本脚本启动的,请自行确认后处理(或用 -Port 换端口)。'
    }
}

# 1. 检查二进制存在
if (-not (Test-Path -LiteralPath $ExePath)) {
    Write-Err "错误:未找到可执行文件 $ExePath ,请先运行 dev_tools\build.ps1 编译。"
    exit 1
}

# 2. 检查是否已有本服务进程在运行
$existing = @(Get-ServiceProcesses)
if ($existing.Count -gt 0) {
    Write-Err ("错误:已有本服务进程在运行(PID:" + (($existing | ForEach-Object { $_.Id }) -join ' ') + ")。")
    Write-Err '请先执行 dev_tools\stop.ps1,或使用 dev_tools\restart.ps1 重启。'
    exit 1
}

# 3. 后台启动(Windows 无 nohup,用 Start-Process 脱离当前终端)
try {
    $proc = Start-Process -FilePath $ExePath `
        -ArgumentList @('serve', "--http=0.0.0.0:$Port") `
        -WorkingDirectory $RootDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $LogFile `
        -RedirectStandardError $ErrLogFile `
        -PassThru `
        -ErrorAction Stop
}
catch {
    Write-Err "错误:启动失败:$($_.Exception.Message)"
    exit 1
}

$proc.Id | Set-Content -LiteralPath $PidFile -Encoding ASCII

# 4. 确认存活并等到端口监听(最多 10 秒)
$listening = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if (-not (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)) { break }
    if (Test-PortOwnedByProcess $Port $proc.Id) { $listening = $true; break }
}

if (-not (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)) {
    Write-Err "错误:服务进程已退出,请查看日志 $LogFile 。"
    Show-LogTail
    Show-PortOccupant $Port
    Remove-Item -LiteralPath $PidFile -ErrorAction SilentlyContinue
    exit 1
}

if (-not $listening) {
    $occupant = Get-PortOccupant $Port
    if ($occupant -and $occupant.Id -ne $proc.Id) {
        Write-Err "错误:端口 $Port 被其他进程占用,本服务无法监听,已终止本次启动的进程。"
    }
    else {
        Write-Err "错误:进程在运行但端口 $Port 未监听,已终止该进程。"
    }
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $PidFile -ErrorAction SilentlyContinue
    Show-LogTail
    Show-PortOccupant $Port
    exit 1
}

Write-Host "服务已启动:PID $($proc.Id),监听 http://0.0.0.0:$Port"
Write-Host "日志:${LogFile}(错误另见 ${ErrLogFile})"
exit 0

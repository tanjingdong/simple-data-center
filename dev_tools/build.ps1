#Requires -Version 5.1
<#
.SYNOPSIS
  simple-data-center 菜单式编译脚本(Windows 版,对应 dev_tools/build.sh)

.DESCRIPTION
  对话式选择操作系统与架构,全量编译单可执行文件:
    - 每次运行均先构建前端(npm run build:client,含 lint;vite 产物输出至
      backend/dist,经 Go embed 打包进二进制),避免嵌入陈旧前端导致新页面 404;
    - 产物保存至 release/simple-data-center-<os>-<arch>-<版本>[.exe](归档);
    - 成功后自动复制到项目根目录 simple-data-center[.exe](运行使用相对路径 db/)。

  版本号自动读取 package.json,无需输入。

  与 build.sh 的差异:
    - Windows 不允许覆盖正在运行的可执行文件,因此服务运行时会拒绝复制;
    - 额外支持 -OS / -Arch 参数,可跳过交互菜单(便于脚本化调用与自测)。

.PARAMETER OS
  目标操作系统:linux / windows / darwin。省略则进入交互菜单。

.PARAMETER Arch
  目标架构:windows 下为 amd64 / 386,其他为 amd64 / arm64。省略则进入交互菜单。

.EXAMPLE
  .\build.ps1
  .\build.ps1 -OS windows -Arch amd64
#>
[CmdletBinding()]
param(
    [ValidateSet('linux', 'windows', 'darwin')]
    [string]$OS,

    [string]$Arch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RootDir 'backend'
$ReleaseDir = Join-Path $RootDir 'release'
$PidFile = Join-Path $RootDir '.simple-data-center.pid'

function Write-Err([string]$Message) {
    [Console]::Error.WriteLine($Message)
}

# 找到命令:优先 PATH,其次依次尝试给定候选路径
function Resolve-ToolPath([string]$Name, [string[]]$Candidates) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($candidate in $Candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }
    return $null
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

# 1. 环境检查:node / npm
$npmPath = Resolve-ToolPath 'npm.cmd' @()
if (-not $npmPath) { $npmPath = Resolve-ToolPath 'npm' @() }
if (-not $npmPath) {
    Write-Err '错误:未找到 npm,无法构建前端。'
    Write-Err '请安装 Node.js(https://nodejs.org/)后重试。'
    exit 1
}

# 2. 环境检查:go 工具链(找不到时探测常见安装位置)
$goPath = Resolve-ToolPath 'go' @(
    'C:\Program Files\Go\bin\go.exe',
    (Join-Path $env:USERPROFILE 'go\bin\go.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Go\bin\go.exe')
)
if (-not $goPath) {
    Write-Err '错误:未找到 go 工具链,无法编译。'
    Write-Err '请安装 Go(https://go.dev/dl/)或将 go 所在目录加入 PATH 后重试。'
    exit 1
}

# 2.1 版本门控:go1.26+ 默认启用 jsonv2 实验,与 PocketBase v0.39.4 的集合 JSON
# 解码不兼容(管理后台导入/编辑集合时服务端无限递归崩溃,详见 CHANGELOG 1.3.3)。
# 仅当编译器版本 ≥1.26 时设置 GOEXPERIMENT=none 恢复经典 json v1 语义;
# 旧编译器不设置,行为与既有一致。
$needGoExperiment = $false
$goVerText = (& $goPath version) -join ' '
if ($goVerText -match 'go(\d+)\.(\d+)') {
    $goMajor = [int]$Matches[1]
    $goMinor = [int]$Matches[2]
    if ($goMajor -gt 1 -or ($goMajor -eq 1 -and $goMinor -ge 26)) {
        $needGoExperiment = $true
        Write-Host "检测到 go$goMajor.$goMinor,将自动设置 GOEXPERIMENT=none(规避 jsonv2 × PocketBase 集合解析崩溃)。"
    }
}

# 3. 读取版本号(package.json 顶层 version 字段)
$version = $null
$packageJsonPath = Join-Path $RootDir 'package.json'
if (Test-Path -LiteralPath $packageJsonPath) {
    $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
    $version = $packageJson.version
}
if (-not $version) {
    Write-Err '错误:无法从 package.json 读取版本号。'
    exit 1
}

Write-Host '┌─ simple-data-center 编译工具 ──────────────────┐'
Write-Host "│  当前版本:$version"
Write-Host '└────────────────────────────────────────────────┘'
Write-Host ''

# 4. 选择操作系统(未传参则交互)
$goos = $OS
if (-not $goos) {
    Write-Host '请选择操作系统:'
    Write-Host '  1) Linux'
    Write-Host '  2) Windows'
    Write-Host '  3) macOS'
    Write-Host '  0) 退出'
    $osChoice = Read-Host '输入序号'
    switch ($osChoice) {
        '0' { Write-Host '已退出。'; exit 0 }
        '1' { $goos = 'linux' }
        '2' { $goos = 'windows' }
        '3' { $goos = 'darwin' }
        default { Write-Err '无效输入,已退出。'; exit 1 }
    }
}

# 5. 选择架构(按系统过滤,未传参则交互)
$validArches = if ($goos -eq 'windows') { @('amd64', '386') } else { @('amd64', 'arm64') }

$goarch = $Arch
if ($goarch) {
    if ($validArches -notcontains $goarch) {
        Write-Err ("错误:$goos 支持的架构为 " + ($validArches -join ' / ') + ",不支持 $goarch。")
        exit 1
    }
}
else {
    Write-Host '请选择架构:'
    if ($goos -eq 'windows') {
        Write-Host '  1) amd64'
        Write-Host '  2) 386(32 位)'
    }
    else {
        Write-Host '  1) amd64'
        Write-Host '  2) arm64'
    }
    Write-Host '  0) 退出'
    $archChoice = Read-Host '输入序号'
    switch ($archChoice) {
        '0' { Write-Host '已退出。'; exit 0 }
        '1' { $goarch = 'amd64' }
        '2' { $goarch = if ($goos -eq 'windows') { '386' } else { 'arm64' } }
        default { Write-Err '无效输入,已退出。'; exit 1 }
    }
}

# 6. 构建前端产物(全量编译:每次运行都重建,产物输出至 backend/dist 供 Go embed)
Write-Host ''
Write-Host '构建前端产物(npm run build:client,含 lint)...'
Push-Location $RootDir
try {
    & $npmPath run build:client
    $npmExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}
if ($npmExitCode -ne 0) {
    Write-Err '错误:前端构建失败,已中止。'
    exit 1
}
Write-Host '前端构建完成。'

# 7. 编译后端
$ext = if ($goos -eq 'windows') { '.exe' } else { '' }
$outName = "simple-data-center-$goos-$goarch-$version$ext"
$outPath = Join-Path $ReleaseDir $outName

if (-not (Test-Path -LiteralPath $ReleaseDir)) {
    [void](New-Item -ItemType Directory -Path $ReleaseDir -Force)
}

Write-Host ''
Write-Host "开始编译 $goos/$goarch 版本 $version ..."
Write-Host "输出:$outPath"

$env:CGO_ENABLED = '0'
$env:GOOS = $goos
$env:GOARCH = $goarch
if ($needGoExperiment) { $env:GOEXPERIMENT = 'none' }
Push-Location $BackendDir
try {
    & $goPath build -tags production -o $outPath .
    $goExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
    Remove-Item Env:GOOS -ErrorAction SilentlyContinue
    Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
    Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue
    Remove-Item Env:GOEXPERIMENT -ErrorAction SilentlyContinue
}
if ($goExitCode -ne 0 -or -not (Test-Path -LiteralPath $outPath)) {
    Write-Err '错误:后端编译失败。'
    exit 1
}
Write-Host '编译成功。'

# 8. 复制到项目根目录(与现有 simple-data-center 相同位置,运行使用相对路径 db/)
$destPath = Join-Path $RootDir "simple-data-center$ext"

$running = @(Get-ServiceProcesses)
if ($running.Count -gt 0) {
    Write-Host ''
    Write-Err ("错误:服务正在运行(PID:" + (($running | ForEach-Object { $_.Id }) -join ' ') + "),Windows 无法覆盖运行中的可执行文件。")
    Write-Err '请先执行 dev_tools\stop.ps1,再重新编译;或直接使用 dev_tools\restart.ps1。'
    Write-Err "归档产物已保留:$outPath"
    exit 1
}

try {
    Copy-Item -LiteralPath $outPath -Destination $destPath -Force -ErrorAction Stop
}
catch {
    Write-Err "错误:复制到项目根目录失败:$($_.Exception.Message)"
    Write-Err "请确认没有进程占用 $destPath 后重试。"
    exit 1
}

$sizeMb = [math]::Round((Get-Item -LiteralPath $destPath).Length / 1MB, 1)
Write-Host "已复制到项目根目录:$destPath($sizeMb MB)"
Write-Host '完成。'
exit 0

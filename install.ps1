<#
.SYNOPSIS
    Pi 中文思考保持方案 — 一键安装脚本
.DESCRIPTION
    安装 Chinese Thinking Guardian for Pi:
    - 部署增强版 AGENTS.md
    - 部署核心扩展 (chinese-thinking-hook.ts，含 L1 + L2 双层防御)
.NOTES
    作者: pi-thinking-zh-hook
    运行环境: Windows PowerShell 5.1+
#>

$ErrorActionPreference = "Stop"

$PI_AGENT_DIR = "$HOME\.pi\agent"
$PI_EXTENSIONS_DIR = "$PI_AGENT_DIR\extensions"
$SOURCE_DIR = $PSScriptRoot

function Write-Step {
    param([string]$Message, [string]$Status = "⏳")
    Write-Host "`n$Status $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "  ⚠️  $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "  ℹ️  $Message" -ForegroundColor Gray
}

# ============================================================
# 开始安装
# ============================================================
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    Pi 中文思考保持方案 — 一键安装          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan

# 检查源目录
if (-not (Test-Path "$SOURCE_DIR\AGENTS.md")) {
    Write-Host "❌ 错误: 找不到 AGENTS.md，请从 pi-thinking-zh-hook 目录运行此脚本" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "$SOURCE_DIR\extensions\chinese-thinking-hook.ts")) {
    Write-Host "❌ 错误: 找不到 chinese-thinking-hook.ts，请从 pi-thinking-zh-hook 目录运行此脚本" -ForegroundColor Red
    exit 1
}

# 确保扩展目录存在
if (-not (Test-Path $PI_EXTENSIONS_DIR)) {
    New-Item -ItemType Directory -Path $PI_EXTENSIONS_DIR -Force | Out-Null
    Write-Info "创建扩展目录: $PI_EXTENSIONS_DIR"
}

# ============================================================
# 步骤 1: 部署 AGENTS.md
# ============================================================
Write-Step "步骤 1/2: 部署 AGENTS.md"

$agentsDest = "$PI_AGENT_DIR\AGENTS.md"
$agentsBackup = "$PI_AGENT_DIR\AGENTS.md.bak.$(Get-Date -Format 'yyyyMMddHHmmss')"

if (Test-Path $agentsDest) {
    Copy-Item -Path $agentsDest -Destination $agentsBackup -Force
    Write-Info "已备份原 AGENTS.md → $agentsBackup"
}

Copy-Item -Path "$SOURCE_DIR\AGENTS.md" -Destination $agentsDest -Force
Write-Success "AGENTS.md 已部署到 $agentsDest"

# ============================================================
# 步骤 2: 部署核心扩展（L1 + L2 双层防御）
# ============================================================
Write-Step "步骤 2/2: 部署核心扩展（L1 system prompt 注入 + L2 context 消息注入）"

$extDest = "$PI_EXTENSIONS_DIR\chinese-thinking-hook.ts"
Copy-Item -Path "$SOURCE_DIR\extensions\chinese-thinking-hook.ts" -Destination $extDest -Force
Write-Success "核心扩展已部署到 $extDest"

# 清理旧的 L3 扩展（如果存在）
$oldL3Dest = "$PI_EXTENSIONS_DIR\chinese-thinking-hook-deep.ts"
if (Test-Path $oldL3Dest) {
    Remove-Item -Path $oldL3Dest -Force
    Write-Warning "已移除旧的 L3 独立扩展（功能已合并到核心扩展中）"
}

# ============================================================
# 完成
# ============================================================
Write-Host "`n╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║          安装完成！                         ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📋 已安装组件:" -ForegroundColor Cyan
Write-Host "  ├─ AGENTS.md (L1 基础层)" -ForegroundColor White
Write-Host "  └─ chinese-thinking-hook.ts (核心扩展，含 L1 system prompt + L2 context 双层防御)" -ForegroundColor White

Write-Host "`n📌 下一步:" -ForegroundColor Yellow
Write-Host "  1. 重启 Pi (或执行 /reload)" -ForegroundColor White
Write-Host "  2. 开始使用 — 中文思考会自动生效" -ForegroundColor White

Write-Host "`n📌 使用:" -ForegroundColor Yellow
Write-Host '  扩展默认关闭，需要时输入 /zhthinking 开启' -ForegroundColor White
Write-Host '  /zhthinking on     — 开启' -ForegroundColor White
Write-Host '  /zhthinking off    — 关闭' -ForegroundColor White
Write-Host '  /zhthinking status — 查看状态' -ForegroundColor White

Write-Host "`n📌 验证:" -ForegroundColor Yellow
Write-Host '  先输入 /zhthinking on 开启，再输入 "Hello, what are you working on?"' -ForegroundColor White
Write-Host "  观察 thinking 标签中是否用中文思考" -ForegroundColor White

Write-Host "`n✨ 安装完成!`n" -ForegroundColor Green

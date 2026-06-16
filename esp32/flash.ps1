# Quick PowerShell wrapper around esptool / flash.py
# Usage:  .\flash.ps1                        # latest release, prompt for port
#         .\flash.ps1 -Port COM5             # skip prompt
#         .\flash.ps1 -Tag v1.0.0 -Monitor   # specific tag + open serial after

param(
  [string]$Port,
  [string]$Tag,
  [string]$File,
  [switch]$Erase,
  [switch]$Monitor
)

$ErrorActionPreference = "Stop"

# Ensure esptool is available
python -m esptool version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Installing esptool + requests..." -ForegroundColor Yellow
  python -m pip install --quiet esptool requests pyserial
}

$args = @()
if ($Port)    { $args += "--port"; $args += $Port }
if ($Tag)     { $args += "--tag";  $args += $Tag  }
if ($File)    { $args += "--file"; $args += $File }
if ($Erase)   { $args += "--erase" }
if ($Monitor) { $args += "--monitor" }

python "$PSScriptRoot\flash.py" @args

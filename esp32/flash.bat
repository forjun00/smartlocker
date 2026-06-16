@echo off
REM Flash SmartLocker firmware to ESP32 on COM14
REM Usage:
REM   flash.bat                 -> latest release
REM   flash.bat v1.0.0          -> specific tag
REM   flash.bat --file fw.bin   -> local .bin

setlocal
cd /d "%~dp0"

set PORT=COM14

if "%~1"=="" (
  python flash.py --port %PORT%
) else if "%~1"=="--file" (
  python flash.py --port %PORT% --file "%~2"
) else (
  python flash.py --port %PORT% --tag %1
)

pause

@echo off
REM ============================================================
REM  SmartLocker - start everything (MQTT broker + Flask backend)
REM  Double-click this file to run the whole project.
REM ============================================================
cd /d "%~dp0"

set MOSQUITTO="C:\Program Files\mosquitto\mosquitto.exe"

echo.
echo  Starting SmartLocker...
echo  -----------------------------------------

REM --- 1. MQTT broker (own window) ---
if exist %MOSQUITTO% (
  echo  [1/2] MQTT broker on port 1883
  start "SmartLocker MQTT" %MOSQUITTO% -c "%~dp0mqtt\mosquitto.conf" -v
) else (
  echo  [!] Mosquitto not found at %MOSQUITTO%
  echo      Skipping broker. Lock/unlock relay commands will not reach the ESP32.
)

REM --- 2. Flask backend (own window) ---
echo  [2/2] Flask backend on port 3001
start "SmartLocker Backend" cmd /k "cd /d %~dp0backend && python app.py"

REM --- open the web app in the default browser ---
timeout /t 4 /nobreak >nul
start "" http://127.0.0.1:3001

echo.
echo  -----------------------------------------
echo   Web app : http://127.0.0.1:3001
echo   LAN     : http://172.16.110.115:3001
echo   Admin   : admin1234
echo  -----------------------------------------
echo   Two windows opened (MQTT + Backend).
echo   Close them (or run stop.bat) to shut down.
echo.
pause

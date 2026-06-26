@echo off
REM Stop SmartLocker services started by start.bat
echo Stopping SmartLocker...

REM Kill the broker
taskkill /IM mosquitto.exe /F >nul 2>&1 && echo  - MQTT broker stopped

REM Kill the backend window (and its python child) by window title
taskkill /FI "WINDOWTITLE eq SmartLocker Backend*" /T /F >nul 2>&1 && echo  - Backend stopped

echo Done.
timeout /t 2 /nobreak >nul

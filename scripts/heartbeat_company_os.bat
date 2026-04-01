@echo off
REM Company OS - Agent Heartbeat Script
REM Auto-invoke all Company OS agents every 5 minutes

REM Agent IDs (from Paperclip API)
set CEO_ID=0d70bbe7-b566-4bd5-9b3b-58aae3d13d86
set CTO_ID=2fd9f72b-f120-4833-89b5-ad1152543941
set BACKEND_ID=6ee471dd-09fa-4270-9f17-a0314723f586
set FRONTEND_ID=afd58c7a-f2b6-490b-9191-dae78f1ea6b6

set API_BASE=http://127.0.0.1:3100

echo [%date% %time%] Company OS Heartbeat Starting...
echo.

REM CEO Agent - Top of hierarchy
echo [%date% %time%] Invoking CEO Agent (%CEO_ID%)...
curl -s -X POST "%API_BASE%/api/agents/%CEO_ID%/heartbeat/invoke" > nul 2>&1
echo [%date% %time%] CEO heartbeat sent

REM CTO Manager - Reports to CEO
echo [%date% %time%] Invoking CTO Manager (%CTO_ID%)...
curl -s -X POST "%API_BASE%/api/agents/%CTO_ID%/heartbeat/invoke" > nul 2>&1
echo [%date% %time%] CTO heartbeat sent

REM Backend Developer - Reports to CTO
echo [%date% %time%] Invoking Backend Developer (%BACKEND_ID%)...
curl -s -X POST "%API_BASE%/api/agents/%BACKEND_ID%/heartbeat/invoke" > nul 2>&1
echo [%date% %time%] Backend heartbeat sent

REM Frontend Developer - Reports to CTO
echo [%date% %time%] Invoking Frontend Developer (%FRONTEND_ID%)...
curl -s -X POST "%API_BASE%/api/agents/%FRONTEND_ID%/heartbeat/invoke" > nul 2>&1
echo [%date% %time%] Frontend heartbeat sent

echo.
echo [%date% %time%] Company OS Heartbeat Complete
echo =============================================
echo.

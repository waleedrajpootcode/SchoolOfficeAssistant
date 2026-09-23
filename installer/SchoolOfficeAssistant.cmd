@echo off
setlocal

set "APP_ROOT=%~dp0app"
set "NODE=%~dp0node\node.exe"
set "SERVER=%APP_ROOT%\server\index.js"

set "PORT=3001"
set "HOST=0.0.0.0"
set "DB_PATH=%ProgramData%\SchoolOfficeAssistant\data\school.sqlite"

if not exist "%ProgramData%\SchoolOfficeAssistant\data" (
    mkdir "%ProgramData%\SchoolOfficeAssistant\data"
)

start "" "%NODE%" "%SERVER%"

timeout /t 3 /nobreak >nul

start "" "http://localhost:3001/"

exit /b 0

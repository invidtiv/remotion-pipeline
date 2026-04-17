@echo off
cd /d "%~dp0"
start "" http://localhost:4317
call npm run runner

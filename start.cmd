@echo off
setlocal
cd /d "%~dp0"
set "INTERVIEW_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%INTERVIEW_NODE%" (
  "%INTERVIEW_NODE%" server.mjs
) else (
  node server.mjs
)
pause

@echo off
cd /d "%~dp0"
set PORT=4173
echo HUM Roofing Intelligence Round 2
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do set IP=%%a
echo Computer preview: http://localhost:%PORT%
echo Phone preview:    http://%IP: =%:%PORT%
echo Keep this window open. Your phone and computer must be on the same Wi-Fi.
echo.
start "" http://localhost:%PORT%
where node >nul 2>nul
if %errorlevel%==0 (
  node server.mjs
) else (
  py -m http.server %PORT% --bind 0.0.0.0
)
pause

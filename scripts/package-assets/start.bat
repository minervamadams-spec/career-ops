@echo off
setlocal EnableDelayedExpansion
REM start.bat -- one-command launch for Offerly on Windows. Double-click it,
REM or run it from a terminal opened in this folder. Mirrors start.sh (Mac/Linux):
REM checks Node, installs it automatically if possible, npm install, build, start,
REM opens the browser once the server answers.

cd /d "%~dp0\web"

echo Offerly -- starting up
echo.

REM ---- 1. Make sure Node.js 20+ is on PATH -----------------------------------
set "NODE_OK=0"
call :check_node
if "%NODE_OK%"=="1" goto node_ready

echo Node.js isn't installed yet, or it's an older version this needs Node 20+.
echo Trying to install it automatically via winget (built into Windows 10/11)...
echo.

where winget >nul 2>&1
if errorlevel 1 goto no_winget

winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo.
  echo Automatic install didn't finish cleanly. See the manual step below.
  goto manual_node
)

REM winget just installed Node to a fixed path -- add it to THIS window's PATH
REM so the rest of this script can use it without reopening the terminal.
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
call :check_node
if "%NODE_OK%"=="1" goto node_ready

echo.
echo Node.js was installed, but this window can't see it yet.
echo Close this window, open a new one, and run start.bat again -- it'll pick up from here.
pause
exit /b 0

:no_winget
echo winget isn't available on this computer (needs Windows 10 1709+ or Windows 11).
:manual_node
echo.
echo Please install Node.js yourself: https://nodejs.org (click the "LTS" button),
echo run the installer, then come back and run start.bat again.
pause
exit /b 1

:node_ready
echo Using Node.js:
node -v
echo.

REM ---- 2. Install dependencies (first run only) ------------------------------
if not exist node_modules (
  echo First-time setup -- installing what this needs ^(a minute or two^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Copy the error above to whoever sent you this.
    pause
    exit /b 1
  )
)

REM ---- 3. Build ----------------------------------------------------------------
echo Building...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Copy the error above to whoever sent you this.
  pause
  exit /b 1
)

echo.
echo Starting Offerly at http://localhost:3000
echo (Leave this window open -- closing it stops the app. Ctrl+C to quit.)
echo.

REM ---- 4. Open the browser once the server actually answers, not before -----
start "" cmd /c "for /l %%i in (1,1,60) do (curl -sS -o nul http://localhost:3000 >nul 2>&1 && start "" http://localhost:3000 && exit /b 0 & timeout /t 1 >nul)"

call npm run start
goto :eof

REM ---- helper: sets NODE_OK=1 if node is on PATH and is major version >=20 --
:check_node
set "NODE_OK=0"
where node >nul 2>&1
if errorlevel 1 exit /b 0
for /f "tokens=1 delims=v." %%v in ('node -v') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR exit /b 0
if %NODE_MAJOR% GEQ 20 set "NODE_OK=1"
exit /b 0

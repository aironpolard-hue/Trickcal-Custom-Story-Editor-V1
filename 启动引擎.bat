@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" goto install
if not exist "node_modules\monaco-editor\min\vs\loader.js" goto install
goto launch

:install
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo Node.js and npm are required for the first setup.
  echo Install Node.js 22.12.0 or later, then run this file again.
  goto failed
)
echo Installing source dependencies. No application build is needed.
echo The first setup needs an Internet connection and may take a few minutes.
call npm.cmd install --no-audit --no-fund
if errorlevel 1 goto failed
if not exist "node_modules\electron\dist\electron.exe" (
  echo Downloading the Electron runtime...
  node "node_modules\electron\install.js"
  if errorlevel 1 goto failed
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron is still missing. Check your network and npm configuration.
  goto failed
)
if not exist "node_modules\monaco-editor\min\vs\loader.js" (
  echo Monaco Editor is still missing. Run: npm install
  goto failed
)

:launch
set "ELECTRON_RUN_AS_NODE="
echo Starting Trickcal Story Engine from source...
start "" /wait "%~dp0node_modules\electron\dist\electron.exe" "%CD%"
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo Startup failed. See the error above.
pause
exit /b 1

@echo off
title BizSuite — Setup
color 0B
echo.
echo  ██████╗ ██╗███████╗███████╗██╗   ██╗██╗████████╗███████╗
echo  ██╔══██╗██║╚══███╔╝╚══███╔╝██║   ██║██║╚══██╔══╝██╔════╝
echo  ██████╔╝██║  ███╔╝   ███╔╝ ██║   ██║██║   ██║   █████╗
echo  ██╔══██╗██║ ███╔╝   ███╔╝  ██║   ██║██║   ██║   ██╔══╝
echo  ██████╔╝██║███████╗███████╗╚██████╔╝██║   ██║   ███████╗
echo  ╚═════╝ ╚═╝╚══════╝╚══════╝ ╚═════╝ ╚═╝   ╚═╝   ╚══════╝
echo.
echo  Invoice ^& Tender Manager — Desktop Setup
echo  ==========================================
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is NOT installed!
    echo.
    echo  Please install Node.js from: https://nodejs.org
    echo  Download the LTS version, install it, then run this script again.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)

echo  [OK] Node.js found:
node --version
echo.

:: Install dependencies
echo  [1/3] Installing dependencies (this may take 2-3 minutes)...
call npm install
if %errorlevel% neq 0 (
    echo  [ERROR] npm install failed. Check your internet connection.
    pause
    exit /b 1
)
echo  [OK] Dependencies installed!
echo.

:: Ask user what to do
echo  What would you like to do?
echo.
echo  [1] Run BizSuite NOW (test without installing)
echo  [2] Build .exe installer (takes 5-10 min)
echo  [3] Both — run first, then build
echo.
set /p choice="Enter 1, 2, or 3: "

if "%choice%"=="1" goto run
if "%choice%"=="2" goto build
if "%choice%"=="3" goto run_then_build
goto run

:run
echo.
echo  [2/3] Starting BizSuite...
echo  Close the app window when you're done testing.
call npm start
goto end

:build
echo.
echo  [2/3] Building .exe installer...
call npm run build-win
if %errorlevel% neq 0 (
    echo  [ERROR] Build failed. See error above.
    pause
    exit /b 1
)
echo.
echo  [3/3] SUCCESS! Installer created:
echo.
echo  dist\BizSuite Setup 2.0.0.exe
echo.
echo  Double-click that file to install BizSuite on your PC!
explorer dist
goto end

:run_then_build
call npm start
echo.
echo  Now building .exe installer...
call npm run build-win
echo.
echo  Done! Installer is in the 'dist' folder.
explorer dist

:end
echo.
echo  Setup complete! 
pause

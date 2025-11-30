@echo off
REM Demo script for Windows to launch server and two clients

echo Starting Multiplayer Game Demo...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed. Please install Node.js first.
    exit /b 1
)

REM Install server dependencies if needed
if not exist "server\node_modules" (
    echo Installing server dependencies...
    cd server
    call npm install
    cd ..
)

REM Install client dependencies if needed
if not exist "client\node_modules" (
    echo Installing client dependencies...
    cd client
    call npm install
    cd ..
)

REM Start server in background
echo Starting game server...
start "Game Server" cmd /c "cd server && node index.js"

REM Wait for server to start
timeout /t 2 /nobreak >nul

REM Start client server in background
echo Starting client server...
start "Client Server" cmd /c "cd client && npx http-server -p 3000 -c-1"

REM Wait for client server to start
timeout /t 2 /nobreak >nul

REM Open two browser windows
echo Opening browser clients...
start "" "http://localhost:3000"
timeout /t 1 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo Demo started!
echo.
echo Press any key to stop the servers...
pause >nul

REM Kill the processes (this is a simple version - in production you'd want better process management)
taskkill /FI "WINDOWTITLE eq Game Server*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Client Server*" /T /F >nul 2>&1


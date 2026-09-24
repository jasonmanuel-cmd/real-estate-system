@echo off
echo ========================================
echo Starting CA Deal Engine
echo ========================================
echo.
echo Backend will start on: http://localhost:3001
echo Frontend will start on: http://localhost:3000
echo.
echo Press Ctrl+C to stop
echo.

REM Start backend in new window
start "CA Deal Engine - Backend" cmd /k "cd backend && npm run dev"

REM Wait 5 seconds for backend to start
timeout /t 5 /nobreak >nul

REM Start frontend in new window
start "CA Deal Engine - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both services starting in separate windows...
echo Open http://localhost:3000 in your browser
echo.
pause

@echo off
title PGEL Production & OEE Tracker - Local Runner
echo ===================================================
echo   PG ELECTROPLAST - Production & OEE Tracker MIS
echo   Starting Backend & Frontend Services...
echo ===================================================

echo [1/2] Starting Node.js Backend API on Port 5000...
start "PGEL MIS Backend (Port 5000)" cmd /k "node server/index.js"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Vite Frontend on Port 5173...
start "PGEL MIS Frontend (Port 5173)" cmd /k "npm.cmd run dev"

echo.
echo ===================================================
echo   Application running!
echo   URL: http://localhost:5173
echo ===================================================

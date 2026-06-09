@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   八强卡组数据更新工具
echo ========================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update_decks_data.ps1"
echo.
pause

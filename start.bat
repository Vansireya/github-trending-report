@echo off
echo ==========================================
echo    GitHub Trending Report Generator
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/3] Scraping today's Trending data...
call npm run scrape
if errorlevel 1 (
    echo ERROR: Failed to scrape data!
    pause
    exit /b 1
)
echo.

echo [2/3] Generating AI report...
call npm run summarize
if errorlevel 1 (
    echo ERROR: Failed to generate report!
    pause
    exit /b 1
)
echo.

echo [3/3] Generating HTML page...
call npm run html
if errorlevel 1 (
    echo ERROR: Failed to generate HTML!
    pause
    exit /b 1
)
echo.

echo ==========================================
echo    Report generation complete!
echo ==========================================
echo.

for /f "delims=" %%i in ('dir /b /o-n "reports\daily_*.html" 2^>nul') do (
    set "latest=%%i"
    goto :found
)

:found
if defined latest (
    echo Opening report: %latest%
    start "" "reports\%latest%"
) else (
    echo Report generated. Please check reports folder.
)

echo.
pause

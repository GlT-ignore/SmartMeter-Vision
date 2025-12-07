@echo off
echo ========================================
echo Force Push to GitHub
echo ========================================
echo.

cd /d "f:\Project\smart project\smartmeter-vision"

echo [1] Current git status:
git status
echo.

echo [2] Adding all files...
git add -A
echo.

echo [3] Files to be committed:
git status --short
echo.

echo [4] Committing changes...
git commit -m "Remove database population tools, add super user feature, fix TypeScript errors"
echo.

echo [5] Setting branch to main...
git branch -M main
echo.

echo [6] Configuring remote...
git remote remove origin 2>nul
git remote add origin https://github.com/GlT-ignore/SmartMeter-Vision.git
git remote -v
echo.

echo [7] Pushing to GitHub (this may prompt for credentials)...
git push -u origin main --force
echo.

if %ERRORLEVEL% EQU 0 (
    echo ========================================
    echo SUCCESS! Code pushed to GitHub
    echo ========================================
    echo Check: https://github.com/GlT-ignore/SmartMeter-Vision
) else (
    echo ========================================
    echo ERROR: Push failed with code %ERRORLEVEL%
    echo ========================================
    echo.
    echo Possible issues:
    echo - Authentication required (use Personal Access Token)
    echo - Network connection issue
    echo - Remote repository doesn't exist
)

echo.
pause

# PowerShell script to push to GitHub
Set-Location "f:\Project\smart project\smartmeter-vision"

Write-Host "=== Current Status ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Staging all changes ===" -ForegroundColor Cyan
git add -A

Write-Host "`n=== Committing changes ===" -ForegroundColor Cyan
git commit -m "Remove database population tools and add super user feature for admin password reset"

Write-Host "`n=== Setting branch to main ===" -ForegroundColor Cyan
git branch -M main

Write-Host "`n=== Configuring remote ===" -ForegroundColor Cyan
git remote remove origin 2>$null
git remote add origin https://github.com/GlT-ignore/SmartMeter-Vision.git
git remote -v

Write-Host "`n=== Pushing to GitHub ===" -ForegroundColor Cyan
Write-Host "If prompted, enter your GitHub credentials..." -ForegroundColor Yellow
git push -u origin main

Write-Host "`n=== Push completed! ===" -ForegroundColor Green
Write-Host "Check: https://github.com/GlT-ignore/SmartMeter-Vision" -ForegroundColor Cyan


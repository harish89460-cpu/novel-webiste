# ==============================================================================
# Rudhra Prarthana Novels — Windows Server & Secure Tunnel Launcher
# ==============================================================================
# This script starts the local Node.js backend server on port 3000 and establishes
# a secure, free HTTPS tunnel (Cloudflare Tunnel) to connect with Vercel.

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  Rudhra Prarthana Novels — Windows Server & Tunnel Launcher" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Verify MySQL Service
Write-Host "`n[Step 1/3] Checking MySQL Server on Windows..." -ForegroundColor Yellow
$mysqlService = Get-Service -Name MySQL80 -ErrorAction SilentlyContinue
if ($mysqlService -and $mysqlService.Status -eq 'Running') {
    Write-Host "✓ MySQL80 Windows Service is RUNNING on port 3306" -ForegroundColor Green
} else {
    Write-Host "⚠ MySQL80 service is not running. Attempting to start..." -ForegroundColor Yellow
    Start-Service -Name MySQL80 -ErrorAction SilentlyContinue
    $mysqlService = Get-Service -Name MySQL80 -ErrorAction SilentlyContinue
    if ($mysqlService -and $mysqlService.Status -eq 'Running') {
        Write-Host "✓ MySQL80 started successfully!" -ForegroundColor Green
    } else {
        Write-Host "✗ Could not start MySQL80. Please start MySQL from Services (services.msc) or MySQL Workbench." -ForegroundColor Red
    }
}

# 2. Start Backend Server
Write-Host "`n[Step 2/3] Starting Node.js Backend Server on port 3000..." -ForegroundColor Yellow
$serverProcess = Start-Process node -ArgumentList "backend/server.js" -PassThru -WindowStyle Minimized
Start-Sleep -Seconds 2

$backendHealth = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get -ErrorAction SilentlyContinue
if ($backendHealth -and $backendHealth.status -eq 'ok') {
    Write-Host "✓ Backend server is active on http://localhost:3000 (PID: $($serverProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "⚠ Waiting for backend server initialization..." -ForegroundColor Yellow
}

# 3. Check for Cloudflare Tunnel (cloudflared)
Write-Host "`n[Step 3/3] Setting up Secure HTTPS Tunnel for Vercel..." -ForegroundColor Yellow
$cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
$cloudflaredPath = if ($cloudflaredCmd) { $cloudflaredCmd.Source }
                   elseif (Test-Path "C:\Program Files (x86)\cloudflared\cloudflared.exe") { "C:\Program Files (x86)\cloudflared\cloudflared.exe" }
                   elseif (Test-Path "C:\Program Files\cloudflared\cloudflared.exe") { "C:\Program Files\cloudflared\cloudflared.exe" }
                   else { $null }

if (-not $cloudflaredPath) {
    Write-Host "`nCloudflare Tunnel (cloudflared) is not yet installed." -ForegroundColor Yellow
    Write-Host "You can install it in 10 seconds by running in PowerShell (Admin):" -ForegroundColor White
    Write-Host "    winget install Cloudflare.cloudflared" -ForegroundColor Cyan
    Write-Host "`nAlternatively, download cloudflared.exe directly from:" -ForegroundColor White
    Write-Host "    https://github.com/cloudflare/cloudflared/releases/latest" -ForegroundColor Cyan
    Write-Host "`nAfter installing, re-run this script to get your live HTTPS tunnel URL!" -ForegroundColor Green
} else {
    Write-Host "✓ Found cloudflared at: $cloudflaredPath" -ForegroundColor Green
    Write-Host "Starting Cloudflare quick tunnel to http://localhost:3000..." -ForegroundColor Cyan
    Write-Host "Look for the *.trycloudflare.com URL below to paste into Vercel:`n" -ForegroundColor Yellow
    & "$cloudflaredPath" tunnel --url http://localhost:3000
}


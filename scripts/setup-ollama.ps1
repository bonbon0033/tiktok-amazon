# PowerShell setup for Ollama + llama3.1:8b (optional — pipeline runs with rule-based fallback if Ollama is absent).
#
# Run from PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts/setup-ollama.ps1

$ErrorActionPreference = 'Stop'

Write-Host "==> Ollama setup for tiktok-amazon pipeline" -ForegroundColor Cyan

# 1. Check if already installed
$ollamaPath = $null
$candidates = @(
  "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
  "$env:ProgramFiles\Ollama\ollama.exe",
  "C:\Program Files\Ollama\ollama.exe"
)
foreach ($p in $candidates) {
  if (Test-Path $p) { $ollamaPath = $p; break }
}

if (-not $ollamaPath) {
  Write-Host "Ollama not found. Downloading installer..." -ForegroundColor Yellow
  $installerUrl = "https://ollama.com/download/OllamaSetup.exe"
  $installerPath = "$env:TEMP\OllamaSetup.exe"
  Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
  Write-Host "Launching installer (interactive). After install completes, re-run this script."
  Start-Process -FilePath $installerPath -Wait
  exit 0
}

Write-Host "Found: $ollamaPath" -ForegroundColor Green

# 2. Start server if not running
$running = $false
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 -UseBasicParsing
  if ($r.StatusCode -eq 200) { $running = $true }
} catch { }

if (-not $running) {
  Write-Host "Starting Ollama server in background..." -ForegroundColor Yellow
  Start-Process -FilePath $ollamaPath -ArgumentList "serve" -WindowStyle Hidden
  Start-Sleep -Seconds 3
}

# 3. Pull model if missing
$model = $env:OLLAMA_MODEL
if (-not $model) { $model = "llama3.1:8b" }

Write-Host "Checking model: $model" -ForegroundColor Cyan
$tags = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing | ConvertFrom-Json
$has = $tags.models | Where-Object { $_.name -like "$($model.Split(':')[0])*" }

if (-not $has) {
  Write-Host "Pulling $model (this may take several GB)..." -ForegroundColor Yellow
  & $ollamaPath pull $model
} else {
  Write-Host "Model present: $($has.name -join ', ')" -ForegroundColor Green
}

# 4. Smoke test
Write-Host "`nSmoke test:" -ForegroundColor Cyan
$body = @{
  model = $model
  messages = @(@{ role = "user"; content = "Reply with: OK" })
  stream = $false
} | ConvertTo-Json -Depth 5

$resp = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/chat" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
$out = ($resp.Content | ConvertFrom-Json).message.content
Write-Host "  Reply: $out" -ForegroundColor Green

Write-Host "`n==> Ready. Pipeline will now use LLM by default." -ForegroundColor Cyan
Write-Host "    Re-run: bash scripts/weekly-pipeline.sh 自己啓発"

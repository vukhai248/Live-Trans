# 1. Kill old CfT
powershell -ExecutionPolicy Bypass -File scripts/kill-cft.ps1

# 2. Launch CfT
$chrome = "C:\Users\Admin\AppData\Local\ms-playwright\chromium-1228\chrome-win64\chrome.exe"
$args = @(
  '--user-data-dir=D:\create\Live-Trans\.tools\profile',
  '--no-first-run',
  '--no-default-browser-check',
  '--load-extension=D:\create\Live-Trans\extension\.output\chrome-mv3',
  '--remote-debugging-port=9222',
  '--window-size=1400,900',
  'https://arxiv.org/pdf/2302.07121'
)
$proc = Start-Process -FilePath $chrome -ArgumentList $args -PassThru
Write-Host "Started Chromium with PID: $($proc.Id)"

# 3. Wait 4s for CDP
Start-Sleep -Seconds 4

# 4. Run node automation script
node scripts/test-translate-paper.mjs

Write-Host "Keeping Chromium alive for inspection..."
Start-Sleep -Seconds 30

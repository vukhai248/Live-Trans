# Kill TOÀN BỘ process Chromium for Testing (ms-playwright) — không đụng Chrome thường.
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.ExecutablePath -like '*ms-playwright*' }
$count = ($procs | Measure-Object).Count
Write-Host "Tìm thấy $count process Chromium for Testing"
$procs | ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
}
Start-Sleep -Seconds 2
$left = (Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.ExecutablePath -like '*ms-playwright*' } | Measure-Object).Count
Write-Host "Còn lại sau khi kill: $left"

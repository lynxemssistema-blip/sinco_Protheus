$filePath = "C:\Users\adm\Desktop\MetalFisa Anty\client\src\pages\EngineeringOrdersPage.jsx"
$lines = Get-Content -Path $filePath
$trimmed = $lines | Select-Object -First 750
$trimmed | Out-File -FilePath $filePath -Encoding utf8
Write-Host "Done. File trimmed to 750 lines."

$filePath = "C:\Users\adm\Desktop\MetalFisa Anty\client\src\pages\EngineeringOrdersPage.jsx"
$bytes = [System.IO.File]::ReadAllBytes($filePath)

# Check for and strip UTF-8 BOM (EF BB BF)
if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "BOM found, stripping..."
    $bytes = $bytes[3..($bytes.Length - 1)]
    [System.IO.File]::WriteAllBytes($filePath, $bytes)
    Write-Host "BOM stripped successfully."
}
else {
    Write-Host "No BOM found."
}

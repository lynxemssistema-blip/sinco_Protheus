$folder = "C:\Users\adm\Desktop\MetalFisa Anty\CargosExtract"
$outputFolder = "C:\Users\adm\Desktop\MetalFisa Anty\CargosExtract_TXT"

if (-not (Test-Path $outputFolder)) {
    New-Item -ItemType Directory -Path $outputFolder | Out-Null
}

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    
    $files = Get-ChildItem -Path $folder -Filter "*.doc" -Recurse

    foreach ($file in $files) {
        $docPath = $file.FullName
        $txtPath = Join-Path $outputFolder ($file.BaseName + ".txt")
        
        Write-Host "Converting $($file.Name)..."
        $doc = $word.Documents.Open($docPath, $false, $true)
        # 2 = wdFormatText
        $doc.SaveAs2($txtPath, 2)
        $doc.Close()
    }
    
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    Write-Host "All files converted successfully."
} catch {
    Write-Host "Failed to use Word COM object. Error: $_"
}

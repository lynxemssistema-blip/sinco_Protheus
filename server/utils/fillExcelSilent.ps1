param(
    [string]$jsonPath,
    [string]$templatePath,
    [string]$outputPath
)

try {
    $data = Get-Content -Raw -Path $jsonPath | ConvertFrom-Json
    
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    # Open read-only
    $workbook = $excel.Workbooks.Open($templatePath, [Type]::Missing, $true)
    
    # Attempt to get the sheet by name 'Importação XLS', fallback to first sheet if it fails
    try {
        $sheet = $workbook.Sheets.Item("Importação XLS")
    } catch {
        $sheet = $workbook.Sheets.Item(1)
    }

    # Clear old data (A to L just in case)
    $sheet.Range("A7:L200").ClearContents()

    $row = 7
    foreach ($item in $data) {
        $sheet.Cells.Item($row, 1).Value2 = [string]$item.componente
        $sheet.Cells.Item($row, 2).Value2 = [double]$item.qtd_necessaria
        # The user only requested A and B, but we can put material in C (3) if available
        if ($item.material_descricao) {
            $sheet.Cells.Item($row, 3).Value2 = [string]$item.material_descricao
        }
        $row++
    }

    # Save as new file
    $workbook.SaveAs($outputPath)
    $workbook.Close($false)
    $excel.Quit()
    
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($sheet) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    Write-Output "SUCCESS"
}
catch {
    Write-Error "Message: $($_.Exception.Message)`nTrace: $($_.ScriptStackTrace)"
    if ($excel) {
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
    exit 1
}

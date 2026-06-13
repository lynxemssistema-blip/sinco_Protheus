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
    $sheet = $workbook.Sheets.Item("Import XLS")

    # Clear old data
    $sheet.Range("A7:B200").ClearContents()
    $sheet.Range("H7:H200").ClearContents()
    $sheet.Range("K7:K200").ClearContents()

    $row = 7
    foreach ($item in $data) {
        $sheet.Cells.Item($row, 1).Value2 = [string]$item.componente
        $sheet.Cells.Item($row, 2).Value2 = [double]$item.qtd_necessaria
        $sheet.Cells.Item($row, 8).Value2 = [string]$item.material_descricao
        $sheet.Cells.Item($row, 11).Value2 = [string]$item.recurso_nome
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

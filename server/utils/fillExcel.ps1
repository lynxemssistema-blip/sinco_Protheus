param(
    [string]$jsonPath,
    [string]$templatePath
)

try {
    $data = Get-Content -Raw -Path $jsonPath | ConvertFrom-Json

    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $true
    
    # 3rd argument is ReadOnly = $true to force Save As
    $workbook = $excel.Workbooks.Open($templatePath, [Type]::Missing, $true)
    $sheet = $workbook.Sheets.Item("Import XLS")

    # Clear old data
    $sheet.Range("A7:B200").ClearContents()
    $sheet.Range("H7:H200").ClearContents()
    $sheet.Range("K7:K200").ClearContents()

    $row = 7
    foreach ($item in $data) {
        $sheet.Cells.Item($row, 1).Value2 = $item.componente
        $sheet.Cells.Item($row, 2).Value2 = $item.qtd_necessaria
        $sheet.Cells.Item($row, 8).Value2 = $item.material_descricao
        $sheet.Cells.Item($row, 11).Value2 = $item.recurso_nome
        $row++
    }
    
    # Do not quit excel, leave it open for the user
} catch {
    Write-Error $_.Exception.Message
}

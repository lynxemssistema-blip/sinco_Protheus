# get_sw_data.ps1
# Estrategia: GetActiveObject conecta ao app (funciona), depois RunMacro2 executa
# VBA DENTRO do processo SolidWorks onde ActiveDoc funciona normalmente.
$ErrorActionPreference = "Stop"

# -------------------------------------------------------
# Macro VBA que roda DENTRO do processo do SolidWorks
# Application.SldWorks e ActiveDoc funcionam in-process
# -------------------------------------------------------
$VBA_MACRO = @'
Sub GetStatus()
    Dim outPath As String
    outPath = Environ("TEMP") & "\sw_agent_out.json"

    Dim swApp As Object
    Set swApp = Application.SldWorks

    Dim swModel As Object
    Set swModel = swApp.ActiveDoc

    If swModel Is Nothing Then
        WriteFile outPath, "{""documentoAberto"":false}"
        Exit Sub
    End If

    Dim title As String, filepath As String, docType As Integer, typeStr As String
    title = swModel.GetTitle()
    filepath = swModel.GetPathName()
    docType = swModel.GetType()

    If docType = 1 Then
        typeStr = "Peca"
    ElseIf docType = 2 Then
        typeStr = "Montagem"
    ElseIf docType = 3 Then
        typeStr = "Desenho"
    Else
        typeStr = "Desconhecido"
    End If

    WriteFile outPath, "{""documentoAberto"":true,""arquivoNome"":""" & JE(title) & """,""arquivoCaminho"":""" & JE(filepath) & """,""tipoArquivo"":""" & typeStr & """}"
End Sub

Sub GetProperties()
    Dim outPath As String
    outPath = Environ("TEMP") & "\sw_agent_out.json"

    Dim swApp As Object
    Set swApp = Application.SldWorks

    Dim swModel As Object
    Set swModel = swApp.ActiveDoc

    If swModel Is Nothing Then
        WriteFile outPath, "{""success"":false,""message"":""No active document""}"
        Exit Sub
    End If

    Dim swCustProp As Object
    Set swCustProp = swModel.Extension.CustomPropertyManager("")

    If swCustProp Is Nothing Then
        WriteFile outPath, "{""success"":false,""message"":""CustomPropertyManager unavailable""}"
        Exit Sub
    End If

    Dim names As Variant
    names = swCustProp.GetNames()

    Dim propsJson As String
    propsJson = "["
    Dim count As Integer
    count = 0

    If Not IsEmpty(names) And Not IsNull(names) Then
        Dim i As Integer
        For i = 0 To UBound(names)
            Dim propName As String, propVal As String
            propName = CStr(names(i))
            propVal = ""
            swCustProp.Get4 propName, False, propVal, propVal
            If count > 0 Then propsJson = propsJson & ","
            propsJson = propsJson & "{""nome"":""" & JE(propName) & """,""valorBruto"":""" & JE(propVal) & """,""valorResolvido"":""" & JE(propVal) & """}"
            count = count + 1
        Next i
    End If

    propsJson = propsJson & "]"
    WriteFile outPath, "{""success"":true,""total"":" & count & ",""propriedades"":" & propsJson & "}"
End Sub

Sub GetGeometry()
    Dim outPath As String
    outPath = Environ("TEMP") & "\sw_agent_out.json"

    Dim swApp As Object
    Set swApp = Application.SldWorks

    Dim swModel As Object
    Set swModel = swApp.ActiveDoc

    If swModel Is Nothing Then
        WriteFile outPath, "{""success"":false,""message"":""No active document""}"
        Exit Sub
    End If

    If swModel.GetType() = 3 Then
        WriteFile outPath, "{""success"":false,""message"":""Mass properties don't apply to 2D drawings.""}"
        Exit Sub
    End If

    Dim swMass As Object
    Set swMass = swModel.Extension.CreateMassProperty()

    If swMass Is Nothing Then
        WriteFile outPath, "{""success"":false,""message"":""Failed to CreateMassProperty""}"
        Exit Sub
    End If

    swMass.UseSystemUnits = True

    Dim m As String, a As String, v As String, d As String
    m = Replace(Format(swMass.Mass, "0.000000"), ",", ".")
    a = Replace(Format(swMass.SurfaceArea, "0.000000"), ",", ".")
    v = Replace(Format(swMass.Volume, "0.000000"), ",", ".")
    d = Replace(Format(swMass.Density, "0.000000"), ",", ".")

    WriteFile outPath, "{""success"":true,""geometria"":{""massa_kg"":" & m & ",""area_m2"":" & a & ",""volume_m3"":" & v & ",""densidade_kg_m3"":" & d & ",""material"":""Configurado no SW""}}"
End Sub

Sub WriteFile(path As String, content As String)
    Dim fNum As Integer
    fNum = FreeFile()
    Open path For Output As #fNum
    Print #fNum, content
    Close #fNum
End Sub

Function JE(s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    JE = s
End Function
'@

# -------------------------------------------------------
# Conecta ao SolidWorks via GetActiveObject
# -------------------------------------------------------
function Get-SolidWorksApp {
    $progIds = @("SldWorks.Application", "SldWorks.Application.32", "SldWorks.Application.31", "SldWorks.Application.30")
    foreach ($progId in $progIds) {
        try {
            $app = [System.Runtime.InteropServices.Marshal]::GetActiveObject($progId)
            if ($null -ne $app) { return $app }
        } catch { }
    }
    return $null
}

try {
    $swApp = Get-SolidWorksApp
    if ($null -eq $swApp) {
        Write-Output '{"status":"error","message":"SolidWorks nao esta aberto no computador."}'
        exit
    }

    $action = if ($null -ne $args[0]) { $args[0] } else { "status" }

    $outputFile = "$env:TEMP\sw_agent_out.json"
    # .swp e a extensao padrao de macros SolidWorks; o nome do modulo e o nome do arquivo sem extensao
    $macroPath  = "$env:TEMP\sw_agent_macro.swp"
    $moduleName = [System.IO.Path]::GetFileNameWithoutExtension($macroPath)  # "sw_agent_macro"

    # Sub a executar no macro VBA
    $subName = switch ($action) {
        "status"     { "GetStatus" }
        "properties" { "GetProperties" }
        "geometry"   { "GetGeometry" }
        default      { "GetStatus" }
    }

    # Remove saida anterior
    if (Test-Path $outputFile) { Remove-Item $outputFile -Force -ErrorAction SilentlyContinue }

    # Grava macro em arquivo temporario (ANSI para compatibilidade SW VBA)
    [System.IO.File]::WriteAllText($macroPath, $VBA_MACRO, [System.Text.Encoding]::Default)

    # Executa macro dentro do processo SolidWorks
    # ModuleName = nome do arquivo sem extensao (padrao SolidWorks .swp)
    $retVal = [int]0
    $runErr = $swApp.RunMacro2($macroPath, $moduleName, $subName, 0, [ref]$retVal)

    # Aguarda o arquivo de saida (ate 5 segundos)
    $waited = 0
    while (-not (Test-Path $outputFile) -and $waited -lt 5000) {
        Start-Sleep -Milliseconds 150
        $waited += 150
    }

    if (-not (Test-Path $outputFile)) {
        Write-Output "{`"status`":`"error`",`"message`":`"Macro sem saida. RunMacro2 retornou: $runErr / retVal: $retVal. Verifique configuracoes de seguranca de macros no SolidWorks (Ferramentas > Opcoes > Seguranca do sistema).`"}"
        exit
    }

    $jsonContent = [System.IO.File]::ReadAllText($outputFile).Trim()

    # Para a acao status, envolve com o campo status para compatibilidade com o agente Node.js
    if ($action -eq "status") {
        $inner = $jsonContent | ConvertFrom-Json
        if ($inner.documentoAberto -eq $true) {
            $out = [ordered]@{
                status          = "connected"
                documentoAberto = $true
                arquivoNome     = $inner.arquivoNome
                arquivoCaminho  = $inner.arquivoCaminho
                tipoArquivo     = $inner.tipoArquivo
            }
            $out | ConvertTo-Json -Compress -Depth 2
        } else {
            Write-Output '{"status":"connected","documentoAberto":false}'
        }
    } else {
        Write-Output $jsonContent
    }

} catch {
    $errMsg = $_.Exception.Message
    if ($errMsg -match "0x800401E3") {
        Write-Output '{"status":"error","message":"SolidWorks nao esta aberto no computador."}'
    } else {
        $cleanMsg = $errMsg -replace '"', '\"'
        Write-Output "{`"status`":`"error`",`"message`":`"$cleanMsg`"}"
    }
}

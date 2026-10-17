/**
 * test-bridge-v2.js
 * Testa o bridge v2 diretamente: cria PS1 → executa → relata resultado
 */
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { exec } = require('child_process');

const PRINTER_NAME = 'ArgoxUSB';

// Pacote PPLB de teste
const pplbData = Buffer.from(
    'N\r\n' +
    'OT\r\n' +
    'Q440,24\r\n' +
    'q600\r\n' +
    'A50,200,0,4,1,1,N,"BRIDGE V2 OK"\r\n' +
    'A50,250,0,3,1,1,N,"WritePrinter RAW"\r\n' +
    'P1\r\n',
    'latin1'
);

function buildPsScript(binPath, printerName) {
    const printerEsc = printerName.replace(/'/g, "''");
    return `$ErrorActionPreference = 'Stop'
$printerName = '${printerEsc}'
$rawBytes = [System.IO.File]::ReadAllBytes('${binPath}')
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class WinRawTest {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public class DOC_INFO_1 { public string pDocName; public string pOutputFile; public string pDataType; }
    [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool OpenPrinter(string s, out IntPtr h, IntPtr a);
    [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] public static extern int StartDocPrinter(IntPtr h, int lv, [In,MarshalAs(UnmanagedType.LPStruct)] DOC_INFO_1 d);
    [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool WritePrinter(IntPtr h, IntPtr p, int cb, out int wr);
    [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
}
'@
$h = [IntPtr]::Zero
if (-not [WinRawTest]::OpenPrinter($printerName, [ref]$h, [IntPtr]::Zero)) {
    $e = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "OpenPrinter falhou: Win32=$e - impressora nao encontrada: $printerName"
}
try {
    $d = New-Object WinRawTest+DOC_INFO_1
    $d.pDocName = 'Teste-Bridge-v2'; $d.pOutputFile = $null; $d.pDataType = 'RAW'
    $id = [WinRawTest]::StartDocPrinter($h, 1, $d)
    if ($id -le 0) { throw 'StartDocPrinter falhou' }
    [WinRawTest]::StartPagePrinter($h) | Out-Null
    $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($rawBytes.Length)
    try {
        [System.Runtime.InteropServices.Marshal]::Copy($rawBytes, 0, $ptr, $rawBytes.Length)
        $wr = 0
        if (-not [WinRawTest]::WritePrinter($h, $ptr, $rawBytes.Length, [ref]$wr)) {
            $e = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "WritePrinter falhou Win32=$e ($wr/$($rawBytes.Length) bytes)"
        }
        Write-Host "OK:$wr"
    } finally { [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr) }
    [WinRawTest]::EndPagePrinter($h) | Out-Null
    [WinRawTest]::EndDocPrinter($h) | Out-Null
} finally { [WinRawTest]::ClosePrinter($h) | Out-Null }
`;
}

const binPath = path.join(os.tmpdir(), 'mf_bridgetest.bin');
const ps1Path = path.join(os.tmpdir(), 'mf_bridgetest.ps1');

fs.writeFileSync(binPath, pplbData);
const script = buildPsScript(binPath, PRINTER_NAME);
fs.writeFileSync(ps1Path, script, 'utf8');

console.log('=== TESTE BRIDGE v2 ===');
console.log(`Impressora : ${PRINTER_NAME}`);
console.log(`Pacote PPLB: ${pplbData.length} bytes`);
console.log(`PS1        : ${ps1Path}`);
console.log('Executando...');

exec(
    `powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}"`,
    { timeout: 30000 },
    (error, stdout, stderr) => {
        fs.unlink(binPath, () => {});
        fs.unlink(ps1Path, () => {});

        if (error) {
            console.error('❌ FALHOU:');
            console.error(stderr || error.message);
        } else {
            console.log('✅ SUCESSO:', stdout.trim());
            console.log('A etiqueta "BRIDGE V2 OK" deve ter impresso!');
        }
    }
);

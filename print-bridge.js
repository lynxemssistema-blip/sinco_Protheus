/**
 * print-bridge.js v6 — MetalFisa
 * TCP 9100 → GDI Print → ArgoxUSB PPLA driver → Impressora
 *
 * Protocolo TCP:
 *   Opção A — Raw PNG (offset 0,0):
 *     bytes: \x89PNG...
 *   Opção B — Header MetalFisa + PNG (com offset):
 *     bytes[0..1] = 0x4D 0x46  ("MF" magic)
 *     bytes[2..3] = X offset como Int16 big-endian (pixels a deslocar)
 *     bytes[4..5] = Y offset como Int16 big-endian
 *     bytes[6..7] = reservado (0x00 0x00)
 *     bytes[8..]  = PNG data
 *
 * Qualidade: drawImage em GraphicsUnit.Inch @ 203 DPI → mapeamento 1:1 pixel→dot
 */

const net    = require('net');
const { exec } = require('child_process');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const PORT         = 9100;
const PRINTER_NAME = process.env.PRINTER_NAME || 'ArgoxUSB';
const PRINTER_DPI  = 203;
const LABEL_W_PX   = 600;
const LABEL_H_PX   = 440;

// Tamanho em polegadas (usado na unidade Inch do GDI)
const LABEL_W_IN   = (LABEL_W_PX / PRINTER_DPI).toFixed(6);  // ~2.956
const LABEL_H_IN   = (LABEL_H_PX / PRINTER_DPI).toFixed(6);  // ~2.167

// Paper size em centésimos de polegada (unidade Win32)
const PAPER_W = Math.round(LABEL_W_PX / PRINTER_DPI * 100);  // 295
const PAPER_H = Math.round(LABEL_H_PX / PRINTER_DPI * 100);  // 217

const MF_MAGIC_0 = 0x4D; // 'M'
const MF_MAGIC_1 = 0x46; // 'F'
const PNG_MAGIC_0 = 0x89;
const PNG_MAGIC_1 = 0x50; // 'P'

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const err = (msg) => console.error(`[${new Date().toISOString()}] ERRO: ${msg}`);

function buildGdiScript(pngPath, printerName, offsetXPx, offsetYPx) {
    const pngEsc = pngPath.replace(/\\/g, '\\\\');
    const pEsc   = printerName.replace(/'/g, "''");
    // Offset em polegadas (1 pixel = 1/203 inch)
    const oxIn   = (offsetXPx / PRINTER_DPI).toFixed(6);
    const oyIn   = (offsetYPx / PRINTER_DPI).toFixed(6);
    return `
Add-Type -AssemblyName System.Drawing

$pngPath     = '${pngEsc}'
$printerName = '${pEsc}'
$widthIn     = [float]${LABEL_W_IN}
$heightIn    = [float]${LABEL_H_IN}
$offsetXIn   = [float]${oxIn}
$offsetYIn   = [float]${oyIn}
$paperW      = ${PAPER_W}
$paperH      = ${PAPER_H}

$img = [System.Drawing.Image]::FromFile($pngPath)

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $printerName

if (-not $doc.PrinterSettings.IsValid) {
    $img.Dispose()
    throw "Impressora '$printerName' nao encontrada ou invalida"
}

$ps = New-Object System.Drawing.Printing.PaperSize("Label", $paperW, $paperH)
$doc.DefaultPageSettings.PaperSize = $ps
$doc.DefaultPageSettings.Margins   = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$doc.DefaultPageSettings.Landscape = $false

$imgRef   = $img
$wIn      = $widthIn
$hIn      = $heightIn
$xIn      = $offsetXIn
$yIn      = $offsetYIn

$doc.add_PrintPage({
    param($sender, $e)
    # GraphicsUnit.Inch + coordenadas em polegadas na resolucao do printer (203 DPI)
    # => mapeamento 1:1 pixel->dot, sem scaling artifacts
    $e.Graphics.PageUnit         = [System.Drawing.GraphicsUnit]::Inch
    $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $e.Graphics.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $rect = New-Object System.Drawing.RectangleF($xIn, $yIn, $wIn, $hIn)
    $e.Graphics.DrawImage($imgRef, $rect)
    $e.HasMorePages = $false
})

$doc.Print()
$img.Dispose()
$doc.Dispose()

Write-Host "OK:printed"
`;
}

function printPNG(pngBuffer, offsetXPx, offsetYPx) {
    return new Promise((resolve, reject) => {
        const stamp   = Date.now();
        const pngPath = path.join(os.tmpdir(), `mf_${stamp}.png`);
        const ps1Path = path.join(os.tmpdir(), `mf_${stamp}.ps1`);
        try {
            fs.writeFileSync(pngPath, pngBuffer);
            fs.writeFileSync(ps1Path, buildGdiScript(pngPath, PRINTER_NAME, offsetXPx, offsetYPx), 'utf8');
        } catch (e) {
            return reject(new Error(`Temp file error: ${e.message}`));
        }
        exec(
            `powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}"`,
            { timeout: 30000 },
            (error, stdout, stderr) => {
                fs.unlink(pngPath, () => {});
                fs.unlink(ps1Path, () => {});
                if (error) reject(new Error((stderr || error.message).trim()));
                else resolve(stdout.trim());
            }
        );
    });
}

const server = net.createServer((socket) => {
    log(`Conexão: ${socket.remoteAddress}`);
    const chunks = [];
    socket.on('data', (c) => chunks.push(c));
    socket.on('end', async () => {
        const data = Buffer.concat(chunks);
        if (!data.length) return;

        let offsetX = 0, offsetY = 0, pngBuffer = data;

        // Detecta header MetalFisa (0x4D 0x46 = "MF")
        if (data.length >= 8 && data[0] === MF_MAGIC_0 && data[1] === MF_MAGIC_1) {
            offsetX   = data.readInt16BE(2);
            offsetY   = data.readInt16BE(4);
            pngBuffer = data.slice(8);
        }

        // Valida PNG magic
        if (pngBuffer.length < 4 ||
            pngBuffer[0] !== PNG_MAGIC_0 || pngBuffer[1] !== PNG_MAGIC_1) {
            err(`Dados não reconhecidos (${data.length} bytes) — esperado PNG ou header MF+PNG`);
            return;
        }

        log(`Recebido ${pngBuffer.length} bytes PNG | offset=(${offsetX},${offsetY})`);

        try {
            const r = await printPNG(pngBuffer, offsetX, offsetY);
            log(`✅ ${r}`);
        } catch (e) {
            err(e.message);
        }
    });
    socket.on('error', (e) => err(`Socket: ${e.message}`));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  MetalFisa Print Bridge v6`);
    console.log(`  TCP :${PORT} → GDI Inch-mode → ${PRINTER_NAME}`);
    console.log(`  Label: ${LABEL_W_PX}×${LABEL_H_PX}px @ ${PRINTER_DPI} DPI (${LABEL_W_IN}"×${LABEL_H_IN}")\n`);
    log('Aguardando...');
});

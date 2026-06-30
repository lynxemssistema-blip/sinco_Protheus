/**
 * MetalFisa Print Agent v1
 * Agente de impressão local — HTTP :9101
 *
 * Roda na máquina do USUÁRIO. O app MetalFisa envia o PNG da etiqueta
 * via HTTP e este agente imprime usando GDI (System.Drawing) via PowerShell.
 * Funciona com qualquer impressora instalada no Windows.
 *
 * Uso:
 *   node print-agent.js
 *   PRINTER_NAME=ArgoxUSB node print-agent.js
 *
 * Requisitos:
 *   - Node.js 16+ instalado na máquina
 *   - Impressora instalada no Windows com o nome configurado em PRINTER_NAME
 */

const http = require('http');
const { exec } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const PORT            = 9101;
const DEFAULT_PRINTER = process.env.PRINTER_NAME || 'ArgoxUSB';
const PRINTER_DPI     = 203;
const LABEL_W_PX      = 600;
const LABEL_H_PX      = 440;
const LABEL_W_IN      = (LABEL_W_PX / PRINTER_DPI).toFixed(6);  // ~2.9557
const LABEL_H_IN      = (LABEL_H_PX / PRINTER_DPI).toFixed(6);  // ~2.1675
const PAPER_W         = Math.round(LABEL_W_PX / PRINTER_DPI * 100); // 295
const PAPER_H         = Math.round(LABEL_H_PX / PRINTER_DPI * 100); // 217
const VERSION         = '1.0.0';

const log  = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const lerr = (msg) => console.error(`[${new Date().toISOString()}] ERRO: ${msg}`);

// ── Script PowerShell GDI ──────────────────────────────────────────────────────
function buildGdiScript(pngPath, printerName, offsetXPx, offsetYPx) {
    const pngEsc = pngPath.replace(/\\/g, '\\\\');
    const pEsc   = printerName.replace(/'/g, "''");
    const oxIn   = (offsetXPx / PRINTER_DPI).toFixed(6);
    const oyIn   = (offsetYPx / PRINTER_DPI).toFixed(6);
    return `Add-Type -AssemblyName System.Drawing
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
    throw "Impressora '$printerName' nao encontrada. Verifique o nome em Configuracoes > Etiquetas."
}

$ps = New-Object System.Drawing.Printing.PaperSize("Label", $paperW, $paperH)
$doc.DefaultPageSettings.PaperSize = $ps
$doc.DefaultPageSettings.Margins   = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$doc.DefaultPageSettings.Landscape = $false

$imgRef = $img
$wIn = $widthIn; $hIn = $heightIn; $xIn = $offsetXIn; $yIn = $offsetYIn
$doc.add_PrintPage({
    param($sender, $e)
    $e.Graphics.PageUnit          = [System.Drawing.GraphicsUnit]::Inch
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

// ── Impressão via GDI ──────────────────────────────────────────────────────────
function printPNG(pngBuffer, printerName, offsetXPx = 0, offsetYPx = 0) {
    return new Promise((resolve, reject) => {
        const stamp   = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const pngPath = path.join(os.tmpdir(), `mf_${stamp}.png`);
        const ps1Path = path.join(os.tmpdir(), `mf_${stamp}.ps1`);

        try {
            fs.writeFileSync(pngPath, pngBuffer);
            fs.writeFileSync(ps1Path, buildGdiScript(pngPath, printerName, offsetXPx, offsetYPx), 'utf8');
        } catch (e) {
            return reject(new Error(`Erro ao criar arquivo temporário: ${e.message}`));
        }

        exec(
            `powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}"`,
            { timeout: 30000 },
            (error, stdout, stderr) => {
                fs.unlink(pngPath, () => {});
                fs.unlink(ps1Path, () => {});
                if (error) {
                    reject(new Error((stderr || error.message).trim()));
                } else {
                    resolve(stdout.trim());
                }
            }
        );
    });
}

// ── Lista de impressoras instaladas ───────────────────────────────────────────
function getInstalledPrinters() {
    return new Promise((resolve) => {
        exec(
            `powershell -NonInteractive -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress"`,
            { timeout: 8000 },
            (error, stdout) => {
                if (error || !stdout.trim()) { resolve([]); return; }
                try {
                    const parsed = JSON.parse(stdout.trim());
                    resolve(Array.isArray(parsed) ? parsed : [parsed]);
                } catch { resolve([]); }
            }
        );
    });
}

// ── Setup: rodar PowerShell via arquivo temporário ────────────────────────────
function runPS(script, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const ps1 = path.join(os.tmpdir(), `mf_setup_${Date.now()}.ps1`);
        try { fs.writeFileSync(ps1, script, 'utf8'); } catch (e) { return reject(e); }
        exec(
            `powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`,
            { timeout: timeoutMs },
            (error, stdout, stderr) => {
                fs.unlink(ps1, () => {});
                if (error) reject(new Error((stderr || error.message).trim()));
                else resolve(stdout.trim());
            }
        );
    });
}

async function checkIsAdmin() {
    try {
        const out = await runPS(`([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)`);
        return out.toLowerCase() === 'true';
    } catch { return false; }
}

async function pingHost(host) {
    try {
        const safe = host.replace(/'/g, "''");
        const out = await runPS(`(Test-Connection -ComputerName '${safe}' -Count 1 -Quiet -ErrorAction SilentlyContinue).ToString()`, 10000);
        return out.toLowerCase() === 'true';
    } catch { return false; }
}

async function resolveHostIP(host) {
    try {
        const safe = host.replace(/'/g, "''");
        return await runPS(`[System.Net.Dns]::GetHostAddresses('${safe}') | Where-Object {$_.AddressFamily -eq 'InterNetwork'} | Select-Object -First 1 -ExpandProperty IPAddressToString`, 6000);
    } catch { return null; }
}

async function listSharedPrinters(host) {
    try {
        const safe = host.replace(/'/g, "''");
        const out = await runPS(`
try {
    $p = Get-WmiObject Win32_Printer -ComputerName '${safe}' -ErrorAction Stop | Where-Object { $_.Shared -eq $true } |
         Select-Object @{n='name';e={$_.Name}},@{n='share';e={$_.ShareName}},@{n='path';e={"\\\\\\\\${safe}\\\\$($_.ShareName)"}}
    if ($p) { $p | ConvertTo-Json -Compress } else { '[]' }
} catch { '[]' }`, 15000);
        const data = JSON.parse(out || '[]');
        return Array.isArray(data) ? data : [data];
    } catch { return []; }
}

async function isPrinterInstalled(name) {
    try {
        const safe = name.replace(/'/g, "''");
        const out = await runPS(`[bool](Get-Printer -Name '${safe}' -ErrorAction SilentlyContinue)`);
        return out.toLowerCase() === 'true';
    } catch { return false; }
}

async function installNetworkPrinter(printerPath) {
    const safe = printerPath.replace(/'/g, "''");
    await runPS(`Add-Printer -ConnectionName '${safe}' -ErrorAction Stop`, 30000);
}

async function installNetworkPrinterElevated(printerPath) {
    // Abre UAC na tela do usuário pedindo senha de admin
    const escaped = printerPath.replace(/\\/g, '\\\\').replace(/'/g, "''");
    await runPS(`
Start-Process powershell -Verb RunAs -Wait -ArgumentList @(
    '-NoProfile','-ExecutionPolicy','Bypass','-Command',
    "Add-Printer -ConnectionName ''${escaped}'' -ErrorAction Stop; Start-Sleep 2"
)`, 90000);
}

async function scanNetworkForPrinters(filter) {
    try {
        const out = await runPS(`
$results = @()
try {
    $comps = (net view 2>$null) -match '^\\\\\\\\' |
             ForEach-Object { ($_ -split '\\s+')[0].TrimStart('\\') }
    foreach ($c in $comps) {
        try {
            $ps = Get-WmiObject Win32_Printer -ComputerName $c -ErrorAction Stop | Where-Object { $_.Shared }
            foreach ($p in $ps) {
                $results += [PSCustomObject]@{
                    host  = $c
                    name  = $p.Name
                    share = $p.ShareName
                    path  = "\\\\$c\\$($p.ShareName)"
                }
            }
        } catch {}
    }
} catch {}
if ($results) { $results | ConvertTo-Json -Compress } else { '[]' }
`, 45000);
        const all = JSON.parse(out || '[]');
        const arr = Array.isArray(all) ? all : [all];
        if (filter) {
            const f = filter.toLowerCase();
            return arr.filter(p => (p.name || '').toLowerCase().includes(f) || (p.share || '').toLowerCase().includes(f) || (p.host || '').toLowerCase().includes(f));
        }
        return arr;
    } catch { return []; }
}

// ── Helpers HTTP ───────────────────────────────────────────────────────────────
const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(res, status, obj) {
    res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
            } catch (e) {
                reject(new Error('JSON inválido: ' + e.message));
            }
        });
        req.on('error', reject);
    });
}

// ── Servidor HTTP ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
    }

    // GET /status — verifica se o agente está rodando e lista impressoras
    if (req.method === 'GET' && req.url === '/status') {
        const printers = await getInstalledPrinters();
        jsonResponse(res, 200, {
            ok: true,
            version: VERSION,
            defaultPrinter: DEFAULT_PRINTER,
            printers,
        });
        return;
    }

    // POST /print — recebe canvasBase64 e imprime
    if (req.method === 'POST' && req.url === '/print') {
        let body;
        try {
            body = await readBody(req);
        } catch (e) {
            jsonResponse(res, 400, { ok: false, error: e.message });
            return;
        }

        const {
            canvasBase64,
            copies      = 1,
            printerName = DEFAULT_PRINTER,
            offsetX     = 0,
            offsetY     = 0,
        } = body;

        if (!canvasBase64) {
            jsonResponse(res, 400, { ok: false, error: 'canvasBase64 é obrigatório' });
            return;
        }

        let pngBuffer;
        try {
            pngBuffer = Buffer.from(
                canvasBase64.replace(/^data:image\/\w+;base64,/, ''),
                'base64'
            );
        } catch (e) {
            jsonResponse(res, 400, { ok: false, error: 'Base64 inválido: ' + e.message });
            return;
        }

        const totalCopies = Math.max(1, Math.floor(copies));
        const results = [];

        for (let c = 0; c < totalCopies; c++) {
            try {
                await printPNG(pngBuffer, printerName, offsetX, offsetY);
                results.push({ copy: c + 1, ok: true });
                log(`OK — "${printerName}" — cópia ${c + 1}/${totalCopies}`);
            } catch (e) {
                results.push({ copy: c + 1, ok: false, error: e.message });
                lerr(`Cópia ${c + 1}/${totalCopies}: ${e.message}`);
            }

            if (c < totalCopies - 1) {
                await new Promise(r => setTimeout(r, 300));
            }
        }

        const allOk = results.every(r => r.ok);
        jsonResponse(res, allOk ? 200 : 500, { ok: allOk, results });
        return;
    }

    // GET /setup/admin — verifica se o agente tem privilégios de administrador
    if (req.method === 'GET' && req.url === '/setup/admin') {
        const isAdmin = await checkIsAdmin();
        jsonResponse(res, 200, { ok: true, isAdmin });
        return;
    }

    // POST /setup/discover — descobre impressoras compartilhadas num host específico
    if (req.method === 'POST' && req.url === '/setup/discover') {
        let body;
        try { body = await readBody(req); } catch (e) { jsonResponse(res, 400, { ok: false, error: e.message }); return; }
        const { host } = body;
        if (!host) { jsonResponse(res, 400, { ok: false, error: 'host é obrigatório' }); return; }

        log(`Setup: descobrindo impressoras em "${host}"`);
        const reachable = await pingHost(host);
        if (!reachable) {
            jsonResponse(res, 200, { ok: false, reachable: false, error: `Host "${host}" não encontrado na rede` });
            return;
        }
        const ip = await resolveHostIP(host);
        const printers = await listSharedPrinters(host);
        jsonResponse(res, 200, { ok: true, reachable: true, ip, printers });
        return;
    }

    // POST /setup/install — instala impressora de rede (com ou sem elevação UAC)
    if (req.method === 'POST' && req.url === '/setup/install') {
        let body;
        try { body = await readBody(req); } catch (e) { jsonResponse(res, 400, { ok: false, error: e.message }); return; }
        const { printerPath, printerName, elevated = false } = body;
        if (!printerPath) { jsonResponse(res, 400, { ok: false, error: 'printerPath é obrigatório' }); return; }

        const name = printerName || printerPath.split('\\').filter(Boolean).pop();
        const alreadyInstalled = await isPrinterInstalled(name);
        if (alreadyInstalled) {
            jsonResponse(res, 200, { ok: true, alreadyInstalled: true, printerName: name });
            return;
        }

        log(`Setup: instalando "${printerPath}"${elevated ? ' [UAC]' : ''}`);
        try {
            if (elevated) await installNetworkPrinterElevated(printerPath);
            else await installNetworkPrinter(printerPath);
            const installed = await isPrinterInstalled(name);
            jsonResponse(res, 200, { ok: installed, printerName: name, installed });
        } catch (e) {
            const needsElevation = /access|denied|privilege|permiss|acesso|negado/i.test(e.message);
            jsonResponse(res, 200, { ok: false, needsElevation, error: e.message });
        }
        return;
    }

    // POST /setup/scan — varre a rede local em busca de impressoras compartilhadas
    if (req.method === 'POST' && req.url === '/setup/scan') {
        let body;
        try { body = await readBody(req); } catch { body = {}; }
        const { filter = '' } = body;
        log(`Setup: varrendo rede${filter ? ` (filtro: "${filter}")` : ''}`);
        const printers = await scanNetworkForPrinters(filter);
        jsonResponse(res, 200, { ok: true, printers });
        return;
    }

    jsonResponse(res, 404, { ok: false, error: `Rota não encontrada: ${req.method} ${req.url}` });
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        lerr(`Porta ${PORT} já está em uso — o Print Agent já está rodando nesta máquina.`);
    } else {
        lerr(`Erro no servidor: ${e.message}`);
    }
    process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n  ╔═══════════════════════════════════════════╗');
    console.log(`  ║   MetalFisa Print Agent v${VERSION}            ║`);
    console.log(`  ║   HTTP  →  http://127.0.0.1:${PORT}           ║`);
    console.log(`  ║   Impressora padrão: ${DEFAULT_PRINTER.padEnd(20)}║`);
    console.log('  ╚═══════════════════════════════════════════╝\n');
    log('Aguardando jobs de impressão...');
    log('Para parar: Ctrl+C');
});

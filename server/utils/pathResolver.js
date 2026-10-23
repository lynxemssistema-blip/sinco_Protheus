const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const uploadsDir = path.resolve(__dirname, '../uploads');

/**
 * Tenta fazer o download sob demanda de um arquivo de upload que esteja na VPS Hostinger
 * caso o mesmo não exista na máquina local (ex: durante desenvolvimento localhost).
 */
function tryDownloadFromRemoteHostinger(targetPath) {
    try {
        const relativePart = path.relative(uploadsDir, targetPath);
        if (!relativePart || relativePart.startsWith('..') || path.isAbsolute(relativePart)) {
            return false;
        }

        const sshKey = path.join(os.homedir(), '.ssh', 'id_hostinger_lynx');
        if (!fs.existsSync(sshKey)) {
            return false;
        }

        const remoteSubPath = relativePart.replace(/\\/g, '/');
        const remoteUrl = `/home/u494795077/domains/lynxems.com.br/public_html/server/uploads/${remoteSubPath}`;
        
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        
        execFileSync('scp', [
            '-i', sshKey,
            '-P', '65002',
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'ConnectTimeout=5',
            `u494795077@89.116.115.59:${remoteUrl}`,
            targetPath
        ], { timeout: 15000, stdio: 'ignore' });

        return fs.existsSync(targetPath);
    } catch (_) {
        return false;
    }
}

/**
 * Normaliza caminhos de arquivo para Windows e Linux:
 * - Remove aspas e espaços extras
 * - Mapeia caminhos de uploads (Linux Hostinger, Windows local, relativo ou absoluto) para a pasta uploads local
 * - Mapeia Q:\ e Q:/ para \\192.168.1.253\Engenharia\ (Windows) ou /mnt/engenharia/ (Linux)
 * - Mapeia UNC de Engenharia e Estrutura Lynx para /mnt/engenharia/ e /mnt/lynx/ no Linux
 * - Trata barras simples, duplas e invertidas
 * @param {string} filePath - Caminho original
 * @returns {string} - Caminho normalizado para o SO atual
 */
function normalizeFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return filePath;

    // Remove aspas e espaços nas pontas
    let normalized = filePath.trim().replace(/^["']+|["']+$/g, '').trim();

    // Intercepta e mapeia qualquer caminho de uploads (seja Linux Hostinger, Windows local, relativo ou absoluto)
    const uploadMatch = normalized.match(/(?:^|[\\/])(?:server[\\/])?uploads[\\/](.+)$/i);
    if (uploadMatch) {
        let subPath = uploadMatch[1].replace(/^[\\/]+/, '');
        if (process.platform !== 'win32') {
            subPath = subPath.replace(/\\/g, '/');
        } else {
            subPath = subPath.replace(/\//g, '\\');
        }
        return path.join(uploadsDir, subPath);
    }

    if (process.platform !== 'win32') {
        // --- AMBIENTE LINUX ---
        // Converte todas as barras para padrão Unix
        normalized = normalized.replace(/\\/g, '/');

        // Mapeia Q:/ para /mnt/engenharia/
        normalized = normalized.replace(/^Q:\/*/i, '/mnt/engenharia/');

        // Mapeia UNC de Engenharia (com 1 ou mais barras no início)
        normalized = normalized.replace(/^[\/]*192\.168\.1\.253\/Engenharia\/*/i, '/mnt/engenharia/');

        // Mapeia UNC de Estrutura Lynx (com 1 ou mais barras no início)
        normalized = normalized.replace(/^[\/]*192\.168\.1\.253\/Estrutura Lynx\/*/i, '/mnt/lynx/');

        // Mapeia caso venha com /mnt/Engenharia (garante minúsculo na raiz do mount)
        normalized = normalized.replace(/^\/mnt\/engenharia\/*/i, '/mnt/engenharia/');
        normalized = normalized.replace(/^\/mnt\/lynx\/*/i, '/mnt/lynx/');
    } else {
        // --- AMBIENTE WINDOWS ---
        // Converte Q:\ para UNC
        normalized = normalized.replace(/^Q:[\/\\]*/i, '\\\\192.168.1.253\\Engenharia\\');

        // Mapeia /mnt/ de volta para UNC
        normalized = normalized.replace(/^[\/\\]*mnt[\/\\]engenharia[\/\\]*/i, '\\\\192.168.1.253\\Engenharia\\');
        normalized = normalized.replace(/^[\/\\]*mnt[\/\\]lynx[\/\\]*/i, '\\\\192.168.1.253\\Estrutura Lynx\\');

        // Converte barras Unix para Windows
        normalized = normalized.replace(/\//g, '\\');

        // Garante que caminhos UNC comecem com duas barras invertidas
        if (normalized.match(/^[^\\]*192\.168\.1\.253\\/i)) {
            normalized = normalized.replace(/^\\*/, '\\\\');
        }
    }

    return normalized;
}

/**
 * Procura um arquivo dentro do diretório de uploads local.
 * Útil quando o caminho gravado no banco aponta para pastas de rede interna (\\192.168.1.253\... ou /mnt/...)
 * mas o arquivo foi sincronizado ou armazenado dentro de server/uploads (engineering, docs, os, etc.).
 * @param {string} targetPath - Caminho ou nome do arquivo
 * @returns {string|null} - Caminho absoluto no disco se encontrado, ou null
 */
function findFileInUploads(targetPath) {
    if (!targetPath || typeof targetPath !== 'string') return null;
    const filename = path.basename(targetPath).trim();
    if (!filename) return null;

    // 1. Se o caminho continha 000-PRODUTOS ou engineering (ex: engineering/LEN-2026-00001/...)
    const matchProd = targetPath.match(/(?:000-PRODUTOS|engineering)[\\/](.+)$/i);
    if (matchProd) {
        const relSub = matchProd[1].replace(/\\/g, path.sep).replace(/\//g, path.sep);
        const directCandidate = path.join(uploadsDir, 'engineering', relSub);
        if (fs.existsSync(directCandidate)) return directCandidate;
    }

    // 2. Se o caminho continha 005-ORDEM DE SERVIÇO ou os
    const matchOS = targetPath.match(/(?:005-ORDEM DE SERVIÇO|os)[\\/](.+)$/i);
    if (matchOS) {
        const relSub = matchOS[1].replace(/\\/g, path.sep).replace(/\//g, path.sep);
        const directCandidate = path.join(uploadsDir, 'os', relSub);
        if (fs.existsSync(directCandidate)) return directCandidate;
    }

    // 3. Pastas comuns dentro de uploads
    const commonDirs = [
        path.join(uploadsDir, 'engineering'),
        path.join(uploadsDir, 'docs'),
        path.join(uploadsDir, 'os'),
        uploadsDir
    ];

    const targetLower = filename.toLowerCase();

    for (const dir of commonDirs) {
        if (!fs.existsSync(dir)) continue;
        const candidate = path.join(dir, filename);
        if (fs.existsSync(candidate)) return candidate;
    }

    // 4. Busca recursiva (até 3 níveis) para localizar por nome exato case-insensitive
    function recursiveSearch(dir, depth = 0) {
        if (depth > 3) return null;
        try {
            const list = fs.readdirSync(dir);
            for (const item of list) {
                const full = path.join(dir, item);
                let stat;
                try {
                    stat = fs.statSync(full);
                } catch (_) {
                    continue;
                }
                if (stat.isDirectory()) {
                    const found = recursiveSearch(full, depth + 1);
                    if (found) return found;
                } else if (item.toLowerCase().trim() === targetLower) {
                    return full;
                }
            }
        } catch (_) {}
        return null;
    }

    return recursiveSearch(uploadsDir);
}

/**
 * Tenta resolver o caminho físico exato no disco de forma case-insensitive e tolerante a pequenas variações.
 * No Linux, diretórios e arquivos em montagens CIFS/SMB ou sistemas de arquivos nativos
 * são estritamente sensíveis a maiúsculas/minúsculas se não montados com flag 'nocase'.
 * 
 * Esta função percorre cada segmento do caminho verificando se existe. Se falhar, lista os
 * arquivos/pastas do diretório pai para encontrar a correspondência correta ignorando case e espaços.
 * 
 * @param {string} targetPath - Caminho a resolver
 * @returns {string} - Caminho resolvido existente ou o caminho original se não encontrado
 */
function resolveCaseInsensitivePath(targetPath) {
    if (!targetPath || typeof targetPath !== 'string') return targetPath;

    // 1. Se o arquivo já existe exatamente como informado (caminho mais rápido)
    try {
        if (fs.existsSync(targetPath)) {
            return targetPath;
        }
    } catch (_) {}

    // 2. Se for um arquivo de upload que não existe localmente, tenta sincronizar da Hostinger sob demanda
    try {
        if (tryDownloadFromRemoteHostinger(targetPath)) {
            return targetPath;
        }
    } catch (_) {}

    // 3. Fallback inteligente: Se o arquivo está na rede interna ou não existe no caminho original,
    // verifica se existe dentro de server/uploads (engineering, docs, os, etc.)
    try {
        const uploadsCandidate = findFileInUploads(targetPath);
        if (uploadsCandidate && fs.existsSync(uploadsCandidate)) {
            return uploadsCandidate;
        }
    } catch (_) {}

    try {
        const normalized = path.normalize(targetPath);
        const parsed = path.parse(normalized);
        const isAbsolute = path.isAbsolute(normalized);
        const root = parsed.root || (isAbsolute ? path.sep : '');
        const relativePart = isAbsolute ? normalized.slice(root.length) : normalized;
        const segments = relativePart.split(path.sep).filter(Boolean);

        let currentPath = root || '.';

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const testPath = path.join(currentPath, segment);

            // Se o subcaminho existe exatamente, avança direto
            if (fs.existsSync(testPath)) {
                currentPath = testPath;
                continue;
            }

            // Diretório pai precisa existir para lermos seu conteúdo
            let entries;
            try {
                entries = fs.readdirSync(currentPath);
            } catch (err) {
                // Diretório pai inacessível
                return targetPath;
            }

            const segmentLower = segment.toLowerCase().trim();

            // 1. Correspondência exata ignorando case e espaços nas pontas
            let match = entries.find(e => e.toLowerCase().trim() === segmentLower);

            // 2. Se for o arquivo final e não encontrou, testar extensão alternativa (.pdf <-> .PDF)
            if (!match && i === segments.length - 1) {
                const segBase = path.parse(segment).name.toLowerCase().trim();
                const segExt = path.parse(segment).ext.toLowerCase().trim();

                // Procura arquivo com mesmo nome base e extensão compatível
                match = entries.find(e => {
                    const eParsed = path.parse(e);
                    return eParsed.name.toLowerCase().trim() === segBase &&
                        (eParsed.ext.toLowerCase().trim() === segExt ||
                         (segExt === '.pdf' && eParsed.ext.toLowerCase().trim() === '.pdf'));
                });

                // 3. Fallback: Procura arquivo cujo nome começa com o código do produto/desenho
                if (!match) {
                    match = entries.find(e => {
                        const eLower = e.toLowerCase().trim();
                        return eLower.startsWith(segBase) && (eLower.endsWith('.pdf') || eLower.endsWith(segExt));
                    });
                }
            }

            if (match) {
                currentPath = path.join(currentPath, match);
            } else {
                // Segmento não encontrado no diretório atual
                return targetPath;
            }
        }

        if (fs.existsSync(currentPath)) {
            return currentPath;
        }
    } catch (err) {
        console.warn('⚠️ [pathResolver] Erro ao resolver caminho case-insensitive:', err.message);
    }

    return targetPath;
}

/**
 * Retorna informações de diagnóstico detalhadas sobre um caminho que falhou.
 * Útil para saber se o ponto de montagem está montado e quais arquivos existem na última pasta encontrada.
 * @param {string} targetPath
 * @returns {object}
 */
function getDiagnosticPathInfo(targetPath) {
    if (!targetPath) return { exists: false, error: 'Caminho vazio' };

    const normalized = path.normalize(targetPath);
    const parsed = path.parse(normalized);
    const isAbsolute = path.isAbsolute(normalized);
    const root = parsed.root || (isAbsolute ? path.sep : '');
    const relativePart = isAbsolute ? normalized.slice(root.length) : normalized;
    const segments = relativePart.split(path.sep).filter(Boolean);

    let currentPath = root || '.';
    let lastExistingDir = currentPath;
    let failedAtSegment = null;
    let availableEntries = [];

    // Checa pontos de montagem comuns no Linux
    const isLinux = process.platform !== 'win32';
    const mountEngenhariaOk = isLinux ? fs.existsSync('/mnt/engenharia') : null;
    const mountLynxOk = isLinux ? fs.existsSync('/mnt/lynx') : null;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const next = path.join(currentPath, seg);
        if (fs.existsSync(next)) {
            currentPath = next;
            try {
                if (fs.statSync(currentPath).isDirectory()) {
                    lastExistingDir = currentPath;
                }
            } catch (_) {}
        } else {
            failedAtSegment = seg;
            try {
                if (fs.existsSync(lastExistingDir)) {
                    availableEntries = fs.readdirSync(lastExistingDir);
                }
            } catch (_) {}
            break;
        }
    }

    return {
        exists: fs.existsSync(targetPath),
        isLinux,
        mountEngenhariaOk,
        mountLynxOk,
        lastExistingDir,
        failedAtSegment,
        availableEntriesCount: availableEntries.length,
        sampleEntries: availableEntries.slice(0, 20)
    };
}

/**
 * Gera uma página HTML estilizada e amigável com diagnóstico de erro 404
 */
function formatNotFoundHtml(originalPath, normalizedPath, resolvedPath, diag) {
    const sampleFilesHtml = diag.sampleEntries && diag.sampleEntries.length > 0
        ? `<div style="margin-top:10px; max-height: 180px; overflow-y: auto; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px; font-family:monospace; font-size:12px;">
            <strong>Arquivos/Pastas encontrados em "${diag.lastExistingDir}":</strong>
            <ul style="margin:5px 0 0 20px; padding:0;">
                ${diag.sampleEntries.map(e => `<li>${e}</li>`).join('')}
            </ul>
           </div>`
        : '<p style="color:#64748b; font-size:13px;">Nenhum arquivo ou subpasta encontrado na pasta pai.</p>';

    const isNetworkShare = /192\.168\.1\.253|Estrutura Lynx|Engenharia|^Q:/i.test(originalPath || '');
    let mountWarning = '';

    if (diag.isLinux && isNetworkShare && !diag.mountEngenhariaOk && !diag.mountLynxOk) {
        mountWarning = `<div style="background:#451a03; border:1px solid #d97706; color:#fde68a; padding:14px; border-radius:8px; margin-bottom:16px; font-size:13px; line-height:1.5;">
            <strong style="font-size:14px; color:#fbbf24; display:block; margin-bottom:6px;">📁 Arquivo Armazenado na Rede Local da Empresa (192.168.1.253)</strong>
            O arquivo solicitado está referenciado no compartilhamento de rede interno da empresa (<code>${originalPath}</code>). Como este acesso está ocorrendo pelo servidor em nuvem (<strong>https://lynxems.com.br</strong>), a nuvem não possui rota direta para a rede física local da fábrica.
            <div style="margin-top:8px;">
                <strong>Como visualizar:</strong>
                <ul style="margin:4px 0 0 16px; padding:0;">
                    <li>Acesse a aplicação através da rede local da empresa (onde o compartilhamento 192.168.1.253 está acessível); ou</li>
                    <li>Faça o upload do PDF diretamente no cadastro do produto pelo sistema para que o arquivo fique permanentemente disponível na nuvem.</li>
                </ul>
            </div>
        </div>`;
    } else if (diag.isLinux && diag.mountEngenhariaOk === false) {
        mountWarning = `<div style="background:#fee2e2; border:1px solid #ef4444; color:#b91c1c; padding:10px 14px; border-radius:6px; margin-bottom:15px; font-weight:600;">
            ⚠️ Atenção: O ponto de montagem <code>/mnt/engenharia</code> NÃO está montado no servidor Linux! Verifique o fstab ou o comando de mount CIFS.
           </div>`;
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Arquivo Não Encontrado - Lynx</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; max-width: 800px; width: 100%; padding: 28px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
        h1 { color: #f87171; font-size: 20px; margin-top: 0; display: flex; align-items: center; gap: 8px; }
        .badge { background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .field { margin-bottom: 12px; }
        .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: bold; margin-bottom: 4px; }
        .value { background: #0f172a; border: 1px solid #334155; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #38bdf8; word-break: break-all; }
        .diag-box { background: #0f172a; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; margin-top: 16px; font-size: 13px; color: #cbd5e1; }
        .hint { font-size: 12px; color: #94a3b8; margin-top: 16px; border-top: 1px solid #334155; padding-top: 12px; }
    </style>
</head>
<body>
    <div class="card">
        <h1><span>⚠️ Arquivo Não Encontrado</span> <span class="badge">404</span></h1>
        ${mountWarning}
        <div class="field">
            <div class="label">Caminho Solicitado</div>
            <div class="value">${originalPath || '---'}</div>
        </div>
        <div class="field">
            <div class="label">Caminho no Servidor Linux</div>
            <div class="value">${resolvedPath || normalizedPath || '---'}</div>
        </div>
        <div class="diag-box">
            <strong>Diagnóstico de Busca:</strong>
            <p style="margin:6px 0;">${diag.failedAtSegment ? `Falha ao localizar o item <code>${diag.failedAtSegment}</code> dentro de <code>${diag.lastExistingDir}</code>` : 'O arquivo físico não foi localizado no disco.'}</p>
            ${sampleFilesHtml}
        </div>
        <div class="hint">
            <strong>Dica:</strong> Se o arquivo foi renomeado, alterado de revisão ou movido para outra pasta na rede, atualize o cadastro no sistema. Se o servidor foi reiniciado, certifique-se de que a unidade de rede <code>/mnt/engenharia</code> está montada.
        </div>
    </div>
</body>
</html>`;
}

module.exports = {
    normalizeFilePath,
    resolveCaseInsensitivePath,
    getDiagnosticPathInfo,
    formatNotFoundHtml,
    tryDownloadFromRemoteHostinger,
    uploadsDir
};

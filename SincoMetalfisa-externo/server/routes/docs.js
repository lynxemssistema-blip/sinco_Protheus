const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const fs = require('fs').promises;
const path = require('path');
const PDFExtractionService = require('../services/pdfExtraction');

/**
 * Normaliza caminhos de arquivo:
 * - Remove espaços no início/final
 * - Converte Q:\ para caminho UNC \\192.168.1.253\Engenharia\
 * @param {string} filePath - Caminho original
 * @returns {string} - Caminho normalizado
 */
function normalizeFilePath(filePath) {
    if (!filePath) return filePath;

    // Remove espaços no início e final
    let normalized = filePath.trim();

    // Converte Q:\ ou Q:/ para caminho UNC padrão em Windows/Linux
    normalized = normalized.replace(/^Q:[\/\\]/i, '\\\\192.168.1.253\\Engenharia\\');

    // Se estiver rodando no Linux, mapear UNC para o ponto de montagem local
    if (process.platform !== 'win32') {
        // Primeiro vira tudo barra normal do Linux
        normalized = normalized.replace(/\\/g, '/');
        // Depois mapeia a raiz do UNC pra /mnt/engenharia/
        normalized = normalized.replace(/^\/\/192\.168\.1\.253\/Engenharia\//i, '/mnt/engenharia/');
    } else {
        // Se estiver rodando no Windows (Local), mapeia /mnt/ de volta para UNC
        normalized = normalized.replace(/^\/mnt\/engenharia\//i, '\\\\192.168.1.253\\Engenharia\\');
        normalized = normalized.replace(/\//g, '\\');
    }

    return normalized;
}

// Inicialização: Criar Tabela se não existir
const initTable = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS produtos_docs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            produto_codigo VARCHAR(50) NOT NULL,
            titulo VARCHAR(255) NOT NULL,
            url_arquivo TEXT NOT NULL,
            operacao VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    try {
        await mysqlPool.query(createTableQuery);
        console.log('✅ Tabela produtos_docs verificada/criada no MySQL remoto.');
    } catch (err) {
        console.error('❌ Erro ao criar tabela produtos_docs:', err.message);
    }

    // Check if 'tipo' column exists, if not add it
    try {
        const [columns] = await mysqlPool.query("SHOW COLUMNS FROM produtos_docs LIKE 'tipo'");
        if (columns.length === 0) {
            await mysqlPool.query("ALTER TABLE produtos_docs ADD COLUMN tipo VARCHAR(50) DEFAULT 'Desenho'");
            console.log('✅ Coluna "tipo" adicionada à tabela produtos_docs.');
        }
    } catch (err) {
        console.error('⚠️ Erro ao verificar/adicionar coluna "tipo":', err.message);
    }

    // Check if 'titulo_desenho' column exists (for older installs)
    try {
        const [columns] = await mysqlPool.query("SHOW COLUMNS FROM produtos_docs LIKE 'titulo_desenho'");
        if (columns.length === 0) {
            // Add AI extraction columns if missing
            await mysqlPool.query(`ALTER TABLE produtos_docs 
                ADD COLUMN titulo_desenho VARCHAR(255),
                ADD COLUMN peso_kg DECIMAL(10,3),
                ADD COLUMN area_pintura_m2 DECIMAL(10,4),
                ADD COLUMN material VARCHAR(100),
                ADD COLUMN espessura_mm VARCHAR(50),
                ADD COLUMN dimensoes VARCHAR(100),
                ADD COLUMN revisao VARCHAR(20),
                ADD COLUMN confianca DECIMAL(5,2),
                ADD COLUMN extraido_em TIMESTAMP,
                ADD COLUMN extraido_por VARCHAR(50)
            `);
            console.log('✅ Colunas de IA adicionadas à tabela produtos_docs.');
        }
    } catch (err) {
        console.error('⚠️ Erro ao verificar/adicionar colunas IA:', err.message);
    }
};

// Executar init na carga do módulo (ou chamar via endpoint de setup, mas aqui é prático)
initTable();

// GET /api/docs/view?path=... - Proxy para abrir arquivos locais
router.get('/view', (req, res) => {
    let filePath = req.query.path;
    if (!filePath) {
        return res.status(400).send('Caminho do arquivo não informado.');
    }

    // Tratamento para múltiplos caminhos concatenados do Protheus (ex: caminho1.pdf" "caminho2.dwg)
    if (filePath.includes('" "')) {
        const paths = filePath.split('" "').map(p => p.replace(/"/g, '').trim());
        // Dá preferência para o PDF, se não houver, pega o primeiro
        const pdfPath = paths.find(p => p.toLowerCase().endsWith('.pdf'));
        filePath = pdfPath || paths[0];
    }
    
    // Remove aspas soltas que possam sobrar
    filePath = filePath.replace(/"/g, '').trim();

    // Normalizar caminho para Linux ou Windows
    filePath = normalizeFilePath(filePath);

    // Express sendFile exige caminhos absolutos - resolve resolve isso para qualquer SO
    const absolutePath = path.resolve(filePath);
    console.log(`📄 Abrindo arquivo em: ${absolutePath}`);

    res.sendFile(absolutePath, (err) => {
        if (err) {
            console.error('Erro ao servir arquivo:', err.message);
            res.status(404).send(`Erro ao abrir arquivo. Verifique se o caminho existe no SERVIDOR Linux: ${absolutePath}`);
        }
    });
});

// GET /api/docs/:produto_codigo - Listar documentos
router.get('/:produto_codigo', async (req, res) => {
    try {
        const { produto_codigo } = req.params;
        const [rows] = await mysqlPool.execute(
            'SELECT * FROM produtos_docs WHERE TRIM(produto_codigo) = ? ORDER BY created_at DESC',
            [produto_codigo.trim()]
        );
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar documentos:', err);
        res.status(500).json({ error: 'Erro ao buscar documentos no servidor remoto.' });
    }
});

// POST /api/docs - Adicionar documento
router.post('/', async (req, res) => {
    try {
        let { produto_codigo, titulo, url_arquivo, tipo = 'Desenho' } = req.body;

        if (!produto_codigo || !titulo || !url_arquivo) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        }

        // Sanitizar: remover aspas extras que o usuário pode colar junto com o caminho
        // Ex: "\\servidor\pasta\arquivo.pdf" → \\servidor\pasta\arquivo.pdf
        url_arquivo = String(url_arquivo).trim().replace(/^["']+|["']+$/g, '').trim();

        // Normalizar caminho do arquivo (trim + Q:\ → UNC)
        url_arquivo = normalizeFilePath(url_arquivo);

        // --- AI EXTRACTION START ---
        let aiMeta = {
            titulo_desenho: null, peso_kg: null, area_pintura_m2: null,
            material: null, espessura_mm: null, dimensoes: null,
            revisao: null, confianca: null
        };

        const geminiKey = process.env.GEMINI_API_KEY;
        if (url_arquivo.toLowerCase().endsWith('.pdf') && geminiKey && geminiKey !== 'sua_api_key_aqui') {
            try {
                const extractor = new PDFExtractionService(geminiKey);
                console.log(`🤖 Extraindo dados com IA para: ${produto_codigo}...`);
                const extracted = await extractor.extractFromPDF(url_arquivo);
                // Mapear chaves corretamente (extractFromPDF retorna 'titulo', não 'titulo_desenho')
                aiMeta = {
                    titulo_desenho: extracted.titulo ?? null,
                    peso_kg: extracted.peso_kg ?? null,
                    area_pintura_m2: extracted.area_pintura_m2 ?? null,
                    material: extracted.material ?? null,
                    espessura_mm: extracted.espessura_mm ?? null,
                    dimensoes: extracted.dimensoes ?? null,
                    revisao: extracted.revisao ?? null,
                    confianca: extracted.confianca ?? null,
                };
            } catch (aiErr) {
                console.warn(`⚠️ Falha na extração de IA (continuando cadastro sem metadados): ${aiErr.message}`);
                // Não propaga — o documento é salvo mesmo sem metadados de IA
            }
        }
        // --- AI EXTRACTION END ---

        const [result] = await mysqlPool.execute(
            `INSERT INTO produtos_docs 
            (produto_codigo, titulo, url_arquivo, tipo, titulo_desenho, peso_kg, area_pintura_m2, material, espessura_mm, dimensoes, revisao, confianca, extraido_em, extraido_por) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'automatico')`,
            [
                produto_codigo, titulo, url_arquivo, tipo,
                aiMeta.titulo_desenho, aiMeta.peso_kg, aiMeta.area_pintura_m2,
                aiMeta.material, aiMeta.espessura_mm, aiMeta.dimensoes,
                aiMeta.revisao, aiMeta.confianca
            ]
        );

        res.status(201).json({
            message: 'Documento adicionado com sucesso.',
            id: result.insertId,
            produto_codigo, titulo, url_arquivo,
            metadata: aiMeta
        });
    } catch (err) {
        console.error('❌ Erro ao salvar documento:', err.message, err.stack);
        res.status(500).json({ error: 'Erro ao salvar documento no servidor remoto.', details: err.message });
    }
});

// DELETE /api/docs/:id - Remover documento
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.execute('DELETE FROM produtos_docs WHERE id = ?', [id]);
        res.json({ message: 'Documento removido.' });
    } catch (err) {
        console.error('Erro ao remover documento:', err);
        res.status(500).json({ error: 'Erro ao remover documento.' });
    }
});

// Função auxiliar para varredura recursiva de diretórios
async function getFilesRecursively(dir) {
    let dirents;
    try {
        dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
        // Se erro ao ler diretório (permissão negada, não encontrado, etc), logar e pular
        if (err.code === 'EPERM' || err.code === 'EACCES') {
            console.log(`⚠️ Sem permissão para acessar: ${dir} (ignorando...)`);
        } else if (err.code === 'ENOENT') {
            console.log(`⚠️ Pasta não encontrada: ${dir} (ignorando...)`);
        } else {
            console.log(`⚠️ Erro ao acessar ${dir}: ${err.message} (ignorando...)`);
        }
        return []; // Retorna array vazio para esta pasta
    }

    const files = await Promise.all(dirents.map(async (dirent) => {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            // Recursão - mas com try/catch individual
            try {
                return await getFilesRecursively(res);
            } catch (err) {
                // Se houver erro na recursão, logar e retornar vazio
                console.log(`⚠️ Erro ao processar subpasta ${res}: ${err.message} (ignorando...)`);
                return [];
            }
        } else {
            return res;
        }
    }));
    return Array.prototype.concat(...files);
}

// Função para resolver drives mapeados para caminhos UNC
async function resolveMappedDrive(drivePath) {
    // Se não for um drive mapeado (ex: C:, D:, Q:), retorna como está
    if (!/^[A-Z]:\\/i.test(drivePath)) {
        return drivePath; // Pode ser UNC ou caminho relativo
    }

    // Extrair letra do drive (ex: "Q:\pasta" -> "Q:")
    const driveLetter = drivePath.substring(0, 1).toUpperCase();
    const relativePath = drivePath.substring(2); // Remove "Q:"

    // 1. Tentar usar o mapeamento manual configurado
    try {
        const driveMapping = require('../config/driveMapping');
        if (driveMapping[driveLetter]) {
            const fullUncPath = driveMapping[driveLetter] + relativePath;
            console.log(`🔄 Convertido (mapeamento manual): ${drivePath} -> ${fullUncPath}`);
            return fullUncPath;
        }
    } catch (err) {
        console.log(`⚠️ Arquivo de mapeamento não encontrado, tentando net use...`);
    }

    // 2. Fallback: Tentar descobrir o caminho UNC usando 'net use'
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execPromise = promisify(exec);

    try {
        const { stdout } = await execPromise(`net use ${driveLetter}:`, { encoding: 'utf8' });

        // Procurar linha com "Remoto" ou "Remote" que contém o UNC path
        const match = stdout.match(/(?:Remoto|Remote)\s+(.+)/i);
        if (match && match[1]) {
            const uncPath = match[1].trim();
            const fullUncPath = uncPath + relativePath;
            console.log(`🔄 Convertido (net use): ${drivePath} -> ${fullUncPath}`);
            return fullUncPath;
        }
    } catch (err) {
        // Se não conseguir resolver, retorna o caminho original
        console.log(`⚠️ Não foi possível resolver ${driveLetter}:, usando caminho original`);
    }

    return drivePath;
}

// POST /api/docs/bulk - Importação em Massa de Documentos
router.post('/bulk', async (req, res) => {
    let { folderPath, overwrite = false, useAI = true } = req.body;

    if (!folderPath) {
        return res.status(400).json({ error: 'É obrigatório informar o caminho da pasta (folderPath).' });
    }

    try {
        // Normalizar caminho: trim + Q:\ → UNC
        const resolvedPath = normalizeFilePath(folderPath);
        console.log(`📂 Caminho original: ${folderPath}`);
        console.log(`📂 Caminho normalizado: ${resolvedPath}`);

        let allFiles;
        try {
            allFiles = await getFilesRecursively(resolvedPath);
        } catch (err) {
            console.error(`❌ Erro ao varrer pasta: ${folderPath}`, err);
            return res.status(400).json({
                error: `Erro ao acessar a pasta.`,
                path: folderPath,
                details: err.message
            });
        }

        console.log(`📄 Arquivos encontrados: ${allFiles.length}`);

        // --- NEW LOGIC: Pre-fetch all product codes ---
        let knownCodes = [];
        try {
            const pool = require('../db');
            const pgRes = await pool.query("SELECT TRIM(b1_cod) as cod FROM public.sb1010 WHERE TRIM(COALESCE(d_e_l_e_t_, '')) <> '*' AND b1_cod IS NOT NULL");
            knownCodes = pgRes.rows.map(r => r.cod.toUpperCase());
            // Sort by length descending to match longest code first
            knownCodes.sort((a, b) => b.length - a.length);
            console.log(`📦 Carregados ${knownCodes.length} códigos de produto para mapeamento inteligente.`);
        } catch (e) {
            console.error('⚠️ Erro ao carregar códigos do Protheus, fallback para nome exato:', e.message);
        }

        let stats = { processed: 0, linked: 0, updated: 0, skipped: 0, errors: 0, ai_extracted: 0, ai_errors: 0 };

        // Initialize AI Extractor if requested
        let extractor = null;
        if (useAI && process.env.GEMINI_API_KEY) {
            try {
                extractor = new PDFExtractionService(process.env.GEMINI_API_KEY);
            } catch (e) { console.error('Erro init AI:', e); }
        }

        for (const filePath of allFiles) {
            stats.processed++;
            const fileName = path.basename(filePath);

            if (path.extname(fileName).toLowerCase() !== '.pdf') {
                stats.skipped++;
                continue;
            }

            let baseName = path.parse(fileName).name.toUpperCase().trim();
            let produtoCodigo = null;

            if (knownCodes.length > 0) {
                // Find first code that the filename starts with followed by a separator or is exact
                produtoCodigo = knownCodes.find(code =>
                    baseName === code ||
                    baseName.startsWith(code + ' ') ||
                    baseName.startsWith(code + '-') ||
                    baseName.startsWith(code + '_') ||
                    baseName.startsWith(code + '.')
                );

                // Fallback: just direct startsWith if no separator
                if (!produtoCodigo) {
                    produtoCodigo = knownCodes.find(code => baseName.startsWith(code));
                }
            }

            // Fallback to exact basename if not found in known codes
            if (!produtoCodigo) {
                produtoCodigo = baseName;
            }

            if (!produtoCodigo) {
                stats.skipped++;
                continue;
            }

            // --- AI EXTRACTION ---
            let metadata = {
                titulo_desenho: null, peso_kg: null, area_pintura_m2: null,
                material: null, espessura_mm: null, dimensoes: null,
                revisao: null, confianca: null
            };
            let aiSuccess = false;

            if (extractor) {
                try {
                    console.log(`🤖 [AI] Analisando: ${fileName}...`);
                    metadata = await extractor.extractFromPDF(filePath);
                    stats.ai_extracted++;
                    aiSuccess = true;
                    // Rate limit safety
                    await new Promise(r => setTimeout(r, 1500));
                } catch (aiErr) {
                    console.warn(`⚠️ [AI] Falha em ${fileName}: ${aiErr.message}`);
                    stats.ai_errors++;
                }
            }
            // ---------------------

            try {
                const [existing] = await mysqlPool.execute(
                    'SELECT id, url_arquivo FROM produtos_docs WHERE produto_codigo = ? AND titulo = ?',
                    [produtoCodigo, fileName]
                );

                if (existing.length > 0) {
                    if (overwrite) {
                        // UPDATE with AI Data
                        let updateSql = "UPDATE produtos_docs SET url_arquivo = ?, tipo = 'Desenho'";
                        let updateParams = [filePath];

                        if (aiSuccess) {
                            updateSql += `, titulo_desenho=?, peso_kg=?, area_pintura_m2=?, material=?, espessura_mm=?, dimensoes=?, revisao=?, confianca=?, extraido_em=CURRENT_TIMESTAMP, extraido_por='automatico'`;
                            updateParams.push(metadata.titulo_desenho, metadata.peso_kg, metadata.area_pintura_m2, metadata.material, metadata.espessura_mm, metadata.dimensoes, metadata.revisao, metadata.confianca);
                        }

                        updateSql += ' WHERE id = ?';
                        updateParams.push(existing[0].id);

                        await mysqlPool.execute(updateSql, updateParams);
                        stats.updated++;
                    } else {
                        stats.skipped++;
                    }
                } else {
                    // INSERT with AI Data
                    await mysqlPool.execute(
                        `INSERT INTO produtos_docs 
                        (produto_codigo, titulo, url_arquivo, tipo, titulo_desenho, peso_kg, area_pintura_m2, material, espessura_mm, dimensoes, revisao, confianca, extraido_em, extraido_por) 
                        VALUES (?, ?, ?, 'Desenho', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'automatico')`,
                        [
                            produtoCodigo, fileName, filePath,
                            metadata.titulo_desenho, metadata.peso_kg, metadata.area_pintura_m2,
                            metadata.material, metadata.espessura_mm, metadata.dimensoes,
                            metadata.revisao, metadata.confianca
                        ]
                    );
                    stats.linked++;
                }

            } catch (dbErr) {
                console.error(`Erro BD ${fileName}:`, dbErr.message);
                stats.errors++;
            }
        }

        res.json({
            message: 'Processamento em massa concluído.',
            stats,
            details: `Pasta: ${folderPath}`
        });

    } catch (err) {
        console.error('Erro na importação em massa:', err);
        res.status(500).json({ error: 'Erro interno.', details: err.message });
    }
});


// POST /api/docs/extract/:id - Extrair dados de um documento PDF usando IA
router.post('/extract/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Buscar documento
        const [docs] = await mysqlPool.execute(
            'SELECT * FROM produtos_docs WHERE id = ?',
            [id]
        );

        if (docs.length === 0) {
            return res.status(404).json({ error: 'Documento não encontrado' });
        }

        const doc = docs[0];

        // Verificar se é PDF
        if (!doc.url_arquivo.toLowerCase().endsWith('.pdf')) {
            return res.status(400).json({
                error: 'Este arquivo não é um PDF',
                hint: 'A extração de dados funciona apenas com arquivos PDF'
            });
        }

        // Extrair dados do PDF usando Gemini
        const extractor = new PDFExtractionService(process.env.GEMINI_API_KEY);

        // Normalizar caminho antes de extrair
        const normalizedPath = normalizeFilePath(doc.url_arquivo);
        const metadata = await extractor.extractFromPDF(normalizedPath);

        // Salvar os metadados diretamente na tabela produtos_docs (UPDATE do registro existente)
        await mysqlPool.execute(`
            UPDATE produtos_docs 
            SET titulo_desenho = ?,
                peso_kg = ?,
                area_pintura_m2 = ?,
                material = ?,
                espessura_mm = ?,
                dimensoes = ?,
                revisao = ?,
                confianca = ?,
                extraido_em = CURRENT_TIMESTAMP,
                extraido_por = 'manual'
            WHERE id = ?
        `, [
            metadata.titulo,
            metadata.peso_kg,
            metadata.area_pintura_m2,
            metadata.material,
            metadata.espessura_mm,
            metadata.dimensoes,
            metadata.revisao,
            metadata.confianca,
            id
        ]);

        res.json({
            message: 'Dados extraídos com sucesso!',
            metadata,
            produto_codigo: doc.produto_codigo
        });

    } catch (err) {
        console.error('❌ Erro na extração:', err);

        // Mensagens de erro amigáveis
        if (err.message.includes('GEMINI_API_KEY')) {
            return res.status(500).json({
                error: 'API Key do Gemini não configurada',
                hint: 'Configure GEMINI_API_KEY no arquivo .env do servidor'
            });
        }

        if (err.message.includes('Arquivo não encontrado')) {
            return res.status(404).json({
                error: 'Arquivo PDF não encontrado no servidor',
                hint: 'Verifique se o caminho do arquivo está correto e acessível'
            });
        }

        res.status(500).json({
            error: 'Erro ao extrair dados do PDF',
            details: err.message
        });
    }
});

// GET /api/docs/metadata/:doc_id - Obter metadados extraídos de um documento
router.get('/metadata/:doc_id', async (req, res) => {
    try {
        const { doc_id } = req.params;

        const [rows] = await mysqlPool.execute(
            'SELECT * FROM produtos_docs WHERE id = ?',
            [doc_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Documento não encontrado'
            });
        }

        const doc = rows[0];

        // Retornar documento com metadados (se já foram extraídos)
        res.json({
            id: doc.id,
            produto_codigo: doc.produto_codigo,
            titulo: doc.titulo,
            url_arquivo: doc.url_arquivo,
            metadados_extraidos: doc.titulo_desenho !== null,
            titulo_desenho: doc.titulo_desenho,
            peso_kg: doc.peso_kg,
            area_pintura_m2: doc.area_pintura_m2,
            material: doc.material,
            espessura_mm: doc.espessura_mm,
            dimensoes: doc.dimensoes,
            revisao: doc.revisao,
            confianca: doc.confianca,
            extraido_em: doc.extraido_em,
            extraido_por: doc.extraido_por
        });

    } catch (err) {
        console.error('Erro ao buscar metadados:', err);
        res.status(500).json({ error: 'Erro ao buscar metadados.' });
    }
});

// GET /api/docs/metadata/produto/:produto_codigo - Obter todos os metadados de um produto
router.get('/metadata/produto/:produto_codigo', async (req, res) => {
    try {
        const { produto_codigo } = req.params;

        const [rows] = await mysqlPool.execute(`
            SELECT * FROM produtos_docs
            WHERE produto_codigo = ?
            ORDER BY created_at DESC
        `, [produto_codigo]);

        res.json(rows);

    } catch (err) {
        console.error('Erro ao buscar metadados do produto:', err);
        res.status(500).json({ error: 'Erro ao buscar metadados.' });
    }
});

module.exports = router;

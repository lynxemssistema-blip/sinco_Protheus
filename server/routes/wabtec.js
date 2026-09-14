const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const db = require('../services/mysqlService');
const axios = require('axios');
const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

// Cache de Token Protheus OAuth2 em memória (TTL: 50 minutos)
let cachedProtheusToken = null;
let cachedProtheusTokenExpiry = 0;

async function getProtheusToken(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedProtheusToken && now < cachedProtheusTokenExpiry) {
        console.log('[Protheus Auth] ⚡ Utilizando token OAuth2 em cache de memória');
        return cachedProtheusToken;
    }

    console.log('[Protheus Auth] ⏳ Solicitando novo Token OAuth2 à API Protheus (192.168.1.60:47500)...');
    const tokenUrl = 'https://192.168.1.60:47500/tlpp/oauth2/token?grant_type=password&username=sinco&password=Metal1120';
    const tokenRes = await axios.get(tokenUrl, { httpsAgent, timeout: 35000 });

    const token = tokenRes.data?.access_token;
    if (!token) {
        throw new Error('Token JWT retornado pela API Protheus estava em branco.');
    }

    const expiresIn = Number(tokenRes.data?.expires_in) || 3600;
    // Cache válido com margem de segurança (5 minutos a menos)
    cachedProtheusTokenExpiry = now + Math.max((expiresIn - 300) * 1000, 60000);
    cachedProtheusToken = token;
    console.log(`[Protheus Auth] ✅ Novo Token Protheus gerado com sucesso (válido por ${expiresIn}s).`);
    return cachedProtheusToken;
}

// Configuração do Multer para armazenamento local
const uploadDir = path.join(__dirname, '../uploads/wabtec_escopos');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Rota para upload de novo escopo de fornecimento (PDF)
router.post('/escopos', upload.single('pdfFile'), async (req, res) => {
    try {
        const { projeto, revisao, criado_por } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        if (!projeto || !revisao) {
            return res.status(400).json({ error: 'Projeto e revisão são obrigatórios.' });
        }

        const filePath = file.path;
        const originalName = file.originalname;
        const relativePath = `uploads/wabtec_escopos/${file.filename}`;

        // Extrair texto do PDF
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        const textoExtraido = data.text;

        // Inserir no banco de dados
        const [result] = await db.query(`
            INSERT INTO app_wabtec_escopos 
            (projeto, revisao, nome_original, caminho_arquivo, texto_extraido, criado_por) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [projeto, revisao, originalName, relativePath, textoExtraido, criado_por || 'Sistema']);

        res.status(201).json({
            message: 'Escopo importado e indexado com sucesso.',
            id: result.insertId
        });

    } catch (error) {
        console.error('Erro ao importar escopo Wabtec:', error);
        res.status(500).json({ error: 'Erro interno ao processar o arquivo PDF.' });
    }
});

// Rota para listar todos os escopos
router.get('/escopos', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, projeto, revisao, nome_original, criado_por, status, data_criacao, caminho_arquivo 
            FROM app_wabtec_escopos 
            WHERE status = 'ATIVO'
            ORDER BY data_criacao DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar escopos Wabtec:', error);
        res.status(500).json({ error: 'Erro ao buscar dados.' });
    }
});

// Rota para buscar o texto extraído (inteligência)
router.get('/escopos/:id/texto', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT texto_extraido FROM app_wabtec_escopos WHERE id = ?`, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Escopo não encontrado.' });
        res.json({ texto: rows[0].texto_extraido });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar texto do escopo.' });
    }
});

// Rota para download/visualização do PDF real
router.get('/escopos/download/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT caminho_arquivo, nome_original FROM app_wabtec_escopos WHERE id = ?`, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Arquivo não encontrado.' });
        
        const filePath = path.join(__dirname, '..', rows[0].caminho_arquivo);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Arquivo físico não encontrado no servidor.' });
        }
        
        // Serve as inline so it displays in browser iframe
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${rows[0].nome_original}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Erro ao baixar arquivo Wabtec:', error);
        res.status(500).json({ error: 'Erro ao baixar arquivo.' });
    }
});

// Rota para deletar (marcar obsoleto)
router.delete('/escopos/:id', async (req, res) => {
    try {
        await db.query(`UPDATE app_wabtec_escopos SET status = 'OBSOLETO' WHERE id = ?`, [req.params.id]);
        res.json({ success: true, message: 'Documento movido para obsoleto.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir escopo.' });
    }
});

// --- Módulo Estrutura WabTec (Parse Excel, Lotes e Mapping Protheus) ---

const xlsx = require('xlsx');
const pgDb = require('../db');

function convertWabtecRevision(rev) {
    if (!rev) return '';
    const strRev = String(rev).trim().toUpperCase();
    if (/^[A-Z]+$/.test(strRev)) {
        let num = 0;
        for (let i = 0; i < strRev.length; i++) {
            num = num * 26 + (strRev.charCodeAt(i) - 64);
        }
        if (num <= 99) return String(num).padStart(2, '0');
    }
    return strRev;
}

// 1. Apenas lê e prever os dados (sem salvar)
router.post('/ler-abas', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

        const workbook = xlsx.readFile(req.file.path);
        const abas = workbook.SheetNames;
        
        res.json({
            success: true,
            abas,
            filePath: req.file.filename // Send filename back to use in next step
        });

    } catch (error) {
        console.error('Erro no ler-abas Wabtec:', error);
        res.status(500).json({ error: 'Erro ao ler abas do arquivo Excel.' });
    }
});

router.post('/upload-estrutura', upload.single('file'), async (req, res) => {
    try {
        const filePath = req.file ? req.file.path : (req.body.filePath ? path.join(uploadDir, req.body.filePath) : null);
        const aba_selecionada = req.body.aba_selecionada || null;

        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado ou encontrado.' });
        }

        const workbook = xlsx.readFile(filePath);
        const sheetName = aba_selecionada && workbook.SheetNames.includes(aba_selecionada) ? aba_selecionada : workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const originalName = req.file ? req.file.originalname : req.body.originalName || 'Estrutura_Wabtec';
        
        // Forçar leitura de toda a planilha ignorando !ref incorreto (bug de planilhas com macro)
        let max_r = 0, max_c = 0;
        for (let key in sheet) {
            if (key[0] === '!') continue;
            let cell = xlsx.utils.decode_cell(key);
            if (cell.r > max_r) max_r = cell.r;
            if (cell.c > max_c) max_c = cell.c;
        }
        sheet['!ref'] = xlsx.utils.encode_range({s:{c:0, r:0}, e:{c:max_c, r:max_r}});

        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const headers = rows[0] || [];
        
        // --- Template Validation ---
        const requiredHeaders = ['Level', 'ID', 'Revision', 'Name', 'Quantity'];
        const headersUpper = headers.map(h => String(h).trim().toUpperCase());
        
        const missingHeaders = requiredHeaders.filter(req => 
            !headersUpper.includes(req.toUpperCase())
        );

        if (missingHeaders.length > 0) {
            return res.status(400).json({ 
                error: `Template inválido ou formato incorreto. Faltam as seguintes colunas obrigatórias: ${missingHeaders.join(', ')}. Por favor, utilize o template padrão da Wabtec.` 
            });
        }
        // --------------------------

        const idxLevel = headersUpper.indexOf('LEVEL');
        const idxID = headersUpper.indexOf('ID');
        const idxRevision = headersUpper.indexOf('REVISION');
        const idxName = headersUpper.indexOf('NAME');
        const idxQuantity = headersUpper.indexOf('QUANTITY');
        const idxFindNo = headersUpper.findIndex(h => h.includes('FIND') || h.includes('POS'));
        const idxUOM = headersUpper.indexOf('UOM');
        const idxDateRel = headersUpper.findIndex(h => h.includes('DATE RELEASED') || h.includes('DATE'));
        const idxRelStatus = headersUpper.findIndex(h => h.includes('RELEASE STATUS'));
        const idxParent = headersUpper.indexOf('PARENT');
        const idxTCUID = headersUpper.indexOf('TCUID');

        const rawItems = [];
        const uniqueDesenhosSet = new Set();

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            // Verifica se a linha tem conteudo
            if (!row || row.length === 0 || row.every(val => !val)) continue;
            
            const nivel = row[idxLevel] !== undefined ? String(row[idxLevel]).trim() : '';
            const find_no = idxFindNo !== -1 && row[idxFindNo] !== undefined ? String(row[idxFindNo]).trim() : '';
            const desenho_cliente = row[idxID] ? String(row[idxID]).trim() : '';
            const rev_cliente_raw = row[idxRevision] ? String(row[idxRevision]).trim() : '';
            const titulo = row[idxName] ? String(row[idxName]).trim() : '';
            const qtd = row[idxQuantity] !== undefined ? String(row[idxQuantity]).trim() : '';
            const uom = idxUOM !== -1 && row[idxUOM] ? String(row[idxUOM]).trim() : '';
            const data_liberacao = idxDateRel !== -1 && row[idxDateRel] ? String(row[idxDateRel]).trim() : '';
            const status_liberacao = idxRelStatus !== -1 && row[idxRelStatus] ? String(row[idxRelStatus]).trim() : '';
            const item_pai = idxParent !== -1 && row[idxParent] ? String(row[idxParent]).trim() : '';
            const tcuid = idxTCUID !== -1 && row[idxTCUID] ? String(row[idxTCUID]).trim() : '';

            if (!desenho_cliente && !titulo) continue;
            
            const rev_convertida = convertWabtecRevision(rev_cliente_raw);
            if (desenho_cliente) uniqueDesenhosSet.add(desenho_cliente);

            rawItems.push({
                nivel,
                find_no,
                desenho_cliente,
                rev_cliente_raw,
                rev_convertida,
                titulo,
                qtd,
                uom,
                data_liberacao,
                status_liberacao,
                item_pai,
                tcuid,
                raw_data: JSON.stringify(row)
            });
        }

        // Cálculo da Quantidade Total Acumulada na hierarquia da BOM
        const stackQtd = [1];
        for (let j = 0; j < rawItems.length; j++) {
            const item = rawItems[j];
            let lvl = 0;
            const lvlStr = String(item.nivel || '0').trim();
            if (/^\.+/.test(lvlStr)) {
                lvl = lvlStr.match(/^\.+/)[0].length;
            } else {
                const parsed = parseInt(lvlStr, 10);
                lvl = isNaN(parsed) ? 0 : parsed;
            }

            const unitStr = String(item.qtd || '1').replace(',', '.').replace(/[^\d.]/g, '');
            const unit = parseFloat(unitStr) || 1;

            let total = 1;
            if (lvl === 0) {
                total = (item.qtd !== undefined && item.qtd !== '' && !isNaN(parseFloat(unitStr))) ? unit : 1;
                stackQtd[0] = total;
                stackQtd.length = 1;
            } else {
                const parentTotal = stackQtd[lvl - 1] !== undefined ? stackQtd[lvl - 1] : (stackQtd[stackQtd.length - 1] || 1);
                total = parentTotal * unit;
                stackQtd[lvl] = total;
                stackQtd.length = lvl + 1;
            }
            item.qtd_total = total;
        }

        // Consulta em lote o Protheus (SZ1010 e SB1010) para preencher Número MetalFisa e Revisão
        const uniqueDesenhos = Array.from(uniqueDesenhosSet);
        const protheusMap = new Map();

        if (uniqueDesenhos.length > 0) {
            try {
                const pgQuery = `
                    SELECT TRIM(sb1.b1_cod) as b1_cod, TRIM(sb1.b1_desc) as b1_desc, TRIM(sz1.z1_revisao) as z1_revisao, TRIM(sz1.z1_codcli) as z1_codcli, TRIM(sb1.b1_um) as b1_um, TRIM(sb1.b1_tipo) as b1_tipo
                    FROM public.sz1010 sz1
                    JOIN public.sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sz1.z1_produto) AND COALESCE(sb1.d_e_l_e_t_, '') <> '*'
                    WHERE TRIM(sz1.z1_codcli) = ANY($1) AND COALESCE(sz1.d_e_l_e_t_, '') = ''
                    ORDER BY sz1.z1_revisao DESC
                `;
                const { rows: pgRows } = await pgDb.query(pgQuery, [uniqueDesenhos]);
                if (pgRows && pgRows.length > 0) {
                    for (const pr of pgRows) {
                        const k = pr.z1_codcli;
                        if (!protheusMap.has(k)) protheusMap.set(k, []);
                        protheusMap.get(k).push(pr);
                    }
                }
            } catch (pgErr) {
                console.warn('Aviso ao consultar Protheus durante leitura da estrutura:', pgErr.message);
            }
        }

        const preview_data = rawItems.map(item => {
            let protheus_cod = null;
            let protheus_desc = null;
            let protheus_rev = null;
            let protheus_um = null;
            let protheus_tipo = null;
            let status_mapeamento = 'PENDENTE';
            let status_detalhe = '';
            let revisao_igual = false;

            const matches = protheusMap.get(item.desenho_cliente);
            if (item.desenho_cliente) {
                if (matches && matches.length > 0) {
                    const revExcelNum = parseInt(item.rev_convertida, 10);
                    let exactMatch = null;
                    if (!isNaN(revExcelNum)) {
                        exactMatch = matches.find(r => parseInt(r.z1_revisao, 10) === revExcelNum);
                    }
                    if (!exactMatch) {
                        exactMatch = matches.find(r => r.z1_revisao === item.rev_convertida || r.z1_revisao === item.rev_cliente_raw);
                    }
                    const hit = exactMatch || matches[0];
                    protheus_cod = hit.b1_cod;
                    protheus_desc = hit.b1_desc;
                    protheus_rev = hit.z1_revisao;
                    protheus_um = hit.b1_um;
                    protheus_tipo = hit.b1_tipo;

                    const revHitNum = parseInt(hit.z1_revisao, 10);
                    const isMatch = (!isNaN(revExcelNum) && !isNaN(revHitNum) && revExcelNum === revHitNum) || 
                                    (hit.z1_revisao === item.rev_convertida) || 
                                    (hit.z1_revisao === item.rev_cliente_raw);

                    revisao_igual = !!isMatch;

                    if (isMatch) {
                        status_mapeamento = 'ENCONTRADO';
                        status_detalhe = `Mesma Revisão (${hit.z1_revisao})`;
                    } else {
                        status_mapeamento = 'DIFERENCA_REVISAO';
                        status_detalhe = `Cliente: ${item.rev_cliente_raw} (${item.rev_convertida}) ≠ MetalFisa: ${hit.z1_revisao}`;
                    }
                } else {
                    status_mapeamento = 'NAO_ENCONTRADO';
                    status_detalhe = 'Desenho não cadastrado na tabela SZ1 (Protheus).';
                    revisao_igual = false;
                }
            } else {
                status_mapeamento = 'IGNORADO';
                status_detalhe = 'Sem código de desenho.';
                revisao_igual = false;
            }

            return {
                ...item,
                uom: protheus_um || item.uom || '',
                protheus_tipo: protheus_tipo || '',
                protheus_cod,
                protheus_desc,
                protheus_rev,
                revisao_igual,
                status_mapeamento,
                status_detalhe
            };
        });

        res.json({
            message: 'Planilha processada com sucesso!',
            nome_arquivo: originalName,
            nome_aba: sheetName,
            headers,
            preview_data
        });

    } catch (error) {
        console.error('Erro no upload-estrutura Wabtec:', error);
        res.status(500).json({ error: 'Erro ao processar o arquivo Excel.' });
    }
});

// 3. Salvar Lote e Registros WabTec
router.post('/save-lote', async (req, res) => {
    const { nome_arquivo, nome_aba, records, headers } = req.body;
    
    if (!records || records.length === 0) {
        return res.status(400).json({ error: 'Nenhum registro para salvar.' });
    }

    try {
        const userId = req.user ? req.user.nome : 'Sistema';
        const headersJson = headers ? JSON.stringify(headers) : '[]';

        // Cria o Lote
        const [loteResult] = await db.query(
            `INSERT INTO app_wabtec_lotes (nome_arquivo, nome_aba, criado_por, headers) VALUES (?, ?, ?, ?)`, 
            [nome_arquivo, nome_aba || '', userId, headersJson]
        );
        const loteId = loteResult.insertId;

        if (records && records.length > 0) {
            const values = records.map(r => [
                loteId, 
                r.nivel || '', 
                r.find_no || '', 
                r.desenho_cliente || '', 
                r.rev_cliente_raw || '', 
                r.rev_convertida || '', 
                r.titulo || '', 
                (isNaN(parseFloat(r.qtd)) || r.qtd === '') ? null : parseFloat(r.qtd), 
                (isNaN(parseFloat(r.qtd_total)) || r.qtd_total === null) ? null : parseFloat(r.qtd_total),
                r.uom || '',
                r.data_liberacao || '',
                r.status_liberacao || '',
                r.item_pai || '',
                r.tcuid || '',
                r.protheus_cod || null,
                r.protheus_desc || null,
                r.protheus_rev || null,
                r.protheus_tipo || null,
                r.cadastro_novo ? 1 : 0,
                r.status_mapeamento || 'PENDENTE',
                r.status_detalhe || '',
                r.raw_data || '[]'
            ]);
            await db.query(`
                INSERT INTO app_wabtec_estruturas 
                (lote_id, nivel, find_no, desenho_cliente, rev_cliente_raw, rev_convertida, titulo, qtd, qtd_total, uom, data_liberacao, status_liberacao, item_pai, tcuid, protheus_cod, protheus_desc, protheus_rev, protheus_tipo, cadastro_novo, status_mapeamento, status_detalhe, raw_data)
                VALUES ?
            `, [values]);
        }

        res.json({ success: true, message: 'Lote e registros gravados com sucesso!' });
    } catch (error) {
        console.error('Erro no save-lote:', error);
        res.status(500).json({ error: 'Erro ao gravar lote de estrutura.' });
    }
});

// 3. Listar Lotes
router.get('/lotes', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT * FROM app_wabtec_lotes ORDER BY data_criacao DESC`);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar lotes' });
    }
});

// 4. Deletar Lote
router.delete('/lotes/:id', async (req, res) => {
    try {
        await db.query(`DELETE FROM app_wabtec_lotes WHERE lote_id = ?`, [req.params.id]);
        res.json({ msg: 'Lote removido com sucesso' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover lote' });
    }
});

// 5. Retornar Estruturas
router.get('/estruturas', async (req, res) => {
    try {
        const { lote_id } = req.query;
        let query = `
            SELECT e.*,
                   (SELECT COUNT(*) 
                      FROM produtos_docs pd 
                     WHERE (pd.produto_codigo = e.protheus_cod AND e.protheus_cod IS NOT NULL AND e.protheus_cod != '')
                        OR (pd.produto_codigo = e.desenho_cliente AND e.desenho_cliente IS NOT NULL AND e.desenho_cliente != '')) AS total_docs,
                   (SELECT pd.url_arquivo 
                      FROM produtos_docs pd 
                     WHERE (pd.produto_codigo = e.protheus_cod AND e.protheus_cod IS NOT NULL AND e.protheus_cod != '')
                        OR (pd.produto_codigo = e.desenho_cliente AND e.desenho_cliente IS NOT NULL AND e.desenho_cliente != '')
                     ORDER BY pd.created_at DESC LIMIT 1) AS primeiro_doc
            FROM app_wabtec_estruturas e
        `;
        const params = [];
        if (lote_id) {
            query += ` WHERE e.lote_id = ?`;
            params.push(lote_id);
        }
        const [mysqlRows] = await db.query(query, params);
        res.json({ data: mysqlRows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar dados de estruturas' });
    }
});

// 6. Sugerir Vínculos
router.post('/mapeamento/sugerir', async (req, res) => {
    try {
        const { lote_id, codigos } = req.body;
        
        // Se mandou lote_id, busca os codigos do lote. Se mandou codigos, usa os codigos.
        let itens = [];
        if (codigos && codigos.length > 0) {
            // Busca os registros exatos
            const placeholders = codigos.map(() => '?').join(',');
            const [rows] = await db.query(`SELECT * FROM app_wabtec_estruturas WHERE desenho_cliente IN (${placeholders})`, codigos);
            itens = rows;
        } else if (lote_id) {
            const [rows] = await db.query(`SELECT * FROM app_wabtec_estruturas WHERE lote_id = ?`, [lote_id]);
            itens = rows;
        }

        if (itens.length === 0) {
            return res.status(400).json({ error: 'Nenhum item para mapear.' });
        }

        for (const item of itens) {
            let protheus_cod = null;
            let protheus_desc = null;
            let protheus_rev = null;
            let protheus_um = null;
            let protheus_tipo = null;
            let status = 'PENDENTE';
            let status_detalhe = '';

            if (item.desenho_cliente) {
                try {
                    const pgQuery = `
                        SELECT TRIM(sb1.b1_cod) as b1_cod, TRIM(sb1.b1_desc) as b1_desc, TRIM(sz1.z1_revisao) as z1_revisao, TRIM(sb1.b1_um) as b1_um, TRIM(sb1.b1_tipo) as b1_tipo
                        FROM public.sz1010 sz1
                        JOIN public.sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sz1.z1_produto) AND COALESCE(sb1.d_e_l_e_t_, '') <> '*'
                        WHERE TRIM(sz1.z1_codcli) = $1 AND COALESCE(sz1.d_e_l_e_t_, '') = ''
                        ORDER BY sz1.z1_revisao DESC
                    `;
                    const { rows: pgRows } = await pgDb.query(pgQuery, [item.desenho_cliente]);

                    if (pgRows && pgRows.length > 0) {
                        // Converter a revisão do Excel (item.rev_convertida) e a do Protheus para inteiros para comparar corretamente 0 = 00 = 000
                        const revExcelNum = parseInt(item.rev_convertida, 10);
                        
                        let bestMatch = null;
                        
                        // Primeiro tenta encontrar uma revisão exata
                        if (!isNaN(revExcelNum)) {
                            bestMatch = pgRows.find(r => parseInt(r.z1_revisao, 10) === revExcelNum);
                        } else {
                            bestMatch = pgRows.find(r => r.z1_revisao === item.rev_convertida);
                        }
                        
                        // Se não encontrou exato, pega o primeiro (mais recente)
                        const hit = bestMatch || pgRows[0];
                        
                        protheus_cod = hit.b1_cod;
                        protheus_desc = hit.b1_desc;
                        protheus_rev = hit.z1_revisao;
                        protheus_um = hit.b1_um;
                        protheus_tipo = hit.b1_tipo;
                        
                        const revHitNum = parseInt(hit.z1_revisao, 10);
                        const isMatch = (!isNaN(revExcelNum) && !isNaN(revHitNum) && revExcelNum === revHitNum) || (hit.z1_revisao === item.rev_convertida);

                        if (isMatch) {
                            status = 'ENCONTRADO';
                            status_detalhe = 'Mapeado perfeitamente no Protheus.';
                        } else {
                            status = 'DIFERENCA_REVISAO';
                            status_detalhe = `Revisão diferente. Excel: ${item.rev_convertida} | Protheus: ${hit.z1_revisao}`;
                        }
                    } else {
                        status = 'NAO_ENCONTRADO';
                        status_detalhe = 'Desenho não cadastrado na tabela SZ1 (Protheus).';
                    }
                } catch (dbErr) {
                    status = 'ERRO';
                    status_detalhe = 'Erro ao consultar banco de dados.';
                }
            } else {
                status = 'IGNORADO';
                status_detalhe = 'Sem número de desenho para buscar.';
            }

            // Atualiza no banco
            await db.query(`
                UPDATE app_wabtec_estruturas 
                SET protheus_cod = ?, protheus_desc = ?, protheus_rev = ?, uom = COALESCE(NULLIF(?, ''), uom), protheus_tipo = COALESCE(?, protheus_tipo), status_mapeamento = ?, status_detalhe = ?
                WHERE id = ?
            `, [protheus_cod, protheus_desc, protheus_rev, protheus_um, protheus_tipo, status, status_detalhe, item.id]);
        }

        res.json({ success: true, message: 'Sugestões processadas e salvas com sucesso.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao processar sugestões.' });
    }
});

// 7. Extrair BOM para o Banco de Dados
router.post('/extrair-bom/:lote_id', async (req, res) => {
    try {
        const { lote_id } = req.params;
        const [loteRows] = await db.query('SELECT * FROM app_wabtec_lotes WHERE lote_id = ?', [lote_id]);
        if (!loteRows || loteRows.length === 0) {
            return res.status(404).json({ error: 'Lote não encontrado.' });
        }

        const [itens] = await db.query('SELECT * FROM app_wabtec_estruturas WHERE lote_id = ? AND protheus_cod IS NOT NULL AND status_mapeamento != "NAO_ENCONTRADO"', [lote_id]);
        if (!itens || itens.length === 0) {
            return res.status(400).json({ error: 'Nenhum item mapeado para extrair estrutura.' });
        }

        // Limpar estrutura anterior deste lote no banco
        await db.query('DELETE FROM app_wabtec_bom WHERE lote_id = ?', [lote_id]);

        let insertCount = 0;

        for (const item of itens) {
            const qtdRequerida = parseFloat(item.qtd) || 1;
            
            const pgQuery = `
                WITH RECURSIVE estrutura_linear AS (
                    SELECT 
                        TRIM(b1.b1_cod) AS produto,
                        TRIM(b1.b1_desc) AS descri,
                        $2::numeric AS qtd_calc,
                        0 AS nivel,
                        TRIM(b1.b1_cod) AS componente,
                        TRIM(b1.b1_um) AS um
                    FROM public.sb1010 b1
                    WHERE TRIM(b1.b1_cod) = $1
                    AND COALESCE(b1.d_e_l_e_t_, '') = ''

                    UNION ALL

                    SELECT 
                        TRIM(g1.g1_comp) AS produto,
                        TRIM(sb1.b1_desc) AS descri,
                        (e.qtd_calc * g1.g1_quant)::numeric AS qtd_calc,
                        e.nivel + 1 AS nivel,
                        TRIM(g1.g1_comp) AS componente,
                        TRIM(sb1.b1_um) AS um
                    FROM public.sg1010 g1
                    JOIN estrutura_linear e ON TRIM(g1.g1_cod) = e.produto
                    JOIN public.sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(g1.g1_comp)
                    WHERE COALESCE(g1.d_e_l_e_t_, '') = ''
                    AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                    AND e.nivel < 20
                )
                SELECT * FROM estrutura_linear;
            `;

            const { rows } = await pgDb.query(pgQuery, [item.protheus_cod, qtdRequerida]);

            if (rows.length > 0) {
                const values = rows.map(row => [
                    lote_id, 
                    item.id, 
                    item.desenho_cliente, 
                    item.protheus_cod, 
                    row.nivel, 
                    row.componente, 
                    row.descri, 
                    row.um || 'UN',
                    row.nivel === 0 ? qtdRequerida : (row.qtd_calc / (qtdRequerida || 1)), // quantidade base
                    parseFloat(row.qtd_calc) // quantidade total multiplicada
                ]);

                await db.query(`
                    INSERT INTO app_wabtec_bom 
                    (lote_id, estrutura_id, desenho_cliente, protheus_cod, nivel, componente_cod, descricao, um, quantidade, quantidade_total)
                    VALUES ?
                `, [values]);
                
                insertCount += rows.length;
            }
        }

        res.json({ success: true, message: `Estrutura extraída e ${insertCount} itens salvos no banco de dados com sucesso.` });
    } catch (err) {
        console.error('Erro na extração de BOM:', err);
        res.status(500).json({ error: 'Erro ao extrair e salvar estrutura no banco.' });
    }
});

// 8. Buscar BOM salva no banco
router.get('/bom/:lote_id', async (req, res) => {
    try {
        const { lote_id } = req.params;
        const [rows] = await db.query('SELECT * FROM app_wabtec_bom WHERE lote_id = ? ORDER BY estrutura_id, nivel, componente_cod', [lote_id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar BOM salva.' });
    }
});

// 9. Exportar BOM (Excel)
const ExcelJS = require('exceljs');
router.get('/exportar-bom/:lote_id', async (req, res) => {
    try {
        const { lote_id } = req.params;
        const [loteRows] = await db.query('SELECT * FROM app_wabtec_lotes WHERE lote_id = ?', [lote_id]);
        if (!loteRows || loteRows.length === 0) {
            return res.status(404).json({ error: 'Lote não encontrado.' });
        }
        const lote = loteRows[0];
        const nomeArquivo = lote.nome_arquivo || 'N/A';
        const nomeAba = lote.nome_aba || 'N/A';

        // Buscar diretamente da tabela já extraída
        const [bomRows] = await db.query('SELECT * FROM app_wabtec_bom WHERE lote_id = ?', [lote_id]);
        if (!bomRows || bomRows.length === 0) {
            return res.status(400).json({ error: 'Lista de materiais não encontrada. Extraia a BOM primeiro.' });
        }

        let resumoMap = {};

        for (const row of bomRows) {
            const key = row.componente_cod;
            if (!resumoMap[key]) {
                resumoMap[key] = {
                    produto: key,
                    descricao: row.descricao,
                    qtd_total: 0
                };
            }
            resumoMap[key].qtd_total += parseFloat(row.quantidade_total) || 0;
        }

        const resumoData = Object.values(resumoMap).sort((a, b) => a.produto.localeCompare(b.produto));

        const workbook = new ExcelJS.Workbook();
        const userInfo = req.user ? req.user.nome : 'Sistema';
        workbook.creator = userInfo;
        workbook.created = new Date();

        const sheetCompleta = workbook.addWorksheet('Estrutura Completa');
        const sheetResumida = workbook.addWorksheet('Resumo de Materiais');

        const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        // Header builder for both sheets
        const addHeader = (sheet, columns) => {
            sheet.mergeCells('A1:F1');
            sheet.getCell('A1').value = `Planilha Origem: ${nomeArquivo} | Aba: ${nomeAba}`;
            sheet.getCell('A1').font = { bold: true, size: 12 };

            sheet.mergeCells('A2:F2');
            sheet.getCell('A2').value = `Gerado por: ${userInfo} em ${dataHora}`;
            sheet.getCell('A2').font = { italic: true };
            
            sheet.addRow([]); // Blank row
            
            // The header row
            const headerRow = sheet.addRow(columns.map(c => c.header));
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            
            sheet.columns = columns.map(c => ({ key: c.key, width: c.width }));
        };

        // --- SHEET COMPLETA ---
        const colsCompleta = [
            { header: 'Desenho Cliente', key: 'origem_desenho', width: 25 },
            { header: 'Cod Origem Protheus', key: 'origem_protheus', width: 20 },
            { header: 'Nível', key: 'nivel', width: 10 },
            { header: 'Produto Componente', key: 'produto', width: 20 },
            { header: 'Descrição', key: 'descri', width: 50 },
            { header: 'Qtd Calc', key: 'qtd_calc', width: 15 }
        ];
        addHeader(sheetCompleta, colsCompleta);

        bomRows.forEach(row => {
            sheetCompleta.addRow({
                origem_desenho: row.desenho_cliente,
                origem_protheus: row.protheus_cod,
                nivel: row.nivel,
                produto: row.componente_cod,
                descri: row.descricao,
                qtd_calc: Number(row.quantidade_total)
            });
        });

        // --- SHEET RESUMIDA ---
        const colsResumida = [
            { header: 'Produto', key: 'produto', width: 20 },
            { header: 'Descrição', key: 'descri', width: 50 },
            { header: 'Qtd Total', key: 'qtd_total', width: 15 }
        ];
        addHeader(sheetResumida, colsResumida);

        resumoData.forEach(d => {
            sheetResumida.addRow({
                produto: d.produto,
                descri: d.descricao,
                qtd_total: Number(d.qtd_total)
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="BOM_Wabtec_${lote_id}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Erro ao gerar Excel BOM:', err);
        res.status(500).json({ error: 'Erro ao gerar o Excel do BOM.' });
    }
});

// 7. Desvincular Todos
router.post('/mapeamento/desvincular-todos', async (req, res) => {
    try {
        const { lote_id } = req.body;
        if (!lote_id) return res.status(400).json({ error: 'Lote não informado' });

        await db.query(`
            UPDATE app_wabtec_estruturas 
            SET protheus_cod = NULL, protheus_desc = NULL, protheus_rev = NULL, status_mapeamento = 'PENDENTE', status_detalhe = ''
            WHERE lote_id = ?
        `, [lote_id]);

        res.json({ message: 'Vínculos removidos com sucesso.' });
    } catch (error) {
        console.error('Erro ao desvincular:', error);
        res.status(500).json({ error: 'Erro ao desvincular' });
    }
});

// =========================================================================
// 7.1 ROTA: Buscar Próximo Código Protheus Estimado (Pré-Número)
// =========================================================================
router.get('/proximo-codigo', async (req, res) => {
    try {
        const grupoRaw = String(req.query.grupo || 'MT2').trim();
        const grupoLimpo = grupoRaw.split(/[\-\s]/)[0].toUpperCase().trim();

        if (!grupoLimpo) {
            return res.status(400).json({ error: 'Grupo não informado.' });
        }

        // Busca os últimos produtos deste grupo ordenados por recno decrescente
        const pgRes = await pgDb.query(`
            SELECT b1_cod, r_e_c_n_o_
            FROM public.sb1010
            WHERE (b1_grupo = $1 OR b1_cod LIKE $2) AND COALESCE(d_e_l_e_t_, '') = ''
            ORDER BY r_e_c_n_o_ DESC
            LIMIT 30
        `, [grupoLimpo.padEnd(4, ' '), `${grupoLimpo}-%`]);

        let maiorNum = 0;
        const regex = new RegExp(`^${grupoLimpo}-(\\d+)$`, 'i');

        for (const row of pgRes.rows) {
            const codTrim = (row.b1_cod || '').trim();
            const match = codTrim.match(regex);
            if (match) {
                const num = parseInt(match[1], 10);
                // Ignorar anomalias isoladas como 10000 se os outros forem menores
                if (!isNaN(num) && (num < 9900 || num > 11000)) {
                    if (num > maiorNum) {
                        maiorNum = num;
                    }
                }
            }
        }

        // Fallback caso todos sejam anomalias
        if (maiorNum === 0 && pgRes.rows.length > 0) {
            for (const row of pgRes.rows) {
                const codTrim = (row.b1_cod || '').trim();
                const match = codTrim.match(regex);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && num > maiorNum) maiorNum = num;
                }
            }
        }

        const proximoNum = maiorNum > 0 ? maiorNum + 1 : 1;
        const proximoCodigo = `${grupoLimpo}-${proximoNum}`;

        res.json({
            success: true,
            grupo: grupoLimpo,
            ultimo_codigo: maiorNum > 0 ? `${grupoLimpo}-${maiorNum}` : null,
            proximo_codigo: proximoCodigo
        });
    } catch (err) {
        console.error('[Wabtec Proximo Codigo] Erro:', err.message);
        res.status(500).json({ error: 'Erro ao calcular próximo código Protheus: ' + err.message });
    }
});

// =========================================================================
// 7.2 ROTA: Verificar se o Desenho do Cliente já existe no Protheus
// =========================================================================
router.get('/consultar-desenho', async (req, res) => {
    try {
        const desenhoRaw = req.query.desenho || '';
        const desenhoTrim = String(desenhoRaw).replace(/\s+/g, ' ').trim().toUpperCase();
        const desenhoNoSpaces = desenhoTrim.replace(/\s+/g, '');

        if (!desenhoTrim) {
            return res.json({ existe: false, desenho: '' });
        }

        console.log(`[Wabtec Consultar Desenho] Verificando existência de '${desenhoTrim}'...`);

        // 1. Consulta SZ1010 (Produto x Cliente) no Protheus
        const sz1Res = await pgDb.query(`
            SELECT 
                TRIM(sz1.z1_produto) AS z1_produto,
                TRIM(sz1.z1_cliente) AS z1_cliente,
                TRIM(sz1.z1_loja) AS z1_loja,
                TRIM(sz1.z1_codcli) AS z1_codcli,
                TRIM(sz1.z1_desccli) AS z1_desccli,
                TRIM(sz1.z1_revisao) AS z1_revisao,
                TRIM(sb1.b1_desc) AS b1_desc,
                TRIM(sb1.b1_grupo) AS b1_grupo,
                TRIM(sb1.b1_tipo) AS b1_tipo,
                TRIM(sb1.b1_um) AS b1_um,
                TRIM(sb1.b1_posipi) AS b1_posipi,
                TRIM(sb1.b1_xrevm) AS b1_xrevm,
                TRIM(sb1.b1_xcoddes) AS b1_xcoddes
            FROM public.sz1010 sz1
            LEFT JOIN public.sb1010 sb1 
                ON TRIM(sz1.z1_produto) = TRIM(sb1.b1_cod)
                AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            WHERE (
                TRIM(sz1.z1_codcli) = $1
                OR TRIM(sz1.z1_codcli) = $2
                OR REPLACE(TRIM(sz1.z1_codcli), ' ', '') = $2
            )
            AND COALESCE(sz1.d_e_l_e_t_, '') = ''
            ORDER BY sz1.r_e_c_n_o_ DESC
            LIMIT 1
        `, [desenhoTrim, desenhoNoSpaces]);

        if (sz1Res.rows.length > 0) {
            const r = sz1Res.rows[0];
            return res.json({
                existe: true,
                origem: 'sz1010',
                tabela: 'SZ1010 (Produto x Cliente Protheus)',
                codigo_protheus: r.z1_produto,
                cliente: r.z1_cliente,
                loja: r.z1_loja,
                cod_desenho_cliente: r.z1_codcli,
                revisao_cliente: r.z1_revisao,
                descricao: r.z1_desccli || r.b1_desc || '',
                grupo: r.b1_grupo || '',
                tipo: r.b1_tipo || '',
                um: r.b1_um || 'PC',
                ncm: r.b1_posipi || '00000000',
                revisao_metalfisa: r.b1_xrevm || '',
                cod_desenho_metalfisa: r.b1_xcoddes || ''
            });
        }

        // 2. Consulta SB1010 por B1_XCODDES ou B1_COD
        const sb1Res = await pgDb.query(`
            SELECT 
                TRIM(b1_cod) AS b1_cod,
                TRIM(b1_desc) AS b1_desc,
                TRIM(b1_grupo) AS b1_grupo,
                TRIM(b1_tipo) AS b1_tipo,
                TRIM(b1_um) AS b1_um,
                TRIM(b1_posipi) AS b1_posipi,
                TRIM(b1_xrevm) AS b1_xrevm,
                TRIM(b1_xcoddes) AS b1_xcoddes
            FROM public.sb1010
            WHERE (
                TRIM(b1_cod) = $1
                OR TRIM(b1_xcoddes) LIKE $2
                OR REPLACE(TRIM(b1_xcoddes), ' ', '') LIKE $3
            )
            AND COALESCE(d_e_l_e_t_, '') = ''
            ORDER BY r_e_c_n_o_ DESC
            LIMIT 1
        `, [desenhoTrim, `%${desenhoTrim}%`, `%${desenhoNoSpaces}%`]);

        if (sb1Res.rows.length > 0) {
            const r = sb1Res.rows[0];
            return res.json({
                existe: true,
                origem: 'sb1010',
                tabela: 'SB1010 (Produtos Protheus)',
                codigo_protheus: r.b1_cod,
                descricao: r.b1_desc || '',
                grupo: r.b1_grupo || '',
                tipo: r.b1_tipo || '',
                um: r.b1_um || 'PC',
                ncm: r.b1_posipi || '00000000',
                revisao_metalfisa: r.b1_xrevm || '',
                cod_desenho_metalfisa: r.b1_xcoddes || '',
                revisao: r.b1_xrevm
            });
        }

        // 3. Consulta app_wabtec_estruturas (MySQL) para ver se já foi associado nesta sessão/estrutura
        const [myRows] = await db.query(`
            SELECT protheus_cod, protheus_desc, protheus_rev, rev_convertida, rev_cliente_raw, titulo
            FROM app_wabtec_estruturas
            WHERE (
                TRIM(desenho_cliente) = ?
                OR REPLACE(TRIM(desenho_cliente), ' ', '') = ?
            )
            AND protheus_cod IS NOT NULL AND TRIM(protheus_cod) != ''
            ORDER BY id DESC
            LIMIT 1
        `, [desenhoTrim, desenhoNoSpaces]);

        if (myRows && myRows.length > 0) {
            const r = myRows[0];
            return res.json({
                existe: true,
                origem: 'estrutura_wabtec',
                tabela: 'Mapeamento Local da Estrutura WabTec',
                codigo_protheus: r.protheus_cod.trim(),
                revisao_cliente: r.rev_convertida || r.rev_cliente_raw || '',
                descricao: r.protheus_desc || r.titulo || '',
                grupo: (r.protheus_cod.match(/^[A-Z0-9]+/i) || [''])[0],
                tipo: 'PI',
                um: 'PC',
                ncm: '00000000'
            });
        }

        // 4. Não existe no Protheus
        return res.json({
            existe: false,
            desenho: desenhoTrim,
            mensagem: 'Desenho não encontrado no Protheus (SB1010 / SZ1010)'
        });

    } catch (err) {
        console.error('[Wabtec Consultar Desenho] Erro:', err.message);
        res.status(500).json({ error: 'Erro ao consultar desenho no Protheus: ' + err.message });
    }
});

// =========================================================================
// 7.3 ROTA: Vincular Produto Existente do Protheus na Estrutura WabTec
// =========================================================================
router.post('/vincular-produto-existente', async (req, res) => {
    try {
        const { 
            desenho_cliente, 
            codigo_protheus, 
            revisao_cliente, 
            titulo,
            cliente_codigo,
            cliente_loja,
            cliente_nome,
            is_sinco
        } = req.body;

        if (!desenho_cliente || !codigo_protheus) {
            return res.status(400).json({ error: 'Desenho/Código do Cliente e Código Protheus são obrigatórios.' });
        }

        const codDesenho = String(desenho_cliente).replace(/\s+/g, ' ').trim().toUpperCase();
        const codProtheus = String(codigo_protheus).replace(/\s+/g, '').trim().toUpperCase();
        const rev = String(revisao_cliente || '00').replace(/\s+/g, '').trim().toUpperCase().slice(0, 4);

        // Buscar dados complementares (UM, Tipo, Descrição) no Protheus SB1010
        let protheusUm = null;
        let protheusTipo = null;
        let descSb1 = null;
        try {
            const { rows: sb1Rows } = await pgDb.query(`
                SELECT TRIM(b1_desc) as b1_desc, TRIM(b1_um) as b1_um, TRIM(b1_tipo) as b1_tipo
                FROM public.sb1010
                WHERE TRIM(b1_cod) = $1 AND COALESCE(d_e_l_e_t_, '') <> '*'
                LIMIT 1
            `, [codProtheus]);
            if (sb1Rows && sb1Rows.length > 0) {
                protheusUm = sb1Rows[0].b1_um;
                protheusTipo = sb1Rows[0].b1_tipo;
                descSb1 = sb1Rows[0].b1_desc;
            }
        } catch (pgErr) {
            console.warn('[Wabtec Vincular Existente] Aviso ao consultar SB1010:', pgErr.message);
        }

        // 1. Atualizar ocorrências em app_wabtec_estruturas (MySQL)
        let linhasAtualizadas = 0;
        try {
            const [updateResult] = await db.query(`
                UPDATE app_wabtec_estruturas
                SET 
                    protheus_cod = ?,
                    protheus_desc = COALESCE(?, ?, protheus_desc),
                    protheus_rev = COALESCE(?, protheus_rev),
                    uom = COALESCE(?, uom),
                    protheus_tipo = COALESCE(?, protheus_tipo),
                    status_mapeamento = 'MAPEADO',
                    status_detalhe = 'Vinculado ao produto existente no Protheus'
                WHERE TRIM(desenho_cliente) = ?
                   OR REPLACE(TRIM(desenho_cliente), ' ', '') = ?
            `, [
                codProtheus, 
                titulo ? String(titulo).replace(/\s+/g, ' ').trim().toUpperCase() : null, 
                descSb1,
                rev || null,
                protheusUm,
                protheusTipo,
                codDesenho,
                codDesenho.replace(/\s+/g, '')
            ]);
            linhasAtualizadas = updateResult.affectedRows || 0;
        } catch (mErr) {
            console.warn('[Wabtec Vincular Existente] Aviso ao atualizar MySQL:', mErr.message);
        }

        // 2. Amarração oficial na tabela SZ1010 (Produto MetalFisa x Cliente) no Protheus
        const codCliFinal = String(cliente_codigo || (is_sinco ? "" : "00000739")).trim();
        const lojaCliFinal = String(cliente_loja || "0001").trim();
        let sz1Status = 'Nenhum cliente informado para vínculo SZ1010';

        if (codCliFinal) {
            try {
                const accessToken = await getProtheusToken();
                if (accessToken) {
                    let sz1Recno = null;
                    try {
                        const { rows: sz1Rows } = await pgDb.query(`
                            SELECT r_e_c_n_o_ 
                            FROM public.sz1010 
                            WHERE TRIM(z1_cliente) = $1 
                              AND TRIM(z1_loja) = $2 
                              AND TRIM(z1_produto) = $3 
                              AND COALESCE(d_e_l_e_t_, '') <> '*'
                            LIMIT 1
                        `, [codCliFinal, lojaCliFinal, codProtheus]);
                        if (sz1Rows && sz1Rows.length > 0) {
                            sz1Recno = Number(sz1Rows[0].r_e_c_n_o_);
                        }
                    } catch (pgSz1Err) {
                        console.warn('[Wabtec Vincular Existente] Aviso ao checar SZ1010:', pgSz1Err.message);
                    }

                    const descFinal = String(titulo || descSb1 || cliente_nome || 'PRODUTO').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 30);
                    const itemSZ1 = {
                        Z1_CLIENTE: codCliFinal,
                        Z1_LOJA: lojaCliFinal || "0001",
                        Z1_PRODUTO: codProtheus,
                        Z1_CODCLI: codDesenho,
                        Z1_DESCCLI: descFinal,
                        Z1_REVISAO: rev || '00'
                    };
                    if (sz1Recno) {
                        itemSZ1.RECNO = sz1Recno;
                    }

                    const payloadSZ1 = {
                        data: {
                            EMPRESA: "01",
                            CFILANT: "0101",
                            NOPER: sz1Recno ? 4 : 3,
                            produtos_clientes: [itemSZ1]
                        }
                    };

                    const sz1Res = await axios.post('https://192.168.1.60:47500/produto-cliente/editar', payloadSZ1, {
                        headers: { 'Authorization': `Bearer ${accessToken}` },
                        httpsAgent,
                        timeout: 35000
                    });
                    console.log(`[Wabtec Vincular Existente] ✅ Amarração SZ1010 vinculada (NOPER: ${sz1Recno ? 4 : 3}):`, sz1Res.data);
                    sz1Status = 'Vínculo SZ1010 gravado com sucesso';
                }
            } catch (sz1Err) {
                console.error('[Wabtec Vincular Existente] Erro ao vincular SZ1010 via API Protheus:', sz1Err.response?.data || sz1Err.message);
                sz1Status = 'Aviso: Erro ao vincular na SZ1010: ' + (sz1Err.response?.data?.message || sz1Err.message);
            }
        }

        res.json({
            success: true,
            codigo: codProtheus,
            desenho_cliente: codDesenho,
            revisao: rev,
            cliente_codigo: codCliFinal,
            cliente_loja: lojaCliFinal,
            cliente_nome: cliente_nome || '',
            uom: protheusUm,
            protheus_tipo: protheusTipo,
            descricao: titulo || descSb1 || '',
            linhas_atualizadas: linhasAtualizadas,
            sz1_status: sz1Status,
            mensagem: `Código ${codProtheus} vinculado com sucesso ao cliente/desenho ${codDesenho}.`
        });
    } catch (err) {
        console.error('[Wabtec Vincular Existente] Erro:', err.message);
        res.status(500).json({ error: 'Erro ao vincular produto existente: ' + err.message });
    }
});

// =========================================================================
// 8. ROTA: Criar Produto no Protheus e Vincular Desenho WabTec
// =========================================================================
router.post('/criar-produto-protheus', async (req, res) => {
    try {
        const {
            desenho_cliente,
            revisao_cliente,
            titulo,
            grupo,
            tipo,
            um,
            ncm,
            posipi,
            peso,
            comprimento,
            largura,
            espessura,
            volume,
            area,
            cliente_codigo,
            cliente_loja,
            is_sinco,
            b1_xcode,
            b1_xcoddes
        } = req.body;

        // Regra do Usuário:
        // - Se for Solid Edge (is_sinco): o usuário pode selecionar o cliente e informar o código do cliente / desenho livremente.
        //   Caso o usuário deixe em branco, padroniza como 'Novo Cadastro Pelo SINCO'.
        // - Se for WabTec (!is_sinco): fluxo exclusivo e blindado que usa estritamente o desenho_cliente da planilha WabTec.
        let codDesenhoBruto = '';
        if (is_sinco) {
            const rawDes = (desenho_cliente || b1_xcoddes || b1_xcode || '').trim();
            codDesenhoBruto = (!rawDes || rawDes === 'NOVO_DESENHO' || rawDes === 'Novo Cadastro Pelo SINCO')
                ? 'Novo Cadastro Pelo SINCO'
                : rawDes;
        } else {
            codDesenhoBruto = (desenho_cliente || b1_xcoddes || b1_xcode || 'Novo Cadastro Pelo SINCO').trim();
        }

        if (!codDesenhoBruto || !titulo || !grupo || !tipo || !um) {
            return res.status(400).json({ error: 'Identificador do produto/desenho, Título, Grupo, Tipo e UM são campos obrigatórios.' });
        }

        // 1. Obter Token OAuth2 da API Protheus (com cache em memória e timeout de 35s)
        let accessToken = '';
        try {
            accessToken = await getProtheusToken();
        } catch (authError) {
            console.error('[Wabtec Criar Produto] Erro Token:', authError.response?.data || authError.message);
            return res.status(500).json({ error: 'Falha de comunicação com a API Protheus (Token): ' + (authError.response?.data?.message || authError.message) });
        }

        if (!accessToken) {
            return res.status(500).json({ error: 'Token JWT retornado pelo Protheus estava em branco.' });
        }

        // 2. Limpeza e Higienização de Strings no padrão do Protheus
        const grupoLimpo = String(grupo || '').split(/[\-\s]/)[0].trim().toUpperCase();
        const tipoLimpo = String(tipo || '').split(/[\-\s]/)[0].trim().toUpperCase();
        const umLimpa = String(um || '').split(/[\-\s]/)[0].trim().toUpperCase();
        const tituloLimpo = String(titulo || '').replace(/\s+/g, ' ').trim().toUpperCase();
        const descCurtada = tituloLimpo.replace(/"/g, '\\"').replace(/\r\n/g, ' ').replace(/\n/g, ' ').slice(0, 30).trim();
        const codDesHigienizado = codDesenhoBruto === 'Novo Cadastro Pelo SINCO'
            ? 'Novo Cadastro Pelo SINCO'
            : String(codDesenhoBruto).replace(/\s+/g, ' ').trim().toUpperCase();
        
        // B1_XREVM = número da revisão do cliente (2 caracteres, sem espaços)
        const revWabtec = String(revisao_cliente || '00').replace(/\s+/g, '').trim().toUpperCase().slice(0, 2).padStart(2, '0');

        // B1_POSIPI = NCM (padrão '00000000', 8 a 10 caracteres, sem espaços ou pontuação)
        const ncmLimpo = String(ncm || posipi || '00000000').replace(/\D/g, '').slice(0, 10).padEnd(8, '0');
        const numPeso = parseFloat(String(peso || 0).replace(',', '.').trim()) || 0;
        const numComprimento = parseFloat(String(comprimento || 0).replace(',', '.').trim()) || 0;
        const numLargura = parseFloat(String(largura || 0).replace(',', '.').trim()) || 0;
        const numEspessura = parseFloat(String(espessura || 0).replace(',', '.').trim()) || 0;
        const numVolume = parseFloat(String(volume || area || 0).replace(',', '.').trim()) || 0;

        // 3. Determinar o próximo código sequencial diretamente no backend para a API Protheus
        let novoCodigo = '';
        try {
            const pgRes = await pgDb.query(`
                SELECT b1_cod, r_e_c_n_o_
                FROM public.sb1010
                WHERE (b1_grupo = $1 OR b1_cod LIKE $2) AND COALESCE(d_e_l_e_t_, '') = ''
                ORDER BY r_e_c_n_o_ DESC
                LIMIT 30
            `, [grupoLimpo.padEnd(4, ' '), `${grupoLimpo}-%`]);

            let maiorNum = 0;
            const regex = new RegExp(`^${grupoLimpo}-(\\d+)$`, 'i');
            for (const row of pgRes.rows) {
                const codTrim = (row.b1_cod || '').trim();
                const match = codTrim.match(regex);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && (num < 9900 || num > 11000)) {
                        if (num > maiorNum) maiorNum = num;
                    }
                }
            }
            const proximoNum = maiorNum > 0 ? maiorNum + 1 : 1;
            novoCodigo = `${grupoLimpo}-${proximoNum}`;
        } catch (seqErr) {
            console.warn('[Wabtec Criar Produto] Erro ao calcular sequencial:', seqErr.message);
        }

        if (!novoCodigo) {
            return res.status(500).json({ error: `Não foi possível calcular o próximo código para o grupo ${grupoLimpo}.` });
        }

        console.log(`[Wabtec Criar Produto] Próximo código oficial calculado pelo backend: ${novoCodigo}`);

        // 4. Montagem do Payload estritamente idêntico a /engenharia/sinco/formulario (frmCadProtheusProd.vb / /produtos/create)
        const payloadCreate = {
            data: {
                produtos: [
                    {
                        EMPRESA: "01",
                        CFILANT: "01",
                        B1_COD: novoCodigo,
                        B1_GRUPO: grupoLimpo,
                        B1_DESC: descCurtada,
                        B1_XREVM: revWabtec,
                        B1_TIPO: tipoLimpo,
                        B1_UM: umLimpa,
                        B1_LOCPAD: "03",
                        B1_POSIPI: ncmLimpo,
                        B1_FINALID: "1",
                        B1_ORIGEM: "0",
                        B1_XCODDES: codDesHigienizado,
                        B1_PESO: numPeso,
                        B1_PESBRU: numPeso,
                        B5_CEME: descCurtada,
                        B5_COMPR: numComprimento,
                        B5_LARG: numLargura,
                        B5_ESPESS: numEspessura,
                        B5_VOLUME: numVolume
                    }
                ]
            }
        };

        console.log('[Wabtec Criar Produto] Submetendo inclusão padrão ao Protheus:', JSON.stringify(payloadCreate, null, 2));

        let createRes;
        try {
            createRes = await axios.post('https://192.168.1.60:47500/produtos/create', payloadCreate, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                httpsAgent,
                timeout: 35000
            });
        } catch (createErr) {
            if (createErr.response?.status === 401) {
                console.warn('[Wabtec Criar Produto] Token 401 detectado, forçando renovação e reenviando...');
                accessToken = await getProtheusToken(true);
                createRes = await axios.post('https://192.168.1.60:47500/produtos/create', payloadCreate, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    httpsAgent,
                    timeout: 35000
                });
            } else {
                throw createErr;
            }
        }

        const responseData = createRes.data;
        console.log('[Wabtec Criar Produto] Resposta Protheus create:', JSON.stringify(responseData));

        // Se o Protheus retornou erro de criação
        if (responseData.status === 'partial' || (Array.isArray(responseData.message) && responseData.message[0]?.startsWith('ERRO:'))) {
            return res.status(422).json({
                success: false,
                error: `O servidor Protheus TLPP (192.168.1.60:47500) recusou a criação: ${responseData.message?.join(' | ')}`,
                details: responseData
            });
        }

        // Captura do código oficial retornado ou confirmado pelo Protheus
        const matchCode = responseData.message?.[0]?.match(/\{([^}]+)\}/);
        const codigoGerado = (matchCode ? matchCode[1] : novoCodigo).trim();

        console.log(`[Wabtec Criar Produto] ✅ Código oficial purinho retornado pelo Protheus: ${codigoGerado}`);

        // 5. Amarração na SZ1010 (Produto x Cliente / Desenho Cliente)
        const codCliFinal = String(cliente_codigo || (is_sinco ? "" : "00000739")).trim();
        const lojaCliFinal = String(cliente_loja || "0001").trim();
        let sz1Criado = false;
        
        if (codCliFinal) {
            let sz1Recno = null;
            try {
                const { rows: sz1Rows } = await pgDb.query(`
                    SELECT r_e_c_n_o_ 
                    FROM public.sz1010 
                    WHERE TRIM(z1_cliente) = $1 
                      AND TRIM(z1_loja) = $2 
                      AND TRIM(z1_produto) = $3 
                      AND COALESCE(d_e_l_e_t_, '') <> '*'
                    LIMIT 1
                `, [codCliFinal, lojaCliFinal, codigoGerado]);
                if (sz1Rows && sz1Rows.length > 0) {
                    sz1Recno = Number(sz1Rows[0].r_e_c_n_o_);
                }
            } catch (pgSz1Err) {
                console.warn('[Wabtec Criar Produto] Aviso ao checar SZ1010:', pgSz1Err.message);
            }

            const itemSZ1 = {
                Z1_CLIENTE: codCliFinal,
                Z1_LOJA: lojaCliFinal || "0001",
                Z1_PRODUTO: codigoGerado,
                Z1_CODCLI: codDesHigienizado,
                Z1_DESCCLI: descCurtada || req.body.cliente_nome || 'PRODUTO',
                Z1_REVISAO: revWabtec
            };
            if (sz1Recno) {
                itemSZ1.RECNO = sz1Recno;
            }

            const payloadSZ1 = {
                data: {
                    EMPRESA: "01",
                    CFILANT: "0101",
                    NOPER: sz1Recno ? 4 : 3,
                    produtos_clientes: [itemSZ1]
                }
            };

            try {
                const sz1Res = await axios.post('https://192.168.1.60:47500/produto-cliente/editar', payloadSZ1, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    httpsAgent,
                    timeout: 35000
                });
                console.log(`[Wabtec Criar Produto] ✅ Amarração SZ1010 concluída (NOPER: ${sz1Recno ? 4 : 3}):`, sz1Res.data);
                sz1Criado = true;
            } catch (sz1Err) {
                console.error('[Wabtec Criar Produto] Erro ao vincular SZ1010 via API Protheus:', sz1Err.response?.data || sz1Err.message);
            }
        }

        // 6. Atualizar TODAS as ocorrências de desenho_cliente no MySQL (app_wabtec_estruturas)
        // Regra do Usuário: Somente executa a amarração de lote na tabela da WabTec se for fluxo WabTec ou se o cliente for WabTec.
        let linhasAtualizadas = 0;
        if (!is_sinco || codCliFinal === '00000739') {
            try {
                const [updateResult] = await db.query(`
                    UPDATE app_wabtec_estruturas
                    SET protheus_cod = ?,
                        protheus_desc = ?,
                        protheus_rev = ?,
                        uom = ?,
                        protheus_tipo = ?,
                        cadastro_novo = 1,
                        status_mapeamento = 'ENCONTRADO',
                        status_detalhe = 'Item cadastrado e vinculado no Protheus via SINCO'
                    WHERE desenho_cliente = ?
                `, [codigoGerado, descCurtada, revWabtec, umLimpa, tipoLimpo, codDesHigienizado]);
                linhasAtualizadas = updateResult.affectedRows || 0;
                console.log(`[Wabtec Criar Produto] ✅ ${linhasAtualizadas} linha(s) em app_wabtec_estruturas atualizada(s) para ${codDesHigienizado} -> ${codigoGerado} (cadastro_novo = 1)`);
            } catch (mysqlErr) {
                console.warn('[Wabtec Criar Produto] Aviso ao atualizar MySQL app_wabtec_estruturas:', mysqlErr.message);
            }
        }

        // 7. Retorno do número purinho para a aplicação
        res.json({
            success: true,
            codigo: codigoGerado,
            revisao: revWabtec,
            descricao: descCurtada,
            desenho_cliente: codDesHigienizado,
            cliente_codigo: codCliFinal,
            cliente_loja: lojaCliFinal,
            cliente_nome: req.body.cliente_nome || '',
            sz1_criado: sz1Criado,
            uom: umLimpa,
            protheus_tipo: tipoLimpo,
            grupo: grupoLimpo,
            peso: numPeso,
            comprimento: numComprimento,
            largura: numLargura,
            espessura: numEspessura,
            volume: numVolume,
            cadastro_novo: 1,
            linhas_atualizadas: linhasAtualizadas,
            message: `Produto ${codigoGerado} gerado com sucesso pelo Protheus!`,
            raw: responseData
        });

    } catch (err) {
        console.error('[Wabtec Criar Produto] Erro geral:', err.response?.data || err.message);
        res.status(500).json({ 
            error: 'Erro ao processar criação e vinculação do produto no Protheus: ' + (err.response?.data?.message || err.message) 
        });
    }
});

/**
 * Alternar ou definir status de 'NOVO' na estrutura WabTec
 * POST /api/wabtec/toggle-novo
 */
router.post('/toggle-novo', async (req, res) => {
    try {
        const { id, desenho_cliente, cadastro_novo } = req.body;

        if (!id && !desenho_cliente) {
            return res.status(400).json({ error: 'Parâmetro id ou desenho_cliente é obrigatório.' });
        }

        const novoValor = (cadastro_novo === 1 || cadastro_novo === true || cadastro_novo === '1') ? 1 : 0;

        let query = 'UPDATE app_wabtec_estruturas SET cadastro_novo = ? WHERE ';
        let params = [novoValor];

        if (desenho_cliente && id) {
            query += '(desenho_cliente = ? OR id = ?)';
            params.push(desenho_cliente, id);
        } else if (desenho_cliente) {
            query += 'desenho_cliente = ?';
            params.push(desenho_cliente);
        } else {
            query += 'id = ?';
            params.push(id);
        }

        const [result] = await db.query(query, params);
        console.log(`[Wabtec] 🔄 Status NOVO alterado para ${novoValor} em ${desenho_cliente || 'ID ' + id} (${result.affectedRows} linhas)`);

        res.json({
            success: true,
            cadastro_novo: novoValor,
            message: novoValor === 1 ? 'Item marcado como NOVO.' : 'Status NOVO desmarcado.',
            affectedRows: result.affectedRows
        });
    } catch (err) {
        console.error('[Wabtec Toggle Novo] Erro:', err);
        res.status(500).json({ error: 'Erro ao alterar status de novo: ' + err.message });
    }
});

/**
 * Desmarcar item como 'NOVO' na estrutura WabTec
 * POST /api/wabtec/desmarcar-novo
 */
router.post('/desmarcar-novo', async (req, res) => {
    try {
        const { id, desenho_cliente } = req.body;

        if (!id && !desenho_cliente) {
            return res.status(400).json({ error: 'Parâmetro id ou desenho_cliente é obrigatório.' });
        }

        let query = 'UPDATE app_wabtec_estruturas SET cadastro_novo = 0 WHERE ';
        let params = [];

        if (desenho_cliente && id) {
            query += '(desenho_cliente = ? OR id = ?)';
            params = [desenho_cliente, id];
        } else if (desenho_cliente) {
            query += 'desenho_cliente = ?';
            params = [desenho_cliente];
        } else {
            query += 'id = ?';
            params = [id];
        }

        const [result] = await db.query(query, params);
        console.log(`[Wabtec] 🔄 Desmarcado status NOVO para ${desenho_cliente || 'ID ' + id} (${result.affectedRows} linhas)`);

        res.json({
            success: true,
            message: 'Status NOVO desmarcado com sucesso.',
            affectedRows: result.affectedRows
        });
    } catch (err) {
        console.error('[Wabtec Desmarcar Novo] Erro:', err);
        res.status(500).json({ error: 'Erro ao desmarcar status de novo: ' + err.message });
    }
});

// =========================================================================
// ROTA: Exportar Estrutura Completa WabTec em Excel Padrão MetalFisa
// GET /api/wabtec/exportar-excel
// =========================================================================
router.get('/exportar-excel', async (req, res) => {
    try {
        const { lote_id } = req.query;
        if (!req.user && req.query.token) {
            try {
                const jwt = require('jsonwebtoken');
                req.user = jwt.verify(req.query.token, process.env.JWT_SECRET || 'metalfisa_secret_key_2025');
            } catch(e) {}
        }

        let loteInfo = {
            lote_id: lote_id || 'Geral',
            nome_arquivo: 'Estrutura_Wabtec',
            nome_aba: 'Geral',
            criado_por: req.user ? req.user.nome : 'Sistema',
            data_criacao: new Date()
        };

        if (lote_id) {
            const [loteRows] = await db.query('SELECT * FROM app_wabtec_lotes WHERE lote_id = ?', [lote_id]);
            if (loteRows && loteRows.length > 0) {
                loteInfo = loteRows[0];
            }
        } else {
            const [latestLotes] = await db.query('SELECT * FROM app_wabtec_lotes ORDER BY lote_id DESC LIMIT 1');
            if (latestLotes && latestLotes.length > 0) {
                loteInfo = latestLotes[0];
            }
        }

        // Busca todos os itens da estrutura com contagem de documentos
        let query = `
            SELECT e.*,
                   (SELECT COUNT(*) 
                      FROM produtos_docs pd 
                     WHERE (pd.produto_codigo = e.protheus_cod AND e.protheus_cod IS NOT NULL AND e.protheus_cod != '')
                        OR (pd.produto_codigo = e.desenho_cliente AND e.desenho_cliente IS NOT NULL AND e.desenho_cliente != '')) AS total_docs
            FROM app_wabtec_estruturas e
        `;
        const params = [];
        const targetLoteId = lote_id || (loteInfo.lote_id !== 'Geral' ? loteInfo.lote_id : null);
        if (targetLoteId) {
            query += ' WHERE e.lote_id = ?';
            params.push(targetLoteId);
        }
        query += ' ORDER BY e.id ASC';

        const [rows] = await db.query(query, params);

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum registro encontrado para exportar.' });
        }

        // Criar Workbook ExcelJS no padrão institucional MetalFisa
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MetalFisa Industrial';
        workbook.lastModifiedBy = req.user ? req.user.nome : 'Sistema MetalFisa';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Cores padrão MetalFisa
        const NAVY   = 'FF1E3A5F'; // Azul corporativo MetalFisa
        const WHITE  = 'FFFFFFFF';
        const GRAY   = 'FFF8FAFC'; // Linhas zebradas
        const BORDER_COLOR = 'FFCBD5E1'; // Slate 300
        const DARK_TEXT = 'FF0F172A';

        // 1. ABA PRINCIPAL: "Estrutura MetalFisa"
        const sheet = workbook.addWorksheet('Estrutura WabTec MetalFisa', {
            views: [{ showGridLines: true, state: 'frozen', ySplit: 6 }]
        });

        const dataImportacaoStr = loteInfo.data_criacao 
            ? new Date(loteInfo.data_criacao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
            : '-';
        const dataEmissaoStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        // Totalizadores para os cards do cabeçalho
        const totalItens = rows.length;
        const totalMapeados = rows.filter(r => r.status_mapeamento === 'ENCONTRADO' || r.revisao_igual == 1).length;
        const totalNovos = rows.filter(r => r.cadastro_novo == 1).length;
        const totalDivergentes = rows.filter(r => r.status_mapeamento === 'DIFERENCA_REVISAO').length;
        const totalNaoCadastrados = rows.filter(r => r.status_mapeamento === 'NAO_ENCONTRADO').length;

        // LINHA 1: BANNER PRINCIPAL METALFISA
        sheet.mergeCells('A1:R1');
        const cellA1 = sheet.getCell('A1');
        cellA1.value = 'METALFISA INDUSTRIAL — RELATÓRIO ESTRUTURA DE PRODUTOS WABTEC';
        cellA1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: WHITE } };
        cellA1.alignment = { horizontal: 'center', vertical: 'middle' };
        cellA1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        sheet.getRow(1).height = 32;

        // LINHA 2: METADADOS DO ARQUIVO / LOTE
        sheet.mergeCells('A2:C2');
        sheet.getCell('A2').value = `Arquivo: ${loteInfo.nome_arquivo || '-'}`;
        sheet.getCell('A2').font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: DARK_TEXT } };
        sheet.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

        sheet.mergeCells('D2:F2');
        sheet.getCell('D2').value = `Aba Importada: ${loteInfo.nome_aba || '-'}`;
        sheet.getCell('D2').font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: DARK_TEXT } };
        sheet.getCell('D2').alignment = { horizontal: 'left', vertical: 'middle' };

        sheet.mergeCells('G2:I2');
        sheet.getCell('G2').value = `Data de Leitura: ${dataImportacaoStr}`;
        sheet.getCell('G2').font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
        sheet.getCell('G2').alignment = { horizontal: 'left', vertical: 'middle' };

        sheet.mergeCells('J2:L2');
        sheet.getCell('J2').value = `Importado por: ${loteInfo.criado_por || 'Sistema'}`;
        sheet.getCell('J2').font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
        sheet.getCell('J2').alignment = { horizontal: 'left', vertical: 'middle' };

        sheet.mergeCells('M2:P2');
        sheet.getCell('M2').value = `Emissão Relatório: ${dataEmissaoStr}`;
        sheet.getCell('M2').font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
        sheet.getCell('M2').alignment = { horizontal: 'left', vertical: 'middle' };

        sheet.mergeCells('Q2:R2');
        sheet.getCell('Q2').value = `Lote ID: #${loteInfo.lote_id || '-'}`;
        sheet.getCell('Q2').font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: NAVY } };
        sheet.getCell('Q2').alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(2).height = 20;

        // LINHA 3 e 4: CARDS DE RESUMO (KPIs)
        sheet.mergeCells('A3:C4');
        const kpi1 = sheet.getCell('A3');
        kpi1.value = `TOTAL DE ITENS\n${totalItens}`;
        kpi1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: NAVY } };
        kpi1.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        kpi1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

        sheet.mergeCells('D3:F4');
        const kpi2 = sheet.getCell('D3');
        kpi2.value = `MAPEADOS NO PROTHEUS\n${totalMapeados}`;
        kpi2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } };
        kpi2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        kpi2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };

        sheet.mergeCells('G3:I4');
        const kpi3 = sheet.getCell('G3');
        kpi3.value = `NOVOS CADASTROS\n${totalNovos}`;
        kpi3.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF854D0E' } };
        kpi3.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        kpi3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };

        sheet.mergeCells('J3:L4');
        const kpi4 = sheet.getCell('J3');
        kpi4.value = `DIVERGÊNCIA REVISÃO\n${totalDivergentes}`;
        kpi4.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF9A3412' } };
        kpi4.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        kpi4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };

        sheet.mergeCells('M3:O4');
        const kpi5 = sheet.getCell('M3');
        kpi5.value = `NÃO CADASTRADOS\n${totalNaoCadastrados}`;
        kpi5.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } };
        kpi5.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        kpi5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };

        sheet.mergeCells('P3:R4');
        const kpi6 = sheet.getCell('P3');
        kpi6.value = `SISTEMA METALFISA\nGestão Integrada PCP`;
        kpi6.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
        kpi6.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        kpi6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

        sheet.getRow(3).height = 18;
        sheet.getRow(4).height = 18;

        // LINHA 5: Separador em branco
        sheet.getRow(5).height = 8;

        // LINHA 6: CABEÇALHO DAS COLUNAS
        const colDefinitions = [
            { header: 'Nível', key: 'nivel', width: 9, align: 'center' },
            { header: 'Posição (Find)', key: 'find_no', width: 14, align: 'center' },
            { header: 'Cód. WabTec (Desenho)', key: 'desenho_cliente', width: 25, align: 'left' },
            { header: 'Rev. WabTec (Orig)', key: 'rev_cliente_raw', width: 16, align: 'center' },
            { header: 'Rev. Convertida', key: 'rev_convertida', width: 16, align: 'center' },
            { header: 'Número MetalFisa', key: 'protheus_cod', width: 18, align: 'center' },
            { header: 'Rev. MetalFisa', key: 'protheus_rev', width: 15, align: 'center' },
            { header: 'Cadastro', key: 'cadastro_status', width: 14, align: 'center' },
            { header: 'UNID', key: 'uom', width: 10, align: 'center' },
            { header: 'TIPO', key: 'protheus_tipo', width: 10, align: 'center' },
            { header: 'Descrição MetalFisa', key: 'protheus_desc', width: 35, align: 'left' },
            { header: 'Descrição WabTec', key: 'titulo', width: 35, align: 'left' },
            { header: 'Qtd Unit', key: 'qtd', width: 12, align: 'right', numFmt: '#,##0.00' },
            { header: 'Qtd Total', key: 'qtd_total', width: 14, align: 'right', numFmt: '#,##0.00' },
            { header: 'Item Pai', key: 'item_pai', width: 22, align: 'left' },
            { header: 'Conferência Revisão', key: 'status_conferencia', width: 25, align: 'center' },
            { header: 'Detalhes Mapeamento', key: 'status_detalhe', width: 35, align: 'left' },
            { header: 'Docs (PDF)', key: 'docs_status', width: 14, align: 'center' }
        ];

        colDefinitions.forEach((col, idx) => {
            sheet.getColumn(idx + 1).width = col.width;
        });

        const headerRow = sheet.getRow(6);
        headerRow.height = 25;

        colDefinitions.forEach((col, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = col.header;
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF475569' } },
                left: { style: 'thin', color: { argb: 'FF475569' } },
                bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                right: { style: 'thin', color: { argb: 'FF475569' } }
            };
        });

        // INSERÇÃO DAS LINHAS DE DADOS
        let currentRowIdx = 7;
        for (const r of rows) {
            const row = sheet.getRow(currentRowIdx);
            row.height = 20;

            const isMesmaRev = r.status_mapeamento === 'ENCONTRADO' || r.revisao_igual == 1;
            const isDivergente = r.status_mapeamento === 'DIFERENCA_REVISAO';
            const isNaoCadastrado = r.status_mapeamento === 'NAO_ENCONTRADO';

            let confStr = 'Pendente';
            if (isMesmaRev) confStr = `Mesma Revisão (${r.protheus_rev || r.rev_convertida})`;
            else if (isDivergente) confStr = `Divergente (Cli ${r.rev_cliente_raw} ≠ Metal ${r.protheus_rev})`;
            else if (isNaoCadastrado) confStr = 'Não Cadastrado no Protheus';

            const bg = (currentRowIdx % 2 === 0) ? GRAY : WHITE;

            const rowData = {
                nivel: r.nivel !== null && r.nivel !== undefined ? `N${r.nivel}` : '-',
                find_no: r.find_no || '-',
                desenho_cliente: r.desenho_cliente || '-',
                rev_cliente_raw: r.rev_cliente_raw || '-',
                rev_convertida: r.rev_convertida || '-',
                protheus_cod: r.protheus_cod || '-',
                protheus_rev: r.protheus_rev || '-',
                cadastro_status: r.cadastro_novo == 1 ? 'NOVO' : 'EXISTENTE',
                uom: r.uom || '-',
                protheus_tipo: r.protheus_tipo || '-',
                protheus_desc: r.protheus_desc || '-',
                titulo: r.titulo || '-',
                qtd: (r.qtd !== null && r.qtd !== undefined && !isNaN(parseFloat(r.qtd))) ? parseFloat(r.qtd) : '-',
                qtd_total: (r.qtd_total !== null && r.qtd_total !== undefined && !isNaN(parseFloat(r.qtd_total))) ? parseFloat(r.qtd_total) : (r.qtd ? parseFloat(r.qtd) : '-'),
                item_pai: r.item_pai || '-',
                status_conferencia: confStr,
                status_detalhe: r.status_detalhe || '-',
                docs_status: Number(r.total_docs) > 0 ? `${r.total_docs} PDF(s)` : '-'
            };

            colDefinitions.forEach((col, idx) => {
                const cell = row.getCell(idx + 1);
                cell.value = rowData[col.key];
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.alignment = { horizontal: col.align, vertical: 'middle' };
                cell.font = { name: 'Calibri', size: 9.5, color: { argb: DARK_TEXT } };
                cell.border = {
                    top: { style: 'thin', color: { argb: BORDER_COLOR } },
                    left: { style: 'thin', color: { argb: BORDER_COLOR } },
                    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
                    right: { style: 'thin', color: { argb: BORDER_COLOR } }
                };

                // Destaques visuais elegantes:
                if (col.key === 'protheus_cod' && r.protheus_cod) {
                    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF047857' } };
                }
                if (col.key === 'cadastro_status') {
                    if (r.cadastro_novo == 1) {
                        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
                    }
                }
                if (col.key === 'protheus_tipo' && r.protheus_tipo) {
                    cell.font = { name: 'Calibri', size: 9.5, bold: true };
                }
                if (col.key === 'uom' && r.uom) {
                    cell.font = { name: 'Calibri', size: 9.5, bold: true };
                }
                if ((col.key === 'qtd' || col.key === 'qtd_total') && typeof cell.value === 'number') {
                    cell.numFmt = '#,##0.00';
                }
            });

            currentRowIdx++;
        }

        // Habilita AutoFilter cobrindo toda a extensão da tabela (linha 6 até última linha preenchida)
        sheet.autoFilter = {
            from: { row: 6, column: 1 },
            to: { row: currentRowIdx - 1, column: colDefinitions.length }
        };

        // 2. ABA 2: "Resumo Gerencial"
        const sheetResumo = workbook.addWorksheet('Resumo Gerencial');
        sheetResumo.views = [{ showGridLines: true }];

        sheetResumo.mergeCells('A1:D1');
        const rHead = sheetResumo.getCell('A1');
        rHead.value = 'RESUMO CONSOLIDADO POR TIPO DE PRODUTO';
        rHead.font = { name: 'Calibri', size: 12, bold: true, color: { argb: WHITE } };
        rHead.alignment = { horizontal: 'center', vertical: 'middle' };
        rHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        sheetResumo.getRow(1).height = 26;

        [18, 30, 16, 18].forEach((w, i) => {
            sheetResumo.getColumn(i + 1).width = w;
        });

        const rhRow = sheetResumo.getRow(2);
        rhRow.height = 22;
        ['Tipo (B1_TIPO)', 'Descrição do Tipo', 'Qtd de Itens', 'Qtd Total Peças'].forEach((h, i) => {
            const c = rhRow.getCell(i + 1);
            c.value = h;
            c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
            c.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        const tiposMap = {};
        rows.forEach(r => {
            const t = r.protheus_tipo || 'NÃO DEFINIDO';
            if (!tiposMap[t]) {
                let desc = 'Outros';
                if (t === 'PA') desc = 'Produto Acabado';
                else if (t === 'PI') desc = 'Produto Intermediário';
                else if (t === 'MP') desc = 'Matéria Prima';
                else if (t === 'MC') desc = 'Material de Consumo';
                else if (t === 'ME') desc = 'Mercadoria para Revenda';
                else if (t === 'NÃO DEFINIDO') desc = 'Aguardando cadastro Protheus';
                tiposMap[t] = { tipo: t, desc, count: 0, totalPecas: 0 };
            }
            tiposMap[t].count++;
            const q = parseFloat(r.qtd_total || r.qtd || 0);
            if (!isNaN(q)) tiposMap[t].totalPecas += q;
        });

        let rRowIdx = 3;
        Object.values(tiposMap).forEach(item => {
            const r = sheetResumo.getRow(rRowIdx);
            r.height = 20;
            r.getCell(1).value = item.tipo;
            r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            r.getCell(1).font = { name: 'Calibri', size: 10, bold: true };

            r.getCell(2).value = item.desc;
            r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

            r.getCell(3).value = item.count;
            r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
            r.getCell(3).numFmt = '#,##0';

            r.getCell(4).value = item.totalPecas;
            r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
            r.getCell(4).numFmt = '#,##0.00';

            for (let c = 1; c <= 4; c++) {
                r.getCell(c).border = {
                    top: { style: 'thin', color: { argb: BORDER_COLOR } },
                    left: { style: 'thin', color: { argb: BORDER_COLOR } },
                    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
                    right: { style: 'thin', color: { argb: BORDER_COLOR } }
                };
            }
            rRowIdx++;
        });

        const safeFileName = `Estrutura_MetalFisa_Wabtec_Lote_${loteInfo.lote_id || 'Geral'}.xlsx`;
        const tempDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${safeFileName}`);

        await workbook.xlsx.writeFile(tempFilePath);

        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        return res.download(tempFilePath, safeFileName, (err) => {
            try {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            } catch(e) {}
            if (err && !res.headersSent) {
                console.error('[Wabtec Exportar Excel] Erro no res.download:', err);
            }
        });
    } catch (err) {
        console.error('[Wabtec Exportar Excel] Erro:', err);
        res.status(500).json({ error: 'Erro ao gerar arquivo Excel da estrutura: ' + err.message });
    }
});

module.exports = router;

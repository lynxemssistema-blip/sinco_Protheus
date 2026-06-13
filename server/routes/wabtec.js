const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const db = require('../services/mysqlService');

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

        const preview_data = [];

        const idxLevel = headersUpper.indexOf('LEVEL');
        const idxID = headersUpper.indexOf('ID');
        const idxRevision = headersUpper.indexOf('REVISION');
        const idxName = headersUpper.indexOf('NAME');
        const idxQuantity = headersUpper.indexOf('QUANTITY');

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            // Verifica se a linha tem conteudo
            if (!row || row.length === 0 || row.every(val => !val)) continue;
            
            const nivel = row[idxLevel] !== undefined ? String(row[idxLevel]).trim() : '';
            const desenho_cliente = row[idxID] ? String(row[idxID]).trim() : '';
            const rev_cliente_raw = row[idxRevision] ? String(row[idxRevision]).trim() : '';
            const titulo = row[idxName] ? String(row[idxName]).trim() : '';
            const qtd = row[idxQuantity] !== undefined ? String(row[idxQuantity]).trim() : '';

            if (!desenho_cliente && !titulo) continue;
            
            const rev_convertida = convertWabtecRevision(rev_cliente_raw);

            preview_data.push({
                nivel,
                desenho_cliente,
                rev_cliente_raw,
                rev_convertida,
                titulo,
                qtd,
                raw_data: JSON.stringify(row)
            });
        }

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
                loteId, r.nivel, r.desenho_cliente, r.rev_cliente_raw, r.rev_convertida, r.titulo, r.qtd, r.raw_data
            ]);
            await db.query(`
                INSERT INTO app_wabtec_estruturas 
                (lote_id, nivel, desenho_cliente, rev_cliente_raw, rev_convertida, titulo, qtd, raw_data)
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
        let query = `SELECT * FROM app_wabtec_estruturas`;
        const params = [];
        if (lote_id) {
            query += ` WHERE lote_id = ?`;
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
            let status = 'PENDENTE';
            let status_detalhe = '';

            if (item.desenho_cliente) {
                try {
                    const pgQuery = `
                        SELECT TRIM(sb1.b1_cod) as b1_cod, TRIM(sb1.b1_desc) as b1_desc, TRIM(sz1.z1_revisao) as z1_revisao
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
                SET protheus_cod = ?, protheus_desc = ?, protheus_rev = ?, status_mapeamento = ?, status_detalhe = ?
                WHERE id = ?
            `, [protheus_cod, protheus_desc, protheus_rev, status, status_detalhe, item.id]);
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

module.exports = router;

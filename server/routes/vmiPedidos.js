const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const conn = require('../services/mysqlService');
const { authenticateToken } = require('./auth');

const upload = multer({ storage: multer.memoryStorage() });

// === 1. PARSER UPLOAD (Pré-visualização) ===
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    try {
        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = wb.SheetNames.find(n => n.toUpperCase() === 'ORDENS DE COMPRA') || wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];

        const data = XLSX.utils.sheet_to_json(sheet, {
            header: 'A',
            defval: null,
            blankrows: false
        });

        if (data.length < 2) return res.status(400).json({ error: 'Planilha sem dados.' });

        // Identificar linha de cabeçalho
        const startIndex = data.findIndex(row => 
            String(row.A || '').toUpperCase().includes('OC') || 
            String(row.B || '').toUpperCase().includes('ITEM')
        );

        if (startIndex === -1) {
            return res.status(400).json({ error: 'Não foi possível encontrar a linha de cabeçalho com "OC" ou "ITEM".' });
        }

        const rawRecords = data.slice(startIndex + 1);
        const parsed = [];

        rawRecords.forEach((r, idx) => {
            if (!r.A || !r.B || !r.C) return; // Ignora linhas sem OC, Item ou Produto

            const oc = String(r.A).trim();
            const itemOc = String(r.B).trim();
            let produtoCliente = String(r.C).split('\\')[0].trim(); // Pega apenas a primeira parte do código
            let descricaoProduto = r.F ? String(r.F).trim() : null;
            let revCliente = null;

            // Tratamento de Código e Revisão
            // Remove TODOS os não-alfanuméricos (igual ao forecast): 21.23.01762 → 212301762
            const limpo = produtoCliente.replace(/[^a-zA-Z0-9]/g, '');
            let codBase = limpo;

            if (limpo.length > 9) {
                codBase = limpo.substring(0, 9);
                revCliente = limpo.substring(9).replace(/^0+/, ''); // Remove zeros à esquerda
                if (!revCliente) revCliente = '0';
            } else {
                if (r.E !== null && r.E !== undefined) {
                    let revRaw = String(r.E).trim();
                    if (revRaw.length === 1) revRaw = `0${revRaw}`;
                    revCliente = revRaw;
                }
            }

            // Tratamento de Datas (Coluna H como Data, e I como DT_NEG opcional)
            let dataEntrega = null;
            if (r.H) {
                if (typeof r.H === 'number') {
                    const parsedDate = XLSX.SSF.parse_date_code(r.H);
                    if (parsedDate) {
                        dataEntrega = `${parsedDate.y}-${String(parsedDate.m).padStart(2, '0')}-${String(parsedDate.d).padStart(2, '0')}`;
                    }
                } else {
                    dataEntrega = r.H; // Se já vier em string, mantém
                }
            }

            const qtde = parseFloat(r.K) || 0;

            parsed.push({
                ordem_compra: oc,
                item_oc: itemOc,
                codigo_produto_cliente: produtoCliente, // Original
                codigo_base: codBase,
                revisao_cliente: revCliente || '',
                descricao_produto_cliente: descricaoProduto,
                data_entrega: dataEntrega,
                quantidade: qtde
            });
        });

        // Agrupar itens com a mesma OC, Item e Produto (opcional, ou manter linhas separadas)
        // Neste caso, a instrução diz "se o item já estiver sido enviado...".
        // Manter em flat mode.

        res.json({
            msg: `Processadas ${parsed.length} linhas da aba '${sheetName}'.`,
            preview_data: parsed,
            _import_meta: {
                nome_arquivo: req.file.originalname,
                total_linhas: parsed.length
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao processar o arquivo Excel.' });
    }
});

// === 2. GRAVAR LOTE NO BANCO ===
router.post('/save-lote', authenticateToken, async (req, res) => {
    const { records, _import_meta } = req.body;
    if (!records || records.length === 0) return res.status(400).json({ error: 'Nenhum dado para salvar.' });

    let connection;
    try {
        connection = await conn.getConnection();
        await connection.beginTransaction();

        // Garantir tabelas com charset utf8mb4
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_vmi_pedidos_lotes (
                lote_id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT,
                usuario_nome VARCHAR(255),
                nome_arquivo VARCHAR(255),
                total_linhas INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        // Migrar charset se tabela já existia com latin1
        await connection.query(`ALTER TABLE app_vmi_pedidos_lotes
            CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`).catch(() => {});

        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_vmi_pedidos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                lote_id INT,
                ordem_compra VARCHAR(50),
                item_oc VARCHAR(50),
                codigo_produto_cliente VARCHAR(100),
                codigo_base VARCHAR(100),
                revisao_cliente VARCHAR(50),
                descricao_produto_cliente VARCHAR(255),
                data_entrega DATE,
                quantidade DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (lote_id),
                INDEX (codigo_produto_cliente),
                INDEX (ordem_compra)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        await connection.query(`ALTER TABLE app_vmi_pedidos
            CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`).catch(() => {});

        // Inserir lote
        const [loteResult] = await connection.query(`
            INSERT INTO app_vmi_pedidos_lotes (usuario_id, usuario_nome, nome_arquivo, total_linhas)
            VALUES (?, ?, ?, ?)
        `, [
            req.user?.id || null,
            req.user?.nome || 'Sistema',
            _import_meta?.nome_arquivo || 'Upload Manual',
            records.length
        ]);

        const loteId = loteResult.insertId;

        // Inserir registros
        const values = [];
        for (const r of records) {
            const dtEntrega = r.data_entrega ? new Date(r.data_entrega) : null;
            const dtStr = dtEntrega && !isNaN(dtEntrega) ? dtEntrega.toISOString().split('T')[0] : null;

            values.push([
                loteId,
                r.ordem_compra || '',
                r.item_oc || '',
                r.codigo_produto_cliente || '',
                r.codigo_base || '',
                r.revisao_cliente || '',
                r.descricao_produto_cliente || '',
                dtStr,
                r.quantidade || 0
            ]);
        }

        if (values.length > 0) {
            const sql = `
                INSERT INTO app_vmi_pedidos 
                (lote_id, ordem_compra, item_oc, codigo_produto_cliente, codigo_base, revisao_cliente, descricao_produto_cliente, data_entrega, quantidade) 
                VALUES ?
            `;
            await connection.query(sql, [values]);
        }

        await connection.commit();
        res.json({ msg: 'Importação de VMI Pedidos concluída com sucesso!' });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Erro ao salvar lote:', err);
        res.status(500).json({ error: 'Erro ao gravar os dados no banco.' });
    } finally {
        if (connection) connection.release();
    }
});

// === 3. BUSCAR LOTES ===
router.get('/lotes', authenticateToken, async (req, res) => {
    try {
        const [rows] = await conn.query('SELECT * FROM app_vmi_pedidos_lotes ORDER BY created_at DESC');
        res.json({ data: rows });
    } catch (err) {
        // Tabela pode não existir ainda
        if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ data: [] });
        res.status(500).json({ error: 'Erro ao buscar lotes.' });
    }
});

// === 4. DELETAR LOTE ===
router.delete('/lotes/:id', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await conn.getConnection();
        await connection.beginTransaction();
        await connection.query('DELETE FROM app_vmi_pedidos WHERE lote_id = ?', [req.params.id]);
        await connection.query('DELETE FROM app_vmi_pedidos_lotes WHERE lote_id = ?', [req.params.id]);
        await connection.commit();
        res.json({ msg: 'Lote apagado.' });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: 'Erro ao deletar lote.' });
    } finally {
        if (connection) connection.release();
    }
});

// === 5. BUSCAR PEDIDOS (Com JOIN de mapeamento do VMI Forecast se existir) ===
router.get('/', authenticateToken, async (req, res) => {
    const { lote } = req.query;
    try {
        let sql = `
            SELECT p.*,
                   m.b1_cod, m.descricao_protheus
            FROM app_vmi_pedidos p
            LEFT JOIN app_demanda_vmi_map m ON p.codigo_base = m.codigo_produto_cliente
        `;
        const params = [];
        if (lote) {
            sql += ' WHERE p.lote_id = ?';
            params.push(lote);
        }
        sql += ' ORDER BY p.ordem_compra ASC, p.item_oc ASC';
        
        const [rows] = await conn.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ data: [] });
        console.error('Erro ao buscar pedidos VMI:', err);
        res.status(500).json({ error: 'Erro ao buscar pedidos VMI.' });
    }
});

// === 6. LIMPAR TUDO ===
router.delete('/all', authenticateToken, async (req, res) => {
    try {
        await conn.query('TRUNCATE TABLE app_vmi_pedidos');
        await conn.query('TRUNCATE TABLE app_vmi_pedidos_lotes');
        res.json({ msg: 'Todos os pedidos foram apagados.' });
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ msg: 'Tabelas limpas.' });
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;

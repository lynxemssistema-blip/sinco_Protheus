const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { emitHermesAlert } = require('../services/hermes/proactiveCron');

// Alter tables to add reposicao_op column and image/image_caption columns
(async () => {
    try {
        await db.query(`ALTER TABLE app_sgq_rncs ADD COLUMN reposicao_op VARCHAR(50) DEFAULT NULL`);
        console.log('✅ Coluna reposicao_op adicionada à tabela app_sgq_rncs com sucesso (ou já existia).');
    } catch (e) {}

    try {
        await db.query(`ALTER TABLE app_sgq_rncs ADD COLUMN numero_rnc VARCHAR(100) DEFAULT NULL`);
        console.log('✅ Coluna numero_rnc adicionada à tabela app_sgq_rncs.');
    } catch (e) {}


    try {
        await db.query(`ALTER TABLE app_sgq_processos ADD COLUMN image TEXT DEFAULT NULL`);
        console.log('✅ Coluna image adicionada à tabela app_sgq_processos.');
    } catch (e) {}

    try {
        await db.query(`ALTER TABLE app_sgq_processos ADD COLUMN image_caption VARCHAR(255) DEFAULT NULL`);
        console.log('✅ Coluna image_caption adicionada à tabela app_sgq_processos.');
    } catch (e) {}
})();

// Multer storage configuration for help images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/sgq_ajuda');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'ajuda-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Auxiliar: Parse seguro para Strings tipo JSON Text
const safeParse = (data) => {
    try {
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
        return [];
    }
};

// GET /api/sgq/processos
// Lista todos os processos SGQ em árvore plana, tratando os vetores textuais
router.get('/processos', async (req, res) => {
    try {
        const { path } = req.query;
        let query = `
            SELECT p.*, d.content as document_content, d.title as document_title 
            FROM app_sgq_processos p
            LEFT JOIN sgq_documents d ON p.document_id = d.id
        `;
        let params = [];

        if (path) {
            query += ' WHERE p.route_path = ?';
            params.push(path);
        }

        const [rows] = await db.query(query, params);

        const processedRows = rows.map(r => ({
            ...r,
            steps: safeParse(r.steps),
            tips: safeParse(r.tips),
            links: safeParse(r.links),
            responsables: safeParse(r.responsables),
            imageCaption: r.image_caption
        }));

        res.json(processedRows);
    } catch (error) {
        console.warn('⚠️ [SGQ PROCESSOS FALLBACK]:', error.message);
        res.json([]);
    }
});

// POST /api/sgq/processos/upload
// Endpoint de upload para imagens de ajuda de contexto
router.post('/processos/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        const imageUrl = `/uploads/sgq_ajuda/${req.file.filename}`;
        res.json({ url: imageUrl });
    } catch (error) {
        console.error('Erro ao fazer upload da imagem de ajuda:', error);
        res.status(500).json({ error: 'Erro ao processar imagem.' });
    }
});

// PUT /api/sgq/processos/:id
// Atualiza informações contextuais e de diretoria/papel de uma tela
router.put('/processos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, steps, tips, links, responsables, document_id, image, image_caption } = req.body;

        await db.query(`
            UPDATE app_sgq_processos 
            SET title = ?, description = ?, steps = ?, tips = ?, links = ?, responsables = ?, document_id = ?, image = ?, image_caption = ?
            WHERE id = ?
        `, [
            title, 
            description, 
            JSON.stringify(steps || []), 
            JSON.stringify(tips || []), 
            JSON.stringify(links || []), 
            JSON.stringify(responsables || []), 
            document_id || null,
            image || null,
            image_caption || null,
            id
        ]);

        res.json({ message: 'Processo SGQ atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar processo SGQ:', error);
        res.status(500).json({ error: 'Erro interno ao salvar Mapeamento SGQ.' });
    }
});

// GET /api/sgq/cargos-funcoes
router.get('/cargos-funcoes', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM app_sgq_cargos_funcoes ORDER BY denominacao ASC');
        const processedRows = rows.map(r => ({
            ...r,
            atividades: safeParse(r.atividades)
        }));
        res.json(processedRows);
    } catch (error) {
        console.error('Erro ao buscar cargos e funções:', error);
        res.status(500).json({ error: 'Erro interno ao consultar cargos e funções.' });
    }
});

// POST /api/sgq/cargos-funcoes
router.post('/cargos-funcoes', async (req, res) => {
    try {
        const { denominacao, codigo_interno, cbo, atividades, educacao, experiencia, treinamento } = req.body;
        const [result] = await db.query(`
            INSERT INTO app_sgq_cargos_funcoes (denominacao, codigo_interno, cbo, atividades, educacao, experiencia, treinamento)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            denominacao,
            codigo_interno || null,
            cbo || null,
            JSON.stringify(atividades || []),
            educacao || null,
            experiencia || null,
            treinamento || null
        ]);
        res.status(201).json({ message: 'Cargo/Função criado com sucesso.', id: result.insertId });
    } catch (error) {
        console.error('Erro ao criar cargo e função:', error);
        res.status(500).json({ error: 'Erro interno ao salvar novo cargo e função.' });
    }
});

// PUT /api/sgq/cargos-funcoes/:id
router.put('/cargos-funcoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { denominacao, codigo_interno, cbo, atividades, educacao, experiencia, treinamento } = req.body;
        await db.query(`
            UPDATE app_sgq_cargos_funcoes 
            SET denominacao = ?, codigo_interno = ?, cbo = ?, atividades = ?, educacao = ?, experiencia = ?, treinamento = ?
            WHERE id = ?
        `, [
            denominacao,
            codigo_interno || null,
            cbo || null,
            JSON.stringify(atividades || []),
            educacao || null,
            experiencia || null,
            treinamento || null,
            id
        ]);
        res.json({ message: 'Cargo/Função atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar cargo e função:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar cargo e função.' });
    }
});

// DELETE /api/sgq/cargos-funcoes/:id
router.delete('/cargos-funcoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM app_sgq_cargos_funcoes WHERE id = ?', [id]);
        res.json({ message: 'Cargo/Função removido com sucesso!' });
    } catch (error) {
        console.error('Erro ao deletar cargo e função:', error);
        res.status(500).json({ error: 'Erro interno ao deletar cargo e função.' });
    }
});

// GET /api/sgq/nao-conformidades
router.get('/nao-conformidades', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM app_sgq_nao_conformidades ORDER BY criado_em DESC');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar não-conformidades:', error);
        res.status(500).json({ error: 'Erro interno ao consultar não-conformidades.' });
    }
});

// GET /api/sgq/nao-conformidades/:recurso_codigo
router.get('/nao-conformidades/:recurso_codigo', async (req, res) => {
    try {
        const { recurso_codigo } = req.params;
        const [rows] = await db.query(
            'SELECT * FROM app_sgq_nao_conformidades WHERE recurso_codigo = ? ORDER BY criado_em DESC',
            [recurso_codigo]
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar não-conformidades:', error);
        res.status(500).json({ error: 'Erro interno ao consultar não-conformidades.' });
    }
});

// POST /api/sgq/nao-conformidades
router.post('/nao-conformidades', async (req, res) => {
    try {
        const { recurso_codigo, descricao, tipo, gravidade, imagem_correta, imagem_incorreta } = req.body;
        if (!recurso_codigo || !descricao) {
            return res.status(400).json({ error: 'recurso_codigo e descricao são obrigatórios.' });
        }
        const [result] = await db.query(
            'INSERT INTO app_sgq_nao_conformidades (recurso_codigo, descricao, tipo, gravidade, imagem_correta, imagem_incorreta) VALUES (?, ?, ?, ?, ?, ?)',
            [recurso_codigo, descricao, tipo || 'check', gravidade || 'observacao', imagem_correta || null, imagem_incorreta || null]
        );
        res.status(201).json({ message: 'Não-conformidade criada com sucesso.', id: result.insertId });
    } catch (error) {
        console.error('Erro ao criar não-conformidade:', error);
        res.status(500).json({ error: 'Erro interno ao salvar não-conformidade.' });
    }
});

// PUT /api/sgq/nao-conformidades/:id
router.put('/nao-conformidades/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { descricao, tipo, gravidade, imagem_correta, imagem_incorreta } = req.body;
        if (!descricao) {
            return res.status(400).json({ error: 'descricao é obrigatória.' });
        }
        await db.query(
            'UPDATE app_sgq_nao_conformidades SET descricao = ?, tipo = ?, gravidade = ?, imagem_correta = ?, imagem_incorreta = ? WHERE id = ?',
            [descricao, tipo || 'check', gravidade || 'observacao', imagem_correta || null, imagem_incorreta || null, id]
        );
        res.json({ message: 'Não-conformidade atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar não-conformidade:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar não-conformidade.' });
    }
});

// DELETE /api/sgq/nao-conformidades/:id
router.delete('/nao-conformidades/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM app_sgq_nao_conformidades WHERE id = ?', [id]);
        res.json({ message: 'Não-conformidade removida com sucesso!' });
    } catch (error) {
        console.error('Erro ao deletar não-conformidade:', error);
        res.status(500).json({ error: 'Erro interno ao deletar não-conformidade.' });
    }
});
// --- ROTAS DE RNCs (Registro de Não Conformidade) ---

// GET /api/sgq/rncs?op=...&pedido=...
router.get('/rncs', async (req, res) => {
    try {
        const { op, pedido, item_op, sequen_op } = req.query;
        let query = `
            SELECT r.*, nc.descricao as nc_descricao, nc.tipo as nc_tipo, nc.gravidade as nc_gravidade,
                   (SELECT COALESCE(SUM(tempo_minutos), 0) FROM app_sgq_rnc_apontamentos WHERE rnc_id = r.id) as tempo_gasto_total
            FROM app_sgq_rncs r
            LEFT JOIN app_sgq_nao_conformidades nc ON r.nao_conformidade_id = nc.id
            WHERE 1=1
        `;
        const params = [];

        if (op) { query += ' AND r.op = ?'; params.push(op); }
        if (pedido) { query += ' AND r.pedido = ?'; params.push(pedido); }
        if (item_op) { query += ' AND r.item_op = ?'; params.push(item_op); }
        if (sequen_op) { query += ' AND r.sequen_op = ?'; params.push(sequen_op); }

        query += ' ORDER BY r.data_criacao DESC';

        const [results] = await db.query(query, params);
        res.json(results);
    } catch (error) {
        console.error('Erro ao buscar RNCs:', error);
        res.status(500).json({ error: 'Erro ao buscar RNCs.' });
    }
});

// GET /api/sgq/rncs/all
router.get('/rncs/all', async (req, res) => {
    try {
        const { status, periodo } = req.query;
        let query = `
            SELECT r.*, nc.descricao as nc_descricao, nc.tipo as nc_tipo, nc.gravidade as nc_gravidade,
                   (SELECT COALESCE(SUM(tempo_minutos), 0) FROM app_sgq_rnc_apontamentos WHERE rnc_id = r.id) as tempo_gasto_total
            FROM app_sgq_rncs r
            LEFT JOIN app_sgq_nao_conformidades nc ON r.nao_conformidade_id = nc.id
            WHERE 1=1
        `;
        const params = [];

        if (status) { query += ' AND r.status = ?'; params.push(status); }

        query += ' ORDER BY r.data_criacao DESC LIMIT 1000';

        const [results] = await db.query(query, params);

        // Enrichment with drawings/PDF from produtos_docs
        if (results && results.length > 0) {
            const codigos = [...new Set(results.map(r => r.produto).filter(c => c))];
            if (codigos.length > 0) {
                const placeholders = codigos.map(() => '?').join(',');
                const [docsResult] = await db.query(
                    `SELECT produto_codigo, url_arquivo FROM produtos_docs WHERE produto_codigo IN (${placeholders})`,
                    codigos
                );
                
                const docsMap = {};
                docsResult.forEach(d => {
                    if (!docsMap[d.produto_codigo]) {
                        docsMap[d.produto_codigo] = [];
                    }
                    docsMap[d.produto_codigo].push(d);
                });

                results.forEach(r => {
                    const docs = docsMap[r.produto] || [];
                    r.tem_arquivos = docs.length > 0;
                    r.arquivos_count = docs.length;
                    r.primeiro_arquivo = docs.length > 0 ? docs[0].url_arquivo : null;
                });
            } else {
                results.forEach(r => {
                    r.tem_arquivos = false;
                    r.arquivos_count = 0;
                    r.primeiro_arquivo = null;
                });
            }
        }

        res.json(results);
    } catch (error) {
        console.error('Erro ao buscar todas RNCs:', error);
        res.status(500).json({ error: 'Erro ao buscar RNCs.' });
    }
});

// POST /api/sgq/rncs
router.post('/rncs', async (req, res) => {
    try {
        const {
            pedido, op, item_op, sequen_op, produto, desc_produto, cliente,
            recurso_origem, recurso_inconformidade, nao_conformidade_id,
            observacao, imagem_evidencia, criado_por, f097_dados, fotos_registro, data_limite
        } = req.body;

        // --- Auto-numbering from general_config ---
        let numero_rnc = null;
        try {
            const [cfgRows] = await db.query('SELECT general_config FROM app_company_settings WHERE id = 1 LIMIT 1');
            if (cfgRows.length > 0 && cfgRows[0].general_config) {
                const gc = typeof cfgRows[0].general_config === 'string'
                    ? JSON.parse(cfgRows[0].general_config)
                    : cfgRows[0].general_config;

                const rncCfg = gc?.sgq_rnc_config;
                if (rncCfg && rncCfg.format) {
                    const seq = parseInt(rncCfg.next_seq) || 1;
                    const now = new Date();

                    // Build number from format template
                    numero_rnc = rncCfg.format
                        .replace('{YEAR}', now.getFullYear())
                        .replace('{MONTH}', String(now.getMonth() + 1).padStart(2, '0'))
                        .replace(/\{SEQ:(\d+)\}/, (_, n) => String(seq).padStart(parseInt(n), '0'))
                        .replace('{SEQ}', String(seq).padStart(4, '0'));

                    // Increment next_seq atomically
                    const updatedGc = { ...gc, sgq_rnc_config: { ...rncCfg, next_seq: seq + 1 } };
                    await db.query(
                        'UPDATE app_company_settings SET general_config = ? WHERE id = 1',
                        [JSON.stringify(updatedGc)]
                    );
                }
            }
        } catch (cfgErr) {
            console.warn('[RNC] Erro ao ler configuração de numeração, usando ID como fallback:', cfgErr.message);
        }

        const [result] = await db.query(
            `INSERT INTO app_sgq_rncs (
                pedido, op, item_op, sequen_op, produto, desc_produto, cliente,
                recurso_origem, recurso_inconformidade, nao_conformidade_id,
                observacao, imagem_evidencia, criado_por, status, f097_dados, fotos_registro, data_limite, numero_rnc
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ABERTO', ?, ?, ?, ?)`,
            [
                pedido || null, op || null, item_op || null, sequen_op || null,
                produto || null, desc_produto || null, cliente || null,
                recurso_origem || null, recurso_inconformidade || null,
                nao_conformidade_id || null, observacao || null,
                imagem_evidencia || null, criado_por || 'Operador',
                f097_dados ? (typeof f097_dados === 'string' ? f097_dados : JSON.stringify(f097_dados)) : null,
                fotos_registro ? (typeof fotos_registro === 'string' ? fotos_registro : JSON.stringify(fotos_registro)) : null,
                data_limite || null,
                numero_rnc
            ]
        );

        try {
            emitHermesAlert(`🚨 **Nova RNC Aberta**: RNC **${numero_rnc || result.insertId}** gerada por **${criado_por || 'Operador'}** para o produto **${produto}** (OS/Pedido: ${op || pedido}).`, 'rnc');
        } catch (e) { console.error('Erro ao emitir alerta de RNC:', e); }

        res.status(201).json({ message: 'RNC criada com sucesso.', id: result.insertId, numero_rnc });
    } catch (error) {
        console.error('Erro ao criar RNC:', error);
        res.status(500).json({ error: 'Erro ao criar RNC.' });
    }
});


// PUT /api/sgq/rncs/:id
router.put('/rncs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            status, tratativa_resposta, tratado_por, f097_dados, fotos_tratativa, 
            recurso_inconformidade, nao_conformidade_id, observacao, data_limite,
            reposicao_solicitada, reposicao_liberada, reposicao_data_solicitacao,
            reposicao_data_liberacao, reposicao_usuario_liberou, reposicao_op
        } = req.body;

        const queryParams = [status || 'EM ANDAMENTO', tratativa_resposta || null, tratado_por || 'Sistema'];
        let queryStr = `UPDATE app_sgq_rncs SET status = ?, tratativa_resposta = ?, tratado_por = ?, data_tratativa = CURRENT_TIMESTAMP`;
        
        let f097Obj = null;
        if (f097_dados !== undefined) {
            queryStr += `, f097_dados = ?`;
            queryParams.push(f097_dados ? (typeof f097_dados === 'string' ? f097_dados : JSON.stringify(f097_dados)) : null);
            try {
                f097Obj = typeof f097_dados === 'string' ? JSON.parse(f097_dados) : f097_dados;
            } catch(e){}
        }
        if (fotos_tratativa !== undefined) {
            queryStr += `, fotos_tratativa = ?`;
            queryParams.push(fotos_tratativa ? (typeof fotos_tratativa === 'string' ? fotos_tratativa : JSON.stringify(fotos_tratativa)) : null);
        }
        if (recurso_inconformidade !== undefined) {
            queryStr += `, recurso_inconformidade = ?`;
            queryParams.push(recurso_inconformidade);
        }
        if (nao_conformidade_id !== undefined) {
            queryStr += `, nao_conformidade_id = ?`;
            queryParams.push(nao_conformidade_id);
        }
        if (observacao !== undefined) {
            queryStr += `, observacao = ?`;
            queryParams.push(observacao);
        }
        if (data_limite !== undefined) {
            queryStr += `, data_limite = ?`;
            queryParams.push(data_limite);
        }
        if (reposicao_solicitada !== undefined) {
            queryStr += `, reposicao_solicitada = ?`;
            queryParams.push(reposicao_solicitada);
        }
        if (reposicao_liberada !== undefined) {
            queryStr += `, reposicao_liberada = ?`;
            queryParams.push(reposicao_liberada);
        }
        if (reposicao_data_solicitacao !== undefined) {
            queryStr += `, reposicao_data_solicitacao = ?`;
            queryParams.push(reposicao_data_solicitacao);
        }
        if (reposicao_data_liberacao !== undefined) {
            queryStr += `, reposicao_data_liberacao = ?`;
            queryParams.push(reposicao_data_liberacao);
        }
        if (reposicao_usuario_liberou !== undefined) {
            queryStr += `, reposicao_usuario_liberou = ?`;
            queryParams.push(reposicao_usuario_liberou);
        }
        if (reposicao_op !== undefined) {
            queryStr += `, reposicao_op = ?`;
            queryParams.push(reposicao_op);
        }

        queryStr += ` WHERE id = ?`;
        queryParams.push(id);

        await db.query(queryStr, queryParams);

        // -------------------------------------------------------------------------
        // INTEGRAÇÃO PROTHEUS (APONTAMENTO DE PERDA E ESTORNO - MATA685)
        // -------------------------------------------------------------------------
        try {
            // Verifica a config global da empresa
            const [configRows] = await db.query(`SELECT general_config FROM app_company_settings LIMIT 1`);
            let companyConfig = {};
            if (configRows && configRows.length > 0) {
                companyConfig = typeof configRows[0].general_config === 'string' ? JSON.parse(configRows[0].general_config) : configRows[0].general_config;
            }

            if (companyConfig.apontamento_perdas_protheus_active && f097Obj && f097Obj.tratativa) {
                const tratativa = f097Obj.tratativa;
                const disposicaoNovaPeca = !!tratativa.disposicao_nova_peca;

                // Busca RNC atualizada para ter acesso à OP, Recurso, Produto e RECNO salvo
                const [rncRows] = await db.query(`SELECT op, produto, recurso_inconformidade, protheus_perda_recno FROM app_sgq_rncs WHERE id = ?`, [id]);
                if (rncRows && rncRows.length > 0) {
                    const rnc = rncRows[0];
                    const opNumero = rnc.op;
                    const produto = rnc.produto;
                    const recurso = rnc.recurso_inconformidade; // Pode vir vazio ou do form
                    
                    const axios = require('axios');
                    const https = require('https');
                    const agent = new https.Agent({ rejectUnauthorized: false });

                    // 1. APONTAMENTO DE PERDA (NOPER: 3)
                    if (disposicaoNovaPeca && !rnc.protheus_perda_recno && opNumero && produto) {
                        const qtdStr = tratativa.protheus_perda_quant;
                        const operacStr = tratativa.protheus_perda_operac;
                        const localizStr = tratativa.protheus_perda_localiz;

                        if (qtdStr && operacStr && localizStr) {
                            const payload = {
                                data: {
                                    EMPRESA: "01",
                                    CFILANT: "0101",
                                    apontamentosPerdas: [{
                                        BC_OP: String(opNumero).trim(),
                                        BC_OPERAC: String(operacStr).trim(),
                                        BC_RECURSO: String(recurso).trim() || '',
                                        NOPER: 3,
                                        aItens: [{
                                            BC_PRODUTO: String(produto).trim(),
                                            BC_LOCORIG: "03",
                                            BC_LOCALIZ: String(localizStr).trim(),
                                            BC_TIPO: "R",
                                            BC_QUANT: Number(qtdStr)
                                        }]
                                    }]
                                }
                            };

                            console.log(`[PROTHEUS API] Engatilhando apontamento de perda para RNC ${id} (OP ${opNumero})`);
                            axios.post(
                                'https://192.168.1.60:47500/ordem-producao/apontamento-perdas',
                                payload,
                                { httpsAgent: agent, timeout: 15000 }
                            ).then(async (response) => {
                                console.log(`[PROTHEUS API SUCESSO] Apontamento Perda RNC ${id}:`, response.data);
                                // Extrai o RECNO retornado (adaptar caso o formato mude)
                                // Assumindo que vem como response.data.recno ou similar, vamos gravar o json puro caso não saibamos o campo exato
                                const recno = response.data?.recno || response.data?.RECNO || JSON.stringify(response.data);
                                await db.query(`UPDATE app_sgq_rncs SET protheus_perda_recno = ? WHERE id = ?`, [String(recno), id]);
                            }).catch(err => {
                                console.error(`[PROTHEUS API ERRO] Falha na perda RNC ${id}:`, err.response?.data || err.message);
                            });
                        }
                    }

                    // 2. ESTORNO DE PERDA (NOPER: 6)
                    if (!disposicaoNovaPeca && rnc.protheus_perda_recno && opNumero) {
                        const payload = {
                            data: {
                                EMPRESA: "01",
                                CFILANT: "0101",
                                apontamentosPerdas: [{
                                    BC_OP: String(opNumero).trim(),
                                    NOPER: 6,
                                    aItens: [{
                                        RECNO_ESTORNO: Number(rnc.protheus_perda_recno) || rnc.protheus_perda_recno
                                    }]
                                }]
                            }
                        };

                        console.log(`[PROTHEUS API] Engatilhando estorno de perda para RNC ${id} (OP ${opNumero})`);
                        axios.post(
                            'https://192.168.1.60:47500/ordem-producao/apontamento-perdas',
                            payload,
                            { httpsAgent: agent, timeout: 15000 }
                        ).then(async (response) => {
                            console.log(`[PROTHEUS API SUCESSO] Estorno Perda RNC ${id}:`, response.data);
                            await db.query(`UPDATE app_sgq_rncs SET protheus_perda_recno = NULL WHERE id = ?`, [id]);
                        }).catch(err => {
                            console.error(`[PROTHEUS API ERRO] Falha no estorno RNC ${id}:`, err.response?.data || err.message);
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Erro na integração de perdas Protheus:', e);
        }
        // -------------------------------------------------------------------------

        res.json({ message: 'RNC updated successfully' });
    } catch (error) {
        console.error('Erro ao atualizar RNC:', error);
        res.status(500).json({ error: 'Erro ao atualizar RNC.' });
    }
});

// --- APONTAMENTOS DE PRODUÇÃO PARA RNC ---

// GET /api/sgq/rncs/:id/apontamentos
router.get('/rncs/:id/apontamentos', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            'SELECT * FROM app_sgq_rnc_apontamentos WHERE rnc_id = ? ORDER BY data_apontamento DESC',
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar apontamentos de RNC:', error);
        res.status(500).json({ error: 'Erro ao buscar apontamentos.' });
    }
});

// POST /api/sgq/rncs/:id/apontamentos
router.post('/rncs/:id/apontamentos', async (req, res) => {
    try {
        const { id } = req.params;
        const { operacao_recurso, descricao, tempo_minutos, usuario } = req.body;
        
        if (!operacao_recurso || !tempo_minutos || !usuario) {
            return res.status(400).json({ error: 'Operação/Recurso, tempo em minutos e usuário são obrigatórios.' });
        }

        const [result] = await db.query(
            `INSERT INTO app_sgq_rnc_apontamentos (rnc_id, operacao_recurso, descricao, tempo_minutos, usuario)
             VALUES (?, ?, ?, ?, ?)`,
            [id, operacao_recurso, descricao || '', parseInt(tempo_minutos, 10), usuario]
        );

        res.status(201).json({ message: 'Apontamento registrado com sucesso.', id: result.insertId });
    } catch (error) {
        console.error('Erro ao registrar apontamento de RNC:', error);
        res.status(500).json({ error: 'Erro ao registrar apontamento.' });
    }
});

// DELETE /api/sgq/rncs/apontamentos/:id
router.delete('/rncs/apontamentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM app_sgq_rnc_apontamentos WHERE id = ?', [id]);
        res.json({ message: 'Apontamento excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir apontamento de RNC:', error);
        res.status(500).json({ error: 'Erro ao excluir apontamento.' });
    }
});

module.exports = router;

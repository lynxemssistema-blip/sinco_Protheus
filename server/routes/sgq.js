const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');

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
            responsables: safeParse(r.responsables)
        }));

        res.json(processedRows);
    } catch (error) {
        console.error('Erro ao buscar processos SGQ:', error);
        res.status(500).json({ error: 'Erro interno ao consultar Mapeamento SGQ.' });
    }
});

// PUT /api/sgq/processos/:id
// Atualiza informações contextuais e de diretoria/papel de uma tela
router.put('/processos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, steps, tips, links, responsables, document_id } = req.body;

        await db.query(`
            UPDATE app_sgq_processos 
            SET title = ?, description = ?, steps = ?, tips = ?, links = ?, responsables = ?, document_id = ?
            WHERE id = ?
        `, [
            title, 
            description, 
            JSON.stringify(steps || []), 
            JSON.stringify(tips || []), 
            JSON.stringify(links || []), 
            JSON.stringify(responsables || []), 
            document_id || null,
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
            SELECT r.*, nc.descricao as nc_descricao, nc.tipo as nc_tipo, nc.gravidade as nc_gravidade 
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
            SELECT r.*, nc.descricao as nc_descricao, nc.tipo as nc_tipo, nc.gravidade as nc_gravidade 
            FROM app_sgq_rncs r
            LEFT JOIN app_sgq_nao_conformidades nc ON r.nao_conformidade_id = nc.id
            WHERE 1=1
        `;
        const params = [];

        if (status) { query += ' AND r.status = ?'; params.push(status); }

        query += ' ORDER BY r.data_criacao DESC LIMIT 1000';

        const [results] = await db.query(query, params);
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
            observacao, imagem_evidencia, criado_por, f097_dados, fotos_registro
        } = req.body;

        const [result] = await db.query(
            `INSERT INTO app_sgq_rncs (
                pedido, op, item_op, sequen_op, produto, desc_produto, cliente,
                recurso_origem, recurso_inconformidade, nao_conformidade_id,
                observacao, imagem_evidencia, criado_por, status, f097_dados, fotos_registro
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ABERTO', ?, ?)`,
            [
                pedido || null, op || null, item_op || null, sequen_op || null,
                produto || null, desc_produto || null, cliente || null,
                recurso_origem || null, recurso_inconformidade || null,
                nao_conformidade_id || null, observacao || null,
                imagem_evidencia || null, criado_por || 'Operador',
                f097_dados ? JSON.stringify(f097_dados) : null,
                fotos_registro ? JSON.stringify(fotos_registro) : null
            ]
        );
        res.status(201).json({ message: 'RNC criada com sucesso.', id: result.insertId });
    } catch (error) {
        console.error('Erro ao criar RNC:', error);
        res.status(500).json({ error: 'Erro ao criar RNC.' });
    }
});

// PUT /api/sgq/rncs/:id
router.put('/rncs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, tratativa_resposta, tratado_por, f097_dados, fotos_tratativa, recurso_inconformidade, nao_conformidade_id, observacao } = req.body;

        const queryParams = [status || 'EM ANDAMENTO', tratativa_resposta || null, tratado_por || 'Sistema'];
        let queryStr = `UPDATE app_sgq_rncs SET status = ?, tratativa_resposta = ?, tratado_por = ?, data_tratativa = CURRENT_TIMESTAMP`;
        
        if (f097_dados !== undefined) {
            queryStr += `, f097_dados = ?`;
            queryParams.push(f097_dados ? (typeof f097_dados === 'string' ? f097_dados : JSON.stringify(f097_dados)) : null);
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

        queryStr += ` WHERE id = ?`;
        queryParams.push(id);

        await db.query(queryStr, queryParams);
        res.json({ message: 'RNC atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar RNC:', error);
        res.status(500).json({ error: 'Erro ao atualizar RNC.' });
    }
});

// DELETE /api/sgq/rncs/:id
router.delete('/rncs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM app_sgq_rncs WHERE id = ?', [id]);
        res.json({ message: 'RNC excluída com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir RNC:', error);
        res.status(500).json({ error: 'Erro ao excluir RNC.' });
    }
});

module.exports = router;

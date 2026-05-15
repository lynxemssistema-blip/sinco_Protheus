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

module.exports = router;

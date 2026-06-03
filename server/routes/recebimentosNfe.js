const express = require('express');
const router = express.Router();
const pool = require('../services/mysqlService');
const protheusDB = require('../services/protheusDB');

// ==========================================
// LISTAR NOTAS FISCAIS
// ==========================================
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, chave_acesso, numero_nf, emitente_nome, emitente_cnpj, data_emissao, valor_total, status, usuario_inclusao, created_at FROM nfe_recebimentos ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar NFs:', error);
        res.status(500).json({ error: 'Erro ao listar notas fiscais.' });
    }
});

// ==========================================
// OBTER DETALHES DE UMA NF + ITENS
// ==========================================
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [nfs] = await pool.query('SELECT * FROM nfe_recebimentos WHERE id = ?', [id]);
        if (nfs.length === 0) return res.status(404).json({ error: 'NF não encontrada.' });

        const [itens] = await pool.query('SELECT * FROM nfe_recebimento_itens WHERE id_nfe = ?', [id]);
        const [logs] = await pool.query(`
            SELECT l.*, i.xProd, i.cProd, i.cProd_metalfisa 
            FROM nfe_recebimento_logs l
            JOIN nfe_recebimento_itens i ON l.id_nfe_item = i.id
            WHERE i.id_nfe = ?
            ORDER BY l.created_at DESC
        `, [id]);

        const nf = nfs[0];
        nf.itens = itens;
        nf.logs = logs;

        res.json(nf);
    } catch (error) {
        console.error('Erro ao obter NF:', error);
        res.status(500).json({ error: 'Erro ao obter nota fiscal.' });
    }
});

// ==========================================
// IMPORTAR NOVO XML DE NF
// ==========================================
router.post('/', async (req, res) => {
    const { chave_acesso, numero_nf, serie, emitente_nome, emitente_cnpj, data_emissao, valor_total, xml_content, usuario, itens } = req.body;
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check if NF already exists
        const [existing] = await connection.query('SELECT id FROM nfe_recebimentos WHERE chave_acesso = ?', [chave_acesso]);
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Esta nota fiscal já foi importada anteriormente.' });
        }

        // Fetch a2_cod for mapping
        let a2_cod = null;
        if (emitente_cnpj) {
            try {
                const cleanCnpj = emitente_cnpj.replace(/\D/g, '');
                const resFornecedor = await protheusDB.query("SELECT trim(a2_cod) as a2_cod FROM public.sa2010 WHERE trim(a2_cgc) = $1 AND d_e_l_e_t_ = ' ' LIMIT 1", [cleanCnpj]);
                if (resFornecedor.rows.length > 0) a2_cod = resFornecedor.rows[0].a2_cod.trim();
            } catch(e) { console.error('Erro Protheus CNPJ:', e); }
        }

        // 1. Inserir a NF
        const [result] = await connection.query(
            `INSERT INTO nfe_recebimentos 
            (chave_acesso, numero_nf, serie, emitente_nome, emitente_cnpj, data_emissao, valor_total, xml_content, usuario_inclusao) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [chave_acesso, numero_nf, serie, emitente_nome, emitente_cnpj, data_emissao || null, valor_total, xml_content, usuario]
        );
        const id_nfe = result.insertId;

        // 2. Inserir os itens
        for (let i = 0; i < itens.length; i++) {
            const item = itens[i];
            let cProdMetal = null;
            if (a2_cod) {
                // Tenta SA5010
                try {
                    const resAssoc = await protheusDB.query("SELECT trim(a5_produto) as a5_produto FROM public.sa5010 WHERE trim(a5_fornece) = $1 AND trim(a5_codprf) = $2 AND d_e_l_e_t_ = ' ' LIMIT 1", [a2_cod, String(item.cProd).trim()]);
                    if (resAssoc.rows.length > 0) cProdMetal = resAssoc.rows[0].a5_produto;
                } catch(e) {}
                
                // Fallback SD1010 (Se SA5010 falhar e a NF já foi importada antes)
                if (!cProdMetal && numero_nf) {
                    try {
                        const docFormated = String(numero_nf).padStart(9, '0');
                        const itemTarget = String(i + 1).padStart(4, '0');
                        const sqlSd1 = "SELECT trim(d1_cod) as d1_cod FROM public.sd1010 WHERE trim(d1_doc) = $1 AND trim(d1_fornece) = $2 AND d1_item = $3 AND d_e_l_e_t_ = ' ' LIMIT 1";
                        const resSd1 = await protheusDB.query(sqlSd1, [docFormated, a2_cod, itemTarget]);
                        if (resSd1.rows.length > 0) cProdMetal = resSd1.rows[0].d1_cod;
                    } catch(e) {}
                }
            }

            await connection.query(
                `INSERT INTO nfe_recebimento_itens 
                (id_nfe, cProd, cProd_metalfisa, xProd, cfop, ncm, und, qCom, vUnCom, vProd) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id_nfe, item.cProd, cProdMetal, item.xProd, item.cfop, item.ncm, item.uCom, item.qCom, item.vUnCom, item.vProd]
            );
        }

        await connection.commit();
        res.json({ id: id_nfe, message: 'Nota fiscal importada com sucesso.' });
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao importar NF:', error);
        res.status(500).json({ error: 'Erro ao importar nota fiscal.' });
    } finally {
        connection.release();
    }
});

// ==========================================
// APONTAR RECEBIMENTO DE UM ITEM
// ==========================================
router.post('/receber-item', async (req, res) => {
    const { id_nfe_item, qty_received_now, usuario } = req.body;
    
    if (!qty_received_now || qty_received_now <= 0) {
        return res.status(400).json({ error: 'Quantidade recebida deve ser maior que zero.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Obter dados do item
        const [itens] = await connection.query('SELECT id_nfe, qCom, qty_received FROM nfe_recebimento_itens WHERE id = ? FOR UPDATE', [id_nfe_item]);
        if (itens.length === 0) throw new Error('Item não encontrado.');
        const item = itens[0];

        const novaQtyRecebida = Number(item.qty_received) + Number(qty_received_now);
        const qComOriginal = Number(item.qCom);

        if (novaQtyRecebida > qComOriginal) {
            throw new Error(`A quantidade total recebida (${novaQtyRecebida}) não pode ser maior que a quantidade da NF (${qComOriginal}).`);
        }

        const novoStatusItem = (novaQtyRecebida >= qComOriginal) ? 'Concluido' : 'Parcial';

        // Atualizar Item
        await connection.query(
            'UPDATE nfe_recebimento_itens SET qty_received = ?, status = ? WHERE id = ?',
            [novaQtyRecebida, novoStatusItem, id_nfe_item]
        );

        // Registrar Log
        await connection.query(
            'INSERT INTO nfe_recebimento_logs (id_nfe_item, usuario, qty_received_now) VALUES (?, ?, ?)',
            [id_nfe_item, usuario, qty_received_now]
        );

        // Atualizar status geral da NF
        const [todosItens] = await connection.query('SELECT qCom, qty_received FROM nfe_recebimento_itens WHERE id_nfe = ?', [item.id_nfe]);
        let nfStatus = 'Pendente';
        let allConcluido = true;
        let anyParcialOrRecebido = false;

        for (const i of todosItens) {
            if (Number(i.qty_received) > 0) anyParcialOrRecebido = true;
            if (Number(i.qty_received) < Number(i.qCom)) allConcluido = false;
        }

        if (allConcluido) {
            nfStatus = 'Concluido';
        } else if (anyParcialOrRecebido) {
            nfStatus = 'Parcial';
        }

        await connection.query('UPDATE nfe_recebimentos SET status = ? WHERE id = ?', [nfStatus, item.id_nfe]);

        await connection.commit();
        res.json({ message: 'Recebimento apontado com sucesso!', status: novoStatusItem, novaQtyRecebida, nfStatus });
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao receber item:', error);
        res.status(400).json({ error: error.message || 'Erro ao registrar recebimento.' });
    } finally {
        connection.release();
    }
});

// ==========================================
// REGISTRAR ENVIO DE E-MAIL (E DISPARAR)
// ==========================================
router.post('/email', async (req, res) => {
    const { id_nfe, remetente, destinatarios, assunto, corpo } = req.body;
    try {
        // Here you would integrate with your actual SMTP or Mail API
        // For now, we simulate the send and log it in the DB.
        
        await pool.query(
            'INSERT INTO nfe_envios_email (id_nfe, remetente, destinatarios, assunto, corpo, status) VALUES (?, ?, ?, ?, ?, ?)',
            [id_nfe, remetente, destinatarios, assunto, corpo, 'Enviado']
        );

        res.json({ message: 'E-mail registrado e enviado com sucesso.' });
    } catch (error) {
        console.error('Erro ao registrar e-mail:', error);
        res.status(500).json({ error: 'Erro ao enviar e-mail.' });
    }
});

// ==========================================
// OBTER LOGS DE E-MAIL (Para Aba Engenharia)
// ==========================================
router.get('/emails/todos', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT e.*, n.numero_nf, n.emitente_nome 
            FROM nfe_envios_email e
            JOIN nfe_recebimentos n ON e.id_nfe = n.id
            ORDER BY e.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar e-mails:', error);
        res.status(500).json({ error: 'Erro ao listar envios de e-mail.' });
    }
});

// ==========================================
// EXCLUIR NOTA FISCAL E CONTROLE DE RECEBIMENTO
// ==========================================
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        // The items have an id that is referenced by logs (id_nfe_item).
        // First delete logs of these items.
        await connection.query(`
            DELETE l FROM nfe_recebimento_logs l
            JOIN nfe_recebimento_itens i ON l.id_nfe_item = i.id
            WHERE i.id_nfe = ?
        `, [id]);

        // Delete items
        await connection.query('DELETE FROM nfe_recebimento_itens WHERE id_nfe = ?', [id]);

        // Delete email logs associated
        await connection.query('DELETE FROM nfe_envios_email WHERE id_nfe = ?', [id]);

        // Delete the NF itself
        const [result] = await connection.query('DELETE FROM nfe_recebimentos WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'NF não encontrada.' });
        }

        await connection.commit();
        res.json({ message: 'NF e controles de recebimento excluídos com sucesso.' });
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao excluir NF:', error);
        res.status(500).json({ error: 'Erro ao excluir a nota fiscal.' });
    } finally {
        connection.release();
    }
});

module.exports = router;

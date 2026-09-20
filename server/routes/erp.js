const express = require('express');
const router = express.Router();
const mysql = require('../services/mysqlService');
const ErpValidator = require('../services/erpValidationService');

// 1. Dashboard / Estatísticas do ERP Nativo (100% MySQL - Paralelizado via Promise.all)
router.get('/stats', async (req, res) => {
    try {
        const [
            [[prod]],
            [[cli]],
            [[forn]],
            [[ped]],
            [[ops]]
        ] = await Promise.all([
            mysql.query('SELECT COUNT(*) as total FROM erp_produtos'),
            mysql.query('SELECT COUNT(*) as total FROM erp_clientes'),
            mysql.query('SELECT COUNT(*) as total FROM erp_fornecedores'),
            mysql.query('SELECT COUNT(*) as total FROM erp_pedidos_venda'),
            mysql.query('SELECT COUNT(*) as total FROM erp_ordens_producao WHERE status != "cancelada"')
        ]);

        res.json({
            produtos: prod?.total || 0,
            clientes: cli?.total || 0,
            fornecedores: forn?.total || 0,
            pedidos: ped?.total || 0,
            ops_ativas: ops?.total || 0
        });
    } catch (err) {
        console.error('Erro em /api/erp/stats:', err);
        res.status(500).json({ error: 'Erro ao buscar estatísticas do ERP', detail: err.message });
    }
});

// 1.1 PRODUTOS: Próximo código automático no padrão Protheus (MATA010) com base no prefixo (mínimo 4 dígitos)
router.get('/produtos/proximo-codigo', async (req, res) => {
    try {
        let { prefixo = '', tipo = 'PA' } = req.query;
        prefixo = (prefixo || '').trim().toUpperCase().replace(/[-_ ]+$/, '');
        if (!prefixo) {
            if (tipo === 'PA') prefixo = 'SCL';
            else if (tipo === 'MP') prefixo = 'MPT';
            else if (tipo === 'PI') prefixo = 'MT2';
            else if (tipo === 'SV') prefixo = 'SRV';
            else if (tipo === 'EM') prefixo = 'EMB';
            else if (tipo === 'ME') prefixo = 'REV';
            else prefixo = tipo.toUpperCase();
        }

        const prefixoComHifen = `${prefixo}-`;

        // 1. Busca o maior número sequencial existente para esse prefixo exato
        const [rows] = await mysql.query(
            "SELECT MAX(CAST(SUBSTRING_INDEX(codigo, '-', -1) AS UNSIGNED)) as max_num FROM erp_produtos WHERE codigo LIKE ? AND codigo REGEXP ?",
            [`${prefixoComHifen}%`, `^${prefixo}-[0-9]+$`]
        );

        let proximoNumero = (rows[0]?.max_num || 0) + 1;

        // 2. Mínimo de 4 dígitos (ex: 0001, 0045, 1372, 10001)
        let seqStr = String(proximoNumero).padStart(Math.max(4, String(proximoNumero).length), '0');
        let proximoCodigo = `${prefixoComHifen}${seqStr}`;

        // 3. Garantia de unicidade / colisão ExistChav (Protheus)
        while (true) {
            const [[exists]] = await mysql.query('SELECT id FROM erp_produtos WHERE codigo = ? LIMIT 1', [proximoCodigo]);
            if (!exists) break;
            proximoNumero++;
            seqStr = String(proximoNumero).padStart(Math.max(4, String(proximoNumero).length), '0');
            proximoCodigo = `${prefixoComHifen}${seqStr}`;
        }

        res.json({ proximoCodigo, prefixo, proximoNumero });
    } catch (err) {
        console.error('Erro ao gerar próximo código no padrão Protheus:', err);
        res.status(500).json({ error: 'Erro ao gerar código automático de produto' });
    }
});

// 2. PRODUTOS: Lookup com filtros avançados para autocomplete e modal de seleção
router.get('/produtos/lookup', async (req, res) => {
    try {
        const { 
            q = '', 
            tipo = '', 
            grupo = '', 
            unidade = '',
            armazem = '',
            com_preco = '',
            preco_min = '',
            preco_max = '',
            modo_busca = 'contem', // 'contem', 'comeca', 'exato'
            ordenar = 'codigo_asc',
            limit = 50, 
            offset = 0,
            format = ''
        } = req.query;

        let baseQuery = `
            FROM erp_produtos
            WHERE status = 'ativo'
        `;
        const params = [];

        // Filtro Textual Inteligente
        if (q && q.trim()) {
            const trimmed = q.trim();
            if (modo_busca === 'exato') {
                baseQuery += ' AND (codigo = ? OR ncm = ?)';
                params.push(trimmed, trimmed);
            } else if (modo_busca === 'comeca') {
                const termStart = `${trimmed}%`;
                baseQuery += ' AND (codigo LIKE ? OR descricao LIKE ?)';
                params.push(termStart, termStart);
            } else {
                // Multi-term: cada palavra digitada é buscada conjuntamente
                const words = trimmed.split(/\s+/).filter(w => w.length > 0);
                for (const word of words) {
                    const term = `%${word}%`;
                    baseQuery += ' AND (codigo LIKE ? OR descricao LIKE ? OR ncm LIKE ?)';
                    params.push(term, term, term);
                }
            }
        }

        // Filtro por Tipo de Produto (B1_TIPO)
        if (tipo && tipo.trim()) {
            const tiposArray = tipo.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
            if (tiposArray.length === 1) {
                baseQuery += ' AND tipo = ?';
                params.push(tiposArray[0]);
            } else if (tiposArray.length > 1) {
                baseQuery += ` AND tipo IN (${tiposArray.map(() => '?').join(',')})`;
                params.push(...tiposArray);
            }
        }

        // Filtro por Grupo / Prefixo
        if (grupo && grupo.trim()) {
            const g = grupo.trim().toUpperCase();
            baseQuery += ' AND (codigo LIKE CONCAT(?, "-%") OR codigo LIKE CONCAT(?, " %") OR codigo LIKE CONCAT(?, "%"))';
            params.push(g, g, g);
        }

        // Filtro por Unidade de Medida (B1_UM)
        if (unidade && unidade.trim()) {
            baseQuery += ' AND unidade_medida = ?';
            params.push(unidade.trim().toUpperCase());
        }

        // Filtro por Armazém Padrão (B1_LOCPAD)
        if (armazem && armazem.trim()) {
            baseQuery += ' AND armazem_padrao = ?';
            params.push(armazem.trim());
        }

        // Filtro por Preço Comercial
        if (com_preco === 'true' || com_preco === '1') {
            baseQuery += ' AND preco_venda > 0';
        }
        if (preco_min !== undefined && preco_min !== '') {
            baseQuery += ' AND preco_venda >= ?';
            params.push(parseFloat(preco_min) || 0);
        }
        if (preco_max !== undefined && preco_max !== '') {
            baseQuery += ' AND preco_venda <= ?';
            params.push(parseFloat(preco_max) || 0);
        }

        // Total de registros para paginação
        const [countRows] = await mysql.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
        const total = countRows[0]?.total || 0;
        res.setHeader('X-Total-Count', total);

        // Ordenação
        let orderClause = ' ORDER BY codigo ASC';
        if (ordenar === 'codigo_desc') orderClause = ' ORDER BY codigo DESC';
        else if (ordenar === 'descricao_asc') orderClause = ' ORDER BY descricao ASC';
        else if (ordenar === 'descricao_desc') orderClause = ' ORDER BY descricao DESC';
        else if (ordenar === 'preco_desc') orderClause = ' ORDER BY preco_venda DESC, codigo ASC';
        else if (ordenar === 'preco_asc') orderClause = ' ORDER BY preco_venda ASC, codigo ASC';

        const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
        const parsedOffset = Math.max(parseInt(offset) || 0, 0);

        const selectQuery = `
            SELECT codigo, descricao, tipo, unidade_medida, ncm, peso_liquido, preco_venda, armazem_padrao
            ${baseQuery}
            ${orderClause}
            LIMIT ? OFFSET ?
        `;
        const queryParams = [...params, parsedLimit, parsedOffset];
        const [rows] = await mysql.query(selectQuery, queryParams);

        if (format === 'paged') {
            return res.json({
                itens: rows,
                total,
                page: Math.floor(parsedOffset / parsedLimit) + 1,
                limit: parsedLimit,
                pages: Math.ceil(total / parsedLimit) || 1
            });
        }

        res.json(rows);
    } catch (err) {
        console.error('Erro em /api/erp/produtos/lookup:', err);
        res.status(500).json({ error: 'Erro na busca de produtos' });
    }
});

// 2.1 PRODUTOS: Listagem de Grupos/Prefixos disponíveis para filtros
router.get('/produtos/grupos', async (req, res) => {
    try {
        const [rows] = await mysql.query(`
            SELECT TRIM(SUBSTRING_INDEX(codigo, '-', 1)) as sigla, COUNT(*) as total
            FROM erp_produtos
            WHERE codigo LIKE '%-%'
            GROUP BY sigla
            HAVING total >= 50
            ORDER BY total DESC
            LIMIT 40
        `);
        res.json(rows);
    } catch (err) {
        console.error('Erro em /api/erp/produtos/grupos:', err);
        res.status(500).json({ error: 'Erro ao listar grupos de produtos' });
    }
});

// 3. PRODUTOS: Listar com busca e paginação
router.get('/produtos', async (req, res) => {
    try {
        const { search = '', tipo = '', limit = 50, offset = 0 } = req.query;
        let query = `
            SELECT p.*, 
                   EXISTS(SELECT 1 FROM erp_estruturas_bom WHERE produto_pai_codigo = p.codigo LIMIT 1) as tem_estrutura
            FROM erp_produtos p
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ' AND (p.codigo LIKE ? OR p.descricao LIKE ? OR p.ncm LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term);
        }
        if (tipo) {
            query += ' AND p.tipo = ?';
            params.push(tipo);
        }

        query += ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await mysql.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Erro em GET /api/erp/produtos:', err);
        res.status(500).json({ error: 'Erro ao listar produtos', detail: err.message });
    }
});

// 4. PRODUTOS: Criar Novo Produto com Validação
router.post('/produtos', async (req, res) => {
    try {
        const validacao = ErpValidator.validarProduto(req.body);
        if (!validacao.valido) {
            return res.status(400).json({ error: 'Falha na validação do produto', erros: validacao.erros });
        }

        const {
            codigo, descricao, tipo = 'PA', unidade_medida = 'UN', ncm = '',
            armazem_padrao = '01', peso_liquido = 0, peso_bruto = 0,
            custo_standard = 0, preco_venda = 0, lead_time_dias = 0
        } = req.body;

        const [result] = await mysql.query(`
            INSERT INTO erp_produtos (
                codigo, descricao, tipo, unidade_medida, ncm, armazem_padrao,
                peso_liquido, peso_bruto, custo_standard, preco_venda, lead_time_dias
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [codigo.trim().toUpperCase(), descricao.trim(), tipo, unidade_medida, ncm, armazem_padrao, peso_liquido, peso_bruto, custo_standard, preco_venda, lead_time_dias]);

        res.status(201).json({ id: result.insertId, codigo, message: 'Produto cadastrado com sucesso!' });
    } catch (err) {
        console.error('Erro em POST /api/erp/produtos:', err);
        res.status(500).json({ error: 'Erro ao criar produto', detail: err.message });
    }
});

// 5. CLIENTES: Lookup rápido para autocomplete nos pedidos
router.get('/clientes/lookup', async (req, res) => {
    try {
        const { q = '' } = req.query;
        const term = `%${q.trim()}%`;
        const [rows] = await mysql.query(`
            SELECT codigo, loja, razao_social, nome_fantasia, cnpj_cpf, cidade, uf, status
            FROM erp_clientes
            WHERE (codigo LIKE ? OR razao_social LIKE ? OR nome_fantasia LIKE ? OR cnpj_cpf LIKE ?)
            ORDER BY razao_social ASC LIMIT 25
        `, [term, term, term, term]);
        res.json(rows);
    } catch (err) {
        console.error('Erro em /api/erp/clientes/lookup:', err);
        res.status(500).json({ error: 'Erro na busca de clientes' });
    }
});

// 6. CLIENTES: Listar
router.get('/clientes', async (req, res) => {
    try {
        const { search = '', limit = 50 } = req.query;
        let query = 'SELECT * FROM erp_clientes WHERE 1=1';
        const params = [];

        if (search) {
            query += ' AND (codigo LIKE ? OR razao_social LIKE ? OR cnpj_cpf LIKE ? OR nome_fantasia LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        query += ' ORDER BY razao_social ASC LIMIT ?';
        params.push(parseInt(limit));

        const [rows] = await mysql.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Erro em GET /api/erp/clientes:', err);
        res.status(500).json({ error: 'Erro ao listar clientes', detail: err.message });
    }
});

// 6.1. CLIENTES: Criar Novo Cliente (MATA030)
router.post('/clientes', async (req, res) => {
    try {
        const validacao = ErpValidator.validarCliente(req.body);
        if (!validacao.valido) {
            return res.status(400).json({ error: 'Falha na validação do cliente', erros: validacao.erros });
        }

        const {
            codigo, loja = '01', razao_social, nome_fantasia = '', cnpj_cpf = '',
            inscricao_estadual = '', tipo_pessoa = 'J', endereco = '', bairro = '',
            cidade = '', uf = 'SP', cep = '', telefone = '', email = '', contato = '',
            condicao_pagamento_padrao = '30 DDL', status = 'ativo'
        } = req.body;

        // Verificar duplicidade de CNPJ/CPF
        if (cnpj_cpf && cnpj_cpf.trim() !== '') {
            const limpo = cnpj_cpf.replace(/\D/g, '');
            const [dupl] = await mysql.query('SELECT codigo, razao_social FROM erp_clientes WHERE REPLACE(REPLACE(REPLACE(cnpj_cpf, ".", ""), "/", ""), "-", "") = ?', [limpo]);
            if (dupl.length > 0) {
                return res.status(400).json({ error: `Já existe um cliente cadastrado com este CNPJ/CPF: Código ${dupl[0].codigo} (${dupl[0].razao_social})` });
            }
        }

        // Gerar código se não fornecido
        let codFinal = codigo ? codigo.trim().toUpperCase() : '';
        if (!codFinal) {
            const [[maxRow]] = await mysql.query('SELECT MAX(CAST(codigo AS UNSIGNED)) as max_cod FROM erp_clientes WHERE codigo REGEXP "^[0-9]+$"');
            const proximo = (maxRow?.max_cod || 1000) + 1;
            codFinal = String(proximo).padStart(6, '0');
        } else {
            const [codExistente] = await mysql.query('SELECT codigo FROM erp_clientes WHERE codigo = ?', [codFinal]);
            if (codExistente.length > 0) {
                return res.status(400).json({ error: `O código de cliente "${codFinal}" já está em uso` });
            }
        }

        const [result] = await mysql.query(`
            INSERT INTO erp_clientes (
                codigo, loja, razao_social, nome_fantasia, cnpj_cpf, inscricao_estadual,
                tipo_pessoa, endereco, bairro, cidade, uf, cep, telefone, email,
                contato, condicao_pagamento_padrao, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            codFinal, loja, razao_social.trim(), nome_fantasia.trim(), cnpj_cpf.trim(),
            inscricao_estadual.trim(), tipo_pessoa, endereco.trim(), bairro.trim(),
            cidade.trim(), uf.trim().toUpperCase(), cep.trim(), telefone.trim(),
            email.trim(), contato.trim(), condicao_pagamento_padrao.trim(), status
        ]);

        res.status(201).json({
            success: true,
            id: result.insertId,
            codigo: codFinal,
            message: `Cliente ${codFinal} - ${razao_social} cadastrado com sucesso!`
        });
    } catch (err) {
        console.error('Erro em POST /api/erp/clientes:', err);
        res.status(500).json({ error: 'Erro ao cadastrar cliente', detail: err.message });
    }
});

// 6.2. CLIENTES: Atualizar Cliente (MATA030)
router.put('/clientes/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const validacao = ErpValidator.validarCliente({ ...req.body, codigo });
        if (!validacao.valido) {
            return res.status(400).json({ error: 'Falha na validação do cliente', erros: validacao.erros });
        }

        const {
            razao_social, nome_fantasia = '', cnpj_cpf = '', inscricao_estadual = '',
            tipo_pessoa = 'J', endereco = '', bairro = '', cidade = '', uf = 'SP',
            cep = '', telefone = '', email = '', contato = '', condicao_pagamento_padrao = '30 DDL',
            status = 'ativo'
        } = req.body;

        await mysql.query(`
            UPDATE erp_clientes SET
                razao_social = ?, nome_fantasia = ?, cnpj_cpf = ?, inscricao_estadual = ?,
                tipo_pessoa = ?, endereco = ?, bairro = ?, cidade = ?, uf = ?,
                cep = ?, telefone = ?, email = ?, contato = ?, condicao_pagamento_padrao = ?,
                status = ?
            WHERE codigo = ?
        `, [
            razao_social.trim(), nome_fantasia.trim(), cnpj_cpf.trim(), inscricao_estadual.trim(),
            tipo_pessoa, endereco.trim(), bairro.trim(), cidade.trim(), uf.trim().toUpperCase(),
            cep.trim(), telefone.trim(), email.trim(), contato.trim(), condicao_pagamento_padrao.trim(),
            status, codigo
        ]);

        res.json({ success: true, message: `Cliente ${codigo} atualizado com sucesso!` });
    } catch (err) {
        console.error('Erro em PUT /api/erp/clientes/:codigo:', err);
        res.status(500).json({ error: 'Erro ao atualizar cliente', detail: err.message });
    }
});

// Helper: Obter próximo número sequencial de pedido (Padrão Protheus GetSXENum SC5)
async function getProximoNumeroPedido(conn) {
    const clientConn = conn || mysql;
    let protheusMax = 0;
    try {
        const pg = require('../db');
        const res = await pg.query("SELECT MAX(c5_num) as max_num FROM sc5010 WHERE d_e_l_e_t_ = ' ' AND c5_num ~ '^[0-9]+$'");
        if (res.rows && res.rows[0]?.max_num) {
            protheusMax = parseInt(res.rows[0].max_num, 10) || 0;
        }
    } catch (e) {
        // Postgres Protheus offline ou inacessível, continua com MySQL
    }

    const [[mysqlMax]] = await clientConn.query(`
        SELECT MAX(CAST(numero_pedido AS UNSIGNED)) as max_num 
        FROM erp_pedidos_venda 
        WHERE numero_pedido REGEXP '^[0-9]+$'
    `);
    const mysqlMaxNum = mysqlMax?.max_num || 0;

    let candidate = Math.max(protheusMax, mysqlMaxNum) + 1;

    // Protheus ExistChav check: garante que o código não existe previamente
    let exists = true;
    let formatted = '';
    while (exists) {
        formatted = String(candidate).padStart(6, '0');
        const [[check]] = await clientConn.query('SELECT 1 FROM erp_pedidos_venda WHERE numero_pedido = ? LIMIT 1', [formatted]);
        if (!check) {
            exists = false;
        } else {
            candidate++;
        }
    }

    return formatted;
}

// 6.5 PEDIDOS DE VENDA: Próximo número sequencial no padrão Protheus (GetSXENum SC5)
router.get('/pedidos/proximo-numero', async (req, res) => {
    try {
        const proximoNumero = await getProximoNumeroPedido();
        res.json({
            proximoNumero,
            tamanho: 6,
            mecanismo: 'Protheus SC5 GetSXENum',
            padrao: 'Numérico com 6 dígitos'
        });
    } catch (err) {
        console.error('Erro em GET /api/erp/pedidos/proximo-numero:', err);
        res.status(500).json({ error: 'Erro ao obter próximo número de pedido' });
    }
});

// 7. PEDIDOS DE VENDA: Listar com cliente e totais (Otimizado: CTE + Agregação sem subqueries correlacionadas)
router.get('/pedidos', async (req, res) => {
    try {
        const { search = '', status = '', limit = 150 } = req.query;
        let whereClause = ' WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (p.numero_pedido LIKE ? OR c.razao_social LIKE ? OR c.nome_fantasia LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term);
        }

        if (status) {
            whereClause += ' AND p.status = ?';
            params.push(status);
        }

        const parsedLimit = Math.min(Math.max(parseInt(limit) || 150, 1), 500);
        params.push(parsedLimit);

        // Otimização: CTE top_pedidos seleciona os pedidos filtrados primeiro (150 linhas)
        // e faz JOIN com itens agrupados apenas desses pedidos, eliminando 600 passes de subquery correlacionada
        const query = `
            WITH top_pedidos AS (
                SELECT p.id, p.numero_pedido, p.cliente_codigo, p.data_emissao, p.condicao_pagamento,
                       p.valor_total, p.peso_total, p.tipo_frete, p.transportadora, p.status, p.observacoes, p.created_at,
                       c.razao_social as cliente_nome, c.nome_fantasia as cliente_fantasia
                FROM erp_pedidos_venda p
                LEFT JOIN erp_clientes c ON p.cliente_codigo = c.codigo
                ${whereClause}
                ORDER BY p.id DESC 
                LIMIT ?
            ),
            itens_agg AS (
                SELECT i.pedido_numero,
                       COUNT(*) as total_itens,
                       MIN(NULLIF(i.data_entrega_prevista, '')) as data_entrega_prevista,
                       SUM(COALESCE(NULLIF(i.valor_total, 0), i.quantidade * i.preco_unitario)) as valor_calculado
                FROM erp_pedidos_itens i
                INNER JOIN top_pedidos tp ON tp.numero_pedido = i.pedido_numero
                GROUP BY i.pedido_numero
            )
            SELECT p.id, p.numero_pedido, p.cliente_codigo, p.data_emissao, p.condicao_pagamento,
                   COALESCE(NULLIF(p.valor_total, 0), it.valor_calculado, 0) as valor_total,
                   p.peso_total, p.tipo_frete, p.transportadora, p.status, p.observacoes, p.created_at,
                   p.cliente_nome, p.cliente_fantasia,
                   COALESCE(it.total_itens, 0) as total_itens,
                   it.data_entrega_prevista,
                   COALESCE(it.valor_calculado, 0) as valor_calculado
            FROM top_pedidos p
            LEFT JOIN itens_agg it ON it.pedido_numero = p.numero_pedido
            ORDER BY p.id DESC
        `;

        const [rows] = await mysql.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Erro em GET /api/erp/pedidos:', err);
        res.status(500).json({ error: 'Erro ao listar pedidos', detail: err.message });
    }
});

// 8. PEDIDOS DE VENDA: Detalhes de um pedido específico + itens do grid com detecção de OPs
router.get('/pedidos/:numero', async (req, res) => {
    try {
        const { numero } = req.params;
        const [pedidos] = await mysql.query(`
            SELECT p.id, p.numero_pedido, p.cliente_codigo, p.data_emissao, p.condicao_pagamento,
                   COALESCE(NULLIF(p.valor_total, 0), (SELECT SUM(COALESCE(NULLIF(valor_total, 0), quantidade * preco_unitario)) FROM erp_pedidos_itens WHERE pedido_numero = p.numero_pedido), 0) as valor_total,
                   p.peso_total, p.tipo_frete, p.transportadora, p.status, p.observacoes, p.created_at,
                   c.razao_social as cliente_nome, c.cnpj_cpf, c.cidade, c.uf, c.telefone, c.email
            FROM erp_pedidos_venda p
            LEFT JOIN erp_clientes c ON p.cliente_codigo = c.codigo
            WHERE p.numero_pedido = ?
        `, [numero]);

        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }

        const [itens] = await mysql.query(`
            SELECT i.*, pr.descricao as produto_descricao, pr.unidade_medida, pr.peso_liquido,
                   COALESCE(NULLIF(i.valor_total, 0), (i.quantidade * i.preco_unitario)) as subtotal,
                   COALESCE(NULLIF(TRIM(i.numero_op_gerada), ''), op.numero_op) as numero_op_efetiva,
                   CASE 
                       WHEN (i.numero_op_gerada IS NOT NULL AND TRIM(i.numero_op_gerada) != '') OR op.numero_op IS NOT NULL THEN 0
                       ELSE 1
                   END as pode_editar
            FROM erp_pedidos_itens i
            LEFT JOIN erp_produtos pr ON i.produto_codigo = pr.codigo
            LEFT JOIN erp_ordens_producao op ON (
                TRIM(op.pedido_venda) = TRIM(i.pedido_numero) 
                AND (
                    TRIM(op.item_pedido) = TRIM(i.item_seq) 
                    OR (COALESCE(TRIM(op.item_pedido), '') = '' AND TRIM(op.produto_codigo) = TRIM(i.produto_codigo))
                )
                AND op.status != 'cancelada'
            )
            WHERE i.pedido_numero = ?
            GROUP BY i.id
            ORDER BY CAST(i.item_seq AS UNSIGNED) ASC, i.id ASC
        `, [numero]);

        res.json({
            pedido: pedidos[0],
            itens
        });
    } catch (err) {
        console.error('Erro em GET /api/erp/pedidos/:numero:', err);
        res.status(500).json({ error: 'Erro ao buscar detalhes do pedido', detail: err.message });
    }
});


// 8.1 PEDIDOS DE VENDA: Atualizar item individualmente (apenas se não houver OP emitida)
router.put('/pedidos/:numero/itens/:itemId', async (req, res) => {
    const conn = await mysql.getConnection();
    try {
        await conn.beginTransaction();
        const { numero, itemId } = req.params;
        const { quantidade, preco_unitario, data_entrega_prevista } = req.body;

        // 1. Busca item e verifica se pertence ao pedido
        const [items] = await conn.query(
            'SELECT * FROM erp_pedidos_itens WHERE id = ? AND pedido_numero = ? FOR UPDATE',
            [itemId, numero]
        );

        if (items.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Item não encontrado para este pedido.' });
        }

        const item = items[0];

        // 2. Verifica se já possui OP emitida (regra de integridade fabril do Protheus)
        let hasOp = Boolean(item.numero_op_gerada && item.numero_op_gerada.trim());
        let opNum = item.numero_op_gerada || '';

        if (!hasOp) {
            const [ops] = await conn.query(`
                SELECT numero_op FROM erp_ordens_producao 
                WHERE TRIM(pedido_venda) = TRIM(?) 
                  AND (
                      TRIM(item_pedido) = TRIM(?) 
                      OR (COALESCE(TRIM(item_pedido), '') = '' AND TRIM(produto_codigo) = TRIM(?))
                  )
                  AND status != 'cancelada'
                LIMIT 1
            `, [numero, item.item_seq, item.produto_codigo]);

            if (ops.length > 0) {
                hasOp = true;
                opNum = ops[0].numero_op;
            }
        }

        if (hasOp) {
            await conn.rollback();
            return res.status(400).json({ 
                error: `Este item já possui Ordem de Produção emitida (OP: ${opNum}). Edição bloqueada por regra de integridade fabril (MATA410).` 
            });
        }

        // 3. Validações dos novos valores
        const novaQtd = parseFloat(quantidade);
        const novoPreco = parseFloat(preco_unitario);

        if (isNaN(novaQtd) || novaQtd <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'A quantidade deve ser um número maior que zero.' });
        }

        if (isNaN(novoPreco) || novoPreco < 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'O preço unitário não pode ser negativo.' });
        }

        const novoValorTotal = parseFloat((novaQtd * novoPreco).toFixed(2));
        const novaDataEntrega = data_entrega_prevista ? String(data_entrega_prevista).split('T')[0] : item.data_entrega_prevista;

        // 4. Atualiza o item na base de dados
        await conn.query(`
            UPDATE erp_pedidos_itens 
            SET quantidade = ?,
                preco_unitario = ?,
                valor_total = ?,
                data_entrega_prevista = ?
            WHERE id = ?
        `, [novaQtd, novoPreco, novoValorTotal, novaDataEntrega, itemId]);

        // 5. Recalcula o cabeçalho do pedido
        const [[totais]] = await conn.query(`
            SELECT COALESCE(SUM(valor_total), 0) as total_pedido,
                   COUNT(*) as total_itens
            FROM erp_pedidos_itens 
            WHERE pedido_numero = ?
        `, [numero]);

        await conn.query(`
            UPDATE erp_pedidos_venda 
            SET valor_total = ?
            WHERE numero_pedido = ?
        `, [totais.total_pedido, numero]);

        await conn.commit();

        res.json({
            success: true,
            message: 'Item do pedido atualizado com sucesso!',
            item: {
                id: item.id,
                quantidade: novaQtd,
                preco_unitario: novoPreco,
                valor_total: novoValorTotal,
                data_entrega_prevista: novaDataEntrega
            },
            total_pedido: totais.total_pedido
        });
    } catch (err) {
        await conn.rollback();
        console.error('Erro em PUT /api/erp/pedidos/:numero/itens/:itemId:', err);
        res.status(500).json({ error: 'Falha ao atualizar item do pedido', detail: err.message });
    } finally {
        conn.release();
    }
});

// 8.2 PEDIDOS DE VENDA: Adicionar novo item a pedido existente
router.post('/pedidos/:numero/itens', async (req, res) => {
    const conn = await mysql.getConnection();
    try {
        await conn.beginTransaction();
        const { numero } = req.params;
        const { produto_codigo, quantidade, preco_unitario, data_entrega_prevista } = req.body;

        // 1. Verifica se o pedido existe e não está cancelado / faturado
        const [pedidos] = await conn.query(
            'SELECT * FROM erp_pedidos_venda WHERE numero_pedido = ? FOR UPDATE',
            [numero]
        );
        if (pedidos.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }
        const pedido = pedidos[0];
        if (pedido.status === 'cancelado') {
            await conn.rollback();
            return res.status(400).json({ error: 'Não é possível adicionar produtos a um pedido cancelado.' });
        }
        if (pedido.status === 'faturado') {
            await conn.rollback();
            return res.status(400).json({ error: 'Não é possível adicionar produtos a um pedido faturado.' });
        }

        // 2. Valida o produto
        const prodCod = String(produto_codigo || '').trim().toUpperCase();
        if (!prodCod) {
            await conn.rollback();
            return res.status(400).json({ error: 'Código do produto é obrigatório.' });
        }
        const [prods] = await conn.query('SELECT codigo, descricao, unidade_medida, peso_liquido FROM erp_produtos WHERE codigo = ?', [prodCod]);
        if (prods.length === 0) {
            await conn.rollback();
            return res.status(400).json({ error: `Produto "${prodCod}" não encontrado no cadastro.` });
        }
        const prod = prods[0];

        // 3. Valida valores
        const qtd = parseFloat(quantidade);
        const preco = parseFloat(preco_unitario);
        if (isNaN(qtd) || qtd <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Quantidade deve ser maior que zero.' });
        }
        if (isNaN(preco) || preco < 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Preço unitário não pode ser negativo.' });
        }
        const subtotal = parseFloat((qtd * preco).toFixed(2));
        const dataEntrega = data_entrega_prevista ? String(data_entrega_prevista).split('T')[0] : (pedido.data_emissao ? String(pedido.data_emissao).split('T')[0] : new Date().toISOString().split('T')[0]);

        // 4. Determina o próximo item_seq (01, 02, 03...)
        const [existingItems] = await conn.query(
            'SELECT item_seq FROM erp_pedidos_itens WHERE pedido_numero = ?',
            [numero]
        );
        let maxNum = 0;
        for (const it of existingItems) {
            const num = parseInt(it.item_seq, 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
        const nextSeq = String(maxNum + 1).padStart(2, '0');

        // 5. Insere o item
        const [insertRes] = await conn.query(`
            INSERT INTO erp_pedidos_itens (
                pedido_numero, item_seq, produto_codigo, quantidade, quantidade_original,
                quantidade_entregue, quantidade_saldo, preco_unitario, valor_total,
                data_entrega_prevista, status
            ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'aberto')
        `, [numero, nextSeq, prodCod, qtd, qtd, qtd, preco, subtotal, dataEntrega]);

        // 6. Recalcula o cabeçalho do pedido
        const [[totais]] = await conn.query(`
            SELECT COALESCE(SUM(valor_total), 0) as total_pedido,
                   COUNT(*) as total_itens
            FROM erp_pedidos_itens 
            WHERE pedido_numero = ?
        `, [numero]);

        await conn.query(`
            UPDATE erp_pedidos_venda 
            SET valor_total = ?
            WHERE numero_pedido = ?
        `, [totais.total_pedido, numero]);

        await conn.commit();

        res.json({
            success: true,
            message: `Produto ${prodCod} adicionado com sucesso como item ${nextSeq}!`,
            item: {
                id: insertRes.insertId,
                pedido_numero: numero,
                item_seq: nextSeq,
                produto_codigo: prodCod,
                produto_descricao: prod.descricao,
                unidade_medida: prod.unidade_medida,
                quantidade: qtd,
                quantidade_original: qtd,
                quantidade_saldo: qtd,
                preco_unitario: preco,
                valor_total: subtotal,
                subtotal: subtotal,
                data_entrega_prevista: dataEntrega,
                numero_op_efetiva: null,
                pode_editar: 1,
                status: 'aberto'
            },
            total_pedido: totais.total_pedido
        });
    } catch (err) {
        await conn.rollback();
        console.error('Erro em POST /api/erp/pedidos/:numero/itens:', err);
        res.status(500).json({ error: 'Falha ao adicionar item ao pedido', detail: err.message });
    } finally {
        conn.release();
    }
});

// 8.3 PEDIDOS DE VENDA: Remover item de pedido existente (apenas se não houver OP)
router.delete('/pedidos/:numero/itens/:itemId', async (req, res) => {
    const conn = await mysql.getConnection();
    try {
        await conn.beginTransaction();
        const { numero, itemId } = req.params;

        const [items] = await conn.query(
            'SELECT * FROM erp_pedidos_itens WHERE id = ? AND pedido_numero = ? FOR UPDATE',
            [itemId, numero]
        );
        if (items.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Item não encontrado para este pedido.' });
        }
        const item = items[0];

        // Verifica se tem OP
        let hasOp = Boolean(item.numero_op_gerada && item.numero_op_gerada.trim());
        let opNum = item.numero_op_gerada || '';
        if (!hasOp) {
            const [ops] = await conn.query(`
                SELECT numero_op FROM erp_ordens_producao 
                WHERE TRIM(pedido_venda) = TRIM(?) 
                  AND (TRIM(item_pedido) = TRIM(?) OR (COALESCE(TRIM(item_pedido), '') = '' AND TRIM(produto_codigo) = TRIM(?)))
                  AND status != 'cancelada'
                LIMIT 1
            `, [numero, item.item_seq, item.produto_codigo]);
            if (ops.length > 0) {
                hasOp = true;
                opNum = ops[0].numero_op;
            }
        }
        if (hasOp) {
            await conn.rollback();
            return res.status(400).json({ 
                error: `Este item já possui Ordem de Produção emitida (OP: ${opNum}). Exclusão bloqueada.` 
            });
        }

        await conn.query('DELETE FROM erp_pedidos_itens WHERE id = ?', [itemId]);

        // Recalcula totais
        const [[totais]] = await conn.query(`
            SELECT COALESCE(SUM(valor_total), 0) as total_pedido,
                   COUNT(*) as total_itens
            FROM erp_pedidos_itens 
            WHERE pedido_numero = ?
        `, [numero]);

        await conn.query(`
            UPDATE erp_pedidos_venda 
            SET valor_total = ?
            WHERE numero_pedido = ?
        `, [totais.total_pedido, numero]);

        await conn.commit();

        res.json({
            success: true,
            message: `Item ${item.item_seq} removido com sucesso!`,
            deletedItemId: parseInt(itemId, 10),
            total_pedido: totais.total_pedido
        });
    } catch (err) {
        await conn.rollback();
        console.error('Erro em DELETE /api/erp/pedidos/:numero/itens/:itemId:', err);
        res.status(500).json({ error: 'Falha ao remover item do pedido', detail: err.message });
    } finally {
        conn.release();
    }
});

// 9. PEDIDOS DE VENDA: Gravar Pedido com Validação Rígida e Transação ACID
router.post('/pedidos', async (req, res) => {
    const conn = await mysql.getConnection();
    try {
        const { cabecalho, itens } = req.body;

        if (!cabecalho) {
            return res.status(400).json({ error: 'Dados do cabeçalho do pedido não informados' });
        }

        // A. Validação Protheus-Grade
        const validacao = await ErpValidator.validarPedidoVenda(cabecalho, itens, conn);
        if (!validacao.valido) {
            return res.status(400).json({
                error: 'O pedido não passou nas validações de integridade',
                erros: validacao.erros
            });
        }

        await conn.beginTransaction();

        // Gerar ou validar número de pedido conforme padrão Protheus
        let numPedido = cabecalho.numero_pedido ? cabecalho.numero_pedido.trim().toUpperCase() : '';
        if (!numPedido) {
            numPedido = await getProximoNumeroPedido(conn);
        } else {
            // Validar ExistChav
            const [[existente]] = await conn.query('SELECT 1 FROM erp_pedidos_venda WHERE numero_pedido = ? LIMIT 1', [numPedido]);
            if (existente) {
                await conn.rollback();
                return res.status(400).json({ error: `O número de pedido "${numPedido}" já existe no banco de dados.` });
            }
        }

        // Calcular totais
        let valorTotal = 0;
        let pesoTotal = 0;

        for (const item of itens) {
            const qtd = parseFloat(item.quantidade) || 0;
            const preco = parseFloat(item.preco_unitario) || 0;
            valorTotal += (qtd * preco);

            const [[prodInfo]] = await conn.query('SELECT peso_liquido FROM erp_produtos WHERE codigo = ?', [item.produto_codigo]);
            pesoTotal += (qtd * (parseFloat(prodInfo?.peso_liquido) || 0));
        }

        valorTotal = parseFloat(valorTotal.toFixed(2));

        // Inserir Cabeçalho
        await conn.query(`
            INSERT INTO erp_pedidos_venda (
                numero_pedido, cliente_codigo, data_emissao, condicao_pagamento,
                valor_total, peso_total, tipo_frete, transportadora, status, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aberto', ?)
        `, [
            numPedido,
            cabecalho.cliente_codigo.trim(),
            cabecalho.data_emissao,
            cabecalho.condicao_pagamento || '',
            valorTotal,
            pesoTotal,
            cabecalho.tipo_frete || 'FOB',
            cabecalho.transportadora || '',
            cabecalho.observacoes || ''
        ]);

        // Inserir Itens do Grid com valor_total
        for (let i = 0; i < itens.length; i++) {
            const item = itens[i];
            const seq = String(i + 1).padStart(2, '0');
            const qtd = parseFloat(item.quantidade) || 0;
            const preco = parseFloat(item.preco_unitario) || 0;
            const itemSubtotal = parseFloat((qtd * preco).toFixed(2));

            await conn.query(`
                INSERT INTO erp_pedidos_itens (
                    pedido_numero, item_seq, produto_codigo, quantidade,
                    quantidade_entregue, preco_unitario, valor_total, data_entrega_prevista, status
                ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'aberto')
            `, [
                numPedido,
                seq,
                item.produto_codigo.trim(),
                qtd,
                preco,
                itemSubtotal,
                item.data_entrega_prevista || cabecalho.data_emissao
            ]);
        }

        await conn.commit();
        res.status(201).json({
            success: true,
            numero_pedido: numPedido,
            valor_total: valorTotal,
            itens_cadastrados: itens.length,
            message: `Pedido ${numPedido} gerado e gravado com sucesso no ERP nativo!`
        });

    } catch (err) {
        await conn.rollback();
        console.error('Erro na gravação transacional do pedido:', err);
        res.status(500).json({ error: 'Erro ao gravar pedido de venda no ERP', detail: err.message });
    } finally {
        conn.release();
    }
});

// 10. ESTRUTURA / BOM: Buscar componentes para explosão na OP
router.get('/estruturas/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const [componentes] = await mysql.query(`
            SELECT b.*, p.descricao as componente_descricao, p.tipo as componente_tipo,
                   p.peso_liquido, COALESCE(s.saldo_atual, 0) as saldo_estoque
            FROM erp_estruturas_bom b
            LEFT JOIN erp_produtos p ON b.produto_filho_codigo = p.codigo
            LEFT JOIN erp_estoque_saldos s ON b.produto_filho_codigo = s.produto_codigo AND s.armazem = '01'
            WHERE b.produto_pai_codigo = ?
            ORDER BY CAST(b.ordem_sequencia AS UNSIGNED) ASC
        `, [codigo]);

        res.json(componentes);
    } catch (err) {
        console.error('Erro em GET /api/erp/estruturas/:codigo:', err);
        res.status(500).json({ error: 'Erro ao buscar componentes da estrutura', detail: err.message });
    }
});

// 11. ORDENS DE PRODUÇÃO: Listar OPs com filtros e joins
router.get('/ordens-producao', async (req, res) => {
    try {
        const { search = '', status = '', limit = 50, offset = 0 } = req.query;
        let query = `
            SELECT op.*, p.descricao as produto_descricao, p.unidade_medida, p.tipo as produto_tipo,
                   p.peso_liquido, (op.quantidade_planejada * COALESCE(p.peso_liquido, 0)) as peso_total_planejado
            FROM erp_ordens_producao op
            LEFT JOIN erp_produtos p ON op.produto_codigo = p.codigo
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ' AND (op.numero_op LIKE ? OR op.produto_codigo LIKE ? OR p.descricao LIKE ? OR op.pedido_venda LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        if (status) {
            query += ' AND op.status = ?';
            params.push(status);
        }

        query += ' ORDER BY op.id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await mysql.query(query, params);

        // Contagem total para paginação
        let countQuery = 'SELECT COUNT(*) as total FROM erp_ordens_producao op LEFT JOIN erp_produtos p ON op.produto_codigo = p.codigo WHERE 1=1';
        const countParams = [];
        if (search) {
            countQuery += ' AND (op.numero_op LIKE ? OR op.produto_codigo LIKE ? OR p.descricao LIKE ? OR op.pedido_venda LIKE ?)';
            const term = `%${search}%`;
            countParams.push(term, term, term, term);
        }
        if (status) {
            countQuery += ' AND op.status = ?';
            countParams.push(status);
        }
        const [[countRes]] = await mysql.query(countQuery, countParams);

        res.json({
            total: countRes.total,
            rows
        });
    } catch (err) {
        console.error('Erro em GET /api/erp/ordens-producao:', err);
        res.status(500).json({ error: 'Erro ao listar ordens de produção', detail: err.message });
    }
});

// 12. ORDENS DE PRODUÇÃO: Abertura de Nova OP (MATA650 / SC2)
router.post('/ordens-producao', async (req, res) => {
    const conn = await mysql.getConnection();
    try {
        const validacao = await ErpValidator.validarOrdemProducao(req.body, conn);
        if (!validacao.valido) {
            return res.status(400).json({ error: 'Falha na validação da OP', erros: validacao.erros });
        }

        const {
            numero_op, produto_codigo, quantidade_planejada,
            pedido_venda = '', item_pedido = '', data_emissao,
            data_inicio_prevista = '', data_fim_prevista = '',
            prioridade = 'media', observacoes = ''
        } = req.body;

        await conn.beginTransaction();

        // Gerar número de OP se não fornecido
        let numOpFinal = numero_op ? numero_op.trim().toUpperCase() : '';
        if (!numOpFinal) {
            const [[maxOp]] = await conn.query('SELECT MAX(CAST(REGEXP_REPLACE(numero_op, "[^0-9]", "") AS UNSIGNED)) as max_num FROM erp_ordens_producao');
            const proximo = (maxOp?.max_num || 10000) + 1;
            numOpFinal = `OP-${String(proximo).padStart(6, '0')}`;
        }

        const [result] = await conn.query(`
            INSERT INTO erp_ordens_producao (
                numero_op, produto_codigo, quantidade_planejada, quantidade_produzida,
                quantidade_perdida, pedido_venda, item_pedido, data_emissao,
                data_inicio_prevista, data_fim_prevista, prioridade, status, observacoes
            ) VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 'aberta', ?)
        `, [
            numOpFinal,
            produto_codigo.trim().toUpperCase(),
            parseFloat(quantidade_planejada),
            pedido_venda.trim(),
            item_pedido.trim(),
            data_emissao,
            data_inicio_prevista || data_emissao,
            data_fim_prevista || data_emissao,
            prioridade,
            observacoes.trim()
        ]);

        await conn.commit();

        res.status(201).json({
            success: true,
            id: result.insertId,
            numero_op: numOpFinal,
            message: `Ordem de Produção ${numOpFinal} aberta com sucesso no ERP!`
        });

    } catch (err) {
        await conn.rollback();
        console.error('Erro ao abrir ordem de produção:', err);
        res.status(500).json({ error: 'Erro ao abrir ordem de produção', detail: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;


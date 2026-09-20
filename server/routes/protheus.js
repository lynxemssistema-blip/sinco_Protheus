const express = require('express');
const router = express.Router();
const protheusDB = require('../services/protheusDB');
const mysqlService = require('../services/mysqlService');
const opExplosionService = require('../services/opExplosionService');
const axios = require('axios');
const https = require('https');
const { hasFinancialAccess } = require('../util/permissionHelper');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Utilitário para rodar Queries no PostgreSQL do Protheus (Otimizado via Pool Central)
 */
async function queryProtheus(sql, params = []) {
    const res = await protheusDB.query(sql, params);
    return res.rows;
}

// =========================================================================
// ROTA: Buscar Produto Info (Fiscal/Logistica) para VB.NET
// =========================================================================
router.get('/produto-info/:codigo', async (req, res) => {
    try {
        const codigo = req.params.codigo;
        const codigoLimpo = String(codigo).toUpperCase().trim();
        const sql = `SELECT b1_posipi, b1_locpad, b1_origem, b1_finalid, b1_xcoddes FROM public.sb1010 WHERE TRIM(b1_cod) = $1 AND COALESCE(d_e_l_e_t_, '') = ''`;
        const prodRes = await queryProtheus(sql, [codigoLimpo]);
        if (prodRes.length > 0) {
            res.json({
                b1_posipi: prodRes[0].b1_posipi?.trim() || "00000000",
                b1_locpad: prodRes[0].b1_locpad?.trim() || "03",
                b1_origem: prodRes[0].b1_origem?.trim() || "0",
                b1_finalid: prodRes[0].b1_finalid?.trim() || "1",
                b1_xcoddes: prodRes[0].b1_xcoddes?.trim() || "",
                existe: true
            });
        } else {
            res.json({ b1_posipi: "00000000", b1_locpad: "03", b1_origem: "0", b1_finalid: "1", b1_xcoddes: "", existe: false });
        }
    } catch (err) {
        res.json({ b1_posipi: "00000000", b1_locpad: "03", b1_origem: "0", b1_finalid: "1", b1_xcoddes: "", existe: false });
    }
});

// =========================================================================
// ROTA: Buscar Associação Fornecedor x Produto (De/Para NF)
// =========================================================================
router.post('/de-para-produtos', async (req, res) => {
    try {
        const { cnpj, codigos_fornecedor, numero_nf } = req.body;
        if (!cnpj || !codigos_fornecedor || codigos_fornecedor.length === 0) {
            return res.json({});
        }

        const cleanCnpj = cnpj.replace(/\D/g, '');
        const sqlFornecedor = `SELECT trim(a2_cod) as a2_cod FROM public.sa2010 WHERE trim(a2_cgc) = $1 AND d_e_l_e_t_ = ' ' LIMIT 1`;
        const fornecedores = await queryProtheus(sqlFornecedor, [cleanCnpj]);

        if (fornecedores.length === 0) return res.json({});

        const a2_cod = fornecedores[0].a2_cod.trim();

        const inParams = codigos_fornecedor.map((_, i) => `$${i + 2}`).join(',');

        // Aplica TRIM no a5_fornece e a5_codprf
        const sqlAssociacao = `
            SELECT trim(a5_codprf) as a5_codprf, trim(a5_produto) as a5_produto 
            FROM public.sa5010 
            WHERE trim(a5_fornece) = $1 AND trim(a5_codprf) IN (${inParams}) AND d_e_l_e_t_ = ' '
        `;

        const params = [a2_cod, ...codigos_fornecedor.map(c => String(c).trim())];
        const associacoes = await queryProtheus(sqlAssociacao, params);

        const map = {};
        associacoes.forEach(a => {
            map[a.a5_codprf] = a.a5_produto;
        });

        // ==========================================
        // FALLBACK: Buscar na SD1010 (Notas Fiscais de Entrada)
        // Caso a amarração SA5010 esteja vazia, mas a nota já tenha sido importada no Protheus.
        // ==========================================
        if (numero_nf) {
            try {
                // Protheus d1_doc tem 9 posições com zeros à esquerda
                const docFormated = String(numero_nf).padStart(9, '0');
                const sqlSd1 = `SELECT d1_item, trim(d1_cod) as d1_cod FROM public.sd1010 WHERE trim(d1_doc) = $1 AND trim(d1_fornece) = $2 AND d_e_l_e_t_ = ' ' ORDER BY d1_item ASC`;
                const itensSd1 = await queryProtheus(sqlSd1, [docFormated, a2_cod]);

                // Mapeia pela sequência do item na nota (nItem XML -> d1_item)
                codigos_fornecedor.forEach((cProd, index) => {
                    if (!map[cProd]) {
                        const itemTarget = String(index + 1).padStart(4, '0');
                        const matchSd1 = itensSd1.find(i => i.d1_item === itemTarget);
                        if (matchSd1 && matchSd1.d1_cod) {
                            map[cProd] = matchSd1.d1_cod;
                        }
                    }
                });
            } catch (e) {
                console.error('Erro ao buscar Fallback SD1010:', e);
            }
        }

        res.json(map);
    } catch (error) {
        console.error('Erro ao buscar de/para de produtos:', error);
        res.status(500).json({ error: 'Erro ao buscar associação de produtos.' });
    }
});

// =========================================================================
// ROTA: Buscar Pedido de Compra (SC7010)
// =========================================================================
router.get('/pedido/:numero', async (req, res) => {
    try {
        const { numero } = req.params;
        const numFormatado = String(numero).padStart(6, '0');

        const sql = `
            SELECT 
                trim(c7_produto) as c7_produto, 
                trim(c7_descri) as c7_descri, 
                c7_quant, 
                c7_preco, 
                c7_total, 
                c7_quje,
                c7_emissao,
                trim(c7_fornece) as c7_fornece,
                trim(c7_loja) as c7_loja,
                trim(c7_item) as c7_item
            FROM public.sc7010
            WHERE c7_num = $1 AND d_e_l_e_t_ = ' '
            ORDER BY c7_item ASC
        `;
        const itens = await queryProtheus(sql, [numFormatado]);

        if (itens.length === 0) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }

        const canViewFinancials = await hasFinancialAccess(req);
        const result = canViewFinancials
            ? itens
            : itens.map(({ c7_preco, c7_total, ...rest }) => rest);

        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar pedido SC7:', error);
        res.status(500).json({ error: 'Erro ao buscar pedido.' });
    }
});

// =========================================================================
// ROTA: Buscar Listas (Combos de Grupo, Tipo e UM)
// =========================================================================
router.get('/dropdowns', async (req, res) => {
    try {
        const sqlGrupo = `SELECT bm_grupo AS codigo, bm_desc AS descricao FROM public.sbm010 WHERE d_e_l_e_t_ = ' ' ORDER BY bm_grupo`;
        const sqlTipo = `SELECT x5_chave AS codigo, x5_descri AS descricao FROM public.sx5010 WHERE x5_tabela = '02' AND d_e_l_e_t_ = ' ' ORDER BY x5_chave`;
        const sqlUM = `SELECT ah_unimed AS codigo, ah_umres AS descricao FROM public.sah010 WHERE d_e_l_e_t_ = ' ' ORDER BY ah_unimed`;

        // Executa em paralelo
        const [grupos, tipos, ums] = await Promise.all([
            queryProtheus(sqlGrupo),
            queryProtheus(sqlTipo),
            queryProtheus(sqlUM)
        ]);

        res.json({
            grupos: grupos.map(g => ({ code: g.codigo?.trim(), label: g.descricao?.trim() })),
            tipos: tipos.map(t => ({ code: t.codigo?.trim(), label: t.descricao?.trim() })),
            ums: ums.map(u => ({ code: u.codigo?.trim(), label: u.descricao?.trim() }))
        });
    } catch (error) {
        console.error('Erro ao buscar Dropdowns no Protheus PG:', error.message);
        res.status(500).json({ error: 'Falha ao recuperar listas.' });
    }
});

// =========================================================================
// ROTA: Listagem Completa de Produtos (DataGrid inferior)
// =========================================================================
router.get('/produtos', async (req, res) => {
    try {
        // Limitado a 1000 linhas inicialmente para não quebrar a UI
        const sql = `
            SELECT b1_cod AS codigo, b1_desc AS descricao, b1_tipo AS tipo, b1_um AS um, b1_grupo AS grupo
            FROM public.sb1010
            WHERE d_e_l_e_t_ = ' '
            ORDER BY b1_cod DESC
            LIMIT 1000
        `;
        const rows = await queryProtheus(sql);
        res.json(rows.map(r => ({
            codigo: r.codigo?.trim(),
            descricao: r.descricao?.trim(),
            tipo: r.tipo?.trim(),
            um: r.um?.trim(),
            grupo: r.grupo?.trim()
        })));
    } catch (error) {
        console.error('Erro ao buscar produtos do Protheus:', error.message);
        res.status(500).json({ error: 'Falha na busca de Cadastros.' });
    }
});

// =========================================================================
// ROTA: Inserir novo Produto via API POST Originária
// =========================================================================
router.post('/produtos/create', async (req, res) => {
    try {
        const { titulo, codigoDesenho, revisao, peso, grupo, tipo, um } = req.body;

        if (!titulo || !grupo || !tipo || !um) {
            return res.status(400).json({ error: 'Grupo, Tipo, UM e Título são campos obrigatórios.' });
        }

        // 1. Requisitar Token (Login)
        let accessToken = '';
        try {
            const tokenUrl = 'https://192.168.1.60:47500/tlpp/oauth2/token?grant_type=password&username=sinco&password=Metal1120';
            const tokenRes = await axios.get(tokenUrl, { httpsAgent, timeout: 10000 });
            accessToken = tokenRes.data.access_token;
        } catch (authError) {
            throw new Error('Falha de Login (Obtenção de Token) na API Protheus: ' + authError.message);
        }

        if (!accessToken) {
            throw new Error('Token JWT retornado estava em branco.');
        }

        // 2. Limpeza de Strings
        let tituloLimpo = (titulo || '').toUpperCase().trim();
        tituloLimpo = tituloLimpo.replace(/"/g, '\\"').replace(/\r\n/g, ' ').replace(/\n/g, ' ');

        let codDesHigienizado = (codigoDesenho || 'desenho_metalfisa').trim();
        codDesHigienizado = codDesHigienizado.replace(/"/g, '\\"').replace(/\r\n/g, ' ').replace(/\n/g, ' ');

        const numPeso = parseFloat(peso) || 0;

        // 3. Montagem do Payload
        const payload = {
            data: {
                produtos: [
                    {
                        EMPRESA: "01",
                        CFILANT: "01",
                        B1_GRUPO: grupo.split(/[\-\s]/)[0], // Extrai só prefixo antes do hifen
                        B1_DESC: tituloLimpo,
                        B1_XREVM: (revisao || '').trim(),
                        B1_TIPO: tipo.split(/[\-\s]/)[0],
                        B1_UM: um.split(/[\-\s]/)[0],
                        B1_LOCPAD: "03",
                        B1_POSIPI: "00000000",
                        B1_FINALID: "1",
                        B1_ORIGEM: "0",
                        B1_XCODDES: codDesHigienizado,
                        B1_PESO: numPeso,
                        B1_PESBRU: numPeso
                    }
                ]
            }
        };

        // 4. Envio POST
        const createUrl = 'https://192.168.1.60:47500/produtos/create';
        const createRes = await axios.post(createUrl, payload, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            httpsAgent,
            timeout: 15000
        });

        // 5. Analise Resposta. B1_COD geralmente vem de volta no body JSON
        const responseData = createRes.data;
        const codigoGerado = responseData.B1_COD || responseData.data?.B1_COD || null;

        if (codigoGerado) {
            res.json({ success: true, codigo: codigoGerado, mensagem: `Produto Criado. Renomeie o Desenho para: ${codigoGerado}`, raw: responseData });
        } else {
            // Em caso de API mutável ou diferente, retorna pra front-end analisar o raw
            res.json({ success: true, codigo: 'SUCESSO_VER_RETORNO', mensagem: 'Resposta irregular obtida da Totvs. Vide Console.', raw: responseData });
        }

    } catch (error) {
        console.error('Protheus Integrador Erro:', error.response?.data || error.message);
        res.status(500).json({ error: 'Erro ao Submeter Produto à API.', details: error.response?.data || error.message });
    }
});

// =========================================================================
// ROTA: Editar/Atualizar Produto via API POST
// =========================================================================
router.post('/produtos/update', async (req, res) => {
    try {
        console.log('\n======================================================');
        console.log('[PRODUTOS UPDATE] INICIANDO REQUISIÇÃO DE EDIÇÃO...');
        console.log('[PRODUTOS UPDATE] Payload recebido do frontend:', JSON.stringify(req.body, null, 2));
        
        const {
            codigo,
            titulo,
            grupo,
            tipo,
            um,
            revisao,
            codigoDesenho,
            peso,
            comprimento,
            largura,
            espessura,
            area
        } = req.body;

        if (!codigo || !titulo || !grupo || !tipo || !um) {
            return res.status(400).json({ 
                success: false,
                error: 'Código, Grupo, Tipo, UM e Título são campos obrigatórios.',
                frontendPayload: req.body,
                endpoint: '/api/protheus/produtos/update',
                timestamp: new Date().toISOString()
            });
        }

        // 1. Requisitar Token (Login)
        let accessToken = '';
        try {
            const tokenUrl = 'https://192.168.1.60:47500/tlpp/oauth2/token?grant_type=password&username=sinco&password=Metal1120';
            const tokenRes = await axios.get(tokenUrl, { httpsAgent, timeout: 10000 });
            accessToken = tokenRes.data.access_token;
        } catch (authError) {
            throw new Error('Falha de Login (Obtenção de Token) na API Protheus: ' + authError.message);
        }

        if (!accessToken) {
            throw new Error('Token JWT retornado estava em branco.');
        }

        console.log('[PRODUTOS UPDATE] Token JWT obtido com sucesso!');

        // 2. Limpeza e Formatação
        let tituloLimpo = (titulo || '').toUpperCase().trim();
        tituloLimpo = tituloLimpo.replace(/"/g, '\\"').replace(/\r\n/g, ' ').replace(/\n/g, ' ');

        let codDesHigienizado = (codigoDesenho || 'desenho_metalfisa').trim();
        codDesHigienizado = codDesHigienizado.replace(/"/g, '\\"').replace(/\r\n/g, ' ').replace(/\n/g, ' ');

        const numPeso = parseFloat(peso) || 0;
        const numComprimento = parseFloat(comprimento) || 0;
        const numLargura = parseFloat(largura) || 0;
        const numEspessura = parseFloat(espessura) || 0;
        const numArea = parseFloat(area) || 0; // Area = B5_VOLUME no desktop app

        // 2.5 Resgatar valores originais (Fiscal/Logística e Desenho) para não sobrescrever
        let b1_posipi = "00000000";
        let b1_locpad = "03";
        let b1_origem = "0";
        let b1_finalid = "1";
        let b1_xcoddes = codDesHigienizado; // Usa o novo caso não encontre
        let noperVal = "3"; // Por padrao assume Novo

        try {
            const prodRes = await queryProtheus(`SELECT b1_posipi, b1_locpad, b1_origem, b1_finalid, b1_xcoddes FROM public.sb1010 WHERE TRIM(b1_cod) = $1 AND COALESCE(d_e_l_e_t_, '') = ''`, [String(codigo).toUpperCase().trim()]);
            if (prodRes.length > 0) {
                b1_posipi = (prodRes[0].b1_posipi || b1_posipi).trim();
                b1_locpad = (prodRes[0].b1_locpad || b1_locpad).trim();
                b1_origem = (prodRes[0].b1_origem || b1_origem).trim();
                b1_finalid = (prodRes[0].b1_finalid || b1_finalid).trim();
                // Se houver código de desenho original no banco, priorizamos ele para não perder:
                b1_xcoddes = (prodRes[0].b1_xcoddes || b1_xcoddes).trim();
                noperVal = "4"; // Produto Existe, faremos Update!
            }
        } catch (dbErr) {
            console.error('Aviso: Erro ao resgatar valores fiscais antigos do Produto, usando fallback padrão:', dbErr.message);
        }

        // 3. Montagem do Payload Exatamente igual ao Desktop
        const payload = {
            data: {
                produtos: [
                    {
                        EMPRESA: "01",
                        CFILANT: "01",
                        NOPER: noperVal,
                        B1_COD: String(codigo).toUpperCase().trim(),
                        B1_GRUPO: grupo.split(/[\-\s]/)[0],
                        B1_DESC: tituloLimpo,
                        B1_XREVM: (revisao || '').trim(),
                        B1_TIPO: tipo.split(/[\-\s]/)[0],
                        B1_UM: um.split(/[\-\s]/)[0],
                        B1_LOCPAD: b1_locpad,
                        B1_POSIPI: b1_posipi,
                        B1_FINALID: b1_finalid,
                        B1_ORIGEM: b1_origem,
                        B1_XCODDES: b1_xcoddes,
                        B1_PESO: numPeso,
                        B1_PESBRU: numPeso,
                        B5_CEME: tituloLimpo,
                        B5_COMPR: numComprimento,
                        B5_LARG: numLargura,
                        B5_ESPESS: numEspessura,
                        B5_VOLUME: numArea
                    }
                ]
            }
        };

        console.log('[PRODUTOS UPDATE] Payload formatado para enviar ao Protheus:');
        console.log(JSON.stringify(payload, null, 2));

        // 4. Envio POST
        const createUrl = 'https://192.168.1.60:47500/produtos/create';
        console.log(`[PRODUTOS UPDATE] Enviando POST para: ${createUrl}`);
        const createRes = await axios.post(createUrl, payload, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            httpsAgent,
            timeout: 15000
        });

        const responseData = createRes.data;
        
        console.log('[PRODUTOS UPDATE] Resposta da TOTVS Protheus recebida:');
        console.log(JSON.stringify(responseData, null, 2));
        console.log('======================================================\n');

        res.json({ 
            success: true, 
            message: 'Produto salvo/atualizado no Protheus.', 
            endpoint: '/api/protheus/produtos/update',
            timestamp: new Date().toISOString(),
            protheusRawResponse: responseData,
            protheusPayload: payload,
            frontendPayload: req.body,
            raw: responseData 
        });

    } catch (error) {
        console.error('Protheus Integrador Erro [Update Produto]:', error.response?.data || error.message);
        console.error('Stack:', error.stack);
        const errDetails = error.response?.data || error.message;
        res.status(error.response?.status || 500).json({ 
            success: false,
            error: 'Erro ao Atualizar Produto na API Protheus.', 
            message: error.message,
            details: errDetails,
            protheusRawResponse: error.response?.data || null,
            protheusPayload: typeof payload !== 'undefined' ? payload : null,
            frontendPayload: req.body,
            endpoint: '/api/protheus/produtos/update',
            timestamp: new Date().toISOString(),
            stack: error.stack
        });
    }
});

// =========================================================================
// ROTA: Gerar Ordem de Producao 100% no Banco Novo (MySQL erp_ordens_producao)
// SEM VÍNCULO COM O PROTHEUS (Independente de TLPP, Webservice ou Protheus Online)
// =========================================================================
router.post('/ordem-producao/incluir', async (req, res) => {
    const conn = await mysqlService.getConnection();
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Nenhum item informado para gerar O.P.' });
        }

        await conn.beginTransaction();

        // 1. Descobrir o próximo número base sequencial da OP no Banco Novo (MySQL)
        const [[maxRow]] = await conn.query(`
            SELECT MAX(CAST(SUBSTRING(numero_op, 1, 6) AS UNSIGNED)) as max_base 
            FROM erp_ordens_producao 
            WHERE numero_op REGEXP '^[0-9]{6}' AND CAST(SUBSTRING(numero_op, 1, 6) AS UNSIGNED) < 900000
        `);
        let baseOpNum = parseInt(maxRow?.max_base || 6805, 10);

        // Mapeamento de Pedido -> Número Base da OP (para garantir que itens do mesmo pedido compartilhem a mesma base de 6 dígitos)
        const pedidoBaseMap = new Map();

        const getBaseOpForPedido = async (pedStr) => {
            if (pedStr && pedidoBaseMap.has(pedStr)) {
                return pedidoBaseMap.get(pedStr);
            }

            // A. Se o pedido já possui alguma OP gravada em erp_ordens_producao, reaproveitar a mesma base de 6 dígitos
            if (pedStr) {
                const [[existingOpRow]] = await conn.query(`
                    SELECT SUBSTRING(numero_op, 1, 6) as base_op
                    FROM erp_ordens_producao
                    WHERE (pedido_venda = ? OR pedido_venda = ?)
                      AND numero_op REGEXP '^[0-9]{6}'
                    LIMIT 1
                `, [pedStr, parseInt(pedStr, 10) || 0]);

                if (existingOpRow?.base_op) {
                    const base = existingOpRow.base_op;
                    pedidoBaseMap.set(pedStr, base);
                    return base;
                }
            }

            // B. Caso contrário, encontrar próxima base sequencial não utilizada
            while (true) {
                baseOpNum += 1;
                const candidateBase = String(baseOpNum).padStart(6, '0');
                const [[usedRow]] = await conn.query(`
                    SELECT id FROM erp_ordens_producao 
                    WHERE numero_op LIKE ? LIMIT 1
                `, [`${candidateBase}%`]);

                if (!usedRow) {
                    if (pedStr) pedidoBaseMap.set(pedStr, candidateBase);
                    return candidateBase;
                }
            }
        };

        const ordensProducao = [];
        const todayStr = new Date().toISOString().split('T')[0];

        for (const it of items) {
            const pedidoStr = String(it.pedido || '').trim().padStart(6, '0');
            const itemPvStr = String(it.itempv || '01').trim().padStart(2, '0');
            let produto = String(it.produto || '').trim();
            const quantFinal = parseFloat(it.quant) || 0;

            if (quantFinal <= 0) {
                console.log(`[OP BUILDER - NOVO BANCO] Pulo item ${itemPvStr} do Pedido ${pedidoStr}: quantidade inválida (${quantFinal}).`);
                continue;
            }

            // Se produto não veio no payload, busca na tabela de itens do novo banco
            if (!produto) {
                const [[prodRow]] = await conn.query(
                    `SELECT produto_codigo FROM erp_pedidos_itens WHERE (pedido_numero = ? OR pedido_numero = ?) AND (item_seq = ? OR CAST(item_seq AS UNSIGNED) = CAST(? AS UNSIGNED)) LIMIT 1`,
                    [pedidoStr, parseInt(pedidoStr, 10), itemPvStr, parseInt(itemPvStr, 10)]
                );
                if (prodRow?.produto_codigo) {
                    produto = prodRow.produto_codigo.trim();
                }
            }

            // Formatação de datas
            const formatData = (d) => {
                if (!d) return todayStr;
                const s = String(d).trim().replace(/\D/g, '');
                if (s.length === 8) {
                    return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
                }
                return String(d).split('T')[0] || todayStr;
            };

            const dataInicio = formatData(it.datpri);
            const dataFim = formatData(it.datprf);

            // -------------------------------------------------------------------------
            // CONTROLE DE SALDO E FRACIONAMENTO INDUSTRIAL DE ITENS DO PEDIDO DE VENDA
            // -------------------------------------------------------------------------
            let totalQtdOriginal = quantFinal;
            let precoUnitario = 0.01;

            // 1. Busca quantidade total original e preço no Postgres (sc6010) ou fallback MySQL
            try {
                const sc6Rows = await queryProtheus(
                    'SELECT c6_qtdven, c6_prcven FROM public.sc6010 WHERE c6_num = $1 AND (c6_item = $2 OR CAST(c6_item AS INT) = $3)',
                    [pedidoStr, itemPvStr, parseInt(itemPvStr, 10) || 0]
                );
                if (sc6Rows && sc6Rows.length > 0) {
                    totalQtdOriginal = parseFloat(sc6Rows[0].c6_qtdven) || quantFinal;
                    precoUnitario = parseFloat(sc6Rows[0].c6_prcven) || 0.01;
                }
            } catch (pgErr) {
                // Postgres indisponível ou timeout
            }

            // Fallback MySQL para obter a quantidade total original do pedido
            try {
                const [[itRow]] = await conn.query(
                    'SELECT quantidade, quantidade_original, preco_unitario FROM erp_pedidos_itens WHERE (pedido_numero = ? OR pedido_numero = ?) AND item_seq = ?',
                    [pedidoStr, parseInt(pedidoStr, 10) || 0, itemPvStr]
                );
                if (itRow) {
                    if (itRow.quantidade_original && parseFloat(itRow.quantidade_original) > 0) {
                        totalQtdOriginal = parseFloat(itRow.quantidade_original);
                    } else if (!totalQtdOriginal || totalQtdOriginal === quantFinal) {
                        // Soma de todas as frações já criadas para este item base (ex: 01 + 01A)
                        const [myFracs] = await conn.query(`
                            SELECT SUM(quantidade) as soma_qtd, MAX(quantidade_original) as max_orig
                            FROM erp_pedidos_itens 
                            WHERE (pedido_numero = ? OR pedido_numero = ?) 
                              AND (item_seq = ? OR item_seq LIKE ?)
                        `, [pedidoStr, parseInt(pedidoStr, 10) || 0, itemPvStr, `${itemPvStr}%`]);

                        if (myFracs[0]?.max_orig && parseFloat(myFracs[0].max_orig) > 0) {
                            totalQtdOriginal = parseFloat(myFracs[0].max_orig);
                        } else if (myFracs[0]?.soma_qtd && parseFloat(myFracs[0].soma_qtd) > 0) {
                            totalQtdOriginal = Math.max(totalQtdOriginal, parseFloat(myFracs[0].soma_qtd));
                        } else if (itRow.quantidade) {
                            totalQtdOriginal = parseFloat(itRow.quantidade);
                        }
                    }
                    if (itRow.preco_unitario) precoUnitario = parseFloat(itRow.preco_unitario);
                }
            } catch (myErr) {
                console.warn('⚠️ [OP INCLUIR] Erro ao consultar erp_pedidos_itens:', myErr.message);
            }

            // 2. Busca OPs já geradas no sistema para este item base e suas frações
            // CRÍTICO: Filtrar por produto_codigo = produto e is_sub_op = 0 para NÃO somar sub-OPs de componentes da BOM
            const [existingOps] = await conn.query(`
                SELECT numero_op, item_pedido, quantidade_planejada 
                FROM erp_ordens_producao 
                WHERE (pedido_venda = ? OR pedido_venda = ?)
                  AND (item_pedido = ? OR item_pedido LIKE ?)
                  AND produto_codigo = ?
                  AND (is_sub_op = 0 OR is_sub_op IS NULL)
            `, [pedidoStr, parseInt(pedidoStr, 10) || 0, itemPvStr, `${itemPvStr}%`, produto]);

            let totalJaEmOp = existingOps.reduce((sum, o) => sum + (parseFloat(o.quantidade_planejada) || 0), 0);

            // Se não encontrou em erp_ordens_producao, verifica em sc2010 (apenas produto pai / c2_sequen = '001')
            if (totalJaEmOp <= 0) {
                const [sc2Ops] = await conn.query(`
                    SELECT c2_quant
                    FROM sc2010
                    WHERE (c2_pedido = ? OR c2_pedido = ?)
                      AND (c2_itempv = ? OR c2_itempv LIKE ?)
                      AND (c2_produto = ? OR c2_sequen = '001')
                `, [pedidoStr, parseInt(pedidoStr, 10) || 0, itemPvStr, `${itemPvStr}%`, produto]);
                totalJaEmOp = sc2Ops.reduce((sum, o) => sum + (parseFloat(o.c2_quant) || 0), 0);
            }

            const saldoDisponivel = Math.max(0, totalQtdOriginal - totalJaEmOp);

            // Validação 1: Bloqueia se a quantidade total do pedido já estiver 100% coberta por OPs
            if (totalJaEmOp >= totalQtdOriginal && totalQtdOriginal > 0) {
                await conn.rollback();
                return res.status(400).json({
                    error: `O item ${itemPvStr} do Pedido ${pedidoStr} já possui 100% de sua quantidade (${totalQtdOriginal.toLocaleString('pt-BR')} un) coberta por Ordem de Produção. Não há saldo restante para emitir nova OP.`
                });
            }

            // Validação 2: Bloqueia se a quantidade solicitada exceder o saldo disponível do pedido
            if (quantFinal > saldoDisponivel + 0.01 && saldoDisponivel > 0) {
                await conn.rollback();
                return res.status(400).json({
                    error: `A quantidade solicitada (${quantFinal.toLocaleString('pt-BR')} un) excede o saldo restante do pedido (${saldoDisponivel.toLocaleString('pt-BR')} un) para o item ${itemPvStr}.`
                });
            }

            let targetItemPv = itemPvStr;
            let isFracionado = false;

            // Se a quantidade solicitada for menor que o total do pedido OU já houver OP anterior gerada,
            // ativa o fracionamento industrial com sufixo alfabético (ex: 01A, 01B, 01C...)
            if (totalJaEmOp > 0 || quantFinal < totalQtdOriginal) {
                isFracionado = true;

                // Consulta letras de frações já usadas no pedido (01A, 01B...)
                const [existingItems] = await conn.query(`
                    SELECT item_seq FROM erp_pedidos_itens 
                    WHERE (pedido_numero = ? OR pedido_numero = ?) 
                      AND (item_seq = ? OR item_seq LIKE ?)
                    ORDER BY item_seq ASC
                `, [pedidoStr, parseInt(pedidoStr, 10) || 0, itemPvStr, `${itemPvStr}%`]);

                const usedLetters = new Set();
                existingItems.forEach(i => {
                    const seq = String(i.item_seq).trim();
                    if (seq.startsWith(itemPvStr) && seq.length > itemPvStr.length) {
                        usedLetters.add(seq.substring(itemPvStr.length).toUpperCase());
                    }
                });

                existingOps.forEach(o => {
                    const ip = String(o.item_pedido || '').trim();
                    if (ip.startsWith(itemPvStr) && ip.length > itemPvStr.length) {
                        usedLetters.add(ip.substring(itemPvStr.length).toUpperCase());
                    }
                });

                let charCode = 65; // 'A'
                while (usedLetters.has(String.fromCharCode(charCode))) {
                    charCode++;
                }
                targetItemPv = `${itemPvStr}${String.fromCharCode(charCode)}`;

                const saldoRestanteAposOp = Math.max(0, totalQtdOriginal - totalJaEmOp - quantFinal);
                console.log(`⚡ [OP FRACIONAMENTO] Pedido ${pedidoStr}: Item ${itemPvStr} original ${totalQtdOriginal}. Criando fração ${targetItemPv} com ${quantFinal} un. Saldo restante: ${saldoRestanteAposOp}.`);

                // Passo 1: Preserva quantidade_original no item original, atualiza o saldo e mantém SEM OP vinculada
                await conn.query(`
                    UPDATE erp_pedidos_itens 
                    SET quantidade_original = COALESCE(quantidade_original, ?),
                        quantidade = ?,
                        quantidade_saldo = ?,
                        numero_op_gerada = NULL,
                        status = ?
                    WHERE (pedido_numero = ? OR pedido_numero = ?) AND item_seq = ?
                `, [totalQtdOriginal, saldoRestanteAposOp, saldoRestanteAposOp, saldoRestanteAposOp > 0 ? 'aberto' : 'em_producao', pedidoStr, parseInt(pedidoStr, 10) || 0, itemPvStr]);

                // Passo 2: Adiciona o item fracionado (ex: 01A, 01B) ao pedido no banco
                await conn.query(`
                    INSERT INTO erp_pedidos_itens (
                        pedido_numero, item_seq, produto_codigo, quantidade, quantidade_original,
                        quantidade_entregue, quantidade_saldo, preco_unitario, valor_total,
                        data_entrega_prevista, status
                    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'em_producao')
                    ON DUPLICATE KEY UPDATE
                        quantidade = VALUES(quantidade),
                        quantidade_original = VALUES(quantidade_original),
                        quantidade_saldo = VALUES(quantidade_saldo),
                        status = 'em_producao'
                `, [
                    pedidoStr,
                    targetItemPv,
                    produto,
                    quantFinal,
                    totalQtdOriginal,
                    quantFinal,
                    precoUnitario,
                    precoUnitario * quantFinal,
                    dataFim
                ]);
            } else {
                // OP cobrindo 100% do saldo de uma vez na primeira emissão
                await conn.query(`
                    UPDATE erp_pedidos_itens 
                    SET quantidade_original = COALESCE(quantidade_original, ?),
                        quantidade_saldo = 0
                    WHERE (pedido_numero = ? OR pedido_numero = ?) AND item_seq = ?
                `, [totalQtdOriginal, pedidoStr, parseInt(pedidoStr, 10) || 0, itemPvStr]);
            }

            // 3. Obter base de 6 dígitos unificada para o pedido e compor número completo da OP normal
            const nextOpStr = await getBaseOpForPedido(pedidoStr);
            const fullOp = `${nextOpStr}${targetItemPv}001`;

            // 4. Gravar Ordem de Produção no Banco Novo (erp_ordens_producao)
            await conn.query(`
                INSERT INTO erp_ordens_producao (
                    numero_op, produto_codigo, quantidade_planejada, quantidade_produzida,
                    quantidade_perdida, pedido_venda, item_pedido, data_emissao,
                    data_inicio_prevista, data_fim_prevista, prioridade, status, observacoes
                ) VALUES (?, ?, ?, 0, 0, ?, ?, CURRENT_DATE, ?, ?, 5, 'aberta', ?)
                ON DUPLICATE KEY UPDATE
                    produto_codigo = VALUES(produto_codigo),
                    quantidade_planejada = VALUES(quantidade_planejada),
                    pedido_venda = VALUES(pedido_venda),
                    item_pedido = VALUES(item_pedido),
                    data_inicio_prevista = VALUES(data_inicio_prevista),
                    data_fim_prevista = VALUES(data_fim_prevista),
                    status = 'aberta',
                    observacoes = VALUES(observacoes)
            `, [
                fullOp,
                produto,
                quantFinal,
                pedidoStr,
                targetItemPv,
                dataInicio,
                dataFim,
                ((it.obs || '').trim() + (isFracionado ? ` [Item Fracionado ${targetItemPv}]` : '')).trim()
            ]);

            // 4.1 Gravar Espelho da OP em sc2010
            await conn.query(`
                INSERT INTO sc2010 (
                    c2_filial, c2_num, c2_item, c2_sequen, c2_produto,
                    c2_local, c2_quant, c2_um, c2_datpri, c2_datprf,
                    c2_obs, c2_emissao, c2_prior, c2_quje, c2_status,
                    c2_perda, c2_roteiro, c2_recurso, c2_pedido, c2_itempv,
                    c2_tpop, c2_op, d_e_l_e_t_
                ) VALUES (
                    '0101', ?, ?, '001', ?,
                    '01', ?, 'UN', ?, ?,
                    ?, DATE_FORMAT(CURRENT_DATE, '%Y%m%d'), '500', 0, 'P',
                    0, '01', '', ?, ?,
                    'F', ?, ''
                ) ON DUPLICATE KEY UPDATE
                    c2_quant = VALUES(c2_quant),
                    c2_datpri = VALUES(c2_datpri),
                    c2_datprf = VALUES(c2_datprf),
                    c2_obs = VALUES(c2_obs),
                    c2_status = 'P'
            `, [
                nextOpStr,
                targetItemPv,
                produto,
                quantFinal,
                dataInicio.replace(/-/g, ''),
                dataFim.replace(/-/g, ''),
                ((it.obs || '').trim() + (isFracionado ? ` [Item Fracionado ${targetItemPv}]` : '')).trim(),
                pedidoStr,
                targetItemPv,
                fullOp
            ]);

            // 5. Atualizar o item correspondente com o número da OP gerada
            await conn.query(`
                UPDATE erp_pedidos_itens 
                SET numero_op_gerada = ?, status = 'em_producao'
                WHERE (pedido_numero = ? OR pedido_numero = ?) 
                  AND item_seq = ?
            `, [fullOp, pedidoStr, parseInt(pedidoStr, 10), targetItemPv]);

            // 6. Atualizar ou inserir tabela de previsões de entrega app_pcp_delivery_forecasts para o item específico
            const fractionLetter = isFracionado ? targetItemPv.substring(itemPvStr.length) : null;
            await conn.query(`
                INSERT INTO app_pcp_delivery_forecasts (
                    pedido, item, data_entrega_pcp, quantidade_pcp, usuario,
                    observacao, op_protheus, numero_lote, lote
                ) VALUES (?, ?, ?, ?, 'Gestão PCP', ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    data_entrega_pcp = VALUES(data_entrega_pcp),
                    quantidade_pcp = VALUES(quantidade_pcp),
                    op_protheus = VALUES(op_protheus),
                    numero_lote = VALUES(numero_lote),
                    lote = VALUES(lote)
            `, [
                pedidoStr,
                targetItemPv,
                dataFim,
                quantFinal,
                ((it.obs || '').trim() + (isFracionado ? ` [Item Fracionado ${targetItemPv}]` : '')).trim(),
                fullOp,
                fractionLetter,
                fractionLetter ? `Lote ${fractionLetter}` : null
            ]);

            // 7. Atualizar status do pedido pai para 'em_producao'
            await conn.query(`
                UPDATE erp_pedidos_venda 
                SET status = 'em_producao' 
                WHERE (numero_pedido = ? OR numero_pedido = ?) AND status = 'aberto'
            `, [pedidoStr, parseInt(pedidoStr, 10)]);

            // 8. Explodir materiais (SD4) e operações (SH6) industriais de forma síncrona/transacional
            const explosionResult = await opExplosionService.explodirOrdemProducao({
                numero_op: fullOp,
                produto_codigo: produto,
                quantidade: quantFinal,
                pedido_venda: pedidoStr,
                item_pedido: targetItemPv,
                data_inicio: dataInicio,
                data_fim: dataFim,
                conn
            });

            console.log(`✅ [OP BANCO NOVO] OP ${fullOp} gerada para Pedido ${pedidoStr} Item ${targetItemPv} (${quantFinal} un):`, {
                materiais: explosionResult?.total_materiais || 0,
                operacoes: explosionResult?.total_operacoes || 0,
                sub_ops: explosionResult?.sub_ops?.length || 0
            });

            ordensProducao.push({
                pedido: pedidoStr,
                item: targetItemPv,
                item_original: itemPvStr,
                is_fracionado: isFracionado,
                op_base: nextOpStr,
                op_num: fullOp,
                op_completa: fullOp,
                produto: produto,
                quantidade: quantFinal,
                materiais_empenhados: explosionResult?.total_materiais || 0,
                operacoes_instanciadas: explosionResult?.total_operacoes || 0,
                sub_ops: explosionResult?.sub_ops || []
            });
        }

        if (ordensProducao.length === 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Nenhum item com quantidade válida para gerar O.P.' });
        }

        await conn.commit();

        res.json({
            success: true,
            banco: 'MySQL (erp_ordens_producao - 100% Independente do Protheus)',
            message: 'Ordem(ns) de Produção gerada(s) com sucesso no Banco Novo (MySQL)!',
            op_number: ordensProducao[0].op_num,
            generated_ops: ordensProducao
        });

    } catch (error) {
        await conn.rollback();
        console.error('[OP BANCO NOVO] Erro ao gerar OP:', error.message);
        res.status(500).json({ error: 'Erro ao gerar O.P. no banco novo.', details: error.message });
    } finally {
        conn.release();
    }
});

// =========================================================================
// ROTA: Editar Estrutura de Produtos via API POST
// =========================================================================
router.post('/estrutura-produtos/editar', async (req, res) => {
    try {
        const { noper, empresa, filial, produto, quantidade, estrutura } = req.body;

        if (!produto || !estrutura || !Array.isArray(estrutura)) {
            return res.status(400).json({ 
                success: false,
                error: 'Produto e estrutura são obrigatórios.',
                frontendPayload: req.body,
                endpoint: '/api/protheus/estrutura-produtos/editar',
                timestamp: new Date().toISOString()
            });
        }

        // 1. Requisitar Token (Login)
        let accessToken = '';
        try {
            const tokenUrl = 'https://192.168.1.60:47500/tlpp/oauth2/token?grant_type=password&username=sinco&password=Metal1120';
            const tokenRes = await axios.get(tokenUrl, { httpsAgent, timeout: 10000 });
            accessToken = tokenRes.data.access_token;
        } catch (authError) {
            throw new Error('Falha de Login (Obtenção de Token) na API Protheus: ' + authError.message);
        }

        if (!accessToken) {
            throw new Error('Token JWT retornado estava em branco.');
        }

        // 2. Montagem do Payload
        const payload = {
            data: {
                NOPER: noper || 4, // 4 = Alterar (default), 3 = Incluir
                EMPRESA: empresa || "01",
                CFILANT: filial || "0101",
                G1_COD: produto,
                G1_QUANT: quantidade || 1,
                AUTOREV: false,
                estrutura: estrutura.map(item => {
                    let trt = item.G1_TRT || item.trt;
                    if (!trt || String(trt).trim() === '') {
                        trt = "   ";
                    } else {
                        trt = String(trt).padEnd(3, ' ').substring(0, 3);
                    }
                    const comp = String(item.G1_COMP || item.componente || '').trim().toUpperCase();
                    const quant = item.G1_QUANT !== undefined ? Number(item.G1_QUANT) : (item.quantidade !== undefined ? Number(item.quantidade) : 1);
                    let opcao = item.OPCAO;
                    if (!opcao) {
                        if (item.deleted) opcao = "EXCLUIR";
                        else if (Number(noper) === 3) opcao = "INCLUIR";
                        else opcao = "ALTERAR";
                    }
                    return {
                        G1_COD: produto,
                        G1_COMP: comp,
                        G1_TRT: trt,
                        G1_QUANT: quant,
                        G1_PERDA: item.G1_PERDA !== undefined ? Number(item.G1_PERDA) : (item.perda !== undefined ? Number(item.perda) : 0),
                        G1_INI: item.G1_INI || item.ini || "19000101",
                        G1_FIM: item.G1_FIM || item.fim || "20491231",
                        OPCAO: opcao // "INCLUIR", "ALTERAR" ou "EXCLUIR"
                    };
                })
            }
        };

        console.log('🚀 [ESTRUTURA] Payload enviado para o Protheus:', JSON.stringify(payload, null, 2));

        // 3. Envio POST
        const createUrl = 'https://192.168.1.60:47500/estrutura-produtos/editar';
        const createRes = await axios.post(createUrl, payload, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            httpsAgent,
            timeout: 30000
        });

        const responseData = createRes.data;
        console.log('📬 [ESTRUTURA] Resposta Protheus:', responseData);

        // Se o status da API for erro ou erro parcial
        if (responseData.status === "error" || responseData.status === "partial") {
            return res.status(400).json({ 
                success: false,
                error: responseData.status === "partial" ? 'Erro parcial retornado pelo Protheus' : 'Erro ao processar estrutura no Protheus', 
                message: responseData.message || 'Erro retornado pela API Protheus',
                details: responseData.message || responseData,
                protheusRawResponse: responseData,
                protheusPayload: payload,
                frontendPayload: req.body,
                endpoint: '/api/protheus/estrutura-produtos/editar',
                timestamp: new Date().toISOString()
            });
        }

        res.json({ 
            success: true, 
            message: 'Estrutura atualizada com sucesso', 
            endpoint: '/api/protheus/estrutura-produtos/editar',
            timestamp: new Date().toISOString(),
            protheusRawResponse: responseData,
            protheusPayload: payload,
            frontendPayload: req.body,
            raw: responseData 
        });

    } catch (error) {
        console.error('❌ Protheus Integrador Erro [Estrutura]:', error.response?.data || error.message);
        const errDetails = error.response?.data || error.message;
        res.status(error.response?.status || 500).json({ 
            success: false,
            error: 'Erro ao Submeter Estrutura à API Protheus.', 
            message: error.message,
            details: errDetails,
            protheusRawResponse: error.response?.data || null,
            protheusPayload: typeof payload !== 'undefined' ? payload : null,
            frontendPayload: req.body,
            endpoint: '/api/protheus/estrutura-produtos/editar',
            timestamp: new Date().toISOString(),
            stack: error.stack
        });
    }
});

// =========================================================================
// ROTA: Editar Roteiro Produtivo via API POST
// =========================================================================
router.post('/roteiro-produtivo/editar', async (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !data.G2_PRODUTO || !data.roteiros || !Array.isArray(data.roteiros)) {
            return res.status(400).json({ 
                success: false,
                error: 'Produto e roteiros são obrigatórios.',
                frontendPayload: req.body,
                endpoint: '/api/protheus/roteiro-produtivo/editar',
                timestamp: new Date().toISOString()
            });
        }

        const activeOps = data.roteiros.filter(r => r.OPERACAO !== "EXCLUIR").map(r => String(r.G2_OPERAC).trim());
        const uniqueOps = new Set(activeOps);
        if (uniqueOps.size !== activeOps.length) {
            return res.status(400).json({ 
                success: false,
                error: 'Existem operações com a mesma sequência. O Protheus rejeita duplicidade. Recarregue a página e tente novamente.',
                duplicateOperations: activeOps,
                frontendPayload: req.body,
                endpoint: '/api/protheus/roteiro-produtivo/editar',
                timestamp: new Date().toISOString()
            });
        }

        const sanitizedRoteiros = data.roteiros.map(r => {
            const recursoCod = String(r.G2_RECURSO || '').trim();
            return {
                G2_OPERAC: String(r.G2_OPERAC || '').trim().padStart(2, '0'),
                G2_DESCRI: String(r.G2_DESCRI || '').substring(0, 30),
                G2_RECURSO: recursoCod,
                G2_FERRAM: String(r.G2_FERRAM || ''),
                G2_TPALOCF: String(r.G2_TPALOCF || ''),
                G2_SETUP: r.G2_SETUP !== undefined && r.G2_SETUP !== '' ? Number(r.G2_SETUP) : 0,
                G2_FORMSTP: String(r.G2_FORMSTP || ''),
                G2_LOTEPAD: 1,
                G2_TEMPAD: Number(r.G2_TEMPAD || 1),
                G2_TPOPER: "1",
                G2_TPSOBRE: String(r.G2_TPSOBRE || ''),
                G2_TEMPSOB: String(r.G2_TEMPSOB || ''),
                G2_CTRAB: String(r.G2_CTRAB || ''),
                G2_TEMPEND: String(r.G2_TEMPEND || ''),
                G2_MAOOBRA: Number(r.G2_MAOOBRA || r.G2_MAOBRA || 1),
                OPERACAO: r.OPERACAO || "ALTERAR"
            };
        });

        const normalizedPayload = {
            data: {
                NOPER: Number(data.NOPER) || 4,
                EMPRESA: String(data.EMPRESA || "01").trim(),
                CFILANT: String(data.CFILANT || "0101").trim(),
                G2_CODIGO: String(data.G2_CODIGO || "01").trim().padStart(2, '0'),
                G2_PRODUTO: String(data.G2_PRODUTO).trim().toUpperCase(),
                roteiros: sanitizedRoteiros
            }
        };

        // 1. Requisitar Token (Login)
        let accessToken = '';
        try {
            const tokenUrl = 'https://192.168.1.60:47500/tlpp/oauth2/token?grant_type=password&username=sinco&password=Metal1120';
            const tokenRes = await axios.get(tokenUrl, { httpsAgent, timeout: 10000 });
            accessToken = tokenRes.data.access_token;
        } catch (authError) {
            throw new Error('Falha de Login (Obtenção de Token) na API Protheus: ' + authError.message);
        }

        if (!accessToken) {
            throw new Error('Token JWT retornado estava em branco.');
        }

        console.log('🚀 [ROTEIRO] Payload normalizado enviado para o Protheus:', JSON.stringify(normalizedPayload, null, 2));

        // 2. Envio POST
        const createUrl = 'https://192.168.1.60:47500/roteiro-produtivo/editar';
        const createRes = await axios.post(createUrl, normalizedPayload, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            httpsAgent,
            timeout: 30000
        });

        const responseData = createRes.data;
        console.log('📬 [ROTEIRO] Resposta Protheus:', responseData);

        // Se o status da API for erro ou erro parcial
        if (responseData.status === "error" || responseData.status === "partial") {
            return res.status(400).json({ 
                success: false,
                error: responseData.status === "partial" ? 'Erro parcial retornado pelo Protheus' : 'Erro ao processar roteiro no Protheus', 
                message: responseData.message || 'Erro retornado pela API Protheus',
                details: responseData.message || responseData,
                protheusRawResponse: responseData,
                protheusPayload: normalizedPayload,
                frontendPayload: req.body,
                endpoint: '/api/protheus/roteiro-produtivo/editar',
                timestamp: new Date().toISOString()
            });
        }

        res.json({ 
            success: true, 
            message: 'Roteiro atualizado com sucesso', 
            endpoint: '/api/protheus/roteiro-produtivo/editar',
            timestamp: new Date().toISOString(),
            protheusRawResponse: responseData,
            protheusPayload: normalizedPayload,
            frontendPayload: req.body,
            raw: responseData 
        });

    } catch (error) {
        const errDetail = error.response?.data || error.message;
        console.error('❌ Protheus Integrador Erro [Roteiro]:', errDetail);
        res.status(error.response?.status || 500).json({ 
            success: false,
            error: 'Erro ao Submeter Roteiro à API Protheus.', 
            message: error.message,
            details: errDetail,
            protheusRawResponse: error.response?.data || null,
            protheusPayload: typeof normalizedPayload !== 'undefined' ? normalizedPayload : null,
            frontendPayload: req.body,
            endpoint: '/api/protheus/roteiro-produtivo/editar',
            timestamp: new Date().toISOString(),
            stack: error.stack
        });
    }
});

// =========================================================================
// ROTA: Buscar Produto x Cliente (SZ1) via DB
// =========================================================================
router.get('/produto-cliente/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const sql = `
            SELECT 
                TRIM(z1_cliente) as z1_cliente,
                TRIM(z1_loja) as z1_loja,
                TRIM(z1_produto) as z1_produto,
                TRIM(z1_codcli) as z1_codcli,
                TRIM(z1_desccli) as z1_desccli,
                TRIM(z1_revisao) as z1_revisao,
                R_E_C_N_O_ as recno
            FROM public.sz1010
            WHERE TRIM(z1_produto) = $1
            AND d_e_l_e_t_ = ' '
            ORDER BY z1_cliente
        `;
        const rows = await queryProtheus(sql, [codigo.toUpperCase().trim()]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar SZ1:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Falha na busca de Produto x Cliente.', 
            details: error.message,
            codigo: req.params.codigo,
            endpoint: `/api/protheus/produto-cliente/${req.params.codigo}`,
            timestamp: new Date().toISOString()
        });
    }
});

// =========================================================================
// ROTA: Editar Restrição Produto x Cliente (SZ1) via API POST
// =========================================================================

/**
 * Helper para validar regras de negócio do Protheus na tabela SZ1010 (Produto x Cliente)
 * O Protheus possui índice único 1: Z1_FILIAL + Z1_CLIENTE + Z1_LOJA + Z1_CODCLI + Z1_REVISAO.
 * Não permite que dois produtos internos compartilhem o mesmo código de desenho e revisão para o mesmo cliente.
 */
async function verificarConflitoSz1(produtosClientes, noper) {
    if (!produtosClientes || !Array.isArray(produtosClientes)) return null;

    for (const item of produtosClientes) {
        const cliente = String(item.Z1_CLIENTE || item.cliente || '').trim().toUpperCase();
        const loja = String(item.Z1_LOJA || item.loja || '0001').trim().toUpperCase();
        const codcli = String(item.Z1_CODCLI || item.cod_cliente || '').trim().toUpperCase();
        const revisao = String(item.Z1_REVISAO || item.revisao || '').trim().toUpperCase();
        const produtoAtual = String(item.Z1_PRODUTO || item.produto || '').trim().toUpperCase();
        const recno = item.RECNO !== undefined ? Number(item.RECNO) : (item.recno !== undefined ? Number(item.recno) : null);

        if (!cliente || !codcli) continue;

        const query = `
            SELECT 
                TRIM(z1.z1_filial)  AS filial,
                TRIM(z1.z1_cliente) AS cliente,
                TRIM(z1.z1_loja)    AS loja,
                TRIM(z1.z1_codcli)  AS cod_cliente,
                TRIM(z1.z1_revisao) AS revisao,
                TRIM(z1.z1_produto) AS produto_existente,
                TRIM(b1.b1_desc)    AS desc_produto_existente,
                TRIM(z1.z1_desccli) AS desc_cliente,
                TRIM(a1.a1_nome)    AS nome_cliente,
                z1.r_e_c_n_o_       AS recno
            FROM public.sz1010 z1
            LEFT JOIN public.sb1010 b1 ON TRIM(b1.b1_cod) = TRIM(z1.z1_produto) AND COALESCE(b1.d_e_l_e_t_, '') <> '*'
            LEFT JOIN public.sa1010 a1 ON TRIM(a1.a1_cod) = TRIM(z1.z1_cliente) AND TRIM(a1.a1_loja) = TRIM(z1.z1_loja) AND COALESCE(a1.d_e_l_e_t_, '') <> '*'
            WHERE TRIM(z1.z1_cliente) = $1
              AND TRIM(z1.z1_loja) = $2
              AND TRIM(z1.z1_codcli) = $3
              AND TRIM(z1.z1_revisao) = $4
              AND COALESCE(z1.d_e_l_e_t_, '') <> '*'
            LIMIT 1
        `;

        try {
            const rows = await queryProtheus(query, [cliente, loja, codcli, revisao]);
            if (rows && rows.length > 0) {
                const conf = rows[0];
                const confRecno = Number(conf.recno);
                const isMesmaLinha = recno && confRecno === recno;
                
                // Conflito se for nova inclusão (NOPER 3), ou se a linha encontrada não for a mesma sendo editada
                // ou se o produto amarrado no banco for diferente do produto atual
                if (Number(noper) === 3 || (!isMesmaLinha && conf.produto_existente !== produtoAtual)) {
                    return {
                        cliente: conf.cliente,
                        loja: conf.loja,
                        nome_cliente: conf.nome_cliente || conf.desc_cliente || `Cliente ${conf.cliente}`,
                        cod_cliente: conf.cod_cliente,
                        revisao: conf.revisao || '00',
                        produto_atual: produtoAtual,
                        produto_existente: conf.produto_existente,
                        desc_produto_existente: conf.desc_produto_existente || 'Sem descrição cadastrada',
                        recno: conf.recno
                    };
                }
            }
        } catch (dbErr) {
            console.warn('⚠️ [SZ1 Check Conflito] Falha na verificação prévia do espelho Protheus:', dbErr.message);
        }
    }
    return null;
}

function formatarMensagemRegraSz1(conflito) {
    return {
        isBusinessRule: true,
        ruleCode: 'SZ1_DUPLICIDADE_PRODUTO_CLIENTE',
        error: 'Regra Protheus (SZ1): Código de desenho já vinculado a outro produto',
        message: `O código de cliente/desenho '${conflito.cod_cliente}' (Revisão '${conflito.revisao}') já está em uso pelo produto ${conflito.produto_existente} (${conflito.desc_produto_existente}) para o cliente ${conflito.cliente} - ${conflito.nome_cliente}.`,
        motivo: `No Protheus, a amarração Produto x Cliente (tabela SZ1) possui chave única por [Cliente + Loja + Cód. Cliente + Revisão]. O sistema bloqueia duplicidades para que não haja ambiguidade na entrada de pedidos e emissão de notas fiscais.`,
        solucoes: [
            `1. Se este novo produto (${conflito.produto_atual}) é uma nova versão do desenho, informe uma nova revisão (ex: '01', '02').`,
            `2. Se este produto é uma peça ou conjunto diferente, utilize o código de desenho específico do cliente para ele.`,
            `3. Se o código pertencia erroneamente ao produto ${conflito.produto_existente}, acesse aquele produto e altere ou exclua a amarração anterior antes de cadastrar neste.`
        ],
        conflito
    };
}

router.post('/produto-cliente/editar', async (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !data.produtos_clientes || !Array.isArray(data.produtos_clientes)) {
            return res.status(400).json({ 
                success: false,
                error: 'Os dados do cliente e produtos_clientes são obrigatórios.',
                frontendPayload: req.body,
                endpoint: '/api/protheus/produto-cliente/editar',
                timestamp: new Date().toISOString()
            });
        }

        // Sanitização e formatação: RECNO como primeiro campo e valor numérico
        data.produtos_clientes = data.produtos_clientes.map(item => {
            const formatted = {};
            const recnoVal = item.RECNO !== undefined ? item.RECNO : item.recno;
            if (recnoVal !== undefined && recnoVal !== null && String(recnoVal).trim() !== '' && !isNaN(Number(recnoVal))) {
                formatted.RECNO = Number(recnoVal);
            }
            formatted.Z1_CLIENTE = String(item.Z1_CLIENTE || item.cliente || '').trim().toUpperCase();
            formatted.Z1_LOJA = String(item.Z1_LOJA || item.loja || '0001').trim().toUpperCase();
            formatted.Z1_PRODUTO = String(item.Z1_PRODUTO || item.produto || '').trim().toUpperCase();
            formatted.Z1_CODCLI = String(item.Z1_CODCLI || item.cod_cliente || '').trim().toUpperCase();
            formatted.Z1_DESCCLI = String(item.Z1_DESCCLI || item.desc_cliente || item.Z1_PRODUTO || 'PRODUTO').trim().toUpperCase();
            formatted.Z1_REVISAO = String(item.Z1_REVISAO || item.revisao || '').trim().toUpperCase();
            return formatted;
        });

        // Verificação proativa das regras de negócio do Protheus (SZ1)
        const conflitoPrevio = await verificarConflitoSz1(data.produtos_clientes, data.NOPER);
        if (conflitoPrevio) {
            console.warn('⚠️ [SZ1 PRODUTO-CLIENTE] Conflito de regra detectado antecipadamente:', conflitoPrevio);
            const infoRegra = formatarMensagemRegraSz1(conflitoPrevio);
            return res.status(400).json({
                success: false,
                ...infoRegra,
                frontendPayload: req.body,
                endpoint: '/api/protheus/produto-cliente/editar',
                timestamp: new Date().toISOString()
            });
        }

        // 1. Requisitar Token (Login)
        let accessToken = '';
        try {
            const tokenUrl = 'https://192.168.1.60:47500/tlpp/oauth2/token?grant_type=password&username=sinco&password=Metal1120';
            const tokenRes = await axios.get(tokenUrl, { httpsAgent, timeout: 10000 });
            accessToken = tokenRes.data.access_token;
        } catch (authError) {
            throw new Error('Falha de Login (Obtenção de Token) na API Protheus: ' + authError.message);
        }

        if (!accessToken) {
            throw new Error('Token JWT retornado estava em branco.');
        }

        console.log('🚀 [SZ1 PRODUTO-CLIENTE] Payload enviado para o Protheus:', JSON.stringify(req.body, null, 2));

        // 2. Envio POST
        const createUrl = 'https://192.168.1.60:47500/produto-cliente/editar';
        const createRes = await axios.post(createUrl, req.body, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            httpsAgent,
            timeout: 30000
        });

        const responseData = createRes.data;
        console.log('📬 [SZ1 PRODUTO-CLIENTE] Resposta Protheus:', responseData);

        // Se o status da API for OK, mas o conteúdo for um erro ou erro parcial
        if (responseData.status === "error" || responseData.status === "partial") {
            const rawMsg = Array.isArray(responseData.message) ? responseData.message.join(' | ') : String(responseData.message || '');
            
            // Se for o erro clássico de duplicidade da SZ1 no Protheus
            if (rawMsg.toLowerCase().includes('já existe') || rawMsg.toLowerCase().includes('ja existe')) {
                const conflito = await verificarConflitoSz1(data.produtos_clientes, data.NOPER);
                if (conflito) {
                    const infoRegra = formatarMensagemRegraSz1(conflito);
                    return res.status(400).json({
                        success: false,
                        ...infoRegra,
                        protheusRawResponse: responseData,
                        frontendPayload: req.body,
                        endpoint: '/api/protheus/produto-cliente/editar',
                        timestamp: new Date().toISOString()
                    });
                }
            }

            return res.status(400).json({ 
                success: false,
                error: 'Erro no Protheus', 
                message: responseData.message || 'Erro retornado pela API Protheus',
                details: responseData.message || responseData,
                protheusRawResponse: responseData,
                protheusPayload: req.body,
                frontendPayload: req.body,
                endpoint: '/api/protheus/produto-cliente/editar',
                timestamp: new Date().toISOString()
            });
        }

        res.json({ 
            success: true, 
            message: 'Produto-cliente (SZ1) atualizado com sucesso', 
            endpoint: '/api/protheus/produto-cliente/editar',
            timestamp: new Date().toISOString(),
            protheusRawResponse: responseData,
            protheusPayload: req.body,
            frontendPayload: req.body,
            raw: responseData 
        });

    } catch (error) {
        console.error('❌ Protheus Integrador Erro [Produto-Cliente SZ1]:', error.response?.data || error.message);
        const errDetails = error.response?.data || error.message;
        const rawErrStr = typeof errDetails === 'object' ? JSON.stringify(errDetails) : String(errDetails);
        
        if (rawErrStr.toLowerCase().includes('já existe') || rawErrStr.toLowerCase().includes('ja existe')) {
            const conflito = await verificarConflitoSz1(req.body?.data?.produtos_clientes, req.body?.data?.NOPER);
            if (conflito) {
                const infoRegra = formatarMensagemRegraSz1(conflito);
                return res.status(400).json({
                    success: false,
                    ...infoRegra,
                    protheusRawResponse: error.response?.data || null,
                    frontendPayload: req.body,
                    endpoint: '/api/protheus/produto-cliente/editar',
                    timestamp: new Date().toISOString()
                });
            }
        }

        res.status(error.response?.status || 500).json({ 
            success: false,
            error: 'Erro ao Submeter Produto-Cliente à API Protheus.', 
            message: error.message,
            details: errDetails,
            protheusRawResponse: error.response?.data || null,
            protheusPayload: req.body,
            frontendPayload: req.body,
            endpoint: '/api/protheus/produto-cliente/editar',
            timestamp: new Date().toISOString(),
            stack: error.stack
        });
    }
});

// =========================================================================
// ROTA: Buscar Fornecedores (SA2) via DB
// =========================================================================
router.get('/fornecedores', async (req, res) => {
    try {
        const sql = `
            SELECT 
                TRIM(a2_cod) as a2_cod,
                TRIM(a2_loja) as a2_loja,
                a2_nome::bytea as a2_nome_bytes,
                TRIM(a2_cgc) as a2_cgc
            FROM public.sa2010
            WHERE d_e_l_e_t_ = ' '
        `;
        const rows = await queryProtheus(sql);
        const td = new TextDecoder('windows-1252');
        const formatted = rows.map(r => ({
            a2_cod: r.a2_cod?.trim() || '',
            a2_loja: r.a2_loja?.trim() || '',
            a2_nome: r.a2_nome_bytes ? td.decode(r.a2_nome_bytes).trim() : '',
            a2_cgc: r.a2_cgc?.trim() || ''
        }));
        formatted.sort((a, b) => a.a2_nome.localeCompare(b.a2_nome, 'pt-BR'));
        res.json(formatted);
    } catch (error) {
        console.error('Erro ao buscar SA2:', error.message);
        res.status(500).json({ error: 'Falha na busca de Fornecedores do Protheus.' });
    }
});

// =========================================================================
// ROTA: Buscar Clientes (SA1) via DB
// =========================================================================
router.get('/clientes', async (req, res) => {
    try {
        const sql = `
            SELECT 
                TRIM(a1_cod) as a1_cod,
                TRIM(a1_loja) as a1_loja,
                a1_nome::bytea as a1_nome_bytes,
                TRIM(a1_cgc) as a1_cgc
            FROM public.sa1010
            WHERE d_e_l_e_t_ = ' '
        `;
        const rows = await queryProtheus(sql);
        const td = new TextDecoder('windows-1252');
        const formatted = rows.map(r => ({
            a1_cod: r.a1_cod?.trim() || '',
            a1_loja: r.a1_loja?.trim() || '',
            a1_nome: r.a1_nome_bytes ? td.decode(r.a1_nome_bytes).trim() : '',
            a1_cgc: r.a1_cgc?.trim() || ''
        }));
        formatted.sort((a, b) => a.a1_nome.localeCompare(b.a1_nome, 'pt-BR'));
        res.json(formatted);
    } catch (error) {
        console.error('Erro ao buscar SA1:', error.message);
        res.status(500).json({ error: 'Falha na busca de Clientes do Protheus.' });
    }
});

module.exports = router;

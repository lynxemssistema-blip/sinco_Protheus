const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const nodemailer = require('nodemailer');
const { hasFinancialAccess } = require('../util/permissionHelper');

// ─── Helper: busca NFs do Protheus para uma lista de pedidos ─────────────────
// Usa 2 queries separadas: sd2010 (sem JOIN) + sf2010 (enriquecimento de data).
// O JOIN era a causa do sumiço: se o cabeçalho sf2010 estava soft-deleted ou
// a série não casava, o INNER JOIN filtrava tudo e retornava 0 linhas.
const buildNFLookup = async (pgPool, uniquePedidos) => {
    if (!uniquePedidos || uniquePedidos.length === 0) return {};

    const normItem = (s) => { const n = parseInt(String(s).trim(), 10); return isNaN(n) ? String(s).trim() : String(n); };
    const fmtEmissao = (raw) => {
        if (!raw) return null;
        const s = raw.trim();
        if (s.length !== 8 || s === '00000000' || !/^\d{8}$/.test(s)) return null;
        return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
    };

    // Etapa 1: busca itens de NF em sd2010 SEM JOIN com sf2010
    const { rows: d2Rows } = await pgPool.query(`
        SELECT
            TRIM(d2.d2_pedido) as pedido,
            TRIM(d2.d2_itempv) as item,
            TRIM(d2.d2_doc)    as nota,
            TRIM(d2.d2_serie)  as serie,
            TRIM(d2.d2_cf)     as cfop,
            d2.d2_quant::numeric(18,2)  as qtd,
            d2.d2_prunit::numeric(18,2) as valor_unit,
            d2.d2_total::numeric(18,2)  as valor_total
        FROM public.sd2010 d2
        WHERE d2.d2_pedido = ANY($1::varchar[])
          AND COALESCE(d2.d_e_l_e_t_, '') = ''
          AND TRIM(d2.d2_doc) != ''
    `, [uniquePedidos]);

    console.log(`[FAT NF] pedidos=${uniquePedidos.join(',')} | sd2010_rows=${d2Rows.length}`);

    if (d2Rows.length === 0) return {};

    // Etapa 2: busca datas de emissão em sf2010 para as notas encontradas
    const uniqueNotas = [...new Set(d2Rows.map(r => r.nota).filter(Boolean))];
    const emissaoMap = {};
    if (uniqueNotas.length > 0) {
        try {
            const { rows: f2Rows } = await pgPool.query(`
                SELECT TRIM(f2.f2_doc) as nota, TRIM(f2.f2_emissao) as emissao_raw
                FROM public.sf2010 f2
                WHERE TRIM(f2.f2_doc) = ANY($1::varchar[])
                  AND COALESCE(f2.d_e_l_e_t_, '') = ''
            `, [uniqueNotas]);
            f2Rows.forEach(r => { if (!emissaoMap[r.nota]) emissaoMap[r.nota] = r.emissao_raw; });
        } catch (e) {
            console.warn('[FAT NF] Erro ao buscar datas sf2010 (não crítico):', e.message);
        }
    }

    // Etapa 2b: busca serie_nf via sf2010 (mapa nota → serie)
    const serieMap = {};
    if (uniqueNotas.length > 0) {
        try {
            const { rows: f2s } = await pgPool.query(`
                SELECT TRIM(f2.f2_doc) as nota, TRIM(f2.f2_serie) as serie
                FROM public.sf2010 f2
                WHERE TRIM(f2.f2_doc) = ANY($1::varchar[])
                  AND COALESCE(f2.d_e_l_e_t_, '') = ''
            `, [uniqueNotas]);
            f2s.forEach(r => { if (!serieMap[r.nota]) serieMap[r.nota] = r.serie; });
        } catch (e) {}
    }

    // Monta nfMap indexado por "pedido-item" (original e normalizado)
    const nfMap = {};
    d2Rows.forEach(nf => {
        const pedido   = nf.pedido;
        const itemOrig = nf.item;
        const itemNorm = normItem(itemOrig);
        const emissao  = fmtEmissao(emissaoMap[nf.nota]);

        [pedido + '-' + itemOrig, pedido + '-' + itemNorm].forEach(key => {
            if (!nfMap[key]) nfMap[key] = [];
            if (nf.nota && !nfMap[key].some(n => n.nota === nf.nota)) {
                nfMap[key].push({
                    nota:        nf.nota,
                    serie:       serieMap[nf.nota] || nf.serie || '',
                    emissao,
                    cfop:        nf.cfop || '',
                    qtd:         parseFloat(nf.qtd) || 0,
                    valor_unit:  parseFloat(nf.valor_unit) || 0,
                    valor_total: parseFloat(nf.valor_total) || 0
                });
            }
        });
    });

    console.log(`[FAT NF] nfMap keys: ${Object.keys(nfMap).join(' | ')}`);
    return nfMap;
};

// Aplica nfMap sobre um array de itens do MySQL
const applyNFMap = (itensRows, nfMap) => {
    const normItem = (s) => { const n = parseInt(String(s).trim(), 10); return isNaN(n) ? String(s).trim() : String(n); };
    itensRows.forEach(item => {
        const pedTrim  = String(item.pedido).trim();
        const itemTrim = String(item.item).trim();
        const itemNorm = normItem(itemTrim);
        const nfs = nfMap[pedTrim + '-' + itemTrim] || nfMap[pedTrim + '-' + itemNorm] || [];
        // Retorna array de objetos (mesmo formato que pedidos.js notas_fiscais)
        item.notas_fiscais_protheus = nfs.length > 0 ? nfs : [];
        item.nf_emissao_protheus    = nfs.length > 0 ? (nfs[0].emissao || null) : null;
    });
};

// Inicialização automática do banco de dados (Tabelas de Faturamento)
const initDB = async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_faturamento_solicitacoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                numero_solicitacao VARCHAR(50) NOT NULL UNIQUE,
                usuario VARCHAR(100) NOT NULL,
                status VARCHAR(50) DEFAULT 'Pendente',
                observacao TEXT,
                nota_fiscal VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_faturamento_solicitacao_itens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                solicitacao_id INT NOT NULL,
                pedido VARCHAR(50) NOT NULL,
                item VARCHAR(50) NOT NULL,
                codigo_produto VARCHAR(100) NOT NULL,
                quantidade_solicitada DECIMAL(18,6) NOT NULL,
                saldo_faturar_momentaneo DECIMAL(18,6) NOT NULL,
                valor_unitario DECIMAL(18,2) NULL,
                valor_total DECIMAL(18,2) NULL,
                nota_fiscal VARCHAR(100) NULL,
                pedido_cliente VARCHAR(100) NULL,
                desenho_cliente VARCHAR(100) NULL,
                nome_cliente VARCHAR(255) NULL,
                pcp_forecast_id INT NULL,
                pcp_data_entrega DATE NULL,
                pcp_serie_cliente VARCHAR(100) NULL,
                pcp_serie_metalfisa VARCHAR(100) NULL,
                pcp_numero_serie VARCHAR(150) NULL,
                pcp_lote VARCHAR(100) NULL,
                pcp_numero_lote VARCHAR(150) NULL,
                quantidade_apontamento DECIMAL(18,6) NULL,
                executar_apontamento TINYINT(1) DEFAULT 0,
                FOREIGN KEY (solicitacao_id) REFERENCES app_faturamento_solicitacoes(id) ON DELETE CASCADE
            )
        `);

        // Migration query in case table exists
        try {
            await mysqlPool.query("ALTER TABLE app_faturamento_solicitacao_itens ADD COLUMN quantidade_apontamento DECIMAL(18,6) NULL");
        } catch (e) {}
        try {
            await mysqlPool.query("ALTER TABLE app_faturamento_solicitacao_itens ADD COLUMN executar_apontamento TINYINT(1) DEFAULT 0");
        } catch (e) {}

        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_faturamento_auditoria (
                id INT AUTO_INCREMENT PRIMARY KEY,
                solicitacao_id INT NOT NULL,
                item_id INT NULL,
                usuario VARCHAR(100) NOT NULL,
                acao VARCHAR(100) NOT NULL,
                detalhes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (solicitacao_id) REFERENCES app_faturamento_solicitacoes(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ [INIT] Tabelas de Faturamento verificadas/criadas com sucesso.');
    } catch (err) {
        console.error('❌ [INIT] Erro ao criar tabelas de faturamento:', err.message);
    }
};

// --- HELPER FUNCTION: Gravar Auditoria ---
const registrarAuditoria = async (connection, solicitacao_id, item_id, usuario, acao, detalhes) => {
    await connection.query(
        `INSERT INTO app_faturamento_auditoria (solicitacao_id, item_id, usuario, acao, detalhes) VALUES (?, ?, ?, ?, ?)`,
        [solicitacao_id, item_id || null, usuario, acao, detalhes ? JSON.stringify(detalhes) : null]
    );
};

// Executar init logo na montagem da rota
initDB();

// Gerar número de solicitação único (ex: FAT-20260323-001)
const gerarNumeroSolicitacao = async () => {
    const dataAtual = new Date();
    const prefix = `FAT-${dataAtual.getFullYear()}${String(dataAtual.getMonth() + 1).padStart(2, '0')}${String(dataAtual.getDate()).padStart(2, '0')}`;
    
    // Busca a ultima solicitação do dia
    const [rows] = await mysqlPool.query(
        "SELECT numero_solicitacao FROM app_faturamento_solicitacoes WHERE numero_solicitacao LIKE ? ORDER BY id DESC LIMIT 1",
        [`${prefix}-%`]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
        const lastNum = rows[0].numero_solicitacao;
        const parts = lastNum.split('-');
        nextNumber = parseInt(parts[2], 10) + 1;
    }

    return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
};

// POST /api/faturamento/solicitacoes - Cria uma nova solicitação
router.post('/solicitacoes', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { usuario, observacao, items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Nenhum item válido informado.' });
        }

        // ── VALIDAÇÃO PROTHEUS: Bloquear faturamento se o Pedido de Compra do Cliente (c6_pedcli) for "PRODUÇÃO" ──
        const protheusDB = require('../services/protheusDB');
        try {
            // Monta as tuplas para consulta em lote no Protheus
            const valuesPlaceholder = items.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
            const queryParams = items.flatMap(it => [String(it.pedido).trim().padStart(6, '0'), String(it.item).trim()]);
            const pgRes = await protheusDB.query(`
                SELECT DISTINCT TRIM(c6_num) as pedido, TRIM(c6_item) as item, TRIM(c6_pedcli) as ped_cliente
                FROM public.sc6010
                WHERE COALESCE(d_e_l_e_t_,'') IN ('',' ')
                  AND (TRIM(c6_num), TRIM(c6_item)) IN (${valuesPlaceholder})
            `, queryParams);

            const hasProducao = pgRes.rows.some(r => {
                const pcVal = String(r.ped_cliente || '').trim().toUpperCase();
                return pcVal === 'PRODUÇÃO' || pcVal === 'PRODUCAO';
            });

            if (hasProducao) {
                return res.status(400).json({ error: 'Itens com Pedido de Compra "PRODUÇÃO" não podem ser faturados.' });
            }
        } catch (pgErr) {
            console.error('⚠️ [FAT] Erro ao validar pedido de compra PRODUÇÃO no Protheus:', pgErr.message);
        }

        await connection.beginTransaction();

        const numero_solicitacao = await gerarNumeroSolicitacao();

        // 1. Inserir cabeçalho
        const [resultHeader] = await connection.query(
            `INSERT INTO app_faturamento_solicitacoes (numero_solicitacao, usuario, observacao, status) 
             VALUES (?, ?, ?, 'Pendente')`,
            [numero_solicitacao, usuario || 'Sistema', observacao || '']
        );

        const solicitacaoId = resultHeader.insertId;

        // 2. Inserir itens (batch)
        const validItems = items.filter(it => it.quantidade_solicitada && it.quantidade_solicitada > 0);
        if (validItems.length > 0) {
            const placeholders = validItems.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            const values = validItems.flatMap(it => [
                solicitacaoId,
                String(it.pedido).trim(),
                String(it.item).trim(),
                String(it.codigo).trim(),
                parseFloat(it.quantidade_solicitada),
                parseFloat(it.qtd_faturar || 0),
                it.ped_cliente ? String(it.ped_cliente).trim() : null,
                it.ref_cliente ? String(it.ref_cliente).trim() : null,
                it.nome_cliente ? String(it.nome_cliente).trim() : null,
                it.valor_unitario || null,
                it.valor_total || null,
                it.pcp_forecast_id || null,
                it.pcp_data_entrega ? String(it.pcp_data_entrega).split('T')[0] : null,
                it.pcp_serie_cliente || null,
                it.pcp_serie_metalfisa || null,
                it.pcp_numero_serie || null,
                it.pcp_lote || null,
                it.pcp_numero_lote || null,
                it.quantidade_apontamento !== undefined && it.quantidade_apontamento !== null ? parseFloat(it.quantidade_apontamento) : null,
                it.executar_apontamento ? 1 : 0
            ]);
            await connection.query(
                `INSERT INTO app_faturamento_solicitacao_itens
                 (solicitacao_id, pedido, item, codigo_produto, quantidade_solicitada, saldo_faturar_momentaneo, pedido_cliente, desenho_cliente, nome_cliente, valor_unitario, valor_total,
                  pcp_forecast_id, pcp_data_entrega, pcp_serie_cliente, pcp_serie_metalfisa, pcp_numero_serie, pcp_lote, pcp_numero_lote, quantidade_apontamento, executar_apontamento)
                 VALUES ${placeholders}`,
                values
            );
        }

        await connection.commit();
        
        // Log Assíncrono fora da transação principal para não bloquear
        registrarAuditoria(mysqlPool, solicitacaoId, null, usuario || 'Sistema', 'CRIACAO', { qtd_itens: items.length }).catch(console.error);

        // 3. Apontamento de Produção no Protheus (Síncrono)
        const apontarItems = validItems.filter(it => it.executar_apontamento && (it.op_num_completa || it.op_num));
        let apontamentoResult = null;
        if (apontarItems.length > 0) {
            try {
                const axios = require('axios');
                const https = require('https');
                const agent = new https.Agent({ rejectUnauthorized: false });

                // 1. Obter token Protheus
                let accessToken = '';
                try {
                    const tokenUrl = 'https://192.168.1.60:47500/tlpp/oauth2/token?grant_type=password&username=sinco&password=Metal1120';
                    const tokenRes = await axios.get(tokenUrl, { httpsAgent: agent, timeout: 10000 });
                    accessToken = tokenRes.data.access_token;
                } catch (authError) {
                    console.error('[PROTHEUS APONTAMENTO] Falha na obtenção do token Protheus:', authError.message);
                    throw new Error('Falha de autenticação Protheus (OAuth2): ' + authError.message);
                }

                if (!accessToken) {
                    throw new Error('Token Protheus retornado em branco.');
                }
                
                const payload = {
                    data: {
                        CFILANT: "0101",
                        EMPRESA: "01",
                        NOPER: 3,
                        apontamentosOrdensProducao: apontarItems.map(it => {
                            const op = String(it.op_num_completa || it.op_num || '').trim();
                            const qtdApontar = it.quantidade_apontamento !== undefined && it.quantidade_apontamento !== null
                                ? parseFloat(it.quantidade_apontamento)
                                : parseFloat(it.quantidade_solicitada);
                            return {
                                C2_OP: op,
                                C2_PRODUTO: String(it.codigo || it.codigo_produto || '').trim(),
                                C2_QUANT: qtdApontar
                            };
                        })
                    }
                };

                console.log(`[PROTHEUS APONTAMENTO] Enviando payload síncrono para ${solicitacaoId}:`, JSON.stringify(payload));

                const response = await axios.post(
                    'https://192.168.1.60:47500/ordem-producao/apontamento-simples',
                    payload,
                    { 
                        httpsAgent: agent,
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        },
                        timeout: 15000
                    }
                );

                console.log(`[PROTHEUS APONTAMENTO] Resposta síncrona recebida para ${solicitacaoId}:`, response.status, response.data);
                
                await registrarAuditoria(
                    mysqlPool, 
                    solicitacaoId, 
                    null, 
                    usuario || 'Sistema', 
                    'APONTAMENTO_PROTHEUS_SUCESSO', 
                    { 
                        payload: payload.data,
                        resposta: response.data 
                    }
                );

                apontamentoResult = {
                    sucesso: true,
                    resposta: response.data
                };
            } catch (err) {
                console.error(`[PROTHEUS APONTAMENTO] Falha síncrona ao executar apontamento para ${solicitacaoId}:`, err.message);
                const errorDetail = err.response?.data || err.message;
                
                await registrarAuditoria(
                    mysqlPool, 
                    solicitacaoId, 
                    null, 
                    usuario || 'Sistema', 
                    'APONTAMENTO_PROTHEUS_ERRO', 
                    { 
                        erro: err.message,
                        detalhe: errorDetail 
                    }
                );

                apontamentoResult = {
                    sucesso: false,
                    erro: err.message,
                    detalhe: errorDetail
                };
            }
        }

        // Disparo de e-mail e WhatsApp assíncrono para os usuários configurados
        (async () => {
            try {
                const [configRows] = await mysqlPool.query('SELECT general_config FROM app_company_settings WHERE id = 1');
                if (configRows.length > 0 && configRows[0].general_config) {
                    const configObj = typeof configRows[0].general_config === 'string' ? JSON.parse(configRows[0].general_config) : configRows[0].general_config;
                    const emailsConfig = configObj.faturamento_emails;

                    if (emailsConfig && Array.isArray(emailsConfig) && emailsConfig.length > 0) {
                        const [userRows] = await mysqlPool.query(
                            `SELECT email, whatsapp FROM usuario WHERE idUsuario IN (?) AND (email IS NOT NULL OR whatsapp IS NOT NULL)`,
                            [emailsConfig]
                        );
                        const recipientList = userRows.map(u => u.email).filter(Boolean);

                        // WhatsApp
                        const waNumbers = userRows.map(u => u.whatsapp).filter(Boolean);
                        if (waNumbers.length > 0) {
                            const { sendText: waSend, msgNovaFaturamento } = require('../services/whatsapp');
                            const waText = msgNovaFaturamento({ numero_solicitacao, usuario: usuario || 'Sistema', qtd_itens: items.length });
                            waSend(waNumbers, waText, `Nova Solicitação Faturamento: ${numero_solicitacao}`).catch(e =>
                                console.error('❌ Erro WhatsApp faturamento:', e.message)
                            );
                        }
                        
                        if (recipientList.length > 0) {
                            let getCorpEmailType = (html) => html; // Default fallback
                            try {
                                const utils = require('../utils/emailTemplate');
                                if (utils && utils.getCorporateEmailTemplate) getCorpEmailType = utils.getCorporateEmailTemplate;
                            } catch (e) { console.warn("Could not load email template wrapper."); }
                            
                            const transporter = nodemailer.createTransport({
                                host: 'smtp.task.com.br',
                                port: 587,
                                secure: false,
                                auth: { user: 'sincometal@metalfisa.com.br', pass: 'Pro1042@sm' },
                                tls: { rejectUnauthorized: false }
                            });

                            let itemsHtml = items.map(it => `
                                <tr>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${it.pedido}-${it.item}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #334155;">${it.nome_cliente || '-'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${it.ped_cliente || '-'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #1e40af;">${it.ref_cliente || '-'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${it.codigo}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${it.quantidade_solicitada}</td>
                                </tr>
                            `).join('');

                            const htmlBody = `
                                <h2 style="color: #1e3a8a;">Nova Solicitação de Faturamento</h2>
                                <p>Uma nova solicitação foi gerada pela equipe de Expedição.</p>
                                <ul style="list-style-type: none; padding-left: 0; background-color: #f8fafc; padding: 15px; border-radius: 5px;">
                                    <li><strong>Nº da Solicitação:</strong> <span style="font-size: 16px; font-weight: bold;">${numero_solicitacao}</span></li>
                                    <li><strong>Solicitante:</strong> ${usuario || 'Sistema'}</li>
                                    <li><strong>Data e Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</li>
                                    <li><strong>Observações:</strong> ${observacao || 'Nenhuma observação adicional.'}</li>
                                </ul>
                                <h3 style="color: #334155; margin-top: 20px;">Itens da Solicitação</h3>
                                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                    <thead style="background-color: #f1f5f9; text-align: left;">
                                        <tr>
                                            <th style="padding: 8px; border: 1px solid #cbd5e1;">Pedido-Item</th>
                                            <th style="padding: 8px; border: 1px solid #cbd5e1;">Cliente</th>
                                            <th style="padding: 8px; border: 1px solid #cbd5e1;">Ped. Cliente</th>
                                            <th style="padding: 8px; border: 1px solid #cbd5e1;">Desenho Cli.</th>
                                            <th style="padding: 8px; border: 1px solid #cbd5e1;">Cód. Produto</th>
                                            <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Qtd. Solicitada</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${itemsHtml}
                                    </tbody>
                                </table>
                                <br/>
                                <p style="font-size: 12px; color: #64748b;">Este é um alerta automático gerado pelo ERP MetalFisa SINCO. Acesse o "Controle de Faturamento" no sistema para maiores detalhes e execução.</p>
                            `;

                            const subject = `Nova Solicitacao de Faturamento: ${numero_solicitacao}`;
                            await transporter.sendMail({
                                from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
                                to: recipientList.join(','),
                                subject,
                                html: getCorpEmailType(htmlBody)
                            });
                            const { logEmailSent } = require('../services/whatsapp');
                            logEmailSent({ recipients: recipientList, subject, body: htmlBody }).catch(() => {});
                            console.log(`✅ E-mail de faturamento gerado para: ${recipientList.join(',')}`);
                        }
                    }
                }
            } catch (emailErr) {
                console.error('❌ Erro no envio assíncrono de e-mail de faturamento:', emailErr);
            }
        })();

        res.status(201).json({ 
            success: true, 
            message: 'Solicitação gerada com sucesso!',
            numero_solicitacao,
            id: solicitacaoId,
            apontamento: apontamentoResult
        });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao salvar solicitação de faturamento:', error);
        res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
    } finally {
        connection.release();
    }
});

// GET /api/faturamento/solicitacoes - Lista solicitações (com busca e paginação)
router.get('/solicitacoes', async (req, res) => {
    try {
        const canViewFinancials = await hasFinancialAccess(req);
        const { limit = 50, page = 1, status = '' } = req.query;
        const limitParsed = parseInt(limit, 10) || 50;
        const pageParsed = parseInt(page, 10) || 1;
        const offset = (pageParsed - 1) * limitParsed;

        let queryParams = [];
        let whereClause = "WHERE 1=1";

        if (status) {
            whereClause += " AND s.status = ?";
            queryParams.push(status);
        }

        // Busca Cabeçalhos
        const [rows] = await mysqlPool.query(`
            SELECT s.*, 
            (SELECT COUNT(*) FROM app_faturamento_solicitacao_itens WHERE solicitacao_id = s.id) as qtd_itens_diferentes
            FROM app_faturamento_solicitacoes s
            ${whereClause}
            ORDER BY s.id DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limitParsed, offset]);

        // Contagem Total
        const [countResult] = await mysqlPool.query(`
            SELECT COUNT(*) as total FROM app_faturamento_solicitacoes s ${whereClause}
        `, queryParams);

        // Se houver registros, busca os itens de cada solicitação para enriquecer o front-end na mesma requisição
        if (rows.length > 0) {
            const solicitacaoIds = rows.map(r => r.id);
            const placeholders = solicitacaoIds.map(() => '?').join(',');
            
            const [itensRows] = await mysqlPool.query(`
                SELECT * FROM app_faturamento_solicitacao_itens 
                WHERE solicitacao_id IN (${placeholders})
                ORDER BY pedido ASC, item ASC
            `, solicitacaoIds);

            // Fetch NFs from Protheus (Postgres)
            if (itensRows.length > 0) {
                try {
                    const pgPool = require('../services/protheusDB');
                    const uniquePedidos = [...new Set(itensRows.map(i => String(i.pedido).trim()))];
                    const nfMap = await buildNFLookup(pgPool, uniquePedidos);
                    applyNFMap(itensRows, nfMap);
                } catch (err) {
                    console.error('[FAT NF] Erro ao buscar NFs do Protheus:', err.message);
                }
            }

            // Agrupa os itens e Auto-Faturamento
            rows.forEach(solicitacao => {
                solicitacao.itens = itensRows.filter(i => i.solicitacao_id === solicitacao.id);

                if (solicitacao.status === 'Pendente' && solicitacao.itens.length > 0) {
                    const allHaveNf = solicitacao.itens.every(it => Array.isArray(it.notas_fiscais_protheus) && it.notas_fiscais_protheus.length > 0);
                    if (allHaveNf) {
                        const nfs = new Set();
                        solicitacao.itens.forEach(it => it.notas_fiscais_protheus.forEach(nf => nfs.add(nf.nota)));
                        const nfString = Array.from(nfs).join(' / ');
                        
                        solicitacao.status = 'Atendido';
                        solicitacao.nota_fiscal = nfString;

                        mysqlPool.query(
                            "UPDATE app_faturamento_solicitacoes SET status = 'Atendido', nota_fiscal = ?, updated_at = NOW() WHERE id = ?",
                            [nfString, solicitacao.id]
                        ).then(() => {
                            mysqlPool.query("INSERT INTO app_faturamento_auditoria (solicitacao_id, acao, usuario, detalhes) VALUES (?, ?, ?, ?)", [solicitacao.id, 'ALTERACAO_STATUS', 'Sistema (Auto)', JSON.stringify('De Pendente para Atendido')]);
                            mysqlPool.query("INSERT INTO app_faturamento_auditoria (solicitacao_id, acao, usuario, detalhes) VALUES (?, ?, ?, ?)", [solicitacao.id, 'VINCULO_NF', 'Sistema (Auto)', JSON.stringify({ nota_fiscal: nfString })]);
                        }).catch(e => console.error('[FAT Auto] Erro:', e.message));
                    }
                }
            });
        }

        // Pós-filtro: se o status mudou via Auto-Faturamento, não o retornamos
        let finalRows = rows;
        if (status) {
            const requestedStatuses = status.split(',').map(s => s.trim());
            finalRows = rows.filter(r => requestedStatuses.includes(r.status));
        }

        if (!canViewFinancials) {
            finalRows = finalRows.map(row => ({
                ...row,
                itens: Array.isArray(row.itens) ? row.itens.map(({ valor_unitario, valor_total, notas_fiscais_protheus, ...rest }) => ({
                    ...rest,
                    notas_fiscais_protheus: Array.isArray(notas_fiscais_protheus)
                        ? notas_fiscais_protheus.map(({ valor_unit, valor_total, ...nfRest }) => nfRest)
                        : notas_fiscais_protheus
                })) : row.itens
            }));
        }

        res.json({
            data: finalRows,
            meta: {
                total: countResult[0].total,
                page: pageParsed,
                limit: limitParsed
            }
        });

    } catch (error) {
        console.error('Erro ao buscar solicitações:', error);
        res.status(500).json({ error: 'Erro ao buscar solicitações' });
    }
});

// GET /api/faturamento/solicitacoes/:id
router.get('/solicitacoes/:id', async (req, res) => {
    try {
        const canViewFinancials = await hasFinancialAccess(req);
        const { id } = req.params;
        const [rows] = await mysqlPool.query("SELECT * FROM app_faturamento_solicitacoes WHERE id = ?", [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Solicitação não encontrada' });
        }

        const solicitacao = rows[0];

        const [itensRows] = await mysqlPool.query("SELECT * FROM app_faturamento_solicitacao_itens WHERE solicitacao_id = ? ORDER BY pedido ASC, item ASC", [id]);
        
        if (itensRows.length > 0) {
            try {
                const pgPool = require('../services/protheusDB');
                const uniquePedidos = [...new Set(itensRows.map(i => String(i.pedido).trim()))];
                const nfMap = await buildNFLookup(pgPool, uniquePedidos);
                applyNFMap(itensRows, nfMap);
            } catch (err) {
                console.error('[FAT NF] Erro ao buscar NFs do Protheus:', err.message);
            }
        }

        solicitacao.itens = itensRows;

        if (!canViewFinancials) {
            solicitacao.itens = solicitacao.itens.map(({ valor_unitario, valor_total, notas_fiscais_protheus, ...rest }) => ({
                ...rest,
                notas_fiscais_protheus: Array.isArray(notas_fiscais_protheus)
                    ? notas_fiscais_protheus.map(({ valor_unit, valor_total, ...nfRest }) => nfRest)
                    : notas_fiscais_protheus
            }));
        }

        if (solicitacao.status === 'Pendente' && solicitacao.itens.length > 0) {
            const allHaveNf = solicitacao.itens.every(it => Array.isArray(it.notas_fiscais_protheus) && it.notas_fiscais_protheus.length > 0);
            if (allHaveNf) {
                const nfs = new Set();
                solicitacao.itens.forEach(it => it.notas_fiscais_protheus.forEach(nf => nfs.add(nf.nota)));
                const nfString = Array.from(nfs).join(' / ');
                
                solicitacao.status = 'Atendido';
                solicitacao.nota_fiscal = nfString;

                mysqlPool.query(
                    "UPDATE app_faturamento_solicitacoes SET status = 'Atendido', nota_fiscal = ?, updated_at = NOW() WHERE id = ?",
                    [nfString, solicitacao.id]
                ).then(() => {
                    mysqlPool.query("INSERT INTO app_faturamento_auditoria (solicitacao_id, acao, usuario, detalhes) VALUES (?, ?, ?, ?)", [solicitacao.id, 'ALTERACAO_STATUS', 'Sistema (Auto)', JSON.stringify('De Pendente para Atendido')]);
                    mysqlPool.query("INSERT INTO app_faturamento_auditoria (solicitacao_id, acao, usuario, detalhes) VALUES (?, ?, ?, ?)", [solicitacao.id, 'VINCULO_NF', 'Sistema (Auto)', JSON.stringify({ nota_fiscal: nfString })]);
                }).catch(e => console.error('[FAT Auto] Erro:', e.message));
            }
        }

        res.json(solicitacao);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar solicitação' });
    }
});

// PUT /api/faturamento/solicitacoes/:id/status
router.put('/solicitacoes/:id/status', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { id } = req.params;
        const { status, usuario } = req.body;

        await connection.beginTransaction();

        const [oldItem] = await connection.query("SELECT status FROM app_faturamento_solicitacoes WHERE id = ?", [id]);
        if (oldItem.length === 0) throw new Error("Solicitação não encontrada.");

        const oldStatus = oldItem[0].status;

        await connection.query("UPDATE app_faturamento_solicitacoes SET status = ? WHERE id = ?", [status, id]);

        if (oldStatus !== status) {
            await registrarAuditoria(connection, id, null, usuario || 'Sistema', 'ALTERACAO_STATUS', { 
                de: oldStatus, 
                para: status 
            });
        }

        await connection.commit();
        res.json({ success: true, message: 'Status atualizado com sucesso!' });
    } catch (error) {
        await connection.rollback();
        console.error('Erro atualizar status:', error);
        res.status(500).json({ error: error.message || 'Erro ao atualizar status' });
    } finally {
        connection.release();
    }
});

// GET /api/faturamento/solicitacoes/:id/auditoria - Resgata linha do tempo
router.get('/solicitacoes/:id/auditoria', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await mysqlPool.query("SELECT * FROM app_faturamento_auditoria WHERE solicitacao_id = ? ORDER BY id DESC", [id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar auditoria' });
    }
});

// PUT /api/faturamento/solicitacoes/:id/notafiscal - Associa NF Global
router.put('/solicitacoes/:id/notafiscal', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { id } = req.params;
        const { nota_fiscal, usuario } = req.body;

        await connection.beginTransaction();

        await connection.query("UPDATE app_faturamento_solicitacoes SET nota_fiscal = ? WHERE id = ?", [nota_fiscal, id]);

        await registrarAuditoria(connection, id, null, usuario, 'VINCULO_NF', { nota_fiscal });

        await connection.commit();
        res.json({ success: true, message: 'Nota fiscal vinculada com sucesso!' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: 'Erro ao vincular nota fiscal' });
    } finally {
        connection.release();
    }
});

// PUT /api/faturamento/solicitacoes/:id/itens/:itemId - Atualiza Quantidade ou NF de um item
router.put('/solicitacoes/:id/itens/:itemId', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { id, itemId } = req.params;
        const { quantidade_solicitada, nota_fiscal, usuario } = req.body;

        await connection.beginTransaction();

        // Pega item antigo para o LOG
        const [oldItem] = await connection.query("SELECT * FROM app_faturamento_solicitacao_itens WHERE id = ? AND solicitacao_id = ?", [itemId, id]);
        if (oldItem.length === 0) throw new Error("Item não encontrado.");

        await connection.query(
            "UPDATE app_faturamento_solicitacao_itens SET quantidade_solicitada = ?, nota_fiscal = ? WHERE id = ?",
            [quantidade_solicitada, nota_fiscal, itemId]
        );

        let detalhes = {};
        let acao = 'ALTERACAO_ITEM';
        if (oldItem[0].quantidade_solicitada != quantidade_solicitada) {
            detalhes.qtd_de = parseFloat(oldItem[0].quantidade_solicitada);
            detalhes.qtd_para = parseFloat(quantidade_solicitada);
        }
        if (oldItem[0].nota_fiscal != nota_fiscal) {
            detalhes.nf_de = oldItem[0].nota_fiscal;
            detalhes.nf_para = nota_fiscal;
            acao = 'VINCULO_NF_ITEM';
        }

        await registrarAuditoria(connection, id, itemId, usuario, acao, detalhes);

        await connection.commit();
        res.json({ success: true, message: 'Item atualizado com sucesso!' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message || 'Erro ao atualizar item' });
    } finally {
        connection.release();
    }
});

// DELETE /api/faturamento/solicitacoes/:id/itens/:itemId - Exclui um material
router.delete('/solicitacoes/:id/itens/:itemId', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { id, itemId } = req.params;
        const { usuario } = req.body; // Vem via json ou query no axios data

        await connection.beginTransaction();

        const [oldItem] = await connection.query("SELECT * FROM app_faturamento_solicitacao_itens WHERE id = ? AND solicitacao_id = ?", [itemId, id]);
        if (oldItem.length === 0) throw new Error("Item não encontrado.");

        await connection.query("DELETE FROM app_faturamento_solicitacao_itens WHERE id = ?", [itemId]);

        await registrarAuditoria(connection, id, itemId, usuario, 'EXCLUSAO_ITEM', { 
            codigo: oldItem[0].codigo_produto, 
            pedido: oldItem[0].pedido, 
            item: oldItem[0].item 
        });



        await connection.commit();
        res.json({ success: true, message: 'Item removido da solicitação.' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message || 'Erro ao excluir item' });
    } finally {
        connection.release();
    }
});

// POST /api/faturamento/solicitacoes/:id/itens - Inserir material novo na solicitação
router.post('/solicitacoes/:id/itens', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { id } = req.params;
        const { pedido, item, codigo_produto, quantidade_solicitada, saldo_faturar_momentaneo, nota_fiscal, ped_cliente, ref_cliente, usuario } = req.body;

        await connection.beginTransaction();

        const [resultItem] = await connection.query(
            `INSERT INTO app_faturamento_solicitacao_itens 
             (solicitacao_id, pedido, item, codigo_produto, quantidade_solicitada, saldo_faturar_momentaneo, nota_fiscal, pedido_cliente, desenho_cliente)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                String(pedido).trim(),
                String(item).trim(),
                String(codigo_produto).trim(),
                parseFloat(quantidade_solicitada),
                parseFloat(saldo_faturar_momentaneo || 0),
                nota_fiscal || null,
                ped_cliente ? String(ped_cliente).trim() : null,
                ref_cliente ? String(ref_cliente).trim() : null
            ]
        );

        await registrarAuditoria(connection, id, resultItem.insertId, usuario, 'INCLUSAO_ITEM', { 
            codigo: codigo_produto, 
            qtd: quantidade_solicitada 
        });

        await connection.commit();
        res.json({ success: true, message: 'Novo item inserido na solicitação!', id: resultItem.insertId });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message || 'Erro ao inserir novo item' });
    } finally {
        connection.release();
    }
});

// POST /api/faturamento/enviar-email-lote - Envia faturamentos selecionados por email na forma de tabela HTML pura
router.post('/enviar-email-lote', async (req, res) => {
    try {
        const { ids, usuario } = req.body;
        
        if (!ids || ids.length === 0) {
            return res.status(400).json({ error: 'Nenhuma solicitação selecionada.' });
        }

        const [configRows] = await mysqlPool.query('SELECT general_config FROM app_company_settings WHERE id = 1');
        if (!configRows.length || !configRows[0].general_config) {
            return res.status(400).json({ error: 'Configuração de e-mail não encontrada.' });
        }

        const configObj = typeof configRows[0].general_config === 'string' ? JSON.parse(configRows[0].general_config) : configRows[0].general_config;
        const emailsConfig = configObj.faturamento_emails;

        if (!emailsConfig || !Array.isArray(emailsConfig) || emailsConfig.length === 0) {
            return res.status(400).json({ error: 'Nenhum usuário configurado para receber e-mails de faturamento.' });
        }

        const [userRows] = await mysqlPool.query(
            `SELECT email FROM usuario WHERE idUsuario IN (?) AND email IS NOT NULL AND email != ''`, 
            [emailsConfig]
        );
        const recipientList = userRows.map(u => u.email).filter(Boolean);

        if (recipientList.length === 0) {
            return res.status(400).json({ error: 'Nenhum e-mail válido encontrado para os usuários configurados.' });
        }

        // Sanitiza IDs
        const escapedIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (escapedIds.length === 0) return res.status(400).json({ error: 'IDs inválidos.' });

        // Busca dados
        const [sols] = await mysqlPool.query(`SELECT * FROM app_faturamento_solicitacoes WHERE id IN (${escapedIds.join(',')})`);
        const [items] = await mysqlPool.query(`SELECT * FROM app_faturamento_solicitacao_itens WHERE solicitacao_id IN (${escapedIds.join(',')})`);

        let conteudosHtml = '';
        for (const sol of sols) {
            const solItems = items.filter(it => it.solicitacao_id === sol.id);
            let itemsHtml = solItems.map(it => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px;">${it.pedido}-${it.item}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px; font-weight: bold; color: #334155;">${it.nome_cliente || '-'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px;">${it.codigo_produto}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px; text-align: right;">${it.quantidade_solicitada}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px;">${it.pedido_cliente || '-'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px; font-weight: bold; color: #1e40af;">${it.desenho_cliente || '-'}</td>
                </tr>
            `).join('');

            conteudosHtml += `
                <div style="margin-bottom: 30px; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; background-color: #fafbfc;">
                    <h3 style="color: #0f172a; margin-top: 0; margin-bottom: 5px;">Solicitação: ${sol.numero_solicitacao}</h3>
                    <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Solicitante:</strong> ${sol.usuario}</p>
                    <p style="margin: 0 0 15px 0; font-size: 13px; color: #475569;"><strong>Data:</strong> ${new Date(sol.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background-color: #f1f5f9; text-align: left;">
                            <tr>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px;">Pedido/Item</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px;">Cliente</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px;">Cód. Produto</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; text-align: right;">Qtd</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px;">Ped. Cliente</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px;">Desenho Cli.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }

        let getCorpEmailType = (html) => html;
        try {
            const utils = require('../utils/emailTemplate');
            if (utils && utils.getCorporateEmailTemplate) getCorpEmailType = utils.getCorporateEmailTemplate;
        } catch (e) { console.warn("Could not load email template wrapper."); }

        const transporter = nodemailer.createTransport({
            host: 'smtp.task.com.br',
            port: 587,
            secure: false,
            auth: { user: 'sincometal@metalfisa.com.br', pass: 'Pro1042@sm' },
            tls: { rejectUnauthorized: false }
        });

        const htmlBody = `
            <h2 style="color: #1e3a8a;">Resumo de Faturamentos Diários</h2>
            <p style="font-size: 15px;"><strong>${usuario || 'Sistema'}</strong> disparou um resumo contendo <strong>${escapedIds.length}</strong> solicitação(ões) de expedição.</p>
            <br/>
            ${conteudosHtml}
            <p style="font-size: 12px; color: #64748b; margin-top: 30px;">Este é um alerta automático gerado pelo ERP MetalFisa SINCO. Acesse o "Controle de Faturamento" no sistema para maiores detalhes e execução.</p>
        `;

        await transporter.sendMail({
            from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
            to: recipientList.join(','),
            subject: `Lote de Faturamentos - ${escapedIds.length} Pedido(s) Selecionados`,
            html: getCorpEmailType(htmlBody)
        });

        res.json({ success: true, message: 'E-mail HTML consolidado enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar e-mail Lote HTML:', error);
        res.status(500).json({ error: 'Erro interno ao processar listagens.' });
    }
});

// GET /api/faturamento/solicitacoes/:id/auditoria - Busca timeline de eventos de uma solicitação
router.get('/solicitacoes/:id/auditoria', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT * FROM app_faturamento_auditoria WHERE solicitacao_id = ? ORDER BY created_at DESC',
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        console.error('Erro GET /auditoria:', err);
        res.status(500).json({ error: 'Erro ao buscar auditoria da solicitação.' });
    }
});

// DELETE /api/faturamento/solicitacoes/:id/itens/:itemId - Remove um item da solicitação
router.delete('/solicitacoes/:id/itens/:itemId', async (req, res) => {
    const connection = await mysqlPool.getConnection();
    try {
        const { id, itemId } = req.params;
        const { usuario } = req.body;

        await connection.beginTransaction();

        // Obtem dados do item antes de excluir para o log
        const [itemRows] = await connection.query('SELECT codigo_produto, quantidade_solicitada FROM app_faturamento_solicitacao_itens WHERE id = ?', [itemId]);
        if (itemRows.length === 0) {
            throw new Error('Item não encontrado ou já deletado.');
        }

        const deletedItem = itemRows[0];

        // Processa exclusão
        await connection.query('DELETE FROM app_faturamento_solicitacao_itens WHERE id = ? AND solicitacao_id = ?', [itemId, id]);

        // Registra Auditoria
        await registrarAuditoria(connection, id, itemId, usuario || 'Sistema', 'EXCLUSAO_ITEM', {
            codigo: deletedItem.codigo_produto,
            qtd: deletedItem.quantidade_solicitada,
            motivo: 'Exclusão unitária via painel'
        });

        await connection.commit();
        res.json({ success: true, message: 'Item removido com sucesso!' });
    } catch (error) {
        await connection.rollback();
        console.error('Erro DELETE /item:', error);
        res.status(500).json({ error: error.message || 'Erro ao deletar item da solicitação.' });
    } finally {
        connection.release();
    }
});

// GET /api/faturamento/dashboard - Dashboard gerencial de faturamento
router.get('/dashboard', async (req, res) => {
    try {
        const canViewFinancials = await hasFinancialAccess(req);
        const { dataInicial, dataFinal, status, groupBy = 'cliente', cliente, produto } = req.query;

        const params = [];
        const whereClauses = ['1=1'];

        if (dataInicial) { whereClauses.push('DATE(s.created_at) >= ?'); params.push(dataInicial); }
        if (dataFinal)   { whereClauses.push('DATE(s.created_at) <= ?'); params.push(dataFinal); }
        if (status) {
            const list = status.split(',').map(s => s.trim()).filter(Boolean);
            if (list.length) { whereClauses.push(`s.status IN (${list.map(() => '?').join(',')})`); params.push(...list); }
        }
        if (cliente) { whereClauses.push('i.nome_cliente LIKE ?'); params.push(`%${cliente}%`); }
        if (produto)  { whereClauses.push('i.codigo_produto LIKE ?'); params.push(`%${produto}%`); }

        const whereSQL = whereClauses.join(' AND ');

        // 1. KPIs por status
        const [kpis] = await mysqlPool.query(`
            SELECT
                s.status,
                COUNT(DISTINCT s.id)          AS qtd_solicitacoes,
                COUNT(i.id)                    AS qtd_itens,
                COALESCE(SUM(i.quantidade_solicitada), 0) AS qtd_total,
                COALESCE(SUM(i.valor_total), 0)           AS valor_total
            FROM app_faturamento_solicitacoes s
            LEFT JOIN app_faturamento_solicitacao_itens i ON i.solicitacao_id = s.id
            WHERE ${whereSQL}
            GROUP BY s.status
            ORDER BY s.status
        `, params);

        // 2. Tendência mensal (últimos 12 meses se sem filtro de data)
        const trendParams = [...params];
        let trendWhere = whereSQL;
        if (!dataInicial && !dataFinal) {
            trendWhere = `${whereSQL} AND s.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)`;
        }
        const [tendenciaMensal] = await mysqlPool.query(`
            SELECT
                DATE_FORMAT(s.created_at, '%Y-%m') AS mes,
                s.status,
                COUNT(DISTINCT s.id)          AS qtd_solicitacoes,
                COUNT(i.id)                    AS qtd_itens,
                COALESCE(SUM(i.quantidade_solicitada), 0) AS qtd_total,
                COALESCE(SUM(i.valor_total), 0)           AS valor_total
            FROM app_faturamento_solicitacoes s
            LEFT JOIN app_faturamento_solicitacao_itens i ON i.solicitacao_id = s.id
            WHERE ${trendWhere}
            GROUP BY mes, s.status
            ORDER BY mes, s.status
        `, trendParams);

        // 3. Agrupamento dinâmico
        const groupMap = {
            cliente:        "COALESCE(NULLIF(TRIM(i.nome_cliente), ''), 'Não identificado')",
            produto:        "COALESCE(NULLIF(TRIM(i.codigo_produto), ''), 'Não identificado')",
            usuario:        "COALESCE(NULLIF(TRIM(s.usuario), ''), 'Não identificado')",
            dia:            "DATE_FORMAT(s.created_at, '%Y-%m-%d')",
            semana:         "DATE_FORMAT(DATE_SUB(s.created_at, INTERVAL WEEKDAY(s.created_at) DAY), '%Y-%m-%d')",
            mes:            "DATE_FORMAT(s.created_at, '%Y-%m')",
            status:         "s.status",
            pedido_cliente: "COALESCE(NULLIF(TRIM(i.pedido_cliente), ''), 'Sem PC')",
        };
        const groupLabels = {
            cliente: 'Cliente', produto: 'Produto', usuario: 'Usuário',
            dia: 'Dia', semana: 'Semana', mes: 'Mês',
            status: 'Status', pedido_cliente: 'Pedido Cliente'
        };
        const groupField = groupMap[groupBy] || groupMap.cliente;
        const groupLabel = groupLabels[groupBy] || 'Cliente';

        const [agrupamento] = await mysqlPool.query(`
            SELECT
                ${groupField}              AS label,
                COUNT(DISTINCT s.id)       AS qtd_solicitacoes,
                COUNT(i.id)                AS qtd_itens,
                COALESCE(SUM(i.quantidade_solicitada), 0) AS qtd_total,
                COALESCE(SUM(i.valor_total), 0)           AS valor_total
            FROM app_faturamento_solicitacoes s
            LEFT JOIN app_faturamento_solicitacao_itens i ON i.solicitacao_id = s.id
            WHERE ${whereSQL}
            GROUP BY label
            ORDER BY ${['dia', 'semana', 'mes'].includes(groupBy) ? 'label ASC' : 'valor_total DESC'}
            LIMIT 100
        `, params);

        // 3b. Faturado (NF válida) — sempre lido do Protheus (sd2010/sf2010), nunca do valor_total
        // planejado nem de um status interno, pois o status 'Atendido' só é atualizado quando alguém
        // abre a tela de solicitações (buildNFLookup já filtra NF cancelada/deletada via d_e_l_e_t_ = '').
        const kpiFaturadoNF = { qtd_solicitacoes: 0, qtd_itens: 0, qtd_total: 0, valor_total: 0 };
        const faturadoPorGrupo = {};
        try {
            const [itensParaNF] = await mysqlPool.query(`
                SELECT s.id AS solicitacao_id, s.usuario, s.status, s.created_at,
                       i.pedido, i.item, i.codigo_produto, i.nome_cliente, i.pedido_cliente
                FROM app_faturamento_solicitacoes s
                JOIN app_faturamento_solicitacao_itens i ON i.solicitacao_id = s.id
                WHERE ${whereSQL} AND s.status != 'Cancelado'
            `, params);

            if (itensParaNF.length > 0) {
                const pgPool = require('../services/protheusDB');
                const uniquePedidos = [...new Set(itensParaNF.map(i => String(i.pedido).trim()))];
                const nfMap = await buildNFLookup(pgPool, uniquePedidos);

                const normItem = (s) => { const n = parseInt(String(s).trim(), 10); return isNaN(n) ? String(s).trim() : String(n); };
                const pad2 = n => String(n).padStart(2, '0');
                const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
                const groupValueGetters = {
                    cliente:        (it) => (it.nome_cliente || '').trim() || 'Não identificado',
                    produto:        (it) => (it.codigo_produto || '').trim() || 'Não identificado',
                    usuario:        (it) => (it.usuario || '').trim() || 'Não identificado',
                    dia:            (it) => toYMD(new Date(it.created_at)),
                    semana:         (it) => { const d = new Date(it.created_at); const wd = (d.getDay() + 6) % 7; const monday = new Date(d); monday.setDate(d.getDate() - wd); return toYMD(monday); },
                    mes:            (it) => { const d = new Date(it.created_at); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; },
                    status:         (it) => it.status,
                    pedido_cliente: (it) => (it.pedido_cliente || '').trim() || 'Sem PC',
                };
                const getLabel = groupValueGetters[groupBy] || groupValueGetters.cliente;

                // Um mesmo pedido+item pode ter sido solicitado em mais de uma solicitação de
                // faturamento (ex.: remessas parciais pedidas em lotes diferentes). O Protheus não
                // guarda qual NF pertence a qual solicitação — buildNFLookup devolve TODAS as NFs
                // daquele pedido+item para cada solicitação que o referencia. Sem este dedup, a mesma
                // NF real seria somada de novo a cada solicitação duplicada, inflando o valor faturado.
                const solicSet = new Set();
                const pedidoItemContabilizado = new Set();
                itensParaNF.forEach(it => {
                    const pedTrim = String(it.pedido).trim();
                    const itemTrim = String(it.item).trim();
                    const itemNorm = normItem(itemTrim);
                    const nfs = nfMap[pedTrim + '-' + itemTrim] || nfMap[pedTrim + '-' + itemNorm] || [];
                    if (nfs.length === 0) return;

                    solicSet.add(it.solicitacao_id);

                    const dedupKey = pedTrim + '|' + itemNorm;
                    if (pedidoItemContabilizado.has(dedupKey)) return;
                    pedidoItemContabilizado.add(dedupKey);

                    const qtdNF   = nfs.reduce((acc, nf) => acc + (nf.qtd || 0), 0);
                    const valorNF = nfs.reduce((acc, nf) => acc + (nf.valor_total || 0), 0);

                    kpiFaturadoNF.qtd_itens += 1;
                    kpiFaturadoNF.qtd_total += qtdNF;
                    kpiFaturadoNF.valor_total += valorNF;

                    const label = getLabel(it);
                    if (!faturadoPorGrupo[label]) faturadoPorGrupo[label] = { valor_total: 0, qtd_total: 0 };
                    faturadoPorGrupo[label].valor_total += valorNF;
                    faturadoPorGrupo[label].qtd_total   += qtdNF;
                });
                kpiFaturadoNF.qtd_solicitacoes = solicSet.size;
            }
        } catch (err) {
            console.error('[FAT Dashboard] Erro ao calcular Faturado (NF válida):', err.message);
        }

        agrupamento.forEach(row => {
            const nf = faturadoPorGrupo[row.label];
            row.valor_faturado_nf = nf?.valor_total || 0;
            row.qtd_faturado_nf   = nf?.qtd_total || 0;
        });

        // 4. Top produtos (independente do groupBy)
        const [topProdutos] = await mysqlPool.query(`
            SELECT
                COALESCE(NULLIF(TRIM(i.codigo_produto), ''), 'Não identificado') AS label,
                COUNT(i.id)                    AS qtd_itens,
                COALESCE(SUM(i.quantidade_solicitada), 0) AS qtd_total,
                COALESCE(SUM(i.valor_total), 0)           AS valor_total
            FROM app_faturamento_solicitacoes s
            LEFT JOIN app_faturamento_solicitacao_itens i ON i.solicitacao_id = s.id
            WHERE ${whereSQL}
            GROUP BY label
            ORDER BY valor_total DESC
            LIMIT 10
        `, params);

        // 5. Evolução diária (últimos 30 dias)
        const [evolucaoDiaria] = await mysqlPool.query(`
            SELECT
                DATE(s.created_at) AS dia,
                s.status,
                COUNT(DISTINCT s.id)          AS qtd_solicitacoes,
                COUNT(i.id)                    AS qtd_itens,
                COALESCE(SUM(i.valor_total), 0) AS valor_total
            FROM app_faturamento_solicitacoes s
            LEFT JOIN app_faturamento_solicitacao_itens i ON i.solicitacao_id = s.id
            WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY dia, s.status
            ORDER BY dia, s.status
        `);

        let responseKpis = kpis;
        let responseKpiFaturadoNF = kpiFaturadoNF;
        let responseTendenciaMensal = tendenciaMensal;
        let responseAgrupamento = agrupamento;
        let responseTopProdutos = topProdutos;
        let responseEvolucaoDiaria = evolucaoDiaria;

        if (!canViewFinancials) {
            const stripValorTotal = (arrRows) => arrRows.map(({ valor_total, ...rest }) => rest);
            responseKpis = stripValorTotal(kpis);
            const { valor_total, ...kpiFaturadoNFRest } = kpiFaturadoNF;
            responseKpiFaturadoNF = kpiFaturadoNFRest;
            responseTendenciaMensal = stripValorTotal(tendenciaMensal);
            responseAgrupamento = agrupamento.map(({ valor_total, valor_faturado_nf, ...rest }) => rest);
            responseTopProdutos = stripValorTotal(topProdutos);
            responseEvolucaoDiaria = stripValorTotal(evolucaoDiaria);
        }

        res.json({
            kpis: responseKpis,
            kpiFaturadoNF: responseKpiFaturadoNF,
            tendenciaMensal: responseTendenciaMensal,
            agrupamento: responseAgrupamento,
            topProdutos: responseTopProdutos,
            evolucaoDiaria: responseEvolucaoDiaria,
            groupLabel
        });
    } catch (err) {
        console.error('Erro GET /faturamento/dashboard:', err);
        res.status(500).json({ error: 'Erro ao gerar dashboard de faturamento.' });
    }
});

module.exports = router;

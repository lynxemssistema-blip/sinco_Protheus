const express = require('express');
const router = express.Router();
const { Client } = require('pg');
const axios = require('axios');
const https = require('https');

// Configuração estática do PostgreSQL de Leitura (Protheus Mirror / p12prd)
const pgConfig = {
    host: '192.168.1.61',
    port: 5432,
    user: 'sinco2',
    password: 'sinco25',
    database: 'p12prd'
};

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Utilitário para rodar Queries no PostgreSQL do Protheus
 */
async function queryProtheus(sql, params = []) {
    const client = new Client(pgConfig);
    await client.connect();
    try {
        const res = await client.query(sql, params);
        return res.rows;
    } finally {
        await client.end();
    }
}

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
// ROTA: Gerar Ordem de Producao via API POST (Lote)
// =========================================================================
router.post('/ordem-producao/incluir', async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Nenhum item informado para gerar O.P.' });
        }

        // 1. Requisitar Token
        let accessToken = '';
        try {
            const tokenUrl = 'https://192.168.1.60:47500/tlpp/oauth2/token?grant_type=password&username=sinco&password=Metal1120';
            const tokenRes = await axios.get(tokenUrl, { httpsAgent, timeout: 10000 });
            accessToken = tokenRes.data.access_token;
        } catch (authError) {
            throw new Error('Falha de Login na API Protheus (O.P.): ' + authError.message);
        }
        if (!accessToken) throw new Error('Token JWT retornado estava em branco.');

        // Busca proximo numero de OP valido para nao enviar 000000
        let baseOpNum = 0;
        try {
            const resOp = await queryProtheus(`SELECT MAX(c2_num) as max_op FROM public.sc2010 WHERE c2_num ~ '^[0-9]+$' AND c2_num < '900000' AND COALESCE(d_e_l_e_t_, '') = ''`);
            if (resOp.length > 0 && resOp[0].max_op) {
                baseOpNum = parseInt(resOp[0].max_op, 10);
            }
        } catch (dbErr) {
            console.error(`Erro ao buscar ultima OP:`, dbErr.message);
        }

        // 2. Montar OPs — layout exato da documentação API Sinco
        const ordensProducao = [];
        for (const it of items) {
            const pedidoStr = String(it.pedido || "").padStart(6, '0');
            const itemPvStr = String(it.itempv || "01").padStart(2, '0');
            let filial = (it.filial || "01").trim();

            // 1. Nova pesquisa no banco (ignora frontend memory para o Produto)
            let produto = "";
            try {
                const sc6Rows = await queryProtheus(
                    `SELECT c6_produto, c6_filial FROM public.sc6010 WHERE c6_num = $1 AND c6_item = $2 AND COALESCE(d_e_l_e_t_, '') = '' LIMIT 1`,
                    [pedidoStr, itemPvStr]
                );
                if (sc6Rows.length > 0 && sc6Rows[0].c6_produto) {
                    produto = sc6Rows[0].c6_produto.trim();
                    if (sc6Rows[0].c6_filial) filial = sc6Rows[0].c6_filial.trim();
                } else {
                    produto = (it.produto || "").trim(); // fallback
                }
            } catch (err) {
                console.error("Erro SC6:", err.message);
                produto = (it.produto || "").trim();
            }

            // Incrementa o numero da OP para cada item no array
            baseOpNum += 1;
            const nextOpStr = String(baseOpNum).padStart(6, '0');

            // Busca o último roteiro (maior código) para a peça no SG2010
            let roteiro = "00";
            if (produto) {
                try {
                    const rotRows = await queryProtheus(
                        `SELECT g2_codigo FROM public.sg2010 WHERE btrim(g2_produto) = $1 AND COALESCE(d_e_l_e_t_, '') = '' ORDER BY g2_codigo DESC LIMIT 1`,
                        [produto]
                    );
                    if (rotRows.length > 0 && rotRows[0].g2_codigo) {
                        roteiro = rotRows[0].g2_codigo.trim();
                        if (roteiro.length < 2) roteiro = roteiro.padStart(2, '0');
                    }
                } catch (dbErr) {
                    console.error(`Erro ao buscar roteiro para o produto ${produto}:`, dbErr.message);
                }
            }

            console.log(`[OP BUILDER] Produto: ${produto} | Roteiro encontrado: ${roteiro}`);

            ordensProducao.push({
                EMPRESA:   "01",
                CFILANT:   filial,
                NOPER:     3,
                C2_NUM:    nextOpStr,
                C2_ITEM:   itemPvStr,
                C2_PRODUTO: produto.padEnd(15, ' '),
                C2_QUANT:  Number(it.quant) || 0,
                C2_DATPRI: it.datpri || "",
                C2_DATPRF: it.datprf || "",
                C2_OBS:    (it.obs || "").trim(),
                C2_ROTEIRO: roteiro,
                C2_PEDIDO: pedidoStr,
                C2_ITEMPV: itemPvStr
            });
        }

        // 3. Payload — estrutura exata da documentação
        const payload = { data: { ordensProducao } };

        console.log('🚀 [OP] Payload →', JSON.stringify(payload, null, 2));

        // 4. Enviar para o Protheus
        const protheusRes = await axios.post(
            'https://192.168.1.60:47500/ordem-producao/incluir',
            payload,
            { headers: { 'Authorization': `Bearer ${accessToken}` }, httpsAgent, timeout: 60000 }
        );

        const protheusResp = protheusRes.data;
        console.log('📬 [OP] Resposta Protheus →', protheusResp);
        
        require('fs').appendFileSync('protheus_log.txt', new Date().toISOString() + ' RESP: ' + JSON.stringify(protheusResp) + '\n');

        // Protheus retorna HTTP 200 mesmo em falha; checar messages[]
        const messages = Array.isArray(protheusResp.message)
            ? protheusResp.message.map(String)
            : (protheusResp.message ? [String(protheusResp.message)] : []);

        const hasError = protheusResp.status === "error"
            || messages.some(m => m.toLowerCase().includes('erro'));

        if (hasError) {
            return res.status(400).json({
                error: 'Protheus recusou a O.P.',
                details: messages.join(' | ') || 'Erro sem detalhes retornado pelo Protheus.'
            });
        }

        let opNumber = null;
        for (const m of messages) {
            const match = m.match(/ORDEM DE PRODUCAO:\s*([0-9]+)\s*CRIADA/i);
            if (match) {
                opNumber = match[1];
                break;
            }
        }

        res.json({ success: true, message: 'O.P.(s) gerada(s) com sucesso.', op_number: opNumber, details: protheusResp });

    } catch (error) {
        console.error('[OP] Erro integração:', error.response?.data || error.message);
        const detail = error.response?.data?.message || error.response?.data || error.message;
        res.status(500).json({ error: 'Erro ao submeter O.P. ao Protheus.', details: detail });
    }
});

module.exports = router;

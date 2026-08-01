const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

console.log("🚀🚀🚀 STOCK.JS FILE LOADED - VERSION 2026-01-20 13:47 🚀🚀🚀");

const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    port: 3306
};

const db = require('../db'); // Import Postgres Connection
const mysqlPool = require('../services/mysqlService'); // Import MySQL Connection
const { hasFinancialAccess } = require('../util/permissionHelper');

// GET /:codigo/saldo - Retorna saldo atual do produto (Protheus SB2010/SB2990) e Fábrica
router.get('/:codigo/saldo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const codLimpo = codigo.trim().toUpperCase();

        const query = `
            SELECT SUM(saldo) as saldo FROM (
                SELECT COALESCE(SUM(b2_qatu), 0) as saldo FROM public.sb2010 WHERE TRIM(b2_cod) = $1 AND COALESCE(d_e_l_e_t_, '') <> '*'
                UNION ALL
                SELECT COALESCE(SUM(b2_qatu), 0) as saldo FROM public.sb2990 WHERE TRIM(b2_cod) = $1 AND COALESCE(d_e_l_e_t_, '') <> '*'
            ) t
        `;
        const result = await db.query(query, [codLimpo]);
        const saldoProtheus = result.rows[0]?.saldo ? parseFloat(result.rows[0].saldo) : 0;
        
        let saldoFabrica = 0;
        try {
            const [localRows] = await mysqlPool.query(
                'SELECT SUM(CASE WHEN tipo = "E" THEN quantidade ELSE -quantidade END) as saldo FROM app_estoque_movimentos WHERE produto_codigo = ?',
                [codLimpo]
            );
            if (localRows.length > 0 && localRows[0].saldo) {
                saldoFabrica = parseFloat(localRows[0].saldo);
            }
        } catch (e) {
            console.error('Erro ao buscar saldo fábrica:', e);
        }

        res.json({ saldoProtheus, saldoFabrica, saldo: saldoProtheus }); // Mantém 'saldo' para retrocompatibilidade
    } catch (error) {
        console.error('Erro ao buscar saldo:', error);
        res.status(500).json({ error: 'Erro ao buscar saldo' });
    }
});

// POST /balances-batch - Retorna o saldo dos produtos para o almoxarifado 01
router.post('/balances-batch', express.json(), async (req, res) => {
    try {
        const { codigos } = req.body;
        if (!Array.isArray(codigos) || codigos.length === 0) {
            return res.json({});
        }
        
        const codigosLimpos = codigos.map(c => c.trim().toUpperCase()).filter(c => c);
        if (codigosLimpos.length === 0) {
            return res.json({});
        }

        const placeholders = codigosLimpos.map((_, i) => `$${i + 1}`).join(',');
        const query = `
            SELECT 
                TRIM(b2_cod) as codigo,
                COALESCE(SUM(b2_qatu), 0) as saldo
            FROM public.sb2010 
            WHERE TRIM(b2_cod) IN (${placeholders}) 
              AND TRIM(b2_local) = '01'
              AND COALESCE(d_e_l_e_t_, '') <> '*'
            GROUP BY TRIM(b2_cod)
        `;
        
        const result = await db.query(query, codigosLimpos);
        
        const balanceMap = {};
        codigosLimpos.forEach(c => {
            balanceMap[c] = 0;
        });
        
        result.rows.forEach(row => {
            balanceMap[row.codigo] = parseFloat(row.saldo);
        });

        res.json(balanceMap);
    } catch (error) {
        console.error('Erro ao buscar saldos em lote:', error);
        res.status(500).json({ error: 'Erro ao buscar saldos em lote' });
    }
});

// GET /:codigo/movimentos - Retorna histórico de movimentações (Protheus SD3010 + Fábrica)
router.get('/:codigo/movimentos', async (req, res) => {
    try {
        const { codigo } = req.params;
        const codLimpo = codigo.trim().toUpperCase();
        
        const query = `
            SELECT
                D3_FILIAL as filial,
                D3_DOC as documento,
                TRIM(D3_COD) as codigo,
                D3_LOCAL as armazem,
                COALESCE(D3_QUANT, 0)::numeric(18,6) as quantidade,
                D3_EMISSAO as emissao,
                D3_TM as tm,
                D3_TIPO as tipo,
                D3_STATUS as status
            FROM public.SD3010
            WHERE TRIM(D3_COD) = $1 AND D_E_L_E_T_ = ' '
            ORDER BY D3_EMISSAO DESC, D3_DOC
            LIMIT 50
        `;
        const result = await db.query(query, [codLimpo]);
        
        let localRows = [];
        try {
            const [rows] = await mysqlPool.query(
                'SELECT * FROM app_estoque_movimentos WHERE produto_codigo = ? ORDER BY data_movimento DESC LIMIT 50',
                [codLimpo]
            );
            localRows = rows;
        } catch (e) {
            console.error('Erro ao buscar movimentos fábrica:', e);
        }

        const protheusRows = result.rows.map((r, index) => ({
            id: 'PROT-' + r.documento + '-' + index,
            produto_codigo: r.codigo,
            tipo: (r.tm < '500') ? 'E' : 'S',
            quantidade: parseFloat(r.quantidade),
            data_movimento: r.emissao, // YYYYMMDD
            observacao: `Arm: ${r.armazem} | TM: ${r.tm} | Doc: ${r.documento}`,
            usuario: 'Protheus' // Indicador de origem
        }));

        const fabricaRows = localRows.map(r => ({
            id: 'FAB-' + r.id,
            produto_codigo: r.produto_codigo,
            tipo: r.tipo,
            quantidade: parseFloat(r.quantidade),
            data_movimento: r.data_movimento,
            observacao: r.observacao,
            usuario: r.usuario || 'Fábrica'
        }));

        const allRows = [...protheusRows, ...fabricaRows].sort((a, b) => {
            const dateA = typeof a.data_movimento === 'string' && /^\d{8}$/.test(a.data_movimento) 
                ? new Date(a.data_movimento.substring(0,4), parseInt(a.data_movimento.substring(4,6))-1, a.data_movimento.substring(6,8))
                : new Date(a.data_movimento);
            const dateB = typeof b.data_movimento === 'string' && /^\d{8}$/.test(b.data_movimento)
                ? new Date(b.data_movimento.substring(0,4), parseInt(b.data_movimento.substring(4,6))-1, b.data_movimento.substring(6,8))
                : new Date(b.data_movimento);
            return dateB - dateA;
        }).slice(0, 50);

        res.json(allRows);
    } catch (error) {
        console.error('Erro ao buscar movimentos:', error);
        res.status(500).json({ error: 'Erro ao buscar movimentos' });
    }
});

// POST / - Registra nova movimentação na Fábrica
router.post('/', async (req, res) => {
    try {
        const { produto_codigo, tipo, quantidade, observacao, usuario } = req.body;
        const codLimpo = produto_codigo.trim().toUpperCase();

        if (!['E', 'S'].includes(tipo) || !quantidade || !codLimpo) {
            return res.status(400).json({ error: 'Dados inválidos.' });
        }

        // Calcula saldo anterior
        const [localRows] = await mysqlPool.query(
            'SELECT SUM(CASE WHEN tipo = "E" THEN quantidade ELSE -quantidade END) as saldo FROM app_estoque_movimentos WHERE produto_codigo = ?',
            [codLimpo]
        );
        const saldoAnterior = (localRows.length > 0 && localRows[0].saldo) ? parseFloat(localRows[0].saldo) : 0;

        await mysqlPool.query(
            'INSERT INTO app_estoque_movimentos (produto_codigo, tipo, quantidade, saldo_anterior, observacao, usuario, data_movimento) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [codLimpo, tipo, quantidade, saldoAnterior, observacao || null, usuario || 'Local']
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao registrar movimentação local:', error);
        res.status(500).json({ error: 'Erro ao registrar movimentação local' });
    }
});

// Monta a query de saldo (mesma lógica de filtro usada por /balances e /cadastro/analisar)
function buildStockQuery({ empresa, filial, almoxarifado, codigo, prefixo, descricao, grupo, tipo, limit = 500 }) {
    const params = [];
    let paramCount = 1;

    let whereClause = "WHERE TRIM(COALESCE(s.d_e_l_e_t_, '')) = '' AND TRIM(COALESCE(p.d_e_l_e_t_, '')) = '' ";
    whereClause += "AND s.b2_cod !~ '^MT[0-9]' "; // Exclusão MT

    if (codigo) {
        params.push(`%${codigo.toUpperCase()}%`);
        whereClause += `AND s.b2_cod LIKE $${paramCount++} `;
    }
    if (prefixo) {
        params.push(`${prefixo.toUpperCase()}%`);
        whereClause += `AND s.b2_cod LIKE $${paramCount++} `;
    }
    if (descricao) {
        params.push(`%${descricao.toUpperCase()}%`);
        whereClause += `AND p.b1_desc LIKE $${paramCount++} `;
    }
    if (grupo) {
        params.push(`${grupo}%`);
        whereClause += `AND p.b1_grupo LIKE $${paramCount++} `;
    }
    if (tipo) {
        params.push(`${tipo}%`);
        whereClause += `AND p.b1_tipo LIKE $${paramCount++} `;
    }
    if (filial) {
        params.push(`${filial}%`);
        whereClause += `AND s.b2_filial LIKE $${paramCount++} `;
    }
    if (almoxarifado) {
        params.push(`${almoxarifado}%`);
        whereClause += `AND s.b2_local LIKE $${paramCount++} `;
    }

    params.push(parseInt(limit));
    const limitParam = paramCount++;

    const queries = [];

    if (!empresa || empresa === '010') {
        queries.push(`(
            SELECT
                '010'::text as empresa,
                s.b2_filial as filial,
                s.b2_local as almoxarifado,
                s.b2_cod as cod_produto,
                p.b1_desc as descricao,
                p.b1_um as unidade,
                p.b1_tipo as tipo,
                p.b1_grupo as grupo,
                s.b2_qatu as saldo_atual,
                s.b2_qemp as empenho
            FROM public.sb2010 s
            JOIN public.sb1010 p ON TRIM(p.b1_cod) = TRIM(s.b2_cod)
            ${whereClause}
            LIMIT $${limitParam}
        )`);
    }

    if (!empresa || empresa === '990') {
        queries.push(`(
            SELECT
                '990'::text as empresa,
                s.b2_filial as filial,
                s.b2_local as almoxarifado,
                s.b2_cod as cod_producto,
                p.b1_desc as descricao,
                p.b1_um as unidade,
                p.b1_tipo as tipo,
                p.b1_grupo as grupo,
                s.b2_qatu as saldo_atual,
                s.b2_qemp as empenho
            FROM public.sb2990 s
            JOIN public.sb1990 p ON TRIM(p.b1_cod) = TRIM(s.b2_cod)
            ${whereClause}
            LIMIT $${limitParam}
        )`);
    }

    return { sql: queries.join(' UNION ALL '), params };
}

// Normaliza linhas de saldo para o payload enxuto enviado à IA
function buildCadastroPromptMateriais(rows) {
    return rows.map(r => ({
        codigo: (r.cod_produto || r.cod_producto || '').trim(),
        descricao: (r.descricao || '').trim(),
        grupo: (r.grupo || '').trim(),
        tipo: (r.tipo || '').trim(),
        unidade: (r.unidade || '').trim(),
        empresa: r.empresa
    })).filter(m => m.codigo);
}

// Monta o prompt enviado ao Gemini para identificar duplicatas/equivalências de cadastro
function buildCadastroSystemPrompt(materiaisPayload, { incluirResposta = false, pergunta, contextoBusca } = {}) {
    const respostaSchema = incluirResposta
        ? `  "resposta": "texto curto (2 a 4 frases) em português respondendo diretamente à pergunta do usuário, citando os códigos relevantes encontrados",\n`
        : '';

    const contexto = incluirResposta
        ? `\nCONTEXTO DA CONSULTA: ${contextoBusca || 'Nenhum'}\nPERGUNTA DO USUÁRIO: ${pergunta || 'Encontre duplicatas/equivalências para o produto de referência acima.'}\n`
        : '';

    return `Você é um especialista sênior em cadastro de materiais (MRP/Protheus) de uma indústria metalmecânica.
Sua tarefa é analisar a lista de materiais abaixo (código, descrição, grupo, tipo, unidade, empresa) e identificar relações entre itens que aparentam ser o mesmo material físico ou substitutos entre si.

Classifique cada relação encontrada em um dos dois tipos:
- "duplicado": o mesmo item físico foi cadastrado por engano sob 2 ou mais códigos diferentes (mesma especificação completa, inclusive dimensão; a diferença é só erro de digitação ou cadastro repetido). Nesse caso, defina qual código deve ser mantido como correto em "sugestao_codigo_correto".
- "equivalente": itens fisicamente diferentes mas que podem substituir um ao outro no uso prático (ex: mesma liga/espessura de matéria-prima com dimensão de corte diferente, onde qualquer um atende; ou mesma peça de fornecedores/variações diferentes). Nesse caso nenhum item deve ser bloqueado — eles só ficam marcados como intercambiáveis, e "sugestao_codigo_correto" deve ser null.

Exemplo de referência para calibrar sua classificação:
- "CHAPA ACO 1006/1008 FQ(4,50MM) - 1200X2000 DO" (código MTC-0872) e "CHAPA ACO 1006/1008 FQ(4,50MM) - 1150X3000 DO" (código MTC-1119): mesma liga e espessura, dimensão de corte diferente, qualquer uma atende → isso é "equivalente", NÃO "duplicado".
- Só classifique como "duplicado" quando a especificação parece ser 100% a mesma peça (inclusive dimensão) e a diferença é apenas erro de cadastro.

Ignore itens que não têm nenhum par relacionado (não crie grupos de tamanho 1).
${contexto}
Retorne ESTRITAMENTE um JSON no formato:
{
${respostaSchema}  "groups": [
    {
      "tipo": "duplicado" | "equivalente",
      "motivo": "explicação curta e objetiva em português",
      "confianca": "alta" | "media" | "baixa",
      "produtos": [ { "codigo": "...", "descricao": "...", "empresa": "010" } ],
      "sugestao_codigo_correto": "codigo recomendado como correto (apenas quando tipo='duplicado'; use null quando 'equivalente')"
    }
  ]
}

LISTA DE MATERIAIS:
${JSON.stringify(materiaisPayload, null, 2)}`;
}

// Chama o Gemini com o prompt de cadastro e retorna o JSON já parseado
async function callCadastroGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'sua_api_key_aqui') {
        const err = new Error('GEMINI_API_KEY não configurada no servidor.');
        err.isConfigError = true;
        throw err;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
        }
    });

    const result = await model.generateContent(prompt);
    let responseText = await result.response.text();
    responseText = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    return JSON.parse(responseText);
}

// POST /cadastro/analisar - Analisa um recorte filtrado do cadastro em busca de duplicatas/equivalências
router.post('/cadastro/analisar', express.json(), async (req, res) => {
    try {
        const { empresa, filial, almoxarifado, codigo, prefixo, descricao, grupo, tipo, limit = 150 } = req.body;
        const cappedLimit = Math.min(parseInt(limit) || 150, 300);

        const { sql, params } = buildStockQuery({ empresa, filial, almoxarifado, codigo, prefixo, descricao, grupo, tipo, limit: cappedLimit });
        const result = await db.query(sql, params);

        if (result.rows.length < 2) {
            return res.json({ groups: [] });
        }

        const materiaisPayload = buildCadastroPromptMateriais(result.rows);
        const prompt = buildCadastroSystemPrompt(materiaisPayload);

        let parsed;
        try {
            parsed = await callCadastroGemini(prompt);
        } catch (aiError) {
            if (aiError.isConfigError) {
                return res.status(500).json({ error: aiError.message });
            }
            console.error('Erro ao interpretar resposta da IA (cadastro/analisar):', aiError.message);
            return res.status(500).json({ error: 'A IA retornou uma resposta em formato inválido. Tente novamente.' });
        }

        res.json({ groups: Array.isArray(parsed.groups) ? parsed.groups : [] });
    } catch (error) {
        console.error('Erro ao analisar cadastro com IA:', error);
        res.status(500).json({ error: 'Erro ao analisar cadastro com IA: ' + error.message });
    }
});

// POST /cadastro/consultar - Consulta pontual em texto livre (por código de referência ou pergunta livre)
router.post('/cadastro/consultar', express.json(), async (req, res) => {
    try {
        const { pergunta, codigo, empresa } = req.body;

        if (!pergunta && !codigo) {
            return res.status(400).json({ error: 'Informe uma pergunta ou um código de produto.' });
        }

        let candidatos = [];
        let contextoBusca = '';

        if (codigo) {
            const codLimpo = codigo.trim().toUpperCase();

            const baseQuery = `
                SELECT '010'::text as empresa, p.b1_cod as cod_produto, p.b1_desc as descricao, p.b1_grupo as grupo, p.b1_tipo as tipo
                FROM public.sb1010 p WHERE TRIM(p.b1_cod) = $1 AND TRIM(COALESCE(p.d_e_l_e_t_, '')) = ''
                UNION ALL
                SELECT '990'::text as empresa, p.b1_cod as cod_produto, p.b1_desc as descricao, p.b1_grupo as grupo, p.b1_tipo as tipo
                FROM public.sb1990 p WHERE TRIM(p.b1_cod) = $1 AND TRIM(COALESCE(p.d_e_l_e_t_, '')) = ''
                LIMIT 1
            `;
            const baseResult = await db.query(baseQuery, [codLimpo]);

            if (baseResult.rows.length === 0) {
                return res.json({ resposta: `Não encontrei o produto com código "${codLimpo}" no cadastro.`, groups: [] });
            }

            const base = baseResult.rows[0];
            contextoBusca = `Produto de referência: ${base.cod_produto} - ${base.descricao} (grupo ${base.grupo})`;

            const { sql, params } = buildStockQuery({ empresa: empresa || base.empresa, grupo: base.grupo, limit: 150 });
            const result = await db.query(sql, params);
            candidatos = result.rows;
        } else {
            const palavras = pergunta.split(/\s+/).map(w => w.trim()).filter(w => w.length >= 3).slice(0, 6);
            if (palavras.length === 0) {
                return res.json({ resposta: 'Não consegui identificar palavras-chave na pergunta. Tente incluir o nome do material ou um código.', groups: [] });
            }
            contextoBusca = `Busca livre: "${pergunta}"`;

            if (!empresa || empresa === '010') {
                const params010 = [];
                const cond010 = palavras.map(palavra => {
                    params010.push(`%${palavra.toUpperCase()}%`);
                    return `p.b1_desc LIKE $${params010.length}`;
                }).join(' OR ');
                const query010 = `
                    SELECT '010'::text as empresa, p.b1_cod as cod_produto, p.b1_desc as descricao, p.b1_um as unidade, p.b1_tipo as tipo, p.b1_grupo as grupo
                    FROM public.sb1010 p
                    WHERE TRIM(COALESCE(p.d_e_l_e_t_, '')) = '' AND (${cond010})
                    LIMIT 80
                `;
                const result010 = await db.query(query010, params010);
                candidatos = candidatos.concat(result010.rows);
            }

            if (!empresa || empresa === '990') {
                const params990 = [];
                const cond990 = palavras.map(palavra => {
                    params990.push(`%${palavra.toUpperCase()}%`);
                    return `p.b1_desc LIKE $${params990.length}`;
                }).join(' OR ');
                const query990 = `
                    SELECT '990'::text as empresa, p.b1_cod as cod_producto, p.b1_desc as descricao, p.b1_um as unidade, p.b1_tipo as tipo, p.b1_grupo as grupo
                    FROM public.sb1990 p
                    WHERE TRIM(COALESCE(p.d_e_l_e_t_, '')) = '' AND (${cond990})
                    LIMIT 80
                `;
                const result990 = await db.query(query990, params990);
                candidatos = candidatos.concat(result990.rows);
            }
        }

        if (candidatos.length === 0) {
            return res.json({ resposta: 'Não encontrei materiais candidatos para essa busca. Tente refinar a descrição ou usar um código.', groups: [] });
        }

        const materiaisPayload = buildCadastroPromptMateriais(candidatos);
        const prompt = buildCadastroSystemPrompt(materiaisPayload, { incluirResposta: true, pergunta, contextoBusca });

        let parsed;
        try {
            parsed = await callCadastroGemini(prompt);
        } catch (aiError) {
            if (aiError.isConfigError) {
                return res.status(500).json({ error: aiError.message });
            }
            console.error('Erro ao interpretar resposta da IA (cadastro/consultar):', aiError.message);
            return res.status(500).json({ error: 'A IA retornou uma resposta em formato inválido. Tente novamente.' });
        }

        res.json({
            resposta: parsed.resposta || '',
            groups: Array.isArray(parsed.groups) ? parsed.groups : []
        });
    } catch (error) {
        console.error('Erro na consulta pontual de cadastro:', error);
        res.status(500).json({ error: 'Erro na consulta pontual de cadastro: ' + error.message });
    }
});

// POST /cadastro/correcoes - Salva a decisão de um grupo (duplicado ou equivalente) revisado pelo usuário
router.post('/cadastro/correcoes', express.json(), async (req, res) => {
    try {
        const { grupo_uuid, tipo_relacao, motivo_ia, criado_por, itens } = req.body;

        if (!['duplicado', 'equivalente'].includes(tipo_relacao)) {
            return res.status(400).json({ error: 'tipo_relacao inválido. Use "duplicado" ou "equivalente".' });
        }
        if (!Array.isArray(itens) || itens.length < 2) {
            return res.status(400).json({ error: 'É necessário informar ao menos 2 itens no grupo.' });
        }

        if (tipo_relacao === 'duplicado') {
            const corretos = itens.filter(i => i.papel === 'correto');
            const bloquear = itens.filter(i => i.papel === 'bloquear');
            if (corretos.length !== 1 || bloquear.length !== itens.length - 1) {
                return res.status(400).json({ error: 'Grupo do tipo "duplicado" precisa de exatamente 1 item "correto" e o restante "bloquear".' });
            }
        } else {
            const invalido = itens.some(i => i.papel !== 'equivalente');
            if (invalido) {
                return res.status(400).json({ error: 'Grupo do tipo "equivalente" precisa que todos os itens tenham papel "equivalente".' });
            }
        }

        const grupoId = grupo_uuid || crypto.randomUUID();

        const values = itens.map(item => [
            grupoId,
            tipo_relacao,
            (item.codigo || '').trim().toUpperCase(),
            item.descricao || null,
            item.empresa || null,
            item.papel,
            motivo_ia || null,
            criado_por || 'Usuário Desconhecido'
        ]);

        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();

        await mysqlPool.query(
            `INSERT INTO app_cadastro_correcoes (grupo_uuid, tipo_relacao, produto_codigo, produto_descricao, empresa, papel, motivo_ia, criado_por) VALUES ${placeholders}`,
            flatValues
        );

        res.json({ success: true, grupo_uuid: grupoId });
    } catch (error) {
        console.error('Erro ao salvar correção de cadastro:', error);
        res.status(500).json({ error: 'Erro ao salvar correção de cadastro: ' + error.message });
    }
});

// GET /cadastro/correcoes - Lista correções salvas, agrupadas por grupo_uuid
router.get('/cadastro/correcoes', async (req, res) => {
    try {
        const { status, tipo_relacao } = req.query;
        let where = 'WHERE 1=1';
        const params = [];
        if (status) {
            where += ' AND status = ?';
            params.push(status);
        }
        if (tipo_relacao) {
            where += ' AND tipo_relacao = ?';
            params.push(tipo_relacao);
        }

        const [rows] = await mysqlPool.query(
            `SELECT * FROM app_cadastro_correcoes ${where} ORDER BY criado_em DESC`,
            params
        );

        const grupos = {};
        rows.forEach(row => {
            if (!grupos[row.grupo_uuid]) {
                grupos[row.grupo_uuid] = {
                    grupo_uuid: row.grupo_uuid,
                    tipo_relacao: row.tipo_relacao,
                    motivo_ia: row.motivo_ia,
                    status: row.status,
                    criado_por: row.criado_por,
                    criado_em: row.criado_em,
                    itens: []
                };
            }
            grupos[row.grupo_uuid].itens.push({
                id: row.id,
                codigo: row.produto_codigo,
                descricao: row.produto_descricao,
                empresa: row.empresa,
                papel: row.papel
            });
        });

        res.json(Object.values(grupos));
    } catch (error) {
        console.error('Erro ao listar correções de cadastro:', error);
        res.status(500).json({ error: 'Erro ao listar correções de cadastro: ' + error.message });
    }
});

// PATCH /cadastro/correcoes/:grupo_uuid/status - Atualiza o status de um grupo (pendente/aplicado/ignorado)
router.patch('/cadastro/correcoes/:grupo_uuid/status', express.json(), async (req, res) => {
    try {
        const { grupo_uuid } = req.params;
        const { status } = req.body;

        if (!['pendente', 'aplicado', 'ignorado'].includes(status)) {
            return res.status(400).json({ error: 'status inválido. Use "pendente", "aplicado" ou "ignorado".' });
        }

        await mysqlPool.query(
            'UPDATE app_cadastro_correcoes SET status = ? WHERE grupo_uuid = ?',
            [status, grupo_uuid]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar status de correção de cadastro:', error);
        res.status(500).json({ error: 'Erro ao atualizar status: ' + error.message });
    }
});

// GET /balances - SIMPLIFIED WORKING VERSION
router.get('/balances', async (req, res) => {
    console.log("\n\n========== BALANCES ROUTE CALLED ==========");
    console.log("Query params:", req.query);

    try {
        const {
            empresa,
            filial,
            almoxarifado,
            codigo,
            descricao,
            grupo,
            tipo,
            limit = 500
        } = req.query;

        console.log("Parsed params:", { empresa, filial, almoxarifado, codigo, descricao, grupo, tipo, limit });

        const { sql, params } = buildStockQuery({ empresa, filial, almoxarifado, codigo, descricao, grupo, tipo, limit });

        console.log("\n=== EXECUTING SQL ===");
        console.log("SQL (FULL):\n", sql);
        console.log("Params:", params);

        // Write to file for debugging
        const fs = require('fs');
        fs.writeFileSync('sql_debug.txt', `SQL:\n${sql}\n\nParams:\n${JSON.stringify(params)}`);
        console.log("SQL saved to sql_debug.txt");

        const result = await db.query(sql, params);

        console.log("=== QUERY RESULT ===");
        console.log("Rows returned:", result.rows.length);
        if (result.rows.length > 0) {
            console.log("First row:", result.rows[0]);
        }

        const rows = result.rows;

        // --- ENRICHMENT (DOCUMENTOS) ---
        if (rows.length > 0) {
            let connection;
            try {
                // Collect codes (handling potential alias typo from query)
                const codigos = rows.map(r => (r.cod_produto || r.cod_producto || '').trim()).filter(c => c);

                if (codigos.length > 0) {
                    connection = await mysql.createConnection(dbConfig);

                    // Create placeholders
                    const placeholders = codigos.map(() => '?').join(',');

                    const [docs] = await connection.execute(
                        `SELECT produto_codigo, url_arquivo FROM produtos_docs WHERE produto_codigo IN (${placeholders}) ORDER BY id ASC`,
                        codigos
                    );

                    const docMap = {};
                    docs.forEach(d => {
                        if (!docMap[d.produto_codigo]) {
                            docMap[d.produto_codigo] = d.url_arquivo;
                        }
                    });

                    rows.forEach(row => {
                        const code = (row.cod_produto || row.cod_producto || '').trim();
                        const fileUrl = docMap[code];
                        row.tem_arquivos = !!fileUrl;
                        row.primeiro_arquivo = fileUrl || null;
                    });
                }
            } catch (errDocs) {
                console.error('Erro ao buscar documentos para o saldo:', errDocs);
            } finally {
                if (connection) await connection.end();
            }
        }

        res.json(rows);

    } catch (error) {
        console.error('[STOCK ERROR]:', error.message);
        res.status(500).json({ error: 'Erro ao buscar saldos: ' + error.message });
    }
});

// GET /requisicoes - Listagem de requisições internas (SD3)
router.get('/requisicoes', async (req, res) => {
    try {
        const { filial, documento, codigo, dataInicial, dataFinal, limit = 500 } = req.query;
        const params = [];
        let paramCount = 1;

        let whereClause = "WHERE d3.D_E_L_E_T_ = ' ' ";

        if (filial) {
            whereClause += `AND d3.D3_FILIAL = $${paramCount++} `;
            params.push(filial);
        }
        if (documento) {
            whereClause += `AND d3.D3_DOC LIKE $${paramCount++} `;
            params.push(`%${documento}%`);
        }
        if (codigo) {
            whereClause += `AND d3.D3_COD LIKE $${paramCount++} `;
            params.push(`%${codigo.toUpperCase()}%`);
        }
        if (dataInicial) {
            const di = dataInicial.replace(/-/g, '');
            whereClause += `AND d3.D3_EMISSAO >= $${paramCount++} `;
            params.push(di);
        }
        if (dataFinal) {
            const df = dataFinal.replace(/-/g, '');
            whereClause += `AND d3.D3_EMISSAO <= $${paramCount++} `;
            params.push(df);
        }

        const query = `
            SELECT
                d3.D3_FILIAL as filial,
                d3.D3_DOC as documento,
                TRIM(d3.D3_COD) as codigo,
                sb1.B1_DESC AS descricao,
                d3.D3_LOCAL as armazem,
                COALESCE(d3.D3_QUANT, 0)::numeric(18,6) as quantidade,
                d3.D3_EMISSAO as emissao,
                d3.D3_TM as tm,
                d3.D3_TIPO as tipo,
                d3.D3_STATUS as status
            FROM public.SD3010 d3
            LEFT JOIN public.SB1010 sb1
                ON sb1.D_E_L_E_T_ = ' '
                AND btrim(sb1.B1_COD) = btrim(d3.D3_COD)
            ${whereClause}
            ORDER BY d3.D3_FILIAL, d3.D3_EMISSAO DESC, d3.D3_DOC, d3.D3_COD
            LIMIT $${paramCount}
        `;
        params.push(parseInt(limit));

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar requisições:', error);
        res.status(500).json({ error: 'Erro ao buscar requisições', details: error.message });
    }
});



// =============================================
// ÚLTIMA COMPRA (SD1010 — NF de Entrada)
// =============================================

router.post('/cadastro/ultima-compra/batch', express.json(), async (req, res) => {
    try {
        const { codigos } = req.body;
        if (!Array.isArray(codigos) || codigos.length === 0) return res.json({});
        const codigosLimpos = codigos.map(c => (c || '').trim().toUpperCase()).filter(c => c);
        if (codigosLimpos.length === 0) return res.json({});

        const placeholders = codigosLimpos.map((_, i) => `$${i + 1}`).join(', ');
        const result = await db.query(`
            SELECT DISTINCT ON (TRIM(d1_cod))
                TRIM(d1_cod) AS codigo, d1_emissao AS ultima_data,
                d1_quant AS quantidade, d1_vunit AS valor_unit,
                TRIM(d1_fornece) AS fornecedor, TRIM(d1_doc) AS doc_nf, TRIM(d1_cf) AS cfop
            FROM sd1010
            WHERE TRIM(COALESCE(d_e_l_e_t_, '')) = ''
              AND LEFT(TRIM(d1_cf), 1) IN ('1', '2')
              AND TRIM(d1_cod) IN (${placeholders})
            ORDER BY TRIM(d1_cod), d1_emissao DESC
        `, codigosLimpos);

        const canViewFinancials = await hasFinancialAccess(req);
        const mapa = {};
        result.rows.forEach(row => {
            const raw = row.ultima_data || '';
            const dataFmt = raw.length === 8
                ? `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}` : raw;
            mapa[row.codigo] = {
                ultima_data: raw, ultima_data_fmt: dataFmt,
                quantidade: parseFloat(row.quantidade) || 0,
                valor_unit: canViewFinancials ? (parseFloat(row.valor_unit) || 0) : undefined,
                fornecedor: row.fornecedor, doc_nf: row.doc_nf, cfop: row.cfop
            };
        });
        res.json(mapa);
    } catch (error) {
        console.error('[Ultima Compra] Erro:', error);
        res.status(500).json({ error: 'Erro ao buscar ultima compra: ' + error.message });
    }
});

// =============================================
// ONDE É USADO (SG1010 — Estrutura de Produto)
// =============================================

router.get('/cadastro/onde-usado/:codigo', async (req, res) => {
    try {
        const codigo = (req.params.codigo || '').trim().toUpperCase();
        if (!codigo) return res.status(400).json({ error: 'Codigo nao informado.' });

        const result = await db.query(`
            SELECT
                TRIM(g1.g1_cod)   AS cod_pai,
                TRIM(sb1.b1_desc) AS desc_pai,
                TRIM(sb1.b1_tipo) AS tipo_pai,
                g1.g1_quant       AS quantidade,
                TRIM(g1.g1_niv)   AS nivel,
                g1.g1_perda       AS perda
            FROM sg1010 g1
            LEFT JOIN sb1010 sb1
                ON TRIM(sb1.b1_cod) = TRIM(g1.g1_cod)
                AND TRIM(COALESCE(sb1.d_e_l_e_t_, '')) = ''
            WHERE TRIM(g1.g1_comp) = $1
              AND TRIM(COALESCE(g1.d_e_l_e_t_, '')) = ''
            ORDER BY TRIM(sb1.b1_tipo), TRIM(g1.g1_cod)
        `, [codigo]);

        const porTipo = {};
        result.rows.forEach(row => {
            const tipo = (row.tipo_pai || 'N/D').trim();
            if (!porTipo[tipo]) porTipo[tipo] = [];
            porTipo[tipo].push({
                cod_pai: row.cod_pai,
                desc_pai: row.desc_pai || '(sem descricao)',
                quantidade: parseFloat(row.quantidade) || 0,
                nivel: row.nivel || '01',
                perda: parseFloat(row.perda) || 0
            });
        });

        res.json({ codigo, total: result.rows.length, por_tipo: porTipo });
    } catch (error) {
        console.error('[Onde e Usado] Erro:', error);
        res.status(500).json({ error: 'Erro ao buscar onde e usado: ' + error.message });
    }
});

// =============================================
// ANÁLISE DE REDUNDÂNCIAS MP
// =============================================

function normalizarDescricaoMP(desc) {
    return (desc || '')
        .toUpperCase()
        .replace(/\bCH\.\s*/g, 'CHAPA ')
        .replace(/\bCHP\.\s*/g, 'CHAPA ')
        .replace(/\bBO\.\s*/g, 'BARRA ')
        .replace(/\bBRR\.\s*/g, 'BARRA ')
        .replace(/\bTB\.\s*/g, 'TUBO ')
        .replace(/\bTUB\.\s*/g, 'TUBO ')
        .replace(/\bSAE\s*/g, '')
        .replace(/1006\/1008|1006-1008/g, '1006')
        .replace(/,(\d)/g, '.$1')
        .replace(/(\d+)\.0+\b/g, '$1')
        .replace(/(\d)\s*X\s*(\d)/g, '$1X$2')
        .replace(/[^A-Z0-9X]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
}

function similaridadeMP(a, b) {
    const na = normalizarDescricaoMP(a);
    const nb = normalizarDescricaoMP(b);
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 1;
    return 1 - levenshtein(na, nb) / maxLen;
}

function agruparCandidatosMp(produtos, threshold = 0.82) {
    const n = produtos.length;
    const visitado = new Array(n).fill(false);
    const grupos = [];
    for (let i = 0; i < n; i++) {
        if (visitado[i]) continue;
        const grupo = [i];
        for (let j = i + 1; j < n; j++) {
            if (visitado[j]) continue;
            if (grupo.some(gi => similaridadeMP(produtos[gi].descricao, produtos[j].descricao) >= threshold)) {
                grupo.push(j);
                visitado[j] = true;
            }
        }
        visitado[i] = true;
        if (grupo.length >= 2) grupos.push(grupo.map(idx => produtos[idx]));
    }
    return grupos;
}

function buildMpRedundanciaPrompt(grupos) {
    const payload = grupos.map((g, i) => ({
        grupo_id: i,
        candidatos: (Array.isArray(g) ? g : [g]).map(p => ({
            codigo: p.codigo, descricao: p.descricao, grupo: p.grupo, unidade: p.unidade
        }))
    }));
    return `Voce e especialista em cadastro de materia-prima para industria metalmecanica (Protheus/MRP).
Analise os grupos candidatos abaixo (pre-selecionados por similaridade textual).

REGRAS:
- "duplicado": MESMA especificacao, so difere por digitacao/abreviacao. Defina sugestao_codigo_correto.
- "equivalente": Mesmo material, dimensoes diferentes. sugestao_codigo_correto=null.
- "diferente": Nao incluir no resultado.

ABREVIACOES: CH./CHP.=CHAPA | BO./BRR.=BARRA | TB./TUB.=TUBO | SAE=norma
NUMEROS: 4,5MM=4.50MM (duplicado se resto igual) | 1200X2000 vs 1000X3000 = EQUIVALENTE no maximo

GRUPOS:
${JSON.stringify(payload, null, 2)}

JSON ESTRITO (sem markdown):
{"groups":[{"tipo":"duplicado|equivalente","motivo":"texto","confianca":"alta|media|baixa","produtos":[{"codigo":"...","descricao":"...","empresa":"010"}],"sugestao_codigo_correto":"cod ou null"}]}`;
}

// FASE 1 — Levenshtein (sem IA). Rapido, sem timeout.
router.post('/cadastro/analisar-mp', express.json(), async (req, res) => {
    try {
        const { grupo, lote_offset = 0, lote_size = 150 } = req.body;
        const LOTE   = Math.min(Math.max(parseInt(lote_size) || 150, 50), 300);
        const offset = Math.max(parseInt(lote_offset) || 0, 0);

        const countParams = [];
        let countWhere = "WHERE TRIM(COALESCE(p.d_e_l_e_t_, '')) = '' AND TRIM(p.b1_tipo) = 'MP'";
        if (grupo) { countParams.push(`${grupo.toUpperCase()}%`); countWhere += ` AND TRIM(p.b1_grupo) LIKE $1`; }
        const countResult = await db.query(`SELECT COUNT(*) AS total FROM public.sb1010 p ${countWhere}`, countParams);
        const totalGeral = parseInt(countResult.rows[0]?.total || 0);

        const params = []; let pc = 1; let whereExtra = '';
        if (grupo) { params.push(`${grupo.toUpperCase()}%`); whereExtra = `AND TRIM(p.b1_grupo) LIKE $${pc++}`; }
        params.push(LOTE, offset);

        const result = await db.query(`
            SELECT TRIM(p.b1_cod) AS codigo, TRIM(p.b1_desc) AS descricao,
                   TRIM(p.b1_grupo) AS grupo, TRIM(p.b1_tipo) AS tipo, TRIM(p.b1_um) AS unidade, TRIM(p.b1_msblql) AS bloqueado
            FROM public.sb1010 p
            WHERE TRIM(COALESCE(p.d_e_l_e_t_, '')) = '' AND TRIM(p.b1_tipo) = 'MP'
              ${whereExtra}
            ORDER BY TRIM(p.b1_grupo), TRIM(p.b1_desc)
            LIMIT $${pc++} OFFSET $${pc++}
        `, params);

        const produtos = result.rows;
        const proximo_offset = offset + produtos.length;
        const tem_mais = proximo_offset < totalGeral;

        if (produtos.length < 2) {
            return res.json({
                candidatos: [], stats: { lote_mp: produtos.length, candidatos: 0 },
                paginacao: { offset, lote: LOTE, proximo_offset, total_geral: totalGeral, tem_mais }
            });
        }

        const gruposCandidatos = agruparCandidatosMp(produtos, 0.82);
        console.log(`[MP Fase1 offset=${offset}] ${produtos.length} MPs -> ${gruposCandidatos.length} candidatos Lev.`);

        const candidatos = gruposCandidatos.map((g, i) => ({
            _candidato_id: `c_${offset}_${i}_${Date.now()}`,
            status: 'pendente',
            produtos: g.map(p => ({ ...p, empresa: '010' }))
        }));

        res.json({
            candidatos, stats: { lote_mp: produtos.length, candidatos: candidatos.length },
            paginacao: { offset, lote: LOTE, proximo_offset, total_geral: totalGeral, tem_mais }
        });
    } catch (error) {
        console.error('[MP Fase1] Erro:', error);
        res.status(500).json({ error: 'Erro ao escanear MPs: ' + error.message });
    }
});

// FASE 2 — Gemini por grupo (~3-8s por chamada). Sem timeout.
router.post('/cadastro/confirmar-grupo-ia', express.json(), async (req, res) => {
    try {
        const { candidato_id, produtos } = req.body;
        if (!Array.isArray(produtos) || produtos.length < 2)
            return res.status(400).json({ error: 'Grupo invalido ou menos de 2 produtos.' });

        const prompt = buildMpRedundanciaPrompt([produtos]);
        let parsed;
        try {
            parsed = await callCadastroGemini(prompt);
        } catch (aiError) {
            if (aiError.isConfigError) return res.status(500).json({ error: aiError.message });
            console.error('[MP ConfirmarIA] Erro IA:', aiError.message);
            return res.status(500).json({ error: 'IA retornou resposta invalida. Tente novamente.' });
        }

        const groups = Array.isArray(parsed.groups) ? parsed.groups : [];
        if (groups.length === 0)
            return res.json({ candidato_id, descartado: true, motivo: 'IA avaliou como materialmente diferentes.' });

        const g = groups[0];
        res.json({
            candidato_id, descartado: false,
            tipo: g.tipo || 'duplicado', motivo: g.motivo || '',
            confianca: g.confianca || 'media',
            produtos: (g.produtos || produtos).map(p => ({ ...p, empresa: '010' })),
            sugestao_codigo_correto: g.sugestao_codigo_correto || null
        });
    } catch (error) {
        console.error('[MP ConfirmarIA] Erro:', error);
        res.status(500).json({ error: 'Erro ao confirmar grupo: ' + error.message });
    }
});

// Dropdown de grupos MP
router.get('/cadastro/analisar-mp/grupos', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT TRIM(b1_grupo) AS grupo, COUNT(*) AS total_mp
            FROM public.sb1010
            WHERE TRIM(COALESCE(d_e_l_e_t_, '')) = '' AND TRIM(b1_tipo) = 'MP'
              AND TRIM(b1_grupo) <> ''
            GROUP BY TRIM(b1_grupo)
            ORDER BY total_mp DESC, TRIM(b1_grupo)
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('[MP Grupos] Erro:', error);
        res.status(500).json({ error: 'Erro ao buscar grupos de MP: ' + error.message });
    }
});

module.exports = router;

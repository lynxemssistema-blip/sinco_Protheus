// Cadastro/vínculo de produtos no Protheus usado pelo formulário SolidEdge (Engenharia).
// Extraído de routes/wabtec.js na remoção do módulo WabTec — lógica mantida sem alterações.
const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const pgDb = require('../db');
const axios = require('axios');
const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

// Cache de Token Protheus OAuth2 em memória (TTL: 50 minutos)
let cachedProtheusToken = null;
let cachedProtheusTokenExpiry = 0;

async function getProtheusToken(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedProtheusToken && now < cachedProtheusTokenExpiry) {
        console.log('[Protheus Auth] ⚡ Utilizando token OAuth2 em cache de memória');
        return cachedProtheusToken;
    }

    console.log('[Protheus Auth] ⏳ Solicitando novo Token OAuth2 à API Protheus (192.168.1.60:47500)...');
    const tokenUrl = 'https://192.168.1.60:47500/tlpp/oauth2/token?grant_type=password&username=sinco&password=Metal1120';
    const tokenRes = await axios.get(tokenUrl, { httpsAgent, timeout: 35000 });

    const token = tokenRes.data?.access_token;
    if (!token) {
        throw new Error('Token JWT retornado pela API Protheus estava em branco.');
    }

    const expiresIn = Number(tokenRes.data?.expires_in) || 3600;
    // Cache válido com margem de segurança (5 minutos a menos)
    cachedProtheusTokenExpiry = now + Math.max((expiresIn - 300) * 1000, 60000);
    cachedProtheusToken = token;
    console.log(`[Protheus Auth] ✅ Novo Token Protheus gerado com sucesso (válido por ${expiresIn}s).`);
    return cachedProtheusToken;
}


// =========================================================================
// 7.2 ROTA: Verificar se o Desenho do Cliente já existe no Protheus
// =========================================================================
router.get('/consultar-desenho', async (req, res) => {
    try {
        const desenhoRaw = req.query.desenho || '';
        const desenhoTrim = String(desenhoRaw).replace(/\s+/g, ' ').trim().toUpperCase();
        const desenhoNoSpaces = desenhoTrim.replace(/\s+/g, '');

        if (!desenhoTrim) {
            return res.json({ existe: false, desenho: '' });
        }

        console.log(`[Wabtec Consultar Desenho] Verificando existência de '${desenhoTrim}'...`);

        // 1. Consulta SZ1010 (Produto x Cliente) no Protheus
        const sz1Res = await pgDb.query(`
            SELECT 
                TRIM(sz1.z1_produto) AS z1_produto,
                TRIM(sz1.z1_cliente) AS z1_cliente,
                TRIM(sz1.z1_loja) AS z1_loja,
                TRIM(sz1.z1_codcli) AS z1_codcli,
                TRIM(sz1.z1_desccli) AS z1_desccli,
                TRIM(sz1.z1_revisao) AS z1_revisao,
                TRIM(sb1.b1_desc) AS b1_desc,
                TRIM(sb1.b1_grupo) AS b1_grupo,
                TRIM(sb1.b1_tipo) AS b1_tipo,
                TRIM(sb1.b1_um) AS b1_um,
                TRIM(sb1.b1_posipi) AS b1_posipi,
                TRIM(sb1.b1_xrevm) AS b1_xrevm,
                TRIM(sb1.b1_xcoddes) AS b1_xcoddes
            FROM public.sz1010 sz1
            LEFT JOIN public.sb1010 sb1 
                ON TRIM(sz1.z1_produto) = TRIM(sb1.b1_cod)
                AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            WHERE (
                TRIM(sz1.z1_codcli) = $1
                OR TRIM(sz1.z1_codcli) = $2
                OR REPLACE(TRIM(sz1.z1_codcli), ' ', '') = $2
            )
            AND COALESCE(sz1.d_e_l_e_t_, '') = ''
            ORDER BY sz1.r_e_c_n_o_ DESC
            LIMIT 1
        `, [desenhoTrim, desenhoNoSpaces]);

        if (sz1Res.rows.length > 0) {
            const r = sz1Res.rows[0];
            return res.json({
                existe: true,
                origem: 'sz1010',
                tabela: 'SZ1010 (Produto x Cliente Protheus)',
                codigo_protheus: r.z1_produto,
                cliente: r.z1_cliente,
                loja: r.z1_loja,
                cod_desenho_cliente: r.z1_codcli,
                revisao_cliente: r.z1_revisao,
                descricao: r.z1_desccli || r.b1_desc || '',
                grupo: r.b1_grupo || '',
                tipo: r.b1_tipo || '',
                um: r.b1_um || 'PC',
                ncm: r.b1_posipi || '00000000',
                revisao_metalfisa: r.b1_xrevm || '',
                cod_desenho_metalfisa: r.b1_xcoddes || ''
            });
        }

        // 2. Consulta SB1010 por B1_XCODDES ou B1_COD
        const sb1Res = await pgDb.query(`
            SELECT 
                TRIM(b1_cod) AS b1_cod,
                TRIM(b1_desc) AS b1_desc,
                TRIM(b1_grupo) AS b1_grupo,
                TRIM(b1_tipo) AS b1_tipo,
                TRIM(b1_um) AS b1_um,
                TRIM(b1_posipi) AS b1_posipi,
                TRIM(b1_xrevm) AS b1_xrevm,
                TRIM(b1_xcoddes) AS b1_xcoddes
            FROM public.sb1010
            WHERE (
                TRIM(b1_cod) = $1
                OR TRIM(b1_xcoddes) LIKE $2
                OR REPLACE(TRIM(b1_xcoddes), ' ', '') LIKE $3
            )
            AND COALESCE(d_e_l_e_t_, '') = ''
            ORDER BY r_e_c_n_o_ DESC
            LIMIT 1
        `, [desenhoTrim, `%${desenhoTrim}%`, `%${desenhoNoSpaces}%`]);

        if (sb1Res.rows.length > 0) {
            const r = sb1Res.rows[0];
            return res.json({
                existe: true,
                origem: 'sb1010',
                tabela: 'SB1010 (Produtos Protheus)',
                codigo_protheus: r.b1_cod,
                descricao: r.b1_desc || '',
                grupo: r.b1_grupo || '',
                tipo: r.b1_tipo || '',
                um: r.b1_um || 'PC',
                ncm: r.b1_posipi || '00000000',
                revisao_metalfisa: r.b1_xrevm || '',
                cod_desenho_metalfisa: r.b1_xcoddes || '',
                revisao: r.b1_xrevm
            });
        }

        // 3. Consulta app_wabtec_estruturas (MySQL) para ver se já foi associado nesta sessão/estrutura
        const [myRows] = await db.query(`
            SELECT protheus_cod, protheus_desc, protheus_rev, rev_convertida, rev_cliente_raw, titulo
            FROM app_wabtec_estruturas
            WHERE (
                TRIM(desenho_cliente) = ?
                OR REPLACE(TRIM(desenho_cliente), ' ', '') = ?
            )
            AND protheus_cod IS NOT NULL AND TRIM(protheus_cod) != ''
            ORDER BY id DESC
            LIMIT 1
        `, [desenhoTrim, desenhoNoSpaces]);

        if (myRows && myRows.length > 0) {
            const r = myRows[0];
            return res.json({
                existe: true,
                origem: 'estrutura_wabtec',
                tabela: 'Mapeamento Local da Estrutura WabTec',
                codigo_protheus: r.protheus_cod.trim(),
                revisao_cliente: r.rev_convertida || r.rev_cliente_raw || '',
                descricao: r.protheus_desc || r.titulo || '',
                grupo: (r.protheus_cod.match(/^[A-Z0-9]+/i) || [''])[0],
                tipo: 'PI',
                um: 'PC',
                ncm: '00000000'
            });
        }

        // 4. Não existe no Protheus
        return res.json({
            existe: false,
            desenho: desenhoTrim,
            mensagem: 'Desenho não encontrado no Protheus (SB1010 / SZ1010)'
        });

    } catch (err) {
        console.error('[Wabtec Consultar Desenho] Erro:', err.message);
        res.status(500).json({ error: 'Erro ao consultar desenho no Protheus: ' + err.message });
    }
});

// =========================================================================
// 7.3 ROTA: Vincular Produto Existente do Protheus na Estrutura WabTec
// =========================================================================
router.post('/vincular-produto-existente', async (req, res) => {
    try {
        const { 
            desenho_cliente, 
            codigo_protheus, 
            revisao_cliente, 
            titulo,
            cliente_codigo,
            cliente_loja,
            cliente_nome,
            is_sinco
        } = req.body;

        if (!desenho_cliente || !codigo_protheus) {
            return res.status(400).json({ error: 'Desenho/Código do Cliente e Código Protheus são obrigatórios.' });
        }

        const codDesenho = String(desenho_cliente).replace(/\s+/g, ' ').trim().toUpperCase();
        const codProtheus = String(codigo_protheus).replace(/\s+/g, '').trim().toUpperCase();
        const rev = String(revisao_cliente || '00').replace(/\s+/g, '').trim().toUpperCase().slice(0, 4);

        // Buscar dados complementares (UM, Tipo, Descrição) no erp_produtos (MySQL)
        let protheusUm = null;
        let protheusTipo = null;
        let descSb1 = null;
        try {
            const [pRows] = await db.query(
                `SELECT descricao as b1_desc, unidade_medida as b1_um, tipo as b1_tipo FROM erp_produtos WHERE codigo = ? LIMIT 1`,
                [codProtheus]
            );
            if (pRows && pRows.length > 0) {
                protheusUm = pRows[0].b1_um;
                protheusTipo = pRows[0].b1_tipo;
                descSb1 = pRows[0].b1_desc;
            }
        } catch (dbErr) {
            console.warn('[Vincular Existente] Aviso erp_produtos:', dbErr.message);
        }

        // 1. Atualizar ocorrências em app_wabtec_estruturas (MySQL)
        let linhasAtualizadas = 0;
        try {
            const [updateResult] = await db.query(`
                UPDATE app_wabtec_estruturas
                SET 
                    protheus_cod = ?,
                    protheus_desc = COALESCE(?, ?, protheus_desc),
                    protheus_rev = COALESCE(?, protheus_rev),
                    uom = COALESCE(?, uom),
                    protheus_tipo = COALESCE(?, protheus_tipo),
                    status_mapeamento = 'MAPEADO',
                    status_detalhe = 'Vinculado ao produto existente no Protheus'
                WHERE TRIM(desenho_cliente) = ?
                   OR REPLACE(TRIM(desenho_cliente), ' ', '') = ?
            `, [
                codProtheus, 
                titulo ? String(titulo).replace(/\s+/g, ' ').trim().toUpperCase() : null, 
                descSb1,
                rev || null,
                protheusUm,
                protheusTipo,
                codDesenho,
                codDesenho.replace(/\s+/g, '')
            ]);
            linhasAtualizadas = updateResult.affectedRows || 0;
        } catch (mErr) {
            console.warn('[Wabtec Vincular Existente] Aviso ao atualizar MySQL:', mErr.message);
        }

        // 2. Amarração oficial na tabela SZ1010 (Produto x Cliente) no MySQL SINCO
        const codCliFinal = String(cliente_codigo || (is_sinco ? "" : "00000739")).trim();
        const lojaCliFinal = String(cliente_loja || "0001").trim();
        let sz1Status = 'Nenhum cliente informado para vínculo SZ1010';

        if (codCliFinal) {
            try {
                const [recRows] = await db.query(`SELECT COALESCE(MAX(r_e_c_n_o_), 0) + 1 AS next_rec FROM sz1010`);
                const nextRec = recRows[0]?.next_rec || 1;
                const descFinal = String(titulo || descSb1 || cliente_nome || 'PRODUTO').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 30);
                const tenantEmpresa = req.tenantId || req.user?.IdEmpresa || 1;
                await db.query(`
                    INSERT INTO sz1010 (z1_filial, z1_cliente, z1_loja, z1_nomecli, z1_produto, z1_codcli, z1_desccli, z1_revisao, r_e_c_n_o_, d_e_l_e_t_, IdEmpresa)
                    VALUES ('0101', ?, ?, ?, ?, ?, ?, ?, ?, '', ?)
                    ON DUPLICATE KEY UPDATE
                        z1_codcli = VALUES(z1_codcli),
                        z1_desccli = VALUES(z1_desccli),
                        z1_revisao = VALUES(z1_revisao)
                `, [codCliFinal, lojaCliFinal, cliente_nome || '', codProtheus, codDesenho, descFinal, rev || '00', nextRec, tenantEmpresa]);
                sz1Status = 'Vínculo gravado com sucesso no SINCO';
            } catch (mSzErr) {
                console.warn('[Vincular Existente] Aviso sz1010 MySQL:', mSzErr.message);
            }
        }

        if (is_sinco) {
            return res.json({
                success: true,
                codigo: codProtheus,
                desenho_cliente: codDesenho,
                revisao: rev,
                cliente_codigo: codCliFinal,
                cliente_loja: lojaCliFinal,
                cliente_nome: cliente_nome || '',
                uom: protheusUm || 'UN',
                protheus_tipo: protheusTipo || 'PA',
                descricao: titulo || descSb1 || '',
                linhas_atualizadas: linhasAtualizadas,
                sz1_status: sz1Status,
                mensagem: `Código ${codProtheus} vinculado com sucesso no SINCO!`
            });
        }

        res.json({
            success: true,
            codigo: codProtheus,
            desenho_cliente: codDesenho,
            revisao: rev,
            cliente_codigo: codCliFinal,
            cliente_loja: lojaCliFinal,
            cliente_nome: cliente_nome || '',
            uom: protheusUm,
            protheus_tipo: protheusTipo,
            descricao: titulo || descSb1 || '',
            linhas_atualizadas: linhasAtualizadas,
            sz1_status: sz1Status,
            mensagem: `Código ${codProtheus} vinculado com sucesso ao cliente/desenho ${codDesenho}.`
        });
    } catch (err) {
        console.error('[Wabtec Vincular Existente] Erro:', err.message);
        res.status(500).json({ error: 'Erro ao vincular produto existente: ' + err.message });
    }
});

// =========================================================================
// 8. ROTA: Criar Produto no Protheus e Vincular Desenho WabTec
// =========================================================================
router.post('/criar-produto-protheus', async (req, res) => {
    try {
        const {
            desenho_cliente,
            revisao_cliente,
            titulo,
            grupo,
            tipo,
            um,
            ncm,
            posipi,
            peso,
            comprimento,
            largura,
            espessura,
            volume,
            area,
            cliente_codigo,
            cliente_loja,
            is_sinco,
            b1_xcode,
            b1_xcoddes
        } = req.body;

        // Regra do Usuário:
        // - Se for Solid Edge (is_sinco): o usuário pode selecionar o cliente e informar o código do cliente / desenho livremente.
        //   Caso o usuário deixe em branco, padroniza como 'Novo Cadastro Pelo SINCO'.
        // - Se for WabTec (!is_sinco): fluxo exclusivo e blindado que usa estritamente o desenho_cliente da planilha WabTec.
        let codDesenhoBruto = '';
        if (is_sinco) {
            const rawDes = (desenho_cliente || b1_xcoddes || b1_xcode || '').trim();
            codDesenhoBruto = (!rawDes || rawDes === 'NOVO_DESENHO' || rawDes === 'Novo Cadastro Pelo SINCO')
                ? 'Novo Cadastro Pelo SINCO'
                : rawDes;
        } else {
            codDesenhoBruto = (desenho_cliente || b1_xcoddes || b1_xcode || 'Novo Cadastro Pelo SINCO').trim();
        }

        if (!codDesenhoBruto || !titulo || !grupo || !tipo || !um) {
            return res.status(400).json({ error: 'Identificador do produto/desenho, Título, Grupo, Tipo e UM são campos obrigatórios.' });
        }

        const grupoLimpo = String(grupo || '').split(/[\-\s]/)[0].trim().toUpperCase() || 'MT';
        const tipoLimpo = String(tipo || '').split(/[\-\s]/)[0].trim().toUpperCase() || 'PA';
        const umLimpa = String(um || '').split(/[\-\s]/)[0].trim().toUpperCase() || 'UN';
        const tituloLimpo = String(titulo || '').replace(/\s+/g, ' ').trim().toUpperCase();
        const descCurtada = tituloLimpo.replace(/"/g, '\\"').replace(/\r\n/g, ' ').replace(/\n/g, ' ').slice(0, 100).trim();
        const codDesHigienizado = codDesenhoBruto === 'Novo Cadastro Pelo SINCO'
            ? 'Novo Cadastro Pelo SINCO'
            : String(codDesenhoBruto).replace(/\s+/g, ' ').trim().toUpperCase();
        const revWabtec = String(revisao_cliente || '00').replace(/\s+/g, '').trim().toUpperCase().slice(0, 2).padStart(2, '0');
        const numPeso = parseFloat(String(peso || 0).replace(',', '.').trim()) || 0;
        const numComprimento = parseFloat(String(comprimento || 0).replace(',', '.').trim()) || 0;
        const numLargura = parseFloat(String(largura || 0).replace(',', '.').trim()) || 0;
        const numEspessura = parseFloat(String(espessura || 0).replace(',', '.').trim()) || 0;
        const numVolume = parseFloat(String(volume || area || 0).replace(',', '.').trim()) || 0;
        const codCliFinal = String(cliente_codigo || (is_sinco ? "" : "00000739")).trim();
        const lojaCliFinal = String(cliente_loja || "0001").trim();
        const nomeCliFinal = String(req.body.cliente_nome || '').trim();
        const ncmLimpo = String(ncm || posipi || '00000000').replace(/\D/g, '').slice(0, 10).padEnd(8, '0');

        // 0. FLUXO NATIVO SINCO (100% Hostinger MySQL u494795077_SINCO): Totalmente independente do Protheus
        if (is_sinco) {
            let codigoGerado = '';
            // Se o usuário já informou um código limpo (ex: MT2-0001 ou PRD-0001)
            if (codDesenhoBruto && codDesenhoBruto !== 'Novo Cadastro Pelo SINCO' && !codDesenhoBruto.includes(' ')) {
                const [exist] = await db.query('SELECT codigo FROM erp_produtos WHERE codigo = ? LIMIT 1', [codDesenhoBruto]);
                if (exist && exist.length > 0) {
                    codigoGerado = codDesenhoBruto;
                }
            }

            if (!codigoGerado) {
                try {
                    const [prodRows] = await db.query(
                        `SELECT codigo FROM erp_produtos WHERE codigo LIKE ? ORDER BY id DESC LIMIT 50`,
                        [`${grupoLimpo}-%`]
                    );
                    let maiorNum = 0;
                    const regex = new RegExp(`^${grupoLimpo}-(\\d+)$`, 'i');
                    for (const row of prodRows) {
                        const match = (row.codigo || '').trim().match(regex);
                        if (match) {
                            const n = parseInt(match[1], 10);
                            if (!isNaN(n) && n > maiorNum) maiorNum = n;
                        }
                    }
                    const proximoNum = maiorNum > 0 ? maiorNum + 1 : 1;
                    codigoGerado = `${grupoLimpo}-${String(proximoNum).padStart(4, '0')}`;
                } catch (eSeq) {
                    console.warn('[SINCO Criar Produto] Erro sequencial:', eSeq.message);
                    codigoGerado = `${grupoLimpo}-${Date.now().toString().slice(-4)}`;
                }
            }

            // Persiste no cadastro oficial do SINCO (erp_produtos)
            await db.query(`
                INSERT INTO erp_produtos (codigo, descricao, tipo, unidade_medida, peso_liquido, peso_bruto, revisao_atual, IdEmpresa)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE
                    descricao = VALUES(descricao),
                    tipo = VALUES(tipo),
                    unidade_medida = VALUES(unidade_medida),
                    peso_liquido = VALUES(peso_liquido),
                    peso_bruto = VALUES(peso_bruto),
                    revisao_atual = VALUES(revisao_atual)
            `, [codigoGerado, descCurtada, tipoLimpo, umLimpa, numPeso, numPeso, revWabtec]);

            // Se informado cliente, cria amarração no sz1010
            let sz1Criado = false;
            if (codCliFinal) {
                try {
                    const [recRows] = await db.query(`SELECT COALESCE(MAX(r_e_c_n_o_), 0) + 1 AS next_rec FROM sz1010`);
                    const nextRec = recRows[0]?.next_rec || 1;
                    const tenantEmpresa = req.tenantId || req.user?.IdEmpresa || 1;
                    await db.query(`
                        INSERT INTO sz1010 (z1_filial, z1_cliente, z1_loja, z1_nomecli, z1_produto, z1_codcli, z1_desccli, z1_revisao, r_e_c_n_o_, d_e_l_e_t_, IdEmpresa)
                        VALUES ('0101', ?, ?, ?, ?, ?, ?, ?, ?, '', ?)
                        ON DUPLICATE KEY UPDATE
                            z1_codcli = VALUES(z1_codcli),
                            z1_desccli = VALUES(z1_desccli),
                            z1_revisao = VALUES(z1_revisao)
                    `, [codCliFinal, lojaCliFinal, nomeCliFinal, codigoGerado, codDesHigienizado, descCurtada, revWabtec, nextRec, tenantEmpresa]);
                    sz1Criado = true;
                } catch (sz1Err) {
                    console.warn('[SINCO Criar Produto] Aviso sz1010:', sz1Err.message);
                }
            }

            return res.json({
                success: true,
                codigo: codigoGerado,
                revisao: revWabtec,
                descricao: descCurtada,
                desenho_cliente: codDesHigienizado,
                cliente_codigo: codCliFinal,
                cliente_loja: lojaCliFinal,
                cliente_nome: nomeCliFinal,
                sz1_criado: sz1Criado,
                uom: umLimpa,
                protheus_tipo: tipoLimpo,
                grupo: grupoLimpo,
                peso: numPeso,
                comprimento: numComprimento,
                largura: numLargura,
                espessura: numEspessura,
                volume: numVolume,
                cadastro_novo: 1,
                linhas_atualizadas: 0,
                message: `Produto ${codigoGerado} gerado com sucesso no SINCO!`
            });
        }

        // 1. Obter Token OAuth2 da API Protheus (com cache em memória e timeout de 35s)
        let accessToken = '';
        try {
            accessToken = await getProtheusToken();
        } catch (authError) {
            console.error('[Wabtec Criar Produto] Erro Token:', authError.response?.data || authError.message);
            return res.status(500).json({ error: 'Falha de comunicação com a API Protheus (Token): ' + (authError.response?.data?.message || authError.message) });
        }

        if (!accessToken) {
            return res.status(500).json({ error: 'Token JWT retornado pelo Protheus estava em branco.' });
        }

        // 3. Determinar o próximo código sequencial diretamente no backend para a API Protheus
        let novoCodigo = '';
        try {
            const pgRes = await pgDb.query(`
                SELECT b1_cod, r_e_c_n_o_
                FROM public.sb1010
                WHERE (b1_grupo = $1 OR b1_cod LIKE $2) AND COALESCE(d_e_l_e_t_, '') = ''
                ORDER BY r_e_c_n_o_ DESC
                LIMIT 30
            `, [grupoLimpo.padEnd(4, ' '), `${grupoLimpo}-%`]);

            let maiorNum = 0;
            const regex = new RegExp(`^${grupoLimpo}-(\\d+)$`, 'i');
            for (const row of pgRes.rows) {
                const codTrim = (row.b1_cod || '').trim();
                const match = codTrim.match(regex);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && (num < 9900 || num > 11000)) {
                        if (num > maiorNum) maiorNum = num;
                    }
                }
            }
            const proximoNum = maiorNum > 0 ? maiorNum + 1 : 1;
            novoCodigo = `${grupoLimpo}-${proximoNum}`;
        } catch (seqErr) {
            console.warn('[Wabtec Criar Produto] Erro ao calcular sequencial:', seqErr.message);
        }

        if (!novoCodigo) {
            return res.status(500).json({ error: `Não foi possível calcular o próximo código para o grupo ${grupoLimpo}.` });
        }

        console.log(`[Wabtec Criar Produto] Próximo código oficial calculado pelo backend: ${novoCodigo}`);

        // 4. Montagem do Payload estritamente idêntico a /engenharia/sinco/formulario (frmCadProtheusProd.vb / /produtos/create)
        const payloadCreate = {
            data: {
                produtos: [
                    {
                        EMPRESA: "01",
                        CFILANT: "01",
                        B1_COD: novoCodigo,
                        B1_GRUPO: grupoLimpo,
                        B1_DESC: descCurtada,
                        B1_XREVM: revWabtec,
                        B1_TIPO: tipoLimpo,
                        B1_UM: umLimpa,
                        B1_LOCPAD: "03",
                        B1_POSIPI: ncmLimpo,
                        B1_FINALID: "1",
                        B1_ORIGEM: "0",
                        B1_XCODDES: codDesHigienizado,
                        B1_PESO: numPeso,
                        B1_PESBRU: numPeso,
                        B5_CEME: descCurtada,
                        B5_COMPR: numComprimento,
                        B5_LARG: numLargura,
                        B5_ESPESS: numEspessura,
                        B5_VOLUME: numVolume
                    }
                ]
            }
        };

        console.log('[Wabtec Criar Produto] Submetendo inclusão padrão ao Protheus:', JSON.stringify(payloadCreate, null, 2));

        let createRes;
        try {
            createRes = await axios.post('https://192.168.1.60:47500/produtos/create', payloadCreate, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                httpsAgent,
                timeout: 35000
            });
        } catch (createErr) {
            if (createErr.response?.status === 401) {
                console.warn('[Wabtec Criar Produto] Token 401 detectado, forçando renovação e reenviando...');
                accessToken = await getProtheusToken(true);
                createRes = await axios.post('https://192.168.1.60:47500/produtos/create', payloadCreate, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    httpsAgent,
                    timeout: 35000
                });
            } else {
                throw createErr;
            }
        }

        const responseData = createRes.data;
        console.log('[Wabtec Criar Produto] Resposta Protheus create:', JSON.stringify(responseData));

        // Se o Protheus retornou erro de criação
        if (responseData.status === 'partial' || (Array.isArray(responseData.message) && responseData.message[0]?.startsWith('ERRO:'))) {
            return res.status(422).json({
                success: false,
                error: `O servidor Protheus TLPP (192.168.1.60:47500) recusou a criação: ${responseData.message?.join(' | ')}`,
                details: responseData
            });
        }

        // Captura do código oficial retornado ou confirmado pelo Protheus
        const matchCode = responseData.message?.[0]?.match(/\{([^}]+)\}/);
        const codigoGerado = (matchCode ? matchCode[1] : novoCodigo).trim();

        console.log(`[Wabtec Criar Produto] ✅ Código oficial purinho retornado pelo Protheus: ${codigoGerado}`);

        // 5. Amarração na SZ1010 (Produto x Cliente / Desenho Cliente)
        let sz1Criado = false;
        
        if (codCliFinal) {
            let sz1Recno = null;
            try {
                const { rows: sz1Rows } = await pgDb.query(`
                    SELECT r_e_c_n_o_ 
                    FROM public.sz1010 
                    WHERE TRIM(z1_cliente) = $1 
                      AND TRIM(z1_loja) = $2 
                      AND TRIM(z1_produto) = $3 
                      AND COALESCE(d_e_l_e_t_, '') <> '*'
                    LIMIT 1
                `, [codCliFinal, lojaCliFinal, codigoGerado]);
                if (sz1Rows && sz1Rows.length > 0) {
                    sz1Recno = Number(sz1Rows[0].r_e_c_n_o_);
                }
            } catch (pgSz1Err) {
                console.warn('[Wabtec Criar Produto] Aviso ao checar SZ1010:', pgSz1Err.message);
            }

            const itemSZ1 = {
                Z1_CLIENTE: codCliFinal,
                Z1_LOJA: lojaCliFinal || "0001",
                Z1_PRODUTO: codigoGerado,
                Z1_CODCLI: codDesHigienizado,
                Z1_DESCCLI: descCurtada || req.body.cliente_nome || 'PRODUTO',
                Z1_REVISAO: revWabtec
            };
            if (sz1Recno) {
                itemSZ1.RECNO = sz1Recno;
            }

            const payloadSZ1 = {
                data: {
                    EMPRESA: "01",
                    CFILANT: "0101",
                    NOPER: sz1Recno ? 4 : 3,
                    produtos_clientes: [itemSZ1]
                }
            };

            try {
                const sz1Res = await axios.post('https://192.168.1.60:47500/produto-cliente/editar', payloadSZ1, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    httpsAgent,
                    timeout: 35000
                });
                console.log(`[Wabtec Criar Produto] ✅ Amarração SZ1010 concluída (NOPER: ${sz1Recno ? 4 : 3}):`, sz1Res.data);
                sz1Criado = true;
            } catch (sz1Err) {
                console.error('[Wabtec Criar Produto] Erro ao vincular SZ1010 via API Protheus:', sz1Err.response?.data || sz1Err.message);
            }
        }

        // 6. Atualizar TODAS as ocorrências de desenho_cliente no MySQL (app_wabtec_estruturas)
        // Regra do Usuário: Somente executa a amarração de lote na tabela da WabTec se for fluxo WabTec ou se o cliente for WabTec.
        let linhasAtualizadas = 0;
        if (!is_sinco || codCliFinal === '00000739') {
            try {
                const [updateResult] = await db.query(`
                    UPDATE app_wabtec_estruturas
                    SET protheus_cod = ?,
                        protheus_desc = ?,
                        protheus_rev = ?,
                        uom = ?,
                        protheus_tipo = ?,
                        cadastro_novo = 1,
                        status_mapeamento = 'ENCONTRADO',
                        status_detalhe = 'Item cadastrado e vinculado no Protheus via SINCO'
                    WHERE desenho_cliente = ?
                `, [codigoGerado, descCurtada, revWabtec, umLimpa, tipoLimpo, codDesHigienizado]);
                linhasAtualizadas = updateResult.affectedRows || 0;
                console.log(`[Wabtec Criar Produto] ✅ ${linhasAtualizadas} linha(s) em app_wabtec_estruturas atualizada(s) para ${codDesHigienizado} -> ${codigoGerado} (cadastro_novo = 1)`);
            } catch (mysqlErr) {
                console.warn('[Wabtec Criar Produto] Aviso ao atualizar MySQL app_wabtec_estruturas:', mysqlErr.message);
            }
        }

        // 7. Retorno do número purinho para a aplicação
        res.json({
            success: true,
            codigo: codigoGerado,
            revisao: revWabtec,
            descricao: descCurtada,
            desenho_cliente: codDesHigienizado,
            cliente_codigo: codCliFinal,
            cliente_loja: lojaCliFinal,
            cliente_nome: req.body.cliente_nome || '',
            sz1_criado: sz1Criado,
            uom: umLimpa,
            protheus_tipo: tipoLimpo,
            grupo: grupoLimpo,
            peso: numPeso,
            comprimento: numComprimento,
            largura: numLargura,
            espessura: numEspessura,
            volume: numVolume,
            cadastro_novo: 1,
            linhas_atualizadas: linhasAtualizadas,
            message: `Produto ${codigoGerado} gerado com sucesso pelo Protheus!`,
            raw: responseData
        });

    } catch (err) {
        console.error('[Wabtec Criar Produto] Erro geral:', err.response?.data || err.message);
        res.status(500).json({ 
            error: 'Erro ao processar criação e vinculação do produto no Protheus: ' + (err.response?.data?.message || err.message) 
        });
    }
});

module.exports = router;

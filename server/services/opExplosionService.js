/**
 * opExplosionService.js
 * Motor de Explosão e Ciclo Completo de Ordem de Produção
 * Implementa as regras industriais do ERP Protheus (MATA650 / MATA380 / SD4010 / SG2010 / SH6010)
 */

const mysqlService = require('./mysqlService');
const db = require('../db');

/**
 * Busca estrutura (BOM) do produto com estratégia híbrida:
 * 1. Primeiro tenta no MySQL (erp_estruturas_bom)
 * 2. Fallback para PostgreSQL (sg1010 + sb1010) se não encontrar no MySQL
 */
async function fetchProductBom(productCode, conn) {
    const cleanCode = String(productCode || '').trim();
    if (!cleanCode) return [];

    // 1. Consulta no MySQL
    const client = conn || mysqlService;
    const [rowsMy] = await client.query(`
        SELECT 
            b.produto_pai_codigo,
            b.produto_filho_codigo as componente,
            p.descricao,
            COALESCE(p.tipo, 'MP') as tipo,
            COALESCE(b.unidade, p.unidade_medida, 'UN') as unidade,
            b.quantidade as qtd_base,
            b.perda_percentual,
            b.revisao,
            b.ordem_sequencia
        FROM erp_estruturas_bom b
        LEFT JOIN erp_produtos p ON p.codigo = b.produto_filho_codigo
        WHERE b.produto_pai_codigo = ? AND b.ativo = 1
        ORDER BY b.ordem_sequencia ASC, b.id ASC
    `, [cleanCode]);

    if (rowsMy && rowsMy.length > 0) {
        return rowsMy.map(r => ({
            componente: String(r.componente).trim(),
            descricao: String(r.descricao || '').trim(),
            tipo: String(r.tipo || 'MP').trim(),
            unidade: String(r.unidade || 'UN').trim(),
            qtd_base: parseFloat(r.qtd_base) || 1,
            perda_percentual: parseFloat(r.perda_percentual) || 0,
            origem: 'mysql'
        }));
    }

    // 2. Consulta no MySQL sg1010 + erp_produtos
    try {
        const [rowsSg1] = await client.query(`
            SELECT 
                TRIM(g1.g1_comp) as componente,
                TRIM(COALESCE(p.descricao, '')) as descricao,
                TRIM(COALESCE(p.tipo, 'MP')) as tipo,
                TRIM(COALESCE(p.unidade_medida, 'UN')) as unidade,
                COALESCE(g1.g1_quant, 1) as qtd_base,
                COALESCE(g1.g1_perda, 0) as perda_percentual
            FROM sg1010 g1
            LEFT JOIN erp_produtos p ON p.codigo = TRIM(g1.g1_comp)
            WHERE g1.g1_cod = ? AND g1.d_e_l_e_t_ = ''
            ORDER BY g1.g1_trt ASC, g1.g1_comp ASC
        `, [cleanCode]);

        if (rowsSg1 && rowsSg1.length > 0) {
            return rowsSg1.map(r => ({
                componente: String(r.componente).trim(),
                descricao: String(r.descricao || '').trim(),
                tipo: String(r.tipo || 'MP').trim(),
                unidade: String(r.unidade || 'UN').trim(),
                qtd_base: parseFloat(r.qtd_base) || 1,
                perda_percentual: parseFloat(r.perda_percentual) || 0,
                origem: 'mysql_sg1010'
            }));
        }
    } catch (mySg1Err) {
        console.warn(`⚠️ [BOM sg1010 MySQL] Aviso:`, mySg1Err.message);
    }

    // 3. Fallback no PostgreSQL (sg1010 + sb1010)
    try {
        const { rows: rowsPg } = await db.query(`
            SELECT 
                TRIM(g1.g1_comp) as componente,
                TRIM(COALESCE(sb1.b1_desc, '')) as descricao,
                TRIM(COALESCE(sb1.b1_tipo, 'MP')) as tipo,
                TRIM(COALESCE(sb1.b1_um, 'UN')) as unidade,
                COALESCE(g1.g1_quant, 1)::numeric as qtd_base,
                COALESCE(g1.g1_perda, 0)::numeric as perda_percentual
            FROM public.sg1010 g1
            LEFT JOIN public.sb1010 sb1 
                ON TRIM(sb1.b1_cod) = TRIM(g1.g1_comp) 
                AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            WHERE TRIM(g1.g1_cod) = $1 
              AND COALESCE(g1.d_e_l_e_t_, '') = ''
            -- BUGFIX (IA): Correção do nome da coluna Protheus sg1010 de g1_trf para g1_trt no ORDER BY
            ORDER BY g1.g1_trt ASC, g1.g1_comp ASC
        `, [cleanCode]);

        if (rowsPg && rowsPg.length > 0) {
            return rowsPg.map(r => ({
                componente: String(r.componente).trim(),
                descricao: String(r.descricao || '').trim(),
                tipo: String(r.tipo || 'MP').trim(),
                unidade: String(r.unidade || 'UN').trim(),
                qtd_base: parseFloat(r.qtd_base) || 1,
                perda_percentual: parseFloat(r.perda_percentual) || 0,
                origem: 'postgres'
            }));
        }
    } catch (pgErr) {
        console.warn(`⚠️ [BOM Fallback PG] Erro ao buscar BOM do produto ${cleanCode} no Postgres:`, pgErr.message);
    }

    return [];
}

/**
 * Busca roteiro de operações do produto com estratégia híbrida:
 * 1. Primeiro tenta no MySQL (erp_roteiros_operacoes)
 * 2. Segundo tenta no MySQL (sg2010 + sh1010)
 * 3. Fallback para PostgreSQL (sg2010 + sh1010)
 */
async function fetchProductRouting(productCode, conn) {
    const cleanCode = String(productCode || '').trim();
    if (!cleanCode) return [];

    const client = conn || mysqlService;

    // 1. Consulta no MySQL (erp_roteiros_operacoes)
    const [rowsMy] = await client.query(`
        SELECT 
            codigo_produto,
            operacao_seq,
            codigo_recurso,
            descricao_operacao,
            tempo_setup_minutos,
            tempo_operacao_minutos,
            unidade_tempo,
            centro_custo
        FROM erp_roteiros_operacoes
        WHERE codigo_produto = ?
        ORDER BY CAST(REGEXP_REPLACE(operacao_seq, '[^0-9]', '') AS UNSIGNED) ASC, operacao_seq ASC
    `, [cleanCode]);

    if (rowsMy && rowsMy.length > 0) {
        return rowsMy.map(r => ({
            operacao_seq: String(r.operacao_seq).trim(),
            codigo_recurso: String(r.codigo_recurso).trim(),
            descricao_operacao: String(r.descricao_operacao || '').trim(),
            tempo_setup_minutos: parseFloat(r.tempo_setup_minutos) || 0,
            tempo_operacao_minutos: parseFloat(r.tempo_operacao_minutos) || 0,
            origem: 'mysql'
        }));
    }

    // 2. Consulta no MySQL (sg2010 + sh1010)
    try {
        const [rowsSg2] = await client.query(`
            SELECT 
                TRIM(g2.g2_operac) as operacao_seq,
                TRIM(g2.g2_recurso) as codigo_recurso,
                TRIM(COALESCE(h1.h1_descri, CONCAT('Operação ', g2.g2_operac))) as descricao_operacao,
                COALESCE(g2.g2_setup, 0) as tempo_setup_minutos,
                COALESCE(g2.g2_tempad, 0) as tempo_operacao_minutos
            FROM sg2010 g2
            LEFT JOIN sh1010 h1 ON h1.h1_codigo = TRIM(g2.g2_recurso) AND h1.d_e_l_e_t_ = ''
            WHERE g2.g2_produto = ? AND g2.d_e_l_e_t_ = ''
            ORDER BY CAST(REGEXP_REPLACE(g2.g2_operac, '[^0-9]', '') AS UNSIGNED) ASC, g2.g2_operac ASC
        `, [cleanCode]);

        if (rowsSg2 && rowsSg2.length > 0) {
            return rowsSg2.map(r => ({
                operacao_seq: String(r.operacao_seq).trim(),
                codigo_recurso: String(r.codigo_recurso).trim(),
                descricao_operacao: String(r.descricao_operacao || '').trim(),
                tempo_setup_minutos: parseFloat(r.tempo_setup_minutos) || 0,
                tempo_operacao_minutos: parseFloat(r.tempo_operacao_minutos) || 0,
                origem: 'mysql_sg2010'
            }));
        }
    } catch (mySg2Err) {
        console.warn(`⚠️ [ROTEIRO sg2010 MySQL] Aviso:`, mySg2Err.message);
    }

    // 3. Fallback no PostgreSQL (sg2010 + sh1010)
    try {
        const { rows: rowsPg } = await db.query(`
            SELECT 
                TRIM(g2.g2_operac) as operacao_seq,
                TRIM(g2.g2_recurso) as codigo_recurso,
                TRIM(COALESCE(h1.h1_descri, 'Operação ' || g2.g2_operac)) as descricao_operacao,
                COALESCE(g2.g2_setup, 0)::numeric as tempo_setup_minutos,
                COALESCE(g2.g2_tempad, 0)::numeric as tempo_operacao_minutos
            FROM public.sg2010 g2
            LEFT JOIN public.sh1010 h1 
                ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso)
                AND COALESCE(h1.d_e_l_e_t_, '') = ''
            WHERE TRIM(g2.g2_produto) = $1
              AND COALESCE(g2.d_e_l_e_t_, '') = ''
            ORDER BY TRIM(g2.g2_operac) ASC
        `, [cleanCode]);

        if (rowsPg && rowsPg.length > 0) {
            return rowsPg.map(r => ({
                operacao_seq: String(r.operacao_seq).trim(),
                codigo_recurso: String(r.codigo_recurso).trim(),
                descricao_operacao: String(r.descricao_operacao || '').trim(),
                tempo_setup_minutos: parseFloat(r.tempo_setup_minutos) || 0,
                tempo_operacao_minutos: parseFloat(r.tempo_operacao_minutos) || 0,
                origem: 'postgres'
            }));
        }
    } catch (pgErr) {
        console.warn(`⚠️ [ROTEIRO Fallback PG] Erro ao buscar roteiro do produto ${cleanCode} no Postgres:`, pgErr.message);
    }

    return [];
}

/**
 * Função Principal de Explosão de OP
 * - Explode a BOM completa proporcionalmente à quantidade
 * - Registra empenhos em erp_ordens_producao_materiais
 * - Instancia o roteiro com tempos em erp_ordens_producao_operacoes
 * - Reserva saldo_empenhado em erp_estoque_saldos
 * - Cria sub-OPs para semiacabados com estrutura própria
 */
async function explodirOrdemProducao({
    numero_op,
    produto_codigo,
    quantidade,
    pedido_venda = null,
    item_pedido = null,
    data_inicio = null,
    data_fim = null,
    conn = null
}) {
    const client = conn || mysqlService;
    const cleanOp = String(numero_op).trim();
    const cleanProd = String(produto_codigo).trim();
    const opQty = parseFloat(quantidade) || 0;

    if (!cleanOp || !cleanProd || opQty <= 0) {
        console.warn(`[OP Explosion] Parâmetros inválidos para explosão: OP=${cleanOp}, Prod=${cleanProd}, Qtd=${opQty}`);
        return { success: false, error: 'Parâmetros inválidos' };
    }

    console.log(`⚙️ [OP EXPLOSION ENGINE] Iniciando explosão completa para OP ${cleanOp} | Produto: ${cleanProd} | Quantidade: ${opQty}`);

    // Limpa empenhos e operações pré-existentes da OP principal e de suas sub-OPs (idempotência)
    const baseOpPattern = `${cleanOp}%`;
    await client.query('DELETE FROM erp_ordens_producao_materiais WHERE numero_op LIKE ?', [baseOpPattern]);
    await client.query('DELETE FROM sd4010 WHERE d4_op LIKE ?', [baseOpPattern]);
    await client.query('DELETE FROM erp_ordens_producao_operacoes WHERE numero_op LIKE ?', [baseOpPattern]);
    await client.query('DELETE FROM sh6010 WHERE h6_op LIKE ?', [baseOpPattern]);
    await client.query('DELETE FROM erp_ordens_producao WHERE op_pai = ?', [cleanOp]);
    await client.query('DELETE FROM sc2010 WHERE c2_op LIKE ? AND c2_sequen > "001"', [baseOpPattern]);

    const generatedSubOps = [];
    let subOpSeq = 1;

    // Fila recursiva para processar árvore de produto (todos os níveis e subníveis)
    async function processarEstruturaRecursiva(parentCode, parentOpNum, parentMultiplier, currentLevel, visitedSet = new Set()) {
        if (currentLevel > 10) return; // Limite de segurança de recursão

        const currentVisited = new Set(visitedSet);
        currentVisited.add(parentCode);

        const bom = await fetchProductBom(parentCode, client);
        if (!bom || bom.length === 0) return;

        for (const item of bom) {
            // Identificação de auto-referência direta (ex: MT2-0003 consome MT2-0003 como matéria-prima base)
            const isSelfReference = (item.componente === parentCode);
            // Prevenção de loop cíclico ancestral (se já foi visitado acima na árvore, exceto auto-referência direta de 1 nível)
            const isAncestorCycle = currentVisited.has(item.componente) && !isSelfReference;

            if (isAncestorCycle) {
                console.warn(`[OP Explosion] Referência cíclica ancestral ignorada: ${parentCode} -> ${item.componente}`);
                continue;
            }

            const fatorPerda = 1 + (item.perda_percentual / 100);
            const qtdNecessaria = item.qtd_base * parentMultiplier * fatorPerda;

            let subOpParaItem = null;

            // Busca se o componente possui sub-estrutura técnica (BOM em qualquer nível)
            // Se for auto-referência (insumo homônimo), ele NÃO gera outra Sub-OP para si mesmo (evita loop infinito de OPs)
            let hasChildren = false;
            let isManufactured = false;

            if (!isSelfReference) {
                const subBom = await fetchProductBom(item.componente, client);
                hasChildren = subBom && subBom.length > 0;
                isManufactured = hasChildren || item.tipo === 'PI' || item.tipo === 'PA' || item.tipo === 'SL';
            }
            if (isManufactured && hasChildren) {
                subOpSeq += 1;
                const subSeqStr = String(subOpSeq).padStart(3, '0');
                // Numeração de sub-op padrão Protheus: base da OP + sequência (ex: 00000101002)
                subOpParaItem = `${cleanOp}${subSeqStr}`;

                // Inserir registro de Sub-OP em erp_ordens_producao
                try {
                    await client.query(`
                        INSERT INTO erp_ordens_producao (
                            numero_op, produto_codigo, quantidade_planejada, quantidade_produzida,
                            quantidade_perdida, pedido_venda, item_pedido, data_emissao,
                            data_inicio_prevista, data_fim_prevista, prioridade, status,
                            op_pai, is_sub_op, nivel, observacoes
                        ) VALUES (?, ?, ?, 0, 0, ?, ?, CURRENT_DATE, ?, ?, 5, 'aberta', ?, 1, ?, ?)
                        ON DUPLICATE KEY UPDATE 
                            quantidade_planejada = VALUES(quantidade_planejada),
                            op_pai = VALUES(op_pai),
                            is_sub_op = 1
                    `, [
                        subOpParaItem,
                        item.componente,
                        qtdNecessaria,
                        pedido_venda,
                        item_pedido,
                        data_inicio,
                        data_fim,
                        parentOpNum,
                        currentLevel,
                        `Sub-OP nível ${currentLevel} para ${item.componente} da OP ${cleanOp}`
                    ]);

                    // Inserir espelho Protheus em sc2010
                    await client.query(`
                        INSERT INTO sc2010 (
                            c2_filial, c2_num, c2_item, c2_sequen, c2_produto,
                            c2_local, c2_quant, c2_um, c2_datpri, c2_datprf,
                            c2_obs, c2_emissao, c2_prior, c2_quje, c2_status,
                            c2_perda, c2_roteiro, c2_recurso, c2_pedido, c2_itempv,
                            c2_tpop, c2_op, d_e_l_e_t_, IdEmpresa
                        ) VALUES (
                            '0101', ?, ?, ?, ?,
                            '01', ?, 'UN', ?, ?,
                            ?, DATE_FORMAT(CURRENT_DATE, '%Y%m%d'), '500', 0, 'P',
                            0, '01', '', ?, ?,
                            'F', ?, '', 1
                        ) ON DUPLICATE KEY UPDATE
                            c2_quant = VALUES(c2_quant),
                            c2_status = VALUES(c2_status)
                    `, [
                        cleanOp.substring(0, 6),
                        cleanOp.slice(6),
                        subSeqStr,
                        item.componente,
                        qtdNecessaria,
                        data_inicio ? String(data_inicio).replace(/-/g, '') : '',
                        data_fim ? String(data_fim).replace(/-/g, '') : '',
                        `Sub-OP nível ${currentLevel} para ${item.componente}`,
                        pedido_venda || '',
                        item_pedido || '',
                        subOpParaItem
                    ]);

                    generatedSubOps.push({
                        numero_op: subOpParaItem,
                        produto_codigo: item.componente,
                        quantidade: qtdNecessaria,
                        op_pai: parentOpNum,
                        nivel: currentLevel
                    });

                    // Instancia todas as operações do roteiro da Sub-OP no MySQL e SH6010
                    await instanciarOperacoesDaOp(subOpParaItem, item.componente, qtdNecessaria, client);

                    // Continua a explosão recursiva para os componentes do próximo nível
                    await processarEstruturaRecursiva(item.componente, subOpParaItem, qtdNecessaria, currentLevel + 1, currentVisited);
                } catch (subErr) {
                    console.warn(`[OP Explosion] Aviso ao criar Sub-OP ${subOpParaItem}:`, subErr.message);
                }
            }

            // Gravar empenho do componente em erp_ordens_producao_materiais
            await client.query(`
                INSERT INTO erp_ordens_producao_materiais (
                    numero_op, produto_pai, componente_codigo, descricao_componente,
                    tipo_componente, quantidade_base, quantidade_necessaria, quantidade_empenhada,
                    quantidade_consumida, unidade_medida, armazem, nivel_estrutura, sub_op_gerada
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '01', ?, ?)
            `, [
                parentOpNum,
                parentCode,
                item.componente,
                item.descricao,
                item.tipo,
                item.qtd_base,
                qtdNecessaria,
                qtdNecessaria,
                item.unidade,
                currentLevel,
                subOpParaItem
            ]);

            // Gravar espelho Protheus do empenho em sd4010
            try {
                await client.query(`
                    INSERT INTO sd4010 (
                        d4_filial, d4_cod, d4_local, d4_op, d4_data,
                        d4_qtdeori, d4_quant, d4_trt, d4_oporig, d4_produto,
                        d4_roteiro, d4_operac, d4_qtneces, d_e_l_e_t_, IdEmpresa
                    ) VALUES (
                        '0101', ?, '01', ?, DATE_FORMAT(CURRENT_DATE, '%Y%m%d'),
                        ?, ?, '', '', ?,
                        '01', '', ?, '', 1
                    )
                `, [
                    item.componente,
                    parentOpNum,
                    qtdNecessaria,
                    qtdNecessaria,
                    parentCode,
                    qtdNecessaria
                ]);
            } catch (sd4Err) {
                console.warn(`[OP Explosion] Aviso ao gravar SD4010 para ${item.componente}:`, sd4Err.message);
            }

            // Atualizar saldo_empenhado no estoque (erp_estoque_saldos)
            try {
                await client.query(`
                    INSERT INTO erp_estoque_saldos (produto_codigo, armazem, saldo_atual, saldo_empenhado)
                    VALUES (?, '01', 0, ?)
                    ON DUPLICATE KEY UPDATE saldo_empenhado = saldo_empenhado + VALUES(saldo_empenhado)
                `, [item.componente, qtdNecessaria]);
            } catch (stockErr) {
                console.warn(`[OP Explosion] Aviso ao reservar estoque para ${item.componente}:`, stockErr.message);
            }

            // Atualizar reserva de empenho no espelho Protheus sb2010 (B2_QEMP)
            try {
                const [upSb2] = await client.query(`
                    UPDATE sb2010 
                    SET b2_qemp = b2_qemp + ?
                    WHERE b2_cod = ? AND b2_local = '01' AND d_e_l_e_t_ = ''
                `, [qtdNecessaria, item.componente]);

                if (upSb2.affectedRows === 0) {
                    await client.query(`
                        INSERT INTO sb2010 (b2_filial, b2_cod, b2_local, b2_qatu, b2_qemp, b2_reserva, b2_qpedven, d_e_l_e_t_, IdEmpresa)
                        VALUES ('0101', ?, '01', 0, ?, 0, 0, '', 1)
                    `, [item.componente, qtdNecessaria]);
                }
            } catch (sb2Err) {
                console.warn(`[OP Explosion] Aviso ao atualizar SB2010 para ${item.componente}:`, sb2Err.message);
            }
        }
    }

    // Função auxiliar para instanciar roteiro de operações (em erp_ordens_producao_operacoes E sh6010)
    async function instanciarOperacoesDaOp(targetOpNum, targetProduct, targetQty, sqlClient) {
        const routing = await fetchProductRouting(targetProduct, sqlClient);
        if (!routing || routing.length === 0) return 0;

        let opsInserted = 0;
        for (const op of routing) {
            const setup = op.tempo_setup_minutos;
            const tempoUnit = op.tempo_operacao_minutos;
            const tempoTotal = setup + (targetQty * tempoUnit);

            // 1. Tabela nativa ERP
            await sqlClient.query(`
                INSERT INTO erp_ordens_producao_operacoes (
                    numero_op, produto_codigo, operacao_seq, codigo_recurso,
                    descricao_operacao, tempo_setup_minutos, tempo_operacao_minutos,
                    tempo_total_minutos, quantidade_planejada, quantidade_produzida,
                    quantidade_refugo, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'pendente')
            `, [
                targetOpNum,
                targetProduct,
                op.operacao_seq,
                op.codigo_recurso,
                op.descricao_operacao,
                setup,
                tempoUnit,
                tempoTotal,
                targetQty
            ]);

            // 2. Espelho Protheus SH6010
            try {
                await sqlClient.query(`
                    INSERT INTO sh6010 (
                        h6_filial, h6_op, h6_produto, h6_operac, h6_recurso,
                        h6_dataini, h6_datafin, h6_qtdprod, h6_qtdperd, h6_tempo,
                        h6_status, d_e_l_e_t_, IdEmpresa
                    ) VALUES (
                        '0101', ?, ?, ?, ?,
                        DATE_FORMAT(CURRENT_DATE, '%Y%m%d'), DATE_FORMAT(CURRENT_DATE, '%Y%m%d'),
                        0, 0, ?,
                        'P', '', 1
                    )
                `, [
                    targetOpNum,
                    targetProduct,
                    op.operacao_seq,
                    op.codigo_recurso,
                    tempoTotal
                ]);
            } catch (sh6Err) {
                console.warn(`[OP Explosion] Aviso ao gravar SH6010 para OP ${targetOpNum} Op ${op.operacao_seq}:`, sh6Err.message);
            }

            opsInserted++;
        }
        return opsInserted;
    }

    // 1. Instancia as operações da OP principal
    const totalOps = await instanciarOperacoesDaOp(cleanOp, cleanProd, opQty, client);

    // 2. Explode a estrutura completa (materiais e sub-ops)
    await processarEstruturaRecursiva(cleanProd, cleanOp, opQty, 1);

    // BUGFIX (IA): Desestruturação resiliente do resultado de contagem de materiais (compatível com [rows, fields] e rows direto)
    let totalMateriais = 0;
    try {
        const queryRes = await client.query('SELECT COUNT(*) as total FROM erp_ordens_producao_materiais WHERE numero_op = ?', [cleanOp]);
        const rows = Array.isArray(queryRes) ? (Array.isArray(queryRes[0]) ? queryRes[0] : queryRes) : [];
        totalMateriais = (rows[0] && typeof rows[0].total !== 'undefined') ? Number(rows[0].total) : 0;
    } catch (cntErr) {
        console.warn(`[OP Explosion] Aviso ao consultar total de materiais para OP ${cleanOp}:`, cntErr.message);
    }

    console.log(`✅ [OP EXPLOSION ENGINE CONCLUÍDO] OP ${cleanOp}: ${totalMateriais} materiais empenhados, ${totalOps} operações instanciadas, ${generatedSubOps.length} sub-OPs geradas.`);

    return {
        success: true,
        numero_op: cleanOp,
        produto_codigo: cleanProd,
        quantidade: opQty,
        total_materiais: totalMateriais,
        total_operacoes: totalOps,
        sub_ops: generatedSubOps
    };
}

module.exports = {
    explodirOrdemProducao,
    fetchProductBom,
    fetchProductRouting
};

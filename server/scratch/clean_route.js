            }
        };

        // 5. Chama Gemini com contexto completo
        const analise = await analisarRelatorioFCS(reportEnriquecido);

        res.json({ analise });

    } catch (error) {
        console.error('\u274c Erro em /smart-plan/analyze:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

// ── ROTA: Estrutura de Produto por Pedido/OP (BOM Tree + Apontamentos) ──────────
// GET /api/pcp-refinado/estrutura-pedido
// Params: op, pedido, produto, cliente, operacao, recurso,
//         data_inicio, data_fim, data_entrega_inicio, data_entrega_fim,
//         status, tipo_produto
router.get('/estrutura-pedido', async (req, res) => {
    let pgClient;
    try {
        const {
            op = '', pedido = '', produto = '', cliente = '',
            operacao = '', recurso = '',
            data_inicio = '', data_fim = '',
            data_entrega_inicio = '', data_entrega_fim = '',
            status: statusFilter = '',
            tipo_produto = ''
        } = req.query;

        pgClient = await db.connect();

        // ── 1. OPs do Protheus (sc2010) ──────────────────────────────────────
        const pgWhere = [`COALESCE(c2.d_e_l_e_t_,'') IN ('',' ')`];
        const pgParams = [];

        if (op)      { pgParams.push(op.trim().padStart(6,'0'));      pgWhere.push(`TRIM(c2.c2_num) = $${pgParams.length}`); }
        if (pedido)  { pgParams.push(pedido.trim().padStart(6,'0'));   pgWhere.push(`TRIM(c2.c2_pedido) = $${pgParams.length}`); }
        if (produto) { pgParams.push(`%${produto.trim().toUpperCase()}%`); pgWhere.push(`(UPPER(TRIM(c2.c2_produto)) LIKE $${pgParams.length} OR UPPER(TRIM(b1.b1_desc)) LIKE $${pgParams.length})`); }
        if (data_inicio) { pgParams.push(data_inicio.replace(/-/g,'')); pgWhere.push(`c2.c2_datpri >= $${pgParams.length}`); }
        if (data_fim)    { pgParams.push(data_fim.replace(/-/g,''));   pgWhere.push(`c2.c2_datprf <= $${pgParams.length}`); }
        if (data_entrega_inicio) { pgParams.push(data_entrega_inicio.replace(/-/g,'')); pgWhere.push(`c6.c6_entreg >= $${pgParams.length}`); }
        if (data_entrega_fim)    { pgParams.push(data_entrega_fim.replace(/-/g,''));   pgWhere.push(`c6.c6_entreg <= $${pgParams.length}`); }
        if (tipo_produto && tipo_produto !== 'Todos') { pgParams.push(tipo_produto.trim()); pgWhere.push(`TRIM(b1.b1_tipo) = $${pgParams.length}`); }
        if (cliente) { pgParams.push(`%${cliente.trim().toUpperCase()}%`); pgWhere.push(`UPPER(TRIM(c6.c6_zclien)) LIKE $${pgParams.length}`); }

        // Filtro por operação/recurso (precisa de join com sg2010)
        let joinSg2 = '';
        if (operacao || recurso) {
            joinSg2 = `JOIN public.sg2010 g2filt ON TRIM(g2filt.g2_produto) = TRIM(c2.c2_produto)
                       AND COALESCE(g2filt.d_e_l_e_t_,'') IN ('',' ')`;
            if (operacao) { pgParams.push(operacao.trim()); pgWhere.push(`TRIM(g2filt.g2_operac) = $${pgParams.length}`); }
            if (recurso)  { pgParams.push(`%${recurso.trim().toUpperCase()}%`); pgWhere.push(`UPPER(TRIM(g2filt.g2_recurso)) LIKE $${pgParams.length}`); }
        }

        const pgQuery = `
            SELECT DISTINCT
                TRIM(c2.c2_num)      AS pedido,
                TRIM(c2.c2_item)     AS item_op,
                TRIM(c2.c2_sequen)   AS sequen,
                TRIM(c2.c2_produto)  AS produto,
                c2.c2_quant          AS qtde,
                c2.c2_quje           AS qtde_feita,
                TRIM(c2.c2_itempv)   AS item_pv,
                TRIM(c2.c2_pedido)   AS num_pedido,
                TRIM(c2.c2_status)   AS status_op,
                c2.c2_datpri         AS dt_abertura,
                c2.c2_datprf         AS dt_prazo_op,
                TRIM(b1.b1_desc)     AS desc_produto,
                TRIM(b1.b1_tipo)     AS tipo_produto,
                TRIM(b1.b1_um)       AS um,
                TRIM(c6.c6_entreg)   AS dt_entrega_pv,
                TRIM(c6.c6_zclien)   AS cliente,
                TRIM(c5.c5_client)   AS cod_cliente
            FROM public.sc2010 c2
            LEFT JOIN public.sb1010 b1 ON TRIM(b1.b1_cod) = TRIM(c2.c2_produto)
                AND COALESCE(b1.d_e_l_e_t_,'') IN ('',' ')
            LEFT JOIN public.sc6010 c6 ON TRIM(c6.c6_num) = TRIM(c2.c2_pedido)
                AND TRIM(c6.c6_itemop) = TRIM(c2.c2_item)
                AND COALESCE(c6.d_e_l_e_t_,'') IN ('',' ')
            LEFT JOIN public.sc5010 c5 ON TRIM(c5.c5_num) = TRIM(c2.c2_pedido)
                AND COALESCE(c5.d_e_l_e_t_,'') IN ('',' ')
            ${joinSg2}
            WHERE ${pgWhere.join(' AND ')}
            ORDER BY pedido, item_op, sequen
            LIMIT 500
        `;

        const pgRes = await pgClient.query(pgQuery, pgParams);
        const opRows = pgRes.rows;

        if (opRows.length === 0) {
            return res.json({ pedidos: [], total: 0 });
        }

        // Produtos distintos para buscar BOM e Roteiro
        const produtos = [...new Set(opRows.map(r => r.produto).filter(Boolean))];

        // ── 2. Estrutura BOM Recursiva — SG1010 ───────────────────────────────
        const sg1Res = await pgClient.query(`
            WITH RECURSIVE bom_tree AS (
                -- Nível 0 (Raiz)
                SELECT TRIM(g1_cod) pai, TRIM(g1_comp) filho,
                       g1_quant qtde_unitaria, TRIM(g1_niv) nivel, g1_perda perda,
                       1 AS curr_level
                FROM public.sg1010
                WHERE COALESCE(d_e_l_e_t_,'') IN ('',' ')
                  AND TRIM(g1_cod) = ANY($1)

                UNION

                -- Níveis subsequentes
                SELECT TRIM(s.g1_cod), TRIM(s.g1_comp),
                       s.g1_quant, TRIM(s.g1_niv), s.g1_perda,
                       b.curr_level + 1
                FROM public.sg1010 s
                INNER JOIN bom_tree b ON TRIM(s.g1_cod) = b.filho
                WHERE COALESCE(s.d_e_l_e_t_,'') IN ('',' ')
                  AND b.curr_level < 5
            )
            SELECT DISTINCT pai, filho, qtde_unitaria, nivel, perda
            FROM bom_tree
            ORDER BY nivel, filho;
        `, [produtos]);

        const bomMap = {};
        const allComponents = new Set([...produtos]);
        
        sg1Res.rows.forEach(r => {
            if (!bomMap[r.pai]) bomMap[r.pai] = [];
            bomMap[r.pai].push(r);
            allComponents.add(r.filho);
        });

        const allComponentsArr = [...allComponents];

        // ── 3. Roteiro de Produção (SG2010) para TODOS os níveis ─────────────
        const sg2Res = await pgClient.query(`
            SELECT TRIM(g2_produto) produto, TRIM(g2_operac) operac,
                   TRIM(g2_recurso) recurso, TRIM(g2_descri) desc_recurso,
                   g2_tempad tempo_padrao
            FROM public.sg2010
            WHERE COALESCE(d_e_l_e_t_,'') IN ('',' ')
              AND TRIM(g2_produto) = ANY($1)
            ORDER BY g2_produto, g2_operac
        `, [allComponentsArr]);

        const rotMap = {};
        sg2Res.rows.forEach(r => {
            if (!rotMap[r.produto]) rotMap[r.produto] = [];
            rotMap[r.produto].push(r);
        });

        // ── 3.5 Descrições de TODOS os itens (SB1010) ──────────────────────────
        let filhoDescMap = {};
        if (allComponentsArr.length > 0) {
            const sb1Res = await pgClient.query(
                `SELECT TRIM(b1_cod) cod, TRIM(b1_desc) descricao, TRIM(b1_tipo) tipo, TRIM(b1_um) um
                 FROM public.sb1010
                 WHERE COALESCE(d_e_l_e_t_,'') IN ('',' ') AND TRIM(b1_cod) = ANY($1)`,
                [filhos]
            );
            sb1Res.rows.forEach(r => { filhoDescMap[r.cod] = r; });
        }
        pgClient.release(); pgClient = null;

        // ── 4. Apontamentos (MySQL) ────────────────────────────────────────────
        const opNums  = [...new Set(opRows.map(r => r.pedido))];
        const [appointments] = await mysqlPool.query(`
            SELECT op_numero, op_item, op_sequencia, operacao_codigo,
                   SUM(quantidade) AS total_produzido,
                   MAX(data_fim)   AS ultima_atualizacao
            FROM app_production_appointments
            WHERE op_numero IN (?)
            GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
        `, [opNums]);

        const apptMap = {};
        appointments.forEach(a => {
            const key = `${a.op_numero}|${a.op_item}|${a.op_sequencia}|${a.operacao_codigo}`;
            apptMap[key] = a;
        });

        // ── 5. Datas planejadas FCS (MySQL) ───────────────────────────────────
        const [fcsPlanning] = await mysqlPool.query(`
            SELECT op_numero, op_item, MIN(data_planejada_inicio) AS dt_inicio_fcs, MAX(data_planejada_fim) AS dt_fim_fcs
            FROM app_production_planning
            WHERE op_numero IN (?)
            GROUP BY op_numero, op_item
        `, [opNums]);

        const fcsMap = {};
        fcsPlanning.forEach(f => {
            fcsMap[`${f.op_numero}|${f.op_item}`] = f;
        });

        // ── 6. Montar Estrutura em Árvore ─────────────────────────────────────
        const pedidosMap = {};

        opRows.forEach(op => {
            const numPedido = op.num_pedido || op.pedido;
            if (!pedidosMap[numPedido]) {
                pedidosMap[numPedido] = {
                    pedido: numPedido,
                    cliente: op.cliente || '—',
                    cod_cliente: op.cod_cliente,
                    itens: {},
                    total_itens: 0,
                    pct_global: 0
                };
            }

            const itemKey = op.item_op;
            if (!pedidosMap[numPedido].itens[itemKey]) {
                const fcs = fcsMap[`${op.pedido}|${op.item_op}`] || {};

                // Monta lista de recursos com apontamentos
                const roteiro = (rotMap[op.produto] || []).map(r => {
                    const apptKey = `${op.pedido}|${op.item_op}|${op.sequen}|${r.operac}`;
                    const appt = apptMap[apptKey] || {};
                    const qtdeProd = Number(appt.total_produzido) || 0;
                    const qtdePlan = Number(op.qtde) || 0;
                    const pct = qtdePlan > 0 ? Math.min(100, Math.round((qtdeProd / qtdePlan) * 100)) : 0;

                    let statusRec = 'waiting';
                    if (pct >= 100) statusRec = 'done';
                    else if (pct > 0) statusRec = 'in_progress';

                    return {
                        operac:       r.operac,
                        recurso:      r.recurso,
                        desc_recurso: r.desc_recurso || r.recurso,
                        tempo_padrao: Number(r.tempo_padrao) || 0,
                        tempo_total_min: Math.round((Number(r.tempo_padrao) || 0) * (Number(op.qtde) || 0)),
                        qtde_planejada: qtdePlan,
                        qtde_produzida: qtdeProd,
                        pct,
                        status: statusRec,
                        ultima_atualizacao: appt.ultima_atualizacao || null
                    };
                });

                // Status global do item = média ponderada pela última op
                let pctItem = 0;
                if (roteiro.length > 0) {
                    const lastOp = roteiro[roteiro.length - 1];
                    pctItem = lastOp.pct;
                }

                let statusItem = 'waiting';
                if (pctItem >= 100) statusItem = 'done';
                else if (pctItem > 0) statusItem = 'in_progress';
                else if (roteiro.some(r => r.pct > 0)) statusItem = 'in_progress';

                // Materiais BOM
                const materiais = (bomMap[op.produto] || []).map(m => {
                    const d = filhoDescMap[m.filho] || {};
                    return {
                        codigo:       m.filho,
                        descricao:    d.descricao || '—',
                        tipo:         d.tipo || '?',
                        um:           d.um || '?',
                        nivel:        m.nivel,
                        qtde_unitaria: Number(m.qtde_unitaria) || 0,
                        qtde_total:   Math.round(((Number(m.qtde_unitaria) || 0) * (Number(op.qtde) || 0)) * 1000) / 1000,
                        perda:        Number(m.perda) || 0
                    };
                });

                pedidosMap[numPedido].itens[itemKey] = {
                    op:           op.pedido,
                    item_op:      op.item_op,
                    item_pv:      op.item_pv,
                    sequen:       op.sequen,
                    produto:      op.produto,
                    desc_produto: op.desc_produto || '—',
                    tipo_produto: op.tipo_produto || '?',
                    um:           op.um || 'UN',
                    qtde:         Number(op.qtde) || 0,
                    qtde_feita:   Number(op.qtde_feita) || 0,
                    qtde_pendente: Math.max(0, (Number(op.qtde) || 0) - (Number(op.qtde_feita) || 0)),
                    pct_global:   pctItem,
                    status:       statusItem,
                    dt_abertura:  op.dt_abertura || '',
                    dt_prazo_op:  op.dt_prazo_op || '',
                    dt_entrega_pv: op.dt_entrega_pv || '',
                    dt_inicio_fcs: fcs.dt_inicio_fcs || null,
                    dt_fim_fcs:    fcs.dt_fim_fcs || null,
                    recursos:     roteiro,
                    materiais
                };
            }
        });

        // Converte mapas em arrays + calcula pct_global do pedido
        const pedidos = Object.values(pedidosMap).map(p => {
            const itensArr = Object.values(p.itens);

            // Aplica filtro de status (se fornecido)
            const itensFiltrados = statusFilter && statusFilter !== 'Todos'
                ? itensArr.filter(i => {
                    if (statusFilter === 'Pendente')       return i.status === 'waiting';
                    if (statusFilter === 'Em Andamento')   return i.status === 'in_progress';
                    if (statusFilter === 'Concluído')      return i.status === 'done';
                    return true;
                })
                : itensArr;

            const totalPct = itensFiltrados.reduce((s, i) => s + (i.pct_global || 0), 0);
            p.pct_global = itensFiltrados.length > 0 ? Math.round(totalPct / itensFiltrados.length) : 0;
            p.total_itens = itensFiltrados.length;
            p.itens = itensFiltrados.sort((a, b) => a.item_pv?.localeCompare(b.item_pv));
            return p;
        }).filter(p => p.itens.length > 0);

        res.json({ pedidos, total: pedidos.reduce((s, p) => s + p.total_itens, 0) });

    } catch (err) {
        console.error('❌ [ESTRUTURA-PEDIDO]', err.message, err.stack?.split('\n')[1]);
        res.status(500).json({ error: err.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

module.exports = router;
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.

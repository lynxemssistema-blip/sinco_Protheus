const mysqlPool = require('./mysqlService');
const db = require('../db');

/**
 * Runs the Finite Capacity Scheduling (FCS) Engine for a set of OPs and starting date
 * @param {Object} params
 * @param {Array<string>} params.ops - List of OP numbers to schedule
 * @param {string} params.data_inicio - Starting base date (YYYY-MM-DD)
 * @param {string} params.usuario - Username trigger the planning
 * @returns {Promise<Object>} Execution summary
 */
async function runFcsSequencing({ ops, data_inicio, usuario = 'planejamento_inteligente', include_saturday = false, preload_existing = false }) {
    let pgClient;
    const agent_logs = [];
    try {
        if (!ops || !ops.length || !data_inicio) {
            throw new Error('Lista de OPs e data de início são obrigatórios.');
        }

        // A data base NUNCA pode ser anterior à data atual
        const todayStr = new Date().toISOString().split('T')[0];
        if (data_inicio < todayStr) {
            throw new Error(`A data de início (${data_inicio}) não pode ser anterior à data de hoje (${todayStr}).`);
        }
        const dataBaseEfetiva = data_inicio;

        pgClient = await db.connect();
        agent_logs.push(`Iniciando FCS: ${ops.length} OPs selecionadas | Data base: ${data_inicio} | Data efetiva: ${dataBaseEfetiva} | Sábado: ${include_saturday ? 'SIM' : 'NÃO'}`);

        // Garantir que a tabela de fatias diárias existe
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_production_planning_diario (
                id                 INT AUTO_INCREMENT PRIMARY KEY,
                op_numero          VARCHAR(20)  NOT NULL,
                op_item            VARCHAR(10)  NOT NULL,
                op_sequencia       VARCHAR(10)  NOT NULL,
                operacao_codigo    VARCHAR(10)  NOT NULL,
                recurso_codigo     VARCHAR(30),
                produto_codigo     VARCHAR(50),
                data_alocacao      DATE         NOT NULL,
                qtd_alocada        INT          NOT NULL DEFAULT 0,
                minutos_alocados   INT          NOT NULL DEFAULT 0,
                usuario_planejador VARCHAR(100),
                criado_em          DATETIME     DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_daily_slice (op_numero, op_item, op_sequencia, operacao_codigo, data_alocacao)
            )
        `);

        // Obter capacidades diárias do MySQL — ordenadas pela ordem definida na página
        // de Capacidade e Tempos (pcp-refinado/capacidade), garantindo que logs e relatórios
        // respeitem a sequência configurada pelo usuário.
        agent_logs.push('Obtendo matriz de capacidades diárias por recurso...');
        const [capRows] = await mysqlPool.query(
            'SELECT recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos, COALESCE(ordem_exibicao, 9999) AS ordem_exibicao '
            + 'FROM app_recursos_capacidade '
            + 'ORDER BY COALESCE(ordem_exibicao, 9999) ASC, recurso_codigo ASC'
        );
        const capacidades = {};        // cap. diária em minutos
        const fallbackCapacidade = {}; // tempo padrão unitário em minutos
        // ordemRecurso: mantém a posição relativa de cada recurso para ordenar relatórios
        const ordemRecurso = {};
        capRows.forEach((r, idx) => {
            capacidades[r.recurso_codigo] = Number(r.capacidade_diaria_minutos) || 0;
            fallbackCapacidade[r.recurso_codigo] = Number(r.tempo_padrao_minutos) || 0;
            ordemRecurso[r.recurso_codigo] = idx; // posição 0-based na ordem configurada
        });

        // Buscar descrição dos recursos via roteiro sg2010
        const recursosCodigos = capRows.map(r => r.recurso_codigo).filter(Boolean);
        const descRecursoMap = {};
        if (recursosCodigos.length > 0) {
            try {
                const sg2Res = await pgClient.query(
                    `SELECT DISTINCT TRIM(g2_recurso) AS cod, TRIM(g2_descri) AS descri
                     FROM public.sg2010
                     WHERE COALESCE(d_e_l_e_t_,'') IN ('',' ')
                       AND TRIM(g2_recurso) = ANY($1)
                       AND g2_descri IS NOT NULL AND TRIM(g2_descri) <> ''`,
                    [recursosCodigos]
                );
                sg2Res.rows.forEach(r => { if (!descRecursoMap[r.cod]) descRecursoMap[r.cod] = r.descri; });
            } catch {
                // descrição é opcional
            }
        }

        // Log da matriz de capacidade carregada
        agent_logs.push(`--- MATRIZ DE CAPACIDADE DE PRODUÇÃO (${capRows.length} recursos) ---`);
        capRows.forEach(r => {
            const desc = descRecursoMap[r.recurso_codigo] || r.recurso_codigo;
            const cap = Number(r.capacidade_diaria_minutos) || 0;
            agent_logs.push(`  [${r.recurso_codigo}] ${desc}: ${cap} min/dia (${(cap/60).toFixed(1)}h/dia)`);
        });
        agent_logs.push(`------`);

        // Buscar detalhes das OPs selecionadas no Protheus
        const pgOpsQuery = `
            WITH RECURSIVE ParentOPs AS (
                SELECT 
                    TRIM(c2_num) AS op_num,
                    TRIM(c2_pedido) AS pedido,
                    TRIM(c2_itempv) AS itempv
                FROM public.sc2010
                WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
                  AND c2_sequen = '001'
                  AND TRIM(c2_pedido) <> ''
                
                UNION
                
                SELECT 
                    TRIM(child.c2_num) AS op_num,
                    p.pedido,
                    p.itempv
                FROM public.sc2010 child
                INNER JOIN ParentOPs p 
                    ON TRIM(child.c2_obs) LIKE '%' || p.op_num || '%'
                WHERE COALESCE(child.d_e_l_e_t_, '') IN ('', ' ')
                  AND child.c2_sequen = '001'
                  AND TRIM(child.c2_pedido) = ''
            )
            SELECT 
                TRIM(c2.c2_num) AS op_num,
                TRIM(c2.c2_item) AS item_op,
                TRIM(c2.c2_sequen) AS sequen,
                TRIM(c2.c2_produto) AS produto,
                COALESCE(NULLIF(TRIM(c2.c2_pedido), ''), parent.pedido) AS pedido,
                COALESCE(NULLIF(TRIM(c2.c2_itempv), ''), parent.itempv) AS itempv,
                c2.c2_quant AS qtde,
                c2.c2_quje AS qtde_feita
            FROM public.sc2010 c2
            LEFT JOIN ParentOPs parent ON parent.op_num = TRIM(c2.c2_num)
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND TRIM(c2.c2_num) = ANY($1::text[])
            ORDER BY c2.c2_num, c2.c2_item, c2.c2_sequen
        `;
        const opsResult = await pgClient.query(pgOpsQuery, [ops]);
        let opsEncontradas = opsResult.rows;

        // ETAPA EXTRA: Desconsiderar OPs associadas a pedidos inativos e sem OP/Pedido válido
        try {
            const [inativosResult] = await mysqlPool.query('SELECT pedido_numero FROM app_pedidos_inativos');
            const inativosSet = new Set(inativosResult.map(r => String(r.pedido_numero).trim()));
            const opsFiltradas = [];
            for (const op of opsEncontradas) {
                const isValidOpNum = op.op_num && op.op_num.trim() !== '' && op.op_num.trim() !== '-';
                const hasPedido = op.pedido && op.pedido.trim() !== '';

                if (!hasPedido || !isValidOpNum) {
                    agent_logs.push(`⚠️ OP ${op.op_num || '(sem numero)'} desconsiderada do FCS pois não possui pedido ou número de OP válido (Produto: ${op.produto}).`);
                    continue;
                }

                if (inativosSet.has(op.pedido)) {
                    agent_logs.push(`⚠️ OP ${op.op_num} desconsiderada do FCS pois o pedido ${op.pedido} está inativo/faturado.`);
                } else {
                    opsFiltradas.push(op);
                }
            }
            opsEncontradas = opsFiltradas;
        } catch (e) {
            console.warn('⚠️ Não foi possível filtrar pedidos inativos no MySQL:', e.message);
        }

        // ── ETAPA 1.5: VARREDURA DE PLANEJAMENTOS ÓRFÃOS (passado não executado) ─────────────
        // DESABILITADO: A varredura automática estava puxando milhares de OPs antigas (fantasmas)
        // do Protheus que nunca foram encerradas, consumindo toda a capacidade produtiva e
        // jogando os novos planejamentos para 1 ano no futuro.
        // O planejamento agora foca apenas nas OPs explicitamente selecionadas pelo usuário.
        agent_logs.push(`Total na fila: ${opsEncontradas.length} OPs (${ops.length} selecionadas).`);

        // Buscar apontamentos específicos por operação no MySQL
        const opNumbers = opsEncontradas.map(op => op.op_num);
        let apontamentosMap = {};
        if (opNumbers.length > 0) {
            try {
                const [apptRows] = await mysqlPool.query(`
                    SELECT op_numero, op_item, op_sequencia, operacao_codigo, SUM(quantidade) as total_produzido
                    FROM app_production_appointments
                    WHERE op_numero IN (?)
                    GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
                `, [opNumbers]);
                apptRows.forEach(r => {
                    const key = `${r.op_numero}-${r.op_item}-${r.op_sequencia}-${r.operacao_codigo}`;
                    apontamentosMap[key] = Number(r.total_produzido) || 0;
                });
            } catch (e) {
                console.warn('⚠️ Não foi possível carregar apontamentos MySQL:', e.message);
            }
        }

        // Buscar o roteiro de todos os produtos envolvidos
        const produtosSet = new Set(opsEncontradas.map(op => op.produto).filter(Boolean));
        const arrayProdutos = Array.from(produtosSet);
        
        let roteiroMap = {};
        if (arrayProdutos.length > 0) {
            agent_logs.push(`Buscando roteiro de engenharia para ${arrayProdutos.length} produto(s)...`);
            const pPlaceholders = arrayProdutos.map((_, i) => `$${i+1}`).join(',');
            const pgRoutingQuery = `
                SELECT 
                    TRIM(g2.g2_produto) AS produto,
                    TRIM(g2.g2_operac) AS operac,
                    TRIM(g2.g2_recurso) AS recurso,
                    g2.g2_tempad AS tempo_minutos
                FROM public.sg2010 g2
                WHERE COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                AND TRIM(g2.g2_produto) IN (${pPlaceholders})
                ORDER BY g2.g2_operac ASC
            `;
            const routingResult = await pgClient.query(pgRoutingQuery, arrayProdutos);
            
            for (const r of routingResult.rows) {
                if (!roteiroMap[r.produto]) roteiroMap[r.produto] = [];
                
                let tempoMinutos = Math.round((Number(r.tempo_minutos) || 0) * 1000) / 1000;
                
                if (tempoMinutos <= 0 && fallbackCapacidade[r.recurso]) {
                    tempoMinutos = fallbackCapacidade[r.recurso];
                }

                roteiroMap[r.produto].push({
                    operac: r.operac,
                    recurso: r.recurso,
                    tempoMinutos
                });
            }
        }

        // 1. VERIFICAR PRODUTOS SEM TEMPO DE OPERAÇÃO
        const missingTimes = [];
        for (const op of opsEncontradas) {
            const roteiros = roteiroMap[op.produto];
            if (roteiros) {
                for (const rot of roteiros) {
                    if (rot.tempoMinutos <= 0) {
                        missingTimes.push({
                            produto: op.produto,
                            recurso: rot.recurso,
                            operacao: rot.operac,
                            mensagem: `Produto ${op.produto} (OP ${op.op_num}) não possui tempo padrão para o recurso ${rot.recurso}`
                        });
                    }
                }
            }
        }

        if (missingTimes.length > 0) {
            return {
                success: false,
                error: 'Faltam tempos de operação definidos. O preenchimento é obrigatório.',
                missing_times: missingTimes,
                agent_logs
            };
        }

        // PRE-ESTUDO: Diagnóstico de capacidade por recurso antes de alocar
        agent_logs.push(`--- PRÉ-ANÁLISE DE GARGALOS DE CAPACIDADE ---`);
        const demandaPorRecurso = {};
        const demandaPorPeca = {};
        for (const op of opsEncontradas) {
            for (const rot of (roteiroMap[op.produto] || [])) {
                // Usa mesma lógica da alocação real: max(qtde_feita_protheus, apontamentos_locais)
                const keyApt = `${op.op_num}-${rot.operac}`;
                const qtdeApontada = apontamentosMap[keyApt] || 0;
                const qtdeFeita = Math.max(Number(op.qtde_feita) || 0, qtdeApontada);
                const qtdPend = Math.max(0, op.qtde - qtdeFeita);
                if (!demandaPorRecurso[rot.recurso]) demandaPorRecurso[rot.recurso] = 0;
                demandaPorRecurso[rot.recurso] += qtdPend * rot.tempoMinutos;
                
                // Agrupar por peça e recurso para o Top 100
                const keyPeca = `${op.produto}||${rot.recurso}`;
                if (!demandaPorPeca[keyPeca]) {
                    demandaPorPeca[keyPeca] = {
                        produto: op.produto,
                        descricao: op.produto_desc,
                        recurso: rot.recurso,
                        desc_recurso: descRecursoMap[rot.recurso] || rot.recurso,
                        quantidade_total: 0,
                        tempo_total_min: 0,
                        tempo_unitario_min: rot.tempoMinutos
                    };
                }
                demandaPorPeca[keyPeca].quantidade_total += qtdPend;
                demandaPorPeca[keyPeca].tempo_total_min += (qtdPend * rot.tempoMinutos);
            }
        }
        for (const [rec, demandaTotal] of Object.entries(demandaPorRecurso)) {
            const capDia = (capacidades[rec] > 0) ? capacidades[rec] : 480;
            const diasNec = Math.ceil(demandaTotal / capDia);
            const pct = capDia > 0 ? ((demandaTotal / capDia) * 100).toFixed(0) : '??';
            const desc = descRecursoMap[rec] || rec;
            if (diasNec > 1) {
                agent_logs.push(`  ⚠️ GARGALO [${rec}] ${desc}: demanda total = ${Math.round(demandaTotal)} min | cap/dia = ${capDia} min | ${diasNec} dias necessários (${pct}% da cap. diária).`);
            } else {
                agent_logs.push(`  ✅ OK     [${rec}] ${desc}: demanda total = ${Math.round(demandaTotal)} min | ${pct}% da cap. diária.`);
            }
        }
        agent_logs.push(`------`);

        // 2. ALGORITMO FCS (Sequenciamento de Capacidade Finita)
        const resource_buckets = {};
        const dailySlices = [];

        // Pré-carrega capacidade já alocada por OPs FORA deste lote para que lotes
        // consecutivos nunca se sobreponham no mesmo recurso/dia.
        if (preload_existing && ops.length > 0) {
            try {
                const excPh = ops.map(() => '?').join(',');
                const [existingSlices] = await mysqlPool.query(`
                    SELECT recurso_codigo, data_alocacao, SUM(minutos_alocados) AS minutos_used
                    FROM app_production_planning_diario
                    WHERE op_numero NOT IN (${excPh})
                      AND data_alocacao >= ?
                      AND recurso_codigo IS NOT NULL
                    GROUP BY recurso_codigo, data_alocacao
                `, [...ops, dataBaseEfetiva]);

                for (const row of existingSlices) {
                    const dateStr = typeof row.data_alocacao === 'string'
                        ? row.data_alocacao.substring(0, 10)
                        : new Date(row.data_alocacao).toISOString().split('T')[0];
                    const recurso = row.recurso_codigo;
                    if (!resource_buckets[dateStr]) resource_buckets[dateStr] = {};
                    const capDia = (capacidades[recurso] > 0) ? capacidades[recurso] : 480;
                    resource_buckets[dateStr][recurso] = Math.max(0, capDia - Number(row.minutos_used));
                }
                agent_logs.push(`📊 Pré-carga: ${existingSlices.length} alocações existentes consumidas (outros lotes não serão sobrepostos).`);
            } catch (e) {
                agent_logs.push(`⚠️ Pré-carga de capacidade falhou: ${e.message}. Prosseguindo sem histórico.`);
            }
        }

        const isBusinessDay = (dateStr) => {
            const d = new Date(dateStr + 'T12:00:00');
            const dow = d.getDay();
            if (dow === 0) return false; // domingo sempre bloqueado
            if (dow === 6 && !include_saturday) return false; // sábado bloqueado se não configurado
            return true;
        };

        const addDays = (dateStr, days) => {
            const date = new Date(dateStr + 'T12:00:00');
            date.setDate(date.getDate() + days);
            while (!isBusinessDay(date.toISOString().split('T')[0])) {
                date.setDate(date.getDate() + 1);
            }
            return date.toISOString().split('T')[0];
        };

        const toBusinessDay = (dateStr) => {
            const date = new Date(dateStr + 'T12:00:00');
            while (!isBusinessDay(date.toISOString().split('T')[0])) {
                date.setDate(date.getDate() + 1);
            }
            return date.toISOString().split('T')[0];
        };

        const getCapacity = (dateStr, recurso) => {
            // Datas anteriores ao inicio do planejamento: disponibilidade ZERO (regra FCS)
            if (dateStr < dataBaseEfetiva) return 0;
            if (!isBusinessDay(dateStr)) return 0;
            if (!resource_buckets[dateStr]) resource_buckets[dateStr] = {};
            if (resource_buckets[dateStr][recurso] === undefined) {
                resource_buckets[dateStr][recurso] = (capacidades[recurso] > 0) ? capacidades[recurso] : 480;
            }
            return resource_buckets[dateStr][recurso];
        };

        const newPlans = [];
        const forecastUpdates = [];
        const hoje = new Date();

        // Enforce: a menor data de planejamento é sempre hoje
        if (data_inicio < todayStr) {
            agent_logs.push(`⚠️ Data solicitada (${data_inicio}) é anterior à data atual (${todayStr}). O planejamento será iniciado a partir de HOJE para evitar alocações no passado.`);
        }
        agent_logs.push(`Iniciando motor FCS a partir da data base: ${dataBaseEfetiva}`);

        const dataBaseUtil = toBusinessDay(dataBaseEfetiva);
        if (dataBaseUtil !== dataBaseEfetiva) {
            agent_logs.push(`⚠️ Data base ${dataBaseEfetiva} é fim de semana. Ajustando para o primeiro dia útil: ${dataBaseUtil}.`);
        } else {
            agent_logs.push(`✅ Data base ${dataBaseEfetiva} é dia útil (${new Date(dataBaseEfetiva + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}). Produção começa neste dia.`);
        }

        // ── ETAPA 2.0: ORDENACAO POR DATA_ENTREGA_PCP (mais urgente = maior prioridade) ──────
        agent_logs.push('Ordenando fila por data de entrega PCP (mais urgente primeiro)...');
        try {
            const todosPedidos = [...new Set(opsEncontradas.map(o => o.pedido).filter(Boolean))];
            if (todosPedidos.length > 0) {
                const fcPh = todosPedidos.map(() => '?').join(',');
                const [fcRows] = await mysqlPool.query(
                    `SELECT TRIM(pedido) as pedido, TRIM(item) as item, data_entrega_pcp
                     FROM app_pcp_delivery_forecasts
                     WHERE pedido IN (${fcPh})`,
                    todosPedidos
                );
                const forecastMap = {};
                fcRows.forEach(f => {
                    forecastMap[`${String(f.pedido).trim()}-${String(f.item).trim()}`] = f.data_entrega_pcp;
                });
                opsEncontradas.forEach(op => {
                    op._entrega_pcp = forecastMap[`${op.pedido}-${op.itempv}`] || null;
                });
            }
        } catch (e) {
            agent_logs.push(`Aviso: nao foi possivel carregar datas PCP para priorizacao (${e.message}).`);
        }

        // Ordena: data_entrega_pcp ASC (nulls por ultimo = menor prioridade)
        opsEncontradas.sort((a, b) => {
            if (!a._entrega_pcp && !b._entrega_pcp) return 0;
            if (!a._entrega_pcp) return 1;
            if (!b._entrega_pcp) return -1;
            return a._entrega_pcp < b._entrega_pcp ? -1 : a._entrega_pcp > b._entrega_pcp ? 1 : 0;
        });

        if (opsEncontradas.length > 0) {
            const first = opsEncontradas[0];
            const last  = opsEncontradas[opsEncontradas.length - 1];
            agent_logs.push(`1a prioridade: OP ${first.op_num} | Produto: ${first.produto} | Entrega PCP: ${first._entrega_pcp || 'sem data'}`);
            agent_logs.push(`Ultima:        OP ${last.op_num}  | Produto: ${last.produto}  | Entrega PCP: ${last._entrega_pcp || 'sem data'}`);
        }
        agent_logs.push('------');

        for (const op of opsEncontradas) {
            const roteiros = roteiroMap[op.produto] || [];
            let currentDate = dataBaseUtil;
            let lastAllocatedDate = null;
            let finalQtdeRestante = op.qtde;
            
            agent_logs.push(`[ESTUDO] Analisando OP ${op.op_num} (Qtd: ${op.qtde} | Produto: ${op.produto})`);

            // Libera o event loop do Node.js brevemente para não travar outras rotas
            await new Promise(resolve => setImmediate(resolve));

            let prevOpEndDate = null;

            for (let i = 0; i < roteiros.length; i++) {
                const rot = roteiros[i];
                const keyApontamento = `${op.op_num}-${op.item_op}-${op.sequen}-${rot.operac}`;
                const qtdeApontada = apontamentosMap[keyApontamento] || 0;
                const qtdeJaFeita = Math.max(Number(op.qtde_feita) || 0, qtdeApontada);
                const qtdeRestante = Math.max(0, op.qtde - qtdeJaFeita);
                
                if (i === roteiros.length - 1) {
                    finalQtdeRestante = qtdeRestante;
                }
                
                if (qtdeRestante <= 0) {
                    agent_logs.push(` ↳ Operação ${rot.operac}: Quantidade concluída (Apontado: ${qtdeJaFeita}/${op.qtde}), ignorando.`);
                    continue;
                }

                const minNecessarios = qtdeRestante * rot.tempoMinutos;
                agent_logs.push(` ↳ Operação ${rot.operac} (${rot.recurso}): Faltam ${qtdeRestante} peças. Requer ${minNecessarios.toFixed(0)} min. Cap/dia = ${(capacidades[rot.recurso] > 0) ? capacidades[rot.recurso] : 480} min.`);

                let dataPlanejadaInicio = null;
                lastAllocatedDate = currentDate;
                let logsLocais = { alocados: 0, diasAvancados: 0 };
                let first180MinDate = null;
                let cumAllocated = 0;

                // Alocação contínua: NUNCA pula dia útil com capacidade disponível.
                // Peças que excedem a capacidade diária se estendem por múltiplos dias.
                // tempoRestanteNaPeca rastreia quanto falta para concluir a peça em andamento.
                const slicesDoDia = [];
                let qtdPendente = qtdeRestante;
                let tempoRestanteNaPeca = rot.tempoMinutos;
                // diasSemCapacidade conta apenas dias CONSECUTIVOS com 0 disponibilidade.
                // Dias produtivos (available > 0) não contribuem — o loop sempre termina nesses.
                // Protege somente contra loop infinito por recurso permanentemente bloqueado.
                let diasSemCapacidade = 0;

                while (qtdPendente > 0) {
                    const available = getCapacity(currentDate, rot.recurso);

                    if (available <= 0) {
                        if (++diasSemCapacidade > 730) {
                            agent_logs.push(`⛔ ABORT: OP ${op.op_num} Op ${rot.operac} — recurso ${rot.recurso} sem capacidade por ${diasSemCapacidade} dias consecutivos. Verifique a configuração.`);
                            break;
                        }
                        currentDate = addDays(currentDate, 1);
                        logsLocais.diasAvancados++;
                        continue;
                    }

                    diasSemCapacidade = 0; // reseta ao encontrar capacidade

                    // Consumir TODA a capacidade disponível hoje:
                    // completa peças e/ou avança a peça em progresso sem desperdiçar minutos.
                    let capRestante = available;
                    let minutosHoje = 0;
                    let pecasCompletasHoje = 0;

                    if (rot.tempoMinutos <= 0) {
                        pecasCompletasHoje = Math.ceil(qtdPendente);
                        minutosHoje = 0;
                        capRestante = available;
                    } else {
                        if (capRestante > 0 && pecasCompletasHoje < qtdPendente) {
                            if (tempoRestanteNaPeca > capRestante) {
                                minutosHoje += capRestante;
                                tempoRestanteNaPeca -= capRestante;
                                capRestante = 0;
                            } else {
                                capRestante -= tempoRestanteNaPeca;
                                minutosHoje += tempoRestanteNaPeca;
                                pecasCompletasHoje++;
                                tempoRestanteNaPeca = rot.tempoMinutos;

                                let maxPecas = Math.floor(capRestante / rot.tempoMinutos);
                                let pecasRestantes = qtdPendente - pecasCompletasHoje;
                                let pecasParaFazer = Math.min(maxPecas, pecasRestantes);

                                if (pecasParaFazer > 0) {
                                    pecasCompletasHoje += pecasParaFazer;
                                    let minUsados = pecasParaFazer * rot.tempoMinutos;
                                    capRestante -= minUsados;
                                    minutosHoje += minUsados;
                                }

                                if (pecasCompletasHoje < qtdPendente && capRestante > 0) {
                                    minutosHoje += capRestante;
                                    tempoRestanteNaPeca -= capRestante;
                                    capRestante = 0;
                                }
                            }
                        }
                    }

                    resource_buckets[currentDate][rot.recurso] -= minutosHoje;

                    if (!dataPlanejadaInicio) dataPlanejadaInicio = currentDate;
                    lastAllocatedDate = currentDate;
                    logsLocais.alocados += minutosHoje;

                    cumAllocated += minutosHoje;
                    if (!first180MinDate && cumAllocated >= 180) first180MinDate = currentDate;

                    slicesDoDia.push({
                        data_alocacao:    currentDate,
                        qtd_alocada:      pecasCompletasHoje,  // 0 = dia parcial (peça em progresso)
                        minutos_alocados: minutosHoje,
                    });

                    qtdPendente -= pecasCompletasHoje;
                    if (qtdPendente > 0) {
                        currentDate = addDays(currentDate, 1);
                        logsLocais.diasAvancados++;
                    }
                }

                if (!dataPlanejadaInicio) {
                    // Abort disparou antes de qualquer alocação: sincroniza lastAllocatedDate
                    // com o currentDate final para evitar data_fim < data_inicio no plano.
                    dataPlanejadaInicio = currentDate;
                    lastAllocatedDate = currentDate;
                }
                if (!first180MinDate) {
                    first180MinDate = lastAllocatedDate;
                }

                // Calcular dias de espera
                let diasEspera = 0;
                if (prevOpEndDate && dataPlanejadaInicio > prevOpEndDate) {
                    let tempDate = new Date(prevOpEndDate + 'T12:00:00');
                    const endD = new Date(dataPlanejadaInicio + 'T12:00:00');
                    while (tempDate < endD) {
                        tempDate.setDate(tempDate.getDate() + 1);
                        if (isBusinessDay(tempDate.toISOString().split('T')[0])) {
                            diasEspera++;
                        }
                    }
                }

                agent_logs.push(`    → Alocação concluída: de ${dataPlanejadaInicio} até ${lastAllocatedDate} em ${slicesDoDia.length} fatia(s) diária(s) (${logsLocais.diasAvancados} dia(s) avançado(s)). Espera: ${diasEspera} dias.`);

                // Registrar fatias diárias no array global para persistência
                slicesDoDia.forEach(s => {
                    dailySlices.push({
                        op_numero:          op.op_num,
                        op_item:            op.item_op,
                        op_sequencia:       op.sequen,
                        operacao_codigo:    rot.operac,
                        recurso_codigo:     rot.recurso,
                        produto_codigo:     op.produto,
                        data_alocacao:      s.data_alocacao,
                        qtd_alocada:        s.qtd_alocada,
                        minutos_alocados:   s.minutos_alocados,
                        usuario_planejador: usuario,
                    });
                });

                newPlans.push({
                    op_numero: op.op_num,
                    op_item: op.item_op,
                    op_sequencia: op.sequen,
                    operacao_codigo: rot.operac,
                    recurso_codigo: rot.recurso,
                    produto_codigo: op.produto,
                    data_planejada_inicio: dataPlanejadaInicio,
                    data_planejada_fim: lastAllocatedDate,
                    dias_espera: diasEspera,
                    usuario_planejador: usuario,
                    observacao_lote: `Planejamento Inteligente - Gerado em ${hoje.toLocaleDateString('pt-BR')} ${hoje.toLocaleTimeString('pt-BR')}`,
                    fatias_diarias: slicesDoDia,
                });

                prevOpEndDate = lastAllocatedDate;

                if (i < roteiros.length - 1) {
                    const proxRecurso = roteiros[i + 1].recurso;
                    if (proxRecurso === rot.recurso) {
                        // Mesmo recurso: avança sempre para não empilhar na mesma data
                        currentDate = addDays(lastAllocatedDate, 1);
                        agent_logs.push(`    → Mesmo recurso (${rot.recurso}): próxima operação forçada para ${currentDate}.`);
                    } else {
                        // Recurso diferente: pode iniciar com sobreposição (pós 180 min do recurso anterior)
                        currentDate = first180MinDate;
                        let maxTries = 30;
                        while (maxTries-- > 0 && getCapacity(currentDate, proxRecurso) <= 0) {
                            currentDate = addDays(currentDate, 1);
                        }
                        agent_logs.push(`    → Recurso diferente (${proxRecurso}): Aplicada sobreposição de 180min. Próxima operação busca vaga a partir de ${currentDate}.`);
                    }
                }
            }
            
            if (op.pedido && op.itempv && lastAllocatedDate) {
                forecastUpdates.push({
                    pedido: op.pedido,
                    item: op.itempv,
                    data_entrega_pcp: op._entrega_pcp, // NUNCA sobrescreve a data PCP. O Agente não preenche mais a Data PCP.
                    data_prevista_faturamento: lastAllocatedDate,
                    quantidade_pcp: finalQtdeRestante,
                    op_protheus: op.op_num
                });
            }
        }

        // 3. SALVAR NO MYSQL
        if (newPlans.length > 0) {
            agent_logs.push(`Salvando planejamento consolidado no banco de dados (${newPlans.length} operações).`);

            // Bug fix crítico: APAGAR tudos os registros antigos das OPs processadas
            // antes de inserir os novos. Isso garante que o replanejamento seja limpo.
            const opsProcessadasNums = [...new Set(newPlans.map(p => p.op_numero))];
            agent_logs.push(`  Limpando todo o histórico de planejamento para as ${opsProcessadasNums.length} OP(s) replanejadas...`);
            const deletePlaceholders = opsProcessadasNums.map(() => '?').join(',');
            const [deleteResult] = await mysqlPool.query(
                `DELETE FROM app_production_planning
                 WHERE op_numero IN (${deletePlaceholders})`,
                [...opsProcessadasNums]
            );
            await mysqlPool.query(
                `DELETE FROM app_production_planning_diario
                 WHERE op_numero IN (${deletePlaceholders})`,
                [...opsProcessadasNums]
            );
            await mysqlPool.query(
                `DELETE FROM app_pcp_delivery_forecasts
                 WHERE TRIM(op_protheus) IN (${deletePlaceholders})`,
                [...opsProcessadasNums]
            );
            if (deleteResult.affectedRows > 0) {
                agent_logs.push(`  ✅ ${deleteResult.affectedRows} registro(s) antigos removidos do banco antes do replanejamento.`);
            }

            const mysqlValues = newPlans.map(p => [
                p.op_numero, p.op_item, p.op_sequencia, p.operacao_codigo, p.recurso_codigo, p.produto_codigo,
                p.data_planejada_inicio, p.data_planejada_fim, p.usuario_planejador, p.observacao_lote, p.dias_espera || 0
            ]);

            await mysqlPool.query(`
                INSERT INTO app_production_planning
                    (op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo, produto_codigo,
                     data_planejada_inicio, data_planejada_fim, usuario_planejador, observacao_lote, dias_espera)
                VALUES ?
                ON DUPLICATE KEY UPDATE
                    recurso_codigo        = VALUES(recurso_codigo),
                    produto_codigo        = VALUES(produto_codigo),
                    data_planejada_inicio = VALUES(data_planejada_inicio),
                    data_planejada_fim    = VALUES(data_planejada_fim),
                    usuario_planejador    = VALUES(usuario_planejador),
                    observacao_lote       = VALUES(observacao_lote),
                    dias_espera           = VALUES(dias_espera)
            `, [mysqlValues]);

            // Persistir fatias diárias por peça
            if (dailySlices.length > 0) {
                const sliceValues = dailySlices.map(s => [
                    s.op_numero, s.op_item, s.op_sequencia, s.operacao_codigo,
                    s.recurso_codigo, s.produto_codigo, s.data_alocacao,
                    s.qtd_alocada, s.minutos_alocados, s.usuario_planejador
                ]);
                await mysqlPool.query(`
                    INSERT INTO app_production_planning_diario
                        (op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo,
                         produto_codigo, data_alocacao, qtd_alocada, minutos_alocados, usuario_planejador)
                    VALUES ?
                    ON DUPLICATE KEY UPDATE
                        qtd_alocada      = VALUES(qtd_alocada),
                        minutos_alocados = VALUES(minutos_alocados)
                `, [sliceValues]);
                agent_logs.push(`✅ ${dailySlices.length} fatia(s) diária(s) salvas em app_production_planning_diario.`);
            }

            if (forecastUpdates.length > 0) {
                // Deduplicar por (pedido, item): manter MAX data_prevista_faturamento para refletir
                // quando TODAS as OPs do item estarão prontas (a que termina por último é a que manda)
                const forecastByKey = {};
                for (const f of forecastUpdates) {
                    const k = `${f.pedido}|${f.item}`;
                    if (!forecastByKey[k] || f.data_prevista_faturamento > forecastByKey[k].data_prevista_faturamento) {
                        forecastByKey[k] = f;
                    }
                }
                const dedupedForecasts = Object.values(forecastByKey);
                agent_logs.push(`Atualizando previsão de entrega PCP para ${dedupedForecasts.length} pedido(s) associado(s).`);
                
                for (const f of dedupedForecasts) {
                    const cleanPedido = String(f.pedido).trim();
                    const cleanItem = String(f.item).trim();
                    const cleanOp = f.op_protheus ? String(f.op_protheus).trim() : null;
                    
                    let existingId = null;
                    
                    // 1. Tentar encontrar registro existente pela OP
                    if (cleanOp && cleanOp !== '-') {
                        const [existOp] = await mysqlPool.query(`SELECT id FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ? AND TRIM(op_protheus) = ? LIMIT 1`, [cleanPedido, cleanItem, cleanOp]);
                        if (existOp.length > 0) existingId = existOp[0].id;
                    }
                    
                    // 2. Se não achou por OP e tem data_entrega_pcp, procurar por registro da mesma data sem OP
                    if (!existingId && f.data_entrega_pcp) {
                         const [existDate] = await mysqlPool.query(`SELECT id FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ? AND data_entrega_pcp = ? AND (op_protheus IS NULL OR TRIM(op_protheus) = '' OR TRIM(op_protheus) = '-') LIMIT 1`, [cleanPedido, cleanItem, f.data_entrega_pcp]);
                         if (existDate.length > 0) existingId = existDate[0].id;
                    }
                    
                    // 3. Se não achou, procurar qualquer registro sem OP para aproveitar
                    if (!existingId) {
                         const [existAny] = await mysqlPool.query(`SELECT id FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ? AND (op_protheus IS NULL OR TRIM(op_protheus) = '' OR TRIM(op_protheus) = '-') LIMIT 1`, [cleanPedido, cleanItem]);
                         if (existAny.length > 0) existingId = existAny[0].id;
                    }

                    if (existingId) {
                        // UPDATE: NUNCA altera a data_entrega_pcp original.
                        await mysqlPool.query(`
                            UPDATE app_pcp_delivery_forecasts 
                            SET data_prevista_faturamento = ?, op_protheus = COALESCE(NULLIF(TRIM(op_protheus), ''), ?), 
                                observacao = IF(observacao IS NULL OR observacao = '', ?, observacao)
                            WHERE id = ?
                        `, [f.data_prevista_faturamento, cleanOp, 'Automático - Agente FCS', existingId]);
                    } else {
                        // INSERT: Nunca preencher a data_entrega_pcp (uso exclusivo humano)
                        await mysqlPool.query(`
                            INSERT INTO app_pcp_delivery_forecasts 
                            (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, op_protheus, data_prevista_faturamento)
                            VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
                        `, [cleanPedido, cleanItem, f.quantidade_pcp, f.usuario || 'Automático - Agente FCS', 'Automático - Agente FCS', cleanOp, f.data_prevista_faturamento]);
                    }
                }
            }
            
            agent_logs.push(`Gerando logs de auditoria e rastreabilidade.`);
            const historicoValues = newPlans.map(p => [
                p.op_numero, p.operacao_codigo, usuario, hoje, 
                'Automático IA', `Inicio: ${p.data_planejada_inicio} | Fim: ${p.data_planejada_fim}`, 'Planejamento Inteligente'
            ]);
            
            await mysqlPool.query(`CREATE TABLE IF NOT EXISTS app_pcp_historico_revisao (id INT AUTO_INCREMENT PRIMARY KEY, op_numero VARCHAR(50), operacao_codigo VARCHAR(50), usuario VARCHAR(100), data_alteracao DATETIME, mudou_de TEXT, mudou_para TEXT, origem VARCHAR(100))`);
            await mysqlPool.query(`INSERT INTO app_pcp_historico_revisao (op_numero, operacao_codigo, usuario, data_alteracao, mudou_de, mudou_para, origem) VALUES ?`, [historicoValues]);
        }

        // 4. GERAR RELATÓRIO ESTRUTURADO
        
        const top100PecasGargalo = Object.values(demandaPorPeca)
            .filter(p => p.tempo_total_min > 0)
            .sort((a, b) => b.tempo_total_min - a.tempo_total_min)
            .slice(0, 100);

        const report = {
            top_100_pecas_gargalo: top100PecasGargalo,
            gerado_em: new Date().toISOString(),
            planejador: usuario,
            data_base: dataBaseEfetiva,
            total_ops: opsEncontradas.length,
            total_operacoes_planejadas: newPlans.length,
            resumo_recursos: {},
            decisoes: []
        };

        // Indexar fatias por "op_numero|operacao_codigo" para evitar O(n²) no loop de relatório
        const slicesByKey = {};
        for (const s of dailySlices) {
            const k = `${s.op_numero}|${s.operacao_codigo}`;
            if (!slicesByKey[k]) slicesByKey[k] = [];
            slicesByKey[k].push(s);
        }

        // Indexar OPs por op_num para lookup O(1) no loop de relatório
        const opsByNum = {};
        for (const o of opsEncontradas) opsByNum[o.op_num] = o;

        for (const plan of newPlans) {
            const op = opsByNum[plan.op_numero];
            const rot = (roteiroMap[plan.produto_codigo] || []).find(r => r.operac === plan.operacao_codigo);
            const keyApt = `${plan.op_numero}-${plan.operacao_codigo}`;
            const qtdeApontadaRel = apontamentosMap[keyApt] || 0;
            const qtdeJaFeitaRel = op ? Math.max(Number(op.qtde_feita) || 0, qtdeApontadaRel) : 0;
            const qtdPendente = op ? Math.max(0, op.qtde - qtdeJaFeitaRel) : 0;
            const minTotais = rot ? Math.round(qtdPendente * rot.tempoMinutos) : 0;
            const capDia = (capacidades[plan.recurso_codigo] > 0) ? capacidades[plan.recurso_codigo] : 480;
            const diasNecessarios = capDia > 0 ? Math.ceil(minTotais / capDia) : 1;
            const dataDif = plan.data_planejada_inicio !== plan.data_planejada_fim;

            if (!report.resumo_recursos[plan.recurso_codigo]) {
                report.resumo_recursos[plan.recurso_codigo] = {
                    recurso: plan.recurso_codigo,
                    desc_recurso: descRecursoMap[plan.recurso_codigo] || plan.recurso_codigo,
                    capacidade_diaria_min: capDia,
                    total_minutos_alocados: 0,
                    total_operacoes: 0,
                    // ordem configurada na página pcp-refinado/capacidade
                    ordem_exibicao: ordemRecurso[plan.recurso_codigo] ?? 9999
                };
            }
            const fatiasDestaOp = slicesByKey[`${plan.op_numero}|${plan.operacao_codigo}`] || [];

            const minutosReaisAlocados = fatiasDestaOp.reduce((sum, s) => sum + s.minutos_alocados, 0);
            report.resumo_recursos[plan.recurso_codigo].total_minutos_alocados += minutosReaisAlocados || minTotais;
            report.resumo_recursos[plan.recurso_codigo].total_operacoes += 1;

            report.decisoes.push({
                op_numero: plan.op_numero,
                produto: plan.produto_codigo,
                operacao: plan.operacao_codigo,
                recurso: plan.recurso_codigo,
                desc_recurso: descRecursoMap[plan.recurso_codigo] || plan.recurso_codigo,
                capacidade_recurso_min_dia: capDia,
                qtd_pendente: qtdPendente,
                tempo_unitario_min: rot ? Math.round(rot.tempoMinutos) : 0,
                total_minutos_necessarios: minTotais,
                capacity_pct: capDia > 0 ? Math.round((minTotais / capDia) * 100) : null,
                excede_capacidade_dia: minTotais > capDia,
                dias_necessarios: diasNecessarios,
                data_inicio: plan.data_planejada_inicio,
                data_fim: plan.data_planejada_fim,
                dias_espera: plan.dias_espera || 0,
                span_multiplos_dias: dataDif,
                justificativa: minTotais > capDia
                    ? `Carga de ${minTotais} min excede capacidade diária de ${capDia} min do recurso ${plan.recurso_codigo}. Distribuída em ${diasNecessarios} dia(s).`
                    : dataDif
                        ? `Carga de ${minTotais} min cabe em um dia, mas o recurso ${plan.recurso_codigo} estava parcialmente ocupado. Distribuída por ${fatiasDestaOp.length} fatia(s).`
                        : `Carga de ${minTotais} min dentro da capacidade diária de ${capDia} min. Alocada em ${plan.data_planejada_inicio}.`,
                fatias_diarias: fatiasDestaOp.map(s => ({
                    data:    s.data_alocacao,
                    qtd:     s.qtd_alocada,
                    minutos: s.minutos_alocados,
                })),
            });
        }

        // Deriva carga_diaria a partir do resource_buckets
        // resource_buckets[date][recurso] = minutos RESTANTES (disponibilidade residual)
        // Consumido = capDia - restante
        const carga_diaria = {};
        for (const [date, recursos] of Object.entries(resource_buckets)) {
            for (const [recurso, restante] of Object.entries(recursos)) {
                const capDia = (capacidades[recurso] > 0) ? capacidades[recurso] : 480;
                const consumido = capDia - restante;
                if (consumido > 0) {
                    if (!carga_diaria[recurso]) carga_diaria[recurso] = { capDia, dates: {} };
                    carga_diaria[recurso].dates[date] = consumido;
                }
            }
        }

        // Ordenar resumo_recursos pelo campo ordem_exibicao antes de retornar
        const resumo_recursos_sorted = Object.fromEntries(
            Object.entries(report.resumo_recursos)
                .sort(([, a], [, b]) => (a.ordem_exibicao ?? 9999) - (b.ordem_exibicao ?? 9999))
        );
        // Ordenar carga_diaria (por recurso) na mesma ordem
        const carga_diaria_sorted = Object.fromEntries(
            Object.entries(carga_diaria)
                .sort(([a], [b]) => (ordemRecurso[a] ?? 9999) - (ordemRecurso[b] ?? 9999))
        );

        agent_logs.push(`Fim do processamento.`);
        return {
            success: true,
            plans: newPlans.length,
            daily_slices: dailySlices.length,
            agent_logs,
            report: { ...report, resumo_recursos: resumo_recursos_sorted, carga_diaria: carga_diaria_sorted }
        };
    } catch (error) {
        console.error('❌ Erro no FCS Engine:', error);
        return {
            success: false,
            error: error.message,
            agent_logs
        };
    } finally {
        if (pgClient) pgClient.release();
    }
}

module.exports = { runFcsSequencing };

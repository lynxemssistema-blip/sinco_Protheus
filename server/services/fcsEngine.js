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
async function runFcsSequencing({ ops, data_inicio, usuario = 'planejamento_inteligente', include_saturday = false }) {
    let pgClient;
    try {
        if (!ops || !ops.length || !data_inicio) {
            throw new Error('Lista de OPs e data de início são obrigatórios.');
        }

        // A data base NUNCA pode ser anterior à data atual
        const todayStr = new Date().toISOString().split('T')[0];
        const dataBaseEfetiva = data_inicio < todayStr ? todayStr : data_inicio;

        pgClient = await db.connect();
        const agent_logs = [];
        agent_logs.push(`Iniciando FCS: ${ops.length} OPs selecionadas | Data base: ${data_inicio} | Data efetiva: ${dataBaseEfetiva} | Sábado: ${include_saturday ? 'SIM' : 'NÃO'}`);
        
        // Obter capacidades diárias do MySQL
        agent_logs.push('Obtendo matriz de capacidades diárias por recurso...');
        const [capRows] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos FROM app_recursos_capacidade');
        const capacidades = {};       // cap. diária em minutos
        const fallbackCapacidade = {}; // tempo padrão unitário em minutos
        capRows.forEach(r => { 
            capacidades[r.recurso_codigo] = Number(r.capacidade_diaria_minutos) || 0;
            fallbackCapacidade[r.recurso_codigo] = Number(r.tempo_padrao_minutos) || 0;
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
            SELECT 
                TRIM(c2.c2_num) AS op_num,
                TRIM(c2.c2_item) AS item_op,
                TRIM(c2.c2_sequen) AS sequen,
                TRIM(c2.c2_produto) AS produto,
                TRIM(c2.c2_pedido) AS pedido,
                TRIM(c2.c2_itempv) AS itempv,
                c2.c2_quant AS qtde,
                c2.c2_quje AS qtde_feita
            FROM public.sc2010 c2
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND TRIM(c2.c2_num) = ANY($1::text[])
            ORDER BY c2.c2_num, c2.c2_item, c2.c2_sequen
        `;
        const opsResult = await pgClient.query(pgOpsQuery, [ops]);
        const opsEncontradas = opsResult.rows;

        // ── ETAPA 1.5: VARREDURA DE PLANEJAMENTOS ÓRFÃOS (passado não executado) ─────────────
        // DESABILITADO: A varredura automática estava puxando milhares de OPs antigas (fantasmas)
        // do Protheus que nunca foram encerradas, consumindo toda a capacidade produtiva e
        // jogando os novos planejamentos para 1 ano no futuro.
        // O planejamento agora foca apenas nas OPs explicitamente selecionadas pelo usuário.
        let opsOrfasCount = 0;
        agent_logs.push(`Total na fila: ${opsEncontradas.length} OPs (${ops.length} selecionadas).`);

        // Buscar apontamentos específicos por operação no MySQL
        const opNumbers = opsEncontradas.map(op => op.op_num);
        let apontamentosMap = {};
        if (opNumbers.length > 0) {
            try {
                const [apptRows] = await mysqlPool.query(`
                    SELECT op_numero, operacao_codigo, SUM(qtde_produzida) as total_produzido
                    FROM app_producao_apontamentos
                    WHERE op_numero IN (?)
                    GROUP BY op_numero, operacao_codigo
                `, [opNumbers]);
                apptRows.forEach(r => {
                    const key = `${r.op_numero}-${r.operacao_codigo}`;
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
                    g2.g2_tempad AS tempo_horas
                FROM public.sg2010 g2
                WHERE COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                  AND TRIM(g2.g2_produto) IN (${pPlaceholders})
                ORDER BY g2.g2_operac ASC
            `;
            const routingResult = await pgClient.query(pgRoutingQuery, arrayProdutos);
            
            for (const r of routingResult.rows) {
                if (!roteiroMap[r.produto]) roteiroMap[r.produto] = [];
                
                let tempoMinutos = Number(r.tempo_horas) || 0;
                
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
        for (const op of opsEncontradas) {
            const qtdPend = Math.max(0, op.qtde - op.qtde_feita);
            for (const rot of (roteiroMap[op.produto] || [])) {
                if (!demandaPorRecurso[rot.recurso]) demandaPorRecurso[rot.recurso] = 0;
                demandaPorRecurso[rot.recurso] += qtdPend * rot.tempoMinutos;
            }
        }
        for (const [rec, demandaTotal] of Object.entries(demandaPorRecurso)) {
            const capDia = capacidades[rec] || 480;
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
                resource_buckets[dateStr][recurso] = capacidades[recurso] || 480;
            }
            return resource_buckets[dateStr][recurso];
        };

        const consumeCapacity = (dateStr, recurso, minNeeded) => {
            if (!isBusinessDay(dateStr)) return { allocated: 0, remaining: minNeeded };
            let available = getCapacity(dateStr, recurso);
            if (available >= minNeeded) {
                resource_buckets[dateStr][recurso] -= minNeeded;
                return { allocated: minNeeded, remaining: 0 };
            } else {
                resource_buckets[dateStr][recurso] = 0;
                return { allocated: available, remaining: minNeeded - available };
            }
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

            for (let i = 0; i < roteiros.length; i++) {
                const rot = roteiros[i];
                const keyApontamento = `${op.op_num}-${rot.operac}`;
                const qtdeApontada = apontamentosMap[keyApontamento] || 0;
                const qtdeJaFeita = Math.max(Number(op.qtde_feita) || 0, qtdeApontada);
                const qtdeRestante = Math.max(0, op.qtde - qtdeJaFeita);
                
                if (i === roteiros.length - 1) {
                    finalQtdeRestante = qtdeRestante;
                }
                
                let minNeeded = qtdeRestante * rot.tempoMinutos;
                
                if (minNeeded <= 0) {
                    agent_logs.push(` ↳ Operação ${rot.operac}: Quantidade concluída (Apontado: ${qtdeJaFeita}/${op.qtde}), ignorando.`);
                    continue; 
                }

                agent_logs.push(` ↳ Operação ${rot.operac} (${rot.recurso}): Faltam ${qtdeRestante} peças. Requer ${minNeeded.toFixed(0)} min. Cap/dia = ${capacidades[rot.recurso]||480} min.`);

                let dataPlanejadaInicio = currentDate;
                lastAllocatedDate = currentDate;
                let logsLocais = { alocados: 0, diasAvancados: 0 };

                while (minNeeded > 0) {
                    const { allocated, remaining } = consumeCapacity(currentDate, rot.recurso, minNeeded);
                    if (allocated > 0) {
                        lastAllocatedDate = currentDate;
                        logsLocais.alocados += allocated;
                    }
                    if (remaining > 0) {
                        currentDate = addDays(currentDate, 1);
                        logsLocais.diasAvancados++;
                    }
                    minNeeded = remaining;
                }

                agent_logs.push(`    → Alocação concluída: de ${dataPlanejadaInicio} até ${lastAllocatedDate} (avanço de ${logsLocais.diasAvancados} dia(s)).`);

                newPlans.push({
                    op_numero: op.op_num,
                    op_item: op.item_op,
                    op_sequencia: op.sequen,
                    operacao_codigo: rot.operac,
                    recurso_codigo: rot.recurso,
                    produto_codigo: op.produto,
                    data_planejada_inicio: dataPlanejadaInicio,
                    data_planejada_fim: lastAllocatedDate,
                    usuario_planejador: usuario,
                    observacao_lote: `Planejamento Inteligente - Gerado em ${hoje.toLocaleDateString('pt-BR')} ${hoje.toLocaleTimeString('pt-BR')}`
                });

                if (i < roteiros.length - 1) {
                    const proxRecurso = roteiros[i + 1].recurso;
                    if (proxRecurso === rot.recurso) {
                        // Mesmo recurso: avança sempre para não empilhar na mesma data
                        currentDate = addDays(lastAllocatedDate, 1);
                        agent_logs.push(`    → Mesmo recurso (${rot.recurso}): próxima operação forçada para ${currentDate}.`);
                    } else {
                        // Recurso diferente: tenta aproveitar o dia corrente primeiro
                        currentDate = lastAllocatedDate;
                        const capProx = getCapacity(currentDate, proxRecurso);
                        if (capProx <= 0) {
                            // Bug fix: avança até encontrar dia com capacidade real
                            let maxTries = 30;
                            while (maxTries-- > 0 && getCapacity(currentDate, proxRecurso) <= 0) {
                                currentDate = addDays(currentDate, 1);
                            }
                            agent_logs.push(`    → Recurso diferente (${proxRecurso}) sem capacidade no dia anterior. Avançando para ${currentDate}.`);
                        } else {
                            agent_logs.push(`    → Recurso diferente (${proxRecurso}): ${capProx} min disponíveis em ${currentDate}. Mantendo dia.`);
                        }
                    }
                }
            }
            
            if (op.pedido && op.itempv && lastAllocatedDate) {
                forecastUpdates.push({
                    pedido: op.pedido,
                    item: op.itempv,
                    data_entrega_pcp: op._entrega_pcp || lastAllocatedDate, // Initialize with forecast if NULL
                    data_prevista_faturamento: lastAllocatedDate,
                    quantidade_pcp: finalQtdeRestante,
                    op_protheus: op.op_num
                });
            }
        }

        // 3. SALVAR NO MYSQL
        if (newPlans.length > 0) {
            agent_logs.push(`Salvando planejamento consolidado no banco de dados (${newPlans.length} operações).`);

            // Bug fix crítico: APAGAR registros com datas passadas de TODAS as OPs processadas
            // antes de inserir os novos. Isso elimina a carga histórica da dashboard de carga diária.
            const opsProcessadasNums = [...new Set(newPlans.map(p => p.op_numero))];
            agent_logs.push(`  Limpando registros anteriores a hoje (${todayStr}) para ${opsProcessadasNums.length} OP(s) replanejadas...`);
            const deletePlaceholders = opsProcessadasNums.map(() => '?').join(',');
            const [deleteResult] = await mysqlPool.query(
                `DELETE FROM app_production_planning 
                 WHERE op_numero IN (${deletePlaceholders})
                   AND data_planejada_inicio < ?`,
                [...opsProcessadasNums, todayStr]
            );
            if (deleteResult.affectedRows > 0) {
                agent_logs.push(`  ✅ ${deleteResult.affectedRows} registro(s) com datas passadas removidos do banco.`);
            }

            const mysqlValues = newPlans.map(p => [
                p.op_numero, p.op_item, p.op_sequencia, p.operacao_codigo, p.recurso_codigo, p.produto_codigo,
                p.data_planejada_inicio, p.data_planejada_fim, p.usuario_planejador, p.observacao_lote
            ]);

            await mysqlPool.query(`
                INSERT INTO app_production_planning
                    (op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo, produto_codigo,
                     data_planejada_inicio, data_planejada_fim, usuario_planejador, observacao_lote)
                VALUES ?
                ON DUPLICATE KEY UPDATE
                    recurso_codigo        = VALUES(recurso_codigo),
                    produto_codigo        = VALUES(produto_codigo),
                    data_planejada_inicio = VALUES(data_planejada_inicio),
                    data_planejada_fim    = VALUES(data_planejada_fim),
                    usuario_planejador    = VALUES(usuario_planejador),
                    observacao_lote       = VALUES(observacao_lote)
            `, [mysqlValues]);

            if (forecastUpdates.length > 0) {
                agent_logs.push(`Atualizando previsão de entrega PCP para ${forecastUpdates.length} pedido(s) associado(s).`);
                const forecastValues = forecastUpdates.map(f => [
                    f.pedido, f.item, f.data_entrega_pcp, f.quantidade_pcp, usuario, 'Automático - Agente FCS', f.op_protheus, f.data_prevista_faturamento
                ]);
                // Bug fix: UPSERT para não duplicar forecasts
                await mysqlPool.query(`
                    INSERT INTO app_pcp_delivery_forecasts 
                        (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, op_protheus, data_prevista_faturamento)
                    VALUES ?
                    ON DUPLICATE KEY UPDATE
                        data_prevista_faturamento = VALUES(data_prevista_faturamento),
                        quantidade_pcp            = VALUES(quantidade_pcp),
                        usuario                   = VALUES(usuario),
                        observacao                = VALUES(observacao)
                `, [forecastValues]);
            }
            
            agent_logs.push(`Gerando logs de auditoria e rastreabilidade.`);
            const historicoValues = newPlans.map(p => [
                p.op_numero, p.operacao_codigo, usuario, hoje, 
                'Automático IA', `Inicio: ${p.data_planejada_inicio} | Fim: ${p.data_planejada_fim}`, 'Planejamento Inteligente'
            ]);
            
            await mysqlPool.query(`CREATE TABLE IF NOT EXISTS app_pcp_historico_revisao (id INT AUTO_INCREMENT PRIMARY KEY, op_numero VARCHAR(50), operacao_codigo VARCHAR(50), usuario VARCHAR(100), data_alteracao DATETIME, mudou_de TEXT, mudou_para TEXT, origem VARCHAR(100))`);
            if (historicoValues.length > 0) {
                await mysqlPool.query(`INSERT INTO app_pcp_historico_revisao (op_numero, operacao_codigo, usuario, data_alteracao, mudou_de, mudou_para, origem) VALUES ?`, [historicoValues]);
            }
        }

        // 4. GERAR RELATÓRIO ESTRUTURADO
        const report = {
            gerado_em: new Date().toISOString(),
            planejador: usuario,
            data_base: dataBaseEfetiva,
            total_ops: opsEncontradas.length,
            total_operacoes_planejadas: newPlans.length,
            resumo_recursos: {},
            decisoes: []
        };

        for (const plan of newPlans) {
            const op = opsEncontradas.find(o => o.op_num === plan.op_numero);
            const rot = (roteiroMap[plan.produto_codigo] || []).find(r => r.operac === plan.operacao_codigo);
            const qtdPendente = op ? Math.max(0, op.qtde - op.qtde_feita) : 0;
            const minTotais = rot ? Math.round(qtdPendente * rot.tempoMinutos) : 0;
            const capDia = capacidades[plan.recurso_codigo] || 480;
            const diasNecessarios = capDia > 0 ? Math.ceil(minTotais / capDia) : 1;
            const dataDif = plan.data_planejada_inicio !== plan.data_planejada_fim;

            if (!report.resumo_recursos[plan.recurso_codigo]) {
                report.resumo_recursos[plan.recurso_codigo] = {
                    recurso: plan.recurso_codigo,
                    desc_recurso: descRecursoMap[plan.recurso_codigo] || plan.recurso_codigo,
                    capacidade_diaria_min: capDia,
                    total_minutos_alocados: 0,
                    total_operacoes: 0
                };
            }
            report.resumo_recursos[plan.recurso_codigo].total_minutos_alocados += minTotais;
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
                span_multiplos_dias: dataDif,
                justificativa: dataDif
                    ? `Carga de ${minTotais} min excede capacidade diária de ${capDia} min do recurso ${plan.recurso_codigo}. Distribuída em ${diasNecessarios} dia(s).`
                    : `Carga de ${minTotais} min dentro da capacidade diária de ${capDia} min. Alocada em ${plan.data_planejada_inicio}.`
            });
        }

        // Deriva carga_diaria a partir do resource_buckets
        // resource_buckets[date][recurso] = minutos RESTANTES (disponibilidade residual)
        // Consumido = capDia - restante
        const carga_diaria = {};
        for (const [date, recursos] of Object.entries(resource_buckets)) {
            for (const [recurso, restante] of Object.entries(recursos)) {
                const capDia = capacidades[recurso] || 480;
                const consumido = capDia - restante;
                if (consumido > 0) {
                    if (!carga_diaria[recurso]) carga_diaria[recurso] = { capDia, dates: {} };
                    carga_diaria[recurso].dates[date] = consumido;
                }
            }
        }

        agent_logs.push(`Fim do processamento.`);
        return {
            success: true,
            plans: newPlans.length,
            agent_logs,
            report: { ...report, carga_diaria }
        };
    } catch (error) {
        console.error('❌ Erro no FCS Engine:', error);
        return {
            success: false,
            error: error.message,
            agent_logs: []
        };
    } finally {
        if (pgClient) pgClient.release();
    }
}

module.exports = { runFcsSequencing };

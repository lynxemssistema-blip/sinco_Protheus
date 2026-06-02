require("dotenv").config();
const { Pool } = require("pg");
const mysql = require("mysql2/promise");

const pg = new Pool({ host:process.env.PGHOST, port:process.env.PGPORT||5432, database:process.env.PGDATABASE||"p12prd", user:process.env.PGUSER, password:process.env.PGPASSWORD });

async function main() {
    const my = await mysql.createConnection({
        host: process.env.MYSQL_HOST||"metalfisa.mysql.uhserver.com", port:3306,
        database: process.env.MYSQL_DB||"metalfisa",
        user: process.env.MYSQL_USER||"ronaldo2",
        password: process.env.MYSQL_PASSWORD||"jHAzhFG848@yN@U"
    });

    // 1. Busca OPs do pedido 004618 (sem TRIM em colunas numericas)
    const opsRes = await pg.query(`
        SELECT 
            TRIM(c2.c2_num)     AS op,
            TRIM(c2.c2_item)    AS item_op,
            TRIM(c2.c2_sequen)  AS sequen,
            TRIM(c2.c2_produto) AS cod_produto_op,
            c2.c2_quant         AS qtd_planejada_op,
            TRIM(c2.c2_pedido)  AS pedido_venda,
            TRIM(c2.c2_itempv)  AS ped_item,
            TRIM(g2.g2_operac)  AS operacao,
            TRIM(g2.g2_recurso) AS recurso,
            TRIM(g2.g2_descri)  AS desc_operacao,
            g2.g2_tempad        AS tempo_padrao_min
        FROM public.sc2010 c2
        JOIN public.sg2010 g2 
            ON TRIM(g2.g2_produto) = TRIM(c2.c2_produto)
           AND COALESCE(g2.d_e_l_e_t_,'') IN ('',' ')
        WHERE TRIM(c2.c2_pedido) = '004618'
          AND COALESCE(c2.d_e_l_e_t_,'') IN ('',' ')
        ORDER BY c2.c2_item, c2.c2_sequen, g2.g2_operac
    `);
    const ops = opsRes.rows;
    console.log(`OPs encontradas no Protheus: ${ops.length}`);

    // 2. Capacidade diaria por recurso no MySQL (FONTE DA VERDADE)
    const [caps] = await my.execute("SELECT recurso_codigo, capacidade_diaria_minutos, tempo_padrao_minutos FROM app_recursos_capacidade");
    const capMap = {};
    caps.forEach(c => {
        capMap[(c.recurso_codigo||"").trim().toUpperCase()] = {
            cap_dia_min:  parseFloat(c.capacidade_diaria_minutos) || 528,
            tempo_padrao: parseFloat(c.tempo_padrao_minutos) || 1
        };
    });

    console.log("\n=== CAPACIDADE DIARIA POR RECURSO (app_recursos_capacidade) ===");
    if (caps.length === 0) {
        console.log("  AVISO: nenhuma capacidade cadastrada — usando 528 min/dia (8h48 padrao)");
    } else {
        Object.entries(capMap).forEach(([k,v]) => console.log(`  ${k}: ${v.cap_dia_min} min/dia | Tempo padrao: ${v.tempo_padrao} min/peca`));
    }

    // 3. Saldo já produzido (descontar do planejamento)
    const uniqueOps = [...new Set(ops.map(o => o.op))];
    let qtdProduzida = {};
    if (uniqueOps.length > 0) {
        const [apts] = await my.execute(
            `SELECT op_numero, op_item, operacao_codigo, SUM(quantidade) qtd
             FROM app_production_appointments
             WHERE op_numero IN (${uniqueOps.map(()=>'?').join(',')})
             GROUP BY op_numero, op_item, operacao_codigo`,
            uniqueOps
        );
        apts.forEach(a => {
            qtdProduzida[`${(a.op_numero||'').trim()}_${(a.op_item||'').trim()}_${(a.operacao_codigo||'').trim()}`] = parseFloat(a.qtd)||0;
        });
    }

    // 4. ALGORITMO DE CASCATA
    //    - Calendario por recurso: {recurso: {YYYY-MM-DD: min_usados}}
    //    - Encadeamento: op N so comeca apos op N-1 da mesma OP/item terminar
    //    - Pula apenas domingo (sabado conta como dia util neste projeto)
    const START_DATE = new Date("2026-06-01T12:00:00");

    function isWorkday(d) { return d.getDay() !== 0; } // 0=domingo
    function nextDay(d)    { let r=new Date(d); r.setDate(r.getDate()+1); return r; }
    function advance(d)    { let r=new Date(d); while(!isWorkday(r)) r.setDate(r.getDate()+1); return r; }
    function fmtDate(d)    { return d.toISOString().split("T")[0]; }

    const resourceCalendar = {};   // minutosUsados por recurso por dia
    const opFinish = {};           // ultimo fim por chave OP+item (encadeamento)
    const results = [];

    // Ordena: por OP, item, depois por operacao (010 antes de 020...)
    ops.sort((a,b) => {
        if (a.op !== b.op)         return a.op.localeCompare(b.op);
        if (a.item_op !== b.item_op) return a.item_op.localeCompare(b.item_op);
        return (a.operacao||'').localeCompare(b.operacao||'');
    });

    console.log("\n=== PLANEJAMENTO CALCULADO (inicio: 01/06/2026, sem concorrencia com outros projetos) ===\n");

    for (const op of ops) {
        const recurso    = (op.recurso||"S/R").trim().toUpperCase();
        const qtdPlan    = parseFloat(op.qtd_planejada_op) || 0;
        const qtdProd    = qtdProduzida[`${op.op}_${op.item_op}_${op.operacao}`] || 0;
        const qtd        = Math.max(0, qtdPlan - qtdProd);

        // Capacidade do recurso no dia (em minutos) — PRIORITARIO sobre qualquer default
        const capData    = capMap[recurso] || { cap_dia_min:528, tempo_padrao:1 };
        const CAP_DIA    = capData.cap_dia_min;   // minutos disponiveis por dia para este recurso

        // Tempo unitario: usa g2_tempad do Protheus; fallback para o padrao do recurso no MySQL
        const tempoUnit  = parseFloat(op.tempo_padrao_min) > 0.001
            ? parseFloat(op.tempo_padrao_min)
            : capData.tempo_padrao;

        // Tempo total da operacao em minutos
        const tempoTotal = qtd > 0 ? qtd * tempoUnit : tempoUnit; // garante pelo menos 1 ciclo

        if (!resourceCalendar[recurso]) resourceCalendar[recurso] = {};

        // Encadeamento: esta op começa apenas após a anterior da mesma OP+item terminar
        const opKey = `${op.op}_${op.item_op}`;
        let startDate = advance(new Date(START_DATE));
        if (opFinish[opKey] && opFinish[opKey] > startDate) startDate = advance(new Date(opFinish[opKey]));

        // Distribui o tempo total pelos dias uteis respeitando a capacidade diaria do recurso
        let currentDate  = new Date(startDate);
        let actualStart  = null;
        let tempoRest    = tempoTotal;

        while (tempoRest > 0) {
            const dateKey   = fmtDate(currentDate);
            const usado     = resourceCalendar[recurso][dateKey] || 0;
            const disponivel = CAP_DIA - usado;  // minutos ainda livres neste recurso hoje

            if (disponivel <= 0) {
                // Recurso esgotado hoje -> avanca para o proximo dia util
                currentDate = advance(nextDay(currentDate));
                continue;
            }

            if (!actualStart) actualStart = new Date(currentDate);

            if (tempoRest <= disponivel) {
                resourceCalendar[recurso][dateKey] = usado + tempoRest;
                tempoRest = 0;
            } else {
                resourceCalendar[recurso][dateKey] = CAP_DIA; // dia cheio
                tempoRest -= disponivel;
                currentDate = advance(nextDay(currentDate));
            }
        }

        const endDate = new Date(currentDate);
        if (!actualStart) actualStart = new Date(endDate);
        opFinish[opKey] = new Date(endDate); // proxima op desta OP começa depois disto

        const diasNec = Math.max(1, Math.ceil(tempoTotal / CAP_DIA));
        results.push({
            op:op.op, item_op:op.item_op, operacao:op.operacao, sequen:op.sequen||'001',
            recurso, cod_produto_op:op.cod_produto_op,
            qtd, tempoTotal, CAP_DIA, diasNec,
            inicio:fmtDate(actualStart), fim:fmtDate(endDate)
        });

        console.log(`  OP ${op.op} | Item ${op.item_op} | Op ${op.operacao} (${recurso}) | Prod:${op.cod_produto_op} | Qtd:${qtd} | ${tempoTotal.toFixed(0)}min / ${CAP_DIA}min/dia = ${diasNec}d | ${fmtDate(actualStart)} -> ${fmtDate(endDate)}`);
    }

    // 5. SALVA NO MYSQL
    console.log(`\n=== SALVANDO ${results.length} REGISTROS ===`);
    const lote_id = `AGENTE-004618-${Date.now()}`;
    let saved = 0, erros = 0;

    for (const r of results) {
        try {
            await my.execute(`
                INSERT INTO app_production_planning
                    (op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo, produto_codigo,
                     data_planejada_inicio, data_planejada_fim, lote_id, usuario_planejador,
                     observacao_lote, duracao_dias, modo_calculo)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'cascata')
                ON DUPLICATE KEY UPDATE
                    recurso_codigo        = VALUES(recurso_codigo),
                    produto_codigo        = VALUES(produto_codigo),
                    data_planejada_inicio = VALUES(data_planejada_inicio),
                    data_planejada_fim    = VALUES(data_planejada_fim),
                    lote_id               = VALUES(lote_id),
                    usuario_planejador     = VALUES(usuario_planejador),
                    observacao_lote        = VALUES(observacao_lote),
                    duracao_dias           = VALUES(duracao_dias),
                    modo_calculo           = 'cascata'
            `, [
                r.op, r.item_op, r.sequen, r.operacao,
                r.recurso, r.cod_produto_op,
                `${r.inicio} 08:00:00`, `${r.fim} 17:00:00`,
                lote_id, 'agente_ia',
                `Planejamento automatico pedido 004618 | Capacidade: ${r.CAP_DIA}min/dia`,
                r.diasNec
            ]);
            saved++;
        } catch(e) {
            console.error(`  ERRO OP ${r.op} | Op ${r.operacao}: ${e.message}`);
            erros++;
        }
    }

    console.log(`\n✅ ${saved} operacoes salvas | ${erros} erros | Lote: ${lote_id}`);

    // 6. RESUMO FINAL POR RECURSO
    console.log("\n=== RESUMO POR RECURSO ===");
    const porRecurso = {};
    results.forEach(r => {
        if (!porRecurso[r.recurso]) porRecurso[r.recurso] = { qtdOps:0, diasAcum:0, inicio:r.inicio, fim:r.fim, capDia:r.CAP_DIA };
        porRecurso[r.recurso].qtdOps++;
        porRecurso[r.recurso].diasAcum += r.diasNec;
        if (r.fim > porRecurso[r.recurso].fim)     porRecurso[r.recurso].fim = r.fim;
        if (r.inicio < porRecurso[r.recurso].inicio) porRecurso[r.recurso].inicio = r.inicio;
    });
    Object.entries(porRecurso).sort(([,a],[,b]) => a.fim.localeCompare(b.fim)).forEach(([rec,v]) => {
        console.log(`  ${rec}: ${v.qtdOps} ops | Cap: ${v.capDia} min/dia | Periodo: ${v.inicio} -> ${v.fim}`);
    });

    const conclusao = results.map(r=>r.fim).sort().reverse()[0];
    console.log(`\n🏁 CONCLUSAO PREVISTA DO PEDIDO 004618: ${conclusao}`);

    await pg.end(); await my.end();
}
main().catch(e => console.error("ERRO FATAL:", e.message));


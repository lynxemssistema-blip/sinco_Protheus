/**
 * Planejamento em Cascata — Pedido 004618
 * 
 * CHAVE DE NEGÓCIO: pedido_venda + op_item + produto_codigo + recurso_codigo + operacao_codigo
 * 
 * REGRAS:
 *   1. Mesmo recurso → peças feitas em sequência (uma após a outra)
 *   2. Próximo recurso de cada peça → inicia APÓS o recurso anterior terminar AQUELA peça
 *   3. Capacidade diária de cada recurso (app_recursos_capacidade) é respeitada
 */
require("dotenv").config();
const { Pool } = require("pg");
const mysql = require("mysql2/promise");

const pg = new Pool({ host:process.env.PGHOST, port:process.env.PGPORT||5432, database:process.env.PGDATABASE||"p12prd", user:process.env.PGUSER, password:process.env.PGPASSWORD });

const PEDIDO       = "004618";
const DATA_INICIO  = "2026-06-01";

// ─── Helpers de data ─────────────────────────────────────────────────────────
function ehDiaUtil(d)  { return d.getDay() !== 0; }             // pula apenas domingo
function proximoDia(d) { let r=new Date(d); r.setDate(r.getDate()+1); return r; }
function avancar(d)    { let r=new Date(d); while(!ehDiaUtil(r)) r.setDate(r.getDate()+1); return r; }
function fmtData(d)    { return d.toISOString().split("T")[0]; }

async function main() {
    const my = await mysql.createConnection({
        host: process.env.MYSQL_HOST||"metalfisa.mysql.uhserver.com", port:3306,
        database: process.env.MYSQL_DB||"metalfisa",
        user: process.env.MYSQL_USER||"ronaldo2",
        password: process.env.MYSQL_PASSWORD||"jHAzhFG848@yN@U"
    });

    console.log(`\n╔══════════════════════════════════════════════════════╗`);
    console.log(`║  PLANEJAMENTO EM CASCATA — PEDIDO ${PEDIDO}          ║`);
    console.log(`║  Data início: ${DATA_INICIO}                           ║`);
    console.log(`╚══════════════════════════════════════════════════════╝\n`);

    // ── 1. CAPACIDADE DIÁRIA POR RECURSO ──────────────────────────────────────
    const [caps] = await my.execute("SELECT recurso_codigo, capacidade_diaria_minutos, tempo_padrao_minutos FROM app_recursos_capacidade");
    const capMap = {};
    caps.forEach(c => {
        capMap[(c.recurso_codigo||"").trim().toUpperCase()] = {
            cap_dia: parseFloat(c.capacidade_diaria_minutos) || 528,
            tempo_pad: parseFloat(c.tempo_padrao_minutos) || 1
        };
    });
    console.log("📋 CAPACIDADE DOS RECURSOS:");
    Object.entries(capMap).forEach(([k,v]) => console.log(`   ${k}: ${v.cap_dia} min/dia`));

    // ── 2. DADOS DO PROTHEUS ───────────────────────────────────────────────────
    // Busca todas as OPs vinculadas ao pedido + roteiro de cada produto
    const pgRes = await pg.query(`
        SELECT 
            TRIM(c2.c2_num)       AS op_numero,
            TRIM(c2.c2_item)      AS op_item,
            TRIM(c2.c2_sequen)    AS op_sequen,
            TRIM(c2.c2_pedido)    AS pedido_venda,
            TRIM(c2.c2_itempv)    AS item_pedido,
            TRIM(c2.c2_produto)   AS produto_codigo,
            c2.c2_quant           AS qtd_planejada,
            TRIM(g2.g2_operac)    AS operacao_codigo,
            TRIM(g2.g2_recurso)   AS recurso_codigo,
            TRIM(g2.g2_descri)    AS desc_operacao,
            g2.g2_tempad          AS tempo_padrao_min,
            g2.g2_setup           AS setup_hora
        FROM public.sc2010 c2
        JOIN public.sg2010 g2
            ON TRIM(g2.g2_produto) = TRIM(c2.c2_produto)
           AND COALESCE(g2.d_e_l_e_t_,'') IN ('',' ')
        WHERE TRIM(c2.c2_pedido) = $1
          AND COALESCE(c2.d_e_l_e_t_,'') IN ('',' ')
        ORDER BY c2.c2_item, g2.g2_operac
    `, [PEDIDO]);

    const ops = pgRes.rows;
    console.log(`\n✅ ${ops.length} operações encontradas no Protheus para o pedido ${PEDIDO}`);

    if (ops.length === 0) { console.log("Nenhuma OP encontrada. Verifique o pedido."); process.exit(0); }

    // ── 3. SALDO JÁ PRODUZIDO ─────────────────────────────────────────────────
    const opNumeros = [...new Set(ops.map(o => o.op_numero))];
    const [apts] = await my.execute(
        `SELECT op_numero, op_item, operacao_codigo, SUM(quantidade) qtd
         FROM app_production_appointments
         WHERE op_numero IN (${opNumeros.map(()=>'?').join(',')})
         GROUP BY op_numero, op_item, operacao_codigo`,
        opNumeros
    );
    const produzidoMap = {};
    apts.forEach(a => {
        produzidoMap[`${(a.op_numero||'').trim()}_${(a.op_item||'').trim()}_${(a.operacao_codigo||'').trim()}`] = parseFloat(a.qtd)||0;
    });

    // ── 4. ALGORITMO DE CASCATA ───────────────────────────────────────────────
    //
    //  resourceCalendar: { RECURSO: { 'YYYY-MM-DD': minutosUsados } }
    //  pecaFim:          { 'op_item_operacaoAnterior': Date } — quando a operação anterior
    //                    desta PEÇA terminou (encadeamento: op10→op20→op30)
    //
    const calendario   = {};  // minutos usados por recurso por dia
    const pecaFim      = {};  // quando a op anterior DE CADA PEÇA terminou
    const resultados   = [];

    // Ordena: por item do pedido, depois por código da operação (010→020→030)
    // Isso garante que op10 de todas as peças seja processada antes de op20
    // MAS mantém o encadeamento correto via pecaFim
    ops.sort((a,b) => {
        // Prioridade: pela operação (010 antes de 020 garante que o recurso A é preenchido antes do B)
        const opCmp = (a.operacao_codigo||'').localeCompare(b.operacao_codigo||'');
        if (opCmp !== 0) return opCmp;
        // Dentro da mesma operação, ordena por item
        return (a.op_item||'').localeCompare(b.op_item||'');
    });

    const INICIO = avancar(new Date(DATA_INICIO + "T12:00:00"));

    console.log(`\n🔄 CALCULANDO CASCATA (início: ${DATA_INICIO})...\n`);

    for (const op of ops) {
        const recurso   = (op.recurso_codigo||"S/R").trim().toUpperCase();
        const qtdPlan   = parseFloat(op.qtd_planejada) || 0;
        const qtdProd   = produzidoMap[`${op.op_numero}_${op.op_item}_${op.operacao_codigo}`] || 0;
        const saldo     = Math.max(0, qtdPlan - qtdProd);

        // Capacidade do recurso (REGRA: usa capacidade cadastrada no MySQL)
        const cap       = capMap[recurso] || { cap_dia: 528, tempo_pad: 1 };
        const CAP_DIA   = cap.cap_dia;

        // Tempo unitário: usa g2_tempad do Protheus; fallback para padrão do recurso
        const tempoUnit = parseFloat(op.tempo_padrao_min) > 0.001
            ? parseFloat(op.tempo_padrao_min)
            : cap.tempo_pad;
        const setup     = (parseFloat(op.setup_hora) || 0) * 60; // horas → minutos

        // Tempo total em minutos (setup + produção)
        // Se saldo = 0 (já produzido), reserva só 1 minuto simbólico para marcar como planejado
        const tempoTotal = saldo > 0
            ? setup + (saldo * tempoUnit)
            : 0;

        if (!calendario[recurso]) calendario[recurso] = {};

        // ── REGRA 1: Encadeamento — esta op só começa após a OPERAÇÃO ANTERIOR da mesma peça
        const pecaKey        = `${op.op_numero}_${op.op_item}`;
        const opAntKey       = `${op.op_numero}_${op.op_item}_ant_${op.operacao_codigo}`;
        // A chave da op anterior desta peça = menor operação que terminou antes desta
        let maiorOpAnt = null;
        Object.keys(pecaFim).forEach(k => {
            if (k.startsWith(pecaKey + '_op_') && k < `${pecaKey}_op_${op.operacao_codigo}`) {
                if (!maiorOpAnt || pecaFim[k] > maiorOpAnt) maiorOpAnt = pecaFim[k];
            }
        });

        let dataInicioCalc = avancar(new Date(INICIO));
        if (maiorOpAnt && maiorOpAnt > dataInicioCalc) {
            dataInicioCalc = avancar(new Date(maiorOpAnt));
        }

        // ── REGRA 2: Disponibilidade do recurso — agenda no próximo slot disponível
        let diaAtual    = new Date(dataInicioCalc);
        let dataInicioPeca = null;
        let tempoRest   = tempoTotal;

        if (tempoTotal <= 0) {
            // Já produzido — registra como início = hoje, fim = hoje
            dataInicioPeca = new Date(diaAtual);
            diaAtual       = new Date(diaAtual);
        } else {
            while (tempoRest > 0) {
                const chave    = fmtData(diaAtual);
                const usado    = calendario[recurso][chave] || 0;
                const dispon   = CAP_DIA - usado;

                if (dispon <= 0) {
                    // Recurso esgotado hoje → avança para o próximo dia útil
                    diaAtual = avancar(proximoDia(diaAtual));
                    continue;
                }

                if (!dataInicioPeca) dataInicioPeca = new Date(diaAtual);

                if (tempoRest <= dispon) {
                    calendario[recurso][chave] = usado + tempoRest;
                    tempoRest = 0;
                } else {
                    calendario[recurso][chave] = CAP_DIA;
                    tempoRest -= dispon;
                    diaAtual = avancar(proximoDia(diaAtual));
                }
            }
        }

        const dataFimCalc = new Date(diaAtual);
        if (!dataInicioPeca) dataInicioPeca = new Date(dataFimCalc);

        // Registra quando ESTA operação desta peça terminou (para encadear a próxima)
        pecaFim[`${pecaKey}_op_${op.operacao_codigo}`] = new Date(dataFimCalc);

        const diasNec = Math.max(1, Math.ceil(tempoTotal / CAP_DIA));

        resultados.push({
            pedido_venda:  PEDIDO,
            op_numero:     op.op_numero,
            op_item:       op.op_item,
            op_sequen:     op.op_sequen,
            operacao:      op.operacao_codigo,
            recurso,
            produto:       op.produto_codigo,
            item_pedido:   op.item_pedido,
            saldo,
            tempoTotal,
            CAP_DIA,
            diasNec,
            inicio:        fmtData(dataInicioPeca),
            fim:           fmtData(dataFimCalc)
        });

        const tag = saldo === 0 ? '✓' : ' ';
        console.log(`${tag} Pedido ${PEDIDO} | Item ${op.op_item.padEnd(3)} | Op ${op.operacao_codigo} | ${recurso.padEnd(8)} | ${op.produto_codigo} | Saldo:${saldo} | ${diasNec}d | ${fmtData(dataInicioPeca)} → ${fmtData(dataFimCalc)}`);
    }

    // ── 5. LIMPA REGISTROS ANTIGOS E INSERE OS NOVOS ─────────────────────────
    console.log(`\n🗑️  Removendo registros antigos do pedido ${PEDIDO}...`);

    // Apaga todos os registros cujo op_numero pertence a este pedido
    if (opNumeros.length > 0) {
        const [del] = await my.execute(
            `DELETE FROM app_production_planning WHERE op_numero IN (${opNumeros.map(()=>'?').join(',')})`,
            opNumeros
        );
        console.log(`   ${del.affectedRows} registros removidos`);
    }

    // Também apaga qualquer registro com pedido_venda = PEDIDO (lotes anteriores)
    const [del2] = await my.execute(`DELETE FROM app_production_planning WHERE pedido_venda = ?`, [PEDIDO]);
    if (del2.affectedRows > 0) console.log(`   +${del2.affectedRows} registros pelo pedido_venda`);

    console.log(`\n💾 SALVANDO ${resultados.length} REGISTROS...`);
    const lote_id = `CASCATA-${PEDIDO}-${Date.now()}`;
    let salvos = 0, erros = 0;

    for (const r of resultados) {
        try {
            await my.execute(`
                INSERT INTO app_production_planning
                    (op_numero, pedido_venda, op_item, op_sequencia, operacao_codigo,
                     recurso_codigo, produto_codigo,
                     data_planejada_inicio, data_planejada_fim,
                     lote_id, usuario_planejador, observacao_lote, duracao_dias, modo_calculo)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'cascata')
            `, [
                r.op_numero, r.pedido_venda, r.op_item, r.op_sequen, r.operacao,
                r.recurso, r.produto,
                `${r.inicio} 08:00:00`, `${r.fim} 17:00:00`,
                lote_id, 'agente_ia',
                `Cascata automática pedido ${PEDIDO} | Cap: ${r.CAP_DIA} min/dia | Saldo: ${r.saldo}`,
                r.diasNec
            ]);
            salvos++;
        } catch(e) {
            console.error(`  ❌ ERRO: ${r.op_numero}|${r.op_item}|${r.operacao}: ${e.message}`);
            erros++;
        }
    }

    console.log(`\n✅ ${salvos} registros salvos | ${erros} erros | Lote: ${lote_id}`);

    // ── 6. RESUMO POR RECURSO ─────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(65)}`);
    console.log("📊 RESUMO POR RECURSO:");
    console.log('═'.repeat(65));
    const porRecurso = {};
    resultados.forEach(r => {
        if (!porRecurso[r.recurso]) porRecurso[r.recurso] = { ops:0, itens:new Set(), inicio:r.inicio, fim:r.fim, cap:r.CAP_DIA };
        porRecurso[r.recurso].ops++;
        porRecurso[r.recurso].itens.add(r.op_item);
        if (r.fim > porRecurso[r.recurso].fim) porRecurso[r.recurso].fim = r.fim;
        if (r.inicio < porRecurso[r.recurso].inicio) porRecurso[r.recurso].inicio = r.inicio;
    });
    const ordenado = Object.entries(porRecurso).sort(([,a],[,b]) => a.inicio.localeCompare(b.inicio));
    let ultimoFim = DATA_INICIO;
    ordenado.forEach(([rec,v]) => {
        console.log(`  ${rec.padEnd(10)} | Cap: ${v.cap} min/dia | ${v.itens.size} peças | ${v.inicio} → ${v.fim}`);
        if (v.fim > ultimoFim) ultimoFim = v.fim;
    });
    console.log('═'.repeat(65));
    console.log(`\n🏁 CONCLUSÃO PREVISTA: ${ultimoFim}`);

    await pg.end();
    await my.end();
}

main().catch(e => { console.error("ERRO FATAL:", e.message); process.exit(1); });

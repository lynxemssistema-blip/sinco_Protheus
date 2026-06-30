const cron = require('node-cron');
const mysqlService = require('../mysqlService');
const db = require('../../db'); // PostgreSQL for Protheus
const ioService = require('../../index'); // We need to export or pass IO

let _io = null;

function setSocketIo(ioInstance) {
    _io = ioInstance;
}

/**
 * Dispara um alerta proativo do Hermes para todos os usuários autorizados
 */
function emitHermesAlert(text, type = 'info', contextData = null) {
    if (!_io) {
        console.log('[Hermes Proactive] Aviso: Socket.IO não está vinculado. Não foi possível enviar:', text);
        return;
    }

    const payload = {
        id: `alert-${Date.now()}`,
        text,
        type,
        criado_em: new Date().toISOString(),
        context_data: contextData
    };

    // Aqui podemos emitir apenas para quem tem permissão, ex: io.to('room_pcp') 
    // Por enquanto, emitimos globalmente no canal de alerta
    _io.emit('hermes_feed_message', payload);
    console.log(`[Hermes Proactive] Alerta emitido: ${text}`);
}

async function startProactiveMonitor() {
    console.log('🤖 [Hermes Proactive] Serviço de Monitoramento Autônomo ativado.');

    // Varredura de pedidos RNC em aberto (A cada 4 horas)
    cron.schedule('0 */4 * * *', async () => {
        try {
            const { isWeekendOrHoliday } = require('../../utils/dateHelper');
            if (isWeekendOrHoliday()) return;

            console.log('🤖 [Hermes Proactive] Verificando RNCs pendentes...');
            const { rows: rncs } = await db.query(`
                SELECT 
                    TRIM(c6.c6_num) as pedido,
                    TRIM(c6.c6_item) as item,
                    TRIM(c6.c6_produto) as produto,
                    TRIM(c6.c6_pedcli) as ped_cliente,
                    TRIM(sa1.a1_nome) as cliente,
                    (c6.c6_qtdven - c6.c6_qtdent) as saldo,
                    c6.c6_entreg as data_entrega,
                    c5.c5_emissao as data_emissao
                FROM sc6010 c6
                JOIN sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.d_e_l_e_t_ = '' AND c5.c5_filial = c6.c6_filial
                LEFT JOIN sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli AND sa1.d_e_l_e_t_ = ''
                WHERE c6.d_e_l_e_t_ = ''
                  AND (c6.c6_qtdven - c6.c6_qtdent) > 0
                  AND c6.c6_pedcli ILIKE '%RNC%'
                  AND c6.c6_num <> ''
                ORDER BY c6.c6_entreg ASC
            `);

            if (rncs && rncs.length > 0) {
                let msg = `⚠️ **Atenção:** Existem **${rncs.length}** pendências de Retrabalho / RNC (Saldo a entregar) no sistema!\n\n`;
                rncs.forEach(rnc => {
                    msg += `- **Cliente:** ${rnc.cliente}  \n`;
                    msg += `  **Pedido:** ${rnc.pedido} (Produto: ${rnc.produto})  \n`;
                    msg += `  **Emissão:** ${rnc.data_emissao ? rnc.data_emissao.substring(6,8)+'/'+rnc.data_emissao.substring(4,6)+'/'+rnc.data_emissao.substring(0,4) : '-'} | **Entrega:** ${rnc.data_entrega ? rnc.data_entrega.substring(6,8)+'/'+rnc.data_entrega.substring(4,6)+'/'+rnc.data_entrega.substring(0,4) : '-'}  \n`;
                    msg += `  **Saldo:** ${rnc.saldo} PC  \n\n`;
                });
                msg += `Por favor, priorizem a resolução destas não-conformidades.`;

                emitHermesAlert(msg, 'error', { type: 'rnc_aberto', count: rncs.length });
            }
        } catch (error) {
            console.error('[Hermes Proactive] Erro na varredura de RNCs:', error);
        }
    });

    // Roda a cada 2 horas (0 0/2 * * *)
    cron.schedule('0 */2 * * *', async () => {
        try {
            const { isWeekendOrHoliday } = require('../../utils/dateHelper');
            if (isWeekendOrHoliday()) return;

            console.log('🤖 [Hermes Proactive] Iniciando varredura bimestral de Gargalos de Planejamento...');
            
            const [atrasos] = await mysqlService.query(`
                SELECT 
                    f.pedido_numero, f.op_numero, f.op_item, f.op_sequencia, f.operacao_codigo,
                    f.quantidade_plan,
                    COALESCE((
                        SELECT SUM(a.quantidade) 
                        FROM app_production_appointments a 
                        WHERE a.op_numero = f.op_numero 
                          AND a.op_item = f.op_item 
                          AND a.op_sequencia = f.op_sequencia
                          AND a.operacao_codigo = f.operacao_codigo
                    ), 0) as quantidade_produzida,
                    f.plan_inicio_ate
                FROM app_pcp_forecasts f
                WHERE f.plan_inicio_ate <= CURDATE()
                  AND f.status_liberacao != 'Encerrado'
                HAVING (quantidade_plan - quantidade_produzida) > 0
                ORDER BY f.plan_inicio_ate ASC
                LIMIT 5;
            `);

            if (atrasos.length > 0) {
                const totalOps = atrasos.length; // Aqui só pegamos 5, ideal seria um COUNT total
                
                const [countRow] = await mysqlService.query(`
                    SELECT COUNT(*) as total_pendente
                    FROM (
                        SELECT f.op_numero
                        FROM app_pcp_forecasts f
                        WHERE f.plan_inicio_ate <= CURDATE()
                        AND f.status_liberacao != 'Encerrado'
                        HAVING (f.quantidade_plan - COALESCE((SELECT SUM(a.quantidade) FROM app_production_appointments a WHERE a.op_numero = f.op_numero AND a.op_item = f.op_item AND a.op_sequencia = f.op_sequencia AND a.operacao_codigo = f.operacao_codigo), 0)) > 0
                    ) AS sub;
                `);

                const totalPendentes = countRow[0].total_pendente;

                let msg = `🚨 **Atenção (Gargalo de Planejamento):** Existem **${totalPendentes}** OPs/Operações planejadas para começar até hoje (ou em atraso) que ainda possuem saldo pendente na fábrica.\n\n`;
                msg += `**Top prioridades no gargalo:**  \n`;
                
                atrasos.forEach(op => {
                    const dataPlan = new Date(op.plan_inicio_ate).toLocaleDateString('pt-BR');
                    msg += `- OP **${op.op_numero}** Seq: ${op.op_sequencia} (Operação: ${op.operacao_codigo}) | Data Plan: ${dataPlan} | Faltam: ${op.quantidade_plan - op.quantidade_produzida} peças  \n`;
                });

                emitHermesAlert(msg, 'warning', { type: 'gargalo_planejamento', count: totalPendentes });
            } else {
                // emitHermesAlert(`✅ **Monitoramento Produtivo:** Nenhuma OP planejada para hoje ou atrasada com saldo pendente identificada no momento. Bom trabalho!`, 'success');
            }

        } catch (error) {
            console.error('[Hermes Proactive] Erro na varredura de gargalos:', error);
        }
    });

}

module.exports = {
    startProactiveMonitor,
    setSocketIo,
    emitHermesAlert
};

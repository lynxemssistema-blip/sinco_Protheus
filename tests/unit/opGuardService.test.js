/**
 * tests/unit/opGuardService.test.js
 * Travas de alteração de OP e número das frações (server/services/opGuardService.js).
 * Usa um banco falso em memória: nenhuma conexão com o MySQL real.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

// Substitui o pool MySQL antes de carregar o serviço (o serviço cria a tabela de histórico ao carregar)
const historicoGravado = [];
const fakePool = {
    query: async (sql, params) => {
        if (/INSERT INTO app_op_historico/i.test(sql)) historicoGravado.push(params);
        return [[]];
    }
};
require.cache[path.join(__dirname, '../../server/services/mysqlService.js')] = {
    id: 'mysqlService', filename: 'mysqlService', loaded: true, exports: fakePool
};

const guard = require('../../server/services/opGuardService');

// Conexão falsa: responde conforme a tabela consultada
const criarConn = (dados = {}) => ({
    query: async (sql) => {
        const tabela = [
            'app_pcp_delivery_forecasts', 'app_sales_order_item_notes', 'app_pcp_releases', 'app_pcp_lote_itens',
            'app_lotes_corte_itens', 'erp_ordens_producao', 'sc2010', 'app_ind_producao_ativa',
            'app_production_appointments', 'app_ind_production_appointments'
        ].find(t => new RegExp(`\\b${t}\\b`, 'i').test(sql));
        const valor = dados[tabela];
        if (valor instanceof Error) throw valor;
        return [valor || (/SUM\(/i.test(sql) ? [{ total: 0 }] : [])];
    }
});

describe('opGuardService: número da OP e das frações', () => {
    it('deve montar a OP original de 11 dígitos a partir do que estiver gravado', () => {
        assert.strictEqual(guard.toOpBase11('000003', '2'), '00000302001');
        assert.strictEqual(guard.toOpBase11('00000302', '02'), '00000302001');
        assert.strictEqual(guard.toOpBase11('00000302001AA', '02'), '00000302001');
        assert.strictEqual(guard.toOpBase11('', '02'), null);
    });

    it('deve gerar as letras das frações em sequência (AA, AB ... AZ, BA)', () => {
        assert.deepStrictEqual([0, 1, 25, 26].map(guard.getFractionLetter), ['AA', 'AB', 'AZ', 'BA']);
    });

    it('deve preferir a OP gerada no sistema, depois a do Protheus, e sem OP usar pedido + item', async () => {
        const sistema = await guard.resolveItemOp(criarConn({ erp_ordens_producao: [{ numero_op: '00000302001' }], sc2010: [{ c2_num: '999999', c2_item: '01', c2_sequen: '001' }] }), '000003', '02');
        assert.deepStrictEqual(sistema, { opBase: '00000302001', origem: 'sistema' });

        const protheus = await guard.resolveItemOp(criarConn({ sc2010: [{ c2_num: '000003', c2_item: '02', c2_sequen: '001' }] }), '3', '2');
        assert.deepStrictEqual(protheus, { opBase: '00000302001', origem: 'protheus' });

        const semOp = await guard.resolveItemOp(criarConn({}), '3', '2');
        assert.deepStrictEqual(semOp, { opBase: '00000302001', origem: 'sem_op' });
    });
});

describe('opGuardService: travas do item', () => {
    beforeEach(() => { historicoGravado.length = 0; });

    it('item sem lote, liberação, corte ou apontamento fica livre', async () => {
        const locks = await guard.getItemLocks(criarConn({ sc2010: [{ c2_num: '000003', c2_item: '02', c2_sequen: '001' }] }), '000003', '02');
        assert.deepStrictEqual(locks.motivos, []);
        assert.strictEqual(locks.apontado, 0);
    });

    it('deve travar por lote LPF (com o status do lote), lote PCP, plano de corte, Mescla e apontamento', async () => {
        const conn = criarConn({
            app_pcp_delivery_forecasts: [{ lpf: 'LPF-2026-00012' }],
            app_sales_order_item_notes: [],
            app_pcp_releases: [{ codigo_liberacao: 'LPF-2026-00012', status: 'LIBERADO' }],
            app_pcp_lote_itens: [{ lote_ref: 'LOTE-7', status: 'ABERTO' }],
            app_lotes_corte_itens: [{ numero_lote: 'LC-2026-MTC01-000004' }],
            sc2010: [{ c2_num: '000003', c2_item: '02', c2_sequen: '001' }],
            app_ind_producao_ativa: [{ op_base: '00000302001' }],
            app_production_appointments: [{ total: 30 }],
            app_ind_production_appointments: [{ total: 5 }]
        });
        const locks = await guard.getItemLocks(conn, '000003', '02');
        assert.deepStrictEqual(locks.motivos.map(m => m.tipo), ['LOTE_LPF', 'LOTE_PCP', 'PLANO_CORTE', 'MESCLA', 'APONTAMENTO']);
        assert.match(locks.motivos[0].descricao, /LPF-2026-00012 \(LIBERADO\)/);
        assert.strictEqual(locks.apontado, 35);
    });

    it('item sem OP não consulta Mescla nem apontamento', async () => {
        const locks = await guard.getItemLocks(criarConn({ app_production_appointments: [{ total: 99 }] }), '000003', '02');
        assert.deepStrictEqual(locks.motivos, []);
    });

    it('tabela opcional ausente no banco não trava nem derruba a verificação', async () => {
        const semTabela = Object.assign(new Error('no such table'), { code: 'ER_NO_SUCH_TABLE' });
        const locks = await guard.getItemLocks(criarConn({ app_pcp_lote_itens: semTabela, app_ind_producao_ativa: semTabela }), '000003', '02');
        assert.deepStrictEqual(locks.motivos, []);
    });

    it('outro erro de banco deve propagar (não libera a alteração por engano)', async () => {
        await assert.rejects(guard.getItemLocks(criarConn({ app_lotes_corte_itens: new Error('timeout') }), '000003', '02'), /timeout/);
    });

    it('assertItemLivre lança erro 409 com os motivos e a regra da Data PCP', async () => {
        const conn = criarConn({ app_lotes_corte_itens: [{ numero_lote: 'LC-1' }] });
        await assert.rejects(guard.assertItemLivre(conn, '000003', '02', 'fracionar a OP'), (err) => {
            assert.ok(err instanceof guard.OpBloqueadaError);
            assert.strictEqual(err.status, 409);
            assert.match(err.message, /^Não é possível fracionar a OP: Plano de corte LC-1\. Somente a Data PCP pode ser alterada\.$/);
            return true;
        });
    });

    it('histórico grava o usuário do login (não o enviado pela tela)', async () => {
        const req = { user: { id: 37, nome: 'Edson Manoel', login: 'edson' }, body: { usuario: 'Outro Nome' }, method: 'POST', baseUrl: '/api/pedidos', route: { path: '/split-op' } };
        await guard.registrarHistorico(null, req, { acao: guard.ACOES.FRACIONAMENTO_CRIADO, pedido: '3', item: '2', op: '00000302001', descricao: 'teste' });
        const p = historicoGravado[0];
        assert.deepStrictEqual([p[0], p[1], p[2], p[5]], ['000003', '02', '00000302001', 'FRACIONAMENTO_CRIADO']);
        assert.deepStrictEqual([p[9], p[10], p[11]], [37, 'Edson Manoel', 'edson']);
        assert.strictEqual(p[12], 'POST /api/pedidos/split-op');
    });
});

/**
 * tests/unit/productionTracking.test.js
 * Testes Unitários de Apontamentos de Produção e Rastreabilidade de Chão de Fábrica
 * MODO DE AUTONOMIA TOTAL - SINCO PROTHEUS
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Extração das regras de negócio do sinco_apontamento.js e producao.js para teste unitário
const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const round3 = (n) => Math.round(n * 1000) / 1000;

const computeSituacao = ({ prevista, produzida }) => {
    const prev = toNumber(prevista);
    const prod = toNumber(produzida);
    if (prev > 0 && prod >= prev) return 'CONCLUIDO';
    if (prod > 0) return 'EM_ANDAMENTO';
    return 'PENDENTE';
};

const computeRefugoPercentual = (pecasBoas, pecasRefugo) => {
    const boas = Math.max(0, toNumber(pecasBoas));
    const refugo = Math.max(0, toNumber(pecasRefugo));
    const total = boas + refugo;
    if (total === 0) return 0;
    return round3((refugo / total) * 100);
};

describe('Shopfloor Rules: computeSituacao', () => {
    it('deve retornar CONCLUIDO quando produzida for igual à prevista', () => {
        const res = computeSituacao({ prevista: 1000, produzida: 1000 });
        assert.strictEqual(res, 'CONCLUIDO');
    });

    it('deve retornar CONCLUIDO quando houver superprodução (produzida > prevista)', () => {
        const res = computeSituacao({ prevista: 500, produzida: 550 });
        assert.strictEqual(res, 'CONCLUIDO');
    });

    it('deve retornar EM_ANDAMENTO quando produzida for maior que zero mas menor que prevista', () => {
        const res = computeSituacao({ prevista: 1000, produzida: 250 });
        assert.strictEqual(res, 'EM_ANDAMENTO');
    });

    it('deve retornar PENDENTE quando quantidade produzida for zero', () => {
        const res = computeSituacao({ prevista: 1000, produzida: 0 });
        assert.strictEqual(res, 'PENDENTE');
    });

    it('deve lidar com valores nulos, strings ou indefinidos graciosamente sem lançar exceção', () => {
        assert.strictEqual(computeSituacao({ prevista: null, produzida: null }), 'PENDENTE');
        assert.strictEqual(computeSituacao({ prevista: '100', produzida: '100' }), 'CONCLUIDO');
        assert.strictEqual(computeSituacao({ prevista: 'invalid', produzida: 'invalid' }), 'PENDENTE');
        assert.strictEqual(computeSituacao({}), 'PENDENTE');
    });

    it('deve evitar estado inválido para quantidades negativas', () => {
        const res = computeSituacao({ prevista: 1000, produzida: -50 });
        assert.strictEqual(res, 'PENDENTE');
    });
});

describe('Shopfloor Rules: toNumber e Cálculos de Refugo', () => {
    it('deve converter corretamente números e strings numéricas', () => {
        assert.strictEqual(toNumber(123), 123);
        assert.strictEqual(toNumber('456.78'), 456.78);
        assert.strictEqual(toNumber('0'), 0);
    });

    it('deve retornar 0 para valores inválidos, nulos, NaN ou Infinity', () => {
        assert.strictEqual(toNumber(null), 0);
        assert.strictEqual(toNumber(undefined), 0);
        assert.strictEqual(toNumber(''), 0);
        assert.strictEqual(toNumber('abc'), 0);
        assert.strictEqual(toNumber(NaN), 0);
        assert.strictEqual(toNumber(Infinity), 0);
        assert.strictEqual(toNumber(-Infinity), 0);
    });

    it('deve calcular percentual de refugo corretamente', () => {
        // 90 boas + 10 refugo = 100 total -> 10%
        assert.strictEqual(computeRefugoPercentual(90, 10), 10);
        // 195 boas + 5 refugo = 200 total -> 2.5%
        assert.strictEqual(computeRefugoPercentual(195, 5), 2.5);
    });

    it('deve prevenir divisão por zero quando total apontado for 0', () => {
        assert.strictEqual(computeRefugoPercentual(0, 0), 0);
        assert.strictEqual(computeRefugoPercentual(null, null), 0);
    });
});

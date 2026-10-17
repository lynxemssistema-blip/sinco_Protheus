/**
 * Serviço de Inicialização e Template de Dados para Novas Empresas SaaS
 * 
 * Cria os setores fabris padrão para que o chão de fábrica, PCP e Meu Canal
 * funcionem imediatamente após o cadastro da empresa sem depender de configuração manual.
 */

const db = require('./mysqlService');

const DEFAULT_SECTORS = [
    { nome: '00 - Corte', descricao: 'Corte e Guilhotina / Laser', cor: '#f59e0b', ordem: 0 },
    { nome: '00 - Dobra', descricao: 'Prensas e Viradeiras CNC', cor: '#3b82f6', ordem: 1 },
    { nome: '01 - Caldeiraria', descricao: 'Ajustagem e Conformação', cor: '#f59e0b', ordem: 2 },
    { nome: '02 - Solda', descricao: 'Solda MIG/TIG e Acabamento', cor: '#3b82f6', ordem: 3 },
    { nome: '03 - Pintura', descricao: 'Pintura Pó e Líquida', cor: '#8b5cf6', ordem: 4 },
    { nome: '04 - Montagem', descricao: 'Montagem Final e Testes', cor: '#64748b', ordem: 5 },
    { nome: '05 - Expedição', descricao: 'Conferência, Embalagem e Embarque', cor: '#10b981', ordem: 6 }
];

const DEFAULT_RESOURCES = [
    { codigo: 'MO0001', nome: 'GUILHOTINA', tipo: 'MA', setorNome: '00 - Corte' },
    { codigo: 'MO0013', nome: 'LASER', tipo: 'MA', setorNome: '00 - Corte' },
    { codigo: 'MO0026', nome: 'SERRA DE FITA', tipo: 'MA', setorNome: '00 - Corte' },
    { codigo: 'MO0003', nome: 'VIRADEIRA', tipo: 'MA', setorNome: '00 - Dobra' },
    { codigo: 'MO0004', nome: 'PRENSA', tipo: 'MA', setorNome: '00 - Dobra' },
    { codigo: 'MO0002', nome: 'PUNCIONADEIRA', tipo: 'MA', setorNome: '01 - Caldeiraria' },
    { codigo: 'MO0028', nome: 'CALANDRA', tipo: 'MA', setorNome: '01 - Caldeiraria' },
    { codigo: 'MO0014', nome: 'FURADEIRA', tipo: 'MA', setorNome: '01 - Caldeiraria' },
    { codigo: 'MO0006', nome: 'SOLDA', tipo: 'MA', setorNome: '02 - Solda' },
    { codigo: 'MO0020', nome: 'SOLDA MIG/TIG', tipo: 'MA', setorNome: '02 - Solda' },
    { codigo: 'MO0008', nome: 'ACABAMENTO', tipo: 'MA', setorNome: '02 - Solda' },
    { codigo: 'MO0010', nome: 'PINTURA', tipo: 'MA', setorNome: '03 - Pintura' },
    { codigo: 'MO0011', nome: 'MONTAGEM', tipo: 'MA', setorNome: '04 - Montagem' },
    { codigo: 'MO0012', nome: 'EMBALAGEM', tipo: 'MA', setorNome: '05 - Expedição' }
];

async function seedCompanyDefaults(empresaId) {
    if (!empresaId || empresaId === 1) return; // Não altera matriz Metalfisa

    try {
        const [existing] = await db.query(
            'SELECT COUNT(*) as total FROM pcp_setores WHERE IdEmpresa = ?',
            [empresaId]
        );

        if (existing[0]?.total === 0) {
            for (const s of DEFAULT_SECTORS) {
                await db.query(
                    'INSERT IGNORE INTO pcp_setores (nome, descricao, cor, ativo, ordem, IdEmpresa) VALUES (?, ?, ?, 1, ?, ?)',
                    [s.nome, s.descricao, s.cor, s.ordem, empresaId]
                );
            }
            console.log(`✅ [TENANT SEED] Setores fabris padrão criados para a Empresa ID ${empresaId}.`);
        }

        // 2. Garante recursos padrão no catálogo pcp_recursos
        const [existingRec] = await db.query(
            'SELECT COUNT(*) as total FROM pcp_recursos WHERE IdEmpresa = ?',
            [empresaId]
        );

        if (existingRec[0]?.total === 0) {
            for (const r of DEFAULT_RESOURCES) {
                await db.query(
                    'INSERT IGNORE INTO pcp_recursos (IdEmpresa, codigo, nome, tipo, capacidade_padrao, ativo) VALUES (?, ?, ?, ?, 0, 1)',
                    [empresaId, r.codigo, r.nome, r.tipo]
                );
            }
            console.log(`✅ [TENANT SEED] Recursos fabris padrão criados no catálogo para Empresa ID ${empresaId}.`);
        }

        // 3. Garante vínculos entre setores e recursos em pcp_setor_recursos
        const [existingLinks] = await db.query(
            'SELECT COUNT(*) as total FROM pcp_setor_recursos WHERE IdEmpresa = ?',
            [empresaId]
        );

        if (existingLinks[0]?.total === 0) {
            const [setoresRows] = await db.query(
                'SELECT id, nome FROM pcp_setores WHERE IdEmpresa = ?',
                [empresaId]
            );
            const setorMap = new Map();
            setoresRows.forEach(s => setorMap.set(s.nome, s.id));

            for (const r of DEFAULT_RESOURCES) {
                const setorId = setorMap.get(r.setorNome);
                if (setorId) {
                    await db.query(
                        'INSERT IGNORE INTO pcp_setor_recursos (setor_id, recurso_codigo, recurso_nome, IdEmpresa) VALUES (?, ?, ?, ?)',
                        [setorId, r.codigo, r.nome, empresaId]
                    );
                }
            }
            console.log(`✅ [TENANT SEED] Vínculos Setor-Recursos criados para Empresa ID ${empresaId}.`);
        }
    } catch (err) {
        console.warn(`⚠️ [TENANT SEED] Falha ao criar template padrão para empresa ${empresaId}:`, err.message);
    }
}

/**
 * Executado na inicialização do servidor para garantir que todas as empresas cadastradas tenham setores
 */
async function seedAllMissingCompanies() {
    try {
        const [empresas] = await db.query('SELECT IdEmpresa FROM empresa WHERE IdEmpresa > 1');
        for (const e of empresas) {
            await seedCompanyDefaults(e.IdEmpresa);
        }
    } catch (err) {
        console.warn('⚠️ [TENANT SEED] Erro ao sincronizar templates das empresas:', err.message);
    }
}

module.exports = {
    seedCompanyDefaults,
    seedAllMissingCompanies
};

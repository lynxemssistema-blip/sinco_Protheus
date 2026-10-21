/**
 * Serviço de Inicialização e Template de Dados para Novas Empresas SaaS
 * 
 * Cria os setores fabris padrão, recursos e o catálogo padrão de codificação de cores de aço
 * para que o chão de fábrica, PCP, Engenharia e Estoques funcionem imediatamente
 * após o cadastro da empresa sem depender de configuração manual.
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

/**
 * Padrão Industrial de Codificação de Cores de Aço (Barras, Tarugos e Chapas)
 * Conforme normas ABNT / SAE / AISI e padrões siderúrgicos (Gerdau, Villares, Aços Favorit).
 */
const DEFAULT_STEEL_COLORS = [
    {
        codigo: 'SAE 1020',
        significado: 'Aço Carbono Baixo / Construção Mecânica / Usinagem Geral',
        tipo_cor: 'solida',
        cor_primaria: '#FFFFFF',
        cor_secundaria: null,
        descricao: 'Extremidade pintada de Branco. Excelente soldabilidade e conformação mecânica.'
    },
    {
        codigo: 'SAE 1045',
        significado: 'Aço Carbono Médio / Alta Resistência / Eixos',
        tipo_cor: 'solida',
        cor_primaria: '#DC2626',
        cor_secundaria: null,
        descricao: 'Extremidade pintada de Vermelho. Aço para eixos, engrenagens e pinos com têmpera.'
    },
    {
        codigo: 'SAE 4140',
        significado: 'Aço Cromo-Molibdênio Beneficiado (Cr-Mo)',
        tipo_cor: 'solida',
        cor_primaria: '#16A34A',
        cor_secundaria: null,
        descricao: 'Extremidade pintada de Verde. Alta tenacidade e resistência à torção e fadiga.'
    },
    {
        codigo: 'SAE 8620',
        significado: 'Aço para Cementação / Alta Tenacidade de Núcleo',
        tipo_cor: 'solida',
        cor_primaria: '#EAB308',
        cor_secundaria: null,
        descricao: 'Extremidade pintada de Amarelo. Camada cementada dura com núcleo tenaz para engrenagens.'
    },
    {
        codigo: 'SAE 4340',
        significado: 'Aço Níquel-Cromo-Molibdênio Alta Torção (Ni-Cr-Mo)',
        tipo_cor: 'solida',
        cor_primaria: '#2563EB',
        cor_secundaria: null,
        descricao: 'Extremidade pintada de Azul. Peças de altíssima responsabilidade estrutural e eixos pesados.'
    },
    {
        codigo: 'ASTM A36',
        significado: 'Aço Estrutural Carbono / Laminados e Perfis',
        tipo_cor: 'solida',
        cor_primaria: '#1E293B',
        cor_secundaria: null,
        descricao: 'Extremidade pintada de Preto/Grafite. Chapas, cantoneiras e vigas soldadas.'
    },
    {
        codigo: 'INOX 304',
        significado: 'Aço Inoxidável Austenítico (18/8)',
        tipo_cor: 'solida',
        cor_primaria: '#CA8A04',
        cor_secundaria: null,
        descricao: 'Extremidade pintada de Dourado. Resistência à oxidação atmosférica e alimentícia.'
    },
    {
        codigo: 'INOX 316',
        significado: 'Aço Inoxidável Austenítico com Molibdênio',
        tipo_cor: 'solida',
        cor_primaria: '#EA580C',
        cor_secundaria: null,
        descricao: 'Extremidade pintada de Laranja. Máxima resistência contra corrosão marítima e cloretos.'
    },
    {
        codigo: 'VC 131 / D2',
        significado: 'Aço Ferramenta para Trabalho a Frio',
        tipo_cor: 'bicolor',
        cor_primaria: '#FFFFFF',
        cor_secundaria: '#DC2626',
        descricao: 'Bicolor Branco e Vermelho. Matrizes de estamparia, corte fino e punções de alto rendimento.'
    },
    {
        codigo: 'VND / O1',
        significado: 'Aço Ferramenta Indeformável Temperável em Óleo',
        tipo_cor: 'bicolor',
        cor_primaria: '#2563EB',
        cor_secundaria: '#EAB308',
        descricao: 'Bicolor Azul e Amarelo. Machos, fieiras, facas de guilhotina e calibres.'
    },
    {
        codigo: '1045 T&R',
        significado: 'Aço 1045 Temperado e Revenido de Precisão',
        tipo_cor: 'bicolor',
        cor_primaria: '#DC2626',
        cor_secundaria: '#1E293B',
        descricao: 'Bicolor Vermelho e Preto. Barras retificadas beneficiadas para fusos e hastes hidráulicas.'
    },
    {
        codigo: '1020 Trefilado',
        significado: 'Aço 1020 Trefilado Redondo/Sextavado h9',
        tipo_cor: 'bicolor',
        cor_primaria: '#FFFFFF',
        cor_secundaria: '#2563EB',
        descricao: 'Bicolor Branco e Azul. Acabamento brilhante e tolerância h9/h11 para tornos automáticos.'
    }
];

/**
 * Cria ou restaura o cadastro padrão de cores de aço para uma empresa
 * @param {number} empresaId 
 * @param {boolean} force Se true, insere ou atualiza mesmo se já houver registros
 */
async function seedSteelColors(empresaId, force = false) {
    if (!empresaId) return;

    try {
        if (!force) {
            const [existing] = await db.query(
                'SELECT COUNT(*) as total FROM erp_produtos_cores WHERE IdEmpresa = ?',
                [empresaId]
            );
            if ((existing[0]?.total || 0) > 0) {
                return; // Já possui cores cadastradas
            }
        }

        for (const c of DEFAULT_STEEL_COLORS) {
            await db.query(`
                INSERT INTO erp_produtos_cores 
                    (IdEmpresa, codigo, significado, tipo_cor, cor_primaria, cor_secundaria, descricao, ativo)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE 
                    significado = VALUES(significado),
                    tipo_cor = VALUES(tipo_cor),
                    cor_primaria = VALUES(cor_primaria),
                    cor_secundaria = VALUES(cor_secundaria),
                    descricao = VALUES(descricao),
                    ativo = 1
            `, [
                empresaId,
                c.codigo,
                c.significado,
                c.tipo_cor,
                c.cor_primaria,
                c.cor_secundaria,
                c.descricao
            ]);
        }

        console.log(`✅ [TENANT SEED] Padrão de 12 cores de aço criado/sincronizado para Empresa ID ${empresaId}.`);
    } catch (err) {
        console.warn(`⚠️ [TENANT SEED] Falha ao criar cores de aço para empresa ${empresaId}:`, err.message);
    }
}

async function seedCompanyDefaults(empresaId) {
    if (!empresaId) return;

    try {
        // 1. Setores Fabris Padrão
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

        // 4. Garante Cores de Aço Padrão
        await seedSteelColors(empresaId, false);
    } catch (err) {
        console.warn(`⚠️ [TENANT SEED] Falha ao criar template padrão para empresa ${empresaId}:`, err.message);
    }
}

/**
 * Executado na inicialização do servidor para garantir que todas as empresas cadastradas tenham templates
 */
async function seedAllMissingCompanies() {
    try {
        const [empresas] = await db.query('SELECT IdEmpresa FROM empresa');
        for (const e of empresas) {
            await seedCompanyDefaults(e.IdEmpresa);
        }
    } catch (err) {
        console.warn('⚠️ [TENANT SEED] Erro ao sincronizar templates das empresas:', err.message);
    }
}

module.exports = {
    DEFAULT_STEEL_COLORS,
    seedSteelColors,
    seedCompanyDefaults,
    seedAllMissingCompanies
};

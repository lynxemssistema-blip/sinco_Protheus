/**
 * Configuração dos Planos de Acesso do SaaS
 */
const PLANOS = {
    starter: {
        id: 'starter',
        nome: 'Starter',
        descricao: 'Ideal para pequenas oficinas e escritórios comerciais',
        limite_usuarios: 3,
        preco_mensal: 290,
        modulos: [
            'comercial',
            'orcamentos',
            'clientes',
            'catalogo_produtos'
        ]
    },
    pro: {
        id: 'pro',
        nome: 'Pro (PCP & Produção)',
        descricao: 'Gestão completa do orçamento ao chão de fábrica',
        limite_usuarios: 10,
        preco_mensal: 690,
        modulos: [
            'comercial',
            'orcamentos',
            'clientes',
            'catalogo_produtos',
            'pcp',
            'producao',
            'apontamento',
            'romaneio',
            'estoque_materiais'
        ]
    },
    enterprise: {
        id: 'enterprise',
        nome: 'Enterprise (Nesting & IA)',
        descricao: 'Poder total com Nesting DXF, Inteligência Artificial e WhatsApp',
        limite_usuarios: 9999,
        preco_mensal: 1490,
        modulos: [
            'comercial',
            'orcamentos',
            'clientes',
            'catalogo_produtos',
            'pcp',
            'producao',
            'apontamento',
            'romaneio',
            'estoque_materiais',
            'nesting_dxf',
            'ia_assistente',
            'whatsapp_alertas',
            'api_integracao'
        ]
    }
};

const TRIAL_DAYS = 14;
const DEFAULT_TRIAL_PLAN = 'pro';

module.exports = {
    PLANOS,
    TRIAL_DAYS,
    DEFAULT_TRIAL_PLAN
};

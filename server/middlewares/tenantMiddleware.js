/**
 * Middleware de Isolamento Multi-Tenant & Controle de Acesso por Planos
 */
const db = require('../services/mysqlService');
const { PLANOS } = require('../config/planos');
const { SUPERADMIN_EMAILS, isSuperAdminUser } = require('../util/authHelper');
const { tenantStorage } = require('../services/tenantContext');

const SUPERADMIN_EMAIL = SUPERADMIN_EMAILS[0];

/**
 * Injeta o contexto da empresa (Tenant) em req.tenantId e req.tenant
 */
async function tenantMiddleware(req, res, next) {
    try {
        if (!req.user) {
            // Same public routes exempted in authenticateToken (opened via <a>/window.open, no auth header)
            const url = req.originalUrl || '';
            if (url.startsWith('/api/docs/view') || url.startsWith('/api/webhook')) {
                return next();
            }
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }

        const isSuperAdmin = isSuperAdminUser(req.user) || req.isSuperAdmin === true;

        req.isSuperAdmin = isSuperAdmin;
        req.isMaster = (req.user.is_master === 1 || req.user.is_master === true || req.user.tipo === 'master' || isSuperAdmin);

        // Caso 1: Superadmin com Impersonation via Header ou Query
        const tenantOverride = req.headers['x-tenant-override'] || req.query.tenant_id;

        if (isSuperAdmin) {
            if (tenantOverride && !isNaN(parseInt(tenantOverride))) {
                req.tenantId = parseInt(tenantOverride);
                req.isImpersonating = true;
            } else if (tenantOverride === 'all' || req.query.tenant_id === 'all' || req.query.empresa_id === 'all' || req.headers['x-tenant-all'] === 'true') {
                req.tenantId = null; // Acesso global explícito para auditoria multi-empresa
                req.isImpersonating = false;
            } else {
                req.tenantId = req.user?.IdEmpresa || null;
                req.isImpersonating = false;
            }
        } else {
            // Caso 2: Usuário regular ou Master da Empresa - Vinculado estritamente à sua própria empresa
            req.tenantId = req.user?.IdEmpresa || null;
            req.isImpersonating = false;
        }

        // Se estiver no escopo de uma empresa específica, busca dados do plano
        if (req.tenantId) {
            try {
                const [empRows] = await db.query(
                    'SELECT IdEmpresa, RazaoSocial, NomeFantasia, plano, status_plano, trial_expira_em, limite_usuarios, modulos_liberados FROM empresa WHERE IdEmpresa = ?',
                    [req.tenantId]
                );

                if (empRows.length > 0) {
                    const emp = empRows[0];
                    const planoConfig = PLANOS[emp.plano] || PLANOS.pro;

                    // Checa expiração de trial
                    let trialExpirado = false;
                    if (emp.status_plano === 'trial' && emp.trial_expira_em) {
                        trialExpirado = new Date(emp.trial_expira_em) < new Date();
                    }

                    // Se empresa estiver bloqueada (exceto para superadmin em auditoria)
                    if (emp.status_plano === 'bloqueado' && !isSuperAdmin) {
                        return res.status(403).json({
                            error: 'Acesso suspenso',
                            message: 'A conta da sua empresa está temporariamente bloqueada. Entre em contato com o suporte comercial.'
                        });
                    }

                    req.tenant = {
                        id: emp.IdEmpresa,
                        nomeFantasia: emp.NomeFantasia || emp.RazaoSocial,
                        razaoSocial: emp.RazaoSocial,
                        plano: emp.plano || 'pro',
                        planoDetalhes: planoConfig,
                        statusPlano: emp.status_plano || 'ativo',
                        trialExpirado,
                        trialExpiraEm: emp.trial_expira_em,
                        limiteUsuarios: emp.limite_usuarios || planoConfig.limite_usuarios,
                        modulos: planoConfig.modulos
                    };
                } else {
                    // Fallback caso IdEmpresa = 1 ainda não esteja criada fisicamente
                    req.tenant = {
                        id: req.tenantId,
                        nomeFantasia: 'Empresa Principal',
                        plano: 'enterprise',
                        statusPlano: 'ativo',
                        trialExpirado: false,
                        limiteUsuarios: 9999,
                        modulos: PLANOS.enterprise.modulos
                    };
                }
            } catch (queryErr) {
                // Silently fallback para não bloquear requisições em caso de falha de conexão transitória
                req.tenant = {
                    id: req.tenantId,
                    nomeFantasia: 'Empresa ' + req.tenantId,
                    plano: 'pro',
                    statusPlano: 'ativo',
                    trialExpirado: false,
                    limiteUsuarios: 10,
                    modulos: PLANOS.pro.modulos
                };
            }
        } else {
            // Visão Global Superadmin (todas as empresas)
            req.tenant = {
                id: null,
                nomeFantasia: 'Visão Global (Todas as Empresas)',
                razaoSocial: 'Painel SuperAdmin Lynx',
                plano: 'enterprise',
                planoDetalhes: PLANOS.enterprise,
                statusPlano: 'ativo',
                trialExpirado: false,
                trialExpiraEm: null,
                limiteUsuarios: 99999,
                modulos: PLANOS.enterprise.modulos
            };
        }

        tenantStorage.run({
            tenantId: req.tenantId,
            user: req.user,
            isSuperAdmin: req.isSuperAdmin,
            isImpersonating: req.isImpersonating
        }, () => {
            next();
        });
    } catch (err) {
        console.error('Erro no tenantMiddleware:', err);
        next();
    }
}

/**
 * Exige perfil Master da Empresa ou Superadmin
 */
function requireMaster(req, res, next) {
    if (!req.isMaster && !req.isSuperAdmin) {
        return res.status(403).json({
            error: 'Permissão negada',
            message: 'Apenas o Administrador Master da empresa pode realizar esta ação.'
        });
    }
    next();
}

/**
 * Exige perfil de Superadmin global (edsonmanoel2012@gmail.com)
 */
function requireSuperAdmin(req, res, next) {
    if (!req.isSuperAdmin) {
        return res.status(403).json({
            error: 'Acesso restrito',
            message: 'Recurso exclusivo do Superadministrador da plataforma.'
        });
    }
    next();
}

/**
 * Middleware para checar se o plano da empresa tem o módulo solicitado
 */
function requirePlanModule(moduloKey) {
    return (req, res, next) => {
        if (req.isSuperAdmin) return next();

        if (req.tenant && req.tenant.modulos && !req.tenant.modulos.includes(moduloKey)) {
            return res.status(403).json({
                error: 'Módulo não disponível no seu plano',
                message: `O módulo "${moduloKey}" faz parte de um plano superior. Faça upgrade para desbloquear.`
            });
        }
        next();
    };
}

module.exports = {
    SUPERADMIN_EMAIL,
    isSuperAdminUser,
    tenantMiddleware,
    requireMaster,
    requireSuperAdmin,
    requirePlanModule
};

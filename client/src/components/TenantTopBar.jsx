import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Building2, Shield, Users, Sparkles, ChevronDown, Check, AlertCircle, ArrowRightLeft } from 'lucide-react';

const TenantTopBar = () => {
    const { user, isSuperAdmin } = useAuth();
    const [empresas, setEmpresas] = useState([]);
    const [empresaAtiva, setEmpresaAtiva] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [planoInfo, setPlanoInfo] = useState(null);

    // Carregar informações do plano da empresa atual
    useEffect(() => {
        if (!user) return;

        api.get('/empresa/meu-plano')
            .then(res => {
                if (res.data?.empresa) {
                    setPlanoInfo(res.data);
                    setEmpresaAtiva(res.data.empresa);
                }
            })
            .catch(() => {});
    }, [user]);

    // Se for Superadmin, carregar a lista de todas as empresas para o Tenant Switcher
    useEffect(() => {
        if (!isSuperAdmin) return;

        api.get('/superadmin/empresas')
            .then(res => {
                if (Array.isArray(res.data?.empresas)) {
                    setEmpresas(res.data.empresas);
                }
            })
            .catch(() => {});
    }, [isSuperAdmin]);

    const handleSwitchTenant = async (empresa) => {
        setLoading(true);
        try {
            if (!empresa) {
                // Alternar explicitamente para visão global
                api.defaults.headers['x-tenant-override'] = 'all';
                localStorage.setItem('@Lynx:tenant_override', 'all');
                window.location.reload();
                return;
            }

            // Alternar para tenant selecionado
            api.defaults.headers['x-tenant-override'] = String(empresa.IdEmpresa);
            localStorage.setItem('@Lynx:tenant_override', String(empresa.IdEmpresa));
            setEmpresaAtiva({
                id: empresa.IdEmpresa,
                nome: empresa.NomeFantasia || empresa.RazaoSocial,
                plano: empresa.plano
            });
            setIsOpen(false);
            window.location.reload();
        } catch (e) {
            console.error('Erro ao alternar empresa:', e);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    const tenantOverride = localStorage.getItem('@Lynx:tenant_override');
    const isGlobalView = tenantOverride === 'all';
    const activeTenantId = isGlobalView ? null : (tenantOverride ? Number(tenantOverride) : (empresaAtiva?.id || user?.IdEmpresa || 1));
    const activeEmp = empresas.find(e => e.IdEmpresa === activeTenantId);

    // Cálculo unificado dos dias restantes da empresa selecionada (mensalidade ou teste)
    const dataVenc = activeEmp?.data_vencimento || planoInfo?.empresa?.dataVencimento || planoInfo?.empresa?.trialExpiraEm;
    const statusPlanoEmpresa = activeEmp?.status_plano || planoInfo?.empresa?.status || 'ativo';
    const isTrial = statusPlanoEmpresa === 'trial';

    let diasRestantes = null;
    if (dataVenc) {
        const diffMs = new Date(dataVenc) - new Date();
        diasRestantes = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    } else if (typeof planoInfo?.empresa?.diasRestantes === 'number') {
        diasRestantes = planoInfo.empresa.diasRestantes;
    } else if (typeof planoInfo?.empresa?.diasRestantesTrial === 'number') {
        diasRestantes = planoInfo.empresa.diasRestantesTrial;
    }

    const isImpersonating = !!tenantOverride && tenantOverride !== 'all' && Number(tenantOverride) !== (user?.IdEmpresa || 1);
    const nomeExibicao = isGlobalView
        ? 'Visão Global (Todas as Empresas)'
        : (activeEmp?.NomeFantasia || activeEmp?.RazaoSocial || empresaAtiva?.nome || user?.empresa?.nomeFantasia || user?.empresa?.razaoSocial || 'Delta Parafusos');
    const planoNome = (empresaAtiva?.plano || user?.empresa?.plano || 'pro').toUpperCase();

    return (
        <div className="bg-slate-900 border-b border-slate-800 text-white px-3 md:px-6 py-1.5 flex items-center justify-between text-xs print:hidden z-20">
            {/* Esquerda: Identificação da Empresa e Plano */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="truncate max-w-[180px] md:max-w-xs">{nomeExibicao}</span>
                </div>

                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <Sparkles className="w-2.5 h-2.5" />
                    {planoNome}
                </span>

                {diasRestantes !== null && !isGlobalView && (
                    <span className={`hidden md:inline-flex items-center gap-1 text-[11px] font-medium ${isTrial ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {isTrial ? `⏳ ${diasRestantes} dias de teste` : `📅 Em dia (${diasRestantes} dias)`}
                    </span>
                )}
            </div>

            {/* Direita: Controles e Seletor Superadmin */}
            <div className="flex items-center gap-3">
                {isSuperAdmin && (
                    <div className="relative">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                isImpersonating
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                                    : (isGlobalView ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700')
                            }`}
                        >
                            <ArrowRightLeft className="w-3 h-3 text-blue-400" />
                            <span className="hidden sm:inline">Empresa:</span>
                            <span className="font-bold text-white max-w-[120px] truncate">{nomeExibicao}</span>
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>

                        {/* Dropdown com a lista de empresas */}
                        {isOpen && (
                            <div className="absolute right-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 text-slate-200">
                                <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-bold text-slate-400 flex items-center justify-between">
                                    <span>ALTERAR EMPRESA ATIVA</span>
                                    <span className="text-[10px] bg-red-500/20 text-red-300 px-1 rounded font-mono">SUPERADMIN</span>
                                </div>

                                <div className="max-h-60 overflow-y-auto py-1">
                                    <button
                                        onClick={() => handleSwitchTenant(null)}
                                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center justify-between transition-colors text-xs font-semibold ${
                                            isGlobalView ? 'bg-blue-600/20 text-white font-bold' : 'text-blue-300'
                                        }`}
                                    >
                                        <span>🌐 Visão Global (Todas)</span>
                                        {isGlobalView && <Check className="w-3.5 h-3.5 text-blue-400" />}
                                    </button>

                                    {empresas.map((emp) => {
                                        const isSelected = !isGlobalView && (activeTenantId === emp.IdEmpresa);
                                        return (
                                            <button
                                                key={emp.IdEmpresa}
                                                onClick={() => handleSwitchTenant(emp)}
                                                className={`w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between transition-colors text-xs ${
                                                    isSelected ? 'bg-blue-600/20 text-white font-bold' : 'text-slate-300'
                                                }`}
                                            >
                                                <div className="truncate pr-2">
                                                    <div className="truncate">{emp.NomeFantasia || emp.RazaoSocial}</div>
                                                    <div className="text-[10px] text-slate-500 font-normal">
                                                        Plano: {emp.plano?.toUpperCase()} • {emp.total_usuarios || 1} usuários
                                                    </div>
                                                </div>
                                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Usuário Master da Empresa */}
                {user?.is_master && !isSuperAdmin && (
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Admin Master
                    </span>
                )}
            </div>
        </div>
    );
};

export default TenantTopBar;

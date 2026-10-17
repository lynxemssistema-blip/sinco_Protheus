import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { 
    Building2, Users, ShieldAlert, Sparkles, ExternalLink, 
    ArrowRightLeft, Edit, CheckCircle, XCircle, Search, RefreshCw 
} from 'lucide-react';

const SuperadminEmpresas = () => {
    const { isSuperAdmin } = useAuth();
    const [empresas, setEmpresas] = useState([]);
    const [metricas, setMetricas] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState('');
    
    // Modal de edição de plano
    const [selectedEmpresa, setSelectedEmpresa] = useState(null);
    const [novoPlano, setNovoPlano] = useState('pro');
    const [novoStatus, setNovoStatus] = useState('ativo');
    const [novoLimite, setNovoLimite] = useState(10);
    const [diasExtensao, setDiasExtensao] = useState('');
    const [salvando, setSalvando] = useState(false);

    const carregarDados = async () => {
        setLoading(true);
        try {
            const [empRes, metRes] = await Promise.all([
                api.get('/superadmin/empresas'),
                api.get('/superadmin/metricas')
            ]);
            setEmpresas(empRes.data?.empresas || []);
            setMetricas(metRes.data?.metricas || null);
        } catch (err) {
            console.error('Erro ao carregar dados do superadmin:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) {
            carregarDados();
        }
    }, [isSuperAdmin]);

    const handleImpersonate = async (empresa) => {
        try {
            const res = await api.get(`/superadmin/impersonate/${empresa.IdEmpresa}`);
            if (res.data?.token) {
                localStorage.setItem('@Lynx:token', res.data.token);
                localStorage.setItem('@Lynx:tenant_override', String(empresa.IdEmpresa));
                api.defaults.headers.Authorization = `Bearer ${res.data.token}`;
                api.defaults.headers['x-tenant-override'] = empresa.IdEmpresa;
                alert(`Acessando como ${empresa.NomeFantasia || empresa.RazaoSocial}. Você agora está visualizando o sistema sob o contexto desta empresa.`);
                window.location.href = '/dashboard';
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao realizar impersonation');
        }
    };

    const handleSalvarPlano = async (e) => {
        e.preventDefault();
        if (!selectedEmpresa) return;

        setSalvando(true);
        try {
            await api.patch(`/superadmin/empresas/${selectedEmpresa.IdEmpresa}`, {
                plano: novoPlano,
                status_plano: novoStatus,
                limite_usuarios: parseInt(novoLimite) || 10,
                estender_dias_trial: diasExtensao ? parseInt(diasExtensao) : undefined
            });
            setSelectedEmpresa(null);
            carregarDados();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao atualizar plano');
        } finally {
            setSalvando(false);
        }
    };

    if (!isSuperAdmin) {
        return (
            <div className="p-12 text-center">
                <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h1 className="text-xl font-bold text-slate-800">Acesso Restrito ao Superadministrador</h1>
                <p className="text-sm text-slate-500 mt-1">Este painel é exclusivo para edsonmanoel2012@gmail.com.</p>
            </div>
        );
    }

    const empresasFiltradas = empresas.filter(e => {
        const query = busca.toLowerCase();
        return (
            (e.NomeFantasia || '').toLowerCase().includes(query) ||
            (e.RazaoSocial || '').toLowerCase().includes(query) ||
            (e.responsavel_email || '').toLowerCase().includes(query) ||
            (e.responsavel_nome || '').toLowerCase().includes(query)
        );
    });

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
                <div>
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
                        <Sparkles className="w-4 h-4" />
                        <span>Controle Supremo da Plataforma</span>
                    </div>
                    <h1 className="text-2xl font-black flex items-center gap-2.5">
                        <Building2 className="w-7 h-7 text-blue-400" />
                        Painel Global de Empresas & Planos
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Visão de todas as empresas registradas no ecossistema, planos ativos e suporte com impersonation.
                    </p>
                </div>

                <button
                    onClick={carregarDados}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    <span>Atualizar Métricas</span>
                </button>
            </div>

            {/* Cards de Métricas Gerais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Empresas</div>
                    <div className="text-3xl font-black text-slate-900 mt-2">{metricas?.totalEmpresas || empresas.length}</div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Usuários</div>
                    <div className="text-3xl font-black text-blue-600 mt-2">{metricas?.totalUsuarios || 0}</div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Planos Ativos</div>
                    <div className="text-sm font-semibold text-slate-700 mt-2 space-y-0.5">
                        {metricas?.distribuicaoPlanos?.map(p => (
                            <div key={p.plano} className="flex justify-between">
                                <span className="uppercase text-[11px] font-bold text-slate-500">{p.plano || 'Pro'}:</span>
                                <span className="font-bold text-slate-800">{p.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status das Contas</div>
                    <div className="text-sm font-semibold text-slate-700 mt-2 space-y-0.5">
                        {metricas?.distribuicaoStatus?.map(s => (
                            <div key={s.status_plano} className="flex justify-between">
                                <span className="uppercase text-[11px] font-bold text-slate-500">{s.status_plano || 'Ativo'}:</span>
                                <span className="font-bold text-slate-800">{s.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Barra de Busca */}
            <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                <input
                    type="text"
                    placeholder="Buscar empresa por nome, razão social ou e-mail do responsável..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                />
            </div>

            {/* Tabela de Empresas */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 font-bold text-slate-900 text-sm flex items-center justify-between">
                    <span>Empresas Registradas ({empresasFiltradas.length})</span>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-400 text-sm">Carregando lista de empresas...</div>
                ) : empresasFiltradas.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">Nenhuma empresa encontrada com os filtros informados.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-3">ID / Empresa</th>
                                    <th className="px-6 py-3">Responsável Master</th>
                                    <th className="px-6 py-3">Plano & Limite</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Ações de Suporte</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                {empresasFiltradas.map((e) => {
                                    const isAtivo = e.status_plano === 'ativo';
                                    const isTrial = e.status_plano === 'trial';

                                    return (
                                        <tr key={e.IdEmpresa} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-3.5">
                                                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                                    <span className="text-slate-400 font-mono text-xs">#{e.IdEmpresa}</span>
                                                    <span>{e.NomeFantasia || e.RazaoSocial}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-400">
                                                    {e.Segmento || 'Indústria'} • {e.Cnpj || 'CNPJ não inf.'}
                                                </div>
                                            </td>

                                            <td className="px-6 py-3.5">
                                                <div className="font-semibold text-slate-800">{e.responsavel_nome || 'Fundador'}</div>
                                                <div className="text-[11px] text-slate-400">{e.responsavel_email || e.Email}</div>
                                            </td>

                                            <td className="px-6 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                                                        {e.plano || 'Pro'}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-medium">
                                                        {e.total_usuarios || 1} / {e.limite_usuarios || 10} users
                                                    </span>
                                                </div>
                                                {isTrial && e.trial_expira_em && (
                                                    <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
                                                        Trial até: {new Date(e.trial_expira_em).toLocaleDateString('pt-BR')}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-6 py-3.5">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                    isAtivo ? 'bg-emerald-50 text-emerald-700' : isTrial ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                                                }`}>
                                                    {isAtivo ? 'Ativo' : isTrial ? 'Trial 14d' : 'Bloqueado'}
                                                </span>
                                            </td>

                                            <td className="px-6 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedEmpresa(e);
                                                            setNovoPlano(e.plano || 'pro');
                                                            setNovoStatus(e.status_plano || 'ativo');
                                                            setNovoLimite(e.limite_usuarios || 10);
                                                            setDiasExtensao('');
                                                        }}
                                                        title="Editar plano e limites"
                                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>

                                                    <button
                                                        onClick={() => handleImpersonate(e)}
                                                        title="Acessar como esta Empresa (Impersonate)"
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors"
                                                    >
                                                        <ArrowRightLeft className="w-3.5 h-3.5" />
                                                        <span>Acessar</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Edição de Plano */}
            {selectedEmpresa && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">Gerenciar Plano & Acesso</h3>
                                <p className="text-xs text-slate-500">{selectedEmpresa.NomeFantasia || selectedEmpresa.RazaoSocial}</p>
                            </div>
                            <button onClick={() => setSelectedEmpresa(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
                        </div>

                        <form onSubmit={handleSalvarPlano} className="space-y-4 mt-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Plano da Licença</label>
                                <select
                                    value={novoPlano}
                                    onChange={(e) => setNovoPlano(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none bg-white font-medium"
                                >
                                    <option value="starter">Starter (Até 3 Usuários - Comercial)</option>
                                    <option value="pro">Pro (Até 10 Usuários - PCP & Produção)</option>
                                    <option value="enterprise">Enterprise (Ilimitado - Nesting DXF & IA)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Status da Conta</label>
                                    <select
                                        value={novoStatus}
                                        onChange={(e) => setNovoStatus(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none bg-white font-medium"
                                    >
                                        <option value="ativo">Ativo (Normal)</option>
                                        <option value="trial">Trial (Período de Teste)</option>
                                        <option value="bloqueado">Bloqueado (Inadimplente)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Limite de Usuários</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="99999"
                                        value={novoLimite}
                                        onChange={(e) => setNovoLimite(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Estender Período de Teste (+ Dias)</label>
                                <input
                                    type="number"
                                    placeholder="Ex: 14 (adiciona 14 dias ao trial)"
                                    value={diasExtensao}
                                    onChange={(e) => setDiasExtensao(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-medium"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setSelectedEmpresa(null)}
                                    className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={salvando}
                                    className="px-5 py-2 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all"
                                >
                                    {salvando ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperadminEmpresas;

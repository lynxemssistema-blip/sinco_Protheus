import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { 
    Building2, Users, ShieldAlert, Sparkles, ExternalLink, 
    ArrowRightLeft, Edit, CheckCircle, XCircle, Search, RefreshCw,
    Calendar, DollarSign, Clock, AlertTriangle, Check, Power,
    ShieldCheck, Lock, Unlock, Mail, Phone, Hash, MessageSquare, Copy
} from 'lucide-react';

const SuperadminEmpresas = () => {
    const { isSuperAdmin } = useAuth();
    const [empresas, setEmpresas] = useState([]);
    const [metricas, setMetricas] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos', 'ativas', 'desativadas', 'vencendo', 'vencidas'
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [feedbackMsg, setFeedbackMsg] = useState(null);

    // Modal de gerenciamento completo
    const [selectedEmpresa, setSelectedEmpresa] = useState(null);
    const [formAtiva, setFormAtiva] = useState(true);
    const [formDataVencimento, setFormDataVencimento] = useState('');
    const [formValorMensalidade, setFormValorMensalidade] = useState('');
    const [formMotivoBloqueio, setFormMotivoBloqueio] = useState('');
    const [formPlano, setFormPlano] = useState('pro');
    const [formStatusPlano, setFormStatusPlano] = useState('ativo');
    const [formLimiteUsuarios, setFormLimiteUsuarios] = useState(10);
    const [formEvolutionAtivo, setFormEvolutionAtivo] = useState(false);
    const [formEvolutionInstancia, setFormEvolutionInstancia] = useState('Suporte Lynx');
    const [formEvolutionApiKey, setFormEvolutionApiKey] = useState('');
    const [formEvolutionUrl, setFormEvolutionUrl] = useState('');
    const [evoStatus, setEvoStatus] = useState(null);
    const [verificandoEvo, setVerificandoEvo] = useState(false);
    const [copiadoWebhook, setCopiadoWebhook] = useState(false);
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
            mostrarFeedback('Erro ao carregar dados de empresas e métricas.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) {
            carregarDados();
        }
    }, [isSuperAdmin]);

    const mostrarFeedback = (texto, tipo = 'success') => {
        setFeedbackMsg({ texto, tipo });
        setTimeout(() => setFeedbackMsg(null), 4000);
    };

    // Alternar ativa/desativada com 1 clique
    const handleToggleAtiva = async (empresa) => {
        const novoStatus = empresa.ativa ? 'desativar' : 'ativar';
        if (!window.confirm(`Deseja realmente ${novoStatus} a empresa "${empresa.NomeFantasia || empresa.RazaoSocial}"? ${empresa.ativa ? 'Usuários comuns não conseguirão acessar.' : 'Os usuários voltarão a ter acesso normal.'}`)) {
            return;
        }

        setActionLoadingId(empresa.IdEmpresa);
        try {
            const res = await api.post(`/superadmin/empresas/${empresa.IdEmpresa}/toggle-status`);
            const novaAtiva = res.data?.ativa;
            
            setEmpresas(prev => prev.map(e => {
                if (e.IdEmpresa === empresa.IdEmpresa) {
                    return { 
                        ...e, 
                        ativa: novaAtiva ? 1 : 0, 
                        status_plano: res.data?.status_plano || (novaAtiva ? 'ativo' : 'bloqueado') 
                    };
                }
                return e;
            }));

            mostrarFeedback(novaAtiva ? `Empresa "${empresa.NomeFantasia || empresa.RazaoSocial}" ativada!` : `Empresa "${empresa.NomeFantasia || empresa.RazaoSocial}" desativada!`);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao alterar ativação da empresa.');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Revalidar assinatura (+30 dias) com 1 clique
    const handleRevalidarRapido = async (empresa, dias = 30) => {
        setActionLoadingId(empresa.IdEmpresa);
        try {
            const res = await api.post(`/superadmin/empresas/${empresa.IdEmpresa}/revalidar`, { dias });
            const novaData = res.data?.data_vencimento;

            setEmpresas(prev => prev.map(e => {
                if (e.IdEmpresa === empresa.IdEmpresa) {
                    return { 
                        ...e, 
                        data_vencimento: novaData, 
                        ativa: 1, 
                        status_plano: 'ativo' 
                    };
                }
                return e;
            }));

            mostrarFeedback(`Assinatura de "${empresa.NomeFantasia || empresa.RazaoSocial}" revalidada por +${dias} dias! Vencimento: ${new Date(novaData).toLocaleDateString('pt-BR')}`);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao revalidar assinatura.');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Acessar empresa como Superadmin
    const handleImpersonate = async (empresa) => {
        try {
            const res = await api.get(`/superadmin/impersonate/${empresa.IdEmpresa}`);
            if (res.data?.token) {
                localStorage.setItem('@Lynx:token', res.data.token);
                localStorage.setItem('@Lynx:tenant_override', String(empresa.IdEmpresa));
                api.defaults.headers.Authorization = `Bearer ${res.data.token}`;
                api.defaults.headers['x-tenant-override'] = empresa.IdEmpresa;
                alert(`Acessando como ${empresa.NomeFantasia || empresa.RazaoSocial}. Você agora está visualizando o sistema sob o contexto desta empresa.`);
                window.location.href = '/visao-geral';
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao realizar impersonation');
        }
    };

    // Alternar Evolution API ativa/inativa com 1 clique direto na tabela
    const handleToggleEvolution = async (empresa) => {
        setActionLoadingId(`evo_${empresa.IdEmpresa}`);
        try {
            const res = await api.post(`/superadmin/empresas/${empresa.IdEmpresa}/evolution-toggle`);
            const novoAtivo = res.data?.evolution_ativo;

            setEmpresas(prev => prev.map(e => {
                if (e.IdEmpresa === empresa.IdEmpresa) {
                    return {
                        ...e,
                        evolution_ativo: novoAtivo,
                        evolution_instancia: res.data?.evolution_instancia || e.evolution_instancia
                    };
                }
                return e;
            }));

            mostrarFeedback(
                novoAtivo === 1
                    ? `WhatsApp / Evolution API ativado para "${empresa.NomeFantasia || empresa.RazaoSocial}"!`
                    : `WhatsApp / Evolution API desativado para "${empresa.NomeFantasia || empresa.RazaoSocial}".`
            );
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao alterar status da Evolution API.');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Consultar status de conexão em tempo real na Evolution API
    const consultarStatusEvolution = async (empresaId) => {
        setVerificandoEvo(true);
        try {
            const res = await api.get(`/superadmin/empresas/${empresaId}/evolution-status`);
            setEvoStatus(res.data);
        } catch (err) {
            setEvoStatus({ success: false, state: 'error', message: 'Erro ao conectar na Evolution API' });
        } finally {
            setVerificandoEvo(false);
        }
    };

    // Abrir modal de edição
    const handleAbrirEdicao = (empresa) => {
        setSelectedEmpresa(empresa);
        setFormAtiva(empresa.ativa === 1);
        setFormDataVencimento(empresa.data_vencimento ? empresa.data_vencimento.split('T')[0] : '');
        setFormValorMensalidade(empresa.valor_mensalidade || '0.00');
        setFormMotivoBloqueio(empresa.motivo_bloqueio || '');
        setFormPlano(empresa.plano || 'pro');
        setFormStatusPlano(empresa.status_plano || 'ativo');
        setFormLimiteUsuarios(empresa.limite_usuarios || 10);
        setFormEvolutionAtivo(empresa.evolution_ativo === 1);
        setFormEvolutionInstancia(empresa.evolution_instancia || 'Suporte Lynx');
        setFormEvolutionApiKey(empresa.evolution_apikey || '');
        setFormEvolutionUrl(empresa.evolution_url || '');
        setEvoStatus(null);
        consultarStatusEvolution(empresa.IdEmpresa);
    };

    // Salvar alterações detalhadas do modal
    const handleSalvarEdicao = async (e) => {
        e.preventDefault();
        if (!selectedEmpresa) return;

        setSalvando(true);
        try {
            await api.patch(`/superadmin/empresas/${selectedEmpresa.IdEmpresa}`, {
                ativa: formAtiva ? 1 : 0,
                data_vencimento: formDataVencimento || null,
                valor_mensalidade: parseFloat(formValorMensalidade) || 0.00,
                motivo_bloqueio: formMotivoBloqueio || null,
                plano: formPlano,
                status_plano: formStatusPlano,
                limite_usuarios: parseInt(formLimiteUsuarios) || 10,
                evolution_ativo: formEvolutionAtivo ? 1 : 0,
                evolution_instancia: formEvolutionInstancia || 'Suporte Lynx',
                evolution_apikey: formEvolutionApiKey ? formEvolutionApiKey.trim() : null,
                evolution_url: formEvolutionUrl ? formEvolutionUrl.trim() : null
            });

            setSelectedEmpresa(null);
            mostrarFeedback('Dados da empresa, assinatura e Evolution API atualizados com sucesso!');
            carregarDados();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao salvar alterações da empresa');
        } finally {
            setSalvando(false);
        }
    };

    // Atalho para adicionar dias no modal
    const adicionarDiasAoVencimento = (dias) => {
        const base = formDataVencimento ? new Date(formDataVencimento) : new Date();
        base.setDate(base.getDate() + dias);
        setFormDataVencimento(base.toISOString().split('T')[0]);
    };

    // Cálculo do status da assinatura
    const calcularStatusAssinatura = (empresa) => {
        const isDesativada = empresa.ativa === 0 || empresa.status_plano === 'bloqueado' || empresa.status_plano === 'inativo';
        if (isDesativada) {
            return {
                tipo: 'desativada',
                texto: 'Desativada',
                badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
                diasRestantes: null
            };
        }

        if (!empresa.data_vencimento) {
            return {
                tipo: 'sem_vencimento',
                texto: 'Sem data de vencimento',
                badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
                diasRestantes: null
            };
        }

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const venc = new Date(empresa.data_vencimento);
        venc.setHours(0, 0, 0, 0);

        const diffTime = venc.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return {
                tipo: 'vencida',
                texto: `Vencida há ${Math.abs(diffDays)} dia(s)`,
                badgeClass: 'bg-red-100 text-red-800 border-red-300 font-bold',
                diasRestantes: diffDays
            };
        } else if (diffDays <= 5) {
            return {
                tipo: 'vencendo',
                texto: diffDays === 0 ? 'Vence HOJE' : `Vence em ${diffDays} dia(s)`,
                badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
                diasRestantes: diffDays
            };
        } else {
            return {
                tipo: 'em_dia',
                texto: `Em dia (${diffDays} dias)`,
                badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                diasRestantes: diffDays
            };
        }
    };

    if (!isSuperAdmin) {
        return (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                <h1 className="text-xl font-bold text-slate-800">Acesso Restrito ao Superadministrador</h1>
                <p className="text-sm text-slate-500 mt-1">Este painel de gestão de empresas e cobrança de assinaturas é exclusivo para o Superadmin da plataforma.</p>
            </div>
        );
    }

    const empresasFiltradas = empresas.filter(e => {
        const query = busca.toLowerCase();
        const matchBusca = 
            (e.NomeFantasia || '').toLowerCase().includes(query) ||
            (e.RazaoSocial || '').toLowerCase().includes(query) ||
            (e.Cnpj || '').toLowerCase().includes(query) ||
            (e.responsavel_email || '').toLowerCase().includes(query) ||
            (e.responsavel_nome || '').toLowerCase().includes(query) ||
            String(e.IdEmpresa).includes(query);

        if (!matchBusca) return false;

        const statusAssinatura = calcularStatusAssinatura(e);
        if (filtroStatus === 'ativas') return e.ativa === 1;
        if (filtroStatus === 'desativadas') return e.ativa === 0;
        if (filtroStatus === 'vencendo') return statusAssinatura.tipo === 'vencendo';
        if (filtroStatus === 'vencidas') return statusAssinatura.tipo === 'vencida';

        return true;
    });

    return (
        <div className="space-y-6">
            {/* Notificação Toast */}
            {feedbackMsg && (
                <div className={`p-4 rounded-xl text-xs font-bold shadow-md flex items-center justify-between border ${
                    feedbackMsg.tipo === 'error' 
                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}>
                    <div className="flex items-center gap-2">
                        {feedbackMsg.tipo === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        <span>{feedbackMsg.texto}</span>
                    </div>
                    <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
                </div>
            )}

            {/* Header Superadmin */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-700">
                <div>
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
                        <Sparkles className="w-4 h-4" />
                        <span>Aba Exclusiva do Superadministrador</span>
                    </div>
                    <h1 className="text-2xl font-black flex items-center gap-2.5">
                        <Building2 className="w-7 h-7 text-blue-400" />
                        Gestão de Empresas & Assinaturas Mensais
                    </h1>
                    <p className="text-xs text-slate-300 mt-1">
                        Controle central de todas as empresas clientes do sistema, status de ativação, renovação de mensalidades e acesso rápido.
                    </p>
                </div>

                <button
                    onClick={carregarDados}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold transition-all shadow-sm"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span>Atualizar Dados</span>
                </button>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Empresas</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{metricas?.totalEmpresas || empresas.length}</div>
                    <span className="text-[10px] text-slate-500 font-medium">{metricas?.totalUsuarios || 0} usuários cadastrados</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Empresas Ativas</div>
                    <div className="text-2xl font-black text-emerald-600 mt-1">
                        {metricas?.empresasAtivas ?? empresas.filter(e => e.ativa === 1).length}
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium">Acesso normal liberado</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Desativadas</div>
                    <div className="text-2xl font-black text-rose-600 mt-1">
                        {metricas?.empresasDesativadas ?? empresas.filter(e => e.ativa === 0).length}
                    </div>
                    <span className="text-[10px] text-rose-700 font-medium">Acesso bloqueado</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Vencendo em 7d</div>
                    <div className="text-2xl font-black text-amber-600 mt-1">
                        {metricas?.vencendoEmBreve ?? 0}
                    </div>
                    <span className="text-[10px] text-amber-700 font-medium">Cobrança próxima</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Assinatura Vencida</div>
                    <div className="text-2xl font-black text-red-700 mt-1">
                        {metricas?.vencidas ?? 0}
                    </div>
                    <span className="text-[10px] text-red-600 font-medium">Aguardando renovação</span>
                </div>
            </div>

            {/* Barra de Filtros e Busca */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                        type="text"
                        placeholder="Buscar por nome da empresa, razão social, CNPJ, e-mail do responsável..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-xs"
                    />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setFiltroStatus('todos')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filtroStatus === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Todas ({empresas.length})
                    </button>
                    <button
                        onClick={() => setFiltroStatus('ativas')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filtroStatus === 'ativas' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Ativas
                    </button>
                    <button
                        onClick={() => setFiltroStatus('desativadas')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filtroStatus === 'desativadas' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Desativadas
                    </button>
                    <button
                        onClick={() => setFiltroStatus('vencendo')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filtroStatus === 'vencendo' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        A Vencer
                    </button>
                    <button
                        onClick={() => setFiltroStatus('vencidas')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filtroStatus === 'vencidas' ? 'bg-white text-red-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Vencidas
                    </button>
                </div>
            </div>

            {/* Tabela de Empresas */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 font-bold text-slate-900 text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <span>Empresas Registradas</span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                            {empresasFiltradas.length}
                        </span>
                    </span>
                    <span className="text-xs text-slate-400 font-normal">
                        O Superadmin pode reativar ou estender vencimento a qualquer momento
                    </span>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-400 text-xs">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                        Carregando empresas cadastradas...
                    </div>
                ) : empresasFiltradas.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs">
                        Nenhuma empresa encontrada com os critérios informados.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-3.5">ID / Empresa</th>
                                    <th className="px-6 py-3.5">Responsável Master</th>
                                    <th className="px-6 py-3.5 text-center">Status de Acesso</th>
                                    <th className="px-6 py-3.5 text-center">WhatsApp (Evo API)</th>
                                    <th className="px-6 py-3.5">Vencimento da Mensalidade</th>
                                    <th className="px-6 py-3.5">Plano & Valor</th>
                                    <th className="px-6 py-3.5 text-right">Ações de Gestão</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                {empresasFiltradas.map((e) => {
                                    const statusAssinatura = calcularStatusAssinatura(e);
                                    const isAtiva = e.ativa === 1;
                                    const isRowLoading = actionLoadingId === e.IdEmpresa;

                                    return (
                                        <tr key={e.IdEmpresa} className={`hover:bg-slate-50/80 transition-colors ${!isAtiva ? 'bg-rose-50/20' : ''}`}>
                                            {/* Empresa */}
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                                    <span className="text-slate-400 font-mono text-xs">#{e.IdEmpresa}</span>
                                                    <span>{e.NomeFantasia || e.RazaoSocial}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-0.5">
                                                    {e.RazaoSocial !== e.NomeFantasia && <span className="block">{e.RazaoSocial}</span>}
                                                    <span>{e.Segmento || 'Indústria'}</span>
                                                    {e.Cnpj && <span> • CNPJ: {e.Cnpj}</span>}
                                                </div>
                                            </td>

                                            {/* Responsável */}
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-800">{e.responsavel_nome || 'Fundador Master'}</div>
                                                <div className="text-[11px] text-slate-400 mt-0.5 flex flex-col gap-0.5">
                                                    {e.responsavel_email && (
                                                        <span className="flex items-center gap-1">
                                                             <Mail className="w-3 h-3 text-slate-400" />
                                                            {e.responsavel_email}
                                                        </span>
                                                    )}
                                                    {e.Telefone && (
                                                        <span className="flex items-center gap-1 text-[10px]">
                                                            <Phone className="w-2.5 h-2.5 text-slate-400" />
                                                            {e.Telefone}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status de Acesso (Toggle Switch) */}
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleToggleAtiva(e)}
                                                        disabled={isRowLoading}
                                                        title={isAtiva ? 'Clique para desativar esta empresa' : 'Clique para ativar esta empresa'}
                                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                            isAtiva ? 'bg-emerald-500' : 'bg-slate-300'
                                                        } ${isRowLoading ? 'opacity-50 cursor-wait' : ''}`}
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                                isAtiva ? 'translate-x-5' : 'translate-x-0'
                                                            }`}
                                                        />
                                                    </button>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                        isAtiva ? 'text-emerald-700' : 'text-rose-600'
                                                    }`}>
                                                        {isAtiva ? 'Ativa' : 'Desativada'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* WhatsApp / Evolution API Toggle */}
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleEvolution(e)}
                                                        disabled={actionLoadingId === `evo_${e.IdEmpresa}`}
                                                        title={e.evolution_ativo === 1 ? 'Clique para desativar o WhatsApp (Evolution API)' : 'Clique para ativar o WhatsApp (Evolution API)'}
                                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                            e.evolution_ativo === 1 ? 'bg-emerald-600' : 'bg-slate-300'
                                                        } ${actionLoadingId === `evo_${e.IdEmpresa}` ? 'opacity-50 cursor-wait' : ''}`}
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                                e.evolution_ativo === 1 ? 'translate-x-5' : 'translate-x-0'
                                                            }`}
                                                        />
                                                    </button>
                                                    <span className={`text-[10px] font-bold tracking-wider flex items-center gap-1 ${
                                                        e.evolution_ativo === 1 ? 'text-emerald-700' : 'text-slate-400'
                                                    }`}>
                                                        <MessageSquare className="w-3 h-3" />
                                                        <span>{e.evolution_ativo === 1 ? (e.evolution_instancia || 'Suporte Lynx') : 'Desativado'}</span>
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Vencimento da Mensalidade */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>
                                                        {e.data_vencimento 
                                                            ? new Date(e.data_vencimento).toLocaleDateString('pt-BR') 
                                                            : 'Não definido'}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${statusAssinatura.badgeClass}`}>
                                                        {statusAssinatura.texto}
                                                    </span>
                                                    {/* Botão rápido +30 dias */}
                                                    <button
                                                        onClick={() => handleRevalidarRapido(e, 30)}
                                                        disabled={isRowLoading}
                                                        title="Prorrogar assinatura por +30 dias"
                                                        className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] border border-blue-200 transition-colors"
                                                    >
                                                        +30 dias
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Plano & Valor */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                                                        {e.plano || 'Pro'}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-medium">
                                                        {e.total_usuarios || 1}/{e.limite_usuarios || 10} users
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-1">
                                                    <DollarSign className="w-3 h-3 text-emerald-600" />
                                                    <span>R$ {parseFloat(e.valor_mensalidade || 0).toFixed(2)}/mês</span>
                                                </div>
                                            </td>

                                            {/* Ações */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleAbrirEdicao(e)}
                                                        title="Editar assinatura, mensalidade, vencimento e plano"
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                                                    >
                                                        <Edit className="w-3.5 h-3.5 text-slate-500" />
                                                        <span>Gerenciar</span>
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

            {/* Modal de Gestão Completa da Empresa e Assinatura */}
            {selectedEmpresa && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-blue-600" />
                                    Gerenciar Assinatura & Acesso
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {selectedEmpresa.NomeFantasia || selectedEmpresa.RazaoSocial} (ID #{selectedEmpresa.IdEmpresa})
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedEmpresa(null)} 
                                className="text-slate-400 hover:text-slate-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSalvarEdicao} className="space-y-4 mt-4 text-xs">
                            {/* Toggle Ativação Geral */}
                            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                                <div>
                                    <span className="font-bold text-slate-800 block text-xs">Status da Empresa no Sistema</span>
                                    <span className="text-[11px] text-slate-500">
                                        {formAtiva 
                                            ? 'Empresa ATIVA: todos os colaboradores conseguem fazer login normalmente.' 
                                            : 'Empresa DESATIVADA: o login de colaboradores comuns será bloqueado.'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormAtiva(!formAtiva)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        formAtiva ? 'bg-emerald-500' : 'bg-slate-300'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                            formAtiva ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Configuração da Evolution API (WhatsApp) */}
                            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                                            <MessageSquare className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-900 block text-xs">WhatsApp (Evolution API)</span>
                                            <span className="text-[11px] text-slate-500">
                                                Ativar envio de mensagens e automações via WhatsApp para esta empresa
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormEvolutionAtivo(!formEvolutionAtivo)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            formEvolutionAtivo ? 'bg-emerald-600' : 'bg-slate-300'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                formEvolutionAtivo ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {formEvolutionAtivo && (
                                    <div className="space-y-3 pt-2 border-t border-emerald-200/60">
                                        <div>
                                            <label className="block font-bold text-slate-700 mb-1">Nome da Instância</label>
                                            <input
                                                type="text"
                                                value={formEvolutionInstancia}
                                                onChange={(e) => setFormEvolutionInstancia(e.target.value)}
                                                placeholder="Ex: Suporte Lynx"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-medium bg-white focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>

                                        {/* Status da Conexão em Tempo Real */}
                                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-semibold text-slate-600">Status no WhatsApp:</span>
                                                {verificandoEvo ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                                        <RefreshCw className="w-3 h-3 animate-spin" /> Verificando...
                                                    </span>
                                                ) : evoStatus?.state === 'open' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        <Check className="w-3 h-3" /> Conectado (open)
                                                    </span>
                                                ) : evoStatus?.state === 'connecting' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                        <RefreshCw className="w-3 h-3 animate-spin" /> Conectando...
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                                        {evoStatus?.state || 'Desconectado'}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => consultarStatusEvolution(selectedEmpresa.IdEmpresa)}
                                                disabled={verificandoEvo}
                                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1 transition-colors"
                                            >
                                                <RefreshCw className={`w-3 h-3 ${verificandoEvo ? 'animate-spin' : ''}`} />
                                                Testar
                                            </button>
                                        </div>

                                        {/* URL do Webhook Pronta para Copiar */}
                                        <div className="p-2.5 rounded-lg bg-slate-900 text-slate-200">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">URL do Webhook (Cole na Evolution API)</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText('https://lynxems.com.br/api/webhook');
                                                        setCopiadoWebhook(true);
                                                        setTimeout(() => setCopiadoWebhook(false), 2500);
                                                    }}
                                                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                                >
                                                    {copiadoWebhook ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                    {copiadoWebhook ? 'Copiado!' : 'Copiar URL'}
                                                </button>
                                            </div>
                                            <div className="font-mono text-[11px] text-emerald-400 break-all select-all">
                                                https://lynxems.com.br/api/webhook
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Data de Vencimento com Atalhos */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                                    <span>Data de Vencimento da Assinatura</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Renovação mensal</span>
                                </label>
                                <input
                                    type="date"
                                    value={formDataVencimento}
                                    onChange={(e) => setFormDataVencimento(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-medium bg-white focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[11px] text-slate-500 font-semibold">Atalhos:</span>
                                    <button
                                        type="button"
                                        onClick={() => adicionarDiasAoVencimento(30)}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors"
                                    >
                                        +30 dias
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => adicionarDiasAoVencimento(60)}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors"
                                    >
                                        +60 dias
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => adicionarDiasAoVencimento(365)}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors"
                                    >
                                        +1 ano
                                    </button>
                                </div>
                            </div>

                            {/* Valor da Mensalidade e Limite de Usuários */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Valor da Mensalidade (R$)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400 font-bold">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formValorMensalidade}
                                            onChange={(e) => setFormValorMensalidade(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl outline-none font-medium bg-white focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Limite de Usuários</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="99999"
                                        value={formLimiteUsuarios}
                                        onChange={(e) => setFormLimiteUsuarios(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-medium bg-white focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Plano e Status do Plano */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Plano da Licença</label>
                                    <select
                                        value={formPlano}
                                        onChange={(e) => setFormPlano(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none bg-white font-medium"
                                    >
                                        <option value="starter">Starter (Até 3 Usuários)</option>
                                        <option value="pro">Pro (Até 10 Usuários)</option>
                                        <option value="enterprise">Enterprise (Ilimitado)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Status Interno</label>
                                    <select
                                        value={formStatusPlano}
                                        onChange={(e) => setFormStatusPlano(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none bg-white font-medium"
                                    >
                                        <option value="ativo">Ativo</option>
                                        <option value="trial">Trial (Período de Teste)</option>
                                        <option value="bloqueado">Bloqueado</option>
                                    </select>
                                </div>
                            </div>

                            {/* Motivo do Bloqueio / Mensagem ao Usuário */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                                    <span>Mensagem Personalizada de Bloqueio (Opcional)</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Visível na tela de login</span>
                                </label>
                                <textarea
                                    rows="2"
                                    value={formMotivoBloqueio}
                                    onChange={(e) => setFormMotivoBloqueio(e.target.value)}
                                    placeholder="Ex: Mensalidade de Outubro pendente. Entre em contato pelo WhatsApp (11) 99999-9999 para liberação."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none font-medium bg-white focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-[10px] text-slate-400 block mt-1">
                                    Se preenchido, esta mensagem específica será exibida para os usuários da empresa ao tentarem fazer login.
                                </span>
                            </div>

                            {/* Botões do Rodapé */}
                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setSelectedEmpresa(null)}
                                    className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={salvando}
                                    className="px-5 py-2 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all flex items-center gap-1.5"
                                >
                                    {salvando ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Salvando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Salvar Alterações</span>
                                        </>
                                    )}
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

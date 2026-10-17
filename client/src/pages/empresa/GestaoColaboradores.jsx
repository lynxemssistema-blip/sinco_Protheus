import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { 
    Users, UserPlus, Shield, Sparkles, Building2, CheckCircle2, 
    XCircle, Trash2, Key, AlertTriangle, RefreshCw, Copy, Check,
    Clock, Send, MessageSquare, ShieldCheck, UserCheck, ExternalLink
} from 'lucide-react';

const GestaoColaboradores = () => {
    const { user, isSuperAdmin } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [planoInfo, setPlanoInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    
    // Form state (manual)
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [login, setLogin] = useState('');
    const [senha, setSenha] = useState('');
    const [telefone, setTelefone] = useState('');
    const [tipoUsuario, setTipoUsuario] = useState('operador');
    const [formLoading, setFormLoading] = useState(false);
    const [feedback, setFeedback] = useState({ error: '', success: '' });

    // Código de Segurança (WhatsApp 30min)
    const [modalCodigoOpen, setModalCodigoOpen] = useState(false);
    const [codigosConvite, setCodigosConvite] = useState([]);
    const [codigoGerado, setCodigoGerado] = useState(null);
    const [conviteTelefone, setConviteTelefone] = useState('');
    const [conviteCargo, setConviteCargo] = useState('operador');
    const [gerandoCodigo, setGerandoCodigo] = useState(false);
    const [copiado, setCopiado] = useState(false);

    const carregarCodigos = async () => {
        try {
            const res = await api.get('/empresa/codigos-convite');
            setCodigosConvite(res.data?.codigos || []);
        } catch (e) {
            console.warn('Nota ao buscar códigos:', e.message);
        }
    };

    const carregarDados = async () => {
        setLoading(true);
        try {
            const [usersRes, planoRes] = await Promise.all([
                api.get('/empresa/usuarios'),
                api.get('/empresa/meu-plano')
            ]);
            setUsuarios(usersRes.data?.usuarios || []);
            setPlanoInfo(planoRes.data || null);
            await carregarCodigos();
        } catch (err) {
            console.error('Erro ao carregar colaboradores:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);

    const handleGerarCodigo = async (e) => {
        e?.preventDefault();
        setGerandoCodigo(true);
        try {
            const res = await api.post('/empresa/gerar-codigo-convite', {
                telefone: conviteTelefone,
                tipo_usuario: conviteCargo
            });
            setCodigoGerado(res.data);
            carregarCodigos();
        } catch (err) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Erro ao gerar código');
        } finally {
            setGerandoCodigo(false);
        }
    };

    const handleAprovarUsuario = async (usuario, aprovado) => {
        try {
            const res = await api.patch(`/empresa/usuarios/${usuario.idUsuario}/aprovar`, { aprovado: aprovado ? 1 : 0 });
            setFeedback({ error: '', success: res.data?.message || 'Status de aprovação atualizado!' });
            carregarDados();
        } catch (err) {
            setFeedback({ error: err.response?.data?.error || 'Erro ao alterar aprovação', success: '' });
        }
    };

    const handleRevogarCodigo = async (codigoId) => {
        if (!window.confirm('Tem certeza que deseja revogar este código de segurança?')) return;
        try {
            await api.delete(`/empresa/codigos-convite/${codigoId}`);
            carregarCodigos();
        } catch (err) {
            alert('Erro ao revogar código');
        }
    };

    const handleCreateColaborador = async (e) => {
        e.preventDefault();
        setFeedback({ error: '', success: '' });
        setFormLoading(true);

        try {
            const res = await api.post('/empresa/usuarios', {
                nome,
                email,
                login: login || email,
                senha,
                telefone,
                tipo_usuario: tipoUsuario
            });

            setFeedback({ error: '', success: res.data?.message || 'Colaborador adicionado com sucesso!' });
            setNome(''); setEmail(''); setLogin(''); setSenha(''); setTelefone('');
            setModalOpen(false);
            carregarDados();
        } catch (err) {
            setFeedback({
                error: err.response?.data?.message || err.response?.data?.error || 'Erro ao adicionar colaborador',
                success: ''
            });
        } finally {
            setFormLoading(false);
        }
    };

    const handleToggleStatus = async (usuario) => {
        const novoStatus = usuario.status === '1' || usuario.status === 1 ? '0' : '1';
        try {
            await api.patch(`/empresa/usuarios/${usuario.idUsuario}/status`, { status: novoStatus });
            carregarDados();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao alterar status');
        }
    };

    const handleDeleteUsuario = async (usuario) => {
        if (!window.confirm(`Tem certeza que deseja remover o colaborador ${usuario.NomeCompleto}?`)) return;
        try {
            await api.delete(`/empresa/usuarios/${usuario.idUsuario}`);
            carregarDados();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao excluir usuário');
        }
    };

    const atingiuLimite = planoInfo?.capacidade?.atingiuLimite;
    const totalUsuarios = planoInfo?.capacidade?.usuariosAtivos || usuarios.length;
    const limite = planoInfo?.capacidade?.limiteUsuarios || 10;
    const pctUso = Math.min(100, Math.round((totalUsuarios / limite) * 100));

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header da Página */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">
                        <Building2 className="w-4 h-4" />
                        <span>{planoInfo?.empresa?.nome || 'Minha Empresa'}</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
                        <Users className="w-7 h-7 text-slate-800" />
                        Gestão da Equipe & Colaboradores
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Gerencie os usuários da sua empresa, permissões operacionais e limites do plano.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={carregarDados}
                        title="Atualizar lista"
                        className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => {
                            setCodigoGerado(null);
                            setConviteTelefone('');
                            setModalCodigoOpen(true);
                        }}
                        disabled={atingiuLimite && !isSuperAdmin}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all ${
                            atingiuLimite && !isSuperAdmin
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-emerald-500/20 active:scale-95'
                        }`}
                    >
                        <MessageSquare className="w-4 h-4 text-emerald-200" />
                        <span>Gerar Código WhatsApp (30 min)</span>
                    </button>

                    <button
                        onClick={() => { setFeedback({ error: '', success: '' }); setModalOpen(true); }}
                        disabled={atingiuLimite && !isSuperAdmin}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition-all ${
                            atingiuLimite && !isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                        <UserPlus className="w-4 h-4 text-slate-500" />
                        <span>Adicionar Manualmente</span>
                    </button>
                </div>
            </div>

            {/* Alerta de Feedback */}
            {feedback.error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{feedback.error}</span>
                </div>
            )}
            {feedback.success && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{feedback.success}</span>
                </div>
            )}

            {/* Cards de Status do Plano e Capacidade */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Plano Atual */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm border border-slate-700 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                            <span>PLANO ATIVO</span>
                            <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full uppercase text-[10px] font-black border border-blue-500/30">
                                {planoInfo?.empresa?.status || 'Ativo'}
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-amber-400" />
                            {planoInfo?.empresa?.planoNome || 'Plano Pro'}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            {planoInfo?.empresa?.planoDescricao || 'Gestão completa do orçamento ao chão de fábrica'}
                        </p>
                    </div>

                    {typeof planoInfo?.empresa?.diasRestantesTrial === 'number' && (
                        <div className="mt-4 pt-3 border-t border-slate-700/60 text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                            <span>⏳ Período de Teste: {planoInfo?.empresa?.diasRestantesTrial} dias restantes</span>
                        </div>
                    )}
                </div>

                {/* Card 2: Usuários e Capacidade */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div>
                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">
                            Capacidade de Colaboradores
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-900">{totalUsuarios}</span>
                            <span className="text-sm font-semibold text-slate-400">/ {limite} contratados</span>
                        </div>

                        {/* Barra de Progresso */}
                        <div className="w-full bg-slate-100 rounded-full h-2.5 mt-3 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    pctUso >= 90 ? 'bg-red-500' : pctUso >= 70 ? 'bg-amber-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${pctUso}%` }}
                            />
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span>{limite - totalUsuarios} vagas livres</span>
                        {atingiuLimite && <span className="text-red-600 font-bold">Limite do plano atingido</span>}
                    </div>
                </div>

                {/* Card 3: Segurança & Módulos */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div>
                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">
                            Segurança & Permissões
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <Shield className="w-4 h-4 text-emerald-600" />
                            Hierarquia de Acesso Isolada
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Seus colaboradores têm acesso restrito aos módulos da sua empresa. Os dados são totalmente isolados de outros clientes.
                        </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                        {planoInfo?.modulosLiberados?.length || 0} módulos liberados na sua licença
                    </div>
                </div>
            </div>

            {/* Banner de Códigos de Segurança Ativos (WhatsApp 30min) */}
            {codigosConvite.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-2xl p-6 shadow-sm border border-emerald-700/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
                                <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
                                <span>Códigos de Convite Ativos (Expiração em 30 min)</span>
                            </div>
                            <h3 className="text-lg font-black text-white">
                                Códigos Gerados pelo Master
                            </h3>
                            <p className="text-xs text-emerald-200/80 mt-0.5">
                                O colaborador deve informar este código na tela de cadastro para entrar diretamente na sua empresa.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                        {codigosConvite.map((c) => (
                            <div key={c.id} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">Código de Segurança:</span>
                                    <span className="text-2xl font-black font-mono tracking-widest text-emerald-300">{c.codigo}</span>
                                    <span className="text-[10px] text-emerald-200/80 block mt-0.5">
                                        ⏱️ {c.minutos_restantes > 0 ? `${c.minutos_restantes} min restantes` : 'Expirando em instantes'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(c.codigo);
                                            alert(`Código ${c.codigo} copiado para a área de transferência!`);
                                        }}
                                        title="Copiar Código"
                                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs font-bold"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleRevogarCodigo(c.id)}
                                        title="Revogar Código"
                                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 transition text-xs font-bold"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Alerta de Colaboradores Aguardando Aprovação */}
            {usuarios.some(u => u.aprovado === 0 || u.aprovado === '0') && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                        <Clock className="w-5 h-5 text-amber-600 animate-pulse shrink-0" />
                        <div>
                            <span className="font-bold">Colaboradores Aguardando Aprovação:</span>
                            <span className="text-xs text-amber-700 block">
                                Existem novos colaboradores que solicitaram acesso e aguardam sua liberação como Master.
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabela de Colaboradores */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-bold text-slate-900 text-sm">
                        Colaboradores Cadastrados ({usuarios.length})
                    </h2>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-400 text-sm">Carregando lista de colaboradores...</div>
                ) : usuarios.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">Nenhum colaborador cadastrado ainda.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-3">Colaborador</th>
                                    <th className="px-6 py-3">Login / E-mail</th>
                                    <th className="px-6 py-3">Perfil / Cargo</th>
                                    <th className="px-6 py-3">Aprovação</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                {usuarios.map((u) => {
                                    const isUserMaster = u.is_master === 1 || u.TipoUsuario === 'master';
                                    const isAtivo = u.status === '1' || u.status === 1;

                                    return (
                                        <tr key={u.idUsuario} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-3.5">
                                                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                                    {u.NomeCompleto}
                                                    {isUserMaster && (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            Master
                                                        </span>
                                                    )}
                                                </div>
                                                {u.telefone && <span className="text-[11px] text-slate-400">{u.telefone}</span>}
                                            </td>

                                            <td className="px-6 py-3.5">
                                                <div className="text-slate-800 font-mono text-[11px]">{u.Login}</div>
                                                <div className="text-slate-400 text-[11px]">{u.email}</div>
                                            </td>

                                            <td className="px-6 py-3.5">
                                                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold uppercase bg-slate-100 text-slate-700">
                                                    {u.TipoUsuario || 'Operador'}
                                                </span>
                                            </td>

                                            <td className="px-6 py-3.5">
                                                {isUserMaster ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span>Master</span>
                                                    </span>
                                                ) : u.aprovado === 0 || u.aprovado === '0' ? (
                                                    <button
                                                        onClick={() => handleAprovarUsuario(u, true)}
                                                        title="Clique para aprovar o colaborador"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 shadow-xs transition active:scale-95"
                                                    >
                                                        <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                                        <span>Aprovar Acesso</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleAprovarUsuario(u, false)}
                                                        title="Clique para revogar aprovação"
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                                                    >
                                                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span>Aprovado</span>
                                                    </button>
                                                )}
                                            </td>

                                            <td className="px-6 py-3.5">
                                                <button
                                                    onClick={() => handleToggleStatus(u)}
                                                    disabled={isUserMaster}
                                                    title={isAtivo ? 'Clique para desativar' : 'Clique para ativar'}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors ${
                                                        isAtivo
                                                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {isAtivo ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                                                    <span>{isAtivo ? 'Ativo' : 'Inativo'}</span>
                                                </button>
                                            </td>

                                            <td className="px-6 py-3.5 text-right">
                                                {!isUserMaster && (
                                                    <button
                                                        onClick={() => handleDeleteUsuario(u)}
                                                        title="Remover colaborador"
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Adicionar Colaborador */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-blue-600" />
                                Adicionar Novo Colaborador
                            </h3>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleCreateColaborador} className="space-y-4 mt-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Carlos Silva"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="carlos@empresa.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Login de Acesso</label>
                                    <input
                                        type="text"
                                        placeholder="carlos.silva"
                                        value={login}
                                        onChange={(e) => setLogin(e.target.value)}
                                        className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Senha Inicial</label>
                                    <input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        value={senha}
                                        onChange={(e) => setSenha(e.target.value)}
                                        className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Perfil / Cargo</label>
                                    <select
                                        value={tipoUsuario}
                                        onChange={(e) => setTipoUsuario(e.target.value)}
                                        className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    >
                                        <option value="operador">Operador (Fábrica)</option>
                                        <option value="comercial">Comercial / Vendas</option>
                                        <option value="pcp">PCP & Planejamento</option>
                                        <option value="engenharia">Engenharia / DXF</option>
                                        <option value="Administrador">Administrador Interno</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp / Telefone (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="(11) 99999-9999"
                                    value={telefone}
                                    onChange={(e) => setTelefone(e.target.value)}
                                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all"
                                >
                                    {formLoading ? 'Salvando...' : 'Adicionar Colaborador'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Gerar Código WhatsApp (30 minutos) */}
            {modalCodigoOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 relative overflow-hidden">
                        {/* Header Decorativo */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-base">
                                        Convidar por WhatsApp
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-medium">
                                        Gera um código de segurança válido por 30 minutos
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModalCodigoOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition"
                            >
                                &times;
                            </button>
                        </div>

                        {!codigoGerado ? (
                            <form onSubmit={handleGerarCodigo} className="space-y-4 mt-5">
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-800 leading-relaxed">
                                    <span className="font-bold block mb-0.5">⚠️ Como funciona:</span>
                                    Um código numérico de 6 dígitos será criado e ficará ativo por <strong>30 minutos</strong>. O novo colaborador informará esse código no cadastro e entrará automaticamente vinculado à sua empresa.
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp do Colaborador (Opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="(11) 99999-9999"
                                        value={conviteTelefone}
                                        onChange={(e) => setConviteTelefone(e.target.value)}
                                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        Se preencher, abrirá a conversa direta com o número.
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Perfil / Cargo Liberado</label>
                                    <select
                                        value={conviteCargo}
                                        onChange={(e) => setConviteCargo(e.target.value)}
                                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                                    >
                                        <option value="operador">Operador (Apontamento & Fábrica)</option>
                                        <option value="conferente">Conferente / Qualidade</option>
                                        <option value="comercial">Comercial / Vendas</option>
                                        <option value="pcp">PCP & Programação</option>
                                        <option value="engenharia">Engenharia / DXF</option>
                                        <option value="Administrador">Administrador Interno</option>
                                    </select>
                                </div>

                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setModalCodigoOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={gerandoCodigo}
                                        className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all flex items-center gap-2"
                                    >
                                        <Key className="w-4 h-4" />
                                        <span>{gerandoCodigo ? 'Gerando...' : 'Gerar Código de 6 Dígitos'}</span>
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-5 mt-5">
                                {/* Display do Código */}
                                <div className="text-center bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-inner">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
                                        CÓDIGO DE SEGURANÇA
                                    </span>
                                    <div className="text-4xl font-mono font-black tracking-widest text-white my-1">
                                        {codigoGerado.codigo}
                                    </div>
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-amber-300 font-semibold mt-2">
                                        <Clock className="w-4 h-4" />
                                        <span>Expira em 30 minutos (às {codigoGerado.hora_expiracao})</span>
                                    </div>
                                </div>

                                {/* Instrução ao Master */}
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                                    Envie este código para o colaborador. Ao se cadastrar com ele, ele será conectado <strong>imediatamente aprovado</strong> à sua empresa.
                                </div>

                                {/* Ações */}
                                <div className="flex flex-col gap-2.5">
                                    <a
                                        href={codigoGerado.whatsapp_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-emerald-500/20 transition active:scale-98"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        <span>Enviar Diretamente no WhatsApp</span>
                                        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                                    </a>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(codigoGerado.whatsapp_text || codigoGerado.codigo);
                                            setCopiado(true);
                                            setTimeout(() => setCopiado(false), 2500);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs border border-slate-300 hover:bg-slate-50 text-slate-700 transition"
                                    >
                                        {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                                        <span>{copiado ? 'Texto Copiado com Sucesso!' : 'Copiar Mensagem do Convite'}</span>
                                    </button>
                                </div>

                                <div className="pt-2 text-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCodigoGerado(null);
                                            setModalCodigoOpen(false);
                                        }}
                                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                                    >
                                        Fechar Janela
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestaoColaboradores;

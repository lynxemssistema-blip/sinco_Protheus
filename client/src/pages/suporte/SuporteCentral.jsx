import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
    HelpCircle, Plus, Search, Filter, MessageSquare, 
    Clock, CheckCircle2, AlertTriangle, Paperclip, ChevronRight, User, Terminal
} from 'lucide-react';
import NovoChamadoModal from './NovoChamadoModal';
import ChamadoDetalhesModal from './ChamadoDetalhesModal';

const SuporteCentral = () => {
    const [chamados, setChamados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [filtroPrioridade, setFiltroPrioridade] = useState('todas');
    const [filtroModulo, setFiltroModulo] = useState('todos');
    const [apenasMeus, setApenasMeus] = useState(false);

    const [modalNovo, setModalNovo] = useState(false);
    const [chamadoSelecionadoId, setChamadoSelecionadoId] = useState(null);

    const carregarChamados = async () => {
        try {
            setLoading(true);
            const params = {};
            if (filtroStatus !== 'todos') params.status = filtroStatus;
            if (filtroPrioridade !== 'todas') params.prioridade = filtroPrioridade;
            if (filtroModulo !== 'todos') params.modulo = filtroModulo;
            if (apenasMeus) params.meus_chamados = 'true';

            const res = await api.get('/suporte/chamados', { params });
            setChamados(res.data?.chamados || []);
        } catch (err) {
            console.error('Erro ao carregar chamados:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarChamados();
    }, [filtroStatus, filtroPrioridade, filtroModulo, apenasMeus]);

    const chamadosFiltrados = chamados.filter(c => {
        const query = busca.toLowerCase();
        return c.titulo?.toLowerCase().includes(query) ||
               c.codigo?.toLowerCase().includes(query) ||
               c.solicitante_nome?.toLowerCase().includes(query) ||
               c.modulo?.toLowerCase().includes(query);
    });

    // Contadores de KPI
    const totalAbertos = chamados.filter(c => c.status === 'aberto' || c.status === 'em_analise').length;
    const totalCriticos = chamados.filter(c => c.prioridade === 'critica' && c.status !== 'fechado' && c.status !== 'resolvido').length;
    const totalResolvidos = chamados.filter(c => c.status === 'resolvido' || c.status === 'fechado').length;

    return (
        <div className="p-4 sm:p-6 bg-slate-900 min-h-screen text-slate-100 space-y-6">
            {/* Header & Ações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                        <HelpCircle className="w-7 h-7 text-indigo-400" />
                        Central de Suporte & Chamados TI
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Helpdesk corporativo integrado, chat interno e planejamento técnico de resolução.
                    </p>
                </div>

                <button
                    onClick={() => setModalNovo(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-950 transition"
                >
                    <Plus className="w-5 h-5" />
                    Abrir Chamado
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center font-bold">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-medium">Em Andamento / Abertos</p>
                        <h3 className="text-2xl font-bold text-white">{totalAbertos}</h3>
                    </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center font-bold">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-medium">Prioridade Crítica</p>
                        <h3 className="text-2xl font-bold text-rose-400">{totalCriticos}</h3>
                    </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-medium">Resolvidos / Concluídos</p>
                        <h3 className="text-2xl font-bold text-emerald-400">{totalResolvidos}</h3>
                    </div>
                </div>
            </div>

            {/* Filtros e Busca */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                        type="text"
                        placeholder="Buscar por código, título ou solicitante..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Filtro Status */}
                    <select
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value)}
                        className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-300"
                    >
                        <option value="todos">Todos os Status</option>
                        <option value="aberto">Abertos</option>
                        <option value="em_analise">Em Análise</option>
                        <option value="aguardando_usuario">Aguardando Usuário</option>
                        <option value="em_correcao">Em Correção</option>
                        <option value="resolvido">Resolvidos</option>
                        <option value="fechado">Fechados</option>
                    </select>

                    {/* Filtro Prioridade */}
                    <select
                        value={filtroPrioridade}
                        onChange={(e) => setFiltroPrioridade(e.target.value)}
                        className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-300"
                    >
                        <option value="todas">Todas as Prioridades</option>
                        <option value="baixa">Baixa</option>
                        <option value="media">Média</option>
                        <option value="alta">Alta</option>
                        <option value="critica">Crítica</option>
                    </select>

                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer ml-2">
                        <input
                            type="checkbox"
                            checked={apenasMeus}
                            onChange={(e) => setApenasMeus(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                        />
                        Apenas Meus Chamados
                    </label>
                </div>
            </div>

            {/* Tabela de Chamados */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-12 text-center text-slate-500 text-sm">Carregando chamados...</div>
                ) : chamadosFiltrados.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-sm">Nenhum chamado encontrado com os filtros selecionados.</div>
                ) : (
                    <div className="divide-y divide-slate-850">
                        {chamadosFiltrados.map((c) => (
                            <div
                                key={c.id}
                                onClick={() => setChamadoSelecionadoId(c.id)}
                                className="p-4 hover:bg-slate-900/50 cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${
                                        c.prioridade === 'critica' ? 'bg-rose-950/80 text-rose-400 border border-rose-800' :
                                        c.prioridade === 'alta' ? 'bg-amber-950/80 text-amber-400 border border-amber-800' :
                                        'bg-blue-950/80 text-blue-400 border border-blue-800'
                                    }`}>
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono font-bold text-indigo-400">{c.codigo}</span>
                                            <span className="text-xs bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded">
                                                {c.modulo}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                c.status === 'resolvido' || c.status === 'fechado' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                                                c.status === 'em_correcao' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                                                c.status === 'aguardando_usuario' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                                                'bg-slate-800 text-slate-300'
                                            }`}>
                                                {c.status?.replace('_', ' ')}
                                            </span>
                                        </div>

                                        <h3 className="font-semibold text-sm text-white mt-1 group-hover:text-indigo-300 transition">
                                            {c.titulo}
                                        </h3>
                                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{c.descricao}</p>

                                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                            <span>Aberto por: <strong className="text-slate-400">{c.solicitante_nome}</strong></span>
                                            <span>Em: {new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                                            {c.total_mensagens > 0 && (
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                                                    {c.total_mensagens}
                                                </span>
                                            )}
                                            {c.total_anexos > 0 && (
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                                                    {c.total_anexos}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end md:self-center">
                                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 transition" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modais */}
            {modalNovo && (
                <NovoChamadoModal
                    onClose={() => setModalNovo(false)}
                    onChamadoCriado={carregarChamados}
                />
            )}

            {chamadoSelecionadoId && (
                <ChamadoDetalhesModal
                    chamadoId={chamadoSelecionadoId}
                    onClose={() => setChamadoSelecionadoId(null)}
                    onAtualizado={carregarChamados}
                />
            )}
        </div>
    );
};

export default SuporteCentral;

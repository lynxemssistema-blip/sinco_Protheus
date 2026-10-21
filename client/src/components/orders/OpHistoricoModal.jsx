import React, { useEffect, useState } from 'react';
import { X, History, Loader2, User, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../services/api';

// Rótulo e cor de cada ação gravada em app_op_historico (server/services/opGuardService.js)
const ACOES = {
    OP_CRIADA: { label: 'OP criada', cor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    OP_EXCLUIDA: { label: 'OP excluída', cor: 'bg-rose-100 text-rose-800 border-rose-200' },
    FRACIONAMENTO_CRIADO: { label: 'OP fracionada', cor: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    FRACIONAMENTO_REAJUSTADO: { label: 'Frações reajustadas', cor: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    FRACIONAMENTO_DESFEITO: { label: 'Fracionamento desfeito', cor: 'bg-amber-100 text-amber-800 border-amber-200' },
    PROGRAMACAO_CRIADA: { label: 'Programação incluída', cor: 'bg-teal-100 text-teal-800 border-teal-200' },
    PROGRAMACAO_EDITADA: { label: 'Programação editada', cor: 'bg-teal-100 text-teal-800 border-teal-200' },
    PROGRAMACAO_REMOVIDA: { label: 'Programação removida', cor: 'bg-rose-100 text-rose-800 border-rose-200' },
    PLANEJAMENTO_PCP_LOTE: { label: 'Planejamento PCP em lote', cor: 'bg-teal-100 text-teal-800 border-teal-200' },
    LOTE_ITEM_INCLUIDO: { label: 'Incluído no lote', cor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    LOTE_ITEM_REMOVIDO: { label: 'Removido do lote', cor: 'bg-amber-100 text-amber-800 border-amber-200' },
    LOTE_DESMANCHADO: { label: 'Lote desmanchado', cor: 'bg-amber-100 text-amber-800 border-amber-200' },
    LIBERACAO_REGISTRADA: { label: 'Liberação registrada', cor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    LOTE_LIBERADO: { label: 'Lote liberado', cor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    PLANO_CORTE_GERADO: { label: 'Plano de corte gerado', cor: 'bg-orange-100 text-orange-800 border-orange-200' },
    MESCLA_LIBERADA: { label: 'Liberação PCP (Mescla)', cor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    ACAO_BLOQUEADA: { label: 'Ação bloqueada', cor: 'bg-slate-200 text-slate-800 border-slate-300' }
};

const formatarDataHora = (valor) => {
    if (!valor) return '-';
    const d = new Date(valor);
    return isNaN(d.getTime()) ? String(valor) : d.toLocaleString('pt-BR');
};

const formatarJson = (valor) => {
    if (valor === null || valor === undefined || valor === '') return null;
    try {
        return JSON.stringify(typeof valor === 'string' ? JSON.parse(valor) : valor, null, 2);
    } catch (_) {
        return String(valor);
    }
};

const OpHistoricoModal = ({ isOpen, onClose, pedido, item, descricao }) => {
    const [registros, setRegistros] = useState([]);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState(null);
    const [abertos, setAbertos] = useState({});

    useEffect(() => {
        if (!isOpen || !pedido || !item) return;
        setLoading(true);
        setErro(null);
        setAbertos({});
        api.get('/pedidos/op-historico', { params: { pedido, item } })
            .then(res => setRegistros(Array.isArray(res.data) ? res.data : []))
            .catch(err => setErro(err.response?.data?.error || err.message))
            .finally(() => setLoading(false));
    }, [isOpen, pedido, item]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 p-5 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-indigo-500 rounded-xl"><History className="w-5 h-5 text-white" /></div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold">Histórico da OP</h2>
                            <p className="text-slate-300 text-xs truncate">Pedido {pedido} · Item {item}{descricao ? ` · ${descricao}` : ''}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Fechar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-sm">
                            <Loader2 className="w-5 h-5 animate-spin" /> Carregando histórico...
                        </div>
                    ) : erro ? (
                        <p className="text-center text-rose-600 text-sm py-12">Erro ao carregar o histórico: {erro}</p>
                    ) : registros.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-12">Nenhuma ação registrada para este item.</p>
                    ) : (
                        <ol className="relative border-l-2 border-slate-200 ml-2 space-y-4">
                            {registros.map(r => {
                                const acao = ACOES[r.acao] || { label: r.acao, cor: 'bg-slate-100 text-slate-700 border-slate-200' };
                                const antes = formatarJson(r.dados_antes);
                                const depois = formatarJson(r.dados_depois);
                                const aberto = !!abertos[r.id];
                                return (
                                    <li key={r.id} className="ml-4">
                                        <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-white border-2 border-indigo-400" />
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className={`px-2 py-0.5 rounded border font-bold ${acao.cor}`}>{acao.label}</span>
                                            <span className="text-slate-500">{formatarDataHora(r.created_at)}</span>
                                            <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                                                <User className="w-3 h-3 text-slate-400" />
                                                {r.usuario_nome || r.usuario_login || 'Sistema'}
                                                {r.usuario_login && r.usuario_nome ? <span className="text-slate-400 font-normal">({r.usuario_login})</span> : null}
                                            </span>
                                        </div>
                                        {r.descricao && <p className="mt-1 text-sm text-slate-800">{r.descricao}</p>}
                                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-mono">
                                            {r.op_numero && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">OP {r.op_numero}</span>}
                                            {r.fracao && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Fração {r.fracao}</span>}
                                            {r.lote_codigo && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">Lote {r.lote_codigo}</span>}
                                        </div>
                                        {(antes || depois) && (
                                            <button
                                                type="button"
                                                onClick={() => setAbertos(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                                                className="mt-1 inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline"
                                            >
                                                {aberto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                {aberto ? 'Ocultar detalhes' : 'Ver antes / depois'}
                                            </button>
                                        )}
                                        {aberto && (
                                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Antes</p>
                                                    <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto max-h-48">{antes || '—'}</pre>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Depois</p>
                                                    <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto max-h-48">{depois || '—'}</pre>
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OpHistoricoModal;

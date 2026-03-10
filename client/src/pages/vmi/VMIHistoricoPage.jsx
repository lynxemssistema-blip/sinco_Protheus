import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    History, FileSpreadsheet, Calendar, Package, Users,
    Loader2, AlertCircle, ChevronRight, Trash2, Eye,
    BarChart2, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';

export default function VMIHistoricoPage() {
    const [leituras, setLeituras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandido, setExpandido] = useState(null);
    const [detalhe, setDetalhe] = useState(null);
    const [loadingDetalhe, setLoadingDetalhe] = useState(false);
    const [comparativo, setComparativo] = useState(null);
    const [loadingComp, setLoadingComp] = useState(false);
    const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    useEffect(() => {
        fetchLeituras();
    }, []);

    const fetchLeituras = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/vmi/leituras');
            setLeituras(data);
        } catch {
            setError('Erro ao carregar histórico de leituras.');
        } finally {
            setLoading(false);
        }
    };

    const fetchDetalhe = async (id) => {
        if (expandido === id) { setExpandido(null); setDetalhe(null); return; }
        setExpandido(id);
        setDetalhe(null);
        setComparativo(null);
        setLoadingDetalhe(true);
        try {
            const { data } = await api.get(`/vmi/leituras/${id}`);
            setDetalhe(data);
        } catch {
            setDetalhe(null);
        } finally {
            setLoadingDetalhe(false);
        }
    };

    const fetchComparativo = async (idAtual) => {
        const idx = leituras.findIndex(l => l.id === idAtual);
        if (idx >= leituras.length - 1) return; // no previous
        const idAnterior = leituras[idx + 1].id;
        setLoadingComp(true);
        try {
            const { data } = await api.get('/vmi/comparativo', {
                params: { id_anterior: idAnterior, id_atual: idAtual }
            });
            setComparativo(data);
        } catch {
            setComparativo(null);
        } finally {
            setLoadingComp(false);
        }
    };

    const remover = (id, e) => {
        e.stopPropagation();
        setConfirm({
            isOpen: true,
            title: 'Remover Histórico',
            message: 'Tem certeza que deseja remover esta leitura do histórico? Esta ação é permanente.',
            onConfirm: async () => {
                try {
                    await api.delete(`/vmi/leituras/${id}`);
                    setLeituras(prev => prev.filter(l => l.id !== id));
                    if (expandido === id) { setExpandido(null); setDetalhe(null); }
                } catch {
                    alert('Erro ao remover leitura.');
                }
            }
        });
    };

    const fmtDate = (dt) => new Date(dt).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    if (loading) return (
        <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
    );

    if (error) return (
        <div className="p-6 flex items-center gap-3 text-red-600 bg-red-50 rounded-xl m-6">
            <AlertCircle className="w-5 h-5" />{error}
        </div>
    );

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                        <History className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Histórico & Evolução VMI</h1>
                        <p className="text-sm text-slate-500">{leituras.length} leituras salvas</p>
                    </div>
                </div>
                <a href="/vmi/leitura"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                    Nova Leitura
                </a>
            </div>

            {/* Empty state */}
            {leituras.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                        <FileSpreadsheet className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">Nenhuma leitura salva ainda.</p>
                    <a href="/vmi/leitura"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        Fazer primeiro upload <ChevronRight className="w-4 h-4" />
                    </a>
                </div>
            )}

            {/* Readings list */}
            <div className="space-y-3">
                {leituras.map((l, idx) => (
                    <div key={l.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

                        {/* Row header */}
                        <div
                            className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => fetchDetalhe(l.id)}
                        >
                            <div className="w-9 h-9 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center shrink-0">
                                <FileSpreadsheet className="w-4 h-4 text-orange-600" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-slate-800 text-sm">{l.mes_label || l.mes_referencia}</span>
                                    {idx === 0 && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Mais recente</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 truncate mt-0.5">{l.nome_arquivo}</p>
                            </div>

                            <div className="hidden md:flex items-center gap-5 text-xs text-slate-500 shrink-0">
                                <span className="flex items-center gap-1">
                                    <Package className="w-3.5 h-3.5" />{l.total_itens} itens
                                </span>
                                <span className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5" />{l.total_pedidos} pedidos
                                </span>
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />{fmtDate(l.data_upload)}
                                </span>
                                {l.usuario_nome && (
                                    <span className="text-slate-400">{l.usuario_nome}</span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {idx < leituras.length - 1 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); fetchDetalhe(l.id); setTimeout(() => fetchComparativo(l.id), 300); }}
                                        className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors"
                                        title="Comparar com leitura anterior"
                                    >
                                        <BarChart2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={(e) => remover(l.id, e)}
                                    className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${expandido === l.id ? 'rotate-90' : ''}`} />
                            </div>
                        </div>

                        {/* Expanded detail */}
                        {expandido === l.id && (
                            <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-4">

                                {loadingDetalhe && (
                                    <div className="flex items-center gap-2 text-slate-500 text-sm py-4 justify-center">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando itens...
                                    </div>
                                )}

                                {/* Comparativo */}
                                {loadingComp && (
                                    <div className="flex items-center gap-2 text-slate-500 text-sm py-2 justify-center">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Calculando comparativo...
                                    </div>
                                )}
                                {comparativo && (
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                                        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                            <BarChart2 className="w-4 h-4 text-blue-600" />
                                            Comparativo com leitura anterior
                                        </h4>
                                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                                            <CompStat
                                                label="Demanda aumentou"
                                                value={comparativo.comparados?.filter(c => c.situacao === 'aumentou').length}
                                                icon={<TrendingUp className="w-4 h-4 text-red-500" />}
                                                color="text-red-600" />
                                            <CompStat
                                                label="Demanda igual"
                                                value={comparativo.comparados?.filter(c => c.situacao === 'igual').length}
                                                icon={<Minus className="w-4 h-4 text-slate-400" />}
                                                color="text-slate-600" />
                                            <CompStat
                                                label="Demanda diminuiu"
                                                value={comparativo.comparados?.filter(c => c.situacao === 'diminuiu').length}
                                                icon={<TrendingDown className="w-4 h-4 text-green-500" />}
                                                color="text-green-600" />
                                        </div>
                                        {comparativo.novos?.length > 0 && (
                                            <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                                                +{comparativo.novos.length} novos itens em relação à leitura anterior
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Items table */}
                                {detalhe && (
                                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-semibold text-slate-500">
                                            Top 20 itens por demanda total
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100">
                                                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Código</th>
                                                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Descrição</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-500">WK01</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-500">WK02</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-500">WK03</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-500">WK04</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-500">WK05</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-slate-800">Total</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-red-500">Faltantes</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {(detalhe.itens || []).slice(0, 20).map((item) => {
                                                        const total = +item.total_demanda ||
                                                            (+item.qtd_wk01 + +item.qtd_wk02 + +item.qtd_wk03 + +item.qtd_wk04 + +item.qtd_wk05);
                                                        return (
                                                            <tr key={item.id} className="hover:bg-slate-50">
                                                                <td className="px-3 py-2 font-mono text-slate-700">{item.codigo_produto}</td>
                                                                <td className="px-3 py-2 text-slate-500 max-w-[180px] truncate">{item.descricao || '—'}</td>
                                                                {[item.qtd_wk01, item.qtd_wk02, item.qtd_wk03, item.qtd_wk04, item.qtd_wk05].map((q, j) => (
                                                                    <td key={j} className={`px-3 py-2 text-right tabular-nums ${+q > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                                                                        {+q > 0 ? (+q).toLocaleString('pt-BR') : '—'}
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-2 text-right font-bold text-slate-800 tabular-nums">
                                                                    {total > 0 ? total.toLocaleString('pt-BR') : '—'}
                                                                </td>
                                                                <td className={`px-3 py-2 text-right tabular-nums font-medium
                                                                    ${+item.faltantes_firmes > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                                                                    {+item.faltantes_firmes > 0 ? (+item.faltantes_firmes).toLocaleString('pt-BR') : '—'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {(detalhe.itens || []).length > 20 && (
                                            <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
                                                + {detalhe.itens.length - 20} itens adicionais
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <ConfirmModal 
                isOpen={confirm.isOpen}
                onClose={() => setConfirm(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirm.onConfirm}
                title={confirm.title}
                message={confirm.message}
            />
        </div>
    );
}

function CompStat({ label, value, icon, color }) {
    return (
        <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center justify-center mb-1">{icon}</div>
            <p className={`text-lg font-bold ${color}`}>{value ?? 0}</p>
            <p className="text-slate-500 text-xs mt-0.5">{label}</p>
        </div>
    );
}

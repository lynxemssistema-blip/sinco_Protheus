import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    PieChart, Loader2, RefreshCw,
    Search, TrendingUp, ExternalLink, MessageCircle, Mail
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import useStickyState from '../../hooks/useStickyState';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtFull = (iso) => {
    if (!iso) return '—';
    try {
        const [y, m, d] = iso.split('T')[0].split('-');
        return `${d}/${m}/${y}`;
    } catch { return iso; }
};

const ProgressBar = ({ value, color = '#3b82f6' }) => (
    <div className="flex flex-col items-center gap-1 w-full">
        <div className="w-full max-w-[100px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all"
                style={{ width: `${value}%`, backgroundColor: value >= 100 ? '#10b981' : color }}
            />
        </div>
        <span className="text-xs font-black text-slate-600">{value}%</span>
    </div>
);

// ─── Página Principal ────────────────────────────────────────────────────────
export default function VisaoSetores() {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [filters, setFilters] = useStickyState({
        pedido: '', cliente: '', produto: '',
        data_inicio: '', data_fim: '',
        status: '', apenas_pendentes: true
    }, '@metalfisa:visao_setores_filters');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([k, v]) => {
                if (v !== '' && v !== false) params.append(k, v);
            });
            const res = await api.get(`/pcp-setores/visao?${params}`);
            setData(res.data);
        } catch (err) {
            toast.error('Erro ao carregar visão por setor.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => { load(); }, []);

    // ─── Processamento da Matriz ─────────────────────────────────────────────
    
    const { setoresHeaders, pedidosRows } = useMemo(() => {
        if (!data || data.length === 0) return { setoresHeaders: [], pedidosRows: [] };

        const headers = data.map(s => ({
            id: s.id,
            nome: s.nome,
            cor: s.cor
        }));

        const map = {};
        data.forEach(setor => {
            setor.ops.forEach(op => {
                const pedKey = op.pedido_venda || `OP-${op.op}`;
                if (!map[pedKey]) {
                    map[pedKey] = {
                        pedido: op.pedido_venda || `OP ${op.op}`,
                        cliente: op.nome_cliente,
                        prazo: op.prazo_entrega_pedido,
                        setoresData: {}
                    };
                }
                
                if (!map[pedKey].setoresData[setor.id]) {
                    map[pedKey].setoresData[setor.id] = { esperada: 0, apontada: 0 };
                }
                
                map[pedKey].setoresData[setor.id].esperada += (Number(op.qtd_esperada_setor) || 0);
                map[pedKey].setoresData[setor.id].apontada += (Number(op.qtd_apontada_setor) || 0);
            });
        });

        const rows = Object.values(map).sort((a, b) => a.pedido.localeCompare(b.pedido));
        
        return { setoresHeaders: headers, pedidosRows: rows };
    }, [data]);

    // ─── Notificações (WhatsApp e Email) ─────────────────────────────────────────────
    const [modalNotify, setModalNotify] = useState(false);
    const [notifyCanal, setNotifyCanal] = useState('whatsapp');
    const [sending, setSending] = useState(false);

    const handleNotify = async (tipo) => {
        setModalNotify(false);
        setSending(true);
        toast.info(`Iniciando disparos via ${notifyCanal}...`, { autoClose: 2000 });
        try {
            const payload = { filters, tipo, canal: notifyCanal };
            if (tipo === 'me') {
                const meuUserStr = localStorage.getItem('@metalfisa:user');
                if (meuUserStr) {
                    const u = JSON.parse(meuUserStr);
                    payload.telefone = u.telefone;
                    payload.email = u.email;
                    payload.nome = u.nome || u.NomeCompleto || u.login;
                    if (notifyCanal === 'whatsapp' && !payload.telefone) {
                        toast.error('Você não tem um celular cadastrado no perfil.');
                        setSending(false);
                        return;
                    }
                    if (notifyCanal === 'email' && !payload.email) {
                        toast.error('Você não tem um e-mail cadastrado no perfil.');
                        setSending(false);
                        return;
                    }
                }
            }

            const res = await api.post('/pcp-setores/visao/notify', payload);
            if (res.data.success) {
                toast.success(res.data.message || 'Relatórios enviados!');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Erro ao enviar relatórios.');
        } finally {
            setSending(false);
        }
    };

    const openModal = (canal) => {
        setNotifyCanal(canal);
        setModalNotify(true);
    };

    return (
        <div className="bg-slate-50 h-screen overflow-hidden p-4 md:p-6 font-sans flex flex-col">
            {/* MODAL NOTIFICAR */}
            {modalNotify && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                {notifyCanal === 'whatsapp' ? <MessageCircle className="w-5 h-5 text-emerald-500" /> : <Mail className="w-5 h-5 text-blue-500" />}
                                Enviar Relatório ({notifyCanal === 'whatsapp' ? 'WhatsApp' : 'E-mail'})
                            </h3>
                            <button onClick={() => setModalNotify(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <div className="p-5 space-y-3">
                            <button onClick={() => handleNotify('responsibles')} className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors group">
                                <div className="font-bold text-slate-800 group-hover:text-emerald-700">Para cada responsável</div>
                                <div className="text-xs text-slate-500 mt-1">Cada responsável receberá apenas o resumo do seu próprio setor.</div>
                            </button>
                            <button onClick={() => handleNotify('all')} className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors group">
                                <div className="font-bold text-slate-800 group-hover:text-emerald-700">Resumo Geral para Todos</div>
                                <div className="text-xs text-slate-500 mt-1">Todos os responsáveis recebem o relatório completo de todos os setores.</div>
                            </button>
                            <button onClick={() => handleNotify('me')} className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group">
                                <div className="font-bold text-slate-800 group-hover:text-blue-700">Apenas para mim</div>
                                <div className="text-xs text-slate-500 mt-1">Enviar o resumo geral apenas para o meu próprio {notifyCanal === 'whatsapp' ? 'WhatsApp' : 'E-mail'}.</div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-[1400px] mx-auto w-full flex-1 flex flex-col space-y-5 min-h-0">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-blue-600" />
                            Evolução de Pedidos por Setor
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">Visão matricial da evolução dos pedidos dentro de cada grupo produtivo</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => openModal('whatsapp')}
                            disabled={loading || sending}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-60"
                        >
                            {sending && notifyCanal === 'whatsapp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                            WhatsApp
                        </button>
                        <button
                            onClick={() => openModal('email')}
                            disabled={loading || sending}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-60"
                        >
                            {sending && notifyCanal === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                            E-mail
                        </button>
                        <button
                            onClick={load}
                            disabled={loading || sending}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </button>
                    </div>
                </div>

                {/* Filtros */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex-none">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                        <input
                            value={filters.pedido} placeholder="Pedido"
                            onChange={e => setFilters(p => ({ ...p, pedido: e.target.value }))}
                            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            value={filters.cliente} placeholder="Cliente"
                            onChange={e => setFilters(p => ({ ...p, cliente: e.target.value }))}
                            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            value={filters.produto} placeholder="Produto"
                            onChange={e => setFilters(p => ({ ...p, produto: e.target.value }))}
                            className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-2">
                            <input type="date" value={filters.data_inicio}
                                onChange={e => setFilters(p => ({ ...p, data_inicio: e.target.value }))}
                                className="flex-1 px-2 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                title="Data início planejada de"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="date" value={filters.data_fim}
                                onChange={e => setFilters(p => ({ ...p, data_fim: e.target.value }))}
                                className="flex-1 px-2 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                title="Data início planejada até"
                            />
                        </div>
                        <select
                            value={filters.status}
                            onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
                            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos os Status</option>
                            <option value="em_andamento">Em Andamento</option>
                            <option value="atrasada_inicio,atrasada_entrega">Atrasadas</option>
                            <option value="planejada,aguardando">Não Iniciadas</option>
                            <option value="concluida">Concluídas</option>
                        </select>
                    </div>
                    <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filters.apenas_pendentes}
                                onChange={e => setFilters(p => ({ ...p, apenas_pendentes: e.target.checked }))}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                            />
                            <span className="text-sm text-slate-600 font-medium select-none">Apenas pendentes</span>
                        </label>
                        <button
                            onClick={load} disabled={loading}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2 rounded-xl transition-colors disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            Buscar
                        </button>
                    </div>
                </div>

                {/* Conteúdo Matricial */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-0">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-16">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                            <span className="text-sm text-slate-500">Processando evolução por setores...</span>
                        </div>
                    ) : pedidosRows.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
                            <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="font-semibold text-slate-600 text-lg">Nenhum pedido encontrado</p>
                            <p className="text-sm text-slate-400 mt-1 max-w-md">
                                Não há ordens de produção ou pedidos associados aos filtros atuais e aos setores configurados.
                            </p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-auto relative">
                            <table className="w-full text-sm text-left whitespace-nowrap min-w-max">
                                <thead className="bg-slate-50 text-slate-700 font-bold border-b sticky top-0 z-20 shadow-sm">
                                    <tr>
                                        <th className="p-4 sticky left-0 top-0 bg-slate-50 border-r z-30 shadow-[1px_0_0_0_#e2e8f0] align-middle w-72">
                                            <div className="text-sm">Pedido / Cliente</div>
                                        </th>
                                        {setoresHeaders.map(setor => (
                                            <th key={setor.id} className="p-4 text-center border-r min-w-[140px]">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: setor.cor }} />
                                                    <span className="truncate max-w-[120px]" title={setor.nome}>{setor.nome}</span>
                                                </div>
                                            </th>
                                        ))}
                                        <th className="p-4 text-center bg-slate-50 sticky right-0 z-20 shadow-[-1px_0_0_0_#e2e8f0]">
                                            Evolução Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pedidosRows.map(ped => {
                                        // Calc geral do pedido
                                        let totalEsp = 0;
                                        let totalApt = 0;
                                        setoresHeaders.forEach(s => {
                                            const d = ped.setoresData[s.id];
                                            if (d) {
                                                totalEsp += d.esperada;
                                                totalApt += d.apontada;
                                            }
                                        });
                                        const progGeral = totalEsp > 0 ? Math.round((totalApt / totalEsp) * 100) : 0;

                                        return (
                                            <tr key={ped.pedido} className="hover:bg-slate-50 group">
                                                <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50 border-r z-10 shadow-[1px_0_0_0_#e2e8f0]">
                                                    <div className="font-black text-blue-700">{ped.pedido}</div>
                                                    <div className="text-xs text-slate-500 truncate w-64 mt-0.5" title={ped.cliente}>{ped.cliente || 'Sem cliente associado'}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                        <span className="font-semibold text-slate-500">Entrega:</span> 
                                                        {fmtFull(ped.prazo)}
                                                    </div>
                                                </td>
                                                {setoresHeaders.map(setor => {
                                                    const sData = ped.setoresData[setor.id];
                                                    if (!sData || sData.esperada === 0) {
                                                        return (
                                                            <td key={setor.id} className="p-4 border-r text-center align-middle">
                                                                <span className="text-slate-300 select-none">—</span>
                                                            </td>
                                                        );
                                                    }
                                                    
                                                    const prog = Math.round((sData.apontada / sData.esperada) * 100);
                                                    return (
                                                        <td key={setor.id} className="p-4 border-r text-center align-middle">
                                                            <ProgressBar value={prog} color={setor.cor} />
                                                            <div className="text-[10px] text-slate-400 mt-1.5 font-mono">
                                                                {Number(sData.apontada).toFixed(0)} / {Number(sData.esperada).toFixed(0)}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                <td className="p-4 text-center sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-1px_0_0_0_#e2e8f0] z-10 align-middle">
                                                    <ProgressBar value={progGeral} color="#475569" />
                                                    <div className="text-[10px] text-slate-400 mt-1.5 font-mono">
                                                        {Number(totalApt).toFixed(0)} / {Number(totalEsp).toFixed(0)}
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
            </div>
        </div>
    );
}

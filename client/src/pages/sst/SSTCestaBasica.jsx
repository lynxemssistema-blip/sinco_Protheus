import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
    ShoppingBag, Calendar, CheckCircle2, XCircle, Clock, Plus, 
    Download, ShieldCheck, Search, AlertTriangle, Fingerprint 
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const SSTCestaBasica = () => {
    const [periodos, setPeriodos] = useState([]);
    const [periodoAtivo, setPeriodoAtivo] = useState(null);
    const [entregas, setEntregas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState('');
    const [modalNovoPeriodo, setModalNovoPeriodo] = useState(false);
    const [novoPeriodo, setNovoPeriodo] = useState({
        competencia: new Date().toISOString().slice(0, 7),
        descricao: '',
        data_liberacao: new Date().toISOString().slice(0, 10),
        data_limite_retirada: ''
    });
    const [actionLoading, setActionLoading] = useState(false);

    // Carregar períodos
    const carregarPeriodos = async () => {
        try {
            setLoading(true);
            const res = await api.get('/sst/cesta/periodos');
            const lista = res.data?.periodos || [];
            setPeriodos(lista);
            if (lista.length > 0 && !periodoAtivo) {
                setPeriodoAtivo(lista[0]);
            }
        } catch (err) {
            console.error('Erro ao carregar competências de cesta básica:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarPeriodos();
    }, []);

    // Carregar entregas do período ativo
    const carregarEntregas = async () => {
        if (!periodoAtivo?.id) return;
        try {
            const res = await api.get(`/sst/cesta/entregas/${periodoAtivo.id}`);
            setEntregas(res.data?.entregas || []);
        } catch (err) {
            console.error('Erro ao carregar entregas:', err);
        }
    };

    useEffect(() => {
        carregarEntregas();
    }, [periodoAtivo]);

    // Criar nova competência
    const handleCriarPeriodo = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            await api.post('/sst/cesta/periodos', novoPeriodo);
            setModalNovoPeriodo(false);
            await carregarPeriodos();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao abrir competência.');
        } finally {
            setActionLoading(false);
        }
    };

    // Confirmar Retirada com Assinatura Digital
    const handleConfirmarRetirada = async (entregaId, colabNome) => {
        if (!confirm(`Confirmar a retirada da cesta básica para ${colabNome} com assinatura digital?`)) return;
        try {
            const res = await api.post(`/sst/cesta/entregas/${entregaId}/retirar`);
            alert(res.data.message || 'Retirada registrada com sucesso!');
            await carregarEntregas();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao registrar retirada.');
        }
    };

    // Gerar Lista de Assinaturas Física em PDF
    const handleGerarListaPdf = () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        doc.setFillColor(30, 41, 59);
        doc.rect(14, 12, 182, 16, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`LISTA DE CONFERÊNCIA E RETIRADA DE CESTA BÁSICA - ${periodoAtivo?.competencia}`, 105, 22, { align: 'center' });

        const body = entregas.map((e, idx) => [
            idx + 1,
            e.colaborador_nome || '-',
            e.Setor || '-',
            e.elegivel ? 'ELEGÍVEL' : `INAPTO: ${e.motivo_inaptidao}`,
            e.status === 'entregue' ? 'RETIRADO' : 'PENDENTE',
            e.status === 'entregue' ? 'ACEITE DIGITAL (OK)' : '__________________________'
        ]);

        doc.autoTable({
            startY: 34,
            head: [['#', 'Colaborador', 'Setor', 'Elegibilidade', 'Status', 'Assinatura do Recebedor']],
            body,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 7.5 },
            columnStyles: {
                5: { cellWidth: 50 }
            }
        });

        doc.save(`Lista_Cesta_Basica_${periodoAtivo?.competencia}.pdf`);
    };

    const entregasFiltradas = entregas.filter(e =>
        e.colaborador_nome?.toLowerCase().includes(busca.toLowerCase()) ||
        e.Setor?.toLowerCase().includes(busca.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-3">
                        <ShoppingBag className="w-8 h-8 text-amber-500" />
                        Cesta Básica & Benefícios Mensais
                    </h1>
                    <p className="text-sm text-slate-400">
                        Apuração automática de elegibilidade com trava por faltas injustificadas e registro de entrega com hash digital.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={handleGerarListaPdf}
                        disabled={!periodoAtivo || entregas.length === 0}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors shadow disabled:opacity-50"
                    >
                        <Download className="w-4 h-4 text-slate-400" />
                        Lista de Assinaturas (PDF)
                    </button>

                    <button
                        onClick={() => setModalNovoPeriodo(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition-all shadow-lg shadow-amber-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        Abrir Nova Competência
                    </button>
                </div>
            </div>

            {/* Barra de Competências & Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-center">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Competência Selecionada</label>
                    <select
                        value={periodoAtivo?.id || ''}
                        onChange={(e) => {
                            const p = periodos.find(item => String(item.id) === e.target.value);
                            setPeriodoAtivo(p);
                        }}
                        className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-amber-500"
                    >
                        {periodos.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.competencia} - {p.descricao || 'Cesta Básica'}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Elegíveis no Mês</div>
                        <div className="text-2xl font-black text-emerald-400">
                            {entregas.filter(e => e.elegivel === 1).length} colaboradores
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                        <XCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Inaptos (Travados)</div>
                        <div className="text-2xl font-black text-red-400">
                            {entregas.filter(e => e.elegivel === 0).length} colaboradores
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cestas Retiradas</div>
                        <div className="text-2xl font-black text-white">
                            {entregas.filter(e => e.status === 'entregue').length} de {entregas.length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabela de Colaboradores e Retirada */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="relative w-80">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            placeholder="Buscar colaborador ou setor..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 w-full focus:outline-none focus:border-amber-500"
                        />
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800 font-bold">
                            <tr>
                                <th className="p-3.5">Colaborador</th>
                                <th className="p-3.5">Setor / Função</th>
                                <th className="p-3.5 text-center">Elegibilidade</th>
                                <th className="p-3.5 text-center">Status Retirada</th>
                                <th className="p-3.5">Detalhes da Retirada</th>
                                <th className="p-3.5 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {entregasFiltradas.map((e) => (
                                <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                                    <td className="p-3.5 font-bold text-white">
                                        {e.colaborador_nome}
                                    </td>
                                    <td className="p-3.5">
                                        <div className="text-slate-300">{e.Setor || 'Geral'}</div>
                                        <div className="text-[11px] text-slate-500">{e.Funcao || 'Operador'}</div>
                                    </td>
                                    <td className="p-3.5 text-center">
                                        {e.elegivel === 1 ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                <CheckCircle2 className="w-3 h-3" /> ELEGÍVEL
                                            </span>
                                        ) : (
                                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30" title={e.motivo_inaptidao}>
                                                <XCircle className="w-3 h-3" /> INAPTO
                                            </div>
                                        )}
                                        {e.motivo_inaptidao && (
                                            <div className="text-[10px] text-red-400 mt-1">{e.motivo_inaptidao}</div>
                                        )}
                                    </td>
                                    <td className="p-3.5 text-center">
                                        {e.status === 'entregue' ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                ENTREGUE
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                                PENDENTE
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3.5 text-xs text-slate-400 font-mono">
                                        {e.data_hora_entrega ? (
                                            <div>
                                                <div>Data: {new Date(e.data_hora_entrega).toLocaleString('pt-BR')}</div>
                                                <div className="text-[10px] text-slate-500">Por: {e.entregue_por}</div>
                                                {e.assinatura_hash && (
                                                    <div className="text-[9px] text-emerald-400 flex items-center gap-1 mt-0.5">
                                                        <Fingerprint className="w-3 h-3" /> {e.assinatura_hash.slice(0, 16)}...
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 italic">Aguardando retirada</span>
                                        )}
                                    </td>
                                    <td className="p-3.5 text-center">
                                        {e.status !== 'entregue' && e.elegivel === 1 ? (
                                            <button
                                                onClick={() => handleConfirmarRetirada(e.id, e.colaborador_nome)}
                                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow transition-colors flex items-center gap-1.5 mx-auto"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Registrar Retirada
                                            </button>
                                        ) : (
                                            <span className="text-xs text-slate-500">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Nova Competência */}
            {modalNovoPeriodo && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md text-slate-100 shadow-2xl p-6 space-y-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-amber-500" />
                            Abrir Nova Competência de Cesta Básica
                        </h2>

                        <form onSubmit={handleCriarPeriodo} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Competência (AAAA-MM)</label>
                                <input
                                    type="month"
                                    value={novoPeriodo.competencia}
                                    onChange={(e) => setNovoPeriodo({ ...novoPeriodo, competencia: e.target.value })}
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Descrição</label>
                                <input
                                    type="text"
                                    value={novoPeriodo.descricao}
                                    onChange={(e) => setNovoPeriodo({ ...novoPeriodo, descricao: e.target.value })}
                                    placeholder="Ex: Cesta de Alimentos - Setembro/2026"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Data Liberação</label>
                                    <input
                                        type="date"
                                        value={novoPeriodo.data_liberacao}
                                        onChange={(e) => setNovoPeriodo({ ...novoPeriodo, data_liberacao: e.target.value })}
                                        required
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Data Limite Retirada</label>
                                    <input
                                        type="date"
                                        value={novoPeriodo.data_limite_retirada}
                                        onChange={(e) => setNovoPeriodo({ ...novoPeriodo, data_limite_retirada: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                                    />
                                </div>
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-300">
                                ⚠️ O sistema irá varrer a tabela de faltas injustificadas do mês e travar automaticamente os colaboradores inaptos.
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setModalNovoPeriodo(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                >
                                    {actionLoading ? 'Processando Faltas...' : 'Abrir Competência'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SSTCestaBasica;

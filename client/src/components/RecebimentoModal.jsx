import React, { useState, useEffect, useRef } from 'react';
import { X, Save, AlertCircle, Calendar, User, FileText, Package, Trash2, History, ChevronDown, ChevronUp, DownloadCloud } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function RecebimentoModal({ isOpen, onClose, selectedItem, onSaveSuccess }) {
    const { user } = useAuth();
    const [quantidade, setQuantidade] = useState('');
    const [observacao, setObservacao] = useState('');
    const getLocalDatetime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    };
    const [dataRecebimento, setDataRecebimento] = useState(getLocalDatetime());
    const [saving, setSaving] = useState(false);

    const [historico, setHistorico] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const [isHistoricoOpen, setIsHistoricoOpen] = useState(false);

    const inputQtdRef = useRef(null);

    useEffect(() => {
        if (isOpen && selectedItem) {
            // Preenche o input por padrão com o saldo total que falta
            setQuantidade(String(selectedItem.saldo_pendente));
            setIsHistoricoOpen(false); // Sempre abre o histórico fechado
            carregarHistorico();

            // Focar automaticamente no input de quantidade e selecionar o texto
            setTimeout(() => {
                if (inputQtdRef.current) {
                    inputQtdRef.current.focus();
                    inputQtdRef.current.select();
                }
            }, 100);
        } else {
            setQuantidade('');
            setObservacao('');
            setHistorico([]);
            setDataRecebimento(getLocalDatetime());
        }
    }, [isOpen, selectedItem]);

    const carregarHistorico = async () => {
        if (!selectedItem) return;
        try {
            setLoadingHistorico(true);
            const { data } = await api.get(`/romaneios/items/${selectedItem.item_id}/historico`);
            setHistorico(data);
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            toast.error('Não foi possível carregar o histórico deste item.');
        } finally {
            setLoadingHistorico(false);
        }
    };

    const handleDeleteHistorico = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este recebimento? O saldo pendente da peça será recalculado.')) return;

        try {
            await api.delete(`/romaneios/recebimentos/${id}`);
            toast.success('Recebimento excluído com sucesso!');
            onSaveSuccess();
            carregarHistorico(); // Recarrega o histórico na tela sem fechar o modal
        } catch (error) {
            console.error('Erro ao excluir recebimento:', error);
            toast.error('Erro ao excluir recebimento.');
        }
    };

    if (!isOpen || !selectedItem) return null;

    const saldoPendente = Number(selectedItem.saldo_pendente);

    const handleSave = async (e) => {
        e.preventDefault();

        const qtdNum = Number(quantidade.replace(',', '.'));
        if (!qtdNum || qtdNum <= 0) {
            toast.warning('Informe uma quantidade válida e maior que zero.');
            return;
        }

        if (qtdNum > saldoPendente) {
            toast.warning(`A quantidade não pode ser maior que o saldo pendente (${saldoPendente}).`);
            return;
        }

        try {
            setSaving(true);
            await api.post(`/romaneios/items/${selectedItem.item_id}/receber`, {
                romaneio_id: selectedItem.romaneio_id,
                quantidade: qtdNum,
                usuario: user?.nome || user?.email || 'Sistema',
                observacao,
                data_recebimento: dataRecebimento
            });

            toast.success('Recebimento registrado com sucesso!');
            onSaveSuccess();
            onClose();
            setQuantidade('');
            setObservacao('');
        } catch (error) {
            console.error('Erro ao salvar recebimento:', error);
            toast.error(error.response?.data?.error || 'Erro ao registrar recebimento');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <DownloadCloud className="w-5 h-5 text-green-600" />
                        Registrar Retorno
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">

                    {/* INFO BOX - Compacto (Padrão Produção) */}
                    <div className="bg-slate-50 p-2 rounded text-xs border border-slate-200">
                        <div className="flex justify-between items-center mb-1">
                            <p><strong>Romaneio:</strong> {selectedItem.romaneio_id}</p>
                            <p className="text-slate-500 text-right">Loja {selectedItem.fornecedor_cod}</p>
                        </div>
                        <p className="mb-1"><strong>Produto:</strong> {selectedItem.codigo_produto} <span className="text-slate-500">({selectedItem.descricao_produto})</span></p>

                        <div className="flex justify-between items-center pt-1 border-t border-slate-200 mt-2">
                            <p><strong>Enviado:</strong> {Number(selectedItem.quantidade_enviada).toLocaleString('pt-BR')} un</p>
                            <p>
                                <strong>Saldo Pendente: </strong>
                                <span className={`font-bold ${saldoPendente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {saldoPendente.toLocaleString('pt-BR')}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Histórico Integrado Collapsible (Padrão Produção) */}
                    {loadingHistorico ? (
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center text-sm text-slate-500">
                            <History className="w-4 h-4 inline-block mr-2 animate-pulse" />
                            Carregando histórico...
                        </div>
                    ) : historico.length > 0 ? (
                        <div className="bg-slate-50 border border-slate-200 rounded overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setIsHistoricoOpen(!isHistoricoOpen)}
                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors"
                            >
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                    <History className="w-4 h-4 text-slate-500" />
                                    Histórico ({historico.length} recebimento{historico.length !== 1 ? 's' : ''})
                                </span>
                                {isHistoricoOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </button>

                            {isHistoricoOpen && (
                                <div className="max-h-60 overflow-y-auto border-t border-slate-200">
                                    {historico.map((rec) => {
                                        const dataRecebe = new Date(rec.data_recebimento);
                                        const isTodayStr = new Date().toISOString().split('T')[0];
                                        const isToday = dataRecebe.toDateString() === new Date().toDateString();

                                        return (
                                            <div key={rec.id} className="p-3 border-b border-slate-100 last:border-b-0 hover:bg-white transition-colors relative group">
                                                <button
                                                    onClick={() => handleDeleteHistorico(rec.id)}
                                                    className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                                                    title="Excluir este recebimento"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="flex items-start justify-between gap-2 mb-1 pr-6">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold text-sm">
                                                            {Number(rec.quantidade).toLocaleString('pt-BR')} un
                                                        </div>
                                                        <span className="text-xs text-slate-600 font-medium">{rec.usuario || 'Sistema'}</span>
                                                    </div>
                                                    <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                                                        {isToday ? 'Hoje' : dataRecebe.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                        {' '}{dataRecebe.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                                                    </span>
                                                </div>
                                                {rec.observacao && (
                                                    <div className="text-xs text-slate-500 italic bg-slate-50 px-2 py-1 rounded mt-1">
                                                        "{rec.observacao}"
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded text-sm text-blue-700 flex items-center gap-2">
                            <History className="w-4 h-4" />
                            <span>Nenhum recebimento anterior registrado</span>
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-3">
                        <div className="bg-slate-50 p-2.5 rounded border">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-slate-700">Qtd. Solicitada Recebimento</label>
                                <span className="text-xs font-bold text-slate-500">Máx: {saldoPendente}</span>
                            </div>
                            <input
                                ref={inputQtdRef}
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={saldoPendente}
                                required
                                value={quantidade}
                                onChange={(e) => setQuantidade(e.target.value)}
                                placeholder="Ex: 50"
                                className="w-full border rounded p-2 text-lg text-slate-900 border-slate-300 focus:border-indigo-500 outline-none"
                            />

                            <div className="mt-1 flex justify-between text-[11px]">
                                <span className="text-slate-400">Enviado Total: {Number(selectedItem.quantidade_enviada)}</span>
                                {Number(quantidade) > saldoPendente && (
                                    <span className="text-red-600 font-bold flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Excede saldo!
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Data e Hora de Recebimento</label>
                            <input
                                type="datetime-local"
                                required
                                value={dataRecebimento}
                                onChange={(e) => setDataRecebimento(e.target.value)}
                                className="w-full border rounded p-2 text-sm text-slate-900 border-slate-300 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Observação (Opcional)</label>
                            <textarea
                                className="w-full border rounded p-2 text-sm text-slate-900 border-slate-300 focus:border-indigo-500 outline-none"
                                rows="2"
                                value={observacao}
                                onChange={(e) => setObservacao(e.target.value)}
                                placeholder="Peças danificadas, erros, etc..."
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={saving || Number(quantidade) > saldoPendente || Number(quantidade) <= 0}
                            className="w-full bg-green-600 text-white rounded-lg p-2 font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Salvando...' : 'Confirmar Recebimento'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

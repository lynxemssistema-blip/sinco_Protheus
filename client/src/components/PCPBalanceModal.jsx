import React, { useState } from 'react';
import { Calendar, X, AlertCircle, ArrowLeft, Check, TableProperties, Loader2 } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function PCPBalanceModal({ isOpen, onClose, selectedItems, onSaveSuccess, usuario, canEdit = true }) {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [allowedDays, setAllowedDays] = useState([1, 2, 3, 4, 5]); // Seg a Sex por padrão
    const [overwrite, setOverwrite] = useState(false);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [saveProgress, setSaveProgress] = useState(null);

    if (!isOpen || !selectedItems || selectedItems.length === 0) return null;

    const daysOfWeek = [
        { id: 1, label: 'Segunda' },
        { id: 2, label: 'Terça' },
        { id: 3, label: 'Quarta' },
        { id: 4, label: 'Quinta' },
        { id: 5, label: 'Sexta' },
        { id: 6, label: 'Sábado' },
        { id: 0, label: 'Domingo' }
    ];

    const handleToggleDay = (id) => {
        setAllowedDays(prev => 
            prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
        );
    };

    const handlePreview = () => {
        if (!startDate || !endDate) {
            toast.error('Preencha as datas de início e fim.');
            return;
        }
        if (allowedDays.length === 0) {
            toast.error('Selecione ao menos um dia da semana.');
            return;
        }

        // Validação e formatação igual ao backend
        const validItems = selectedItems.filter(i => {
            const saldo = parseFloat(i.saldo_a_faturar || i.qtd_faturar || i.quantidade || 0);
            return saldo > 0;
        });

        if (validItems.length === 0) {
            toast.error('Nenhum dos itens selecionados possui saldo pendente.');
            return;
        }

        const validDays = [];
        let current = new Date(startDate + 'T12:00:00Z');
        const end = new Date(endDate + 'T12:00:00Z');

        while (current <= end) {
            const dayOfWeek = current.getUTCDay();
            if (allowedDays.includes(dayOfWeek)) {
                validDays.push(current.toISOString().split('T')[0]);
            }
            current.setUTCDate(current.getUTCDate() + 1);
        }

        if (validDays.length === 0) {
            toast.error('Nenhum dia válido encontrado no período informado.');
            return;
        }

        // Cálculo de evolução da OP
        const calculateEvolution = (item) => {
            const hasOP = !!item.op_num || !!item.op_protheus;
            const opQtd = parseFloat(item.op_qtd || 0);
            const saldoProd = parseFloat(item.saldo_produzido || 0);
            
            if (!hasOP) return -1; // Sem OP (Última prioridade)
            if (opQtd > 0) return (saldoProd / opQtd) * 100;
            return 0; // Com OP, mas sem produção
        };

        // Ordenar do mais evoluído para o menos evoluído
        validItems.sort((a, b) => {
            const evoA = calculateEvolution(a);
            const evoB = calculateEvolution(b);
            return evoB - evoA;
        });

        const totalItems = validItems.length;
        const totalDays = validDays.length;
        const baseSize = Math.floor(totalItems / totalDays);
        const remainder = totalItems % totalDays;
        const capacities = validDays.map((_, i) => baseSize + (i < remainder ? 1 : 0));

        let currentDayIndex = 0;
        let itemsInCurrentDay = 0;
        const sim = [];

        validItems.forEach(item => {
            if (itemsInCurrentDay >= capacities[currentDayIndex]) {
                currentDayIndex++;
                itemsInCurrentDay = 0;
            }
            const dateToAssign = validDays[currentDayIndex];
            itemsInCurrentDay++;

            const saldo = parseFloat(item.saldo_a_faturar || item.qtd_faturar || item.quantidade || 0);
            sim.push({
                pedido: String(item.pedido).trim(),
                item: String(item.item).trim(),
                produto: String(item.codigo || item.produto || '').trim(),
                descricao: item.descricao || item.desc_venda || '',
                data_pcp: dateToAssign,
                quantidade: saldo,
                originalItem: item
            });
        });

        setPreviewData(sim.sort((a, b) => new Date(a.data_pcp) - new Date(b.data_pcp)));
    };

    const handleSave = async () => {
        if (!previewData) return;

        setLoading(true);
        setSaveProgress({ current: 0, total: previewData.length });

        try {
            const CHUNK_SIZE = 50;
            const payloadItems = previewData.map(p => ({
                ...p.originalItem,
                qtd_faturar: p.quantidade,
                pedido: p.pedido,
                item: p.item,
                codigo: p.produto,
                data_pcp: p.data_pcp
            }));

            let processedCount = 0;
            const avisos = [];

            // Processamento em pequenos lotes para não sobrecarregar e mostrar progresso
            for (let i = 0; i < payloadItems.length; i += CHUNK_SIZE) {
                const chunk = payloadItems.slice(i, i + CHUNK_SIZE);
                
                // Highlight and auto-scroll to the first item of this chunk
                const elId = `balance-item-${i}`;
                const el = document.getElementById(elId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                
                const payload = {
                    items: chunk,
                    startDate,
                    endDate,
                    allowedDays,
                    overwrite,
                    usuario
                };

                const res = await api.post('/pedidos/pcp-forecasts/balance', payload, { timeout: 60000 });
                
                if (res.data?.success) {
                    processedCount += chunk.length;
                    if (Array.isArray(res.data.avisos)) avisos.push(...res.data.avisos);
                    setSaveProgress({ current: processedCount, total: payloadItems.length });
                } else {
                    throw new Error(res.data?.error || 'Erro desconhecido no servidor.');
                }
            }

            toast.success(`Balanceamento concluído! ${processedCount - avisos.filter(a => a.motivo?.startsWith('Item fracionado')).length} itens salvos com sucesso.`);
            // Itens fracionados (não alterados) e travados (só a Data PCP mudou)
            avisos.slice(0, 5).forEach(a => toast.warning(`Pedido ${a.pedido} / Item ${a.item}: ${a.motivo}`, { autoClose: 8000 }));
            if (avisos.length > 5) toast.warning(`+${avisos.length - 5} item(ns) com aviso (fracionados ou travados).`, { autoClose: 8000 });
            onSaveSuccess();
            onClose();
        } catch (err) {
            console.error('Balance error:', err);
            toast.error(err.response?.data?.error || err.message || 'Falha na comunicação com o servidor.');
        } finally {
            setLoading(false);
            setSaveProgress(null);
        }
    };

    const formatDateBR = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`bg-white rounded-xl shadow-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-all ${previewData ? 'max-w-4xl' : 'max-w-lg'}`}>
                <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-6 w-6" />
                        <div>
                            <h2 className="text-lg font-bold">Balanceamento Inteligente PCP</h2>
                            <p className="text-indigo-100 text-xs">
                                {selectedItems.length} Itens Selecionados
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-indigo-500 rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {!previewData ? (
                    <>
                        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
                            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3 border border-blue-100">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                                <div className="text-sm">
                                    <p className="font-semibold mb-1">Como funciona?</p>
                                    <p>Os itens selecionados serão agrupados por <b>Peça (Produto)</b>. Peças iguais receberão a mesma data. As entregas serão distribuídas sequencialmente entre as datas e dias da semana escolhidos.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Início</label>
                                    <input 
                                        type="date" 
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data Final</label>
                                    <input 
                                        type="date" 
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Dias da Semana Permitidos</label>
                                <div className="flex flex-wrap gap-2">
                                    {daysOfWeek.map(day => (
                                        <button
                                            key={day.id}
                                            onClick={() => handleToggleDay(day.id)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                                                allowedDays.includes(day.id)
                                                    ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                                                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={overwrite}
                                        onChange={(e) => setOverwrite(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-800">Sobrescrever datas existentes</span>
                                        <span className="text-xs text-gray-500">Se marcado, itens que já possuem Data PCP terão suas datas alteradas. Se desmarcado, serão ignorados ou mantidos.</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
                            <button 
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            {canEdit && (
                                <button 
                                    onClick={handlePreview}
                                    className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md rounded-lg flex items-center gap-2 transition-all"
                                >
                                    <TableProperties className="w-4 h-4" />
                                    Visualizar Alocação
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-gray-800 text-lg">Pré-visualização da Alocação</h3>
                                <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
                                    {previewData.length} itens a serem alocados
                                </div>
                            </div>
                            
                            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Data PCP</th>
                                            <th className="px-4 py-3 font-semibold">Pedido/Item</th>
                                            <th className="px-4 py-3 font-semibold">Produto</th>
                                            <th className="px-4 py-3 font-semibold">Qtd.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {previewData.map((row, idx) => {
                                            const isProcessed = saveProgress && idx < saveProgress.current;
                                            const isProcessing = saveProgress && idx >= saveProgress.current && idx < saveProgress.current + 50; // CHUNK_SIZE = 50
                                            
                                            return (
                                            <tr id={`balance-item-${idx}`} key={idx} className={`transition-colors duration-300 ${
                                                isProcessing ? 'bg-indigo-50 shadow-inner' :
                                                isProcessed ? 'bg-emerald-50/40 opacity-80' : 'hover:bg-indigo-50/30'
                                            }`}>
                                                <td className="px-4 py-3 font-medium text-indigo-700 whitespace-nowrap flex items-center gap-2">
                                                    {formatDateBR(row.data_pcp)}
                                                    {isProcessing && (
                                                        <span className="inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-800 items-center gap-1">
                                                            <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
                                                        </span>
                                                    )}
                                                    {isProcessed && (
                                                        <span className="inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 items-center gap-1">
                                                            <Check className="w-3 h-3" /> Salvo
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {row.pedido} / {row.item}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-gray-800">{row.produto}</div>
                                                    <div className="text-xs text-gray-500 truncate max-w-xs" title={row.descricao}>
                                                        {row.descricao}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-bold text-gray-700">
                                                    {row.quantidade}
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 px-6 py-4 flex justify-between gap-3 border-t shrink-0">
                            <button 
                                onClick={() => setPreviewData(null)}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Voltar aos Parâmetros
                            </button>
                            <div className="flex gap-3">
                                <button 
                                    onClick={onClose}
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                {canEdit && (
                                    <button 
                                        onClick={handleSave}
                                        disabled={loading}
                                        className={`px-6 py-2 text-sm font-bold text-white rounded-lg flex items-center justify-center gap-2 transition-all relative overflow-hidden min-w-[180px] ${
                                            loading ? 'bg-green-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg'
                                        }`}
                                    >
                                        {saveProgress && (
                                            <div 
                                                className="absolute left-0 top-0 bottom-0 bg-green-700 opacity-40 transition-all duration-300"
                                                style={{ width: `${(saveProgress.current / saveProgress.total) * 100}%` }}
                                            />
                                        )}
                                        <span className="relative z-10 flex items-center gap-2">
                                            {loading ? (
                                                `Salvando... ${saveProgress ? Math.round((saveProgress.current / saveProgress.total) * 100) : 0}%`
                                            ) : (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    Confirmar e Salvar
                                                </>
                                            )}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}


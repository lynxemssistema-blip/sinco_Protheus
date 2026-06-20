import React, { useState, useEffect, useMemo } from 'react';
import { Scissors, Loader2, ChevronDown, ChevronRight, Package, Calendar, User, Search, Layers, FileSpreadsheet, X, LayoutGrid, List, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

// ============================================================================
// [1] CONTROLLER (ALCENETIZAÇÃO - ISOLAMENTO LÓGICO)
// ============================================================================
function useCorteReleaseController() {
    const [lotes, setLotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedLoteId, setExpandedLoteId] = useState(null);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [viewMode, setViewMode] = useState('card');

    useEffect(() => {
        fetchLotes();
    }, []);

    const fetchLotes = async () => {
        setLoading(true);
        try {
            const res = await api.get('/corte/lotes-detalhados');
            setLotes(res.data || []);
        } catch (e) {
            console.error(e);
            toast.error('ERRO AO CARREGAR LOTES DE CORTE.');
        } finally {
            setLoading(false);
        }
    };

    const handleReexportExcel = async (loteId, loteNumero) => {
        try {
            toast.info('REGERANDO ARQUIVO EXCEL...');
            const response = await api.post(`/corte/lotes/${loteId}/excel`, {}, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${loteNumero || 'Lote'}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('PLANILHA EXCEL BAIXADA COM SUCESSO!');
        } catch (e) {
            console.error(e);
            toast.error('ERRO DE CONEXÃO AO BAIXAR PLANILHA EXCEL.');
        }
    };

    const handleExportEspelho = async () => {
        const selectedLoteIds = Array.from(selectedIds);
        if (selectedLoteIds.length === 0) {
            toast.warning('SELECIONE AO MENOS UM LOTE PARA EXPORTAR.');
            return;
        }
        try {
            toast.info('GERANDO ESPELHO OS-CORTE...');
            const response = await api.post('/corte/lotes/exportar-espelho', { loteIds: selectedLoteIds }, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Espelho_OS_Corte_${new Date().toISOString().slice(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('ESPELHO OS-CORTE GERADO COM SUCESSO!');
        } catch (e) {
            console.error(e);
            toast.error('ERRO AO GERAR ESPELHO OS-CORTE.');
        }
    };

    const handleBulkStatusUpdate = async (novoStatus) => {
        const selectedLoteIds = Array.from(selectedIds);
        if (selectedLoteIds.length === 0) return;
        try {
            await api.put('/corte/lotes/status-material-lote', { loteIds: selectedLoteIds, status_material: novoStatus });
            setLotes(prev => prev.map(l => selectedLoteIds.includes(l.id) ? { ...l, status_material: novoStatus } : l));
            toast.success(`${selectedLoteIds.length} LOTE(S) MARCADO(S) COMO ${novoStatus.toUpperCase()}.`);
        } catch (e) {
            console.error(e);
            toast.error('ERRO AO ATUALIZAR STATUS DOS LOTES.');
        }
    };

    const handleExportRelatorio = (filteredLotes) => {
        const selectedLotes = filteredLotes.filter(l => selectedIds.has(l.id));
        if (selectedLotes.length === 0) {
            toast.warning('SELECIONE AO MENOS UM LOTE PARA EXPORTAR.');
            return;
        }

        const wb = XLSX.utils.book_new();

        // Aba 1: Resumo por lote
        const resumoData = [
            ['RELATÓRIO DE LIBERAÇÃO DE CORTE'],
            [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
            [],
            ['Nº do Lote', 'Recurso', 'Cód. Material', 'Descrição do Material', 'Total Peças', 'Data Criação', 'Usuário'],
        ];
        for (const lote of selectedLotes) {
            const recursoNome = lote.recurso === 'MO0013' || lote.recurso === 'Laser' ? 'Laser' : 'Puncionadeira';
            const totalPecas = lote.items?.reduce((acc, i) => acc + parseFloat(i.qtd_necessaria || 0), 0) || 0;
            resumoData.push([
                lote.numero_lote,
                recursoNome,
                lote.material_codigo || '',
                lote.material_descricao || '',
                totalPecas,
                new Date(lote.data_criacao).toLocaleString('pt-BR'),
                lote.usuario || '',
            ]);
        }
        const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
        wsResumo['!cols'] = [{ wch: 36 }, { wch: 14 }, { wch: 16 }, { wch: 42 }, { wch: 14 }, { wch: 20 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

        // Aba 2: Itens detalhados
        const itensData = [
            ['Nº do Lote', 'Recurso', 'Material', 'Pedido', 'Item', 'Produto Pai', 'Componente', 'Descrição Componente', 'Nº OP', 'Qtd. Necessária', 'Status'],
        ];
        for (const lote of selectedLotes) {
            const recursoNome = lote.recurso === 'MO0013' || lote.recurso === 'Laser' ? 'Laser' : 'Puncionadeira';
            for (const item of (lote.items || [])) {
                itensData.push([
                    lote.numero_lote,
                    recursoNome,
                    `${lote.material_codigo || ''} - ${lote.material_descricao || ''}`,
                    item.pedido_pai || '',
                    item.item_pai || '',
                    item.produto_pai || '',
                    item.componente || '',
                    item.componente_descricao || '',
                    item.op_numero || '',
                    parseFloat(item.qtd_necessaria || 0),
                    item.status || 'Pendente',
                ]);
            }
        }
        const wsItens = XLSX.utils.aoa_to_sheet(itensData);
        wsItens['!cols'] = [{ wch: 36 }, { wch: 14 }, { wch: 46 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 46 }, { wch: 20 }, { wch: 16 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsItens, 'Itens Detalhados');

        const filename = `Relatorio_Liberacao_Corte_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        toast.success(`RELATÓRIO GERADO PARA ${selectedLotes.length} LOTE(S).`);
    };

    const filteredLotes = useMemo(() => {
        return lotes.filter(l =>
            l.numero_lote?.toLowerCase().includes(search.toLowerCase()) ||
            l.material_codigo?.toLowerCase().includes(search.toLowerCase()) ||
            l.material_descricao?.toLowerCase().includes(search.toLowerCase())
        );
    }, [lotes, search]);

    const handleUpdateStatusMaterial = async (loteId, novoStatus) => {
        try {
            await api.put(`/corte/lotes/${loteId}/status-material`, { status_material: novoStatus });
            setLotes(prev => prev.map(l => l.id === loteId ? { ...l, status_material: novoStatus } : l));
            toast.success(`Status do material atualizado para ${novoStatus}.`);
        } catch (e) {
            console.error(e);
            toast.error('ERRO AO ATUALIZAR STATUS DO MATERIAL.');
        }
    };

    return {
        state: { loading, expandedLoteId, search, selectedIds, viewMode, filteredLotes },
        actions: { setExpandedLoteId, setSearch, setSelectedIds, setViewMode, fetchLotes, handleReexportExcel, handleExportEspelho, handleExportRelatorio, handleUpdateStatusMaterial, handleBulkStatusUpdate }
    };
}

// ============================================================================
// [2] COMPONENTES DE APRESENTAÇÃO (METALFISMO DE DESIGN)
// ============================================================================

export default function CorteReleaseTab() {
    const { state, actions } = useCorteReleaseController();
    const { loading, expandedLoteId, search, selectedIds, viewMode, filteredLotes } = state;
    const { handleBulkStatusUpdate } = actions;

    const allFilteredSelected = filteredLotes.length > 0 && filteredLotes.every(l => selectedIds.has(l.id));
    const someFilteredSelected = filteredLotes.some(l => selectedIds.has(l.id));
    const selectedCount = filteredLotes.filter(l => selectedIds.has(l.id)).length;

    const toggleSelect = (id) => {
        actions.setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        actions.setSelectedIds(prev => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                filteredLotes.forEach(l => next.delete(l.id));
            } else {
                filteredLotes.forEach(l => next.add(l.id));
            }
            return next;
        });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6 bg-[#0d111a] text-gray-200 font-sans p-6 min-h-full rounded-xl">
            {/* Header & Filter */}
            <div className="bg-[#111827] rounded-xl p-6 border border-[#1f2937] shadow-lg space-y-5">
                <div className="flex items-center justify-between border-b border-[#1f2937] pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#38bdf8]/10 rounded border border-[#38bdf8]/30">
                            <Scissors className="w-5 h-5 text-[#38bdf8]" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black font-sans tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
                                FILTROS E LIBERAÇÃO DE CORTE
                            </h2>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                                GESTÃO DE LOTES GERADOS PARA CHÃO DE FÁBRICA
                            </p>
                        </div>
                        <span className="ml-4 font-mono text-xs font-bold text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded border border-[#10b981]/30">
                            {filteredLotes.length} LOTES
                        </span>
                    </div>
                    <div className="flex bg-[#0b0f19] p-1 rounded-md border border-[#1f2937]">
                        <button
                            onClick={() => actions.setViewMode('card')}
                            className={`px-4 py-2 text-[10px] font-bold rounded-sm flex items-center gap-2 uppercase tracking-widest transition-all ${viewMode === 'card' ? 'bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30 shadow-sm' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            CARDS
                        </button>
                        <button
                            onClick={() => actions.setViewMode('table')}
                            className={`px-4 py-2 text-[10px] font-bold rounded-sm flex items-center gap-2 uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30 shadow-sm' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}
                        >
                            <List className="w-4 h-4" />
                            TABELA
                        </button>
                    </div>
                </div>

                <div className="flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-[250px] space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">BUSCAR LOTES</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#38bdf8]" />
                            <input
                                type="text"
                                placeholder="Nº LOTE OU MATERIAL..."
                                value={search}
                                onChange={e => actions.setSearch(e.target.value)}
                                className="w-full bg-[#0b0f19] text-gray-200 border border-[#1f2937] rounded-md pl-10 pr-4 py-2.5 text-xs focus:ring-1 focus:ring-[#38bdf8] focus:border-[#38bdf8] outline-none font-mono tracking-wider transition-all placeholder-gray-600"
                            />
                        </div>
                    </div>
                    <div className="flex items-end gap-3">
                        <button
                            onClick={actions.fetchLotes}
                            className="px-6 py-2.5 bg-gradient-to-r from-[#10b981] to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-[#0b0f19] rounded-md text-xs font-black uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all flex items-center gap-2"
                        >
                            <Search className="w-4 h-4" /> ATUALIZAR
                        </button>
                    </div>
                </div>

                {/* Barra de seleção em lote */}
                {filteredLotes.length > 0 && (
                    <div className="flex items-center gap-4 pt-4 border-t border-[#1f2937]">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={allFilteredSelected}
                                ref={el => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 rounded bg-[#0b0f19] border-[#38bdf8] text-[#38bdf8] focus:ring-[#38bdf8] cursor-pointer focus:ring-offset-[#111827]"
                            />
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                                {allFilteredSelected ? 'DESMARCAR TODOS' : 'SELECIONAR TODOS'}
                            </span>
                        </label>

                        {selectedCount > 0 && (
                            <div className="flex items-center gap-3">
                                <span className="text-gray-600">|</span>
                                <span className="text-[10px] font-bold text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30 px-3 py-1 rounded-sm uppercase tracking-widest">
                                    {selectedCount} SELECIONADO(S)
                                </span>
                                <button
                                    onClick={actions.handleExportEspelho}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-[#1f2937] hover:bg-[#374151] text-gray-200 border border-gray-600 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-sm transition-all"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-[#10b981]" />
                                    IMPRIMIR ESPELHO
                                </button>
                                <button
                                    onClick={() => actions.handleExportRelatorio(filteredLotes)}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-[#1f2937] hover:bg-[#374151] text-gray-200 border border-gray-600 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-sm transition-all"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-[#38bdf8]" />
                                    RELATÓRIO RESUMIDO
                                </button>
                                <button
                                    onClick={() => handleBulkStatusUpdate('Liberado')}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all"
                                >
                                    <span className="w-2 h-2 rounded-full bg-[#10b981]" /> LIBERAR TODOS
                                </button>
                                <button
                                    onClick={() => handleBulkStatusUpdate('Pendente')}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all"
                                >
                                    <span className="w-2 h-2 rounded-full bg-amber-500" /> MARCAR PENDENTE
                                </button>
                                <button
                                    onClick={() => actions.setSelectedIds(new Set())}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-gray-700 text-gray-500 rounded-md text-[10px] font-bold hover:text-gray-300 hover:border-gray-500 uppercase tracking-widest transition-all"
                                >
                                    <X className="w-3.5 h-3.5" /> LIMPAR
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* List */}
            {loading ? (
                <div className="bg-[#111827] rounded-xl p-12 border border-[#1f2937] flex flex-col items-center justify-center text-[#38bdf8]">
                    <Loader2 className="w-10 h-10 animate-spin mb-4 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
                    <p className="font-bold tracking-widest text-xs uppercase text-[#38bdf8]">CARREGANDO LOTES DE CORTE...</p>
                </div>
            ) : filteredLotes.length === 0 ? (
                <div className="bg-[#111827] rounded-xl p-12 border border-[#1f2937] flex flex-col items-center justify-center text-gray-500 border-dashed">
                    <AlertTriangle className="w-12 h-12 mb-4 text-amber-500/50" />
                    <p className="font-bold tracking-widest text-xs uppercase text-gray-400">NENHUM LOTE ENCONTRADO.</p>
                </div>
            ) : viewMode === 'table' ? (
                <div className="bg-[#111827] rounded-xl border border-[#1f2937] shadow-lg overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#0b0f19] border-b border-[#1f2937] text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    <th className="pl-6 pr-4 py-4 w-12">SEL</th>
                                    <th className="px-4 py-4">Nº LOTE</th>
                                    <th className="px-4 py-4">DATA GERAÇÃO</th>
                                    <th className="px-4 py-4">RECURSO (MÁQUINA)</th>
                                    <th className="px-4 py-4">MATERIAL / CHAPA</th>
                                    <th className="px-4 py-4">STATUS MATERIAL</th>
                                    <th className="px-4 py-4 text-right">QTD TOTAL</th>
                                    <th className="px-6 py-4 text-right">AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1f2937]/50">
                                {filteredLotes.map(lote => {
                                    const isSelected = selectedIds.has(lote.id);
                                    const totalPecas = lote.items?.reduce((acc, curr) => acc + parseFloat(curr.qtd_necessaria || 0), 0);
                                    const isLaser = lote.recurso === 'MO0013' || lote.recurso === 'Laser';
                                    const recursoNome = isLaser ? 'LASER' : 'PUNCIONADEIRA';
                                    const badgeColor = isLaser ? 'bg-[#10b981]' : 'bg-amber-500';
                                    
                                    return (
                                        <tr 
                                            key={lote.id} 
                                            className={`hover:bg-[#1f2937]/30 transition-colors cursor-pointer ${isSelected ? 'bg-[#38bdf8]/5' : ''}`} 
                                            onClick={() => toggleSelect(lote.id)}
                                        >
                                            <td className="pl-6 pr-4 py-3.5">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}}
                                                    onClick={e => { e.stopPropagation(); toggleSelect(lote.id); }}
                                                    className="w-4 h-4 rounded bg-[#0b0f19] border-[#38bdf8] text-[#38bdf8] focus:ring-[#38bdf8] cursor-pointer focus:ring-offset-[#111827]"
                                                />
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`font-mono font-bold text-sm ${isSelected ? 'text-[#38bdf8]' : 'text-gray-200'}`}>
                                                    {lote.numero_lote}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className="font-mono text-xs font-medium text-gray-500 whitespace-nowrap">
                                                    {formatDate(lote.data_criacao)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${badgeColor} shadow-[0_0_5px_currentColor]`} />
                                                    <span className="font-bold text-gray-300 text-[10px] tracking-wider uppercase">{recursoNome}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="text-xs text-gray-400 max-w-[200px] xl:max-w-xs truncate uppercase tracking-wide" title={`${lote.material_codigo} - ${lote.material_descricao}`}>
                                                    <span className="font-mono font-bold text-gray-200 mr-2">{lote.material_codigo}</span> 
                                                    {lote.material_descricao}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        actions.handleUpdateStatusMaterial(lote.id, lote.status_material === 'Liberado' ? 'Pendente' : 'Liberado');
                                                    }}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${lote.status_material === 'Liberado' ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-amber-500/10 text-amber-500 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]'}`}
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${lote.status_material === 'Liberado' ? 'bg-[#10b981] shadow-[0_0_5px_currentColor]' : 'bg-amber-500 shadow-[0_0_5px_currentColor] animate-pulse'}`}></span>
                                                    {lote.status_material === 'Liberado' ? 'LIBERADO' : 'PENDENTE'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                <span className="font-mono font-black text-[#10b981] text-sm">
                                                    {totalPecas?.toLocaleString('pt-BR')} <span className="text-[10px] font-normal text-gray-500 uppercase">UN</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 text-right">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); actions.handleReexportExcel(lote.id, lote.numero_lote); }}
                                                    className="p-2 bg-[#1f2937] hover:bg-[#38bdf8]/10 text-gray-400 hover:text-[#38bdf8] rounded border border-gray-700 hover:border-[#38bdf8]/30 transition-all inline-flex items-center"
                                                    title="BAIXAR PLANILHA"
                                                >
                                                    <FileSpreadsheet className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    {filteredLotes.map(lote => {
                        const isExpanded = expandedLoteId === lote.id;
                        const isSelected = selectedIds.has(lote.id);

                        const itemsByPedido = {};
                        lote.items?.forEach(item => {
                            const key = `${item.pedido_pai} - Item ${item.item_pai}`;
                            if (!itemsByPedido[key]) itemsByPedido[key] = [];
                            itemsByPedido[key].push(item);
                        });

                        const totalPecas = lote.items?.reduce((acc, curr) => acc + parseFloat(curr.qtd_necessaria || 0), 0);
                        const isLaser = lote.recurso === 'MO0013' || lote.recurso === 'Laser';
                        const recursoNome = isLaser ? 'LASER' : 'PUNCIONADEIRA';
                        const badgeColor = isLaser ? 'bg-[#10b981]' : 'bg-amber-500';

                        return (
                            <div
                                key={lote.id}
                                className={`bg-[#111827] rounded-xl border overflow-hidden transition-all duration-200 shadow-md ${isSelected ? 'border-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.1)]' : 'border-[#1f2937]'}`}
                            >
                                {/* Linha Principal */}
                                <div
                                    className={`px-6 py-5 flex items-center cursor-pointer transition-colors ${isExpanded ? 'bg-[#1f2937]/30' : 'hover:bg-[#1f2937]/20'}`}
                                    onClick={() => actions.setExpandedLoteId(isExpanded ? null : lote.id)}
                                >
                                    <div className="mr-5" onClick={e => { e.stopPropagation(); toggleSelect(lote.id); }}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelect(lote.id)}
                                            className="w-4 h-4 rounded bg-[#0b0f19] border-[#38bdf8] text-[#38bdf8] focus:ring-[#38bdf8] cursor-pointer focus:ring-offset-[#111827]"
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </div>

                                    <div className="mr-5 text-gray-500">
                                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                    </div>

                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-6">
                                        <div>
                                            <p className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mb-1">Nº LOTE</p>
                                            <p className={`font-mono font-black text-base ${isSelected ? 'text-[#38bdf8]' : 'text-gray-200'}`}>
                                                {lote.numero_lote}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mb-1">MÁQUINA</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2.5 h-2.5 rounded-full ${badgeColor} shadow-[0_0_5px_currentColor]`} />
                                                <p className="font-bold tracking-wider text-gray-300 text-xs">{recursoNome}</p>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mb-1">MATERIAL / CHAPA MTC</p>
                                            <p className="font-semibold text-gray-300 text-xs truncate uppercase tracking-wide" title={lote.material_descricao}>
                                                <span className="font-mono text-[#10b981] mr-2">{lote.material_codigo}</span>
                                                {lote.material_descricao}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mb-1">STATUS</p>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    actions.handleUpdateStatusMaterial(lote.id, lote.status_material === 'Liberado' ? 'Pendente' : 'Liberado');
                                                }}
                                                className={`flex items-center gap-2 px-3 py-1 rounded-sm text-[9px] font-bold uppercase tracking-widest transition-all ${lote.status_material === 'Liberado' ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-amber-500/10 text-amber-500 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]'}`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${lote.status_material === 'Liberado' ? 'bg-[#10b981] shadow-[0_0_5px_currentColor]' : 'bg-amber-500 shadow-[0_0_5px_currentColor] animate-pulse'}`}></span>
                                                {lote.status_material === 'Liberado' ? 'LIBERADO' : 'PENDENTE'}
                                            </button>
                                        </div>
                                        <div className="text-right flex flex-col justify-center">
                                            <p className="font-mono font-black text-[#10b981] text-xl">
                                                {totalPecas?.toLocaleString('pt-BR')} <span className="text-[10px] font-bold font-sans text-gray-500 uppercase tracking-widest">UN</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="ml-8 flex items-center gap-4 border-l border-[#1f2937] pl-8">
                                        <div className="flex flex-col items-end space-y-2 text-right">
                                            <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400 font-bold uppercase tracking-widest">
                                                <Calendar className="w-3.5 h-3.5 text-[#38bdf8]" /> {formatDate(lote.data_criacao)}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400 font-bold uppercase tracking-widest">
                                                <User className="w-3.5 h-3.5 text-[#10b981]" /> {lote.usuario}
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => { e.stopPropagation(); actions.handleReexportExcel(lote.id, lote.numero_lote); }}
                                            className="p-3 bg-[#1f2937] hover:bg-[#38bdf8]/10 hover:text-[#38bdf8] text-gray-400 rounded-md text-[10px] uppercase tracking-widest font-bold transition-all flex items-center gap-2 border border-gray-700 hover:border-[#38bdf8]/30"
                                            title="EXPORTAR PLANILHA DESTE LOTE"
                                        >
                                            <FileSpreadsheet className="w-4 h-4" />
                                            <span>EXCEL</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Expansão: Agrupamento por Projeto */}
                                {isExpanded && (
                                    <div className="border-t border-[#1f2937] bg-[#0b0f19] p-6 shadow-inner">
                                        {lote.observacao && (
                                            <div className="mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-500 p-4 rounded-md text-xs font-mono uppercase tracking-wide">
                                                <span className="font-black text-amber-400">OBSERVAÇÃO PCP:</span> {lote.observacao}
                                            </div>
                                        )}

                                        <h3 className="text-[11px] font-bold text-gray-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                                            <Layers className="w-4 h-4 text-[#38bdf8]" />
                                            ESTRUTURA DO LOTE POR PROJETO
                                        </h3>

                                        <div className="space-y-5">
                                            {Object.keys(itemsByPedido).map(pedido => (
                                                <div key={pedido} className="bg-[#111827] border border-[#1f2937] rounded-lg overflow-hidden shadow-sm">
                                                    <div className="bg-[#1f2937]/50 border-b border-[#1f2937] px-5 py-3 text-[11px] font-bold text-gray-300 uppercase tracking-widest flex justify-between items-center">
                                                        <span className="flex items-center gap-2">
                                                            <Package className="w-4 h-4 text-[#10b981]" />
                                                            PEDIDO (PV): <span className="font-mono text-gray-100 text-sm">{pedido}</span>
                                                        </span>
                                                        <span className="text-[10px] font-black text-[#38bdf8] bg-[#38bdf8]/10 px-2 py-1 rounded border border-[#38bdf8]/20">
                                                            {itemsByPedido[pedido].length} OPs
                                                        </span>
                                                    </div>
                                                    <div className="divide-y divide-[#1f2937]/50">
                                                        {itemsByPedido[pedido].map(item => (
                                                            <div key={item.id} className="p-5 flex items-center justify-between hover:bg-[#1f2937]/20 transition-colors">
                                                                <div className="flex-1 grid grid-cols-12 gap-5 items-center">
                                                                    <div className="col-span-4">
                                                                        <div className="font-mono font-bold text-gray-200 text-sm">{item.componente}</div>
                                                                        <div className="text-[10px] text-gray-500 truncate mt-0.5 uppercase tracking-wide" title={item.componente_descricao}>{item.componente_descricao}</div>
                                                                    </div>
                                                                    <div className="col-span-3">
                                                                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">ORDEM DE PRODUÇÃO</div>
                                                                        <div className="font-mono text-sm font-black text-gray-300">{item.op_numero || 'N/A'}</div>
                                                                    </div>
                                                                    <div className="col-span-2">
                                                                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">QUANTIDADE</div>
                                                                        <div className="font-mono font-bold text-[#10b981] text-sm">{parseFloat(item.qtd_necessaria).toLocaleString('pt-BR')} UN</div>
                                                                    </div>
                                                                    <div className="col-span-3 flex justify-end">
                                                                        {item.status === 'Concluído' ? (
                                                                            <div className="flex items-center gap-2 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                                                                <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_5px_currentColor]"></span>
                                                                                CONCLUÍDO
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                                                                                <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_currentColor] animate-pulse"></span>
                                                                                PENDENTE
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

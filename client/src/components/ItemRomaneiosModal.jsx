import React, { useState } from 'react';
import { 
    X, Truck, Calendar, Clock, CheckCircle2, AlertCircle, Package, 
    User, FileText, ArrowRight, Layers, Maximize2, Minimize2, 
    ChevronDown, ChevronUp 
} from 'lucide-react';

const fmtDate = (raw) => {
    if (!raw) return '—';
    const s = String(raw).replace(/-/g, '').trim();
    if (s.length === 8) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    if (raw instanceof Date || String(raw).includes('T')) {
        const d = new Date(raw);
        if (!isNaN(d)) return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return String(raw).substring(0, 10) || '—';
};

const fmtShortDate = (raw) => {
    if (!raw) return '—';
    const s = String(raw).replace(/-/g, '').trim();
    if (s.length === 8) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    if (raw instanceof Date || String(raw).includes('T')) {
        const d = new Date(raw);
        if (!isNaN(d)) return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
    return String(raw).substring(0, 10) || '—';
};

const parseNf = (val) => {
    if (!val) return '—';
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '' || trimmed === '[]' || trimmed === 'null' || trimmed === '[""]') return '—';
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const arr = JSON.parse(trimmed);
                if (Array.isArray(arr) && arr.length > 0) {
                    const valid = arr.filter(v => v && String(v).trim() !== '');
                    return valid.length > 0 ? valid.join(', ') : '—';
                }
                return '—';
            } catch (e) {}
        }
        return trimmed;
    }
    if (Array.isArray(val)) {
        const valid = val.filter(v => v && String(v).trim() !== '');
        return valid.length > 0 ? valid.join(', ') : '—';
    }
    return String(val);
};

export default function ItemRomaneiosModal({ isOpen, onClose, itemData }) {
    const [isMax, setIsMax] = useState(false);
    const [collapsedCards, setCollapsedCards] = useState({});

    if (!isOpen || !itemData) return null;

    const { produto, descricao, romaneios = [] } = itemData;

    const toggleCard = (id) => {
        setCollapsedCards(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const totalEnviado = romaneios.reduce((s, r) => s + (Number(r.quantidade_enviada) || 0), 0);
    const totalRecebido = romaneios.reduce((s, r) => s + (Number(r.quantidade_recebida) || 0), 0);
    const totalSaldo = romaneios.reduce((s, r) => s + (Number(r.saldo_pendente) || 0), 0);
    const pctGeral = totalEnviado > 0 ? Math.min(100, Math.round((totalRecebido / totalEnviado) * 100)) : 0;

    return (
        <div className={`fixed inset-0 bg-black/70 z-[999999] flex items-center justify-center backdrop-blur-xs animate-fade-in ${isMax ? 'p-0' : 'p-2 sm:p-4 md:p-6'}`}>
            <div className={`bg-white w-full shadow-2xl flex flex-col min-h-0 overflow-hidden border border-slate-200 transition-all duration-200 ${
                isMax ? 'h-full max-w-none rounded-none' : 'max-w-5xl h-[92vh] max-h-[92vh] rounded-2xl'
            }`}>
                
                {/* Header Superior com Identificação e Controles */}
                <div className="bg-slate-900 text-white px-5 sm:px-6 py-3.5 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400 flex-shrink-0 shadow-inner">
                            <Truck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-base font-bold text-white font-mono tracking-tight">{produto}</h2>
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-blue-300 border border-slate-700 flex-shrink-0">
                                    {romaneios.length} {romaneios.length === 1 ? 'Romaneio' : 'Romaneios'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate max-w-2xl mt-0.5">{descricao || 'Rastreamento de envios para terceiros e retornos'}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 border-l border-slate-700/80 pl-3 flex-shrink-0">
                        <button
                            onClick={() => setIsMax(!isMax)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            title={isMax ? "Restaurar tamanho" : "Maximizar (Tela Cheia)"}
                        >
                            {isMax ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-slate-400 transition-colors"
                            title="Fechar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Resumo Consolidado */}
                <div className="bg-slate-50 border-b border-slate-200 px-5 sm:px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-shrink-0">
                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total de Romaneios</span>
                        <span className="text-base sm:text-lg font-black text-slate-800">{romaneios.length}</span>
                    </div>
                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Enviado</span>
                        <span className="text-base sm:text-lg font-black text-slate-800">{totalEnviado} <span className="text-xs font-normal text-slate-400">PC</span></span>
                    </div>
                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Retornado</span>
                        <span className="text-base sm:text-lg font-black text-emerald-600">{totalRecebido} <span className="text-xs font-normal text-emerald-400">PC ({pctGeral}%)</span></span>
                    </div>
                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo no Terceiro</span>
                        <span className={`text-base sm:text-lg font-black ${totalSaldo > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {totalSaldo} <span className="text-xs font-normal text-slate-400">{totalSaldo === 0 ? '(100% OK)' : 'PC'}</span>
                        </span>
                    </div>
                </div>

                {/* Lista com Rolagem dos Romaneios */}
                <div 
                    className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 bg-slate-100/60"
                    style={{ scrollbarWidth: 'thin' }}
                >
                    {romaneios.map((rom, idx) => {
                        const cardKey = rom.item_id || rom.romaneio_id || idx;
                        const isCollapsed = !!collapsedCards[cardKey];
                        const isRec = rom.status_retorno === 'recebido';
                        const isParc = rom.status_retorno === 'parcial';
                        const pctRom = rom.quantidade_enviada > 0 ? Math.min(100, Math.round((rom.quantidade_recebida / rom.quantidade_enviada) * 100)) : 0;
                        const recebimentos = rom.recebimentos || [];

                        return (
                            <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:shadow-md flex-shrink-0">
                                {/* Header do Romaneio (Clicável para Expandir/Recolher) */}
                                <div 
                                    onClick={() => toggleCard(cardKey)}
                                    className="px-4 sm:px-5 py-3 bg-slate-50 hover:bg-slate-100/80 cursor-pointer border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 select-none transition-colors"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <button 
                                            type="button" 
                                            className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-slate-900 shadow-2xs"
                                        >
                                            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                                        </button>
                                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                                            <Truck className="w-4 h-4 text-blue-600" />
                                            <span>Romaneio #{rom.romaneio_id}</span>
                                        </div>
                                        {rom.romaneio_tipo && (
                                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                                                {rom.romaneio_tipo}
                                            </span>
                                        )}
                                        {rom.pedido && (
                                            <span className="text-[10px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-semibold" title="Vínculo da OP">
                                                OP: {rom.pedido}{rom.item_pedido ? ` / ${rom.item_pedido}` : ''}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="text-xs text-slate-500 hidden sm:block">
                                            <span className="font-semibold text-slate-700">{rom.quantidade_recebida}</span> / {rom.quantidade_enviada} PC
                                        </div>
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-2xs ${
                                            isRec 
                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                                : isParc 
                                                    ? 'bg-blue-50 text-blue-800 border-blue-300' 
                                                    : 'bg-amber-50 text-amber-900 border-amber-300'
                                        }`}>
                                            {isRec ? '✓ 100% Retornado' : isParc ? '⏳ Retorno Parcial' : '🚚 No Terceiro (Pendente)'}
                                        </span>
                                    </div>
                                </div>

                                {/* Corpo do Card (se não colapsado) */}
                                {!isCollapsed && (
                                    <div className="p-4 sm:p-5 flex flex-col gap-4">
                                        {/* Grid de Metadados */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/70">
                                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Fornecedor / Terceiro</span>
                                                <span className="text-xs font-bold text-slate-900 block mt-0.5 leading-snug">{rom.fornecedor_nome || '—'}</span>
                                                {rom.fornecedor_cod && (
                                                    <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">Cód: {rom.fornecedor_cod}</span>
                                                )}
                                            </div>

                                            <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/70">
                                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Datas de Rastreamento</span>
                                                <div className="mt-1 space-y-1 text-xs text-slate-700">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Data Envio:</span>
                                                        <span className="font-semibold text-slate-800">{fmtShortDate(rom.data_liberacao)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Prev. Retorno:</span>
                                                        <span className="font-semibold text-slate-800">{rom.data_previsao_retorno ? fmtShortDate(rom.data_previsao_retorno) : '—'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/70">
                                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Documentos Fiscais</span>
                                                <div className="mt-1 space-y-1 text-xs text-slate-700">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">NF Remessa:</span>
                                                        <span className="font-mono font-semibold text-slate-800">{parseNf(rom.nf_saida)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">NF Retorno:</span>
                                                        <span className="font-mono font-semibold text-slate-800">{parseNf(rom.nf_retorno)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quantidades e Barra de Progresso */}
                                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                                            <div className="flex justify-between items-center mb-1.5 text-xs">
                                                <div className="flex items-center gap-3">
                                                    <span><strong>Enviado:</strong> {rom.quantidade_enviada} PC</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="text-emerald-700"><strong>Recebido:</strong> {rom.quantidade_recebida} PC</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className={rom.saldo_pendente > 0 ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                                                        <strong>Saldo:</strong> {rom.saldo_pendente} PC
                                                    </span>
                                                </div>
                                                <span className="font-bold text-slate-600">{pctRom}%</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-300 ${isRec ? 'bg-emerald-500' : isParc ? 'bg-blue-500' : 'bg-amber-400'}`}
                                                    style={{ width: `${pctRom}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Histórico de Entregas / Recebimentos com Scroll Interno Próprio */}
                                        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                                            <div className="bg-slate-100/90 px-3.5 py-2 text-[11px] font-bold text-slate-700 flex items-center justify-between border-b border-slate-200">
                                                <span className="flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                    Histórico de Entregas / Recebimentos ({recebimentos.length})
                                                </span>
                                                {recebimentos.length > 3 && (
                                                    <span className="text-[10px] text-slate-400 font-normal">
                                                        Role para ver todos
                                                    </span>
                                                )}
                                            </div>

                                            {recebimentos.length > 0 ? (
                                                <div 
                                                    className="max-h-44 overflow-y-auto divide-y divide-slate-100 text-xs"
                                                    style={{ scrollbarWidth: 'thin' }}
                                                >
                                                    {recebimentos.map((rec, rIdx) => (
                                                        <div key={rIdx} className="px-4 py-2.5 flex items-center justify-between bg-white hover:bg-slate-50/80 transition-colors gap-3">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded font-mono text-xs shadow-2xs flex-shrink-0">
                                                                    +{rec.quantidade} PC
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-semibold text-slate-800 text-xs">
                                                                        Recebido em {fmtDate(rec.data_recebimento)}
                                                                    </div>
                                                                    {rec.observacao && (
                                                                        <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-md">
                                                                            Obs: {rec.observacao}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {rec.usuario && (
                                                                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 flex-shrink-0">
                                                                    <User className="w-3 h-3 text-slate-400" />
                                                                    {rec.usuario}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-3 text-xs text-slate-400 italic bg-white">
                                                    Nenhum recebimento registrado ainda para este romaneio.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Rodapé */}
                <div className="bg-slate-50 border-t border-slate-200 px-5 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
                    <span className="text-xs text-slate-500">
                        Total de {romaneios.length} {romaneios.length === 1 ? 'romaneio vinculado' : 'romaneios vinculados'} a este item
                    </span>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

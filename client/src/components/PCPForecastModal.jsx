import React, { useState, useEffect } from 'react';
import { X, Calendar, Save, Trash2, Plus, AlertCircle, Package, Pencil, XCircle, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import ConfirmModal from './ConfirmModal';

const EMPTY_FORM = {
    data_entrega_pcp: '',
    quantidade_pcp: '',
    observacao: '',
    numero_serie: '',
    serie_cliente: '',
    serie_lynx: '',
    serie_metalfisa: '',
    lote: '',
    numero_lote: '',
    gerar_op_protheus: true,
    sobrescrever_existente: false
};

const getFullOpNumber = (op, itemNumber) => {
    if (!op || String(op).trim() === '-' || String(op).trim() === '') return null;
    let cleanOp = String(op).trim();
    const cleanItem = String(itemNumber || '01').trim().padStart(2, '0');
    if (cleanOp.length === 6) {
        return `${cleanOp}${cleanItem}001`;
    }
    if (cleanOp.length === 8) {
        return `${cleanOp}001`;
    }
    return cleanOp;
};

const getDisplayOp = (op, itemNumber) => {
    if (!op || String(op).trim() === '-' || String(op).trim() === '') return op;
    let cleanOp = String(op).trim();
    if (cleanOp.length === 6 && itemNumber && String(itemNumber).trim() !== '-') {
        return cleanOp + String(itemNumber).trim().padStart(2, '0');
    }
    return cleanOp;
};

const getFractionLetter = (index) => {
    if (index < 26) {
        return String.fromCharCode(65 + index); // 'A', 'B', 'C' ... 'Z'
    }
    const firstChar = String.fromCharCode(65 + Math.floor(index / 26) - 1);
    const secondChar = String.fromCharCode(65 + (index % 26));
    return `${firstChar}${secondChar}`;
};

const ProgForm = ({ value, onChange, onSubmit, onCancel, saving, qtdDisponivel, qtdTotal, isEdit, canGenerateOp, hideOpSwitch, nextFractionLetter }) => (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data Entrega *</label>
            <input type="date" required autoFocus={!isEdit}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.data_entrega_pcp}
                onChange={e => onChange(p => ({ ...p, data_entrega_pcp: e.target.value }))} />
        </div>
        {!value.isBatch && (
            <div>
                <div className="flex justify-between items-end mb-1">
                    <label className="block text-xs font-medium text-gray-600">Quantidade *</label>
                    {qtdTotal > 0 && qtdDisponivel > 0 && (
                        <button type="button" tabIndex="-1"
                            onClick={() => onChange(p => ({ ...p, quantidade_pcp: String(Number(qtdDisponivel.toFixed(2))) }))}
                            className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium cursor-pointer transition-colors hover:underline"
                            title="Preencher com saldo restante"
                        >
                            Saldo: {qtdDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                        </button>
                    )}
                </div>
                <input type="number" step="0.01" min="0.01" required placeholder="0.00"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={value.quantidade_pcp}
                    onChange={e => onChange(p => ({ ...p, quantidade_pcp: e.target.value }))} />
            </div>
        )}
        {value.isBatch && (
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 font-medium">
                <Package className="h-4 w-4 inline mr-1 -mt-0.5" /> A quantidade a ser produzida/programada de cada item corresponderá ao saldo pendente restante do mesmo de forma automática.
            </div>
        )}
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Série Cliente</label>
            <input type="text" placeholder="Ex: SC-001"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.serie_cliente}
                onChange={e => onChange(p => ({ ...p, serie_cliente: e.target.value }))} />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Série Lynx</label>
            <input type="text" placeholder="Ex: SL-001"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.serie_lynx || value.serie_metalfisa || ''}
                onChange={e => onChange(p => ({ ...p, serie_lynx: e.target.value, serie_metalfisa: e.target.value }))} />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Número de Série</label>
            <input type="text" placeholder="Ex: NS-12345"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.numero_serie}
                onChange={e => onChange(p => ({ ...p, numero_serie: e.target.value }))} />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lote</label>
            <input type="text" placeholder={nextFractionLetter ? `Ex: Lote ${nextFractionLetter}` : "Ex: L-2026-001"}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.lote}
                onChange={e => onChange(p => ({ ...p, lote: e.target.value }))} />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Número do Lote</label>
            <input type="text" placeholder={nextFractionLetter || "Ex: AA"}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono"
                value={value.numero_lote}
                onChange={e => onChange(p => ({ ...p, numero_lote: e.target.value.toUpperCase() }))} />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observação</label>
            <textarea rows={2} placeholder="Observações adicionais..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                value={value.observacao}
                onChange={e => onChange(p => ({ ...p, observacao: e.target.value }))} />
        </div>

        {!isEdit && (
            <div className="p-3 mb-2 rounded-lg border bg-amber-50 border-amber-100 flex items-center justify-between">
                <div>
                    <div className="text-sm font-semibold text-amber-900">Sobrescrever Existentes</div>
                    <div className="text-xs text-amber-700">Substituir se já houver data PCP?</div>
                </div>
                <label className="relative flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={value.sobrescrever_existente} 
                        onChange={(e) => onChange(p => ({ ...p, sobrescrever_existente: e.target.checked }))} />
                    <div className={`w-9 h-5 peer-focus:outline-none rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${value.sobrescrever_existente ? 'bg-amber-500 after:translate-x-full' : 'bg-gray-300'}`}></div>
                </label>
            </div>
        )}

        {!hideOpSwitch && (
            <div className={`p-3 rounded-lg border flex items-center justify-between ${canGenerateOp ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-100'}`}>
                <div>
                    <div className={`text-sm font-semibold ${canGenerateOp ? 'text-blue-900' : 'text-red-900'}`}>Gerar Ordem de Produção (OP)</div>
                    <div className={`text-xs ${canGenerateOp ? 'text-blue-700' : 'text-red-700'}`}>
                        {canGenerateOp 
                            ? (nextFractionLetter ? `Emitir Ordem de Produção Fração (Lote ${nextFractionLetter}) no ERP.` : "Emitir Ordem de Produção no ERP (Banco Novo MySQL).") 
                            : "Bloqueado: Item(ns) não liberados para PCP."}
                    </div>
                </div>
                <label className={`relative flex items-center ${canGenerateOp ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <input type="checkbox" className="sr-only peer" checked={canGenerateOp && value.gerar_op_protheus} disabled={!canGenerateOp} 
                        onChange={(e) => onChange(p => ({ ...p, gerar_op_protheus: e.target.checked }))} />
                    <div className={`w-9 h-5 peer-focus:outline-none rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${canGenerateOp && value.gerar_op_protheus ? 'bg-blue-600 after:translate-x-full' : 'bg-gray-300'}`}></div>
                </label>
            </div>
        )}

        <div className="flex gap-2 mt-1">
            <button type="submit" disabled={saving}
                className={`flex-1 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${isEdit ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700 shadow-sm'}`}>
                {saving ? 'Salvando...' : <><Save className="h-4 w-4" /> {isEdit ? 'Salvar Alterações' : 'Adicionar'}</>}
            </button>
            {isEdit && onCancel && (
                <button type="button" onClick={onCancel}
                    className="px-3 py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium">
                    <XCircle className="h-4 w-4" /> Cancelar
                </button>
            )}
        </div>
    </form>
);

const PCPForecastModal = ({ isOpen, onClose, item, onSaveSuccess, canEdit = true }) => {
    const { user } = useAuth();
    const [programacoes, setProgramacoes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);   // id da prog em edição
    const [editForm, setEditForm] = useState(EMPTY_FORM);
    const [localBatchOps, setLocalBatchOps] = useState({}); // Armazena as OPs geradas no lote
    const [processingItems, setProcessingItems] = useState([]); // Lista de chaves pedido_item sendo processadas no momento
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });

    const isBatch = Array.isArray(item);
    const targetItems = isBatch ? item : [item];

    const getOpEligibility = (t) => {
        if (!t) return { valid: false, reason: 'Inválido' };
        if (String(t?.status_tipo_item || '').trim() !== 'PCP') return { valid: false, reason: 'Não liberado (PCP)' };
        if (parseFloat(t.qtd_faturar || 0) <= 0) return { valid: false, reason: 'Já 100% faturado' };
        return { valid: true, reason: '' };
    };

    const validItemsForOp = targetItems.filter(t => getOpEligibility(t).valid);
    const canGenerateOp = validItemsForOp.length > 0;

    const pedido = isBatch ? 'Lote' : (item?.pedido || item?.pedido_id);
    const itemNum = isBatch ? `${targetItems.length} Itens` : item?.item;
    const qtdTotal = isBatch ? 0 : parseFloat(item?.quantidade_original ?? item?.c6_qtdven ?? item?.qtd_faturar ?? item?.visual_qtd ?? item?.quantidade ?? 0);
    const qtdTotalStr = isBatch ? '-' : qtdTotal.toLocaleString('pt-BR');

    const qtdProgramada = programacoes.reduce((s, p) => s + parseFloat(p.quantidade_pcp || 0), 0);
    const qtdDisponivel = Math.max(0, qtdTotal - qtdProgramada);
    const pctProgramado = qtdTotal > 0 ? Math.min(100, (qtdProgramada / qtdTotal) * 100) : 0;

    // Disponível para edição (exclui a prog sendo editada)
    const qtdDisponivelEdit = (prog) => {
        const outrosProg = programacoes.filter(p => p.id !== prog.id).reduce((s, p) => s + parseFloat(p.quantidade_pcp || 0), 0);
        return qtdTotal - outrosProg;
    };

    useEffect(() => {
        if (isOpen && item) {
            const tItem = isBatch ? item[0] : item;
            
            const parseEntregaToInput = (raw, formatted) => {
                if (raw && typeof raw === 'string' && raw.length === 8 && !raw.includes('-')) {
                    return `${raw.substring(0,4)}-${raw.substring(4,6)}-${raw.substring(6,8)}`;
                }
                if (raw && typeof raw === 'string' && raw.includes('-')) return raw.split('T')[0];
                if (formatted && typeof formatted === 'string' && formatted.length === 10 && formatted.includes('/')) {
                    const p = formatted.split('/');
                    return `${p[2]}-${p[1]}-${p[0]}`;
                }
                return '';
            };
            const defaultDate = parseEntregaToInput(tItem?.entrega_raw || tItem?.entrega, tItem?.entrega_formatada || tItem?.entrega);

            setFormData({ ...EMPTY_FORM, isBatch, data_entrega_pcp: defaultDate });
            setEditingId(null);
            if (!isBatch && pedido && itemNum) {
                loadProgramacoes(true);
            } else {
                setProgramacoes([]);
            }
        }
    }, [isOpen, item, isBatch]);

    const loadProgramacoes = async (isInitialLoad = false) => {
        if (isBatch) return [];
        
        setLoading(true);
        try {
            const res = await api.get(`/pedidos/items/${pedido}/${itemNum}/pcp-forecasts/history`);
            const progs = res.data || [];
            setProgramacoes(progs);
            
            const qtdProg = progs.reduce((s, p) => s + parseFloat(p.quantidade_pcp || 0), 0);
            const disponivel = qtdTotal - qtdProg;
            
            if (!editingId) {
                setFormData(prev => {
                    if (isInitialLoad === true || prev.quantidade_pcp === '') {
                        return {
                            ...prev,
                            quantidade_pcp: disponivel > 0 ? Number(disponivel.toFixed(2)).toString() : ''
                        };
                    }
                    return prev;
                });
            }
            return progs;
        } catch (err) {
            console.error('Erro ao carregar programações:', err);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        
        if (isBatch) {
            if (!formData.data_entrega_pcp) {
                toast.warning('A Data de Entrega é obrigatória.');
                return;
            }

            setSaving(true);
            try {
                // 1. Criar OPs no Protheus PRIMEIRO (se selecionado)
                const generatedOpsMap = {};
                if (canGenerateOp && formData.gerar_op_protheus) {
                    const protheusItems = validItemsForOp.map(t => {
                        const tQtdTotal = parseFloat(t.quantidade || 0);
                        const tQtdFaturar = parseFloat(t.qtd_faturar || 0);
                        const qtd = tQtdFaturar > 0 ? tQtdFaturar : tQtdTotal;
                        return {
                            filial: t.filial || '01',
                            produto: t.codigo,
                            quant: qtd,
                            datpri: formData.data_entrega_pcp.replace(/-/g, ''),
                            datprf: formData.data_entrega_pcp.replace(/-/g, ''),
                            obs: formData.observacao || '',
                            pedido: t.pedido,
                            itempv: t.item
                        };
                    });

                    if (protheusItems.length > 0) {
                        const chunkSize = 5;
                        const chunks = [];
                        for (let i = 0; i < protheusItems.length; i += chunkSize) {
                            chunks.push(protheusItems.slice(i, i + chunkSize));
                        }

                        for (let i = 0; i < chunks.length; i++) {
                            const chunk = chunks[i];
                            const processingKeys = chunk.map(c => `${String(c.pedido).trim()}_${String(c.itempv).trim()}`);
                            setProcessingItems(processingKeys);
                            
                            const firstKey = processingKeys[0];
                            const elId = `batch-item-${firstKey}`;
                            const el = document.getElementById(elId);
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }

                            try {
                                const resp = await api.post('/protheus/ordem-producao/incluir', { items: chunk });
                                if (resp.data?.generated_ops) {
                                    for (const op of resp.data.generated_ops) {
                                        const chave = `${String(op.pedido).trim()}_${String(op.item).trim()}`;
                                        generatedOpsMap[chave] = op.op_num;
                                    }
                                    setLocalBatchOps(prev => ({ ...prev, ...generatedOpsMap }));
                                }
                                if (resp.data?.details) console.log(`🚀 [PROTHEUS CHUNK ${i+1}/${chunks.length}]:`, resp.data.details);
                            } catch (chunkErr) {
                                console.error(`❌ [ERRO API PROTHEUS CHUNK ${i+1}] Detalhes:`, chunkErr.response?.data || chunkErr);
                                const errMsg = chunkErr.response?.data?.details || chunkErr.response?.data?.error || chunkErr.message || 'Erro no processamento.';
                                toast.error(`Lote ${i+1} no Protheus falhou: ${errMsg}`, { autoClose: 8000 });
                            }

                            if (i < chunks.length - 1) {
                                await new Promise(r => setTimeout(r, 2000));
                            }
                        }
                        
                        setProcessingItems([]);
                    }
                }

                // 2. Prepara Lote com a OP já gerada
                const batchItems = targetItems.map(t => {
                    const tQtdTotal = parseFloat(t.quantidade || 0);
                    const tQtdFaturar = parseFloat(t.qtd_faturar || 0);
                    const quantidade_pcp = tQtdFaturar > 0 ? tQtdFaturar : tQtdTotal;
                    const hasOp = !!(t.op_num && String(t.op_num).trim() !== '-' && String(t.op_num).trim() !== '');
                    const chave = `${String(t.pedido).trim()}_${String(t.item).trim()}`;
                    const rawOp = generatedOpsMap[chave] || (hasOp ? (t.op_num_completa || t.op_num) : null);
                    const opVinculada = getFullOpNumber(rawOp, t.item);

                    return {
                        pedido: t.pedido,
                        item: t.item,
                        quantidade_pcp: quantidade_pcp,
                        qtd_total_item: tQtdTotal,
                        op_protheus: opVinculada
                    };
                });
                
                // 3. DEPOIS: Grava Programações no PCP Batch (com a OP já associada)
                await api.post('/pedidos/pcp-forecasts/batch', {
                    items: batchItems,
                    data_entrega_pcp: formData.data_entrega_pcp,
                    usuario: user?.nome || user?.name || user?.login || 'Usuário',
                    observacao: formData.observacao || null,
                    numero_serie: formData.numero_serie || null,
                    serie_cliente: formData.serie_cliente || null,
                    serie_lynx: formData.serie_lynx || formData.serie_metalfisa || null,
                    serie_metalfisa: formData.serie_lynx || formData.serie_metalfisa || null,
                    lote: formData.lote || null,
                    numero_lote: formData.numero_lote || null,
                    sobrescrever_existente: formData.sobrescrever_existente
                });

                toast.success('Programação Lote adicionada com sucesso!');
                setFormData(EMPTY_FORM);
                if (onSaveSuccess) onSaveSuccess();
            } catch (err) {
                console.error("❌ [ERRO API PROTHEUS/LOTE] Detalhes:", err.response?.data || err);
                const errMsg = err.response?.data?.details || err.response?.data?.error || err.message || 'Erro ao processar lote.';
                toast.error(`Falha no Lote: ${errMsg}`, { autoClose: 8000 });
            } finally {
                setSaving(false);
            }
            return;
        }

        // --- SINGLE ITEM LOGIC ---
        if (!formData.data_entrega_pcp || !formData.quantidade_pcp) {
            toast.warning('Data e Quantidade são obrigatórios.');
            return;
        }
        const novaQtd = parseFloat(formData.quantidade_pcp);
        if (novaQtd <= 0) { toast.warning('Quantidade deve ser maior que zero.'); return; }
        if (qtdTotal > 0 && qtdProgramada + novaQtd > qtdTotal + 0.01) {
            toast.error(`Quantidade excede o disponível. Disponível: ${qtdDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`);
            return;
        }
        setSaving(true);
        try {
            const existingCount = (programacoes || []).length;
            const nextLetter = formData.numero_lote && /^[A-Z]{1,2}$/i.test(String(formData.numero_lote).trim())
                ? String(formData.numero_lote).trim().toUpperCase()
                : getFractionLetter(existingCount);
            
            const qtdFinal = parseFloat(formData.quantidade_pcp);
            let opGerada = null;
            let targetItem = itemNum;

            // 1. PRIMEIRO: Cria a OP no ERP com sufixo de lote (se marcado)
            if (canGenerateOp && formData.gerar_op_protheus) {
                const protheusItems = [{
                    filial: item.filial || '01',
                    produto: item.codigo,
                    quant: qtdFinal,
                    datpri: formData.data_entrega_pcp.replace(/-/g, ''),
                    datprf: formData.data_entrega_pcp.replace(/-/g, ''),
                    obs: formData.observacao || '',
                    pedido: pedido,
                    itempv: itemNum,
                    lote_sufixo: nextLetter
                }];
                console.log(`🚀 [PROTHEUS SINGLE] Enviando JSON:`, JSON.stringify({ items: protheusItems }, null, 2));
                
                try {
                    const protheusRes = await api.post('/protheus/ordem-producao/incluir', { items: protheusItems });
                    const genOp = protheusRes.data?.generated_ops?.[0];
                    if (genOp?.op_num) {
                        opGerada = genOp.op_num;
                    } else if (protheusRes.data?.op_number) {
                        opGerada = protheusRes.data.op_number;
                    }
                    if (genOp?.item) {
                        targetItem = genOp.item;
                    }
                } catch (opErr) {
                    const errData = opErr.response?.data;
                    const errMsg = errData?.details || errData?.error || opErr.message || 'Erro ao gerar OP';
                    toast.error(`A criação da OP falhou: ${errMsg}`, { autoClose: 8000 });
                    throw new Error(`Falha ao gerar OP no ERP: ${errMsg}`);
                }
            } else if (item.op_num && String(item.op_num).trim() !== '-' && String(item.op_num).trim() !== '') {
                opGerada = getFullOpNumber(item.op_num_completa || item.op_num, itemNum);
            }
            
            // 2. DEPOIS: Salva a previsão de Data PCP e Quantidade (já com a OP e Lote vinculados)
            const isFracionadoItem = targetItem !== itemNum;
            const fractionSuffix = isFracionadoItem ? targetItem.substring(itemNum.length) : nextLetter;
            await api.post('/pedidos/pcp-forecasts', {
                pedido, 
                item: targetItem,
                data_entrega_pcp: formData.data_entrega_pcp,
                quantidade_pcp: qtdFinal,
                usuario: user?.nome || user?.name || user?.login || 'Usuário',
                observacao: formData.observacao || null,
                numero_serie: formData.numero_serie || null,
                serie_cliente: formData.serie_cliente || null,
                serie_lynx: formData.serie_lynx || formData.serie_metalfisa || null,
                serie_metalfisa: formData.serie_lynx || formData.serie_metalfisa || null,
                lote: formData.lote || `Lote ${fractionSuffix}`,
                numero_lote: formData.numero_lote || fractionSuffix,
                qtd_total_item: isFracionadoItem ? undefined : (qtdTotal > 0 ? qtdTotal : undefined),
                op_protheus: opGerada,
                sobrescrever_existente: true
            });

            toast.success('Programação adicionada com sucesso!');
            setFormData(prev => ({ ...EMPTY_FORM, isBatch: prev.isBatch, data_entrega_pcp: prev.data_entrega_pcp }));
            const newProgs = await loadProgramacoes();
            if (onSaveSuccess) onSaveSuccess(newProgs);
        } catch (err) {
            const errData = err.response?.data;
            const errMsg = errData?.details || errData?.error || err.message || 'Erro ao salvar.';
            toast.error(`Falha ao salvar programação: ${errMsg}`, { autoClose: 8000 });
        } finally {
            setSaving(false);
        }

    };

    const startEdit = (prog) => {
        setEditingId(prog.id);
        setEditForm({
            data_entrega_pcp: prog.data_entrega_pcp ? prog.data_entrega_pcp.split('T')[0] : '',
            quantidade_pcp: String(parseFloat(prog.quantidade_pcp || 0)),
            observacao: prog.observacao || '',
            numero_serie: prog.numero_serie || '',
            serie_cliente: prog.serie_cliente || '',
            serie_lynx: prog.serie_lynx || prog.serie_metalfisa || '',
            serie_metalfisa: prog.serie_lynx || prog.serie_metalfisa || '',
            lote: prog.lote || '',
            numero_lote: prog.numero_lote || '',
            gerar_op_protheus: false
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm(EMPTY_FORM);
    };

    const handleUpdate = async (e, prog) => {
        e.preventDefault();
        if (!editForm.data_entrega_pcp || !editForm.quantidade_pcp) {
            toast.warning('Data e Quantidade são obrigatórios.');
            return;
        }
        const novaQtd = parseFloat(editForm.quantidade_pcp);
        if (novaQtd <= 0) { toast.warning('Quantidade deve ser maior que zero.'); return; }
        const dispEdit = qtdDisponivelEdit(prog);
        if (qtdTotal > 0 && novaQtd > dispEdit) {
            toast.error(`Quantidade excede o disponível. Disponível para este item: ${dispEdit.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`);
            return;
        }
        setSaving(true);
        try {
            const progHasOp = prog.op_protheus && String(prog.op_protheus).trim() !== '-' && String(prog.op_protheus).trim().length > 0;
            let opAtualizada = getFullOpNumber(prog.op_protheus, item.item);

            // 1. PRIMEIRO: Se for gerar OP no Protheus na edição, cria a OP primeiro
            if (canGenerateOp && editForm.gerar_op_protheus && !progHasOp) {
                try {
                    const protheusPayload = {
                        items: [{
                            filial: item.filial || '01',
                            produto: item.codigo,
                            quant: novaQtd,
                            datpri: editForm.data_entrega_pcp.replace(/-/g, ''),
                            datprf: editForm.data_entrega_pcp.replace(/-/g, ''),
                            obs: editForm.observacao || '',
                            pedido: item.pedido,
                            itempv: item.item
                        }]
                    };
                    const resp = await api.post('/protheus/ordem-producao/incluir', protheusPayload);
                    if (resp.data?.generated_ops && resp.data.generated_ops.length > 0) {
                        opAtualizada = getFullOpNumber(resp.data.generated_ops[0].op_num, item.item);
                    } else if (resp.data?.op_number) {
                        opAtualizada = getFullOpNumber(resp.data.op_number, item.item);
                    }
                } catch (err) {
                    console.error("❌ [ERRO API OP/EDICAO] Detalhes:", err.response?.data || err);
                    const errMsg = err.response?.data?.details || err.response?.data?.error || err.message || 'Erro ao gerar OP no ERP.';
                    toast.error(`Falha ao gerar O.P.: ${errMsg}`, { autoClose: 8000 });
                    throw new Error(`Falha ao gerar OP no ERP: ${errMsg}`);
                }
            }

            // 2. DEPOIS: Atualiza a programação com a nova data e quantidade
            await api.put(`/pedidos/pcp-forecasts/${prog.id}`, {
                data_entrega_pcp: editForm.data_entrega_pcp,
                quantidade_pcp: novaQtd,
                observacao: editForm.observacao || null,
                numero_serie: editForm.numero_serie || null,
                serie_cliente: editForm.serie_cliente || null,
                serie_lynx: editForm.serie_lynx || editForm.serie_metalfisa || null,
                serie_metalfisa: editForm.serie_lynx || editForm.serie_metalfisa || null,
                lote: editForm.lote || null,
                numero_lote: editForm.numero_lote || null,
                usuario: user?.nome || user?.name || user?.login || 'Usuário',
                qtd_total_item: qtdTotal > 0 ? qtdTotal : undefined
            });

            if (opAtualizada && opAtualizada !== prog.op_protheus) {
                await api.patch(`/pedidos/pcp-forecasts/${prog.id}/op`, { op_protheus: opAtualizada });
                toast.success('Ordem de Produção gerada no Protheus e vinculada com sucesso!');
            } else {
                toast.success('Programação atualizada com sucesso!');
            }

            cancelEdit();
            const newProgs = await loadProgramacoes();
            if (onSaveSuccess) onSaveSuccess(newProgs);
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Erro ao atualizar.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmModal({ isOpen: true, id });
    };

    const handleConfirmDelete = async () => {
        const id = confirmModal.id;
        setConfirmModal({ isOpen: false, id: null });
        if (!id) return;
        
        try {
            const res = await api.delete(`/pedidos/pcp-forecasts/${id}`);
            if (res.data?.success) {
                toast.success('Programação removida com sucesso!');
                if (editingId === id) cancelEdit();
                const newProgs = await loadProgramacoes();
                if (onSaveSuccess) onSaveSuccess(newProgs);
            } else {
                toast.error(res.data?.error || 'Erro desconhecido ao remover.');
            }
        } catch (err) {
            console.error('Delete error:', err);
            toast.error(err.response?.data?.error || err.message || 'Falha na comunicação com o servidor ao remover.');
        }
    };

    const fmtDate = (d) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    };

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-blue-600 px-6 py-4 flex items-center justify-between text-white shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-6 w-6 text-blue-100" />
                        <div>
                            <h2 className="text-lg font-bold">{isBatch ? 'Programação Lote PCP' : 'Programações de Entrega PCP'}</h2>
                            <p className="text-blue-100 text-xs">
                                {isBatch ? `${targetItems.length} Itens Múltiplos Selecionados` : `Pedido ${pedido} · Item ${itemNum} · ${item.codigo} — ${item.descricao}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-blue-500 rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Progresso (Somente Individual) */}
                {!isBatch && (
                    <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 shrink-0">
                        <div className="flex items-center justify-between text-xs text-blue-700 font-medium mb-1">
                            <span>Total programado: <strong>{qtdProgramada.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong> / {qtdTotalStr}</span>
                            <span className={qtdDisponivel < 0 ? 'text-red-600 font-bold' : qtdDisponivel === 0 ? 'text-emerald-600 font-bold' : ''}>
                                {qtdDisponivel === 0 ? 'Totalmente programado' : `Disponível: `}
                                {qtdDisponivel !== 0 && <strong>{qtdDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong>}
                            </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                            <div className={`h-2 rounded-full transition-all ${pctProgramado >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                                style={{ width: `${pctProgramado}%` }} />
                        </div>
                    </div>
                )}

                <div className="flex flex-col md:flex-row overflow-hidden flex-1 min-h-0">
                    {/* Painel esquerdo: Adicionar nova */}
                    {canEdit && (
                        <div className="w-full md:w-80 shrink-0 border-r border-gray-100 flex flex-col relative overflow-hidden">
                            <div className="p-5 overflow-y-auto flex-1">
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pb-1 border-b mb-3">
                                    <Plus className="h-4 w-4 text-blue-600" /> Nova Programação
                                </h3>
                                <ProgForm
                                    value={formData}
                                    onChange={setFormData}
                                    onSubmit={handleAdd}
                                    saving={saving && !editingId}
                                    qtdDisponivel={qtdDisponivel}
                                    qtdTotal={qtdTotal}
                                    isEdit={false}
                                    canGenerateOp={canGenerateOp}
                                />
                            </div>
                        </div>
                    )}

                    {/* Lista de Programações ou Itens do Lote */}
                    <div className="flex-1 p-5 overflow-y-auto">
                        {isBatch ? (
                            <>
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pb-1 border-b mb-4">
                                    <Package className="h-4 w-4 text-indigo-600" />
                                    Itens Selecionados ({targetItems.length})
                                </h3>
                                <div className="space-y-3 mb-4 pr-2">
                                    {targetItems.map((t, idx) => {
                                        const itemKey = `${String(t.pedido).trim()}_${String(t.item).trim()}`;
                                        const uniqueKey = `${itemKey}_${idx}`;
                                        const eligibility = getOpEligibility(t);
                                        const localOp = localBatchOps[itemKey];
                                        const isProcessing = processingItems.includes(itemKey);

                                        return (
                                            <div id={`batch-item-${uniqueKey}`} key={uniqueKey} className={`rounded p-3 flex justify-between items-center text-sm transition-all duration-300 ${isProcessing ? 'bg-indigo-50 border border-indigo-300 shadow' : 'bg-gray-50 border border-gray-200'}`}>
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="font-bold text-gray-800 flex items-center gap-2">
                                                        <span>#{String(t.pedido).trim()} - Item {String(t.item).trim()}</span>
                                                        {eligibility.valid && !localOp && formData.gerar_op_protheus && !isProcessing && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Na Fila OP</span>
                                                        )}
                                                        {isProcessing && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-800 flex items-center gap-1">
                                                                <Loader2 className="w-3 h-3 animate-spin" /> Gerando OP...
                                                            </span>
                                                        )}
                                                        {localOp && (
                                                            <span className="text-xs bg-cyan-100 text-cyan-700 font-bold px-2 py-0.5 rounded">OP: {getDisplayOp(localOp, t.item)}</span>
                                                        )}
                                                        {!eligibility.valid && !localOp && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                                                                Bloqueado OP: {eligibility.reason}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-gray-500 text-xs truncate mt-1" title={t.produto_descricao}>
                                                        {t.codigo} - {t.produto_descricao}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                    <div className="text-gray-600 font-medium">Qtd: {t.qtd_faturar} un</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pb-1 border-b mb-4">
                                    <Package className="h-4 w-4 text-indigo-600" />
                                    Programações ({programacoes.length})
                                </h3>

                                {loading ? (
                                    <div className="text-gray-400 text-sm text-center py-8">Carregando...</div>
                                ) : programacoes.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                                        <AlertCircle className="h-10 w-10 mb-2 opacity-30" />
                                        <span className="text-sm">Nenhuma programação cadastrada.</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {programacoes.map((prog, idx) => (
                                            <div key={prog.id}
                                                className={`rounded-xl border p-4 transition-all ${editingId === prog.id ? 'border-amber-400 bg-amber-50 shadow-md' : 'bg-gray-50 border-gray-200 hover:border-indigo-200'}`}>

                                                {/* Cabeçalho da prog */}
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">#{idx + 1}</span>
                                                        {editingId !== prog.id && (
                                                            <>
                                                                <span className="text-sm font-bold text-gray-800">{fmtDate(prog.data_entrega_pcp)}</span>
                                                                <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded">
                                                                    {parseFloat(prog.quantidade_pcp).toLocaleString('pt-BR')} un
                                                                </span>
                                                                {(prog.op_protheus && String(prog.op_protheus).trim().length > 0 && String(prog.op_protheus).trim() !== '-') && (
                                                                    <span className="text-xs bg-cyan-100 text-cyan-700 font-bold px-2 py-0.5 rounded" title="OP Vinculada">
                                                                        OP: {getDisplayOp(prog.op_protheus, itemNum)}
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                        {editingId === prog.id && (
                                                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Editando...</span>
                                                        )}
                                                    </div>
                                                    {canEdit && (
                                                        <div className="flex items-center gap-1">
                                                            {editingId !== prog.id && (
                                                                <button onClick={() => startEdit(prog)}
                                                                    className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors rounded"
                                                                    title="Editar programação">
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                            <button onClick={(e) => handleDeleteClick(e, prog.id)} disabled={editingId === prog.id}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                                                title="Remover programação">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Edit Form */}
                                                {editingId === prog.id ? (
                                                    <div className="pt-3 border-t border-amber-200 border-dashed">
                                                        <ProgForm
                                                            value={editForm}
                                                            onChange={setEditForm}
                                                            onSubmit={(e) => handleUpdate(e, prog)}
                                                            onCancel={cancelEdit}
                                                            saving={saving && editingId === prog.id}
                                                            qtdDisponivel={qtdDisponivelEdit(prog)}
                                                            qtdTotal={qtdTotal}
                                                            isEdit={true}
                                                            hideOpSwitch={!!((prog.op_protheus && String(prog.op_protheus).trim().length > 0 && String(prog.op_protheus).trim() !== '-') || (!isBatch && item?.op_num && String(item.op_num).trim().length > 0 && String(item.op_num).trim() !== '-'))}
                                                            canGenerateOp={canGenerateOp}
                                                            hasOp={!!((prog.op_protheus && String(prog.op_protheus).trim().length > 0 && String(prog.op_protheus).trim() !== '-') || (!isBatch && item?.op_num && String(item.op_num).trim().length > 0 && String(item.op_num).trim() !== '-'))}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5 pl-2 mt-2 border-l-2 border-gray-200">
                                                        {prog.observacao && <div className="text-xs text-gray-600"><span className="font-semibold text-gray-500">Obs:</span> {prog.observacao}</div>}
                                                        {prog.numero_serie && <div className="text-xs text-gray-600"><span className="font-semibold text-gray-500">Nº Série:</span> {prog.numero_serie}</div>}
                                                        {(prog.serie_cliente || prog.serie_lynx || prog.serie_metalfisa) && (
                                                            <div className="flex gap-4 text-xs text-gray-600">
                                                                {prog.serie_cliente && <div><span className="font-semibold text-gray-500">SC:</span> {prog.serie_cliente}</div>}
                                                                {(prog.serie_lynx || prog.serie_metalfisa) && <div><span className="font-semibold text-gray-500">Série Lynx:</span> {prog.serie_lynx || prog.serie_metalfisa}</div>}
                                                            </div>
                                                        )}
                                                        {(prog.lote || prog.numero_lote) && (
                                                            <div className="flex gap-4 text-xs text-gray-600">
                                                                {prog.lote && <div><span className="font-semibold text-gray-500">Lote:</span> {prog.lote}</div>}
                                                                {prog.numero_lote && <div><span className="font-semibold text-gray-500">Nº Lote:</span> {prog.numero_lote}</div>}
                                                            </div>
                                                        )}
                                                        <div className="text-[10px] text-gray-400 mt-2">
                                                            Registrado por {prog.usuario}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 px-6 py-3 border-t flex justify-end shrink-0">
                    <button onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title="Remover Programação PCP"
                message="Tem certeza que deseja remover esta programação do sistema?"
                onConfirm={handleConfirmDelete}
                onClose={() => setConfirmModal({ isOpen: false, id: null })}
            />
        </div>
    );
};

export default PCPForecastModal;

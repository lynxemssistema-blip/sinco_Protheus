import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { X, GitFork, RefreshCw, ClipboardList, Printer, Minus, Maximize2, Minimize2 } from 'lucide-react';
import { getEstruturaPedido, getProductDocs, getFileUrl } from '../services/api';
import BOMOrganogram from './BOMOrganogram';
import BOMPrintLandscape from './BOMPrintLandscape';
import ProductionAppointmentModal from './ProductionAppointmentModal';
import PendenciasList from './PendenciasList';

// Mesma visão da estrutura de OP/Produto usada em pcp/apontamento-estrutura (aba Organograma Interativo)
export default function BOMStructureModal({ opNum, itemPv, pedido, produto, onClose }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [selectedRootKey, setSelectedRootKey] = useState(null);
    const [appointingOp, setAppointingOp] = useState(null);
    const [activeTab, setActiveTab] = useState('estrutura'); // 'estrutura' | 'impressao_a4' | 'pendencias'
    const [modalState, setModalState] = useState('normal'); // 'normal' | 'maximized' | 'minimized'

    const loadData = useCallback(() => {
        setLoading(true);
        getEstruturaPedido({ op: opNum, pedido: pedido, produto: produto })
            .then(result => {
                setData(result);
                if (!result?.pedidos?.length) toast.info('Nenhuma estrutura encontrada para esta OP.');
            })
            .catch(err => toast.error('Erro ao buscar estrutura: ' + err.message))
            .finally(() => setLoading(false));
    }, [opNum, pedido, produto]);

    useEffect(() => { loadData(); }, [loadData]);

    const processedData = React.useMemo(() => {
        if (!data) return null;
        const newPedidos = data.pedidos.map(p => {
            const itens = p.itens || [];
            itens.forEach(i => { i.subItens = []; });
            const roots = [];
            itens.forEach(i => {
                let isChild = false;
                for (const parent of itens) {
                    if (parent === i) continue;
                    // Garante que o componente pertence ao mesmo item/linha do pedido de venda (item_op)
                    if (parent.item_op === i.item_op && parent.materiais?.some(m => m.codigo?.trim() === i.produto?.trim())) {
                        parent.subItens.push(i);
                        isChild = true;
                        break;
                    }
                }
                if (!isChild) roots.push(i);
            });
            return { ...p, treeItens: roots.length > 0 ? roots : itens };
        });
        return { ...data, pedidos: newPedidos };
    }, [data]);

    // Identifica o item raiz exato em foco (OP selecionada) de forma síncrona
    const activeRootItem = React.useMemo(() => {
        if (!processedData?.pedidos?.length) return null;
        const allRoots = processedData.pedidos.flatMap(p => p.treeItens || []);
        if (allRoots.length === 0) return null;

        if (selectedRootKey) {
            const foundSelected = allRoots.find(r => `${r.op}_${r.item_op}_${r.sequen}` === selectedRootKey);
            if (foundSelected) return foundSelected;
        }

        let found = null;

        // 1. Tenta casar exatamente por item_pv ou item_op
        if (itemPv) {
            const targetItem = String(itemPv).trim().replace(/^0+/, '');
            found = allRoots.find(r => 
                String(r.item_pv || r.item_op || '').trim().replace(/^0+/, '') === targetItem
            );
        }

        // 2. Tenta casar por produto
        if (!found && produto) {
            const cleanProd = String(produto).trim().toUpperCase();
            found = allRoots.find(r => String(r.produto || '').trim().toUpperCase() === cleanProd);
        }

        // 3. Tenta casar por OP completa (ex: 00461809) ou OP raiz (004618)
        if (!found && opNum) {
            const cleanOp = String(opNum).trim().replace(/^0+/, '');
            found = allRoots.find(r => 
                `${r.op}${r.item_op}`.replace(/^0+/, '') === cleanOp || 
                r.op.replace(/^0+/, '') === cleanOp
            );
        }

        return found || allRoots[0];
    }, [processedData, selectedRootKey, itemPv, produto, opNum]);

    const activeRootKey = activeRootItem ? `${activeRootItem.op}_${activeRootItem.item_op}_${activeRootItem.sequen}` : null;
    const setActiveRootKey = (key) => setSelectedRootKey(key);

    // Recursos ainda não concluídos (aguardando/em andamento) SOMENTE da OP selecionada em activeRootKey
    // e de todos os seus subitens/filhos (árvore hierárquica completa desta OP), sem repetições.
    const livePendencias = React.useMemo(() => {
        if (!processedData?.pedidos || !activeRootItem) return [];
        const rows = [];
        const visitedNodes = new Set();
        const visitedOps = new Set();

        const collect = (item, pedidoInfo) => {
            if (!item) return;
            const nodeKey = `${item.op}_${item.item_op}_${item.sequen}`;
            if (visitedNodes.has(nodeKey)) return;
            visitedNodes.add(nodeKey);

            (item.recursos || []).forEach(r => {
                if (r.status !== 'done') {
                    const opKey = `${item.op}_${item.item_op}_${item.sequen}_${r.operac}_${r.recurso}`;
                    if (!visitedOps.has(opKey)) {
                        visitedOps.add(opKey);
                        rows.push({
                            pedido: pedidoInfo?.pedido,
                            cliente: pedidoInfo?.cliente,
                            op: item.op,
                            item_op: item.item_op,
                            sequen: item.sequen,
                            op_completa: `${item.op || ''}${item.item_op || ''}${item.sequen || ''}`,
                            item_pv: item.item_pv,
                            ped_cliente: item.ped_cliente,
                            ref_cliente: item.ref_cliente,
                            produto: item.produto,
                            desc_produto: item.desc_produto,
                            tipo_produto: item.tipo_produto,
                            um: item.um,
                            dt_entrega_pv: item.dt_entrega_pv,
                            dt_pcp: item.dt_pcp,
                            operac: r.operac,
                            desc_recurso: r.desc_recurso,
                            recurso: r.recurso,
                            data_planejada_inicio: r.data_planejada_inicio,
                            qtde_planejada: r.qtde_planejada || item.qtde,
                            qtde_produzida: r.qtde_produzida || 0,
                            status: r.status,
                            pct: r.pct
                        });
                    }
                }
            });

            const children = item.subItens || item.filhos || [];
            children.forEach(sub => collect(sub, pedidoInfo));
        };

        const parentPedido = processedData.pedidos.find(p => (p.treeItens || []).some(r => r === activeRootItem)) || processedData.pedidos[0];
        collect(activeRootItem, parentPedido);
        return rows;
    }, [processedData, activeRootItem]);

    const handleApontar = (item, recurso) => {
        if (!item) return;
        setAppointingOp({
            op:               item.op,
            item_op:          item.item_op,
            sequen:           item.sequen,
            operacao:         recurso.operac,
            recurso:          recurso.recurso,
            cod_produto_op:   item.produto,
            desc_produto:     item.desc_produto,
            desc_operacao:    `${recurso.operac} - ${recurso.desc_recurso}`,
            qtd_planejada_op: recurso.qtde_planejada,
            qtd_produzida_real: recurso.qtde_produzida,
        });
    };

    const handleViewDrawing = async (produto) => {
        if (!produto) return;
        const toastId = toast.loading(`Buscando desenhos para ${produto}...`);
        try {
            const docs = await getProductDocs(produto);
            if (!docs || docs.length === 0) {
                toast.update(toastId, { render: `Nenhum desenho técnico cadastrado para o produto ${produto}.`, type: 'warning', isLoading: false, autoClose: 3000 });
                return;
            }
            const drawing = docs.find(d =>
                (d.tipo === 'Desenho' || d.titulo?.toLowerCase().includes('desenho')) &&
                d.url_arquivo?.toLowerCase().endsWith('.pdf')
            ) || docs[0];

            if (drawing && drawing.url_arquivo) {
                toast.update(toastId, { render: `Abrindo desenho de ${produto}...`, type: 'success', isLoading: false, autoClose: 1000 });
                window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(drawing.url_arquivo)}`), '_blank');
            } else {
                toast.update(toastId, { render: `Nenhum arquivo de desenho válido encontrado para ${produto}.`, type: 'warning', isLoading: false, autoClose: 3000 });
            }
        } catch (err) {
            toast.update(toastId, { render: 'Erro ao carregar desenhos: ' + err.message, type: 'error', isLoading: false, autoClose: 3000 });
        }
    };

    const handleAppointmentSaved = () => {
        setAppointingOp(null);
        toast.success('Apontamento salvo!');
        loadData();
    };

    if (modalState === 'minimized') {
        return (
            <div 
                onClick={() => setModalState('normal')}
                className="fixed bottom-5 right-5 z-[9999] bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 cursor-pointer hover:bg-slate-800 transition-all group hover:scale-105 animate-fade-in"
            >
                <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400">
                    <GitFork className="w-4 h-4" />
                </div>
                <div className="flex flex-col pr-2">
                    <span className="text-xs font-bold text-slate-100">Estrutura da OP: {opNum}{itemPv ? ` (Item ${itemPv})` : ''}</span>
                    <span className="text-[10px] text-slate-400">Clique para restaurar</span>
                </div>
                <div className="flex items-center gap-1 border-l border-slate-700/60 pl-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); setModalState('normal'); }}
                        className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Restaurar tamanho normal"
                    >
                        <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setModalState('maximized'); }}
                        className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Maximizar tela cheia"
                    >
                        <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-slate-400 transition-colors"
                        title="Fechar"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        );
    }

    const isMax = modalState === 'maximized';

    return (
        <div className={`fixed inset-0 bg-black/60 z-50 flex items-center justify-center transition-all ${isMax ? 'p-0' : 'p-4'}`}>
            <div className={`bg-white shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
                isMax ? 'w-full h-full rounded-none' : 'w-full max-w-6xl h-[85vh] rounded-xl'
            }`}>
                <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0 print:hidden">
                    <div className="flex items-center gap-3">
                        <GitFork className="w-5 h-5 text-blue-400" />
                        <span className="font-bold text-base">Estrutura da OP: {opNum}{itemPv ? ` (Item ${itemPv})` : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700/50">
                            <button
                                onClick={() => setActiveTab('estrutura')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                    activeTab === 'estrutura' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <GitFork className="w-3.5 h-3.5" />
                                Estrutura
                            </button>
                            <button
                                onClick={() => setActiveTab('impressao_a4')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                    activeTab === 'impressao_a4' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                                }`}
                                title="Versão da estrutura formatada para folha A4 Deitado / Paisagem"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                Impressão A4 (Deitado)
                            </button>
                            <button
                                onClick={() => setActiveTab('pendencias')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                    activeTab === 'pendencias' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <ClipboardList className="w-3.5 h-3.5" />
                                Pendências{livePendencias.length > 0 ? ` (${livePendencias.length})` : ''}
                            </button>
                        </div>
                        
                        {/* Controles de Janela: Minimizar, Maximizar/Restaurar, Fechar */}
                        <div className="flex items-center gap-1 pl-2 border-l border-slate-700/60">
                            <button 
                                onClick={() => setModalState('minimized')} 
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                title="Minimizar modal"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => setModalState(isMax ? 'normal' : 'maximized')} 
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                title={isMax ? "Restaurar tamanho normal" : "Maximizar (Tela Cheia)"}
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
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                    </div>
                ) : !processedData || processedData.pedidos.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                        Nenhuma estrutura encontrada para esta OP.
                    </div>
                ) : activeTab === 'estrutura' ? (
                    <BOMOrganogram
                        data={processedData}
                        onApontar={handleApontar}
                        onViewDrawing={handleViewDrawing}
                        onSelectMaterial={() => {}}
                        activeRootKey={activeRootKey}
                        setActiveRootKey={setActiveRootKey}
                        showFocusPanel={false}
                    />
                ) : activeTab === 'impressao_a4' ? (
                    <BOMPrintLandscape
                        data={processedData}
                        opNum={activeRootItem ? `${activeRootItem.op}${activeRootItem.item_op}` : opNum}
                        itemPv={activeRootItem?.item_pv || activeRootItem?.item_op || itemPv}
                        pedido={pedido || activeRootItem?.pedido || processedData?.pedidos?.[0]?.pedido}
                        produto={activeRootItem?.produto || produto || livePendencias?.[0]?.produto}
                        activeRootKey={activeRootKey}
                        setActiveRootKey={setActiveRootKey}
                        livePendencias={livePendencias}
                    />
                ) : (
                    <PendenciasList
                        opNum={activeRootItem ? `${activeRootItem.op}${activeRootItem.item_op}` : opNum}
                        itemPv={activeRootItem?.item_pv || activeRootItem?.item_op || itemPv}
                        pedido={pedido || activeRootItem?.pedido || processedData?.pedidos?.[0]?.pedido}
                        produtoPai={activeRootItem?.produto || produto || livePendencias?.[0]?.produto}
                        liveItens={livePendencias}
                    />
                )}
            </div>

            {appointingOp && (
                <div onClick={e => e.stopPropagation()}>
                    <ProductionAppointmentModal
                        op={appointingOp}
                        onClose={() => setAppointingOp(null)}
                        onSaved={handleAppointmentSaved}
                    />
                </div>
            )}
        </div>
    );
}

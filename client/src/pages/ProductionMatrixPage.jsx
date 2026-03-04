import React, { useState, useEffect } from 'react';
import { Search, Grid3x3, CheckCircle, Clock, AlertTriangle, ChevronDown, FileText, Play, Pause, Square, RotateCcw } from 'lucide-react';
import { getProductionMatrix, saveAppointment, getProductDocuments } from '../services/api';
import ProductionAppointmentModal from '../components/ProductionAppointmentModal';
import ProductionHistoryModal from '../components/ProductionHistoryModal';
import ProcessLegendModal from '../components/ProcessLegendModal';
import { useTimer } from '../contexts/TimerContext';

// Helper para formatar data DD/MM
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
};

export default function ProductionMatrixPage() {
    const [data, setData] = useState({ operations: [], items: [] });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ op: '', produto: '', cliente: '', pedido: '', operacao: '' }); // Add Operacao filter
    const [appointingOp, setAppointingOp] = useState(null);
    const [showProcessLegend, setShowProcessLegend] = useState(false);
    const [historyTarget, setHistoryTarget] = useState(null); // For completed item history

    // Global Timer Integration (lightweight — no intervals)
    const { timers, startTimer, pauseTimer, restartTimer, getElapsedTime } = useTimer();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await getProductionMatrix(filters);
            setData(result);
        } catch (err) {
            console.error('Error loading matrix:', err);
            // Tentar extrair detalhes do erro
            if (err.response) {
                console.error('SERVER ERROR DATA:', err.response.data);
                console.error('SERVER ERROR STATUS:', err.response.status);
            } else if (err.request) {
                console.error('NO RESPONSE:', err.request);
            } else {
                console.error('REQUEST SETUP ERROR:', err.message);
            }
        } finally {
            setLoading(false);
        }
    };


    const handleSearch = () => {
        loadData();
    };

    const buildOpObject = (item, opCode) => {
        const opData = item.operations[opCode];
        if (!opData) return; // Operação não aplicável

        // Calcular próxima operação
        // As keys de item.operations são os recursos (MO0001, etc), não ordenados numericamente por operacao
        // Precisamos encontrar a próxima operação baseada no ROTEIRO do item. 
        // Mas aqui no frontend só temos o mapa [Recurso] -> Data.
        // A melhor forma é usar a lista de colunas `data.operations` ordenadas? Não, pois a ordem das colunas é por Recurso agora.
        // A melhor forma é olhar item.operations values e ordenar por sequencia/operacao_real.

        const allItemOps = Object.values(item.operations).sort((a, b) => {
            const seqA = Number(a.sequen) || 0;
            const seqB = Number(b.sequen) || 0;
            if (seqA !== seqB) return seqA - seqB;

            const opA = Number(a.operacao_real) || 0;
            const opB = Number(b.operacao_real) || 0;
            return opA - opB;
        });

        const currentIndex = allItemOps.findIndex(o => o.code === opCode); // opCode is Resource
        let nextOpInfo = null;
        if (currentIndex >= 0 && currentIndex < allItemOps.length - 1) {
            const next = allItemOps[currentIndex + 1];
            nextOpInfo = {
                recurso: next.recurso,
                operacao: next.operacao_real,
                descricao: next.description || next.recurso
            };
        }

        const opObj = {
            op: item.op,
            item_op: item.item_op,
            sequen: item.sequencia || opData.sequen || '001',
            operacao: opData.operacao_real || opCode, // CRÍTICO: Usar código numérico (10) se existir, senão o recurso
            operacao_coluna: opCode, // Guardar a chave da coluna (Recurso) para atualização visual
            recurso: opCode,
            cod_produto_op: item.cod_produto,
            desc_produto: item.desc_produto,
            desc_operacao: opCode, // Exibir recurso na descrição
            qtd_planejada_op: opData.qtd_planejada,
            qtd_produzida_real: opData.qtd_produzida,
            next_op: nextOpInfo,
            next_desc_operacao: nextOpInfo ? `${nextOpInfo.operacao || '?'} - ${nextOpInfo.descricao}` : null
        };

        return opObj;
    };

    const handleCellClick = (item, opCode) => {
        const opData = item.operations[opCode];

        // Completed: show history modal instead of blocking
        if (opData && (opData.status === 'done' || opData.percentual >= 100)) {
            const opObj = buildOpObject(item, opCode);
            if (opObj) setHistoryTarget(opObj);
            return;
        }

        const opObj = buildOpObject(item, opCode);
        if (opObj) setAppointingOp(opObj);
    };

    // In-Cell Timer Actions
    const handleCellPlay = (e, item, opCode) => {
        e.stopPropagation();
        const opObj = buildOpObject(item, opCode);
        if (opObj) startTimer(opObj);
    };

    const handleCellPause = (e, timerId) => {
        e.stopPropagation();
        pauseTimer(timerId);
    };

    const handleCellRestart = (e, timerId) => {
        e.stopPropagation();
        if (window.confirm("Deseja realmente zerar o tempo rodado nesta operação?")) {
            restartTimer(timerId);
        }
    };

    const handleCellStop = (e, timerId, item, opCode) => {
        e.stopPropagation();
        pauseTimer(timerId);

        // Open Modal to finalize the appointment
        const opObj = buildOpObject(item, opCode);
        const timerData = timers[timerId];

        // Pass timer state explicitly or let the modal fetch it from the Context
        if (opObj) {
            setAppointingOp(opObj);
            // The modal will see the stopped timer in context via the same timerId
        }
    };

    const handleAppointmentSave = async (data) => {
        try {
            await saveAppointment(data);
            setAppointingOp(null);

            // ATUALIZAÇÃO OTIMISTA (Sem Reload)
            setData(prev => {
                const newItems = prev.items.map(item => {
                    // Encontrar o item correto (OP, ItemOP e SEQUENCIA)
                    if (item.op === data.op_numero &&
                        item.item_op === data.op_item &&
                        item.sequencia === data.op_sequencia) {

                        const updatedOps = { ...item.operations };

                        // Find the target column by matching operacao_real
                        const targetColumn = Object.keys(updatedOps).find(key =>
                            updatedOps[key].operacao_real == data.operacao_codigo
                        ) || data.operacao_codigo;

                        const currentOp = updatedOps[targetColumn];

                        if (currentOp) {
                            const addedQtd = Number(data.quantidade);
                            const newProduced = (currentOp.qtd_produzida || 0) + addedQtd;
                            const plan = currentOp.qtd_planejada || 0;
                            const newPercent = plan > 0 ? Math.min(100, Math.round((newProduced / plan) * 100)) : 0;

                            let newStatus = currentOp.status;
                            if (newPercent >= 100) newStatus = 'done';
                            else if (newPercent > 0) newStatus = 'in_progress';

                            updatedOps[targetColumn] = {
                                ...currentOp,
                                qtd_produzida: newProduced,
                                percentual: newPercent,
                                status: newStatus
                            };
                        }
                        return { ...item, operations: updatedOps };
                    }
                    return item;
                });
                return { ...prev, items: newItems };
            });
            // loadData(); // Removido reload forçado
        } catch (err) {
            console.error(err);
            alert('Erro ao registrar apontamento');
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            waiting: 'bg-gray-100 text-gray-600 border-gray-200',
            in_progress: 'bg-yellow-50 text-yellow-800 border-yellow-200',
            done: 'bg-green-50 text-green-800 border-green-200'
        };
        return colors[status] || colors.waiting;
    };

    const getStatusIcon = (status) => {
        if (status === 'done') return <CheckCircle className="w-4 h-4 inline-block" />;
        if (status === 'in_progress') return <Clock className="w-4 h-4 inline-block" />;
        return <AlertTriangle className="w-4 h-4 inline-block opacity-30" />;
    };

    return (
        <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Grid3x3 className="w-7 h-7 text-blue-600" />
                        Visão Matricial de Produção
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">Visualize o progresso de cada item em todas as operações</p>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">OP</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filters.op}
                            onChange={(e) => setFilters({ ...filters, op: e.target.value })}
                            placeholder="OP..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Pedido</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filters.pedido}
                            onChange={(e) => setFilters({ ...filters, pedido: e.target.value })}
                            placeholder="PV..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Cliente</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filters.cliente}
                            onChange={(e) => setFilters({ ...filters, cliente: e.target.value })}
                            placeholder="Nome..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Produto</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filters.produto}
                            onChange={(e) => setFilters({ ...filters, produto: e.target.value })}
                            placeholder="Código ou descrição..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex justify-between">
                            <span>Operação</span>
                            <button
                                onClick={() => setShowProcessLegend(true)}
                                className="text-blue-600 hover:text-blue-800 text-[10px] underline"
                                title="Abrir Legenda"
                            >
                                (Legenda)
                            </button>
                        </label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filters.operacao}
                            onChange={(e) => setFilters({ ...filters, operacao: e.target.value })}
                            placeholder="Cód..."
                        />
                    </div>
                    <div>
                        <button
                            onClick={handleSearch}
                            className="w-full bg-blue-600 text-white rounded p-2 font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                        >
                            <Search className="w-4 h-4" />
                            Buscar
                        </button>
                    </div>
                </div>
            </div>

            {/* Matrix Grid */}
            {loading ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center flex-1 flex items-center justify-center">
                    <div className="animate-pulse text-slate-500">Carregando...</div>
                </div>
            ) : data.items.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-slate-500 flex-1 flex items-center justify-center">
                    Nenhum item encontrado. Ajuste os filtros e tente novamente.
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="overflow-auto h-[calc(100vh-280px)]">
                        <table className="w-full border-collapse min-w-max">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="border-b border-r px-4 py-3 text-left text-xs font-bold text-slate-700 bg-slate-100 sticky left-0 z-20 min-w-[280px]">
                                        Item / Produto
                                    </th>
                                    {data.operations.map(op => (
                                        <th key={op.code || op} className="border-b px-3 py-3 text-center text-xs font-bold text-slate-700 min-w-[120px]">
                                            <div className="flex flex-col items-center">
                                                <span>{typeof op === 'object' ? op.code : op}</span>
                                                {typeof op === 'object' && op.description && (
                                                    <span className="text-[9px] text-slate-500 font-normal mt-0.5 uppercase block max-w-[100px] truncate" title={op.description}>
                                                        {op.description}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((item) => (
                                    <tr key={`${item.op}_${item.item_op}_${item.sequencia || '001'}`} className="hover:bg-slate-50 transition-colors">
                                        <td className="border-b border-r px-4 py-3 bg-white sticky left-0 z-10">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className={`flex-1 ${(item.sequencia && item.sequencia !== '001') ? 'pl-4 border-l-2 border-slate-200 ml-1' : ''}`}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-[10px] text-slate-500 font-mono">
                                                            {item.op}-{item.item_op}
                                                            {item.sequencia && item.sequencia !== '001' && (
                                                                <span className="ml-1 text-slate-400">Seq: {item.sequencia}</span>
                                                            )}
                                                        </div>
                                                        {(item.sequencia && item.sequencia !== '001') && <div className="text-[10px] text-slate-300">↳</div>}
                                                    </div>

                                                    {item.nome_cliente && <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={item.nome_cliente}>{item.nome_cliente}</div>}
                                                    <div className="text-xs text-slate-600 mt-0.5">{item.desc_produto}</div>
                                                    <div className="text-xs text-blue-600 mt-0.5 font-mono">{item.cod_produto}</div>
                                                    {item.pedido_venda && (
                                                        <div className="text-xs text-blue-600 mt-1">PV: {item.pedido_venda}</div>
                                                    )}
                                                </div>
                                                {/* Botão de PDF */}
                                                {item.doc_url ? (
                                                    <a
                                                        href={`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(item.doc_url)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-100 text-[10px] font-bold hover:bg-red-100 transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                        title={`Ver desenho técnico (Rev: ${item.doc_rev || 'N/A'})`}
                                                    >
                                                        <FileText className="w-3 h-3" />
                                                        PDF
                                                    </a>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded border border-slate-200 text-[10px] font-bold cursor-not-allowed grayscale opacity-60"
                                                        title="Sem desenho associado"
                                                    >
                                                        <FileText className="w-3 h-3 opacity-50" />
                                                        PDF
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {
                                            data.operations.map(op => {
                                                const opCode = typeof op === 'object' ? op.code : op;
                                                const opData = item.operations[opCode];

                                                if (!opData) {
                                                    return (
                                                        <td key={opCode} className="border-b px-2 py-2 text-center bg-gray-50">
                                                            <span className="text-gray-300 text-xs">-</span>
                                                        </td>
                                                    );
                                                }

                                                const timerId = `${item.op}_${item.item_op || '01'}_${item.sequencia || '001'}_${opData.operacao_real || opCode}`;
                                                const cellTimer = timers[timerId];
                                                const isRunning = cellTimer && cellTimer.isRunning;
                                                const startedTime = cellTimer?.startedAt
                                                    ? new Date(cellTimer.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                                    : null;

                                                return (
                                                    <td
                                                        key={opCode}
                                                        className={`border-b px-2 py-2 cursor-pointer hover:opacity-80 transition-all group ${getStatusColor(opData.status)} ${isRunning ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50' : ''}`}
                                                        onClick={() => handleCellClick(item, opCode)}
                                                    >
                                                        <div className="text-center space-y-1 relative">
                                                            {/* Display Operation Code */}
                                                            {opData.operacao_real && (
                                                                <div className="text-[10px] font-mono font-bold text-slate-500 mb-0.5 bg-white/30 rounded inline-block px-1">
                                                                    Op: {opData.operacao_real}
                                                                </div>
                                                            )}
                                                            <div className="flex items-center justify-center gap-1">
                                                                {getStatusIcon(opData.status)}
                                                                <span className="font-bold text-sm">
                                                                    {opData.qtd_produzida.toFixed(0)}/{opData.qtd_planejada.toFixed(0)}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs font-medium pb-1">{opData.percentual}%</div>

                                                            {/* TIMER: Static badge showing started time (no live counter) */}
                                                            {cellTimer && (
                                                                <div className={`mt-1 text-[10px] font-semibold rounded px-1.5 py-0.5 ${isRunning ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                                                    {isRunning ? `▶ ${startedTime}` : `⏸ ${startedTime}`}
                                                                </div>
                                                            )}

                                                            <div className="h-1.5 bg-white/50 rounded-full overflow-hidden mt-1">
                                                                <div
                                                                    className="h-full bg-current transition-all"
                                                                    style={{ width: `${Math.min(100, opData.percentual)}%` }}
                                                                />
                                                            </div>

                                                            {/* IN-CELL CONTROLS (Hover State) */}
                                                            {opData.percentual < 100 && (
                                                                <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1 bg-white shadow-md border border-slate-200 rounded-full px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-1/2 z-10 ${isRunning ? 'opacity-100 ring-1 ring-emerald-400' : ''}`} onClick={e => e.stopPropagation()}>
                                                                    {!isRunning ? (
                                                                        <button onClick={(e) => handleCellPlay(e, item, opCode)} className="p-1 hover:bg-emerald-100 text-emerald-600 rounded-full" title="Iniciar/Retomar">
                                                                            <Play className="w-3.5 h-3.5 fill-current" />
                                                                        </button>
                                                                    ) : (
                                                                        <button onClick={(e) => handleCellPause(e, timerId)} className="p-1 hover:bg-amber-100 text-amber-600 rounded-full" title="Pausar">
                                                                            <Pause className="w-3.5 h-3.5 fill-current" />
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        onClick={(e) => handleCellStop(e, timerId, item, opCode)}
                                                                        disabled={!cellTimer}
                                                                        className="p-1 hover:bg-rose-100 text-rose-600 rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
                                                                        title="Finalizar (Apontar)"
                                                                    >
                                                                        <Square className="w-3.5 h-3.5 fill-current" />
                                                                    </button>

                                                                    <button
                                                                        onClick={(e) => handleCellRestart(e, timerId)}
                                                                        disabled={!cellTimer}
                                                                        className="p-1 hover:bg-slate-200 text-slate-700 rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
                                                                        title="Zerar Tempo"
                                                                    >
                                                                        <RotateCcw className="w-3.5 h-3.5 fill-current" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })
                                        }
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
            }

            {/* Legenda */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="text-xs font-bold text-slate-700 mb-2">Legenda:</div>
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200" />
                        <span className="text-xs text-slate-600">Aguardando (0%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-yellow-50 border border-yellow-200" />
                        <span className="text-xs text-slate-600">Em Andamento (1-99%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-green-50 border border-green-200" />
                        <span className="text-xs text-slate-600">Concluído (100%)</span>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {
                appointingOp && (
                    <ProductionAppointmentModal
                        op={appointingOp}
                        onClose={() => setAppointingOp(null)}
                        onSave={handleAppointmentSave}
                    />
                )
            }

            {/* Modal de Legenda */}
            {
                showProcessLegend && (
                    <ProcessLegendModal
                        onClose={() => setShowProcessLegend(false)}
                        onSelect={(code) => {
                            setFilters({ ...filters, operacao: code });
                            setShowProcessLegend(false);
                            // Opcional: Auto-buscar? handleSearch();
                        }}
                    />
                )
            }
            {historyTarget && (
                <ProductionHistoryModal
                    opData={historyTarget}
                    onClose={() => setHistoryTarget(null)}
                />
            )}
        </div >
    );
}

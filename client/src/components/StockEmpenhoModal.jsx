import React, { useState, useEffect } from 'react';
import { X, Box, CheckCircle, AlertTriangle, Layers, ArrowRight, ShieldAlert, Cpu, RefreshCw, Check, Square, CheckSquare, Zap, Ban, Info } from 'lucide-react';
import { getStockCandidateOps, empenharStockToOp, api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function StockEmpenhoModal({ product, onClose, onSuccess }) {
    const { user } = useAuth();
    const [loadingOps, setLoadingOps] = useState(true);
    const [candidateOps, setCandidateOps] = useState([]);
    const [selectedOp, setSelectedOp] = useState(null);
    const [loadingRouting, setLoadingRouting] = useState(false);
    const [operacoes, setOperacoes] = useState([]);

    // Configuração do Empenho
    const [quantidade, setQuantidade] = useState('');
    const [modoApontamento, setModoApontamento] = useState('CASCATA'); // 'CASCATA' | 'PONTUAL' | 'SEM_APONTAMENTO'
    const [selectedTargetRecurso, setSelectedTargetRecurso] = useState('');
    const [selectedOperationsManual, setSelectedOperationsManual] = useState({});
    const [observacao, setObservacao] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const saldoFabrica = parseFloat(product?.saldo_fabrica !== undefined ? product.saldo_fabrica : (product?.estoque_total || 0));

    // 1. Carregar OPs candidatas
    useEffect(() => {
        if (!product?.codigo) return;
        setLoadingOps(true);
        getStockCandidateOps(product.codigo)
            .then(data => {
                setCandidateOps(data || []);
                if (data && data.length > 0) {
                    handleSelectOp(data[0]);
                }
            })
            .catch(err => {
                console.error(err);
                toast.error('Erro ao buscar OPs candidatas para este produto.');
            })
            .finally(() => setLoadingOps(false));
    }, [product?.codigo]);

    // 2. Carregar roteiro de operações ao selecionar OP
    const handleSelectOp = async (opItem) => {
        setSelectedOp(opItem);
        
        // Sugere a quantidade pendente da OP respeitando o saldo da fábrica
        const maxPossivel = Math.min(saldoFabrica, parseFloat(opItem.qtd_pendente || opItem.qtd_necessaria || 1));
        setQuantidade(maxPossivel > 0 ? String(maxPossivel) : '1');

        setLoadingRouting(true);
        try {
            // Tenta buscar o roteiro do produto específico
            let opsFound = [];
            
            try {
                const resProd = await api.get('/producao/op-roteiro-saldo', {
                    params: {
                        op: opItem.op,
                        item: opItem.item_op || '01',
                        sequencia: opItem.sequen_op || '001',
                        produto: product.codigo
                    }
                });
                if (Array.isArray(resProd.data) && resProd.data.length > 0) {
                    opsFound = resProd.data;
                }
            } catch (e) {
                console.warn('Erro ao buscar roteiro do produto:', e);
            }

            // Se não encontrou para o produto direto, busca para o produto pai
            if (opsFound.length === 0 && opItem.produto_pai && opItem.produto_pai !== product.codigo) {
                try {
                    const resPai = await api.get('/producao/op-roteiro-saldo', {
                        params: {
                            op: opItem.op,
                            item: opItem.item_op || '01',
                            sequencia: opItem.sequen_op || '001',
                            produto: opItem.produto_pai
                        }
                    });
                    if (Array.isArray(resPai.data) && resPai.data.length > 0) {
                        opsFound = resPai.data;
                    }
                } catch (e) {
                    console.warn('Erro ao buscar roteiro do pai:', e);
                }
            }

            // Normaliza as operações
            const normalOps = opsFound.map(o => ({
                operacao_codigo: String(o.operacao_codigo || '').trim(),
                recurso: String(o.recurso_codigo || o.recurso || '').trim(),
                descricao: String(o.operacao_desc || o.descricao || o.recurso_codigo || o.operacao_codigo).trim()
            }));

            setOperacoes(normalOps);

            if (normalOps.length > 0) {
                // Seleciona a última operação por padrão para o modo cascata
                setSelectedTargetRecurso(normalOps[normalOps.length - 1].operacao_codigo);
                
                // Marca todas como selecionadas inicialmente no modo pontual
                const manualInit = {};
                normalOps.forEach(o => { manualInit[o.operacao_codigo] = true; });
                setSelectedOperationsManual(manualInit);
            } else {
                setSelectedTargetRecurso('');
                setSelectedOperationsManual({});
            }
        } catch (err) {
            console.error('Erro ao carregar roteiro da OP:', err);
        } finally {
            setLoadingRouting(false);
        }
    };

    // Calcular limite máximo permitido
    const qtdPendenteOp = selectedOp ? parseFloat(selectedOp.qtd_pendente || selectedOp.qtd_necessaria || 0) : 0;
    const maxPermitido = Math.min(saldoFabrica, qtdPendenteOp > 0 ? qtdPendenteOp : saldoFabrica);

    // Determinar quais operações serão apontadas
    const getOperacoesEfetivas = () => {
        if (modoApontamento === 'SEM_APONTAMENTO') {
            return [];
        }

        if (!operacoes || operacoes.length === 0) {
            return [{ operacao_codigo: '10', recurso: 'ESTOQUE_LOCAL', descricao: 'Baixa Estoque Fábrica' }];
        }

        if (modoApontamento === 'CASCATA') {
            // Pega todas as operações do início até a selecionada
            const targetIdx = operacoes.findIndex(o => o.operacao_codigo === selectedTargetRecurso);
            if (targetIdx >= 0) {
                return operacoes.slice(0, targetIdx + 1);
            }
            return operacoes;
        } else {
            // Modo Pontual
            return operacoes.filter(o => selectedOperationsManual[o.operacao_codigo]);
        }
    };

    const operacoesEfetivas = getOperacoesEfetivas();

    // Funções de auxílio para Modo Pontual
    const handleToggleAll = (select) => {
        const next = {};
        operacoes.forEach(o => { next[o.operacao_codigo] = select; });
        setSelectedOperationsManual(next);
    };

    const handleConfirmEmpenho = async () => {
        const qtdNum = parseFloat(quantidade);
        if (isNaN(qtdNum) || qtdNum <= 0) {
            return toast.warning('Informe uma quantidade válida para empenhar.');
        }

        if (qtdNum > saldoFabrica) {
            return toast.error(`A quantidade (${qtdNum}) não pode ser maior que o saldo em fábrica (${saldoFabrica})!`);
        }

        if (qtdNum > maxPermitido && qtdPendenteOp > 0) {
            return toast.error(`A quantidade excede a pendência da OP (${qtdPendenteOp} un)!`);
        }

        if (!selectedOp) {
            return toast.warning('Selecione uma OP de destino.');
        }

        if (modoApontamento !== 'SEM_APONTAMENTO' && operacoesEfetivas.length === 0) {
            return toast.warning('Selecione pelo menos uma operação para apontamento.');
        }

        setIsSubmitting(true);
        try {
            const payload = {
                produto_codigo: product.codigo,
                op_numero: selectedOp.op,
                op_item: selectedOp.item_op || '01',
                op_sequencia: selectedOp.sequen_op || '001',
                pedido_venda: selectedOp.pedido || '',
                produto_pai: selectedOp.produto_pai || product.codigo,
                quantidade: qtdNum,
                modo_apontamento: modoApontamento,
                operacoes: operacoesEfetivas,
                usuario: user?.NomeCompleto || user?.nome || 'Operador',
                observacao: observacao.trim()
            };

            const res = await empenharStockToOp(payload);
            toast.success(res.message || 'Empenho realizado com sucesso!');
            if (onSuccess) onSuccess();
            if (onClose) onClose();
        } catch (err) {
            console.error('Erro ao confirmar empenho:', err);
            toast.error(err.response?.data?.error || 'Erro ao processar empenho de estoque.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
                
                {/* Header */}
                <div className="bg-slate-900 px-6 py-5 text-white flex justify-between items-center relative shrink-0">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                            <Box size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black">{product?.codigo}</h3>
                                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono">
                                    {product?.unidade || 'UN'}
                                </span>
                            </div>
                            <p className="text-slate-400 text-xs sm:text-sm truncate max-w-md">
                                {product?.descricao}
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <span className="text-xs text-emerald-400 font-bold block uppercase tracking-wider">Saldo em Fábrica</span>
                            <span className="text-xl font-black text-white">{saldoFabrica} {product?.unidade || 'un'}</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
                    
                    {/* 1. Seleção de OP Candidata */}
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">1</span>
                                Selecione a Ordem de Produção (OP) / Pedido de Destino
                            </label>
                            <span className="text-xs text-slate-400">
                                {candidateOps.length} OP(s) aberta(s) com demanda real
                            </span>
                        </div>

                        {loadingOps ? (
                            <div className="py-8 text-center text-slate-400 text-sm">
                                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                Localizando OPs com demanda pendente...
                            </div>
                        ) : candidateOps.length === 0 ? (
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-sm flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                                <div>
                                    <p className="font-bold">Nenhuma OP aberta com saldo pendente encontrada.</p>
                                    <p className="text-xs text-amber-700">Todas as OPs deste item já foram apontadas ou o pedido já foi faturado.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                                {candidateOps.map((opItem, idx) => {
                                    const isSel = selectedOp?.op === opItem.op && selectedOp?.item_op === opItem.item_op && selectedOp?.sequen_op === opItem.sequen_op;
                                    return (
                                        <div
                                            key={`${opItem.op}-${opItem.item_op}-${idx}`}
                                            onClick={() => handleSelectOp(opItem)}
                                            className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                                                isSel 
                                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs' 
                                                    : 'border-slate-200 bg-white hover:border-indigo-300'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-mono font-black text-slate-900 text-base">OP: {opItem.op}</span>
                                                    {opItem.pedido && (
                                                        <span className="ml-2 text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                                                            Ped: {opItem.pedido}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                                    opItem.qtd_pendente > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                    Pendente: {opItem.qtd_pendente} un
                                                </span>
                                            </div>

                                            <div className="text-xs text-slate-500 flex items-center justify-between">
                                                <span className="truncate max-w-[200px]" title={opItem.cliente || opItem.desc_produto_pai}>
                                                    {opItem.cliente || opItem.desc_produto_pai}
                                                </span>
                                                <span>Prazo: <b className="text-slate-700">{opItem.prazo_entrega}</b></span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 2. Quantidade e Regras de Limite */}
                    {selectedOp && (
                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">2</span>
                                    Defina a Quantidade para Empenhar
                                </label>
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                    Limite Máximo Permitido: {maxPermitido} {product?.unidade || 'un'}
                                </span>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="relative w-full sm:w-60">
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxPermitido}
                                        step="1"
                                        value={quantidade}
                                        onChange={(e) => {
                                            const v = parseFloat(e.target.value);
                                            if (v > maxPermitido) {
                                                setQuantidade(String(maxPermitido));
                                                toast.warning(`Limite de ${maxPermitido} peças aplicado automaticamente.`);
                                            } else {
                                                setQuantidade(e.target.value);
                                            }
                                        }}
                                        className="w-full text-2xl font-black text-slate-900 border-2 border-slate-300 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-center"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                                        {product?.unidade || 'UN'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    {[1, 5, 10, maxPermitido].filter((v, i, a) => v <= maxPermitido && a.indexOf(v) === i).map((quickVal) => (
                                        <button
                                            key={quickVal}
                                            type="button"
                                            onClick={() => setQuantidade(String(quickVal))}
                                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                        >
                                            {quickVal === maxPermitido ? `Máx (${quickVal})` : `+${quickVal}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. Modo de Apontamento & Seleção Interativa de Recursos */}
                    {selectedOp && (
                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">3</span>
                                    Escolha o Modo de Apontamento de Produção
                                </label>
                            </div>

                            {/* Seletor de Opção A / Opção B / Opção C */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Opção A */}
                                <div
                                    onClick={() => setModoApontamento('CASCATA')}
                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                        modoApontamento === 'CASCATA'
                                            ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center gap-2 font-bold text-slate-900 mb-1 text-sm">
                                            <input
                                                type="radio"
                                                checked={modoApontamento === 'CASCATA'}
                                                onChange={() => setModoApontamento('CASCATA')}
                                                className="accent-indigo-600 w-4 h-4 cursor-pointer"
                                            />
                                            <span>Opção A: Avanço em Cascata</span>
                                        </div>
                                        <p className="text-xs text-slate-600 ml-6 leading-relaxed">
                                            Aponta como <b>concluído</b> todas as etapas até o recurso onde a peça entra.
                                        </p>
                                    </div>
                                </div>

                                {/* Opção B */}
                                <div
                                    onClick={() => setModoApontamento('PONTUAL')}
                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                        modoApontamento === 'PONTUAL'
                                            ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center gap-2 font-bold text-slate-900 mb-1 text-sm">
                                            <input
                                                type="radio"
                                                checked={modoApontamento === 'PONTUAL'}
                                                onChange={() => setModoApontamento('PONTUAL')}
                                                className="accent-indigo-600 w-4 h-4 cursor-pointer"
                                            />
                                            <span>Opção B: Apontamento Pontual</span>
                                        </div>
                                        <p className="text-xs text-slate-600 ml-6 leading-relaxed">
                                            Escolha manualmente via checkboxes exatamente quais recursos receberão crédito.
                                        </p>
                                    </div>
                                </div>

                                {/* Opção C (NOVA) */}
                                <div
                                    onClick={() => setModoApontamento('SEM_APONTAMENTO')}
                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                        modoApontamento === 'SEM_APONTAMENTO'
                                            ? 'border-amber-600 bg-amber-50/50 shadow-xs'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center gap-2 font-bold text-slate-900 mb-1 text-sm">
                                            <input
                                                type="radio"
                                                checked={modoApontamento === 'SEM_APONTAMENTO'}
                                                onChange={() => setModoApontamento('SEM_APONTAMENTO')}
                                                className="accent-amber-600 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-amber-900">Opção C: Não Fazer Apontamento</span>
                                        </div>
                                        <p className="text-xs text-amber-800 ml-6 leading-relaxed">
                                            Apenas baixa o saldo físico e reserva para a OP, <b>sem gerar apontamentos</b> na produção.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Roteiro e Seleção de Recursos (Apenas para Opção A e B) */}
                            {modoApontamento === 'SEM_APONTAMENTO' ? (
                                <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                                    <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold">Modo Apenas Empenho Selecionado</p>
                                        <p className="text-amber-800 mt-0.5">
                                            O sistema realizará a baixa de <b>{quantidade || 0} un</b> do estoque físico e registrará o vínculo direto com a OP <b>{selectedOp?.op}</b>, sem movimentar a esteira de apontamentos de chão de fábrica.
                                        </p>
                                    </div>
                                </div>
                            ) : loadingRouting ? (
                                <div className="py-6 text-center text-xs text-slate-400">
                                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                                    Carregando operações e roteiro da OP...
                                </div>
                            ) : operacoes.length > 0 ? (
                                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                                    
                                    {/* Barra de Ação / Instrução */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                            <Zap size={14} className="text-indigo-600" />
                                            {modoApontamento === 'CASCATA'
                                                ? 'Selecione até qual recurso a peça avança (marcará as anteriores):'
                                                : 'Marque individualmente os recursos que receberão o apontamento:'
                                            }
                                        </span>

                                        {modoApontamento === 'PONTUAL' && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleAll(true)}
                                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded cursor-pointer"
                                                >
                                                    Marcar Todas
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleAll(false)}
                                                    className="text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-2 py-1 rounded cursor-pointer"
                                                >
                                                    Desmarcar Todas
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* MODO A: BOTÕES DE CASCATA */}
                                    {modoApontamento === 'CASCATA' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                            {operacoes.map((op, idx) => {
                                                const targetIdx = operacoes.findIndex(o => o.operacao_codigo === selectedTargetRecurso);
                                                const isInCascade = idx <= targetIdx;
                                                const isTarget = op.operacao_codigo === selectedTargetRecurso;

                                                return (
                                                    <div
                                                        key={op.operacao_codigo}
                                                        onClick={() => setSelectedTargetRecurso(op.operacao_codigo)}
                                                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                                            isTarget
                                                                ? 'bg-emerald-700 border-emerald-700 text-white shadow-md'
                                                                : isInCascade
                                                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono font-black text-xs">
                                                                    Op. {op.operacao_codigo}
                                                                </span>
                                                                {op.recurso && (
                                                                    <span className="text-[10px] bg-black/10 px-1 rounded font-bold">
                                                                        {op.recurso}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs font-bold truncate mt-0.5">
                                                                {op.descricao}
                                                            </p>
                                                        </div>

                                                        <div className="shrink-0">
                                                            {isInCascade ? (
                                                                <CheckCircle size={18} className={isTarget ? 'text-white' : 'text-emerald-600'} />
                                                            ) : (
                                                                <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* MODO B: CHECKBOXES PONTUAIS */}
                                    {modoApontamento === 'PONTUAL' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                            {operacoes.map((op) => {
                                                const isChecked = !!selectedOperationsManual[op.operacao_codigo];

                                                return (
                                                    <div
                                                        key={op.operacao_codigo}
                                                        onClick={() => {
                                                            setSelectedOperationsManual(prev => ({
                                                                ...prev,
                                                                [op.operacao_codigo]: !prev[op.operacao_codigo]
                                                            }));
                                                        }}
                                                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                                            isChecked
                                                                ? 'bg-indigo-50 border-indigo-600 text-indigo-950 shadow-xs'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono font-black text-xs">
                                                                    Op. {op.operacao_codigo}
                                                                </span>
                                                                {op.recurso && (
                                                                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1 rounded font-bold">
                                                                        {op.recurso}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs font-bold truncate mt-0.5">
                                                                {op.descricao}
                                                            </p>
                                                        </div>

                                                        <div className="shrink-0">
                                                            {isChecked ? (
                                                                <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                                                                    <Check size={14} />
                                                                </div>
                                                            ) : (
                                                                <div className="w-5 h-5 rounded-md border-2 border-slate-300 bg-white" />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Resumo do que será apontado */}
                                    <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                                        <span>
                                            Serão gerados apontamentos para <b>{operacoesEfetivas.length}</b> recurso(s): {operacoesEfetivas.map(o => o.descricao || o.operacao_codigo).join(' ➔ ')}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-100 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                                    <span>Não foram encontradas operações específicas em roteiro para esta OP. O sistema registrará a baixa e empenho direto.</span>
                                </div>
                            )}

                            {/* Observação Opcional */}
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Observação do Empenho (Opcional):</label>
                                <input
                                    type="text"
                                    value={observacao}
                                    onChange={(e) => setObservacao(e.target.value)}
                                    placeholder="Ex: Peças conferidas e retiradas do estoque intermediário..."
                                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleConfirmEmpenho}
                        disabled={isSubmitting || !selectedOp || parseFloat(quantidade) <= 0 || (modoApontamento !== 'SEM_APONTAMENTO' && operacoesEfetivas.length === 0)}
                        className={`px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                            modoApontamento === 'SEM_APONTAMENTO'
                                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <RefreshCw size={18} className="animate-spin" />
                                <span>Processando Empenho...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} />
                                <span>
                                    {modoApontamento === 'SEM_APONTAMENTO'
                                        ? `Confirmar Empenho sem Apontar (${quantidade || 0} un)`
                                        : `Confirmar Empenho (${quantidade || 0} un)`
                                    }
                                </span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

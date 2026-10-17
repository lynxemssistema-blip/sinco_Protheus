import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Save, Camera, History, CheckCircle, ChevronDown, Activity, Clock, PlusCircle, Trash2, Edit2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getOpRncs, getSgqNaoConformidades, createRnc, updateRnc, deleteRnc, getProcessList, getPedidosFlat, getSincoRestricoesSz0, createSincoRestricaoSz0 } from '../services/api';
import { toast } from 'react-toastify';

export default function RNCModal({ op, onClose }) {
    const { user } = useAuth();
    const [rncs, setRncs] = useState([]);
    const [naoConformidades, setNaoConformidades] = useState([]);
    const [recursos, setRecursos] = useState([]);
    
    // Parent Item Info
    const [isItemPai, setIsItemPai] = useState(false);
    const [pedidoInfo, setPedidoInfo] = useState(null);

    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Form State for Table
    const [problemas, setProblemas] = useState([]);
    const [selectedRecurso, setSelectedRecurso] = useState(op.operacao || '');
    const [selectedNc, setSelectedNc] = useState('');
    const [observacao, setObservacao] = useState('');
    const [fotosRegistro, setFotosRegistro] = useState([]);
    
    // Novas Variáveis F097 (Criação)
    const [origem, setOrigem] = useState('');
    const [responsavelQualidade, setResponsavelQualidade] = useState('');
    const [localDeteccao, setLocalDeteccao] = useState('');
    const [setorOrigem, setSetorOrigem] = useState('');
    const [qtdNaoConforme, setQtdNaoConforme] = useState('');
    
    // Treat RNC State
    const [treatingId, setTreatingId] = useState(null);
    const [tratativaObs, setTratativaObs] = useState('');
    const [tratativaStatus, setTratativaStatus] = useState('CONCLUIDO');
    
    // Edit RNC State
    const [editingId, setEditingId] = useState(null);
    const [editObsVal, setEditObsVal] = useState('');

    const fileInputRef = useRef(null);

    useEffect(() => {
        loadInitialData();
        loadHistory();
        loadPedidoInfo();
    }, []);

    const loadPedidoInfo = async () => {
        const numPedido = op.pedido || String(op.op).substring(0, 6);
        
        if (numPedido) {
            try {
                // Passa 'pedido' em vez de 'q' e limita a 50 itens para procurar o item correto
                const result = await getPedidosFlat({ pedido: numPedido, limit: 50 });
                if (result && result.data && result.data.length > 0) {
                    let itemCorreto = result.data[0]; // fallback
                    if (op.item_pedido) {
                        const encontrado = result.data.find(i => i.item === op.item_pedido);
                        if (encontrado) itemCorreto = encontrado;
                    }
                    setPedidoInfo(itemCorreto);
                    // O produto é pai se o produto que está sendo fabricado na OP for igual ao produto de faturamento (C6_PRODUTO)
                    setIsItemPai(op.cod_produto_op === itemCorreto.produto);
                } else {
                    setIsItemPai(op.item_op === '01'); // fallback caso não encontre
                }
            } catch (err) {
                console.error('Erro ao buscar infos do pedido:', err);
                setIsItemPai(op.item_op === '01'); // fallback
            }
        }
    };

    const loadInitialData = async () => {
        try {
            const [ncRes, recRes] = await Promise.all([
                getSgqNaoConformidades(),
                getProcessList()
            ]);
            setNaoConformidades(ncRes || []);
            setRecursos(Array.isArray(recRes) ? recRes : (recRes?.data || []));
        } catch (error) {
            console.error('Erro ao carregar dados base RNC:', error);
            toast.error('Erro ao carregar lista de não-conformidades.');
        }
    };

    const loadHistory = async () => {
        setLoadingHistory(true);
        const numPedido = op.pedido || String(op.op).substring(0, 6);
        try {
            const data = await getOpRncs({ 
                pedido: numPedido, 
                op: op.op, 
                item_op: op.item_op, 
                sequen_op: op.sequen 
            });
            setRncs(data || []);
        } catch (error) {
            console.error('Erro ao buscar histórico de RNCs:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handlePhotoUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFotosRegistro(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeFoto = (indexToRemove) => {
        setFotosRegistro(prev => prev.filter((_, i) => i !== indexToRemove));
    };

    const handleAddProblema = () => {
        if (!selectedRecurso || !selectedNc || !observacao.trim()) {
            toast.warning('Selecione o setor, o defeito e insira a descrição da falha antes de adicionar.');
            return;
        }
        const ncInfo = naoConformidades.find(n => String(n.id) === String(selectedNc));
        const recInfo = recursos.find(r => r.codigo === selectedRecurso);
        setProblemas([...problemas, {
            recurso: selectedRecurso,
            recursoDesc: recInfo?.descricao || '',
            ncId: selectedNc,
            ncDesc: ncInfo?.descricao || '',
            observacao: observacao.trim()
        }]);
        setSelectedNc('');
        setObservacao('');
    };

    const handleRemoveProblema = (index) => {
        setProblemas(problemas.filter((_, i) => i !== index));
    };

    const handleCreateRnc = async (e) => {
        e.preventDefault();
        
        if (problemas.length === 0) {
            toast.warning('Adicione pelo menos um problema na lista antes de salvar.');
            return;
        }

        setLoading(true);
        let successCount = 0;
        const numPedido = op.pedido || String(op.op).substring(0, 6);
        const clienteNome = op.cliente || pedidoInfo?.cliente_razao || '';

        try {
            for (const prob of problemas) {
                await createRnc({
                    pedido: numPedido,
                    op: op.op,
                    item_op: op.item_op,
                    sequen_op: op.sequen,
                    produto: op.cod_produto_op || op.produto,
                    desc_produto: op.desc_produto,
                    cliente: clienteNome,
                    recurso_origem: op.operacao,
                    recurso_inconformidade: prob.recurso,
                    nao_conformidade_id: prob.ncId,
                    observacao: prob.observacao,
                    imagem_evidencia: fotosRegistro.length > 0 ? fotosRegistro[0] : null,
                    fotos_registro: fotosRegistro,
                    criado_por: user?.nome || user?.login,
                    f097_dados: JSON.stringify({
                        registro: {
                            origem,
                            responsavel_qualidade: responsavelQualidade,
                            local_deteccao: localDeteccao,
                            setor_envolvido: prob.recurso,
                            setor_origem: setorOrigem,
                            qtd_nao_conforme: qtdNaoConforme,
                            produto_pai: pedidoInfo?.produto ? `${pedidoInfo.produto} - ${pedidoInfo.desc_produto || pedidoInfo.descricao}` : null,
                            is_produto_pai: isItemPai
                        }
                    })
                });

                // NOVA REGRA SZ0: Criar restrição automática se recurso for MO008
                if (prob.recurso === 'MO008') {
                    try {
                        const prod = op.cod_produto_op || op.produto;
                        const rSz0 = await getSincoRestricoesSz0(prod);
                        const listSz0 = Array.isArray(rSz0) ? rSz0 : [];
                        const maxItem = listSz0.reduce((max, r) => {
                            const n = parseInt(r.item, 10);
                            return isNaN(n) ? max : Math.max(max, n);
                        }, 0);
                        const itemNumber = String(maxItem + 1).padStart(3, '0');
                        
                        const formatProtheusStr = (text) => text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s.,\-:()\/]/g, '') : '';

                        const now = new Date();
                        const dtHoje = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
                        const hrAgora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                        await createSincoRestricaoSz0({
                            data: {
                                restricoes: [{
                                    EMPRESA: '01',
                                    CFILANT: '01',
                                    NOPER: 3,
                                    Z0_PRODUTO: prod,
                                    Z0_ITEM: itemNumber,
                                    Z0_STATUS: 'P',
                                    Z0_RESUMO: formatProtheusStr(prob.ncDesc).substring(0, 80),
                                    Z0_RESTRIC: formatProtheusStr(prob.ncDesc).substring(0, 500),
                                    Z0_RESPONS: (user?.nome || user?.login || 'SISTEMA').toUpperCase().substring(0, 15),
                                    Z0_DTULTAL: dtHoje,
                                    Z0_HRULTAL: hrAgora,
                                    Z0_XREVM: '' 
                                }]
                            }
                        });
                    } catch (e) {
                        console.error('Erro ao criar restrição SZ0 automática:', e);
                        toast.warning('RNC criada, mas falha ao gerar restrição SZ0.');
                    }
                }

                successCount++;
            }

            toast.success(`${successCount} RNC(s) registradas com sucesso!`);
            
            // Limpa form, NÃO fecha o modal
            setProblemas([]);
            setSelectedNc('');
            setObservacao('');
            setFotosRegistro([]);
            setOrigem('');
            setResponsavelQualidade('');
            setLocalDeteccao('');
            setSetorOrigem('');
            setQtdNaoConforme('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            
            loadHistory();
        } catch (error) {
            console.error('Erro ao salvar RNC:', error);
            toast.error('Falha ao registrar RNC.');
        } finally {
            setLoading(false);
        }
    };

    const handleTreatRnc = async (rncId) => {
        try {
            const rnc = rncs.find(r => r.id === rncId);
            const userName = user?.nome || user?.login || 'Sistema';
            const dataAgora = new Date().toLocaleString('pt-BR');
            const novaAnotacao = tratativaObs.trim() ? `[${dataAgora} por ${userName}]: ${tratativaObs}` : '';
            
            const historicoAtual = rnc?.tratativa_resposta ? rnc.tratativa_resposta + (novaAnotacao ? '\n\n' : '') : '';
            const novoHistorico = historicoAtual + novaAnotacao;

            await updateRnc(rncId, {
                status: tratativaStatus,
                tratativa_resposta: novoHistorico,
                tratado_por: userName
            });
            
            // NOVA REGRA SZ0: Baixar restrição automática se recurso for MO008
            if (tratativaStatus === 'CONCLUIDO') {
                if (rnc && rnc.recurso_inconformidade === 'MO008') {
                    try {
                        const prod = op.cod_produto_op || op.produto;
                        const rSz0 = await getSincoRestricoesSz0(prod);
                        const listSz0 = Array.isArray(rSz0) ? rSz0 : [];
                        
                        const formatProtheusStr = (text) => text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s.,\-:()\/]/g, '') : '';
                        const descPadraoFormatada = formatProtheusStr(rnc.nc_descricao || '').substring(0, 80);

                        const targetSz0 = listSz0.find(sz => 
                            sz.status === 'P' && 
                            (sz.resumo || '').toUpperCase() === descPadraoFormatada
                        );

                        if (targetSz0) {
                            const now = new Date();
                            const dtHoje = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
                            const hrAgora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                            
                            await createSincoRestricaoSz0({
                                data: {
                                    restricoes: [{
                                        EMPRESA: '01',
                                        CFILANT: '01',
                                        NOPER: 4, // Edição
                                        Z0_PRODUTO: prod,
                                        Z0_ITEM: targetSz0.item,
                                        Z0_STATUS: 'A', // Finalizada / Aprovada
                                        Z0_RESUMO: targetSz0.resumo,
                                        Z0_RESTRIC: targetSz0.restricao,
                                        Z0_RESPONS: (user?.nome || user?.login || 'SISTEMA').toUpperCase().substring(0, 15),
                                        Z0_DTULTAL: dtHoje,
                                        Z0_HRULTAL: hrAgora,
                                        Z0_XREVM: targetSz0.revisao || ''
                                    }]
                                }
                            });
                        }
                    } catch (e) {
                        console.error('Erro ao baixar restrição SZ0 automática:', e);
                        toast.warning('RNC finalizada, mas falha ao atualizar a SZ0.');
                    }
                }
            }

            toast.success('RNC tratada com sucesso!');
            setTreatingId(null);
            setTratativaObs('');
            loadHistory();
        } catch (error) {
            console.error('Erro ao tratar RNC:', error);
            toast.error('Falha ao atualizar RNC.');
        }
    };

    const handleDeleteRnc = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir esta RNC? Esta ação não pode ser desfeita.')) return;
        try {
            await deleteRnc(id);
            toast.success('RNC excluída com sucesso.');
            loadHistory();
        } catch (error) {
            console.error('Erro ao excluir RNC:', error);
            toast.error('Falha ao excluir RNC.');
        }
    };

    const handleEditAbertoRnc = async (rncId, novaObs) => {
        try {
            await updateRnc(rncId, { observacao: novaObs });
            toast.success('Observação atualizada com sucesso.');
            setEditingId(null);
            loadHistory();
        } catch (error) {
            console.error('Erro ao editar RNC:', error);
            toast.error('Falha ao editar RNC.');
        }
    };

    const getStatusColor = (status) => {
        if (status === 'CONCLUIDO') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
        if (status === 'EM ANDAMENTO') return 'text-amber-700 bg-amber-50 border-amber-200';
        return 'text-rose-700 bg-rose-50 border-rose-200';
    };

    const numPedidoExibicao = op.pedido || String(op.op).substring(0, 6);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mt-10 mb-10 overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-slate-800 text-white">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                            Registro de RNC
                        </h2>
                        <span className="text-xs text-slate-300">OP: {op.op}-{op.item_op} | PV: {numPedidoExibicao}</span>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-5 overflow-y-auto max-h-[80vh]">
                    
                    {/* Rastreabilidade e Informações do Pedido */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                        <h3 className="text-xs font-bold text-indigo-800 uppercase mb-2 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5" />
                            Dados do Projeto (Rastreabilidade)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div>
                                <label className="text-[10px] text-indigo-500 font-bold uppercase">Cliente</label>
                                <div className="text-sm font-semibold text-slate-800 bg-white px-2 py-1.5 rounded border border-indigo-100 truncate" title={op.cliente || pedidoInfo?.nome_cliente || pedidoInfo?.cliente_razao || 'Não identificado'}>
                                    {op.cliente || pedidoInfo?.nome_cliente || pedidoInfo?.cliente_razao || 'Não identificado'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-indigo-500 font-bold uppercase">Pedido</label>
                                <div className="text-sm font-semibold text-slate-800 bg-white px-2 py-1.5 rounded border border-indigo-100">
                                    {op.pedido || numPedidoExibicao || '-'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-indigo-500 font-bold uppercase">Item PV</label>
                                <div className="text-sm font-semibold text-slate-800 bg-white px-2 py-1.5 rounded border border-indigo-100">
                                    {pedidoInfo?.item || op.item_pedido || '-'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-indigo-500 font-bold uppercase">Hierarquia OP</label>
                                <div className={`text-sm font-semibold px-2 py-1.5 rounded border ${isItemPai ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                    {isItemPai ? 'Item Pai (Principal)' : 'Item Filho (Componente)'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-indigo-500 font-bold uppercase">Produto Pai</label>
                                <div className="text-sm font-semibold text-slate-800 bg-white px-2 py-1.5 rounded border border-indigo-100 truncate" title={pedidoInfo?.produto ? `${pedidoInfo.produto} - ${pedidoInfo.desc_produto || pedidoInfo.descricao}` : 'Não identificado'}>
                                    {pedidoInfo?.produto ? `${pedidoInfo.produto} - ${pedidoInfo.desc_produto || pedidoInfo.descricao}` : 'Não identificado'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Formulário Novo Apontamento */}
                    <form onSubmit={handleCreateRnc} className="border border-slate-200 rounded-lg p-4 shadow-sm bg-white space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                            <AlertTriangle className="w-4 h-4 text-slate-500" />
                            Dados Gerais do F 097-22
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Origem</label>
                                <select 
                                    value={origem}
                                    onChange={(e) => setOrigem(e.target.value)}
                                    className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 focus:border-blue-500 focus:bg-white"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="Interna">Interna</option>
                                    <option value="Fornecedor">Fornecedor</option>
                                    <option value="Cliente">Cliente</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Resp. Qualidade</label>
                                <input 
                                    type="text"
                                    value={responsavelQualidade}
                                    onChange={(e) => setResponsavelQualidade(e.target.value)}
                                    placeholder="Ex: João Silva"
                                    className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 focus:border-blue-500 focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Local de Detecção</label>
                                <input 
                                    type="text"
                                    value={localDeteccao}
                                    onChange={(e) => setLocalDeteccao(e.target.value)}
                                    placeholder="Ex: Inspeção Final"
                                    className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 focus:border-blue-500 focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Setor de Origem</label>
                                <input 
                                    type="text"
                                    value={setorOrigem}
                                    onChange={(e) => setSetorOrigem(e.target.value)}
                                    placeholder="Ex: Usinagem"
                                    className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 focus:border-blue-500 focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Qtd. Não Conforme Geral</label>
                                <input 
                                    type="number"
                                    value={qtdNaoConforme}
                                    onChange={(e) => setQtdNaoConforme(e.target.value)}
                                    placeholder="Ex: 5"
                                    className="w-full border border-slate-200 rounded p-2 text-xs bg-slate-50 focus:border-blue-500 focus:bg-white"
                                />
                            </div>
                        </div>

                        {/* LISTA DE DEFEITOS (Tabela) */}
                        <div className="mt-6 pt-4 border-t border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                                📋 Lista de Problemas (Adicione 1 ou mais)
                            </h3>
                            
                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col md:flex-row gap-2 items-end">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Setor Envolvido</label>
                                    <select 
                                        value={selectedRecurso}
                                        onChange={(e) => {
                                            setSelectedRecurso(e.target.value);
                                            setSelectedNc('');
                                        }}
                                        className="w-full border border-slate-200 rounded p-2 text-xs focus:border-blue-500"
                                    >
                                        <option value="">-- Selecione --</option>
                                        {recursos.map((r, idx) => (
                                            <option key={`${r.codigo}-${idx}`} value={r.codigo}>{r.codigo} {r.descricao ? `- ${r.descricao}` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Defeito Encontrado</label>
                                    <select 
                                        value={selectedNc}
                                        onChange={(e) => setSelectedNc(e.target.value)}
                                        className="w-full border border-slate-200 rounded p-2 text-xs focus:border-blue-500"
                                        disabled={!selectedRecurso}
                                    >
                                        <option value="">{selectedRecurso ? "-- Selecione --" : "-- Selecione o Setor --"}</option>
                                        {naoConformidades
                                            .filter(nc => !selectedRecurso || nc.recurso_codigo === selectedRecurso)
                                            .map(nc => (
                                            <option key={nc.id} value={nc.id}>{nc.descricao} ({nc.gravidade})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-[2]">
                                    <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Descrição da Falha / Ação Diferente</label>
                                    <input 
                                        type="text"
                                        value={observacao}
                                        onChange={(e) => setObservacao(e.target.value)}
                                        placeholder="Ex: Peça arranhada no canto direito..."
                                        className="w-full border border-slate-200 rounded p-2 text-xs focus:border-blue-500"
                                    />
                                </div>
                                <button 
                                    type="button"
                                    onClick={handleAddProblema}
                                    className="bg-blue-600 text-white font-bold p-2 text-xs rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 min-w-[100px]"
                                >
                                    <PlusCircle className="w-4 h-4" /> Adicionar
                                </button>
                            </div>

                            {problemas.length > 0 && (
                                <div className="mt-3 overflow-hidden border border-slate-200 rounded-lg">
                                    <table className="w-full text-left text-xs bg-white">
                                        <thead className="bg-slate-100 text-slate-600 border-b">
                                            <tr>
                                                <th className="px-3 py-2 font-semibold">Setor</th>
                                                <th className="px-3 py-2 font-semibold">Defeito</th>
                                                <th className="px-3 py-2 font-semibold">Descrição</th>
                                                <th className="px-3 py-2 font-semibold w-12 text-center">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {problemas.map((prob, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="px-3 py-2 font-medium">{prob.recurso}</td>
                                                    <td className="px-3 py-2">{prob.ncDesc}</td>
                                                    <td className="px-3 py-2 text-slate-500">{prob.observacao}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleRemoveProblema(idx)}
                                                            className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded hover:bg-red-100"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Evidências Fotográficas */}
                        <div className="pt-4 border-t border-slate-200">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Evidências Gerais (Opcional)</label>
                            
                            <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-600 rounded-lg p-3 cursor-pointer transition-colors text-sm font-medium">
                                <Camera className="w-5 h-5" />
                                <span>Tirar Foto / Anexar Imagens</span>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    multiple 
                                    capture="environment" // FORÇA CÂMERA NO MOBILE
                                    className="hidden" 
                                    ref={fileInputRef}
                                    onChange={handlePhotoUpload}
                                />
                            </label>
                            {fotosRegistro.length > 0 && (
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    {fotosRegistro.map((foto, index) => (
                                        <div key={index} className="relative group">
                                            <img src={foto} alt={`Evidência ${index + 1}`} className="h-24 w-full object-cover rounded-lg border border-slate-200" />
                                            <button 
                                                type="button" 
                                                onClick={() => removeFoto(index)}
                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading || problemas.length === 0}
                            className={`w-full text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors mt-4
                                ${problemas.length === 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900'}`}
                        >
                            <Save className="w-5 h-5" />
                            {loading ? 'Salvando...' : `Salvar e Registrar ${problemas.length} Problema(s)`}
                        </button>
                    </form>

                    {/* Histórico */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3 border-b pb-2">
                            <History className="w-4 h-4 text-slate-500" />
                            Histórico de RNCs desta OP
                        </h3>

                        {loadingHistory ? (
                            <div className="text-center text-slate-500 text-xs py-4 animate-pulse">Carregando...</div>
                        ) : rncs.length === 0 ? (
                            <div className="text-center text-slate-400 text-xs py-4">Nenhuma RNC registrada para esta OP.</div>
                        ) : (
                            <div className="space-y-3">
                                {rncs.map(rnc => (
                                    <div key={rnc.id} className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="text-xs font-bold text-slate-800">
                                                    [{rnc.recurso_inconformidade}] {rnc.nc_descricao || 'Defeito Padrão'}
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                    Por: {rnc.criado_por} em {new Date(rnc.data_criacao).toLocaleString('pt-BR')}
                                                </div>
                                            </div>
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusColor(rnc.status)}`}>
                                                {rnc.status}
                                            </span>
                                        </div>

                                        {editingId === rnc.id ? (
                                            <div className="my-2 space-y-2">
                                                <input 
                                                    type="text" 
                                                    value={editObsVal} 
                                                    onChange={(e) => setEditObsVal(e.target.value)} 
                                                    className="w-full text-xs p-1.5 border border-blue-300 rounded focus:border-blue-500"
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleEditAbertoRnc(rnc.id, editObsVal)} className="px-3 bg-blue-600 text-white text-[10px] font-bold py-1.5 rounded">Salvar</button>
                                                    <button onClick={() => setEditingId(null)} className="px-3 bg-slate-100 text-slate-600 text-[10px] font-bold py-1.5 rounded border">Cancelar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-600 my-2 italic flex items-center justify-between group">
                                                <span>"{rnc.observacao}"</span>
                                                {rnc.status !== 'CONCLUIDO' && (
                                                    <div className="hidden group-hover:flex gap-1">
                                                        <button 
                                                            onClick={() => { setEditingId(rnc.id); setEditObsVal(rnc.observacao); }} 
                                                            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                                            title="Editar Observação"
                                                        ><Edit2 className="w-3.5 h-3.5" /></button>
                                                        <button 
                                                            onClick={() => handleDeleteRnc(rnc.id)} 
                                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                            title="Excluir RNC"
                                                        ><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {(rnc.fotos_registro ? JSON.parse(rnc.fotos_registro) : (rnc.imagem_evidencia ? [rnc.imagem_evidencia] : [])).length > 0 && (
                                            <div className="mb-2 flex flex-wrap gap-2">
                                                {(rnc.fotos_registro ? JSON.parse(rnc.fotos_registro) : (rnc.imagem_evidencia ? [rnc.imagem_evidencia] : [])).map((imgUrl, i) => (
                                                    <img key={i} src={imgUrl} alt={`Anexo ${i+1}`} className="h-16 w-16 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80" onClick={() => window.open(imgUrl)} />
                                                ))}
                                            </div>
                                        )}

                                        {rnc.status !== 'CONCLUIDO' && editingId !== rnc.id ? (
                                            treatingId === rnc.id ? (
                                                <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                                                    <select 
                                                        className="w-full text-xs p-1.5 border rounded"
                                                        value={tratativaStatus}
                                                        onChange={e => setTratativaStatus(e.target.value)}
                                                    >
                                                        <option value="EM ANDAMENTO">Em Andamento</option>
                                                        <option value="CONCLUIDO">Concluir</option>
                                                    </select>
                                                    <textarea 
                                                        placeholder="Ação tomada para resolver..."
                                                        className="w-full text-xs p-1.5 border rounded"
                                                        rows="2"
                                                        value={tratativaObs}
                                                        onChange={e => setTratativaObs(e.target.value)}
                                                    />
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleTreatRnc(rnc.id)}
                                                            className="flex-1 bg-emerald-600 text-white text-[10px] font-bold py-1.5 rounded"
                                                        >
                                                            Confirmar Tratativa
                                                        </button>
                                                        <button 
                                                            onClick={() => setTreatingId(null)}
                                                            className="px-3 bg-slate-100 text-slate-600 text-[10px] font-bold py-1.5 rounded border"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-2 pt-2 border-t border-slate-100">
                                                    <button 
                                                        onClick={() => { 
                                                            setTreatingId(rnc.id); 
                                                            setTratativaStatus('CONCLUIDO'); 
                                                            setTratativaObs(''); 
                                                        }}
                                                        className="w-full text-[10px] font-bold bg-indigo-50 text-indigo-700 py-1.5 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors"
                                                    >
                                                        TRATAR PROBLEMA
                                                    </button>
                                                </div>
                                            )
                                        ) : (
                                            <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-emerald-700 bg-emerald-50/50 p-2 rounded">
                                                <span className="font-bold">Solução:</span> {rnc.tratativa_resposta || 'Nenhuma nota de solução inserida.'}
                                                <div className="text-emerald-600 mt-0.5 opacity-80">Por: {rnc.tratado_por}</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

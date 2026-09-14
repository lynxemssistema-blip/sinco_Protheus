import React, { useState, useEffect, useCallback } from 'react';
import {
    X,
    FileText,
    Wrench,
    Building2,
    AlertTriangle,
    Layers,
    Package,
    ExternalLink,
    Sparkles,
    Edit3,
    CheckCircle2,
    XCircle,
    Loader2,
    RefreshCw,
    FolderOpen,
    Clock,
    Tag,
    Hash,
    Plus,
    Trash2,
    Save,
    Minimize2,
    Maximize2,
    Search
} from 'lucide-react';
import api, {
    getSincoProduto,
    getSincoOperacoes,
    getSincoRestricoes,
    getSincoRestricoesSz0,
    getSincoArvore,
    getProductDocuments,
    updateSincoProductStructure,
    updateSincoProdutoCliente,
    updateSincoRoteiro,
    createSincoRestricaoSz0,
    searchSincoProdutos
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function SincoNodeManager({
    codigo,
    descricao,
    nivel = 0,
    quantidade = 1,
    unidade = 'UN',
    displayMode = 'modal', // 'accordion' | 'drawer' | 'modal'
    onClose,
    onSuccessRefresh,
    onCarregarNoFormulario,
    onCadastrarProtheus
}) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('materiais'); // 'materiais' | 'sz1' | 'roteiro' | 'sz0' | 'geral' | 'docs'
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null);

    // Dados por aba
    const [dadosGerais, setDadosGerais] = useState(null);
    const [docs, setDocs] = useState([]);
    
    // 1. Árvore do Produto / Materiais (SG1)
    const [materiais, setMateriais] = useState([]);
    const [materiaisOriginal, setMateriaisOriginal] = useState([]);
    const [isEditingMateriais, setIsEditingMateriais] = useState(false);

    // 2. Clientes (SZ1)
    const [clientesSz1, setClientesSz1] = useState([]);
    const [clientesSz1Original, setClientesSz1Original] = useState([]);
    const [isEditingSz1, setIsEditingSz1] = useState(false);

    // 3. Roteiro (SG2)
    const [roteiro, setRoteiro] = useState([]);
    const [roteiroOriginal, setRoteiroOriginal] = useState([]);
    const [isEditingRoteiro, setIsEditingRoteiro] = useState(false);

    // 4. Restrições (SZ0)
    const [restricoesSz0, setRestricoesSz0] = useState([]);
    const [showNovoSz0, setShowNovoSz0] = useState(false);
    const [novoSz0, setNovoSz0] = useState({
        resumo: '',
        restricao: '',
        tipo_restricao: 'PROCESSO',
        cod_maquina: '',
        status: 'P',
        revMetalfisa: ''
    });

    const cleanCodigo = (codigo || '').replace(/\.[^/.]+$/, '').trim().toUpperCase();

    const showMsg = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const carregarTudo = useCallback(async () => {
        if (!cleanCodigo) return;
        setLoading(true);
        try {
            const [prodRes, docsRes, opeRes, sz1Res, sz0Res, arvRes] = await Promise.allSettled([
                getSincoProduto(cleanCodigo),
                getProductDocuments(cleanCodigo),
                getSincoOperacoes(cleanCodigo),
                getSincoRestricoes(cleanCodigo),
                getSincoRestricoesSz0(cleanCodigo),
                getSincoArvore(cleanCodigo)
            ]);

            if (prodRes.status === 'fulfilled' && prodRes.value) setDadosGerais(prodRes.value);
            else setDadosGerais(null);

            if (docsRes.status === 'fulfilled' && Array.isArray(docsRes.value)) setDocs(docsRes.value);
            else setDocs([]);

            // Materiais (SG1)
            if (arvRes.status === 'fulfilled' && Array.isArray(arvRes.value)) {
                setMateriais(arvRes.value);
                setMateriaisOriginal(JSON.parse(JSON.stringify(arvRes.value)));
            } else {
                setMateriais([]);
                setMateriaisOriginal([]);
            }

            // Clientes (SZ1)
            if (sz1Res.status === 'fulfilled' && Array.isArray(sz1Res.value)) {
                setClientesSz1(sz1Res.value);
                setClientesSz1Original(JSON.parse(JSON.stringify(sz1Res.value)));
            } else {
                setClientesSz1([]);
                setClientesSz1Original([]);
            }

            // Roteiro (SG2)
            if (opeRes.status === 'fulfilled' && Array.isArray(opeRes.value)) {
                setRoteiro(opeRes.value);
                setRoteiroOriginal(JSON.parse(JSON.stringify(opeRes.value)));
            } else {
                setRoteiro([]);
                setRoteiroOriginal([]);
            }

            // Restrições (SZ0)
            if (sz0Res.status === 'fulfilled' && Array.isArray(sz0Res.value)) {
                setRestricoesSz0(sz0Res.value);
            } else {
                setRestricoesSz0([]);
            }

        } catch (err) {
            console.error('Erro ao carregar dados do nó:', err);
            showMsg('Falha ao carregar alguns dados deste componente.', 'error');
        } finally {
            setLoading(false);
        }
    }, [cleanCodigo]);

    useEffect(() => {
        if (cleanCodigo) {
            carregarTudo();
        }
    }, [cleanCodigo, carregarTudo]);

    // ==========================================
    // 1. SALVAR MATERIAIS / ESTRUTURA (SG1)
    // ==========================================
    const handleAddMaterialRow = () => {
        setMateriais(prev => [
            ...prev,
            {
                nivel: `N${Number(nivel) + 1}`,
                componente: '',
                descricao: '',
                quantidade: 1,
                unidade: 'UN',
                tipo: 'MP',
                isNew: true
            }
        ]);
        setIsEditingMateriais(true);
    };

    const handleSalvarMateriais = async () => {
        const validos = materiais.filter(m => !m.deleted && m.componente && m.componente.trim());
        if (validos.length === 0 && materiaisOriginal.length === 0) {
            showMsg('Nenhum componente para salvar na estrutura.', 'warning');
            return;
        }

        const estruturaPayload = validos.map(m => ({
            componente: m.componente.trim().toUpperCase(),
            quantidade: Number(m.quantidade || 1),
            unidade: (m.unidade || 'UN').trim().toUpperCase(),
            tipo: (m.tipo || 'MP').trim().toUpperCase(),
            descricao: (m.descricao || '').trim()
        }));

        setSaving(true);
        try {
            await updateSincoProductStructure({
                noper: materiaisOriginal.length === 0 ? 3 : 4,
                empresa: '01',
                filial: '0101',
                produto: cleanCodigo,
                quantidade: 1,
                estrutura: estruturaPayload
            });
            showMsg('Estrutura de materiais (SG1) salva com sucesso!', 'success');
            setIsEditingMateriais(false);
            await carregarTudo();
            if (onSuccessRefresh) onSuccessRefresh(cleanCodigo);
        } catch (err) {
            console.error('Erro ao salvar materiais:', err);
            showMsg(err.response?.data?.error || err.message || 'Erro ao salvar estrutura', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ==========================================
    // 2. SALVAR CLIENTES (SZ1)
    // ==========================================
    const handleAddClienteRow = () => {
        setClientesSz1(prev => [
            ...prev,
            {
                cliente: '',
                loja: '0001',
                cod_cliente: '',
                desc_cliente: '',
                revisao: '00',
                isNew: true
            }
        ]);
        setIsEditingSz1(true);
    };

    const handleSalvarClientes = async () => {
        const validos = clientesSz1.filter(c => !c.deleted && c.cliente && c.cliente.trim());
        if (validos.length === 0 && clientesSz1Original.length === 0) {
            showMsg('Nenhum vínculo de cliente para salvar.', 'warning');
            return;
        }

        const payloadItems = validos.map(c => ({
            Z1_CLIENTE: String(c.cliente || '').trim().toUpperCase(),
            Z1_LOJA: String(c.loja || '0001').trim().toUpperCase(),
            Z1_PRODUTO: cleanCodigo,
            Z1_CODCLI: String(c.cod_cliente || '').trim().toUpperCase(),
            Z1_DESCCLI: String(c.desc_cliente || descricao || cleanCodigo).trim().toUpperCase(),
            Z1_REVISAO: String(c.revisao || '00').trim().toUpperCase(),
            RECNO: c.recno ? Number(c.recno) : undefined
        }));

        setSaving(true);
        try {
            await updateSincoProdutoCliente({
                data: {
                    CFILANT: '0101',
                    EMPRESA: '01',
                    NOPER: clientesSz1Original.length === 0 ? 3 : 4,
                    produtos_clientes: payloadItems
                }
            });
            showMsg('Vínculos de cliente (SZ1) salvos com sucesso!', 'success');
            setIsEditingSz1(false);
            await carregarTudo();
            if (onSuccessRefresh) onSuccessRefresh(cleanCodigo);
        } catch (err) {
            console.error('Erro ao salvar cliente SZ1:', err);
            showMsg(err.response?.data?.error || err.message || 'Erro ao salvar cliente', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ==========================================
    // 3. SALVAR ROTEIRO (SG2)
    // ==========================================
    const handleAddOperacaoRow = () => {
        const nextSeq = String((roteiro.filter(r => !r.deleted).length + 1) * 10).padStart(2, '0');
        setRoteiro(prev => [
            ...prev,
            {
                operacao: nextSeq,
                recurso: '',
                descricao: '',
                tempo: 1,
                setup: 0,
                isNew: true
            }
        ]);
        setIsEditingRoteiro(true);
    };

    const handleSalvarRoteiro = async () => {
        const validos = roteiro.filter(r => !r.deleted && r.operacao && r.recurso);
        if (validos.length === 0 && roteiroOriginal.length === 0) {
            showMsg('Nenhuma operação para salvar no roteiro.', 'warning');
            return;
        }

        const roteirosPayload = validos.map(op => ({
            G2_OPERAC: String(op.operacao).trim().padStart(2, '0'),
            G2_DESCRI: (op.descricao || '').substring(0, 30),
            G2_RECURSO: (op.recurso || '').trim(),
            G2_FERRAM: '',
            G2_TPALOCF: '',
            G2_SETUP: String(op.setup || '0'),
            G2_FORMSTP: '',
            G2_LOTEPAD: 1,
            G2_TEMPAD: Number(op.tempo || 1),
            G2_TPOPER: '1',
            G2_TPSOBRE: '',
            G2_TEMPSOB: '',
            G2_CTRAB: '',
            G2_TEMPEND: '',
            G2_MAOOBRA: 1,
            OPERACAO: op.isNew ? 'INCLUIR' : 'ALTERAR'
        }));

        setSaving(true);
        try {
            await updateSincoRoteiro({
                data: {
                    NOPER: roteiroOriginal.length === 0 ? 3 : 4,
                    EMPRESA: '01',
                    CFILANT: '0101',
                    G2_CODIGO: '01',
                    G2_PRODUTO: cleanCodigo,
                    roteiros: roteirosPayload
                }
            });
            showMsg('Roteiro de operações (SG2) salvo com sucesso!', 'success');
            setIsEditingRoteiro(false);
            await carregarTudo();
            if (onSuccessRefresh) onSuccessRefresh(cleanCodigo);
        } catch (err) {
            console.error('Erro ao salvar roteiro:', err);
            showMsg(err.response?.data?.error || err.message || 'Erro ao salvar roteiro', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ==========================================
    // 4. SALVAR RESTRIÇÃO (SZ0)
    // ==========================================
    const handleSalvarSz0 = async () => {
        if (!novoSz0.resumo.trim() || !novoSz0.restricao.trim()) {
            showMsg('Preencha o Resumo e a Descrição da restrição.', 'warning');
            return;
        }

        setSaving(true);
        try {
            await createSincoRestricaoSz0({
                produto: cleanCodigo,
                item: String(restricoesSz0.length + 1).padStart(3, '0'),
                resumo: novoSz0.resumo.trim(),
                restricao: novoSz0.restricao.trim(),
                tipo_restricao: novoSz0.tipo_restricao,
                cod_maquina: (novoSz0.cod_maquina || '').trim(),
                status: novoSz0.status || 'P',
                revMetalfisa: novoSz0.revMetalfisa || dadosGerais?.rev || '',
                responsavel: user?.nome || user?.login || 'Engenharia'
            });
            showMsg('Restrição de engenharia (SZ0) salva com sucesso!', 'success');
            setShowNovoSz0(false);
            setNovoSz0({
                resumo: '',
                restricao: '',
                tipo_restricao: 'PROCESSO',
                cod_maquina: '',
                status: 'P',
                revMetalfisa: ''
            });
            await carregarTudo();
            if (onSuccessRefresh) onSuccessRefresh(cleanCodigo);
        } catch (err) {
            console.error('Erro ao salvar restrição SZ0:', err);
            showMsg(err.response?.data?.error || err.message || 'Erro ao salvar restrição', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ==========================================
    // RENDERIZAÇÃO DO CONTEÚDO DAS 4 SEÇÕES
    // ==========================================
    const renderContent = () => {
        if (loading) {
            return (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="text-xs font-semibold">Consultando dados de {cleanCodigo}...</span>
                </div>
            );
        }

        return (
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">

                {/* Notificação Temporária */}
                {notification && (
                    <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 animate-slideDown shadow-xs ${
                        notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                        notification.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                        {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        <span>{notification.msg}</span>
                    </div>
                )}

                {/* ABA 1: ÁRVORE DO PRODUTO (MATERIAIS - SG1) */}
                {activeTab === 'materiais' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-emerald-600" />
                                    Árvore do Produto / Materiais (BOM SG1)
                                </h4>
                                <p className="text-[11px] text-slate-500">Componentes e matérias-primas que compõem este nó ({materiais.filter(m => !m.deleted).length} itens)</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddMaterialRow}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                >
                                    <Plus size={13} />
                                    <span>Adicionar Material</span>
                                </button>
                                {isEditingMateriais && (
                                    <button
                                        type="button"
                                        onClick={handleSalvarMateriais}
                                        disabled={saving}
                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                    >
                                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                        <span>Salvar no Protheus</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                                    <tr>
                                        <th className="px-3 py-2 w-14">Nív.</th>
                                        <th className="px-3 py-2">Código Componente</th>
                                        <th className="px-3 py-2">Descrição</th>
                                        <th className="px-3 py-2 w-20 text-right">Qtde</th>
                                        <th className="px-3 py-2 w-16 text-center">UN</th>
                                        <th className="px-3 py-2 w-16 text-center">Tipo</th>
                                        <th className="px-3 py-2 w-12 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {materiais.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                                                Nenhum componente cadastrado na estrutura deste item.
                                            </td>
                                        </tr>
                                    ) : (
                                        materiais.map((mat, idx) => (
                                            <tr key={idx} className={`transition-colors ${mat.deleted ? 'bg-red-50/50 opacity-40 line-through' : 'hover:bg-slate-50'}`}>
                                                <td className="px-3 py-2 font-mono text-slate-500">{mat.nivel || `N${Number(nivel) + 1}`}</td>
                                                <td className="px-3 py-1.5 font-mono font-bold text-slate-800">
                                                    {mat.isNew ? (
                                                        <input
                                                            type="text"
                                                            value={mat.componente || ''}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setMateriais(prev => prev.map((m, i) => i === idx ? { ...m, componente: val } : m));
                                                                setIsEditingMateriais(true);
                                                            }}
                                                            placeholder="Ex: MTA-1827"
                                                            className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono uppercase focus:ring-1 focus:ring-emerald-500"
                                                        />
                                                    ) : (
                                                        mat.componente
                                                    )}
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-600">
                                                    {mat.isNew ? (
                                                        <input
                                                            type="text"
                                                            value={mat.descricao || ''}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setMateriais(prev => prev.map((m, i) => i === idx ? { ...m, descricao: val } : m));
                                                                setIsEditingMateriais(true);
                                                            }}
                                                            placeholder="Descrição do material..."
                                                            className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-emerald-500"
                                                        />
                                                    ) : (
                                                        mat.descricao || '—'
                                                    )}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={mat.quantidade || 1}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setMateriais(prev => prev.map((m, i) => i === idx ? { ...m, quantidade: val } : m));
                                                            setIsEditingMateriais(true);
                                                        }}
                                                        className="w-16 text-right border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 text-center font-mono">
                                                    <input
                                                        type="text"
                                                        maxLength={2}
                                                        value={mat.unidade || 'UN'}
                                                        onChange={e => {
                                                            const val = e.target.value.toUpperCase();
                                                            setMateriais(prev => prev.map((m, i) => i === idx ? { ...m, unidade: val } : m));
                                                            setIsEditingMateriais(true);
                                                        }}
                                                        className="w-12 text-center border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono uppercase focus:ring-1 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 text-center">
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                                                        {mat.tipo || 'MP'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setMateriais(prev => prev.map((m, i) => i === idx ? { ...m, deleted: !m.deleted } : m));
                                                            setIsEditingMateriais(true);
                                                        }}
                                                        className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                                        title={mat.deleted ? "Desfazer exclusão" : "Remover componente"}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ABA 2: CLIENTES (SZ1) */}
                {activeTab === 'sz1' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                    Produto Metalfisa / Cliente (SZ1)
                                </h4>
                                <p className="text-[11px] text-slate-500">Part numbers de montadoras e clientes vinculados a este código ({clientesSz1.filter(c => !c.deleted).length} vínculos)</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddClienteRow}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                >
                                    <Plus size={13} />
                                    <span>Adicionar Cliente</span>
                                </button>
                                {isEditingSz1 && (
                                    <button
                                        type="button"
                                        onClick={handleSalvarClientes}
                                        disabled={saving}
                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                    >
                                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                        <span>Salvar no Protheus</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                                    <tr>
                                        <th className="px-3 py-2 w-28">Cliente (Cód)</th>
                                        <th className="px-3 py-2 w-16">Loja</th>
                                        <th className="px-3 py-2">Part Number Cliente</th>
                                        <th className="px-3 py-2">Descrição no Cliente</th>
                                        <th className="px-3 py-2 w-20 text-center">Revisão</th>
                                        <th className="px-3 py-2 w-12 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {clientesSz1.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                                                Nenhum vínculo de cliente cadastrado para este produto.
                                            </td>
                                        </tr>
                                    ) : (
                                        clientesSz1.map((cli, idx) => (
                                            <tr key={idx} className={`transition-colors ${cli.deleted ? 'bg-red-50/50 opacity-40 line-through' : 'hover:bg-slate-50'}`}>
                                                <td className="px-3 py-1.5 font-bold font-mono">
                                                    <input
                                                        type="text"
                                                        value={cli.cliente || ''}
                                                        onChange={e => {
                                                            const val = e.target.value.toUpperCase();
                                                            setClientesSz1(prev => prev.map((c, i) => i === idx ? { ...c, cliente: val } : c));
                                                            setIsEditingSz1(true);
                                                        }}
                                                        placeholder="Ex: 000001"
                                                        className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono uppercase focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 font-mono">
                                                    <input
                                                        type="text"
                                                        maxLength={4}
                                                        value={cli.loja || '0001'}
                                                        onChange={e => {
                                                            const val = e.target.value.toUpperCase();
                                                            setClientesSz1(prev => prev.map((c, i) => i === idx ? { ...c, loja: val } : c));
                                                            setIsEditingSz1(true);
                                                        }}
                                                        className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono uppercase focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 font-mono font-bold text-slate-800">
                                                    <input
                                                        type="text"
                                                        value={cli.cod_cliente || ''}
                                                        onChange={e => {
                                                            const val = e.target.value.toUpperCase();
                                                            setClientesSz1(prev => prev.map((c, i) => i === idx ? { ...c, cod_cliente: val } : c));
                                                            setIsEditingSz1(true);
                                                        }}
                                                        placeholder="Ex: 10029384-A"
                                                        className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono uppercase focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-600">
                                                    <input
                                                        type="text"
                                                        value={cli.desc_cliente || ''}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setClientesSz1(prev => prev.map((c, i) => i === idx ? { ...c, desc_cliente: val } : c));
                                                            setIsEditingSz1(true);
                                                        }}
                                                        placeholder="Descrição técnica..."
                                                        className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 text-center font-mono">
                                                    <input
                                                        type="text"
                                                        maxLength={6}
                                                        value={cli.revisao || '00'}
                                                        onChange={e => {
                                                            const val = e.target.value.toUpperCase();
                                                            setClientesSz1(prev => prev.map((c, i) => i === idx ? { ...c, revisao: val } : c));
                                                            setIsEditingSz1(true);
                                                        }}
                                                        className="w-14 text-center border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono uppercase focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setClientesSz1(prev => prev.map((c, i) => i === idx ? { ...c, deleted: !c.deleted } : c));
                                                            setIsEditingSz1(true);
                                                        }}
                                                        className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                                        title={cli.deleted ? "Desfazer exclusão" : "Remover vínculo"}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ABA 3: OPERAÇÕES / ROTEIRO (SG2) */}
                {activeTab === 'roteiro' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                    <Wrench className="w-4 h-4 text-amber-600" />
                                    Operações de Fabricação (Roteiro SG2)
                                </h4>
                                <p className="text-[11px] text-slate-500">Sequenciamento produtivo, máquinas e tempos padrão ({roteiro.filter(r => !r.deleted).length} operações)</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddOperacaoRow}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                >
                                    <Plus size={13} />
                                    <span>Adicionar Operação</span>
                                </button>
                                {isEditingRoteiro && (
                                    <button
                                        type="button"
                                        onClick={handleSalvarRoteiro}
                                        disabled={saving}
                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                    >
                                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                        <span>Salvar no Protheus</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                                    <tr>
                                        <th className="px-3 py-2 w-16 text-center">Seq.</th>
                                        <th className="px-3 py-2 w-28">Recurso/Máq.</th>
                                        <th className="px-3 py-2">Descrição da Operação</th>
                                        <th className="px-3 py-2 w-20 text-right">Tempo (min)</th>
                                        <th className="px-3 py-2 w-20 text-right">Setup (min)</th>
                                        <th className="px-3 py-2 w-12 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {roteiro.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                                                Nenhum roteiro cadastrado para este produto.
                                            </td>
                                        </tr>
                                    ) : (
                                        roteiro.map((op, idx) => (
                                            <tr key={idx} className={`transition-colors ${op.deleted ? 'bg-red-50/50 opacity-40 line-through' : 'hover:bg-slate-50'}`}>
                                                <td className="px-3 py-1.5 text-center font-mono font-bold">
                                                    <input
                                                        type="text"
                                                        maxLength={3}
                                                        value={op.operacao || ''}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setRoteiro(prev => prev.map((r, i) => i === idx ? { ...r, operacao: val } : r));
                                                            setIsEditingRoteiro(true);
                                                        }}
                                                        className="w-12 text-center border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono font-bold focus:ring-1 focus:ring-amber-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 font-mono font-bold text-slate-800">
                                                    <input
                                                        type="text"
                                                        value={op.recurso || ''}
                                                        onChange={e => {
                                                            const val = e.target.value.toUpperCase();
                                                            setRoteiro(prev => prev.map((r, i) => i === idx ? { ...r, recurso: val } : r));
                                                            setIsEditingRoteiro(true);
                                                        }}
                                                        placeholder="Ex: DOBRA01"
                                                        className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono uppercase focus:ring-1 focus:ring-amber-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-600">
                                                    <input
                                                        type="text"
                                                        value={op.descricao || ''}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setRoteiro(prev => prev.map((r, i) => i === idx ? { ...r, descricao: val } : r));
                                                            setIsEditingRoteiro(true);
                                                        }}
                                                        placeholder="Ex: Dobrar na prensa 100t..."
                                                        className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-amber-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={op.tempo || 1}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setRoteiro(prev => prev.map((r, i) => i === idx ? { ...r, tempo: val } : r));
                                                            setIsEditingRoteiro(true);
                                                        }}
                                                        className="w-16 text-right border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono focus:ring-1 focus:ring-amber-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={op.setup || 0}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setRoteiro(prev => prev.map((r, i) => i === idx ? { ...r, setup: val } : r));
                                                            setIsEditingRoteiro(true);
                                                        }}
                                                        className="w-16 text-right border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono focus:ring-1 focus:ring-amber-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setRoteiro(prev => prev.map((r, i) => i === idx ? { ...r, deleted: !r.deleted } : r));
                                                            setIsEditingRoteiro(true);
                                                        }}
                                                        className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                                        title={op.deleted ? "Desfazer exclusão" : "Remover operação"}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ABA 4: RESTRIÇÕES DE ENGENHARIA (SZ0) */}
                {activeTab === 'sz0' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                    Restrições de Engenharia e Processo (SZ0)
                                </h4>
                                <p className="text-[11px] text-slate-500">Bloqueios de fábrica, avisos técnicos e especificações críticas ({restricoesSz0.length} restrições)</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowNovoSz0(!showNovoSz0)}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                            >
                                <Plus size={13} />
                                <span>{showNovoSz0 ? 'Fechar Formulário' : 'Nova Restrição SZ0'}</span>
                            </button>
                        </div>

                        {/* Formulário Inline de Nova Restrição */}
                        {showNovoSz0 && (
                            <div className="p-4 bg-red-50/60 border border-red-200 rounded-lg space-y-3 animate-fadeIn">
                                <h5 className="text-xs font-bold text-red-900">Cadastrar Nova Restrição para {cleanCodigo}</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Resumo do Aviso *</label>
                                        <input
                                            type="text"
                                            value={novoSz0.resumo}
                                            onChange={e => setNovoSz0(p => ({ ...p, resumo: e.target.value }))}
                                            placeholder="Ex: Cuidado com a furação na borda"
                                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-red-500 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Máquina / Recurso (Opcional)</label>
                                        <input
                                            type="text"
                                            value={novoSz0.cod_maquina}
                                            onChange={e => setNovoSz0(p => ({ ...p, cod_maquina: e.target.value.toUpperCase() }))}
                                            placeholder="Ex: CORTE01"
                                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono uppercase focus:ring-1 focus:ring-red-500 bg-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Descrição Técnica Detalhada *</label>
                                    <textarea
                                        rows={2}
                                        value={novoSz0.restricao}
                                        onChange={e => setNovoSz0(p => ({ ...p, restricao: e.target.value }))}
                                        placeholder="Descreva a instrução técnica completa para os operadores de fábrica..."
                                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-red-500 bg-white resize-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowNovoSz0(false)}
                                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSalvarSz0}
                                        disabled={saving}
                                        className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-2xs"
                                    >
                                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                        <span>Gravar Restrição SZ0</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                                    <tr>
                                        <th className="px-3 py-2 w-14 text-center">Item</th>
                                        <th className="px-3 py-2">Resumo</th>
                                        <th className="px-3 py-2">Restrição Completa</th>
                                        <th className="px-3 py-2 w-24">Responsável</th>
                                        <th className="px-3 py-2 w-20 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {restricoesSz0.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                                Nenhuma restrição SZ0 cadastrada para este produto.
                                            </td>
                                        </tr>
                                    ) : (
                                        restricoesSz0.map((r, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-2 text-center font-mono font-bold text-slate-500">{r.item || idx + 1}</td>
                                                <td className="px-3 py-2 font-bold text-slate-800">{r.resumo || '—'}</td>
                                                <td className="px-3 py-2 text-slate-600 text-[11px]">{r.restricao || '—'}</td>
                                                <td className="px-3 py-2 text-slate-500 text-[11px]">{r.responsavel || 'Engenharia'}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                        r.status === 'A' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {r.status === 'A' ? 'Aprovado' : 'Pendente'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ABA 5: DESENHOS / DOCUMENTOS (PDF) */}
                {activeTab === 'docs' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-red-600" />
                                    Desenhos Técnicos e Arquivos (PDF)
                                </h4>
                                <p className="text-[11px] text-slate-500">Documentos oficiais de engenharia vinculados ao produto</p>
                            </div>
                        </div>

                        {docs.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 italic text-xs">
                                Nenhum documento técnico anexado para {cleanCodigo}.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {docs.map((doc, idx) => (
                                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3 shadow-2xs hover:border-blue-300 transition-colors">
                                        <div className="flex items-center gap-2.5 overflow-hidden">
                                            <div className="p-2 bg-red-50 text-red-600 rounded-lg shrink-0">
                                                <FileText size={18} />
                                            </div>
                                            <div className="overflow-hidden">
                                                <span className="font-semibold text-xs text-slate-800 truncate block">{doc.nome_arquivo || doc.tipo || `Desenho ${idx + 1}`}</span>
                                                <span className="text-[10px] text-slate-400 font-mono block">Rev: {doc.revisao || dadosGerais?.rev || '00'}</span>
                                            </div>
                                        </div>
                                        <a
                                            href={doc.url_arquivo}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
                                        >
                                            <ExternalLink size={12} />
                                            <span>Abrir PDF</span>
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ABA 6: DADOS GERAIS DO PRODUTO */}
                {activeTab === 'geral' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Tipo de Produto</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{dadosGerais?.tipo || '—'}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Grupo de Estoque</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{dadosGerais?.grupo || '—'}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Unidade de Medida</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{dadosGerais?.unidade || unidade || 'UN'}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Peso Líquido</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{dadosGerais?.peso ? `${dadosGerais.peso} kg` : '—'}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Espessura</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{dadosGerais?.espessura || '—'}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Largura</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{dadosGerais?.largura || '—'}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Comprimento</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{dadosGerais?.comprimento || '—'}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Revisão ERP</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{dadosGerais?.rev || dadosGerais?.xrevm || '00'}</span>
                        </div>
                    </div>
                )}

            </div>
        );
    };

    // ==========================================
    // BARRA DE ABAS
    // ==========================================
    const renderTabsBar = () => (
        <div className="px-4 bg-slate-100/90 border-b border-slate-200 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none">
            <button
                type="button"
                onClick={() => setActiveTab('materiais')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'materiais' ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
                <Layers size={14} className="text-emerald-600" />
                <span>Árvore (Materiais)</span>
                {materiais.length > 0 && <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">{materiais.length}</span>}
            </button>

            <button
                type="button"
                onClick={() => setActiveTab('sz1')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'sz1' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
                <Building2 size={14} className="text-blue-600" />
                <span>Clientes (SZ1)</span>
                {clientesSz1.length > 0 && <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">{clientesSz1.length}</span>}
            </button>

            <button
                type="button"
                onClick={() => setActiveTab('roteiro')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'roteiro' ? 'border-amber-600 text-amber-700 bg-white shadow-2xs' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
                <Wrench size={14} className="text-amber-600" />
                <span>Roteiro (SG2)</span>
                {roteiro.length > 0 && <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">{roteiro.length}</span>}
            </button>

            <button
                type="button"
                onClick={() => setActiveTab('sz0')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'sz0' ? 'border-red-600 text-red-700 bg-white shadow-2xs' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
                <AlertTriangle size={14} className="text-red-600" />
                <span>Restrições (SZ0)</span>
                {restricoesSz0.length > 0 && <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">{restricoesSz0.length}</span>}
            </button>

            <button
                type="button"
                onClick={() => setActiveTab('docs')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'docs' ? 'border-slate-700 text-slate-900 bg-white shadow-2xs' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
                <FileText size={14} className="text-red-600" />
                <span>Desenhos PDF</span>
                {docs.length > 0 && <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">{docs.length}</span>}
            </button>

            <button
                type="button"
                onClick={() => setActiveTab('geral')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'geral' ? 'border-slate-700 text-slate-900 bg-white shadow-2xs' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
                <Package size={14} className="text-slate-600" />
                <span>Dados Gerais</span>
            </button>
        </div>
    );

    // ==========================================
    // CABEÇALHO DO COMPONENTE
    // ==========================================
    const renderHeader = () => (
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/30 rounded-lg border border-blue-500/40 text-blue-400">
                    <Layers size={18} />
                </div>
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-black text-white tracking-wide">{cleanCodigo}</span>
                        <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-400/30">Nível {nivel}</span>
                        {dadosGerais?.tipo && (
                            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-400/30">Tipo: {dadosGerais.tipo}</span>
                        )}
                        <span className="text-slate-300 text-xs truncate max-w-md hidden sm:inline">{descricao || dadosGerais?.titulo || ''}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {onCarregarNoFormulario && (
                    <button
                        type="button"
                        onClick={() => onCarregarNoFormulario(cleanCodigo)}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                        title="Carregar este componente como item ativo no formulário principal"
                    >
                        <Edit3 size={12} />
                        <span className="hidden md:inline">Formulário Principal</span>
                    </button>
                )}
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                        title="Fechar painel"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>
    );

    // ==========================================
    // 1. MODO ACCORDION (LINHA EXPANSÍVEL INLINE)
    // ==========================================
    if (displayMode === 'accordion') {
        return (
            <div className="bg-slate-50 border-y-2 border-indigo-500 shadow-inner my-1 rounded-lg overflow-hidden flex flex-col text-slate-800">
                {renderHeader()}
                {renderTabsBar()}
                {renderContent()}
            </div>
        );
    }

    // ==========================================
    // 2. MODO DRAWER (PAINEL LATERAL DESLIZANTE)
    // ==========================================
    if (displayMode === 'drawer') {
        return (
            <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[580px] lg:w-[680px] bg-white shadow-2xl border-l border-slate-300 flex flex-col animate-slideLeft">
                {renderHeader()}
                {renderTabsBar()}
                {renderContent()}
            </div>
        );
    }

    // ==========================================
    // 3. MODO MODAL (JANELA CENTRAL FLUTUANTE)
    // ==========================================
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
                {renderHeader()}
                {renderTabsBar()}
                {renderContent()}
            </div>
        </div>
    );
}

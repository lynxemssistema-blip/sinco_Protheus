import React, { useState, useEffect } from 'react';
import { 
    ShieldAlert, ShieldCheck, Download, Save, RefreshCw, Plus, Trash2, 
    FileText, CheckCircle2, DollarSign, Calendar, Users, Building, 
    Truck, Award, AlertTriangle, Eye, Edit3, ArrowLeft, ArrowUp, ArrowDown, 
    Layers, Sparkles, Server, Check, HelpCircle, Calculator
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getPropostaComercial, savePropostaComercial, exportPropostaWord } from '../../services/api';

const SUPERADMIN_EMAIL = 'edsonmanoel2012@gmail.com';

const PropostaComercialPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [activeTab, setActiveTab] = useState('identificacao'); // 'identificacao' | 'modulos' | 'comercial' | 'homologacao' | 'preview'
    const [activeModuleIndex, setActiveModuleIndex] = useState(0);
    const [proposta, setProposta] = useState(null);

    // Validação estrita de Superadmin (exclusivo para "SuperAdmin", "Edson", tipo "SA" ou "edsonmanoel2012@gmail.com")
    const userEmail = (user?.email || '').toLowerCase().trim();
    const userLogin = (user?.login || '').toLowerCase().trim();
    const userTipo = (user?.tipo || user?.TipoUsuario || '').toUpperCase().trim();
    const isSuperAdmin = 
        userLogin === 'superadmin' || 
        userLogin === 'edson' ||
        userTipo === 'SA' ||
        user?.id === 37 ||
        userEmail === 'edsonmanoel2012@gmail.com' || 
        userLogin === 'edsonmanoel2012@gmail.com';

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await getPropostaComercial();
            setProposta(data);
        } catch (err) {
            console.error('Erro ao carregar proposta:', err);
            toast.error(err.response?.data?.error || 'Erro ao carregar dados da proposta.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) {
            loadData();
        }
    }, [isSuperAdmin]);

    // Tela de Acesso Negado para qualquer outro usuário
    if (!isSuperAdmin) {
        return (
            <div className="min-h-[85vh] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-xl">
                    <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito e Confidencial</h2>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        Esta área é estritamente confidencial e reservada à Diretoria da Lynx (<span className="text-red-400 font-semibold">{SUPERADMIN_EMAIL}</span>).
                    </p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-all border border-slate-700 shadow-md"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retornar ao Painel Principal
                    </Link>
                </div>
            </div>
        );
    }

    const handleSave = async () => {
        try {
            setSaving(true);
            await savePropostaComercial(proposta);
            toast.success('Proposta comercial salva e documento Word sincronizado!');
        } catch (err) {
            console.error('Erro ao salvar proposta:', err);
            toast.error(err.response?.data?.error || 'Falha ao salvar proposta comercial.');
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadWord = async () => {
        try {
            setExporting(true);
            toast.info('Gerando arquivo Word oficial formatado...', { autoClose: 2000 });
            const blob = await exportPropostaWord();
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Proposta_Comercial_Lynx_Metalfisa_2026.docx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Download do documento Word concluído!');
        } catch (err) {
            console.error('Erro ao baixar Word:', err);
            toast.error('Erro ao gerar e transferir o arquivo Word.');
        } finally {
            setExporting(false);
        }
    };

    // ==========================================
    // HANDLERS DE EDIÇÃO TOTAL DO DOCUMENTO
    // ==========================================

    // 1. Dados Gerais do Cabeçalho
    const handleGeneralChange = (field, value) => {
        setProposta(prev => ({ ...prev, [field]: value }));
    };

    // 2. Dados das Partes (Fornecedor / Cliente)
    const handleFornecedorChange = (field, value) => {
        setProposta(prev => ({
            ...prev,
            fornecedor: { ...(prev.fornecedor || {}), [field]: value }
        }));
    };

    const handleClienteChange = (field, value) => {
        setProposta(prev => ({
            ...prev,
            cliente: { ...(prev.cliente || {}), [field]: value }
        }));
    };

    // 3. Licenciamento & Infraestrutura
    const handleLicenciamentoChange = (field, value) => {
        setProposta(prev => ({
            ...prev,
            licenciamento: { ...(prev.licenciamento || {}), [field]: value }
        }));
    };

    const handleInfraChange = (field, value) => {
        setProposta(prev => ({
            ...prev,
            infraestrutura: { ...(prev.infraestrutura || {}), [field]: value }
        }));
    };

    // 4. Diretrizes & Homologação
    const handleHomologacaoChange = (field, value) => {
        setProposta(prev => ({
            ...prev,
            homologacao: { ...(prev.homologacao || {}), [field]: value }
        }));
    };

    // 5. Módulos do Sistema (Adicionar, Excluir, Reordenar, Editar)
    const handleAddModule = () => {
        const nextId = `modulo_${Date.now()}`;
        const newMod = {
            id: nextId,
            nome: 'Novo Módulo Integrado',
            icone: 'Layers',
            descricao: 'Descreva aqui o objetivo operacional e estratégico deste módulo no sistema...',
            itens: [
                {
                    titulo: 'Recurso / Entregável Inicial',
                    descricao: 'Detalhamento das regras de negócio, telas e integrações deste recurso...'
                }
            ]
        };
        const nextModules = [...(proposta.modulos || []), newMod];
        setProposta(prev => ({ ...prev, modulos: nextModules }));
        setActiveModuleIndex(nextModules.length - 1);
        toast.info('Novo módulo adicionado!');
    };

    const handleRemoveModule = (modIndex) => {
        const modNome = proposta.modulos?.[modIndex]?.nome || `Módulo ${modIndex + 1}`;
        if (!window.confirm(`Deseja realmente excluir o módulo "${modNome}"?`)) return;
        const nextModules = proposta.modulos.filter((_, idx) => idx !== modIndex);
        setProposta(prev => ({ ...prev, modulos: nextModules }));
        if (activeModuleIndex >= nextModules.length) {
            setActiveModuleIndex(Math.max(0, nextModules.length - 1));
        }
        toast.warn('Módulo removido.');
    };

    const handleMoveModule = (modIndex, direction) => {
        const nextModules = [...proposta.modulos];
        const targetIdx = direction === 'up' ? modIndex - 1 : modIndex + 1;
        if (targetIdx < 0 || targetIdx >= nextModules.length) return;
        const temp = nextModules[modIndex];
        nextModules[modIndex] = nextModules[targetIdx];
        nextModules[targetIdx] = temp;
        setProposta(prev => ({ ...prev, modulos: nextModules }));
        setActiveModuleIndex(targetIdx);
    };

    const handleModuleChange = (index, field, value) => {
        const nextModules = [...proposta.modulos];
        nextModules[index] = { ...nextModules[index], [field]: value };
        setProposta(prev => ({ ...prev, modulos: nextModules }));
    };

    const handleAddItem = (modIndex) => {
        const nextModules = [...proposta.modulos];
        const nextItens = [
            ...(nextModules[modIndex].itens || []),
            { titulo: 'Novo Requisito / Recurso', descricao: 'Descreva detalhadamente a entrega deste item...' }
        ];
        nextModules[modIndex] = { ...nextModules[modIndex], itens: nextItens };
        setProposta(prev => ({ ...prev, modulos: nextModules }));
    };

    const handleRemoveItem = (modIndex, itemIndex) => {
        if (!window.confirm('Deseja realmente excluir este item do escopo?')) return;
        const nextModules = [...proposta.modulos];
        const nextItens = nextModules[modIndex].itens.filter((_, idx) => idx !== itemIndex);
        nextModules[modIndex] = { ...nextModules[modIndex], itens: nextItens };
        setProposta(prev => ({ ...prev, modulos: nextModules }));
    };

    const handleItemChange = (modIndex, itemIndex, field, value) => {
        const nextModules = [...proposta.modulos];
        const nextItens = [...nextModules[modIndex].itens];
        nextItens[itemIndex] = { ...nextItens[itemIndex], [field]: value };
        nextModules[modIndex] = { ...nextModules[modIndex], itens: nextItens };
        setProposta(prev => ({ ...prev, modulos: nextModules }));
    };

    // 6. Parcelas de Implantação & Valores
    const handleAddParcela = () => {
        const nextImp = [...(proposta.investimento?.implantacao || [])];
        const nextNum = nextImp.length + 1;
        nextImp.push({
            parcela: `${nextNum}ª Parcela`,
            vencimento: 'A combinar na entrega das etapas',
            valor: 8000,
            valor_formatado: 'R$ 8.000,00'
        });
        setProposta(prev => ({
            ...prev,
            investimento: {
                ...(prev.investimento || {}),
                implantacao: nextImp
            }
        }));
        toast.info('Nova parcela adicionada ao cronograma!');
    };

    const handleRemoveParcela = (pIndex) => {
        if (!window.confirm('Deseja realmente excluir esta parcela do cronograma?')) return;
        const nextImp = proposta.investimento.implantacao.filter((_, idx) => idx !== pIndex);
        setProposta(prev => ({
            ...prev,
            investimento: {
                ...(prev.investimento || {}),
                implantacao: nextImp
            }
        }));
    };

    const handleParcelaChange = (index, field, value) => {
        const nextImp = [...proposta.investimento.implantacao];
        nextImp[index] = { ...nextImp[index], [field]: value };
        setProposta(prev => ({
            ...prev,
            investimento: {
                ...(prev.investimento || {}),
                implantacao: nextImp
            }
        }));
    };

    const handleTotalImplantacaoChange = (value) => {
        setProposta(prev => ({
            ...prev,
            investimento: {
                ...(prev.investimento || {}),
                total_implantacao_formatado: value
            }
        }));
    };

    const handleAutoCalculateTotal = () => {
        const items = proposta.investimento?.implantacao || [];
        let sum = 0;
        items.forEach(it => {
            const raw = String(it.valor_formatado || it.valor || '0')
                .replace(/[^\d,\.]/g, '')
                .replace(/\./g, '')
                .replace(',', '.');
            const num = parseFloat(raw) || 0;
            sum += num;
        });
        const formatted = sum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        setProposta(prev => ({
            ...prev,
            investimento: {
                ...(prev.investimento || {}),
                total_implantacao: sum,
                total_implantacao_formatado: formatted
            }
        }));
        toast.info(`Total recalculado: ${formatted}`);
    };

    // 7. Mensalidade de Sustentação & Suporte
    const handleMensalidadeChange = (anoKey, field, value) => {
        setProposta(prev => ({
            ...prev,
            investimento: {
                ...(prev.investimento || {}),
                mensalidade: {
                    ...(prev.investimento?.mensalidade || {}),
                    [anoKey]: {
                        ...(prev.investimento?.mensalidade?.[anoKey] || {}),
                        [field]: value
                    }
                }
            }
        }));
    };

    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 text-sm font-medium">Carregando Proposta Comercial Oficial...</p>
            </div>
        );
    }

    if (!proposta) {
        return (
            <div className="p-8 text-center text-slate-400">
                <p>Nenhuma informação encontrada para a proposta.</p>
                <button onClick={loadData} className="mt-4 px-4 py-2 bg-slate-800 rounded-lg text-white text-sm">
                    Tentar Novamente
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
            {/* Header com Ações Globais */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                        <div>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Área Exclusiva Superadmin Lynx
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-400 border border-slate-700">
                                    Ref: {proposta.referencia || 'N/D'}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {proposta.modulos?.length || 0} Módulos
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                                Gestão Integral da Proposta Comercial &middot; Metalfisa
                            </h1>
                            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
                                Todos os textos, títulos, prazos, módulos, parcelas, valores e cláusulas são 100% editáveis em tempo real com exportação instantânea em Microsoft Word (.docx).
                            </p>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                onClick={handleDownloadWord}
                                disabled={exporting}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50"
                                title="Gerar e Baixar arquivo .docx pronto para Word"
                            >
                                <Download className="w-4 h-4" />
                                {exporting ? 'Gerando Word...' : 'Baixar Word (.docx)'}
                            </button>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>

                            <button
                                onClick={loadData}
                                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all"
                                title="Recarregar dados originais do servidor"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Abas de Navegação */}
                    <div className="flex items-center gap-2 mt-6 pt-6 border-t border-slate-800/80 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('identificacao')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                                activeTab === 'identificacao' 
                                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <Building className="w-4 h-4" />
                            1. Dados Gerais & Partes
                        </button>

                        <button
                            onClick={() => setActiveTab('modulos')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                                activeTab === 'modulos' 
                                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <FileText className="w-4 h-4" />
                            2. Módulos & Recursos ({proposta.modulos?.length})
                        </button>

                        <button
                            onClick={() => setActiveTab('comercial')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                                activeTab === 'comercial' 
                                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <DollarSign className="w-4 h-4" />
                            3. Investimento & Condições
                        </button>

                        <button
                            onClick={() => setActiveTab('homologacao')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                                activeTab === 'homologacao' 
                                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <Server className="w-4 h-4" />
                            4. Diretrizes & Homologação
                        </button>

                        <button
                            onClick={() => setActiveTab('preview')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                                activeTab === 'preview' 
                                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <Eye className="w-4 h-4" />
                            5. Pré-Visualização Formatada
                        </button>
                    </div>
                </div>
            </div>

            {/* Conteúdo Principal */}
            <div className="max-w-7xl mx-auto">

                {/* ============================================================== */}
                {/* ABA 1: DADOS GERAIS & IDENTIFICAÇÃO DAS PARTES                  */}
                {/* ============================================================== */}
                {activeTab === 'identificacao' && (
                    <div className="space-y-6">
                        {/* Dados Principais do Documento */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                                <FileText className="w-5 h-5 text-amber-400" />
                                Cabeçalho e Identificação da Proposta
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
                                <div className="md:col-span-8">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                        Título Principal do Documento
                                    </label>
                                    <input
                                        type="text"
                                        value={proposta.titulo || ''}
                                        onChange={(e) => handleGeneralChange('titulo', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:border-amber-500 outline-none"
                                    />
                                </div>
                                <div className="md:col-span-4">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                        Referência do Documento
                                    </label>
                                    <input
                                        type="text"
                                        value={proposta.referencia || ''}
                                        onChange={(e) => handleGeneralChange('referencia', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-amber-400 font-mono text-sm focus:border-amber-500 outline-none"
                                    />
                                </div>
                                <div className="md:col-span-12">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                        Subtítulo / Descritivo Geral do Escopo
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={proposta.subtitulo || ''}
                                        onChange={(e) => handleGeneralChange('subtitulo', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-300 text-xs leading-relaxed focus:border-amber-500 outline-none"
                                    />
                                </div>
                                <div className="md:col-span-6">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                        Data de Emissão (Texto Oficial)
                                    </label>
                                    <input
                                        type="text"
                                        value={proposta.data_emissao || ''}
                                        onChange={(e) => handleGeneralChange('data_emissao', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-500 outline-none"
                                        placeholder="Ex: Setembro de 2026"
                                    />
                                </div>
                                <div className="md:col-span-6">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                        Prazo de Validade da Proposta (Dias Corridos)
                                    </label>
                                    <input
                                        type="number"
                                        value={proposta.validade_dias || 30}
                                        onChange={(e) => handleGeneralChange('validade_dias', parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Dados das Partes (Fornecedor e Cliente) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Fornecedor */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                                    <Building className="w-5 h-5 text-blue-400" />
                                    Dados do Fornecedor / Desenvolvedor
                                </h3>
                                <div className="space-y-3 pt-1">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                            Razão Social / Nome Fantasia
                                        </label>
                                        <input
                                            type="text"
                                            value={proposta.fornecedor?.empresa || ''}
                                            onChange={(e) => handleFornecedorChange('empresa', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm font-semibold focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                            Equipe / Responsável Técnico
                                        </label>
                                        <input
                                            type="text"
                                            value={proposta.fornecedor?.responsavel || ''}
                                            onChange={(e) => handleFornecedorChange('responsavel', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 text-sm focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                            E-mail / Telefone / Contato Oficial
                                        </label>
                                        <input
                                            type="text"
                                            value={proposta.fornecedor?.contato || ''}
                                            onChange={(e) => handleFornecedorChange('contato', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-amber-400 font-mono text-sm focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Cliente */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                                    <Building className="w-5 h-5 text-emerald-400" />
                                    Dados do Cliente Contratante
                                </h3>
                                <div className="space-y-3 pt-1">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                            Razão Social da Empresa
                                        </label>
                                        <input
                                            type="text"
                                            value={proposta.cliente?.empresa || ''}
                                            onChange={(e) => handleClienteChange('empresa', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm font-semibold focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                            Representante / Diretoria Destinatária
                                        </label>
                                        <input
                                            type="text"
                                            value={proposta.cliente?.representante || ''}
                                            onChange={(e) => handleClienteChange('representante', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 text-sm focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* ABA 2: MÓDULOS E RECURSOS DO SISTEMA                            */}
                {/* ============================================================== */}
                {activeTab === 'modulos' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Seletor de Módulos (Sidebar à esquerda) */}
                        <div className="lg:col-span-4 space-y-3">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Módulos ({proposta.modulos?.length})
                                </h3>
                                <button
                                    onClick={handleAddModule}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-md"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Novo Módulo
                                </button>
                            </div>

                            <div className="space-y-2">
                                {proposta.modulos?.map((mod, idx) => {
                                    const isSelected = activeModuleIndex === idx;
                                    return (
                                        <div
                                            key={mod.id || idx}
                                            className={`rounded-xl border transition-all overflow-hidden ${
                                                isSelected 
                                                    ? 'bg-gradient-to-r from-blue-900/40 to-slate-900 border-blue-500/50 shadow-lg shadow-blue-500/10' 
                                                    : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
                                            }`}
                                        >
                                            <div 
                                                onClick={() => setActiveModuleIndex(idx)}
                                                className="p-3.5 cursor-pointer"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                                        Módulo 0{idx + 1}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[11px] text-slate-400 font-medium mr-1">
                                                            {mod.itens?.length || 0} recursos
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleMoveModule(idx, 'up'); }}
                                                            disabled={idx === 0}
                                                            className="p-1 hover:text-amber-400 disabled:opacity-20 transition-colors"
                                                            title="Mover para cima"
                                                        >
                                                            <ArrowUp className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleMoveModule(idx, 'down'); }}
                                                            disabled={idx === (proposta.modulos?.length - 1)}
                                                            className="p-1 hover:text-amber-400 disabled:opacity-20 transition-colors"
                                                            title="Mover para baixo"
                                                        >
                                                            <ArrowDown className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <h4 className={`text-sm font-bold ${isSelected ? 'text-amber-400' : 'text-slate-200'}`}>
                                                    {mod.nome}
                                                </h4>
                                                <p className="text-xs text-slate-400 line-clamp-1 mt-1">
                                                    {mod.descricao}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Editor do Módulo Ativo */}
                        <div className="lg:col-span-8">
                            {proposta.modulos?.[activeModuleIndex] ? (
                                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                                    <div className="flex items-start justify-between border-b border-slate-800 pb-4 gap-4 flex-wrap">
                                        <div className="flex-1 min-w-[240px]">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                                Nome do Módulo 0{activeModuleIndex + 1}
                                            </label>
                                            <input
                                                type="text"
                                                value={proposta.modulos[activeModuleIndex].nome || ''}
                                                onChange={(e) => handleModuleChange(activeModuleIndex, 'nome', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-bold text-base focus:border-amber-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 mt-6">
                                            <button
                                                onClick={() => handleAddItem(activeModuleIndex)}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all"
                                            >
                                                <Plus className="w-4 h-4" /> Adicionar Recurso
                                            </button>
                                            <button
                                                onClick={() => handleRemoveModule(activeModuleIndex)}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all"
                                                title="Excluir este módulo inteiro"
                                            >
                                                <Trash2 className="w-4 h-4" /> Excluir Módulo
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                            Descrição Geral do Módulo
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={proposta.modulos[activeModuleIndex].descricao || ''}
                                            onChange={(e) => handleModuleChange(activeModuleIndex, 'descricao', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 text-sm focus:border-amber-500 outline-none transition-all"
                                        />
                                    </div>

                                    {/* Lista de Recursos / Subitens */}
                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                                                Recursos e Entregáveis Detalhados ({proposta.modulos[activeModuleIndex].itens?.length || 0})
                                            </h4>
                                        </div>

                                        {proposta.modulos[activeModuleIndex].itens?.map((item, itIdx) => (
                                            <div
                                                key={itIdx}
                                                className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 transition-all group space-y-2"
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center shrink-0">
                                                            {itIdx + 1}
                                                        </span>
                                                        <input
                                                            type="text"
                                                            value={item.titulo || ''}
                                                            onChange={(e) => handleItemChange(activeModuleIndex, itIdx, 'titulo', e.target.value)}
                                                            className="flex-1 bg-transparent font-bold text-white text-sm border-b border-transparent focus:border-amber-500 outline-none transition-all py-0.5"
                                                            placeholder="Título do recurso..."
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveItem(activeModuleIndex, itIdx)}
                                                        className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition-colors opacity-60 group-hover:opacity-100"
                                                        title="Remover item"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <textarea
                                                    rows={2}
                                                    value={item.descricao || ''}
                                                    onChange={(e) => handleItemChange(activeModuleIndex, itIdx, 'descricao', e.target.value)}
                                                    className="w-full bg-slate-900/80 border border-slate-800/60 rounded-lg p-2.5 text-xs text-slate-300 leading-relaxed focus:border-amber-500 outline-none transition-all"
                                                    placeholder="Descrição detalhada do recurso e regras de negócio..."
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400">
                                    Selecione ou adicione um módulo para começar a editar.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* ABA 3: INVESTIMENTO & CONDIÇÕES COMERCIAIS                     */}
                {/* ============================================================== */}
                {activeTab === 'comercial' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Implantação e Parcelamento */}
                        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                            <div className="flex items-start justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-amber-400" />
                                        Cronograma de Pagamento da Implantação
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Parcelas de engenharia, integração Protheus e entregáveis homologados.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleAddParcela}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Nova Parcela
                                    </button>
                                    <button
                                        onClick={handleAutoCalculateTotal}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold transition-all"
                                        title="Soma automaticamente os valores das parcelas"
                                    >
                                        <Calculator className="w-3.5 h-3.5" /> Recalcular Total
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {proposta.investimento?.implantacao?.map((parc, pIdx) => (
                                    <div key={pIdx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <input
                                                type="text"
                                                value={parc.parcela || ''}
                                                onChange={(e) => handleParcelaChange(pIdx, 'parcela', e.target.value)}
                                                className="bg-transparent font-bold text-xs uppercase tracking-wider text-amber-400 border-b border-transparent focus:border-amber-500 outline-none flex-1"
                                                placeholder="Ex: 1ª Parcela (Entrada)"
                                            />
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={parc.valor_formatado || ''}
                                                    onChange={(e) => handleParcelaChange(pIdx, 'valor_formatado', e.target.value)}
                                                    className="bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg text-sm font-bold text-emerald-400 text-right w-36 focus:border-emerald-500 outline-none"
                                                    placeholder="R$ 8.000,00"
                                                />
                                                <button
                                                    onClick={() => handleRemoveParcela(pIdx)}
                                                    className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors"
                                                    title="Excluir parcela"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] text-slate-500 uppercase font-semibold block mb-1">
                                                Condição / Vencimento
                                            </label>
                                            <input
                                                type="text"
                                                value={parc.vencimento || ''}
                                                onChange={(e) => handleParcelaChange(pIdx, 'vencimento', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-200 focus:border-amber-500 outline-none"
                                                placeholder="Ex: À vista na assinatura formal"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Total Geral da Implantação */}
                            <div className="bg-gradient-to-r from-blue-950/40 to-slate-900 p-4 rounded-xl border border-blue-900/50 flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <span className="text-xs uppercase font-bold text-slate-400 block mb-1">
                                        Total da Implantação (Editável ou Calculado)
                                    </span>
                                    <input
                                        type="text"
                                        value={proposta.investimento?.total_implantacao_formatado || ''}
                                        onChange={(e) => handleTotalImplantacaoChange(e.target.value)}
                                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-lg font-black text-white focus:border-amber-500 outline-none w-56"
                                        placeholder="R$ 24.000,00"
                                    />
                                </div>
                                <span className="text-xs px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">
                                    {proposta.investimento?.implantacao?.length || 0} parcelas configuradas
                                </span>
                            </div>
                        </div>

                        {/* Mensalidade Perpétua & Licenciamento */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-amber-400" />
                                        Mensalidade Perpétua de Sustentação
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Suporte continuado, atualizações e evolução do ecossistema.
                                    </p>
                                </div>

                                {/* Ano 1 */}
                                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                                    <span className="text-xs font-bold text-amber-400 uppercase block">
                                        Primeiro Ano de Suporte
                                    </span>
                                    <div>
                                        <label className="text-[11px] text-slate-500 uppercase font-semibold block mb-1">
                                            Período Vigente
                                        </label>
                                        <input
                                            type="text"
                                            value={proposta.investimento?.mensalidade?.ano1?.periodo || ''}
                                            onChange={(e) => handleMensalidadeChange('ano1', 'periodo', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-200 focus:border-amber-500 outline-none"
                                            placeholder="10/02/2027 a 10/02/2028 (Primeiro Ano)"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-slate-500 uppercase font-semibold block mb-1">
                                            Base de Cálculo da Taxa
                                        </label>
                                        <input
                                            type="text"
                                            value={proposta.investimento?.mensalidade?.ano1?.base_calculo || ''}
                                            onChange={(e) => handleMensalidadeChange('ano1', 'base_calculo', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-blue-300 font-semibold focus:border-amber-500 outline-none"
                                            placeholder="1,0 (um) Salário Mínimo Nacional vigente por mês"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-slate-500 uppercase font-semibold block mb-1">
                                            Primeiro Vencimento
                                        </label>
                                        <input
                                            type="text"
                                            value={proposta.investimento?.mensalidade?.ano1?.primeiro_vencimento || ''}
                                            onChange={(e) => handleMensalidadeChange('ano1', 'primeiro_vencimento', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 focus:border-amber-500 outline-none"
                                            placeholder="10/02/2027"
                                        />
                                    </div>
                                </div>

                                {/* Ano 2 em diante */}
                                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                                    <span className="text-xs font-bold text-amber-400 uppercase block">
                                        A Partir do Segundo Ano (Evolução Perpétua)
                                    </span>
                                    <div>
                                        <label className="text-[11px] text-slate-500 uppercase font-semibold block mb-1">
                                            Período Vigente
                                        </label>
                                        <input
                                            type="text"
                                            value={proposta.investimento?.mensalidade?.ano2_em_diante?.periodo || ''}
                                            onChange={(e) => handleMensalidadeChange('ano2_em_diante', 'periodo', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-200 focus:border-amber-500 outline-none"
                                            placeholder="A partir de 10/02/2028"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-slate-500 uppercase font-semibold block mb-1">
                                            Base de Cálculo da Taxa
                                        </label>
                                        <input
                                            type="text"
                                            value={proposta.investimento?.mensalidade?.ano2_em_diante?.base_calculo || ''}
                                            onChange={(e) => handleMensalidadeChange('ano2_em_diante', 'base_calculo', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-purple-300 font-semibold focus:border-amber-500 outline-none"
                                            placeholder="2,5 (dois e meio) Salários Mínimos Nacionais vigentes por mês"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-slate-500 uppercase font-semibold block mb-1">
                                            Regra de Reajuste
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={proposta.investimento?.mensalidade?.ano2_em_diante?.regra_reajuste || ''}
                                            onChange={(e) => handleMensalidadeChange('ano2_em_diante', 'regra_reajuste', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Licenciamento */}
                                <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-xl space-y-2">
                                    <h5 className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                                        <Award className="w-4 h-4" /> Licenciamento de Usuários
                                    </h5>
                                    <div>
                                        <label className="text-[11px] text-slate-500 uppercase font-semibold block mb-1">
                                            Modelo da Licença
                                        </label>
                                        <input
                                            type="text"
                                            value={proposta.licenciamento?.modelo || ''}
                                            onChange={(e) => handleLicenciamentoChange('modelo', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-emerald-300 font-semibold focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-slate-500 uppercase font-semibold block mb-1">
                                            Detalhamento do Acesso
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={proposta.licenciamento?.detalhes || ''}
                                            onChange={(e) => handleLicenciamentoChange('detalhes', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 leading-relaxed focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* ABA 4: DIRETRIZES TÉCNICAS, HOMOLOGAÇÃO & INFRAESTRUTURA        */}
                {/* ============================================================== */}
                {activeTab === 'homologacao' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Homologação & Validações */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                Diretrizes Técnicas & Homologação
                            </h3>

                            <div className="space-y-4 pt-1">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                        Ambiente de Homologação / Testes
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={proposta.homologacao?.ambiente || ''}
                                        onChange={(e) => handleHomologacaoChange('ambiente', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed focus:border-emerald-500 outline-none"
                                        placeholder="Ex: Homologação assistida em Base de Testes do Protheus..."
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                        Pontos de Integração Protheus (Tabelas / APIs)
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={proposta.homologacao?.pontos_integracao || ''}
                                        onChange={(e) => handleHomologacaoChange('pontos_integracao', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed focus:border-emerald-500 outline-none font-mono"
                                        placeholder="Tabelas SE1, SE2, SE5, SF1, SF2, SD1, SD2, SC7..."
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                        Integração de Ponto Eletrônico (Portaria 671/MTE)
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={proposta.homologacao?.ponto_eletronico || ''}
                                        onChange={(e) => handleHomologacaoChange('ponto_eletronico', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed focus:border-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Infraestrutura & Segurança */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                                <Server className="w-5 h-5 text-blue-400" />
                                Infraestrutura & Segurança de Dados
                            </h3>

                            <div className="space-y-4 pt-1">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                        Servidor SINCO / Topologia
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={proposta.infraestrutura?.servidor || ''}
                                        onChange={(e) => handleInfraChange('servidor', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed focus:border-blue-500 outline-none"
                                        placeholder="On-Premise / Servidor Local SINCO (192.168.1.77)..."
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                                        Segurança, Privacidade & Contingência
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={proposta.infraestrutura?.seguranca || ''}
                                        onChange={(e) => handleInfraChange('seguranca', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed focus:border-blue-500 outline-none"
                                        placeholder="Privacidade total dos dados internos da empresa..."
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                                            Observações Gerais &amp; Disposições
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-normal lowercase">(gerado como Seção 5 no Word)</span>
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={proposta.observacoes_gerais || ''}
                                        onChange={(e) => handleGeneralChange('observacoes_gerais', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed focus:border-amber-500 outline-none"
                                        placeholder="Insira observações gerais, prazos específicos, condições de garantia, regras adicionais de atendimento..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* ABA 5: PRÉ-VISUALIZAÇÃO FORMATADA DO DOCUMENTO                 */}
                {/* ============================================================== */}
                {activeTab === 'preview' && (
                    <div className="bg-white text-slate-900 rounded-2xl p-8 md:p-12 shadow-2xl max-w-4xl mx-auto space-y-8 border border-slate-200">
                        {/* Header Documento */}
                        <div className="border-b-2 border-slate-800 pb-6 flex items-start justify-between flex-wrap gap-4">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-orange-600 block">
                                    DOCUMENTO TÉCNICO-COMERCIAL &middot; REF: {proposta.referencia}
                                </span>
                                <h2 className="text-2xl font-black text-slate-900 mt-1">
                                    {proposta.titulo}
                                </h2>
                                <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                                    {proposta.subtitulo}
                                </p>
                            </div>
                            <div className="text-right text-xs text-slate-500 shrink-0">
                                <p className="font-bold text-slate-800">{proposta.fornecedor?.empresa}</p>
                                <p>Emissão: {proposta.data_emissao}</p>
                                <p>Validade: {proposta.validade_dias} dias</p>
                            </div>
                        </div>

                        {/* Seção 1: Escopo dos Módulos */}
                        <div className="space-y-6">
                            <h3 className="text-base font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-2">
                                1. Escopo Técnico dos {proposta.modulos?.length} Módulos Contratados
                            </h3>
                            {proposta.modulos?.map((m, i) => (
                                <div key={i} className="space-y-2">
                                    <h4 className="text-sm font-bold text-slate-900">
                                        1.{i + 1}. {m.nome}
                                    </h4>
                                    <p className="text-xs text-slate-600 mb-2">{m.descricao}</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {m.itens?.map((it, itIdx) => (
                                            <li key={itIdx} className="text-xs text-slate-700 leading-relaxed">
                                                <strong className="text-slate-900">{it.titulo}:</strong> {it.descricao}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        {/* Seção 2: Condições Comerciais */}
                        <div className="space-y-4 pt-4 border-t border-slate-200">
                            <h3 className="text-base font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-2">
                                2. Condições Comerciais e Valores
                            </h3>
                            <table className="w-full text-xs text-left border-collapse border border-slate-300">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="border border-slate-300 p-2 font-bold">Parcela</th>
                                        <th className="border border-slate-300 p-2 font-bold">Vencimento</th>
                                        <th className="border border-slate-300 p-2 font-bold text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {proposta.investimento?.implantacao?.map((p, pI) => (
                                        <tr key={pI}>
                                            <td className="border border-slate-300 p-2 font-semibold">{p.parcela}</td>
                                            <td className="border border-slate-300 p-2">{p.vencimento}</td>
                                            <td className="border border-slate-300 p-2 text-right font-bold">{p.valor_formatado}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-blue-50 font-bold">
                                        <td className="border border-slate-300 p-2" colSpan={2}>Total da Implantação</td>
                                        <td className="border border-slate-300 p-2 text-right text-blue-900 font-black">
                                            {proposta.investimento?.total_implantacao_formatado || 'R$ 24.000,00'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-2 mt-4">
                                <p>
                                    <strong>Mensalidade de Suporte (Ano 1):</strong> {proposta.investimento?.mensalidade?.ano1?.base_calculo} ({proposta.investimento?.mensalidade?.ano1?.periodo}) &mdash; 1º vencimento em {proposta.investimento?.mensalidade?.ano1?.primeiro_vencimento}.
                                </p>
                                <p>
                                    <strong>Mensalidade de Suporte (Ano 2 em diante):</strong> {proposta.investimento?.mensalidade?.ano2_em_diante?.base_calculo} ({proposta.investimento?.mensalidade?.ano2_em_diante?.periodo}).
                                </p>
                                <p>
                                    <strong>Regra de Reajuste:</strong> {proposta.investimento?.mensalidade?.ano2_em_diante?.regra_reajuste}
                                </p>
                                <p>
                                    <strong>Licenciamento:</strong> {proposta.licenciamento?.detalhes}
                                </p>
                            </div>
                        </div>

                        {/* Seção 3: Observações Gerais e Disposições Finais */}
                        {proposta.observacoes_gerais && (
                            <div className="space-y-3 pt-4 border-t border-slate-200">
                                <h3 className="text-base font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-700" />
                                    3. Observações Gerais e Disposições Finais
                                </h3>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                                    {proposta.observacoes_gerais}
                                </div>
                            </div>
                        )}

                        {/* Assinaturas das Partes */}
                        <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
                            <div>
                                <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
                                    {proposta.fornecedor?.empresa}
                                </div>
                                <p>Fornecedor / Tecnologia</p>
                            </div>
                            <div>
                                <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
                                    {proposta.cliente?.empresa}
                                </div>
                                <p>Contratante / Diretoria</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PropostaComercialPage;

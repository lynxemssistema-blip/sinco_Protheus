import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    UploadCloud, FileUp, CheckCircle2, RefreshCw, Trash2, Layers, 
    Search, Save, AlertTriangle, XCircle, Filter, Eye, ListTree, PlusCircle, Plus, Sparkles, X,
    FileText, Paperclip, FileSpreadsheet, Download
} from 'lucide-react';
import api, { getProductDocuments } from '../../services/api';
import { toast } from 'react-toastify';
import WabtecBOMTree from '../../components/wabtec/WabtecBOMTree';
import CriarProdutoProtheusModal from '../../components/wabtec/CriarProdutoProtheusModal';
import DocsModal from '../../components/DocsModal';

/**
 * Calcula a Quantidade Total acumulada na hierarquia para cada item da BOM
 */
function computeQtdTotalForItems(rawItems) {
    if (!rawItems || rawItems.length === 0) return [];
    const stackQtd = [1];
    return rawItems.map(item => {
        let lvl = 0;
        const lvlStr = String(item.nivel || '0').trim();
        if (/^\.+/.test(lvlStr)) {
            lvl = lvlStr.match(/^\.+/)[0].length;
        } else {
            const parsed = parseInt(lvlStr, 10);
            lvl = isNaN(parsed) ? 0 : parsed;
        }

        const unitStr = String(item.qtd || '1').replace(',', '.').replace(/[^\d.]/g, '');
        const unit = parseFloat(unitStr) || 1;

        let total = 1;
        if (lvl === 0) {
            total = (item.qtd !== undefined && item.qtd !== '' && !isNaN(parseFloat(unitStr))) ? unit : 1;
            stackQtd[0] = total;
            stackQtd.length = 1;
        } else {
            const parentTotal = stackQtd[lvl - 1] !== undefined ? stackQtd[lvl - 1] : (stackQtd[stackQtd.length - 1] || 1);
            total = parentTotal * unit;
            stackQtd[lvl] = total;
            stackQtd.length = lvl + 1;
        }

        return {
            ...item,
            _levelNum: lvl,
            qtd_total: item.qtd_total !== undefined && item.qtd_total !== null && item.qtd_total !== '' 
                ? item.qtd_total 
                : total
        };
    });
}

export default function WabtecEstruturaImportacaoPage({ selectedLote, setSelectedLote }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [loteData, setLoteData] = useState([]);
    const [loteHeaders, setLoteHeaders] = useState([]);
    const [nomeAba, setNomeAba] = useState('');
    const [abas, setAbas] = useState([]);
    const [abaSelecionada, setAbaSelecionada] = useState('');
    const [uploadedFilePath, setUploadedFilePath] = useState(null);
    const [step, setStep] = useState(1); // 1: Select File, 2: Select Aba, 3: Preview
    
    // Modal de Criação de Produto no Protheus
    const [modalCriarOpen, setModalCriarOpen] = useState(false);
    const [itemParaCriar, setItemParaCriar] = useState(null);

    // Modal de Documentos do Produto (PDF / Desenho)
    const [docsModalItem, setDocsModalItem] = useState(null);

    // Filtros e busca
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('TODOS'); // 'TODOS' | 'IGUAL' | 'DIVERGENTE' | 'NAO_CADASTRADO'
    const [viewMode, setViewMode] = useState('inteligente'); // 'inteligente' | 'original'
    const [exportingExcel, setExportingExcel] = useState(false);
    const [isUploadOpen, setIsUploadOpen] = useState(false);

    const fileInputRef = useRef(null);

    // Exportar estrutura completa em Excel padrão Lynx com metadados e KPIs
    const handleExportarExcel = async (loteId) => {
        try {
            setExportingExcel(true);
            toast.info("Gerando planilha Excel Lynx (.xlsx)...", { autoClose: 2000 });

            const token = localStorage.getItem('@Lynx:token') || '';
            const url = `/api/wabtec/exportar-excel?lote_id=${loteId || ''}&token=${encodeURIComponent(token)}`;

            const response = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!response.ok) {
                let errMsg = `Erro ${response.status}`;
                try {
                    const errBody = await response.json();
                    errMsg = errBody.error || errBody.message || errMsg;
                } catch (_) {}
                throw new Error(errMsg);
            }

            // Usar arrayBuffer + Blob com MIME type explícito para garantir que
            // o Chrome respeite o atributo download e salve com extensão .xlsx correta
            const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const arrayBuffer = await response.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: XLSX_MIME });

            const fileName = `Estrutura_Lynx_Wabtec_${loteId ? `Lote_${loteId}` : 'Completa'}.xlsx`;
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            // Aguardar o click processar antes de remover e revogar
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            }, 3000);

            toast.success(`Planilha "${fileName}" baixada com sucesso!`);
        } catch (err) {
            console.error("Erro ao exportar Excel:", err);
            toast.error("Erro ao exportar Excel: " + (err.message || 'Falha na geração'));
        } finally {
            setExportingExcel(false);
        }
    };

    const handleAbrirCriacao = (r) => {
        setItemParaCriar(r);
        setModalCriarOpen(true);
    };

    // Callback de sucesso da criação do produto no Protheus
    // Regra do Usuário: "caso o cod da wabtec se repita na lista o mesmo codigo doprotheus deve ser referenciado ok. e a linha onde estive o mesmo codigo e atualizado."
    const handleProdutoCriadoComSucesso = (resData) => {
        const codDesenho = resData.desenho_cliente;
        const protheusCod = resData.codigo;
        const protheusDesc = resData.descricao;
        const protheusRev = resData.revisao;
        const uom = resData.uom;
        const protheusTipo = resData.protheus_tipo || resData.tipo;

        // Atualiza em loteData (lote salvo ativo)
        setLoteData(prev => prev.map(item => {
            if (item.desenho_cliente === codDesenho) {
                return {
                    ...item,
                    protheus_cod: protheusCod,
                    protheus_desc: protheusDesc,
                    protheus_rev: protheusRev,
                    uom: uom || item.uom,
                    protheus_tipo: protheusTipo || item.protheus_tipo,
                    status_mapeamento: 'ENCONTRADO',
                    revisao_igual: true,
                    status_detalhe: 'Cadastrado e vinculado no Protheus via SINCO',
                    cadastro_novo: 1
                };
            }
            return item;
        }));

        // Atualiza em previewData (caso esteja no fluxo de importação da planilha)
        setPreviewData(prev => prev.map(item => {
            if (item.desenho_cliente === codDesenho) {
                return {
                    ...item,
                    protheus_cod: protheusCod,
                    protheus_desc: protheusDesc,
                    protheus_rev: protheusRev,
                    uom: uom || item.uom,
                    protheus_tipo: protheusTipo || item.protheus_tipo,
                    status_mapeamento: 'ENCONTRADO',
                    revisao_igual: true,
                    status_detalhe: 'Cadastrado e vinculado no Protheus via SINCO',
                    cadastro_novo: 1
                };
            }
            return item;
        }));
    };

    // Ação para alternar status de novo (marcar ou desmarcar com persistência)
    const handleToggleNovo = async (item, novoValor) => {
        try {
            const res = await api.post('/wabtec/toggle-novo', {
                id: item.id,
                desenho_cliente: item.desenho_cliente,
                cadastro_novo: novoValor
            });

            if (res.data?.success) {
                setLoteData(prev => prev.map(r => {
                    if (r.desenho_cliente === item.desenho_cliente || (item.id && r.id === item.id)) {
                        return { ...r, cadastro_novo: novoValor };
                    }
                    return r;
                }));

                setPreviewData(prev => prev.map(r => {
                    if (r.desenho_cliente === item.desenho_cliente || (item.id && r.id === item.id)) {
                        return { ...r, cadastro_novo: novoValor };
                    }
                    return r;
                }));

                if (novoValor === 1) {
                    toast.success(`Item ${item.desenho_cliente || ''} marcado como NOVO!`);
                } else {
                    toast.info(`Status NOVO removido para ${item.desenho_cliente || 'o item'}.`);
                }
            }
        } catch (err) {
            console.error('Erro ao alternar status novo:', err);
            toast.error('Não foi possível atualizar o status de novo.');
        }
    };

    // Atualiza a contagem de documentos apenas para o item aberto sem recarregar a tabela inteira
    const handleAtualizarDocsItem = async (item) => {
        if (!item) return;
        try {
            const code = item.protheus_cod || item.desenho_cliente;
            const alt = item.protheus_cod ? item.desenho_cliente : null;
            const docs = await getProductDocuments(code, alt);
            const count = Array.isArray(docs) ? docs.length : 0;

            setLoteData(prev => prev.map(r => {
                if (r.desenho_cliente === item.desenho_cliente || (item.id && r.id === item.id)) {
                    return { ...r, total_docs: count };
                }
                return r;
            }));

            setPreviewData(prev => prev.map(r => {
                if (r.desenho_cliente === item.desenho_cliente || (item.id && r.id === item.id)) {
                    return { ...r, total_docs: count };
                }
                return r;
            }));
        } catch (e) {
            console.error('Erro ao atualizar status do documento:', e);
        }
    };

    const fetchLotes = async (isInitial = false) => {
        try {
            const { data } = await api.get('/wabtec/lotes');
            const loaded = data.data || [];
            setLotes(loaded);
            if (isInitial && loaded.length > 0 && !selectedLote) {
                handleSelectLote(loaded[0].lote_id);
            } else if (loaded.length === 0) {
                setSelectedLote(null);
                setLoteData([]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectLote = async (loteId) => {
        setSelectedLote(loteId);
        setLoadingData(true);
        try {
            const res = await api.get(`/wabtec/estruturas?lote_id=${loteId}`);
            const data = res.data.data || [];
            setLoteData(data);
            if (data.length > 0) {
                try {
                    const lote = lotes.find(l => l.lote_id === loteId);
                    if (lote && lote.headers && lote.headers.length > 0) {
                        let parsedHeaders = typeof lote.headers === 'string' ? JSON.parse(lote.headers) : lote.headers;
                        setLoteHeaders(parsedHeaders);
                    } else {
                        const parsed = JSON.parse(data[0].raw_data || '[]');
                        setLoteHeaders(parsed.map((_, i) => `Col ${i+1}`));
                    }
                } catch(e) {
                    setLoteHeaders([]);
                }
            } else {
                setLoteHeaders([]);
            }
        } catch (err) {
            toast.error("Erro ao carregar dados do lote.");
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchLotes(true);
    }, []);

    const handleAtualizar = () => {
        fetchLotes(false);
        if (selectedLote) handleSelectLote(selectedLote);
    };

    const handleFileChange = (e) => {
        if (e.target.files?.[0]) setFile(e.target.files[0]);
    };

    const handleLerAbas = async () => {
        if (!file) return toast.warning("Selecione um arquivo Excel.");
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const { data } = await api.post('/wabtec/ler-abas', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAbas(data.abas || []);
            setUploadedFilePath(data.filePath);
            setStep(2);
            toast.success("Abas lidas com sucesso. Selecione a aba desejada.");
        } catch (err) {
            toast.error("Erro ao processar arquivo.");
        } finally {
            setUploading(false);
        }
    };

    const handleProcessarAba = async () => {
        if (!abaSelecionada) return toast.warning("Selecione uma aba.");
        setUploading(true);
        try {
            const { data } = await api.post('/wabtec/upload-estrutura', {
                filePath: uploadedFilePath,
                aba_selecionada: abaSelecionada,
                originalName: file.name
            });
            setPreviewData(data.preview_data || []);
            setHeaders(data.headers || []);
            setNomeAba(data.nome_aba || '');
            setStep(3);
            setPreviewMode(true);
            toast.success(data.message);
        } catch (err) {
            toast.error("Erro ao processar a aba selecionada.");
        } finally {
            setUploading(false);
        }
    };

    const handleCancelPreview = () => {
        setPreviewMode(false);
        setPreviewData([]);
        setHeaders([]);
        setNomeAba('');
        setFile(null);
        setStep(1);
        setSearchTerm('');
        setFilterStatus('TODOS');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmSave = async () => {
        setSaving(true);
        try {
            await api.post('/wabtec/save-lote', {
                records: previewData,
                nome_arquivo: file?.name || 'Estrutura_Wabtec',
                nome_aba: nomeAba,
                headers: headers
            });
            toast.success("Lote salvo com sucesso com todos os vínculos Lynx!");
            handleCancelPreview();
            fetchLotes();
        } catch (err) {
            toast.error("Erro ao salvar lote.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteLote = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Deseja realmente excluir este lote?")) return;
        try {
            await api.delete(`/wabtec/lotes/${id}`);
            toast.success("Lote removido.");
            if (selectedLote === id) {
                setSelectedLote(null);
                setLoteData([]);
            }
            fetchLotes(false);
        } catch {
            toast.error("Erro ao remover.");
        }
    };

    const formatDate = (d) => {
        return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // Filtros e contagens de conferência de revisão
    const getStats = (items) => {
        const total = items.length;
        const iguais = items.filter(r => r.status_mapeamento === 'ENCONTRADO' || r.revisao_igual === true).length;
        const divergentes = items.filter(r => r.status_mapeamento === 'DIFERENCA_REVISAO').length;
        const naoCadastrados = items.filter(r => r.status_mapeamento === 'NAO_ENCONTRADO').length;
        return { total, iguais, divergentes, naoCadastrados };
    };

    const filterRows = (items) => {
        return items.filter(r => {
            const matchesSearch = !searchTerm || 
                (r.desenho_cliente && r.desenho_cliente.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.protheus_cod && r.protheus_cod.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.protheus_desc && r.protheus_desc.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.titulo && r.titulo.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.find_no && String(r.find_no).toLowerCase().includes(searchTerm.toLowerCase()));

            if (!matchesSearch) return false;

            if (filterStatus === 'IGUAL') {
                return r.status_mapeamento === 'ENCONTRADO' || r.revisao_igual === true;
            }
            if (filterStatus === 'DIVERGENTE') {
                return r.status_mapeamento === 'DIFERENCA_REVISAO';
            }
            if (filterStatus === 'NAO_CADASTRADO') {
                return r.status_mapeamento === 'NAO_ENCONTRADO';
            }
            return true;
        });
    };

    // Renderizador da Tabela Enriquecida / Árvore / Original
    const renderTableContent = (items, rawHeaderList, isPreview = false) => {
        const enrichedItems = computeQtdTotalForItems(items);
        const stats = getStats(enrichedItems);
        const filtered = filterRows(enrichedItems);

        // Se o modo Árvore estiver ativo, delega para o componente especializado
        if (viewMode === 'arvore') {
            return (
                <div className="space-y-4">
                    {/* Seletor de Modo no Topo */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-50 border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-600" />
                            Visualização Hierárquica Multinível (BOM Tree)
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-2xs">
                                <button 
                                    onClick={() => setViewMode('inteligente')}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition ${viewMode === 'inteligente' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    title="Visualizar em formato tabular clássico"
                                >
                                    <ListTree className="w-3.5 h-3.5" /> Tabela Lynx
                                </button>
                                <button 
                                    onClick={() => setViewMode('arvore')}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition ${viewMode === 'arvore' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    title="Visualizar estrutura em árvore hierárquica (pai-filho com expansão)"
                                >
                                    <Layers className="w-3.5 h-3.5" /> Árvore BOM
                                </button>
                                <button 
                                    onClick={() => setViewMode('original')}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition ${viewMode === 'original' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    title="Visualizar colunas brutas do Excel"
                                >
                                    <Eye className="w-3.5 h-3.5" /> Original Excel
                                </button>
                            </div>
                        </div>
                    </div>
                    <WabtecBOMTree items={enrichedItems} onCriarProduto={handleAbrirCriacao} onAbrirDocs={setDocsModalItem} />
                </div>
            );
        }

        return (
            <div className="space-y-2 flex-1 flex flex-col">
                {/* Barra de Filtros e Resumo Comparativo Compacta */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button 
                            onClick={() => setFilterStatus('TODOS')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 border ${filterStatus === 'TODOS' ? 'bg-slate-800 text-white border-slate-800 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                        >
                            Todos ({stats.total})
                        </button>
                        <button 
                            onClick={() => setFilterStatus('IGUAL')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 border ${filterStatus === 'IGUAL' ? 'bg-green-600 text-white border-green-600 shadow-xs' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
                        >
                            <CheckCircle2 className="w-3 h-3" />
                            Mesma Revisão ({stats.iguais})
                        </button>
                        <button 
                            onClick={() => setFilterStatus('DIVERGENTE')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 border ${filterStatus === 'DIVERGENTE' ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                        >
                            <AlertTriangle className="w-3 h-3" />
                            Revisões Diferentes ({stats.divergentes})
                        </button>
                        <button 
                            onClick={() => setFilterStatus('NAO_CADASTRADO')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 border ${filterStatus === 'NAO_CADASTRADO' ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}`}
                        >
                            <XCircle className="w-3 h-3" />
                            Não Cadastrado ({stats.naoCadastrados})
                        </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative w-full sm:w-48">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                            <input 
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar desenho, metalfisa..."
                                className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="flex bg-white rounded-md border border-slate-200 p-0.5 shadow-2xs">
                            <button 
                                onClick={() => setViewMode('inteligente')}
                                className={`px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 transition ${viewMode === 'inteligente' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                title="Visualizar com número Lynx e conferência de revisão"
                            >
                                <ListTree className="w-3 h-3" /> Tabela
                            </button>
                            <button 
                                onClick={() => setViewMode('arvore')}
                                className={`px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 transition ${viewMode === 'arvore' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                title="Visualizar estrutura em árvore hierárquica (pai-filho com expansão)"
                            >
                                <Layers className="w-3 h-3" /> Árvore
                            </button>
                            <button 
                                onClick={() => setViewMode('original')}
                                className={`px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 transition ${viewMode === 'original' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                title="Visualizar colunas brutas do Excel"
                            >
                                <Eye className="w-3 h-3" /> Original
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabela de Dados Otimizada para o Monitor */}
                <div className="overflow-auto flex-1 min-h-[440px] max-h-[calc(100vh-220px)] border-t border-slate-100">
                    {viewMode === 'inteligente' ? (
                        <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                            <thead className="bg-slate-100 sticky top-0 shadow-xs z-10 text-slate-700 uppercase font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-2 py-1.5 text-[11px]">Nível</th>
                                    <th className="px-2 py-1.5 text-[11px]">Posição (Find)</th>
                                    <th className="px-2 py-1.5 text-[11px]">Cód. WabTec (ID)</th>
                                    <th className="px-2 py-1.5 text-[11px] text-center bg-indigo-50/50 text-indigo-900 border-x border-indigo-100">
                                        Rev. Cliente (Orig / Conv)
                                    </th>
                                    <th className="px-2 py-1.5 text-[11px] text-center bg-emerald-50/50 text-emerald-900">
                                        Número Lynx
                                    </th>
                                    <th className="px-2 py-1.5 text-[11px] text-center bg-emerald-50/50 text-emerald-900 border-r border-emerald-100">
                                        Rev. Lynx
                                    </th>
                                    <th className="px-2 py-1.5 text-[11px] text-center bg-emerald-50/50 text-emerald-900 border-r border-emerald-100 font-bold" title="Status de cadastro no Protheus">
                                        Cadastro
                                    </th>
                                    <th className="px-2 py-1.5 text-[11px] text-center bg-blue-50/50 text-blue-900 border-r border-blue-100 font-bold" title="Tipo do Produto no Protheus (ex: PI, PA, MP, etc.)">
                                        Tipo
                                    </th>
                                    <th className="px-3 py-1.5 text-[11px] font-bold">
                                        Conferência de Revisão
                                    </th>
                                    <th className="px-2 py-1.5 text-[11px] text-center font-bold bg-slate-50 border-r border-slate-200" title="Desenho técnico ou documentos em PDF">
                                        Desenho (PDF)
                                    </th>
                                    <th className="px-2 py-1.5 text-[11px]">Descrição Lynx</th>
                                    <th className="px-2 py-1.5 text-[11px]">Descrição WabTec</th>
                                    <th className="px-2 py-1.5 text-[11px] text-right">Qtd Unit</th>
                                    <th className="px-2 py-1.5 text-[11px] text-right font-bold bg-amber-50/70 text-amber-950 border-x border-amber-200" title="Quantidade Total acumulada no produto final calculada pela hierarquia da montagem">
                                        Qtd Total
                                    </th>
                                    <th className="px-2 py-1.5 text-[11px] text-center font-bold">Unid</th>
                                    <th className="px-2 py-1.5 text-[11px]">Item Pai (Parent)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filtered.map((r, i) => {
                                    const isMesmaRev = r.status_mapeamento === 'ENCONTRADO' || r.revisao_igual === true;
                                    const isDivergente = r.status_mapeamento === 'DIFERENCA_REVISAO';
                                    const isNaoCadastrado = r.status_mapeamento === 'NAO_ENCONTRADO';

                                    return (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            {/* Nível */}
                                            <td className="px-2 py-1">
                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                                                    r.nivel === '0' ? 'bg-slate-800 text-white' :
                                                    r.nivel === '1' ? 'bg-blue-600 text-white' :
                                                    r.nivel === '2' ? 'bg-indigo-100 text-indigo-800' :
                                                    'bg-slate-100 text-slate-700'
                                                }`}>
                                                    N{r.nivel}
                                                </span>
                                            </td>

                                            {/* Posição Find NO */}
                                            <td className="px-2 py-1 text-slate-600 font-mono text-[11px]">
                                                {r.find_no || '-'}
                                            </td>

                                            {/* Desenho WabTec */}
                                            <td className="px-2 py-1 font-bold text-indigo-700 text-xs">
                                                {r.desenho_cliente}
                                            </td>

                                            {/* Rev. Cliente */}
                                            <td className="px-2 py-1 text-center bg-indigo-50/30 border-x border-indigo-100">
                                                <div className="inline-flex items-center justify-center gap-1 font-mono">
                                                    <span className="font-bold text-indigo-950 px-1.5 py-0.5 bg-white rounded border border-indigo-200 text-[11px]">
                                                        {r.rev_convertida || r.rev_cliente_raw || '-'}
                                                    </span>
                                                    {r.rev_cliente_raw && r.rev_cliente_raw !== r.rev_convertida && (
                                                        <span className="text-[10px] text-slate-400" title="Revisão original no Excel">
                                                            ({r.rev_cliente_raw})
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Número Lynx */}
                                            <td className="px-2 py-1 text-center bg-emerald-50/30">
                                                {r.protheus_cod ? (
                                                    <span className="inline-block px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs text-xs">
                                                        {r.protheus_cod}
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAbrirCriacao(r)}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border border-blue-200 text-[10px] font-semibold transition-all shadow-2xs cursor-pointer group"
                                                        title={`Cadastrar ${r.desenho_cliente} no Protheus`}
                                                    >
                                                        <PlusCircle className="w-3 h-3 text-blue-600 group-hover:scale-110 transition-transform" />
                                                        <span>Criar no Protheus</span>
                                                    </button>
                                                )}
                                            </td>

                                            {/* Revisão Lynx */}
                                            <td className="px-2 py-1 text-center bg-emerald-50/30 border-r border-emerald-100 font-mono font-bold text-xs">
                                                {r.protheus_rev ? (
                                                    <span className={`px-1 py-0.5 rounded text-[11px] ${isMesmaRev ? 'text-green-800 bg-green-100 border border-green-300' : 'text-amber-800 bg-amber-100 border border-amber-300'}`}>
                                                        {r.protheus_rev}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>

                                            {/* Status Cadastro Protheus (NOVO / Marcar / Desmarcar) */}
                                            <td className="px-2 py-1 text-center bg-emerald-50/20 border-r border-emerald-100">
                                                {Number(r.cadastro_novo) === 1 ? (
                                                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs group transition-all">
                                                        <Sparkles className="w-2.5 h-2.5 text-emerald-600 animate-pulse flex-shrink-0" />
                                                        <span>NOVO</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleNovo(r, 0)}
                                                            className="ml-0.5 p-0.5 rounded-full hover:bg-emerald-200 text-emerald-700 hover:text-emerald-950 transition-colors cursor-pointer"
                                                            title="Desmarcar como novo (remover status)"
                                                        >
                                                            <X className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                ) : r.protheus_cod ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleNovo(r, 1)}
                                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-emerald-800 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all cursor-pointer group"
                                                        title="Marcar este cadastro como NOVO no Protheus"
                                                    >
                                                        <Plus className="w-2.5 h-2.5 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                                                        <span className="text-[10px] text-slate-400 group-hover:text-emerald-700 font-medium">Marcar Novo</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300 font-mono">-</span>
                                                )}
                                            </td>

                                            {/* Tipo do Produto no Protheus (PI, PA, MP, etc.) */}
                                            <td className="px-2 py-1 text-center font-mono text-[10px] bg-blue-50/20 border-r border-blue-100">
                                                {r.protheus_tipo ? (
                                                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold shadow-2xs border ${
                                                        r.protheus_tipo === 'PA' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                                                        r.protheus_tipo === 'PI' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                                                        r.protheus_tipo === 'MP' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                                                        'bg-slate-100 text-slate-700 border-slate-300'
                                                    }`} title={`Tipo do Produto: ${r.protheus_tipo}`}>
                                                        {r.protheus_tipo}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 font-mono">-</span>
                                                )}
                                            </td>

                                            {/* Conferência de Revisão (Destaque Principal) */}
                                            <td className="px-2.5 py-1">
                                                {isMesmaRev ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-300 shadow-2xs">
                                                        <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                                                        Mesma Revisão ({r.protheus_rev || r.rev_convertida})
                                                    </span>
                                                ) : isDivergente ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs" 
                                                        title={`Cliente: ${r.rev_cliente_raw} (${r.rev_convertida}) ≠ Lynx: ${r.protheus_rev}`}>
                                                        <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                                        Divergente: Cli {r.rev_cliente_raw} ({r.rev_convertida}) ≠ Metal {r.protheus_rev}
                                                    </span>
                                                ) : isNaoCadastrado ? (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                                        <XCircle className="w-3 h-3 text-rose-500 flex-shrink-0" />
                                                        Não Cadastrado
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[10px]">Pendente</span>
                                                )}
                                            </td>

                                            {/* Desenho / PDF Anexado */}
                                            <td className="px-2 py-1 text-center border-r border-slate-100">
                                                {Number(r.total_docs) > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDocsModalItem(r)}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 text-[10px] font-bold transition-all shadow-2xs cursor-pointer group"
                                                        title={`Visualizar / Gerenciar ${r.total_docs} documento(s) em PDF`}
                                                    >
                                                        <FileText className="w-3 h-3 text-rose-600 group-hover:scale-110 transition-transform" />
                                                        <span>PDF ({r.total_docs})</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDocsModalItem(r)}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer group"
                                                        title={`Anexar arquivo PDF para ${r.protheus_cod || r.desenho_cliente}`}
                                                    >
                                                        <Paperclip className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                                        <span>Anexar PDF</span>
                                                    </button>
                                                )}
                                            </td>

                                            {/* Descrição Protheus */}
                                            <td className="px-2 py-1 text-slate-700 max-w-[180px] truncate text-[11px]" title={r.protheus_desc}>
                                                {r.protheus_desc || '-'}
                                            </td>

                                            {/* Descrição WabTec */}
                                            <td className="px-2 py-1 text-slate-500 max-w-[180px] truncate text-[11px]" title={r.titulo}>
                                                {r.titulo || '-'}
                                            </td>

                                            {/* Quantidade Unitária */}
                                            <td className="px-2 py-1 text-right font-mono text-slate-700 text-xs">
                                                {r.qtd !== undefined && r.qtd !== '' ? r.qtd : '-'}
                                            </td>

                                            {/* Quantidade Total Calculada na Hierarquia */}
                                            <td className="px-2 py-1 text-right font-mono bg-amber-50/40 border-x border-amber-100">
                                                <span className="inline-block px-1.5 py-0.5 rounded font-bold bg-amber-100/90 text-amber-950 border border-amber-300 shadow-2xs text-[11px]"
                                                      title={`Qtd Total acumulada na hierarquia: ${r.qtd_total !== undefined && r.qtd_total !== null ? r.qtd_total : r.qtd}`}>
                                                    {r.qtd_total !== undefined && r.qtd_total !== null && r.qtd_total !== '' 
                                                        ? (Number(r.qtd_total) % 1 === 0 ? Number(r.qtd_total) : Number(r.qtd_total).toFixed(2)) 
                                                        : (r.qtd || '-')}
                                                </span>
                                            </td>

                                            {/* Unidade */}
                                            <td className="px-2 py-1 text-center font-mono text-[10px]">
                                                {r.uom ? (
                                                    <span className="inline-block px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                                                        {r.uom}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 font-mono">-</span>
                                                )}
                                            </td>

                                            {/* Item Pai */}
                                            <td className="px-2 py-1 text-[10px] text-slate-500 max-w-[140px] truncate" title={r.item_pai}>
                                                {r.item_pai || '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        /* Modo Original do Excel */
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-slate-50 sticky top-0 shadow-sm text-slate-500 uppercase border-b border-slate-200">
                                <tr>
                                    {rawHeaderList.map((h, i) => (
                                        <th key={i} className="px-4 py-2 border-b">{h || `Col ${i+1}`}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((r, i) => {
                                    let raw = [];
                                    try {
                                        raw = JSON.parse(r.raw_data || '[]');
                                    } catch(e) {}
                                    return (
                                        <tr key={i} className="hover:bg-slate-50">
                                            {rawHeaderList.map((_, colIdx) => (
                                                <td key={colIdx} className="px-4 py-2 text-xs text-slate-700">
                                                    {raw[colIdx] !== undefined ? String(raw[colIdx]) : ''}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        );
    };

    const showUpload = isUploadOpen || previewMode || step > 1 || (lotes.length === 0 && !selectedLote);

    return (
        <div className="space-y-2 flex flex-col">
            {/* Upload Box Colapsável */}
            {showUpload && (
                <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                            <FileUp className="w-3.5 h-3.5 text-indigo-500" /> Importar Planilha de Estrutura
                        </h3>
                        {lotes.length > 0 && !previewMode && step === 1 && (
                            <button
                                onClick={() => setIsUploadOpen(false)}
                                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded hover:bg-slate-100 transition"
                            >
                                Fechar
                            </button>
                        )}
                    </div>
                    <div className="flex flex-col gap-3">
                        {step === 1 && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                <div className="relative flex-1 max-w-xl">
                                    <input type="file" accept=".xlsx,.xlsm" onChange={handleFileChange}
                                        ref={fileInputRef} disabled={uploading}
                                        className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors border border-slate-200 rounded-md bg-slate-50 disabled:opacity-50" />
                                </div>
                                <button onClick={handleLerAbas} disabled={!file || uploading}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center gap-2 text-xs font-bold transition shadow-xs disabled:opacity-50">
                                    {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                                    {uploading ? 'Lendo Abas...' : 'Ler Abas'}
                                </button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="flex-1 max-w-xl">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Selecione a Aba que contém a estrutura:</label>
                                    <select 
                                        value={abaSelecionada} 
                                        onChange={(e) => setAbaSelecionada(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="" disabled>-- Selecione uma aba --</option>
                                        {abas.map((a, i) => (
                                            <option key={i} value={a}>{a}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-end gap-2 mt-auto">
                                    <button onClick={() => { setStep(1); setAbas([]); }}
                                        className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium transition shadow-xs">
                                        Voltar
                                    </button>
                                    <button onClick={handleProcessarAba} disabled={!abaSelecionada || uploading}
                                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center gap-2 text-xs font-bold transition shadow-xs disabled:opacity-50">
                                        {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                                        Processar Planilha
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-green-50 p-3 rounded-lg border border-green-200">
                                <div className="flex items-center gap-2.5">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    <div>
                                        <p className="text-xs font-bold text-green-800">Planilha processada e vinculada com sucesso ao Protheus!</p>
                                        <p className="text-[11px] text-green-600">Revise os números Lynx e conferência de revisão antes de salvar.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleCancelPreview} disabled={saving}
                                        className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium transition shadow-xs disabled:opacity-50">
                                        Cancelar
                                    </button>
                                    <button onClick={handleConfirmSave} disabled={saving}
                                        className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center gap-2 text-xs font-bold transition shadow-xs disabled:opacity-50">
                                        {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        {saving ? 'Gravando...' : 'Confirmar e Salvar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tabela de Preview */}
            {previewMode && previewData.length > 0 && (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">Preview com Número Lynx e Revisão ({previewData.length} itens)</span>
                    </div>
                    {renderTableContent(previewData, headers, true)}
                </div>
            )}

            {/* Tabela de Dados Salvos (Lote Ativo) */}
            {!previewMode && (
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-[500px]">
                    {/* Barra de Ferramentas Superior Unificada */}
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Layers className="w-4 h-4 text-indigo-600" />
                                Estrutura Cadastrada
                            </span>

                            {/* Seletor de Lotes Compacto */}
                            {lotes.length > 0 && (
                                <div className="flex items-center gap-1">
                                    <select
                                        value={selectedLote || ''}
                                        onChange={(e) => handleSelectLote(Number(e.target.value))}
                                        className="text-xs font-medium bg-white border border-slate-300 rounded-md px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 max-w-[220px] truncate"
                                    >
                                        {lotes.map(l => (
                                            <option key={l.lote_id} value={l.lote_id}>
                                                Lote #{l.lote_id} - {l.nome_arquivo}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedLote && (
                                        <button
                                            onClick={(e) => handleDeleteLote(selectedLote, e)}
                                            className="text-slate-400 hover:text-red-600 p-1 transition"
                                            title="Excluir este lote ativo"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Botão de Toggle da Área de Importação */}
                            <button
                                onClick={() => setIsUploadOpen(!isUploadOpen)}
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition border ${
                                    isUploadOpen 
                                        ? 'bg-slate-200 text-slate-800 border-slate-300' 
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                }`}
                                title="Importar nova planilha Excel WabTec"
                            >
                                <FileUp className="w-3.5 h-3.5 text-indigo-600" />
                                {isUploadOpen ? 'Fechar Importação' : '+ Importar Planilha'}
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button 
                                onClick={handleAtualizar} 
                                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium transition shadow-2xs"
                                title="Recarregar dados"
                            >
                                <RefreshCw className="w-3 h-3 text-slate-500" /> Atualizar
                            </button>

                            {loteData.length > 0 && (
                                <a
                                    href={`/api/wabtec/exportar-excel?lote_id=${selectedLote || ''}`}
                                    download={`Estrutura_Lynx_Wabtec_Lote_${selectedLote || 'Completa'}.xlsx`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleExportarExcel(selectedLote);
                                    }}
                                    className={`px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer no-underline ${exportingExcel ? 'opacity-60 pointer-events-none' : ''}`}
                                    title="Exportar dados completos da estrutura formatados no padrão Lynx (.xlsx)"
                                >
                                    {exportingExcel ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />}
                                    <span>{exportingExcel ? 'Gerando...' : 'Exportar Excel (.xlsx)'}</span>
                                </a>
                            )}
                        </div>
                    </div>

                    {loadingData ? (
                        <div className="flex-1 flex items-center justify-center py-12">
                            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                        </div>
                    ) : loteData.length > 0 ? (
                        renderTableContent(loteData, loteHeaders, false)
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400 flex-1">
                            <Layers className="w-10 h-10 mb-2 opacity-20" />
                            <p className="text-slate-600 font-bold text-xs">Nenhuma estrutura registrada ou selecionada.</p>
                            <p className="text-xs text-slate-400 mt-0.5">Importe uma planilha WabTec para visualizar os dados com vínculos e conferência de revisão.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Cadastro de Produto no Protheus */}
            <CriarProdutoProtheusModal 
                isOpen={modalCriarOpen}
                onClose={() => setModalCriarOpen(false)}
                item={itemParaCriar}
                onSuccess={handleProdutoCriadoComSucesso}
            />

            {/* Modal de Documentos do Produto (PDFs / Desenhos) */}
            <DocsModal
                isOpen={Boolean(docsModalItem)}
                onClose={() => {
                    const item = docsModalItem;
                    setDocsModalItem(null);
                    if (item) handleAtualizarDocsItem(item);
                }}
                productCode={docsModalItem?.protheus_cod || docsModalItem?.desenho_cliente}
                altCode={docsModalItem?.protheus_cod ? docsModalItem?.desenho_cliente : null}
                productName={docsModalItem?.protheus_desc || docsModalItem?.titulo || docsModalItem?.desenho_cliente}
            />
        </div>
    );
}

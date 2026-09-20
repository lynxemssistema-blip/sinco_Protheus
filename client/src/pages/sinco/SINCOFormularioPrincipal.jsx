import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Save, Search, FileText, Download, FileDigit, Settings, RefreshCw, Upload, 
    FileSignature, Plus, X, Pencil, Edit3, CheckCircle, AlertTriangle, XCircle, Trash2, 
    Sparkles, UploadCloud, FolderInput, Paperclip, Maximize2, Minimize2, Loader2,
    Network, Layers, Package, ExternalLink, Eye, Filter, Wrench, Building2, 
    Printer, FileSpreadsheet, CheckCircle2, ChevronRight, ChevronDown, FolderOpen,
    Info, ShieldAlert
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api, { getSincoArvore, getSincoArvoreCompleta, getSincoRestricoes, getSincoRestricoesSz0, createSincoRestricaoSz0, getSincoOperacoes, getSincoProduto, updateSincoProduto, updateSincoProductStructure, updateSincoRoteiro, updateSincoProdutoCliente, searchSincoProdutos, getProcessList, getClientes, getProductDocuments } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import CriarProdutoProtheusModal from '../../components/wabtec/CriarProdutoProtheusModal';
import DocsModal from '../../components/DocsModal';
import SincoComponenteModal from '../../components/sinco/SincoComponenteModal';
import SincoNodeManager from '../../components/sinco/SincoNodeManager';

const estadoVazio = {
    arquivo: 'Nenhum arquivo carregado',
    caminho: 'Nenhum arquivo carregado',
    titulo: '',
    grupo: '',
    unidade: '',
    tipo: '',
    rev: '',
    peso: '',
    espessura: '',
    largura: '',
    comprimento: '',
    area: '',
    acabamento: '', // Mantido da imagem, mas sem Autor/Data
    densidade: '7.85'
};

export default function SINCOFormularioPrincipal() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();

    const [dados, setDados] = useState({
        arquivo: searchParams.get('arquivo') || estadoVazio.arquivo,
        caminho: searchParams.get('caminho') || searchParams.get('arquivo') || estadoVazio.caminho,
        titulo: searchParams.get('titulo') || '',
        grupo: searchParams.get('grupo') || '',
        unidade: searchParams.get('unidade') || '',
        tipo: searchParams.get('tipo') || '',
        rev: searchParams.get('rev') || '',
        peso: searchParams.get('peso') || '',
        espessura: searchParams.get('espessura') || '',
        largura: searchParams.get('largura') || '',
        comprimento: searchParams.get('comprimento') || '',
        area: searchParams.get('area') || '',
        acabamento: searchParams.get('acabamento') || '',
        densidade: searchParams.get('densidade') || '7.85',
    });
    const [busca, setBusca] = useState('');
    const [arvore, setArvore] = useState([]);
    const [restricoes, setRestricoes] = useState([]);
    const [operacoes, setOperacoes] = useState([]);
    const [restricoesSz0, setRestricoesSz0] = useState([]);
    const [erroProtheus, setErroProtheus] = useState(null);
    const [produtoNaoNoMirror, setProdutoNaoNoMirror] = useState(false); // produto existe no ERP mas não está no espelho PostgreSQL

    const [loadingArvore, setLoadingArvore] = useState(false);
    const [loadingRest, setLoadingRest] = useState(false);
    const [loadingOpe, setLoadingOpe] = useState(false);
    const [loadingSz0, setLoadingSz0] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    // Modal Nova/Editar Restrição SZ0
    const [showModalSz0, setShowModalSz0] = useState(false);
    const [savingSz0, setSavingSz0] = useState(false);
    const [editandoRestricao, setEditandoRestricao] = useState(null); // null = nova, objeto = edição
    const [novaRestricao, setNovaRestricao] = useState({ resumo: '', restricao: '', responsavel: '', revMetalfisa: '', status: 'P' });
    // Modal de Regra de Negócio SZ1 (Duplicidade / Conflito Protheus)
    const [modalRegraSz1, setModalRegraSz1] = useState(null);
    // Edição de Árvore (BOM)
    const [isEditingArvore, setIsEditingArvore] = useState(false);
    const [isEditingDadosGerais, setIsEditingDadosGerais] = useState(false);
    const [materiaisSalvos, setMateriaisSalvos] = useState([]);
    
    // Buscar materiais do BD
    useEffect(() => {
        const fetchMateriais = async () => {
            try {
                const res = await api.get('/sinco/materiais-apoio');
                setMateriaisSalvos(res.data);
            } catch (err) {
                console.error('Erro ao buscar materiais de apoio:', err);
                // Fallback de segurança se falhar
                setMateriaisSalvos([
                    { nome: 'Aço Carbono', densidade: '7.85' },
                    { nome: 'Aço Inox', densidade: '7.93' },
                    { nome: 'Alumínio', densidade: '2.70' }
                ]);
            }
        };
        fetchMateriais();
    }, []);

    const [editedArvore, setEditedArvore] = useState([]);
    const [savingArvore, setSavingArvore] = useState(false);

    // Edição de Roteiro (Operações)
    const [isEditingOperacoes, setIsEditingOperacoes] = useState(false);
    const [editedOperacoes, setEditedOperacoes] = useState([]);
    const [savingOperacoes, setSavingOperacoes] = useState(false);
    const [processList, setProcessList] = useState([]);

    // Edição SZ1 (Produtos x Cliente)
    const [isEditingRestricoes, setIsEditingRestricoes] = useState(false);
    const [editedRestricoes, setEditedRestricoes] = useState([]);
    const [savingRestricoes, setSavingRestricoes] = useState(false);
    
    // Busca de Clientes para SZ1
    const [showSearchClienteModal, setShowSearchClienteModal] = useState(false);
    const [searchClienteQuery, setSearchClienteQuery] = useState('');
    const [searchClienteResults, setSearchClienteResults] = useState([]);
    const [searchingCliente, setSearchingCliente] = useState(false);
    const [activeClienteRowIndex, setActiveClienteRowIndex] = useState(null);

    // Debounce automático para busca de clientes no modal Protheus (SZ1)
    useEffect(() => {
        if (!showSearchClienteModal) return;
        const timer = setTimeout(() => {
            const q = searchClienteQuery ? searchClienteQuery.trim() : '';
            setSearchingCliente(true);
            getClientes(q)
                .then(res => setSearchClienteResults(Array.isArray(res) ? res : []))
                .catch(err => {
                    console.error('Erro ao buscar clientes:', err);
                    showToast("Erro ao buscar clientes", 'error');
                })
                .finally(() => setSearchingCliente(false));
        }, 300);

        return () => clearTimeout(timer);
    }, [searchClienteQuery, showSearchClienteModal]);

    useEffect(() => {
        getProcessList().then(res => {
            if (res && res.data) {
                setProcessList(res.data);
            }
        }).catch(err => console.error("Erro ao carregar processos:", err));
    }, []);

    // Modal de Busca de Produto
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [activeRowIndex, setActiveRowIndex] = useState(null);

    // Modal de Busca de Recurso
    const [showSearchRecursoModal, setShowSearchRecursoModal] = useState(false);
    const [searchRecursoQuery, setSearchRecursoQuery] = useState('');
    const [activeRecursoRowIndex, setActiveRecursoRowIndex] = useState(null);

    // Toast Notification
    const [toast, setToast] = useState(null);
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    // PDF URL from ERP e Lista de Documentos
    const [pdfDocUrl, setPdfDocUrl] = useState(null);
    const [productDocs, setProductDocs] = useState([]);
    const [showDocsModal, setShowDocsModal] = useState(false);
    const [openMenuDocs, setOpenMenuDocs] = useState(false);
    const [maximizedPanel, setMaximizedPanel] = useState(null); // 'arvore' | 'restricoes' | 'operacoes' | 'sz0' | null

    // Modal de Cadastro de Produto no Protheus (TOTVS)
    const [modalCriarProdutoOpen, setModalCriarProdutoOpen] = useState(false);
    const [itemParaCriarProduto, setItemParaCriarProduto] = useState(null);

    // Aba Principal (Opção A: Página Inteira): 'formulario' | 'arvore'
    const [activeMainTab, setActiveMainTab] = useState('formulario');

    // Estados da Aba Estrutura em Árvore Completa (Multinível Recursiva)
    const [arvoreCompleta, setArvoreCompleta] = useState([]);
    const [loadingArvoreCompleta, setLoadingArvoreCompleta] = useState(false);
    const [treeFilterText, setTreeFilterText] = useState('');
    const [treeValidationStatus, setTreeValidationStatus] = useState({});
    const [loadingTreeValidation, setLoadingTreeValidation] = useState(false);
    const [selectedComponenteModal, setSelectedComponenteModal] = useState(null);

    // 3 Modos de Visualização: 'accordion' | 'drawer' | 'modal'
    const [treeViewMode, setTreeViewMode] = useState(() => {
        return localStorage.getItem('sinco_arvore_view_mode') || 'accordion';
    });
    const handleSetTreeViewMode = (mode) => {
        setTreeViewMode(mode);
        localStorage.setItem('sinco_arvore_view_mode', mode);
    };
    const [expandedNodeAccordion, setExpandedNodeAccordion] = useState(null);
    const [activeDrawerNode, setActiveDrawerNode] = useState(null);
    const [activeModalNode, setActiveModalNode] = useState(null);

    const codigoAtual = (dados.arquivo !== estadoVazio.arquivo && dados.arquivo
        ? dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase() 
        : (busca ? busca.replace(/\.[^/.]+$/, '').trim().toUpperCase() : ''));

    const handleRefreshDocs = useCallback(async (codParam = null) => {
        const cod = (codParam || codigoAtual || '').trim().toUpperCase();
        if (!cod || cod === estadoVazio.arquivo.toUpperCase()) {
            setProductDocs([]);
            setPdfDocUrl(null);
            return;
        }
        try {
            const docs = await getProductDocuments(cod);
            if (Array.isArray(docs)) {
                setProductDocs(docs);
                const desenho = docs.find(d => d.tipo === 'Desenho') || docs[0];
                if (desenho?.url_arquivo) {
                    setPdfDocUrl(desenho.url_arquivo);
                } else {
                    setPdfDocUrl(null);
                }
            } else {
                setProductDocs([]);
                setPdfDocUrl(null);
            }
        } catch (e) {
            console.warn('[SINCO] Erro ao sincronizar documentos:', e);
            setProductDocs([]);
        }
    }, [codigoAtual]);

    const handleAbrirCadastroNovo = (customItemParam = null) => {
        // Se foi disparado diretamente pelo evento onClick do React, descarta o SyntheticEvent
        const isCustomValid = customItemParam && typeof customItemParam.preventDefault !== 'function' && !customItemParam.nativeEvent && !customItemParam._reactName;
        const customItem = isCustomValid ? customItemParam : null;

        if (!customItem) {
            // Abertura LIMPA/NOVA (botão superior "Cadastrar no Protheus"):
            // Nenhum dado do produto atualmente visualizado na tela deve sujar o novo cadastro.
            setItemParaCriarProduto({
                is_clean: true,
                desenho_cliente: '',
                b1_xcode: '',
                b1_xcoddes: '',
                rev_convertida: '00',
                rev_cliente_raw: '00',
                revisao: '00',
                nivel: 'PA',
                titulo: '',
                uom: 'PC',
                peso: '',
                comprimento: '',
                largura: '',
                espessura: '',
                volume: '',
                cliente_codigo: '',
                cliente_loja: '0001',
                cliente_nome: '',
                badge: 'CADASTRO SOLID EDGE',
                is_sinco: true
            });
            setModalCriarProdutoOpen(true);
            return;
        }

        // Se veio de um item customizado (ex: linha da árvore BOM não mapeada)
        setItemParaCriarProduto({
            ...customItem,
            desenho_cliente: customItem.desenho_cliente || '',
            b1_xcode: customItem.b1_xcode || customItem.desenho_cliente || 'Novo Cadastro Pelo SINCO',
            b1_xcoddes: customItem.b1_xcoddes || customItem.desenho_cliente || 'Novo Cadastro Pelo SINCO',
            rev_convertida: customItem.rev_convertida || '00',
            rev_cliente_raw: customItem.rev_cliente_raw || '00',
            revisao: customItem.revisao || '00',
            nivel: customItem.nivel || 'N1',
            titulo: customItem.titulo || '',
            uom: customItem.uom || 'PC',
            peso: customItem.peso || '',
            comprimento: customItem.comprimento || '',
            largura: customItem.largura || '',
            espessura: customItem.espessura || '',
            volume: customItem.volume || '',
            cliente_codigo: customItem.cliente_codigo || '',
            cliente_loja: customItem.cliente_loja || '0001',
            cliente_nome: customItem.cliente_nome || '',
            badge: 'CADASTRO SOLID EDGE',
            is_sinco: true
        });
        setModalCriarProdutoOpen(true);
    };

    const handleProdutoCriadoComSucesso = async (resData) => {
        const novoCodigo = resData?.codigo;
        if (novoCodigo) {
            showToast(`🎉 Produto ${novoCodigo} gerado e cadastrado no Protheus com sucesso!`, 'success');
            
            // Se foi aberto a partir de uma linha da árvore (BOM)
            if (itemParaCriarProduto?._targetRowIndex !== undefined && itemParaCriarProduto?._targetRowIndex !== null) {
                const rowIdx = itemParaCriarProduto._targetRowIndex;
                const newArr = [...editedArvore];
                if (newArr[rowIdx]) {
                    newArr[rowIdx].componente = novoCodigo;
                    newArr[rowIdx].descricao = resData.descricao || itemParaCriarProduto.titulo || '';
                    newArr[rowIdx].unidade = resData.uom || 'PC';
                    setEditedArvore(newArr);
                }
                return;
            }

            // Se foi o produto principal: preenche imediatamente todos os dados do formulário
            setBusca(novoCodigo);
            setProdutoNaoNoMirror(false);
            setErroProtheus(null);

            setDados(prev => ({
                ...prev,
                arquivo: novoCodigo,
                caminho: `Cadastrado no Protheus (${resData.desenho_cliente || resData.b1_xcoddes || 'Novo Cadastro Pelo SINCO'})`,
                titulo: resData.descricao || itemParaCriarProduto?.titulo || prev.titulo,
                tipo: resData.protheus_tipo || resData.tipo || itemParaCriarProduto?.tipo || prev.tipo,
                unidade: resData.uom || resData.um || itemParaCriarProduto?.um || prev.unidade,
                grupo: resData.grupo || (itemParaCriarProduto?.grupo ? String(itemParaCriarProduto.grupo).split(/[\-\s]/)[0] : '') || prev.grupo,
                rev: resData.revisao || itemParaCriarProduto?.revisao_cliente || '00',
                peso: resData.peso !== undefined && resData.peso !== '' ? String(resData.peso) : (itemParaCriarProduto?.peso || prev.peso),
                comprimento: resData.comprimento !== undefined && resData.comprimento !== '' ? String(resData.comprimento) : (itemParaCriarProduto?.comprimento || prev.comprimento),
                largura: resData.largura !== undefined && resData.largura !== '' ? String(resData.largura) : (itemParaCriarProduto?.largura || prev.largura),
                espessura: resData.espessura !== undefined && resData.espessura !== '' ? String(resData.espessura) : (itemParaCriarProduto?.espessura || prev.espessura),
                area: resData.volume !== undefined && resData.volume !== '' ? String(resData.volume) : (itemParaCriarProduto?.volume || prev.area)
            }));

            // Atualiza e recarrega toda a tela do Solid Edge (Árvore, Restrições SZ1, Operações/Roteiro, SZ0 e Documentos)
            await carregarProtheus(novoCodigo);
            handleRefreshDocs(novoCodigo);

            // Garante exibição imediata do vínculo SZ1 na tabela da tela sem depender de latência de replicação
            if (resData.cliente_codigo) {
                setRestricoes(prev => {
                    const filtrado = (prev || []).filter(r => !(
                        r.cliente === resData.cliente_codigo && 
                        (r.cod_cliente === resData.desenho_cliente || !r.cod_cliente)
                    ));
                    return [
                        ...filtrado,
                        {
                            cliente: resData.cliente_codigo,
                            loja: resData.cliente_loja || '0001',
                            nome_cliente: resData.cliente_nome || '',
                            desc_cliente: resData.cliente_nome || '',
                            cod_cliente: resData.desenho_cliente || '',
                            revisao: resData.revisao || '00'
                        }
                    ];
                });
            }

            // Atualiza URL para refletir o novo produto no SINCO
            try {
                setSearchParams({ arquivo: novoCodigo }, { replace: true });
            } catch (urlErr) {
                console.warn('Erro ao atualizar searchParams:', urlErr);
            }

            // Consulta no banco Protheus para certificar dados gerais
            try {
                const prodDetalhe = await getSincoProduto(novoCodigo);
                if (prodDetalhe) {
                    setDados(prev => ({
                        ...prev,
                        titulo: prodDetalhe.titulo || prev.titulo,
                        tipo: prodDetalhe.tipo || prev.tipo,
                        unidade: prodDetalhe.unidade || prev.unidade,
                        grupo: prodDetalhe.grupo || prev.grupo,
                        peso: prodDetalhe.peso || prev.peso,
                        rev: prodDetalhe.xrevm || prev.rev
                    }));
                }
            } catch (e) {
                // Silencioso se o espelho local do Protheus ainda sincronizará
            }
        }
    };
    useEffect(() => {
        const e = parseFloat(String(dados.espessura).replace(',', '.')) || 0;
        const l = parseFloat(String(dados.largura).replace(',', '.')) || 0;
        const c = parseFloat(String(dados.comprimento).replace(',', '.')) || 0;
        const d = parseFloat(String(dados.densidade).replace(',', '.')) || 0;

        if (e > 0 && l > 0 && c > 0) {
            // Peso = espessura * largura * comprimento * (densidade / 1000000)
            const novoPeso = (e * l * c * (d / 1000000)).toFixed(3);
            
            // Área de pintura em M² (largura * comprimento * 2 lados / 1.000.000)
            const novaArea = ((l * c * 2) / 1000000).toFixed(3);

            if (dados.peso !== novoPeso || dados.area !== novaArea) {
                setDados(prev => ({
                    ...prev,
                    peso: novoPeso,
                    area: novaArea
                }));
            }
        }
    }, [dados.espessura, dados.largura, dados.comprimento, dados.densidade, dados.peso, dados.area]);

    const carregarProtheus = useCallback(async (codigo) => {
        if (!codigo || codigo === estadoVazio.arquivo) {
            setArvore([]);
            setRestricoes([]);
            setOperacoes([]);
            setErroProtheus(null);
            return;
        }

        // Remover a extensão do arquivo (.psm, .asm, .par, etc.)
        const codigoSemExtensao = codigo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        setErroProtheus(null);
        setLoadingArvore(true);
        setLoadingRest(true);
        setLoadingOpe(true);
        setLoadingSz0(true);
        setLoadingArvoreCompleta(true);
        try {
            const [rA, rR, rO, rSz0, rDocs, rACompleta] = await Promise.all([
                getSincoArvore(codigoSemExtensao),
                getSincoRestricoes(codigoSemExtensao),
                getSincoOperacoes(codigoSemExtensao),
                getSincoRestricoesSz0(codigoSemExtensao),
                getProductDocuments(codigoSemExtensao).catch(() => []),
                getSincoArvoreCompleta(codigoSemExtensao).catch(() => [])
            ]);
            setArvore(Array.isArray(rA) ? rA : []);
            setEditedArvore(Array.isArray(rA) ? JSON.parse(JSON.stringify(rA)) : []);
            setIsEditingArvore(false);
            setRestricoes(Array.isArray(rR) ? rR : []);
            const rOMapped = Array.isArray(rO) ? rO.map(o => ({...o, _original_operacao: o.operacao})) : [];
            setOperacoes(rOMapped);
            setRestricoesSz0((Array.isArray(rSz0) ? rSz0 : []).filter(r => r.status !== 'L'));
            setArvoreCompleta(Array.isArray(rACompleta) ? rACompleta : []);
            
            // Verifica se tem PDF de desenho
            if (Array.isArray(rDocs) && rDocs.length > 0) {
                setProductDocs(rDocs);
                // Tenta achar o primeiro arquivo do tipo Desenho
                const desenho = rDocs.find(d => d.tipo === 'Desenho') || rDocs[0];
                setPdfDocUrl(desenho.url_arquivo);
            } else {
                setProductDocs([]);
                setPdfDocUrl(null);
            }
        } catch (error) {
            console.error("Erro ao carregar dados do Protheus:", error);
            setErroProtheus(error.response?.data?.error || error.message || 'Erro desconhecido ao consultar');
            setArvore([]);
            setRestricoes([]);
            setOperacoes([]);
            setRestricoesSz0([]);
            setArvoreCompleta([]);
            setProductDocs([]);
            setPdfDocUrl(null);
        } finally {
            setLoadingArvore(false);
            setLoadingRest(false);
            setLoadingOpe(false);
            setLoadingSz0(false);
            setLoadingArvoreCompleta(false);
        }
    }, []);

    // Carrega na primeira abertura (via URL)
    useEffect(() => {
        const cod = searchParams.get('arquivo');
        if (cod) carregarProtheus(cod);
    }, [searchParams, carregarProtheus]);

    // Se o app VB enviou ?codigo= (código gerado pelo Protheus), preenche o campo de busca e consulta automaticamente
    useEffect(() => {
        const codigoProtheus = searchParams.get('codigo');
        if (codigoProtheus && codigoProtheus.trim()) {
            const codigoLimpo = codigoProtheus.trim().toUpperCase();
            setBusca(codigoLimpo);
            buscarProdutoManual(codigoLimpo);
        }
    // Só executa uma vez ao montar (quando a URL chega do VB)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Socket.io — recebe atualização em tempo real do Solid Edge Desktop
    useEffect(() => {
        let socket = null;
        import('socket.io-client').then(({ io }) => {
            const socketUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
            socket = io(socketUrl, { transports: ['polling', 'websocket'] });
            socket.on('connect', () => { socket.emit('join_sinco_formulario'); });
            socket.on('sinco:desenho_atualizado', (novos) => {
                setDados(prev => {
                    const arquivoMudou = novos.arquivo && novos.arquivo !== prev.arquivo;
                    if (arquivoMudou) carregarProtheus(novos.arquivo);
                    return arquivoMudou ? { ...estadoVazio, ...novos } : { ...prev, ...novos };
                });
            });
        });
        return () => { if (socket) socket.disconnect(); };
    }, [carregarProtheus]);

    const buscarProdutoManual = async (codigo) => {
        if (!codigo) return;
        const codigoSemExtensao = codigo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        setErroProtheus(null);
        setProdutoNaoNoMirror(false);
        setDados({
            ...estadoVazio,
            arquivo: codigoSemExtensao,
            caminho: 'Busca via ERP',
        });

        try {
            const p = await getSincoProduto(codigoSemExtensao);
            if (p) {
                setProdutoNaoNoMirror(false);
                setDados(prev => ({
                    ...prev,
                    titulo: p.titulo || '',
                    tipo: p.tipo || '',
                    unidade: p.unidade || '',
                    grupo: p.grupo || '',
                    peso: p.peso || prev.peso,
                    // p.xrevm = B1_XREVM (Rev. MetalFisa); p.rev = B1_REVATU (revisão técnica geral)
                    rev: p.xrevm || prev.rev,
                    espessura: p.espessura || prev.espessura,
                    largura: p.largura || prev.largura,
                    comprimento: p.comprimento || prev.comprimento,
                    area: p.area || prev.area
                }));
            }
        } catch (e) {
            // Produto não está no espelho PostgreSQL (pode existir no ERP mas ainda não sincronizado)
            console.warn(`[SINCO] Produto ${codigoSemExtensao} ausente no mirror PostgreSQL (SB1010). Ativando modo de preenchimento manual.`);
            setProdutoNaoNoMirror(true);
            // Ativa edição automática para o usuário preencher os dados manualmente
            setIsEditingDadosGerais(true);
        }

        carregarProtheus(codigoSemExtensao);
    };

    const temArquivo = dados.arquivo !== estadoVazio.arquivo;

    const handleAtualizarDados = async () => {
        if (!temArquivo) return;
        const codigoSemExtensao = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        try {
            const p = await getSincoProduto(codigoSemExtensao);
            if (p) {
                setDados(prev => ({
                    ...prev,
                    titulo: p.titulo || '',
                    tipo: p.tipo || '',
                    unidade: p.unidade || '',
                    grupo: p.grupo || '',
                    peso: p.peso || prev.peso,
                    // p.xrevm = B1_XREVM (Rev. MetalFisa); p.rev = B1_REVATU (revisão técnica geral)
                    rev: p.xrevm || prev.rev,
                    espessura: p.espessura || prev.espessura,
                    largura: p.largura || prev.largura,
                    comprimento: p.comprimento || prev.comprimento,
                    area: p.area || prev.area
                }));
            }
        } catch (e) {
            console.warn(`Produto ${codigoSemExtensao} não encontrado (SB1/SB5).`);
        }

        carregarProtheus(codigoSemExtensao);
    };

    const handleSalvarProduto = async () => {
        const codigoFormatado = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();
        
        if (!codigoFormatado || codigoFormatado === 'NENHUM ARQUIVO CARREGADO') {
            showToast('Nenhum produto válido selecionado.', 'error');
            return;
        }

        try {
            setLoadingData(true);
            const payload = {
                codigo: codigoFormatado,
                titulo: dados.titulo,
                grupo: dados.grupo,
                tipo: dados.tipo,
                um: dados.unidade,
                revisao: dados.rev,
                codigoDesenho: codigoFormatado, // Utilizando o arquivo atual

                peso: dados.peso,
                comprimento: dados.comprimento,
                largura: dados.largura,
                espessura: dados.espessura,
                area: dados.area // Equivalente ao B5_VOLUME
            };

            await updateSincoProduto(payload);
            showToast('Dados do produto atualizados no Protheus com sucesso!', 'success');
            setIsEditingDadosGerais(false);
        } catch (error) {
            console.error('Erro ao salvar dados do produto:', error.response?.data || error);
            const msg = error.response?.data?.details?.message || error.response?.data?.details || error.response?.data?.error || error.message;
            const strMsg = typeof msg === 'object' ? JSON.stringify(msg) : msg;
            setErroProtheus(strMsg);
            showToast('Erro ao atualizar produto: ' + strMsg, 'error');
        } finally {
            setLoadingData(false);
        }
    };

    const handleSalvarRestricao = async () => {
        if (!temArquivo) return;
        const produto = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        // Data/hora local — evita conversão UTC que faz cair no dia seguinte após 21h
        const now = new Date();
        const dtHoje = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const hrAgora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const isEdit = !!editandoRestricao;

        // Edição: mantém a chave primária existente
        // Inclusão: encontra o maior item do array e soma 1
        const item = isEdit
            ? editandoRestricao.item
            : (() => {
                const maxItem = restricoesSz0.reduce((max, r) => {
                    const n = parseInt(r.item, 10);
                    return isNaN(n) ? max : Math.max(max, n);
                }, 0);
                return String(maxItem + 1).padStart(3, '0');
            })();

        const formatProtheusStr = (text) => {
            if (!text) return '';
            return text
                .normalize('NFD') // Remove accents
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase() // Force uppercase
                .replace(/[^A-Z0-9\s.,\-:()\/]/g, ''); // Remove strict special characters
        };

        const payload = {
            data: {
                restricoes: [{
                    EMPRESA: '01',
                    CFILANT: '01',
                    NOPER: isEdit ? 4 : 3,
                    Z0_PRODUTO: produto,
                    Z0_ITEM: item,
                    Z0_STATUS: novaRestricao.status || 'P',
                    Z0_RESUMO: formatProtheusStr(novaRestricao.resumo),
                    Z0_RESTRIC: formatProtheusStr(novaRestricao.restricao),
                    Z0_RESPONS: novaRestricao.responsavel,
                    Z0_DTULTAL: dtHoje,
                    Z0_HRULTAL: hrAgora,
                    Z0_XREVM: (novaRestricao.revMetalfisa || dados.rev || '').substring(0, 2),
                }]
            }
        };

        setSavingSz0(true);
        try {
            await createSincoRestricaoSz0(payload);
            setShowModalSz0(false);
            setEditandoRestricao(null);
            setNovaRestricao({ resumo: '', restricao: '', responsavel: '', revMetalfisa: '', status: 'P' });
            const rSz0 = await getSincoRestricoesSz0(produto);
            setRestricoesSz0((Array.isArray(rSz0) ? rSz0 : []).filter(r => r.status !== 'L'));
            showToast('Restrição SZ0 salva com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao salvar restrição SZ0:', err.response?.data || err);
            const msg = err.response?.data?.details?.message || err.response?.data?.details || err.response?.data?.error || err.response?.data?.message || err.message;
            const strMsg = typeof msg === 'object' ? JSON.stringify(msg) : msg;
            showToast('Erro ao salvar restrição: ' + strMsg, 'error');
        } finally {
            setSavingSz0(false);
        }
    };

    const handleDeletarRestricaoSz0 = async (r) => {
        if (!confirm(`Deseja excluir a restrição ${r.item}?`)) return;
        
        const now = new Date();
        const dtHoje = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const hrAgora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const produto = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        const payload = {
            data: {
                restricoes: [{
                    EMPRESA: '01',
                    CFILANT: '01',
                    NOPER: 4, // NOPER 4 com status 'L' (Liberada/Excluída), evitando erro 500 do Protheus
                    Z0_PRODUTO: produto,
                    Z0_ITEM: String(r.item || '001').padStart(3, '0'),
                    Z0_STATUS: 'L',
                    Z0_RESUMO: r.resumo || 'LIBERADA',
                    Z0_RESTRIC: r.restricao || 'LIBERADA',
                    Z0_RESPONS: (user?.nome || user?.login || 'ENGENHARIA').toUpperCase().substring(0, 15),
                    Z0_DTULTAL: dtHoje,
                    Z0_HRULTAL: hrAgora,
                    Z0_XREVM: (r.revisao || '').substring(0, 2)
                }]
            }
        };

        setLoadingSz0(true);
        try {
            await createSincoRestricaoSz0(payload);
            showToast('Restrição excluída com sucesso.', 'success');
            const rSz0 = await getSincoRestricoesSz0(produto);
            setRestricoesSz0((Array.isArray(rSz0) ? rSz0 : []).filter(r => r.status !== 'L'));
            if (handleRevalidarArvore) handleRevalidarArvore(produto, 'sz0');
        } catch (err) {
            console.error('Erro ao excluir restrição SZ0:', err.response?.data || err);
            const msg = err.response?.data?.details?.message || err.response?.data?.details || err.response?.data?.error || err.response?.data?.message || err.message;
            const strMsg = typeof msg === 'object' ? JSON.stringify(msg) : msg;
            showToast('Erro do Protheus ao processar restrição: ' + strMsg, 'error');
        } finally {
            setLoadingSz0(false);
        }
    };

    const handleSalvarArvore = async () => {
        if (!temArquivo) return;
        const produtoPai = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        // Ponto 3: Bloqueio de Componentes Duplicados na Tela
        const codigosAtivos = editedArvore
            .filter(e => !e.deleted && e.componente && e.componente.trim() !== '')
            .map(e => e.componente.toUpperCase().trim());
        const duplicados = codigosAtivos.filter((item, index) => codigosAtivos.indexOf(item) !== index);
        if (duplicados.length > 0) {
            showToast(`O componente ${duplicados[0]} foi adicionado duas vezes. Agrupe as quantidades antes de salvar.`, 'warning');
            return;
        }

        // Ponto 4: Concorrência (Dois Engenheiros no mesmo Produto)
        try {
            const arvoreFresca = await getSincoArvore(produtoPai);
            if (Array.isArray(arvoreFresca) && arvoreFresca.length !== arvore.length) {
                showToast(`Atenção: Outro usuário alterou a estrutura do ${produtoPai} enquanto você editava. Por segurança, a edição foi cancelada e a página será atualizada com os dados mais recentes.`, 'warning');
                setArvore(arvoreFresca);
                setIsEditingArvore(false);
                return;
            }
        } catch (err) {
            console.error("Erro checando concorrência:", err);
        }
        
        const estruturaMudancas = [];
        let hasValidationError = false;

        // Função auxiliar para datas
        const formatDate = (val, fallback) => {
            if (!val) return fallback;
            const str = String(val).trim();
            return str === '' ? fallback : str;
        };

        // 1. Identificar INCLUIR e ALTERAR
        for (const itemEdit of editedArvore) {
            if (!itemEdit.componente || itemEdit.componente.trim() === '') continue;

            const componente = itemEdit.componente.toUpperCase().trim();
            const qtdNum = Number(itemEdit.quantidade) || 0;
            
            if (!itemEdit.deleted && qtdNum <= 0) {
                showToast(`O componente ${componente} não pode ter quantidade zero ou negativa.`, 'warning');
                hasValidationError = true;
                break;
            }

            const itemOrig = arvore.find(o => 
                o.componente && o.componente.toUpperCase().trim() === componente &&
                (itemEdit.trt === undefined || o.trt === itemEdit.trt)
            );

            if (!itemOrig) {
                // Não estava na original = INCLUIR
                if (!itemEdit.deleted) {
                    estruturaMudancas.push({
                        G1_COMP: componente,
                        G1_TRT: "   ",
                        G1_QUANT: qtdNum,
                        G1_PERDA: 0,
                        G1_INI: "19000101",
                        G1_FIM: "20491231",
                        OPCAO: "INCLUIR"
                    });
                }
            } else {
                // Estava na original
                if (itemEdit.deleted) {
                    estruturaMudancas.push({
                        G1_COMP: componente,
                        G1_TRT: itemOrig.trt || "   ",
                        G1_QUANT: Number(itemOrig.quantidade) || 0,
                        G1_PERDA: Number(itemOrig.perda) || 0,
                        G1_INI: formatDate(itemOrig.ini, "19000101"),
                        G1_FIM: formatDate(itemOrig.fim, "20491231"),
                        OPCAO: "EXCLUIR"
                    });
                } else if (qtdNum !== (Number(itemOrig.quantidade) || 0)) {
                    // Quantidade mudou = ALTERAR
                    estruturaMudancas.push({
                        G1_COMP: componente,
                        G1_TRT: itemOrig.trt || "   ",
                        G1_QUANT: qtdNum,
                        G1_PERDA: Number(itemOrig.perda) || 0,
                        G1_INI: formatDate(itemOrig.ini, "19000101"),
                        G1_FIM: formatDate(itemOrig.fim, "20491231"),
                        OPCAO: "ALTERAR"
                    });
                }
            }
        }

        if (hasValidationError) return;

        // 2. Identificar EXCLUIR silentes
        for (const itemOrig of arvore) {
            if (!itemOrig.componente) continue;
            const componente = itemOrig.componente.toUpperCase().trim();
            const existsInEdited = editedArvore.find(e => e.componente && e.componente.toUpperCase().trim() === componente);
            if (!existsInEdited) {
                estruturaMudancas.push({
                    G1_COMP: componente,
                    G1_TRT: itemOrig.trt || "   ",
                    G1_QUANT: Number(itemOrig.quantidade) || 0,
                    G1_PERDA: Number(itemOrig.perda) || 0,
                    G1_INI: formatDate(itemOrig.ini, "19000101"),
                    G1_FIM: formatDate(itemOrig.fim, "20491231"),
                    OPCAO: "EXCLUIR"
                });
            }
        }



        if (estruturaMudancas.length === 0) {
            showToast('Nenhuma mudança detectada na estrutura.', 'warning');
            setIsEditingArvore(false);
            return;
        }

        // Se a arvore original estiver completamente vazia, significa que a estrutura não existe no Protheus.
        // Logo, a operação global (NOPER) deve ser 3 (Inclusão) e não 4 (Alteração).
        const noper = arvore.length === 0 ? 3 : 4;

        const payload = {
            noper: noper,
            empresa: "01",
            filial: "0101",
            produto: produtoPai,
            quantidade: 1, // Quantidade do pai
            estrutura: estruturaMudancas
        };

        setSavingArvore(true);
        try {
            await updateSincoProductStructure(payload);
            showToast('Estrutura atualizada com sucesso no Protheus!', 'success');
            // Recarrega apenas a estrutura e valida pontualmente sem piscar telas
            const rA = await getSincoArvore(produtoPai);
            setArvore(Array.isArray(rA) ? rA : []);
            setEditedArvore(Array.isArray(rA) ? JSON.parse(JSON.stringify(rA)) : []);
            setIsEditingArvore(false);
            handleRevalidarArvore(produtoPai, 'materiais');
        } catch (err) {
            console.error('Erro ao salvar estrutura (BOM):', err.response?.data || err);
            const msg = err.response?.data?.details?.message || err.response?.data?.details || err.response?.data?.error || err.message;
            const strMsg = typeof msg === 'object' ? JSON.stringify(msg) : msg;
            showToast('Erro ao salvar estrutura: ' + strMsg, 'error');
        } finally {
            setSavingArvore(false);
        }
    };

    const handleSalvarOperacoes = async () => {
        if (!temArquivo) return;
        const produtoPai = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        const activeOps = editedOperacoes.filter(op => !op.deleted);
        if (operacoes.length > 0 && activeOps.length === 0) {
            showToast('O Protheus exige pelo menos uma operação ativa no roteiro.', 'warning');
            return;
        }

        // Validação de duplicidade de sequência
        const seqs = activeOps.map(op => String(op.operacao || '').trim().padStart(2, '0'));
        if (new Set(seqs).size !== seqs.length) {
            showToast('Existem operações com a mesma sequência no roteiro. O Protheus rejeita duplicidade.', 'error');
            return;
        }

        // Se operacoes.length == 0 => Inclusão de roteiro (NOPER = 3)
        // Se operacoes.length > 0 => Alteração de roteiro (NOPER = 4)
        const noper = operacoes.length === 0 ? 3 : 4;

        // Construir o payload de operações
        const roteirosParaEnviar = [];

        for (let i = 0; i < operacoes.length; i++) {
            const original = operacoes[i];
            const editada = editedOperacoes.find(op => op._original_operacao === original.operacao && !op.isNew);
            
            if (!editada || editada.deleted) {
                // Foi excluída
                roteirosParaEnviar.push({
                    G2_OPERAC: String(original.operacao).trim().padStart(2, '0'),
                    G2_DESCRI: (original.descricao || original.recurso_descricao || '').substring(0, 30),
                    G2_RECURSO: (original.recurso || '').trim(),
                    G2_FERRAM: "",
                    G2_TPALOCF: "",
                    G2_SETUP: Number(original.setup || 0),
                    G2_FORMSTP: "",
                    G2_LOTEPAD: 1,
                    G2_TEMPAD: Number(original.tempo || 1),
                    G2_TPOPER: "1",
                    G2_TPSOBRE: "",
                    G2_TEMPSOB: "",
                    G2_CTRAB: "",
                    G2_TEMPEND: "",
                    G2_MAOOBRA: 1,
                    OPERACAO: "EXCLUIR"
                });
            } else if (String(editada.operacao).trim() !== String(original.operacao).trim()) {
                // Mudou o número da operação: Exclui a original e inclui a nova
                roteirosParaEnviar.push({
                    G2_OPERAC: String(original.operacao).trim().padStart(2, '0'),
                    G2_DESCRI: (original.descricao || original.recurso_descricao || '').substring(0, 30),
                    G2_RECURSO: (original.recurso || '').trim(),
                    G2_FERRAM: "",
                    G2_TPALOCF: "",
                    G2_SETUP: Number(original.setup || 0),
                    G2_FORMSTP: "",
                    G2_LOTEPAD: 1,
                    G2_TEMPAD: Number(original.tempo || 1),
                    G2_TPOPER: "1",
                    G2_TPSOBRE: "",
                    G2_TEMPSOB: "",
                    G2_CTRAB: "",
                    G2_TEMPEND: "",
                    G2_MAOOBRA: 1,
                    OPERACAO: "EXCLUIR"
                });
                roteirosParaEnviar.push({
                    G2_OPERAC: String(editada.operacao).trim().padStart(2, '0'),
                    G2_DESCRI: (editada.descricao || editada.recurso_descricao || '').substring(0, 30),
                    G2_RECURSO: (editada.recurso || '').trim(),
                    G2_FERRAM: "",
                    G2_TPALOCF: "",
                    G2_SETUP: Number(editada.setup || 0),
                    G2_FORMSTP: "",
                    G2_LOTEPAD: 1,
                    G2_TEMPAD: Number(editada.tempo || 1),
                    G2_TPOPER: "1",
                    G2_TPSOBRE: "",
                    G2_TEMPSOB: "",
                    G2_CTRAB: "",
                    G2_TEMPEND: "",
                    G2_MAOOBRA: 1,
                    OPERACAO: "INCLUIR"
                });
            } else {
                // Mesma operação mantida ou alterada (sempre enviada na alteração de roteiro)
                roteirosParaEnviar.push({
                    G2_OPERAC: String(editada.operacao).trim().padStart(2, '0'),
                    G2_DESCRI: (editada.descricao || editada.recurso_descricao || '').substring(0, 30),
                    G2_RECURSO: (editada.recurso || '').trim(),
                    G2_FERRAM: "",
                    G2_TPALOCF: "",
                    G2_SETUP: Number(editada.setup || 0),
                    G2_FORMSTP: "",
                    G2_LOTEPAD: 1,
                    G2_TEMPAD: Number(editada.tempo || 1),
                    G2_TPOPER: "1",
                    G2_TPSOBRE: "",
                    G2_TEMPSOB: "",
                    G2_CTRAB: "",
                    G2_TEMPEND: "",
                    G2_MAOOBRA: 1,
                    OPERACAO: "ALTERAR"
                });
            }
        }

        // Inclui as novas operações
        for (let i = 0; i < editedOperacoes.length; i++) {
            const op = editedOperacoes[i];
            if (op.isNew && !op.deleted) {
                if (!op.operacao || !op.recurso) continue;
                roteirosParaEnviar.push({
                    G2_OPERAC: String(op.operacao).trim().padStart(2, '0'),
                    G2_DESCRI: (op.descricao || op.recurso_descricao || '').substring(0, 30),
                    G2_RECURSO: (op.recurso || '').trim(),
                    G2_FERRAM: "",
                    G2_TPALOCF: "",
                    G2_SETUP: Number(op.setup || 0),
                    G2_FORMSTP: "",
                    G2_LOTEPAD: 1,
                    G2_TEMPAD: Number(op.tempo || 1),
                    G2_TPOPER: "1",
                    G2_TPSOBRE: "",
                    G2_TEMPSOB: "",
                    G2_CTRAB: "",
                    G2_TEMPEND: "",
                    G2_MAOOBRA: 1,
                    OPERACAO: "INCLUIR"
                });
            }
        }

        if (roteirosParaEnviar.length === 0) {
            showToast('Nenhuma modificação para salvar no roteiro.', 'warning');
            setIsEditingOperacoes(false);
            return;
        }

        const payload = {
            data: {
                NOPER: Number(noper),
                EMPRESA: "01",
                CFILANT: "0101",
                G2_CODIGO: "01",
                G2_PRODUTO: produtoPai,
                roteiros: roteirosParaEnviar
            }
        };

        setSavingOperacoes(true);
        try {
            await updateSincoRoteiro(payload);
            showToast('Roteiro atualizado com sucesso no Protheus!', 'success');
            // Recarrega apenas operações pontualmente sem recarregar a tela inteira
            const rO = await getSincoOperacoes(produtoPai);
            const rOMapped = Array.isArray(rO) ? rO.map(o => ({...o, _original_operacao: o.operacao})) : [];
            setOperacoes(rOMapped);
            setEditedOperacoes(JSON.parse(JSON.stringify(rOMapped)));
            setIsEditingOperacoes(false);
            handleRevalidarArvore(produtoPai, 'roteiro');
        } catch (err) {
            console.error('❌ Falha ao salvar Roteiro:', err.response?.data || err);
            const msg = err.response?.data?.details?.message || err.response?.data?.details || err.response?.data?.error || err.message;
            const strMsg = typeof msg === 'object' ? JSON.stringify(msg) : msg;
            showToast('Erro ao salvar roteiro: ' + strMsg, 'error');
        } finally {
            setSavingOperacoes(false);
        }
    };

    const applyReindexOperacoes = (arr) => {
        // Apenas ordena pelo número da operação, preservando a numeração customizada (ex: 25)
        // para não sobrescrever nem apagar operações subsequentes indevidamente.
        return [...arr].sort((a, b) => parseInt(a.operacao || 0, 10) - parseInt(b.operacao || 0, 10));
    };

    const handleSalvarRestricoesSz1 = async () => {
        if (!temArquivo) return;
        const produto = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        const validos = editedRestricoes.filter(r => !r.deleted && r.cliente && String(r.cliente).trim() !== '');

        if (validos.length === 0 && restricoes.length === 0) {
            showToast('Nenhuma mudança para salvar na tabela SZ1.', 'warning');
            setIsEditingRestricoes(false);
            return;
        }

        // Validação: Não permitir mesma revisão para o mesmo código de cliente
        const keySet = new Set();
        for (const r of validos) {
            const codCli = String(r.cod_cliente || '').trim().toUpperCase();
            const rev = String(r.revisao || '').trim().toUpperCase();
            const uniqueKey = `${codCli}-${rev}`;
            if (keySet.has(uniqueKey)) {
                showToast(`Erro: A revisão '${rev}' está repetida para o cód. cliente '${codCli}'.`, 'error');
                return;
            }
            keySet.add(uniqueKey);
        }

        const formatItem = (r) => {
            const desc = String(r.desc_cliente || r.nome_cliente || dados?.descricao || produto || '').trim().toUpperCase();
            const item = {};
            if (r.recno && !isNaN(Number(r.recno))) {
                item.RECNO = Number(r.recno);
            }
            item.Z1_CLIENTE = String(r.cliente || '').trim().toUpperCase();
            item.Z1_LOJA = String(r.loja || '0001').trim().toUpperCase();
            item.Z1_PRODUTO = produto;
            item.Z1_CODCLI = String(r.cod_cliente || '').trim().toUpperCase();
            item.Z1_DESCCLI = desc;
            item.Z1_REVISAO = String(r.revisao || '').trim().toUpperCase();
            return item;
        };

        const insercoes = [];
        const alteracoes = [];

        validos.forEach(r => {
            if (r.isNew || !r.recno) {
                insercoes.push(formatItem(r));
            } else {
                const original = restricoes.find(o => String(o.recno) === String(r.recno)) || {};
                
                // Como agora temos o RECNO como ID absoluto da linha, 
                // qualquer edição (seja chave ou secundária) é enviada como NOPER=4 (Alteração)
                if (String(original.revisao || '').trim().toUpperCase() !== String(r.revisao || '').trim().toUpperCase() || 
                    String(original.cod_cliente || '').trim().toUpperCase() !== String(r.cod_cliente || '').trim().toUpperCase() ||
                    String(original.desc_cliente || '').trim().toUpperCase() !== String(r.desc_cliente || '').trim().toUpperCase() || 
                    String(original.cliente || '').trim().toUpperCase() !== String(r.cliente || '').trim().toUpperCase() || 
                    String(original.loja || '').trim().toUpperCase() !== String(r.loja || '').trim().toUpperCase()) {
                    
                    alteracoes.push(formatItem(r));
                }
            }
        });

        if (insercoes.length === 0 && alteracoes.length === 0) {
            showToast('Nenhuma mudança detectada na tabela SZ1.', 'info');
            setIsEditingRestricoes(false);
            return;
        }

        setSavingRestricoes(true);
        try {
            if (insercoes.length > 0) {
                await updateSincoProdutoCliente({
                    data: { CFILANT: "0101", EMPRESA: "01", NOPER: 3, produtos_clientes: insercoes }
                });
            }
            if (alteracoes.length > 0) {
                await updateSincoProdutoCliente({
                    data: { CFILANT: "0101", EMPRESA: "01", NOPER: 4, produtos_clientes: alteracoes }
                });
            }
            showToast('Produtos x Cliente atualizados com sucesso no Protheus!', 'success');
            const res = await getSincoRestricoes(produto);
            setRestricoes(Array.isArray(res) ? res : []);
            setIsEditingRestricoes(false);
            handleRevalidarArvore(produto, 'sz1');
        } catch (err) {
            console.error('Erro ao salvar Produtos x Cliente SZ1:', err.response?.data || err);
            const resData = err.response?.data;
            if (resData?.isBusinessRule) {
                setModalRegraSz1(resData);
            } else {
                const msg = resData?.details?.message || resData?.message || resData?.details || resData?.error || err.message;
                const strMsg = typeof msg === 'object' ? (Array.isArray(msg) ? msg.join('; ') : JSON.stringify(msg)) : msg;
                showToast('Erro ao salvar Produtos x Cliente: ' + strMsg, 'error');
            }
        } finally {
            setSavingRestricoes(false);
        }
    };

    const materiais = isEditingArvore ? editedArvore : arvore; 
    const listOperacoes = isEditingOperacoes ? editedOperacoes : operacoes;
    const listRestricoes = isEditingRestricoes ? editedRestricoes : restricoes;

    // Revalidação da árvore completa (global ou pontual por nó)
    const handleRevalidarArvore = useCallback(async (changedCodigo = null, changeType = null) => {
        if (!temArquivo) return;
        const codLimpo = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();
        try {
            // Se for uma atualização pontual de uma linha alterada:
            if (typeof changedCodigo === 'string' && changedCodigo.trim()) {
                const targetCode = changedCodigo.trim().toUpperCase();
                // 1. Atualiza o status de validação apenas dessa linha sem mexer no restante da página
                try {
                    const res = await api.post('/sinco/validar-estruturas', { components: [targetCode] });
                    if (res.data && res.data[targetCode]) {
                        setTreeValidationStatus(prev => ({
                            ...prev,
                            [targetCode]: res.data[targetCode]
                        }));
                    }
                } catch (err) {
                    console.warn('Erro ao validar status pontual da linha:', err);
                }

                // 2. Atualiza a hierarquia da árvore em segundo plano APENAS se a alteração foi de materiais (SG1)
                // Para Roteiro (SG2), Clientes (SZ1) e Restrições (SZ0), a árvore hierárquica não muda!
                if (!changeType || changeType === 'materiais') {
                    try {
                        const comp = await getSincoArvoreCompleta(codLimpo);
                        if (Array.isArray(comp)) {
                            setArvoreCompleta(comp);
                        }
                    } catch (err) {
                        console.warn('Erro ao atualizar dados da árvore em background:', err);
                    }
                }
                return;
            }

            // Recarregamento global manual (apenas se clicar no botão "Atualizar" do topo)
            setLoadingArvoreCompleta(true);
            const comp = await getSincoArvoreCompleta(codLimpo);
            if (Array.isArray(comp)) setArvoreCompleta(comp);
        } catch (e) {
            console.error("Erro ao revalidar arvore completa:", e);
        } finally {
            setLoadingArvoreCompleta(false);
        }
    }, [temArquivo, dados.arquivo]);

    // Mapeamento normalizado dos itens da árvore hierárquica (Multinível Completa)
    const rowsArvore = useMemo(() => {
        const rawList = arvoreCompleta && arvoreCompleta.length > 0 ? arvoreCompleta : arvore;
        const list = [];

        // 1. Nó Raiz (Nível 0 - O Produto Pai)
        if (temArquivo) {
            const codPai = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();
            list.push({
                index: 0,
                isRoot: true,
                codigoOriginal: codPai,
                codigoLimpo: codPai,
                descricao: dados.titulo || dados.descricao || 'PRODUTO PRINCIPAL (RAIZ)',
                nivel: 0,
                quantidade: 1,
                unidade: dados.unidade || 'UN',
                tipo: dados.tipo || 'PA',
                pai: null,
                caminho_hierarquico: codPai
            });
        }

        // 2. Nós Filhos (N1, N2, N3, N4...)
        if (Array.isArray(rawList) && rawList.length > 0) {
            rawList.forEach((item, index) => {
                let componenteBruto = item.componente || item.B1_COD || item.Arquivo || item.CaminhoCompleto || item.codigo || '';
                let componenteLimpo = componenteBruto;
                if (componenteLimpo) {
                    componenteLimpo = String(componenteLimpo).trim();
                    const lastDot = componenteLimpo.lastIndexOf('.');
                    if (lastDot > 0 && !componenteLimpo.includes('/') && !componenteLimpo.includes('\\')) {
                        const ext = componenteLimpo.substring(lastDot + 1).toLowerCase();
                        if (['asm', 'par', 'psm', 'dft', 'pwd'].includes(ext)) {
                            componenteLimpo = componenteLimpo.substring(0, lastDot);
                        }
                    }
                    componenteLimpo = componenteLimpo.toUpperCase();
                }

                const nivelNum = item.nivel !== undefined ? Number(item.nivel) : (item.Nivel !== undefined ? Number(item.Nivel) : 1);
                const qtdNum = item.quantidade !== undefined ? Number(item.quantidade) : (item.QUANTIDADE !== undefined ? Number(item.QUANTIDADE) : (item.QtdeTotal !== undefined ? Number(item.QtdeTotal) : 1));
                const descStr = item.descricao || item.B1_DESC || item.Título || item.DescDetal || item.Assunto || '';
                const umStr = item.unidade || item.B1_UM || item.Unidade || item.um || 'UN';
                const tipoStr = item.tipo || item.B1_TIPO || item.TipoArquivo || '';

                list.push({
                    index: index + 1,
                    isRoot: false,
                    codigoOriginal: componenteBruto,
                    codigoLimpo: componenteLimpo || componenteBruto,
                    descricao: descStr,
                    nivel: isNaN(nivelNum) ? 1 : nivelNum,
                    quantidade: isNaN(qtdNum) ? 1 : qtdNum,
                    unidade: umStr,
                    tipo: tipoStr,
                    pai: item.pai || null,
                    caminho_hierarquico: item.caminho_hierarquico || null,
                    trt: item.trt || null
                });
            });
        }

        return list;
    }, [temArquivo, dados, arvore, arvoreCompleta]);

    // Validação automática de todos os níveis da árvore no Protheus
    useEffect(() => {
        if (!rowsArvore || rowsArvore.length === 0) {
            setTreeValidationStatus({});
            return;
        }

        const fetchValidation = async () => {
            const hasExisting = Object.keys(treeValidationStatus).length > 0;
            if (!hasExisting) {
                setLoadingTreeValidation(true);
            }
            try {
                const components = [...new Set(rowsArvore.map(r => r.codigoLimpo).filter(Boolean))];
                if (components.length > 0) {
                    const res = await api.post('/sinco/validar-estruturas', { components });
                    setTreeValidationStatus(prev => ({
                        ...prev,
                        ...(res.data || {})
                    }));
                }
            } catch (err) {
                console.error("Erro ao validar estruturas da árvore:", err);
            } finally {
                setLoadingTreeValidation(false);
            }
        };

        fetchValidation();
    }, [rowsArvore.length, temArquivo, dados.arquivo]);

    const handleOpenNode = (node) => {
        if (treeViewMode === 'accordion') {
            setExpandedNodeAccordion(prev => prev === node.codigoLimpo ? null : node.codigoLimpo);
        } else if (treeViewMode === 'drawer') {
            setActiveDrawerNode(node);
        } else {
            setActiveModalNode(node);
        }
    };

    // Filtragem em tempo real na árvore
    const filteredRowsArvore = useMemo(() => {
        if (!treeFilterText) return rowsArvore;
        const term = treeFilterText.toLowerCase().trim();
        return rowsArvore.filter(r => 
            r.codigoLimpo.toLowerCase().includes(term) ||
            r.codigoOriginal.toLowerCase().includes(term) ||
            r.descricao.toLowerCase().includes(term) ||
            String(r.nivel).includes(term)
        );
    }, [rowsArvore, treeFilterText]);

    // Exportação da árvore para Excel (.xlsx)
    const handleExportArvoreExcel = () => {
        if (!rowsArvore || rowsArvore.length === 0) {
            showToast('Nenhum dado na árvore para exportar', 'error');
            return;
        }

        const exportData = rowsArvore.map(r => {
            const vStatus = treeValidationStatus[r.codigoLimpo] || {};
            return {
                'Nível': r.nivel,
                'Código': r.codigoLimpo,
                'Descrição': r.descricao,
                'Quantidade': r.quantidade,
                'Unidade': r.unidade,
                'BOM (SG1)': vStatus.materiais ? 'Sim' : 'Não',
                'Cliente (SZ1)': vStatus.sz1 ? 'Sim' : 'Não',
                'Roteiro (SG2)': vStatus.roteiro ? 'Sim' : 'Não',
                'Restrições (SZ0)': vStatus.sz0 ? 'Sim' : 'Não'
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!cols'] = [
            { wch: 8 },
            { wch: 24 },
            { wch: 48 },
            { wch: 12 },
            { wch: 8 },
            { wch: 14 },
            { wch: 14 },
            { wch: 14 },
            { wch: 16 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Estrutura_Arvore");
        const codRoot = dados.arquivo.replace(/\.[^/.]+$/, '').trim() || 'Produto';
        XLSX.writeFile(wb, `Estrutura_Arvore_${codRoot}_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('Planilha Excel gerada com sucesso!', 'success');
    };

    // Ação: Abrir PDF de um componente específico da árvore
    const handleAbrirPdfComponente = async (codigoComp) => {
        const codLimpo = String(codigoComp).replace(/\.[^/.]+$/, '').trim().toUpperCase();
        try {
            const docsComp = await getProductDocuments(codLimpo);
            if (Array.isArray(docsComp) && docsComp.length > 0) {
                const pdfDoc = docsComp.find(d => (d.caminho_relativo || d.nome_arquivo || '').toLowerCase().endsWith('.pdf')) || docsComp[0];
                const pdfPath = pdfDoc.caminho_relativo || pdfDoc.url_arquivo;
                if (pdfPath) {
                    window.open(`/api/docs/view?path=${encodeURIComponent(pdfPath)}`, '_blank', 'noopener,noreferrer');
                    return;
                }
            }
            showToast(`Nenhum documento PDF cadastrado para o componente ${codLimpo}`, 'info');
        } catch (e) {
            showToast(`Erro ao buscar documento do componente ${codLimpo}`, 'error');
        }
    };

    // Ação: Carregar qualquer nó da árvore como o produto ativo no formulário
    const handleCarregarNoFormulario = (codigoComp) => {
        const codLimpo = String(codigoComp).replace(/\.[^/.]+$/, '').trim().toUpperCase();
        setBusca(codLimpo);
        buscarProdutoManual(codLimpo);
        setActiveMainTab('formulario');
        showToast(`Componente ${codLimpo} carregado no Formulário Solid Edge!`, 'success');
    };

    const inputCls = "w-full px-2 py-0.5 bg-white border border-amber-300 rounded text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 h-7";
    const readCls = "w-full px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 h-7";
    const lblCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate";
    const boxTitleCls = "text-xs font-bold uppercase tracking-wider px-2.5 py-1 border-b";
    const thCls = "px-2 py-1 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 border-b border-slate-200 z-10 whitespace-nowrap";

    return (
        <div className="w-full flex flex-col space-y-2 p-1.5 sm:p-2 bg-slate-50/50">
            {/* Cabeçalho Compacto e Responsivo */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">SINCO - Solid Edge</h1>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 whitespace-nowrap">
                        v5 UI
                    </span>
                    <span className="text-slate-300 text-xs hidden sm:inline">|</span>
                    <div className="text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-400 font-medium">Arquivo Corrente:</span>
                        {temArquivo && dados.caminho && dados.caminho !== estadoVazio.caminho ? (
                            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                <button
                                    title="Abrir no Solid Edge"
                                    onClick={() => {
                                        fetch('http://localhost:8080/api/solidedge/open-file', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ caminho: dados.caminho })
                                        }).catch(() => showToast('Agente Solid Edge não encontrado.\nInicie o INICIAR_AGENT.bat na sua máquina.', 'error'));
                                    }}
                                    className="font-mono text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0 text-xs font-semibold max-w-[280px] truncate"
                                >
                                    {dados.caminho}
                                </button>
                                <button
                                    title={pdfDocUrl ? "Abrir PDF do Desenho (via Servidor)" : (dados.caminho !== 'Busca via ERP' ? "Abrir PDF do Desenho (Local)" : "PDF não encontrado")}
                                    disabled={!pdfDocUrl && dados.caminho === 'Busca via ERP'}
                                    onClick={() => {
                                        if (pdfDocUrl) {
                                            window.open(`/api/docs/view?path=${encodeURIComponent(pdfDocUrl)}`, '_blank', 'noopener,noreferrer');
                                            return;
                                        }
                                        
                                        // Fallback to local conversion if we have a real local path
                                        if (dados.caminho !== 'Busca via ERP') {
                                            const filePath = dados.caminho;
                                            let pdfPath = filePath;
                                            const lastDotIndex = filePath.lastIndexOf('.');
                                            if (lastDotIndex > 0) {
                                                pdfPath = filePath.substring(0, lastDotIndex) + '.pdf';
                                            } else {
                                                pdfPath = filePath + '.pdf';
                                            }
                                            window.open(`/api/docs/view?path=${encodeURIComponent(pdfPath)}`, '_blank', 'noopener,noreferrer');
                                        }
                                    }}
                                    className={`p-0.5 rounded transition-colors flex items-center justify-center ${
                                        pdfDocUrl || dados.caminho !== 'Busca via ERP' 
                                        ? 'text-red-600 hover:bg-red-50 hover:text-red-700' 
                                        : 'text-gray-300 cursor-not-allowed'
                                    }`}
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <strong className="text-slate-400 font-mono text-xs">{dados.caminho}</strong>
                        )}
                    </div>
                </div>

                {/* Filtro de Busca Manual e Botões de Ação */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        onClick={handleAtualizarDados}
                        title="Emular recarregamento da página (atualiza dados do cabeçalho Protheus e as tabelas sem perder o último ERP e caminho)"
                        className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <div className="relative">
                        <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && buscarProdutoManual(busca)}
                            placeholder="Consultar Produto..."
                            className="w-40 sm:w-48 pl-7 pr-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                    <button
                        onClick={() => buscarProdutoManual(busca)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white shadow-xs border border-blue-700 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer"
                    >
                        Buscar ERP
                    </button>

                    {/* Botão de Documentos / Anexar PDF (Exatamente Idêntico ao Catálogo de Produtos) */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                if (productDocs.length === 0 && !pdfDocUrl) {
                                    setShowDocsModal(true);
                                } else {
                                    setOpenMenuDocs(prev => !prev);
                                }
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shadow-xs border flex items-center gap-1.5 relative whitespace-nowrap cursor-pointer ${
                                productDocs.length > 0 || pdfDocUrl
                                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200 ring-1 ring-red-200'
                                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300 hover:border-slate-400'
                            }`}
                            title={productDocs.length > 0 || pdfDocUrl ? "Opções de Documento / PDF" : "Anexar Arquivo PDF"}
                        >
                            <FileText className={`h-3.5 w-3.5 ${productDocs.length > 0 || pdfDocUrl ? 'text-red-600' : 'text-slate-500'}`} />
                            <span>{productDocs.length > 0 ? `PDF (${productDocs.length})` : 'Anexar PDF'}</span>
                            {(productDocs.length > 0 || pdfDocUrl) && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                </span>
                            )}
                        </button>

                        {/* Dropdown Menu Idêntico ao Catálogo de Produtos */}
                        {openMenuDocs && (
                            <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-md shadow-xl z-50 border border-slate-200 animate-fadeIn py-1">
                                {pdfDocUrl && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            window.open(`/api/docs/view?path=${encodeURIComponent(pdfDocUrl)}`, '_blank', 'noopener,noreferrer');
                                            setOpenMenuDocs(false);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 w-full text-left cursor-pointer"
                                    >
                                        <FileText className="h-4 w-4 text-red-600" />
                                        <span>Abrir Desenho</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowDocsModal(true);
                                        setOpenMenuDocs(false);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 w-full text-left cursor-pointer"
                                >
                                    <FolderInput className="h-4 w-4 text-blue-600" />
                                    <span>Gerenciar Docs</span>
                                </button>
                                <div
                                    className="fixed inset-0 z-[-1]"
                                    onClick={() => setOpenMenuDocs(false)}
                                />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => handleAbrirCadastroNovo()}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-700 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer"
                        title="Cadastrar Novo Produto no Protheus (SB1010/SB5010/SZ1010)"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Cadastrar no Protheus</span>
                    </button>

                    {maximizedPanel && (
                        <button
                            onClick={() => setMaximizedPanel(null)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white shadow-xs text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer"
                            title="Restaurar layout normal com todos os painéis"
                        >
                            <Minimize2 className="h-3.5 w-3.5" />
                            <span>Restaurar Painéis</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Erro de comunicação com Protheus */}
            {erroProtheus && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 flex items-start gap-2">
                    <span className="font-semibold whitespace-nowrap">Erro Protheus:</span>
                    <span className="font-mono break-all">{erroProtheus}</span>
                </div>
            )}

            {/* Banner: produto existe no ERP mas não está no espelho PostgreSQL */}
            {produtoNaoNoMirror && !erroProtheus && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                        <div>
                            <span className="font-semibold">Produto não encontrado no espelho local (PostgreSQL).</span>
                            <span className="ml-1 text-amber-700">
                                O produto <strong>{dados.arquivo}</strong> pode existir no Protheus mas não foi sincronizado com o mirror.
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => handleAbrirCadastroNovo()}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                        <span>Cadastrar no Protheus (TOTVS)</span>
                    </button>
                </div>
            )}

            {/* Seletor de Abas Principais (Opção A: Página Inteira) */}
            <div className="flex items-center justify-between gap-3 bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setActiveMainTab('formulario')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            activeMainTab === 'formulario'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <FileText size={14} />
                        <span>Formulário Solid Edge</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveMainTab('arvore')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            activeMainTab === 'arvore'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <Network size={14} />
                        <span>Estrutura em Árvore Completa</span>
                        {rowsArvore.length > 0 && (
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full border ${
                                activeMainTab === 'arvore'
                                    ? 'bg-white/20 text-white border-white/30'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}>
                                {rowsArvore.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="hidden md:inline font-medium text-[11px]">
                        {activeMainTab === 'formulario' 
                            ? 'Visão clássica de cadastro e sub-tabelas' 
                            : 'Navegação hierárquica multinível com ações em qualquer nó'}
                    </span>
                    <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-700">
                        {dados.arquivo.replace(/\.[^/.]+$/, '')}
                    </span>
                </div>
            </div>

            {/* ABA 1: FORMULÁRIO SOLID EDGE */}
            {activeMainTab === 'formulario' && (
                <>
            {/* Layout do Formulário Principal - Limpo, Ultra-Compacto e Responsivo */}
            <div className={`bg-white rounded-lg border flex flex-col shadow-xs overflow-hidden ${isEditingDadosGerais ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200'}`}>
                <div className={`${boxTitleCls} ${isEditingDadosGerais ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'} flex justify-between items-center py-1 px-3`}>
                    <div className="flex items-center gap-2">
                        <span>Dados Gerais do Produto</span>
                        <span className="text-[10px] font-normal text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            Modo Solid Edge / Formulário
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {temArquivo && !isEditingDadosGerais && (
                            <button
                                onClick={() => setIsEditingDadosGerais(true)}
                                className="flex items-center gap-1 px-2 py-0.5 text-slate-600 hover:text-amber-700 hover:bg-amber-100 rounded text-[10px] uppercase font-bold tracking-wide transition-colors"
                            >
                                <Pencil className="h-3 w-3" /> Editar
                            </button>
                        )}
                        {isEditingDadosGerais && (
                            <>
                                <button
                                    onClick={() => setIsEditingDadosGerais(false)}
                                    disabled={loadingData}
                                    className="flex items-center gap-1 px-2 py-0.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded text-[10px] uppercase font-bold tracking-wide transition-colors disabled:opacity-50"
                                >
                                    <X className="h-3 w-3" /> Cancelar
                                </button>
                                <button
                                    onClick={handleSalvarProduto}
                                    disabled={loadingData}
                                    className="flex items-center gap-1 px-3 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] uppercase font-bold tracking-wide transition-colors shadow-xs disabled:bg-slate-300 disabled:text-slate-500"
                                >
                                    <Save className="h-3 w-3" /> {loadingData ? 'Salvando...' : 'Salvar'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="p-2">
                    <div className="grid grid-cols-12 gap-x-2 gap-y-1 text-xs">
                        {/* Linha 1: 12 colunas */}
                        <div className="col-span-2 sm:col-span-1">
                            <label className={lblCls}>Tipo</label>
                            <input type="text" value={dados.tipo} onChange={e => setDados(p => ({ ...p, tipo: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className={lblCls}>Unidade</label>
                            <input type="text" value={dados.unidade} onChange={e => setDados(p => ({ ...p, unidade: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                            <label className={lblCls}>Grupo</label>
                            <input type="text" value={dados.grupo} onChange={e => setDados(p => ({ ...p, grupo: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                            <label className={lblCls}>Num. Documento</label>
                            <input type="text" value={dados.arquivo} readOnly className={readCls} />
                        </div>
                        <div className="col-span-1 sm:col-span-1">
                            <label className={lblCls} title="Rev. Metalfisa">Rev</label>
                            <input type="text" value={dados.rev} onChange={e => setDados(p => ({ ...p, rev: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-12 sm:col-span-5">
                            <label className={lblCls}>Título</label>
                            <input type="text" value={dados.titulo} onChange={e => setDados(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: PORCA SEXT A6 INOX" readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>

                        {/* Linha 2: 12 colunas */}
                        <div className="col-span-6 sm:col-span-2">
                            <label className={lblCls} title="Densidade / Material">Densid. / Material</label>
                            {isEditingDadosGerais ? (
                                <select 
                                    className={inputCls}
                                    value={dados.densidade || ''}
                                    onChange={async e => {
                                        if (e.target.value === 'ADD_NEW') {
                                            const desc = window.prompt("Nome do novo material (ex: Cobre):");
                                            if (!desc) return;
                                            const dens = window.prompt(`Densidade para ${desc} (ex: 8.96):`);
                                            if (!dens) return;
                                            const val = dens.replace(',', '.');
                                            
                                            try {
                                                await api.post('/sinco/materiais-apoio', { nome: desc, densidade: val });
                                                const newMat = { nome: desc, densidade: val };
                                                setMateriaisSalvos(prev => [...prev.filter(m => m.nome !== desc), newMat].sort((a,b) => a.nome.localeCompare(b.nome)));
                                                setDados(p => ({ ...p, densidade: val }));
                                            } catch (err) {
                                                console.error(err);
                                                alert('Erro ao salvar no banco. Verifique sua conexão.');
                                            }
                                        } else if (e.target.value === 'EDIT_MAT') {
                                            const lista = materiaisSalvos.map((m, i) => `${i + 1}. ${m.nome} (${m.densidade})`).join('\n');
                                            const idx = window.prompt(`Qual material deseja editar?\n\n${lista}\n\nDigite o número:`);
                                            if (!idx) return;
                                            const i = parseInt(idx) - 1;
                                            if (i < 0 || i >= materiaisSalvos.length) { alert('Número inválido.'); return; }
                                            
                                            const matOriginal = materiaisSalvos[i];
                                            const novoNome = window.prompt("Novo nome:", matOriginal.nome);
                                            if (!novoNome) return;
                                            const novaDens = window.prompt("Nova densidade:", String(matOriginal.densidade));
                                            if (!novaDens) return;
                                            const valDens = novaDens.replace(',', '.');
                                            
                                            try {
                                                await api.put('/sinco/materiais-apoio', { nomeOriginal: matOriginal.nome, nome: novoNome, densidade: valDens });
                                                setMateriaisSalvos(prev => 
                                                    prev.map(m => m.nome === matOriginal.nome ? { nome: novoNome, densidade: valDens } : m)
                                                       .sort((a,b) => a.nome.localeCompare(b.nome))
                                                );
                                                if (String(dados.densidade) === String(matOriginal.densidade)) {
                                                    setDados(p => ({ ...p, densidade: valDens }));
                                                }
                                                alert(`Material "${novoNome}" atualizado com sucesso!`);
                                            } catch (err) {
                                                console.error(err);
                                                alert('Erro ao atualizar material.');
                                            }
                                        } else if (e.target.value === 'DELETE_MAT') {
                                            const lista = materiaisSalvos.map((m, i) => `${i + 1}. ${m.nome} (${m.densidade})`).join('\n');
                                            const idx = window.prompt(`Qual material deseja EXCLUIR?\n\n${lista}\n\nDigite o número:`);
                                            if (!idx) return;
                                            const i = parseInt(idx) - 1;
                                            if (i < 0 || i >= materiaisSalvos.length) { alert('Número inválido.'); return; }
                                            
                                            const mat = materiaisSalvos[i];
                                            if (!window.confirm(`Tem certeza que deseja excluir "${mat.nome}" (${mat.densidade})?`)) return;
                                            
                                            try {
                                                await api.delete('/sinco/materiais-apoio', { data: { nome: mat.nome } });
                                                setMateriaisSalvos(prev => prev.filter(m => m.nome !== mat.nome));
                                                alert(`Material "${mat.nome}" excluído com sucesso!`);
                                            } catch (err) {
                                                console.error(err);
                                                alert('Erro ao excluir material.');
                                            }
                                        } else if (e.target.value === 'MANUAL') {
                                            const val = window.prompt("Digite o valor da densidade (ex: 7.85):", dados.densidade || '');
                                            if (val) {
                                                setDados(p => ({ ...p, densidade: val.replace(',', '.') }));
                                            }
                                        } else {
                                            setDados(p => ({ ...p, densidade: e.target.value }));
                                        }
                                    }}
                                >
                                    <option value="">-- Selecionar --</option>
                                    {dados.densidade && !materiaisSalvos.some(m => Number(m.densidade) === Number(dados.densidade)) && (
                                        <option value={dados.densidade}>{dados.densidade} (Manual)</option>
                                    )}
                                    {materiaisSalvos.map(m => (
                                        <option key={m.nome} value={m.densidade}>{m.nome} ({Number(m.densidade).toFixed(2)})</option>
                                    ))}
                                    <option disabled>───────────────</option>
                                    <option value="MANUAL">+ Digitar Manualmente...</option>
                                    <option value="ADD_NEW">+ Cadastrar Novo Material...</option>
                                    <option value="EDIT_MAT">✏️ Editar Material...</option>
                                    <option value="DELETE_MAT">🗑️ Excluir Material...</option>
                                </select>
                            ) : (
                                <input type="text" value={dados.densidade} readOnly className={readCls} />
                            )}
                        </div>
                        <div className="col-span-3 sm:col-span-1">
                            <label className={lblCls}>Espess. (mm)</label>
                            <input type="text" value={dados.espessura || '0'} onChange={e => setDados(p => ({ ...p, espessura: e.target.value.replace(',', '.') }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-3 sm:col-span-1">
                            <label className={lblCls}>Larg. (mm)</label>
                            <input type="text" value={dados.largura || '0'} onChange={e => setDados(p => ({ ...p, largura: e.target.value.replace(',', '.') }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-3 sm:col-span-1">
                            <label className={lblCls}>Compr. (mm)</label>
                            <input type="text" value={dados.comprimento || '0'} onChange={e => setDados(p => ({ ...p, comprimento: e.target.value.replace(',', '.') }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-3 sm:col-span-1">
                            <label className={lblCls}>Área (m²)</label>
                            <input type="text" value={dados.area || '0'} onChange={e => setDados(p => ({ ...p, area: e.target.value.replace(',', '.') }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-6 sm:col-span-1">
                            <label className={lblCls}>Peso (kg)</label>
                            <input type="text" value={dados.peso || '0'} onChange={e => setDados(p => ({ ...p, peso: e.target.value.replace(',', '.') }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-12 sm:col-span-5">
                            <label className={lblCls}>Comentários - Acabamento</label>
                            <input type="text" value={dados.acabamento} onChange={e => setDados(p => ({ ...p, acabamento: e.target.value }))} placeholder="Ex: CINZA N6,5 TEXTURIZADO - 80 MICRAS" readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-tabelas: Árvore do Produto + Restrições SZ1 + Operações */}
            {maximizedPanel !== 'sz0' && (
                <div className={`grid gap-2 flex-1 pb-1 ${
                    maximizedPanel 
                        ? 'grid-cols-1' 
                        : 'grid-cols-1 lg:grid-cols-3'
                }`}>
                    {/* 1. Árvore */}
                    {(!maximizedPanel || maximizedPanel === 'arvore') && (
                        <div className={`bg-white rounded-lg border flex flex-col shadow-2xs overflow-hidden ${
                            maximizedPanel === 'arvore' ? 'h-[calc(100vh-210px)] min-h-[460px]' : 'h-[255px] sm:h-[280px] xl:h-[310px] 2xl:h-[360px]'
                        } ${isEditingArvore ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-slate-200'}`}>
                            <div className={`${boxTitleCls} ${isEditingArvore ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'} flex justify-between items-center`}>
                                <div className="flex items-center gap-1.5">
                                    <span>Árvore do Produto (Materiais)</span>
                                    {materiais.length > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">{materiais.length}</span>}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {temArquivo && !isEditingArvore && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditedArvore(JSON.parse(JSON.stringify(arvore)));
                                                    setIsEditingArvore(true);
                                                }}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium rounded transition-colors shadow-2xs cursor-pointer"
                                                title="Editar componentes existentes"
                                            >
                                                <Pencil className="h-3 w-3" /> Editar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditedArvore([...JSON.parse(JSON.stringify(arvore)), {
                                                        nivel: 'NOVO',
                                                        componente: '',
                                                        descricao: '',
                                                        quantidade: 1,
                                                        unidade: 'UN',
                                                        isNew: true,
                                                        deleted: false
                                                    }]);
                                                    setIsEditingArvore(true);
                                                }}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-medium rounded transition-colors shadow-2xs cursor-pointer"
                                                title="Inserir novo componente na estrutura"
                                            >
                                                <Plus className="h-3 w-3" /> Inserir Novo
                                            </button>
                                        </div>
                                    )}
                                    {isEditingArvore && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setEditedArvore(JSON.parse(JSON.stringify(arvore)));
                                                    setIsEditingArvore(false);
                                                }}
                                                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-medium rounded transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleSalvarArvore}
                                                disabled={savingArvore}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white text-[10px] font-medium rounded transition-colors shadow-2xs"
                                            >
                                                <Save className="h-3 w-3" /> {savingArvore ? 'Salvando...' : 'Salvar'}
                                            </button>
                                        </>
                                    )}
                                    <span className={`text-[10px] bg-white px-2 py-0.5 rounded border ${isEditingArvore ? 'border-indigo-200 text-indigo-600' : 'border-emerald-200 text-emerald-600'} font-mono`}>{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
                                    <button
                                        onClick={() => setMaximizedPanel(maximizedPanel === 'arvore' ? null : 'arvore')}
                                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded transition-colors cursor-pointer"
                                        title={maximizedPanel === 'arvore' ? "Restaurar layout padrão" : "Maximizar Árvore"}
                                    >
                                        {maximizedPanel === 'arvore' ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                            </div>
                    <div className="flex-1 overflow-auto bg-slate-50/50">
                        {loadingArvore ? (
                            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Carregando componentes...</div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <table className="w-full text-left text-xs bg-white">
                                    <thead>
                                        <tr>
                                            <th className={thCls}>Nív.</th>
                                            <th className={thCls}>Código</th>
                                            <th className={thCls}>Descrição</th>
                                            <th className={thCls + " text-right"}>Qtde</th>
                                            <th className={thCls}>UN</th>
                                            {isEditingArvore && <th className={thCls}></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {materiais.length === 0 ? (
                                            <tr>
                                                <td colSpan={isEditingArvore ? 6 : 5} className="text-center py-8 text-slate-400">
                                                    <p className="italic text-xs mb-3 text-slate-500 font-medium">Nenhum material carregado para a estrutura</p>
                                                    {temArquivo && !isEditingArvore && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditedArvore([...JSON.parse(JSON.stringify(arvore)), {
                                                                    nivel: 'NOVO',
                                                                    componente: '',
                                                                    descricao: '',
                                                                    quantidade: 1,
                                                                    unidade: 'UN',
                                                                    isNew: true,
                                                                    deleted: false
                                                                }]);
                                                                setIsEditingArvore(true);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-md text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" /> Inserir Novo Componente
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ) : materiais.map((r, i) => (
                                            <tr key={i} className={`transition-colors ${r.deleted ? 'bg-red-50/50 opacity-50' : 'hover:bg-emerald-50/30'}`}>
                                                <td className="px-2 py-1 text-slate-400 font-medium">{r.nivel || (r.isNew ? 'NOVO' : '—')}</td>
                                                <td className="px-2 py-1 font-mono font-medium text-slate-700">
                                                    {r.isNew ? (
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                type="text" 
                                                                value={r.componente || ''} 
                                                                onChange={(e) => {
                                                                    const newArr = [...editedArvore];
                                                                    newArr[i].componente = e.target.value.toUpperCase();
                                                                    setEditedArvore(newArr);
                                                                }}
                                                                onBlur={async (e) => {
                                                                    // Se o modal de busca for abrir, podemos ignorar (onMouseDown previne o blur)
                                                                    const codigo = e.target.value.trim().toUpperCase();
                                                                    if (codigo) {
                                                                        try {
                                                                            const prod = await getSincoProduto(codigo);
                                                                            if (prod && prod.codigo) {
                                                                                const newArr = [...editedArvore];
                                                                                newArr[i].descricao = prod.titulo || '';
                                                                                newArr[i].unidade = prod.unidade || 'UN';
                                                                                setEditedArvore(newArr);
                                                                            } else {
                                                                                throw new Error('Not found');
                                                                            }
                                                                        } catch (err) {
                                                                            showToast(`Componente ${codigo} não encontrado no Protheus.`, 'warning');
                                                                            const newArr = [...editedArvore];
                                                                            newArr[i].componente = '';
                                                                            newArr[i].descricao = '';
                                                                            setEditedArvore(newArr);
                                                                        }
                                                                    }
                                                                }}
                                                                placeholder="Código..."
                                                                className="w-full px-1 py-0.5 border border-indigo-200 rounded text-xs font-mono uppercase"
                                                            />
                                                            <button
                                                                type="button"
                                                                onMouseDown={(e) => e.preventDefault()} // Impede que o input perca o foco antes do clique
                                                                onClick={() => {
                                                                    setActiveRowIndex(i);
                                                                    setSearchQuery('');
                                                                    setSearchResults([]);
                                                                    setShowSearchModal(true);
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                                title="Buscar no Protheus"
                                                            >
                                                                <Search className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className={r.deleted ? 'line-through text-red-500' : ''}>{r.componente}</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1 text-slate-600 max-w-[200px] truncate" title={r.descricao}>
                                                    {r.isNew ? <span className="text-indigo-600 font-medium italic">{r.descricao || 'Produto a ser validado pelo Protheus'}</span> : <span className={r.deleted ? 'line-through text-red-500' : ''}>{r.descricao || '—'}</span>}
                                                </td>
                                                <td className="px-2 py-1 text-right">
                                                    {isEditingArvore ? (
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            step="0.0001"
                                                            value={r.quantidade !== undefined ? r.quantidade : ''} 
                                                            disabled={r.deleted}
                                                            onChange={(e) => {
                                                                const newArr = [...editedArvore];
                                                                newArr[i].quantidade = e.target.value;
                                                                setEditedArvore(newArr);
                                                            }}
                                                            className="w-20 px-1 py-0.5 border border-indigo-200 rounded text-right text-xs font-mono disabled:opacity-50"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-700 font-mono tabular-nums">{Number(r.quantidade).toFixed(4)}</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1 text-slate-500">{r.unidade || '—'}</td>
                                                {isEditingArvore && (
                                                    <td className="px-2 py-1 text-right">
                                                        <button
                                                            onClick={() => {
                                                                const newArr = [...editedArvore];
                                                                if (r.isNew) {
                                                                    newArr.splice(i, 1);
                                                                } else {
                                                                    newArr[i] = { ...newArr[i], deleted: !newArr[i].deleted };
                                                                }
                                                                setEditedArvore(newArr);
                                                            }}
                                                            className={`p-1 transition-colors rounded ${r.deleted ? 'bg-slate-200 text-slate-600' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                                            title={r.deleted ? "Restaurar" : "Excluir da Estrutura"}
                                                        >
                                                            {r.deleted ? <RefreshCw className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {isEditingArvore && (
                                    <div className="p-2 border-t border-indigo-100 bg-indigo-50/30">
                                        <button
                                            onClick={() => {
                                                setEditedArvore([...editedArvore, {
                                                    nivel: 'NOVO',
                                                    componente: '',
                                                    descricao: '',
                                                    quantidade: 1,
                                                    unidade: 'UN',
                                                    isNew: true,
                                                    deleted: false
                                                }]);
                                            }}
                                            className="w-full py-1.5 flex items-center justify-center gap-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100/50 border border-indigo-200 border-dashed rounded-md transition-colors"
                                        >
                                            <Plus className="h-3.5 w-3.5" /> Adicionar Componente
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 2. Restrições */}
            {(!maximizedPanel || maximizedPanel === 'restricoes') && (
                <div className={`bg-white rounded-lg border flex flex-col shadow-2xs overflow-hidden ${
                    maximizedPanel === 'restricoes' ? 'h-[calc(100vh-210px)] min-h-[460px]' : 'h-[255px] sm:h-[280px] xl:h-[310px] 2xl:h-[360px]'
                } ${isEditingRestricoes ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200'}`}>
                    <div className={`${boxTitleCls} ${isEditingRestricoes ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-amber-50 text-amber-700 border-amber-100'} flex justify-between items-center`}>
                        <div className="flex items-center gap-1.5">
                            <span>Produto Metalfisa/Cliente (SZ1)</span>
                            {listRestricoes.length > 0 && <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">{listRestricoes.length}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                            {temArquivo && !isEditingRestricoes && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setEditedRestricoes(JSON.parse(JSON.stringify(restricoes)));
                                            setIsEditingRestricoes(true);
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-medium rounded transition-colors shadow-2xs cursor-pointer"
                                        title="Editar amarrações existentes"
                                    >
                                        <Pencil className="h-3 w-3" /> Editar
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditedRestricoes([...JSON.parse(JSON.stringify(restricoes)), {
                                                cliente: '',
                                                loja: '0001',
                                                nome_cliente: '',
                                                desc_cliente: '',
                                                cod_cliente: '',
                                                revisao: '00',
                                                isNew: true,
                                                deleted: false
                                            }]);
                                            setIsEditingRestricoes(true);
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-amber-700 hover:bg-amber-800 text-white text-[10px] font-medium rounded transition-colors shadow-2xs cursor-pointer"
                                        title="Inserir novo cliente/amarração SZ1"
                                    >
                                        <Plus className="h-3 w-3" /> Inserir Novo
                                    </button>
                                </div>
                            )}
                            {isEditingRestricoes && (
                                <>
                                    <button
                                        onClick={() => {
                                            setEditedRestricoes(JSON.parse(JSON.stringify(restricoes)));
                                            setIsEditingRestricoes(false);
                                        }}
                                        className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-medium rounded transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSalvarRestricoesSz1}
                                        disabled={savingRestricoes}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white text-[10px] font-medium rounded transition-colors shadow-2xs"
                                    >
                                        <Save className="h-3 w-3" /> {savingRestricoes ? 'Salvando...' : 'Salvar'}
                                    </button>
                                </>
                            )}
                            <span className={`text-[10px] bg-white px-2 py-0.5 rounded border ${isEditingRestricoes ? 'border-amber-300 text-amber-700' : 'border-amber-200 text-amber-600'} font-mono`}>{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
                            <button
                                onClick={() => setMaximizedPanel(maximizedPanel === 'restricoes' ? null : 'restricoes')}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded transition-colors cursor-pointer"
                                title={maximizedPanel === 'restricoes' ? "Restaurar layout padrão" : "Maximizar SZ1"}
                            >
                                {maximizedPanel === 'restricoes' ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto bg-slate-50/50">
                        {loadingRest ? (
                            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Carregando restrições...</div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <table className="w-full text-left text-xs bg-white">
                                <thead>
                                    <tr>
                                        <th className={thCls}>Cliente</th>
                                        <th className={thCls}>Nome</th>
                                        <th className={thCls}>Cód CL.</th>
                                        <th className={thCls}>Rev</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {listRestricoes.length === 0 ? (
                                        <tr>
                                            <td colSpan={isEditingRestricoes ? 5 : 4} className="text-center py-8 text-slate-400">
                                                <p className="italic text-xs mb-3 text-slate-500 font-medium">Nenhuma restrição encontrada no Protheus</p>
                                                {temArquivo && !isEditingRestricoes && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditedRestricoes([...JSON.parse(JSON.stringify(restricoes)), {
                                                                cliente: '',
                                                                loja: '0001',
                                                                nome_cliente: '',
                                                                desc_cliente: '',
                                                                cod_cliente: '',
                                                                revisao: '00',
                                                                isNew: true,
                                                                deleted: false
                                                            }]);
                                                            setIsEditingRestricoes(true);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-md text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Inserir Novo Vínculo de Cliente
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ) : listRestricoes.map((r, i) => (
                                        <tr key={i} className={`transition-colors ${r.deleted ? 'bg-red-50/50 opacity-50' : 'hover:bg-amber-50/30'}`}>
                                            <td className="px-2 py-1 font-mono font-medium text-slate-700 w-24">
                                                {isEditingRestricoes ? (
                                                    <div className="flex items-center gap-1">
                                                        <input 
                                                            type="text" 
                                                            value={r.cliente || ''} 
                                                            onChange={async (e) => {
                                                                const val = e.target.value.replace(/\D/g, '').padStart(6, '0');
                                                                const newArr = [...editedRestricoes];
                                                                newArr[i].cliente = val;
                                                                setEditedRestricoes(newArr);
                                                            }}
                                                            disabled={r.deleted}
                                                            className="w-full px-1 py-0.5 border border-amber-200 rounded text-xs font-mono disabled:opacity-50"
                                                            placeholder="Cód Clie"
                                                        />
                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => {
                                                                setActiveClienteRowIndex(i);
                                                                setSearchClienteQuery('');
                                                                setSearchClienteResults([]);
                                                                setShowSearchClienteModal(true);
                                                                
                                                                setSearchingCliente(true);
                                                                getClientes('')
                                                                    .then(res => setSearchClienteResults(res || []))
                                                                    .catch(err => console.error(err))
                                                                    .finally(() => setSearchingCliente(false));
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                                            title="Buscar Cliente no Protheus"
                                                        >
                                                            <Search className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className={r.deleted ? 'line-through text-red-500' : ''}>{r.cliente}</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-1 text-slate-600 max-w-[150px] truncate" title={r.desc_cliente || r.nome_cliente}>
                                                {isEditingRestricoes ? (
                                                    <input 
                                                        type="text" 
                                                        value={r.desc_cliente || r.nome_cliente || ''} 
                                                        onChange={(e) => {
                                                            const newArr = [...editedRestricoes];
                                                            newArr[i].desc_cliente = e.target.value.toUpperCase();
                                                            setEditedRestricoes(newArr);
                                                        }}
                                                        disabled={r.deleted}
                                                        className="w-full px-1 py-0.5 border border-amber-200 rounded text-xs uppercase disabled:opacity-50"
                                                        placeholder="Descrição do Cliente"
                                                    />
                                                ) : (
                                                    <span className={r.deleted ? 'line-through text-red-500' : ''}>{r.desc_cliente || r.nome_cliente}</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-1 font-mono text-slate-500">
                                                {isEditingRestricoes ? (
                                                    <input 
                                                        type="text" 
                                                        value={r.cod_cliente || ''} 
                                                        onChange={(e) => {
                                                            const newArr = [...editedRestricoes];
                                                            newArr[i].cod_cliente = e.target.value.toUpperCase();
                                                            setEditedRestricoes(newArr);
                                                        }}
                                                        disabled={r.deleted}
                                                        className="w-full px-1 py-0.5 border border-amber-200 rounded text-xs uppercase disabled:opacity-50"
                                                        placeholder="Ref. Cód Cliente"
                                                    />
                                                ) : (
                                                    <span className={r.deleted ? 'line-through text-red-500' : ''}>{r.cod_cliente || '—'}</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-1 font-semibold text-amber-700 bg-amber-50/50 text-center w-16">
                                                {isEditingRestricoes ? (
                                                    <input 
                                                        type="text" 
                                                        maxLength={2}
                                                        value={r.revisao || ''} 
                                                        onChange={(e) => {
                                                            const newArr = [...editedRestricoes];
                                                            newArr[i].revisao = e.target.value.toUpperCase();
                                                            setEditedRestricoes(newArr);
                                                        }}
                                                        disabled={r.deleted}
                                                        className="w-full px-1 py-0.5 border border-amber-200 rounded text-center text-xs font-mono disabled:opacity-50"
                                                        placeholder="Rev"
                                                    />
                                                ) : (
                                                    <span className={r.deleted ? 'line-through text-red-500' : ''}>{r.revisao}</span>
                                                )}
                                            </td>
                                            {isEditingRestricoes && (
                                                <td className="px-2 py-1 text-right">
                                                    <button
                                                        onClick={() => {
                                                            let newArr = [...editedRestricoes];
                                                            if (r.isNew) {
                                                                newArr.splice(i, 1);
                                                            } else {
                                                                newArr[i] = { ...newArr[i], deleted: !newArr[i].deleted };
                                                            }
                                                            setEditedRestricoes(newArr);
                                                        }}
                                                        className={`p-1 transition-colors rounded ${r.deleted ? 'bg-slate-200 text-slate-600' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                                        title={r.deleted ? "Restaurar" : "Excluir SZ1"}
                                                    >
                                                        {r.deleted ? <RefreshCw className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {isEditingRestricoes && (
                                <div className="p-2 border-t border-amber-100 bg-amber-50/30">
                                    <button
                                        onClick={() => {
                                            const newArr = [...editedRestricoes, {
                                                cliente: '',
                                                loja: '0001',
                                                nome_cliente: '',
                                                desc_cliente: '',
                                                cod_cliente: '',
                                                revisao: '',
                                                isNew: true,
                                                deleted: false
                                            }];
                                            setEditedRestricoes(newArr);
                                        }}
                                        className="w-full py-1.5 flex items-center justify-center gap-1 text-xs font-medium text-amber-600 hover:bg-amber-100/50 border border-amber-200 border-dashed rounded-md transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Adicionar Cliente
                                    </button>
                                </div>
                            )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3. Operações */}
            {(!maximizedPanel || maximizedPanel === 'operacoes') && (
                <div className={`bg-white rounded-lg border flex flex-col shadow-2xs overflow-hidden ${
                    maximizedPanel === 'operacoes' ? 'h-[calc(100vh-210px)] min-h-[460px]' : 'h-[255px] sm:h-[280px] xl:h-[310px] 2xl:h-[360px]'
                } ${isEditingOperacoes ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-200'}`}>
                    <div className={`${boxTitleCls} ${isEditingOperacoes ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-blue-50 text-blue-700 border-blue-100'} flex justify-between items-center`}>
                        <div className="flex items-center gap-1.5">
                            <span>Operações (Roteiro)</span>
                            {listOperacoes.length > 0 && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-bold">{listOperacoes.length}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                            {temArquivo && !isEditingOperacoes && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setEditedOperacoes(JSON.parse(JSON.stringify(operacoes)));
                                            setIsEditingOperacoes(true);
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium rounded transition-colors shadow-2xs cursor-pointer"
                                        title="Editar operações existentes"
                                    >
                                        <Pencil className="h-3 w-3" /> Editar
                                    </button>
                                    <button
                                        onClick={() => {
                                            const nextOpNum = operacoes.length > 0 ? (operacoes.length + 1) * 10 : 10;
                                            setEditedOperacoes([...JSON.parse(JSON.stringify(operacoes)), {
                                                operacao: String(nextOpNum),
                                                descricao: '',
                                                recurso: '',
                                                recurso_descricao: '',
                                                setup: 0,
                                                tempo: 1,
                                                isNew: true,
                                                deleted: false
                                            }]);
                                            setIsEditingOperacoes(true);
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-blue-700 hover:bg-blue-800 text-white text-[10px] font-medium rounded transition-colors shadow-2xs cursor-pointer"
                                        title="Inserir nova operação no roteiro"
                                    >
                                        <Plus className="h-3 w-3" /> Inserir Novo
                                    </button>
                                </div>
                            )}
                            {isEditingOperacoes && (
                                <>
                                    <button
                                        onClick={() => {
                                            setEditedOperacoes(JSON.parse(JSON.stringify(operacoes)));
                                            setIsEditingOperacoes(false);
                                        }}
                                        className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-medium rounded transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSalvarOperacoes}
                                        disabled={savingOperacoes}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-[10px] font-medium rounded transition-colors shadow-2xs"
                                    >
                                        <Save className="h-3 w-3" /> {savingOperacoes ? 'Salvando...' : 'Salvar'}
                                    </button>
                                </>
                            )}
                            <span className={`text-[10px] bg-white px-2 py-0.5 rounded border ${isEditingOperacoes ? 'border-blue-300 text-blue-700' : 'border-blue-200 text-blue-600'} font-mono`}>{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
                            <button
                                onClick={() => setMaximizedPanel(maximizedPanel === 'operacoes' ? null : 'operacoes')}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded transition-colors cursor-pointer"
                                title={maximizedPanel === 'operacoes' ? "Restaurar layout padrão" : "Maximizar Operações"}
                            >
                                {maximizedPanel === 'operacoes' ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto bg-slate-50/50">
                        {loadingOpe ? (
                            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Carregando operações...</div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <table className="w-full text-left text-xs bg-white">
                                    <thead>
                                        <tr>
                                            <th className={thCls}>Operação</th>
                                            <th className={thCls}>Descrição</th>
                                            <th className={thCls}>Recurso</th>
                                            <th className={thCls + " text-right"}>Setup (min)</th>
                                            <th className={thCls + " text-right"}>Tempo Padrão</th>
                                            {isEditingOperacoes && <th className={thCls}></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {listOperacoes.length === 0 ? (
                                            <tr>
                                                <td colSpan={isEditingOperacoes ? 6 : 5} className="text-center py-8 text-slate-400">
                                                    <p className="italic text-xs mb-3 text-slate-500 font-medium">Nenhuma operação encontrada no Protheus</p>
                                                    {temArquivo && !isEditingOperacoes && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditedOperacoes([...JSON.parse(JSON.stringify(operacoes)), {
                                                                    operacao: '10',
                                                                    descricao: '',
                                                                    recurso: '',
                                                                    recurso_descricao: '',
                                                                    setup: 0,
                                                                    tempo: 1,
                                                                    isNew: true,
                                                                    deleted: false
                                                                }]);
                                                                setIsEditingOperacoes(true);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" /> Inserir Nova Operação
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ) : listOperacoes.map((r, i) => (
                                            <tr key={i} className={`transition-colors ${r.deleted ? 'bg-red-50/50 opacity-50' : 'hover:bg-blue-50/30'}`}>
                                                <td className="px-2 py-1 font-mono font-medium text-slate-700 w-16">
                                                    {isEditingOperacoes ? (
                                                        <input 
                                                            type="text" 
                                                            value={r.operacao || ''} 
                                                            onChange={(e) => {
                                                                const newArr = [...editedOperacoes];
                                                                newArr[i] = { ...newArr[i], operacao: e.target.value.replace(/\D/g, '') };
                                                                setEditedOperacoes(newArr);
                                                            }}
                                                            onBlur={() => {
                                                                setEditedOperacoes(applyReindexOperacoes(editedOperacoes));
                                                            }}
                                                            disabled={r.deleted}
                                                            className="w-full px-1 py-0.5 border border-blue-200 rounded text-xs font-mono disabled:opacity-50"
                                                            placeholder="Ex: 010"
                                                        />
                                                    ) : (
                                                        <span className={r.deleted ? 'line-through text-red-500' : ''}>{r.operacao}</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1 text-slate-600 max-w-[150px] truncate" title={r.descricao || r.recurso_descricao}>
                                                    {isEditingOperacoes ? (
                                                        <input 
                                                            type="text" 
                                                            value={r.descricao || r.recurso_descricao || ''} 
                                                            onChange={(e) => {
                                                                const newArr = [...editedOperacoes];
                                                                newArr[i].descricao = e.target.value.toUpperCase();
                                                                // Desassocia recurso_descricao pra forçar uso da descrição manual
                                                                newArr[i].recurso_descricao = ''; 
                                                                setEditedOperacoes(newArr);
                                                            }}
                                                            disabled={r.deleted}
                                                            className="w-full px-1 py-0.5 border border-blue-200 rounded text-xs uppercase disabled:opacity-50"
                                                        />
                                                    ) : (
                                                        <span className={r.deleted ? 'line-through text-red-500' : ''}>{r.descricao || r.recurso_descricao || r.recurso}</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1 font-mono text-slate-500">
                                                    {isEditingOperacoes ? (
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                type="text" 
                                                                value={r.recurso || ''} 
                                                                onChange={(e) => {
                                                                    const val = e.target.value.toUpperCase();
                                                                    const newArr = [...editedOperacoes];
                                                                    newArr[i].recurso = val;
                                                                    const processMatch = processList.find(p => p.codigo === val);
                                                                    if (processMatch) {
                                                                        newArr[i].descricao = processMatch.descricao;
                                                                        newArr[i].recurso_descricao = processMatch.descricao;
                                                                    }
                                                                    setEditedOperacoes(newArr);
                                                                }}
                                                                disabled={r.deleted}
                                                                className="w-full px-1 py-0.5 border border-blue-200 rounded text-xs uppercase disabled:opacity-50"
                                                                placeholder="MO0001"
                                                                list="recursos-list"
                                                            />
                                                            <button
                                                                type="button"
                                                                onMouseDown={(e) => e.preventDefault()}
                                                                onClick={() => {
                                                                    setActiveRecursoRowIndex(i);
                                                                    setSearchRecursoQuery('');
                                                                    setShowSearchRecursoModal(true);
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                title="Buscar Recurso"
                                                            >
                                                                <Search className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className={r.deleted ? 'line-through text-red-500' : ''}>{r.recurso || '—'}</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1 text-right w-24">
                                                    {isEditingOperacoes ? (
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            step="0.01" 
                                                            value={r.setup !== undefined ? r.setup : ''} 
                                                            onChange={(e) => {
                                                                const newArr = [...editedOperacoes];
                                                                newArr[i] = { ...newArr[i], setup: e.target.value };
                                                                setEditedOperacoes(newArr);
                                                            }}
                                                            disabled={r.deleted}
                                                            className="w-20 px-1 py-0.5 border border-amber-200 rounded text-right text-xs font-mono text-amber-700 disabled:opacity-50 bg-amber-50/50"
                                                        />
                                                    ) : (
                                                        <span className={`font-mono font-medium ${r.deleted ? 'line-through text-red-500' : 'text-amber-700 bg-amber-50/50 px-1 py-0.5 rounded'}`}>{Number(r.setup || 0).toFixed(2)} min</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1 text-right w-24">
                                                    {isEditingOperacoes ? (
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            step="0.001" 
                                                            value={r.tempo !== undefined ? r.tempo : ''} 
                                                            onChange={(e) => {
                                                                const newArr = [...editedOperacoes];
                                                                newArr[i] = { ...newArr[i], tempo: e.target.value };
                                                                setEditedOperacoes(newArr);
                                                            }}
                                                            disabled={r.deleted}
                                                            className="w-20 px-1 py-0.5 border border-blue-200 rounded text-right text-xs font-mono text-blue-600 disabled:opacity-50 bg-blue-50/50"
                                                        />
                                                    ) : (
                                                        <span className={`font-mono font-medium ${r.deleted ? 'line-through text-red-500' : 'text-blue-600 bg-blue-50/50 px-1 py-0.5 rounded'}`}>{Number(r.tempo || 0).toFixed(3).replace('.', ',')} min</span>
                                                    )}
                                                </td>
                                                {isEditingOperacoes && (
                                                    <td className="px-2 py-1 text-right">
                                                        <button
                                                            onClick={() => {
                                                                let newArr = [...editedOperacoes];
                                                                if (r.isNew) {
                                                                    newArr.splice(i, 1);
                                                                } else {
                                                                    newArr[i] = { ...newArr[i], deleted: !newArr[i].deleted };
                                                                }
                                                                setEditedOperacoes(applyReindexOperacoes(newArr));
                                                            }}
                                                            className={`p-1 transition-colors rounded ${r.deleted ? 'bg-slate-200 text-slate-600' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                                            title={r.deleted ? "Restaurar" : "Excluir da Estrutura"}
                                                        >
                                                            {r.deleted ? <RefreshCw className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {isEditingOperacoes && (
                                    <>
                                        <datalist id="recursos-list">
                                            {processList.map(p => (
                                                <option key={p.codigo} value={p.codigo}>{p.descricao}</option>
                                            ))}
                                        </datalist>
                                        <div className="p-2 border-t border-blue-100 bg-blue-50/30">
                                            <button
                                                onClick={() => {
                                                    const maxOp = editedOperacoes.reduce((max, op) => {
                                                        const num = parseInt(op.operacao || 0, 10);
                                                        return num > max ? num : max;
                                                    }, 0);
                                                    const nextOp = Math.ceil((maxOp + 1) / 10) * 10;
                                                    const nextOpStr = String(nextOp === 0 ? 10 : nextOp).padStart(2, '0');

                                                    const newArr = [...editedOperacoes, {
                                                        operacao: nextOpStr,
                                                        descricao: '',
                                                        recurso: '',
                                                        setup: 1,
                                                        tempo: 1,
                                                        isNew: true,
                                                        deleted: false
                                                    }];
                                                    setEditedOperacoes(applyReindexOperacoes(newArr));
                                                }}
                                                className="w-full py-1.5 flex items-center justify-center gap-1 text-xs font-medium text-blue-600 hover:bg-blue-100/50 border border-blue-200 border-dashed rounded-md transition-colors"
                                            >
                                                <Plus className="h-3.5 w-3.5" /> Adicionar Operação
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )}

    {/* 4. Restrições de Engenharia SZ0 */}
    {(!maximizedPanel || maximizedPanel === 'sz0') && (
        <div className={`bg-white rounded-lg border border-slate-200 flex flex-col shadow-2xs overflow-hidden ${
            maximizedPanel === 'sz0' ? 'h-[calc(100vh-210px)] min-h-[460px]' : 'h-[185px] sm:h-[205px] xl:h-[230px] 2xl:h-[280px]'
        }`}>
            <div className={`${boxTitleCls} bg-red-50 text-red-700 border-red-100 flex justify-between items-center`}>
                <div className="flex items-center gap-1.5">
                    <span>Restrições de Engenharia (SZ0)</span>
                    {restricoesSz0.length > 0 && <span className="ml-1 text-[10px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded-full font-bold">{restricoesSz0.length}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                    {temArquivo && (
                        <button
                            onClick={() => {
                                setNovaRestricao({ resumo: '', restricao: '', responsavel: (user?.nome || user?.login || '').toUpperCase(), revMetalfisa: '' });
                                setShowModalSz0(true);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-medium rounded transition-colors shadow-2xs cursor-pointer"
                        >
                            <Plus className="h-3 w-3" /> Nova
                        </button>
                    )}
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-red-200 text-red-600 font-mono">{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
                    <button
                        onClick={() => setMaximizedPanel(maximizedPanel === 'sz0' ? null : 'sz0')}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded transition-colors cursor-pointer"
                        title={maximizedPanel === 'sz0' ? "Restaurar layout padrão" : "Maximizar SZ0"}
                    >
                        {maximizedPanel === 'sz0' ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </button>
                </div>
            </div>
                <div className="flex-1 overflow-auto bg-slate-50/50">
                    {loadingSz0 ? (
                        <div className="flex items-center justify-center py-8 text-slate-400 text-sm">Carregando restrições SZ0...</div>
                    ) : (
                        <table className="w-full text-left text-xs bg-white">
                            <thead>
                                <tr>
                                    <th className={thCls}>Item</th>
                                    <th className={thCls}>Status</th>
                                    <th className={thCls}>Resumo</th>
                                    <th className={thCls}>Descrição da Restrição *</th>
                                    <th className={thCls}>Revisão</th>
                                    <th className={thCls}>Responsável</th>
                                    <th className={thCls}>Últ. Alteração</th>
                                    <th className={thCls}></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {restricoesSz0.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-8 text-slate-400 italic">
                                            Nenhuma restrição SZ0 encontrada para este produto
                                        </td>
                                    </tr>
                                ) : [...restricoesSz0].sort((a, b) => Number(b.item) - Number(a.item)).map((r, i) => {
                                    const statusLabel = r.status === 'P' ? 'Pendente' : r.status === 'A' ? 'Aprovado' : r.status === 'R' ? 'Rejeitado' : r.status;
                                    const statusCls = r.status === 'P' ? 'bg-amber-100 text-amber-700 border-amber-200' : r.status === 'A' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200';
                                    const dtFormatted = r.dt_ultima_alt ? r.dt_ultima_alt.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '—';
                                    return (
                                        <tr key={i} className="hover:bg-red-50/30 transition-colors" title={r.restricao || ''}>
                                            <td className="px-2 py-1 font-mono font-medium text-slate-700">{r.item}</td>
                                            <td className="px-2 py-1">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${statusCls}`}>{statusLabel}</span>
                                            </td>
                                            <td className="px-2 py-1 text-slate-600 max-w-[200px] truncate" title={r.resumo}>{r.resumo || '—'}</td>
                                            <td className="px-2 py-1 text-slate-600 max-w-[300px] truncate" title={r.restricao}>{r.restricao || '—'}</td>
                                            <td className="px-2 py-1 font-mono text-slate-500 font-bold">{r.revisao || '—'}</td>
                                            <td className="px-2 py-1 font-mono text-slate-500">{r.responsavel || '—'}</td>
                                            <td className="px-2 py-1 text-slate-500 whitespace-nowrap">{dtFormatted} {r.hr_ultima_alt || ''}</td>
                                            <td className="px-2 py-1 text-right">
                                                {temArquivo && (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditandoRestricao(r);
                                                                setNovaRestricao({
                                                                    resumo: r.resumo || '',
                                                                    restricao: r.restricao || '',
                                                                    responsavel: (user?.nome || user?.login || '').toUpperCase(),
                                                                    revMetalfisa: r.revisao || dados.rev || '',
                                                                    status: r.status || 'P',
                                                                });
                                                                setShowModalSz0(true);
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                            title="Editar restrição"
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletarRestricaoSz0(r)}
                                                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                                            title="Excluir restrição"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            )}
            </>
            )}

            {/* ABA 2: ESTRUTURA EM ÁRVORE COMPLETA (OPÇÃO A: PÁGINA INTEIRA) */}
            {/* ABA 2: ESTRUTURA EM ÁRVORE COMPLETA (MULTINÍVEL RECURSIVA COM 3 MODOS VISUAIS) */}
            {activeMainTab === 'arvore' && (
                <div className="flex flex-col space-y-3 w-full animate-fadeIn relative">
                    
                    {/* Barra de Ferramentas e Seletor dos 3 Modos Visuais */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
                        
                        {/* Lado Esquerdo: Identificação e Métricas */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                                <Network size={16} />
                                <span className="text-xs font-black">Árvore Multinível Completa</span>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg border border-slate-200 font-medium">
                                    Total: <strong className="text-slate-900">{rowsArvore.length}</strong> itens
                                    {rowsArvore.length > 0 && (
                                        <span className="ml-1 text-[10px] text-slate-500 font-bold">
                                            ({Math.max(...rowsArvore.map(r => r.nivel))} níveis)
                                        </span>
                                    )}
                                </span>
                                {loadingTreeValidation && (
                                    <span className="text-[11px] text-blue-600 flex items-center gap-1 animate-pulse font-medium">
                                        <Loader2 size={12} className="animate-spin" />
                                        Validando Protheus...
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Centro: SELETOR DAS 3 OPÇÕES VISUAIS DE EDIÇÃO */}
                        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200 self-stretch sm:self-auto">
                            <span className="text-[10px] font-black uppercase text-slate-500 px-2 select-none">Modo:</span>
                            
                            {/* Opção 1: Linha Expansível (Accordion) */}
                            <button
                                type="button"
                                onClick={() => handleSetTreeViewMode('accordion')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    treeViewMode === 'accordion' 
                                        ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200' 
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                }`}
                                title="Opção 1: Expandir as 4 áreas de engenharia na própria linha da árvore (Accordion)"
                            >
                                <span>🪗 Linha Expansível</span>
                            </button>

                            {/* Opção 2: Painel Lateral (Drawer) */}
                            <button
                                type="button"
                                onClick={() => handleSetTreeViewMode('drawer')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    treeViewMode === 'drawer' 
                                        ? 'bg-white text-blue-700 shadow-2xs border border-blue-200' 
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                }`}
                                title="Opção 2: Abrir gaveta lateral à direita com as 4 áreas sem cobrir a árvore (Drawer)"
                            >
                                <span>📑 Painel Lateral</span>
                            </button>

                            {/* Opção 3: Janela Modal (Modal 360°) */}
                            <button
                                type="button"
                                onClick={() => handleSetTreeViewMode('modal')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    treeViewMode === 'modal' 
                                        ? 'bg-white text-emerald-700 shadow-2xs border border-emerald-200' 
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                }`}
                                title="Opção 3: Abrir janela modal centralizada ampla em tela inteira"
                            >
                                <span>🪟 Janela Modal</span>
                            </button>
                        </div>

                        {/* Lado Direito: Busca, Atualizar, Excel */}
                        <div className="flex items-center gap-2 w-full xl:w-auto justify-end flex-wrap">
                            <div className="relative flex-1 sm:w-56">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Filtrar na estrutura..."
                                    value={treeFilterText}
                                    onChange={(e) => setTreeFilterText(e.target.value)}
                                    className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                                {treeFilterText && (
                                    <button
                                        onClick={() => setTreeFilterText('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                        title="Limpar filtro"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={handleRevalidarArvore}
                                disabled={loadingArvore || loadingArvoreCompleta}
                                title="Recarregar Estrutura Completa Recursiva"
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                            >
                                <RefreshCw size={13} className={loadingArvore || loadingArvoreCompleta ? 'animate-spin' : ''} />
                                <span className="hidden sm:inline">Atualizar</span>
                            </button>

                            <button
                                onClick={handleExportArvoreExcel}
                                disabled={rowsArvore.length === 0}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                                title="Exportar Estrutura Hierárquica em Excel"
                            >
                                <FileSpreadsheet size={14} />
                                <span>Exportar XLSX</span>
                            </button>
                        </div>
                    </div>

                    {/* Tabela da Árvore Widescreen com Suporte a Todos os Níveis */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full">
                        <div className="overflow-x-auto min-h-[460px] max-h-[calc(100vh-220px)]">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200 sticky top-0 z-20 backdrop-blur-xs">
                                        <th className="px-3 py-2.5 w-14 text-center">Nív.</th>
                                        <th className="px-3 py-2.5 min-w-[240px]">Código do Componente</th>
                                        <th className="px-3 py-2.5 min-w-[280px]">Descrição Técnica</th>
                                        <th className="px-3 py-2.5 w-24 text-right">Qtde / UN</th>
                                        <th className="px-2 py-2.5 w-20 text-center" title="Estrutura de Materiais cadastrada no Protheus (SG1)">BOM (SG1)</th>
                                        <th className="px-2 py-2.5 w-20 text-center" title="Vínculo de Produto x Cliente cadastrado (SZ1)">Cliente (SZ1)</th>
                                        <th className="px-2 py-2.5 w-20 text-center" title="Roteiro de Operações cadastrado (SG2)">Roteiro (SG2)</th>
                                        <th className="px-2 py-2.5 w-20 text-center" title="Restrições de Processo/Qualidade (SZ0)">Restrições (SZ0)</th>
                                        <th className="px-3 py-2.5 min-w-[270px] text-center">Ações em Qualquer Nível</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {loadingArvore || loadingArvoreCompleta ? (
                                        <tr>
                                            <td colSpan={9} className="py-20 text-center text-slate-400">
                                                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                                                <span className="text-xs font-semibold">Carregando todos os níveis da estrutura hierárquica...</span>
                                            </td>
                                        </tr>
                                    ) : filteredRowsArvore.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-16 text-center text-slate-400">
                                                <Package className="w-10 h-10 mx-auto text-slate-300 mb-2 opacity-50" />
                                                <p className="font-semibold text-slate-600">Nenhum componente encontrado na estrutura.</p>
                                                {treeFilterText && (
                                                    <p className="text-[11px] text-slate-400 mt-1">
                                                        Nenhum resultado corresponde ao filtro "{treeFilterText}".
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRowsArvore.map((r, rIdx) => {
                                            const vStatus = treeValidationStatus[r.codigoLimpo];
                                            const indentPx = Math.min(r.nivel, 8) * 18;
                                            const isExpanded = treeViewMode === 'accordion' && expandedNodeAccordion === r.codigoLimpo;
                                            
                                            // Badges de nível diferenciados por profundidade
                                            let nivelBadgeCls = 'bg-slate-100 text-slate-700 border-slate-200 font-bold';
                                            if (r.nivel === 0) nivelBadgeCls = 'bg-blue-600 text-white border-blue-700 font-black shadow-2xs';
                                            else if (r.nivel === 1) nivelBadgeCls = 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold';
                                            else if (r.nivel === 2) nivelBadgeCls = 'bg-purple-100 text-purple-800 border-purple-300 font-bold';
                                            else if (r.nivel === 3) nivelBadgeCls = 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
                                            else if (r.nivel >= 4) nivelBadgeCls = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';

                                            const renderValIcon = (statusKey) => {
                                                if (loadingTreeValidation) return <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300 mx-auto" />;
                                                if (!vStatus) return <span className="text-slate-300 font-mono">—</span>;
                                                return vStatus[statusKey]
                                                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" title="Cadastrado / Válido no Protheus" />
                                                    : <XCircle className="w-4 h-4 text-slate-300 hover:text-red-500 mx-auto transition-colors" title="Não cadastrado ou sem registro" />;
                                            };

                                            return (
                                                <React.Fragment key={r.caminho_hierarquico || `${r.codigoLimpo}_${r.nivel}_${rIdx}`}>
                                                    <tr className={`transition-colors group ${
                                                        isExpanded ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-blue-50/40'
                                                    }`}>
                                                        
                                                        {/* NÍVEL */}
                                                        <td className="px-3 py-2 text-center">
                                                            <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] border ${nivelBadgeCls}`}>
                                                                {r.nivel === 0 ? 'PA' : `N${r.nivel}`}
                                                            </span>
                                                        </td>

                                                        {/* CÓDIGO DO COMPONENTE COM INDENTAÇÃO VISUAL */}
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-1.5" style={{ paddingLeft: `${indentPx}px` }}>
                                                                {r.nivel > 0 && (
                                                                    <span className="text-slate-300 font-mono text-[11px] select-none shrink-0">
                                                                        └─
                                                                    </span>
                                                                )}
                                                                {r.nivel === 0 ? (
                                                                    <Network className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                                ) : (vStatus?.materiais) ? (
                                                                    <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                                ) : (
                                                                    <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                )}
                                                                <span className="font-mono font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                                                                    {r.codigoLimpo}
                                                                </span>
                                                                {r.tipo && (
                                                                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                                                        {r.tipo}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* DESCRIÇÃO */}
                                                        <td className="px-3 py-2 text-slate-700 font-medium leading-tight max-w-xs md:max-w-md truncate" title={r.descricao}>
                                                            {r.descricao || '—'}
                                                        </td>

                                                        {/* QUANTIDADE / UN */}
                                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                                            <span className="font-mono font-bold text-slate-900">
                                                                {r.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                                            </span>
                                                            <span className="ml-1 text-[10px] text-slate-500 font-bold">
                                                                {r.unidade}
                                                            </span>
                                                        </td>

                                                        {/* VALIDAÇÕES */}
                                                        <td className="px-2 py-2 text-center">{renderValIcon('materiais')}</td>
                                                        <td className="px-2 py-2 text-center">{renderValIcon('sz1')}</td>
                                                        <td className="px-2 py-2 text-center">{renderValIcon('roteiro')}</td>
                                                        <td className="px-2 py-2 text-center">{renderValIcon('sz0')}</td>

                                                        {/* AÇÕES EM QUALQUER NÍVEL */}
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                                
                                                                {/* 1. PDF Desenho */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAbrirPdfComponente(r.codigoLimpo)}
                                                                    className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                                                    title={`Consultar/Abrir Desenho PDF de ${r.codigoLimpo}`}
                                                                >
                                                                    <FileText size={15} />
                                                                </button>

                                                                {/* 2. Disparador dos 3 Modos (Accordion / Drawer / Modal) com 4 áreas completas */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenNode(r)}
                                                                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer ${
                                                                        isExpanded 
                                                                            ? 'bg-indigo-600 text-white border border-indigo-700' 
                                                                            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                                                                    }`}
                                                                    title={`Gerenciar Materiais, SZ1, Roteiro e SZ0 de ${r.codigoLimpo} (${treeViewMode})`}
                                                                >
                                                                    {treeViewMode === 'accordion' ? (
                                                                        isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                                                                    ) : (
                                                                        <Eye size={12} />
                                                                    )}
                                                                    <span>
                                                                        {treeViewMode === 'accordion' 
                                                                            ? (isExpanded ? 'Recolher' : 'Gerenciar')
                                                                            : 'Gerenciar'}
                                                                    </span>
                                                                </button>

                                                                {/* 3. Carregar no Formulário Principal */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCarregarNoFormulario(r.codigoLimpo)}
                                                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                                                                    title={`Carregar ${r.codigoLimpo} como produto ativo no Formulário`}
                                                                >
                                                                    <Edit3 size={11} />
                                                                    <span className="hidden sm:inline">Formulário</span>
                                                                </button>
                                                            </div>
                                                        </td>

                                                    </tr>

                                                    {/* OPÇÃO 1: LINHA EXPANSÍVEL (ACCORDION INLINE) */}
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={9} className="p-0 border-b-2 border-indigo-300">
                                                                <SincoNodeManager
                                                                    codigo={r.codigoLimpo}
                                                                    descricao={r.descricao}
                                                                    nivel={r.nivel}
                                                                    quantidade={r.quantidade}
                                                                    unidade={r.unidade}
                                                                    displayMode="accordion"
                                                                    onClose={() => setExpandedNodeAccordion(null)}
                                                                    onSuccessRefresh={handleRevalidarArvore}
                                                                    onCarregarNoFormulario={handleCarregarNoFormulario}
                                                                    onCadastrarProtheus={(p) => { setItemParaCriarProduto(p); setModalCriarProdutoOpen(true); }}
                                                                />
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* OPÇÃO 2: PAINEL LATERAL (DRAWER DESLIZANTE) */}
                    {treeViewMode === 'drawer' && activeDrawerNode && (
                        <div className="fixed inset-0 z-50 pointer-events-none">
                            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-2xs pointer-events-auto" onClick={() => setActiveDrawerNode(null)} />
                            <div className="pointer-events-auto">
                                <SincoNodeManager
                                    codigo={activeDrawerNode.codigoLimpo}
                                    descricao={activeDrawerNode.descricao}
                                    nivel={activeDrawerNode.nivel}
                                    quantidade={activeDrawerNode.quantidade}
                                    unidade={activeDrawerNode.unidade}
                                    displayMode="drawer"
                                    onClose={() => setActiveDrawerNode(null)}
                                    onSuccessRefresh={handleRevalidarArvore}
                                    onCarregarNoFormulario={handleCarregarNoFormulario}
                                    onCadastrarProtheus={(p) => { setItemParaCriarProduto(p); setModalCriarProdutoOpen(true); }}
                                />
                            </div>
                        </div>
                    )}

                    {/* OPÇÃO 3: JANELA MODAL (MODAL CENTRALIZADO) */}
                    {activeModalNode && (
                        <SincoNodeManager
                            codigo={activeModalNode.codigoLimpo}
                            descricao={activeModalNode.descricao}
                            nivel={activeModalNode.nivel}
                            quantidade={activeModalNode.quantidade}
                            unidade={activeModalNode.unidade}
                            displayMode="modal"
                            onClose={() => setActiveModalNode(null)}
                            onSuccessRefresh={handleRevalidarArvore}
                            onCarregarNoFormulario={handleCarregarNoFormulario}
                            onCadastrarProtheus={(p) => { setItemParaCriarProduto(p); setModalCriarProdutoOpen(true); }}
                        />
                    )}

                </div>
            )}

            {/* Modal Nova/Editar Restrição SZ0 */}
            {showModalSz0 && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { setShowModalSz0(false); setEditandoRestricao(null); }}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 border border-slate-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
                            <h3 className="text-sm font-bold text-slate-800">
                                {editandoRestricao ? `Editar Restrição ${editandoRestricao.item}` : 'Nova Restrição'} — {dados.arquivo.replace(/\.[^/.]+$/, '')}
                            </h3>
                            <button onClick={() => { setShowModalSz0(false); setEditandoRestricao(null); }} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className={lblCls}>Resumo *</label>
                                <input type="text" maxLength={80} value={novaRestricao.resumo} onChange={e => setNovaRestricao(p => ({ ...p, resumo: e.target.value }))} placeholder="Breve descrição da restrição" className={inputCls} autoFocus />
                            </div>
                            <div>
                                <label className={lblCls}>Descrição da Restrição *</label>
                                <textarea rows={3} maxLength={500} value={novaRestricao.restricao} onChange={e => setNovaRestricao(p => ({ ...p, restricao: e.target.value }))} placeholder="Detalhe completo da restrição..." className={inputCls + ' resize-none'} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={lblCls}>Responsável</label>
                                    <input type="text" value={novaRestricao.responsavel} readOnly className={readCls} title="Preenchido automaticamente com o usuário logado" />
                                </div>
                                <div>
                                    <label className={lblCls}>Rev. Metalfisa</label>
                                    <input type="text" maxLength={2} value={novaRestricao.revMetalfisa || dados.rev || ''} onChange={e => setNovaRestricao(p => ({ ...p, revMetalfisa: e.target.value }))} className={inputCls} />
                                </div>
                                <div>
                                    <label className={lblCls}>Status</label>
                                    <select value={novaRestricao.status} onChange={e => setNovaRestricao(p => ({ ...p, status: e.target.value }))} className={inputCls}>
                                        <option value="P">Pendente</option>
                                        <option value="A">Aprovado</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span>Item: {editandoRestricao ? editandoRestricao.item : String(restricoesSz0.length + 1).padStart(3, '0')}</span>
                                <span>•</span>
                                <span>Data/Hora: agora</span>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                            <button onClick={() => { setShowModalSz0(false); setEditandoRestricao(null); }} className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancelar</button>
                            <button
                                onClick={handleSalvarRestricao}
                                disabled={savingSz0 || !novaRestricao.resumo.trim() || !novaRestricao.restricao.trim()}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-md transition-colors shadow-sm flex items-center gap-1.5"
                            >
                                {savingSz0 ? 'Salvando...' : <><Save className="h-3.5 w-3.5" /> {editandoRestricao ? 'Salvar Alterações' : 'Salvar Restrição'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showSearchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[80vh] max-h-[600px] animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-800">Buscar Componente (Protheus)</h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">Pesquise por código ou parte da descrição do material.</p>
                            </div>
                            <button onClick={() => setShowSearchModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && searchQuery.length >= 3) {
                                                setSearching(true);
                                                searchSincoProdutos(searchQuery)
                                                    .then(res => setSearchResults(res || []))
                                                    .catch(err => showToast("Erro ao buscar materiais", 'error'))
                                                    .finally(() => setSearching(false));
                                            }
                                        }}
                                        placeholder="Digite ao menos 3 letras e pressione Enter ou Buscar..."
                                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-shadow"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        if (searchQuery.length >= 3) {
                                            setSearching(true);
                                            searchSincoProdutos(searchQuery)
                                                .then(res => setSearchResults(res || []))
                                                .catch(err => showToast("Erro ao buscar materiais", 'error'))
                                                .finally(() => setSearching(false));
                                        }
                                    }}
                                    disabled={searchQuery.length < 3 || searching}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Search className="w-4 h-4" />
                                    Buscar
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            {searching ? (
                                <div className="flex justify-center items-center h-full text-sm text-slate-400">Buscando no Protheus...</div>
                            ) : searchResults.length === 0 ? (
                                <div className="flex justify-center items-center h-full text-sm text-slate-400 italic">
                                    {searchQuery.length >= 3 ? "Nenhum material encontrado." : "Aguardando busca."}
                                </div>
                            ) : (
                                <table className="w-full text-left text-[11px]">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-100 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-2 font-medium text-slate-500">CÓDIGO</th>
                                            <th className="px-4 py-2 font-medium text-slate-500">DESCRIÇÃO</th>
                                            <th className="px-4 py-2 font-medium text-slate-500">TIPO</th>
                                            <th className="px-4 py-2 font-medium text-slate-500">UN</th>
                                            <th className="px-4 py-2 font-medium text-slate-500 text-center">AÇÃO</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {searchResults.map((r, i) => (
                                            <tr key={i} className="hover:bg-indigo-50/50 transition-colors">
                                                <td className="px-4 py-2 font-mono font-medium text-slate-700">{r.codigo}</td>
                                                <td className="px-4 py-2 text-slate-600 font-medium truncate max-w-[200px]" title={r.titulo}>{r.titulo}</td>
                                                <td className="px-4 py-2 text-slate-500">{r.tipo}</td>
                                                <td className="px-4 py-2 text-slate-500">{r.unidade}</td>
                                                <td className="px-4 py-2 text-center">
                                                    <button
                                                        onClick={() => {
                                                            if (activeRowIndex !== null) {
                                                                const newArr = [...editedArvore];
                                                                newArr[activeRowIndex].componente = r.codigo;
                                                                newArr[activeRowIndex].descricao = r.titulo;
                                                                newArr[activeRowIndex].unidade = r.unidade;
                                                                setEditedArvore(newArr);
                                                            }
                                                            setShowSearchModal(false);
                                                        }}
                                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-medium rounded shadow-sm transition-colors"
                                                    >
                                                        Selecionar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white shadow-xl rounded-lg pointer-events-auto flex ring-1 ${toast.type === 'error' ? 'ring-red-500/30' : toast.type === 'warning' ? 'ring-amber-500/30' : 'ring-green-500/30'} overflow-hidden transform transition-all duration-300 ease-in-out`}>
                    <div className="flex p-4 w-full">
                        <div className="flex-shrink-0">
                            {toast.type === 'error' ? (
                                <XCircle className="h-5 w-5 text-red-500" />
                            ) : toast.type === 'warning' ? (
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                            ) : (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                            )}
                        </div>
                        <div className="ml-3 w-0 flex-1 pt-0.5">
                            <p className="text-sm font-medium text-slate-900">{toast.message}</p>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex">
                            <button
                                onClick={() => setToast(null)}
                                className="bg-white rounded-md inline-flex text-slate-400 hover:text-slate-500 focus:outline-none"
                            >
                                <span className="sr-only">Close</span>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {showSearchRecursoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col h-[70vh] max-h-[500px] animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-800">Buscar Recurso (Operação)</h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">Pesquise por código ou descrição do recurso.</p>
                            </div>
                            <button onClick={() => setShowSearchRecursoModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchRecursoQuery}
                                    onChange={(e) => setSearchRecursoQuery(e.target.value)}
                                    placeholder="Digite para filtrar os recursos..."
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-left text-[11px]">
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-100 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-2 font-medium text-slate-500">CÓDIGO</th>
                                        <th className="px-4 py-2 font-medium text-slate-500">DESCRIÇÃO</th>
                                        <th className="px-4 py-2 font-medium text-slate-500 text-center">AÇÃO</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {processList
                                        .filter(r => !searchRecursoQuery || r.codigo.toLowerCase().includes(searchRecursoQuery.toLowerCase()) || r.descricao.toLowerCase().includes(searchRecursoQuery.toLowerCase()))
                                        .map((r, i) => (
                                        <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-4 py-2 font-mono font-medium text-slate-700">{r.codigo}</td>
                                            <td className="px-4 py-2 text-slate-600 font-medium truncate max-w-[200px]" title={r.descricao}>{r.descricao}</td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => {
                                                        if (activeRecursoRowIndex !== null) {
                                                            const newArr = [...editedOperacoes];
                                                            newArr[activeRecursoRowIndex].recurso = r.codigo;
                                                            newArr[activeRecursoRowIndex].descricao = r.descricao;
                                                            newArr[activeRecursoRowIndex].recurso_descricao = r.descricao;
                                                            setEditedOperacoes(newArr);
                                                        }
                                                        setShowSearchRecursoModal(false);
                                                    }}
                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium rounded shadow-sm transition-colors"
                                                >
                                                    Selecionar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {processList.filter(r => !searchRecursoQuery || r.codigo.toLowerCase().includes(searchRecursoQuery.toLowerCase()) || r.descricao.toLowerCase().includes(searchRecursoQuery.toLowerCase())).length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="px-4 py-8 text-center text-slate-400 italic">Nenhum recurso encontrado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Busca Cliente (Protheus) */}
            {showSearchClienteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[80vh] max-h-[600px] animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-800">Buscar Cliente/Fornecedor (Protheus)</h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">Pesquise por código ou parte do nome.</p>
                            </div>
                            <button onClick={() => setShowSearchClienteModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <div className="relative flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchClienteQuery}
                                        onChange={(e) => setSearchClienteQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const q = searchClienteQuery ? searchClienteQuery.trim() : '';
                                                setSearchingCliente(true);
                                                getClientes(q)
                                                    .then(res => setSearchClienteResults(Array.isArray(res) ? res : []))
                                                    .catch(err => showToast("Erro ao buscar clientes", 'error'))
                                                    .finally(() => setSearchingCliente(false));
                                            }
                                        }}
                                        placeholder="Digite código ou nome do cliente (ex: ATILLA)..."
                                        className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-md shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow"
                                        autoFocus
                                    />
                                    {searchClienteQuery && (
                                        <button 
                                            type="button"
                                            onClick={() => setSearchClienteQuery('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                            title="Limpar busca"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    disabled={searchingCliente}
                                    onClick={() => {
                                        const q = searchClienteQuery ? searchClienteQuery.trim() : '';
                                        setSearchingCliente(true);
                                        getClientes(q)
                                            .then(res => setSearchClienteResults(Array.isArray(res) ? res : []))
                                            .catch(err => showToast("Erro ao buscar clientes", 'error'))
                                            .finally(() => setSearchingCliente(false));
                                    }}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                >
                                    {searchingCliente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                    <span>Buscar</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            {searchingCliente ? (
                                <div className="flex flex-col justify-center items-center h-full text-sm text-slate-400 gap-2">
                                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                                    <span>Buscando no Protheus...</span>
                                </div>
                            ) : searchClienteResults.length === 0 ? (
                                <div className="flex flex-col justify-center items-center h-full text-sm text-slate-400 italic p-6 text-center">
                                    <p>Nenhum cliente/fornecedor encontrado para "{searchClienteQuery}".</p>
                                    <p className="text-xs text-slate-400 not-italic mt-1">Dica: Verifique a grafia ou tente buscar por código/parte do nome.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-[11px]">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-100 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-2 font-medium text-slate-500">CÓDIGO</th>
                                            <th className="px-4 py-2 font-medium text-slate-500">LOJA</th>
                                            <th className="px-4 py-2 font-medium text-slate-500">NOME</th>
                                            <th className="px-4 py-2 font-medium text-slate-500">TIPO</th>
                                            <th className="px-4 py-2 font-medium text-slate-500 text-center">AÇÃO</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {searchClienteResults.map((r, i) => (
                                            <tr key={i} className="hover:bg-amber-50/50 transition-colors">
                                                <td className="px-4 py-2 font-mono font-medium text-slate-700">{r.codigo}</td>
                                                <td className="px-4 py-2 font-mono text-slate-600">{r.loja}</td>
                                                <td className="px-4 py-2 text-slate-600 font-medium truncate max-w-[200px]" title={r.nome}>{r.nome}</td>
                                                <td className="px-4 py-2 text-slate-500">{r.tipo}</td>
                                                <td className="px-4 py-2 text-center">
                                                    <button
                                                        onClick={() => {
                                                            if (activeClienteRowIndex !== null) {
                                                                const newArr = [...editedRestricoes];
                                                                newArr[activeClienteRowIndex].cliente = r.codigo;
                                                                newArr[activeClienteRowIndex].loja = r.loja;
                                                                newArr[activeClienteRowIndex].desc_cliente = r.nome;
                                                                newArr[activeClienteRowIndex].nome_cliente = r.nome;
                                                                setEditedRestricoes(newArr);
                                                            }
                                                            setShowSearchClienteModal(false);
                                                        }}
                                                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-medium rounded shadow-sm transition-colors"
                                                    >
                                                        Selecionar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Documentos do Produto (Idêntico ao Catálogo de Produtos) */}
            <DocsModal
                isOpen={showDocsModal}
                onClose={() => {
                    setShowDocsModal(false);
                    handleRefreshDocs();
                }}
                productCode={codigoAtual}
                productName={dados.titulo || ''}
                canEdit={true}
            />

            {/* Modal de Cadastro de Produto no Protheus (TOTVS) */}
            <CriarProdutoProtheusModal
                isOpen={modalCriarProdutoOpen}
                onClose={() => setModalCriarProdutoOpen(false)}
                item={itemParaCriarProduto ? { ...itemParaCriarProduto, is_sinco: true } : null}
                onSuccess={handleProdutoCriadoComSucesso}
                isSinco={true}
            />

            {/* Modal de Inspeção 360° e Ações de Componente da Árvore */}
            <SincoComponenteModal
                isOpen={Boolean(selectedComponenteModal)}
                onClose={() => setSelectedComponenteModal(null)}
                codigo={selectedComponenteModal?.codigoLimpo || selectedComponenteModal?.codigo}
                descricao={selectedComponenteModal?.descricao}
                nivel={selectedComponenteModal?.nivel}
                quantidade={selectedComponenteModal?.quantidade}
                unidade={selectedComponenteModal?.unidade}
                onCarregarNoFormulario={handleCarregarNoFormulario}
                onCadastrarProtheus={(item) => {
                    setItemParaCriarProduto(item);
                    setModalCriarProdutoOpen(true);
                }}
            />

            {/* Modal de Aviso de Regra de Negócio Protheus (SZ1 - Produto x Cliente) */}
            {modalRegraSz1 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header com destaque de regra */}
                        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex items-center justify-between text-white shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <AlertTriangle className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-bold tracking-tight">Regra de Negócio Protheus (Tabela SZ1)</h3>
                                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-amber-700/60 text-white rounded-full">
                                            Validação TOTVS
                                        </span>
                                    </div>
                                    <p className="text-xs text-amber-100 mt-0.5">
                                        Conflito de Amarração Produto x Desenho do Cliente
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setModalRegraSz1(null)}
                                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Corpo com explicação pedagógica */}
                        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-700">
                            {/* 1. Alerta de Conflito Identificado */}
                            <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3.5 flex flex-col gap-2">
                                <div className="flex items-start gap-2">
                                    <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                    <span className="font-semibold text-amber-950 text-xs uppercase tracking-wide">
                                        Vínculo já existente na base de dados
                                    </span>
                                </div>
                                <p className="text-xs text-amber-900 font-medium leading-relaxed">
                                    {modalRegraSz1.message}
                                </p>
                            </div>

                            {/* 2. Comparativo Visual dos Itens */}
                            {modalRegraSz1.conflito && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                                            O que você tentou vincular agora
                                        </span>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Produto Atual:</span>
                                                <span className="font-mono font-bold text-slate-800">{modalRegraSz1.conflito.produto_atual}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Cód. Cliente (Desenho):</span>
                                                <span className="font-mono font-bold text-amber-700">{modalRegraSz1.conflito.cod_cliente}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Revisão:</span>
                                                <span className="font-mono font-bold text-amber-700">{modalRegraSz1.conflito.revisao}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Cliente:</span>
                                                <span className="font-mono text-slate-700">{modalRegraSz1.conflito.cliente}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                                                Onde este desenho já está amarrado
                                            </span>
                                            <span className="text-[10px] font-mono text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                                                RECNO #{modalRegraSz1.conflito.recno}
                                            </span>
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Produto Vinculado:</span>
                                                <span className="font-mono font-bold text-red-600">{modalRegraSz1.conflito.produto_existente}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Descrição:</span>
                                                <span className="font-medium text-slate-700 truncate max-w-[140px]" title={modalRegraSz1.conflito.desc_produto_existente}>
                                                    {modalRegraSz1.conflito.desc_produto_existente}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Cliente / Razão:</span>
                                                <span className="font-medium text-slate-700 truncate max-w-[140px]" title={modalRegraSz1.conflito.nome_cliente}>
                                                    {modalRegraSz1.conflito.nome_cliente}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3. Por que isso acontece? (Explicação da Regra) */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                                    Por que o Protheus não permite essa gravação?
                                </span>
                                <p className="leading-relaxed">
                                    {modalRegraSz1.motivo}
                                </p>
                            </div>

                            {/* 4. Soluções Disponíveis */}
                            <div className="space-y-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                                    Como você pode resolver:
                                </span>
                                <div className="space-y-1.5 text-xs text-slate-700">
                                    {modalRegraSz1.solucoes && modalRegraSz1.solucoes.map((sol, idx) => (
                                        <div key={idx} className="flex items-start gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                                            <span className="font-bold text-amber-600">{idx + 1}.</span>
                                            <span className="leading-relaxed">{sol.replace(/^[0-9]+\.\s*/, '')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer com botões de ação */}
                        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => setModalRegraSz1(null)}
                                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
                            >
                                Voltar e Corrigir Formulário
                            </button>

                            {modalRegraSz1.conflito?.produto_existente && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const codConflitante = modalRegraSz1.conflito.produto_existente;
                                        setModalRegraSz1(null);
                                        handleCarregarNoFormulario(codConflitante);
                                    }}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                                >
                                    <span>Abrir Produto Conflitante ({modalRegraSz1.conflito.produto_existente})</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

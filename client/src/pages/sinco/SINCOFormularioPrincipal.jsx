import { useState, useEffect, useCallback } from 'react';
import { Save, Search, FileText, Download, FileDigit, Settings, RefreshCw, Upload, FileSignature, Plus, X, Pencil, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api, { getSincoArvore, getSincoRestricoes, getSincoRestricoesSz0, createSincoRestricaoSz0, getSincoOperacoes, getSincoProduto, updateSincoProduto, updateSincoProductStructure, updateSincoRoteiro, updateSincoProdutoCliente, searchSincoProdutos, getProcessList, getClientes } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

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
    const [searchParams] = useSearchParams();
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

    // Automatic Calculation of Peso and Area Pintura
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
        try {
            const [rA, rR, rO, rSz0] = await Promise.all([
                getSincoArvore(codigoSemExtensao),
                getSincoRestricoes(codigoSemExtensao),
                getSincoOperacoes(codigoSemExtensao),
                getSincoRestricoesSz0(codigoSemExtensao),
            ]);
            setArvore(Array.isArray(rA) ? rA : []);
            setEditedArvore(Array.isArray(rA) ? JSON.parse(JSON.stringify(rA)) : []);
            setIsEditingArvore(false);
            setRestricoes(Array.isArray(rR) ? rR : []);
            const rOMapped = Array.isArray(rO) ? rO.map(o => ({...o, _original_operacao: o.operacao})) : [];
            setOperacoes(rOMapped);
            setRestricoesSz0(Array.isArray(rSz0) ? rSz0 : []);
        } catch (error) {
            console.error("Erro ao carregar dados do Protheus:", error);
            setErroProtheus(error.response?.data?.error || error.message || 'Erro desconhecido ao consultar');
            setArvore([]);
            setRestricoes([]);
            setOperacoes([]);
            setRestricoesSz0([]);
        } finally {
            setLoadingArvore(false);
            setLoadingRest(false);
            setLoadingOpe(false);
            setLoadingSz0(false);
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
            socket = io(socketUrl, { transports: ['websocket', 'polling'] });
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
        setDados({
            ...estadoVazio,
            arquivo: codigoSemExtensao,
            caminho: 'Busca via ERP',
        });

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
                    rev: p.rev || prev.rev,
                    espessura: p.espessura || prev.espessura,
                    largura: p.largura || prev.largura,
                    comprimento: p.comprimento || prev.comprimento,
                    area: p.area || prev.area
                }));
            }
        } catch (e) {
            console.warn(`Produto ${codigoSemExtensao} não encontrado no Protheus (SB1/SB5).`);
            showToast(`Produto ${codigoSemExtensao} não cadastrado. Criando novo...`, 'warning');
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
                    rev: p.rev || prev.rev,
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
            console.error('Erro ao salvar dados do produto:', error);
            setErroProtheus(error.response?.data?.details || error.message);
            showToast('Erro ao atualizar produto.', 'error');
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
            setRestricoesSz0(Array.isArray(rSz0) ? rSz0 : []);
        } catch (err) {
            showToast('Erro ao salvar restrição: ' + (err.response?.data?.error || err.response?.data?.message || err.message), 'error');
        } finally {
            setSavingSz0(false);
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
            // Recarrega os dados do ERP
            await carregarProtheus(produtoPai);
        } catch (err) {
            showToast('Erro ao salvar estrutura: ' + (err.response?.data?.error || err.response?.data?.details || err.message), 'error');
        } finally {
            setSavingArvore(false);
        }
    };

    const handleSalvarOperacoes = async () => {
        if (!temArquivo) return;
        const produtoPai = dados.arquivo.replace(/\.[^/.]+$/, '').trim().toUpperCase();

        // Se operacoes.length == 0 => Inclusão de roteiro (NOPER = 3)
        // Se operacoes.length > 0 => Alteração de roteiro (NOPER = 4)
        const noper = operacoes.length === 0 ? 3 : 4;

        // Construir o payload de operações
        const roteirosParaEnviar = [];

        for (let i = 0; i < operacoes.length; i++) {
            const original = operacoes[i];
            const editada = editedOperacoes.find(op => op._original_operacao === original.operacao && !op.isNew);
            
            if (!editada || editada.deleted) {
                // Foi excluída ou não existe mais
                roteirosParaEnviar.push({
                    G2_OPERAC: String(original.operacao).trim().padStart(2, '0'),
                    G2_DESCRI: (original.descricao || original.recurso_descricao || '').substring(0, 30),
                    G2_RECURSO: (original.recurso || '').trim(),
                    G2_FERRAM: "", G2_TPALOCF: "", G2_SETUP: Number(original.setup || 0), G2_FORMSTP: "", G2_LOTEPAD: 1,
                    G2_TEMPAD: Number(original.tempo || 0),
                    G2_TPOPER: "1", G2_TPSOBRE: "", G2_TEMPSOB: "", G2_CTRAB: "", G2_TEMPEND: "", G2_MAOOBRA: 1,
                    OPERACAO: "EXCLUIR"
                });
            } else if (String(editada.operacao).trim() !== String(original.operacao).trim()) {
                // Mudou o número da operação: Exclui a original e inclui a nova
                roteirosParaEnviar.push({
                    G2_OPERAC: String(original.operacao).trim().padStart(2, '0'),
                    G2_DESCRI: (original.descricao || original.recurso_descricao || '').substring(0, 30),
                    G2_RECURSO: (original.recurso || '').trim(),
                    G2_FERRAM: "", G2_TPALOCF: "", G2_SETUP: Number(original.setup || 0), G2_FORMSTP: "", G2_LOTEPAD: 1,
                    G2_TEMPAD: Number(original.tempo || 0),
                    G2_TPOPER: "1", G2_TPSOBRE: "", G2_TEMPSOB: "", G2_CTRAB: "", G2_TEMPEND: "", G2_MAOOBRA: 1,
                    OPERACAO: "EXCLUIR"
                });
                roteirosParaEnviar.push({
                    G2_OPERAC: String(editada.operacao).trim().padStart(2, '0'),
                    G2_DESCRI: (editada.descricao || editada.recurso_descricao || '').substring(0, 30),
                    G2_RECURSO: (editada.recurso || '').trim(),
                    G2_FERRAM: "", G2_TPALOCF: "", G2_SETUP: Number(editada.setup || 0), G2_FORMSTP: "", G2_LOTEPAD: 1,
                    G2_TEMPAD: Number(editada.tempo || 0),
                    G2_TPOPER: "1", G2_TPSOBRE: "", G2_TEMPSOB: "", G2_CTRAB: "", G2_TEMPEND: "", G2_MAOOBRA: 1,
                    OPERACAO: "INCLUIR"
                });
            } else {
                // Mesma operação, verifica se mudou algo
                if (
                    String(original.descricao || original.recurso_descricao || '').trim() !== String(editada.descricao || editada.recurso_descricao || '').trim() ||
                    String(original.recurso).trim() !== String(editada.recurso).trim() ||
                    Number(original.tempo) !== Number(editada.tempo) ||
                    Number(original.setup) !== Number(editada.setup)
                ) {
                    roteirosParaEnviar.push({
                        G2_OPERAC: String(editada.operacao).trim().padStart(2, '0'),
                        G2_DESCRI: (editada.descricao || editada.recurso_descricao || '').substring(0, 30),
                        G2_RECURSO: (editada.recurso || '').trim(),
                        G2_FERRAM: "", G2_TPALOCF: "", G2_SETUP: Number(editada.setup || 0), G2_FORMSTP: "", G2_LOTEPAD: 1,
                        G2_TEMPAD: Number(editada.tempo || 0),
                        G2_TPOPER: "1", G2_TPSOBRE: "", G2_TEMPSOB: "", G2_CTRAB: "", G2_TEMPEND: "", G2_MAOOBRA: 1,
                        OPERACAO: "ALTERAR"
                    });
                }
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
                    G2_FERRAM: "", G2_TPALOCF: "", G2_SETUP: Number(op.setup || 0), G2_FORMSTP: "", G2_LOTEPAD: 1,
                    G2_TEMPAD: Number(op.tempo || 0),
                    G2_TPOPER: "1", G2_TPSOBRE: "", G2_TEMPSOB: "", G2_CTRAB: "", G2_TEMPEND: "", G2_MAOOBRA: 1,
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
                NOPER: noper,
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
            await carregarProtheus(produtoPai);
        } catch (err) {
            console.error('❌ Falha ao salvar Roteiro:', err);
            showToast('Erro ao salvar roteiro: ' + (err.response?.data?.error || err.response?.data?.details || err.message), 'error');
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

        const noper = restricoes.length === 0 ? 3 : 4;
        
        // Filtramos os deletados e os que não tem cliente válido
        const validos = editedRestricoes.filter(r => !r.deleted && r.cliente && String(r.cliente).trim() !== '');

        if (validos.length === 0 && restricoes.length === 0) {
            showToast('Nenhuma mudança para salvar na tabela SZ1.', 'warning');
            setIsEditingRestricoes(false);
            return;
        }

        const payload = {
            data: {
                CFILANT: "0101",
                EMPRESA: "01",
                NOPER: noper,
                produtos_clientes: validos.map(r => ({
                    Z1_CLIENTE: String(r.cliente || '').trim(),
                    Z1_LOJA: String(r.loja || '0001').trim(),
                    Z1_PRODUTO: produto,
                    Z1_CODCLI: String(r.cod_cliente || '').trim(),
                    Z1_DESCCLI: String(r.desc_cliente || '').trim(),
                    Z1_REVISAO: String(r.revisao || '').trim()
                }))
            }
        };

        setSavingRestricoes(true);
        try {
            await updateSincoProdutoCliente(payload);
            showToast('Produtos x Cliente atualizados com sucesso no Protheus!', 'success');
            const res = await getSincoRestricoes(produto);
            setRestricoes(Array.isArray(res) ? res : []);
            setIsEditingRestricoes(false);
        } catch (err) {
            showToast('Erro ao salvar Produtos x Cliente: ' + (err.response?.data?.error || err.response?.data?.details || err.message), 'error');
        } finally {
            setSavingRestricoes(false);
        }
    };

    const materiais = isEditingArvore ? editedArvore : arvore; 
    const listOperacoes = isEditingOperacoes ? editedOperacoes : operacoes;
    const listRestricoes = isEditingRestricoes ? editedRestricoes : restricoes;

    const inputCls = "w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-slate-400";
    const readCls = "w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-sm font-mono text-slate-600";
    const lblCls = "block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1";
    const boxTitleCls = "text-xs font-semibold uppercase tracking-wider px-3 py-2 border-b";
    const thCls = "px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white sticky top-0 border-b border-slate-100";

    return (
        <div className="flex flex-col h-screen space-y-4 max-w-[1800px] mx-auto p-4 overflow-hidden">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">SINCO - Solid Edge - Lynx</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                            Web Version (MetalFisa 5 UI)
                        </span>
                        <span className="text-slate-400 text-xs">|</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1.5">
                            Arquivo Corrente:
                            {temArquivo && dados.caminho && dados.caminho !== estadoVazio.caminho ? (
                                <button
                                    title="Abrir no Solid Edge"
                                    onClick={() => {
                                        fetch('http://localhost:8080/api/solidedge/open-file', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ caminho: dados.caminho })
                                        }).catch(() => showToast('Agente Solid Edge não encontrado.\nInicie o INICIAR_AGENT.bat na sua máquina.', 'error'));
                                    }}
                                    className="font-mono text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0 text-xs">
                                    {dados.caminho}
                                </button>
                            ) : (
                                <strong className="text-slate-400 font-mono">{dados.caminho}</strong>
                            )}
                        </span>
                    </div>
                </div>

                {/* Filtro de Busca Manual e Botão de Atualizar Formulário */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAtualizarDados}
                        title="Emular recarregamento da página (atualiza dados do cabeçalho Protheus e as tabelas sem perder o último ERP e caminho)"
                        className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                    <div className="relative">
                        <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && buscarProdutoManual(busca)}
                            placeholder="Consultar Produto..."
                            className="w-56 pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                    <button
                        onClick={() => buscarProdutoManual(busca)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-blue-700 text-xs font-medium rounded-md transition-colors whitespace-nowrap"
                    >
                        Buscar ERP
                    </button>
                </div>
            </div>

            {/* Barra de Ferramentas */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-1.5 flex flex-wrap gap-1.5 items-center">
                <span className="text-xs font-medium text-slate-400 px-2 flex items-center gap-1.5">
                    Modo Solid Edge / Formulário
                </span>
            </div>

            {/* Erro de comunicação com Protheus */}
            {erroProtheus && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                    <span className="font-semibold whitespace-nowrap">Erro Protheus:</span>
                    <span className="font-mono break-all">{erroProtheus}</span>
                </div>
            )}

            {/* Layout do Formulário Principal - Limpo e Compacto */}
            <div className={`bg-white rounded-lg border flex flex-col shadow-sm overflow-hidden ${isEditingDadosGerais ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200'}`}>
                <div className={`${boxTitleCls} ${isEditingDadosGerais ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'} flex justify-between items-center`}>
                    <span>Dados Gerais do Produto</span>
                    <div className="flex items-center gap-2">
                        {temArquivo && !isEditingDadosGerais && (
                            <button
                                onClick={() => setIsEditingDadosGerais(true)}
                                className="flex items-center gap-1 px-2 py-1 text-slate-600 hover:text-amber-700 hover:bg-amber-100 rounded text-[10px] uppercase font-bold tracking-wide transition-colors"
                            >
                                <Pencil className="h-3 w-3" /> Editar
                            </button>
                        )}
                        {isEditingDadosGerais && (
                            <>
                                <button
                                    onClick={() => setIsEditingDadosGerais(false)}
                                    disabled={loadingData}
                                    className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded text-[10px] uppercase font-bold tracking-wide transition-colors disabled:opacity-50"
                                >
                                    <X className="h-3 w-3" /> Cancelar
                                </button>
                                <button
                                    onClick={handleSalvarProduto}
                                    disabled={loadingData}
                                    className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] uppercase font-bold tracking-wide transition-colors shadow-sm disabled:bg-slate-300 disabled:text-slate-500"
                                >
                                    <Save className="h-3 w-3" /> {loadingData ? 'Salvando...' : 'Salvar'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="p-4">
                    <div className="grid grid-cols-12 gap-x-4 gap-y-3">
                        {/* Linha 1 */}
                        <div className="col-span-2">
                            <label className={lblCls}>Tipo</label>
                            <input type="text" value={dados.tipo} onChange={e => setDados(p => ({ ...p, tipo: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-2">
                            <label className={lblCls}>Unidade</label>
                            <input type="text" value={dados.unidade} onChange={e => setDados(p => ({ ...p, unidade: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-3">
                            <label className={lblCls}>Grupo</label>
                            <input type="text" value={dados.grupo} onChange={e => setDados(p => ({ ...p, grupo: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-5">
                            <label className={lblCls}>Título</label>
                            <input type="text" value={dados.titulo} onChange={e => setDados(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: PORCA SEXT A6 INOX" readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>

                        {/* Linha 2 */}
                        <div className="col-span-3">
                            <label className={lblCls}>Num. Documento</label>
                            <input type="text" value={dados.arquivo} readOnly className={readCls} />
                        </div>
                        <div className="col-span-1">
                            <label className={lblCls}>Rev. Metalfisa</label>
                            <input type="text" value={dados.rev} onChange={e => setDados(p => ({ ...p, rev: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-2">
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
                                            
                                            // Atualiza no banco
                                            try {
                                                await api.post('/sinco/materiais-apoio', { nome: desc, densidade: val });
                                                // Atualiza local após sucesso
                                                const newMat = { nome: desc, densidade: val };
                                                setMateriaisSalvos(prev => [...prev.filter(m => m.nome !== desc), newMat].sort((a,b) => a.nome.localeCompare(b.nome)));
                                                setDados(p => ({ ...p, densidade: val }));
                                            } catch (err) {
                                                console.error(err);
                                                alert('Erro ao salvar no banco. Verifique sua conexão.');
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
                                    {/* Mostrar valor atual caso seja digitado manualmente e não esteja na lista */}
                                    {dados.densidade && !materiaisSalvos.some(m => Number(m.densidade) === Number(dados.densidade)) && (
                                        <option value={dados.densidade}>{dados.densidade} (Manual)</option>
                                    )}
                                    {materiaisSalvos.map(m => (
                                        <option key={m.nome} value={m.densidade}>{m.nome} ({Number(m.densidade).toFixed(2)})</option>
                                    ))}
                                    <option value="MANUAL">+ Digitar Manualmente...</option>
                                    <option value="ADD_NEW">+ Cadastrar Novo Material...</option>
                                </select>
                            ) : (
                                <input type="text" value={dados.densidade} readOnly className={readCls} />
                            )}
                        </div>
                        <div className="col-span-2">
                            <label className={lblCls}>Peso (kg)</label>
                            <input type="text" value={dados.peso || '0'} onChange={e => setDados(p => ({ ...p, peso: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-1">
                            <label className={lblCls}>Área (m²)</label>
                            <input type="text" value={dados.area || '0'} onChange={e => setDados(p => ({ ...p, area: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-1">
                            <label className={lblCls}>Espess. (mm)</label>
                            <input type="text" value={dados.espessura || '0'} onChange={e => setDados(p => ({ ...p, espessura: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-1">
                            <label className={lblCls}>Larg. (mm)</label>
                            <input type="text" value={dados.largura || '0'} onChange={e => setDados(p => ({ ...p, largura: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                        <div className="col-span-1">
                            <label className={lblCls}>Compr. (mm)</label>
                            <input type="text" value={dados.comprimento || '0'} onChange={e => setDados(p => ({ ...p, comprimento: e.target.value }))} readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>

                        {/* Linha 3 */}
                        <div className="col-span-12">
                            <label className={lblCls}>Comentários - Acabamento</label>
                            <input type="text" value={dados.acabamento} onChange={e => setDados(p => ({ ...p, acabamento: e.target.value }))} placeholder="Ex: CINZA N6,5 TEXTURIZADO - 80 MICRAS" readOnly={!isEditingDadosGerais} className={isEditingDadosGerais ? inputCls : readCls} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-tabelas: Árvore do Produto + Operações + Restrições SZ1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 pb-2">
                {/* 1. Árvore */}
                <div className={`bg-white rounded-lg border flex flex-col shadow-sm overflow-hidden h-full ${isEditingArvore ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-slate-200'}`}>
                    <div className={`${boxTitleCls} ${isEditingArvore ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'} flex justify-between items-center`}>
                        <span>Árvore do Produto (Materiais)</span>
                        <div className="flex items-center gap-2">
                            {temArquivo && !isEditingArvore && (
                                <button
                                    onClick={() => {
                                        setEditedArvore(JSON.parse(JSON.stringify(arvore)));
                                        setIsEditingArvore(true);
                                    }}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium rounded transition-colors shadow-sm"
                                >
                                    <Pencil className="h-3 w-3" /> Editar
                                </button>
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
                                        className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white text-[10px] font-medium rounded transition-colors shadow-sm"
                                    >
                                        <Save className="h-3 w-3" /> {savingArvore ? 'Salvando...' : 'Salvar'}
                                    </button>
                                </>
                            )}
                            <span className={`text-[10px] bg-white px-2 py-0.5 rounded border ${isEditingArvore ? 'border-indigo-200 text-indigo-600' : 'border-emerald-200 text-emerald-600'} font-mono`}>{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
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
                                                <td colSpan={isEditingArvore ? 6 : 5} className="text-center py-12 text-slate-400 italic">
                                                    Nenhum material carregado para a estrutura
                                                </td>
                                            </tr>
                                        ) : materiais.map((r, i) => (
                                            <tr key={i} className={`transition-colors ${r.deleted ? 'bg-red-50/50 opacity-50' : 'hover:bg-emerald-50/30'}`}>
                                                <td className="px-3 py-2 text-slate-400 font-medium">{r.nivel || (r.isNew ? 'NOVO' : '—')}</td>
                                                <td className="px-3 py-2 font-mono font-medium text-slate-700">
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
                                                <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={r.descricao}>
                                                    {r.isNew ? <span className="text-slate-400 italic">Produto a ser validado pelo Protheus</span> : <span className={r.deleted ? 'line-through text-red-500' : ''}>{r.descricao || '—'}</span>}
                                                </td>
                                                <td className="px-3 py-2 text-right">
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
                                                <td className="px-3 py-2 text-slate-500">{r.unidade || '—'}</td>
                                                {isEditingArvore && (
                                                    <td className="px-3 py-2 text-right">
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

                {/* 2. Restrições */}
                <div className={`bg-white rounded-lg border flex flex-col shadow-sm overflow-hidden h-full ${isEditingRestricoes ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200'}`}>
                    <div className={`${boxTitleCls} ${isEditingRestricoes ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-amber-50 text-amber-700 border-amber-100'} flex justify-between items-center`}>
                        <span>Produto Metalfisa/Cliente (SZ1)</span>
                        <div className="flex items-center gap-2">
                            {temArquivo && !isEditingRestricoes && (
                                <button
                                    onClick={() => {
                                        setEditedRestricoes(JSON.parse(JSON.stringify(restricoes)));
                                        setIsEditingRestricoes(true);
                                    }}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-medium rounded transition-colors shadow-sm"
                                >
                                    <Pencil className="h-3 w-3" /> Editar
                                </button>
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
                                        className="flex items-center gap-1 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white text-[10px] font-medium rounded transition-colors shadow-sm"
                                    >
                                        <Save className="h-3 w-3" /> {savingRestricoes ? 'Salvando...' : 'Salvar'}
                                    </button>
                                </>
                            )}
                            <span className={`text-[10px] bg-white px-2 py-0.5 rounded border ${isEditingRestricoes ? 'border-amber-300 text-amber-700' : 'border-amber-200 text-amber-600'} font-mono`}>{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
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
                                            <td colSpan={isEditingRestricoes ? 5 : 4} className="text-center py-12 text-slate-400 italic">
                                                Nenhuma restrição encontrada no Protheus
                                            </td>
                                        </tr>
                                    ) : listRestricoes.map((r, i) => (
                                        <tr key={i} className={`transition-colors ${r.deleted ? 'bg-red-50/50 opacity-50' : 'hover:bg-amber-50/30'}`}>
                                            <td className="px-3 py-2 font-mono font-medium text-slate-700 w-24">
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
                                            <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate" title={r.desc_cliente || r.nome_cliente}>
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
                                            <td className="px-3 py-2 font-mono text-slate-500">
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
                                            <td className="px-3 py-2 font-semibold text-amber-700 bg-amber-50/50 text-center w-16">
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
                                                <td className="px-3 py-2 text-right">
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

                {/* 3. Operações */}
                <div className={`bg-white rounded-lg border flex flex-col shadow-sm overflow-hidden h-full ${isEditingOperacoes ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-200'}`}>
                    <div className={`${boxTitleCls} ${isEditingOperacoes ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-blue-50 text-blue-700 border-blue-100'} flex justify-between items-center`}>
                        <span>Operações (Roteiro)</span>
                        <div className="flex items-center gap-2">
                            {temArquivo && !isEditingOperacoes && (
                                <button
                                    onClick={() => {
                                        setEditedOperacoes(JSON.parse(JSON.stringify(operacoes)));
                                        setIsEditingOperacoes(true);
                                    }}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium rounded transition-colors shadow-sm"
                                >
                                    <Pencil className="h-3 w-3" /> Editar
                                </button>
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
                                        className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-[10px] font-medium rounded transition-colors shadow-sm"
                                    >
                                        <Save className="h-3 w-3" /> {savingOperacoes ? 'Salvando...' : 'Salvar'}
                                    </button>
                                </>
                            )}
                            <span className={`text-[10px] bg-white px-2 py-0.5 rounded border ${isEditingOperacoes ? 'border-blue-300 text-blue-700' : 'border-blue-200 text-blue-600'} font-mono`}>{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
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
                                                <td colSpan={isEditingOperacoes ? 5 : 4} className="text-center py-12 text-slate-400 italic">
                                                    Nenhuma operação encontrada no Protheus
                                                </td>
                                            </tr>
                                        ) : listOperacoes.map((r, i) => (
                                            <tr key={i} className={`transition-colors ${r.deleted ? 'bg-red-50/50 opacity-50' : 'hover:bg-blue-50/30'}`}>
                                                <td className="px-3 py-2 font-mono font-medium text-slate-700 w-16">
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
                                                <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate" title={r.descricao || r.recurso_descricao}>
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
                                                <td className="px-3 py-2 font-mono text-slate-500">
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
                                                        <span className={r.deleted ? 'line-through text-red-500' : ''}>{r.recurso_descricao ? `${r.recurso} - ${r.recurso_descricao}` : (r.recurso || '—')}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right w-28">
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
                                                <td className="px-3 py-2 text-right w-28">
                                                    {isEditingOperacoes ? (
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            step="0.01"
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
                                                        <span className={`font-mono font-medium ${r.deleted ? 'line-through text-red-500' : 'text-blue-600 bg-blue-50/50 px-1 py-0.5 rounded'}`}>{Number(r.tempo || 0).toFixed(2)} min</span>
                                                    )}
                                                </td>
                                                {isEditingOperacoes && (
                                                    <td className="px-3 py-2 text-right">
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
                                                        setup: 0,
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
            </div>

            {/* 4. Restrições de Engenharia SZ0 */}
            <div className="bg-white rounded-lg border border-slate-200 flex flex-col shadow-sm overflow-hidden">
                <div className={`${boxTitleCls} bg-red-50 text-red-700 border-red-100 flex justify-between items-center`}>
                    <span>Restrições de Engenharia (SZ0){restricoesSz0.length > 0 && <span className="ml-2 text-[10px] bg-red-100 px-1.5 py-0.5 rounded-full font-bold">{restricoesSz0.length}</span>}</span>
                    <div className="flex items-center gap-2">
                        {temArquivo && (
                            <button
                                onClick={() => {
                                    setNovaRestricao({ resumo: '', restricao: '', responsavel: (user?.nome || user?.login || '').toUpperCase(), revMetalfisa: '' });
                                    setShowModalSz0(true);
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-medium rounded transition-colors shadow-sm"
                            >
                                <Plus className="h-3 w-3" /> Nova
                            </button>
                        )}
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-red-200 text-red-600 font-mono">{temArquivo ? dados.arquivo.replace(/\.[^/.]+$/, '') : '—'}</span>
                    </div>
                </div>
                <div className="overflow-auto bg-slate-50/50" style={{ maxHeight: '220px' }}>
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
                                            <td className="px-3 py-2 font-mono font-medium text-slate-700">{r.item}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${statusCls}`}>{statusLabel}</span>
                                            </td>
                                            <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={r.resumo}>{r.resumo || '—'}</td>
                                            <td className="px-3 py-2 text-slate-600 max-w-[300px] truncate" title={r.restricao}>{r.restricao || '—'}</td>
                                            <td className="px-3 py-2 font-mono text-slate-500 font-bold">{r.revisao || '—'}</td>
                                            <td className="px-3 py-2 font-mono text-slate-500">{r.responsavel || '—'}</td>
                                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{dtFormatted} {r.hr_ultima_alt || ''}</td>
                                            <td className="px-3 py-2 text-right">
                                                {temArquivo && (
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
                                                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                                        title="Editar restrição"
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </button>
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
                            <div className="relative">
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
                                    placeholder="Digite ao menos 3 letras e pressione Enter..."
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-shadow"
                                    autoFocus
                                />
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
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchClienteQuery}
                                    onChange={(e) => setSearchClienteQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && searchClienteQuery.length >= 3) {
                                            setSearchingCliente(true);
                                            getClientes(searchClienteQuery)
                                                .then(res => setSearchClienteResults(res || []))
                                                .catch(err => showToast("Erro ao buscar clientes", 'error'))
                                                .finally(() => setSearchingCliente(false));
                                        }
                                    }}
                                    placeholder="Digite ao menos 3 letras e pressione Enter..."
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            {searchingCliente ? (
                                <div className="flex justify-center items-center h-full text-sm text-slate-400">Buscando no Protheus...</div>
                            ) : searchClienteResults.length === 0 ? (
                                <div className="flex justify-center items-center h-full text-sm text-slate-400 italic">
                                    {searchClienteQuery.length >= 3 ? "Nenhum cliente/fornecedor encontrado." : "Aguardando busca."}
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

        </div>
    );
}

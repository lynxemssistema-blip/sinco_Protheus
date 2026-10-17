import React, { useState, useEffect } from 'react';
import { 
    FileText, Download, Printer, Building2, ShieldCheck, CheckCircle2, 
    Layers, Send, Calendar, DollarSign, Calculator, ChevronRight, 
    ChevronLeft, Plus, Edit3, Save, RefreshCw, Sliders, Users, 
    Sparkles, Laptop, Server, HardDrive, ExternalLink, Lock, Check,
    AlertCircle, FileSpreadsheet, Eye, ArrowRight, Activity, MapPin,
    Search, Filter, GitBranch, FileCheck, TrendingUp, Clock, X,
    SlidersHorizontal, CheckCircle, ChevronDown, BarChart3, PieChart,
    Settings, Trash2, Copy, FilePlus, Image as ImageIcon, Upload, FolderOpen,
    EyeOff
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

// Predefinições de Logotipos Oficiais para Co-Branding
const LYNX_LOGO_PRESETS = [
    { nome: 'Clássico Institucional', url: '/logos/lynx-ems-logo.jpg', desc: 'Logo padrão oficial' },
    { nome: 'Lynx Forest', url: '/logos/lynx-forest.png', desc: 'Verde Floresta' },
    { nome: 'Lynx Metal', url: '/logos/lynx-metal.png', desc: 'Chumbo Industrial' },
    { nome: 'Lynx Snow', url: '/logos/lynx-snow.png', desc: 'Clean / Branco' },
    { nome: 'Lynx Sublogo', url: '/logos/lynx-sublogo-forest.png', desc: 'Ícone condensado' }
];

const PARCEIRO_LOGO_PRESETS = [
    { nome: 'SIM Consultoria', url: '/logos/sim-consultoria-logo.png', razao: 'SIM Consultoria & Gestão Empresarial', papel: 'Consultoria Especializada em Implantação, Integração de ERPs & Governança de Processos' },
    { nome: 'Metalfisa', url: '/logos/metalfisa-logo.png', razao: 'Metalfisa Estruturas e Engenharia Ltda', papel: 'Fabricação e Montagem de Estruturas Metálicas' },
    { nome: 'Alfatec', url: '/logos/alfatec-logo.png', razao: 'Alfatec Engenharia e Automação', papel: 'Engenharia Térmica e Automação de Processos' },
    { nome: 'AMC', url: '/logos/amc-logo.png', razao: 'AMC Construções & Empreendimentos', papel: 'Obras Civis e Canteiros Industriais' },
    { nome: 'FLR', url: '/logos/flr-logo.png', razao: 'FLR Montagens Eletromecânicas', papel: 'Montagens Industriais e Elétricas' },
    { nome: 'Metta', url: '/logos/metta-logo.png', razao: 'Metta Soluções e Manutenção', papel: 'Gestão de Manutenção Fabril' }
];

export default function PropostaComercialSuperAdmin() {
    const { isSuperAdmin, user } = useAuth();
    
    // Estados principais
    const [propostas, setPropostas] = useState([]);
    const [selectedPropostaId, setSelectedPropostaId] = useState('irricom-2026');
    const [proposta, setProposta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('lista'); // 'lista', 'documento', 'edicao', 'slides', 'simulador', 'clientes'
    const [currentSlide, setCurrentSlide] = useState(0);
    const [saving, setSaving] = useState(false);
    const [generatingPptx, setGeneratingPptx] = useState(false);

    // Progressão de Investimento (12 ou 24 meses) em cada proposta
    const [progressaoMeses, setProgressaoMeses] = useState(12); // 12 ou 24 meses
    const [canteirosProjecao, setCanteirosProjecao] = useState(15);
    const [previewTabBloco5, setPreviewTabBloco5] = useState('temporal'); // 'temporal' | 'progressao'

    // Filtros e busca da Lista de Propostas
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [statusDropdownId, setStatusDropdownId] = useState(null);

    // Modal Nova Proposta com IA
    const [iaModalOpen, setIaModalOpen] = useState(false);
    const [iaLoading, setIaLoading] = useState(false);
    const [iaForm, setIaForm] = useState({
        nomeCliente: '',
        site: '',
        instagram: '',
        setor: '',
        focoOperacional: ''
    });

    // Modal Nova Proposta a partir do Modelo Padrão Parametrizado
    const [modeloModalOpen, setModeloModalOpen] = useState(false);
    const [modeloLoading, setModeloLoading] = useState(false);
    const [modeloForm, setModeloForm] = useState({
        cliente_nome: '',
        cliente_razao_social: '',
        cliente_site: '',
        cliente_instagram: '',
        setor: ''
    });

    // Modal Nova Revisão
    const [revisaoModalOpen, setRevisaoModalOpen] = useState(false);
    const [revisaoTarget, setRevisaoTarget] = useState(null);
    const [notasRevisao, setNotasRevisao] = useState('');
    const [revisaoLoading, setRevisaoLoading] = useState(false);

    // Modal de Exportação PDF
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfMode, setPdfMode] = useState('completo'); // 'completo', 'dossie', 'slides'
    const [generatingWord, setGeneratingWord] = useState(false);

    // Simulador de Canteiros
    const [salarioMinimoAtual, setSalarioMinimoAtual] = useState(1518.00); // Salário Mínimo vigente 2026
    const [simuladorCanteiros, setSimuladorCanteiros] = useState(15);

    // Gestão de Clientes Lynx
    const [clientesLynx, setClientesLynx] = useState([]);
    const [novoClienteModal, setNovoClienteModal] = useState(false);
    const [novoCliente, setNovoCliente] = useState({
        nome: '',
        razao_social: '',
        site: '',
        telefone: '',
        email: '',
        setor: '',
        cidade: '',
        uf: ''
    });

    // Sub-estados auxiliares para Adicionar Módulos e Itens de Infraestrutura na edição
    const [novoModuloFase1, setNovoModuloFase1] = useState({ nome: '', descricao: '', status: 'Contemplado (Imediato)' });
    const [novoModuloFase2, setNovoModuloFase2] = useState({ nome: '', status: 'Roadmap Futuro (Fora do escopo atual)' });
    const [novoItemInfra, setNovoItemInfra] = useState('');

    // Carregar Lista de Propostas
    const fetchPropostas = async (targetIdToSelect = null) => {
        try {
            setLoading(true);
            const res = await api.get('/propostas');
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                setPropostas(res.data);
                const currentId = targetIdToSelect || (res.data.some(p => p.id === selectedPropostaId) 
                    ? selectedPropostaId 
                    : res.data[0].id);
                await fetchPropostaDetalhe(currentId);
            } else {
                await fetchPropostaDetalhe('irricom-2026');
            }
        } catch (err) {
            console.warn('Erro ao carregar propostas, usando dados locais da Irricom:', err);
            await fetchPropostaDetalhe('irricom-2026');
        } finally {
            setLoading(false);
        }
    };

    // Carregar Detalhes de uma Proposta específica
    const fetchPropostaDetalhe = async (id) => {
        try {
            const res = await api.get(`/propostas/${id}`);
            if (res.data) {
                setProposta(res.data);
                setSelectedPropostaId(res.data.id);
                if (res.data.investimento?.sustentacao_mensal?.franquia_canteiros) {
                    setCanteirosProjecao(res.data.investimento.sustentacao_mensal.franquia_canteiros);
                    setSimuladorCanteiros(res.data.investimento.sustentacao_mensal.franquia_canteiros);
                }
            }
        } catch (err) {
            console.error('Erro ao buscar detalhes da proposta:', err);
        }
    };

    // Carregar Clientes Lynx
    const fetchClientesLynx = async () => {
        try {
            const res = await api.get('/propostas/clientes/lynx');
            if (res.data) setClientesLynx(res.data);
        } catch (err) {
            console.warn('Erro ao buscar clientes Lynx:', err);
        }
    };

    useEffect(() => {
        fetchPropostas();
        fetchClientesLynx();
    }, []);

    // Atualizar Status da Proposta
    const handleUpdateStatus = async (propostaId, novoStatus) => {
        try {
            await api.put(`/propostas/${propostaId}/status`, { status: novoStatus });
            toast.success(`Status da proposta alterado para "${novoStatus.replace('_', ' ').toUpperCase()}"`);
            setStatusDropdownId(null);
            
            // Atualiza localmente
            setPropostas(prev => prev.map(p => p.id === propostaId ? { ...p, status: novoStatus } : p));
            if (proposta && proposta.id === propostaId) {
                setProposta(prev => ({ ...prev, status: novoStatus }));
            }
        } catch (err) {
            console.error('Erro ao atualizar status:', err);
            toast.error('Erro ao atualizar status: ' + (err.response?.data?.error || err.message));
        }
    };

    // Abrir Proposta no Dossiê
    const handleVisualizarDossie = (propId) => {
        fetchPropostaDetalhe(propId);
        setActiveTab('documento');
    };

    // Abrir Proposta na Edição/Parametrização
    const handleAbrirEdicao = (propId) => {
        fetchPropostaDetalhe(propId);
        setActiveTab('edicao');
    };

    // Abrir Proposta nos Slides
    const handleVisualizarSlides = (propId) => {
        fetchPropostaDetalhe(propId);
        setCurrentSlide(0);
        setActiveTab('slides');
    };

    // Criar Proposta a partir do Modelo Mestre Parametrizado
    const handleCriarDeModeloPadrao = async (e) => {
        e.preventDefault();
        if (!modeloForm.cliente_nome) {
            toast.warn('Informe o nome do cliente!');
            return;
        }

        setModeloLoading(true);
        try {
            const res = await api.post('/propostas/criar-de-template', modeloForm);
            toast.success(`Proposta criada a partir do Modelo Padrão para ${res.data.cliente_nome}!`);
            setModeloModalOpen(false);
            setModeloForm({ cliente_nome: '', cliente_razao_social: '', cliente_site: '', cliente_instagram: '', setor: '' });
            await fetchPropostas(res.data.id);
            setActiveTab('edicao'); // Abre direto na tela de parametrização
        } catch (err) {
            console.error('Erro ao criar do modelo:', err);
            toast.error('Falha ao criar proposta: ' + (err.response?.data?.error || err.message));
        } finally {
            setModeloLoading(false);
        }
    };

    // Disparar Criação com IA
    const handleGerarComIA = async (e) => {
        e.preventDefault();
        if (!iaForm.nomeCliente && !iaForm.site) {
            toast.warn('Preencha ao menos o nome do cliente ou o site!');
            return;
        }

        setIaLoading(true);
        try {
            const res = await api.post('/propostas/gerar-com-ia', iaForm);
            toast.success(`Proposta personalizada para ${res.data.cliente_nome} gerada com IA!`);
            setIaModalOpen(false);
            setIaForm({ nomeCliente: '', site: '', instagram: '', setor: '', focoOperacional: '' });
            
            // Recarrega lista e seleciona a nova proposta na aba de edição
            await fetchPropostas(res.data.id);
            setActiveTab('edicao');
        } catch (err) {
            console.error('Erro na geração com IA:', err);
            toast.error('Falha ao gerar proposta: ' + (err.response?.data?.error || err.message));
        } finally {
            setIaLoading(false);
        }
    };

    // Abrir Modal de Criação de Revisão
    const handleAbrirModalRevisao = (prop) => {
        setRevisaoTarget(prop);
        const match = (prop.revisao || 'Rev 00').match(/Rev\s*(\d+)/i);
        const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
        setNotasRevisao(`Revisão ${String(nextNum).padStart(2, '0')}: Ajuste de premissas e escopo.`);
        setRevisaoModalOpen(true);
    };

    // Confirmar Criação de Nova Revisão
    const handleConfirmarNovaRevisao = async (e) => {
        e.preventDefault();
        if (!revisaoTarget) return;

        setRevisaoLoading(true);
        try {
            const res = await api.post(`/propostas/${revisaoTarget.id}/criar-revisao`, {
                notas_revisao: notasRevisao
            });
            toast.success(`Nova versão ${res.data.revisao} criada para ${res.data.cliente_nome}!`);
            setRevisaoModalOpen(false);
            await fetchPropostas(res.data.id);
            setActiveTab('edicao');
        } catch (err) {
            console.error('Erro ao criar revisão:', err);
            toast.error('Falha ao criar revisão: ' + (err.response?.data?.error || err.message));
        } finally {
            setRevisaoLoading(false);
        }
    };

    // Executar Impressão/PDF
    const handleExecutarPrint = () => {
        setPdfModalOpen(false);
        if (pdfMode === 'slides') {
            setActiveTab('slides');
        } else {
            setActiveTab('documento');
        }
        setTimeout(() => {
            window.print();
        }, 350);
    };

    // Salvar TODAS as edições/parametrizações individuais na proposta
    const handleSalvarEdicoes = async () => {
        if (!proposta) return;
        setSaving(true);
        try {
            const propostaParaSalvar = {
                ...proposta,
                setup_total: totalSetupGeral,
                investimento: {
                    ...proposta.investimento,
                    cronograma_pagamento: {
                        ...(proposta.investimento?.cronograma_pagamento || {}),
                        data_aceite: dataAceiteSimulacao,
                        carencia_dias: carenciaEfetivaDias,
                        parcelas_setup: parcelasSetup,
                        fracao1_valor: parcelasSetup[0]?.valor || 0,
                        fracao1_dias: parcelasSetup[0]?.dias_apos_aceite || 60,
                        fracao1_dias_vencimento: parcelasSetup[0]?.dias_vencimento || 10,
                        fracao2_valor: parcelasSetup[1]?.valor || 0,
                        fracao2_dias: parcelasSetup[1]?.dias_apos_aceite || 90,
                        fracao2_dias_vencimento: parcelasSetup[1]?.dias_vencimento || 10,
                        mensalidade_dia_emissao: mensalidadeDiaEmissao,
                        mensalidade_dia_vencimento: mensalidadeDiaVencto,
                        incluir_tabela_pdf: incluirTabelaPdf,
                        incluir_tabela_word: incluirTabelaWord,
                        incluir_tabela_pptx: incluirTabelaPptx
                    },
                    setup_fase_agil: {
                        ...(proposta.investimento?.setup_fase_agil || {}),
                        mes1_valor: parcelasSetup[0]?.valor || 0,
                        mes2_valor: parcelasSetup[1]?.valor || 0,
                        total: totalSetupGeral
                    }
                }
            };
            await api.put(`/propostas/${proposta.id}`, propostaParaSalvar);
            toast.success(`Proposta de ${proposta.cliente_nome} parametrizada e salva com sucesso!`);
            fetchPropostas(proposta.id);
        } catch (err) {
            console.error('Erro ao salvar parametrizações:', err);
            toast.error('Erro ao salvar proposta: ' + (err.response?.data?.error || err.message));
        } finally {
            setSaving(false);
        }
    };

    // Upload de imagem do computador para o Logotipo da Lynx ou da Parceira
    const handleUploadLogo = (e, tipo) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG).');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.warning('A imagem selecionada é maior que 5MB. Recomendamos imagens de até 2MB.');
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result;
            if (tipo === 'fornecedor') {
                setProposta(prev => ({
                    ...prev,
                    fornecedor: {
                        ...(prev.fornecedor || {}),
                        logo_url: base64Data
                    }
                }));
                toast.success('Logotipo da Lynx atualizado com sucesso!');
            } else {
                setProposta(prev => ({
                    ...prev,
                    empresa_parceira: {
                        ...(prev.empresa_parceira || {}),
                        logo_url: base64Data
                    }
                }));
                toast.success(`Logotipo da ${proposta?.empresa_parceira?.nome || 'Empresa Parceira'} atualizado!`);
            }
        };
        reader.onerror = () => {
            toast.error('Erro ao ler a imagem selecionada.');
        };
        reader.readAsDataURL(file);
    };

    // Regerar PowerPoint
    const handleRegerarPptx = async () => {
        if (!proposta) return;
        setGeneratingPptx(true);
        try {
            await api.post(`/propostas/${proposta.id}/gerar-pptx`, proposta);
            toast.success('Apresentação PowerPoint regerada com sucesso com os dados atualizados!');
        } catch (err) {
            console.error('Erro ao regerar PPTX:', err);
            toast.error('Erro ao regerar PPTX: ' + (err.response?.data?.error || err.message));
        } finally {
            setGeneratingPptx(false);
        }
    };

    // Regerar Documento Word (.docx) sob demanda
    const handleRegerarWord = async () => {
        if (!proposta) return;
        setGeneratingWord(true);
        try {
            const res = await api.post(`/propostas/${proposta.id}/gerar-word`, proposta);
            toast.success('Documento Word (.docx) gerado com sucesso com logotipo da Lynx e SIM Consultoria!');
            if (res.data?.download_url) {
                const link = document.createElement('a');
                link.href = res.data.download_url;
                link.download = res.data.filename || `Proposta_Comercial_SINCO_${proposta.cliente_nome}.docx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            console.error('Erro ao gerar Word:', err);
            toast.error('Erro ao gerar Word: ' + (err.response?.data?.error || err.message));
        } finally {
            setGeneratingWord(false);
        }
    };

    // Funções de Manipulação de Módulos e Escopo na Edição
    const handleAdicionarModuloFase1 = () => {
        if (!novoModuloFase1.nome) return toast.warn('Informe o nome do módulo!');
        const novo = {
            id: novoModuloFase1.nome.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            ...novoModuloFase1
        };
        setProposta({
            ...proposta,
            escopo_fase1: [...(proposta.escopo_fase1 || []), novo]
        });
        setNovoModuloFase1({ nome: '', descricao: '', status: 'Contemplado (Imediato)' });
    };

    const handleRemoverModuloFase1 = (index) => {
        const list = [...(proposta.escopo_fase1 || [])];
        list.splice(index, 1);
        setProposta({ ...proposta, escopo_fase1: list });
    };

    const handleAdicionarModuloFase2 = () => {
        if (!novoModuloFase2.nome) return toast.warn('Informe o nome do módulo futuro!');
        const novo = {
            id: novoModuloFase2.nome.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            ...novoModuloFase2
        };
        setProposta({
            ...proposta,
            escopo_fase2: [...(proposta.escopo_fase2 || []), novo]
        });
        setNovoModuloFase2({ nome: '', status: 'Roadmap Futuro (Fora do escopo atual)' });
    };

    const handleRemoverModuloFase2 = (index) => {
        const list = [...(proposta.escopo_fase2 || [])];
        list.splice(index, 1);
        setProposta({ ...proposta, escopo_fase2: list });
    };

    const handleAdicionarItemInfra = () => {
        if (!novoItemInfra.trim()) return;
        setProposta({
            ...proposta,
            infraestrutura: [...(proposta.infraestrutura || []), novoItemInfra.trim()]
        });
        setNovoItemInfra('');
    };

    const handleRemoverItemInfra = (index) => {
        const list = [...(proposta.infraestrutura || [])];
        list.splice(index, 1);
        setProposta({ ...proposta, infraestrutura: list });
    };

    // Cadastrar Novo Cliente
    const handleCadastrarCliente = async (e) => {
        e.preventDefault();
        try {
            await api.post('/propostas/clientes/lynx', novoCliente);
            toast.success(`Cliente ${novoCliente.nome} cadastrado com sucesso!`);
            setNovoClienteModal(false);
            setNovoCliente({ nome: '', razao_social: '', site: '', telefone: '', email: '', setor: '', cidade: '', uf: '' });
            fetchClientesLynx();
        } catch (err) {
            toast.error('Erro ao cadastrar cliente: ' + (err.response?.data?.error || err.message));
        }
    };

    // Helper de Manipulação de Datas para o Cronograma Temporal
    const parseDataStr = (str) => {
        if (!str) return new Date(2026, 9, 5); // 05/10/2026 padrão
        const clean = String(str).trim();
        const parts = clean.includes('-') ? clean.split('-') : clean.split('/');
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // YYYY-MM-DD
                return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            } else {
                // DD/MM/YYYY
                return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            }
        }
        return new Date(clean);
    };

    const formatDataBR = (dateObj) => {
        if (!dateObj || isNaN(dateObj.getTime())) return '-';
        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const y = dateObj.getFullYear();
        return `${d}/${m}/${y}`;
    };

    const addDias = (dateObj, dias) => {
        const res = new Date(dateObj.getTime());
        res.setDate(res.getDate() + Number(dias));
        return res;
    };

    // Parâmetros de Investimento e Cronograma Temporal Parametrizados
    const crono = proposta?.investimento?.cronograma_pagamento || {};
    const dataAceiteSimulacao = crono.data_aceite || proposta?.data_proposta || '2026-10-05';
    const mensalidadeDiaEmissao = Number(crono.mensalidade_dia_emissao) || 28;
    const mensalidadeDiaVencto = Number(crono.mensalidade_dia_vencimento) || 10;
    const incluirTabelaPdf = crono.incluir_tabela_pdf !== false;
    const incluirTabelaWord = crono.incluir_tabela_word !== false;
    const incluirTabelaPptx = crono.incluir_tabela_pptx !== false;

    // Parcelas dinâmicas de Setup / Implantação / MVP
    const parcelasSetupPadrao = [
        {
            id: 'p1',
            nome: '1ª Fração - Implantação Piloto & MVP',
            dias_apos_aceite: Number(crono.carencia_dias || crono.fracao1_dias || 60),
            valor: Number(crono.fracao1_valor ?? proposta?.investimento?.setup_fase_agil?.mes1_valor ?? 16520.60),
            dias_vencimento: Number(crono.fracao1_dias_vencimento || 10)
        },
        {
            id: 'p2',
            nome: '2ª Fração - Homologação & Quitação Setup',
            dias_apos_aceite: Number(crono.fracao2_dias || 90),
            valor: Number(crono.fracao2_valor ?? proposta?.investimento?.setup_fase_agil?.mes2_valor ?? 16520.60),
            dias_vencimento: Number(crono.fracao2_dias_vencimento || 10)
        }
    ];

    const parcelasSetup = (Array.isArray(crono.parcelas_setup) && crono.parcelas_setup.length > 0)
        ? crono.parcelas_setup
        : parcelasSetupPadrao;

    const totalSetupGeral = parcelasSetup.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const primeiraParcela = parcelasSetup[0] || { dias_apos_aceite: 60, valor: 16520.60, dias_vencimento: 10 };
    const carenciaEfetivaDias = Number(primeiraParcela.dias_apos_aceite) || 60;
    const carenciaDias = carenciaEfetivaDias;

    const setupM1 = Number(parcelasSetup[0]?.valor) || 0;
    const setupM2 = Number(parcelasSetup[1]?.valor) || 0;
    const fracao1Valor = setupM1;
    const fracao2Valor = setupM2;
    const fracao1DiasVencto = Number(parcelasSetup[0]?.dias_vencimento) || 10;
    const fracao2Dias = Number(parcelasSetup[1]?.dias_apos_aceite) || 90;
    const fracao2DiasVencto = Number(parcelasSetup[1]?.dias_vencimento) || 10;

    const baseSM = Number(proposta?.investimento?.sustentacao_mensal?.valor_base_salarios_minimos) || 6;
    const franquiaCanteiros = Number(proposta?.investimento?.sustentacao_mensal?.franquia_canteiros) || 15;
    const extraSM = Number(proposta?.investimento?.sustentacao_mensal?.acrescimo_por_canteiro_extra_sm) || 0.5;

    // Sincronizador de campos escalares do cronograma
    const handleAtualizarCronograma = (campo, valor) => {
        if (!proposta) return;
        const cronoAtual = proposta.investimento?.cronograma_pagamento || {};
        const novoCrono = { ...cronoAtual, [campo]: valor };
        
        // Se alterou a carência, sincroniza os dias da 1ª parcela
        let novasParcelas = parcelasSetup;
        if (campo === 'carencia_dias' && parcelasSetup.length > 0) {
            novasParcelas = parcelasSetup.map((p, idx) => idx === 0 ? { ...p, dias_apos_aceite: Number(valor) } : p);
            novoCrono.parcelas_setup = novasParcelas;
            novoCrono.fracao1_dias = Number(valor);
        }

        setProposta({
            ...proposta,
            investimento: {
                ...proposta.investimento,
                cronograma_pagamento: novoCrono
            }
        });
    };

    // Atualização de uma parcela específica (em tempo real)
    const handleAtualizarParcela = (index, campo, valor) => {
        if (!proposta) return;
        const novasParcelas = parcelasSetup.map((p, idx) => {
            if (idx === index) {
                return { 
                    ...p, 
                    [campo]: (campo === 'valor' || campo === 'dias_apos_aceite' || campo === 'dias_vencimento') 
                        ? Number(valor) 
                        : valor 
                };
            }
            return p;
        });

        const novoTotalSetup = novasParcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
        const novoCrono = { 
            ...(proposta.investimento?.cronograma_pagamento || {}),
            parcelas_setup: novasParcelas,
            fracao1_valor: novasParcelas[0]?.valor || 0,
            fracao1_dias: novasParcelas[0]?.dias_apos_aceite || 60,
            carencia_dias: novasParcelas[0]?.dias_apos_aceite || 60,
            fracao1_dias_vencimento: novasParcelas[0]?.dias_vencimento || 10,
            fracao2_valor: novasParcelas[1]?.valor || 0,
            fracao2_dias: novasParcelas[1]?.dias_apos_aceite || 90,
            fracao2_dias_vencimento: novasParcelas[1]?.dias_vencimento || 10
        };

        const novoSetup = {
            ...(proposta.investimento?.setup_fase_agil || {}),
            mes1_valor: novasParcelas[0]?.valor || 0,
            mes2_valor: novasParcelas[1]?.valor || 0,
            total: novoTotalSetup
        };

        setProposta({
            ...proposta,
            setup_total: novoTotalSetup,
            investimento: {
                ...proposta.investimento,
                setup_fase_agil: novoSetup,
                cronograma_pagamento: novoCrono
            }
        });
    };

    // Adicionar nova parcela de implantação/MVP
    const handleAdicionarParcela = () => {
        if (!proposta) return;
        const ultParcela = parcelasSetup[parcelasSetup.length - 1];
        const proxNumero = parcelasSetup.length + 1;
        const proxDias = ultParcela ? Number(ultParcela.dias_apos_aceite) + 30 : 120;
        
        const novaParcela = {
            id: `p_${Date.now()}`,
            nome: `${proxNumero}ª Fração - Expansão Implantação & MVP`,
            dias_apos_aceite: proxDias,
            valor: 10000,
            dias_vencimento: 10
        };

        const novasParcelas = [...parcelasSetup, novaParcela];
        const novoTotalSetup = novasParcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
        
        const novoCrono = {
            ...(proposta.investimento?.cronograma_pagamento || {}),
            parcelas_setup: novasParcelas,
            fracao1_valor: novasParcelas[0]?.valor || 0,
            fracao2_valor: novasParcelas[1]?.valor || 0
        };

        const novoSetup = {
            ...(proposta.investimento?.setup_fase_agil || {}),
            mes1_valor: novasParcelas[0]?.valor || 0,
            mes2_valor: novasParcelas[1]?.valor || 0,
            total: novoTotalSetup
        };

        setProposta({
            ...proposta,
            setup_total: novoTotalSetup,
            investimento: {
                ...proposta.investimento,
                setup_fase_agil: novoSetup,
                cronograma_pagamento: novoCrono
            }
        });

        toast.success(`Parcela ${proxNumero} adicionada ao cronograma de implantação!`);
    };

    // Remover parcela de implantação/MVP
    const handleRemoverParcela = (index) => {
        if (!proposta || parcelasSetup.length <= 1) {
            toast.warn('A proposta deve conter ao menos 1 parcela de implantação/setup.');
            return;
        }

        const novasParcelas = parcelasSetup.filter((_, idx) => idx !== index);
        const novoTotalSetup = novasParcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

        const novoCrono = {
            ...(proposta.investimento?.cronograma_pagamento || {}),
            parcelas_setup: novasParcelas,
            fracao1_valor: novasParcelas[0]?.valor || 0,
            fracao1_dias: novasParcelas[0]?.dias_apos_aceite || 60,
            carencia_dias: novasParcelas[0]?.dias_apos_aceite || 60,
            fracao2_valor: novasParcelas[1]?.valor || 0,
            fracao2_dias: novasParcelas[1]?.dias_apos_aceite || 90
        };

        const novoSetup = {
            ...(proposta.investimento?.setup_fase_agil || {}),
            mes1_valor: novasParcelas[0]?.valor || 0,
            mes2_valor: novasParcelas[1]?.valor || 0,
            total: novoTotalSetup
        };

        setProposta({
            ...proposta,
            setup_total: novoTotalSetup,
            investimento: {
                ...proposta.investimento,
                setup_fase_agil: novoSetup,
                cronograma_pagamento: novoCrono
            }
        });

        toast.info('Parcela removida do cronograma.');
    };

    // Cálculo Simulador de Canteiros
    const canteirosExcedentesSimulador = Math.max(0, simuladorCanteiros - franquiaCanteiros);
    const smTotaisSimulador = baseSM + (canteirosExcedentesSimulador * extraSM);
    const valorMensalidadeSimulador = smTotaisSimulador * salarioMinimoAtual;

    // Projeção Mensalidade Sustentação
    const canteirosMesProjecao = canteirosProjecao || franquiaCanteiros;
    const extrasProjecao = Math.max(0, canteirosMesProjecao - franquiaCanteiros);
    const smTotaisProjecao = baseSM + (extrasProjecao * extraSM);
    const mensalidadeSustentacaoProjecao = proposta?.investimento?.sustentacao_mensal?.valor_mensal
        ? Number(proposta.investimento.sustentacao_mensal.valor_mensal)
        : smTotaisProjecao * salarioMinimoAtual;

    // Construção dos Marcos Temporais de Pagamento Dinâmicos
    const dAceite = parseDataStr(dataAceiteSimulacao);

    // Ordena as parcelas de setup cronologicamente
    const parcelasOrdenadas = [...parcelasSetup].sort((a, b) => Number(a.dias_apos_aceite) - Number(b.dias_apos_aceite));
    const temEntradaDia0 = parcelasOrdenadas.some(p => Number(p.dias_apos_aceite) === 0);
    const parcelaEntrada = parcelasOrdenadas.find(p => Number(p.dias_apos_aceite) === 0);
    const valorEntrada = parcelaEntrada ? (Number(parcelaEntrada.valor) || 0) : 0;
    const venctoEntrada = parcelaEntrada ? (Number(parcelaEntrada.dias_vencimento) || 5) : 5;

    const marcosTemporais = [];

    if (!temEntradaDia0) {
        marcosTemporais.push({
            marco: 'Dia 0',
            dataEstimada: formatDataBR(dAceite),
            tag: 'Aceite Formal',
            evento: 'Aceite da Proposta & Início dos Trabalhos',
            objeto: 'Assinatura contratual e kick-off de imersão e desenvolvimento MVP',
            emissaoNf: '—',
            vencimentoNf: '—',
            regra: `Carência Comercial de ${carenciaEfetivaDias} Dias (Sem desembolso imediato - R$ 0,00)`,
            tipo: 'carencia',
            valorSetup: 0,
            valorMensalidade: 0,
            valorTotal: 0
        });
    }

    // Para cada parcela de setup, gera o marco de emissão da parcela e a mensalidade associada
    parcelasOrdenadas.forEach((parc, idx) => {
        const dEmissao = addDias(dAceite, parc.dias_apos_aceite);
        const dVencto = addDias(dEmissao, parc.dias_vencimento || 10);
        const isEntrada = Number(parc.dias_apos_aceite) === 0;

        marcosTemporais.push({
            marco: isEntrada ? 'No Aceite (Entrada)' : `Dia ${parc.dias_apos_aceite}`,
            dataEstimada: formatDataBR(dEmissao),
            tag: isEntrada ? 'Entrada' : `${idx + 1}ª Fração Setup`,
            evento: `Emissão NF ${parc.nome || (isEntrada ? 'Entrada Contratual' : `${idx + 1}ª Fração Setup`)}`,
            objeto: isEntrada 
                ? 'Entrada facilitada com início imediato do diagnóstico e configuração'
                : `Fração de Setup (${idx + 1}/${parcelasOrdenadas.length}) com entrega e evolução dos módulos`,
            emissaoNf: formatDataBR(dEmissao),
            vencimentoNf: formatDataBR(dVencto),
            regra: isEntrada 
                ? `À vista em até ${parc.dias_vencimento || 5} dias após assinatura`
                : `${parc.dias_vencimento || 10} dias após a emissão da NF`,
            tipo: 'setup',
            valorSetup: Number(parc.valor) || 0,
            valorMensalidade: 0,
            valorTotal: Number(parc.valor) || 0
        });

        // Mensalidade do mês corrente da parcela (apenas a partir do ciclo operacional > dia 0)
        if (!isEntrada) {
            const mesP = dEmissao.getMonth();
            const anoP = dEmissao.getFullYear();
            const dMensEmissao = new Date(anoP, mesP, mensalidadeDiaEmissao);
            const dMensVencto = new Date(anoP, mesP + 1, mensalidadeDiaVencto);

            marcosTemporais.push({
                marco: `Mês Corrente (${formatDataBR(dMensEmissao).slice(3)})`,
                dataEstimada: formatDataBR(dMensEmissao),
                tag: `${idx + 1}ª Mensalidade`,
                evento: `Emissão NF ${idx + 1}ª Mensalidade (Sustentação SaaS)`,
                objeto: 'Infraestrutura nuvem, licenças ilimitadas e suporte técnico',
                emissaoNf: formatDataBR(dMensEmissao),
                vencimentoNf: formatDataBR(dMensVencto),
                regra: `Emissão dia ${mensalidadeDiaEmissao} c/ vencto dia ${mensalidadeDiaVencto} próx. mês`,
                tipo: 'mensalidade',
                valorSetup: 0,
                valorMensalidade: mensalidadeSustentacaoProjecao,
                valorTotal: mensalidadeSustentacaoProjecao
            });
        }
    });

    // Marco de Recorrência Regular
    marcosTemporais.push({
        marco: 'Ciclo Recorrente Regular',
        dataEstimada: 'Recorrência Mensal',
        tag: 'Sustentação Contínua',
        evento: 'Mensalidade Regular Exclusiva (Sustentação & Licenças)',
        objeto: `Apenas mensalidade SaaS (${franquiaCanteiros} canteiros inclusos • Setup 100% quitado)`,
        emissaoNf: `Todo dia ${mensalidadeDiaEmissao} de cada mês`,
        vencimentoNf: `Todo dia ${mensalidadeDiaVencto} do mês subsequente`,
        regra: 'Faturamento recorrente previsível com controle total de canteiros',
        tipo: 'recorrencia',
        valorSetup: 0,
        valorMensalidade: mensalidadeSustentacaoProjecao,
        valorTotal: mensalidadeSustentacaoProjecao
    });

    // Cálculo da Tabela de Progressão Mês a Mês (12 ou 24 Meses) Refletindo as Parcelas Reais
    const mesPrimeiraParcela = Math.max(1, Math.ceil(carenciaEfetivaDias / 30));
    
    // Mapeamento de parcelas por mês de competência (a cada 30 dias após aceite)
    const parcelasPorMes = {};
    parcelasOrdenadas.forEach((parc) => {
        const mesCompetencia = Math.max(1, Math.ceil(Number(parc.dias_apos_aceite) / 30));
        if (!parcelasPorMes[mesCompetencia]) parcelasPorMes[mesCompetencia] = [];
        parcelasPorMes[mesCompetencia].push(parc);
    });

    const linhasProgressao = [];
    let acumulador = 0;
    for (let m = 1; m <= progressaoMeses; m++) {
        let vSetup = 0;
        let vSustentacao = 0;
        let descFase = '';
        let canteirosInfo = '';

        const parcelasDoMes = parcelasPorMes[m] || [];
        if (parcelasDoMes.length > 0) {
            vSetup = parcelasDoMes.reduce((s, p) => s + (Number(p.valor) || 0), 0);
        }

        if (m < mesPrimeiraParcela) {
            // Mês anterior à primeira parcela: Carência comercial R$ 0
            vSetup = 0;
            vSustentacao = 0;
            descFase = 'Setup • Carência Comercial & Imersão Técnica';
            canteirosInfo = 'N/A (Carência Comercial)';
        } else if (vSetup > 0) {
            // Mês com parcela(s) de setup
            vSustentacao = mensalidadeSustentacaoProjecao;
            const nomes = parcelasDoMes.map(p => p.nome).join(' + ');
            descFase = `Setup • ${nomes} + Mensalidade`;
            canteirosInfo = `${canteirosMesProjecao} canteiros ${extrasProjecao > 0 ? `(+${extrasProjecao} extras)` : '(Franquia)'}`;
        } else {
            // Mês apenas de sustentação SaaS
            vSetup = 0;
            vSustentacao = mensalidadeSustentacaoProjecao;
            descFase = 'Sustentação Operacional SaaS Recorrente';
            canteirosInfo = `${canteirosMesProjecao} canteiros ${extrasProjecao > 0 ? `(+${extrasProjecao} extras)` : '(Franquia)'}`;
        }

        const totalMes = vSetup + vSustentacao;
        acumulador += totalMes;
        linhasProgressao.push({
            mes: m,
            fase: descFase,
            canteiros: canteirosInfo,
            setup: vSetup,
            sustentacao: vSustentacao,
            total: totalMes,
            acumulado: acumulador
        });
    }

    const mesesSustentacao = Math.max(0, progressaoMeses - (mesPrimeiraParcela - 1));
    const totalSustentacaoGeral = mensalidadeSustentacaoProjecao * mesesSustentacao;
    const totalInvestimentoGeral = totalSetupGeral + totalSustentacaoGeral;
    const mediaMensalDiluida = totalInvestimentoGeral / progressaoMeses;
    const custoPorCanteiroMes = canteirosMesProjecao > 0 ? (totalInvestimentoGeral / progressaoMeses / canteirosMesProjecao) : 0;

    // Métricas para a Lista de Propostas
    const totalPropostas = propostas.length;
    const propostasAprovadas = propostas.filter(p => p.status === 'aprovada').length;
    const propostasEmAnalise = propostas.filter(p => p.status === 'enviada' || p.status === 'em_analise').length;
    const valorTotalSetup = propostas.reduce((acc, p) => acc + (p.setup_total || 33041.20), 0);

    // Filtragem da Lista de Propostas
    const propostasFiltradas = propostas.filter(p => {
        const matchesSearch = 
            (p.cliente_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.setor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.revisao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.notas_revisao || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Helper de Badges de Status
    const renderStatusBadge = (status) => {
        switch (status) {
            case 'aprovada':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle className="w-3 h-3 text-emerald-600" /> Aprovada</span>;
            case 'enviada':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300"><Send className="w-3 h-3 text-blue-600" /> Enviada</span>;
            case 'em_analise':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300"><Clock className="w-3 h-3 text-amber-600" /> Em Análise</span>;
            case 'revisada':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-800 border border-slate-300"><GitBranch className="w-3 h-3 text-slate-600" /> Revisada</span>;
            case 'recusada':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300"><X className="w-3 h-3 text-rose-600" /> Recusada</span>;
            case 'rascunho':
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200"><Edit3 className="w-3 h-3 text-slate-400" /> Rascunho</span>;
        }
    };

    // Componente Reutilizável: Tabela Temporal de Pagamentos e Faturamento (Fluxo de Desembolso)
    const renderTabelaTemporalPagamento = () => {
        return (
            <div className={`space-y-4 ${!incluirTabelaPdf ? 'print:hidden' : ''}`}>
                {/* Barra de Opções de Inclusão da Tabela nos Formatos Exportados */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                            <Sliders className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-800 block">
                                Inclusão do Cronograma nos Arquivos:
                            </span>
                            <span className="text-[11px] text-slate-500">
                                Escolha em quais formatos exportados esta tabela deve aparecer
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Toggle PDF */}
                        <button
                            type="button"
                            onClick={() => handleAtualizarCronograma('incluir_tabela_pdf', !incluirTabelaPdf)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                incluirTabelaPdf
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <span className={`w-2.5 h-2.5 rounded-full ${incluirTabelaPdf ? 'bg-emerald-500 ring-2 ring-emerald-300' : 'bg-slate-300'}`}></span>
                            <span>📄 PDF {incluirTabelaPdf ? '(Incluída)' : '(Oculta no PDF)'}</span>
                        </button>

                        {/* Toggle Word */}
                        <button
                            type="button"
                            onClick={() => handleAtualizarCronograma('incluir_tabela_word', !incluirTabelaWord)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                incluirTabelaWord
                                    ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-2xs'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <span className={`w-2.5 h-2.5 rounded-full ${incluirTabelaWord ? 'bg-blue-500 ring-2 ring-blue-300' : 'bg-slate-300'}`}></span>
                            <span>📝 Word (.docx) {incluirTabelaWord ? '(Incluída)' : '(Oculta no Word)'}</span>
                        </button>

                        {/* Toggle PPTX */}
                        <button
                            type="button"
                            onClick={() => handleAtualizarCronograma('incluir_tabela_pptx', !incluirTabelaPptx)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                incluirTabelaPptx
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <span className={`w-2.5 h-2.5 rounded-full ${incluirTabelaPptx ? 'bg-amber-500 ring-2 ring-amber-300' : 'bg-slate-300'}`}></span>
                            <span>📊 PowerPoint (.pptx) {incluirTabelaPptx ? '(Incluída)' : '(Oculta no PPTX)'}</span>
                        </button>
                    </div>
                </div>

                {/* Aviso quando tabela está desabilitada para o PDF */}
                {!incluirTabelaPdf && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-amber-900 print:hidden">
                        <div className="flex items-center gap-2">
                            <EyeOff className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                                <strong>Atenção:</strong> Esta tabela está visível na tela para você conferir, mas está <strong>desabilitada para o PDF</strong> (será omitida ao imprimir ou salvar em PDF).
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleAtualizarCronograma('incluir_tabela_pdf', true)}
                            className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold rounded-lg text-[11px] shrink-0 cursor-pointer"
                        >
                            Reativar no PDF
                        </button>
                    </div>
                )}

                {/* Banner de Condições Comerciais & Pagamento */}
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 shadow-xs break-inside-avoid print:bg-emerald-50/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                {temEntradaDia0 || carenciaEfetivaDias === 0 ? (
                                    <>
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-900 mb-1">
                                            ★ Condição Comercial • Entrada no Aceite + Parcelas Vinculadas a Entregas (Sem Carência)
                                        </span>
                                        <h4 className="text-base font-black text-slate-900">
                                            Entrada Facilitada na Assinatura e Parcelamento em Marcos de Homologação
                                        </h4>
                                        <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                                            No <strong>Dia 0 (Aceite da Proposta / Assinatura)</strong> é emitida a Entrada de <strong>R$ {valorEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> (vencimento em {venctoEntrada} dias). 
                                            A LYNX e a consultoria parceira iniciam imediatamente a implantação, parametrização e treinamento no chão de fábrica. 
                                            As parcelas subsequentes do setup ocorrem aos <strong>60 dias</strong> (marco piloto de chão de fábrica) e aos <strong>90 dias</strong> (homologação final e encerramento do setup), acompanhadas pelo ciclo de sustentação regular.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-900 mb-1">
                                            ★ Condição Comercial Diferenciada • Carência de {carenciaEfetivaDias} Dias
                                        </span>
                                        <h4 className="text-base font-black text-slate-900">
                                            Pagamento Inicial somente após {carenciaEfetivaDias} dias da aceitação da proposta
                                        </h4>
                                        <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                                            No <strong>Dia 0 (Aceite)</strong> nenhum desembolso financeiro é realizado (R$ 0,00). 
                                            A LYNX inicia de imediato o diagnóstico e desenvolvimento dedicado. 
                                            A emissão da 1ª fração de setup ocorre aos <strong>{carenciaEfetivaDias} dias</strong> com 10 dias para pagamento, acompanhada pelo ciclo das faturas mensais (emissão dia {mensalidadeDiaEmissao} c/ vencimento dia {mensalidadeDiaVencto}).
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Widget de Simulação Interativa de Data do Aceite */}
                        <div className="bg-white p-3.5 rounded-xl border border-emerald-300 shadow-2xs shrink-0 md:w-64 break-inside-avoid">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                📅 Data de Aceite (Simulação):
                            </span>
                            <div className="hidden print:block text-xs font-bold font-mono text-slate-900 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                {dataAceiteSimulacao ? new Date(dataAceiteSimulacao + 'T12:00:00').toLocaleDateString('pt-BR') : '05/10/2026'} (Marco Zero)
                            </div>
                            <input
                                type="date"
                                value={dataAceiteSimulacao}
                                onChange={(e) => handleAtualizarCronograma('data_aceite', e.target.value)}
                                className="w-full text-xs font-bold font-mono bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 print:hidden"
                            />
                            <span className="text-[10px] text-slate-400 block mt-1 print:hidden">
                                Alteração em tempo real recalculando datas
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tabela Temporal de Pagamentos */}
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs break-inside-avoid print:border-slate-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="p-3">Marco</th>
                                    <th className="p-3">Data Estimada</th>
                                    <th className="p-3">Evento / Objeto da NF</th>
                                    <th className="p-3">Emissão da NF</th>
                                    <th className="p-3">Data de Vencimento</th>
                                    <th className="p-3">Condição Comercial</th>
                                    <th className="p-3 text-right">Valor Previsto (R$)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {marcosTemporais.map((marco, idx) => {
                                    const isCarencia = marco.tipo === 'carencia';
                                    const isSetup = marco.tipo === 'setup';
                                    return (
                                        <tr 
                                            key={idx}
                                            className={`hover:bg-slate-50/80 transition-colors ${
                                                isCarencia ? 'bg-slate-50/40' : isSetup ? 'bg-amber-50/20' : 'bg-emerald-50/15'
                                            }`}
                                        >
                                            <td className="p-3 font-sans">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                    isCarencia 
                                                        ? 'bg-slate-200 text-slate-800' 
                                                        : isSetup 
                                                            ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                                }`}>
                                                    {marco.marco}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono font-bold text-slate-900">
                                                {marco.dataEstimada}
                                            </td>
                                            <td className="p-3 font-sans">
                                                <strong className="text-slate-900 block">{marco.evento}</strong>
                                                <span className="text-[10px] text-slate-500">{marco.objeto}</span>
                                            </td>
                                            <td className="p-3 font-mono text-slate-700">
                                                {marco.emissaoNf}
                                            </td>
                                            <td className="p-3 font-mono font-bold text-slate-900">
                                                {marco.vencimentoNf}
                                            </td>
                                            <td className="p-3 font-sans text-slate-600 text-[11px]">
                                                {marco.regra}
                                            </td>
                                            <td className="p-3 text-right font-mono font-black text-sm">
                                                {marco.valorTotal === 0 ? (
                                                    <span className="text-slate-400">R$ 0,00</span>
                                                ) : isSetup ? (
                                                    <span className="text-amber-800">
                                                        R$ {marco.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-800">
                                                        R$ {marco.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-xs font-mono font-bold">
                                <tr>
                                    <td colSpan="5" className="p-3 font-sans text-slate-700">
                                        <div className="flex items-center gap-4 text-[11px] flex-wrap">
                                            <span>• Total Setup ({parcelasSetup.length} Parcela{parcelasSetup.length > 1 ? 's' : ''}): <strong>R$ {totalSetupGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                                            <span>• Mensalidade Base ({franquiaCanteiros} canteiros): <strong>R$ {mensalidadeSustentacaoProjecao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                                        </div>
                                    </td>
                                    <td colSpan="2" className="p-3 text-right text-emerald-900 text-xs font-sans">
                                        ✓ Impostos municipais e federais inclusos
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    // Componente Reutilizável: Tabela e Painel de Progressão Financeira (12 ou 24 meses)
    const renderPainelProgressaoInvestimento = () => {
        return (
            <div className="space-y-6">
                {/* Header do Painel com Controles */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                            Previsibilidade Orçamentária • {proposta?.cliente_nome}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                            Progressão do Investimento ({progressaoMeses} Meses)
                        </h4>
                    </div>

                    <div className="flex items-center flex-wrap gap-2.5">
                        {/* Seletor 12 vs 24 Meses */}
                        <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                            <button
                                onClick={() => setProgressaoMeses(12)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    progressaoMeses === 12
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                12 Meses (1º Ano)
                            </button>
                            <button
                                onClick={() => setProgressaoMeses(24)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    progressaoMeses === 24
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                24 Meses (Ciclo Bienal)
                            </button>
                        </div>

                        {/* Seletor Rápido de Canteiros na Projeção */}
                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                            <span className="text-slate-500 font-semibold">Canteiros Ativos:</span>
                            <select
                                value={canteirosProjecao}
                                onChange={(e) => setCanteirosProjecao(Number(e.target.value))}
                                className="font-bold text-emerald-800 bg-transparent outline-none cursor-pointer"
                            >
                                <option value={10}>10 canteiros</option>
                                <option value={15}>15 canteiros (Franquia)</option>
                                <option value={20}>20 canteiros (+5 extras)</option>
                                <option value={25}>25 canteiros (+10 extras)</option>
                                <option value={30}>30 canteiros (+15 extras)</option>
                                <option value={40}>40 canteiros (+25 extras)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Cards de Resumo Financeiro da Progressão */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Investimento Total ({progressaoMeses}m)
                        </span>
                        <div className="text-xl font-black text-slate-900 mt-1">
                            R$ {totalInvestimentoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                            <span>Setup: <strong>R$ {totalSetupGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                            <span>Sustentação: <strong>R$ {totalSustentacaoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Média Mensal Diluída
                        </span>
                        <div className="text-xl font-black text-emerald-800 mt-1">
                            R$ {mediaMensalDiluida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1">
                            Amortização total com setup incluso
                        </span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Custo Médio por Canteiro
                        </span>
                        <div className="text-xl font-black text-slate-800 mt-1">
                            R$ {custoPorCanteiroMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1">
                            Considerando {canteirosMesProjecao} canteiros ativos
                        </span>
                    </div>

                    <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                            Previsibilidade & Transparência
                        </span>
                        <div className="text-xs font-bold text-slate-900 mt-1 leading-snug">
                            100% Infraestrutura, Nuvem, Backups e Licenças Ilimitadas
                        </div>
                        <span className="text-[10px] text-emerald-700 block mt-1">
                            Sem surpresas ou custos ocultos de TI
                        </span>
                    </div>
                </div>

                {/* Tabela de Progressão Mês a Mês */}
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                    <div className="overflow-x-auto max-h-[460px]">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="p-3">Mês</th>
                                    <th className="p-3">Etapa / Ciclo</th>
                                    <th className="p-3">Canteiros Previstos</th>
                                    <th className="p-3 text-right">Setup MVP (R$)</th>
                                    <th className="p-3 text-right">Sustentação SaaS (R$)</th>
                                    <th className="p-3 text-right">Total Mês (R$)</th>
                                    <th className="p-3 text-right">Acumulado (R$)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                                {linhasProgressao.map((row) => {
                                    const isSetupRow = row.mes <= 2;
                                    return (
                                        <tr 
                                            key={row.mes} 
                                            className={`hover:bg-slate-50 transition-colors ${isSetupRow ? 'bg-amber-50/20' : ''}`}
                                        >
                                            <td className="p-3 font-sans font-bold text-slate-900">
                                                Mês {String(row.mes).padStart(2, '0')}
                                            </td>
                                            <td className="p-3 font-sans text-slate-700">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                                    isSetupRow 
                                                        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                }`}>
                                                    {row.fase}
                                                </span>
                                            </td>
                                            <td className="p-3 font-sans text-slate-600">
                                                {row.canteiros}
                                            </td>
                                            <td className="p-3 text-right text-slate-700">
                                                {row.setup > 0 ? `R$ ${row.setup.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className="p-3 text-right text-slate-700">
                                                {row.sustentacao > 0 ? `R$ ${row.sustentacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className="p-3 text-right font-bold text-slate-900">
                                                R$ {row.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-3 text-right font-bold text-emerald-800">
                                                R$ {row.acumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200 text-xs font-mono">
                                <tr>
                                    <td colSpan="3" className="p-3 font-sans uppercase tracking-wider text-slate-800">
                                        Total Geral Acumulado ({progressaoMeses} Meses):
                                    </td>
                                    <td className="p-3 text-right text-amber-800">
                                        R$ {totalSetupGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right text-emerald-800">
                                        R$ {totalSustentacaoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td colSpan="2" className="p-3 text-right text-base text-emerald-900 font-black">
                                        R$ {totalInvestimentoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Nota de Governança e Autonomia */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-[11px] text-slate-600 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                        <strong>Regra de Escalabilidade Flexível:</strong> O gerenciamento de ativação ou encerramento dos canteiros é de controle exclusivo da {proposta?.cliente_nome}. Ao desmobilizar uma frente de obra no sistema, o acréscimo de 0,5 SM cessa imediatamente na fatura subsequente, assegurando que o investimento acompanhe estritamente a demanda operacional ativa.
                    </span>
                </div>
            </div>
        );
    };

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-amber-600">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso Exclusivo SuperAdmin</h2>
                    <p className="text-sm text-slate-500 mb-6">
                        O módulo corporativo de elaboração e gestão de Propostas Comerciais da Lynx é restrito a administradores mestres do sistema.
                    </p>
                    <div className="text-xs font-mono bg-slate-100 p-2.5 rounded-lg text-slate-600">
                        Usuário logado: <strong>{user?.login || 'Convidado'}</strong> (Tipo: {user?.tipo || 'N/A'})
                    </div>
                </div>
            </div>
        );
    }

    if (loading && propostas.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
                <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-slate-800">Carregando Propostas Comerciais...</h3>
                <p className="text-xs text-slate-500 mt-1">Sincronizando painel corporativo Lynx EMS</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-800 pb-20 print:bg-white print:p-0">
            {/* Top Bar Executiva */}
            <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs px-4 md:px-8 py-3.5 print:hidden">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                SuperAdmin • Lynx EMS
                            </span>
                            <span className="text-slate-400 text-xs">•</span>
                            <span className="text-xs font-medium text-slate-500 font-mono">
                                {proposta ? `${proposta.codigo} (${proposta.revisao || 'Rev 00'})` : 'Painel de Propostas'}
                            </span>
                        </div>
                        <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
                            <Building2 className="w-5 h-5 text-emerald-600" />
                            {activeTab === 'lista' ? 'Gestão de Propostas Comerciais Emitidas' : `Proposta Comercial: ${proposta?.cliente_nome || 'Cliente'}`}
                        </h1>
                    </div>

                    <div className="flex items-center flex-wrap gap-2.5">
                        {/* Seletor Rápido de Propostas */}
                        {propostas.length > 1 && (
                            <select 
                                value={selectedPropostaId} 
                                onChange={(e) => {
                                    fetchPropostaDetalhe(e.target.value);
                                    if (activeTab === 'lista') setActiveTab('documento');
                                }}
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                {propostas.map(p => (
                                    <option key={p.id} value={p.id}>{p.cliente_nome} ({p.codigo} - {p.revisao || 'Rev 00'})</option>
                                ))}
                            </select>
                        )}

                        {/* Botão Nova Proposta com IA */}
                        <button
                            onClick={() => setIaModalOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 active:scale-95"
                            title="Gerar proposta automaticamente a partir do site e Instagram"
                        >
                            <Sparkles className="w-4 h-4 text-emerald-200" />
                            <span>Nova com IA</span>
                        </button>

                        {/* Botão Nova Proposta a partir do Modelo Padrão */}
                        <button
                            onClick={() => setModeloModalOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all border border-slate-200 shadow-2xs active:scale-95"
                            title="Criar nova proposta a partir do modelo padrão parametrizado"
                        >
                            <FilePlus className="w-4 h-4 text-emerald-600" />
                            <span>+ Modelo Padrão</span>
                        </button>

                        {/* Botão Baixar PowerPoint */}
                        <a 
                            href="/propostas/Proposta_Comercial_SINCO_Irricom_2026.pptx"
                            download={proposta?.pptx_filename || "Proposta_Comercial_SINCO_Irricom_2026.pptx"}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all border border-slate-200 shadow-2xs"
                            title="Baixar Apresentação PowerPoint em formato 16:9 widescreen"
                        >
                            <Download className="w-4 h-4 text-slate-600" />
                            <span className="hidden sm:inline">Baixar PPTX</span>
                        </a>

                        {/* Botão Baixar Word (.docx) */}
                        <button
                            onClick={handleRegerarWord}
                            disabled={generatingWord}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition-all border border-blue-200 shadow-2xs active:scale-95 disabled:opacity-50"
                            title="Gerar e Baixar Documento Formal no Word (.docx) com logos da Lynx e SIM"
                        >
                            <FileText className={`w-4 h-4 ${generatingWord ? 'animate-spin text-blue-600' : 'text-blue-700'}`} />
                            <span className="hidden sm:inline">{generatingWord ? 'Gerando Word...' : 'Baixar Word'}</span>
                        </button>

                        {/* Botão Exportar PDF */}
                        <button
                            onClick={() => setPdfModalOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all border border-emerald-300 shadow-2xs"
                            title="Exportar Proposta Comercial completa em PDF (com ou sem slides)"
                        >
                            <Printer className="w-4 h-4 text-emerald-700" />
                            <span>Exportar PDF</span>
                        </button>
                    </div>
                </div>

                {/* Submenu de Navegação por Abas */}
                <div className="max-w-7xl mx-auto flex items-center gap-1.5 mt-3 border-t border-slate-100 pt-2.5 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('lista')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                            activeTab === 'lista'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <FileCheck className="w-3.5 h-3.5" />
                        Lista de Propostas Emitidas
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'lista' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                            {propostas.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('documento')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                            activeTab === 'documento'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Dossiê Técnico-Comercial
                    </button>

                    <button
                        onClick={() => setActiveTab('edicao')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                            activeTab === 'edicao'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Parametrização & Edição Individual
                    </button>

                    <button
                        onClick={() => setActiveTab('slides')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                            activeTab === 'slides'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <Laptop className="w-3.5 h-3.5" />
                        Apresentação em Slides ({currentSlide + 1}/13)
                    </button>

                    <button
                        onClick={() => setActiveTab('simulador')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                            activeTab === 'simulador'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <Calculator className="w-3.5 h-3.5" />
                        Simulador & Parâmetros
                    </button>

                    <button
                        onClick={() => setActiveTab('clientes')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                            activeTab === 'clientes'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Clientes Lynx ({clientesLynx.length})
                    </button>
                </div>
            </div>

            {/* Conteúdo Principal */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">

                {/* =========================================================================
                    ABA 0: LISTA DE PROPOSTAS EMITIDAS & CONTROLE CORPORATIVO
                ========================================================================= */}
                {activeTab === 'lista' && (
                    <div className="space-y-6">
                        {/* Header com KPIs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Emitidas</span>
                                    <span className="text-2xl font-black text-slate-900">{totalPropostas}</span>
                                    <span className="text-[10px] text-slate-500 block mt-0.5">Propostas corporativas</span>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                                    <FileSpreadsheet className="w-6 h-6" />
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Em Negociação</span>
                                    <span className="text-2xl font-black text-amber-700">{propostasEmAnalise}</span>
                                    <span className="text-[10px] text-amber-600 block mt-0.5">Enviadas ou em análise</span>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                                    <Clock className="w-6 h-6" />
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Aprovadas / Contrato</span>
                                    <span className="text-2xl font-black text-emerald-800">{propostasAprovadas}</span>
                                    <span className="text-[10px] text-emerald-600 block mt-0.5">Fase de implantação</span>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Volume Setup MVP</span>
                                    <span className="text-xl font-black text-slate-900">
                                        R$ {valorTotalSetup.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[10px] text-slate-500 block mt-0.5">Imersão de 60 dias somada</span>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-emerald-600">
                                    <DollarSign className="w-6 h-6" />
                                </div>
                            </div>
                        </div>

                        {/* Barra de Filtros e Busca */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar por cliente, código (ex: PROP-2026-001), setor ou notas..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                                    <Filter className="w-3.5 h-3.5" />
                                    Status:
                                </span>
                                {['todos', 'enviada', 'em_analise', 'aprovada', 'revisada', 'rascunho'].map((st) => (
                                    <button
                                        key={st}
                                        onClick={() => setStatusFilter(st)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize whitespace-nowrap ${
                                            statusFilter === st
                                                ? 'bg-slate-900 text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {st === 'todos' ? 'Todos' : st.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tabela de Propostas Emitidas */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                        <tr>
                                            <th className="p-4">Código / Revisão</th>
                                            <th className="p-4">Cliente / Segmento</th>
                                            <th className="p-4">Data Emissão</th>
                                            <th className="p-4">Investimento Setup (60d)</th>
                                            <th className="p-4">Sustentação Prevista</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Ações Gerenciais</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {propostasFiltradas.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="p-8 text-center text-slate-400">
                                                    Nenhuma proposta encontrada para os filtros selecionados.
                                                </td>
                                            </tr>
                                        ) : (
                                            propostasFiltradas.map((p) => {
                                                const isSelected = p.id === selectedPropostaId;
                                                return (
                                                    <tr 
                                                        key={p.id} 
                                                        className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-emerald-50/30' : ''}`}
                                                    >
                                                        {/* Código e Revisão */}
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono font-bold text-slate-900 text-xs">
                                                                    {p.codigo}
                                                                </span>
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                                    {p.revisao || 'Rev 00'}
                                                                </span>
                                                            </div>
                                                            {p.notas_revisao && (
                                                                <div className="text-[10px] text-slate-400 mt-1 max-w-xs truncate" title={p.notas_revisao}>
                                                                    {p.notas_revisao}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Cliente e Segmento */}
                                                        <td className="p-4">
                                                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                                                {p.cliente_nome}
                                                                {p.cliente_site && (
                                                                    <a 
                                                                        href={p.cliente_site} 
                                                                        target="_blank" 
                                                                        rel="noreferrer"
                                                                        className="text-slate-400 hover:text-emerald-700 inline-block"
                                                                        title="Visitar site do cliente"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                                                {p.setor || 'Engenharia & Soluções Corporativas'}
                                                            </div>
                                                        </td>

                                                        {/* Data Emissão */}
                                                        <td className="p-4 text-slate-600 whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                                {new Date(p.data_proposta).toLocaleDateString('pt-BR')}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                                v{p.versao || '1.0'}
                                                            </div>
                                                        </td>

                                                        {/* Setup 60 Dias */}
                                                        <td className="p-4 font-mono">
                                                            <div className="font-bold text-emerald-800 text-xs">
                                                                R$ {(p.setup_total || 33041.20).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                2 parcelas mensais
                                                            </div>
                                                        </td>

                                                        {/* Sustentação Mensal */}
                                                        <td className="p-4">
                                                            <div className="font-bold text-slate-800">
                                                                {p.sustentacao_sm || 6} Salários Mínimos
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                Franquia de {p.franquia_canteiros || 15} canteiros
                                                            </div>
                                                        </td>

                                                        {/* Status com Dropdown Interativo */}
                                                        <td className="p-4 relative">
                                                            <div className="inline-block relative">
                                                                <button
                                                                    onClick={() => setStatusDropdownId(statusDropdownId === p.id ? null : p.id)}
                                                                    className="flex items-center gap-1.5 focus:outline-none cursor-pointer group"
                                                                    title="Clique para alterar status"
                                                                >
                                                                    {renderStatusBadge(p.status)}
                                                                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-transform" />
                                                                </button>

                                                                {/* Dropdown de Status */}
                                                                {statusDropdownId === p.id && (
                                                                    <div className="absolute left-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40">
                                                                        <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                                                            Alterar Status
                                                                        </div>
                                                                        {['rascunho', 'enviada', 'em_analise', 'aprovada', 'revisada', 'recusada'].map((st) => (
                                                                            <button
                                                                                key={st}
                                                                                onClick={() => handleUpdateStatus(p.id, st)}
                                                                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center justify-between ${
                                                                                    p.status === st ? 'font-bold text-emerald-700 bg-emerald-50/50' : 'text-slate-700'
                                                                                }`}
                                                                            >
                                                                                <span className="capitalize">{st.replace('_', ' ')}</span>
                                                                                {p.status === st && <Check className="w-3 h-3 text-emerald-600" />}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Ações */}
                                                        <td className="p-4 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                {/* Visualizar Dossiê */}
                                                                <button
                                                                    onClick={() => handleVisualizarDossie(p.id)}
                                                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors"
                                                                    title="Abrir Dossiê Técnico-Comercial"
                                                                >
                                                                    <FileText className="w-4 h-4" />
                                                                </button>

                                                                {/* Editar / Parametrizar */}
                                                                <button
                                                                    onClick={() => handleAbrirEdicao(p.id)}
                                                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors"
                                                                    title="Parametrizar e Editar Proposta Completa"
                                                                >
                                                                    <Settings className="w-4 h-4" />
                                                                </button>

                                                                {/* Ver Slides */}
                                                                <button
                                                                    onClick={() => handleVisualizarSlides(p.id)}
                                                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors"
                                                                    title="Ver Apresentação em Slides"
                                                                >
                                                                    <Laptop className="w-4 h-4" />
                                                                </button>

                                                                {/* Criar Revisão */}
                                                                <button
                                                                    onClick={() => handleAbrirModalRevisao(p)}
                                                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                                                    title="Criar Nova Revisão (Rev 01, Rev 02...)"
                                                                >
                                                                    <GitBranch className="w-4 h-4" />
                                                                </button>

                                                                {/* Baixar PPTX */}
                                                                <a
                                                                    href="/propostas/Proposta_Comercial_SINCO_Irricom_2026.pptx"
                                                                    download={p.pptx_filename || `Proposta_Comercial_SINCO_${p.cliente_nome}.pptx`}
                                                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                                                    title="Baixar Arquivo PowerPoint (.pptx)"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </a>

                                                                {/* Baixar Word (.docx) */}
                                                                <button
                                                                    onClick={() => {
                                                                        fetchPropostaDetalhe(p.id);
                                                                        handleRegerarWord();
                                                                    }}
                                                                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                                                                    title="Gerar e Baixar Documento Word (.docx) com logos Lynx & SIM"
                                                                >
                                                                    <FileText className="w-4 h-4" />
                                                                </button>

                                                                {/* Exportar PDF */}
                                                                <button
                                                                    onClick={() => {
                                                                        fetchPropostaDetalhe(p.id);
                                                                        setPdfModalOpen(true);
                                                                    }}
                                                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors"
                                                                    title="Exportar Proposta em PDF"
                                                                >
                                                                    <Printer className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* =========================================================================
                    ABA 1: DOSSIÊ TÉCNICO-COMERCIAL FORMATADO
                ========================================================================= */}
                {activeTab === 'documento' && proposta && (
                    <div className="space-y-6 print:space-y-4">
                        {/* Header Documento / Banner de Boas-Vindas */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
                            {/* Co-Branding Logos no Topo do Dossiê */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-100">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 flex items-center justify-center h-12 w-28 shrink-0">
                                        <img 
                                            src={proposta.fornecedor?.logo_url || '/logos/lynx-ems-logo.jpg'} 
                                            alt="Logo Lynx EMS" 
                                            className="max-h-8 object-contain" 
                                            onError={(e) => { e.target.src = '/logos/lynx-ems-logo.jpg'; }}
                                        />
                                    </div>
                                    {proposta.empresa_parceira?.habilitada !== false && (
                                        <>
                                            <span className="text-slate-400 font-black text-sm">+</span>
                                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 flex items-center justify-center h-12 w-28 shrink-0">
                                                <img 
                                                    src={proposta.empresa_parceira?.logo_url || '/logos/sim-consultoria-logo.png'} 
                                                    alt={proposta.empresa_parceira?.nome || 'SIM Consultoria'} 
                                                    className="max-h-8 object-contain" 
                                                    onError={(e) => { e.target.src = '/logos/sim-consultoria-logo.png'; }}
                                                />
                                            </div>
                                            <div className="hidden sm:block text-[11px] text-slate-500 pl-3 border-l border-slate-200">
                                                <strong className="text-slate-800 block text-xs">Consórcio de Entrega Tecnológica</strong>
                                                <span>Lynx EMS (Software SINCO) & {proposta.empresa_parceira?.nome || 'SIM Consultoria'}</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 print:hidden">
                                    <button
                                        onClick={handleRegerarWord}
                                        disabled={generatingWord}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200 transition-all shadow-2xs"
                                        title="Baixar Proposta em formato Word (.docx)"
                                    >
                                        <FileText className={`w-3.5 h-3.5 ${generatingWord ? 'animate-spin text-blue-600' : 'text-blue-700'}`} />
                                        <span>{generatingWord ? 'Gerando...' : 'Baixar Word'}</span>
                                    </button>
                                    <button
                                        onClick={() => setPdfModalOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 transition-all shadow-2xs"
                                        title="Exportar Proposta em PDF"
                                    >
                                        <Printer className="w-3.5 h-3.5 text-emerald-700" />
                                        <span>Exportar PDF</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                        Ecossistema SINCO • Conectores Universais para ERPs (Protheus, Omie, Sankhya, etc.) • Proposta Oficial Conjunta
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                                        Proposta Técnico-Comercial de Implementação
                                    </h2>
                                    <p className="text-slate-600 text-sm max-w-3xl leading-relaxed">
                                        Desenvolvida sob medida para a <strong>{proposta.cliente_razao_social || proposta.cliente_nome}</strong>, integrando as operações de engenharia, manufatura fabril, canteiros de obra, SST e SGQ com mobilidade nativa.
                                    </p>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-w-[240px] text-xs space-y-1.5">
                                    <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Dados da Proposta</div>
                                    <div><strong>Código:</strong> {proposta.codigo}</div>
                                    <div><strong>Revisão:</strong> <span className="text-emerald-700 font-bold">{proposta.revisao || 'Rev 00'}</span></div>
                                    <div><strong>Data:</strong> {new Date(proposta.data_proposta).toLocaleDateString('pt-BR')}</div>
                                    <div><strong>Versão:</strong> {proposta.versao}</div>
                                    <div><strong>Cliente:</strong> {proposta.cliente_nome}</div>
                                    <div><strong>Ambiente Previsto:</strong> <a href={proposta.url_ambiente} target="_blank" rel="noreferrer" className="text-emerald-700 underline font-semibold">{proposta.url_ambiente}</a></div>
                                </div>
                            </div>
                        </div>

                        {/* SEÇÃO 1: CONTEXTO E OBJETIVO */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
                            <div className="flex items-center gap-2.5 mb-4 text-emerald-800">
                                <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-black text-xs">
                                    1
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                                    Contexto e Objetivo
                                </h3>
                            </div>
                            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-line bg-slate-50/70 p-5 rounded-xl border border-slate-100">
                                {proposta.contexto}
                            </div>
                        </div>

                        {/* SEÇÃO 2: ESCOPO DO PROJETO (MÓDULOS) */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
                            <div className="flex items-center gap-2.5 mb-4 text-emerald-800">
                                <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-black text-xs">
                                    2
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                                    Escopo do Projeto & Módulos
                                </h3>
                            </div>

                            {/* Fase 1: Imediata */}
                            <div className="mb-6">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    Fase 1: Módulos Contemplados (Imersão Inicial & Desenvolvimento)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(proposta.escopo_fase1 || []).map((m, idx) => (
                                        <div key={idx} className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/30 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <span className="font-bold text-slate-900 text-sm">{m.nome}</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                        {m.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-600 leading-relaxed mb-2">
                                                    {m.descricao}
                                                </p>
                                                {m.recursos && m.recursos.length > 0 && (
                                                    <ul className="mt-2.5 pt-2.5 border-t border-emerald-200/60 space-y-1.5">
                                                        {m.recursos.map((rec, rIdx) => (
                                                            <li key={rIdx} className="text-[11px] text-slate-700 flex items-start gap-1.5 leading-relaxed">
                                                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                                                <span>{rec}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Fase 2: Roadmap Futuro */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    Fase 2: Roadmap Futuro (Fora do Escopo Imediato)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {(proposta.escopo_fase2 || []).map((m, idx) => (
                                        <div key={idx} className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-between">
                                            <span className="font-semibold text-xs text-slate-700">{m.nome}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">{m.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* SEÇÃO 3: METODOLOGIA ÁGIL (MVP) */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
                            <div className="flex items-center gap-2.5 mb-4 text-emerald-800">
                                <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-black text-xs">
                                    3
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                                    Metodologia Ágil (MVP - Produto Mínimo Viável)
                                </h3>
                            </div>
                            <p className="text-slate-600 text-sm mb-5 leading-relaxed">
                                {proposta.metodologia?.descricao}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(proposta.metodologia?.pilares || []).map((p, idx) => (
                                    <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs mb-3">
                                            0{idx + 1}
                                        </div>
                                        <h4 className="font-bold text-slate-900 text-sm mb-1.5">{p.titulo}</h4>
                                        <p className="text-xs text-slate-600 leading-relaxed">{p.descricao}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* SEÇÃO 4: CHECKPOINT DE AVALIAÇÃO */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
                            <div className="flex items-center gap-2.5 mb-4 text-emerald-800">
                                <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-black text-xs">
                                    4
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                                    Checkpoint de Avaliação e Continuidade (60 Dias)
                                </h3>
                            </div>
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                                {proposta.checkpoint?.descricao}
                            </div>
                        </div>

                        {/* SEÇÃO 5: INFRAESTRUTURA TECNOLÓGICA */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
                            <div className="flex items-center gap-2.5 mb-4 text-emerald-800">
                                <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-black text-xs">
                                    5
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                                    Infraestrutura Tecnológica Inclusa
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(proposta.infraestrutura || []).map((inf, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <span>{inf}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* SEÇÃO 6: INVESTIMENTO E CONDIÇÕES COMERCIAIS */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
                            <div className="flex items-center gap-2.5 mb-6 text-emerald-800">
                                <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-black text-xs">
                                    6
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                                    Investimento e Condições Comerciais
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                {/* Fase 1: Setup com Condições Comerciais */}
                                <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                            {temEntradaDia0 || carenciaEfetivaDias === 0 
                                                ? 'Setup Inicial • Entrada no Aceite & Entregas (Sem Carência)' 
                                                : `Setup Inicial • Carência de ${carenciaEfetivaDias} Dias`}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            {temEntradaDia0 || carenciaEfetivaDias === 0 
                                                ? `Entrada: R$ ${valorEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                                                : 'Dia 0 = R$ 0,00'}
                                        </span>
                                    </div>
                                    <h4 className="text-base font-bold text-slate-900 mb-3">
                                        {temEntradaDia0 || carenciaEfetivaDias === 0 
                                            ? `Implantação & Setup Vinculado a Entregas (${parcelasSetup.length} Parcelas)` 
                                            : `Desenvolvimento Dedicado MVP (${parcelasSetup.length} Parcelas)`}
                                    </h4>
                                    
                                    <div className="space-y-2 mb-4">
                                        {parcelasSetup.map((parc, idx) => (
                                            <div key={parc.id || idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 text-xs">
                                                <div>
                                                    <span className="font-semibold text-slate-700 block">{parc.nome || `${idx + 1}ª Fração Setup`} (Dia {parc.dias_apos_aceite}):</span>
                                                    <span className="text-[10px] text-slate-400">Emissão NF aos {parc.dias_apos_aceite} dias • Vencimento em {parc.dias_vencimento || 10} dias</span>
                                                </div>
                                                <span className="font-bold text-slate-900 text-sm">
                                                    R$ {(Number(parc.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between items-center bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200 text-xs">
                                            <span className="font-bold text-emerald-900">Total Setup ({parcelasSetup.length} Parcelas):</span>
                                            <span className="font-black text-emerald-900 text-sm">
                                                R$ {totalSetupGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        {proposta.investimento?.setup_fase_agil?.descricao || 'Dedicação exclusiva para entrega dos módulos essenciais nos primeiros ciclos.'}
                                    </p>
                                </div>

                                {/* Fase 2: Sustentação */}
                                <div className="border border-emerald-200 rounded-2xl p-5 bg-emerald-50/30">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                                            Sustentação Mensal (SaaS)
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700 border border-emerald-200">
                                            NF dia {mensalidadeDiaEmissao} • Vencto dia {mensalidadeDiaVencto}
                                        </span>
                                    </div>
                                    <h4 className="text-base font-bold text-slate-900 mb-3">
                                        Suporte, Nuvem & Canteiros
                                    </h4>
                                    
                                    <div className="space-y-2 mb-4">
                                        <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-emerald-200 text-xs">
                                            <div>
                                                <span className="font-semibold text-slate-700 block">Mensalidade Base:</span>
                                                <span className="text-[10px] text-emerald-700">R$ {mensalidadeSustentacaoProjecao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</span>
                                            </div>
                                            <span className="font-black text-emerald-900 text-sm">
                                                {baseSM} Salários Mínimos
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-emerald-200 text-xs">
                                            <span className="font-semibold text-slate-700">Franquia de Canteiros:</span>
                                            <span className="font-bold text-slate-900 text-xs">
                                                Até {franquiaCanteiros} canteiros inclusos
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-emerald-200 text-xs">
                                            <span className="font-semibold text-slate-700">Por Canteiro Extra:</span>
                                            <span className="font-bold text-slate-900 text-xs">
                                                +{extraSM} Salário Mínimo
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        {proposta.investimento?.sustentacao_mensal?.descricao_escalabilidade}
                                    </p>
                                </div>
                            </div>

                            {/* Tabela Temporal de Pagamentos e Fluxo de Desembolso */}
                            <div className={`mb-6 ${!incluirTabelaPdf ? 'print:hidden' : ''}`}>
                                {renderTabelaTemporalPagamento()}
                            </div>

                            {/* Regras de Faturamento */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                                <div>
                                    <span className="text-slate-500 font-semibold block">Emissão de NF Mensalidade:</span>
                                    <strong className="text-slate-800">Todo dia {mensalidadeDiaEmissao} de cada mês</strong>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-semibold block">Vencimento da Mensalidade:</span>
                                    <strong className="text-slate-800">Previsto para o dia {mensalidadeDiaVencto} do mês subsequente</strong>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-semibold block">Condições Tributárias:</span>
                                    <strong className="text-emerald-800">Impostos municipais e federais inclusos</strong>
                                </div>
                            </div>
                        </div>

                        {/* =========================================================================
                            SEÇÃO 7: TABELA DE PROGRESSÃO DO INVESTIMENTO (12 OU 24 MESES)
                        ========================================================================= */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
                            <div className="flex items-center gap-2.5 mb-6 text-emerald-800">
                                <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-black text-xs">
                                    7
                                </span>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                                        Tabela de Progressão do Investimento Total (12 ou 24 Meses)
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Visão cronológica transparente do desembolso mensal e evolução financeira consolidada do projeto.
                                    </p>
                                </div>
                            </div>

                            {renderPainelProgressaoInvestimento()}
                        </div>

                        {/* =========================================================================
                            SEÇÃO 8: TERMO DE ACEITE & ASSINATURAS DAS PARTES
                        ========================================================================= */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs break-inside-avoid">
                            <div className="flex items-center gap-2.5 mb-4 text-emerald-800">
                                <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-black text-xs">
                                    8
                                </span>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                                        Termo de Aceite & Assinaturas das Partes
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {temEntradaDia0 || carenciaEfetivaDias === 0
                                            ? 'Alinhamento formal das partes quanto ao escopo técnico, condições comerciais de pagamento e cronograma de implantação.'
                                            : `Alinhamento formal das partes quanto ao escopo técnico, carência de ${carenciaEfetivaDias} dias, modelo comercial e cronograma.`}
                                    </p>
                                </div>
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed mb-8">
                                Estando as partes devidamente de acordo com todas as premissas deste instrumento técnico-comercial, firmam o presente aceite para início imediato dos trabalhos de implantação:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-center">
                                {/* Assinatura Lynx EMS */}
                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-end min-h-[155px] items-center text-center">
                                    <div className="h-10 mb-2 flex items-center justify-center">
                                        <img 
                                            src={proposta.fornecedor?.logo_url || '/logos/lynx-ems-logo.jpg'} 
                                            alt="Logo Lynx" 
                                            className="max-h-9 object-contain" 
                                            onError={(e) => { e.target.src = '/logos/lynx-ems-logo.jpg'; }}
                                        />
                                    </div>
                                    <div className="border-b border-slate-300 pb-2 mb-2 w-full">
                                        <span className="text-[10px] text-slate-400 block font-mono">Assinatura Digital / Certificada</span>
                                    </div>
                                    <strong className="text-xs text-slate-900 block font-bold">{proposta.fornecedor?.empresa || 'LYNX EMS SISTEMA & CONSULTORIA'}</strong>
                                    <span className="text-[11px] text-slate-500">{proposta.fornecedor?.papel || 'Desenvolvimento de Software & Arquitetura SINCO'}</span>
                                </div>

                                {/* Assinatura SIM Consultoria / Parceira */}
                                {proposta.empresa_parceira?.habilitada !== false ? (
                                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-end min-h-[155px] items-center text-center">
                                        <div className="h-10 mb-2 flex items-center justify-center">
                                            <img 
                                                src={proposta.empresa_parceira?.logo_url || '/logos/sim-consultoria-logo.png'} 
                                                alt="Logo Parceira" 
                                                className="max-h-9 object-contain" 
                                                onError={(e) => { e.target.src = '/logos/sim-consultoria-logo.png'; }}
                                            />
                                        </div>
                                        <div className="border-b border-slate-300 pb-2 mb-2 w-full">
                                            <span className="text-[10px] text-slate-400 block font-mono">Assinatura Digital / Certificada</span>
                                        </div>
                                        <strong className="text-xs text-slate-900 block font-bold">{proposta.empresa_parceira?.nome || 'SIM CONSULTORIA'}</strong>
                                        <span className="text-[11px] text-slate-500">{proposta.empresa_parceira?.papel || 'Consultoria de Processos & Integração com ERPs'}</span>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/30 flex flex-col justify-end min-h-[155px] text-slate-400 text-xs items-center text-center">
                                        <span>Testemunha / Gestão de Projetos</span>
                                    </div>
                                )}

                                {/* Assinatura Cliente */}
                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-end min-h-[140px]">
                                    <div className="border-b border-slate-300 pb-2 mb-2">
                                        <span className="text-[10px] text-slate-400 block font-mono">De Acordo do Contratante</span>
                                    </div>
                                    <strong className="text-xs text-slate-900 block font-bold">{proposta.cliente_razao_social || proposta.cliente_nome}</strong>
                                    <span className="text-[11px] text-slate-500">Diretoria Executiva / Representante Legal</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* =========================================================================
                    ABA 1.5: PARAMETRIZAÇÃO & EDIÇÃO INDIVIDUAL DA PROPOSTA
                ========================================================================= */}
                {activeTab === 'edicao' && proposta && (
                    <div className="space-y-6">
                        {/* Header de Edição */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                    Editor Corporativo de Proposta
                                </span>
                                <h2 className="text-xl font-black text-slate-900 mt-1 flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-emerald-600" />
                                    Parametrização: {proposta.cliente_nome} ({proposta.codigo})
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Edite qualquer premissa, escopo, módulos, textos contratuais e valores individualmente para este cliente.
                                </p>
                            </div>

                            <div className="flex items-center flex-wrap gap-2">
                                <button
                                    onClick={handleSalvarEdicoes}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
                                </button>
                                <button
                                    onClick={handleRegerarWord}
                                    disabled={generatingWord}
                                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200 transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                                    title="Gera e baixa o documento formal em Word (.docx) com logotipo Lynx e SIM"
                                >
                                    <FileText className={`w-3.5 h-3.5 ${generatingWord ? 'animate-spin text-blue-600' : 'text-blue-700'}`} />
                                    <span>{generatingWord ? 'Gerando Word...' : 'Gerar Word (.docx)'}</span>
                                </button>
                                <button
                                    onClick={handleRegerarPptx}
                                    disabled={generatingPptx}
                                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 active:scale-95"
                                    title="Regera a apresentação PowerPoint com os novos dados"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${generatingPptx ? 'animate-spin text-emerald-600' : ''}`} />
                                    <span>{generatingPptx ? 'Gerando...' : 'Atualizar PPTX'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Bloco 1: Identificação do Cliente & Contrato */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-emerald-600" />
                                1. Identificação do Cliente & Dados do Contrato
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Nome Fantasia *</label>
                                    <input
                                        value={proposta.cliente_nome || ''}
                                        onChange={e => setProposta({ ...proposta, cliente_nome: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Razão Social</label>
                                    <input
                                        value={proposta.cliente_razao_social || ''}
                                        onChange={e => setProposta({ ...proposta, cliente_razao_social: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Setor de Atuação</label>
                                    <input
                                        value={proposta.setor || ''}
                                        onChange={e => setProposta({ ...proposta, setor: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Site Oficial</label>
                                    <input
                                        value={proposta.cliente_site || ''}
                                        onChange={e => setProposta({ ...proposta, cliente_site: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Instagram</label>
                                    <input
                                        value={proposta.cliente_instagram || ''}
                                        onChange={e => setProposta({ ...proposta, cliente_instagram: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Ambiente Previsto (SaaS)</label>
                                    <input
                                        value={proposta.url_ambiente || ''}
                                        onChange={e => setProposta({ ...proposta, url_ambiente: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-emerald-800"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bloco 1.1: Empresa Parceira & Consórcio de Entrega (Co-Branding) */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                            {/* Hidden inputs para upload de imagem */}
                            <input
                                id="upload-logo-lynx"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadLogo(e, 'fornecedor')}
                            />
                            <input
                                id="upload-logo-parceira"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadLogo(e, 'empresa_parceira')}
                            />

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                                            1.1. Empresa Parceira & Consórcio de Entrega (Co-Branding)
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Configure a empresa parceira que compõe a solução conjunta da Lynx e escolha os logotipos oficiais para PDF, Word (.docx) e web.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                                        <input
                                            type="checkbox"
                                            checked={proposta.empresa_parceira?.habilitada !== false}
                                            onChange={e => setProposta({
                                                ...proposta,
                                                empresa_parceira: {
                                                    ...(proposta.empresa_parceira || {}),
                                                    habilitada: e.target.checked
                                                }
                                            })}
                                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                        />
                                        <span>Habilitar Parceria / Co-Branding</span>
                                    </label>
                                </div>
                            </div>

                            {proposta.empresa_parceira?.habilitada !== false && (
                                <div className="space-y-6">
                                    {/* SELETOR INTERATIVO DE IMAGENS E LOGOTIPOS */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                                                Escolha dos Logotipos Oficiais (Lynx + Parceiro)
                                            </span>
                                            <span className="text-[11px] text-slate-500">
                                                Selecione uma imagem predefinida ou faça upload do computador
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* CARD LOGO LYNX EMS */}
                                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-slate-800">1. Logotipo Lynx EMS (Software)</span>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                        Tecnologia & Plataforma
                                                    </span>
                                                </div>

                                                {/* Mini Preview do Logo Ativo Lynx */}
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center h-14 w-28 shrink-0">
                                                        <img 
                                                            src={proposta.fornecedor?.logo_url || '/logos/lynx-ems-logo.jpg'} 
                                                            alt="Logo Lynx" 
                                                            className="max-h-9 object-contain" 
                                                            onError={(e) => { e.target.src = '/logos/lynx-ems-logo.jpg'; }}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => document.getElementById('upload-logo-lynx').click()}
                                                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                                        >
                                                            <Upload className="w-3 h-3 text-emerald-600" />
                                                            Upload do Computador
                                                        </button>
                                                        <span className="text-[10px] text-slate-400 block font-mono">PNG, JPG com fundo transparente</span>
                                                    </div>
                                                </div>

                                                {/* Galeria de Predefinições Lynx */}
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                                                        Predefinições Oficiais Lynx:
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {LYNX_LOGO_PRESETS.map((p, idx) => (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                onClick={() => setProposta(prev => ({
                                                                    ...prev,
                                                                    fornecedor: {
                                                                        ...(prev.fornecedor || {}),
                                                                        logo_url: p.url
                                                                    }
                                                                }))}
                                                                className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                                                                    (proposta.fornecedor?.logo_url || '/logos/lynx-ems-logo.jpg') === p.url
                                                                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-2xs'
                                                                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                                                }`}
                                                            >
                                                                {p.nome}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Caminho ou URL direta */}
                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-500 block mb-1">Caminho ou URL direta:</label>
                                                    <input
                                                        value={proposta.fornecedor?.logo_url || '/logos/lynx-ems-logo.jpg'}
                                                        onChange={e => setProposta(prev => ({
                                                            ...prev,
                                                            fornecedor: {
                                                                ...(prev.fornecedor || {}),
                                                                logo_url: e.target.value
                                                            }
                                                        }))}
                                                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500"
                                                    />
                                                </div>
                                            </div>

                                            {/* CARD LOGO EMPRESA PARCEIRA */}
                                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-slate-800">2. Logotipo Empresa Parceira</span>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                                                        Implantação & Consultoria
                                                    </span>
                                                </div>

                                                {/* Mini Preview do Logo Ativo Parceira */}
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center h-14 w-28 shrink-0">
                                                        <img 
                                                            src={proposta.empresa_parceira?.logo_url || '/logos/sim-consultoria-logo.png'} 
                                                            alt="Logo Parceira" 
                                                            className="max-h-9 object-contain" 
                                                            onError={(e) => { e.target.src = '/logos/sim-consultoria-logo.png'; }}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => document.getElementById('upload-logo-parceira').click()}
                                                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                                        >
                                                            <Upload className="w-3 h-3 text-teal-600" />
                                                            Upload do Computador
                                                        </button>
                                                        <span className="text-[10px] text-slate-400 block font-mono">PNG, JPG com fundo transparente</span>
                                                    </div>
                                                </div>

                                                {/* Galeria de Predefinições Parceiro */}
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                                                        Predefinições de Parceiros & Consultorias:
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {PARCEIRO_LOGO_PRESETS.map((p, idx) => (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                onClick={() => setProposta(prev => ({
                                                                    ...prev,
                                                                    empresa_parceira: {
                                                                        ...(prev.empresa_parceira || {}),
                                                                        nome: p.nome,
                                                                        razao_social: p.razao || prev.empresa_parceira?.razao_social,
                                                                        papel: p.papel || prev.empresa_parceira?.papel,
                                                                        logo_url: p.url
                                                                    }
                                                                }))}
                                                                className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                                                                    (proposta.empresa_parceira?.logo_url || '/logos/sim-consultoria-logo.png') === p.url
                                                                        ? 'bg-teal-700 text-white border-teal-700 font-bold shadow-2xs'
                                                                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                                                }`}
                                                            >
                                                                {p.nome}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Caminho ou URL direta */}
                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-500 block mb-1">Caminho ou URL direta:</label>
                                                    <input
                                                        value={proposta.empresa_parceira?.logo_url || '/logos/sim-consultoria-logo.png'}
                                                        onChange={e => setProposta(prev => ({
                                                            ...prev,
                                                            empresa_parceira: {
                                                                ...(prev.empresa_parceira || {}),
                                                                logo_url: e.target.value
                                                            }
                                                        }))}
                                                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-700 outline-none focus:ring-1 focus:ring-teal-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* DADOS CADASTRAIS DA EMPRESA PARCEIRA */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 block mb-1">Nome Fantasia da Parceira *</label>
                                            <input
                                                value={proposta.empresa_parceira?.nome || ''}
                                                onChange={e => setProposta({
                                                    ...proposta,
                                                    empresa_parceira: {
                                                        ...(proposta.empresa_parceira || {}),
                                                        nome: e.target.value
                                                    }
                                                })}
                                                placeholder="Ex: SIM Consultoria"
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 block mb-1">Razão Social / CNPJ</label>
                                            <input
                                                value={proposta.empresa_parceira?.razao_social || ''}
                                                onChange={e => setProposta({
                                                    ...proposta,
                                                    empresa_parceira: {
                                                        ...(proposta.empresa_parceira || {}),
                                                        razao_social: e.target.value
                                                    }
                                                })}
                                                placeholder="Razão social da empresa parceira"
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 block mb-1">Papel Técnico na Solução</label>
                                            <input
                                                value={proposta.empresa_parceira?.papel || ''}
                                                onChange={e => setProposta({
                                                    ...proposta,
                                                    empresa_parceira: {
                                                        ...(proposta.empresa_parceira || {}),
                                                        papel: e.target.value
                                                    }
                                                })}
                                                placeholder="Ex: Consultoria Especializada em Processos & Integração de ERPs"
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 block mb-1">Site Oficial da Parceira</label>
                                            <input
                                                value={proposta.empresa_parceira?.site || ''}
                                                onChange={e => setProposta({
                                                    ...proposta,
                                                    empresa_parceira: {
                                                        ...(proposta.empresa_parceira || {}),
                                                        site: e.target.value
                                                    }
                                                })}
                                                placeholder="https://simconsultoria.com.br"
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 block mb-1">E-mail / Contato</label>
                                            <input
                                                value={proposta.empresa_parceira?.contato || ''}
                                                onChange={e => setProposta({
                                                    ...proposta,
                                                    empresa_parceira: {
                                                        ...(proposta.empresa_parceira || {}),
                                                        contato: e.target.value
                                                    }
                                                })}
                                                placeholder="contato@simconsultoria.com.br"
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Pré-visualização Interativa dos Logotipos Conjuntos (Lynx + SIM) */}
                                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4 text-white">
                                        <div className="flex items-center gap-3.5">
                                            <div 
                                                onClick={() => document.getElementById('upload-logo-lynx').click()}
                                                title="Clique para trocar imagem do logo Lynx"
                                                className="bg-white p-2 rounded-xl shadow-xs flex items-center justify-center h-12 w-28 shrink-0 cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all"
                                            >
                                                <img 
                                                    src={proposta.fornecedor?.logo_url || '/logos/lynx-ems-logo.jpg'} 
                                                    alt="Logo Lynx EMS" 
                                                    className="max-h-8 object-contain" 
                                                    onError={(e) => { e.target.src = '/logos/lynx-ems-logo.jpg'; }}
                                                />
                                            </div>
                                            <span className="text-slate-400 font-black text-base">+</span>
                                            <div 
                                                onClick={() => document.getElementById('upload-logo-parceira').click()}
                                                title="Clique para trocar imagem do logo da Parceira"
                                                className="bg-white p-2 rounded-xl shadow-xs flex items-center justify-center h-12 w-28 shrink-0 cursor-pointer hover:ring-2 hover:ring-teal-400 transition-all"
                                            >
                                                <img 
                                                    src={proposta.empresa_parceira?.logo_url || '/logos/sim-consultoria-logo.png'} 
                                                    alt="Logo Parceiro" 
                                                    className="max-h-8 object-contain" 
                                                    onError={(e) => { e.target.src = '/logos/sim-consultoria-logo.png'; }} 
                                                />
                                            </div>
                                        </div>
                                        <div className="text-center md:text-right">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider mb-1">
                                                ★ Consórcio de Entrega Integrada
                                            </span>
                                            <div className="text-xs font-bold text-white">
                                                Lynx EMS & {proposta.empresa_parceira?.nome || 'SIM Consultoria'}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-0.5 max-w-md">
                                                Ambos os logotipos estão habilitados para exibição conjunta no cabeçalho do dossiê, na exportação para PDF e no arquivo Word (.docx).
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bloco 2: Contexto e Objetivo Customizado */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FileText className="w-4 h-4 text-emerald-600" />
                                2. Contexto Operacional & Objetivo da Implementação
                            </h3>
                            <textarea
                                rows="5"
                                value={proposta.contexto || ''}
                                onChange={e => setProposta({ ...proposta, contexto: e.target.value })}
                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans text-slate-800"
                                placeholder="Descreva os desafios e o objetivo estratégico do ecossistema Sinco para este cliente..."
                            />
                        </div>

                        {/* Bloco 3: Módulos & Escopo (Fase 1 e Fase 2) */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-1">
                                    <Layers className="w-4 h-4 text-emerald-600" />
                                    3. Escopo de Módulos (Fase 1 - MVP Imediato)
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Adicione, remova ou personalize os módulos que serão implementados nos primeiros 60 dias.
                                </p>
                            </div>

                            {/* Lista de Módulos da Fase 1 */}
                            <div className="space-y-3">
                                {(proposta.escopo_fase1 || []).map((mod, idx) => (
                                    <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                        <div className="flex-1 space-y-1">
                                            <input
                                                value={mod.nome}
                                                onChange={e => {
                                                    const list = [...proposta.escopo_fase1];
                                                    list[idx].nome = e.target.value;
                                                    setProposta({ ...proposta, escopo_fase1: list });
                                                }}
                                                className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg p-2"
                                            />
                                            <textarea
                                                rows="2"
                                                value={mod.descricao}
                                                onChange={e => {
                                                    const list = [...proposta.escopo_fase1];
                                                    list[idx].descricao = e.target.value;
                                                    setProposta({ ...proposta, escopo_fase1: list });
                                                }}
                                                className="w-full text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg p-2"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoverModuloFase1(idx)}
                                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                                            title="Remover Módulo"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}

                                {/* Adicionar Novo Módulo Fase 1 */}
                                <div className="p-3.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/30 space-y-2">
                                    <span className="text-xs font-bold text-emerald-900 block">+ Adicionar Módulo Customizado na Fase 1:</span>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <input
                                            placeholder="Nome do Módulo (ex: Módulo Manutenção)"
                                            value={novoModuloFase1.nome}
                                            onChange={e => setNovoModuloFase1({ ...novoModuloFase1, nome: e.target.value })}
                                            className="text-xs bg-white border border-slate-200 rounded-lg p-2 outline-none"
                                        />
                                        <input
                                            placeholder="Breve descrição do benefício"
                                            value={novoModuloFase1.descricao}
                                            onChange={e => setNovoModuloFase1({ ...novoModuloFase1, descricao: e.target.value })}
                                            className="text-xs bg-white border border-slate-200 rounded-lg p-2 outline-none sm:col-span-2"
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleAdicionarModuloFase1}
                                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                                        >
                                            Inserir Módulo
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Fase 2: Roadmap Futuro */}
                            <div className="pt-4 border-t border-slate-100">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                    Módulos da Fase 2 (Roadmap Futuro)
                                </h4>
                                <div className="space-y-2">
                                    {(proposta.escopo_fase2 || []).map((mod, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                            <input
                                                value={mod.nome}
                                                onChange={e => {
                                                    const list = [...proposta.escopo_fase2];
                                                    list[idx].nome = e.target.value;
                                                    setProposta({ ...proposta, escopo_fase2: list });
                                                }}
                                                className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded p-1.5 flex-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoverModuloFase2(idx)}
                                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2 pt-1">
                                        <input
                                            placeholder="Nome do módulo roadmap (ex: Módulo Compras)"
                                            value={novoModuloFase2.nome}
                                            onChange={e => setNovoModuloFase2({ ...novoModuloFase2, nome: e.target.value })}
                                            className="text-xs bg-white border border-slate-200 rounded-lg p-2 flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAdicionarModuloFase2}
                                            className="px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900"
                                        >
                                            + Adicionar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bloco 4: Infraestrutura & Metodologia */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Server className="w-4 h-4 text-emerald-600" />
                                4. Infraestrutura Tecnológica Inclusa
                            </h3>
                            <div className="space-y-2">
                                {(proposta.infraestrutura || []).map((inf, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                        <input
                                            value={inf}
                                            onChange={e => {
                                                const list = [...proposta.infraestrutura];
                                                list[idx] = e.target.value;
                                                setProposta({ ...proposta, infraestrutura: list });
                                            }}
                                            className="text-xs text-slate-700 bg-white border border-slate-200 rounded p-1.5 flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoverItemInfra(idx)}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        placeholder="Ex: Rotinas diárias de backup de segurança em nuvem..."
                                        value={novoItemInfra}
                                        onChange={e => setNovoItemInfra(e.target.value)}
                                        className="text-xs bg-white border border-slate-200 rounded-lg p-2 flex-1"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAdicionarItemInfra}
                                        className="px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900"
                                    >
                                        + Inserir Item
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Bloco 5: Valores & Cronograma Temporal Parametrizado (Carência 60 Dias & Parcelas Dinâmicas) */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-emerald-600" />
                                        5. Cronograma Temporal, Carência & Condições Comerciais
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Configure os prazos, valores das frações de setup, parcelas dinâmicas de MVP, carência comercial e vencimentos das mensalidades.
                                    </p>
                                </div>
                                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                                    {temEntradaDia0 || carenciaEfetivaDias === 0 
                                        ? 'Entrada no Aceite (Sem Carência)' 
                                        : `Carência de ${carenciaEfetivaDias} Dias Ativa`}
                                </span>
                            </div>

                            {/* Sub-bloco A: Data do Aceite e Carência Inicial */}
                            <div className="bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-slate-50 border border-emerald-200 rounded-2xl p-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">
                                            📅 Data de Aceite (Simulação ou Real)
                                        </label>
                                        <input
                                            type="date"
                                            value={dataAceiteSimulacao}
                                            onChange={e => handleAtualizarCronograma('data_aceite', e.target.value)}
                                            className="w-full text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <span className="text-[10px] text-slate-500 block mt-1">
                                            {temEntradaDia0 ? `Faturamento Entrada (R$ ${valorEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : 'Dia 0 do projeto (R$ 0,00)'}
                                        </span>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">
                                            Carência Inicial (Dias após aceite)
                                        </label>
                                        <input
                                            type="number"
                                            value={carenciaEfetivaDias}
                                            onChange={e => handleAtualizarCronograma('carencia_dias', Number(e.target.value))}
                                            className="w-full text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <span className="text-[10px] text-slate-500 block mt-1">
                                            {temEntradaDia0 || carenciaEfetivaDias === 0 ? 'Sem carência comercial (0 dias)' : 'Dias sem cobrança inicial'}
                                        </span>
                                    </div>

                                    <div className="bg-white/80 p-3 rounded-xl border border-emerald-200/80 text-xs text-slate-600">
                                        <div className="font-bold text-emerald-900 mb-0.5 flex items-center gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            {temEntradaDia0 || carenciaEfetivaDias === 0 ? 'Condição Comercial: Sem Carência' : 'Regra de Carência Ativa'}
                                        </div>
                                        <p className="text-[11px] leading-snug">
                                            {temEntradaDia0 || carenciaEfetivaDias === 0
                                                ? `Entrada de R$ ${valorEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} faturada no aceite com as parcelas seguintes vinculadas a entregas.`
                                                : `Nenhum desembolso financeiro é exigido no Dia 0. A primeira NF de setup é emitida aos ${carenciaEfetivaDias} dias com vencimento estendido.`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Sub-bloco B: Lista Dinâmica de Parcelas de Implantação / Setup / MVP */}
                            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                            <Layers className="w-4 h-4 text-emerald-600" />
                                            Parcelas de Implantação, Setup & MVP ({parcelasSetup.length} Parcelas)
                                        </span>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Adicione, edite ou remova parcelas conforme a negociação de entregas e cronograma de MVP.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-emerald-900 bg-emerald-100 px-3 py-1 rounded-xl border border-emerald-300">
                                            Total Setup: R$ {totalSetupGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                {/* Cards das Parcelas */}
                                <div className="space-y-3">
                                    {parcelasSetup.map((parc, idx) => {
                                        const dEmissaoParc = addDias(dAceite, parc.dias_apos_aceite);
                                        const dVenctoParc = addDias(dEmissaoParc, parc.dias_vencimento || 10);

                                        return (
                                            <div 
                                                key={parc.id || idx}
                                                className="bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-4 shadow-2xs transition-all space-y-3"
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                                                            {idx + 1}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-800">
                                                            Parcela #{idx + 1} • {parc.nome || `Fração ${idx + 1}`}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-[10px] font-mono bg-slate-50 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                                                            📅 NF: <strong>{formatDataBR(dEmissaoParc)}</strong> ➔ Vencto: <strong>{formatDataBR(dVenctoParc)}</strong>
                                                        </span>

                                                        {parcelasSetup.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoverParcela(idx)}
                                                                title="Remover esta parcela de setup"
                                                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                <span className="hidden sm:inline">Remover</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                    <div>
                                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                                            Descrição / Etapa da Parcela
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={parc.nome || ''}
                                                            onChange={e => handleAtualizarParcela(idx, 'nome', e.target.value)}
                                                            placeholder="Ex: 1ª Fração - Implantação Piloto & MVP"
                                                            className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                                            Prazo de Emissão da NF (Dias após aceite)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={parc.dias_apos_aceite || ''}
                                                            onChange={e => handleAtualizarParcela(idx, 'dias_apos_aceite', Number(e.target.value))}
                                                            className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                                                        />
                                                        <span className="text-[10px] text-slate-400 block mt-0.5">NF aos {parc.dias_apos_aceite} dias</span>
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                                            Valor da Parcela (R$)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={parc.valor || ''}
                                                            onChange={e => handleAtualizarParcela(idx, 'valor', Number(e.target.value))}
                                                            className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-emerald-500 text-amber-900"
                                                        />
                                                        <span className="text-[10px] text-slate-400 block mt-0.5">R$ {(Number(parc.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                                            Dias para Vencimento após NF
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={parc.dias_vencimento || 10}
                                                            onChange={e => handleAtualizarParcela(idx, 'dias_vencimento', Number(e.target.value))}
                                                            className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                                                        />
                                                        <span className="text-[10px] text-slate-400 block mt-0.5">Vencimento em {parc.dias_vencimento || 10} dias</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Botão para Adicionar Nova Parcela */}
                                <button
                                    type="button"
                                    onClick={handleAdicionarParcela}
                                    className="w-full py-3.5 px-4 rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-600 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs hover:shadow-xs group cursor-pointer"
                                >
                                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Plus className="w-3.5 h-3.5" />
                                    </div>
                                    <span>+ Adicionar Mais uma Parcela de Implantação / MVP</span>
                                </button>
                            </div>

                            {/* Sub-bloco C: Sustentação Mensal e Ciclo de Faturamento */}
                            <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/50">
                                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                                    Sustentação Mensal (SaaS) & Ciclo Recorrente de Faturamento
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Mensalidade Base (SM)</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={proposta.investimento?.sustentacao_mensal?.valor_base_salarios_minimos || ''}
                                            onChange={e => setProposta({
                                                ...proposta,
                                                investimento: {
                                                    ...proposta.investimento,
                                                    sustentacao_mensal: { ...proposta.investimento?.sustentacao_mensal, valor_base_salarios_minimos: Number(e.target.value) }
                                                }
                                            })}
                                            className="w-full text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-emerald-800"
                                        />
                                        <span className="text-[10px] text-slate-500 block mt-1">Equivalente a {baseSM} SM (R$ {mensalidadeSustentacaoProjecao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Franquia de Canteiros</label>
                                        <input
                                            type="number"
                                            value={proposta.investimento?.sustentacao_mensal?.franquia_canteiros || ''}
                                            onChange={e => setProposta({
                                                ...proposta,
                                                investimento: {
                                                    ...proposta.investimento,
                                                    sustentacao_mensal: { ...proposta.investimento?.sustentacao_mensal, franquia_canteiros: Number(e.target.value) }
                                                }
                                            })}
                                            className="w-full text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <span className="text-[10px] text-slate-500 block mt-1">Canteiros inclusos sem acréscimo</span>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Canteiro Extra (SM)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={proposta.investimento?.sustentacao_mensal?.acrescimo_por_canteiro_extra_sm || ''}
                                            onChange={e => setProposta({
                                                ...proposta,
                                                investimento: {
                                                    ...proposta.investimento,
                                                    sustentacao_mensal: { ...proposta.investimento?.sustentacao_mensal, acrescimo_por_canteiro_extra_sm: Number(e.target.value) }
                                                }
                                            })}
                                            className="w-full text-xs font-mono bg-white border border-slate-200 rounded-xl p-2.5 outline-none"
                                        />
                                        <span className="text-[10px] text-slate-500 block mt-1">Por canteiro excedente à franquia</span>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Dia Emissão NF Mensalidade</label>
                                        <input
                                            type="number"
                                            value={mensalidadeDiaEmissao}
                                            onChange={e => handleAtualizarCronograma('mensalidade_dia_emissao', Number(e.target.value))}
                                            className="w-full text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <span className="text-[10px] text-slate-500 block mt-1">Padrão: dia 28 do mês corrente</span>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Dia Vencimento Mensalidade</label>
                                        <input
                                            type="number"
                                            value={mensalidadeDiaVencto}
                                            onChange={e => handleAtualizarCronograma('mensalidade_dia_vencimento', Number(e.target.value))}
                                            className="w-full text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <span className="text-[10px] text-slate-500 block mt-1">Padrão: dia 10 do mês subsequente</span>
                                    </div>
                                </div>
                            </div>

                            {/* Sub-bloco C.2: OPÇÕES DE INCLUSÃO DO CRONOGRAMA NOS ARQUIVOS EXPORTADOS */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                                        <h5 className="text-xs font-bold text-slate-800">
                                            Inclusão da Tabela de Pagamento (60 Dias) nos Documentos Exportados
                                        </h5>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">Controle individual por tipo de arquivo</span>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* PDF */}
                                    <label className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                        incluirTabelaPdf 
                                            ? 'bg-white border-emerald-300 shadow-2xs' 
                                            : 'bg-slate-100 border-slate-200 opacity-70'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={incluirTabelaPdf}
                                            onChange={(e) => handleAtualizarCronograma('incluir_tabela_pdf', e.target.checked)}
                                            className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-900 block">📄 Incluir no PDF</span>
                                            <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                                                {incluirTabelaPdf ? 'A tabela será impressa no documento PDF.' : 'A tabela será omitida na impressão / PDF.'}
                                            </span>
                                        </div>
                                    </label>

                                    {/* Word */}
                                    <label className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                        incluirTabelaWord 
                                            ? 'bg-white border-blue-300 shadow-2xs' 
                                            : 'bg-slate-100 border-slate-200 opacity-70'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={incluirTabelaWord}
                                            onChange={(e) => handleAtualizarCronograma('incluir_tabela_word', e.target.checked)}
                                            className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-900 block">📝 Incluir no Word (.docx)</span>
                                            <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                                                {incluirTabelaWord ? 'Gera a Seção 5.3 com a tabela de marcos.' : 'Omite a Seção 5.3 do arquivo docx.'}
                                            </span>
                                        </div>
                                    </label>

                                    {/* PPTX */}
                                    <label className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                        incluirTabelaPptx 
                                            ? 'bg-white border-amber-300 shadow-2xs' 
                                            : 'bg-slate-100 border-slate-200 opacity-70'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={incluirTabelaPptx}
                                            onChange={(e) => handleAtualizarCronograma('incluir_tabela_pptx', e.target.checked)}
                                            className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-900 block">📊 Incluir no PowerPoint (.pptx)</span>
                                            <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                                                {incluirTabelaPptx ? 'Exibe marcos e carência no slide 12/13.' : 'Exibe resumo sem datas no slide 12/13.'}
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Sub-bloco D: PRÉ-VISUALIZAÇÃO EM TEMPO REAL DAS TABELAS FINANCEIRAS */}
                            <div className="border-t-2 border-slate-200 pt-6 mt-6 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                        </span>
                                        <div>
                                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                <Eye className="w-4 h-4 text-emerald-400" />
                                                Pré-Visualização em Tempo Real (Ajuste Imediato)
                                            </h4>
                                            <p className="text-[11px] text-slate-300">
                                                Acompanhe a tabela e o fluxo financeiro se recalculando instantaneamente conforme você edita acima.
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Seletor de Pré-Visualização */}
                                    <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewTabBloco5('temporal')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                previewTabBloco5 === 'temporal'
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            📅 Tabela Temporal (Marcos)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewTabBloco5('progressao')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                previewTabBloco5 === 'progressao'
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            📈 Progressão Mês a Mês
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-200 shadow-2xs">
                                    {previewTabBloco5 === 'temporal' ? (
                                        renderTabelaTemporalPagamento()
                                    ) : (
                                        renderPainelProgressaoInvestimento()
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Botão de Salvar Fixo no Rodapé */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={handleSalvarEdicoes}
                                disabled={saving}
                                className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Save className="w-5 h-5" />
                                <span>{saving ? 'Gravando no Servidor...' : 'Salvar Todas as Alterações da Proposta'}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* =========================================================================
                    ABA 2: APRESENTAÇÃO EM SLIDES (WIDESCREEN 16:9 - 13 SLIDES)
                ========================================================================= */}
                {activeTab === 'slides' && proposta && (
                    <div className="space-y-4">
                        {/* Controles de Apresentação */}
                        <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                                    disabled={currentSlide === 0}
                                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 transition-all"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="text-xs font-bold text-slate-700 font-mono px-2">
                                    Slide {currentSlide + 1} de 13
                                </span>
                                <button
                                    onClick={() => setCurrentSlide(Math.min(12, currentSlide + 1))}
                                    disabled={currentSlide === 12}
                                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 transition-all"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Miniaturas de navegação rápida */}
                            <div className="hidden md:flex items-center gap-1.5">
                                {Array.from({ length: 13 }).map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentSlide(i)}
                                        className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all ${
                                            currentSlide === i
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2">
                                <a 
                                    href="/propostas/Proposta_Comercial_SINCO_Irricom_2026.pptx"
                                    download={proposta.pptx_filename || "Proposta_Comercial_SINCO.pptx"}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Baixar PPTX</span>
                                </a>
                            </div>
                        </div>

                        {/* Moldura Widescreen 16:9 */}
                        <div className="aspect-[16/9] w-full bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-10 flex flex-col justify-between overflow-hidden relative">
                            {/* Slide 0: Capa */}
                            {currentSlide === 0 && (
                                <div className="h-full flex flex-col justify-between">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-emerald-600" />
                                            <span className="text-xs font-black tracking-widest uppercase text-slate-800">LYNX SOLUÇÕES CORPORATIVAS</span>
                                        </div>
                                        <span className="text-[11px] font-mono text-slate-400 font-semibold">{proposta.codigo} • {proposta.revisao || 'Rev 00'}</span>
                                    </div>
                                    <div className="my-auto space-y-4 max-w-3xl">
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block">
                                            PROPOSTA TÉCNICO-COMERCIAL • 2026
                                        </span>
                                        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                                            Implementação do Ecossistema SINCO
                                        </h1>
                                        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                                            Digitalização de ponta a ponta da operação de campo, gestão fabril, qualidade (SGQ) e segurança (SST) para a <strong>{proposta.cliente_razao_social || proposta.cliente_nome}</strong>.
                                        </p>
                                        {/* Badges dos Módulos Principais */}
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {[
                                                'SST Industrial & NRs',
                                                'SGQ ISO 9001 & Data Book',
                                                'Gestão Fabril & Chão de Fábrica',
                                                'RDO Digital & Obras',
                                                'Solicitações Canteiro-Matriz',
                                                'Conexão Universal com ERPs (Protheus, Omie, Sankhya)'
                                            ].map((badge, idx) => (
                                                <span key={idx} className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                                    {badge}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                                        <span>Cliente: <strong>{proposta.cliente_nome}</strong></span>
                                        <span>Ambiente: <strong>{proposta.url_ambiente}</strong></span>
                                    </div>
                                </div>
                            )}

                            {/* Slide 1: Contexto */}
                            {currentSlide === 1 && (
                                <div className="h-full flex flex-col justify-between">
                                    <div>
                                        <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">CONTEXTO CORPORATIVO</div>
                                        <h2 className="text-2xl font-black text-slate-900 mb-1">A Operação da {proposta.cliente_nome} & Alinhamento Estratégico</h2>
                                        <p className="text-xs text-slate-500">{proposta.setor || 'Excelência operacional conectando engenharia, produção e campo'}</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 my-auto">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <h3 className="font-bold text-slate-900 text-sm mb-2">Escala Operacional</h3>
                                            <ul className="text-xs text-slate-600 space-y-1.5">
                                                <li>• Histórico e reputação consolidados</li>
                                                <li>• Volume expressivo de projetos entregues</li>
                                                <li>• Múltiplas frentes de trabalho ativas</li>
                                                <li>• Atendimento a grandes clientes industriais</li>
                                            </ul>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <h3 className="font-bold text-slate-900 text-sm mb-2">Desafio de Governança</h3>
                                            <ul className="text-xs text-slate-600 space-y-1.5">
                                                <li>• Conformidade com ISO 9001</li>
                                                <li>• Exigência rigorosa de SST</li>
                                                <li>• Rastreabilidade Canteiro-Matriz</li>
                                                <li>• Eliminação de papel e retrabalho</li>
                                            </ul>
                                        </div>
                                        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
                                            <h3 className="font-bold text-emerald-950 text-sm mb-2">Objetivo da Parceria</h3>
                                            <ul className="text-xs text-slate-700 space-y-1.5">
                                                <li>• Digitalização ponta a ponta</li>
                                                <li>• Mobilidade para os operadores</li>
                                                <li>• Integração com qualquer ERP (Protheus, Omie, Sankhya, etc.)</li>
                                                <li>• Gestão SaaS pela Lynx</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between">
                                        <span>Proposta Técnico-Comercial • {proposta.cliente_nome}</span>
                                        <span>Página 2 de 13</span>
                                    </div>
                                </div>
                            )}

                            {/* Slide 2: O Ecossistema Sinco */}
                            {currentSlide === 2 && (
                                <div className="h-full flex flex-col justify-between">
                                    <div>
                                        <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">ARQUITETURA & TECNOLOGIA</div>
                                        <h2 className="text-2xl font-black text-slate-900 mb-1">O Que é o Ecossistema SINCO</h2>
                                        <p className="text-xs text-slate-500">A camada de inteligência e mobilidade operacional compatível com qualquer ERP ou operação autônoma</p>
                                    </div>
                                    <div className="grid grid-cols-4 gap-3 my-auto">
                                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">CAMADA 1</span>
                                            <h3 className="font-bold text-slate-900 text-xs mb-1.5">PWA Mobile de Campo</h3>
                                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                                Interface tátil para celulares e tablets. Funciona online e offline em canteiros remotos, com sincronização automática.
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">CAMADA 2</span>
                                            <h3 className="font-bold text-slate-900 text-xs mb-1.5">Cockpit Web Matriz</h3>
                                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                                Central de controle para gerentes e diretores acompanharem avanço físico, pendências de compras e KPIs em tempo real.
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">CAMADA 3</span>
                                            <h3 className="font-bold text-slate-900 text-xs mb-1.5">Conexão Universal ERP</h3>
                                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                                Barramento nativo com qualquer ERP (conectores prontos para Protheus, Omie, Sankhya, etc.), aproveitando cadastros de clientes, produtos, pedidos e OPs sem retrabalho.
                                            </p>
                                        </div>
                                        <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">CAMADA 4</span>
                                            <h3 className="font-bold text-emerald-950 text-xs mb-1.5">Segurança & Auditoria</h3>
                                            <p className="text-[11px] text-slate-700 leading-relaxed">
                                                Acessos por perfil, histórico completo de alterações (log auditável) e infraestrutura em nuvem blindada com SSL.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between">
                                        <span>Proposta Técnico-Comercial • {proposta.cliente_nome}</span>
                                        <span>Página 3 de 13</span>
                                    </div>
                                </div>
                            )}

                            {/* Slides 3 a 11 com visualizadores dinâmicos e ricos em detalhes do SINCO */}
                            {currentSlide > 2 && currentSlide < 12 && (
                                <div className="h-full flex flex-col justify-between">
                                    <div>
                                        <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                                            {[
                                                '', '', '',
                                                'MÓDULO OPERACIONAL • SST INDUSTRIAL',
                                                'MÓDULO OPERACIONAL • SGQ & ISO 9001',
                                                'MÓDULO OPERACIONAL • GESTÃO FABRIL & PCP',
                                                'MÓDULO OPERACIONAL • CAMPO & SOLICITAÇÕES',
                                                'ROADMAP DE EXPANSÃO • FASE 2',
                                                'METODOLOGIA DE IMPLANTAÇÃO',
                                                'GOVERNANÇA DO PROJETO',
                                                'INFRAESTRUTURA EM NUVEM',
                                                'CONDIÇÕES COMERCIAIS'
                                            ][currentSlide]}
                                        </div>
                                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-0.5">
                                            {[
                                                '', '', '',
                                                'Fase 1: Módulo SST (Saúde e Segurança do Trabalho)',
                                                'Fase 1: Módulo SGQ (Qualidade ISO 9001 & Data Book)',
                                                'Fase 1: Módulo Gestão Fabril & Chão de Fábrica',
                                                'Fase 1: Gestão de Campo (RDO) & Solicitações Canteiro-Matriz',
                                                'Fase 2: Roadmap de Expansão (Módulos Futuros)',
                                                temEntradaDia0 || carenciaEfetivaDias === 0 
                                                    ? 'Metodologia Ágil LYNX: Inovação & Homologação Contínua' 
                                                    : 'Metodologia Ágil LYNX: Inovação com MVP (60 Dias)',
                                                temEntradaDia0 || carenciaEfetivaDias === 0 
                                                    ? 'Checkpoint de Avaliação & Homologação aos 60 Dias' 
                                                    : 'Checkpoint de Avaliação aos 60 Dias (Entrega & Satisfação)',
                                                'Infraestrutura Tecnológica SaaS Inclusa',
                                                'Investimento: Setup Inicial & Sustentação Mensal'
                                            ][currentSlide]}
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            {[
                                                '', '', '',
                                                'Gestão digital de compliance para ambientes de alto risco (mineração e indústria pesada)',
                                                'Digitalização de inspeções de qualidade, rastreabilidade por QR Code e controle metrológico',
                                                'Apontamento operacional touch, tempos-padrão e esteira produtiva em tempo real',
                                                'Diário de obra digital com avanço físico e canal oficial de requisições de suprimentos',
                                                'Almoxarifado inteligente, portal de compras/NF-e e gestão financeira por canteiro de obras',
                                                'Desenvolvimento profundo e orgânico, sem modelos tradicionais engessados',
                                                'Transparência total e validação prática de aderência antes da fase continuada',
                                                `Ambiente web dedicado para a ${proposta.cliente_nome} com alta disponibilidade e backups`,
                                                temEntradaDia0 || carenciaEfetivaDias === 0 
                                                    ? `Setup em ${parcelasSetup.length} etapas por entregas e sustentação mensal recorrente` 
                                                    : 'Setup faseado nos primeiros 60 dias e mensalidade base com regra justa de canteiros'
                                            ][currentSlide]}
                                        </p>
                                    </div>

                                    {/* SLIDE 3: MÓDULO SST */}
                                    {currentSlide === 3 && (
                                        <div className="grid grid-cols-2 gap-3.5 my-auto">
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                                    <h4 className="font-bold text-slate-900 text-xs">DDS Digital & Assinatura na Tela</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    Realização do Diálogo Diário de Segurança direto no smartphone do encarregado, com assinatura digital na tela e captura fotográfica da equipe reunida na frente de serviço.
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                                    <h4 className="font-bold text-slate-900 text-xs">APR & Permissão de Trabalho (PT / PET)</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    Liberação digital para atividades críticas (NR-35 trabalho em altura, NR-10 elétrica, NR-33 espaço confinado) com validação obrigatória de pré-requisitos antes do início.
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                                    <h4 className="font-bold text-slate-900 text-xs">Checklists com Fotos Obrigatórias</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    Vistorias pré-operacionais de caminhões munck, guindastes, compressores, ferramentas elétricas e EPIs/EPCs com fotos para blindagem e comprovação jurídica.
                                                </p>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-700" />
                                                    <h4 className="font-bold text-emerald-950 text-xs">Gestão de NRs, ASOs & Indicador HHT</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-700 leading-relaxed">
                                                    Alertas com 30 dias de antecedência para reciclagens de treinamentos de NR e exames periódicos (ASOs), além de cálculo automático de Homens-Hora Trabalhados (HHT).
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* SLIDE 4: MÓDULO SGQ */}
                                    {currentSlide === 4 && (
                                        <div className="grid grid-cols-2 gap-3.5 my-auto">
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                                    <h4 className="font-bold text-slate-900 text-xs">FIP e FIQ Digitais no Posto</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    Fichas de Inspeção de Processo e Qualidade com tolerâncias dimensionais, ensaios não destrutivos (líquido penetrante, visual de solda) e registro fotográfico imediato.
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                                    <h4 className="font-bold text-slate-900 text-xs">Gestão de RNCs com 5W2H e Ishikawa</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    Abertura ágil de Não Conformidades na fábrica ou na obra, determinação da causa-raiz estruturada (Ishikawa) e plano de ação corretivo com prazos e responsáveis.
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                                    <h4 className="font-bold text-slate-900 text-xs">Rastreabilidade por QR Code & Usina</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    Etiquetagem com QR Code unitário em cada peça ou conjunto fabricado, vinculando digitalmente o certificado de corrida da chapa/perfil ao soldador qualificado responsável.
                                                </p>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-700" />
                                                    <h4 className="font-bold text-emerald-950 text-xs">Calibração & Data Book em 1 Clique</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-700 leading-relaxed">
                                                    Controle metrológico de paquímetros, torquímetros e manômetros, com geração automatizada do Data Book completo para entrega a mineradoras e indústrias contratantes.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* SLIDE 5: GESTÃO FABRIL */}
                                    {currentSlide === 5 && (
                                        <div className="grid grid-cols-2 gap-3.5 my-auto">
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                                    <h4 className="font-bold text-slate-900 text-xs">Apontamento Touch nos Postos de Trabalho</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    Terminais industriais touch em corte, dobra, caldeiraria, solda, pintura e montagem. Início e fim de operações via leitor de código de barras das OPs com zero digitação.
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                                    <h4 className="font-bold text-slate-900 text-xs">Tempo Padrão vs. Tempo Real</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    Comparativo automático entre o tempo estimado pela engenharia e o tempo real apontado pelo operador, apurando a produtividade e o custo real de fabricação.
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                                    <h4 className="font-bold text-slate-900 text-xs">Esteira Produtiva Visual (Kanban Fabril)</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    Painel de status das OPs: "Aguardando Matéria-Prima", "Em Fabricação", "Aguardando Inspeção SGQ" e "Liberado para Carga", alertando o PCP sobre qualquer gargalo.
                                                </p>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-700" />
                                                    <h4 className="font-bold text-emerald-950 text-xs">Romaneio de Expedição & Refugo</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-700 leading-relaxed">
                                                    Conferência cega por leitor óptico na expedição, garantindo 100% de exatidão no embarque para a obra, além de controle e quantificação de perdas metálicas e retrabalho.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* SLIDE 6: GESTÃO DE CAMPO & SOLICITAÇÕES */}
                                    {currentSlide === 6 && (
                                        <div className="grid grid-cols-2 gap-4 my-auto">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">CANTEIRO DE OBRA</span>
                                                    <h4 className="font-bold text-slate-900 text-xs">Gestão de Campo & RDO Digital</h4>
                                                </div>
                                                <ul className="text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                                                    <li>• <strong>RDO 100% Digital:</strong> Registro diário de clima, efetivo por função e turnos ativos.</li>
                                                    <li>• <strong>Avanço Físico Ponderado:</strong> % executado com fotos georreferenciadas e carimbo de hora.</li>
                                                    <li>• <strong>Relatório de Paralisações:</strong> Registro formal de chuvas ou terceiros para pleitos contratuais.</li>
                                                    <li>• <strong>Modo Offline Híbrido:</strong> Funciona mesmo sem sinal 4G, sincronizando ao reconectar.</li>
                                                </ul>
                                            </div>

                                            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-2">
                                                <div className="flex items-center gap-2 border-b border-emerald-200 pb-2">
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-200 text-emerald-900">CANAL OFICIAL</span>
                                                    <h4 className="font-bold text-emerald-950 text-xs">Solicitações Canteiro ↔ Matriz</h4>
                                                </div>
                                                <ul className="text-[11px] text-slate-700 space-y-1.5 leading-relaxed">
                                                    <li>• <strong>Requisição Mobile Direta:</strong> Pedido de peças, EPIs e ferramentas pelo celular do encarregado.</li>
                                                    <li>• <strong>Alçadas Inteligentes:</strong> Aprovação em níveis (Encarregado → Coordenador → Suprimentos).</li>
                                                    <li>• <strong>Rastreamento Logístico:</strong> Timeline visual de despacho, trânsito e entrega no canteiro.</li>
                                                    <li>• <strong>Eliminação do WhatsApp:</strong> Fim de pedidos informais perdidos e compras em duplicidade.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {/* SLIDE 7: ROADMAP FASE 2 */}
                                    {currentSlide === 7 && (
                                        <div className="grid grid-cols-3 gap-3.5 my-auto">
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">MÓDULO FUTURO</span>
                                                <h4 className="font-bold text-slate-900 text-xs mb-2">Almoxarifado & Custódia</h4>
                                                <ul className="text-[11px] text-slate-600 space-y-1.5">
                                                    <li>• Saldos em tempo real por canteiro e central</li>
                                                    <li>• Custódia de caixas de ferramentas</li>
                                                    <li>• Transferência entre obras com romaneio</li>
                                                    <li>• Inventário rotativo por código de barras</li>
                                                </ul>
                                            </div>
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">MÓDULO FUTURO</span>
                                                <h4 className="font-bold text-slate-900 text-xs mb-2">Compras & Suprimentos</h4>
                                                <ul className="text-[11px] text-slate-600 space-y-1.5">
                                                    <li>• Mapa comparativo de cotações ágil</li>
                                                    <li>• Auditoria de Pedido vs XML da NF-e</li>
                                                    <li>• Qualificação de fornecedores industriais</li>
                                                    <li>• Gestão de SLA de entrega e prazos</li>
                                                </ul>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">MÓDULO FUTURO</span>
                                                <h4 className="font-bold text-emerald-950 text-xs mb-2">Gestão Financeira</h4>
                                                <ul className="text-[11px] text-slate-700 space-y-1.5">
                                                    <li>• Medições vinculadas ao avanço no RDO</li>
                                                    <li>• Fluxo de caixa projetado vs realizado</li>
                                                    <li>• Centro de custos individual por canteiro</li>
                                                    <li>• DRE gerencial consolidado e balancetes</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {/* SLIDE 8: METODOLOGIA ÁGIL MVP */}
                                    {currentSlide === 8 && (
                                        <div className="grid grid-cols-3 gap-3.5 my-auto">
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs mb-2">01</div>
                                                <h4 className="font-bold text-slate-900 text-xs mb-1.5">
                                                    {proposta.metodologia?.pilares?.[0]?.titulo || (temEntradaDia0 || carenciaEfetivaDias === 0 ? 'Imersão Inicial & Diagnóstico Fabril' : 'Imersão de 60 Dias')}
                                                </h4>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    {proposta.metodologia?.pilares?.[0]?.descricao || 'Dedicação técnica para mapear postos de trabalho e processos, adaptando a plataforma à rotina real sem burocracias.'}
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs mb-2">02</div>
                                                <h4 className="font-bold text-slate-900 text-xs mb-1.5">Aceleração de Valor</h4>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    O sistema roda e gera valor desde os primeiros ciclos. As equipes testam em condições reais de obra e fábrica, permitindo melhorias ágeis e contínuas.
                                                </p>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-200 text-emerald-900 flex items-center justify-center font-bold text-xs mb-2">03</div>
                                                <h4 className="font-bold text-emerald-950 text-xs mb-1.5">Foco na Assertividade</h4>
                                                <p className="text-[11px] text-slate-700 leading-relaxed">
                                                    A ferramenta evolui com base nos gargalos reais da operação, garantindo alta adesão natural dos colaboradores e retorno imediato sobre o investimento.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* SLIDE 9: CHECKPOINT 60 DIAS */}
                                    {currentSlide === 9 && (
                                        <div className="grid grid-cols-2 gap-4 my-auto">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                                                    <h4 className="font-bold text-slate-900 text-xs">Relatório Técnico de Entrega</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    Ao término dos primeiros 60 dias de imersão, a LYNX emitirá um dossiê formal detalhando:
                                                </p>
                                                <ul className="text-[11px] text-slate-600 space-y-1">
                                                    <li>• Status e maturidade de cada módulo implementado</li>
                                                    <li>• Volume de apontamentos e adesão no chão de fábrica e obras</li>
                                                    <li>• Mapeamento de gargalos eliminados e redução de retrabalho</li>
                                                </ul>
                                            </div>

                                            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-2">
                                                <div className="flex items-center gap-2 border-b border-emerald-200 pb-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
                                                    <h4 className="font-bold text-emerald-950 text-xs">Pesquisa de Satisfação & Continuidade</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-700 leading-relaxed">
                                                    Avaliação conjunta com a liderança para comprovar os ganhos práticos:
                                                </p>
                                                <ul className="text-[11px] text-slate-700 space-y-1">
                                                    <li>• Validação da aderência da plataforma à rotina diária</li>
                                                    <li>• Decisão transparente e segura para a fase de sustentação mensal</li>
                                                    <li>• Parceria sólida de longo prazo baseada em resultados mensuráveis</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {/* SLIDE 10: INFRAESTRUTURA SAAS */}
                                    {currentSlide === 10 && (
                                        <div className="grid grid-cols-4 gap-3 my-auto">
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                <h4 className="font-bold text-slate-900 text-xs mb-1">Domínio Próprio</h4>
                                                <span className="text-[10px] font-mono text-emerald-700 block mb-1 truncate">{proposta.url_ambiente}</span>
                                                <p className="text-[11px] text-slate-500 leading-relaxed">Ambiente web seguro com certificado SSL e acesso criptografado.</p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                <h4 className="font-bold text-slate-900 text-xs mb-1">Cloud Dedicado</h4>
                                                <span className="text-[10px] font-bold text-slate-400 block mb-1">Alta Disponibilidade</span>
                                                <p className="text-[11px] text-slate-500 leading-relaxed">Servidores em nuvem de alta performance sem necessidade de hardware local.</p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                <h4 className="font-bold text-slate-900 text-xs mb-1">Backups Diários</h4>
                                                <span className="text-[10px] font-bold text-slate-400 block mb-1">Segurança de Dados</span>
                                                <p className="text-[11px] text-slate-500 leading-relaxed">Rotinas automáticas diárias de retenção de dados e tolerância a falhas.</p>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                                                <h4 className="font-bold text-emerald-950 text-xs mb-1">Sustentação Inclusa</h4>
                                                <span className="text-[10px] font-bold text-emerald-800 block mb-1">Suporte Lynx</span>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">Manutenções preventivas, melhorias contínuas e suporte técnico inclusos.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* SLIDE 11: INVESTIMENTO & REGRAS */}
                                    {currentSlide === 11 && (
                                        <div className="grid grid-cols-2 gap-4 my-auto">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">FASE 1 • SETUP ({parcelasSetup.length} PARCELAS)</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800">
                                                        {temEntradaDia0 || carenciaEfetivaDias === 0 
                                                            ? 'Entrada no Aceite (Sem Carência)' 
                                                            : 'Dia 0 = R$ 0,00'}
                                                    </span>
                                                </div>
                                                {temEntradaDia0 ? (
                                                    <div className="flex items-center justify-between border-b border-slate-200 pb-1 text-xs">
                                                        <span className="text-slate-600">Entrada (Assinatura Contratual):</span>
                                                        <span className="font-bold text-emerald-900 text-xs">
                                                            R$ {valorEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (vencto {venctoEntrada}d)
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between border-b border-slate-200 pb-1 text-xs">
                                                        <span className="text-slate-600">Dia 0 (Aceite da Proposta):</span>
                                                        <span className="font-bold text-slate-800 text-xs">R$ 0,00 (Carência inicial {carenciaEfetivaDias}d)</span>
                                                    </div>
                                                )}
                                                {parcelasSetup.filter(p => Number(p.dias_apos_aceite) > 0).map((parc, idx) => (
                                                    <div key={parc.id || idx} className="flex items-center justify-between border-b border-slate-200 pb-1 text-xs">
                                                        <span className="text-slate-600">{parc.nome || `Fração #${idx + 1}`} (Dia {parc.dias_apos_aceite}):</span>
                                                        <span className="font-bold text-amber-900 text-xs">R$ {(Number(parc.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (vencto {parc.dias_vencimento || 10}d)</span>
                                                    </div>
                                                ))}
                                                <div className="flex items-center justify-between pt-1">
                                                    <span className="text-xs font-bold text-slate-800">Total Setup Quitado:</span>
                                                    <span className="font-black text-emerald-800 text-sm">R$ {totalSetupGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>

                                            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-2">
                                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">FASE 2 • SUSTENTAÇÃO SAAS RECORRENTE</span>
                                                <div className="flex items-center justify-between border-b border-emerald-200 pb-1">
                                                    <span className="text-xs text-slate-700">Ciclo de Faturamento:</span>
                                                    <span className="font-bold text-emerald-950 text-xs">NF dia {mensalidadeDiaEmissao} • Vencto dia {mensalidadeDiaVencto}</span>
                                                </div>
                                                <div className="flex items-center justify-between border-b border-emerald-200 pb-1">
                                                    <span className="text-xs text-slate-700">Mensalidade Base ({franquiaCanteiros} canteiros):</span>
                                                    <span className="font-black text-emerald-900 text-xs">{baseSM} SM (R$ {mensalidadeSustentacaoProjecao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span>
                                                </div>
                                                <div className="flex items-center justify-between border-b border-emerald-200 pb-1">
                                                    <span className="text-xs text-slate-700">Canteiro Extra (Pay-per-use):</span>
                                                    <span className="font-bold text-slate-800 text-xs">+{extraSM} SM / canteiro ativo</span>
                                                </div>
                                                <p className="text-[10px] text-slate-600 leading-tight pt-1">
                                                    • Autonomia total: encerrou a obra no app, a cobrança adicional cessa imediatamente no mês seguinte.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between">
                                        <span>Proposta Técnico-Comercial • {proposta.cliente_nome}</span>
                                        <span>Página {currentSlide + 1} de 13</span>
                                    </div>
                                </div>
                            )}

                            {/* Slide 12: Projeção de Investimento (12 ou 24 Meses) */}
                            {currentSlide === 12 && (
                                <div className="h-full flex flex-col justify-between">
                                    <div>
                                        <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">CRONOGRAMA FINANCEIRO</div>
                                        <h2 className="text-2xl font-black text-slate-900 mb-1">
                                            Projeção e Progressão do Investimento ({progressaoMeses} Meses)
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Visão consolidada de desembolso para a {proposta.cliente_nome} considerando {canteirosMesProjecao} canteiros
                                        </p>
                                    </div>

                                    <div className="my-auto space-y-3">
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                <span className="text-[10px] text-slate-400 font-bold block">TOTAL DO PERÍODO</span>
                                                <span className="text-lg font-black text-slate-900">
                                                    R$ {totalInvestimentoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                                                <span className="text-[10px] text-emerald-800 font-bold block">MÉDIA MENSAL DILUÍDA</span>
                                                <span className="text-lg font-black text-emerald-900">
                                                    R$ {mediaMensalDiluida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                <span className="text-[10px] text-slate-400 font-bold block">CUSTO POR CANTEIRO / MÊS</span>
                                                <span className="text-lg font-black text-slate-800">
                                                    R$ {custoPorCanteiroMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-2">
                                            <span>
                                                • <strong>Fase 1 (Carência & Setup):</strong> Mês 1 Carência (R$ 0,00). 1ª Fração (Dia {carenciaDias}) e 2ª Fração (Dia {fracao2Dias}) de R$ {fracao1Valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} cada (Total: R$ {totalSetupGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                            </span>
                                            <span>
                                                • <strong>Fase 2 (Mensalidades):</strong> Emissão todo dia {mensalidadeDiaEmissao} c/ vencto dia {mensalidadeDiaVencto} próx. mês (R$ {mensalidadeSustentacaoProjecao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês)
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between">
                                        <span>Proposta Técnico-Comercial • {proposta.cliente_nome}</span>
                                        <span>Página 13 de 13</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* =========================================================================
                    ABA 3: SIMULADOR & PARÂMETROS COMERCIAIS
                ========================================================================= */}
                {activeTab === 'simulador' && proposta && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Simulador Interativo */}
                            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        <Calculator className="w-5 h-5 text-emerald-600" />
                                        Simulador de Mensalidade
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Calcule o valor da sustentação com base no número de canteiros ativos da {proposta.cliente_nome}.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                                            Salário Mínimo de Referência (R$)
                                        </label>
                                        <input
                                            type="number"
                                            value={salarioMinimoAtual}
                                            onChange={(e) => setSalarioMinimoAtual(Number(e.target.value))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <span className="text-[10px] text-slate-400 mt-0.5 block">Vigente 2026: R$ 1.518,00</span>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-xs font-semibold text-slate-700">
                                                Canteiros de Obra Ativos
                                            </label>
                                            <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                {simuladorCanteiros} canteiros
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="50"
                                            value={simuladorCanteiros}
                                            onChange={(e) => setSimuladorCanteiros(Number(e.target.value))}
                                            className="w-full accent-emerald-600 cursor-pointer"
                                        />
                                        <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                                            <span>1</span>
                                            <span>Franquia: {franquiaCanteiros}</span>
                                            <span>50</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Resumo do Cálculo */}
                                <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>Mensalidade Base:</span>
                                        <span className="font-bold text-slate-900">{baseSM} SM</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>Canteiros Excedentes:</span>
                                        <span className="font-bold text-slate-900">
                                            {canteirosExcedentesSimulador} canteiro(s) (+{(canteirosExcedentesSimulador * extraSM).toFixed(1)} SM)
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-600 border-t border-emerald-200/60 pt-2">
                                        <span>Total em Salários Mínimos:</span>
                                        <span className="font-bold text-slate-900">{smTotaisSimulador} SM</span>
                                    </div>
                                    <div className="pt-2 border-t border-emerald-200/60">
                                        <div className="text-[10px] text-slate-500">Valor Estimado da Mensalidade:</div>
                                        <div className="text-2xl font-black text-emerald-900 mt-0.5">
                                            R$ {valorMensalidadeSimulador.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Formulário de Parâmetros Editáveis */}
                            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                            <Sliders className="w-5 h-5 text-emerald-600" />
                                            Parâmetros da Proposta ({proposta.cliente_nome})
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Altere os valores e condições contratuais desta proposta comercial.
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleSalvarEdicoes}
                                        disabled={saving}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4" />
                                        <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {parcelasSetup.map((parc, idx) => (
                                        <div key={parc.id || idx}>
                                            <label className="text-xs font-semibold text-slate-700 block mb-1">
                                                {parc.nome || `Valor Parcela #${idx + 1}`} (R$)
                                            </label>
                                            <input
                                                type="number"
                                                value={parc.valor || ''}
                                                onChange={(e) => handleAtualizarParcela(idx, 'valor', Number(e.target.value))}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                                                Dia {parc.dias_apos_aceite} (vencto {parc.dias_vencimento || 10}d) • NF em {formatDataBR(addDias(dAceite, parc.dias_apos_aceite))}
                                            </span>
                                        </div>
                                    ))}

                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Mensalidade Base (em Salários Mínimos)</label>
                                        <input
                                            type="number"
                                            value={proposta?.investimento?.sustentacao_mensal?.valor_base_salarios_minimos || ''}
                                            onChange={(e) => setProposta({
                                                ...proposta,
                                                investimento: {
                                                    ...proposta.investimento,
                                                    sustentacao_mensal: {
                                                        ...proposta.investimento.sustentacao_mensal,
                                                        valor_base_salarios_minimos: Number(e.target.value)
                                                    }
                                                }
                                            })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Franquia de Canteiros de Obra Inclusos</label>
                                        <input
                                            type="number"
                                            value={proposta?.investimento?.sustentacao_mensal?.franquia_canteiros || ''}
                                            onChange={(e) => setProposta({
                                                ...proposta,
                                                investimento: {
                                                    ...proposta.investimento,
                                                    sustentacao_mensal: {
                                                        ...proposta.investimento.sustentacao_mensal,
                                                        franquia_canteiros: Number(e.target.value)
                                                    }
                                                }
                                            })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabela de Progressão Integrada no Simulador */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
                            {renderPainelProgressaoInvestimento()}
                        </div>
                    </div>
                )}

                {/* =========================================================================
                    ABA 4: GESTÃO DE CLIENTES LYNX
                ========================================================================= */}
                {activeTab === 'clientes' && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-emerald-600" />
                                    Clientes & Prospectos Comerciais Lynx
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Empresas cadastradas para envio e implementação de propostas comerciais do ecossistema Sinco.
                                </p>
                            </div>

                            <button
                                onClick={() => setNovoClienteModal(true)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Novo Cliente</span>
                            </button>
                        </div>

                        {/* Tabela de Clientes */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="p-3.5">Cliente</th>
                                        <th className="p-3.5">Setor de Atuação</th>
                                        <th className="p-3.5">Contato</th>
                                        <th className="p-3.5">Localização</th>
                                        <th className="p-3.5">Status Proposta</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {clientesLynx.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="p-3.5">
                                                <div className="font-bold text-slate-900">{c.nome}</div>
                                                <div className="text-[10px] text-slate-400">{c.razao_social}</div>
                                            </td>
                                            <td className="p-3.5 text-slate-600">{c.setor || 'Engenharia'}</td>
                                            <td className="p-3.5">
                                                <div className="text-slate-800">{c.telefone || 'N/D'}</div>
                                                <div className="text-[10px] text-slate-400">{c.email || 'N/D'}</div>
                                            </td>
                                            <td className="p-3.5 text-slate-600">{c.cidade ? `${c.cidade} / ${c.uf}` : 'Belo Horizonte / MG'}</td>
                                            <td className="p-3.5">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                    Proposta Ativa
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>

            {/* =========================================================================
                MODAL 0: NOVA PROPOSTA A PARTIR DO MODELO PADRÃO PARAMETRIZADO
            ========================================================================= */}
            {modeloModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                                    <FilePlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-slate-900">Nova Proposta do Modelo Padrão</h4>
                                    <p className="text-xs text-slate-500">Cria uma proposta mestre que você poderá parametrizar completamente.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModeloModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCriarDeModeloPadrao} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Nome do Cliente / Empresa *</label>
                                <input
                                    required
                                    placeholder="Ex: Nova Engenharia, Construtora Alfa..."
                                    value={modeloForm.cliente_nome}
                                    onChange={e => setModeloForm({ ...modeloForm, cliente_nome: e.target.value })}
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Razão Social</label>
                                <input
                                    placeholder="Razão Social completa da empresa"
                                    value={modeloForm.cliente_razao_social}
                                    onChange={e => setModeloForm({ ...modeloForm, cliente_razao_social: e.target.value })}
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Site</label>
                                    <input
                                        placeholder="https://empresa.com.br"
                                        value={modeloForm.cliente_site}
                                        onChange={e => setModeloForm({ ...modeloForm, cliente_site: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Instagram (@)</label>
                                    <input
                                        placeholder="@empresa"
                                        value={modeloForm.cliente_instagram}
                                        onChange={e => setModeloForm({ ...modeloForm, cliente_instagram: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Segmento / Setor</label>
                                <input
                                    placeholder="Ex: Mineração, Engenharia Civil, Indústria Fabril..."
                                    value={modeloForm.setor}
                                    onChange={e => setModeloForm({ ...modeloForm, setor: e.target.value })}
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none"
                                />
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-[11px] text-slate-600">
                                💡 <strong>Flexibilidade Total:</strong> Após criar, a proposta abrirá imediatamente na aba de parametrização para você customizar todos os módulos, textos, valores e cronograma financeiro.
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setModeloModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={modeloLoading}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                                >
                                    <FilePlus className="w-4 h-4" />
                                    <span>{modeloLoading ? 'Criando...' : 'Criar & Abrir Editor'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL 1: NOVA PROPOSTA COM IA (COPILOTO LYNX)
            ========================================================================= */}
            {iaModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-slate-900">Nova Proposta Comercial com IA</h4>
                                    <p className="text-xs text-slate-500">O Copiloto Lynx estuda o site e o Instagram do cliente e monta a proposta personalizada.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIaModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleGerarComIA} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Nome do Cliente / Empresa *</label>
                                <input
                                    required
                                    placeholder="Ex: Construtora Exemplo, Irricom, Metalfisa..."
                                    value={iaForm.nomeCliente}
                                    onChange={e => setIaForm({ ...iaForm, nomeCliente: e.target.value })}
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Site Oficial (URL)</label>
                                    <input
                                        placeholder="https://empresa.com.br"
                                        value={iaForm.site}
                                        onChange={e => setIaForm({ ...iaForm, site: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Instagram (@)</label>
                                    <input
                                        placeholder="@empresa_oficial"
                                        value={iaForm.instagram}
                                        onChange={e => setIaForm({ ...iaForm, instagram: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Setor / Segmento de Atuação</label>
                                <input
                                    placeholder="Ex: Engenharia Civil, Mineração, Montagem Eletromecânica, Irrigação..."
                                    value={iaForm.setor}
                                    onChange={e => setIaForm({ ...iaForm, setor: e.target.value })}
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Foco Operacional ou Particularidades</label>
                                <textarea
                                    rows="2"
                                    placeholder="Ex: Necessidade prioritária de apontamentos de diário de obras, integração com ERP (Protheus, Omie, Sankhya, etc.) e conformidade ISO 9001..."
                                    value={iaForm.focoOperacional}
                                    onChange={e => setIaForm({ ...iaForm, focoOperacional: e.target.value })}
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3.5 text-[11px] text-emerald-900 space-y-1">
                                <strong>Premissas Automáticas da Lynx:</strong>
                                <div>• Modelo Ágil MVP (Imersão de 60 dias sem escopo fechado engessado)</div>
                                <div>• Setup padrão: 2x R$ 16.520,60 | Sustentação: 6 SM (15 canteiros) + 0,5 SM extra</div>
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIaModalOpen(false)}
                                    disabled={iaLoading}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={iaLoading}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                                >
                                    {iaLoading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Estudando Empresa & Gerando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            <span>Gerar Proposta com IA</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL 2: CRIAR NOVA REVISÃO (REV 01, REV 02...)
            ========================================================================= */}
            {revisaoModalOpen && revisaoTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                                    <GitBranch className="w-5 h-5 text-emerald-700" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-slate-900">Criar Nova Revisão</h4>
                                    <p className="text-xs text-slate-500">
                                        Proposta: <strong>{revisaoTarget.codigo}</strong> ({revisaoTarget.revisao || 'Rev 00'}) • {revisaoTarget.cliente_nome}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setRevisaoModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmarNovaRevisao} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">
                                    Notas da Revisão / Motivo da Alteração *
                                </label>
                                <textarea
                                    required
                                    rows="3"
                                    value={notasRevisao}
                                    onChange={e => setNotasRevisao(e.target.value)}
                                    placeholder="Descreva as alterações contratuais, ajustes de valores ou alinhamentos de escopo..."
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <p className="text-xs text-slate-500 leading-relaxed">
                                A versão anterior será marcada automaticamente como <span className="font-bold text-slate-700">Revisada</span>, e a nova revisão será criada preservando o histórico de emissão.
                            </p>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setRevisaoModalOpen(false)}
                                    disabled={revisaoLoading}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={revisaoLoading}
                                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                                >
                                    <GitBranch className="w-4 h-4" />
                                    <span>{revisaoLoading ? 'Emitindo Revisão...' : 'Confirmar & Criar Revisão'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL 3: EXPORTAR PROPOSTA EM PDF
            ========================================================================= */}
            {pdfModalOpen && proposta && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                                    <Printer className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-slate-900">Exportar Proposta em PDF</h4>
                                    <p className="text-xs text-slate-500">{proposta.codigo} • {proposta.cliente_nome}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPdfModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-700 block">Selecione o formato de exportação:</label>

                            <div 
                                onClick={() => setPdfMode('completo')}
                                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                    pdfMode === 'completo' 
                                        ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20' 
                                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-slate-900">Dossiê Completo + Tabela 12/24 Meses + Slides</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Recomendado</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Gera o documento técnico-comercial com cronograma financeiro completo e anexa todos os slides executivos.
                                </p>
                            </div>

                            <div 
                                onClick={() => setPdfMode('dossie')}
                                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                    pdfMode === 'dossie' 
                                        ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20' 
                                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                }`}
                            >
                                <span className="font-bold text-xs text-slate-900 block">Apenas Dossiê Técnico-Comercial</span>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Ideal para envio formal como anexo contratual (com a tabela de progressão de 12 e 24 meses).
                                </p>
                            </div>

                            <div 
                                onClick={() => setPdfMode('slides')}
                                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                    pdfMode === 'slides' 
                                        ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20' 
                                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                }`}
                            >
                                <span className="font-bold text-xs text-slate-900 block">Apenas Slides da Apresentação</span>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Exporta os 13 slides em formato de lâminas para projeção executiva.
                                </p>
                            </div>
                        </div>

                        {/* Opção Tabela Temporal de Pagamento (60 Dias) no PDF */}
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <label className="flex items-start gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={incluirTabelaPdf}
                                    onChange={(e) => handleAtualizarCronograma('incluir_tabela_pdf', e.target.checked)}
                                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div>
                                    <span className="text-xs font-bold text-slate-800 block">
                                        Incluir Tabela Temporal de Pagamentos e Desembolso no PDF
                                    </span>
                                    <span className="text-[11px] text-slate-500 block mt-0.5 leading-tight">
                                        {incluirTabelaPdf 
                                            ? 'A tabela com os marcos cronológicos (Entrada, parcelas de setup e faturamento) sairá no PDF.' 
                                            : 'A tabela de cronograma financeiro será omitida do arquivo PDF gerado.'}
                                    </span>
                                </div>
                            </label>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setPdfModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExecutarPrint}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                            >
                                <Printer className="w-4 h-4" />
                                <span>Imprimir / Salvar em PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Novo Cliente */}
            {novoClienteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <h4 className="text-base font-bold text-slate-900">Cadastrar Novo Cliente Lynx</h4>
                        <form onSubmit={handleCadastrarCliente} className="space-y-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Nome Fantasia *</label>
                                <input
                                    required
                                    value={novoCliente.nome}
                                    onChange={e => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Razão Social</label>
                                <input
                                    value={novoCliente.razao_social}
                                    onChange={e => setNovoCliente({ ...novoCliente, razao_social: e.target.value })}
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Telefone</label>
                                    <input
                                        value={novoCliente.telefone}
                                        onChange={e => setNovoCliente({ ...novoCliente, telefone: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">E-mail</label>
                                    <input
                                        value={novoCliente.email}
                                        onChange={e => setNovoCliente({ ...novoCliente, email: e.target.value })}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setNovoClienteModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                >
                                    Cadastrar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

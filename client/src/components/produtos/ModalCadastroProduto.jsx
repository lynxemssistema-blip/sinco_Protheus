import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Package, 
    X, 
    Link, 
    AlertCircle, 
    CheckCircle2, 
    Camera, 
    Trash2, 
    Upload, 
    ZoomIn, 
    FileText, 
    Palette, 
    Link2, 
    Plus, 
    RotateCcw, 
    Languages, 
    Database, 
    Loader2,
    Lock,
    Folder,
    Sliders,
    Sparkles
} from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';

// Dicionário técnico de engenharia para tradução instantânea Inglês ➔ Português
const DICIONARIO_EN_PT = {
    'WELDMENT': 'CONJ SOLDADO',
    'WELD': 'SOLDA',
    'WELDED': 'SOLDADO',
    'ASM': 'CONJUNTO',
    'ASSY': 'CONJUNTO',
    'ASSEMBLY': 'CONJUNTO',
    'POST': 'COLUNA',
    'CAB': 'CABINE',
    'BLOWER': 'SOPRADOR',
    'SUPPORT': 'SUPORTE',
    'BRACKET': 'SUPORTE',
    'HOLDER': 'SUPORTE',
    'MOUNT': 'SUPORTE',
    'MOUNTING': 'FIXACAO',
    'TUBE': 'TUBO',
    'TUBING': 'TUBULACAO',
    'PIPE': 'TUBO',
    'PLATE': 'CHAPA',
    'SHEET': 'CHAPA',
    'COVER': 'TAMPA',
    'LID': 'TAMPA',
    'CAP': 'TAMPA',
    'BOX': 'CAIXA',
    'CASE': 'CAIXA',
    'HOUSING': 'CARCACA',
    'ENCLOSURE': 'GABINETE',
    'RAIL': 'TRILHO',
    'TRACK': 'TRILHO',
    'TAPE': 'FITA',
    'NUT': 'PORCA',
    'SEXT': 'SEXTAVADA',
    'HEX': 'SEXTAVADA',
    'BOLT': 'PARAFUSO',
    'SCREW': 'PARAFUSO',
    'FASTENER': 'FIXADOR',
    'WASHER': 'ARRUELA',
    'PIN': 'PINO',
    'STUD': 'PRISIONEIRO',
    'SEAL': 'VEDACAO',
    'GASKET': 'JUNTA',
    'HOSE': 'MANGUEIRA',
    'VALVE': 'VALVULA',
    'CLAMP': 'ABRACADEIRA',
    'CLIP': 'CLIPE',
    'FLANGE': 'FLANGE',
    'LEVER': 'ALAVANCA',
    'HANDLE': 'MANIPULO',
    'HINGE': 'DOBRADICA',
    'LOCK': 'TRAVA',
    'LATCH': 'TRAVA',
    'SPRING': 'MOLA',
    'BEAM': 'VIGA',
    'CHANNEL': 'PERFIL U',
    'BAR': 'BARRA',
    'ROD': 'HASTE',
    'SHAFT': 'EIXO',
    'FRAME': 'ESTRUTURA',
    'PANEL': 'PAINEL',
    'DOOR': 'PORTA',
    'STAPLE': 'GRAMPO',
    'RING': 'ANEL',
    'BUSHING': 'BUCHA',
    'SPACER': 'ESPACADOR',
    'SHIM': 'CALCO',
    'FITTING': 'CONEXAO',
    'CONNECTOR': 'CONECTOR',
    'CABLE': 'CABO',
    'WIRE': 'FIO',
    'HARNESS': 'CHICOTE',
    'LIGHT': 'LEVE',
    'FAB': 'FABR',
    'FABRICATION': 'FABRICACAO',
    'LIST': 'LISTA',
    'STEEL': 'ACO',
    'IRON': 'FERRO',
    'ALUMINUM': 'ALUMINIO',
    'COPPER': 'COBRE',
    'BRASS': 'LATAO',
    'RUBBER': 'BORRACHA',
    'PLASTIC': 'PLASTICO',
    'UPPER': 'SUPERIOR',
    'LOWER': 'INFERIOR',
    'TOP': 'SUPERIOR',
    'BOTTOM': 'INFERIOR',
    'FRONT': 'DIANTEIRO',
    'REAR': 'TRASEIRO',
    'BACK': 'TRASEIRO',
    'LEFT': 'ESQUERDO',
    'RIGHT': 'DIREITO',
    'INNER': 'INTERNO',
    'OUTER': 'EXTERNO',
    'CENTER': 'CENTRAL',
    'SIDE': 'LATERAL',
    'DUCT': 'DUTO',
    'FILTER': 'FILTRO',
    'INVERTER': 'INVERSOR',
    'BASE': 'BASE',
    'LEG': 'PERNA',
    'GUSSET': 'REFORCO',
    'STRIP': 'TIRA',
    'GUARD': 'PROTECAO',
    'SHIELD': 'BLINDAGEM',
    'SCREEN': 'TELA',
    'MESH': 'MALHA',
    'MOTOR': 'MOTOR',
    'PUMP': 'BOMBA',
    'TANK': 'TANQUE',
    'RESERVOIR': 'RESERVATORIO'
};

function traduzirInglesParaPortugues(textoOriginal) {
    if (!textoOriginal) return '';
    const textoLimpo = String(textoOriginal).toUpperCase().trim();
    const partes = textoLimpo.split(/(\s+|[,;./\-_]+)/);
    const traduzidas = partes.map(parte => {
        const pTrim = parte.trim();
        if (DICIONARIO_EN_PT[pTrim]) {
            return DICIONARIO_EN_PT[pTrim];
        }
        return parte;
    });
    return traduzidas.join('').replace(/\s+/g, ' ').trim();
}

// Helper para deduzir o prefixo / família a partir dos dados do produto ou código
function deduzirPrefixo(data, prefixos = []) {
    if (!data) return '';
    if (data.prefixo) return String(data.prefixo).trim().toUpperCase();
    const cod = String(data.codigo || data.b1_cod || '').trim().toUpperCase();
    if (!cod) return '';

    // Se a lista de prefixos estiver disponível, tenta casar com o prefixo mais específico
    if (Array.isArray(prefixos) && prefixos.length > 0) {
        const ordenados = [...prefixos].sort((a, b) => (b.codigo?.length || 0) - (a.codigo?.length || 0));
        const match = ordenados.find(p => cod.startsWith(p.codigo + '-') || cod === p.codigo);
        if (match) return match.codigo;
    }

    // Se tem hífen (padrão Protheus: PMP-000001 -> PMP)
    if (cod.includes('-')) {
        return cod.split('-')[0].trim();
    }

    // Fallback: se começa com letras/alfanumérico
    const match = cod.match(/^[A-Z0-9]{2,5}/);
    return match ? match[0] : '';
}

export default function ModalCadastroProduto({
    isOpen,
    onClose,
    isEditing = false,
    initialData = null,
    onSuccess,
    isSinco = false
}) {
    // Estado Geral do Formulário
    const [formData, setFormData] = useState({
        codigo: '',
        descricao: '',
        tipo: 'PA',
        unidade_medida: 'UN',
        ncm: '',
        armazem_padrao: '01',
        origem: '0',
        peso_liquido: '',
        peso_bruto: '',
        custo_standard: '',
        preco_venda: '',
        lead_time_dias: '5',
        status: 'ativo',
        foto_url: '',
        desenho_url: '',
        desenho_nome: '',
        desenho_tipo: '',
        b1_xrevm: '0',
        b1_xproc1: '',
        b1_xrevc: '0',
        cor_id: '',
        cliente_codigo: '',
        cliente_loja: '01',
        cliente_nome: '',
        pasta_servidor: ''
    });

    // Estados de Controle
    const [selectedPrefixo, setSelectedPrefixo] = useState(() => deduzirPrefixo(initialData) || 'PRD-1');
    const [availablePrefixos, setAvailablePrefixos] = useState([]);
    const [quickPrefixos, setQuickPrefixos] = useState(['PRD-1', 'PRO-2', 'PRO-3']);
    const [coresList, setCoresList] = useState([]);
    const [clientesList, setClientesList] = useState([]);
    const [loadingCodigo, setLoadingCodigo] = useState(false);

    // Estados da Matriz de Formulários Específicos: Por padrão 'padrao' (Protheus) ou lembrando a preferência do usuário
    const [formMode, setFormMode] = useState(() => {
        try {
            return localStorage.getItem('@SINCO:produto_form_mode') || 'padrao';
        } catch {
            return 'padrao';
        }
    });

    const handleSetFormMode = (novoModo) => {
        setFormMode(novoModo);
        try {
            localStorage.setItem('@SINCO:produto_form_mode', novoModo);
        } catch (e) {
            console.warn('Erro ao salvar preferência de modo no localStorage:', e);
        }
    };
    const [templatesList, setTemplatesList] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [templateCampos, setTemplateCampos] = useState([]);
    const [atributosValores, setAtributosValores] = useState({});
    const [loadingTemplate, setLoadingTemplate] = useState(false);

    const [cadastrosBasicos, setCadastrosBasicos] = useState({
        tipos: [],
        unidades: [],
        armazens: []
    });

    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState(null);
    const [modalSuccess, setModalSuccess] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    // Tradução e Descrição Original
    const [originalDescricao, setOriginalDescricao] = useState('');
    const [traduzido, setTraduzido] = useState(false);

    // Helper para converter string brasileira com vírgula em número seguro para o backend
    const parseDecimal = (val) => {
        if (val === null || val === undefined || val === '') return 0;
        const str = String(val).trim().replace(/\s/g, '').replace(',', '.');
        const parsed = parseFloat(str);
        return isNaN(parsed) ? 0 : parsed;
    };

    // Helper para permitir digitação natural de números com vírgula ou ponto no Brasil
    const handleDecimalChange = (field, value) => {
        let cleaned = value.replace(/[^0-9.,]/g, '');
        const matches = cleaned.match(/[.,]/g);
        if (matches && matches.length > 1) {
            let first = true;
            cleaned = cleaned.replace(/[.,]/g, (match) => {
                if (first) {
                    first = false;
                    return match;
                }
                return '';
            });
        }
        setFormData(prev => ({ ...prev, [field]: cleaned }));
    };

    // Busca próximo código sequencial automático com 6 dígitos baseado EXCLUSIVAMENTE no prefixo (família)
    const fetchNextProductCode = useCallback(async (pref) => {
        if (isEditing) return;
        setLoadingCodigo(true);
        try {
            const cleanPref = String(pref || 'PRD-1').trim();
            // Apenas a família/prefixo define a sequência numérica do código
            const res = await api.get(`/erp/produtos/proximo-codigo?prefixo=${encodeURIComponent(cleanPref)}`);
            const nextCode = res.data?.proximoCodigo || res.data?.proximo_codigo;
            if (nextCode) {
                setFormData(prev => ({ ...prev, codigo: nextCode }));
            }
        } catch (err) {
            console.error('Erro ao buscar próximo código automático:', err);
        } finally {
            setLoadingCodigo(false);
        }
    }, [isEditing]);

    // Carrega Cadastros Básicos estritamente do tenant ativo (prefixos, tipos, unidades, armazéns, cores, clientes)
    const fetchCadastrosBasicos = useCallback(async () => {
        try {
            const [cadastrosRes, coresRes, cliRes] = await Promise.all([
                api.get('/cadastros-basicos/todos?apenas_ativos=1').catch(() => ({ data: {} })),
                api.get('/erp/produtos/cores').catch(() => ({ data: [] })),
                api.get('/erp/clientes/lookup?q=').catch(() => ({ data: [] }))
            ]);

            const baseData = cadastrosRes.data || {};
            const tiposList = Array.isArray(baseData.tipos) ? baseData.tipos : [];
            const unidadesList = Array.isArray(baseData.unidades) ? baseData.unidades : [];
            const armazensList = Array.isArray(baseData.armazens) ? baseData.armazens : [];
            const prefixosList = (Array.isArray(baseData.prefixos) ? baseData.prefixos : []).map(p => ({
                codigo: p.sigla || p.codigo,
                descricao: p.descricao,
                tipo_padrao: p.tipo_padrao || 'PA',
                padrao_sequencial: p.padrao_sequencial || '000001'
            }));

            setCadastrosBasicos({
                tipos: tiposList,
                unidades: unidadesList,
                armazens: armazensList
            });

            setCoresList(Array.isArray(coresRes.data) ? coresRes.data : []);

            if (prefixosList.length > 0) {
                // Descobre se há um prefixo referente ao item atual sendo editado/exibido
                const prefixoDoItem = deduzirPrefixo(initialData, prefixosList);

                // Garante que o prefixo do item exista na lista de opções para exibição no select
                if (prefixoDoItem && !prefixosList.some(p => p.codigo.toUpperCase() === prefixoDoItem.toUpperCase())) {
                    prefixosList.unshift({
                        codigo: prefixoDoItem,
                        descricao: `Família ${prefixoDoItem}`,
                        tipo_padrao: initialData?.tipo || 'MP',
                        padrao_sequencial: '000001'
                    });
                }

                setAvailablePrefixos(prefixosList);
                setQuickPrefixos(prefixosList.slice(0, 5).map(p => p.codigo));

                if (prefixoDoItem) {
                    setSelectedPrefixo(prefixoDoItem);
                } else if (!isEditing) {
                    setSelectedPrefixo(prev => {
                        if (prefixosList.some(p => p.codigo === prev)) {
                            return prev;
                        }
                        const firstPref = prefixosList[0].codigo;
                        fetchNextProductCode(firstPref);
                        return firstPref;
                    });
                }
            } else {
                setAvailablePrefixos([
                    { codigo: 'PRD-1', descricao: 'Matérias-Primas', tipo_padrao: 'MP' },
                    { codigo: 'PRO-2', descricao: 'Parafusos', tipo_padrao: 'PI' },
                    { codigo: 'PRO-3', descricao: 'Porcas', tipo_padrao: 'PA' }
                ]);
            }

            if (Array.isArray(cliRes.data)) {
                setClientesList(cliRes.data);
            }
        } catch (err) {
            console.warn('Erro ao carregar dados auxiliares do cadastro:', err);
        }
    }, [initialData, isEditing, fetchNextProductCode]);

    // Inicialização ao abrir o Modal
    useEffect(() => {
        if (!isOpen) return;

        fetchCadastrosBasicos();

        if (initialData) {
            const rawCodigo = initialData.codigo || initialData.b1_cod || '';
            const detectedPrefixo = deduzirPrefixo(initialData, availablePrefixos);
            if (detectedPrefixo) {
                setSelectedPrefixo(detectedPrefixo);
            }

            const rawDescricao = initialData.descricao || initialData.titulo || initialData.b1_desc || '';
            const rawTipo = initialData.tipo || initialData.b1_tipo || (initialData.nivel === '0' || initialData.nivel === 0 ? 'PA' : 'PI');
            const rawUm = initialData.unidade_medida || initialData.uom || initialData.unidade || initialData.b1_um || 'UN';
            const rawNcm = initialData.ncm || initialData.b1_posipi || '';
            const rawArmazem = initialData.armazem_padrao || initialData.b1_locpad || '01';

            const rawPesoLiq = initialData.peso_liquido !== undefined && initialData.peso_liquido !== null && initialData.peso_liquido !== '' 
                ? String(initialData.peso_liquido).replace('.', ',') 
                : (initialData.peso !== undefined && initialData.peso !== null && initialData.peso !== '' ? String(initialData.peso).replace('.', ',') : '');

            const rawPesoBruto = initialData.peso_bruto !== undefined && initialData.peso_bruto !== null && initialData.peso_bruto !== '' 
                ? String(initialData.peso_bruto).replace('.', ',') : '';

            const rawCusto = initialData.custo_standard !== undefined && initialData.custo_standard !== null && initialData.custo_standard !== '' 
                ? String(initialData.custo_standard).replace('.', ',') : '';

            const rawPreco = initialData.preco_venda !== undefined && initialData.preco_venda !== null && initialData.preco_venda !== '' 
                ? String(initialData.preco_venda).replace('.', ',') : '';

            const rawRevEmpresa = initialData.b1_xrevm !== undefined && initialData.b1_xrevm !== null && String(initialData.b1_xrevm).trim() !== '' 
                ? String(initialData.b1_xrevm) : '0';

            const rawDesCli = initialData.b1_xproc1 || initialData.desenho_cliente || initialData.codDesenhoCliente || initialData.b1_xcode || initialData.b1_xcoddes || '';
            
            const rawRevCli = initialData.b1_xrevc !== undefined && initialData.b1_xrevc !== null && String(initialData.b1_xrevc).trim() !== ''
                ? String(initialData.b1_xrevc)
                : (initialData.revisaoCliente || initialData.rev_convertida || initialData.revisao || '0');

            const rawCliCod = initialData.cliente_codigo || initialData.z1_cliente || '';
            const rawCliLoj = initialData.cliente_loja || initialData.z1_loja || '01';
            const rawCliNom = initialData.cliente_nome || initialData.z1_nomecli || '';

            setFormData({
                codigo: rawCodigo,
                descricao: rawDescricao,
                tipo: rawTipo,
                unidade_medida: rawUm.toUpperCase().slice(0, 2),
                ncm: rawNcm,
                armazem_padrao: rawArmazem,
                origem: initialData.origem || '0',
                peso_liquido: rawPesoLiq,
                peso_bruto: rawPesoBruto,
                custo_standard: rawCusto,
                preco_venda: rawPreco,
                lead_time_dias: initialData.lead_time_dias !== undefined && initialData.lead_time_dias !== null ? String(initialData.lead_time_dias) : '5',
                status: initialData.status || 'ativo',
                foto_url: initialData.foto_url || '',
                desenho_url: initialData.desenho_url || '',
                desenho_nome: initialData.desenho_nome || '',
                desenho_tipo: initialData.desenho_tipo || '',
                b1_xrevm: rawRevEmpresa,
                b1_xproc1: rawDesCli,
                b1_xrevc: String(rawRevCli),
                cor_id: initialData.cor_id ? String(initialData.cor_id) : '',
                cliente_codigo: rawCliCod,
                cliente_loja: rawCliLoj,
                cliente_nome: rawCliNom,
                pasta_servidor: initialData.pasta_servidor || ''
            });

            setOriginalDescricao(rawDescricao);
            setTraduzido(false);

            if (!isEditing && !rawCodigo) {
                fetchNextProductCode(detectedPrefixo || selectedPrefixo);
            }
        } else {
            // Novo cadastro em branco
            setFormData({
                codigo: '',
                descricao: '',
                tipo: 'PA',
                unidade_medida: 'UN',
                ncm: '',
                armazem_padrao: '01',
                origem: '0',
                peso_liquido: '',
                peso_bruto: '',
                custo_standard: '',
                preco_venda: '',
                lead_time_dias: '5',
                status: 'ativo',
                foto_url: '',
                desenho_url: '',
                desenho_nome: '',
                desenho_tipo: '',
                b1_xrevm: '0',
                b1_xproc1: '',
                b1_xrevc: '0',
                cor_id: '',
                cliente_codigo: '',
                cliente_loja: '01',
                cliente_nome: '',
                pasta_servidor: ''
            });
            setOriginalDescricao('');
            setTraduzido(false);
            fetchNextProductCode(selectedPrefixo);
        }

        setModalError(null);
        setModalSuccess(null);

        // Carrega templates disponíveis para a empresa e tenta casar com o produto/tipo
        api.get('/cadastros-basicos/templates')
            .then(res => {
                const list = res.data?.templates || [];
                setTemplatesList(list);

                const savedMode = localStorage.getItem('@SINCO:produto_form_mode') || 'padrao';
                setFormMode(savedMode);

                const currentCod = initialData?.codigo || initialData?.b1_cod;
                if (currentCod) {
                    // Carrega atributos salvos do produto se existirem
                    api.get(`/cadastros-basicos/produtos/${encodeURIComponent(currentCod)}/atributos`)
                        .then(attrRes => {
                            if (attrRes.data?.atributos) {
                                setAtributosValores(attrRes.data.atributos);
                            }
                            if (attrRes.data?.template_id) {
                                const found = list.find(t => t.id === attrRes.data.template_id);
                                if (found) {
                                    setSelectedTemplateId(found.id);
                                    setActiveTemplate(found);
                                    setTemplateCampos(found.campos || []);
                                    return;
                                }
                            }
                            // Se não tinha template salvo, tenta achar um template pelo tipo de produto
                            const tipoProd = initialData?.tipo || initialData?.b1_tipo || 'MP';
                            const matchTipo = list.find(t => t.tipo_produto === tipoProd);
                            if (matchTipo) {
                                setSelectedTemplateId(matchTipo.id);
                                setActiveTemplate(matchTipo);
                                setTemplateCampos(matchTipo.campos || []);
                            }
                        })
                        .catch(() => {});
                } else {
                    // Novo produto: seleciona o primeiro template ativo compatível para quando o usuário alternar para o modo específico
                    const defaultTpl = list.find(t => t.ativo) || list[0];
                    if (defaultTpl) {
                        setSelectedTemplateId(defaultTpl.id);
                        setActiveTemplate(defaultTpl);
                        setTemplateCampos(defaultTpl.campos || []);
                    }
                    setAtributosValores({});
                }
            })
            .catch(err => console.warn('Erro ao carregar templates para o modal:', err));
    }, [isOpen, initialData, isEditing, fetchCadastrosBasicos, fetchNextProductCode]);

    // Selecionar Cliente da Carteira
    const handleSelectCliente = (cli) => {
        setFormData(prev => ({
            ...prev,
            cliente_codigo: cli.codigo || cli.a1_cod || '',
            cliente_loja: cli.loja || cli.a1_loja || '01',
            cliente_nome: cli.razao_social || cli.a1_nome || cli.nome_fantasia || ''
        }));
    };

    // Desvincular Cliente (Torna item interno)
    const handleClearCliente = () => {
        setFormData(prev => ({
            ...prev,
            cliente_codigo: '',
            cliente_loja: '01',
            cliente_nome: ''
        }));
    };

    // Ao mudar o Prefixo da Família
    const handlePrefixoChange = (novoPrefixo) => {
        setSelectedPrefixo(novoPrefixo);
        const achou = availablePrefixos.find(p => p.codigo === novoPrefixo);
        if (achou?.tipo_padrao) {
            setFormData(prev => ({ ...prev, tipo: achou.tipo_padrao }));
        }
        fetchNextProductCode(novoPrefixo);
    };

    // Ao mudar o Tipo B1_TIPO: Conforme áudio e regra expressa do usuário, o tipo NÃO interfere no número sequencial do código (é apenas a família/prefixo)
    const handleTipoChange = (novoTipo) => {
        setFormData(prev => ({ ...prev, tipo: novoTipo }));
        // Se houver um template correspondente ao tipo, seleciona-o
        const matchTpl = templatesList.find(t => t.tipo_produto === novoTipo);
        if (matchTpl) {
            setSelectedTemplateId(matchTpl.id);
            setActiveTemplate(matchTpl);
            setTemplateCampos(matchTpl.campos || []);
        }
    };

    // Ao mudar o Template manualmente na tela
    const handleTemplateChange = (tplId) => {
        setSelectedTemplateId(tplId);
        if (!tplId) {
            setActiveTemplate(null);
            setTemplateCampos([]);
            return;
        }
        const found = templatesList.find(t => String(t.id) === String(tplId));
        if (found) {
            setActiveTemplate(found);
            setTemplateCampos(found.campos || []);
            // Ajusta o tipo_produto do produto se o template tiver um tipo específico
            if (found.tipo_produto && !isEditing) {
                setFormData(prev => ({ ...prev, tipo: found.tipo_produto }));
            }
        }
    };

    // Atualiza um atributo dinâmico do template
    const handleAtributoChange = (campo, valor) => {
        setAtributosValores(prev => ({
            ...prev,
            [campo.campo_chave]: valor
        }));

        // Se o campo possuir destino direto no produto (ex: ncm, peso_liquido), atualiza o formData também
        if (campo.campo_destino && campo.campo_destino !== 'atributos_json') {
            setFormData(prev => ({
                ...prev,
                [campo.campo_destino]: valor
            }));
        }
    };

    // Gerar Descrição Automática a partir da Máscara do Template
    const handleGerarDescricaoAutomatica = () => {
        if (!activeTemplate?.descricao_mascara) {
            toast.warn('Este modelo não possui uma fórmula de descrição configurada.');
            return;
        }

        let desc = activeTemplate.descricao_mascara;
        // Substitui {chave} pelos valores preenchidos nos atributos ou no formulário
        const todasChaves = {
            ...formData,
            ...atributosValores,
            tipo: formData.tipo,
            codigo: formData.codigo
        };

        for (const [k, v] of Object.entries(todasChaves)) {
            const regex = new RegExp(`\\{${k}\\}`, 'gi');
            desc = desc.replace(regex, v ? String(v).trim().toUpperCase() : '');
        }

        // Limpa espaços duplos e pontuações soltas
        desc = desc.replace(/\s+/g, ' ').trim();
        setFormData(prev => ({ ...prev, descricao: desc.slice(0, 100) }));
        toast.success(`Descrição gerada: "${desc.slice(0, 100)}"`);
    };

    // Traduzir Descrição EN ➔ PT
    const handleTraduzir = () => {
        const base = formData.descricao || originalDescricao;
        if (!base) return;
        const textoTraduzido = traduzirInglesParaPortugues(base);
        setFormData(prev => ({ ...prev, descricao: textoTraduzido.slice(0, 100) }));
        setTraduzido(true);
        toast.info(`Descrição traduzida: "${textoTraduzido.slice(0, 100)}"`, { autoClose: 3000 });
    };

    // Reverter para o original
    const handleReverterOriginal = () => {
        if (!originalDescricao) return;
        setFormData(prev => ({ ...prev, descricao: originalDescricao.slice(0, 100) }));
        setTraduzido(false);
        toast.info('Descrição revertida para o texto original.');
    };

    // Upload de Foto
    const handleFotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('A foto deve ter no máximo 5MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            setFormData(prev => ({ ...prev, foto_url: event.target.result }));
        };
        reader.readAsDataURL(file);
    };

    // Upload de Desenho Técnico
    const handleDesenhoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 25 * 1024 * 1024) {
            alert('O desenho técnico deve ter no máximo 25MB.');
            return;
        }
        const ext = file.name.split('.').pop()?.toLowerCase();
        const reader = new FileReader();
        reader.onload = (event) => {
            setFormData(prev => ({
                ...prev,
                desenho_url: event.target.result,
                desenho_nome: file.name,
                desenho_tipo: ['pdf', 'dwg', 'dxf'].includes(ext) ? ext : 'outro'
            }));
        };
        reader.readAsDataURL(file);
    };

    // Submissão do Formulário
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setModalError(null);
        setModalSuccess(null);

        if (!formData.codigo || formData.codigo.trim().length < 2) {
            setModalError('O código do produto é obrigatório (mínimo 2 caracteres).');
            setSaving(false);
            return;
        }

        if (!formData.descricao || formData.descricao.trim().length < 2) {
            setModalError('A descrição completa do produto é obrigatória.');
            setSaving(false);
            return;
        }

        const payload = {
            ...formData,
            codigo: formData.codigo.trim().toUpperCase(),
            descricao: formData.descricao.trim().toUpperCase(),
            peso_liquido: parseDecimal(formData.peso_liquido),
            peso_bruto: parseDecimal(formData.peso_bruto),
            custo_standard: parseDecimal(formData.custo_standard),
            preco_venda: parseDecimal(formData.preco_venda),
            lead_time_dias: parseInt(formData.lead_time_dias, 10) || 0,
            cor_id: formData.cor_id ? parseInt(formData.cor_id, 10) : null,
            b1_xrevm: String(formData.b1_xrevm || '0').trim(),
            b1_xproc1: String(formData.b1_xproc1 || '').trim(),
            b1_xrevc: String(formData.b1_xrevc || '0').trim(),
            cliente_codigo: formData.cliente_codigo ? String(formData.cliente_codigo).trim() : null,
            cliente_loja: formData.cliente_loja ? String(formData.cliente_loja).trim() : '01',
            cliente_nome: formData.cliente_nome ? String(formData.cliente_nome).trim() : null,
            pasta_servidor: formData.pasta_servidor ? String(formData.pasta_servidor).trim() : null
        };

        try {
            let res;
            if (isEditing) {
                res = await api.put(`/erp/produtos/${encodeURIComponent(payload.codigo)}`, payload);
                setModalSuccess(`Produto ${payload.codigo} atualizado com sucesso!`);
            } else {
                res = await api.post('/erp/produtos', payload);
                setModalSuccess(`Produto ${payload.codigo} cadastrado com sucesso!`);
            }

            // Salva os atributos dinâmicos específicos se houver algum template ou atributo preenchido
            if (activeTemplate || Object.keys(atributosValores).length > 0) {
                try {
                    await api.post(`/cadastros-basicos/produtos/${encodeURIComponent(payload.codigo)}/atributos`, {
                        template_id: activeTemplate?.id || null,
                        atributos: atributosValores
                    });
                } catch (attrErr) {
                    console.warn('Aviso: atributos dinâmicos não foram persistidos:', attrErr);
                }
            }

            if (onSuccess) {
                onSuccess({
                    ...payload,
                    id: res.data?.id,
                    codigo: payload.codigo,
                    descricao: payload.descricao,
                    uom: payload.unidade_medida
                });
            }

            setTimeout(() => {
                onClose();
            }, 800);
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.erros?.join(', ') || err.message;
            setModalError(msg);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
            {/* Modal Container: Compacto, largo (2 colunas) para caber 100% na tela sem barra de rolagem */}
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl lg:max-w-[1120px] flex flex-col max-h-[96vh] overflow-hidden my-auto">
                
                {/* 1. Modal Header Compacto */}
                <div className="flex items-center justify-between py-2 px-5 border-b border-gray-200 bg-gray-50/90 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shadow-2xs">
                            <Package className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-gray-900 leading-tight">
                                    {isEditing ? `Editar Produto: ${formData.codigo}` : 'Novo Produto'}
                                </h2>
                                {isSinco && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        Módulo Solid Edge / SINCO
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-500 leading-none mt-0.5">
                                {isEditing 
                                    ? 'Atualização cadastral, fotos e desenhos de engenharia' 
                                    : 'Cadastro padrão Protheus com código sequencial automático de 6 dígitos'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Seletor Visual de Modo (Específico vs Padrão) */}
                        <div className="bg-gray-100 p-0.5 rounded-lg border border-gray-200 flex items-center">
                            <button
                                type="button"
                                onClick={() => handleSetFormMode('padrao')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition ${
                                    formMode === 'padrao'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                                title="Formulário clássico completo do Protheus / ERP (Padrão do Sistema)"
                            >
                                <Database className="w-3 h-3" />
                                <span>Modo Padrão Protheus</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetFormMode('especifico')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition ${
                                    formMode === 'especifico'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                                title="Formulário com caixas e perguntas específicas do tipo de produto"
                            >
                                <Sparkles className="w-3 h-3" />
                                <span>Modo Específico</span>
                            </button>
                        </div>

                        <RouterLink
                            to="/cadastros/templates-produto"
                            target="_blank"
                            className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition flex items-center gap-1 shadow-2xs"
                            title="Abrir Matriz de Modelos de Formulários em nova aba"
                        >
                            <Sliders className="w-3 h-3" />
                            <span>Matriz de Form.</span>
                        </RouterLink>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 2. Modal Body / Form em 2 Colunas */}
                <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 overflow-y-auto flex-1 flex flex-col justify-between space-y-2.5">
                    {modalError && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                            <span>{modalError}</span>
                        </div>
                    )}

                    {modalSuccess && (
                        <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
                            <span>{modalSuccess}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                        
                        {/* ══ COLUNA ESQUERDA (7/12): Identificação, Código, Descrição, Amarração SZ1010 e Cor ══ */}
                        <div className="lg:col-span-7 space-y-2">
                            
                            {/* Card 1: Prefixo, Tipo e Código Gerado (Automático 6 Dígitos) */}
                            <div className="bg-slate-50/90 p-2.5 rounded-lg border border-gray-200 space-y-1.5">
                                <div className="grid grid-cols-12 gap-2">
                                    {/* Prefixo da Família */}
                                    <div className="col-span-5">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                                                Prefixo (Família) *
                                            </label>
                                            <RouterLink
                                                to="/cadastros/basicos?tab=prefixos"
                                                target="_blank"
                                                className="text-[9px] text-blue-600 hover:underline"
                                            >
                                                + Config
                                            </RouterLink>
                                        </div>
                                        <select
                                            value={selectedPrefixo}
                                            onChange={(e) => handlePrefixoChange(e.target.value)}
                                            disabled={isEditing}
                                            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 h-7"
                                        >
                                            {selectedPrefixo && !availablePrefixos.some(p => p.codigo?.toUpperCase() === selectedPrefixo.toUpperCase()) && (
                                                <option value={selectedPrefixo}>
                                                    {selectedPrefixo} - Família do Produto
                                                </option>
                                            )}
                                            {availablePrefixos.map(pref => (
                                                <option key={pref.codigo} value={pref.codigo}>
                                                    {pref.codigo} - {pref.descricao}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Tipo B1_TIPO */}
                                    <div className="col-span-3">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                                                Tipo (B1_TIPO) *
                                            </label>
                                            <RouterLink
                                                to="/cadastros/basicos?tab=tipos"
                                                target="_blank"
                                                className="text-[9px] text-blue-600 hover:underline"
                                            >
                                                + Tipos
                                            </RouterLink>
                                        </div>
                                        <select
                                            value={formData.tipo}
                                            onChange={(e) => handleTipoChange(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-md px-1.5 py-1 text-xs text-gray-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        >
                                            {cadastrosBasicos.tipos && cadastrosBasicos.tipos.length > 0 ? (
                                                cadastrosBasicos.tipos.map(t => (
                                                    <option key={t.codigo} value={t.codigo}>
                                                        {t.codigo} - {t.descricao}
                                                    </option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="PA">PA - Acabado</option>
                                                    <option value="PI">PI - Semi-Acab.</option>
                                                    <option value="MP">MP - Mat. Prima</option>
                                                    <option value="BN">BN - Benefic.</option>
                                                    <option value="MC">MC - Consumo</option>
                                                </>
                                            )}
                                        </select>
                                    </div>

                                    {/* Código Gerado B1_COD (Automático e Sequencial - NÃO EDITÁVEL) */}
                                    <div className="col-span-4">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                                                <Lock className="w-2.5 h-2.5 text-gray-500" />
                                                <span>Cód. Gerado (B1_COD) *</span>
                                            </label>
                                            {!isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => fetchNextProductCode(selectedPrefixo)}
                                                    disabled={loadingCodigo}
                                                    className="text-[9px] text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                                                    title="Recalcular próximo código sequencial de 6 dígitos"
                                                >
                                                    <RotateCcw className={`w-2 h-2 ${loadingCodigo ? 'animate-spin' : ''}`} />
                                                    <span>Recalcular</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                required
                                                readOnly
                                                tabIndex={-1}
                                                value={formData.codigo}
                                                placeholder="Aguardando cálculo..."
                                                title="Código gerado automaticamente pelo sistema (não editável)"
                                                className="w-full bg-gray-100 border border-gray-300 rounded-md px-2 py-1 pr-14 text-xs font-mono font-bold text-gray-800 cursor-not-allowed uppercase select-all h-7 shadow-inner focus:outline-none"
                                            />
                                            <span className="absolute right-1 top-1 text-[8px] bg-slate-200 text-slate-700 border border-slate-300 px-1 py-0.5 rounded font-mono font-bold select-none">
                                                6 DÍGITOS
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Prefixos rápidos */}
                                {!isEditing && quickPrefixos.length > 0 && (
                                    <div className="flex items-center gap-1.5 pt-1 border-t border-gray-200/70">
                                        <span className="text-[10px] font-semibold text-gray-500">Rápidos:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {quickPrefixos.map(qp => (
                                                <button
                                                    key={qp}
                                                    type="button"
                                                    onClick={() => handlePrefixoChange(qp)}
                                                    className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded border transition cursor-pointer ${
                                                        selectedPrefixo === qp 
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {qp}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ══ MODO ESPECÍFICO: Caixa de Atributos Dinâmicos por Tipo de Produto ══ */}
                            {formMode === 'especifico' && (
                                <div className="bg-gradient-to-r from-indigo-50/80 to-purple-50/50 p-3 rounded-xl border border-indigo-200/80 shadow-xs space-y-2.5">
                                    <div className="flex items-center justify-between border-b border-indigo-200/60 pb-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <Sparkles className="w-4 h-4 text-indigo-600" />
                                            <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                                                Atributos Técnicos Específicos da Família
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Seletor de Modelo */}
                                            <select
                                                value={selectedTemplateId}
                                                onChange={(e) => handleTemplateChange(e.target.value)}
                                                className="bg-white border border-indigo-300 rounded-md px-2 py-0.5 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-6"
                                            >
                                                <option value="">-- Selecionar Modelo --</option>
                                                {templatesList.map(t => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.nome} ({t.tipo_produto})
                                                    </option>
                                                ))}
                                            </select>

                                            <RouterLink
                                                to="/cadastros/templates-produto"
                                                target="_blank"
                                                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline flex items-center gap-0.5"
                                                title="Adicionar ou editar campos na matriz"
                                            >
                                                <Plus className="w-3 h-3" /> Config
                                            </RouterLink>
                                        </div>
                                    </div>

                                    {/* Grid de Campos Específicos Dinâmicos */}
                                    {templateCampos && templateCampos.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {templateCampos.map((campo) => {
                                                const val = atributosValores[campo.campo_chave] || '';
                                                return (
                                                    <div key={campo.id || campo.campo_chave} className="space-y-0.5">
                                                        <label className="block text-[10px] font-bold text-gray-700 truncate" title={campo.label}>
                                                            {campo.label}
                                                            {campo.obrigatorio ? <span className="text-red-500 font-bold ml-0.5">*</span> : null}
                                                            {campo.unidade ? <span className="text-gray-400 font-normal ml-1">({campo.unidade})</span> : null}
                                                        </label>

                                                        {campo.tipo_input === 'select' ? (
                                                            <select
                                                                value={val}
                                                                onChange={(e) => handleAtributoChange(campo, e.target.value)}
                                                                className="w-full bg-white border border-indigo-200 rounded-md px-2 py-1 text-xs text-gray-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-7"
                                                            >
                                                                <option value="">Selecione...</option>
                                                                {(campo.opcoes_select || '').split(',').map((opt, i) => (
                                                                    <option key={i} value={opt.trim()}>{opt.trim()}</option>
                                                                ))}
                                                            </select>
                                                        ) : campo.tipo_input === 'textarea' ? (
                                                            <textarea
                                                                rows={2}
                                                                value={val}
                                                                onChange={(e) => handleAtributoChange(campo, e.target.value)}
                                                                placeholder={`Informe ${campo.label.toLowerCase()}...`}
                                                                className="w-full bg-white border border-indigo-200 rounded-md px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                        ) : (
                                                            <input
                                                                type={campo.tipo_input === 'number' ? 'number' : 'text'}
                                                                step="any"
                                                                value={val}
                                                                onChange={(e) => handleAtributoChange(campo, e.target.value)}
                                                                placeholder={`Informe ${campo.label.toLowerCase()}...`}
                                                                className="w-full bg-white border border-indigo-200 rounded-md px-2 py-1 text-xs text-gray-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-7"
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-white/70 rounded-lg text-center border border-indigo-100">
                                            <p className="text-xs text-indigo-700 font-semibold">
                                                Nenhum modelo de formulário vinculado a este tipo.
                                            </p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                Selecione um modelo no canto superior ou configure novos campos na <RouterLink to="/cadastros/templates-produto" target="_blank" className="text-indigo-600 underline font-bold">Matriz de Formulários</RouterLink>.
                                            </p>
                                        </div>
                                    )}

                                    {/* Ação: Gerar Descrição Automática a partir do Template */}
                                    {activeTemplate?.descricao_mascara && (
                                        <div className="pt-1.5 border-t border-indigo-200/60 flex items-center justify-between">
                                            <span className="text-[10px] text-indigo-700 font-mono truncate" title={activeTemplate.descricao_mascara}>
                                                Fórmula: {activeTemplate.descricao_mascara}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleGerarDescricaoAutomatica}
                                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-bold shadow-2xs flex items-center gap-1 transition shrink-0 cursor-pointer"
                                                title="Preencher a Descrição Completa usando a fórmula e os atributos informados"
                                            >
                                                <Sparkles className="w-3 h-3" />
                                                Gerar Descrição Automática
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Card 2: Descrição Completa (B1_DESC) + Tradução EN ➔ PT */}
                            <div className="space-y-0.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                                        Descrição Completa (B1_DESC) *
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-[9px] font-mono ${formData.descricao.length > 95 ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                                            {formData.descricao.length}/100 carac.
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleTraduzir}
                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                                            title="Traduzir descrição técnica de Inglês para Português"
                                        >
                                            <Languages className="w-2.5 h-2.5 text-blue-600" />
                                            <span>Traduzir EN ➔ PT</span>
                                        </button>
                                        {traduzido && (
                                            <button
                                                type="button"
                                                onClick={handleReverterOriginal}
                                                className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-semibold transition cursor-pointer"
                                                title="Restaurar a descrição original"
                                            >
                                                <RotateCcw className="w-2 h-2 text-gray-500" />
                                                <span>Original</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    required
                                    maxLength={100}
                                    value={formData.descricao}
                                    onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value.toUpperCase() }))}
                                    placeholder="Ex: TUBO BRONZE TM-23 30X45MM X 1000"
                                    className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1 text-xs text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase tracking-wide h-7"
                                />
                            </div>

                            {/* Card 3: Associação Desenho Empresa com Desenho Cliente (SZ1010) */}
                            <div className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                                    <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[10px] uppercase tracking-wider">
                                        <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Associação Desenho Empresa ⟷ Desenho Cliente (SZ1010)</span>
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-medium">
                                        Amarração Técnica
                                    </span>
                                </div>

                                {/* Seleção do Cliente */}
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <label className="block text-[9px] font-semibold text-slate-600 uppercase">
                                            Cliente da Carteira (SA1010 / Opcional)
                                        </label>
                                        {formData.cliente_codigo && (
                                            <button
                                                type="button"
                                                onClick={handleClearCliente}
                                                className="text-[9px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                                                title="Tornar produto interno da empresa"
                                            >
                                                <X className="w-2.5 h-2.5" />
                                                Desvincular
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        value={formData.cliente_codigo || ''}
                                        onChange={(e) => {
                                            const selCod = e.target.value;
                                            if (!selCod) {
                                                handleClearCliente();
                                            } else {
                                                const cli = clientesList.find(c => (c.codigo || c.a1_cod) === selCod);
                                                if (cli) handleSelectCliente(cli);
                                                else setFormData(prev => ({ ...prev, cliente_codigo: selCod }));
                                            }
                                        }}
                                        className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                    >
                                        <option value="">⚪ Nenhum (Produto Interno da Empresa sem cliente específico)</option>
                                        {clientesList.map(cli => {
                                            const cod = cli.codigo || cli.a1_cod;
                                            const loj = cli.loja || cli.a1_loja || '01';
                                            const nom = cli.razao_social || cli.a1_nome || cli.nome_fantasia || '';
                                            return (
                                                <option key={`${cod}-${loj}`} value={cod}>
                                                    {cod} (Loja {loj}) - {nom}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                {/* 3 Campos: Revisão Empresa, Ref/Desenho Cliente, Revisão Cliente */}
                                <div className="grid grid-cols-12 gap-2">
                                    <div className="col-span-3">
                                        <label className="block text-[9px] font-bold text-gray-700 uppercase tracking-wider mb-0.5 truncate" title="Revisão do Produto (C6_XREVM)">
                                            Rev. Empresa
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="0"
                                            value={formData.b1_xrevm}
                                            onChange={(e) => setFormData(prev => ({ ...prev, b1_xrevm: e.target.value.trim().toUpperCase() }))}
                                            className="w-full bg-white border border-gray-300 rounded-md px-1.5 py-1 text-xs text-gray-900 font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        />
                                    </div>

                                    <div className="col-span-6">
                                        <label className="block text-[9px] font-bold text-gray-700 uppercase tracking-wider mb-0.5 truncate" title="Ref. Cliente (Desenho do Cliente)">
                                            Ref. Cliente (Desenho)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: DES-10492 / REF-001"
                                            value={formData.b1_xproc1}
                                            onChange={(e) => setFormData(prev => ({ ...prev, b1_xproc1: e.target.value.trim().toUpperCase() }))}
                                            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        />
                                    </div>

                                    <div className="col-span-3">
                                        <label className="block text-[9px] font-bold text-gray-700 uppercase tracking-wider mb-0.5 truncate" title="Rev. Cliente (Revisão do Cliente)">
                                            Rev. Cliente
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="0"
                                            value={formData.b1_xrevc}
                                            onChange={(e) => setFormData(prev => ({ ...prev, b1_xrevc: e.target.value.trim().toUpperCase() }))}
                                            className="w-full bg-white border border-gray-300 rounded-md px-1.5 py-1 text-xs text-gray-900 font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        />
                                    </div>
                                </div>

                                {/* Banner de Status SZ1010 */}
                                <div className={`py-1 px-2 rounded border text-[10px] flex items-center justify-between ${
                                    formData.cliente_codigo && formData.b1_xproc1
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                        : formData.cliente_codigo
                                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                                        : 'bg-slate-100/90 border-slate-200 text-slate-600'
                                }`}>
                                    <div className="flex items-center gap-1.5 truncate pr-2">
                                        <Link2 className={`w-3 h-3 shrink-0 ${formData.cliente_codigo && formData.b1_xproc1 ? 'text-emerald-600' : 'text-slate-400'}`} />
                                        <span className="truncate">
                                            {formData.cliente_codigo && formData.b1_xproc1 ? (
                                                <>Vínculo SZ1010: Cliente <strong>{formData.cliente_codigo}</strong> • Desenho: <strong>{formData.b1_xproc1}</strong></>
                                            ) : formData.cliente_codigo ? (
                                                <>Cliente selecionado. Informe o desenho para ativar SZ1010.</>
                                            ) : (
                                                <>Cadastro Interno: Sem amarração com cliente externo.</>
                                            )}
                                        </span>
                                    </div>
                                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded shrink-0 ${
                                        formData.cliente_codigo && formData.b1_xproc1
                                            ? 'bg-emerald-200 text-emerald-900 border border-emerald-400'
                                            : formData.cliente_codigo
                                            ? 'bg-amber-200 text-amber-900'
                                            : 'bg-slate-200 text-slate-700'
                                    }`}>
                                        {formData.cliente_codigo && formData.b1_xproc1 ? 'SZ1010 ATIVO' : formData.cliente_codigo ? 'AGUARDANDO DESENHO' : 'INTERNO'}
                                    </span>
                                </div>
                            </div>

                            {/* Card 4: Codificação de Cor */}
                            <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                        <Palette className="w-3 h-3 text-indigo-600" />
                                        Cor do Aço / Matéria-Prima
                                    </label>
                                    <RouterLink
                                        to="/cadastros/basicos?tab=cores"
                                        target="_blank"
                                        className="text-[9px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline flex items-center gap-0.5"
                                    >
                                        <Plus className="w-2.5 h-2.5" /> Gerenciar Cores
                                    </RouterLink>
                                </div>

                                <div className="flex items-center gap-2">
                                    <select
                                        value={formData.cor_id || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, cor_id: e.target.value }))}
                                        className="flex-1 bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                    >
                                        <option value="">Nenhum (Sem cor de aço - Padrão)</option>
                                        {coresList.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.codigo} - {c.significado} ({c.tipo_cor === 'bicolor' ? 'Bicolor' : 'Sólida'})
                                            </option>
                                        ))}
                                    </select>

                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-gray-200 h-7 shrink-0">
                                        {formData.cor_id ? (() => {
                                            const sel = coresList.find(c => String(c.id) === String(formData.cor_id));
                                            if (!sel) return <span className="text-[10px] text-gray-400">Sem cor</span>;
                                            return (
                                                <>
                                                    <span
                                                        className="w-4 h-4 rounded-full border border-gray-400 shadow-inner shrink-0"
                                                        style={sel.tipo_cor === 'bicolor' && sel.cor_secundaria
                                                            ? { background: `linear-gradient(90deg, ${sel.cor_primaria} 50%, ${sel.cor_secundaria} 50%)` }
                                                            : { backgroundColor: sel.cor_primaria }
                                                        }
                                                    />
                                                    <span className="text-[10px] font-bold text-gray-800 font-mono">{sel.codigo}</span>
                                                </>
                                            );
                                        })() : (
                                            <span className="text-[10px] text-gray-400 italic">⚪ Sem cor</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ══ COLUNA DIREITA (5/12): Parâmetros Fabris, Valores & Mídias Técnicas ══ */}
                        <div className="lg:col-span-5 space-y-2">
                            
                            {/* Card 1: Unidade, Armazém, NCM, Lead Time */}
                            <div className="bg-slate-50/70 p-2.5 rounded-lg border border-gray-200 space-y-1.5">
                                <span className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-0.5">
                                    Parâmetros Fabris & Fiscais
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="block text-[9px] font-semibold text-gray-600 uppercase">
                                                Unidade (B1_UM) *
                                            </label>
                                            <RouterLink to="/cadastros/basicos?tab=unidades" target="_blank" className="text-[8px] text-blue-600 hover:underline">
                                                + UMs
                                            </RouterLink>
                                        </div>
                                        <select
                                            value={formData.unidade_medida}
                                            onChange={(e) => setFormData(prev => ({ ...prev, unidade_medida: e.target.value }))}
                                            className="w-full bg-white border border-gray-300 rounded-md px-1.5 py-1 text-xs text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        >
                                            {cadastrosBasicos.unidades && cadastrosBasicos.unidades.length > 0 ? (
                                                cadastrosBasicos.unidades.map(u => (
                                                    <option key={u.codigo} value={u.codigo}>{u.codigo} - {u.descricao}</option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="UN">UN - Unidade</option>
                                                    <option value="PC">PC - Peça</option>
                                                    <option value="KG">KG - Quilograma</option>
                                                    <option value="MT">MT - Metro</option>
                                                    <option value="M2">M2 - Metro Quad.</option>
                                                    <option value="CX">CX - Caixa</option>
                                                </>
                                            )}
                                        </select>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="block text-[9px] font-semibold text-gray-600 uppercase">
                                                Armazém (B1_LOCPAD)
                                            </label>
                                            <RouterLink to="/cadastros/basicos?tab=armazens" target="_blank" className="text-[8px] text-blue-600 hover:underline">
                                                + Arm
                                            </RouterLink>
                                        </div>
                                        <select
                                            value={formData.armazem_padrao}
                                            onChange={(e) => setFormData(prev => ({ ...prev, armazem_padrao: e.target.value }))}
                                            className="w-full bg-white border border-gray-300 rounded-md px-1.5 py-1 text-xs text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        >
                                            {cadastrosBasicos.armazens && cadastrosBasicos.armazens.length > 0 ? (
                                                cadastrosBasicos.armazens.map(a => (
                                                    <option key={a.codigo} value={a.codigo}>{a.codigo} - {a.descricao}</option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="01">01 - Almoxarifado Central</option>
                                                    <option value="99">99 - Chão de Fábrica</option>
                                                    <option value="02">02 - Matéria-Prima</option>
                                                    <option value="03">03 - Expedição</option>
                                                </>
                                            )}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-semibold text-gray-600 uppercase mb-0.5">
                                            NCM (B1_POSIPI)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: 85177900"
                                            value={formData.ncm}
                                            onChange={(e) => setFormData(prev => ({ ...prev, ncm: e.target.value }))}
                                            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-semibold text-gray-600 uppercase mb-0.5">
                                            Lead Time (Dias)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="5"
                                            value={formData.lead_time_dias}
                                            onChange={(e) => setFormData(prev => ({ ...prev, lead_time_dias: e.target.value }))}
                                            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-900 font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Pesos e Custos com suporte a decimais (vírgula) */}
                            <div className="bg-slate-50/70 p-2.5 rounded-lg border border-gray-200 space-y-1.5">
                                <span className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-0.5">
                                    Pesos & Valores (Decimais com vírgula)
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[9px] font-semibold text-gray-600 uppercase mb-0.5">
                                            Peso Líq. (kg)
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0,000"
                                            value={formData.peso_liquido}
                                            onChange={(e) => handleDecimalChange('peso_liquido', e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-900 font-mono text-right focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-semibold text-gray-600 uppercase mb-0.5">
                                            Peso Bruto (kg)
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0,000"
                                            value={formData.peso_bruto}
                                            onChange={(e) => handleDecimalChange('peso_bruto', e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-900 font-mono text-right focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-semibold text-gray-600 uppercase mb-0.5">
                                            Custo Std (R$)
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0,00"
                                            value={formData.custo_standard}
                                            onChange={(e) => handleDecimalChange('custo_standard', e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-900 font-mono text-right focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-semibold text-gray-600 uppercase mb-0.5">
                                            Preço Venda (R$)
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0,00"
                                            value={formData.preco_venda}
                                            onChange={(e) => handleDecimalChange('preco_venda', e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-900 font-mono text-right focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Mídias Técnicas (Foto & Desenho Compactos) */}
                            <div className="grid grid-cols-2 gap-2">
                                {/* Foto do Produto */}
                                <div className="bg-slate-50/80 p-2 rounded-lg border border-gray-200 flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                                            <Camera className="w-3 h-3 text-blue-600" />
                                            Foto Produto
                                        </label>
                                        {formData.foto_url && (
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, foto_url: '' }))}
                                                className="text-[9px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                                            >
                                                Remover
                                            </button>
                                        )}
                                    </div>

                                    {formData.foto_url ? (
                                        <div className="relative group w-full h-16 bg-white border border-gray-200 rounded overflow-hidden flex items-center justify-center">
                                            <img
                                                src={formData.foto_url}
                                                alt="Foto do Produto"
                                                className="max-h-full max-w-full object-contain"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setPreviewImage(formData.foto_url)}
                                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1 cursor-pointer"
                                            >
                                                <ZoomIn className="w-3 h-3" />
                                                Ampliar
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full h-16 border border-dashed border-gray-300 rounded cursor-pointer bg-white hover:bg-blue-50/50 hover:border-blue-400 transition text-center px-1">
                                            <Upload className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
                                            <p className="text-[9px] font-medium text-gray-700 leading-tight">Enviar foto</p>
                                            <p className="text-[8px] text-gray-400">PNG, JPG</p>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleFotoUpload}
                                            />
                                        </label>
                                    )}

                                    <input
                                        type="text"
                                        placeholder="Ou URL (https://...)"
                                        value={formData.foto_url?.startsWith('data:') ? '' : formData.foto_url}
                                        onChange={(e) => setFormData(prev => ({ ...prev, foto_url: e.target.value }))}
                                        className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[9px] text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1 h-6"
                                    />
                                </div>

                                {/* Desenho Técnico */}
                                <div className="bg-slate-50/80 p-2 rounded-lg border border-gray-200 flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                                            <FileText className="w-3 h-3 text-indigo-600" />
                                            Desenho (CAD)
                                        </label>
                                        {formData.desenho_url && (
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, desenho_url: '', desenho_nome: '', desenho_tipo: '' }))}
                                                className="text-[9px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                                            >
                                                Remover
                                            </button>
                                        )}
                                    </div>

                                    {formData.desenho_url ? (
                                        <div className="w-full h-16 bg-white border border-gray-200 rounded p-1 flex flex-col items-center justify-center text-center">
                                            <FileText className="w-4 h-4 text-indigo-600 mb-0.5" />
                                            <p className="text-[9px] font-bold text-gray-900 truncate max-w-full leading-tight" title={formData.desenho_nome || 'desenho'}>
                                                {formData.desenho_nome || 'Desenho anexado'}
                                            </p>
                                            <a
                                                href={formData.desenho_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[9px] text-indigo-600 hover:underline font-semibold mt-0.5"
                                            >
                                                Baixar / Ver
                                            </a>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full h-16 border border-dashed border-gray-300 rounded cursor-pointer bg-white hover:bg-indigo-50/50 hover:border-indigo-400 transition text-center px-1">
                                            <Link className="w-3.5 h-3.5 text-indigo-600 mb-0.5" />
                                            <p className="text-[9px] font-medium text-gray-700 leading-tight">Anexar desenho</p>
                                            <p className="text-[8px] text-gray-400">PDF, DWG, DXF</p>
                                            <input
                                                type="file"
                                                accept=".pdf,.dwg,.dxf"
                                                className="hidden"
                                                onChange={handleDesenhoUpload}
                                            />
                                        </label>
                                    )}

                                    <input
                                        type="text"
                                        placeholder="Ou link externo (SharePoint...)"
                                        value={formData.desenho_url?.startsWith('data:') ? '' : formData.desenho_url}
                                        onChange={(e) => {
                                            const url = e.target.value;
                                            const ext = url.split('.').pop()?.toLowerCase()?.split(/[?#]/)[0] || '';
                                            setFormData(prev => ({
                                                ...prev,
                                                desenho_url: url,
                                                desenho_nome: url ? (url.split('/').pop()?.split(/[?#]/)[0] || 'desenho-externo') : '',
                                                desenho_tipo: ['pdf', 'dwg', 'dxf'].includes(ext) ? ext : 'outro'
                                            }));
                                        }}
                                        className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[9px] text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 mt-1 h-6"
                                    />
                                </div>
                            </div>

                            {/* Pasta / Diretório no Servidor */}
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                                        <Folder className="w-3 h-3 text-amber-600" />
                                        Caminho / Pasta no Servidor (Rede)
                                    </label>
                                    {formData.pasta_servidor && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, pasta_servidor: '' }))}
                                            className="text-[9px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                                        >
                                            Limpar
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    placeholder="Ex: \\servidor\engenharia\desenhos\PRD-0001 ou D:\Engenharia\..."
                                    value={formData.pasta_servidor || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, pasta_servidor: e.target.value }))}
                                    className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-[11px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                                />
                                <p className="text-[8px] text-gray-400 mt-0.5">
                                    Caminho da pasta onde estão armazenados os arquivos e desenhos deste item na rede local.
                                </p>
                            </div>
                        </div>

                    </div>

                    {/* 3. Modal Footer / Ações */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 shrink-0">
                        <div className="text-[10px] text-gray-500">
                            Campos com <span className="text-rose-500 font-bold">*</span> são obrigatórios.
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 transition shadow-xs hover:shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <span>
                                        {isEditing 
                                            ? 'Atualizar Produto' 
                                            : (isSinco ? 'Cadastrar e Vincular no SINCO' : 'Gravar Produto')}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Modal de Zoom da Foto */}
                {previewImage && (
                    <div 
                        onClick={() => setPreviewImage(null)}
                        className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
                    >
                        <div className="relative max-w-2xl max-h-[85vh] bg-white p-2 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <button
                                type="button"
                                onClick={() => setPreviewImage(null)}
                                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition shadow cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <img src={previewImage} alt="Visualização ampliada" className="max-h-[80vh] w-auto mx-auto rounded-xl object-contain" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

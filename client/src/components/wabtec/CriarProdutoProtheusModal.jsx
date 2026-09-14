import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    X, 
    Database, 
    Layers, 
    Tag, 
    FileText, 
    Ruler, 
    CheckCircle2, 
    AlertCircle, 
    AlertTriangle,
    RefreshCw,
    Loader2, 
    Sparkles, 
    Link2,
    Languages,
    RotateCcw,
    Search
} from 'lucide-react';
import api, { getClientes } from '../../services/api';
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
    
    // Divide respeitando palavras inteiras e separadores
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

export default function CriarProdutoProtheusModal({ isOpen, onClose, item, onSuccess, isSinco = false }) {
    // ⚠️ TODOS os hooks React devem ser chamados incondicionalmente no topo do componente
    // Identificador se o modal foi aberto pela página do Solid Edge (SINCO)
    const isCadastroSinco = Boolean(
        isSinco ||
        item?.is_sinco || 
        item?.badge === 'CADASTRO SINCO' || 
        item?.badge === 'CADASTRO SOLID EDGE'
    );

    // Estados do Formulário
    const [titulo, setTitulo] = useState('');
    const [descEstendida, setDescEstendida] = useState('');
    const [grupo, setGrupo] = useState('');
    const [tipo, setTipo] = useState('PA');
    const [um, setUm] = useState('PC');
    const [ncm, setNcm] = useState('00000000');
    const [peso, setPeso] = useState('');
    const [comprimento, setComprimento] = useState('');
    const [largura, setLargura] = useState('');
    const [espessura, setEspessura] = useState('');
    const [volume, setVolume] = useState('');

    // Estados de Cliente e Código/Revisão (customizáveis no Solid Edge e persistentes)
    const [clienteCodigo, setClienteCodigo] = useState('');
    const [clienteLoja, setClienteLoja] = useState('0001');
    const [clienteNome, setClienteNome] = useState('');
    const [codDesenhoCliente, setCodDesenhoCliente] = useState('');
    const [revisaoCliente, setRevisaoCliente] = useState('00');

    // Estados de Busca de Clientes (SA1010)
    const [showSearchCliente, setShowSearchCliente] = useState(false);
    const [searchCliQuery, setSearchCliQuery] = useState('');
    const [searchCliResults, setSearchCliResults] = useState([]);
    const [searchingCli, setSearchingCli] = useState(false);

    // Estados de Controle e Listas
    const [dropdowns, setDropdowns] = useState({ grupos: [], tipos: [], ums: [] });
    const [loadingDropdowns, setLoadingDropdowns] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [searchGrupo, setSearchGrupo] = useState('');
    const [originalExcelDesc, setOriginalExcelDesc] = useState('');
    const [traduzido, setTraduzido] = useState(false);

    // Verificação em Tempo Real se o Desenho do Cliente já existe no Protheus (SZ1010 / SB1010)
    const [consultandoDesenho, setConsultandoDesenho] = useState(false);
    const [resultadoDesenho, setResultadoDesenho] = useState(null);

    // Normalização da Revisão da WabTec
    const revWabtec = useMemo(() => {
        if (!item) return '00';
        return String(item.rev_convertida || item.rev_cliente_raw || '00').padStart(2, '0');
    }, [item]);

    // Handlers para seleção e persistência do Cliente (Solid Edge)
    const handleSelectCliente = (cli) => {
        const cod = cli.codigo?.trim() || '';
        const loj = cli.loja?.trim() || '0001';
        const nom = cli.nome?.trim() || '';
        setClienteCodigo(cod);
        setClienteLoja(loj);
        setClienteNome(nom);
        setShowSearchCliente(false);
        try {
            const raw = localStorage.getItem('sinco_ultimo_cadastro_protheus');
            const prev = raw ? JSON.parse(raw) : {};
            localStorage.setItem('sinco_ultimo_cadastro_protheus', JSON.stringify({
                ...prev,
                cliente_codigo: cod,
                cliente_loja: loj,
                cliente_nome: nom
            }));
        } catch (e) {
            console.warn('Erro ao salvar cliente no localStorage:', e);
        }
    };

    const handleClearCliente = () => {
        setClienteCodigo('');
        setClienteLoja('0001');
        setClienteNome('');
        try {
            const raw = localStorage.getItem('sinco_ultimo_cadastro_protheus');
            const prev = raw ? JSON.parse(raw) : {};
            localStorage.setItem('sinco_ultimo_cadastro_protheus', JSON.stringify({
                ...prev,
                cliente_codigo: '',
                cliente_loja: '0001',
                cliente_nome: ''
            }));
        } catch (e) {
            console.warn('Erro ao limpar cliente no localStorage:', e);
        }
    };

    const executarBuscaClientes = useCallback(async (queryTexto) => {
        const q = typeof queryTexto === 'string' ? queryTexto : searchCliQuery;
        setSearchingCli(true);
        try {
            const res = await getClientes(q ? q.trim() : '');
            setSearchCliResults(Array.isArray(res) ? res : []);
        } catch (err) {
            console.error('Erro ao buscar clientes no Protheus:', err);
            toast.error('Erro ao buscar clientes no Protheus.');
        } finally {
            setSearchingCli(false);
        }
    }, [searchCliQuery]);

    const handleOpenSearchCliente = () => {
        setSearchCliQuery('');
        setSearchCliResults([]);
        setShowSearchCliente(true);
        executarBuscaClientes('');
    };

    // Busca com debounce automático (300ms) ao digitar na caixa de busca de clientes
    useEffect(() => {
        if (!showSearchCliente) return;

        const timer = setTimeout(() => {
            executarBuscaClientes(searchCliQuery);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchCliQuery, showSearchCliente, executarBuscaClientes]);

    const handleRevisaoChange = (val) => {
        const limpo = val.toUpperCase().slice(0, 4);
        setRevisaoCliente(limpo);
        try {
            const raw = localStorage.getItem('sinco_ultimo_cadastro_protheus');
            const prev = raw ? JSON.parse(raw) : {};
            localStorage.setItem('sinco_ultimo_cadastro_protheus', JSON.stringify({
                ...prev,
                revisao: limpo
            }));
        } catch (e) {}
    };

    // Consulta em tempo real se o desenho do cliente já existe no Protheus
    useEffect(() => {
        let isMounted = true;
        const desenhoConsultar = isCadastroSinco ? codDesenhoCliente.trim() : item?.desenho_cliente;
        if (desenhoConsultar && desenhoConsultar !== 'Novo Cadastro Pelo SINCO' && isOpen) {
            const checkDesenhoProtheus = async () => {
                setConsultandoDesenho(true);
                try {
                    const res = await api.get('/wabtec/consultar-desenho', {
                        params: { desenho: desenhoConsultar }
                    });
                    if (isMounted) {
                        setResultadoDesenho(res.data);
                        if (res.data?.existe) {
                            if (res.data.ncm) setNcm(res.data.ncm);
                            if (res.data.grupo) setGrupo(res.data.grupo);
                            if (res.data.tipo) setTipo(res.data.tipo);
                            if (res.data.um) setUm(res.data.um);
                        }
                    }
                } catch (err) {
                    console.warn('Erro ao consultar desenho no Protheus:', err.message);
                    if (isMounted) setResultadoDesenho(null);
                } finally {
                    if (isMounted) setConsultandoDesenho(false);
                }
            };
            checkDesenhoProtheus();
        } else {
            setResultadoDesenho(null);
        }
        return () => { isMounted = false; };
    }, [isCadastroSinco ? codDesenhoCliente : item?.desenho_cliente, isOpen, isCadastroSinco]);

    // Inicialização ao abrir com os dados do item e preferências persistidas
    useEffect(() => {
        if (item && isOpen) {
            const isSincoItem = Boolean(
                item.is_sinco || 
                item.badge === 'CADASTRO SINCO' || 
                item.badge === 'CADASTRO SOLID EDGE'
            );

            let savedPref = null;
            if (isSincoItem) {
                try {
                    const raw = localStorage.getItem('sinco_ultimo_cadastro_protheus');
                    if (raw) savedPref = JSON.parse(raw);
                } catch (e) {}
            }

            // Descrição da peça
            const descPlanilha = item.titulo ? String(item.titulo).trim().toUpperCase() : '';
            setOriginalExcelDesc(descPlanilha);
            setTitulo(descPlanilha.slice(0, 30));
            setDescEstendida(descPlanilha);
            setTraduzido(false);

            // Predefine UM
            if (item.uom) {
                const uomUpper = String(item.uom).trim().toUpperCase();
                setUm(uomUpper.slice(0, 2));
            } else if (isSincoItem && savedPref?.um) {
                setUm(savedPref.um);
            } else {
                setUm('PC');
            }

            // Define tipo padrão
            if (item.nivel === '0' || item.nivel === 0) {
                setTipo('PA');
            } else if (isSincoItem && savedPref?.tipo) {
                setTipo(savedPref.tipo);
            } else {
                setTipo('PI');
            }

            // Define grupo inicial
            if (item.grupo) {
                setGrupo(String(item.grupo).split(/[\-\s]/)[0]);
            } else if (isSincoItem && savedPref?.grupo) {
                setGrupo(savedPref.grupo);
            }

            setNcm('00000000');
            setPeso(item.peso !== undefined && item.peso !== '' ? String(item.peso) : '');
            setComprimento(item.comprimento !== undefined && item.comprimento !== '' ? String(item.comprimento) : '');
            setLargura(item.largura !== undefined && item.largura !== '' ? String(item.largura) : '');
            setEspessura(item.espessura !== undefined && item.espessura !== '' ? String(item.espessura) : '');
            setVolume(item.volume !== undefined && item.volume !== '' ? String(item.volume) : (item.area !== undefined && item.area !== '' ? String(item.area) : ''));
            setSearchGrupo('');

            if (isSincoItem) {
                // Se for abertura de novo cadastro limpo (item.is_clean), não puxa cliente ou desenho antigos do localStorage
                const isClean = Boolean(item.is_clean);
                const cliCod = item.cliente_codigo || (!isClean ? savedPref?.cliente_codigo : '') || '';
                const cliLoj = item.cliente_loja || (!isClean ? (savedPref?.cliente_loja || '0001') : '0001') || '0001';
                const cliNom = item.cliente_nome || (!isClean ? savedPref?.cliente_nome : '') || '';
                setClienteCodigo(cliCod);
                setClienteLoja(cliLoj);
                setClienteNome(cliNom);

                const rawDes = isClean ? '' : (item.desenho_cliente === 'Novo Cadastro Pelo SINCO' ? '' : (item.desenho_cliente || ''));
                setCodDesenhoCliente(rawDes);

                const revInicial = item.revisao || item.rev_convertida || item.rev_cliente_raw || (!isClean ? savedPref?.revisao : '00') || '00';
                setRevisaoCliente(String(revInicial).trim().toUpperCase().slice(0, 4) || '00');
            } else {
                // Fluxo exclusivo WabTec: estritamente fixo para WabTec
                setClienteCodigo('00000739');
                setClienteLoja('0001');
                setClienteNome('WABTEC BRASIL');
                setCodDesenhoCliente(item.desenho_cliente || '');
                setRevisaoCliente(String(item.rev_convertida || item.rev_cliente_raw || '00').padStart(2, '0'));
            }
        }
    }, [item, isOpen]);

    // Busca Dropdowns do Protheus (SBM010, SX5010, SAH010)
    useEffect(() => {
        let isMounted = true;
        const fetchDropdowns = async () => {
            setLoadingDropdowns(true);
            try {
                const { data } = await api.get('/protheus/dropdowns');
                if (isMounted && data) {
                    const sortedGrupos = (data.grupos || []).sort((a, b) => a.code.localeCompare(b.code));
                    setDropdowns({
                        grupos: sortedGrupos,
                        tipos: (data.tipos || []).sort((a, b) => a.code.localeCompare(b.code)),
                        ums: (data.ums || []).sort((a, b) => a.code.localeCompare(b.code))
                    });

                    // Se não tiver grupo selecionado, sugere do localStorage ou MT4/MT2
                    if (!grupo && sortedGrupos.length > 0) {
                        let prefGrupo = '';
                        if (isCadastroSinco) {
                            try {
                                const raw = localStorage.getItem('sinco_ultimo_cadastro_protheus');
                                if (raw) prefGrupo = JSON.parse(raw)?.grupo || '';
                            } catch (e) {}
                        }
                        const defaultGrupo = (prefGrupo && sortedGrupos.find(g => g.code === prefGrupo))
                            || sortedGrupos.find(g => g.code === 'MT4' || g.code === 'MT2');
                        if (defaultGrupo) setGrupo(defaultGrupo.code);
                    }
                }
            } catch (err) {
                console.error('Erro ao carregar listas do Protheus:', err);
                toast.error('Não foi possível carregar as listas mestres do Protheus.');
            } finally {
                if (isMounted) setLoadingDropdowns(false);
            }
        };

        if (isOpen) {
            fetchDropdowns();
        }
        return () => { isMounted = false; };
    }, [isOpen, isCadastroSinco]);

    // Filtro rápido de Grupos
    const filteredGrupos = useMemo(() => {
        return dropdowns.grupos.filter(g => 
            g.code.toLowerCase().includes(searchGrupo.toLowerCase()) || 
            (g.label && g.label.toLowerCase().includes(searchGrupo.toLowerCase()))
        );
    }, [dropdowns.grupos, searchGrupo]);

    // Ação: Traduzir de Inglês para Português
    const handleTraduzir = () => {
        const baseTexto = descEstendida || titulo || originalExcelDesc;
        const textoTraduzido = traduzirInglesParaPortugues(baseTexto);
        setTitulo(textoTraduzido.slice(0, 30));
        setDescEstendida(textoTraduzido);
        setTraduzido(true);
        toast.info(`Descrição traduzida para o Português: "${textoTraduzido.slice(0, 30)}"`, { autoClose: 3500 });
    };

    // Ação: Reverter para a descrição original da planilha WabTec
    const handleReverterOriginal = () => {
        setTitulo(originalExcelDesc.slice(0, 30));
        setDescEstendida(originalExcelDesc);
        setTraduzido(false);
        toast.info('Descrição revertida para o original da planilha WabTec.');
    };

    const handleVincularExistente = async () => {
        const codigoVincular = isCadastroSinco ? codDesenhoCliente : item?.desenho_cliente;
        if (!resultadoDesenho?.codigo_protheus || !codigoVincular) return;
        setSubmitting(true);
        try {
            const payload = {
                desenho_cliente: codigoVincular,
                codigo_protheus: resultadoDesenho.codigo_protheus,
                revisao_cliente: isCadastroSinco ? revisaoCliente : revWabtec,
                titulo: descEstendida || titulo,
                cliente_codigo: isCadastroSinco ? clienteCodigo.trim() : (item?.cliente_codigo || '00000739'),
                cliente_loja: isCadastroSinco ? clienteLoja.trim() : (item?.cliente_loja || '0001'),
                cliente_nome: isCadastroSinco ? clienteNome.trim() : (item?.cliente_nome || 'WABTEC BRASIL'),
                is_sinco: isCadastroSinco
            };
            const res = await api.post('/wabtec/vincular-produto-existente', payload);
            if (res.data?.success) {
                toast.success(
                    `🎉 Código ${resultadoDesenho.codigo_protheus} vinculado com sucesso na tabela Produto x Cliente (SZ1010)!`,
                    { autoClose: 5000 }
                );
                if (onSuccess) {
                    onSuccess({ 
                        codigo: resultadoDesenho.codigo_protheus,
                        desenho_cliente: codigoVincular,
                        revisao: isCadastroSinco ? revisaoCliente : revWabtec,
                        cliente_codigo: isCadastroSinco ? clienteCodigo.trim() : (item?.cliente_codigo || '00000739'),
                        cliente_loja: isCadastroSinco ? clienteLoja.trim() : (item?.cliente_loja || '0001'),
                        cliente_nome: isCadastroSinco ? clienteNome.trim() : (item?.cliente_nome || 'WABTEC BRASIL'),
                        ...res.data
                    });
                }
                onClose();
            }
        } catch (err) {
            console.error('Erro ao vincular produto existente:', err);
            toast.error(err.response?.data?.error || 'Erro ao vincular produto existente.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!titulo.trim()) {
            toast.warn('A Descrição MetalFisa é obrigatória.');
            return;
        }
        if (!grupo) {
            toast.warn('Selecione o Grupo de Estoque.');
            return;
        }
        if (!tipo) {
            toast.warn('Selecione o Tipo do Produto.');
            return;
        }
        if (!um) {
            toast.warn('Selecione a Unidade de Medida.');
            return;
        }

        setSubmitting(true);
        try {
            const codDes = isCadastroSinco
                ? (codDesenhoCliente.trim() || 'Novo Cadastro Pelo SINCO')
                : String(item.desenho_cliente || '').replace(/\s+/g, ' ').trim().toUpperCase();
            const tit = String(descEstendida || titulo || '').replace(/\s+/g, ' ').trim().toUpperCase();
            const grp = String(grupo || '').split(/[\-\s]/)[0].trim().toUpperCase();
            const tip = String(tipo || '').split(/[\-\s]/)[0].trim().toUpperCase();
            const unMed = String(um || '').split(/[\-\s]/)[0].trim().toUpperCase();
            const rev = isCadastroSinco
                ? String(revisaoCliente || '00').replace(/\s+/g, '').trim().toUpperCase().slice(0, 2).padStart(2, '0')
                : String(revWabtec || '00').replace(/\s+/g, '').trim().toUpperCase().slice(0, 2);
            const ncmLimpo = String(ncm || '00000000').replace(/\D/g, '').slice(0, 10).padEnd(8, '0');

            const payload = {
                desenho_cliente: codDes,
                b1_xcode: codDes,
                b1_xcoddes: codDes,
                is_sinco: isCadastroSinco,
                revisao_cliente: rev,
                titulo: tit,
                grupo: grp,
                tipo: tip,
                um: unMed,
                ncm: ncmLimpo,
                peso: peso ? parseFloat(String(peso).replace(',', '.').trim()) : 0,
                comprimento: comprimento ? parseFloat(String(comprimento).replace(',', '.').trim()) : 0,
                largura: largura ? parseFloat(String(largura).replace(',', '.').trim()) : 0,
                espessura: espessura ? parseFloat(String(espessura).replace(',', '.').trim()) : 0,
                volume: volume ? parseFloat(String(volume).replace(',', '.').trim()) : 0,
                cliente_codigo: isCadastroSinco ? clienteCodigo.trim() : (item.cliente_codigo || '00000739'),
                cliente_loja: isCadastroSinco ? clienteLoja.trim() : (item.cliente_loja || '0001'),
                cliente_nome: isCadastroSinco ? clienteNome.trim() : (item.cliente_nome || 'WABTEC BRASIL')
            };

            const res = await api.post('/wabtec/criar-produto-protheus', payload);
            if (res.data.success) {
                // Se for Solid Edge, persiste as preferências selecionadas no localStorage
                if (isCadastroSinco) {
                    try {
                        localStorage.setItem('sinco_ultimo_cadastro_protheus', JSON.stringify({
                            cliente_codigo: clienteCodigo.trim(),
                            cliente_loja: clienteCodigo.trim() ? clienteLoja.trim() : '',
                            cliente_nome: clienteCodigo.trim() ? clienteNome.trim() : '',
                            grupo: grp,
                            tipo: tip,
                            um: unMed,
                            revisao: rev
                        }));
                    } catch (e) {
                        console.warn('Erro ao persistir preferências no localStorage:', e);
                    }
                }

                const msgSucesso = clienteCodigo.trim()
                    ? `🎉 Produto ${res.data.codigo} gerado com sucesso! Vínculo criado na SZ1010.`
                    : `🎉 Produto ${res.data.codigo} gerado com sucesso no Protheus!`;
                toast.success(msgSucesso, { autoClose: 6000 });
                if (onSuccess) onSuccess({ ...payload, ...res.data, cliente_nome: clienteCodigo.trim() ? clienteNome : '' });
                onClose();
            }
        } catch (err) {
            console.error('Erro ao criar produto no Protheus:', err);
            const dataErr = err.response?.data;
            const mainMsg = dataErr?.error || err.message || 'Erro inesperado na API do Protheus.';
            const motivo = dataErr?.motivo ? `\nMotivo: ${dataErr.motivo}` : '';
            toast.error(`${mainMsg}${motivo}`, { autoClose: 12000 });
        } finally {
            setSubmitting(false);
        }
    };

    // ⚠️ Retorno antecipado seguro APÓS todos os hooks
    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header Modal */}
                <div className="px-6 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-400">
                            <Database className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-base tracking-tight text-white">Cadastrar Produto no Protheus (TOTVS)</h3>
                                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    {item.badge || 'BOM WabTec'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300">
                                Inclusão nas tabelas SB1010/SB5010 e amarração de documentos na SZ1010
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        disabled={submitting}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Corpo com Scroll */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                    
                    {/* Card Origem: Solid Edge vs WabTec */}
                    {isCadastroSinco ? (
                        <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col gap-3 shadow-2xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                                        1. Identificação do Cliente & Desenho
                                    </span>
                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 border border-slate-300">
                                        Preenchimento Opcional
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-500">
                                    Deixe em branco caso este produto não pertença a um cliente específico.
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                {/* Seletor de Cliente (6 cols) */}
                                <div className="md:col-span-6 space-y-1">
                                    <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                                        <span>Cliente Protheus (SA1010)</span>
                                        {clienteCodigo && (
                                            <span className="text-[10px] font-mono text-blue-700 font-bold">
                                                Cód: {clienteCodigo} | Loja: {clienteLoja || '0001'}
                                            </span>
                                        )}
                                    </label>
                                    {clienteCodigo ? (
                                        <div className="flex items-center justify-between px-3 py-1.5 bg-white border border-blue-300 rounded-lg shadow-2xs h-[38px]">
                                            <div className="flex items-center gap-2 truncate pr-2" title={`${clienteCodigo} - ${clienteNome} (Loja ${clienteLoja})`}>
                                                <span className="font-mono font-extrabold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                                                    {clienteCodigo}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-800 truncate">
                                                    {clienteNome}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    ({clienteLoja || '0001'})
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={handleOpenSearchCliente}
                                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                                    title="Trocar cliente"
                                                >
                                                    <Search className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleClearCliente}
                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                                    title="Remover cliente"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleOpenSearchCliente}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-blue-50/40 border border-slate-300 hover:border-blue-400 rounded-lg text-xs text-slate-600 transition-all shadow-2xs group cursor-pointer h-[38px]"
                                        >
                                            <span className="flex items-center gap-2 text-slate-400 italic">
                                                <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                                <span>Selecionar cliente no Protheus...</span>
                                            </span>
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white rounded text-[11px] font-bold transition-colors">
                                                Buscar
                                            </span>
                                        </button>
                                    )}
                                </div>

                                {/* Código do Cliente / Desenho (4 cols) */}
                                <div className="md:col-span-4 space-y-1">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Cód. no Cliente / Desenho
                                    </label>
                                    <input 
                                        type="text"
                                        value={codDesenhoCliente}
                                        onChange={(e) => setCodDesenhoCliente(e.target.value.toUpperCase())}
                                        placeholder="Ex: DWG-12345 (Opcional)"
                                        className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 uppercase h-[38px]"
                                    />
                                </div>

                                {/* Revisão Cliente (2 cols) */}
                                <div className="md:col-span-2 space-y-1">
                                    <label className="block text-xs font-bold text-slate-700 text-center">
                                        Rev. Cliente
                                    </label>
                                    <input 
                                        type="text"
                                        maxLength={4}
                                        value={revisaoCliente}
                                        onChange={(e) => handleRevisaoChange(e.target.value)}
                                        placeholder="00"
                                        className="w-full px-2 py-2 text-xs font-mono font-bold text-center bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase h-[38px]"
                                    />
                                </div>
                            </div>

                            {/* Status de Existência no Protheus se informado código */}
                            {consultandoDesenho && (
                                <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                    <span>Verificando se o desenho {codDesenhoCliente} já existe no Protheus...</span>
                                </div>
                            )}

                            {!consultandoDesenho && resultadoDesenho && resultadoDesenho.existe && (
                                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span>Desenho já existente no Protheus com o produto <strong>{resultadoDesenho.codigo_protheus}</strong> (Rev: {resultadoDesenho.revisao || '-'}).</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleVincularExistente}
                                        disabled={submitting}
                                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition-all shadow-xs cursor-pointer"
                                    >
                                        Vincular ao {resultadoDesenho.codigo_protheus}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Card Origem WabTec (100% INTACTO E EXCLUSIVO WABTEC) */
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                                        Desenho {item.cliente_nome ? item.cliente_nome : 'WabTec'} (Origem)
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-base font-mono font-extrabold text-blue-900">
                                            {item.desenho_cliente}
                                        </span>
                                        {consultandoDesenho && (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                                                <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                                                <span>Verificando no Protheus...</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                                        Revisão Cliente
                                    </span>
                                    <span className="inline-block font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 text-xs">
                                        {revWabtec} {item.rev_cliente_raw && item.rev_cliente_raw !== revWabtec ? `(${item.rev_cliente_raw})` : ''}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                                        Nível da Estrutura
                                    </span>
                                    <span className="inline-block font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-xs">
                                        N{item.nivel !== undefined ? item.nivel : '-'}
                                    </span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 flex items-center gap-1.5">
                                <span className="font-semibold text-slate-400 uppercase text-[10px]">Descrição na Planilha:</span>
                                <span className="truncate text-slate-800 font-semibold max-w-md" title={item.titulo}>
                                    {item.titulo || '(Sem descrição informada)'}
                                </span>
                            </div>

                            {/* Status de Existência no Protheus (SZ1010 / SB1010) */}
                            {!consultandoDesenho && resultadoDesenho && (
                                resultadoDesenho.existe ? (
                                    <div className="mt-1 p-3 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 flex flex-col gap-2 shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                                <span className="font-bold text-xs uppercase tracking-wider text-amber-900">
                                                    Desenho Já Cadastrado no Protheus!
                                                </span>
                                            </div>
                                            <span className="font-mono font-extrabold text-sm px-2.5 py-0.5 rounded-md bg-amber-200 text-amber-950 border border-amber-400">
                                                {resultadoDesenho.codigo_protheus}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-amber-900 bg-amber-100/60 p-2 rounded-lg border border-amber-200 font-medium">
                                            <div><span className="text-amber-700 block text-[10px]">Origem:</span> {resultadoDesenho.origem === 'sz1010' ? 'SZ1010 (Prd x Cli)' : resultadoDesenho.origem === 'sb1010' ? 'SB1010 (ERP)' : 'Estrutura'}</div>
                                            <div><span className="text-amber-700 block text-[10px]">Rev. Protheus:</span> {resultadoDesenho.revisao || resultadoDesenho.revisao_cliente || '-'}</div>
                                            <div><span className="text-amber-700 block text-[10px]">NCM:</span> {resultadoDesenho.ncm || '00000000'}</div>
                                            <div><span className="text-amber-700 block text-[10px]">Tipo / UM:</span> {resultadoDesenho.tipo || 'PI'} / {resultadoDesenho.um || 'PC'}</div>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                            <span className="text-[11px] text-amber-800 truncate max-w-sm" title={resultadoDesenho.descricao}>
                                                Descrição no ERP: <strong>{resultadoDesenho.descricao}</strong>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleVincularExistente}
                                                disabled={submitting}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span>Vincular Este Código Existente ({resultadoDesenho.codigo_protheus})</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-1 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <span>Desenho Novo no Protheus</span>
                                            <span className="text-[11px] font-normal text-slate-500 hidden sm:inline">— Não cadastrado no Protheus (SB1010 / SZ1010). Pronto para gerar novo código.</span>
                                        </div>
                                        <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            Novo (Não Existe no ERP)
                                        </span>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* Seção 2: Classificação Protheus */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                                <Layers className="w-4 h-4 text-blue-600" />
                                2. Classificação do Produto (Tabelas Mestre TOTVS)
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200 font-medium">
                                <Sparkles className="w-3 h-3 text-blue-600" />
                                <span>Autonumeração SB1010 ativa: Grupo <strong>{grupo ? String(grupo).split(/[\-\s]/)[0] : '---'}</strong></span>
                            </div>
                        </div>

                        {loadingDropdowns ? (
                            <div className="p-6 flex items-center justify-center gap-3 text-slate-500 text-xs">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                Carregando Grupos, Tipos e Unidades do Protheus...
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                {/* Macro-Grupo */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Macro-Grupo (SBM010) <span className="text-rose-500">*</span>
                                    </label>
                                    <select 
                                        value={grupo}
                                        onChange={(e) => setGrupo(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    >
                                        <option value="">Selecione o Grupo...</option>
                                        {filteredGrupos.map(g => (
                                            <option key={g.code} value={g.code}>
                                                {g.code} {g.label && g.label !== 'Sem nome' ? `- ${g.label}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Tipo */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Tipo (SX5010) <span className="text-rose-500">*</span>
                                    </label>
                                    <select 
                                        value={tipo}
                                        onChange={(e) => setTipo(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    >
                                        <option value="">Selecione o Tipo...</option>
                                        {dropdowns.tipos.map(t => (
                                            <option key={t.code} value={t.code}>
                                                {t.code} - {t.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Unidade de Medida */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Unidade (SAH010) <span className="text-rose-500">*</span>
                                    </label>
                                    <select 
                                        value={um}
                                        onChange={(e) => setUm(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                                        required
                                    >
                                        <option value="">Selecione a UM...</option>
                                        {dropdowns.ums.map(u => (
                                            <option key={u.code} value={u.code}>
                                                {u.code} - {u.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* NCM / Posição IPI */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-700">
                                        NCM / Pos. IPI (SB1010)
                                    </label>
                                    <input 
                                        type="text"
                                        maxLength={10}
                                        value={ncm}
                                        onChange={(e) => setNcm(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                                        placeholder="00000000"
                                        className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Seção 3: Descrição e Regras de Desenho */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                                <FileText className="w-4 h-4 text-blue-600" />
                                3. Descrição MetalFisa
                            </div>

                            {/* Botões de Tradução e Reversão */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleTraduzir}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                                    title="Traduzir a descrição do Inglês para Português usando o vocabulário técnico de engenharia"
                                >
                                    <Languages className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Traduzir EN ➔ PT</span>
                                </button>
                                {traduzido && (
                                    <button
                                        type="button"
                                        onClick={handleReverterOriginal}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-all cursor-pointer"
                                        title="Restaurar a descrição original da planilha WabTec"
                                    >
                                        <RotateCcw className="w-3 h-3 text-slate-500" />
                                        <span>Original</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Campo: Descrição MetalFisa B1_DESC */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-slate-700">
                                    Descrição MetalFisa (B1_DESC) <span className="text-rose-500">*</span>
                                </label>
                                <span className={`text-[10px] font-mono ${titulo.length > 28 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                                    {titulo.length} / 30 caracteres
                                </span>
                            </div>
                            <input 
                                type="text"
                                maxLength={30}
                                value={titulo}
                                onChange={(e) => setTitulo(e.target.value.toUpperCase())}
                                placeholder="EX: LIGHT FAB LIST BLOWER CAB"
                                className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase tracking-wide"
                                required
                            />
                            {originalExcelDesc && originalExcelDesc !== titulo && (
                                <div className="text-[10px] text-slate-500 italic truncate max-w-xl" title={`Original: ${originalExcelDesc}`}>
                                    Planilha: {originalExcelDesc}
                                </div>
                            )}
                        </div>

                        {/* Resumo Dinâmico de Amarração */}
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-700">
                            <div className="flex items-center gap-2 truncate pr-2">
                                <Link2 className={`w-4 h-4 shrink-0 ${clienteCodigo ? 'text-emerald-600' : 'text-slate-400'}`} />
                                <span className="truncate">
                                    {clienteCodigo ? (
                                        <>
                                            Vínculo <strong>SZ1010</strong>: Cliente <strong>{clienteCodigo} - {clienteNome}</strong> (Loja {clienteLoja || '0001'}) • Cód: <strong>{codDesenhoCliente.trim() || 'Novo Cadastro Pelo SINCO'}</strong> • Rev: <strong>{revisaoCliente || '00'}</strong>
                                        </>
                                    ) : (
                                        <>
                                            Cadastro Avulso: <strong>Sem amarração de cliente na SZ1010</strong> (inclusão apenas nas tabelas SB1010/SB5010).
                                        </>
                                    )}
                                </span>
                            </div>
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${clienteCodigo ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600 border border-slate-300'}`}>
                                {clienteCodigo ? 'SZ1010 Ativo' : 'Sem Amarração'}
                            </span>
                        </div>
                    </div>

                    {/* Seção 4: Dimensões Físicas (SB5010 - Opcional) */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider">
                            <Ruler className="w-4 h-4 text-blue-600" />
                            4. Dimensões Físicas e Peso (SB5010 / Opcional)
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="space-y-1">
                                <label className="block text-[11px] font-semibold text-slate-600">Peso (kg)</label>
                                <input 
                                    type="number"
                                    step="0.001"
                                    value={peso}
                                    onChange={(e) => setPeso(e.target.value)}
                                    placeholder="0.000"
                                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[11px] font-semibold text-slate-600">Compr. (mm)</label>
                                <input 
                                    type="number"
                                    step="0.1"
                                    value={comprimento}
                                    onChange={(e) => setComprimento(e.target.value)}
                                    placeholder="0.0"
                                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[11px] font-semibold text-slate-600">Largura (mm)</label>
                                <input 
                                    type="number"
                                    step="0.1"
                                    value={largura}
                                    onChange={(e) => setLargura(e.target.value)}
                                    placeholder="0.0"
                                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[11px] font-semibold text-slate-600">Espessura (mm)</label>
                                <input 
                                    type="number"
                                    step="0.01"
                                    value={espessura}
                                    onChange={(e) => setEspessura(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-1 col-span-2 md:col-span-1">
                                <label className="block text-[11px] font-semibold text-slate-600">Volume / Área</label>
                                <input 
                                    type="number"
                                    step="0.001"
                                    value={volume}
                                    onChange={(e) => setVolume(e.target.value)}
                                    placeholder="0.000"
                                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </form>

                {/* Rodapé / Ações */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500">
                        Campos marcados com <span className="text-rose-500 font-bold">*</span> são de preenchimento obrigatório.
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting || loadingDropdowns}
                            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Cadastrando no Protheus...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Cadastrar e Vincular no Protheus</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>

            {/* Modal de Busca de Clientes Protheus (SA1010) */}
            {showSearchCliente && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col h-[70vh] max-h-[520px] animate-in fade-in zoom-in duration-150 border border-slate-200">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50 rounded-t-xl">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">Selecionar Cliente (Protheus SA1010)</h4>
                                <p className="text-[11px] text-slate-500">Busque pelo código ou razão social do cliente (Preenchimento opcional)</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowSearchCliente(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-3 border-b border-slate-200 bg-white flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="text"
                                        value={searchCliQuery}
                                        onChange={(e) => setSearchCliQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                executarBuscaClientes(searchCliQuery);
                                            }
                                        }}
                                        placeholder="Digite nome ou código (busca instantânea)..."
                                        className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        autoFocus
                                    />
                                    {searchCliQuery && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchCliQuery('');
                                                executarBuscaClientes('');
                                            }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                            title="Limpar busca"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => executarBuscaClientes(searchCliQuery)}
                                    disabled={searchingCli}
                                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                                >
                                    {searchingCli ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                    <span>Buscar</span>
                                </button>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                                <span>Busca em tempo real no Protheus SA1010</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleClearCliente();
                                        setShowSearchCliente(false);
                                    }}
                                    className="text-amber-700 hover:text-amber-900 hover:underline font-semibold cursor-pointer"
                                >
                                    Sem Cliente (Não associar)
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-0">
                            {searchingCli ? (
                                <div className="flex items-center justify-center h-full text-xs text-slate-400 gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                    <span>Buscando no Protheus SA1010...</span>
                                </div>
                            ) : searchCliResults.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-xs text-slate-400 p-6 text-center gap-2">
                                    <AlertCircle className="w-6 h-6 text-slate-300" />
                                    <span>Nenhum cliente encontrado com <strong>"{searchCliQuery}"</strong>.</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchCliQuery('');
                                            executarBuscaClientes('');
                                        }}
                                        className="text-blue-600 hover:underline font-semibold text-xs mt-1"
                                    >
                                        Exibir clientes mais frequentes
                                    </button>
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] text-slate-500 uppercase font-bold">
                                        <tr>
                                            <th className="px-3 py-2">Código</th>
                                            <th className="px-2 py-2">Loja</th>
                                            <th className="px-3 py-2">Razão Social</th>
                                            <th className="px-2 py-2 text-center">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {searchCliResults.map((cli, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50/60 transition-colors">
                                                <td className="px-3 py-2 font-mono font-bold text-blue-900">{cli.codigo}</td>
                                                <td className="px-2 py-2 font-mono text-slate-600">{cli.loja}</td>
                                                <td className="px-3 py-2 text-slate-700 truncate max-w-[220px]" title={cli.nome}>{cli.nome}</td>
                                                <td className="px-2 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectCliente(cli)}
                                                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
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

                        {/* Rodapé com botão de dispensa */}
                        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => {
                                    handleClearCliente();
                                    setShowSearchCliente(false);
                                }}
                                className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                            >
                                Deixar em branco (Sem Cliente)
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowSearchCliente(false)}
                                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded transition-colors cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

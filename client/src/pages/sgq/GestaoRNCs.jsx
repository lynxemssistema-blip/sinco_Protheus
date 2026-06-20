import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Shield, Search, CheckCircle, AlertTriangle, Clock, Filter, Printer, FileText, Camera, X, Mail, TrendingUp, Activity, Wrench, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { getAllRncs, updateRnc, getSgqNaoConformidades, getProcessList, getFileUrl, getRncApontamentos, createRncApontamento, deleteRncApontamento } from '../../services/api';
import { generateRNCPdf, generateSingleRNCPdf } from '../../services/rncPdfGenerator';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import RNCSendEmailModal from '../../components/RNCSendEmailModal';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';

export default function GestaoRNCs() {
    const { user } = useAuth();
    const [allRncs, setAllRncs] = useState([]);
    const [activeTab, setActiveTab] = useState('lista');
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchText, setSearchText] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'data_criacao', dir: 'desc' });
    
    // Treat RNC Modal
    const [treatingRnc, setTreatingRnc] = useState(null);
    const [tratativaObs, setTratativaObs] = useState('');
    const [tratativaStatus, setTratativaStatus] = useState('CONCLUIDO');
    const [fotosTratativa, setFotosTratativa] = useState([]);
    
    // Email Send Modal State
    const [emailRncTarget, setEmailRncTarget] = useState(null);
    const [emailType, setEmailType] = useState('rnc');
    const [reposicaoSearch, setReposicaoSearch] = useState('');
    const [reposicaoStatusFilter, setReposicaoStatusFilter] = useState('');

    // Apontamentos de RNC State
    const [apontandoRnc, setApontandoRnc] = useState(null);
    const [apontamentos, setApontamentos] = useState([]);
    const [apontamentosLoading, setApontamentosLoading] = useState(false);
    const [formOperacao, setFormOperacao] = useState('');
    const [formDescricao, setFormDescricao] = useState('');
    const [formTempo, setFormTempo] = useState('');
    const [formUsuario, setFormUsuario] = useState(user?.nome || '');

    // Novas Variáveis F097 (Tratativa)
    const [w2hOQue, setW2hOQue] = useState('');
    const [w2hQuem, setW2hQuem] = useState('');
    const [w2hQuando, setW2hQuando] = useState('');
    const [w2hOnde, setW2hOnde] = useState('');
    const [w2hPorQue, setW2hPorQue] = useState('');
    const [w2hQuantidade, setW2hQuantidade] = useState('');
    const [w2hFrequencia, setW2hFrequencia] = useState('');

    const [disposicaoRetrabalho, setDisposicaoRetrabalho] = useState(false);
    const [disposicaoNovaPeca, setDisposicaoNovaPeca] = useState(false);
    
    const [eficAcoesImplementadas, setEficAcoesImplementadas] = useState('');
    const [eficCorrigiram, setEficCorrigiram] = useState('');
    const [eficReincidencia, setEficReincidencia] = useState('');
    const [eficEficazes, setEficEficazes] = useState('');
    const [eficConclusao, setEficConclusao] = useState('');

    const [naoConformidades, setNaoConformidades] = useState([]);
    const [recursos, setRecursos] = useState([]);
    
    // Edit Abertura State
    const [isEditingAbertura, setIsEditingAbertura] = useState(false);
    const [aberturaRecurso, setAberturaRecurso] = useState('');
    const [aberturaNc, setAberturaNc] = useState('');
    const [aberturaOrigem, setAberturaOrigem] = useState('');
    const [aberturaResp, setAberturaResp] = useState('');
    const [aberturaSetorEnvolvido, setAberturaSetorEnvolvido] = useState('');
    const [aberturaSetorOrigem, setAberturaSetorOrigem] = useState('');
    const [aberturaLocalDet, setAberturaLocalDet] = useState('');
    const [aberturaQtd, setAberturaQtd] = useState('');
    const [aberturaObs, setAberturaObs] = useState('');
    const [aberturaDataLimite, setAberturaDataLimite] = useState('');

    const fileInputRef = useRef(null);

    useEffect(() => {
        loadData();
        loadBaseData();
    }, []);

    const rncs = useMemo(() => {
        let list = [...allRncs];

        // Status filter
        if (statusFilter) list = list.filter(r => r.status === statusFilter);

        // Text search: ID, produto, desc_produto, op, pedido, criado_por, nc_descricao, recurso_inconformidade
        if (searchText.trim()) {
            const q = searchText.trim().toLowerCase();
            list = list.filter(r =>
                String(r.id).includes(q) ||
                (r.produto && r.produto.toLowerCase().includes(q)) ||
                (r.desc_produto && r.desc_produto.toLowerCase().includes(q)) ||
                (r.op && String(r.op).toLowerCase().includes(q)) ||
                (r.pedido && String(r.pedido).toLowerCase().includes(q)) ||
                (r.criado_por && r.criado_por.toLowerCase().includes(q)) ||
                (r.nc_descricao && r.nc_descricao.toLowerCase().includes(q)) ||
                (r.recurso_inconformidade && r.recurso_inconformidade.toLowerCase().includes(q))
            );
        }

        // Column sort
        if (sortConfig.key) {
            list.sort((a, b) => {
                let va = a[sortConfig.key];
                let vb = b[sortConfig.key];
                // Null / undefined always go last
                if (va == null && vb == null) return 0;
                if (va == null) return 1;
                if (vb == null) return -1;
                // Numeric
                if (typeof va === 'number' && typeof vb === 'number') {
                    return sortConfig.dir === 'asc' ? va - vb : vb - va;
                }
                // Date strings
                const da = Date.parse(va);
                const db = Date.parse(vb);
                if (!isNaN(da) && !isNaN(db)) {
                    return sortConfig.dir === 'asc' ? da - db : db - da;
                }
                // String
                va = String(va).toLowerCase();
                vb = String(vb).toLowerCase();
                if (va < vb) return sortConfig.dir === 'asc' ? -1 : 1;
                if (va > vb) return sortConfig.dir === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return list;
    }, [allRncs, statusFilter, searchText, sortConfig]);

    const loadBaseData = async () => {
        try {
            const [ncRes, recRes] = await Promise.all([
                getSgqNaoConformidades(),
                getProcessList()
            ]);
            setNaoConformidades(ncRes || []);
            setRecursos(Array.isArray(recRes) ? recRes : (recRes?.data || []));
        } catch (e) {
            console.error('Erro ao carregar dados base', e);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getAllRncs({});
            setAllRncs(data || []);
        } catch (error) {
            console.error('Erro ao buscar RNCs:', error);
            toast.error('Falha ao carregar lista de RNCs.');
        } finally {
            setLoading(false);
        }
    };

    const loadApontamentos = async (rncId) => {
        try {
            setApontamentosLoading(true);
            const data = await getRncApontamentos(rncId);
            setApontamentos(data || []);
        } catch (error) {
            console.error('Erro ao buscar apontamentos da RNC:', error);
            toast.error('Erro ao carregar apontamentos.');
        } finally {
            setApontamentosLoading(false);
        }
    };

    const handleAddApontamento = async (e) => {
        e.preventDefault();
        if (!formOperacao.trim()) {
            toast.warning('Informe a Operação/Recurso.');
            return;
        }
        if (!formTempo || parseInt(formTempo, 10) <= 0) {
            toast.warning('Informe um tempo válido maior que zero.');
            return;
        }
        try {
            await createRncApontamento(apontandoRnc.id, {
                operacao_recurso: formOperacao,
                descricao: formDescricao,
                tempo_minutos: parseInt(formTempo, 10),
                usuario: formUsuario || user?.nome || 'Operador'
            });
            toast.success('Apontamento registrado com sucesso.');
            setFormOperacao('');
            setFormDescricao('');
            setFormTempo('');
            loadApontamentos(apontandoRnc.id);
            loadData();
        } catch (error) {
            console.error('Erro ao salvar apontamento:', error);
            toast.error('Falha ao registrar apontamento.');
        }
    };

    const getQtdNaoConforme = (rnc) => {
        if (!rnc.f097_dados) return 1;
        try {
            let parsed = JSON.parse(rnc.f097_dados);
            if (typeof parsed === 'string') {
                parsed = JSON.parse(parsed);
            }
            return parsed?.registro?.qtd_nao_conforme || 1;
        } catch (e) {
            return 1;
        }
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        } catch (e) {
            return dateStr;
        }
    };

    const getReposicaoStatusBadge = (rnc) => {
        let hasNovaPecaDisposicao = false;
        if (rnc.f097_dados) {
            try {
                let parsed = JSON.parse(rnc.f097_dados);
                if (typeof parsed === 'string') {
                    parsed = JSON.parse(parsed);
                }
                hasNovaPecaDisposicao = !!parsed?.tratativa?.disposicao_nova_peca;
            } catch (e) {}
        }

        if (rnc.reposicao_liberada) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                    <CheckCircle className="w-3 h-3" /> Liberada
                </span>
            );
        }

        if (rnc.reposicao_solicitada) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3 h-3" /> Solicitada
                </span>
            );
        }

        if (hasNovaPecaDisposicao) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertTriangle className="w-3 h-3" /> Pendente
                </span>
            );
        }

        return <span className="text-slate-400 text-xs">-</span>;
    };

    const handleReleaseReposicao = async (rnc) => {
        const reposicaoOp = window.prompt(`Informe o número da OP referente à fabricação da peça para a RNC #${rnc.id}:`);
        if (reposicaoOp === null) return; // Se o usuário cancelar
        const opFinal = reposicaoOp.trim();
        if (!opFinal) {
            toast.warning("O número da OP é obrigatório para liberar a fabricação da peça.");
            return;
        }

        try {
            const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const userName = user?.nome || user?.NomeCompleto || user?.username || 'Sistema';

            await updateRnc(rnc.id, {
                reposicao_liberada: 1,
                reposicao_data_liberacao: nowStr,
                reposicao_usuario_liberou: userName,
                reposicao_op: opFinal
            });

            toast.success(`Peça de reposição para RNC #${rnc.id} liberada com sucesso com a OP ${opFinal}!`);
            loadData();
        } catch (err) {
            console.error('Erro ao liberar peça de reposição:', err);
            toast.error('Falha ao liberar a peça para fabricação.');
        }
    };

    const handleDeleteApontamento = async (id) => {
        if (!window.confirm('Deseja realmente excluir este apontamento?')) return;
        try {
            await deleteRncApontamento(id);
            toast.success('Apontamento excluído com sucesso.');
            loadApontamentos(apontandoRnc.id);
            loadData();
        } catch (error) {
            console.error('Erro ao excluir apontamento:', error);
            toast.error('Erro ao excluir apontamento.');
        }
    };

    const handleSaveTratativa = async () => {
        try {
            const userName = user?.nome || user?.login || 'Sistema';
            const dataAgora = new Date().toLocaleString('pt-BR');
            const novaAnotacao = tratativaObs.trim() ? `[${dataAgora} por ${userName}]: ${tratativaObs}` : '';
            
            const historicoAtual = treatingRnc.tratativa_resposta ? treatingRnc.tratativa_resposta + (novaAnotacao ? '\n\n' : '') : '';
            const novoHistorico = historicoAtual + novaAnotacao;

            let existingF097 = {};
            if (treatingRnc.f097_dados) {
                try {
                    let parsed = JSON.parse(treatingRnc.f097_dados);
                    if (typeof parsed === 'string') {
                        parsed = JSON.parse(parsed);
                    }
                    if (parsed && typeof parsed === 'object') {
                        existingF097 = parsed;
                    }
                } catch(e) {}
            }

            const f097Updated = {
                ...existingF097,
                registro: {
                    ...(existingF097.registro || {}),
                    origem: aberturaOrigem,
                    responsavel_qualidade: aberturaResp,
                    local_deteccao: aberturaLocalDet,
                    setor_envolvido: aberturaSetorEnvolvido,
                    setor_origem: aberturaSetorOrigem,
                    qtd_nao_conforme: aberturaQtd
                },
                tratativa: {
                    w2h_o_que: w2hOQue,
                    w2h_quem: w2hQuem,
                    w2h_quando: w2hQuando,
                    w2h_onde: w2hOnde,
                    w2h_por_que: w2hPorQue,
                    w2h_quantidade: w2hQuantidade,
                    w2h_frequencia: w2hFrequencia,
                    disposicao_retrabalho: disposicaoRetrabalho,
                    disposicao_nova_peca: disposicaoNovaPeca,
                    efic_acoes_implementadas: eficAcoesImplementadas,
                    efic_corrigiram: eficCorrigiram,
                    efic_reincidencia: eficReincidencia,
                    efic_eficazes: eficEficazes,
                    efic_conclusao: eficConclusao
                }
            };

            await updateRnc(treatingRnc.id, {
                status: tratativaStatus,
                tratativa_resposta: novoHistorico,
                tratado_por: userName,
                fotos_tratativa: fotosTratativa.length > 0 ? fotosTratativa : undefined,
                f097_dados: JSON.stringify(f097Updated),
                recurso_inconformidade: aberturaRecurso,
                nao_conformidade_id: aberturaNc,
                observacao: aberturaObs,
                data_limite: aberturaDataLimite || null
            });
            toast.success('RNC atualizada com sucesso!');
            setTreatingRnc(null);
            setIsEditingAbertura(false);
            setTratativaObs('');
            setFotosTratativa([]);
            loadData();
        } catch (error) {
            console.error('Erro ao atualizar RNC:', error);
            toast.error('Falha ao salvar tratativa.');
        }
    };

    const handlePhotoUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFotosTratativa(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeFoto = (indexToRemove) => {
        setFotosTratativa(prev => prev.filter((_, i) => i !== indexToRemove));
    };

    const handlePrint = () => {
        if (rncs.length === 0) {
            toast.warning('Não há dados para gerar o relatório.');
            return;
        }
        generateRNCPdf(rncs, { status: statusFilter }, user);
    };

    // --- KPI & CHART DATA CALCULATIONS ---
    const totalRncs = allRncs.length;
    const rncsAbertas = allRncs.filter(r => r.status === 'ABERTO').length;
    const rncsAndamento = allRncs.filter(r => r.status === 'EM ANDAMENTO').length;
    const rncsConcluidas = allRncs.filter(r => r.status === 'CONCLUIDO').length;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const rncsAtrasadas = allRncs.filter(r => {
        if (r.status === 'CONCLUIDO' || !r.data_limite) return false;
        const limite = new Date(r.data_limite);
        return limite < hoje;
    }).length;

    const taxaConclusao = totalRncs > 0 ? ((rncsConcluidas / totalRncs) * 100).toFixed(1) : 0;

    // Pareto de Defeitos (Top 8)
    const defectCounts = {};
    allRncs.forEach(r => {
        const desc = r.nc_descricao || 'Outro / Não Definido';
        defectCounts[desc] = (defectCounts[desc] || 0) + 1;
    });
    const defectsData = Object.entries(defectCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    // Ocorrências por Recurso (Top 8)
    const recursoCounts = {};
    allRncs.forEach(r => {
        const rec = r.recurso_inconformidade || 'Não Definido';
        recursoCounts[rec] = (recursoCounts[rec] || 0) + 1;
    });
    const recursosData = Object.entries(recursoCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    // Evolução Mensal (Últimos 12 meses)
    const monthlyCounts = {};
    allRncs.forEach(r => {
        if (!r.data_criacao) return;
        const d = new Date(r.data_criacao);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    });
    const trendData = Object.keys(monthlyCounts)
        .sort()
        .map(key => {
            const [year, month] = key.split('-');
            const monthsName = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const label = `${monthsName[parseInt(month) - 1]}/${year.substring(2)}`;
            return {
                key,
                label,
                quantidade: monthlyCounts[key]
            };
        })
        .slice(-12);

    // Distribuição por Gravidade (Pie Chart)
    const severityCounts = {};
    allRncs.forEach(r => {
        const sev = r.nc_gravidade || 'Não Definida';
        severityCounts[sev] = (severityCounts[sev] || 0) + 1;
    });
    const severityData = Object.entries(severityCounts)
        .map(([name, value]) => ({ name, value }));

    const getSeverityColor = (severity) => {
        const s = String(severity).toLowerCase();
        if (s.includes('crít') || s.includes('crit')) return '#ef4444'; // Vermelho
        if (s.includes('grav')) return '#f97316'; // Laranja
        if (s.includes('mod')) return '#eab308'; // Amarelo
        if (s.includes('lev')) return '#3b82f6'; // Azul
        return '#64748b'; // Slate
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900/95 text-white p-3 rounded-lg border border-slate-700 shadow-2xl text-xs font-semibold backdrop-blur-sm">
                    <p className="mb-1 font-bold text-slate-300">{label}</p>
                    {payload.map((pld, index) => (
                        <p key={index} style={{ color: pld.color || '#a5b4fc' }}>
                            {pld.name === 'quantidade' ? 'Quantidade' : pld.name}: {pld.value} RNC(s)
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const handleSort = (key) => {
        setSortConfig(prev =>
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: 'asc' }
        );
    };

    const SortableHeader = ({ label, colKey, className = '' }) => {
        const isActive = sortConfig.key === colKey;
        return (
            <th
                className={`px-4 py-3 font-semibold cursor-pointer select-none hover:bg-slate-100 transition-colors group ${className}`}
                onClick={() => handleSort(colKey)}
            >
                <span className="flex items-center gap-1">
                    {label}
                    <span className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'}`}>
                        {isActive
                            ? (sortConfig.dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)
                            : <ChevronsUpDown className="w-3.5 h-3.5" />}
                    </span>
                </span>
            </th>
        );
    };

    const getStatusBadge = (status) => {
        if (status === 'CONCLUIDO') return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1 w-max"><CheckCircle className="w-3 h-3"/> CONCLUÍDO</span>;
        if (status === 'EM ANDAMENTO') return <span className="px-2 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold flex items-center gap-1 w-max"><Clock className="w-3 h-3"/> EM ANDAMENTO</span>;
        return <span className="px-2 py-1 bg-rose-100 text-rose-800 border border-rose-200 rounded-full text-[10px] font-bold flex items-center gap-1 w-max"><AlertTriangle className="w-3 h-3"/> ABERTO</span>;
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Shield className="w-7 h-7 text-indigo-600" />
                        Gestão Global de RNCs
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">Controle e acompanhamento de Não-Conformidades da produção.</p>
                </div>
            </div>

            {/* Tabs Header */}
            <div className="flex border-b border-slate-200 mt-2">
                <button
                    onClick={() => setActiveTab('lista')}
                    className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'lista'
                            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-lg'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    Lista de RNCs
                </button>
                <button
                    onClick={() => setActiveTab('kpis')}
                    className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'kpis'
                            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-lg'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Activity className="w-4 h-4 text-emerald-600" />
                    Painel de KPIs & Gráficos
                </button>
                <button
                    onClick={() => setActiveTab('reposicoes')}
                    className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'reposicoes'
                            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-lg'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Wrench className="w-4 h-4 text-rose-600" />
                    Peças Solicitadas
                </button>
            </div>

            {activeTab === 'lista' && (
                <>
                    <div className="bg-white rounded-lg shadow-sm border p-4 flex flex-wrap gap-3 items-center">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar por ID, OP, Produto, NC, Recurso..."
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                className="w-full pl-9 pr-9 py-2 border rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-shadow"
                            />
                            {searchText && (
                                <button
                                    onClick={() => setSearchText('')}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {/* Status filter */}
                        <div className="flex items-center gap-2 font-medium text-sm text-slate-600">
                            <Filter className="w-4 h-4" />
                        </div>
                        <select
                            className="border rounded px-3 py-2 text-sm outline-none focus:border-indigo-500"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">Todos os Status</option>
                            <option value="ABERTO">Abertas</option>
                            <option value="EM ANDAMENTO">Em Andamento</option>
                            <option value="CONCLUIDO">Concluídas</option>
                        </select>
                        {/* Result count */}
                        <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-1.5 rounded-lg">
                            {rncs.length} resultado{rncs.length !== 1 ? 's' : ''}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                            <button onClick={handlePrint} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded text-sm font-bold border border-slate-200 hover:bg-slate-200 transition-colors flex items-center gap-1">
                                <Printer className="w-4 h-4" />
                                Imprimir PDF
                            </button>
                            <button onClick={loadData} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-sm font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors">
                                Atualizar Lista
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-slate-500 font-medium animate-pulse">Carregando RNCs...</div>
                    ) : rncs.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-sm border p-10 text-center text-slate-500">
                            Nenhuma RNC encontrada para este filtro.
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 border-b text-xs">
                                    <tr>
                                        <SortableHeader label="ID" colKey="id" />
                                        <SortableHeader label="Status" colKey="status" />
                                        <th className="px-4 py-3 font-semibold">Reposição</th>
                                        <SortableHeader label="Produto" colKey="produto" />
                                        <SortableHeader label="OP" colKey="op" />
                                        <SortableHeader label="Problema / Máquina" colKey="nc_descricao" />
                                        <SortableHeader label="Criado Por" colKey="criado_por" />
                                        <SortableHeader label="Prazo" colKey="data_limite" />
                                        <SortableHeader label="Tempo" colKey="tempo_gasto_total" />
                                        <th className="px-4 py-3 font-semibold text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rncs.map(rnc => (
                                        <tr key={rnc.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-mono font-bold text-slate-400">#{rnc.id}</td>
                                            <td className="px-4 py-3">{getStatusBadge(rnc.status)}</td>
                                            <td className="px-4 py-3">{getReposicaoStatusBadge(rnc)}</td>
                                            <td className="px-4 py-3 max-w-[220px]">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-slate-800 text-xs truncate" title={rnc.produto}>{rnc.produto}</div>
                                                        <div className="text-[10px] text-slate-500 truncate mt-0.5" title={rnc.desc_produto}>{rnc.desc_produto}</div>
                                                    </div>
                                                    {rnc.tem_arquivos ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (rnc.primeiro_arquivo) {
                                                                    const viewUrl = getFileUrl(`/api/docs/view?path=${encodeURIComponent(rnc.primeiro_arquivo)}`);
                                                                    window.open(viewUrl, '_blank');
                                                                }
                                                            }}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg flex-shrink-0 transition-colors flex items-center justify-center"
                                                            title="Ver Desenho / PDF"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <div className="text-slate-300 p-1.5 flex-shrink-0" title="Sem desenho anexado">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-800 text-xs">OP: {rnc.op}-{rnc.item_op} ({rnc.sequen_op})</div>
                                                <div className="text-[10px] text-slate-500">PV: {rnc.pedido || 'N/A'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-700 text-xs flex items-center gap-1">
                                                    {rnc.nc_descricao || 'Outro / Não Listado'}
                                                    {rnc.imagem_evidencia && (
                                                        <button onClick={() => window.open(rnc.imagem_evidencia)} className="text-blue-500 hover:text-blue-700 p-0.5 bg-blue-50 rounded border border-blue-200 ml-1" title="Ver Foto">
                                                            <FileText className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">Recurso: {rnc.recurso_inconformidade}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs font-semibold text-slate-600">{rnc.criado_por}</div>
                                                <div className="text-[10px] text-slate-400">{new Date(rnc.data_criacao).toLocaleDateString('pt-BR')}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs font-semibold text-indigo-700">
                                                    {rnc.data_limite ? new Date(rnc.data_limite).toLocaleDateString('pt-BR') : 'Não Definido'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                                                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                                    {rnc.tempo_gasto_total || 0} min
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setApontandoRnc(rnc);
                                                            setFormOperacao('');
                                                            setFormDescricao('');
                                                            setFormTempo('');
                                                            setFormUsuario(user?.nome || '');
                                                            loadApontamentos(rnc.id);
                                                        }}
                                                        className="p-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                                                        title="Apontar Tempo / Produção"
                                                    >
                                                        <Clock className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setTreatingRnc(rnc);
                                                            setTratativaStatus(rnc.status === 'ABERTO' ? 'EM ANDAMENTO' : rnc.status);
                                                            setTratativaObs('');
                                                            setFotosTratativa([]);
                                                            // Load Edit Abertura
                                                            setAberturaRecurso(rnc.recurso_inconformidade || '');
                                                            setAberturaNc(rnc.nao_conformidade_id || '');
                                                            setAberturaObs(rnc.observacao || '');
                                                            setAberturaDataLimite(rnc.data_limite ? rnc.data_limite.split('T')[0] : '');
                                                            
                                                            if (rnc.f097_dados) {
                                                                try {
                                                                    let parsed = JSON.parse(rnc.f097_dados);
                                                                    if (typeof parsed === 'string') {
                                                                        parsed = JSON.parse(parsed);
                                                                    }
                                                                    const fData = parsed && typeof parsed === 'object' ? parsed : {};
                                                                    const tData = fData.tratativa || {};
                                                                    const rData = fData.registro || {};
                                                                    setW2hOQue(tData.w2h_o_que || '');
                                                                    setW2hQuem(tData.w2h_quem || '');
                                                                    setW2hQuando(tData.w2h_quando || '');
                                                                    setW2hOnde(tData.w2h_onde || '');
                                                                    setW2hPorQue(tData.w2h_por_que || '');
                                                                    setW2hQuantidade(tData.w2h_quantidade || '');
                                                                    setW2hFrequencia(tData.w2h_frequencia || '');
                                                                    setDisposicaoRetrabalho(!!tData.disposicao_retrabalho);
                                                                    setDisposicaoNovaPeca(!!tData.disposicao_nova_peca);
                                                                    setEficAcoesImplementadas(tData.efic_acoes_implementadas || '');
                                                                    setEficCorrigiram(tData.efic_corrigiram || '');
                                                                    setEficReincidencia(tData.efic_reincidencia || '');
                                                                    setEficEficazes(tData.efic_eficazes || '');
                                                                    setEficConclusao(tData.efic_conclusao || '');

                                                                    setAberturaOrigem(rData.origem || '');
                                                                    setAberturaResp(rData.responsavel_qualidade || '');
                                                                    setAberturaLocalDet(rData.local_deteccao || '');
                                                                    setAberturaSetorEnvolvido(rData.setor_envolvido || '');
                                                                    setAberturaSetorOrigem(rData.setor_origem || '');
                                                                    setAberturaQtd(rData.qtd_nao_conforme || '');
                                                                } catch(e) {
                                                                    console.error('Erro ao ler f097_dados', e);
                                                                }
                                                            } else {
                                                                setW2hOQue(''); setW2hQuem(''); setW2hQuando(''); setW2hOnde('');
                                                                setW2hPorQue(''); setW2hQuantidade(''); setW2hFrequencia('');
                                                                setDisposicaoRetrabalho(false); setDisposicaoNovaPeca(false);
                                                                setEficAcoesImplementadas(''); setEficCorrigiram(''); setEficReincidencia('');
                                                                setEficEficazes(''); setEficConclusao('');
                                                                
                                                                setAberturaOrigem(''); setAberturaResp(''); setAberturaLocalDet('');
                                                                setAberturaSetorEnvolvido(''); setAberturaSetorOrigem(''); setAberturaQtd('');
                                                            }
                                                        }}
                                                        className="text-[10px] font-bold px-3 py-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                                                    >
                                                        {rnc.status === 'CONCLUIDO' ? 'VER DETALHES' : 'TRATAR RNC'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEmailType('rnc');
                                                            setEmailRncTarget(rnc);
                                                        }}
                                                        className="p-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                                                        title="Enviar RNC por E-mail"
                                                    >
                                                        <Mail className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'kpis' && (
                <div className="space-y-6 animate-fadeIn">
                    {/* Top Row: Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Total Card */}
                        <div className="bg-slate-900 text-white rounded-xl shadow-lg p-5 border border-slate-800 transition-all hover:scale-[1.02] duration-200 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <FileText className="w-16 h-16 text-indigo-400" />
                            </div>
                            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Total de RNCs</span>
                            <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-3xl font-extrabold tracking-tight">{totalRncs}</span>
                                <span className="text-xs text-indigo-300 font-semibold">registradas</span>
                            </div>
                        </div>

                        {/* Abertas Card */}
                        <div className="bg-white rounded-xl shadow-sm p-5 border border-rose-200 hover:border-rose-300 hover:shadow-md transition-all hover:scale-[1.02] duration-200 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <AlertTriangle className="w-16 h-16 text-rose-500" />
                            </div>
                            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">Abertas</span>
                            <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-3xl font-extrabold tracking-tight text-rose-600">{rncsAbertas}</span>
                                <span className="text-xs text-slate-500 font-semibold">pendentes</span>
                            </div>
                        </div>

                        {/* Em Andamento Card */}
                        <div className="bg-white rounded-xl shadow-sm p-5 border border-amber-200 hover:border-amber-300 hover:shadow-md transition-all hover:scale-[1.02] duration-200 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Clock className="w-16 h-16 text-amber-500" />
                            </div>
                            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Em Andamento</span>
                            <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-3xl font-extrabold tracking-tight text-amber-600">{rncsAndamento}</span>
                                <span className="text-xs text-slate-500 font-semibold">sob análise</span>
                            </div>
                        </div>

                        {/* Concluídas Card */}
                        <div className="bg-white rounded-xl shadow-sm p-5 border border-emerald-200 hover:border-emerald-300 hover:shadow-md transition-all hover:scale-[1.02] duration-200 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <CheckCircle className="w-16 h-16 text-emerald-500" />
                            </div>
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Concluídas</span>
                            <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-3xl font-extrabold tracking-tight text-emerald-600">{rncsConcluidas}</span>
                                <span className="text-xs text-emerald-600/80 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">{taxaConclusao}% efic.</span>
                            </div>
                        </div>

                        {/* Atrasadas Card */}
                        <div className={`rounded-xl shadow-sm p-5 border transition-all hover:scale-[1.02] duration-200 relative overflow-hidden flex flex-col justify-between min-h-[110px] ${
                            rncsAtrasadas > 0 
                                ? 'bg-red-50/80 border-red-200 hover:border-red-300 animate-pulse' 
                                : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}>
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <AlertTriangle className="w-16 h-16 text-red-600" />
                            </div>
                            <span className={`text-xs font-bold uppercase tracking-wider ${rncsAtrasadas > 0 ? 'text-red-600 font-extrabold' : 'text-slate-500'}`}>Prazo Excedido</span>
                            <div className="flex items-baseline gap-2 mt-2">
                                <span className={`text-3xl font-extrabold tracking-tight ${rncsAtrasadas > 0 ? 'text-red-600' : 'text-slate-700'}`}>{rncsAtrasadas}</span>
                                <span className={`text-xs font-semibold ${rncsAtrasadas > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                    {rncsAtrasadas > 0 ? 'ATENÇÃO!' : 'em dia'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Chart Row 1: Defects & Resources */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Pareto Defects Bar Chart */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
                            <div className="flex items-center justify-between mb-4 border-b pb-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Top 8 Defeitos Recorrentes</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Distribuição das não-conformidades por categoria/tipo</p>
                                </div>
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Pareto</span>
                            </div>
                            <div className="h-[280px] w-full">
                                {defectsData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={defectsData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                            <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={130} tickLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]}>
                                                {defectsData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#b91c1c' : index < 3 ? '#ef4444' : '#f87171'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 text-xs">Sem dados suficientes</div>
                                )}
                            </div>
                        </div>

                        {/* Machine/Recurso Occurrences Chart */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
                            <div className="flex items-center justify-between mb-4 border-b pb-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">RNCs por Recurso / Setor</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Identificação de focos críticos na linha produtiva</p>
                                </div>
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Recursos</span>
                            </div>
                            <div className="h-[280px] w-full">
                                {recursosData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={recursosData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                                                {recursosData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#312e81' : index < 3 ? '#4f46e5' : '#818cf8'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 text-xs">Sem dados suficientes</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Chart Row 2: Trend & Severity */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Monthly Trend Area Chart */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col lg:col-span-2">
                            <div className="flex items-center justify-between mb-4 border-b pb-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Histórico Mensal de Aberturas</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Evolução do volume de não-conformidades nos últimos 12 meses</p>
                                </div>
                                <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                    <TrendingUp className="w-3 h-3" /> Tendência
                                </div>
                            </div>
                            <div className="h-[250px] w-full">
                                {trendData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorQuant" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area type="monotone" dataKey="quantidade" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorQuant)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 text-xs">Sem dados suficientes</div>
                                )}
                            </div>
                        </div>

                        {/* Severity Distribution Pie Chart */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
                            <div className="flex items-center justify-between mb-4 border-b pb-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Distribuição por Severidade</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Divisão das falhas por nível de gravidade</p>
                                </div>
                            </div>
                            <div className="h-[200px] w-full relative flex items-center justify-center">
                                {severityData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={severityData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={4}
                                                dataKey="value"
                                            >
                                                {severityData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={getSeverityColor(entry.name)} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400 text-xs">Sem dados suficientes</div>
                                )}
                            </div>
                            {/* Legends */}
                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t text-[11px] font-medium text-slate-600">
                                {severityData.map((entry, index) => (
                                    <div key={index} className="flex items-center gap-1.5 truncate" title={`${entry.name}: ${entry.value}`}>
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getSeverityColor(entry.name) }} />
                                        <span className="truncate">{entry.name}</span>
                                        <span className="text-slate-400 font-bold ml-auto">({entry.value})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Peças Solicitadas Tab */}
            {activeTab === 'reposicoes' && (
                <div className="space-y-4 animate-fadeIn">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white border rounded-xl shadow-sm p-4 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Solicitado</span>
                                <h3 className="text-2xl font-bold text-slate-800 mt-1">
                                    {allRncs.filter(r => r.reposicao_solicitada === 1).length}
                                </h3>
                            </div>
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Wrench className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="bg-white border rounded-xl shadow-sm p-4 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aguardando Liberação</span>
                                <h3 className="text-2xl font-bold text-rose-600 mt-1">
                                    {allRncs.filter(r => r.reposicao_solicitada === 1 && !r.reposicao_liberada).length}
                                </h3>
                            </div>
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                                <Clock className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="bg-white border rounded-xl shadow-sm p-4 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Liberado p/ Produção</span>
                                <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                                    {allRncs.filter(r => r.reposicao_solicitada === 1 && r.reposicao_liberada === 1).length}
                                </h3>
                            </div>
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white rounded-lg shadow-sm border p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
                        <div className="flex flex-1 w-full md:w-auto gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por ID, Código ou Descrição do Produto..."
                                    value={reposicaoSearch}
                                    onChange={(e) => setReposicaoSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:border-indigo-500"
                                />
                            </div>
                            <select
                                value={reposicaoStatusFilter}
                                onChange={(e) => setReposicaoStatusFilter(e.target.value)}
                                className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
                            >
                                <option value="">Todos os Status</option>
                                <option value="pendente">Aguardando Liberação</option>
                                <option value="liberada">Liberado para Fabricação</option>
                            </select>
                        </div>
                    </div>

                    {/* Table / List */}
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        {(() => {
                            const filtered = allRncs
                                .filter(r => r.reposicao_solicitada === 1)
                                .filter(r => {
                                    // Search filter
                                    const searchLower = reposicaoSearch.toLowerCase();
                                    const matchesSearch = 
                                        String(r.id).includes(searchLower) ||
                                        (r.produto && r.produto.toLowerCase().includes(searchLower)) ||
                                        (r.desc_produto && r.desc_produto.toLowerCase().includes(searchLower)) ||
                                        (r.op && r.op.toLowerCase().includes(searchLower));
                                    
                                    // Status filter
                                    if (reposicaoStatusFilter === 'pendente') {
                                        return matchesSearch && !r.reposicao_liberada;
                                    }
                                    if (reposicaoStatusFilter === 'liberada') {
                                        return matchesSearch && r.reposicao_liberada === 1;
                                    }
                                    return matchesSearch;
                                });

                            if (filtered.length === 0) {
                                return (
                                    <div className="p-8 text-center flex flex-col items-center justify-center">
                                        <Wrench className="w-12 h-12 text-slate-300 mb-3" />
                                        <h3 className="text-sm font-bold text-slate-700">Nenhuma solicitação encontrada</h3>
                                        <p className="text-xs text-slate-500 mt-1">Nenhuma peça de reposição atende aos filtros definidos.</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-slate-700">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600 uppercase">
                                                <th className="px-4 py-3">RNC ID</th>
                                                <th className="px-4 py-3">Desenho</th>
                                                <th className="px-4 py-3">Produto</th>
                                                <th className="px-4 py-3">OP / PV</th>
                                                <th className="px-4 py-3">Quantidade</th>
                                                <th className="px-4 py-3">Solicitado Em</th>
                                                <th className="px-4 py-3">Status da Liberação</th>
                                                <th className="px-4 py-3 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs">
                                            {filtered.map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <span className="font-bold text-slate-800">#{r.id}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {r.tem_arquivos ? (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (r.primeiro_arquivo) {
                                                                        const viewUrl = getFileUrl(`/api/docs/view?path=${encodeURIComponent(r.primeiro_arquivo)}`);
                                                                        window.open(viewUrl, '_blank');
                                                                    }
                                                                }}
                                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg flex-shrink-0 transition-colors flex items-center justify-center"
                                                                title="Ver Desenho / PDF"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                            </button>
                                                        ) : (
                                                            <div className="text-slate-300 p-1.5 flex-shrink-0" title="Sem desenho anexado">
                                                                <FileText className="w-4 h-4" />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-mono font-semibold text-slate-800">{r.produto}</div>
                                                        <div className="text-[10px] text-slate-500 line-clamp-1">{r.desc_produto}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-slate-800">OP: {r.op}-{r.item_op}</div>
                                                        <div className="text-[10px] text-slate-400">Pedido/PV: {r.pedido || 'N/A'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-slate-800">
                                                        {getQtdNaoConforme(r)} un
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">
                                                        {formatDateTime(r.reposicao_data_solicitacao)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {r.reposicao_liberada === 1 ? (
                                                            <div>
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <CheckCircle className="w-3 h-3" /> Liberada
                                                                </span>
                                                                <div className="text-[9px] text-slate-500 mt-1">
                                                                    Por: <strong className="text-slate-600">{r.reposicao_usuario_liberou}</strong> em {formatDateTime(r.reposicao_data_liberacao)}
                                                                </div>
                                                                {r.reposicao_op && (
                                                                    <div className="text-[9px] font-bold text-indigo-600 mt-1 bg-indigo-50 px-1.5 py-0.5 rounded inline-block border border-indigo-100">
                                                                        OP Gerada: {r.reposicao_op}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                                                <Clock className="w-3 h-3" /> Aguardando Liberação
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setTreatingRnc(r);
                                                                    setTratativaStatus(r.status === 'ABERTO' ? 'EM ANDAMENTO' : r.status);
                                                                    setTratativaObs('');
                                                                    setFotosTratativa([]);
                                                                    setAberturaRecurso(r.recurso_inconformidade || '');
                                                                    setAberturaNc(r.nao_conformidade_id || '');
                                                                    setAberturaObs(r.observacao || '');
                                                                    setAberturaDataLimite(r.data_limite ? r.data_limite.split('T')[0] : '');
                                                                    
                                                                    if (r.f097_dados) {
                                                                        try {
                                                                            let parsed = JSON.parse(r.f097_dados);
                                                                            if (typeof parsed === 'string') {
                                                                                parsed = JSON.parse(parsed);
                                                                            }
                                                                            const fData = parsed && typeof parsed === 'object' ? parsed : {};
                                                                            const tData = fData.tratativa || {};
                                                                            const rData = fData.registro || {};
                                                                            setW2hOQue(tData.w2h_o_que || '');
                                                                            setW2hQuem(tData.w2h_quem || '');
                                                                            setW2hQuando(tData.w2h_quando || '');
                                                                            setW2hOnde(tData.w2h_onde || '');
                                                                            setW2hPorQue(tData.w2h_por_que || '');
                                                                            setW2hQuantidade(tData.w2h_quantidade || '');
                                                                            setW2hFrequencia(tData.w2h_frequencia || '');
                                                                            setDisposicaoRetrabalho(!!tData.disposicao_retrabalho);
                                                                            setDisposicaoNovaPeca(!!tData.disposicao_nova_peca);
                                                                            setEficAcoesImplementadas(tData.efic_acoes_implementadas || '');
                                                                            setEficCorrigiram(tData.efic_corrigiram || '');
                                                                            setEficReincidencia(tData.efic_reincidencia || '');
                                                                            setEficEficazes(tData.efic_eficazes || '');
                                                                            setEficConclusao(tData.efic_conclusao || '');
                                                                            setAberturaOrigem(rData.origem || '');
                                                                            setAberturaResp(rData.responsavel_qualidade || '');
                                                                            setAberturaLocalDet(rData.local_deteccao || '');
                                                                            setAberturaSetorEnvolvido(rData.setor_envolvido || '');
                                                                            setAberturaSetorOrigem(rData.setor_origem || '');
                                                                            setAberturaQtd(rData.qtd_nao_conforme || '');
                                                                        } catch (e) {}
                                                                    }
                                                                }}
                                                                className="px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-bold transition-colors"
                                                                title="Ver detalhes da RNC"
                                                            >
                                                                Detalhes RNC
                                                            </button>
                                                            {r.reposicao_liberada !== 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleReleaseReposicao(r)}
                                                                    className="px-2.5 py-1.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold transition-colors"
                                                                >
                                                                    Liberar Fabricação
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Modal de Tratativa */}
            {treatingRnc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b bg-slate-800 text-white">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Shield className="w-5 h-5 text-indigo-400" />
                                Tratativa de RNC #{treatingRnc.id}
                            </h2>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => generateSingleRNCPdf(treatingRnc)}
                                    className="text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded flex items-center gap-1 transition-colors"
                                    title="Baixar F 097-22 em PDF"
                                >
                                    <Printer className="w-4 h-4" />
                                    PDF F097
                                </button>
                                <button onClick={() => setTreatingRnc(null)} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                            
                            {/* Resumo da RNC */}
                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="grid grid-cols-2 gap-2 flex-1">
                                        <div><span className="text-slate-500">OP:</span> <strong>{treatingRnc.op}-{treatingRnc.item_op}</strong></div>
                                        <div><span className="text-slate-500">Pedido:</span> <strong>{treatingRnc.pedido}</strong></div>
                                        <div className="col-span-2"><span className="text-slate-500">Produto:</span> <strong>{treatingRnc.produto}</strong></div>
                                        <div className="col-span-2"><span className="text-slate-500">Defeito:</span> <strong className="text-red-600">{treatingRnc.nc_descricao}</strong></div>
                                        <div className="col-span-2"><span className="text-slate-500">Recurso:</span> <strong>{treatingRnc.recurso_inconformidade}</strong></div>
                                        <div className="col-span-2"><span className="text-slate-500">Prazo Planejado (Data Limite):</span> <strong className="text-indigo-700">{treatingRnc.data_limite ? new Date(treatingRnc.data_limite).toLocaleDateString('pt-BR') : 'Não Definido'}</strong></div>
                                    </div>
                                    {treatingRnc.status !== 'CONCLUIDO' && (
                                        <button 
                                            onClick={() => setIsEditingAbertura(!isEditingAbertura)}
                                            className="text-xs font-bold px-2 py-1 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded"
                                        >
                                            {isEditingAbertura ? 'Cancelar Edição' : 'Editar Abertura'}
                                        </button>
                                    )}
                                </div>
                                
                                {isEditingAbertura ? (
                                    <div className="bg-white border rounded p-3 mt-3 shadow-inner grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Origem</label>
                                            <select value={aberturaOrigem} onChange={e => setAberturaOrigem(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-slate-50">
                                                <option value="">Selecione...</option><option value="Interna">Interna</option><option value="Fornecedor">Fornecedor</option><option value="Cliente">Cliente</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Resp. Qualidade</label>
                                            <input type="text" value={aberturaResp} onChange={e => setAberturaResp(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Setor Envolvido (Recurso)</label>
                                            <select value={aberturaRecurso} onChange={e => {
                                                setAberturaRecurso(e.target.value);
                                                setAberturaSetorEnvolvido(e.target.value);
                                                setAberturaNc('');
                                            }} className="w-full border rounded p-1.5 text-xs bg-slate-50">
                                                <option value="">-- Selecione o Setor --</option>
                                                {recursos.map(r => <option key={r.codigo} value={r.codigo}>{r.codigo} {r.descricao ? `- ${r.descricao}` : ''}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Problema Encontrado</label>
                                            <select value={aberturaNc} onChange={e => setAberturaNc(e.target.value)} disabled={!aberturaRecurso} className="w-full border rounded p-1.5 text-xs bg-slate-50">
                                                <option value="">{aberturaRecurso ? "-- Selecione o Defeito --" : "-- Selecione o Setor Primeiro --"}</option>
                                                {naoConformidades.filter(nc => !aberturaRecurso || nc.recurso_codigo === aberturaRecurso).map(nc => (
                                                    <option key={nc.id} value={nc.id}>{nc.descricao} ({nc.gravidade})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Local de Detecção</label>
                                            <input type="text" value={aberturaLocalDet} onChange={e => setAberturaLocalDet(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Setor de Origem</label>
                                            <input type="text" value={aberturaSetorOrigem} onChange={e => setAberturaSetorOrigem(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Qtd Não Conforme</label>
                                            <input type="number" value={aberturaQtd} onChange={e => setAberturaQtd(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Data Limite de Resolução</label>
                                            <input type="date" value={aberturaDataLimite} onChange={e => setAberturaDataLimite(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-slate-50" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Descrição da Falha</label>
                                            <textarea value={aberturaObs} onChange={e => setAberturaObs(e.target.value)} rows="2" className="w-full border rounded p-1.5 text-xs bg-slate-50" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {treatingRnc.observacao && (
                                            <div className="mt-2 text-xs italic bg-white p-2 rounded border border-slate-100">
                                                " {treatingRnc.observacao} "
                                            </div>
                                        )}
                                        {treatingRnc.imagem_evidencia && (
                                            <div className="mt-3">
                                                <span className="text-xs font-bold text-slate-500 block mb-1">Evidências (Abertura):</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {(treatingRnc.fotos_registro ? JSON.parse(treatingRnc.fotos_registro) : [treatingRnc.imagem_evidencia]).map((imgUrl, idx) => (
                                                        <img key={idx} src={imgUrl} className="h-24 object-cover rounded border cursor-pointer hover:opacity-80" alt={`Evidência ${idx}`} onClick={() => window.open(imgUrl)} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                               

                                {treatingRnc.tratativa_resposta && (
                                    <div className="mt-3 bg-indigo-50 border border-indigo-100 p-2 rounded text-xs">
                                        <span className="font-bold text-indigo-800 mb-1 block">Histórico de Tratativas:</span>
                                        <pre className="whitespace-pre-wrap font-sans text-indigo-900 leading-relaxed">{treatingRnc.tratativa_resposta}</pre>
                                        
                                        {treatingRnc.fotos_tratativa && (
                                            <div className="mt-2 pt-2 border-t border-indigo-200">
                                                <span className="font-bold text-indigo-800 mb-1 block text-[10px]">Fotos da Solução:</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {JSON.parse(treatingRnc.fotos_tratativa).map((imgUrl, idx) => (
                                                        <img key={idx} src={imgUrl} className="h-16 object-cover rounded border border-indigo-200 cursor-pointer hover:opacity-80" alt={`Solução ${idx}`} onClick={() => window.open(imgUrl)} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Área de Ação */}
                            {treatingRnc.status !== 'CONCLUIDO' ? (
                                <div className="space-y-4">
                                    <div className="bg-white border rounded p-3 shadow-sm">
                                        <h4 className="font-bold text-slate-800 text-xs mb-2 border-b pb-1">1. Disposição do Produto</h4>
                                        <div className="flex gap-4 mb-2">
                                            <label className="flex items-center gap-1.5 text-xs text-slate-700">
                                                <input type="checkbox" checked={disposicaoRetrabalho} onChange={e => setDisposicaoRetrabalho(e.target.checked)} className="rounded" />
                                                Retrabalho
                                            </label>
                                            <label className="flex items-center gap-1.5 text-xs text-slate-700">
                                                <input type="checkbox" checked={disposicaoNovaPeca} onChange={e => setDisposicaoNovaPeca(e.target.checked)} className="rounded" />
                                                Nova Peça
                                            </label>
                                        </div>

                                        {disposicaoNovaPeca && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEmailType('reposicao');
                                                        setEmailRncTarget(treatingRnc);
                                                    }}
                                                    className="w-full py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold shadow transition-colors flex items-center justify-center gap-1.5"
                                                >
                                                    <Mail className="w-4 h-4" />
                                                    Enviar Solicitação de Fabricação de Nova Peça
                                                </button>
                                                {treatingRnc.reposicao_solicitada ? (
                                                    <div className="text-center">
                                                        <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 font-medium inline-block">
                                                            ✓ Solicitação de fabricação já enviada em {new Date(treatingRnc.reposicao_data_solicitacao).toLocaleString('pt-BR')}
                                                        </span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white border rounded p-3 shadow-sm">
                                        <h4 className="font-bold text-slate-800 text-xs mb-2 border-b pb-1">2. Investigação (5W2H)</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">O Quê? (Problema)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hOQue} onChange={e => setW2hOQue(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Por Quê? (Causa)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hPorQue} onChange={e => setW2hPorQue(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Onde? (Local)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hOnde} onChange={e => setW2hOnde(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Quando? (Data/Hora)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hQuando} onChange={e => setW2hQuando(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Quem? (Responsável)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hQuem} onChange={e => setW2hQuem(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Quantidade / Custo (How Much)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hQuantidade} onChange={e => setW2hQuantidade(e.target.value)} />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-600">Como ocorrerá? (Frequência - How)</label>
                                                <input type="text" className="w-full border rounded p-1.5 text-xs bg-slate-50 focus:bg-white" value={w2hFrequencia} onChange={e => setW2hFrequencia(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white border rounded p-3 shadow-sm">
                                        <h4 className="font-bold text-slate-800 text-xs mb-2 border-b pb-1">3. Verificação da Eficácia</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-600">Ações Foram Implementadas?</label>
                                                <select className="w-full border rounded p-1.5 text-xs bg-slate-50" value={eficAcoesImplementadas} onChange={e => setEficAcoesImplementadas(e.target.value)}>
                                                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Corrigiram o problema?</label>
                                                <select className="w-full border rounded p-1.5 text-xs bg-slate-50" value={eficCorrigiram} onChange={e => setEficCorrigiram(e.target.value)}>
                                                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600">Houve Reincidência?</label>
                                                <select className="w-full border rounded p-1.5 text-xs bg-slate-50" value={eficReincidencia} onChange={e => setEficReincidencia(e.target.value)}>
                                                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-600">Conclusão</label>
                                                <select className="w-full border rounded p-1.5 text-xs bg-slate-50" value={eficConclusao} onChange={e => setEficConclusao(e.target.value)}>
                                                    <option value="">Selecione...</option>
                                                    <option value="Eficaz">Eficaz</option>
                                                    <option value="Manter Aberta">Manter Aberta</option>
                                                    <option value="Não Eficaz">Não Eficaz</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white border rounded p-3 shadow-sm space-y-3">
                                        <h4 className="font-bold text-slate-800 text-xs mb-2 border-b pb-1">4. Resumo e Status</h4>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Mudar Status</label>
                                            <select 
                                                className="w-full border rounded p-2 text-sm outline-none focus:border-indigo-500 bg-slate-50"
                                                value={tratativaStatus}
                                                onChange={e => setTratativaStatus(e.target.value)}
                                            >
                                                <option value="EM ANDAMENTO">Em Andamento</option>
                                                <option value="CONCLUIDO">Concluído</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Descrição / Anotação Extra</label>
                                            <textarea 
                                                className="w-full border rounded p-2 text-sm outline-none focus:border-indigo-500 bg-slate-50"
                                                rows="2"
                                                placeholder="Descreva observações adicionais..."
                                                value={tratativaObs}
                                                onChange={e => setTratativaObs(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Fotos da Solução (Opcional)</label>
                                            <label className="flex items-center justify-center gap-2 w-full border border-dashed border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-600 rounded p-2 cursor-pointer transition-colors text-xs font-medium">
                                                <Camera className="w-4 h-4" />
                                                <span>Adicionar Fotos</span>
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    multiple 
                                                    capture="environment"
                                                    className="hidden" 
                                                    ref={fileInputRef}
                                                    onChange={handlePhotoUpload}
                                                />
                                            </label>
                                            {fotosTratativa.length > 0 && (
                                                <div className="mt-2 grid grid-cols-4 gap-2">
                                                    {fotosTratativa.map((foto, index) => (
                                                        <div key={index} className="relative group">
                                                            <img src={foto} alt={`Solução ${index + 1}`} className="h-16 w-full object-cover rounded border border-slate-200" />
                                                            <button 
                                                                type="button" 
                                                                onClick={() => removeFoto(index)}
                                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleSaveTratativa}
                                        className="w-full bg-indigo-600 text-white font-bold py-2 rounded shadow hover:bg-indigo-700 transition-colors"
                                    >
                                        Salvar Tratativa
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
                                        <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-1.5"><CheckCircle className="w-4 h-4"/> RNC Concluída</h4>
                                        <div className="text-sm text-emerald-900 bg-white p-3 rounded border border-emerald-100">
                                            <span className="font-bold mb-1 block text-emerald-800">Histórico Final:</span>
                                            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{treatingRnc.tratativa_resposta || 'Nenhuma tratativa registrada.'}</pre>
                                        </div>
                                    </div>

                                    {disposicaoNovaPeca && (
                                        <div className="bg-white border rounded p-3 shadow-sm">
                                            <h4 className="font-bold text-slate-800 text-xs mb-2 border-b pb-1">Disposição: Peça de Reposição</h4>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEmailType('reposicao');
                                                    setEmailRncTarget(treatingRnc);
                                                }}
                                                className="w-full py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold shadow transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <Mail className="w-4 h-4" />
                                                Reenviar Solicitação de Fabricação de Nova Peça
                                            </button>
                                            {treatingRnc.reposicao_solicitada ? (
                                                <div className="mt-2 text-center">
                                                    <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 font-medium inline-block">
                                                        ✓ Peça de reposição já solicitada em {new Date(treatingRnc.reposicao_data_solicitacao).toLocaleString('pt-BR')}
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Apontamento de Produção / Tempo */}
            {apontandoRnc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 border-b bg-slate-800 text-white">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-400" />
                                Apontamento de Tempo - RNC #{apontandoRnc.id}
                            </h2>
                            <button onClick={() => setApontandoRnc(null)} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Formulário de Novo Apontamento */}
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200 flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-indigo-600" />
                                    Registrar Novo Aponto
                                </h3>
                                <form onSubmit={handleAddApontamento} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Operação / Recurso *</label>
                                        <select
                                            className="w-full border rounded px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
                                            value={formOperacao}
                                            onChange={(e) => setFormOperacao(e.target.value)}
                                            required
                                        >
                                            <option value="">-- Selecione o Setor --</option>
                                            {recursos.map(r => (
                                                <option key={r.codigo} value={r.codigo}>
                                                    {r.codigo} {r.descricao ? `- ${r.descricao}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Tempo Gasto (em minutos) *</label>
                                        <input
                                            type="number"
                                            className="w-full border rounded px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
                                            placeholder="Ex: 45"
                                            value={formTempo}
                                            onChange={(e) => setFormTempo(e.target.value)}
                                            required
                                            min="1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Operador / Usuário *</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
                                            value={formUsuario}
                                            onChange={(e) => setFormUsuario(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Descrição do Trabalho</label>
                                        <textarea
                                            className="w-full border rounded px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
                                            rows="3"
                                            placeholder="Descreva brevemente o trabalho realizado na RNC..."
                                            value={formDescricao}
                                            onChange={(e) => setFormDescricao(e.target.value)}
                                        />
                                    </div>
                                    
                                    <button
                                        type="submit"
                                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-bold shadow-md hover:shadow-lg transition-all"
                                    >
                                        Adicionar Apontamento
                                    </button>
                                </form>
                            </div>
                            
                            {/* Histórico e Totalização */}
                            <div className="flex flex-col h-full min-h-[300px]">
                                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
                                    <h3 className="text-sm font-bold text-slate-800">Histórico de Apontamentos</h3>
                                    <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded">
                                        Total: {apontamentos.reduce((acc, curr) => acc + curr.tempo_minutos, 0)} min
                                    </span>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto space-y-3 max-h-[320px] pr-1">
                                    {apontamentosLoading ? (
                                        <div className="text-center py-10 text-xs text-slate-400 animate-pulse">Carregando apontamentos...</div>
                                    ) : apontamentos.length === 0 ? (
                                        <div className="text-center py-10 text-xs text-slate-400 border border-dashed rounded-lg">
                                            Nenhum apontamento realizado ainda.
                                        </div>
                                    ) : (
                                        apontamentos.map(ap => (
                                            <div key={ap.id} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-800">{ap.operacao_recurso}</div>
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            Por: {ap.usuario} • {new Date(ap.data_apontamento).toLocaleString('pt-BR')}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded">
                                                            {ap.tempo_minutos} min
                                                        </span>
                                                        <button
                                                            onClick={() => handleDeleteApontamento(ap.id)}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                                            title="Excluir Apontamento"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {ap.descricao && (
                                                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded border border-slate-100 italic">
                                                        "{ap.descricao}"
                                                    </p>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Envio por E-mail */}
            <RNCSendEmailModal
                isOpen={!!emailRncTarget}
                onClose={() => setEmailRncTarget(null)}
                rnc={emailRncTarget}
                emailType={emailType}
                onSuccess={() => {
                    setEmailRncTarget(null);
                    loadData();
                }}
            />
        </div>
    );
}

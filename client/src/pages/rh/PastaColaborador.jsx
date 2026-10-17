import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
    Users, User, FileText, AlertTriangle, Award, CheckCircle2, Clock, 
    Calendar, Shield, Camera, Plus, Download, Search, Eye, X, Edit3, 
    ChevronRight, HeartPulse, Briefcase, ThumbsUp, AlertCircle, Sparkles, Filter
} from 'lucide-react';
import { gerarDossieColaboradorPdf } from '../../services/rhDossiePdfGenerator';

const PastaColaborador = () => {
    const [colaboradores, setColaboradores] = useState([]);
    const [loadingLista, setLoadingLista] = useState(true);
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos');

    const [colaboradorAtivo, setColaboradorAtivo] = useState(null);
    const [dossie, setDossie] = useState(null);
    const [loadingDossie, setLoadingDossie] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState('diario'); // 'diario', 'atestados', 'faltas', 'avaliacoes', 'uniformes'

    // Modais
    const [modalDetalhes, setModalDetalhes] = useState(false);
    const [modalOcorrencia, setModalOcorrencia] = useState(false);
    const [modalAtestado, setModalAtestado] = useState(false);
    const [modalFalta, setModalFalta] = useState(false);
    const [modalAvaliacao, setModalAvaliacao] = useState(false);
    const [modalUniforme, setModalUniforme] = useState(false);
    const [modalFotoZoom, setModalFotoZoom] = useState(null); // { titulo, base64 }

    // Forms
    const [formDetalhes, setFormDetalhes] = useState({});
    const [formOcorrencia, setFormOcorrencia] = useState({ tipo: 'feedback', titulo: '', descricao: '', data_ocorrencia: new Date().toISOString().slice(0, 10), anexo_base64: null, anexo_nome: null });
    const [formAtestado, setFormAtestado] = useState({ data_emissao: new Date().toISOString().slice(0, 10), data_inicio: new Date().toISOString().slice(0, 10), dias_afastamento: 1, medico_nome: '', crm: '', cid10: '', motivo_resumo: '', tipo_afastamento: 'medico_comum', abona_falta: 1, impacta_inss: 0, observacoes: '', foto_atestado_base64: null, anexo_nome: null });
    const [formFalta, setFormFalta] = useState({ data_falta: new Date().toISOString().slice(0, 10), tipo_falta: 'injustificada', minutos_atraso: 0, justificativa: '', impacta_cesta_basica: 1, descontar_folha: 1 });
    const [formAvaliacao, setFormAvaliacao] = useState({ data_avaliacao: new Date().toISOString().slice(0, 10), nota_comprometimento: 5, nota_pontualidade: 5, nota_qualidade_trabalho: 5, nota_relacionamento_equipe: 5, nota_conservacao_uniforme_5s: 5, pontos_fortes: '', pontos_melhoria: '' });
    const [formUniforme, setFormUniforme] = useState({ data_inspecao: new Date().toISOString().slice(0, 10), estado_camisa: 'bom', estado_calca: 'bom', estado_botina: 'bom', uso_epi_obrigatorio: 'conforme_100', necessita_reposicao: 0, itens_reposicao: '', observacoes: '', foto_inspecao_base64: null, anexo_nome: null });
    const [salvando, setSalvando] = useState(false);

    // Carregar lista de colaboradores
    const carregarColaboradores = async () => {
        try {
            setLoadingLista(true);
            const res = await api.get('/rh/pasta/colaboradores');
            const lista = res.data?.colaboradores || [];
            setColaboradores(lista);
            if (lista.length > 0 && !colaboradorAtivo) {
                selecionarColaborador(lista[0]);
            }
        } catch (err) {
            console.error('Erro ao listar colaboradores:', err);
        } finally {
            setLoadingLista(false);
        }
    };

    // Carregar dossiê completo de um colaborador
    const carregarDossie = async (usuarioId) => {
        try {
            setLoadingDossie(true);
            const res = await api.get(`/rh/pasta/colaboradores/${usuarioId}`);
            setDossie(res.data);
            if (res.data?.detalhes) {
                setFormDetalhes({ ...res.data.detalhes });
            } else {
                setFormDetalhes({ regime_contratacao: 'CLT', status_funcional: 'ativo' });
            }
        } catch (err) {
            console.error('Erro ao carregar dossiê:', err);
        } finally {
            setLoadingDossie(false);
        }
    };

    const selecionarColaborador = (colab) => {
        setColaboradorAtivo(colab);
        carregarDossie(colab.idUsuario);
    };

    useEffect(() => {
        carregarColaboradores();
    }, []);

    // Conversão de arquivo para Base64
    const handleArquivoParaBase64 = (e, callbackSucesso) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            callbackSucesso(uploadEvent.target.result, file.name);
        };
        reader.readAsDataURL(file);
    };

    // Submits dos formulários
    const salvarDetalhesFuncionais = async (e) => {
        e.preventDefault();
        try {
            setSalvando(true);
            await api.put(`/rh/pasta/colaboradores/${colaboradorAtivo.idUsuario}/detalhes`, formDetalhes);
            setModalDetalhes(false);
            carregarDossie(colaboradorAtivo.idUsuario);
            carregarColaboradores();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao salvar detalhes.');
        } finally {
            setSalvando(false);
        }
    };

    const salvarOcorrencia = async (e) => {
        e.preventDefault();
        try {
            setSalvando(true);
            await api.post('/rh/pasta/ocorrencias', {
                ...formOcorrencia,
                usuario_id: colaboradorAtivo.idUsuario
            });
            setModalOcorrencia(false);
            setFormOcorrencia({ tipo: 'feedback', titulo: '', descricao: '', data_ocorrencia: new Date().toISOString().slice(0, 10), anexo_base64: null, anexo_nome: null });
            carregarDossie(colaboradorAtivo.idUsuario);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao salvar ocorrência.');
        } finally {
            setSalvando(false);
        }
    };

    const salvarAtestado = async (e) => {
        e.preventDefault();
        try {
            setSalvando(true);
            await api.post('/rh/pasta/atestados', {
                ...formAtestado,
                usuario_id: colaboradorAtivo.idUsuario
            });
            setModalAtestado(false);
            setFormAtestado({ data_emissao: new Date().toISOString().slice(0, 10), data_inicio: new Date().toISOString().slice(0, 10), dias_afastamento: 1, medico_nome: '', crm: '', cid10: '', motivo_resumo: '', tipo_afastamento: 'medico_comum', abona_falta: 1, impacta_inss: 0, observacoes: '', foto_atestado_base64: null, anexo_nome: null });
            carregarDossie(colaboradorAtivo.idUsuario);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao anexar atestado.');
        } finally {
            setSalvando(false);
        }
    };

    const salvarFalta = async (e) => {
        e.preventDefault();
        try {
            setSalvando(true);
            await api.post('/rh/pasta/faltas', {
                ...formFalta,
                usuario_id: colaboradorAtivo.idUsuario
            });
            setModalFalta(false);
            setFormFalta({ data_falta: new Date().toISOString().slice(0, 10), tipo_falta: 'injustificada', minutos_atraso: 0, justificativa: '', impacta_cesta_basica: 1, descontar_folha: 1 });
            carregarDossie(colaboradorAtivo.idUsuario);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao registrar falta.');
        } finally {
            setSalvando(false);
        }
    };

    const salvarAvaliacao = async (e) => {
        e.preventDefault();
        try {
            setSalvando(true);
            await api.post('/rh/pasta/avaliacoes', {
                ...formAvaliacao,
                usuario_id: colaboradorAtivo.idUsuario
            });
            setModalAvaliacao(false);
            carregarDossie(colaboradorAtivo.idUsuario);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao salvar avaliação.');
        } finally {
            setSalvando(false);
        }
    };

    const salvarUniforme = async (e) => {
        e.preventDefault();
        try {
            setSalvando(true);
            await api.post('/rh/pasta/uniformes', {
                ...formUniforme,
                usuario_id: colaboradorAtivo.idUsuario
            });
            setModalUniforme(false);
            setFormUniforme({ data_inspecao: new Date().toISOString().slice(0, 10), estado_camisa: 'bom', estado_calca: 'bom', estado_botina: 'bom', uso_epi_obrigatorio: 'conforme_100', necessita_reposicao: 0, itens_reposicao: '', observacoes: '', foto_inspecao_base64: null, anexo_nome: null });
            carregarDossie(colaboradorAtivo.idUsuario);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao registrar vistoria.');
        } finally {
            setSalvando(false);
        }
    };

    // Filtro de lista
    const colaboradoresFiltrados = colaboradores.filter(c => {
        const matchesBusca = c.NomeCompleto?.toLowerCase().includes(busca.toLowerCase()) ||
                             c.Setor?.toLowerCase().includes(busca.toLowerCase()) ||
                             c.Funcao?.toLowerCase().includes(busca.toLowerCase());
        const matchesStatus = filtroStatus === 'todos' || (c.status_funcional || 'ativo') === filtroStatus;
        return matchesBusca && matchesStatus;
    });

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
            {/* ── BARRA LATERAL: SELETOR DE COLABORADORES ── */}
            <div className="w-80 border-r border-slate-800 bg-slate-950 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-400" />
                            <h2 className="font-semibold text-white text-base">Colaboradores</h2>
                        </div>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                            {colaboradoresFiltrados.length}
                        </span>
                    </div>

                    <div className="relative mb-2">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            placeholder="Buscar colaborador..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-750 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div className="flex items-center gap-1">
                        {['todos', 'ativo', 'afastado'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setFiltroStatus(st)}
                                className={`text-xs px-2.5 py-1 rounded-md capitalize font-medium transition ${
                                    filtroStatus === st
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-slate-400 hover:bg-slate-900'
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-850">
                    {loadingLista ? (
                        <div className="p-6 text-center text-slate-500 text-sm">Carregando colaboradores...</div>
                    ) : colaboradoresFiltrados.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-sm">Nenhum colaborador encontrado.</div>
                    ) : (
                        colaboradoresFiltrados.map((c) => {
                            const isAtivo = colaboradorAtivo?.idUsuario === c.idUsuario;
                            return (
                                <button
                                    key={c.idUsuario}
                                    onClick={() => selecionarColaborador(c)}
                                    className={`w-full text-left p-3.5 flex items-center gap-3 transition ${
                                        isAtivo
                                            ? 'bg-indigo-950/60 border-l-4 border-indigo-500 text-white'
                                            : 'hover:bg-slate-900 text-slate-300'
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-indigo-300 flex-shrink-0 overflow-hidden">
                                        {c.fotoUsuario ? (
                                            <img src={c.fotoUsuario} alt={c.NomeCompleto} className="w-full h-full object-cover" />
                                        ) : (
                                            c.NomeCompleto?.slice(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{c.NomeCompleto}</p>
                                        <p className="text-xs text-slate-400 truncate">{c.Funcao || c.Setor || 'Sem cargo definido'}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {c.total_atestados > 0 && (
                                                <span className="text-[10px] bg-rose-950/60 text-rose-300 border border-rose-800/40 px-1.5 py-0.2 rounded font-mono">
                                                    {c.total_atestados} atest.
                                                </span>
                                            )}
                                            {c.total_faltas > 0 && (
                                                <span className="text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/40 px-1.5 py-0.2 rounded font-mono">
                                                    {c.total_faltas} faltas
                                                </span>
                                            )}
                                            {c.ultima_avaliacao_media && (
                                                <span className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.2 rounded font-mono">
                                                    ★ {c.ultima_avaliacao_media}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── PAINEL PRINCIPAL: DOSSIÊ 360° ── */}
            <div className="flex-1 flex flex-col overflow-y-auto">
                {!colaboradorAtivo ? (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                        Selecione um colaborador ao lado para abrir a pasta funcional.
                    </div>
                ) : loadingDossie ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                        Carregando dossiê 360° de {colaboradorAtivo.NomeCompleto}...
                    </div>
                ) : (
                    <>
                        {/* 1. Header do Colaborador */}
                        <div className="bg-slate-950 border-b border-slate-800 p-6">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-indigo-500/40 flex items-center justify-center font-bold text-xl text-indigo-300 flex-shrink-0 overflow-hidden shadow-lg shadow-indigo-950/30">
                                        {dossie?.usuario?.fotoUsuario ? (
                                            <img src={dossie.usuario.fotoUsuario} alt="Foto" className="w-full h-full object-cover" />
                                        ) : (
                                            dossie?.usuario?.NomeCompleto?.slice(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h1 className="text-xl font-bold text-white tracking-tight">{dossie?.usuario?.NomeCompleto}</h1>
                                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium uppercase border ${
                                                dossie?.detalhes?.status_funcional === 'afastado'
                                                    ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                                                    : dossie?.detalhes?.status_funcional === 'ferias'
                                                    ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                                                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                            }`}>
                                                {dossie?.detalhes?.status_funcional || 'ativo'}
                                            </span>
                                            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                                                {dossie?.detalhes?.regime_contratacao || 'CLT'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-400 mt-1">
                                            {dossie?.usuario?.Funcao || 'Sem função'} • {dossie?.usuario?.Setor || 'Sem setor'} • E-mail: {dossie?.usuario?.email || '-'}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                                            <span>CPF: <strong className="text-slate-300">{dossie?.detalhes?.cpf_cnpj || '-'}</strong></span>
                                            <span>Admissão: <strong className="text-slate-300">{dossie?.detalhes?.data_admissao ? new Date(dossie.detalhes.data_admissao).toLocaleDateString('pt-BR') : '-'}</strong></span>
                                            <span>Contato Emergência: <strong className="text-slate-300">{dossie?.detalhes?.contato_emergencia || '-'} ({dossie?.detalhes?.telefone_emergencia || '-'})</strong></span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setModalDetalhes(true)}
                                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-sm font-medium border border-slate-700 transition"
                                    >
                                        <Edit3 className="w-4 h-4 text-indigo-400" />
                                        Editar Cadastro
                                    </button>
                                    <button
                                        onClick={() => gerarDossieColaboradorPdf(dossie)}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-900/30 transition"
                                    >
                                        <Download className="w-4 h-4" />
                                        Exportar Dossiê (PDF)
                                    </button>
                                </div>
                            </div>

                            {/* 2. Menu de Navegação das 5 Abas */}
                            <div className="flex items-center gap-2 mt-6 border-b border-slate-800 overflow-x-auto">
                                {[
                                    { id: 'diario', label: 'Diário de Ocorrências', icon: FileText, count: dossie?.ocorrencias?.length },
                                    { id: 'atestados', label: 'Atestados Médicos', icon: HeartPulse, count: dossie?.atestados?.length },
                                    { id: 'faltas', label: 'Faltas & Assiduidade', icon: Clock, count: dossie?.faltas?.length },
                                    { id: 'avaliacoes', label: 'Avaliação 360°', icon: Award, count: dossie?.avaliacoes?.length },
                                    { id: 'uniformes', label: 'Vistoria Uniforme & EPI', icon: Shield, count: dossie?.uniformes?.length }
                                ].map((tab) => {
                                    const Icon = tab.icon;
                                    const isActive = abaAtiva === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setAbaAtiva(tab.id)}
                                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                                                isActive
                                                    ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {tab.label}
                                            {tab.count !== undefined && (
                                                <span className={`text-xs px-2 py-0.2 rounded-full font-mono ${
                                                    isActive ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                    {tab.count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. Conteúdo da Aba Ativa */}
                        <div className="p-6 space-y-6">
                            {/* ABA 1: DIÁRIO DE OCORRÊNCIAS */}
                            {abaAtiva === 'diario' && (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-white">Diário de Bordo & Ocorrências</h3>
                                            <p className="text-xs text-slate-400">Histórico de elogios, alinhamentos, advertências e suspensões.</p>
                                        </div>
                                        <button
                                            onClick={() => setModalOcorrencia(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Nova Ocorrência
                                        </button>
                                    </div>

                                    {dossie?.ocorrencias?.length === 0 ? (
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                                            Nenhuma ocorrência registrada para este colaborador.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {dossie.ocorrencias.map((oc) => (
                                                <div key={oc.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-start gap-4">
                                                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${
                                                        oc.tipo === 'elogio' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' :
                                                        oc.tipo === 'advertencia' ? 'bg-amber-950 text-amber-400 border border-amber-800/40' :
                                                        oc.tipo === 'suspensao' ? 'bg-rose-950 text-rose-400 border border-rose-800/40' :
                                                        'bg-blue-950 text-blue-400 border border-blue-800/40'
                                                    }`}>
                                                        {oc.tipo === 'elogio' ? <ThumbsUp className="w-5 h-5" /> :
                                                         oc.tipo === 'advertencia' ? <AlertTriangle className="w-5 h-5" /> :
                                                         oc.tipo === 'suspensao' ? <AlertCircle className="w-5 h-5" /> :
                                                         <FileText className="w-5 h-5" />}
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-semibold text-sm text-white">{oc.titulo}</h4>
                                                                <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-slate-800 text-slate-300">
                                                                    {oc.tipo}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs text-slate-500">
                                                                {new Date(oc.data_ocorrencia).toLocaleDateString('pt-BR')}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-300 mt-2 whitespace-pre-line">{oc.descricao}</p>
                                                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-900 text-xs text-slate-500">
                                                            <span>Registrado por: <strong className="text-slate-400">{oc.registrado_por_nome || 'RH'}</strong></span>
                                                            {oc.anexo_base64 && (
                                                                <button
                                                                    onClick={() => setModalFotoZoom({ titulo: oc.titulo, base64: oc.anexo_base64 })}
                                                                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                    Ver Anexo
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ABA 2: ATESTADOS MÉDICOS */}
                            {abaAtiva === 'atestados' && (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-white">Atestados Médicos & Afastamentos</h3>
                                            <p className="text-xs text-slate-400">Armazenamento digital com foto em alta resolução e controle de abonos.</p>
                                        </div>
                                        <button
                                            onClick={() => setModalAtestado(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Anexar Atestado
                                        </button>
                                    </div>

                                    {dossie?.atestados?.length === 0 ? (
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                                            Nenhum atestado registrado.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {dossie.atestados.map((at) => (
                                                <div key={at.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex gap-4">
                                                    {at.foto_atestado_base64 ? (
                                                        <div
                                                            onClick={() => setModalFotoZoom({ titulo: `Atestado - ${at.medico_nome || 'Médico'}`, base64: at.foto_atestado_base64 })}
                                                            className="w-24 h-32 rounded-lg bg-slate-900 border border-slate-750 flex-shrink-0 cursor-pointer overflow-hidden group relative"
                                                        >
                                                            <img src={at.foto_atestado_base64} alt="Atestado" className="w-full h-full object-cover group-hover:scale-105 transition" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                                                                <Eye className="w-5 h-5" />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="w-24 h-32 rounded-lg bg-slate-900 border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-600 flex-shrink-0 text-center p-2">
                                                            <HeartPulse className="w-6 h-6 mb-1 text-slate-500" />
                                                            <span className="text-[10px]">Sem foto</span>
                                                        </div>
                                                    )}

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono">
                                                                {at.dias_afastamento} {at.dias_afastamento === 1 ? 'dia' : 'dias'}
                                                            </span>
                                                            <span className="text-xs text-slate-500">
                                                                Início: {new Date(at.data_inicio).toLocaleDateString('pt-BR')}
                                                            </span>
                                                        </div>

                                                        <h4 className="font-semibold text-sm text-white mt-1 truncate">
                                                            Dr(a). {at.medico_nome || 'Não informado'}
                                                        </h4>
                                                        <p className="text-xs text-slate-400">CRM: {at.crm || '-'} • CID-10: <strong className="text-slate-200">{at.cid10 || '-'}</strong></p>
                                                        <p className="text-xs text-slate-400 mt-1">Retorno: <strong className="text-emerald-400">{new Date(at.data_retorno).toLocaleDateString('pt-BR')}</strong></p>

                                                        <div className="flex items-center gap-2 mt-3">
                                                            {at.abona_falta ? (
                                                                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded">
                                                                    ✓ Abona Falta
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800/40 px-2 py-0.5 rounded">
                                                                    ✕ Não Abona
                                                                </span>
                                                            )}
                                                            {at.impacta_inss === 1 && (
                                                                <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded">
                                                                    INSS &gt;15 dias
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ABA 3: FALTAS & ASSIDUIDADE */}
                            {abaAtiva === 'faltas' && (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-white">Faltas, Atrasos & Assiduidade</h3>
                                            <p className="text-xs text-slate-400">Controle de pontualidade com impacto automático na Cesta Básica.</p>
                                        </div>
                                        <button
                                            onClick={() => setModalFalta(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Registrar Falta/Atraso
                                        </button>
                                    </div>

                                    {dossie?.faltas?.length === 0 ? (
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                                            Nenhuma falta ou atraso registrado. Colaborador 100% assíduo!
                                        </div>
                                    ) : (
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-900 border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold">
                                                    <tr>
                                                        <th className="p-3">Data</th>
                                                        <th className="p-3">Tipo</th>
                                                        <th className="p-3">Minutos</th>
                                                        <th className="p-3">Impacta Cesta Básica</th>
                                                        <th className="p-3">Desconto em Folha</th>
                                                        <th className="p-3">Justificativa</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-850">
                                                    {dossie.faltas.map((f) => (
                                                        <tr key={f.id} className="hover:bg-slate-900/40">
                                                            <td className="p-3 font-mono text-slate-300">
                                                                {new Date(f.data_falta).toLocaleDateString('pt-BR')}
                                                            </td>
                                                            <td className="p-3">
                                                                <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${
                                                                    f.tipo_falta === 'injustificada' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                                                                    f.tipo_falta === 'atraso' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                                                                    'bg-slate-800 text-slate-300'
                                                                }`}>
                                                                    {f.tipo_falta}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 font-mono text-slate-400">
                                                                {f.minutos_atraso ? `${f.minutos_atraso} min` : '-'}
                                                            </td>
                                                            <td className="p-3">
                                                                {f.impacta_cesta_basica ? (
                                                                    <span className="text-xs text-rose-400 font-semibold">Sim (Trava Cesta)</span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-500">Não</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-xs text-slate-400">
                                                                {f.descontar_folha ? 'Sim' : 'Abonado'}
                                                            </td>
                                                            <td className="p-3 text-xs text-slate-400 max-w-xs truncate">
                                                                {f.justificativa || '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ABA 4: AVALIAÇÃO 360° */}
                            {abaAtiva === 'avaliacoes' && (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-white">Avaliação de Desempenho 360°</h3>
                                            <p className="text-xs text-slate-400">Scorecard de notas ponderadas (Comprometimento, Qualidade, Pontualidade e 5S).</p>
                                        </div>
                                        <button
                                            onClick={() => setModalAvaliacao(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Nova Avaliação
                                        </button>
                                    </div>

                                    {dossie?.avaliacoes?.length === 0 ? (
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                                            Nenhuma avaliação 360° registrada até o momento.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {dossie.avaliacoes.map((av) => (
                                                <div key={av.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-850">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400 font-bold text-lg">
                                                                {av.media_geral}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-sm text-white">
                                                                    Avaliação de Desempenho em {new Date(av.data_avaliacao).toLocaleDateString('pt-BR')}
                                                                </h4>
                                                                <p className="text-xs text-slate-400">Avaliador: {av.avaliador_nome || 'Gestor RH'}</p>
                                                            </div>
                                                        </div>

                                                        <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                                                            parseFloat(av.media_geral) >= 4.5 ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                                                            parseFloat(av.media_geral) >= 3.5 ? 'bg-blue-950 text-blue-300 border-blue-800' :
                                                            'bg-amber-950 text-amber-300 border-amber-800'
                                                        }`}>
                                                            {parseFloat(av.media_geral) >= 4.5 ? 'Desempenho Excepcional' :
                                                             parseFloat(av.media_geral) >= 3.5 ? 'Dentro do Esperado' : 'Abaixo do Esperado'}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                                                        {[
                                                            { label: 'Comprometimento', nota: av.nota_comprometimento },
                                                            { label: 'Pontualidade', nota: av.nota_pontualidade },
                                                            { label: 'Qualidade', nota: av.nota_qualidade_trabalho },
                                                            { label: 'Equipe', nota: av.nota_relacionamento_equipe },
                                                            { label: '5S & Fardamento', nota: av.nota_conservacao_uniforme_5s }
                                                        ].map((item, idx) => (
                                                            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                                                                <p className="text-[11px] text-slate-400 mb-1">{item.label}</p>
                                                                <p className="text-base font-bold text-indigo-300">★ {item.nota}/5</p>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {(av.pontos_fortes || av.pontos_melhoria) && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-900 text-xs">
                                                            {av.pontos_fortes && (
                                                                <div>
                                                                    <strong className="text-emerald-400 block mb-1">Pontos Fortes:</strong>
                                                                    <p className="text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-800/60">{av.pontos_fortes}</p>
                                                                </div>
                                                            )}
                                                            {av.pontos_melhoria && (
                                                                <div>
                                                                    <strong className="text-amber-400 block mb-1">Pontos de Melhoria:</strong>
                                                                    <p className="text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-800/60">{av.pontos_melhoria}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ABA 5: VISTORIA DE UNIFORME & EPI */}
                            {abaAtiva === 'uniformes' && (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-white">Inspeções de Fardamento & EPI</h3>
                                            <p className="text-xs text-slate-400">Verificação do estado de conservação de camisas, calças e botinas de segurança.</p>
                                        </div>
                                        <button
                                            onClick={() => setModalUniforme(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Nova Inspeção
                                        </button>
                                    </div>

                                    {dossie?.uniformes?.length === 0 ? (
                                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
                                            Nenhuma vistoria de fardamento registrada.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {dossie.uniformes.map((uni) => (
                                                <div key={uni.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4">
                                                    {uni.foto_inspecao_base64 && (
                                                        <div
                                                            onClick={() => setModalFotoZoom({ titulo: 'Foto da Inspeção', base64: uni.foto_inspecao_base64 })}
                                                            className="w-24 h-24 rounded-lg bg-slate-900 border border-slate-750 flex-shrink-0 cursor-pointer overflow-hidden group relative"
                                                        >
                                                            <img src={uni.foto_inspecao_base64} alt="Vistoria" className="w-full h-full object-cover group-hover:scale-105 transition" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                                                                <Eye className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="font-semibold text-sm text-white">
                                                                Vistoria em {new Date(uni.data_inspecao).toLocaleDateString('pt-BR')}
                                                            </h4>
                                                            <span className="text-xs text-slate-500">Inspetor: {uni.inspetor_nome || 'RH/Segurança'}</span>
                                                        </div>

                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                                                            <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                                                <span className="text-slate-400 block">Camisa:</span>
                                                                <strong className="text-slate-200 capitalize">{uni.estado_camisa}</strong>
                                                            </div>
                                                            <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                                                <span className="text-slate-400 block">Calça:</span>
                                                                <strong className="text-slate-200 capitalize">{uni.estado_calca}</strong>
                                                            </div>
                                                            <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                                                <span className="text-slate-400 block">Botina:</span>
                                                                <strong className="text-slate-200 capitalize">{uni.estado_botina}</strong>
                                                            </div>
                                                            <div className="bg-slate-900 p-2 rounded border border-slate-800">
                                                                <span className="text-slate-400 block">Uso Obrigatório:</span>
                                                                <strong className="text-emerald-400">100% Conforme</strong>
                                                            </div>
                                                        </div>

                                                        {uni.necessita_reposicao ? (
                                                            <div className="mt-3 p-2 bg-rose-950/60 border border-rose-800/60 rounded text-xs text-rose-300 flex items-center gap-2">
                                                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                                                <span>Necessita reposição de: <strong>{uni.itens_reposicao || 'Itens diversos'}</strong></span>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ── MODAIS DE CADASTRO ── */}

            {/* 1. Modal Detalhes Funcionais */}
            {modalDetalhes && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-semibold text-white">Editar Cadastro Funcional de RH</h3>
                            <button onClick={() => setModalDetalhes(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={salvarDetalhesFuncionais} className="mt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Regime Contratação</label>
                                    <select
                                        value={formDetalhes.regime_contratacao || 'CLT'}
                                        onChange={(e) => setFormDetalhes({ ...formDetalhes, regime_contratacao: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    >
                                        <option value="CLT">CLT</option>
                                        <option value="PJ">PJ / Prestador</option>
                                        <option value="Estagiario">Estagiário</option>
                                        <option value="Temporario">Temporário</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Status Funcional</label>
                                    <select
                                        value={formDetalhes.status_funcional || 'ativo'}
                                        onChange={(e) => setFormDetalhes({ ...formDetalhes, status_funcional: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    >
                                        <option value="ativo">Ativo</option>
                                        <option value="afastado">Afastado (INSS)</option>
                                        <option value="ferias">Férias</option>
                                        <option value="desligado">Desligado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">CPF / CNPJ</label>
                                    <input
                                        type="text"
                                        value={formDetalhes.cpf_cnpj || ''}
                                        onChange={(e) => setFormDetalhes({ ...formDetalhes, cpf_cnpj: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Data Admissão</label>
                                    <input
                                        type="date"
                                        value={formDetalhes.data_admissao ? formDetalhes.data_admissao.slice(0, 10) : ''}
                                        onChange={(e) => setFormDetalhes({ ...formDetalhes, data_admissao: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Contato de Emergência</label>
                                    <input
                                        type="text"
                                        placeholder="Nome do parente"
                                        value={formDetalhes.contato_emergencia || ''}
                                        onChange={(e) => setFormDetalhes({ ...formDetalhes, contato_emergencia: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Telefone Emergência</label>
                                    <input
                                        type="text"
                                        placeholder="(00) 00000-0000"
                                        value={formDetalhes.telefone_emergencia || ''}
                                        onChange={(e) => setFormDetalhes({ ...formDetalhes, telefone_emergencia: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                                <button type="button" onClick={() => setModalDetalhes(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={salvando} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm">
                                    {salvando ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. Modal Nova Ocorrência */}
            {modalOcorrencia && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-semibold text-white">Nova Ocorrência / Diário de Bordo</h3>
                            <button onClick={() => setModalOcorrencia(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={salvarOcorrencia} className="mt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Tipo de Registro</label>
                                    <select
                                        value={formOcorrencia.tipo}
                                        onChange={(e) => setFormOcorrencia({ ...formOcorrencia, tipo: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    >
                                        <option value="elogio">Elogio</option>
                                        <option value="feedback">Feedback / Alinhamento</option>
                                        <option value="advertencia">Advertência Escrita</option>
                                        <option value="suspensao">Suspensão Disciplinar</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Data do Ocorrido</label>
                                    <input
                                        type="date"
                                        required
                                        value={formOcorrencia.data_ocorrencia}
                                        onChange={(e) => setFormOcorrencia({ ...formOcorrencia, data_ocorrencia: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 font-medium">Título Resumido</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Elogio de proatividade na linha 02"
                                    value={formOcorrencia.titulo}
                                    onChange={(e) => setFormOcorrencia({ ...formOcorrencia, titulo: e.target.value })}
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 font-medium">Descrição Detalhada dos Fatos</label>
                                <textarea
                                    required
                                    rows="4"
                                    placeholder="Relate os detalhes..."
                                    value={formOcorrencia.descricao}
                                    onChange={(e) => setFormOcorrencia({ ...formOcorrencia, descricao: e.target.value })}
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 font-medium">Anexo / Foto Comprobatória (Opcional)</label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleArquivoParaBase64(e, (base64, nome) => {
                                        setFormOcorrencia({ ...formOcorrencia, anexo_base64: base64, anexo_nome: nome });
                                    })}
                                    className="w-full mt-1 text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-750"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                                <button type="button" onClick={() => setModalOcorrencia(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={salvando} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm">
                                    {salvando ? 'Salvando...' : 'Registrar Ocorrência'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 3. Modal Anexar Atestado */}
            {modalAtestado && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-semibold text-white">Anexar Atestado Médico</h3>
                            <button onClick={() => setModalAtestado(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={salvarAtestado} className="mt-4 space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Emissão</label>
                                    <input
                                        type="date"
                                        required
                                        value={formAtestado.data_emissao}
                                        onChange={(e) => setFormAtestado({ ...formAtestado, data_emissao: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Início Afastamento</label>
                                    <input
                                        type="date"
                                        required
                                        value={formAtestado.data_inicio}
                                        onChange={(e) => setFormAtestado({ ...formAtestado, data_inicio: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Dias Afastados</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={formAtestado.dias_afastamento}
                                        onChange={(e) => setFormAtestado({ ...formAtestado, dias_afastamento: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Médico(a)</label>
                                    <input
                                        type="text"
                                        placeholder="Nome médico"
                                        value={formAtestado.medico_nome}
                                        onChange={(e) => setFormAtestado({ ...formAtestado, medico_nome: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">CRM</label>
                                    <input
                                        type="text"
                                        placeholder="12345/MG"
                                        value={formAtestado.crm}
                                        onChange={(e) => setFormAtestado({ ...formAtestado, crm: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">CID-10</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: J06.9"
                                        value={formAtestado.cid10}
                                        onChange={(e) => setFormAtestado({ ...formAtestado, cid10: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-6 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={formAtestado.abona_falta === 1}
                                        onChange={(e) => setFormAtestado({ ...formAtestado, abona_falta: e.target.checked ? 1 : 0 })}
                                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                                    />
                                    Abonar Falta / Horas
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={formAtestado.impacta_inss === 1}
                                        onChange={(e) => setFormAtestado({ ...formAtestado, impacta_inss: e.target.checked ? 1 : 0 })}
                                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                                    />
                                    Impacta Encaminhamento ao INSS (&gt; 15 dias)
                                </label>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 font-medium">Foto do Atestado Médico (Captura / Upload)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) => handleArquivoParaBase64(e, (base64, nome) => {
                                        setFormAtestado({ ...formAtestado, foto_atestado_base64: base64, anexo_nome: nome });
                                    })}
                                    className="w-full mt-1 text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-750"
                                />
                                {formAtestado.foto_atestado_base64 && (
                                    <p className="text-[11px] text-emerald-400 mt-1">✓ Foto carregada pronta para salvar no MySQL!</p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                                <button type="button" onClick={() => setModalAtestado(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={salvando} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm">
                                    {salvando ? 'Salvando...' : 'Salvar Atestado'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 4. Modal Falta / Assiduidade */}
            {modalFalta && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-semibold text-white">Registrar Falta ou Atraso</h3>
                            <button onClick={() => setModalFalta(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={salvarFalta} className="mt-4 space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 font-medium">Data da Ocorrência</label>
                                <input
                                    type="date"
                                    required
                                    value={formFalta.data_falta}
                                    onChange={(e) => setFormFalta({ ...formFalta, data_falta: e.target.value })}
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Tipo</label>
                                    <select
                                        value={formFalta.tipo_falta}
                                        onChange={(e) => setFormFalta({ ...formFalta, tipo_falta: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    >
                                        <option value="injustificada">Falta Injustificada</option>
                                        <option value="justificada">Falta Justificada</option>
                                        <option value="atraso">Atraso</option>
                                        <option value="suspensao">Suspensão</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Minutos de Atraso</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formFalta.minutos_atraso}
                                        onChange={(e) => setFormFalta({ ...formFalta, minutos_atraso: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 font-medium">Justificativa</label>
                                <textarea
                                    rows="2"
                                    value={formFalta.justificativa}
                                    onChange={(e) => setFormFalta({ ...formFalta, justificativa: e.target.value })}
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                />
                            </div>

                            <div className="space-y-2 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={formFalta.impacta_cesta_basica === 1}
                                        onChange={(e) => setFormFalta({ ...formFalta, impacta_cesta_basica: e.target.checked ? 1 : 0 })}
                                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                                    />
                                    Impacta Cesta Básica (Inabilita no mês)
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={formFalta.descontar_folha === 1}
                                        onChange={(e) => setFormFalta({ ...formFalta, descontar_folha: e.target.checked ? 1 : 0 })}
                                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                                    />
                                    Descontar em Folha de Pagamento
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                                <button type="button" onClick={() => setModalFalta(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={salvando} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm">
                                    {salvando ? 'Salvando...' : 'Salvar Registro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 5. Modal Avaliação 360° */}
            {modalAvaliacao && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-semibold text-white">Nova Avaliação de Desempenho 360°</h3>
                            <button onClick={() => setModalAvaliacao(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={salvarAvaliacao} className="mt-4 space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 font-medium">Data da Avaliação</label>
                                <input
                                    type="date"
                                    required
                                    value={formAvaliacao.data_avaliacao}
                                    onChange={(e) => setFormAvaliacao({ ...formAvaliacao, data_avaliacao: e.target.value })}
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                />
                            </div>

                            <div className="space-y-2 pt-2">
                                {[
                                    { key: 'nota_comprometimento', label: 'Comprometimento & Foco' },
                                    { key: 'nota_pontualidade', label: 'Pontualidade & Assiduidade' },
                                    { key: 'nota_qualidade_trabalho', label: 'Qualidade Técnica do Trabalho' },
                                    { key: 'nota_relacionamento_equipe', label: 'Relacionamento & Trabalho em Equipe' },
                                    { key: 'nota_conservacao_uniforme_5s', label: 'Conservação de EPI / Fardamento & 5S' }
                                ].map((c) => (
                                    <div key={c.key} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                                        <span className="text-xs text-slate-300 font-medium">{c.label}</span>
                                        <div className="flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => setFormAvaliacao({ ...formAvaliacao, [c.key]: star })}
                                                    className={`w-7 h-7 rounded text-xs font-bold transition ${
                                                        formAvaliacao[c.key] >= star
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                                                    }`}
                                                >
                                                    {star}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Pontos Fortes</label>
                                    <textarea
                                        rows="2"
                                        value={formAvaliacao.pontos_fortes}
                                        onChange={(e) => setFormAvaliacao({ ...formAvaliacao, pontos_fortes: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Pontos de Melhoria</label>
                                    <textarea
                                        rows="2"
                                        value={formAvaliacao.pontos_melhoria}
                                        onChange={(e) => setFormAvaliacao({ ...formAvaliacao, pontos_melhoria: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                                <button type="button" onClick={() => setModalAvaliacao(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={salvando} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm">
                                    {salvando ? 'Salvando...' : 'Salvar Avaliação 360°'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 6. Modal Vistoria de Uniforme & EPI */}
            {modalUniforme && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-semibold text-white">Vistoria de Fardamento & EPI</h3>
                            <button onClick={() => setModalUniforme(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={salvarUniforme} className="mt-4 space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 font-medium">Data da Inspeção</label>
                                <input
                                    type="date"
                                    required
                                    value={formUniforme.data_inspecao}
                                    onChange={(e) => setFormUniforme({ ...formUniforme, data_inspecao: e.target.value })}
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Camisa</label>
                                    <select
                                        value={formUniforme.estado_camisa}
                                        onChange={(e) => setFormUniforme({ ...formUniforme, estado_camisa: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                                    >
                                        <option value="otimo">Ótimo</option>
                                        <option value="bom">Bom</option>
                                        <option value="regular">Regular</option>
                                        <option value="desgastado">Desgastado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Calça</label>
                                    <select
                                        value={formUniforme.estado_calca}
                                        onChange={(e) => setFormUniforme({ ...formUniforme, estado_calca: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                                    >
                                        <option value="otimo">Ótimo</option>
                                        <option value="bom">Bom</option>
                                        <option value="regular">Regular</option>
                                        <option value="desgastado">Desgastado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Botina</label>
                                    <select
                                        value={formUniforme.estado_botina}
                                        onChange={(e) => setFormUniforme({ ...formUniforme, estado_botina: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                                    >
                                        <option value="otimo">Ótimo</option>
                                        <option value="bom">Bom</option>
                                        <option value="regular">Regular</option>
                                        <option value="desgastado">Desgastado</option>
                                    </select>
                                </div>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 pt-1">
                                <input
                                    type="checkbox"
                                    checked={formUniforme.necessita_reposicao === 1}
                                    onChange={(e) => setFormUniforme({ ...formUniforme, necessita_reposicao: e.target.checked ? 1 : 0 })}
                                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                                />
                                Necessita Reposição Imediata
                            </label>

                            {formUniforme.necessita_reposicao === 1 && (
                                <div>
                                    <label className="text-xs text-slate-400 font-medium">Quais itens precisam de reposição?</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: 1 Botina nº 41, 2 camisas tamanho G"
                                        value={formUniforme.itens_reposicao}
                                        onChange={(e) => setFormUniforme({ ...formUniforme, itens_reposicao: e.target.value })}
                                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-xs text-slate-400 font-medium">Foto da Inspeção (Opcional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) => handleArquivoParaBase64(e, (base64, nome) => {
                                        setFormUniforme({ ...formUniforme, foto_inspecao_base64: base64, anexo_nome: nome });
                                    })}
                                    className="w-full mt-1 text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-750"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                                <button type="button" onClick={() => setModalUniforme(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={salvando} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm">
                                    {salvando ? 'Salvando...' : 'Salvar Vistoria'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 7. Modal Visualizar Foto Zoom */}
            {modalFotoZoom && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-3xl w-full p-4 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <h4 className="font-semibold text-sm text-white">{modalFotoZoom.titulo}</h4>
                            <button onClick={() => setModalFotoZoom(null)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                            <img src={modalFotoZoom.base64} alt="Zoom" className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PastaColaborador;

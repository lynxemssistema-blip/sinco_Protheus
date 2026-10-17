import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Award, ShieldCheck, Users, Calendar, Clock, AlertTriangle,
    CheckCircle2, Plus, RefreshCw, Printer, FileText, Vote,
    Eye, Filter, Search, ChevronRight, Lock, Check, X,
    ExternalLink, AlertCircle, Sparkles, Building2, UserCheck,
    Smartphone, Download, HelpCircle, Paperclip, Upload, FileUp,
    Hash, Copy, UserPlus, Trash2, History, Send, Mail
} from 'lucide-react';
import {
    getCipaGestoes, getCipaGestao, createCipaGestao, createCipaGestaoLegada,
    updateCipaGestaoStatus, addCipaComissaoMembro, deleteCipaComissaoMembro,
    inscreverCipaCandidato, homologarCipaCandidato, apurarCipaUrna,
    salvarCipaMembrosIndicados, definirCipaCargos, darPosseCipa,
    getCipaReunioes, createCipaReuniao, createCipaReuniaoWithAnexo, uploadCipaAtaAnexo, assinarCipaAta,
    getCipaColaboradoresDisponiveis, addCipaMembroManual, deleteCipaMembroManual,
    getCipaAuditoria, auditarCipaComprovante
} from '../../../services/api';
import {
    generateEditalCipaPdf, generateAtaEleicaoCipaPdf,
    generateAtaPosseCipaPdf, generateAtaReuniaoCipaPdf
} from '../../../services/cipaPdfGenerator';
import { useHelp } from '../../../contexts/HelpContext';
import { useAuth } from '../../../contexts/AuthContext';

export default function CIPACentralPage() {
    const navigate = useNavigate();
    const { openHelp } = useHelp();
    const { user } = useAuth();

    // Gestões
    const [gestoes, setGestoes] = useState([]);
    const [selectedGestaoId, setSelectedGestaoId] = useState('');
    const [gestaoData, setGestaoData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Colaboradores da Metalfisa (RH)
    const [colaboradores, setColaboradores] = useState([]);

    // Reuniões & Atas
    const [reunioes, setReunioes] = useState([]);
    const [reuniaoArquivo, setReuniaoArquivo] = useState(null);
    const [uploadingAnexoReuniaoId, setUploadingAnexoReuniaoId] = useState(null);

    // Auditoria Eleitoral
    const [auditoriaData, setAuditoriaData] = useState(null);
    const [filtroAuditoria, setFiltroAuditoria] = useState('');
    const [hashPesquisa, setHashPesquisa] = useState('');
    const [resultadoAuditoriaHash, setResultadoAuditoriaHash] = useState(null);
    const [pesquisandoHash, setPesquisandoHash] = useState(false);

    // Abas: 'painel' | 'cronograma' | 'comissao' | 'candidatos' | 'urna' | 'membros' | 'reunioes' | 'auditoria'
    const [activeTab, setActiveTab] = useState('painel');

    // Modal Nova Gestão Eleitoral (NR-05)
    const [modalNovaGestaoOpen, setModalNovaGestaoOpen] = useState(false);
    const [novaGestaoForm, setNovaGestaoForm] = useState({
        ano_inicio: new Date().getFullYear(),
        ano_fim: new Date().getFullYear() + 1,
        descricao: `Gestão CIPA ${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        data_prevista_eleicao: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        vagas_titulares_eleitos: 4,
        vagas_suplentes_eleitos: 3,
        vagas_titulares_indicados: 4,
        vagas_suplentes_indicados: 3,
        observacoes: ''
    });
    const [savingGestao, setSavingGestao] = useState(false);

    // Modal CIPA Já Existente / Legada (Transição)
    const [modalGestaoLegadaOpen, setModalGestaoLegadaOpen] = useState(false);
    const [gestaoLegadaForm, setGestaoLegadaForm] = useState({
        ano_inicio: new Date().getFullYear(),
        ano_fim: new Date().getFullYear() + 1,
        descricao: `Gestão CIPA ${new Date().getFullYear()}/${new Date().getFullYear() + 1} (Em Andamento)`,
        data_posse: new Date().toISOString().split('T')[0],
        vagas_titulares_eleitos: 4,
        vagas_suplentes_eleitos: 3,
        vagas_titulares_indicados: 4,
        vagas_suplentes_indicados: 3,
        admin_auditoria_usuario_id: user?.idUsuario || '',
        email_auditoria: user?.email || '',
        observacoes: 'Cadastrada para continuidade de CIPA em andamento.'
    });
    const [savingGestaoLegada, setSavingGestaoLegada] = useState(false);

    // Modal Membro Manual (Para CIPA Legada ou Ajuste)
    const [modalMembroManualOpen, setModalMembroManualOpen] = useState(false);
    const [membroManualForm, setMembroManualForm] = useState({
        usuario_id: '',
        origem: 'eleito',
        tipo_vaga: 'titular',
        cargo_cipa: 'membro_titular'
    });
    const [savingMembroManual, setSavingMembroManual] = useState(false);

    // Modal Inscrição Candidato
    const [modalCandidatoOpen, setModalCandidatoOpen] = useState(false);
    const [candidatoForm, setCandidatoForm] = useState({
        usuario_id: '',
        nome_urna: '',
        cargo_setor: '',
        observacoes: ''
    });
    const [savingCandidato, setSavingCandidato] = useState(false);

    // Modal Nova Reunião
    const [modalReuniaoOpen, setModalReuniaoOpen] = useState(false);
    const [reuniaoForm, setReuniaoForm] = useState({
        numero_ata: '',
        tipo: 'ordinaria',
        mes_competencia: '',
        data_reuniao: new Date().toISOString().split('T')[0],
        horario_inicio: '09:00',
        horario_fim: '10:00',
        local: 'Sala de Reuniões Principal - Metalfisa',
        pauta: 'Reunião mensal ordinária da CIPA',
        conteudo_ata: 'Discussão e deliberação sobre as rotinas de segurança na fábrica e ações de combate ao assédio.'
    });
    const [savingReuniao, setSavingReuniao] = useState(false);

    // Modal Assinar Ata
    const [modalAssinarOpen, setModalAssinarOpen] = useState(false);
    const [reuniaoAssinarId, setReuniaoAssinarId] = useState(null);
    const [senhaAssinatura, setSenhaAssinatura] = useState('');
    const [savingAssinatura, setSavingAssinatura] = useState(false);

    // Carregar Lista de Gestões
    const loadGestoes = async () => {
        try {
            setLoading(true);
            const res = await getCipaGestoes();
            setGestoes(res || []);
            if (res && res.length > 0 && !selectedGestaoId) {
                setSelectedGestaoId(res[0].id);
            }
        } catch (err) {
            console.error('Erro ao carregar gestões CIPA:', err);
        } finally {
            setLoading(false);
        }
    };

    // Carregar Detalhes da Gestão Selecionada
    const loadGestaoDetalhes = async (id) => {
        if (!id) return;
        try {
            const data = await getCipaGestao(id);
            setGestaoData(data);

            // Carregar Reuniões
            getCipaReunioes(id).then(r => setReunioes(r || [])).catch(console.error);

            // Carregar Auditoria
            getCipaAuditoria(id).then(a => setAuditoriaData(a || null)).catch(console.error);
        } catch (err) {
            console.error('Erro ao carregar detalhes da gestão:', err);
        }
    };

    useEffect(() => {
        loadGestoes();
        getCipaColaboradoresDisponiveis().then(res => setColaboradores(res || [])).catch(console.error);
    }, []);

    useEffect(() => {
        if (selectedGestaoId) {
            loadGestaoDetalhes(selectedGestaoId);
        }
    }, [selectedGestaoId]);

    // Criar Nova Gestão
    const handleCreateGestao = async (e) => {
        e.preventDefault();
        try {
            setSavingGestao(true);
            const res = await createCipaGestao(novaGestaoForm);
            alert('Gestão CIPA criada com sucesso com todo o cronograma legal da NR-05!');
            setModalNovaGestaoOpen(false);
            await loadGestoes();
            if (res.gestao_id) {
                setSelectedGestaoId(res.gestao_id);
            }
        } catch (err) {
            alert('Erro ao criar gestão CIPA: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingGestao(false);
        }
    };

    // Criar CIPA Já Existente (Transição)
    const handleCreateGestaoLegada = async (e) => {
        e.preventDefault();
        try {
            setSavingGestaoLegada(true);
            const res = await createCipaGestaoLegada(gestaoLegadaForm);
            alert('CIPA em andamento cadastrada com sucesso! Mandato empossado e pronto para inclusão de membros e atas históricas.');
            setModalGestaoLegadaOpen(false);
            await loadGestoes();
            if (res.gestao_id) {
                setSelectedGestaoId(res.gestao_id);
            }
        } catch (err) {
            alert('Erro ao cadastrar CIPA em andamento: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingGestaoLegada(false);
        }
    };

    // Vincular Membro Manualmente
    const handleAddMembroManual = async (e) => {
        e.preventDefault();
        if (!membroManualForm.usuario_id) {
            alert('Por favor, selecione um colaborador.');
            return;
        }
        try {
            setSavingMembroManual(true);
            await addCipaMembroManual(selectedGestaoId, membroManualForm);
            alert('Membro vinculado com sucesso à composição da CIPA!');
            setModalMembroManualOpen(false);
            setMembroManualForm({
                usuario_id: '',
                origem: 'eleito',
                tipo_vaga: 'titular',
                cargo_cipa: 'membro_titular'
            });
            await loadGestaoDetalhes(selectedGestaoId);
        } catch (err) {
            alert('Erro ao vincular membro: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingMembroManual(false);
        }
    };

    // Excluir Membro Manual
    const handleDeleteMembro = async (membroId) => {
        if (!confirm('Deseja realmente remover este membro da CIPA?')) return;
        try {
            await deleteCipaMembroManual(selectedGestaoId, membroId);
            alert('Membro removido com sucesso.');
            await loadGestaoDetalhes(selectedGestaoId);
        } catch (err) {
            alert('Erro ao remover membro: ' + (err.response?.data?.error || err.message));
        }
    };

    // Avançar Status
    const handleUpdateStatus = async (novoStatus) => {
        if (!confirm(`Deseja alterar o status da gestão para "${novoStatus.toUpperCase()}"?`)) return;
        try {
            await updateCipaGestaoStatus(selectedGestaoId, novoStatus);
            await loadGestaoDetalhes(selectedGestaoId);
            await loadGestoes();
        } catch (err) {
            alert('Erro ao alterar status: ' + (err.response?.data?.error || err.message));
        }
    };

    // Inscrever Candidato
    const handleSaveCandidato = async (e) => {
        e.preventDefault();
        try {
            setSavingCandidato(true);
            await inscreverCipaCandidato(selectedGestaoId, candidatoForm);
            alert('Candidato inscrito com sucesso!');
            setModalCandidatoOpen(false);
            setCandidatoForm({ usuario_id: '', nome_urna: '', cargo_setor: '', observacoes: '' });
            await loadGestaoDetalhes(selectedGestaoId);
        } catch (err) {
            alert('Erro ao inscrever candidato: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingCandidato(false);
        }
    };

    // Apuração da Urna Eletrônica
    const handleApurarUrna = async (forcar = false) => {
        if (!confirm('Tem certeza que deseja encerrar a votação e apurar a urna eletrônica agora?')) return;
        try {
            const res = await apurarCipaUrna(selectedGestaoId, { forcar_apuracao: forcar });
            alert(`Urna apurada com sucesso! Total de votos: ${res.total_votos}. Ata de Eleição gerada.`);
            await loadGestaoDetalhes(selectedGestaoId);
            await loadGestoes();
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            if (msg.includes('Quórum legal')) {
                if (confirm(msg + '\n\nDeseja forçar a apuração mesmo assim (por decisão fundamentada da Comissão)?')) {
                    handleApurarUrna(true);
                }
            } else {
                alert('Erro na apuração: ' + msg);
            }
        }
    };

    // Salvar Reunião com Anexo (PDF, DOCX ou Imagem)
    const handleSaveReuniao = async (e) => {
        e.preventDefault();
        try {
            setSavingReuniao(true);
            if (reuniaoArquivo) {
                const formData = new FormData();
                Object.entries(reuniaoForm).forEach(([k, v]) => {
                    if (v !== undefined && v !== null) formData.append(k, v);
                });
                formData.append('arquivo_anexo', reuniaoArquivo);
                await createCipaReuniaoWithAnexo(selectedGestaoId, formData);
            } else {
                await createCipaReuniao(selectedGestaoId, reuniaoForm);
            }
            alert('Reunião e ata registradas com sucesso!');
            setModalReuniaoOpen(false);
            setReuniaoArquivo(null);
            setReuniaoForm({
                numero_ata: '',
                tipo: 'ordinaria',
                mes_competencia: '',
                data_reuniao: new Date().toISOString().split('T')[0],
                horario_inicio: '09:00',
                horario_fim: '10:00',
                local: 'Sala de Reuniões Principal - Metalfisa',
                pauta: 'Reunião mensal ordinária da CIPA',
                conteudo_ata: 'Discussão e deliberação sobre as rotinas de segurança na fábrica e ações de combate ao assédio.'
            });
            await loadGestaoDetalhes(selectedGestaoId);
        } catch (err) {
            alert('Erro ao agendar reunião: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingReuniao(false);
        }
    };

    // Upload de anexo para ata já existente
    const handleUploadAnexoAta = async (reuniaoId, file) => {
        if (!file) return;
        try {
            setUploadingAnexoReuniaoId(reuniaoId);
            const formData = new FormData();
            formData.append('arquivo_anexo', file);
            await uploadCipaAtaAnexo(reuniaoId, formData);
            alert('Documento digitalizado/anexo enviado com sucesso à ata!');
            await loadGestaoDetalhes(selectedGestaoId);
        } catch (err) {
            alert('Erro ao anexar documento: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploadingAnexoReuniaoId(null);
        }
    };

    // Assinar Ata
    const handleConfirmAssinatura = async (e) => {
        e.preventDefault();
        try {
            setSavingAssinatura(true);
            await assinarCipaAta(reuniaoAssinarId, { senha: senhaAssinatura });
            alert('Ata assinada digitalmente com sucesso!');
            setModalAssinarOpen(false);
            setSenhaAssinatura('');
            await loadGestaoDetalhes(selectedGestaoId);
        } catch (err) {
            alert('Erro ao assinar ata: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingAssinatura(false);
        }
    };

    // Auditar Comprovante por Hash
    const handleConsultarHash = async (e) => {
        e.preventDefault();
        if (!hashPesquisa.trim()) return;
        try {
            setPesquisandoHash(true);
            setResultadoAuditoriaHash(null);
            const res = await auditarCipaComprovante(hashPesquisa.trim());
            setResultadoAuditoriaHash(res);
        } catch (err) {
            setResultadoAuditoriaHash({
                valido: false,
                mensagem: err.response?.data?.mensagem || 'Comprovante não localizado ou inválido no ecossistema eleitoral.'
            });
        } finally {
            setPesquisandoHash(false);
        }
    };

    const statusBadge = (st) => {
        switch (st) {
            case 'eleicao':
                return <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-1.5"><Vote className="w-3.5 h-3.5" /> Urna Aberta (Votação)</span>;
            case 'inscricoes':
                return <span className="bg-blue-100 text-blue-800 border border-blue-300 px-3 py-1 rounded-full text-xs font-bold">Inscrições Abertas</span>;
            case 'apurada':
                return <span className="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full text-xs font-bold">Eleição Apurada</span>;
            case 'empossada':
                return <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-bold">Mandato Empossado</span>;
            case 'concluida':
                return <span className="bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1 rounded-full text-xs font-bold">Mandato Concluído</span>;
            default:
                return <span className="bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1 rounded-full text-xs font-bold">Planejamento</span>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
            {/* Header Corporativo */}
            <div className="bg-[#1F365C] text-white py-8 px-6 sm:px-10 shadow-lg border-b border-slate-700 relative overflow-hidden">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                            <Award className="w-4 h-4" />
                            <span>Segurança e Saúde no Trabalho — NR-05 & Lei 14.457/2022</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            CIPA — Comissão de Prevenção de Acidentes e Assédio
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
                            Ecossistema integrado: processo eleitoral, urna eletrônica com sigilo absoluto, quórum em tempo real, geração automática de atas e gestão contínua de reuniões.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Seletor de Gestão */}
                        <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-xl border border-white/20 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-amber-300 ml-2" />
                            <select
                                value={selectedGestaoId}
                                onChange={(e) => setSelectedGestaoId(e.target.value)}
                                className="bg-transparent text-white text-xs font-bold border-none outline-none pr-3 cursor-pointer"
                            >
                                {gestoes.map(g => (
                                    <option key={g.id} value={g.id} className="text-slate-900 font-medium">
                                        Gestão {g.ano_inicio}/{g.ano_fim} ({g.status})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => setModalGestaoLegadaOpen(true)}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                            <History className="w-4 h-4" />
                            <span>CIPA Já Existente (Transição)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setModalNovaGestaoOpen(true)}
                            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Nova Eleição (NR-05)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => openHelp('/sst/cipa')}
                            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-all cursor-pointer"
                            title="Ajuda de Contexto CIPA"
                        >
                            <HelpCircle className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Sub-header de Navegação por Abas */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between overflow-x-auto">
                    <div className="flex items-center gap-1 sm:gap-2 py-2">
                        {[
                            { id: 'painel', label: 'Painel Geral', icon: ShieldCheck },
                            { id: 'cronograma', label: 'Cronograma Legal (NR-05)', icon: Calendar },
                            { id: 'comissao', label: 'Comissão Eleitoral', icon: Users },
                            { id: 'candidatos', label: 'Candidatos Inscritos', icon: UserCheck },
                            { id: 'urna', label: 'Urna Eletrônica & Quórum', icon: Vote },
                            { id: 'membros', label: 'Membros & Posse', icon: Award },
                            { id: 'reunioes', label: 'Reuniões & Atas Mensais', icon: FileText },
                            { id: 'auditoria', label: 'Auditoria & Comprovantes', icon: Lock }
                        ].map(t => {
                            const Icon = t.icon;
                            const isActive = activeTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setActiveTab(t.id)}
                                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                                        isActive 
                                            ? 'bg-[#1F365C] text-white shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{t.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {gestaoData && (
                        <div className="hidden lg:flex items-center gap-3 pl-4 border-l border-slate-200">
                            {statusBadge(gestaoData.status)}
                        </div>
                    )}
                </div>
            </div>

            {/* Conteúdo Principal */}
            <div className="max-w-7xl mx-auto px-6 mt-8">
                {/* 1. ABA PAINEL GERAL */}
                {activeTab === 'painel' && gestaoData && (
                    <div className="space-y-6">
                        {/* KPIs Rápidos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Eleitores Aptos</p>
                                    <p className="text-2xl font-black text-slate-900">{gestaoData.total_aptos_calculado || 0}</p>
                                    <p className="text-[11px] text-slate-400">Total de trabalhadores ativos</p>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                                    <Vote className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Votos Coletados</p>
                                    <p className="text-2xl font-black text-slate-900">{gestaoData.total_votos_coletados || 0}</p>
                                    <p className="text-[11px] text-emerald-600 font-bold">
                                        Quórum: {gestaoData.percentual_quorum}% (Mínimo: {gestaoData.quorum_minimo_necessario})
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
                                    <UserCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Candidatos Inscritos</p>
                                    <p className="text-2xl font-black text-slate-900">{gestaoData.candidatos?.length || 0}</p>
                                    <p className="text-[11px] text-slate-400">Representantes empregados</p>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                                    <Award className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Vagas Paritárias</p>
                                    <p className="text-2xl font-black text-slate-900">
                                        {(gestaoData.vagas_titulares_eleitos + gestaoData.vagas_suplentes_eleitos) * 2} vagas
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        {gestaoData.vagas_titulares_eleitos} Tit. + {gestaoData.vagas_suplentes_eleitos} Supl. cada
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Banner da Urna Eletrônica Aberta */}
                        {gestaoData.status === 'eleicao' && (
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-white/20 rounded-2xl">
                                        <Vote className="w-10 h-10 text-white animate-bounce" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black">Urna Eletrônica Oficial ABERTA para Votação!</h3>
                                        <p className="text-emerald-100 text-xs sm:text-sm mt-1 max-w-xl">
                                            Os colaboradores podem exercer o voto anônimo direto pelo smartphone ou através do Totem físico.
                                            Quórum atual registrado: <strong>{gestaoData.percentual_quorum}%</strong> ({gestaoData.total_votos_coletados} votos).
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Link
                                        to="/sst/cipa/urna"
                                        className="px-5 py-3 bg-white hover:bg-emerald-50 text-emerald-900 rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        <span>Abrir Cabine / Totem</span>
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => handleApurarUrna(false)}
                                        className="px-5 py-3 bg-emerald-900 hover:bg-emerald-950 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer"
                                    >
                                        <Check className="w-4 h-4" />
                                        <span>Encerrar & Apurar</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Ações e Próximos Passos */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-amber-500" />
                                <span>Fluxo e Transições do Processo Eleitoral da CIPA</span>
                            </h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    disabled={gestaoData.status !== 'planejamento'}
                                    onClick={() => handleUpdateStatus('inscricoes')}
                                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all"
                                >
                                    1. Abrir Período de Inscrições
                                </button>
                                <button
                                    type="button"
                                    disabled={gestaoData.status !== 'inscricoes'}
                                    onClick={() => handleUpdateStatus('eleicao')}
                                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all"
                                >
                                    2. Abrir Urna Eletrônica (Votação)
                                </button>
                                <button
                                    type="button"
                                    disabled={gestaoData.status !== 'eleicao'}
                                    onClick={() => handleApurarUrna(false)}
                                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all"
                                >
                                    3. Apurar Urna & Gerar Ata de Eleição
                                </button>
                                <button
                                    type="button"
                                    disabled={gestaoData.status !== 'apurada'}
                                    onClick={() => handleUpdateStatus('empossada')}
                                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all"
                                >
                                    4. Dar Posse Oficial & Iniciar Mandato
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. ABA CRONOGRAMA LEGAL */}
                {activeTab === 'cronograma' && gestaoData && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-base font-black text-slate-900">Cronograma Oficial de Prazos Legais (NR-05)</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Controle automático das 9 etapas regulamentares obrigatórias da Secretaria de Trabalho e Emprego.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => generateEditalCipaPdf({
                                    gestao: gestaoData,
                                    cronograma: gestaoData.cronograma,
                                    comissao: gestaoData.comissao
                                })}
                                className="px-4 py-2.5 bg-[#1F365C] hover:bg-[#162744] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                            >
                                <Printer className="w-4 h-4" />
                                <span>Emitir Edital de Convocação (PDF)</span>
                            </button>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {(gestaoData.cronograma || []).map((etapa, idx) => (
                                <div key={etapa.id || idx} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{etapa.descricao_etapa}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">Prazo de referência legal: {etapa.dias_prazo_nr05} dias</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-800">
                                                {etapa.data_prevista ? new Date(etapa.data_prevista).toLocaleDateString('pt-BR') : 'A definir'}
                                            </p>
                                            <span className="text-[10px] text-slate-400">Data limite legal</span>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                            etapa.status === 'concluido' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {etapa.status === 'concluido' ? 'Concluído' : 'Programado'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. ABA CANDIDATOS */}
                {activeTab === 'candidatos' && gestaoData && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div>
                                <h3 className="text-base font-black text-slate-900">Candidatos a Representantes dos Empregados</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Inscrições abertas a todos os colaboradores com garantia de estabilidade provisória.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalCandidatoOpen(true)}
                                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Inscrever Candidato</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {(gestaoData.candidatos || []).map(cand => (
                                <div key={cand.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-600 shrink-0">
                                            {cand.foto_url ? (
                                                <img src={cand.foto_url} alt={cand.nome_urna} className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{cand.nome_urna?.substring(0, 2).toUpperCase() || 'CP'}</span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                                Chapa {cand.numero_chapa}
                                            </span>
                                            <h4 className="text-sm font-bold text-slate-900 truncate mt-1">{cand.nome_urna}</h4>
                                            <p className="text-xs text-slate-500 truncate">{cand.cargo_setor || 'Fábrica'}</p>
                                        </div>
                                    </div>

                                    {gestaoData.status === 'apurada' && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-700">{cand.total_votos || 0} votos</span>
                                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                                cand.resultado === 'titular_eleito' ? 'bg-emerald-100 text-emerald-800' :
                                                cand.resultado === 'suplente_eleito' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {cand.resultado === 'titular_eleito' ? 'Titular Eleito' :
                                                 cand.resultado === 'suplente_eleito' ? 'Suplente Eleito' : 'Não Eleito'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 4. ABA URNA ELETRÔNICA & QUÓRUM */}
                {activeTab === 'urna' && gestaoData && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                                <Vote className="w-5 h-5 text-emerald-600" />
                                <span>Monitoramento de Quórum da Votação em Tempo Real</span>
                            </h3>

                            {/* Barra de Progresso do Quórum */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold">
                                    <span>Votantes Registrados: {gestaoData.total_votos_coletados} de {gestaoData.total_aptos_calculado} ({gestaoData.percentual_quorum}%)</span>
                                    <span>Quórum Mínimo Obrigatório: {gestaoData.quorum_minimo_necessario} votos (50% + 1)</span>
                                </div>
                                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                    <div
                                        className={`h-full transition-all duration-500 ${
                                            gestaoData.percentual_quorum >= 50 ? 'bg-emerald-500' : 'bg-amber-500'
                                        }`}
                                        style={{ width: `${Math.min(gestaoData.percentual_quorum, 100)}%` }}
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    * Conforme a NR-05.5.4, a apuração somente pode ser homologada se o quórum atingir mais de 50% dos trabalhadores da empresa.
                                </p>
                            </div>

                            <div className="mt-6 flex items-center gap-3">
                                <Link
                                    to="/sst/cipa/urna"
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                                >
                                    <Vote className="w-4 h-4" />
                                    <span>Abrir Cabine de Votação (Totem)</span>
                                </Link>

                                {gestaoData.status === 'apurada' && (
                                    <button
                                        type="button"
                                        onClick={() => generateAtaEleicaoCipaPdf({
                                            gestao: gestaoData,
                                            candidatos: gestaoData.candidatos,
                                            totalAptos: gestaoData.total_aptos_calculado,
                                            totalVotaram: gestaoData.total_votos_coletados
                                        })}
                                        className="px-4 py-2.5 bg-[#1F365C] hover:bg-[#162744] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                                    >
                                        <Printer className="w-4 h-4" />
                                        <span>Baixar Ata de Eleição & Apuração (PDF)</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. ABA MEMBROS & POSSE */}
                {activeTab === 'membros' && gestaoData && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-base font-black text-slate-900">Composição Oficial da CIPA</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Representação paritária: empregados eleitos e indicados da empresa (NR-05).
                                    {gestaoData.tipo_gestao === 'legada_existente' && (
                                        <span className="ml-2 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            Gestão em Andamento (Transição)
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setModalMembroManualOpen(true)}
                                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    <span>Vincular Membro Manualmente</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => generateAtaPosseCipaPdf({
                                        gestao: gestaoData,
                                        membros: gestaoData.membros
                                    })}
                                    className="px-4 py-2.5 bg-[#1F365C] hover:bg-[#162744] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>Emitir Ata de Posse da CIPA (PDF)</span>
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                        <th className="p-3">Foto</th>
                                        <th className="p-3">Cipeiro</th>
                                        <th className="p-3">Cargo na CIPA</th>
                                        <th className="p-3">Representação</th>
                                        <th className="p-3">Vaga</th>
                                        <th className="p-3">Treinamento 20h</th>
                                        <th className="p-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(gestaoData.membros || []).length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="p-8 text-center text-slate-400">
                                                Nenhum membro cadastrado nesta gestão. Clique em "Vincular Membro Manualmente" para compor a comissão.
                                            </td>
                                        </tr>
                                    ) : (
                                        (gestaoData.membros || []).map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-3">
                                                    <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center font-bold text-slate-700 shrink-0">
                                                        {m.foto_exibicao || m.fotoUsuario ? (
                                                            <img src={m.foto_exibicao || m.fotoUsuario} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span>{m.nome_completo?.substring(0, 2).toUpperCase() || 'CP'}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-900">{m.nome_completo}</div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {m.Matricula ? `Matrícula: ${m.Matricula} • ` : ''}{m.Funcao || m.Setor || 'Metalfisa'}
                                                    </div>
                                                </td>
                                                <td className="p-3 font-bold text-blue-700 uppercase">
                                                    {m.cargo_cipa?.replace('_', ' ')}
                                                </td>
                                                <td className="p-3 text-slate-600">
                                                    {m.origem === 'eleito' ? (
                                                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold">
                                                            Eleito pelos Empregados
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                                            Indicado pelo Empregador
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-slate-600 uppercase font-semibold">{m.tipo_vaga}</td>
                                                <td className="p-3 text-emerald-600 font-bold">✓ Concluído (20h)</td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteMembro(m.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Remover membro da CIPA"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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

                {/* 6. ABA REUNIÕES & ATAS MENSAIS */}
                {activeTab === 'reunioes' && gestaoData && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div>
                                <h3 className="text-base font-black text-slate-900">Reuniões Ordinárias & Extraordinárias (Atas NR-05)</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Atas digitais mensais com assinatura eletrônica e suporte para anexar documentos históricos digitalizados (PDF / Word / Imagem).
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalReuniaoOpen(true)}
                                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Agendar Reunião / Anexar Ata</span>
                            </button>
                        </div>

                        {/* Lista de Atas Reais */}
                        <div className="space-y-4">
                            {reunioes.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
                                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <h4 className="font-bold text-slate-800 text-sm">Nenhuma reunião ou ata cadastrada</h4>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Clique em "Agendar Reunião / Anexar Ata" para registrar reuniões ordinárias ou anexar atas físicas já existentes.
                                    </p>
                                </div>
                            ) : (
                                reunioes.map((r, idx) => (
                                    <div key={r.id || idx} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-300 transition-colors">
                                        <div className="space-y-1.5 max-w-2xl">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-bold text-sm text-slate-900">
                                                    Ata {r.numero_ata ? `Nº ${r.numero_ata}` : `Reunião ${idx + 1}`} — {r.tipo === 'extraordinaria' ? 'Reunião Extraordinária' : 'Reunião Ordinária'}
                                                </h4>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    r.status === 'assinada' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                }`}>
                                                    {r.status === 'assinada' ? 'Ata Homologada / Assinada' : 'Aguardando Assinaturas'}
                                                </span>
                                                <span className="text-xs text-slate-500 font-medium">
                                                    📅 {r.data_reuniao ? new Date(r.data_reuniao).toLocaleDateString('pt-BR') : 'Data não informada'} • {r.horario_inicio || '09:00'} às {r.horario_fim || '10:00'}
                                                </span>
                                            </div>

                                            <p className="text-xs text-slate-700">
                                                <strong>Pauta:</strong> {r.pauta}
                                            </p>

                                            {r.local && (
                                                <p className="text-[11px] text-slate-500">
                                                    <strong>Local:</strong> {r.local}
                                                </p>
                                            )}

                                            {/* Badge do Arquivo Anexo Digitalizado (PDF/Word) */}
                                            {r.arquivo_anexo_url ? (
                                                <div className="pt-1 flex items-center gap-2">
                                                    <a
                                                        href={r.arquivo_anexo_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 transition-colors"
                                                    >
                                                        <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span className="truncate max-w-[280px]">{r.arquivo_nome_original || 'Visualizar Ata Digitalizada / Anexo'}</span>
                                                        <ExternalLink className="w-3 h-3 text-emerald-600" />
                                                    </a>
                                                    <span className="text-[10px] text-slate-400">Documento anexado</span>
                                                </div>
                                            ) : (
                                                <div className="pt-1">
                                                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 cursor-pointer transition-colors">
                                                        <Upload className="w-3.5 h-3.5" />
                                                        <span>{uploadingAnexoReuniaoId === r.id ? 'Enviando...' : 'Anexar Ata Digitalizada / Word / PDF'}</span>
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                                            disabled={uploadingAnexoReuniaoId === r.id}
                                                            onChange={(e) => handleUploadAnexoAta(r.id, e.target.files[0])}
                                                        />
                                                    </label>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReuniaoAssinarId(r.id);
                                                    setModalAssinarOpen(true);
                                                }}
                                                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                                            >
                                                Assinar Digitalmente
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => generateAtaReuniaoCipaPdf({
                                                    reuniao: r,
                                                    gestao: gestaoData,
                                                    presencas: gestaoData.membros || []
                                                })}
                                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200"
                                                title="Baixar Ata Oficial em PDF"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* 7. ABA AUDITORIA & COMPROVANTES (NOVO - REQUISITO AUDIOS CIPA) */}
                {activeTab === 'auditoria' && gestaoData && (
                    <div className="space-y-6">
                        {/* Banner Informativo sobre Blindagem NR-05 e Auditoria */}
                        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white border border-slate-700 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                    <span>Auditoria Eleitoral e Sigilo Constitucional NR-05</span>
                                </div>
                                <h3 className="text-lg font-black text-white">Central de Conformidade & Verificação de Comprovantes</h3>
                                <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                                    A cada voto concluído na Urna, um token criptográfico SHA-256 é emitido e disparado automaticamente para o WhatsApp e/ou E-mail do colaborador, com envio de protocolo simultâneo para o Administrador da CIPA / SESMT.
                                    As cédulas de votação são gravadas em tabela desacoplada sem identificador de usuário, garantindo 100% de sigilo legal.
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold">
                                    Blindagem Zero-Knowledge
                                </span>
                            </div>
                        </div>

                        {/* KPIs de Disparo e Votação */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Total de Aptos</p>
                                    <p className="text-2xl font-black text-slate-900">{gestaoData.total_aptos_calculado || 0}</p>
                                    <p className="text-[11px] text-slate-400">Quórum mín: {gestaoData.quorum_minimo_necessario}</p>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                                    <Vote className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Votos Depositados</p>
                                    <p className="text-2xl font-black text-slate-900">{auditoriaData?.totais?.total_votantes || gestaoData.total_votos_coletados || 0}</p>
                                    <p className="text-[11px] text-emerald-600 font-bold">Presença confirmada</p>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                                    <Smartphone className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Comprovantes WhatsApp</p>
                                    <p className="text-2xl font-black text-slate-900">{auditoriaData?.totais?.enviados_whatsapp || 0}</p>
                                    <p className="text-[11px] text-slate-400">Disparos diretos ou manuais</p>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-sky-50 text-sky-700 rounded-xl">
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Comprovantes E-mail</p>
                                    <p className="text-2xl font-black text-slate-900">{auditoriaData?.totais?.enviados_email || 0}</p>
                                    <p className="text-[11px] text-slate-400">Notificações eletrônicas</p>
                                </div>
                            </div>
                        </div>

                        {/* Ferramenta: Validador de Token / Comprovante */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                            <div className="flex items-center gap-2">
                                <Search className="w-5 h-5 text-amber-500" />
                                <h3 className="text-base font-black text-slate-900">Validar Código de Comprovante de Votação</h3>
                            </div>
                            <p className="text-xs text-slate-500">
                                Cole abaixo o código do comprovante apresentado pelo eleitor para validar sua autenticidade no registro imutável do sistema.
                            </p>

                            <form onSubmit={handleConsultarHash} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                <input
                                    type="text"
                                    placeholder="Ex: CIPA-2026-c29007fba6b1f24d7734..."
                                    value={hashPesquisa}
                                    onChange={(e) => setHashPesquisa(e.target.value)}
                                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-600"
                                />
                                <button
                                    type="submit"
                                    disabled={pesquisandoHash || !hashPesquisa.trim()}
                                    className="px-5 py-2.5 bg-[#1F365C] hover:bg-[#162744] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>{pesquisandoHash ? 'Consultando...' : 'Verificar Autenticidade'}</span>
                                </button>
                            </form>

                            {/* Resultado da Validação do Comprovante */}
                            {resultadoAuditoriaHash && (
                                <div className={`p-4 rounded-xl border text-xs animate-fade-in ${
                                    resultadoAuditoriaHash.valido 
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                                        : 'bg-red-50 border-red-200 text-red-900'
                                }`}>
                                    {resultadoAuditoriaHash.valido ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                                <span>Comprovante Autêntico e Válido no Registro da CIPA!</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-slate-700">
                                                <div><strong>Eleitor:</strong> {resultadoAuditoriaHash.eleitor_auditado}</div>
                                                <div><strong>Matrícula:</strong> {resultadoAuditoriaHash.matricula_auditada}</div>
                                                <div><strong>Data/Hora:</strong> {new Date(resultadoAuditoriaHash.data_hora_voto).toLocaleString('pt-BR')}</div>
                                                <div><strong>Canal:</strong> {resultadoAuditoriaHash.canal}</div>
                                            </div>
                                            <div className="text-[11px] text-emerald-700 pt-1 border-t border-emerald-200/60 font-mono break-all">
                                                Hash SHA-256: {resultadoAuditoriaHash.hash_comprovante}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 font-bold text-red-700">
                                            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                                            <span>{resultadoAuditoriaHash.mensagem}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Tabela de Eleitores que Votaram (Audit Trail) */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Registro de Presença Eleitoral & Disparo de Comprovantes</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Relação auditável dos colaboradores que registraram presença na urna desta eleição.
                                    </p>
                                </div>
                                <div className="w-full sm:w-64">
                                    <input
                                        type="text"
                                        placeholder="Buscar por colaborador ou matrícula..."
                                        value={filtroAuditoria}
                                        onChange={(e) => setFiltroAuditoria(e.target.value)}
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                            <th className="p-3">Eleitor</th>
                                            <th className="p-3">Data e Hora do Voto</th>
                                            <th className="p-3">Dispositivo / IP</th>
                                            <th className="p-3">WhatsApp</th>
                                            <th className="p-3">E-mail</th>
                                            <th className="p-3 text-right">Comprovante (Hash)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(!auditoriaData?.eleitores || auditoriaData.eleitores.length === 0) ? (
                                            <tr>
                                                <td colSpan="6" className="p-8 text-center text-slate-400">
                                                    Nenhum voto registrado até o momento nesta gestão.
                                                </td>
                                            </tr>
                                        ) : (
                                            auditoriaData.eleitores
                                                .filter(el => {
                                                    if (!filtroAuditoria.trim()) return true;
                                                    const term = filtroAuditoria.toLowerCase();
                                                    return (
                                                        (el.NomeCompleto && el.NomeCompleto.toLowerCase().includes(term)) ||
                                                        (el.Matricula && String(el.Matricula).toLowerCase().includes(term)) ||
                                                        (el.Setor && el.Setor.toLowerCase().includes(term))
                                                    );
                                                })
                                                .map(el => (
                                                    <tr key={el.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-3 flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center font-bold text-slate-700 shrink-0">
                                                                {el.fotoUsuario ? (
                                                                    <img src={el.fotoUsuario} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span>{el.NomeCompleto?.substring(0, 2).toUpperCase() || 'EL'}</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900">{el.NomeCompleto}</div>
                                                                <div className="text-[11px] text-slate-500">
                                                                    {el.Matricula ? `Matrícula: ${el.Matricula} • ` : ''}{el.Setor || 'Fábrica'}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-slate-700 font-medium">
                                                            {el.data_hora_voto ? new Date(el.data_hora_voto).toLocaleString('pt-BR') : '—'}
                                                        </td>
                                                        <td className="p-3 text-slate-600 font-mono text-[11px]">
                                                            {el.dispositivo || 'Totem Urna'} {el.ip_origem ? `(${el.ip_origem})` : ''}
                                                        </td>
                                                        <td className="p-3">
                                                            {el.comprovante_enviado_whatsapp ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                    ✓ Enviado
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                    Não enviado
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3">
                                                            {el.comprovante_enviado_email ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                                                    ✓ Enviado
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                    Não enviado
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            {el.hash_comprovante ? (
                                                                <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded border border-slate-200 font-mono text-[11px] text-slate-800">
                                                                    <span>{el.hash_comprovante.slice(0, 16)}...</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(el.hash_comprovante);
                                                                            alert('Hash do comprovante copiado!');
                                                                        }}
                                                                        className="text-slate-500 hover:text-slate-800 cursor-pointer"
                                                                        title="Copiar Hash Completo"
                                                                    >
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL NOVA GESTÃO CIPA */}
            {modalNovaGestaoOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                <Award className="w-5 h-5 text-amber-500" />
                                <span>Criar Nova Gestão CIPA (NR-05)</span>
                            </h3>
                            <button onClick={() => setModalNovaGestaoOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateGestao} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-slate-700">Ano Início</label>
                                    <input
                                        type="number"
                                        required
                                        value={novaGestaoForm.ano_inicio}
                                        onChange={(e) => setNovaGestaoForm(prev => ({ ...prev, ano_inicio: Number(e.target.value) }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700">Ano Término</label>
                                    <input
                                        type="number"
                                        required
                                        value={novaGestaoForm.ano_fim}
                                        onChange={(e) => setNovaGestaoForm(prev => ({ ...prev, ano_fim: Number(e.target.value) }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700">Data Prevista da Eleição (Votação)</label>
                                <input
                                    type="date"
                                    required
                                    value={novaGestaoForm.data_prevista_eleicao}
                                    onChange={(e) => setNovaGestaoForm(prev => ({ ...prev, data_prevista_eleicao: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                                />
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    O sistema calculará automaticamente todos os prazos legais da NR-05 baseando-se nesta data.
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-slate-700">Titulares Eleitos (Empregados)</label>
                                    <input
                                        type="number"
                                        value={novaGestaoForm.vagas_titulares_eleitos}
                                        onChange={(e) => setNovaGestaoForm(prev => ({ ...prev, vagas_titulares_eleitos: Number(e.target.value) }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700">Suplentes Eleitos (Empregados)</label>
                                    <input
                                        type="number"
                                        value={novaGestaoForm.vagas_suplentes_eleitos}
                                        onChange={(e) => setNovaGestaoForm(prev => ({ ...prev, vagas_suplentes_eleitos: Number(e.target.value) }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setModalNovaGestaoOpen(false)}
                                    className="px-4 py-2 border rounded-xl text-slate-600 font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingGestao}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold"
                                >
                                    {savingGestao ? 'Gerando Cronograma...' : 'Criar Gestão'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL CIPA JÁ EXISTENTE / TRANSICIONAL */}
            {modalGestaoLegadaOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                <History className="w-5 h-5 text-emerald-600" />
                                <span>Cadastrar CIPA Já Existente em Andamento (Transição)</span>
                            </h3>
                            <button onClick={() => setModalGestaoLegadaOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-4 text-xs text-emerald-900">
                            <strong>Continuidade Operacional:</strong> Utilize esta opção para cadastrar a comissão CIPA que já está em exercício na empresa. O mandato será criado como <strong>Empossado</strong> imediatamente, permitindo vincular os membros atuais e anexar atas históricas digitalizadas (PDF ou Word).
                        </div>

                        <form onSubmit={handleCreateGestaoLegada} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-slate-700">Ano Início da Gestão</label>
                                    <input
                                        type="number"
                                        required
                                        value={gestaoLegadaForm.ano_inicio}
                                        onChange={(e) => setGestaoLegadaForm(prev => ({ ...prev, ano_inicio: Number(e.target.value) }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700">Ano Término da Gestão</label>
                                    <input
                                        type="number"
                                        required
                                        value={gestaoLegadaForm.ano_fim}
                                        onChange={(e) => setGestaoLegadaForm(prev => ({ ...prev, ano_fim: Number(e.target.value) }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700">Título / Descrição da Gestão</label>
                                <input
                                    type="text"
                                    required
                                    value={gestaoLegadaForm.descricao}
                                    onChange={(e) => setGestaoLegadaForm(prev => ({ ...prev, descricao: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-700">Data de Posse Original</label>
                                <input
                                    type="date"
                                    required
                                    value={gestaoLegadaForm.data_posse}
                                    onChange={(e) => setGestaoLegadaForm(prev => ({ ...prev, data_posse: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-slate-700">Titulares Eleitos (Empregados)</label>
                                    <input
                                        type="number"
                                        value={gestaoLegadaForm.vagas_titulares_eleitos}
                                        onChange={(e) => setGestaoLegadaForm(prev => ({ ...prev, vagas_titulares_eleitos: Number(e.target.value) }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700">Suplentes Eleitos (Empregados)</label>
                                    <input
                                        type="number"
                                        value={gestaoLegadaForm.vagas_suplentes_eleitos}
                                        onChange={(e) => setGestaoLegadaForm(prev => ({ ...prev, vagas_suplentes_eleitos: Number(e.target.value) }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700">Administrador / SESMT para Auditoria de Presença</label>
                                <select
                                    value={gestaoLegadaForm.admin_auditoria_usuario_id}
                                    onChange={(e) => {
                                        const uid = e.target.value;
                                        const c = colaboradores.find(col => String(col.idUsuario) === String(uid));
                                        setGestaoLegadaForm(prev => ({
                                            ...prev,
                                            admin_auditoria_usuario_id: uid,
                                            email_auditoria: c?.email || prev.email_auditoria
                                        }));
                                    }}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white"
                                >
                                    <option value="">Selecione o Administrador / Responsável...</option>
                                    {colaboradores.map(c => (
                                        <option key={c.idUsuario} value={c.idUsuario}>
                                            {c.NomeCompleto} ({c.Funcao || c.Setor || 'Colaborador'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700">E-mail para Recebimento de Auditoria</label>
                                <input
                                    type="email"
                                    placeholder="sesmt@metalfisa.com.br"
                                    value={gestaoLegadaForm.email_auditoria}
                                    onChange={(e) => setGestaoLegadaForm(prev => ({ ...prev, email_auditoria: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-700">Observações Históricas</label>
                                <textarea
                                    rows="2"
                                    value={gestaoLegadaForm.observacoes}
                                    onChange={(e) => setGestaoLegadaForm(prev => ({ ...prev, observacoes: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setModalGestaoLegadaOpen(false)} className="px-4 py-2 border rounded-xl text-slate-600 font-bold">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={savingGestaoLegada} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">
                                    {savingGestaoLegada ? 'Cadastrando...' : 'Cadastrar e Iniciar Gestão'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL VINCULAR MEMBRO MANUALMENTE */}
            {modalMembroManualOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-blue-600" />
                                <span>Vincular Membro da CIPA</span>
                            </h3>
                            <button onClick={() => setModalMembroManualOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddMembroManual} className="space-y-4 text-xs">
                            <div>
                                <label className="font-bold text-slate-700">Colaborador (Cadastro Oficial Metalfisa)</label>
                                <select
                                    required
                                    value={membroManualForm.usuario_id}
                                    onChange={(e) => setMembroManualForm(prev => ({ ...prev, usuario_id: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white"
                                >
                                    <option value="">Selecione o colaborador...</option>
                                    {colaboradores.map(c => (
                                        <option key={c.idUsuario} value={c.idUsuario}>
                                            {c.NomeCompleto} {c.Matricula ? `(Matr: ${c.Matricula})` : ''} - {c.Funcao || c.Setor || ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Preview do colaborador selecionado */}
                            {membroManualForm.usuario_id && (() => {
                                const sel = colaboradores.find(c => String(c.idUsuario) === String(membroManualForm.usuario_id));
                                if (!sel) return null;
                                return (
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 border rounded-xl">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 border overflow-hidden flex items-center justify-center font-bold text-slate-700 shrink-0">
                                            {sel.fotoUsuario ? (
                                                <img src={sel.fotoUsuario} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{sel.NomeCompleto?.substring(0, 2).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-bold text-slate-900 truncate">{sel.NomeCompleto}</p>
                                            <p className="text-[11px] text-slate-500 truncate">{sel.Funcao} • {sel.Setor}</p>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-slate-700">Origem / Representação</label>
                                    <select
                                        value={membroManualForm.origem}
                                        onChange={(e) => setMembroManualForm(prev => ({ ...prev, origem: e.target.value }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white"
                                    >
                                        <option value="eleito">Eleito pelos Empregados</option>
                                        <option value="indicado">Indicado pelo Empregador</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700">Tipo de Vaga</label>
                                    <select
                                        value={membroManualForm.tipo_vaga}
                                        onChange={(e) => setMembroManualForm(prev => ({ ...prev, tipo_vaga: e.target.value }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white"
                                    >
                                        <option value="titular">Titular</option>
                                        <option value="suplente">Suplente</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700">Cargo Oficial na CIPA</label>
                                <select
                                    value={membroManualForm.cargo_cipa}
                                    onChange={(e) => setMembroManualForm(prev => ({ ...prev, cargo_cipa: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white"
                                >
                                    <option value="presidente">Presidente</option>
                                    <option value="vice_presidente">Vice-Presidente</option>
                                    <option value="secretario">Secretário</option>
                                    <option value="secretario_substituto">Secretário Substituto</option>
                                    <option value="membro_titular">Membro Titular</option>
                                    <option value="membro_suplente">Membro Suplente</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setModalMembroManualOpen(false)} className="px-4 py-2 border rounded-xl text-slate-600 font-bold">Cancelar</button>
                                <button type="submit" disabled={savingMembroManual} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold">
                                    {savingMembroManual ? 'Vinculando...' : 'Confirmar Membro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL INSCREVER CANDIDATO */}
            {modalCandidatoOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <h3 className="font-bold text-slate-900 text-base">Inscrição de Candidato CIPA</h3>
                            <button onClick={() => setModalCandidatoOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveCandidato} className="space-y-4 text-xs">
                            <div>
                                <label className="font-bold text-slate-700">Selecionar Colaborador (RH)</label>
                                <select
                                    value={candidatoForm.usuario_id}
                                    onChange={(e) => {
                                        const uid = e.target.value;
                                        const colab = colaboradores.find(c => String(c.idUsuario) === String(uid));
                                        setCandidatoForm(prev => ({
                                            ...prev,
                                            usuario_id: uid,
                                            nome_urna: colab ? colab.NomeCompleto : prev.nome_urna,
                                            cargo_setor: colab ? `${colab.Funcao || ''} (${colab.Setor || ''})` : prev.cargo_setor
                                        }));
                                    }}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white"
                                >
                                    <option value="">Selecione da lista de funcionários...</option>
                                    {colaboradores.map(c => (
                                        <option key={c.idUsuario} value={c.idUsuario}>
                                            {c.NomeCompleto} {c.Matricula ? `(Matr: ${c.Matricula})` : ''} - {c.Setor || ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Foto preview */}
                            {candidatoForm.usuario_id && (() => {
                                const sel = colaboradores.find(c => String(c.idUsuario) === String(candidatoForm.usuario_id));
                                if (!sel) return null;
                                return (
                                    <div className="flex items-center gap-3 p-2.5 bg-slate-50 border rounded-xl">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 border overflow-hidden flex items-center justify-center font-bold text-slate-700 shrink-0">
                                            {sel.fotoUsuario ? (
                                                <img src={sel.fotoUsuario} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{sel.NomeCompleto?.substring(0, 2).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">{sel.NomeCompleto}</p>
                                            <p className="text-[11px] text-slate-500">Foto oficial importada automaticamente do RH</p>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div>
                                <label className="font-bold text-slate-700">Nome de Urna (como aparecerá na cédula)</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: João da Solda"
                                    value={candidatoForm.nome_urna}
                                    onChange={(e) => setCandidatoForm(prev => ({ ...prev, nome_urna: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-700">Função & Setor</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Soldador MIG (Caldeiraria)"
                                    value={candidatoForm.cargo_setor}
                                    onChange={(e) => setCandidatoForm(prev => ({ ...prev, cargo_setor: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setModalCandidatoOpen(false)} className="px-4 py-2 border rounded-xl text-slate-600 font-bold">Cancelar</button>
                                <button type="submit" disabled={savingCandidato} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold">
                                    {savingCandidato ? 'Gravando...' : 'Confirmar Inscrição'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL NOVA REUNIÃO / ANEXO DE ATA */}
            {modalReuniaoOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <span>Agendar Reunião / Registrar Ata da CIPA</span>
                            </h3>
                            <button onClick={() => setModalReuniaoOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveReuniao} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-slate-700">Número da Ata</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: 01/2026"
                                        value={reuniaoForm.numero_ata}
                                        onChange={(e) => setReuniaoForm(prev => ({ ...prev, numero_ata: e.target.value }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700">Tipo da Reunião</label>
                                    <select
                                        value={reuniaoForm.tipo}
                                        onChange={(e) => setReuniaoForm(prev => ({ ...prev, tipo: e.target.value }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white"
                                    >
                                        <option value="ordinaria">Ordinária Mensal</option>
                                        <option value="extraordinaria">Extraordinária (Acidente Grave / Urgência)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="font-bold text-slate-700">Data</label>
                                    <input
                                        type="date"
                                        required
                                        value={reuniaoForm.data_reuniao}
                                        onChange={(e) => setReuniaoForm(prev => ({ ...prev, data_reuniao: e.target.value }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700">Início</label>
                                    <input
                                        type="time"
                                        value={reuniaoForm.horario_inicio}
                                        onChange={(e) => setReuniaoForm(prev => ({ ...prev, horario_inicio: e.target.value }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700">Término</label>
                                    <input
                                        type="time"
                                        value={reuniaoForm.horario_fim}
                                        onChange={(e) => setReuniaoForm(prev => ({ ...prev, horario_fim: e.target.value }))}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700">Local da Reunião</label>
                                <input
                                    type="text"
                                    value={reuniaoForm.local}
                                    onChange={(e) => setReuniaoForm(prev => ({ ...prev, local: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-700">Pauta Principal</label>
                                <input
                                    type="text"
                                    required
                                    value={reuniaoForm.pauta}
                                    onChange={(e) => setReuniaoForm(prev => ({ ...prev, pauta: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-700">Conteúdo e Deliberações da Ata</label>
                                <textarea
                                    rows="3"
                                    value={reuniaoForm.conteudo_ata}
                                    onChange={(e) => setReuniaoForm(prev => ({ ...prev, conteudo_ata: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                                />
                            </div>

                            {/* Anexo de Arquivo Digitalizado / Word / PDF */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                                    <Paperclip className="w-4 h-4 text-emerald-600" />
                                    <span>Anexar Documento Digitalizado (Opcional - PDF / Word / Scan)</span>
                                </label>
                                <p className="text-[11px] text-slate-500">
                                    Ideal para arquivar atas manuscritas escaneadas ou minutas redigidas em Word (.docx / .pdf).
                                </p>
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                    onChange={(e) => setReuniaoArquivo(e.target.files[0] || null)}
                                    className="w-full mt-1 text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                                {reuniaoArquivo && (
                                    <p className="text-[11px] font-bold text-emerald-700">
                                        Arquivo selecionado: {reuniaoArquivo.name} ({(reuniaoArquivo.size / 1024).toFixed(1)} KB)
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setModalReuniaoOpen(false)} className="px-4 py-2 border rounded-xl text-slate-600 font-bold">Cancelar</button>
                                <button type="submit" disabled={savingReuniao} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
                                    {savingReuniao ? 'Salvando Ata...' : 'Salvar Reunião'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL ASSINATURA ELETRÔNICA COM SENHA */}
            {modalAssinarOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
                        <div className="text-center mb-4">
                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full mx-auto flex items-center justify-center mb-2">
                                <Lock className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-slate-900 text-base">Assinatura Digital de Ata</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Digite sua senha pessoal do sistema para assinar a ata oficial da CIPA com carimbo de tempo e hash SHA-256.
                            </p>
                        </div>
                        <form onSubmit={handleConfirmAssinatura} className="space-y-4">
                            <input
                                type="password"
                                required
                                placeholder="Sua senha de login"
                                value={senhaAssinatura}
                                onChange={(e) => setSenhaAssinatura(e.target.value)}
                                className="w-full px-3 py-2.5 border rounded-xl text-center text-sm font-bold"
                            />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setModalAssinarOpen(false)} className="flex-1 py-2.5 border rounded-xl text-xs font-bold text-slate-600">Cancelar</button>
                                <button type="submit" disabled={savingAssinatura} className="flex-1 py-2.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold">
                                    {savingAssinatura ? 'Autenticando...' : 'Assinar Digitalmente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

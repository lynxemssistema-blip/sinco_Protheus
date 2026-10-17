import React, { useState, useEffect } from 'react';
import {
    Shield, Users, Clock, AlertTriangle, FileSpreadsheet, Plus, Search,
    Calendar, Phone, UserCheck, Truck, Car, CheckCircle, RefreshCw, X,
    Edit2, Camera, BookOpen, AlertCircle, ArrowRightLeft, Eye, Download, HelpCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import portariaService from '../../services/portariaService';
import CameraCaptureModal from '../../components/CameraCaptureModal';
import { useHelp } from '../../contexts/HelpContext';

export default function PortariaGerencialPage() {
    const { toggleHelp } = useHelp();
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'porteiros' | 'livro' | 'historico'
    const [loading, setLoading] = useState(false);

    // Dados do Dashboard
    const [dashboardData, setDashboardData] = useState({
        kpis: {
            total_no_patio: 0,
            total_veiculos: 0,
            total_cargas: 0,
            total_retidos_criticos: 0,
            total_pernoitaram: 0,
            entradas_hoje: 0,
            saidas_hoje: 0,
            tempo_medio_minutos_hoje: 0
        },
        veiculosCriticos: [],
        porteirosAtivos: []
    });

    // Dados de Porteiros e Turnos
    const [porteiros, setPorteiros] = useState([]);
    const [turnos, setTurnos] = useState([]);
    const [selectedPorteiro, setSelectedPorteiro] = useState(null);
    const [isPorteiroModalOpen, setIsPorteiroModalOpen] = useState(false);
    const [isSavingPorteiro, setIsSavingPorteiro] = useState(false);
    const [colaboradores, setColaboradores] = useState([]);
    const [porteiroForm, setPorteiroForm] = useState({
        usuario_id: '',
        nome: '',
        apelido: '',
        cpf: '',
        rg: '',
        telefone: '',
        telefone_emergencia: '',
        contato_emergencia_nome: '',
        turno_id: '',
        status: 'ATIVO',
        observacoes: '',
        foto_base64: null
    });

    // Dados do Livro de Ocorrências
    const [ocorrencias, setOcorrencias] = useState([]);
    const [isOcorrenciaModalOpen, setIsOcorrenciaModalOpen] = useState(false);
    const [ocorrenciaForm, setOcorrenciaForm] = useState({
        porteiro_saida_id: '',
        porteiro_entrada_id: '',
        turno_id: '',
        descricao_ocorrencias: ''
    });

    // Dados do Histórico / Relatórios
    const [historico, setHistorico] = useState([]);
    const [filtros, setFiltros] = useState({
        dataInicio: '',
        dataFim: '',
        tipo: 'TODOS',
        status: 'TODOS',
        busca: ''
    });

    // Modal de Câmera para foto do porteiro
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    // Carregar dados conforme aba
    useEffect(() => {
        carregarDados();
    }, [activeTab]);

    const carregarDados = async () => {
        setLoading(true);
        try {
            if (activeTab === 'dashboard') {
                const dash = await portariaService.getDashboard();
                setDashboardData(dash);
            } else if (activeTab === 'porteiros') {
                const [ports, turns, aux] = await Promise.all([
                    portariaService.getPorteiros(),
                    portariaService.getTurnos(),
                    portariaService.getAuxiliares()
                ]);
                setPorteiros(ports || []);
                setTurnos(turns || []);
                setColaboradores(aux?.colaboradores || []);
            } else if (activeTab === 'livro') {
                const [ocors, ports, turns] = await Promise.all([
                    portariaService.getOcorrencias(),
                    portariaService.getPorteiros(),
                    portariaService.getTurnos()
                ]);
                setOcorrencias(ocors || []);
                setPorteiros(ports || []);
                setTurnos(turns || []);
            } else if (activeTab === 'historico') {
                const hist = await portariaService.getHistorico(filtros);
                setHistorico(hist || []);
            }
        } catch (err) {
            console.error('Erro ao carregar dados gerenciais da portaria:', err);
            toast.error('Erro ao carregar dados do painel.');
        } finally {
            setLoading(false);
        }
    };

    // Salvar Porteiro (Criar ou Atualizar)
    const handleSavePorteiro = async (e) => {
        e.preventDefault();
        if (!porteiroForm.nome.trim()) {
            toast.warning('O nome do porteiro é obrigatório.');
            return;
        }

        setIsSavingPorteiro(true);
        try {
            await portariaService.salvarPorteiro(porteiroForm, selectedPorteiro?.id);
            toast.success(selectedPorteiro ? 'Porteiro atualizado com sucesso!' : 'Porteiro cadastrado com sucesso!');
            setIsPorteiroModalOpen(false);
            setSelectedPorteiro(null);
            carregarDados();
        } catch (err) {
            console.error('Erro ao salvar porteiro:', err);
            toast.error(err.response?.data?.error || 'Falha ao salvar porteiro.');
        } finally {
            setIsSavingPorteiro(false);
        }
    };

    const handleEditPorteiro = (p) => {
        setSelectedPorteiro(p);
        setPorteiroForm({
            usuario_id: p.usuario_id || '',
            nome: p.nome || '',
            apelido: p.apelido || '',
            cpf: p.cpf || '',
            rg: p.rg || '',
            telefone: p.telefone || '',
            telefone_emergencia: p.telefone_emergencia || '',
            contato_emergencia_nome: p.contato_emergencia_nome || '',
            turno_id: p.turno_id || '',
            status: p.status || 'ATIVO',
            observacoes: p.observacoes || '',
            foto_base64: null
        });
        setIsPorteiroModalOpen(true);
    };

    const handleNewPorteiro = () => {
        setSelectedPorteiro(null);
        setPorteiroForm({
            usuario_id: '',
            nome: '',
            apelido: '',
            cpf: '',
            rg: '',
            telefone: '',
            telefone_emergencia: '',
            contato_emergencia_nome: '',
            turno_id: '',
            status: 'ATIVO',
            observacoes: '',
            foto_base64: null
        });
        setIsPorteiroModalOpen(true);
    };

    // Salvar Passagem de Plantão
    const handleSaveOcorrencia = async (e) => {
        e.preventDefault();
        if (!ocorrenciaForm.descricao_ocorrencias.trim()) {
            toast.warning('Informe a descrição da ocorrência ou passagem de turno.');
            return;
        }
        if (!ocorrenciaForm.porteiro_saida_id || !ocorrenciaForm.porteiro_entrada_id) {
            toast.warning('Informe o porteiro que entrega e o que assume o turno.');
            return;
        }
        if (String(ocorrenciaForm.porteiro_saida_id) === String(ocorrenciaForm.porteiro_entrada_id)) {
            toast.warning('O porteiro que entrega e o que assume devem ser diferentes.');
            return;
        }

        try {
            await portariaService.registrarPassagemTurno(ocorrenciaForm);
            toast.success('Passagem de turno registrada no livro com sucesso!');
            setIsOcorrenciaModalOpen(false);
            setOcorrenciaForm({
                porteiro_saida_id: '',
                porteiro_entrada_id: '',
                turno_id: '',
                descricao_ocorrencias: ''
            });
            carregarDados();
        } catch (err) {
            console.error('Erro ao registrar passagem de turno:', err);
            toast.error(err.response?.data?.error || 'Erro ao registrar ocorrência.');
        }
    };

    // Exportar Histórico para Excel
    const handleExportExcel = () => {
        if (!historico || historico.length === 0) {
            toast.info('Não há registros no histórico para exportar.');
            return;
        }

        const dadosFormatados = historico.map((item) => ({
            'ID': item.id,
            'Tipo': item.tipo,
            'Nome': item.nome_pessoa,
            'Documento (CPF/RG)': item.documento || '-',
            'Telefone': item.telefone || '-',
            'Empresa / Origem': item.empresa_origem || '-',
            'Setor Destino': item.setor_destino || '-',
            'Responsável Interno': item.responsavel_interno || '-',
            'Tipo Veículo': item.tipo_veiculo || '-',
            'Placa': item.placa_veiculo || '-',
            'Modelo Veículo': item.modelo_veiculo || '-',
            'Nº Crachá': item.numero_cracha || '-',
            'Nº Nota Fiscal': item.numero_nf || '-',
            'Data Entrada': new Date(item.data_entrada).toLocaleString('pt-BR'),
            'Data Saída': item.data_saida ? new Date(item.data_saida).toLocaleString('pt-BR') : 'No pátio',
            'Permanência (min)': item.tempo_permanencia_min || '-',
            'Status': item.status,
            'Porteiro Entrada': item.nome_porteiro_entrada || '-',
            'Porteiro Saída': item.nome_porteiro_saida || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(dadosFormatados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Portaria');
        XLSX.writeFile(wb, `Relatorio_Portaria_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success('Relatório Excel gerado e baixado!');
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl w-full mx-auto space-y-6">
                {/* 1. CABEÇALHO DO PAINEL GERENCIAL */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                Gestão de Portaria & Segurança
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                                Indicadores de pátio, equipe de guarita e auditoria de acessos
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Abas de Navegação */}
                        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                            {[
                                { id: 'dashboard', label: 'Dashboard & Pátio', icon: Shield },
                                { id: 'porteiros', label: 'Equipe & Turnos', icon: Users },
                                { id: 'livro', label: 'Livro de Plantão', icon: BookOpen },
                                { id: 'historico', label: 'Histórico & Relatórios', icon: FileSpreadsheet }
                            ].map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition ${
                                            isActive
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Botão de Ajuda de Contexto */}
                        <button
                            type="button"
                            onClick={toggleHelp}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-500/10 rounded-xl text-slate-300 hover:text-amber-400 active:scale-95 transition text-xs font-semibold"
                            title="Ajuda e Manual da Gestão de Portaria"
                        >
                            <HelpCircle className="w-4 h-4 text-amber-400" />
                            <span className="hidden sm:inline">Ajuda</span>
                        </button>
                    </div>
                </div>

                {/* 2. CONTEÚDO DA ABA SELECIONADA */}
                {/* ABA 1: DASHBOARD & INDICADORES */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        {/* KPIs Principais */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ocupação do Pátio</span>
                                <div className="text-3xl font-black text-white mt-1">
                                    {dashboardData.kpis.total_no_patio}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                    <span>{dashboardData.kpis.total_veiculos} veículos</span> • <span>{dashboardData.kpis.total_cargas} cargas</span>
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Movimentação Hoje</span>
                                <div className="text-3xl font-black text-emerald-400 mt-1">
                                    +{dashboardData.kpis.entradasHoje || dashboardData.kpis.entradas_hoje || 0}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                    {dashboardData.kpis.saidasHoje || dashboardData.kpis.saidas_hoje || 0} saídas registradas
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tempo Médio Hoje</span>
                                <div className="text-3xl font-black text-blue-400 mt-1">
                                    {dashboardData.kpis.tempo_medio_minutos_hoje || 0} min
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                    Permanência média por veículo
                                </div>
                            </div>

                            <div className={`rounded-2xl p-4 border transition shadow-sm ${
                                dashboardData.kpis.total_retidos_criticos > 0
                                    ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                                    : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}>
                                <span className="text-xs font-semibold uppercase tracking-wider">Retidos Críticos (&gt; 4h)</span>
                                <div className={`text-3xl font-black mt-1 ${
                                    dashboardData.kpis.total_retidos_criticos > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-100'
                                }`}>
                                    {dashboardData.kpis.total_retidos_criticos}
                                </div>
                                <div className="text-[11px] mt-1">
                                    {dashboardData.kpis.total_pernoitaram || 0} pernoitaram no pátio
                                </div>
                            </div>
                        </div>

                        {/* Veículos Retidos Críticos em Destaque */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                                <div className="flex items-center gap-2.5">
                                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                                    <div>
                                        <h2 className="text-sm sm:text-base font-bold text-white">
                                            Atenção: Permanências Críticas e Pernoites ({dashboardData.veiculosCriticos?.length || 0})
                                        </h2>
                                        <p className="text-xs text-slate-400">Veículos ou pessoas com mais de 4 horas dentro da empresa</p>
                                    </div>
                                </div>
                            </div>

                            {dashboardData.veiculosCriticos?.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs">
                                    ✅ Nenhuma ocorrência crítica de permanência excedida no momento.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-800/80 overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase">
                                            <tr>
                                                <th className="py-2.5 px-4">Visitante</th>
                                                <th className="py-2.5 px-4">Placa / Veículo</th>
                                                <th className="py-2.5 px-4">Destino / Empresa</th>
                                                <th className="py-2.5 px-4">Entrada</th>
                                                <th className="py-2.5 px-4">Permanência</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {dashboardData.veiculosCriticos?.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-800/30">
                                                    <td className="py-2.5 px-4 font-semibold text-white">
                                                        {item.nome_pessoa}
                                                    </td>
                                                    <td className="py-2.5 px-4 font-mono font-bold text-amber-300">
                                                        {item.placa_veiculo || 'A pé'}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-slate-300">
                                                        {item.setor_destino || '-'} ({item.empresa_origem || 'Próprio'})
                                                    </td>
                                                    <td className="py-2.5 px-4 text-slate-400 font-mono">
                                                        {new Date(item.data_entrada).toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="py-2.5 px-4 font-bold text-rose-400">
                                                        {Math.floor(item.permanencia_min / 60)}h {item.permanencia_min % 60}m
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ABA 2: EQUIPE DE PORTEIROS & TURNOS */}
                {activeTab === 'porteiros' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-white">Quadro de Porteiros e Vigilantes</h2>
                                <p className="text-xs text-slate-400">Cadastro de colaboradores de guarita, escalas e contatos de emergência</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleNewPorteiro}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
                            >
                                <Plus className="w-4 h-4" />
                                Cadastrar Porteiro
                            </button>
                        </div>

                        {/* Grid dos Porteiros */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {porteiros.map((p) => (
                                <div
                                    key={p.id}
                                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-md hover:border-slate-700 transition"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                {p.foto_url ? (
                                                    <img
                                                        src={p.foto_url}
                                                        alt={p.nome}
                                                        className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-700 shadow"
                                                    />
                                                ) : (
                                                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 shadow">
                                                        <Users className="w-7 h-7" />
                                                    </div>
                                                )}
                                                <div>
                                                    <h3 className="font-bold text-base text-white leading-tight">
                                                        {p.nome}
                                                    </h3>
                                                    {p.apelido && (
                                                        <span className="text-xs text-slate-400">
                                                            "{p.apelido}"
                                                        </span>
                                                    )}
                                                    <div className="mt-1">
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                                            p.status === 'ATIVO'
                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                                : 'bg-slate-800 text-slate-400 border-slate-700'
                                                        }`}>
                                                            {p.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleEditPorteiro(p)}
                                                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2 text-xs">
                                            <div className="flex items-center justify-between text-slate-300">
                                                <span className="text-slate-500">Turno de Trabalho:</span>
                                                <span className="font-semibold text-slate-200">{p.nome_turno || 'Não definido'}</span>
                                            </div>

                                            {p.telefone && (
                                                <div className="flex items-center justify-between text-slate-300">
                                                    <span className="text-slate-500">Telefone / WhatsApp:</span>
                                                    <a
                                                        href={`https://wa.me/55${p.telefone.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="font-medium text-emerald-400 hover:underline flex items-center gap-1"
                                                    >
                                                        <Phone className="w-3 h-3" />
                                                        {p.telefone}
                                                    </a>
                                                </div>
                                            )}

                                            {p.telefone_emergencia && (
                                                <div className="flex items-center justify-between text-slate-300">
                                                    <span className="text-slate-500">Contato Emergência:</span>
                                                    <span className="font-medium text-rose-300">
                                                        {p.contato_emergencia_nome ? `${p.contato_emergencia_nome} • ` : ''}
                                                        {p.telefone_emergencia}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {p.observacoes && (
                                        <div className="mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 italic">
                                            "{p.observacoes}"
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Tabela de Turnos Cadastrados */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                            <h3 className="font-bold text-sm text-white">Escalas e Turnos da Portaria</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {turnos.map((t) => (
                                    <div key={t.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                                        <div className="font-bold text-xs text-white">{t.nome}</div>
                                        <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                                            {t.hora_inicio.slice(0, 5)} até {t.hora_fim.slice(0, 5)}
                                        </div>
                                        {t.descricao && (
                                            <div className="text-[10px] text-slate-500 mt-1">{t.descricao}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ABA 3: LIVRO DE OCORRÊNCIAS / PASSAGEM DE PLANTÃO */}
                {activeTab === 'livro' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-white">Livro Digital de Ocorrências da Portaria</h2>
                                <p className="text-xs text-slate-400">Rastreabilidade formal de trocas de plantão e incidentes reportados</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOcorrenciaModalOpen(true)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
                            >
                                <Plus className="w-4 h-4" />
                                Registrar Passagem de Turno
                            </button>
                        </div>

                        <div className="space-y-4">
                            {ocorrencias.length === 0 ? (
                                <div className="p-12 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
                                    Nenhuma passagem de turno registrada no livro até o momento.
                                </div>
                            ) : (
                                ocorrencias.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-md"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                                                    <ArrowRightLeft className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-white">
                                                        Passagem de Turno: {item.nome_turno || 'Plantão'}
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        Saiu: <span className="text-slate-200 font-semibold">{item.nome_porteiro_saida || 'Não informado'}</span> • 
                                                        Assumiu: <span className="text-slate-200 font-semibold">{item.nome_porteiro_entrada || 'Não informado'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-mono font-bold text-slate-300">
                                                    {new Date(item.data_registro).toLocaleString('pt-BR')}
                                                </div>
                                                <div className="text-[11px] text-amber-400">
                                                    {item.total_veiculos_patio} veículos no pátio no momento
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                                            {item.descricao_ocorrencias}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ABA 4: HISTÓRICO & RELATÓRIOS */}
                {activeTab === 'historico' && (
                    <div className="space-y-6">
                        {/* Filtros */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <h2 className="text-sm sm:text-base font-bold text-white">
                                    Filtros de Auditoria e Relatório
                                </h2>
                                <button
                                    type="button"
                                    onClick={handleExportExcel}
                                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow transition"
                                >
                                    <Download className="w-4 h-4" />
                                    Exportar para Excel (.xlsx)
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                <div>
                                    <label className="block text-slate-400 mb-1">Data Início</label>
                                    <input
                                        type="date"
                                        value={filtros.dataInicio}
                                        onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 mb-1">Data Fim</label>
                                    <input
                                        type="date"
                                        value={filtros.dataFim}
                                        onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 mb-1">Tipo de Acesso</label>
                                    <select
                                        value={filtros.tipo}
                                        onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                                    >
                                        <option value="TODOS">Todos os tipos</option>
                                        <option value="VISITANTE">Visitante</option>
                                        <option value="FORNECEDOR_CARGA">Carga / Fornecedor</option>
                                        <option value="PRESTADOR">Prestador</option>
                                        <option value="CLIENTE">Cliente</option>
                                        <option value="COLABORADOR">Colaborador</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-400 mb-1">Busca Rápida</label>
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Placa, nome, crachá, NF..."
                                            value={filtros.busca}
                                            onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-200"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={carregarDados}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-2"
                                >
                                    <Search className="w-4 h-4" />
                                    Aplicar Filtros
                                </button>
                            </div>
                        </div>

                        {/* Tabela de Resultados */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-950/70 text-[11px] font-semibold text-slate-400 uppercase">
                                        <tr>
                                            <th className="py-3 px-4">Visitante</th>
                                            <th className="py-3 px-4">Veículo / Placa</th>
                                            <th className="py-3 px-4">Empresa / Destino</th>
                                            <th className="py-3 px-4 text-center">Crachá</th>
                                            <th className="py-3 px-4">Entrada</th>
                                            <th className="py-3 px-4">Saída</th>
                                            <th className="py-3 px-4">Permanência</th>
                                            <th className="py-3 px-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {historico.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="p-8 text-center text-slate-500">
                                                    Nenhum registro encontrado para os filtros selecionados.
                                                </td>
                                            </tr>
                                        ) : (
                                            historico.map((row) => (
                                                <tr key={row.id} className="hover:bg-slate-800/30">
                                                    <td className="py-3 px-4">
                                                        <div className="font-bold text-white">{row.nome_pessoa}</div>
                                                        <div className="text-[10px] text-slate-500">{row.tipo}</div>
                                                    </td>
                                                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                                                        {row.placa_veiculo || 'A pé'}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-300">
                                                        <div>{row.empresa_origem || '-'}</div>
                                                        <div className="text-[10px] text-slate-500">{row.setor_destino || '-'}</div>
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-mono font-bold text-amber-300">
                                                        {row.numero_cracha ? `#${row.numero_cracha}` : '-'}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono text-slate-300">
                                                        {new Date(row.data_entrada).toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono text-slate-400">
                                                        {row.data_saida ? new Date(row.data_saida).toLocaleString('pt-BR') : '-'}
                                                    </td>
                                                    <td className="py-3 px-4 font-bold text-blue-300">
                                                        {row.tempo_permanencia_min ? `${row.tempo_permanencia_min} min` : '-'}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                                            row.status === 'NO_PATIO'
                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                                : 'bg-slate-800 text-slate-400 border-slate-700'
                                                        }`}>
                                                            {row.status === 'NO_PATIO' ? 'No Pátio' : 'Finalizado'}
                                                        </span>
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

                {/* MODAL CADASTRAR/EDITAR PORTEIRO */}
                {isPorteiroModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl p-6 text-slate-100 my-8">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                                <h3 className="font-bold text-base text-white">
                                    {selectedPorteiro ? 'Editar Dados do Porteiro' : 'Cadastrar Novo Porteiro'}
                                </h3>
                                <button
                                    onClick={() => setIsPorteiroModalOpen(false)}
                                    className="text-slate-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSavePorteiro} className="space-y-4 mt-4">
                                {/* Foto com Câmera ou Upload */}
                                <div className="flex items-center gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
                                    {porteiroForm.foto_base64 || selectedPorteiro?.foto_url ? (
                                        <img
                                            src={porteiroForm.foto_base64 || selectedPorteiro?.foto_url}
                                            alt="Foto do Porteiro"
                                            className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 shadow">
                                            <Users className="w-8 h-8" />
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-xs font-semibold text-white">Foto de Perfil</div>
                                        <p className="text-[11px] text-slate-400 mb-2">Tire a foto usando a webcam do PC ou faça upload</p>
                                        <button
                                            type="button"
                                            onClick={() => setIsCameraOpen(true)}
                                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                                        >
                                            <Camera className="w-3.5 h-3.5" />
                                            {porteiroForm.foto_base64 || selectedPorteiro?.foto_url ? 'Alterar Foto (Câmera / Arquivo)' : 'Capturar Foto com a Câmera'}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <label className="block text-slate-300 mb-1">Nome Completo *</label>
                                        <input
                                            type="text"
                                            required
                                            value={porteiroForm.nome}
                                            onChange={(e) => setPorteiroForm({ ...porteiroForm, nome: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 mb-1">Apelido de Guarita</label>
                                        <input
                                            type="text"
                                            value={porteiroForm.apelido}
                                            onChange={(e) => setPorteiroForm({ ...porteiroForm, apelido: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 mb-1">CPF</label>
                                        <input
                                            type="text"
                                            value={porteiroForm.cpf}
                                            onChange={(e) => setPorteiroForm({ ...porteiroForm, cpf: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 mb-1">Telefone Principal (WhatsApp)</label>
                                        <input
                                            type="text"
                                            value={porteiroForm.telefone}
                                            onChange={(e) => setPorteiroForm({ ...porteiroForm, telefone: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 mb-1">Telefone de Emergência</label>
                                        <input
                                            type="text"
                                            value={porteiroForm.telefone_emergencia}
                                            onChange={(e) => setPorteiroForm({ ...porteiroForm, telefone_emergencia: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 mb-1">Nome do Contato Emergência</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Esposa / Mãe"
                                            value={porteiroForm.contato_emergencia_nome}
                                            onChange={(e) => setPorteiroForm({ ...porteiroForm, contato_emergencia_nome: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 mb-1">Turno de Trabalho</label>
                                        <select
                                            value={porteiroForm.turno_id}
                                            onChange={(e) => setPorteiroForm({ ...porteiroForm, turno_id: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                        >
                                            <option value="">Selecione o turno</option>
                                            {turnos.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.nome} ({t.hora_inicio.slice(0, 5)} - {t.hora_fim.slice(0, 5)})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 mb-1">Status</label>
                                        <select
                                            value={porteiroForm.status}
                                            onChange={(e) => setPorteiroForm({ ...porteiroForm, status: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                        >
                                            <option value="ATIVO">Ativo</option>
                                            <option value="FERIAS">Em Férias</option>
                                            <option value="AFASTADO">Afastado</option>
                                            <option value="INATIVO">Inativo</option>
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-slate-300 mb-1">Login no sistema (opcional)</label>
                                        <select
                                            value={porteiroForm.usuario_id}
                                            onChange={(e) => setPorteiroForm({ ...porteiroForm, usuario_id: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                        >
                                            <option value="">Sem vínculo</option>
                                            {colaboradores.map((c) => (
                                                <option key={c.idUsuario} value={c.idUsuario}>
                                                    {c.NomeCompleto}{c.Setor ? ` (${c.Setor})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Com o vínculo, a Guarita identifica automaticamente este porteiro ao fazer login.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setIsPorteiroModalOpen(false)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingPorteiro}
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                                    >
                                        {isSavingPorteiro ? 'Salvando...' : 'Salvar Porteiro'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL REGISTRAR PASSAGEM DE TURNO NO LIVRO */}
                {isOcorrenciaModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 text-slate-100">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                <h3 className="font-bold text-base text-white">Registrar Passagem de Turno</h3>
                                <button
                                    onClick={() => setIsOcorrenciaModalOpen(false)}
                                    className="text-slate-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveOcorrencia} className="space-y-4 mt-4 text-xs">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-slate-300 mb-1">Porteiro que está saindo</label>
                                        <select
                                            value={ocorrenciaForm.porteiro_saida_id}
                                            onChange={(e) => setOcorrenciaForm({ ...ocorrenciaForm, porteiro_saida_id: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                        >
                                            <option value="">Selecione</option>
                                            {porteiros.map((p) => (
                                                <option key={p.id} value={p.id}>{p.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 mb-1">Porteiro que está assumindo</label>
                                        <select
                                            value={ocorrenciaForm.porteiro_entrada_id}
                                            onChange={(e) => setOcorrenciaForm({ ...ocorrenciaForm, porteiro_entrada_id: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                        >
                                            <option value="">Selecione</option>
                                            {porteiros.map((p) => (
                                                <option key={p.id} value={p.id}>{p.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-slate-300 mb-1">Turno que assume</label>
                                    <select
                                        value={ocorrenciaForm.turno_id}
                                        onChange={(e) => setOcorrenciaForm({ ...ocorrenciaForm, turno_id: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                                    >
                                        <option value="">Selecione o turno</option>
                                        {turnos.map((t) => (
                                            <option key={t.id} value={t.id}>{t.nome}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-slate-300 mb-1">Descrição das Ocorrências / Pendências *</label>
                                    <textarea
                                        rows="4"
                                        required
                                        placeholder="Ex: Plantão encerrado sem novidades. Permanece no pátio a carreta placa XYZ descarregando chapa na área 2..."
                                        value={ocorrenciaForm.descricao_ocorrencias}
                                        onChange={(e) => setOcorrenciaForm({ ...ocorrenciaForm, descricao_ocorrencias: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setIsOcorrenciaModalOpen(false)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
                                    >
                                        Confirmar Passagem de Turno
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL DE CÂMERA WEBCAM PARA O PORTEIRO */}
                <CameraCaptureModal
                    isOpen={isCameraOpen}
                    title="Capturar Foto do Porteiro"
                    onClose={() => setIsCameraOpen(false)}
                    onCapture={(base64) => {
                        setPorteiroForm((prev) => ({ ...prev, foto_base64: base64 }));
                        toast.success('Foto do porteiro capturada!');
                    }}
                />
            </div>
        </div>
    );
}

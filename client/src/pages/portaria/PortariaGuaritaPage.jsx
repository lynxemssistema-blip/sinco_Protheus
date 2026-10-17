import React, { useState, useEffect, useMemo } from 'react';
import {
    Shield, Truck, User, Car, Clock, Camera, RefreshCw, CheckCircle,
    AlertTriangle, AlertCircle, Search, Plus, Phone, LogOut, ArrowRight,
    UserCheck, FileText, ChevronRight, X, ExternalLink, Hash, Building2,
    LayoutGrid, ListFilter, Smartphone, HelpCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import portariaService from '../../services/portariaService';
import CameraCaptureModal from '../../components/CameraCaptureModal';
import { useAuth } from '../../contexts/AuthContext';
import { useHelp } from '../../contexts/HelpContext';

export default function PortariaGuaritaPage() {
    const { user } = useAuth();
    const { toggleHelp } = useHelp();

    // Estados de dados
    const [ativos, setAtivos] = useState([]);
    const [auxiliares, setAuxiliares] = useState({ setores: [], colaboradores: [], turnos: [], porteiros: [] });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

    // Porteiro ativo na guarita
    const [porteiroAtivo, setPorteiroAtivo] = useState(null);
    const [isTrocaPorteiroOpen, setIsTrocaPorteiroOpen] = useState(false);

    // Modal de câmera
    const [cameraModalConfig, setCameraModalConfig] = useState({
        isOpen: false,
        target: null, // 'pessoa' | 'veiculo'
        title: ''
    });

    // Modal de visualização de foto ampliada
    const [fotoAmpliada, setFotoAmpliada] = useState(null);

    // Modo de visualização no pátio: 'cards' | 'tabela'
    // Em telas pequenas (mobile), o padrão é 'cards' para melhor usabilidade com toque
    const [viewMode, setViewMode] = useState(
        typeof window !== 'undefined' && window.innerWidth <= 768 ? 'cards' : 'tabela'
    );

    // Estado do formulário de Check-in
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        tipo: 'VISITANTE',
        nome_pessoa: '',
        documento: '',
        telefone: '',
        empresa_origem: '',
        setor_destino: '',
        responsavel_interno: '',
        tipo_veiculo: 'NENHUM',
        placa_veiculo: '',
        modelo_veiculo: '',
        cor_veiculo: '',
        numero_cracha: '',
        numero_nf: '',
        motivo_visita: '',
        observacoes: '',
        foto_pessoa_base64: null,
        foto_veiculo_base64: null
    });

    // Relógio digital em tempo real
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Carregar dados iniciais e conectar Socket.IO
    useEffect(() => {
        carregarDados();

        const socket = io();
        socket.on('connect', () => {
            socket.emit('join_tenant', localStorage.getItem('@Lynx:token'));
        });
        socket.on('portaria:novo_acesso', (novo) => {
            setAtivos((prev) => [novo, ...prev.filter((item) => item.id !== novo.id)]);
            toast.info(`🔔 Nova entrada: ${novo.nome_pessoa} (${novo.placa_veiculo || 'A pé'})`);
        });

        socket.on('portaria:saida_acesso', (saida) => {
            setAtivos((prev) => prev.filter((item) => item.id !== saida.id));
            toast.success(`👋 Saída registrada: ${saida.nome_pessoa}`);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const carregarDados = async () => {
        setLoading(true);
        try {
            const [ativosData, auxData] = await Promise.all([
                portariaService.getAcessosAtivos(),
                portariaService.getAuxiliares()
            ]);
            setAtivos(ativosData || []);
            setAuxiliares(auxData || { setores: [], colaboradores: [], turnos: [], porteiros: [] });

            if (auxData.porteiros && auxData.porteiros.length > 0) {
                const matchUser = auxData.porteiros.find(p => p.usuario_id === user?.idUsuario);
                setPorteiroAtivo(matchUser || auxData.porteiros[0]);
            }
        } catch (err) {
            console.error('Erro ao carregar dados da guarita:', err);
            toast.error('Erro ao carregar dados da portaria.');
        } finally {
            setLoading(false);
        }
    };

    // Submissão do Check-in
    const handleCheckInSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nome_pessoa.trim()) {
            toast.warning('O nome da pessoa é obrigatório.');
            return;
        }

        if (formData.tipo_veiculo !== 'NENHUM' && !formData.placa_veiculo.trim()) {
            toast.warning('Informe a placa do veículo.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                porteiro_entrada_id: porteiroAtivo?.id || null
            };

            await portariaService.registrarCheckIn(payload);
            toast.success('Entrada autorizada e registrada com sucesso!');

            setFormData({
                tipo: 'VISITANTE',
                nome_pessoa: '',
                documento: '',
                telefone: '',
                empresa_origem: '',
                setor_destino: '',
                responsavel_interno: '',
                tipo_veiculo: 'NENHUM',
                placa_veiculo: '',
                modelo_veiculo: '',
                cor_veiculo: '',
                numero_cracha: '',
                numero_nf: '',
                motivo_visita: '',
                observacoes: '',
                foto_pessoa_base64: null,
                foto_veiculo_base64: null
            });
            setIsFormOpen(false);
            carregarDados();
        } catch (err) {
            console.error('Erro ao salvar entrada:', err);
            toast.error(err.response?.data?.error || 'Erro ao registrar entrada.');
        } finally {
            setSubmitting(false);
        }
    };

    // Submissão de Check-out
    const handleCheckOut = async (acesso) => {
        const confirmar = window.confirm(`Confirmar a saída de "${acesso.nome_pessoa}" (Placa: ${acesso.placa_veiculo || 'Sem veículo'})?`);
        if (!confirmar) return;

        try {
            await portariaService.registrarCheckOut(acesso.id, {
                porteiro_saida_id: porteiroAtivo?.id || null
            });
            setAtivos((prev) => prev.filter((item) => item.id !== acesso.id));
            toast.success(`Saída de ${acesso.nome_pessoa} confirmada!`);
        } catch (err) {
            if (err.response?.status === 409) {
                // Outro tablet já registrou a saída: só sincroniza a lista
                setAtivos((prev) => prev.filter((item) => item.id !== acesso.id));
                toast.info(err.response.data?.error || 'Saída já registrada em outro dispositivo.');
                return;
            }
            console.error('Erro ao registrar saída:', err);
            toast.error(err.response?.data?.error || 'Erro ao registrar saída.');
        }
    };

    // Filtragem em tempo real
    const acessosFiltrados = useMemo(() => {
        if (!searchTerm.trim()) return ativos;
        const q = searchTerm.toLowerCase();
        return ativos.filter((a) => (
            (a.nome_pessoa && a.nome_pessoa.toLowerCase().includes(q)) ||
            (a.documento && a.documento.toLowerCase().includes(q)) ||
            (a.placa_veiculo && a.placa_veiculo.toLowerCase().includes(q)) ||
            (a.empresa_origem && a.empresa_origem.toLowerCase().includes(q)) ||
            (a.numero_cracha && String(a.numero_cracha).toLowerCase().includes(q)) ||
            (a.setor_destino && a.setor_destino.toLowerCase().includes(q))
        ));
    }, [ativos, searchTerm]);

    const totalNoPatio = ativos.length;
    const totalVeiculos = ativos.filter(a => a.tipo_veiculo && a.tipo_veiculo !== 'NENHUM').length;
    const totalCargas = ativos.filter(a => ['CARRETA', 'CAMINHAO', 'VUC'].includes(a.tipo_veiculo)).length;
    const totalCriticos = ativos.filter(a => (a.permanencia_atual_min > 240)).length;

    const formatPermanencia = (min) => {
        if (!min && min !== 0) return '-';
        if (min < 60) return `${min} min`;
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${h}h ${m > 0 ? `${m}m` : ''}`;
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-20 sm:pb-8">
            {/* 1. BARRA SUPERIOR RESPONSIVA */}
            <header className="bg-slate-900 border-b border-slate-800 px-3 py-2.5 sm:px-6 sm:py-3 sticky top-0 z-30 shadow-md">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
                    {/* Título & Badge */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                                <h1 className="text-sm sm:text-lg font-bold text-white tracking-wide truncate">
                                    Portaria • Guarita
                                </h1>
                                <span className="hidden sm:flex px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Terminal
                                </span>
                            </div>
                            <p className="text-[10px] sm:text-xs text-slate-400 truncate">Guarita de Acesso</p>
                        </div>
                    </div>

                    {/* Porteiro no Posto & Relógio */}
                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* Relógio Digital (oculto em telas muito pequenas para economizar espaço) */}
                        <div className="hidden lg:flex flex-col items-end px-3 py-1 bg-slate-950/60 border border-slate-800 rounded-lg">
                            <span className="text-[10px] text-slate-400 font-medium">
                                {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                            </span>
                            <span className="text-sm font-mono font-bold text-slate-200">
                                {currentTime.toLocaleTimeString('pt-BR')}
                            </span>
                        </div>

                        {/* Card do Porteiro Ativo */}
                        <div
                            onClick={() => setIsTrocaPorteiroOpen(true)}
                            className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-xl p-1 sm:p-1.5 sm:pr-3 cursor-pointer hover:border-slate-700 active:scale-95 transition"
                            title="Clique para alternar porteiro"
                        >
                            <div className="relative shrink-0">
                                {porteiroAtivo?.foto_url ? (
                                    <img
                                        src={porteiroAtivo.foto_url}
                                        alt={porteiroAtivo.nome}
                                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-slate-700"
                                    />
                                ) : (
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                                        <User className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                )}
                                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                            </div>
                            <div className="text-left hidden sm:block">
                                <div className="text-xs font-semibold text-white leading-tight truncate max-w-[120px]">
                                    {porteiroAtivo?.nome?.split(' ')[0] || 'Porteiro'}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <span>{porteiroAtivo?.nome_turno?.split(' ')[0] || 'Plantão'}</span>
                                    <span className="text-emerald-400 font-semibold">• Trocar</span>
                                </div>
                            </div>
                        </div>

                        {/* Botão de Ajuda de Contexto */}
                        <button
                            type="button"
                            onClick={toggleHelp}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-950/90 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-500/10 rounded-xl text-slate-300 hover:text-amber-400 active:scale-95 transition"
                            title="Ajuda e Manual da Guarita"
                        >
                            <HelpCircle className="w-4 h-4 text-amber-400" />
                            <span className="hidden md:inline text-xs font-semibold">Ajuda</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* 2. BARRA DE MÉTRICAS EM TEMPO REAL (GRID 2x2 MOBILE) */}
            <div className="bg-slate-900/60 border-b border-slate-800/80 px-3 py-2.5 sm:px-6 sm:py-3">
                <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">No Pátio</span>
                            <div className="text-lg sm:text-2xl font-black text-white">{totalNoPatio}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Veículos</span>
                            <div className="text-lg sm:text-2xl font-black text-slate-100">{totalVeiculos}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <Car className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Cargas / Caminhões</span>
                            <div className="text-lg sm:text-2xl font-black text-amber-300">{totalCargas}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                            <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                    </div>

                    <div className={`rounded-xl p-2.5 sm:p-3 flex items-center justify-between border transition ${
                        totalCriticos > 0
                            ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                            : 'bg-slate-900/90 border-slate-800 text-slate-400'
                    }`}>
                        <div>
                            <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider">&gt; 4 Horas</span>
                            <div className={`text-lg sm:text-2xl font-black ${totalCriticos > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
                                {totalCriticos}
                            </div>
                        </div>
                        <div className={`p-2 rounded-lg ${totalCriticos > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-500'}`}>
                            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. CONTEÚDO PRINCIPAL */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col gap-4 sm:gap-6">
                {/* Linha de Busca & Ações */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar placa, nome, crachá, CPF..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Seletor Cartões vs Tabela */}
                        <div className="hidden sm:flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
                            <button
                                type="button"
                                onClick={() => setViewMode('tabela')}
                                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                                    viewMode === 'tabela' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                                }`}
                                title="Visualização em Tabela"
                            >
                                <ListFilter className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('cards')}
                                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                                    viewMode === 'cards' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                                }`}
                                title="Visualização em Cartões"
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Botão Novo Check-in */}
                        <button
                            type="button"
                            onClick={() => setIsFormOpen(!isFormOpen)}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg transition active:scale-95 ${
                                isFormOpen
                                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                            }`}
                        >
                            {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {isFormOpen ? 'Fechar Formulário' : 'Novo Check-in (Entrada)'}
                        </button>
                    </div>
                </div>

                {/* FORMULÁRIO DE ENTRADA RESPONSIVO */}
                {isFormOpen && (
                    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-2xl animate-in slide-in-from-top-4 duration-200">
                        <div className="flex items-center justify-between pb-3 sm:pb-4 mb-4 sm:mb-5 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                    <UserCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-sm sm:text-base font-bold text-white">Registrar Entrada</h2>
                                    <p className="text-[11px] sm:text-xs text-slate-400">Check-in de veículos e visitantes na fábrica</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCheckInSubmit} className="space-y-4 sm:space-y-5">
                            {/* Tipo de Acesso */}
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Tipo de Acesso
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
                                    {[
                                        { id: 'VISITANTE', label: 'Visitante' },
                                        { id: 'FORNECEDOR_CARGA', label: 'Carga / Fornecedor' },
                                        { id: 'PRESTADOR', label: 'Prestador de Serviço' },
                                        { id: 'CLIENTE', label: 'Cliente' },
                                        { id: 'COLABORADOR', label: 'Colaborador' }
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, tipo: t.id })}
                                            className={`py-2 px-2.5 text-xs font-semibold rounded-xl border transition ${
                                                formData.tipo === t.id
                                                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                                                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dados do Visitante */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-medium text-slate-300 mb-1">
                                        Nome Completo <span className="text-rose-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: João da Silva"
                                        value={formData.nome_pessoa}
                                        onChange={(e) => setFormData({ ...formData, nome_pessoa: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">CPF ou RG</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: 000.000.000-00"
                                        value={formData.documento}
                                        onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Telefone / WhatsApp</label>
                                    <input
                                        type="tel"
                                        placeholder="Ex: (11) 99999-9999"
                                        value={formData.telefone}
                                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            {/* Empresa & Destino */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Empresa / Transportadora</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Transportadora XYZ"
                                        value={formData.empresa_origem}
                                        onChange={(e) => setFormData({ ...formData, empresa_origem: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Setor de Destino</label>
                                    <input
                                        list="setores-list"
                                        placeholder="Ex: Usinagem, Almoxarifado"
                                        value={formData.setor_destino}
                                        onChange={(e) => setFormData({ ...formData, setor_destino: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                    />
                                    <datalist id="setores-list">
                                        {auxiliares.setores?.map((s, idx) => (
                                            <option key={idx} value={s} />
                                        ))}
                                    </datalist>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">Responsável Interno</label>
                                    <input
                                        list="colaboradores-list"
                                        placeholder="Nome do colaborador visitado"
                                        value={formData.responsavel_interno}
                                        onChange={(e) => setFormData({ ...formData, responsavel_interno: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                    />
                                    <datalist id="colaboradores-list">
                                        {auxiliares.colaboradores?.map((c) => (
                                            <option key={c.idUsuario} value={c.NomeCompleto} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            {/* Identificação do Veículo */}
                            <div className="p-3.5 sm:p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">
                                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Car className="w-4 h-4 text-emerald-400" />
                                    Identificação do Veículo
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Tipo de Veículo</label>
                                        <select
                                            value={formData.tipo_veiculo}
                                            onChange={(e) => setFormData({ ...formData, tipo_veiculo: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200"
                                        >
                                            <option value="NENHUM">Nenhum (Entrada a pé)</option>
                                            <option value="CARRETA">Carreta / Bitrem</option>
                                            <option value="CAMINHAO">Caminhão Toco / Truck</option>
                                            <option value="VUC">VUC / 3/4</option>
                                            <option value="UTILITARIO">Utilitário / Furgão / Van</option>
                                            <option value="CARRO">Carro de Passeio</option>
                                            <option value="MOTO">Motocicleta</option>
                                        </select>
                                    </div>

                                    {formData.tipo_veiculo !== 'NENHUM' && (
                                        <>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                                    Placa <span className="text-rose-400">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="ABC1D23"
                                                    value={formData.placa_veiculo}
                                                    onChange={(e) => setFormData({ ...formData, placa_veiculo: e.target.value.toUpperCase() })}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-slate-100 uppercase"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">Modelo</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: Scania / Gol"
                                                    value={formData.modelo_veiculo}
                                                    onChange={(e) => setFormData({ ...formData, modelo_veiculo: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">Cor</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: Branco, Prata"
                                                    value={formData.cor_veiculo}
                                                    onChange={(e) => setFormData({ ...formData, cor_veiculo: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Crachá, NF e Botões de Foto Mobile-First */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">
                                        Nº do Crachá Provisório
                                    </label>
                                    <div className="relative">
                                        <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Ex: 14"
                                            value={formData.numero_cracha}
                                            onChange={(e) => setFormData({ ...formData, numero_cracha: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 font-bold focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">
                                        Nº Nota Fiscal / Romaneio
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: NF 104523"
                                        value={formData.numero_nf}
                                        onChange={(e) => setFormData({ ...formData, numero_nf: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100"
                                    />
                                </div>

                                {/* Botão de Foto Visitante */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1">
                                        Foto do Visitante / Motorista
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setCameraModalConfig({
                                            isOpen: true,
                                            target: 'pessoa',
                                            title: 'Capturar Foto do Visitante'
                                        })}
                                        className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition active:scale-95 ${
                                            formData.foto_pessoa_base64
                                                ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                                                : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                                        }`}
                                    >
                                        <Camera className="w-4 h-4 text-emerald-400" />
                                        {formData.foto_pessoa_base64 ? '✓ Foto Capturada' : 'Câmera / Celular'}
                                    </button>
                                </div>

                                {/* Botão de Foto Veículo */}
                                {formData.tipo_veiculo !== 'NENHUM' ? (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">
                                            Foto da Placa / Veículo
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setCameraModalConfig({
                                                isOpen: true,
                                                target: 'veiculo',
                                                title: 'Capturar Foto da Placa/Veículo'
                                            })}
                                            className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition active:scale-95 ${
                                                formData.foto_veiculo_base64
                                                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                                                    : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                                            }`}
                                        >
                                            <Camera className="w-4 h-4 text-emerald-400" />
                                            {formData.foto_veiculo_base64 ? '✓ Foto da Placa' : 'Câmera / Celular'}
                                        </button>
                                    </div>
                                ) : (
                                    <div />
                                )}
                            </div>

                            {/* Botão de Envio Full-Width no Mobile */}
                            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="w-full sm:w-auto px-4 py-3 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition text-center"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full sm:w-auto px-6 py-3 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition active:scale-95 disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Gravando Entrada...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Autorizar Entrada
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* 4. LISTA DE QUEM ESTÁ NO PÁTIO AGORA */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <h2 className="text-sm sm:text-base font-bold text-white">
                                No Pátio ({acessosFiltrados.length})
                            </h2>
                        </div>

                        {/* Botão de Atualizar */}
                        <button
                            type="button"
                            onClick={carregarDados}
                            title="Atualizar lista"
                            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 transition"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl">
                            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                            <span className="text-xs">Atualizando pátio da portaria...</span>
                        </div>
                    ) : acessosFiltrados.length === 0 ? (
                        <div className="p-10 text-center text-slate-500 flex flex-col items-center justify-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl">
                            <UserCheck className="w-10 h-10 text-slate-600 stroke-1" />
                            <span className="text-sm font-semibold text-slate-300">Nenhum visitante ou veículo no pátio.</span>
                            <span className="text-xs text-slate-500">Novas entradas liberadas aparecerão aqui automaticamente.</span>
                        </div>
                    ) : (
                        /* VISUALIZAÇÃO EM CARTÕES (IDEAL PARA CELULAR) OU TABELA (DESKTOP) */
                        viewMode === 'cards' || (typeof window !== 'undefined' && window.innerWidth <= 768) ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {acessosFiltrados.map((item) => {
                                    const isCritico = (item.permanencia_atual_min > 240);
                                    return (
                                        <div
                                            key={item.id}
                                            className={`bg-slate-900 border rounded-2xl p-4 flex flex-col justify-between shadow-md space-y-3 transition ${
                                                isCritico ? 'border-rose-500/50 bg-rose-950/15' : 'border-slate-800 hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="space-y-3">
                                                {/* Topo do Card: Foto, Nome e Crachá */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {item.foto_pessoa_url ? (
                                                            <img
                                                                src={item.foto_pessoa_url}
                                                                alt={item.nome_pessoa}
                                                                onClick={() => setFotoAmpliada(item.foto_pessoa_url)}
                                                                className="w-12 h-12 rounded-xl object-cover border border-slate-700 cursor-pointer shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                                                                <User className="w-6 h-6" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-sm text-white truncate">
                                                                {item.nome_pessoa}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400 truncate">
                                                                {item.empresa_origem || item.tipo}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Badge Crachá */}
                                                    {item.numero_cracha ? (
                                                        <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold rounded-lg text-xs font-mono shrink-0">
                                                            #{item.numero_cracha}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {/* Detalhes do Veículo & Destino */}
                                                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                                                    {item.tipo_veiculo && item.tipo_veiculo !== 'NENHUM' ? (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-slate-400 flex items-center gap-1.5">
                                                                {['CARRETA', 'CAMINHAO'].includes(item.tipo_veiculo) ? (
                                                                    <Truck className="w-3.5 h-3.5 text-amber-400" />
                                                                ) : (
                                                                    <Car className="w-3.5 h-3.5 text-emerald-400" />
                                                                )}
                                                                {item.modelo_veiculo || item.tipo_veiculo}
                                                            </span>
                                                            <span className="font-mono font-bold text-slate-100 bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                                                                {item.placa_veiculo}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-slate-500 italic text-[11px]">Entrada a pé</div>
                                                    )}

                                                    <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800/60">
                                                        <span className="text-slate-500">Destino:</span>
                                                        <span className="font-medium truncate max-w-[150px]">{item.setor_destino || '-'}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between text-slate-300">
                                                        <span className="text-slate-500">Permanência:</span>
                                                        <span className={`font-bold inline-flex items-center gap-1 ${
                                                            isCritico ? 'text-rose-400 animate-pulse' : 'text-slate-200'
                                                        }`}>
                                                            <Clock className="w-3 h-3" />
                                                            {formatPermanencia(item.permanencia_atual_min)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Botão de Check-out Touch-Friendly */}
                                            <button
                                                type="button"
                                                onClick={() => handleCheckOut(item)}
                                                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow transition active:scale-98"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                Registrar Saída (Check-out)
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* VISUALIZAÇÃO EM TABELA (DESKTOP) */
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                                <div className="divide-y divide-slate-800/80 overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                            <tr>
                                                <th className="py-3 px-4">Visitante / Empresa</th>
                                                <th className="py-3 px-4">Veículo / Placa</th>
                                                <th className="py-3 px-4">Destino / Responsável</th>
                                                <th className="py-3 px-4 text-center">Crachá</th>
                                                <th className="py-3 px-4">Entrada / Permanência</th>
                                                <th className="py-3 px-4 text-right">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {acessosFiltrados.map((item) => {
                                                const isCritico = (item.permanencia_atual_min > 240);
                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-3">
                                                                {item.foto_pessoa_url ? (
                                                                    <img
                                                                        src={item.foto_pessoa_url}
                                                                        alt={item.nome_pessoa}
                                                                        onClick={() => setFotoAmpliada(item.foto_pessoa_url)}
                                                                        className="w-10 h-10 rounded-xl object-cover border border-slate-700 cursor-pointer"
                                                                    />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                                                                        <User className="w-5 h-5" />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="font-bold text-white text-sm">{item.nome_pessoa}</div>
                                                                    <div className="text-[11px] text-slate-400">{item.empresa_origem || item.tipo}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {item.tipo_veiculo !== 'NENHUM' ? (
                                                                <div>
                                                                    <span className="font-mono font-bold text-slate-100 bg-slate-800 px-1.5 py-0.5 rounded text-xs">
                                                                        {item.placa_veiculo}
                                                                    </span>
                                                                    <div className="text-[10px] text-slate-400 mt-0.5">{item.modelo_veiculo || item.tipo_veiculo}</div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-500 italic">Entrada a pé</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="font-medium text-slate-200">{item.setor_destino || '-'}</div>
                                                            {item.responsavel_interno && <div className="text-[11px] text-slate-400">Resp: {item.responsavel_interno}</div>}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            {item.numero_cracha ? (
                                                                <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold rounded-lg text-xs font-mono">
                                                                    #{item.numero_cracha}
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="text-slate-300 font-mono text-[11px]">
                                                                {new Date(item.data_entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${
                                                                isCritico ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' : 'bg-slate-800 text-slate-300'
                                                            }`}>
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {formatPermanencia(item.permanencia_atual_min)}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCheckOut(item)}
                                                                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-sm transition active:scale-95 inline-flex items-center gap-1.5"
                                                            >
                                                                <LogOut className="w-3.5 h-3.5" />
                                                                Saída
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </main>

            {/* BOTÃO FLUTUANTE (FAB) PARA CELULAR: NOVO CHECK-IN RÁPIDO */}
            {!isFormOpen && (
                <div className="fixed bottom-4 right-4 z-40 sm:hidden">
                    <button
                        type="button"
                        onClick={() => {
                            setIsFormOpen(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-2xl shadow-emerald-950 flex items-center gap-2 border border-emerald-400/30 active:scale-95 transition"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Novo Check-in</span>
                    </button>
                </div>
            )}

            {/* MODAL DE CÂMERA WEBCAM / UPLOAD */}
            <CameraCaptureModal
                isOpen={cameraModalConfig.isOpen}
                title={cameraModalConfig.title}
                onClose={() => setCameraModalConfig({ ...cameraModalConfig, isOpen: false })}
                onCapture={(base64) => {
                    if (cameraModalConfig.target === 'pessoa') {
                        setFormData((prev) => ({ ...prev, foto_pessoa_base64: base64 }));
                    } else if (cameraModalConfig.target === 'veiculo') {
                        setFormData((prev) => ({ ...prev, foto_veiculo_base64: base64 }));
                    }
                }}
            />

            {/* MODAL DE TROCAR PORTEIRO */}
            {isTrocaPorteiroOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-5 text-slate-100">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                            <h3 className="font-bold text-base text-white">Selecionar Operador da Guarita</h3>
                            <button
                                onClick={() => setIsTrocaPorteiroOpen(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mb-4">
                            Selecione o operador responsável por este terminal:
                        </p>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {auxiliares.porteiros?.map((porteiro) => (
                                <button
                                    key={porteiro.id}
                                    type="button"
                                    onClick={() => {
                                        setPorteiroAtivo(porteiro);
                                        setIsTrocaPorteiroOpen(false);
                                        toast.info(`Porteiro ativo alterado para ${porteiro.nome}`);
                                    }}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                                        porteiroAtivo?.id === porteiro.id
                                            ? 'bg-emerald-950/40 border-emerald-500 text-white'
                                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    {porteiro.foto_url ? (
                                        <img
                                            src={porteiro.foto_url}
                                            alt={porteiro.nome}
                                            className="w-10 h-10 rounded-lg object-cover border border-slate-700"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                                            <User className="w-5 h-5" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm truncate">{porteiro.nome}</div>
                                        <div className="text-xs text-slate-400 truncate">Turno: {porteiro.nome_turno || 'Padrão'}</div>
                                    </div>
                                    {porteiroAtivo?.id === porteiro.id && (
                                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE FOTO AMPLIADA */}
            {fotoAmpliada && (
                <div
                    onClick={() => setFotoAmpliada(null)}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-pointer"
                >
                    <div className="relative max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden border border-slate-700 bg-black">
                        <img src={fotoAmpliada} alt="Foto Ampliada" className="w-full h-full object-contain" />
                        <button
                            onClick={() => setFotoAmpliada(null)}
                            className="absolute top-3 right-3 p-2 bg-slate-900/80 text-white rounded-full hover:bg-slate-800"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

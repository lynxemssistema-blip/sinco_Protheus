import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    GraduationCap, BookOpen, CheckSquare, Layers, Factory, Users,
    Play, Clock, AlertTriangle, ArrowRight, ExternalLink, Search,
    Filter, ChevronDown, ChevronRight, Award, ShieldCheck,
    Cpu, Grid, Wrench, BarChart2, TrendingUp, Calendar, ArrowLeftRight,
    ClipboardList, CheckCircle2, RotateCcw, Printer, Sparkles, HelpCircle,
    Timer, Hourglass, CheckCheck, Package, ShoppingCart, Truck, Database
} from 'lucide-react';
import { ALL_TRAINING_SCREENS, ALL_TRAINING_TRACKS } from '../config/trainingData';

// Mapeador de Ícones para Trilhas
const ICON_MAP = {
    Factory,
    Cpu,
    Layers,
    BarChart2,
    Wrench,
    Package,
    ShoppingCart,
    Truck,
    Database,
    BookOpen
};

export default function TrainingPlanTab() {
    const navigate = useNavigate();
    
    // Modo de visualização escolhido pelo usuário: 'trilhas' | 'telas' | 'checklist'
    const [viewMode, setViewMode] = useState('telas');
    const [searchFilter, setSearchFilter] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const [selectedTrackId, setSelectedTrackId] = useState(null);
    const [expandedScreenId, setExpandedScreenId] = useState(null);

    // Checklist persistido no LocalStorage
    const [completedItems, setCompletedItems] = useState(() => {
        try {
            const saved = localStorage.getItem('metalfisa_training_progress');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    const toggleCheckItem = (itemId) => {
        setCompletedItems(prev => {
            const next = { ...prev, [itemId]: !prev[itemId] };
            try {
                localStorage.setItem('metalfisa_training_progress', JSON.stringify(next));
            } catch (e) {}
            return next;
        });
    };

    const resetChecklist = () => {
        if (window.confirm('Deseja realmente zerar todo o progresso do checklist de treinamento?')) {
            setCompletedItems({});
            localStorage.removeItem('metalfisa_training_progress');
        }
    };

    // Estatísticas de Carga Horária e Progresso
    const totalTrainingHours = useMemo(() => {
        return ALL_TRAINING_SCREENS.reduce((acc, s) => acc + (s.durationHours || 1), 0);
    }, []);

    const totalChecks = useMemo(() => {
        return ALL_TRAINING_SCREENS.reduce((acc, s) => acc + (s.verificationChecklist?.length || 0), 0);
    }, []);

    const finishedChecks = useMemo(() => {
        return Object.values(completedItems).filter(Boolean).length;
    }, [completedItems]);

    const progressPercentage = totalChecks > 0 ? Math.round((finishedChecks / totalChecks) * 100) : 0;

    // Filtros de telas por Categoria (todas as áreas do sistema)
    const categories = useMemo(() => {
        const set = new Set(ALL_TRAINING_SCREENS.map(s => s.category));
        return ['Todas', ...Array.from(set)];
    }, []);

    const filteredScreens = useMemo(() => {
        return ALL_TRAINING_SCREENS.filter(s => {
            const matchesCat = selectedCategory === 'Todas' || s.category === selectedCategory;
            const q = searchFilter.toLowerCase();
            const matchesQuery = !q || 
                s.name.toLowerCase().includes(q) ||
                s.summary.toLowerCase().includes(q) ||
                s.targetAudience.toLowerCase().includes(q) ||
                s.category.toLowerCase().includes(q) ||
                s.workflowSteps?.some(st => st.title.toLowerCase().includes(q) || st.action.toLowerCase().includes(q));
            return matchesCat && matchesQuery;
        });
    }, [selectedCategory, searchFilter]);

    return (
        <div className="space-y-8 pb-16">

            {/* ── BANNER DE CONTROLE DO TREINAMENTO ── */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 md:p-8 text-white shadow-xl border border-slate-700/60 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold ring-1 ring-blue-500/30 mb-3">
                            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                            Matriz de Capacitação Operacional · Treinamento Página a Página
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">
                            Plano de Treinamento Geral: <span className="text-blue-400">Página a Página</span>
                        </h2>
                        <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                            Capacitação prática com carga horária de <strong className="text-amber-300">mínimo 1h a 2h por tela/módulo</strong> do sistema (Teoria + Prática no Posto).
                            Navegue abaixo por <strong className="text-white">Fichas Tela a Tela</strong>, filtre por área (Comercial, Engenharia, PCP, Logística, Qualidade, VMI, Manutenção) ou estude pelas <strong className="text-white">Trilhas por Função</strong>.
                        </p>
                    </div>

                    {/* Widget de Carga Horária e Progresso */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 flex flex-col justify-between min-w-[150px]">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-1">
                                <Timer className="w-4 h-4 text-amber-400" />
                                <span>Carga Curricular</span>
                            </div>
                            <p className="text-2xl font-black text-white">{totalTrainingHours} Horas</p>
                            <p className="text-[10px] text-slate-400">{ALL_TRAINING_SCREENS.length} telas mapeadas (≥1h/tela)</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 min-w-[240px] flex flex-col justify-between">
                            <div className="flex items-center justify-between text-xs font-bold mb-2">
                                <span className="text-slate-300">Progresso Geral</span>
                                <span className="text-emerald-400">{progressPercentage}% Concluído</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                                <div 
                                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500 rounded-full"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                <span>{finishedChecks} de {totalChecks} competências validadas</span>
                                {finishedChecks > 0 && (
                                    <button 
                                        onClick={resetChecklist} 
                                        className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1"
                                        title="Zerar checklist"
                                    >
                                        <RotateCcw className="w-3 h-3" /> Zerar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── SELETOR DE FORMATO DE TREINAMENTO (ESCOLHA DO USUÁRIO) ── */}
                <div className="mt-8 pt-6 border-t border-slate-700/60 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 mr-2">
                        Formato de Estudo:
                    </span>

                    <button
                        onClick={() => setViewMode('telas')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'telas'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        <BookOpen className="w-4 h-4" />
                        Guia Passo a Passo Página a Página ({ALL_TRAINING_SCREENS.length} Telas)
                    </button>
                    
                    <button
                        onClick={() => setViewMode('trilhas')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'trilhas'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        <Award className="w-4 h-4" />
                        Trilhas por Cargo / Função ({ALL_TRAINING_TRACKS.length} Trilhas)
                    </button>

                    <button
                        onClick={() => setViewMode('checklist')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            viewMode === 'checklist'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        <CheckSquare className="w-4 h-4" />
                        Matriz de Competências & Avaliação Prática
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════
                MODO 1: GUIA OPERACIONAL PASSO A PASSO (PÁGINA A PÁGINA)
            ══════════════════════════════════════════════════════════════════════ */}
            {viewMode === 'telas' && (
                <div className="space-y-6">
                    {/* Barra de Filtros e Busca */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                            <span className="text-xs font-bold text-slate-400 flex items-center gap-1 flex-shrink-0">
                                <Filter className="w-3.5 h-3.5" /> Módulo:
                            </span>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                                        selectedCategory === cat
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="relative w-full md:w-80">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Filtrar tela, ação, cargo ou rota..."
                                value={searchFilter}
                                onChange={e => setSearchFilter(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Lista de Fichas Operacionais Página a Página */}
                    <div className="space-y-5">
                        {filteredScreens.map(scr => {
                            const isExpanded = expandedScreenId === scr.id || filteredScreens.length === 1;

                            return (
                                <div 
                                    key={scr.id}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
                                >
                                    {/* Cabeçalho da Ficha */}
                                    <div 
                                        onClick={() => setExpandedScreenId(isExpanded ? null : scr.id)}
                                        className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 font-black text-sm shadow-inner">
                                                <BookOpen className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <h4 className="text-base font-black text-slate-900">{scr.name}</h4>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800">
                                                        {scr.category}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-amber-700" /> Carga: {scr.durationLabel}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
                                                    {scr.summary}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 self-end md:self-center flex-shrink-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(scr.path);
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
                                            >
                                                Praticar na Tela <ExternalLink className="w-3 h-3" />
                                            </button>
                                            <div className="p-1 rounded-full text-slate-400 hover:text-slate-600">
                                                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Conteúdo Expandido com Passo a Passo Completo */}
                                    {isExpanded && (
                                        <div className="p-6 border-t border-slate-200 space-y-6">
                                            
                                            {/* Bloco de Carga Horária & Estrutura */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-1 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> Carga Horária & Estrutura:
                                                    </p>
                                                    <p className="text-xs font-bold text-amber-950 mb-0.5">
                                                        {scr.durationLabel}
                                                    </p>
                                                    <p className="text-[11px] text-amber-900 leading-snug">
                                                        {scr.structure}
                                                    </p>
                                                </div>

                                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                                        🎯 Objetivo da Operação:
                                                    </p>
                                                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                                                        {scr.objective}
                                                    </p>
                                                </div>

                                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                                        👤 Quem Utiliza:
                                                    </p>
                                                    <p className="text-xs text-slate-700 font-medium">
                                                        {scr.targetAudience}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Pré-requisitos */}
                                            {scr.prerequisites && scr.prerequisites.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-black text-slate-800 mb-2 flex items-center gap-1.5">
                                                        <ShieldCheck className="w-4 h-4 text-amber-500" /> Pré-requisitos & Insumos:
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {scr.prerequisites.map((prereq, idx) => (
                                                            <span key={idx} className="px-2.5 py-1 rounded-md text-xs bg-amber-50 text-amber-900 border border-amber-200/60 font-medium">
                                                                • {prereq}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Passo a Passo Operacional */}
                                            <div>
                                                <p className="text-xs font-black text-slate-800 mb-3 flex items-center gap-1.5">
                                                    <Play className="w-4 h-4 text-blue-600" /> Fluxo de Operação Passo a Passo:
                                                </p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {scr.workflowSteps.map((st) => (
                                                        <div key={st.step} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-3">
                                                            <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                                                                {st.step}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-900 mb-1">{st.title}</p>
                                                                <p className="text-xs text-slate-600 leading-relaxed">{st.action}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Alertas Críticos */}
                                            {scr.criticalAlerts && scr.criticalAlerts.length > 0 && (
                                                <div className="bg-red-50/80 border border-red-200 rounded-xl p-4">
                                                    <p className="text-xs font-black text-red-900 flex items-center gap-1.5 mb-1.5">
                                                        <AlertTriangle className="w-4 h-4 text-red-600" /> Atenção & Erros Comuns a Evitar:
                                                    </p>
                                                    <ul className="space-y-1">
                                                        {scr.criticalAlerts.map((alert, idx) => (
                                                            <li key={idx} className="text-xs text-red-800 leading-relaxed">
                                                                ⚠️ {alert}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════
                MODO 2: TRILHAS DE APRENDIZAGEM POR FUNÇÃO / CARGO
            ══════════════════════════════════════════════════════════════════════ */}
            {viewMode === 'trilhas' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-slate-900">Trilhas de Formação Especializadas</h3>
                            <p className="text-xs text-slate-500">Carga horária acumulada com no mínimo 1h dedicada por módulo temático</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ALL_TRAINING_TRACKS.map(track => {
                            const IconComponent = ICON_MAP[track.icon] || BookOpen;
                            const isSelected = selectedTrackId === track.id;
                            
                            // Telas desta trilha
                            const trackScreens = ALL_TRAINING_SCREENS.filter(s => track.modules.includes(s.id));

                            return (
                                <div 
                                    key={track.id}
                                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                                        isSelected 
                                            ? 'border-blue-500 shadow-xl ring-2 ring-blue-500/20' 
                                            : 'border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'
                                    }`}
                                >
                                    <div className="p-6">
                                        <div className="flex items-start justify-between gap-3 mb-4">
                                            <div className={`p-3 rounded-xl ${track.badge}`}>
                                                <IconComponent className="w-6 h-6" />
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                                                    <Clock className="w-3.5 h-3.5 text-amber-700" /> {track.estimatedTime}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {track.moduleCount} módulos (≥1h cada)
                                                </span>
                                            </div>
                                        </div>

                                        <h4 className="text-base font-black text-slate-900 mb-1 leading-snug">
                                            {track.title}
                                        </h4>
                                        <p className="text-xs text-slate-500 mb-4">{track.subtitle}</p>

                                        <p className="text-xs text-slate-600 leading-relaxed mb-5">
                                            {track.description}
                                        </p>

                                        <div className="space-y-2 mb-4">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                Competências-Chave Desenvolvidas:
                                            </p>
                                            <ul className="space-y-1.5">
                                                {track.keySkills.map((skill, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                        <span>{skill}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Footer do Card com Telas da Trilha */}
                                    <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-col gap-3">
                                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                            <span>Módulos da Trilha ({track.modules.length})</span>
                                            <button
                                                onClick={() => setSelectedTrackId(isSelected ? null : track.id)}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1"
                                            >
                                                {isSelected ? 'Ocultar Detalhes' : 'Ver Cronograma'}
                                                {isSelected ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>

                                        {isSelected && (
                                            <div className="space-y-2 pt-2 border-t border-slate-200">
                                                {trackScreens.map(scr => (
                                                    <div 
                                                        key={scr.id}
                                                        className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-xs font-bold text-slate-900 truncate">{scr.name}</p>
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-800 border border-amber-200/60">
                                                                    {scr.durationLabel}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 mt-0.5">{scr.structure}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => navigate(scr.path)}
                                                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-black transition-colors self-end sm:self-center flex-shrink-0"
                                                        >
                                                            Abrir Tela <ExternalLink className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════
                MODO 3: MATRIZ DE COMPETÊNCIAS & CHECKLIST DE CAPACITAÇÃO
            ══════════════════════════════════════════════════════════════════════ */}
            {viewMode === 'checklist' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-black text-slate-900">Matriz de Validação Prática Geral</h3>
                            <p className="text-xs text-slate-500">
                                Registro formal de conclusão de horas e validação de competências página a página (Mínimo de 1h dedicada por módulo).
                            </p>
                        </div>
                        <button 
                            onClick={() => window.print()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all"
                        >
                            <Printer className="w-4 h-4" /> Imprimir Ficha de Treinamento
                        </button>
                    </div>

                    <div className="space-y-4">
                        {ALL_TRAINING_SCREENS.map(scr => (
                            <div key={scr.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-3 gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-sm font-black text-slate-900">{scr.name}</h4>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                                            {scr.category}
                                        </span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-amber-700" /> Carga: {scr.durationLabel}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => navigate(scr.path)}
                                        className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 self-end sm:self-center"
                                    >
                                        Ir para tela <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {scr.verificationChecklist?.map((chk, idx) => {
                                        const checkKey = `${scr.id}_${idx}`;
                                        const isChecked = !!completedItems[checkKey];

                                        return (
                                            <label 
                                                key={idx}
                                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                                    isChecked 
                                                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-medium'
                                                        : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <input 
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleCheckItem(checkKey)}
                                                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 mt-0.5"
                                                />
                                                <span className="text-xs leading-relaxed">{chk}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

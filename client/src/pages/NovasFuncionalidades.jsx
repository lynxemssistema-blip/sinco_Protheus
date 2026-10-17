import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Sparkles, Calendar, Search, Filter, ArrowRight, CheckCircle2,
    Zap, Shield, FileSpreadsheet, Package, Layers, ExternalLink,
    ChevronDown, ChevronUp, Clock, Info, Award
} from 'lucide-react';
import { CHANGELOG_DATA, CHANGELOG_MODULES, CHANGELOG_TYPES } from '../config/changelogData';

export default function NovasFuncionalidades() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedModule, setSelectedModule] = useState('todos');
    const [selectedType, setSelectedType] = useState('todos');
    const [expandedCards, setExpandedCards] = useState({});

    // Toggle para expandir/recolher detalhes de cada card
    const toggleExpand = (id) => {
        setExpandedCards(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Filtros dinâmicos
    const filteredItems = useMemo(() => {
        return CHANGELOG_DATA.filter(item => {
            const matchesSearch =
                item.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.resumo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.moduloLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.destaques.some(d => d.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesModule = selectedModule === 'todos' || item.modulo === selectedModule;
            const matchesType = selectedType === 'todos' || item.tipo === selectedType;

            return matchesSearch && matchesModule && matchesType;
        });
    }, [searchTerm, selectedModule, selectedType]);

    // Cores dos badges de tipo
    const getBadgeStyle = (tipo) => {
        switch (tipo) {
            case 'nova_feature':
                return 'bg-emerald-100 text-emerald-800 border-emerald-300';
            case 'resiliencia':
                return 'bg-amber-100 text-amber-900 border-amber-300';
            case 'melhoria':
                return 'bg-blue-100 text-blue-800 border-blue-300';
            default:
                return 'bg-slate-100 text-slate-800 border-slate-300';
        }
    };

    // Ícone representativo por tipo
    const getIconByType = (tipo) => {
        switch (tipo) {
            case 'nova_feature':
                return <Sparkles className="w-5 h-5 text-emerald-600" />;
            case 'resiliencia':
                return <Zap className="w-5 h-5 text-amber-600" />;
            case 'melhoria':
                return <Shield className="w-5 h-5 text-blue-600" />;
            default:
                return <CheckCircle2 className="w-5 h-5 text-slate-600" />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
            {/* Header Hero */}
            <div className="bg-gradient-to-r from-[#1E2825] via-[#24312D] to-[#32423D] text-white py-10 px-6 sm:px-12 shadow-lg border-b border-[#425750]/40 relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-12">
                    <Sparkles className="w-96 h-96 text-white" />
                </div>

                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-amber-300 border border-white/20">
                            <Calendar className="w-4 h-4" />
                            Marco Oficial de Entrega: 09/09/2026
                        </div>
                        <span className="text-xs text-slate-300 font-medium">
                            Versão Atual: <strong className="text-white">{CHANGELOG_DATA[0]?.versao || 'v2026.4.7'}</strong>
                        </span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 text-white flex items-center gap-3">
                        Novas Funcionalidades do App
                    </h1>
                    <p className="text-slate-200 text-sm sm:text-base max-w-3xl leading-relaxed">
                        Registro oficial de todas as implementações, inovações e melhorias incorporadas ao Portal Lynx
                        a partir da data de entrega do sistema (<strong>09/09/2026</strong>).
                    </p>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/10">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/10 flex items-center gap-3">
                            <div className="p-2.5 bg-amber-500/20 rounded-lg text-amber-300">
                                <Award className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-300 font-medium">Marco Inicial</p>
                                <p className="text-sm font-bold text-white">09/09/2026</p>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/10 flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-500/20 rounded-lg text-emerald-300">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-300 font-medium">Entregas no Período</p>
                                <p className="text-sm font-bold text-white">{CHANGELOG_DATA.length} Recursos Registrados</p>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/10 flex items-center gap-3">
                            <div className="p-2.5 bg-blue-500/20 rounded-lg text-blue-300">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-300 font-medium">Status de Evolução</p>
                                <p className="text-sm font-bold text-white">Suporte Contínuo Ativo</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-8">
                {/* Search & Filter Bar */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-8">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por recurso, palavra-chave, módulo ou melhoria..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#425750] transition-all"
                            />
                        </div>

                        {/* Filter by Module */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <div className="flex gap-1.5 flex-nowrap">
                                {CHANGELOG_MODULES.map(mod => (
                                    <button
                                        key={mod.id}
                                        onClick={() => setSelectedModule(mod.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                            selectedModule === mod.id
                                                ? 'bg-[#425750] text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {mod.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline Results */}
                {filteredItems.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
                        <Info className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-700 mb-1">Nenhum recurso encontrado</h3>
                        <p className="text-xs text-slate-500">Tente ajustar o termo da busca ou selecione outro módulo.</p>
                    </div>
                ) : (
                    <div className="relative border-l-2 border-slate-200 ml-4 sm:ml-8 pl-6 sm:pl-8 space-y-8">
                        {filteredItems.map((item, index) => {
                            const isExpanded = expandedCards[item.id] !== false; // Default aberto

                            return (
                                <div key={item.id} className="relative group">
                                    {/* Timeline Marker Dot */}
                                    <div className="absolute -left-[35px] sm:-left-[43px] top-6 w-8 h-8 rounded-full bg-white border-2 border-slate-300 group-hover:border-[#425750] shadow-sm flex items-center justify-center transition-colors">
                                        {getIconByType(item.tipo)}
                                    </div>

                                    {/* Card Principal */}
                                    <div className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all p-6">
                                        {/* Card Header */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {/* Data */}
                                                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-bold font-mono">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                                    {item.data}
                                                </span>

                                                {/* Versão */}
                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-mono font-medium">
                                                    {item.versao}
                                                </span>

                                                {/* Módulo */}
                                                <span className="bg-[#425750]/10 text-[#425750] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                                    {item.moduloLabel}
                                                </span>

                                                {/* Tipo */}
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle(item.tipo)}`}>
                                                    {item.tipoLabel}
                                                </span>
                                            </div>

                                            {/* Expand/Collapse Button */}
                                            <button
                                                onClick={() => toggleExpand(item.id)}
                                                className="text-slate-400 hover:text-slate-600 p-1 rounded transition"
                                                title={isExpanded ? 'Recolher detalhes' : 'Ver detalhes'}
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {/* Título & Resumo */}
                                        <h2 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
                                            {item.titulo}
                                        </h2>
                                        <p className="text-sm text-slate-600 leading-relaxed mb-4">
                                            {item.resumo}
                                        </p>

                                        {/* Destaques Expansíveis */}
                                        {isExpanded && (
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-4 animate-fadeIn">
                                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                    O que foi entregue nesta atualização:
                                                </h4>
                                                <ul className="space-y-2">
                                                    {item.destaques.map((dest, i) => (
                                                        <li key={i} className="text-xs text-slate-700 flex items-start gap-2 leading-relaxed">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-[#425750] mt-1.5 flex-shrink-0" />
                                                            <span>{dest}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Card Footer: Ações e Autor */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                                            <span className="text-[11px] text-slate-400">
                                                Registrado por: <strong className="text-slate-600">{item.autor}</strong>
                                            </span>

                                            {item.linkAcao && (
                                                <Link
                                                    to={item.linkAcao}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#425750] hover:text-[#23302C] transition-colors"
                                                >
                                                    <span>{item.linkLabel || 'Acessar no Sistema'}</span>
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

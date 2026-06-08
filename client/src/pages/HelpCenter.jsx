import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Search, HelpCircle, ChevronRight, BookOpen, ShoppingCart, Factory,
    Package, Settings, Truck, FileText, BarChart, Calendar, Database,
    ShieldCheck, Lightbulb, Zap, ArrowRight, Home, List, Grid,
    CheckSquare, TrendingUp, Bell, User, Layers
} from 'lucide-react';
import { useHelp } from '../contexts/HelpContext';

// ─── Icon Map ────────────────────────────────────────────────────────────────
const ICON_MAP = {
    ShoppingCart, Factory, Package, Settings, Truck, FileText, BarChart,
    Calendar, Database, ShieldCheck, BookOpen, Grid, CheckSquare,
    TrendingUp, Bell, User, Layers, Search, Home, List, HelpCircle,
};

function ModuleIcon({ name, className = 'h-5 w-5' }) {
    const Icon = ICON_MAP[name] || HelpCircle;
    return <Icon className={className} />;
}

// ─── Category Styles ──────────────────────────────────────────────────────────
const CATEGORY_STYLES = {
    'Comercial': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    'PCP': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    'Engenharia': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
    'SINCO / Engenharia': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-500' },
    'Materiais': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    'Compras': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
    'Produtos': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
    'Logística': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
    'SGQ': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
    'Relatórios': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
    'Administração': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
    'Comunicação': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
    'Analytics': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
    'PCP Refinado': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
};

function getStyle(category) {
    return CATEGORY_STYLES[category] || CATEGORY_STYLES['Administração'];
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HelpCenter() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [activeCategory, setActiveCategory] = useState('Todos');
    const { allModules, openHelp, loadingHelp } = useHelp();
    const [activeTabId, setActiveTabId] = useState(null);

    const selectedModule = useMemo(
        () => allModules.find(m => m.id === selectedId) || null,
        [allModules, selectedId]
    );

    useEffect(() => {
        if (selectedModule?.tabs && Array.isArray(selectedModule.tabs) && selectedModule.tabs.length > 0) {
            if (!activeTabId || !selectedModule.tabs.some(t => t?.id === activeTabId)) {
                setActiveTabId(selectedModule.tabs[0].id);
            }
        } else {
            setActiveTabId(null);
        }
    }, [selectedModule, activeTabId]);

    const activeTab = useMemo(() => {
        return selectedModule?.tabs?.find(t => t?.id === activeTabId);
    }, [selectedModule, activeTabId]);

    const content = activeTab || selectedModule;

    const modules = allModules || [];

    // Build categories list
    const categories = useMemo(() => {
        const cats = {};
        modules.forEach(mod => {
            if (!cats[mod.category]) cats[mod.category] = [];
            cats[mod.category].push(mod);
        });
        return cats;
    }, [allModules]);

    // Filter modules by search
    const filteredModules = useMemo(() => {
        if (!searchTerm.trim()) return allModules;
        const q = searchTerm.toLowerCase();
        return allModules.filter(mod =>
            mod.title.toLowerCase().includes(q) ||
            mod.description.toLowerCase().includes(q) ||
            mod.category.toLowerCase().includes(q) ||
            mod.steps?.some(s => s.toLowerCase().includes(q)) ||
            mod.tips?.some(t => t.toLowerCase().includes(q))
        );
    }, [allModules, searchTerm]);

    const handleSelectModule = (id) => {
        setSelectedId(id);
        setSearchTerm('');
    };

    const handleNavigate = (path) => {
        navigate(path);
    };

    // ── Highlight search term ──
    function highlight(text) {
        if (!searchTerm.trim()) return text;
        const parts = text.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        return parts.map((p, i) =>
            p.toLowerCase() === searchTerm.toLowerCase()
                ? <mark key={i} className="bg-amber-200 text-amber-900 rounded px-0.5 not-italic font-bold">{p}</mark>
                : p
        );
    }

    return (
        <div className="min-h-screen bg-[#f1f5f9] font-sans">

            {/* ── TOP HEADER ── */}
            <div className="bg-slate-900 text-white">
                <div className="max-w-7xl mx-auto px-6 py-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        {/* Title block */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <BookOpen className="h-4 w-4 text-blue-400" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                                    MetalFisa PCP · Central de Ajuda
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none mb-2">
                                Documentação
                                <span className="text-blue-400"> Completa</span>
                            </h1>
                            <p className="text-slate-400 text-base max-w-lg">
                                {allModules.length} módulos documentados. Clique em qualquer módulo para ver o guia detalhado de uso.
                            </p>
                        </div>

                        {/* Search */}
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Buscar por módulo, função ou dica..."
                                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-slate-500 focus:bg-white focus:text-slate-900 focus:placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 transition-all outline-none text-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] bg-white/10 text-slate-300 font-bold px-2 py-0.5 rounded-full">
                                    {filteredModules.length} resultado{filteredModules.length !== 1 && 's'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── BODY ── */}
            <div className="max-w-7xl mx-auto px-6 py-8 flex gap-6">

                {/* ── LEFT SIDEBAR (Category Nav) ── */}
                {!searchTerm && (
                    <aside className="w-64 flex-shrink-0 hidden md:block">
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden sticky top-6">
                            <div className="px-4 py-3 border-b border-slate-100">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Categorias</p>
                            </div>
                            <nav className="py-2">
                                {/* All modules */}
                                <button
                                    onClick={() => setSelectedId(null)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors ${!selectedId ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                >
                                    <Home className="h-3.5 w-3.5 flex-shrink-0" />
                                    Visão Geral
                                    <span className="ml-auto text-[10px] font-black opacity-60">{allModules.length}</span>
                                </button>

                                <div className="my-2 mx-4 h-px bg-slate-100" />

                                {Object.entries(categories).map(([cat, mods]) => {
                                    const style = getStyle(cat);
                                    const isActiveCat = selectedModule?.category === cat;
                                    return (
                                        <div key={cat}>
                                            <p className="px-4 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                {cat}
                                            </p>
                                            {mods.map(mod => (
                                                <button
                                                    key={mod.id}
                                                    onClick={() => handleSelectModule(mod.id)}
                                                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-xs font-semibold transition-all group ${selectedId === mod.id
                                                            ? `${style.bg} ${style.text} font-bold`
                                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                        }`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedId === mod.id ? style.dot : 'bg-slate-300 group-hover:bg-slate-400'}`} />
                                                    <span className="truncate">{mod.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })}
                            </nav>
                        </div>
                    </aside>
                )}

                {/* ── MAIN CONTENT ── */}
                <div className="flex-1 min-w-0">

                    {/* ── SEARCH RESULTS ── */}
                    {searchTerm && (
                        <div className="space-y-3">
                            {filteredModules.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                                    <Search className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                                    <p className="font-bold text-slate-500">Nenhum resultado para "{searchTerm}"</p>
                                    <p className="text-sm text-slate-400 mt-1">Tente palavras como "pedido", "OP", "SINCO" ou "compras".</p>
                                </div>
                            ) : (
                                filteredModules.map(mod => {
                                    const style = getStyle(mod.category);
                                    return (
                                        <div
                                            key={mod.id}
                                            onClick={() => { setSearchTerm(''); handleSelectModule(mod.id); }}
                                            className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-400 hover:shadow-md cursor-pointer transition-all group"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className={`w-10 h-10 rounded-xl ${style.bg} ${style.text} flex items-center justify-center flex-shrink-0`}>
                                                    <ModuleIcon name={mod.icon} className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${style.badge}`}>
                                                            {mod.category}
                                                        </span>
                                                    </div>
                                                    <h3 className="font-black text-slate-900 text-base">{highlight(mod.title)}</h3>
                                                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{highlight(mod.description)}</p>
                                                    {mod.steps?.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 1).map((s, i) => (
                                                        <p key={i} className="text-xs text-slate-400 mt-1 line-clamp-1">
                                                            <span className="font-bold text-slate-500">Passo: </span>{highlight(s)}
                                                        </p>
                                                    ))}
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* ── MODULE DETAIL VIEW ── */}
                    {!searchTerm && selectedModule && (() => {
                        const style = getStyle(selectedModule.category);
                        return (
                            <div className="space-y-5">
                                {/* Breadcrumb */}
                                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                    <button onClick={() => setSelectedId(null)} className="hover:text-slate-700 transition-colors">Todos os módulos</button>
                                    <ChevronRight className="h-3 w-3" />
                                    <span className={selectedModule.text}>{selectedModule.category}</span>
                                    <ChevronRight className="h-3 w-3" />
                                    <span className="text-slate-700 font-bold">{selectedModule.title}</span>
                                </div>

                                {/* Module Header */}
                                <div className={`rounded-2xl border p-6 ${style.bg} ${style.border}`}>
                                    <div className="flex items-start gap-4">
                                        <div className={`w-14 h-14 rounded-2xl bg-white/60 backdrop-blur flex items-center justify-center flex-shrink-0 shadow-sm ${style.text}`}>
                                            <ModuleIcon name={selectedModule.icon} className="h-7 w-7" />
                                        </div>
                                        <div>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${style.text}`}>{selectedModule.category}</span>
                                            <h2 className="text-2xl font-black text-slate-900 mt-0.5">{selectedModule.title}</h2>
                                            <p className="text-slate-600 mt-1 leading-relaxed">{selectedModule.description}</p>
                                        </div>
                                    </div>

                                    {/* Navigate to page button */}
                                    <button
                                        onClick={() => handleNavigate(selectedModule.path)}
                                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 transition-colors"
                                    >
                                        <ArrowRight className="h-4 w-4" />
                                        Ir para o módulo
                                    </button>
                                </div>

                                {/* Tabs Navigation */}
                                {selectedModule.tabs && selectedModule.tabs.length > 0 && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex gap-2 overflow-x-auto no-scrollbar">
                                        {selectedModule.tabs.map((tab) => {
                                            const active = activeTabId === tab.id;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActiveTabId(tab.id)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                                                        active 
                                                            ? 'bg-slate-900 text-white shadow-sm font-black' 
                                                            : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Tab Description (if active tab is selected and has specific description) */}
                                {activeTab && content?.description && content.description !== selectedModule.description && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{content.description}</p>
                                    </div>
                                )}

                                {/* Visual Image representation */}
                                {content?.image && (
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Layers className="h-4 w-4 text-slate-500" />
                                            <h3 className="font-black text-slate-800 uppercase tracking-wide text-xs">Visualização do Processo</h3>
                                        </div>
                                        <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-3">
                                            <img 
                                                src={content.image} 
                                                alt={content.imageCaption || "Ajuda visual"} 
                                                className="max-h-[480px] w-auto object-contain rounded-lg shadow-sm border border-slate-100 hover:scale-[1.01] transition-transform duration-300"
                                            />
                                            {content.imageCaption && (
                                                <p className="text-xs text-slate-500 mt-3 text-center max-w-2xl font-semibold leading-relaxed">
                                                    {content.imageCaption}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Steps */}
                                {content?.steps && content.steps.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                                        <div className="flex items-center gap-2 mb-5">
                                            <List className="h-4 w-4 text-slate-500" />
                                            <h3 className="font-black text-slate-800 uppercase tracking-wide text-xs">Como usar este módulo</h3>
                                        </div>
                                        <ol className="space-y-4">
                                            {content.steps.map((step, i) => (
                                                <li key={i} className="flex gap-4 items-start">
                                                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center mt-0.5">
                                                        {i + 1}
                                                    </span>
                                                    <p className="text-sm text-slate-600 leading-relaxed pt-1">{step}</p>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Tips */}
                                {content?.tips && content.tips.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Lightbulb className="h-4 w-4 text-amber-600" />
                                            <h3 className="font-black text-amber-800 uppercase tracking-wide text-xs">Dicas Pro</h3>
                                        </div>
                                        <ul className="space-y-3">
                                            {content.tips.map((tip, i) => (
                                                <li key={i} className="flex gap-3 items-start">
                                                    <Zap className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                    <p className="text-sm text-amber-800 leading-relaxed">{tip}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Related modules */}
                                {selectedModule.links && selectedModule.links.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <ArrowRight className="h-4 w-4 text-slate-500" />
                                            <h3 className="font-black text-slate-700 uppercase tracking-wide text-xs">Módulos Relacionados</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {selectedModule.links.map(link => {
                                                const relMod = allModules.find(m => m.path === link.path);
                                                const relStyle = relMod ? getStyle(relMod.category) : getStyle('Administração');
                                                return (
                                                    <button
                                                        key={link.path}
                                                        onClick={() => relMod ? handleSelectModule(relMod.id) : handleNavigate(link.path)}
                                                        className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-900 hover:border-slate-900 hover:text-white group transition-all text-left"
                                                    >
                                                        {relMod && (
                                                            <div className={`w-8 h-8 rounded-lg ${relStyle.bg} ${relStyle.text} group-hover:bg-white/10 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors`}>
                                                                <ModuleIcon name={relMod.icon} className="h-4 w-4" />
                                                            </div>
                                                        )}
                                                        <span className="text-sm font-bold truncate">{link.label}</span>
                                                        <ChevronRight className="h-4 w-4 ml-auto opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* ── OVERVIEW: All modules grid ── */}
                    {!searchTerm && !selectedModule && (
                        <div className="space-y-8">
                            {/* Workflow Fluxo */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                                <h2 className="font-black text-slate-900 text-lg mb-1">Fluxo MetalFisa PCP</h2>
                                <p className="text-sm text-slate-500 mb-6">O caminho do pedido: da venda à entrega.</p>
                                <div className="flex flex-wrap gap-3 items-center">
                                    {[
                                        { label: 'Vendas', desc: 'Pedido ERP', style: getStyle('Comercial') },
                                        { label: 'Engenharia', desc: 'Liberar BOM', style: getStyle('Engenharia') },
                                        { label: 'PCP', desc: 'Planejar OPs', style: getStyle('PCP') },
                                        { label: 'Produção', desc: 'Apontar Horas', style: getStyle('PCP') },
                                        { label: 'Logística', desc: 'Romaneio', style: getStyle('Logística') },
                                    ].map((step, i, arr) => (
                                        <React.Fragment key={step.label}>
                                            <div className={`flex flex-col items-center justify-center w-28 h-20 rounded-2xl border-2 ${step.style.bg} ${step.style.border}`}>
                                                <span className={`text-sm font-black ${step.style.text}`}>{step.label}</span>
                                                <span className="text-[10px] text-slate-500 mt-0.5">{step.desc}</span>
                                            </div>
                                            {i < arr.length - 1 && (
                                                <ChevronRight className="h-5 w-5 text-slate-300 flex-shrink-0" />
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>

                            {/* Category groups */}
                            {Object.entries(categories).map(([cat, mods]) => {
                                const style = getStyle(cat);
                                return (
                                    <div key={cat}>
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                                            <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs">{cat}</h3>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${style.badge}`}>{mods.length}</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {mods.map(mod => (
                                                <button
                                                    key={mod.id}
                                                    onClick={() => handleSelectModule(mod.id)}
                                                    className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-400 hover:shadow-md transition-all text-left group"
                                                >
                                                    <div className={`w-10 h-10 rounded-xl ${style.bg} ${style.text} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                                        <ModuleIcon name={mod.icon} className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-900 text-sm leading-tight">{mod.title}</h4>
                                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{mod.description}</p>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-slate-200 group-hover:text-slate-500 flex-shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="max-w-7xl mx-auto px-6 pb-12 text-center">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                    MetalFisa PCP · Central de Ajuda · {allModules.length} módulos documentados
                </p>
            </div>
        </div>
    );
}

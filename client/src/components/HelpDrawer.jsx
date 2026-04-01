import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    X, HelpCircle, ChevronRight, ArrowRight, Lightbulb,
    BookOpen, ExternalLink, List, Zap, Pin, PinOff
} from 'lucide-react';
import { useHelp } from '../contexts/HelpContext';

// ─── Icon Map ────────────────────────────────────────────────────────────────
const ICON_BG = {
    'Comercial': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    'PCP': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    'Engenharia': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
    'SINCO / Engenharia': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
    'Materiais': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    'Compras': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    'Produtos': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
    'Logística': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
    'SGQ': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
    'Relatórios': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
    'Administração': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
    'Comunicação': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
    'Analytics': { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
};

function getCategoryStyle(category) {
    return ICON_BG[category] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function HelpDrawer() {
    const { isOpen, forcedPath, closeHelp, isPinned, togglePin, allModules, getHelpByPath, loadingHelp } = useHelp();
    const location = useLocation();
    const navigate = useNavigate();
    const drawerRef = useRef(null);

    const currentPath = forcedPath || location.pathname;
    const helpData = getHelpByPath(currentPath);

    // Close on Escape
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') closeHelp(); };
        if (isOpen) window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, closeHelp]);

    // Click outside to close
    useEffect(() => {
        const onClickOutside = (e) => {
            if (drawerRef.current && !drawerRef.current.contains(e.target)) closeHelp();
        };
        if (isOpen && !isPinned) {
            // slight delay so the open-click itself doesn't immediately close
            const t = setTimeout(() => document.addEventListener('mousedown', onClickOutside), 100);
            return () => { clearTimeout(t); document.removeEventListener('mousedown', onClickOutside); };
        }
    }, [isOpen, isPinned, closeHelp]);

    const handleNavigate = (path) => {
        navigate(path);
        closeHelp();
    };

    const categoryStyle = helpData ? getCategoryStyle(helpData.category) : null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[998] transition-opacity duration-300 ${(isOpen && !isPinned) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-hidden="true"
            />

            {/* Drawer */}
            <aside
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Central de Ajuda"
                className={`fixed right-0 top-0 h-full w-full max-w-[420px] bg-white shadow-2xl z-[999] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-900 text-white flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <HelpCircle className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Ajuda Contextual</p>
                            <h2 className="text-sm font-black tracking-tight leading-tight">
                                {helpData ? helpData.title : 'Central de Ajuda'}
                            </h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={togglePin}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isPinned ? 'bg-indigo-500/30 text-indigo-200' : 'bg-white/10 hover:bg-white/20'}`}
                            title={isPinned ? "Desafixar menu" : "Fixar menu lateral"}
                            aria-label="Fixar ajuda"
                        >
                            {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </button>
                        <button
                            onClick={closeHelp}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            aria-label="Fechar ajuda"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto">

                    {helpData ? (
                        // ── PAGE-SPECIFIC HELP ──
                        <div className="p-5 space-y-5">
                            {/* Category badge + description */}
                            <div className={`p-4 rounded-xl border ${categoryStyle.bg} ${categoryStyle.border}`}>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${categoryStyle.text}`}>
                                    {helpData.category}
                                </span>
                                <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                                    {helpData.description}
                                </p>
                            </div>

                            {/* Steps */}
                            {helpData.steps && helpData.steps.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <List className="h-4 w-4 text-slate-500" />
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                                            Como usar
                                        </h3>
                                    </div>
                                    <ol className="space-y-2">
                                        {helpData.steps.map((step, i) => (
                                            <li key={i} className="flex gap-3 items-start">
                                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center mt-0.5">
                                                    {i + 1}
                                                </span>
                                                <p className="text-sm text-slate-600 leading-relaxed">{step}</p>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            {/* Tips */}
                            {helpData.tips && helpData.tips.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Lightbulb className="h-4 w-4 text-amber-600" />
                                        <h3 className="text-xs font-black uppercase tracking-widest text-amber-700">
                                            Dicas Pro
                                        </h3>
                                    </div>
                                    <ul className="space-y-2">
                                        {helpData.tips.map((tip, i) => (
                                            <li key={i} className="flex gap-2 items-start">
                                                <Zap className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                                                <p className="text-xs text-amber-800 leading-relaxed">{tip}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Related links */}
                            {helpData.links && helpData.links.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <ArrowRight className="h-4 w-4 text-slate-500" />
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                                            Módulos Relacionados
                                        </h3>
                                    </div>
                                    <div className="space-y-2">
                                        {helpData.links.map((link) => (
                                            <button
                                                key={link.path}
                                                onClick={() => handleNavigate(link.path)}
                                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-900 hover:text-white group transition-all duration-200"
                                            >
                                                <span className="text-sm font-semibold">{link.label}</span>
                                                <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Divider + link to full help */}
                            <div className="border-t border-slate-100 pt-4">
                                <button
                                    onClick={() => handleNavigate('/ajuda')}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-slate-900 hover:text-slate-900 text-sm font-bold transition-all"
                                >
                                    <BookOpen className="h-4 w-4" />
                                    Ver Central de Ajuda Completa
                                    <ExternalLink className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        // ── FALLBACK: No help for this page → show all modules ──
                        <div className="p-5 space-y-4">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                                <HelpCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm font-bold text-slate-500">Nenhuma ajuda específica para esta tela.</p>
                                <p className="text-xs text-slate-400 mt-1">Explore outros módulos abaixo ou acesse a Central de Ajuda.</p>
                            </div>

                            <button
                                onClick={() => handleNavigate('/ajuda')}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
                            >
                                <BookOpen className="h-4 w-4" />
                                Abrir Central de Ajuda
                            </button>

                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Todos os Módulos</p>
                                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                                    {allModules.map((mod) => {
                                        const style = getCategoryStyle(mod.category);
                                        return (
                                            <button
                                                key={mod.route_path}
                                                onClick={() => handleNavigate(mod.route_path)}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-left group"
                                            >
                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${style.bg} ${style.text} flex-shrink-0`}>
                                                    {mod.category.split('/')[0].trim()}
                                                </span>
                                                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 truncate">
                                                    {mod.title}
                                                </span>
                                                <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-slate-600 flex-shrink-0 ml-auto" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex-shrink-0 border-t border-slate-100 px-5 py-3 bg-slate-50">
                    <p className="text-[10px] text-slate-400 text-center font-medium">
                        MetalFisa PCP · Central de Ajuda · Pressione <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">ESC</kbd> para fechar
                    </p>
                </div>
            </aside>
        </>
    );
}

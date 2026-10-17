import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    X, HelpCircle, ChevronRight, ArrowRight, Lightbulb,
    BookOpen, ExternalLink, List, Zap, Pin, PinOff, Layers, Printer
} from 'lucide-react';
import { useHelp } from '../contexts/HelpContext';

// ─── Icon Map ────────────────────────────────────────────────────────────────
// ─── Icon Map ────────────────────────────────────────────────────────────────
const ICON_BG = {
    'Comercial': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    'Comercial / PCP': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    'PCP': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    'PCP Geral': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    'PCP Refinado': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    'OP Fracionada': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    'PCP / Chão de Fábrica': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
    'Planejamento / PCP': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },

    'Engenharia': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
    'Engenharia / CAD': { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
    'Engenharia / Produto': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
    'SINCO / Engenharia': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
    'SINCO': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
    'Materiais': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    'Compras': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    'Suprimentos': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    'Suprimentos / Fiscal': { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
    'Suprimentos / Qualidade': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    'Produtos': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
    'Logística': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
    'Logística / Fornecedores': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    'SGQ': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    'Qualidade': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    'Relatórios': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
    'Administração': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
    'Comunicação': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
    'Analytics': { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
    'Gestão a Vista': { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
    'Financeiro': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
    'Recursos Humanos': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
    'RH': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },

    'Manutenção de Equip.': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    'Manutenção': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    'Meu Painel': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    'Acesso Cliente': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    'Sistema': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
};

function getCategoryStyle(category) {
    return ICON_BG[category] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function HelpDrawer() {
    const { isOpen, forcedPath, closeHelp, isPinned, togglePin, getHelpByPath, allModules = [], loadingHelp } = useHelp();
    const location = useLocation();
    const navigate = useNavigate();
    const drawerRef = React.useRef(null);

    const [activeTabId, setActiveTabId] = React.useState(null);

    const currentPath = forcedPath || location.pathname;
    
    // Memoize helpData to avoid unnecessary re-renders
    const helpData = React.useMemo(() => {
        try {
            return getHelpByPath ? getHelpByPath(currentPath) : null;
        } catch (err) {
            console.error('Error in getHelpByPath:', err);
            return null;
        }
    }, [currentPath, getHelpByPath]);

    // Initial tab selection and reset logic
    React.useEffect(() => {
        if (helpData?.tabs && Array.isArray(helpData.tabs) && helpData.tabs.length > 0) {
            if (!activeTabId || !helpData.tabs.some(t => t?.id === activeTabId)) {
                setActiveTabId(helpData.tabs[0].id);
            }
        } else {
            setActiveTabId(null);
        }
    }, [helpData, activeTabId]);

    const activeTab = React.useMemo(() => {
        return helpData?.tabs?.find(t => t?.id === activeTabId);
    }, [helpData, activeTabId]);
    
    const content = activeTab || helpData;
    
    // Safely get category style
    const categoryName = helpData?.category || 'Central';
    const categoryStyle = React.useMemo(() => getCategoryStyle(categoryName), [categoryName]);

    // Close on Escape
    React.useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') closeHelp(); };
        if (isOpen) window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, closeHelp]);

    // Handle outside clicks
    React.useEffect(() => {
        const onClickOutside = (e) => {
            if (isOpen && !isPinned && drawerRef.current && !drawerRef.current.contains(e.target)) {
                closeHelp();
            }
        };
        if (isOpen && !isPinned) {
            const t = setTimeout(() => document.addEventListener('mousedown', onClickOutside), 100);
            return () => { clearTimeout(t); document.removeEventListener('mousedown', onClickOutside); };
        }
    }, [isOpen, isPinned, closeHelp]);

    const handleNavigate = (path) => {
        navigate(path);
        closeHelp();
    };

    const handlePrint = () => {
        const doc = helpData;
        if (!doc) return;

        const allTabs = doc.tabs && doc.tabs.length > 0 ? doc.tabs : null;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return;

        const tabsHtml = allTabs
            ? allTabs.map(tab => `
                <div class="section">
                    <h2>${tab.label || ''}</h2>
                    ${tab.description ? `<p class="desc">${tab.description}</p>` : ''}
                    ${tab.steps && tab.steps.length > 0
                        ? `<ol>${tab.steps.map(s => `<li>${s}</li>`).join('')}</ol>`
                        : ''}
                </div>`).join('')
            : '';

        const globalSteps = doc.steps && doc.steps.length > 0 && !allTabs
            ? `<div class="section"><h2>Como usar</h2><ol>${doc.steps.map(s => `<li>${s}</li>`).join('')}</ol></div>`
            : '';

        const tips = doc.tips && doc.tips.length > 0
            ? `<div class="section tips"><h2>💡 Dicas</h2><ul>${doc.tips.map(t => `<li>${t}</li>`).join('')}</ul></div>`
            : '';

        printWindow.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
            <meta charset="UTF-8">
            <title>Ajuda – ${doc.title || 'Lynx'}</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; margin: 24px 32px; }
                header { border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; margin-bottom: 18px; }
                header h1 { font-size: 18px; margin: 0; color: #1e3a5f; }
                header .badge { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
            </body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 400);
    };

    if (!isOpen && !isPinned) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[998] transition-opacity duration-300 ${(isOpen && !isPinned) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-hidden="true"
                onClick={closeHelp}
            />

            {/* Drawer */}
            <aside
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Central de Ajuda"
                className={`fixed right-0 top-0 h-full w-full max-w-[420px] bg-white shadow-2xl z-[999] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-900 text-white flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <HelpCircle className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Ajuda Contextual</p>
                            <h2 className="text-sm font-black tracking-tight leading-tight truncate max-w-[200px]">
                                {helpData?.title || 'Central de Ajuda'}
                            </h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            title="Imprimir ajuda desta tela"
                            aria-label="Imprimir ajuda"
                        >
                            <Printer className="h-4 w-4" />
                        </button>
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

                {/* ── Tabs Navigation ── */}
                {helpData?.tabs && helpData.tabs.length > 0 && (
                    <div className="px-5 pt-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                        <div className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth">
                            {helpData.tabs.map((tab) => {
                                if (!tab || !tab.id) return null;
                                const active = activeTabId === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTabId(tab.id)}
                                        className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${active ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {tab.label || 'Aba'}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {helpData ? (
                        <div className="p-5 space-y-6">
                            {/* Category badge + description */}
                            <div className={`p-4 rounded-xl border ${categoryStyle?.bg || 'bg-gray-50'} ${categoryStyle?.border || 'border-gray-200'}`}>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${categoryStyle?.text || 'text-gray-600'}`}>
                                    {helpData.category || 'Geral'}
                                </span>
                                {!content?.document_content && (
                                    <p className="mt-1.5 text-sm text-slate-700 font-medium leading-relaxed">
                                        {content?.description || 'Nenhum detalhe adicional disponível para este item.'}
                                    </p>
                                )}
                            </div>

                            {/* Document Content from SGQ */}
                            {content?.document_content ? (
                                <div 
                                    className="sgq-document-content animate-in fade-in slide-in-from-bottom-2 duration-300 bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
                                    dangerouslySetInnerHTML={{ __html: content.document_content }}
                                />
                            ) : (
                                <>
                                    {/* Visual Image representation */}
                                    {content?.image && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex items-center gap-2">
                                                <Layers className="h-4 w-4 text-slate-400" />
                                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                                                    Visualização do Processo
                                                </h3>
                                            </div>
                                            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-2 flex flex-col items-center">
                                                <img 
                                                    src={content.image} 
                                                    alt={content.imageCaption || "Ajuda visual"} 
                                                    className="max-h-[200px] w-auto object-contain rounded-lg shadow-sm"
                                                />
                                                {content.imageCaption && (
                                                    <p className="text-[10px] text-slate-500 mt-2 text-center font-medium leading-relaxed">
                                                        {content.imageCaption}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Steps (Legacy fallback) */}
                                    {content?.steps && Array.isArray(content.steps) && content.steps.length > 0 && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex items-center gap-2 mb-3">
                                                <List className="h-4 w-4 text-slate-400" />
                                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                                                    Como usar
                                                </h3>
                                            </div>
                                            <ol className="space-y-3">
                                                {content.steps.map((step, i) => (
                                                    <li key={i} className="flex gap-3 items-start">
                                                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center mt-0.5 shadow-sm">
                                                            {i + 1}
                                                        </span>
                                                        <p className="text-[13px] text-slate-600 font-medium leading-relaxed">{step}</p>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}

                                    {/* Tips (Legacy fallback) */}
                                    {content?.tips && Array.isArray(content.tips) && content.tips.length > 0 && (
                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 animate-in fade-in zoom-in-95 duration-500">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Lightbulb className="h-4 w-4 text-amber-600" />
                                                <h3 className="text-xs font-black uppercase tracking-widest text-amber-700">
                                                    Dicas Pro
                                                </h3>
                                            </div>
                                            <ul className="space-y-2.5">
                                                {content.tips.map((tip, i) => (
                                                    <li key={i} className="flex gap-2.5 items-start">
                                                        <div className="bg-amber-400/20 p-1 rounded-md mt-0.5 shadow-xs">
                                                            <Zap className="h-3 w-3 text-amber-600 flex-shrink-0" />
                                                        </div>
                                                        <p className="text-xs text-amber-900 font-semibold leading-relaxed">{tip}</p>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Related links */}
                            {helpData.links && Array.isArray(helpData.links) && helpData.links.length > 0 && (
                                <div className="pb-4">
                                    <div className="flex items-center gap-2 mb-3 pt-2">
                                        <ArrowRight className="h-4 w-4 text-slate-400" />
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                                            Módulos Relacionados
                                        </h3>
                                    </div>
                                    <div className="space-y-2">
                                        {helpData.links.map((link, idx) => (
                                            <button
                                                key={link?.path || idx}
                                                onClick={() => link?.path && handleNavigate(link.path)}
                                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-900 hover:text-white group transition-all duration-200 shadow-sm hover:shadow-md"
                                            >
                                                <span className="text-sm font-semibold">{link?.label || 'Link'}</span>
                                                <ChevronRight className="h-4 w-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Footer Link to help center */}
                            <div className="border-t border-slate-100 pt-4 pb-4">
                                <button
                                    onClick={() => handleNavigate('/ajuda')}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-slate-900 hover:text-slate-900 hover:bg-slate-50 text-sm font-bold transition-all"
                                >
                                    <BookOpen className="h-4 w-4" />
                                    Ver Central de Ajuda Completa
                                    <ExternalLink className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-5 space-y-4">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                                {loadingHelp ? (
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                                        <p className="text-xs text-slate-400 font-bold">Carregando...</p>
                                    </div>
                                ) : (
                                    <>
                                        <HelpCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-slate-500">Nenhuma ajuda específica para esta tela.</p>
                                        <p className="text-xs text-slate-400 mt-1">Explore outros módulos abaixo ou acesse a Central de Ajuda.</p>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={() => handleNavigate('/ajuda')}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors shadow-md"
                            >
                                <BookOpen className="h-4 w-4" />
                                Abrir Central de Ajuda
                            </button>

                            {allModules && allModules.length > 0 && (
                                <div className="pt-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Todos os Módulos</p>
                                    <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                                        {allModules.map((mod) => {
                                            if (!mod) return null;
                                            const style = getCategoryStyle(mod.category);
                                            return (
                                                <button
                                                    key={mod.route_path}
                                                    onClick={() => handleNavigate(mod.route_path)}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-left group"
                                                >
                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${style?.bg || 'bg-gray-100'} ${style?.text || 'text-gray-700'} flex-shrink-0`}>
                                                        {mod.category?.split('/')[0]?.trim() || 'Geral'}
                                                    </span>
                                                    <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 truncate flex-1">
                                                        {mod.title || 'Módulo'}
                                                    </span>
                                                    <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-slate-600 flex-shrink-0" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex-shrink-0 border-t border-slate-100 px-5 py-3 bg-slate-50">
                    <p className="text-[10px] text-slate-400 text-center font-medium">
                        Lynx PCP · Central de Ajuda · Pressione <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono shadow-sm">ESC</kbd> para fechar
                    </p>
                </div>
            </aside>
        </>
    );
}

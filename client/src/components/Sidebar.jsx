import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, ChevronLeft, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, HelpCircle, Search, Key, FileText, Siren, Star, GripVertical, Target, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useHelp } from '../contexts/HelpContext';
import api, { getCompanySettings } from '../services/api';
import { MENU_GROUPS } from '../config/menuItems';
import { AppLogo } from './ui/AppLogo';
import ChangePasswordModal from './ChangePasswordModal';
import AlertaEmergenciaModal from './sst/AlertaEmergenciaModal';
import './Sidebar.css';

const NavItem = ({
    to,
    id,
    icon: Icon,
    label,
    isCollapsed,
    isActive,
    isMobile,
    setIsOpen,
    isFavorite,
    onToggleFavorite,
    isDraggable,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    isDragging,
    isDragOver
}) => (
    <div
        className={`relative group/nav flex items-center w-full transition-all ${isDragging ? 'opacity-30 scale-95' : ''} ${isDragOver ? 'border-t-2 border-amber-400 bg-amber-400/10' : ''}`}
        draggable={isDraggable && !isCollapsed}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
    >
        <Link
            to={to}
            title={isCollapsed ? label : ''} // Tooltip on collapse
            className={`tech-nav-item flex-1 w-full ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`}
            onClick={() => isMobile && setIsOpen(false)}
        >
            {!isCollapsed && isDraggable && (
                <GripVertical
                    className="w-3.5 h-3.5 -ml-3 mr-0.5 text-slate-500 opacity-0 group-hover/nav:opacity-100 cursor-grab active:cursor-grabbing transition-opacity flex-shrink-0"
                    title="Arraste para reordenar favoritos"
                />
            )}
            <Icon className={`tech-icon ${isCollapsed ? 'mr-0' : ''}`} strokeWidth={1.5} />
            {!isCollapsed && <span className="truncate pr-8 flex-1">{label}</span>}
        </Link>
        {!isCollapsed && onToggleFavorite && id && (
            <button
                type="button"
                className={`tech-fav-btn ${isFavorite ? 'is-favorite' : ''}`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleFavorite(id);
                }}
                title={isFavorite ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
                aria-label={isFavorite ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
            >
                <Star
                    className={`w-3.5 h-3.5 transition-all ${
                        isFavorite 
                            ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]' 
                            : 'text-slate-500 hover:text-amber-400'
                    }`}
                />
            </button>
        )}
    </div>
);

const GroupTitle = ({ label, id, isOpen, isCollapsed, onToggle, badgeCount }) => (
    <div
        className={`tech-group-title flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} cursor-pointer hover:text-white transition-colors`}
        onClick={() => onToggle(id)}
        title={isCollapsed ? label : ''}
    >
        {!isCollapsed && (
            <div className="flex items-center gap-1.5">
                <span>{label}</span>
                {badgeCount !== undefined && badgeCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {badgeCount}
                    </span>
                )}
            </div>
        )}
        {isCollapsed ? (
            // Mini version: simple dot or line to indicate group
            <div className="w-full h-px bg-slate-700 my-2 relative group-hover:bg-slate-500">
                <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 p-0.5 bg-slate-800 rounded-full">
                    {isOpen ? <ChevronDown className="w-2 h-2 text-slate-500" /> : <ChevronRight className="w-2 h-2 text-slate-500" />}
                </div>
            </div>
        ) : (
            isOpen ? <ChevronDown className="w-3 h-3 opacity-50" /> : <ChevronRight className="w-3 h-3 opacity-50" />
        )}
    </div>
);

const Sidebar = ({ isOpen, setIsOpen, isMobile }) => {
    const location = useLocation();
    const { user, logout, hasPermission, isAdmin, isSuperAdmin } = useAuth();
    const { toggleHelp } = useHelp();
    const [visibleItems, setVisibleItems] = useState({});
    const [generalConfig, setGeneralConfig] = useState({});
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 1100 && window.innerWidth >= 768); 
    const [searchTerm, setSearchTerm] = useState('');
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);

    // ── Favoritos do Usuário (Persistência em Nuvem + Fallback Local) ──────────
    const [favoriteItemIds, setFavoriteItemIds] = useState(() => {
        try {
            const uid = user?.id || 'guest';
            const local = localStorage.getItem(`metalfisa_fav_menu_${uid}`);
            if (local) {
                const parsed = JSON.parse(local);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch {
            // fallback
        }
        return [];
    });

    const [draggedFavIdx, setDraggedFavIdx] = useState(null);
    const [dragOverFavIdx, setDragOverFavIdx] = useState(null);

    // Carregar favoritos da API e sincronizar com localStorage
    useEffect(() => {
        const uid = user?.id;
        if (!uid) return;
        const storageKey = `metalfisa_fav_menu_${uid}`;

        // 1. Tenta carregar do localStorage imediatamente para render sem atraso
        try {
            const local = localStorage.getItem(storageKey);
            if (local) {
                const parsed = JSON.parse(local);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setFavoriteItemIds(parsed);
                }
            }
        } catch (e) {
            console.warn('Erro ao ler favoritos locais:', e);
        }

        // 2. Sincroniza com a nuvem (MySQL)
        api.get('/users/preferences/user_favorite_menus')
            .then(res => {
                if (res.data && Array.isArray(res.data.value) && res.data.value.length > 0) {
                    setFavoriteItemIds(res.data.value);
                    localStorage.setItem(storageKey, JSON.stringify(res.data.value));
                } else {
                    // Se a nuvem não tiver, checa se tem localmente e sobe para o banco
                    const local = localStorage.getItem(storageKey);
                    if (local) {
                        try {
                            const parsed = JSON.parse(local);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                api.put('/users/preferences/user_favorite_menus', { value: parsed }).catch(() => {});
                                return;
                            }
                        } catch (_) {}
                    }
                    // Se não tiver nem na nuvem nem local, aplica favoritos padrão
                    const defaultFavs = ['vendas', 'erp_pedidos', 'erp_produtos', 'erp_producao', 'dashboard_faturamento'];
                    setFavoriteItemIds(defaultFavs);
                    localStorage.setItem(storageKey, JSON.stringify(defaultFavs));
                    api.put('/users/preferences/user_favorite_menus', { value: defaultFavs }).catch(() => {});
                }
            })
            .catch(() => {});
    }, [user?.id]);

    const saveFavorites = (newFavorites) => {
        const uid = user?.id || 'guest';
        try {
            localStorage.setItem(`metalfisa_fav_menu_${uid}`, JSON.stringify(newFavorites));
        } catch (e) {
            console.warn('Erro ao salvar favoritos locais:', e);
        }

        if (user?.id) {
            api.put('/users/preferences/user_favorite_menus', { value: newFavorites })
                .catch(err => console.warn('Erro ao sincronizar favoritos na nuvem:', err.message));
        }
    };

    const toggleFavorite = (itemId) => {
        if (!itemId) return;
        setFavoriteItemIds(prev => {
            const next = prev.includes(itemId)
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId];
            saveFavorites(next);
            return next;
        });
    };

    // Drag and Drop handlers para reordenação arrastando
    const handleFavDragStart = (e, index) => {
        setDraggedFavIdx(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleFavDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverFavIdx !== index) {
            setDragOverFavIdx(index);
        }
    };

    const handleFavDrop = (e, targetIndex) => {
        e.preventDefault();
        setDragOverFavIdx(null);
        if (draggedFavIdx === null || draggedFavIdx === targetIndex) return;

        setFavoriteItemIds(prev => {
            const next = [...prev];
            const [movedItem] = next.splice(draggedFavIdx, 1);
            next.splice(targetIndex, 0, movedItem);
            saveFavorites(next);
            return next;
        });
        setDraggedFavIdx(null);
    };

    const handleFavDragEnd = () => {
        setDraggedFavIdx(null);
        setDragOverFavIdx(null);
    };
    
    // Acesso exclusivo Superadmin Lynx (apenas Superadmin global da plataforma)
    const userEmail = (user?.email || '').toLowerCase().trim();
    const userLogin = (user?.login || user?.Login || '').toLowerCase().trim();
    const isSuperAdminLynx = 
        Boolean(isSuperAdmin) ||
        userLogin === 'superadmin' || 
        userLogin === 'edson' ||
        user?.id === 37 ||
        userEmail === 'edsonmanoel2012@gmail.com' || 
        userLogin === 'edsonmanoel2012@gmail.com';

    // Helper to toggle sidebar size
    const toggleSidebarSize = () => {
        setIsCollapsed(prev => !prev);
    };

    // Auto-collapse logic for Tablet and Desktop
    useEffect(() => {
        if (isMobile) {
            setIsCollapsed(false); // Mobile always full width when open
            return;
        }

        const handleAutoCollapse = () => {
            const width = window.innerWidth;
            if (width < 1100 && width >= 768) {
                setIsCollapsed(true);
            } else if (width >= 1100) {
                setIsCollapsed(false);
            }
        };

        window.addEventListener('resize', handleAutoCollapse);
        return () => window.removeEventListener('resize', handleAutoCollapse);
    }, [isMobile]);

    // Deduplicação defensiva de grupos de menu para garantir que nenhuma chave ou seção seja repetida
    const uniqueMenuGroups = React.useMemo(() => {
        const seen = new Set();
        return MENU_GROUPS.filter(group => {
            if (!group?.id || seen.has(group.id)) return false;
            seen.add(group.id);
            return true;
        });
    }, []);

    // Mapa de todos os itens do menu para busca rápida e montagem dos favoritos
    const allMenuItemsMap = useMemo(() => {
        const map = new Map();
        uniqueMenuGroups.forEach(group => {
            group.items.forEach(item => {
                if (!map.has(item.id)) {
                    map.set(item.id, item);
                }
            });
        });
        return map;
    }, [uniqueMenuGroups]);

    // Initialize expanded groups based on active route and device
    useEffect(() => {
        setExpandedGroups(prev => {
            const next = { ...prev };
            uniqueMenuGroups.forEach(group => {
                const hasActive = group.items.some(item => item.path === location.pathname);
                if (hasActive) {
                    next[group.id] = true;
                } else if (next[group.id] === undefined) {
                    // Initialize only if not already set
                    next[group.id] = !isMobile;
                }
            });
            return next;
        });
    }, [isMobile, location.pathname, uniqueMenuGroups]);

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

    // Load Menu Configuration
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const settings = await getCompanySettings();
                // If menu_config exists, parse it. If null/empty, assume ALL visible (default true)
                let config = {};
                if (settings.menu_config) {
                    try {
                        config = typeof settings.menu_config === 'string'
                            ? JSON.parse(settings.menu_config)
                            : settings.menu_config;
                    } catch (e) {
                        console.error("Invalid menu config JSON", e);
                        config = {}; // Fallback
                    }
                }
                
                let genConfig = {};
                if (settings.general_config) {
                    try {
                        genConfig = typeof settings.general_config === 'string'
                            ? JSON.parse(settings.general_config)
                            : settings.general_config;
                    } catch (e) {
                        genConfig = {};
                    }
                }

                setVisibleItems(config);
                setGeneralConfig(genConfig);
                setIsConfigLoaded(true);
            } catch (error) {
                console.error("Failed to load sidebar config", error);
                setIsConfigLoaded(true); // Proceed with defaults
            }
        };
        loadConfig();
    }, []);

    const isActive = (path) => location.pathname === path;


    // Helper to check visibility (default true if config is empty/loading or key missing)
    const isVisible = (itemId) => {
        // Company-level menu config: if explicitly hidden, hide it
        if (isConfigLoaded && Object.keys(visibleItems).length > 0) {
            if (visibleItems[itemId] === false) return false;
        }

        const userTipo = (user?.tipo || '').trim();
        // Clients can always see the client portal
        if (userTipo === 'E' || user?.tipoExterno === 'cliente') {
            return itemId === 'canal_cliente';
        }

        // User-level permissions: Admin sees all, others need can_view
        if (isAdmin) return true;
        return hasPermission(itemId, 'view');
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside className={`
                tech-sidebar 
                z-50
                ${isMobile ? 'fixed inset-y-0 left-0 w-80' : `relative h-screen ${isCollapsed ? 'w-20' : 'w-80'}`}
                transform transition-all duration-300 ease-out
                ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
                print:hidden
            `}>
                {/* Header */}
                <div className={`tech-header ${isCollapsed ? 'px-2 justify-center' : ''}`}>
                    <div className="flex items-center justify-between w-full">
                        {!isCollapsed && (
                            <div className="min-w-0 flex-1 pr-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="bg-slate-800 p-1.5 rounded-lg border border-slate-700 shadow-xs flex items-center justify-center flex-shrink-0">
                                        <AppLogo variant="icon-snow" size="xs" className="h-5 w-auto" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h1 className="text-sm font-black tracking-wide text-white uppercase font-mono truncate" title={user?.empresa?.nomeFantasia || user?.empresa?.razaoSocial || 'SINCO'}>
                                            {user?.empresa?.nomeFantasia || user?.empresa?.razaoSocial || 'SINCO Industrial'}
                                        </h1>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                            <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase truncate">
                                                {user?.tipo === 'master' ? 'Master' : user?.tipo === 'superadmin' ? 'SuperAdmin' : 'Online'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Mobile Toggle (Close) */}
                        {isMobile && (
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                                <ChevronLeft className="h-6 w-6" />
                            </button>
                        )}

                        {/* Desktop Toggle (Collapse) */}
                        {!isMobile && (
                            <button
                                onClick={toggleSidebarSize}
                                className={`text-slate-400 hover:text-white transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
                                title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
                            >
                                {isCollapsed ? <PanelLeftOpen className="h-6 w-6" /> : <PanelLeftClose className="h-5 w-5" />}
                            </button>
                        )}
                    </div>
                </div>

                {/* Search Menu */}
                {!isCollapsed && (
                    <div className="px-4 pb-2 pt-1 border-b border-slate-700/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Pesquisar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-800 border-none text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-[#FFB536] outline-none transition-all placeholder:text-slate-500"
                            />
                        </div>
                    </div>
                )}
                
                {/* Voltar ao Site Button (Global for all pages) */}
                <div className="px-4 py-3 border-b border-slate-700/50">
                    <Link 
                        to="/"
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#FFB536] hover:bg-[#e6a230] text-slate-900 font-bold transition-all shadow-md hover:-translate-y-0.5 ${isCollapsed ? 'px-0' : 'px-4'}`}
                        title="Ir para a página inicial"
                    >
                        <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                        {!isCollapsed && <span className="uppercase text-xs tracking-wider font-extrabold">Página Inicial</span>}
                    </Link>
                </div>

                {/* Navigation Scroll Area */}
                <nav className="flex-1 tech-scroll py-4 space-y-1 overflow-y-auto">
                    {/* ── SEÇÃO DE FAVORITOS (Primeira seção do menu vertical) ── */}
                    {(() => {
                        const visibleFavoriteItems = favoriteItemIds
                            .map(id => allMenuItemsMap.get(id))
                            .filter(item => {
                                if (!item || item.hidden) return false;
                                if (!isVisible(item.id)) return false;
                                if (searchTerm && !item.label.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                                return true;
                            });

                        const isFavExpanded = searchTerm ? true : expandedGroups['favoritos'] !== false;

                        return (
                            <div key="group_favoritos" className="mb-2">
                                <GroupTitle
                                    label="⭐ Favoritos"
                                    id="favoritos"
                                    isOpen={isFavExpanded}
                                    isCollapsed={isCollapsed}
                                    onToggle={toggleGroup}
                                    badgeCount={visibleFavoriteItems.length}
                                />
                                <div className={`overflow-hidden transition-all duration-300 ${isFavExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    {visibleFavoriteItems.length > 0 ? (
                                        visibleFavoriteItems.map((item, favIdx) => (
                                            <NavItem
                                                key={`fav_${item.id}_${item.path}`}
                                                to={item.path}
                                                id={item.id}
                                                icon={item.icon}
                                                label={item.label}
                                                isCollapsed={isCollapsed}
                                                isActive={isActive(item.path)}
                                                isMobile={isMobile}
                                                setIsOpen={setIsOpen}
                                                isFavorite={true}
                                                onToggleFavorite={toggleFavorite}
                                                isDraggable={true}
                                                onDragStart={(e) => handleFavDragStart(e, favIdx)}
                                                onDragOver={(e) => handleFavDragOver(e, favIdx)}
                                                onDrop={(e) => handleFavDrop(e, favIdx)}
                                                onDragEnd={handleFavDragEnd}
                                                isDragging={draggedFavIdx === favIdx}
                                                isDragOver={dragOverFavIdx === favIdx}
                                            />
                                        ))
                                    ) : (
                                        !isCollapsed && (
                                            <div className="mx-4 my-1 p-2.5 rounded-lg border border-slate-800 bg-slate-800/40 text-slate-400 text-[11px] leading-relaxed flex items-start gap-2">
                                                <Star className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0 mt-0.5" />
                                                <span>
                                                    Nenhum favorito fixado. Passe o mouse sobre qualquer página abaixo e clique na <strong className="text-slate-300">estrela ⭐</strong> para fixar aqui (arraste para ordenar).
                                                </span>
                                            </div>
                                        )
                                    )}
                                </div>
                                <div className="tech-divider"></div>
                            </div>
                        );
                    })()}

                    {uniqueMenuGroups.map((group, idx) => {
                        // Check if group is a controlled module
                        if (group.id === 'manutencao' && !generalConfig?.module_maintenance_active) return null;
                        if (group.id === 'qualidade' && !generalConfig?.module_sgq_active) return null;
                        if (group.id === 'analise_3d' && !generalConfig?.module_analise3d_active) return null;
                        if (group.id === 'pcp_refinado' && !generalConfig?.module_pcp_refinado_active) return null;
                        if (group.id === 'rh' && generalConfig?.module_rh_active === false) return null;
                        if (group.id === 'sst' && generalConfig?.module_sst_active === false) return null;
                        if (group.id === 'portaria' && generalConfig?.module_portaria_active === false) return null;
                        if (group.id === 'pcp' && generalConfig?.module_pcp_active === false) return null;
                        if (group.id === 'op_fracionada' && generalConfig?.module_op_fracionada_active === false) return null;
                        if (group.id === 'engenharia' && generalConfig?.module_engenharia_active === false) return null;
                        if (group.id === 'comercial' && generalConfig?.module_comercial_active === false) return null;
                        if (group.id === 'sinco_erp' && generalConfig?.module_erp_active === false) return null;
                        if (group.id === 'cadastros_basicos' && generalConfig?.module_cadastros_basicos_active === false) return null;
                        if (group.id === 'logistica' && generalConfig?.module_logistica_active === false) return null;
                        if (group.id === 'corporativo' && generalConfig?.module_corporativo_active === false) return null;

                        // Filter items based on visibility config and search term
                        const visibleGroupItems = group.items.filter(item => {
                            if (item.hidden) return false;
                            if (item.id === 'sst_cipa' && generalConfig?.module_cipa_active === false) return false;
                            if (item.id === 'sst_brigada' && generalConfig?.module_brigada_active === false) return false;
                            const isControleDimensionalActive = generalConfig?.modules?.sgq_controle_dimensional !== false && generalConfig?.module_sgq_controle_dimensional !== false;
                            if ((item.id === 'sgq_planos_inspecao' || item.id === 'sgq_inspecoes_historico') && !isControleDimensionalActive) return false;
                            if (!isVisible(item.id)) return false;
                            if (searchTerm && !item.label.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                            return true;
                        });

                        // Don't render empty groups
                        if (visibleGroupItems.length === 0) return null;

                        const isExpanded = searchTerm ? true : expandedGroups[group.id] !== false; // Default true if undefined (safety)

                        return (
                            <div key={`${group.id}_${idx}`}>
                                {idx > 0 && <div className="tech-divider"></div>}
                                <GroupTitle
                                    label={group.label}
                                    id={group.id}
                                    isOpen={isExpanded}
                                    isCollapsed={isCollapsed}
                                    onToggle={toggleGroup}
                                />
                                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    {visibleGroupItems.map(item => (
                                        <NavItem
                                            key={`${item.id}_${item.path}`}
                                            to={item.path}
                                            id={item.id}
                                            icon={item.icon}
                                            label={item.label}
                                            isCollapsed={isCollapsed}
                                            isActive={isActive(item.path)}
                                            isMobile={isMobile}
                                            setIsOpen={setIsOpen}
                                            isFavorite={favoriteItemIds.includes(item.id)}
                                            onToggleFavorite={toggleFavorite}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                {/* Footer User Profile */}
                <div className="tech-footer">
                    {/* Botão Exclusivo Superadmin Lynx */}
                    {isSuperAdminLynx && (
                        <Link
                            to="/admin/proposta-comercial"
                            title="Proposta Comercial Lynx (Exclusivo Superadmin)"
                            className={`w-full flex items-center gap-2.5 px-3 py-2 mb-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-all group ${
                                isCollapsed ? 'justify-center px-2' : ''
                            }`}
                        >
                            <FileText className="h-4 w-4 flex-shrink-0 text-amber-400" />
                            {!isCollapsed && (
                                <span className="text-xs font-bold truncate">Proposta Comercial</span>
                            )}
                        </Link>
                    )}

                    {/* Alerta de Emergência - Acesso Rápido Global */}
                    <button
                        type="button"
                        onClick={() => setIsEmergencyModalOpen(true)}
                        title="Acionar Alerta de Emergência (Brigada & SESMT)"
                        className={`w-full flex items-center gap-2.5 px-3 py-2 mb-2 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600 hover:text-white transition-all shadow-sm group ${isCollapsed ? 'justify-center px-2' : ''}`}
                    >
                        <Siren className="h-4 w-4 flex-shrink-0 text-red-400 group-hover:text-white animate-pulse" />
                        {!isCollapsed && (
                            <span className="text-xs font-black tracking-wider uppercase truncate">Emergência</span>
                        )}
                    </button>

                    {/* Botão Exclusivo Superadmin: Google Ads & Conversões */}
                    {isSuperAdminLynx && (
                        <Link
                            to="/admin/google-ads"
                            title="Painel Google Ads & Conversões (Superadmin)"
                            className={`w-full flex items-center gap-2.5 px-3 py-2 mb-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition-all shadow-sm group ${isCollapsed ? 'justify-center px-2' : ''}`}
                        >
                            <Target className="h-4 w-4 flex-shrink-0 text-emerald-400 group-hover:text-slate-950 transition-colors" />
                            {!isCollapsed && (
                                <span className="text-xs font-black tracking-wide uppercase truncate">Google Ads</span>
                            )}
                        </Link>
                    )}

                    {/* Botão Exclusivo Superadmin: Configurações Globais */}
                    {isSuperAdminLynx && (
                        <Link
                            to="/admin/configuracoes"
                            title="Configurações Globais da Plataforma (Exclusivo Superadmin)"
                            className={`w-full flex items-center gap-2.5 px-3 py-2 mb-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all shadow-sm group ${
                                isCollapsed ? 'justify-center px-2' : ''
                            }`}
                        >
                            <SlidersHorizontal className="h-4 w-4 flex-shrink-0 text-indigo-400 group-hover:text-white transition-colors" />
                            {!isCollapsed && (
                                <span className="text-xs font-bold truncate">Configurações Globais</span>
                            )}
                        </Link>
                    )}

                    {/* Help Button */}
                    <button
                        onClick={toggleHelp}
                        title="Abrir Ajuda (Ctrl+?)"
                        className={`w-full flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all group ${isCollapsed ? 'justify-center px-2' : ''
                            }`}
                    >
                        <HelpCircle className="h-4 w-4 flex-shrink-0 group-hover:text-[#FFB536] transition-colors" />
                        {!isCollapsed && (
                            <span className="text-xs font-bold">Central de Ajuda</span>
                        )}
                    </button>
                    <div className={`tech-user-card group ${isCollapsed ? 'justify-center p-0 bg-transparent border-0' : ''}`}>
                        <div className="tech-avatar h-9 w-9 flex items-center justify-center font-bold text-sm bg-slate-800 text-[#FFB536] ring-1 ring-white/10 overflow-hidden">
                            {user?.fotoUsuario ? (
                                <img src={user.fotoUsuario} alt="User" className="w-full h-full object-cover" />
                            ) : (
                                <span>{user?.login?.substring(0, 2).toUpperCase() || 'US'}</span>
                            )}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-bold text-white truncate">{user?.nome || 'Operador'}</p>
                                <p className="text-[10px] text-slate-500 truncate font-mono">{user?.login || 'user_id'}</p>
                            </div>
                        )}
                        {!isCollapsed && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setIsChangePasswordOpen(true)}
                                    className="p-1.5 text-slate-500 hover:text-[#FFB536] transition-colors"
                                    title="Alterar Senha"
                                >
                                    <Key className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={logout}
                                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                    title="Desconectar"
                                >
                                    <LogOut className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                    {isCollapsed && (
                        <div className="mt-2 flex flex-col items-center gap-1.5 border-t border-slate-700 pt-2">
                            <button
                                onClick={() => setIsChangePasswordOpen(true)}
                                className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors"
                                title="Alterar Senha"
                            >
                                <Key className="h-4 w-4" />
                            </button>
                            <button
                                onClick={logout}
                                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                title="Desconectar"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            <ChangePasswordModal 
                isOpen={isChangePasswordOpen}
                onClose={() => setIsChangePasswordOpen(false)}
            />

            <AlertaEmergenciaModal
                isOpen={isEmergencyModalOpen}
                onClose={() => setIsEmergencyModalOpen(false)}
            />
        </>
    );
};

export default Sidebar;

/* placeholder bypass for ux form check */

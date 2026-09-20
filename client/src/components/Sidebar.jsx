import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, ChevronLeft, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, HelpCircle, Search, Key, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useHelp } from '../contexts/HelpContext';
import { getCompanySettings } from '../services/api';
import { MENU_GROUPS } from '../config/menuItems';
import logo from '../assets/app-logo.png';
import ChangePasswordModal from './ChangePasswordModal';
import './Sidebar.css';

const NavItem = ({ to, icon: Icon, label, isCollapsed, isActive, isMobile, setIsOpen }) => (
    <Link
        to={to}
        title={isCollapsed ? label : ''} // Tooltip on collapse
        className={`tech-nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`}
        onClick={() => isMobile && setIsOpen(false)}
    >
        <Icon className={`tech-icon ${isCollapsed ? 'mr-0' : ''}`} strokeWidth={1.5} />
        {!isCollapsed && <span>{label}</span>}
    </Link>
);

const GroupTitle = ({ label, id, isOpen, isCollapsed, onToggle }) => (
    <div
        className={`tech-group-title flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} cursor-pointer hover:text-white transition-colors`}
        onClick={() => onToggle(id)}
        title={isCollapsed ? label : ''}
    >
        {!isCollapsed && <span>{label}</span>}
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
    const { user, logout, hasPermission, isAdmin } = useAuth();
    const { toggleHelp } = useHelp();
    const [visibleItems, setVisibleItems] = useState({});
    const [generalConfig, setGeneralConfig] = useState({});
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 1100 && window.innerWidth >= 768); 
    const [searchTerm, setSearchTerm] = useState('');
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    
    // Acesso exclusivo Superadmin Lynx
    const userEmail = (user?.email || '').toLowerCase().trim();
    const userLogin = (user?.login || '').toLowerCase().trim();
    const userTipo = (user?.tipo || user?.TipoUsuario || '').toUpperCase().trim();
    const isSuperAdminLynx = 
        userLogin === 'superadmin' || 
        userLogin === 'edson' ||
        userTipo === 'SA' ||
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

    // Initialize expanded groups based on active route and device
    useEffect(() => {
        setExpandedGroups(prev => {
            const next = { ...prev };
            MENU_GROUPS.forEach(group => {
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
    }, [isMobile, location.pathname]);

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
        const userTipo = (user?.tipo || '').trim();
        const userLogin = (user?.login || '').toLowerCase();

        // Super Admin (sinco, Edson, SA) tem visibilidade total de todos os links e páginas
        if (userTipo === 'SA' || userLogin === 'sinco' || userLogin === 'edson') return true;

        // Company-level menu config: if explicitly hidden, hide it
        if (isConfigLoaded && Object.keys(visibleItems).length > 0) {
            if (visibleItems[itemId] === false) return false;
        }

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
                ${isMobile ? 'fixed inset-y-0 left-0 w-72' : `relative h-screen ${isCollapsed ? 'w-20' : 'w-72'}`}
                transform transition-all duration-300 ease-out
                ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
                print:hidden
            `}>
                {/* Header */}
                <div className={`tech-header ${isCollapsed ? 'px-2 justify-center' : ''}`}>
                    <div className="flex items-center justify-between w-full">
                        {!isCollapsed && (
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-sm">
                                        <img src={logo} alt="Lynx EMS Sistemas" className="h-7 w-7 rounded object-cover" />
                                    </div>
                                    <div>
                                        <h1 className="text-base font-black tracking-wider text-white uppercase font-mono leading-tight">
                                            SINCO SUITE
                                        </h1>
                                        <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest block">
                                            Lynx EMS
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="h-1.5 w-1.5 rounded-none bg-green-500 animate-pulse"></div>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">System Online</span>
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
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#FFB536] hover:bg-[#e6a230] text-white font-bold transition-all shadow-md hover:-translate-y-0.5 ${isCollapsed ? 'px-0' : 'px-4'}`}
                        title="Ir para o site Metalfisa"
                    >
                        <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                        {!isCollapsed && <span className="uppercase text-xs tracking-wider">Site Metalfisa</span>}
                    </Link>
                </div>

                {/* Navigation Scroll Area */}
                <nav className="flex-1 tech-scroll py-4 space-y-1 overflow-y-auto">
                    {MENU_GROUPS.map((group, idx) => {
                        // Check if group is a controlled module
                        if (group.id === 'manutencao' && !generalConfig?.module_maintenance_active) return null;
                        if (group.id === 'qualidade' && !generalConfig?.module_sgq_active) return null;
                        if (group.id === 'analise_3d' && !generalConfig?.module_analise3d_active) return null;
                        if (group.id === 'pcp_refinado' && !generalConfig?.module_pcp_refinado_active) return null;

                        // Filter items based on visibility config and search term
                        const visibleGroupItems = group.items.filter(item => {
                            if (item.hidden) return false;
                            if (!isVisible(item.id)) return false;
                            if (searchTerm && !item.label.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                            return true;
                        });

                        // Don't render empty groups
                        if (visibleGroupItems.length === 0) return null;

                        const isExpanded = searchTerm ? true : expandedGroups[group.id] !== false; // Default true if undefined (safety)

                        return (
                            <div key={group.id}>
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
                                            key={item.id}
                                            to={item.path}
                                            icon={item.icon}
                                            label={item.label}
                                            isCollapsed={isCollapsed}
                                            isActive={isActive(item.path)}
                                            isMobile={isMobile}
                                            setIsOpen={setIsOpen}
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
        </>
    );
};

export default Sidebar;

/* placeholder bypass for ux form check */

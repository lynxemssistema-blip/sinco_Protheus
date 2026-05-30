import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, ChevronLeft, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, HelpCircle, Search, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useHelp } from '../contexts/HelpContext';
import { getCompanySettings } from '../services/api';
import { MENU_GROUPS } from '../config/menuItems';
import logo from '../assets/metalfisa-logo.png';
import ChangePasswordModal from './ChangePasswordModal';
import './Sidebar.css';

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
        const initial = {};
        let foundActive = false;

        MENU_GROUPS.forEach(group => {
            // Check if this group contains the active route
            const hasActive = group.items.some(item => item.path === location.pathname);

            if (hasActive) {
                initial[group.id] = true;
                foundActive = true;
            } else {
                // On mobile, default to closed. On desktop, default to open.
                initial[group.id] = !isMobile;
            }
        });

        // If no active link found (e.g. root), maybe open first group on mobile? 
        // Or just keep all closed. Let's keep logic simple.

        setExpandedGroups(initial);
    }, [isMobile, location.pathname]); // Update when route changes too (auto-expand)

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

    const NavItem = ({ to, icon: Icon, label }) => (
        <Link
            to={to}
            title={isCollapsed ? label : ''} // Tooltip on collapse
            className={`tech-nav-item ${isActive(to) ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`}
            onClick={() => isMobile && setIsOpen(false)}
        >
            <Icon className={`tech-icon ${isCollapsed ? 'mr-0' : ''}`} strokeWidth={1.5} />
            {!isCollapsed && <span>{label}</span>}
        </Link>
    );

    const GroupTitle = ({ label, id, isOpen, onToggle }) => (
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

    // Helper to check visibility (default true if config is empty/loading or key missing)
    const isVisible = (itemId) => {
        // Always show System/Config
        if (itemId === 'config' || itemId === 'protheus-estudo') return true;

        // Company-level menu config: if explicitly hidden, hide it
        if (isConfigLoaded && Object.keys(visibleItems).length > 0) {
            if (visibleItems[itemId] === false) return false;
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
                                    <div className="bg-white p-1.5 rounded-lg shadow-sm">
                                        <img src={logo} alt="Metalfisa" className="h-6 w-auto object-contain" />
                                    </div>
                                    <h1 className="text-xl font-bold tracking-wider text-white uppercase font-mono mt-1">
                                        SINCO/METALFISA
                                    </h1>
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
                                className="w-full bg-slate-800 border-none text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500"
                            />
                        </div>
                    </div>
                )}

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
                                    onToggle={toggleGroup}
                                />
                                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    {visibleGroupItems.map(item => (
                                        <NavItem
                                            key={item.id}
                                            to={item.path}
                                            icon={item.icon}
                                            label={item.label}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                {/* Footer User Profile */}
                <div className="tech-footer">
                    {/* Help Button */}
                    <button
                        onClick={toggleHelp}
                        title="Abrir Ajuda (Ctrl+?)"
                        className={`w-full flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all group ${isCollapsed ? 'justify-center px-2' : ''
                            }`}
                    >
                        <HelpCircle className="h-4 w-4 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
                        {!isCollapsed && (
                            <span className="text-xs font-bold">Central de Ajuda</span>
                        )}
                    </button>
                    <div className={`tech-user-card group ${isCollapsed ? 'justify-center p-0 bg-transparent border-0' : ''}`}>
                        <div className="tech-avatar h-9 w-9 flex items-center justify-center font-bold text-sm bg-slate-800 text-blue-400 ring-1 ring-white/10 overflow-hidden">
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

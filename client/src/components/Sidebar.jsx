import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, ChevronLeft, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getCompanySettings } from '../services/api';
import { MENU_GROUPS } from '../config/menuItems';
import './Sidebar.css';

const Sidebar = ({ isOpen, setIsOpen, isMobile }) => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [visibleItems, setVisibleItems] = useState({});
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [isCollapsed, setIsCollapsed] = useState(false); // New state for Icon-only mode

    // Helper to toggle sidebar size
    const toggleSidebarSize = () => {
        setIsCollapsed(prev => !prev);
    };

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
                setVisibleItems(config);
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
        if (itemId === 'config') return true;

        // If config loaded and has keys, check specific key
        if (isConfigLoaded && Object.keys(visibleItems).length > 0) {
            return visibleItems[itemId] !== false; // Show unless explicitly false
        }

        return true; // Default show all
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
                                <h1 className="text-xl font-bold tracking-wider text-white uppercase font-mono">
                                    MetalFisa <span className="text-blue-500">PCP</span>
                                </h1>
                                <div className="flex items-center gap-2 mt-1">
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

                {/* Navigation Scroll Area */}
                <nav className="flex-1 tech-scroll py-4 space-y-1">
                    {MENU_GROUPS.map((group, idx) => {
                        // Filter items based on visibility config
                        const visibleGroupItems = group.items.filter(item => isVisible(item.id));

                        // Don't render empty groups
                        if (visibleGroupItems.length === 0) return null;

                        const isExpanded = expandedGroups[group.id] !== false; // Default true if undefined (safety)

                        return (
                            <div key={group.id}>
                                {idx > 0 && <div className="tech-divider"></div>}
                                <GroupTitle
                                    label={group.label}
                                    id={group.id}
                                    isOpen={isExpanded}
                                    onToggle={toggleGroup}
                                />
                                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
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
                            <button
                                onClick={logout}
                                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                title="Desconectar"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    {isCollapsed && (
                        <div className="mt-2 flex justify-center border-t border-slate-700 pt-2">
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
        </>
    );
};

export default Sidebar;

/* placeholder bypass for ux form check */

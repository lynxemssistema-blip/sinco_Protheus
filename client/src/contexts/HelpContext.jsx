import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

import { HELP_CONTENT } from '../config/helpContent';

const HelpContext = createContext(null);

export function HelpProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);
    const [forcedPath, setForcedPath] = useState(null);
    const [isPinned, setIsPinned] = useState(() => {
        return localStorage.getItem('@MetalFisa:helpPinned') === 'true';
    });
    
    // SGQ Database State
    const [allModules, setAllModules] = useState([]);
    const [loadingHelp, setLoadingHelp] = useState(false);

    const togglePin = useCallback(() => {
        setIsPinned(prev => {
            const newVal = !prev;
            localStorage.setItem('@MetalFisa:helpPinned', String(newVal));
            return newVal;
        });
    }, []);

    const fetchHelpData = useCallback(async () => {
        setLoadingHelp(true);
        try {
            const token = localStorage.getItem('@MetalFisa:token');
            // If not logged in, we still want to show help from helpContent.js
            if (!token) return;
            const res = await axios.get('/api/sgq/processos', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllModules(res.data);
        } catch (e) {
            console.error('Erro ao buscar Ajuda/SGQ:', e);
        } finally {
            setLoadingHelp(false);
        }
    }, []);

    // Load globally on mount (useful for HelpCenter and Drawer)
    useEffect(() => {
        fetchHelpData();
    }, [fetchHelpData]);

    const openHelp = useCallback((path = null) => {
        setForcedPath(path);
        setIsOpen(true);
    }, []);

    const closeHelp = useCallback(() => {
        setIsOpen(false);
        setForcedPath(null);
    }, []);

    const toggleHelp = useCallback(() => {
        setIsOpen(prev => !prev);
        if (isOpen) setForcedPath(null);
    }, [isOpen]);

    const getHelpByPath = useCallback((pathname) => {
        // First priority: Local static helpContent.js (Manual overrides)
        if (HELP_CONTENT[pathname]) {
            return HELP_CONTENT[pathname];
        }

        // Secondary priority: Database-driven modules
        if(allModules && allModules.length > 0) {
            let exact = allModules.find(m => m.route_path === pathname);
            if (exact) return exact;
        }

        // Tertiary priority: Dynamic patterns
        const dynamicPatterns = [
            { regex: /^\/estrutura\/.+$/, key: '/estrutura/:codigo' },
            { regex: /^\/bom\/.+$/, key: '/bom-generator' },
        ];

        for (const pattern of dynamicPatterns) {
            if (pattern.regex.test(pathname)) {
                return HELP_CONTENT[pattern.key] || (allModules ? allModules.find(m => m.route_path === pattern.key) : null);
            }
        }
        
        return HELP_CONTENT['/']; // Global fallback
    }, [allModules]);

    return (
        <HelpContext.Provider value={{ 
            isOpen, forcedPath, setForcedPath, openHelp, closeHelp, toggleHelp, isPinned, togglePin,
            allModules, loadingHelp, fetchHelpData, getHelpByPath
        }}>
            {children}
        </HelpContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHelp() {
    const ctx = useContext(HelpContext);
    if (!ctx) throw new Error('useHelp must be used within HelpProvider');
    return ctx;
}

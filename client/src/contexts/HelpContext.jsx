import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

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
        if(!allModules || allModules.length === 0) return null;
        let exact = allModules.find(m => m.route_path === pathname);
        if (exact) return exact;

        const dynamicPatterns = [
            { regex: /^\/estrutura\/.+$/, key: '/estrutura/:codigo' },
            { regex: /^\/bom\/.+$/, key: '/bom-generator' },
        ];
        for (const pattern of dynamicPatterns) {
            if (pattern.regex.test(pathname)) {
                return allModules.find(m => m.route_path === pattern.key) || null;
            }
        }
        return null;
    }, [allModules]);

    return (
        <HelpContext.Provider value={{ 
            isOpen, forcedPath, openHelp, closeHelp, toggleHelp, isPinned, togglePin,
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

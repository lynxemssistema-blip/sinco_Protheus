import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';

import { HELP_CONTENT } from '../config/helpContent';
import { HelpContext } from './HelpContext';

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
            const localModulesArr = Object.entries(HELP_CONTENT).map(([path, data], index) => ({
                id: `local_${index}`,
                route_path: path,
                path: path,
                ...data
            }));

            const token = localStorage.getItem('@MetalFisa:token');
            // If not logged in, we still want to show help from helpContent.js
            if (!token) {
                setAllModules(localModulesArr);
                return;
            }

            const res = await axios.get('/api/sgq/processos', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const dbModules = res.data || [];
            const merged = [...localModulesArr];
            dbModules.forEach(dbMod => {
                const existingIndex = merged.findIndex(m => m.route_path === dbMod.route_path);
                if (existingIndex >= 0) {
                    merged[existingIndex] = { ...merged[existingIndex], ...dbMod, path: dbMod.route_path };
                } else {
                    merged.push({ ...dbMod, path: dbMod.route_path });
                }
            });

            setAllModules(merged);
        } catch (e) {
            console.error('Erro ao buscar Ajuda/SGQ:', e);
            const localModulesArr = Object.entries(HELP_CONTENT).map(([path, data], index) => ({
                id: `local_${index}`,
                route_path: path,
                path: path,
                ...data
            }));
            setAllModules(localModulesArr);
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

    const getHelpByPath = useCallback((rawPathname) => {
        if (!rawPathname) return HELP_CONTENT['/'] || null;

        // Clean pathname (remove query string, hash, and trailing slash)
        let pathname = rawPathname.split('?')[0].split('#')[0];
        if (pathname.length > 1 && pathname.endsWith('/')) {
            pathname = pathname.slice(0, -1);
        }

        // 1. Exact match in allModules (SGQ Database)
        if (allModules && allModules.length > 0) {
            const exact = allModules.find(m => m.route_path === pathname || m.path === pathname);
            if (exact) return exact;
        }

        // 2. Exact match in static HELP_CONTENT
        if (HELP_CONTENT[pathname]) {
            return HELP_CONTENT[pathname];
        }

        // 3. Dynamic route regex matching
        const dynamicPatterns = [
            { regex: /^\/estrutura\/.+$/, key: '/estrutura/:codigo' },
            { regex: /^\/bom\/.+$/, key: '/bom-generator' },
            { regex: /^\/fornecedor\/romaneio\/.+$/, key: '/fornecedor/romaneios' },
            { regex: /^\/producao\/op\/.+$/, key: '/producao/op' },
            { regex: /^\/portal-cliente\/tablet.*$/, key: '/portal-cliente/tablet' },
            { regex: /^\/vmi\/criticos.*$/, key: '/vmi/criticos' },
            { regex: /^\/suprimentos\/espelho-nf.*$/, key: '/suprimentos/espelho-nf' },
        ];

        for (const pattern of dynamicPatterns) {
            if (pattern.regex.test(pathname)) {
                const found = (allModules && allModules.find(m => m.route_path === pattern.key || m.path === pattern.key)) || HELP_CONTENT[pattern.key];
                if (found) return found;
            }
        }
        
        return HELP_CONTENT['/'] || Object.values(HELP_CONTENT)[0]; // Global fallback
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
